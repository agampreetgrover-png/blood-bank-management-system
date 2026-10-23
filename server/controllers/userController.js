const { pool } = require('../config/db');
const { signToken, verifyToken } = require('../utils/tokens');
const { passwordProblem, hashPassword, checkPassword } = require('../utils/passwords');
const { EMAIL_RE, PHONE_RE, cleanPhone } = require('../utils/validation');
const {
  encryptSecret, decryptSecret, newSecret, setupInfo, checkCode,
  newBackupCodes, backupCodesLeft, verifyUserCode, INCORRECT
} = require('../utils/totp');

const USER_SELECT = `SELECT u.*, bg.group_name AS blood_group FROM users u
  LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id`;

const DEACTIVATED = 'This account has been deactivated. Please contact the blood bank.';
const LOGIN_EXPIRED = 'Your login has expired. Please log in again.';
const SIGNUP_EXPIRED = 'This sign up has expired. Please start again.';

// Login accepts the email address or the phone number
async function findByIdentifier(identifier) {
  const id = String(identifier || '').trim().toLowerCase();
  const [rows] = await pool.query(`${USER_SELECT} WHERE u.email = ? OR u.phone = ?`, [id, cleanPhone(id)]);
  return rows[0];
}

async function findById(id) {
  const [[user]] = await pool.query(`${USER_SELECT} WHERE u.id = ?`, [id]);
  return user;
}

// ver must match users.token_version for the token to be accepted (see middleware/userAuth.js)
function signUserToken(user) {
  return signToken('user', { id: user.id, name: user.full_name, email: user.email, ver: user.token_version });
}

function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    blood_group_id: user.blood_group_id,
    blood_group: user.blood_group || null
  };
}

