const { pool } = require('../config/db');
const { sendOtpEmail } = require('../utils/mailer');
const { issueOtp, discardOtp, consumeOtp, RESEND_COOLDOWN_SECONDS, OTP_TTL_MINUTES } = require('../utils/otp');
const { signToken } = require('../utils/tokens');
const { passwordProblem, hashPassword, checkPassword } = require('../utils/passwords');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USER_SELECT = `SELECT u.*, bg.group_name AS blood_group FROM users u
  LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id`;

// Login accepts the email address or the phone number
async function findByIdentifier(identifier) {
  const id = String(identifier || '').trim().toLowerCase();
  const [rows] = await pool.query(`${USER_SELECT} WHERE u.email = ? OR u.phone = ?`, [id, id.replace(/[\s-]/g, '')]);
  return rows[0];
}

// "jane.doe@gmail.com" -> "ja***@gmail.com". Someone can log in with a phone number,
// and knowing the password alone shouldn't reveal the account's email address.
function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, Math.min(2, name.length - 1))}***@${domain}`;
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

function otpSentResponse(email, resendIn = RESEND_COOLDOWN_SECONDS) {
  return {
    message: `We sent a 6-digit code to ${email}.`,
    email,
    resend_in: resendIn,
    expires_in: OTP_TTL_MINUTES * 60
  };
}

// Issues a code and emails it. Returns the throttle result instead of sending when asked too often.
async function sendCode(email, purpose, payload) {
  const issued = await issueOtp(email, purpose, payload);
  if (issued.throttled) return issued;
  try {
    await sendOtpEmail(email, issued.code, purpose);
  } catch (error) {
    await discardOtp(issued.id);
    throw error;
  }
  return issued;
}

// POST /api/users/signup/request-otp
// Validates the sign up details and emails a code. The account is only created once the code is verified.
async function requestSignupOtp(req, res) {
  try {
    const { full_name, phone, password, blood_group_id } = req.body;
    const cleanEmail = normalizeEmail(req.body.email);

    if (!full_name || !String(full_name).trim() || !cleanEmail || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone and password are required.' });
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const cleanPhone = String(phone).replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
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
      [cleanEmail, cleanPhone]
    );
    if (existing.length > 0) {
      const field = existing.some((u) => u.email === cleanEmail) ? 'email address' : 'phone number';
      return res.status(409).json({ message: `An account with this ${field} already exists. Please log in.` });
    }

    // Only the bcrypt hash waits in otp_codes until the email is verified, never the plain password
    const result = await sendCode(cleanEmail, 'signup', {
      full_name: String(full_name).trim(),
      phone: cleanPhone,
      blood_group_id: bloodGroupId,
      password_hash: await hashPassword(password)
    });
    if (result.throttled) {
      return res.status(429).json({ message: 'Please wait before requesting another code.', retry_after: result.retryAfter });
    }

    res.json(otpSentResponse(cleanEmail));
  } catch (error) {
    console.error('Signup OTP error:', error);
    res.status(502).json({ message: "We couldn't send the verification email. Please try again." });
  }
}

// POST /api/users/signup/verify - { email, code }. A valid code creates the account and logs in.
async function verifySignup(req, res) {
  try {
    const cleanEmail = normalizeEmail(req.body.email);
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const result = await consumeOtp(cleanEmail, 'signup', req.body.code);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    const { full_name, phone, blood_group_id, password_hash } = result.payload;
    try {
      await pool.query(
        'INSERT INTO users (full_name, email, phone, password, blood_group_id) VALUES (?, ?, ?, ?, ?)',
        [full_name, cleanEmail, phone, password_hash, blood_group_id]
      );
    } catch (error) {
      // Someone registered this email/phone between the request and the verification
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'An account with these details already exists. Please log in.' });
      }
      throw error;
    }

    const [[user]] = await pool.query(`${USER_SELECT} WHERE u.email = ?`, [cleanEmail]);
    res.status(201).json(sessionResponse('Account created successfully.', user));
  } catch (error) {
    console.error('Verify signup error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/users/login - step 1 of 2: { identifier, password }, identifier is the email or phone number.
// The right password doesn't log in by itself; it emails a code to the account, checked at /login/verify.
// Login codes are only ever sent from here, so a valid one proves both the password and the inbox.
async function loginUser(req, res) {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/phone and password are required.' });
    }

    const user = await findByIdentifier(identifier);
    // An account without a password sets one with "Forgot password?" first
    if (!(await checkPassword(password, user?.password))) {
      return res.status(401).json({ message: 'Invalid email/phone or password.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact the blood bank.' });
    }

    let result;
    try {
      result = await sendCode(user.email, 'login', null);
    } catch (error) {
      console.error('Login OTP error:', error);
      return res.status(502).json({ message: "We couldn't send the login code. Please try again." });
    }
    // Logging in again straight away (a page refresh, or going back a step) keeps the code that was just sent
    if (result.throttled && !result.cooldown) {
      return res.status(429).json({
        message: 'Too many login codes requested for this account. Please try again later.',
        retry_after: result.retryAfter
      });
    }

    res.json(otpSentResponse(maskEmail(user.email), result.cooldown ? result.retryAfter : RESEND_COOLDOWN_SECONDS));
  } catch (error) {
    console.error('Login user error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
}

// POST /api/users/login/verify - step 2 of 2: { identifier, code } with the code emailed by /login
async function verifyLogin(req, res) {
  try {
    const user = await findByIdentifier(req.body.identifier);
    if (!user) {
      return res.status(400).json({ message: 'That code is invalid or has expired. Request a new one.' });
    }

    const result = await consumeOtp(user.email, 'login', req.body.code);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    // Deactivated since the password step
    if (!user.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact the blood bank.' });
    }

    res.json(sessionResponse('Login successful', user));
  } catch (error) {
    console.error('Verify login error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

// POST /api/users/password/request-otp - { email }
// Emails a password reset code to an existing account. The answer is the same whether or not
// the email has an account, so it can't be used to find out who is registered.
async function requestResetOtp(req, res) {
  try {
    const cleanEmail = normalizeEmail(req.body.email);
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (rows.length > 0) {
      await sendCode(cleanEmail, 'reset', null);
    }

    res.json(otpSentResponse(cleanEmail));
  } catch (error) {
    console.error('Reset OTP error:', error);
    res.status(502).json({ message: "We couldn't send the verification email. Please try again." });
  }
}

// POST /api/users/password/reset - { email, code, password }
// The emailed code proves the email address. The new password replaces the old one, every other
// session for the account is signed out, and the user is logged in here.
async function resetPassword(req, res) {
  try {
    const cleanEmail = normalizeEmail(req.body.email);
    const { code, password } = req.body;

    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
    // Checked before the code, so a password that isn't allowed doesn't use up an attempt
    const problem = passwordProblem(password);
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    const result = await consumeOtp(cleanEmail, 'reset', code);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    const [[account]] = await pool.query('SELECT id, is_active FROM users WHERE email = ?', [cleanEmail]);
    if (!account) {
      return res.status(401).json({ message: 'Account not found. Please create an account.' });
    }
    if (!account.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact the blood bank.' });
    }

    await pool.query(
      'UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?',
      [await hashPassword(password), account.id]
    );
    const [[user]] = await pool.query(`${USER_SELECT} WHERE u.id = ?`, [account.id]);

    res.json(sessionResponse('Your password has been changed.', user));
  } catch (error) {
    console.error('Reset password error:', error);
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

    res.json({ user: publicUser(rows[0]), donor: donor || null, donations, requests });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ message: 'Failed to load account.' });
  }
}

module.exports = {
  requestSignupOtp,
  verifySignup,
  loginUser,
  verifyLogin,
  requestResetOtp,
  resetPassword,
  getMyAccount
};
