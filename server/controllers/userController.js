const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signUserToken(user) {
  return jwt.sign(
    { id: user.id, name: user.full_name, email: user.email, role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
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

// POST /api/users/register
async function registerUser(req, res) {
  try {
    const { full_name, email, phone, password, blood_group_id } = req.body;

    if (!full_name || !full_name.trim() || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const cleanPhone = String(phone).replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({ message: 'Phone number must be a valid 10-digit mobile number.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, phone, password, blood_group_id) VALUES (?, ?, ?, ?, ?)',
      [full_name.trim(), cleanEmail, cleanPhone, hashedPassword, bloodGroupId]
    );

    const [[user]] = await pool.query(
      `SELECT u.*, bg.group_name AS blood_group FROM users u
       LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id WHERE u.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'Account created successfully.',
      token: signUserToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Register user error:', error);
    res.status(500).json({ message: 'Failed to create account.' });
  }
}

// POST /api/users/login - accepts email or phone number as the identifier
async function loginUser(req, res) {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/phone and password are required.' });
    }

    const id = String(identifier).trim().toLowerCase();
    const [rows] = await pool.query(
      `SELECT u.*, bg.group_name AS blood_group FROM users u
       LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id
       WHERE u.email = ? OR u.phone = ?`,
      [id, id.replace(/[\s-]/g, '')]
    );

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email/phone or password.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact the blood bank.' });
    }

    res.json({ message: 'Login successful', token: signUserToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Login user error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
}

// GET /api/users/me - profile plus the user's own donor profile, donations and blood requests.
// Everything is filtered by the logged-in user's id, so nobody can see another person's records.
async function getMyAccount(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT u.*, bg.group_name AS blood_group FROM users u
       LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id
       WHERE u.id = ? AND u.is_active = 1`,
      [req.user.id]
    );
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

module.exports = { registerUser, loginUser, getMyAccount };