function sessionResponse(message, user) {
  return { message, token: signUserToken(user), user: publicUser(user) };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Runs fn(conn) in a transaction and returns its result
async function inTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// What the client shows to add the account to an authenticator app
async function setupResponse(secret, email) {
  const { qr } = await setupInfo(secret, email);
  return { secret, qr };
}

// POST /api/users/signup - { full_name, email, phone, password, blood_group_id? }
// Checks the details and returns a QR code for the authenticator app. Nothing is saved yet:
// the details travel in setup_token and the account is created at /signup/verify.
async function startSignup(req, res) {
  try {
    const { full_name, phone, password, blood_group_id } = req.body;
    const cleanEmail = normalizeEmail(req.body.email);

    if (!full_name || !String(full_name).trim() || !cleanEmail || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone and password are required.' });
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const mobile = cleanPhone(phone);
    if (!PHONE_RE.test(mobile)) {
      return res.status(400).json({ message: 'Phone number must be a valid 10-digit mobile number.' });
    }

    const problem = passwordProblem(password);
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    let bloodGroupId = null;
    if (blood_group_id) {
      const [bgCheck] = await pool.query('SELECT id FROM blood_groups WHERE id = ?', [blood_group_id]);
      if (bgCheck.length === 0) {
        return res.status(400).json({ message: 'Invalid blood group selected.' });
      }
      bloodGroupId = bgCheck[0].id;
    }

    const [existing] = await pool.query(
      'SELECT email, phone FROM users WHERE email = ? OR phone = ?',
      [cleanEmail, mobile]
    );
    if (existing.length > 0) {
      const field = existing.some((u) => u.email === cleanEmail) ? 'email address' : 'phone number';
      return res.status(409).json({ message: `An account with this ${field} already exists. Please log in.` });
    }

    // The token is signed, not hidden, so it only carries the bcrypt hash and the encrypted secret
    const secret = newSecret();
    const setup_token = signToken('signup', {
      full_name: String(full_name).trim(),
      email: cleanEmail,
      phone: mobile,
      blood_group_id: bloodGroupId,
      password_hash: await hashPassword(password),
      secret: encryptSecret(secret)
    });

    res.json({ setup_token, setup: await setupResponse(secret, cleanEmail) });
  } catch (error) {
    console.error('Start signup error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/users/signup/verify - { setup_token, code }
// A code from the newly added authenticator creates the account, its backup codes, and logs in.
async function verifySignup(req, res) {
  try {
    const pending = verifyToken(req.body.setup_token, 'signup');
    if (!pending) {
      return res.status(400).json({ message: SIGNUP_EXPIRED });
    }

    let secret;
    try {
      secret = decryptSecret(pending.secret);
    } catch {
      return res.status(400).json({ message: SIGNUP_EXPIRED });
    }
    const step = checkCode(secret, req.body.code);
    if (step === null) {
      return res.status(400).json({ message: INCORRECT.message });
    }

    const { full_name, email, phone, blood_group_id, password_hash } = pending;
    let created;
    try {
      created = await inTransaction(async (conn) => {
        const [result] = await conn.query(
          `INSERT INTO users (full_name, email, phone, password, blood_group_id, totp_secret, totp_last_step)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [full_name, email, phone, password_hash, blood_group_id, pending.secret, step]
        );
        const codes = await newBackupCodes(result.insertId, conn);
        return { id: result.insertId, codes };
      });
    } catch (error) {
      // Someone registered this email/phone since the details were checked (or this sign up was already finished)
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'An account with these details already exists. Please log in.' });
      }
      throw error;
    }

    const user = await findById(created.id);
    res.status(201).json({ ...sessionResponse('Account created successfully.', user), backup_codes: created.codes });
  } catch (error) {
    console.error('Verify signup error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/users/login - step 1 of 2: { identifier, password }, identifier is the email or phone number.
// The right password doesn't log in by itself: it returns an mfa_token for /login/verify.
// stage 'verify': enter the code from the authenticator app (or a backup code).
// stage 'setup': no authenticator yet, so the account sets one up first (QR code included).
async function loginUser(req, res) {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/phone and password are required.' });
    }

    const user = await findByIdentifier(identifier);
    // An account without a password can't log in
    if (!(await checkPassword(password, user?.password))) {
      return res.status(401).json({ message: 'Invalid email/phone or password.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: DEACTIVATED });
    }

    const claims = { id: user.id, ver: user.token_version };
    if (user.totp_secret) {
      return res.json({ stage: 'verify', mfa_token: signToken('mfa', { ...claims, stage: 'verify' }) });
    }

    const secret = newSecret();
    res.json({
      stage: 'setup',
      mfa_token: signToken('mfa', { ...claims, stage: 'setup', secret: encryptSecret(secret) }),
      setup: await setupResponse(secret, user.email)
    });
  } catch (error) {
    console.error('Login user error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
}

// POST /api/users/login/verify - step 2 of 2: { mfa_token, code }
async function verifyLogin(req, res) {
  try {
    const pending = verifyToken(req.body.mfa_token, 'mfa');
    if (!pending) {
      return res.status(400).json({ message: LOGIN_EXPIRED });
    }

    const user = await findById(pending.id);
    // A password reset or an authenticator reset since step 1 raises token_version
    if (!user || user.token_version !== pending.ver) {
      return res.status(400).json({ message: LOGIN_EXPIRED });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: DEACTIVATED });
    }

    if (pending.stage === 'verify') {
      if (!user.totp_secret) {
        return res.status(400).json({ message: LOGIN_EXPIRED });
      }
      const result = await verifyUserCode(user.id, req.body.code);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.message });
      }
      return res.json({ ...sessionResponse('Login successful', user), backup_codes_left: await backupCodesLeft(user.id) });
    }

    if (pending.stage !== 'setup' || user.totp_secret) {
      return res.status(400).json({ message: LOGIN_EXPIRED });
    }
    const result = await verifyUserCode(user.id, req.body.code, { pendingSecret: pending.secret });
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    // Saved only if no authenticator was set up in the meantime
    const codes = await inTransaction(async (conn) => {
      const [saved] = await conn.query(
        `UPDATE users SET totp_secret = ?, totp_last_step = ?, mfa_failures = 0, mfa_locked_until = NULL
         WHERE id = ? AND totp_secret IS NULL AND token_version = ?`,
        [pending.secret, result.step, user.id, pending.ver]
      );
      if (saved.affectedRows === 0) return null;
      return newBackupCodes(user.id, conn);
    });
    if (!codes) {
      return res.status(400).json({ message: LOGIN_EXPIRED });
    }

    res.json({ ...sessionResponse('Login successful', user), backup_codes: codes });
  } catch (error) {
    console.error('Verify login error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/users/password/reset - { identifier, code, password }
// The authenticator code (or a backup code) proves it's the owner. The new password replaces the old one,
// every other session for the account is signed out, and the user is logged in here.
// An account without an authenticator gets the same answer as a wrong code; staff can help such users.
async function resetPassword(req, res) {
  try {
    const { identifier, code, password } = req.body;
    if (!identifier || !code) {
      return res.status(400).json({ message: 'Email/phone and code are required.' });
    }
    // Checked before the code, so a password that isn't allowed doesn't count as a wrong code
    const problem = passwordProblem(password);
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    const account = await findByIdentifier(identifier);
    if (!account || !account.totp_secret) {
      return res.status(400).json({ message: INCORRECT.message });
    }

    const result = await verifyUserCode(account.id, code);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    if (!account.is_active) {
      return res.status(403).json({ message: DEACTIVATED });
    }

    await pool.query(
      'UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?',
      [await hashPassword(password), account.id]
    );
    const user = await findById(account.id);

    res.json(sessionResponse('Your password has been changed.', user));
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/users/mfa/backup-codes - { code } with the current authenticator code.
// Replaces all backup codes with 8 new ones.
async function regenerateBackupCodes(req, res) {
  try {
    const result = await verifyUserCode(req.user.id, req.body.code, { allowBackup: false });
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    const codes = await inTransaction((conn) => newBackupCodes(req.user.id, conn));
    res.json({ backup_codes: codes });
  } catch (error) {
    console.error('Backup codes error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

// GET /api/users/me - profile plus the user's own donor profile, donations and blood requests.
// Everything is filtered by the logged-in user's id, so nobody can see another person's records.
async function getMyAccount(req, res) {
  try {
    const [rows] = await pool.query(`${USER_SELECT} WHERE u.id = ? AND u.is_active = 1`, [req.user.id]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Account not found. Please log in again.' });
    }

    const [donations] = await pool.query(
      `SELECT dn.id, dn.donation_date, dn.units_donated, dn.status, bg.group_name AS blood_group
       FROM donations dn
       INNER JOIN donors d ON dn.donor_id = d.id
       INNER JOIN blood_groups bg ON dn.blood_group_id = bg.id
       WHERE d.user_id = ?
       ORDER BY dn.donation_date DESC, dn.id DESC`,
      [req.user.id]
    );

    const [requests] = await pool.query(
      `SELECT br.id, br.units_required, br.hospital, br.request_date, br.urgency, br.status,
              p.full_name AS patient_name, bg.group_name AS blood_group
       FROM blood_requests br
       INNER JOIN patients p ON br.patient_id = p.id
       INNER JOIN blood_groups bg ON br.blood_group_id = bg.id
       WHERE br.user_id = ?
       ORDER BY br.created_at DESC`,
      [req.user.id]
    );

    const [[donor]] = await pool.query(
      'SELECT id, is_active, is_eligible, last_donation_date FROM donors WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      user: publicUser(rows[0]),
      donor: donor || null,
      donations,
      requests,
      backup_codes_left: await backupCodesLeft(req.user.id)
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ message: 'Failed to load account.' });
  }
}

module.exports = {
  startSignup,
  verifySignup,
  loginUser,
  verifyLogin,
  resetPassword,
  regenerateBackupCodes,
  getMyAccount
};
