const { pool } = require('../config/db');
const { signToken } = require('../utils/tokens');
const { checkPassword } = require('../utils/passwords');

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, password, is_active FROM admins WHERE email = ?',
      [String(email).trim()]
    );
    const admin = rows[0];

    // The password is checked before anything else is said about the account,
    // so a stranger can't learn which staff emails exist or are deactivated
    if (!(await checkPassword(password, admin?.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!admin.is_active) {
      return res.status(403).json({ message: 'Account is deactivated.' });
    }

    const token = signToken('admin', { id: admin.id, name: admin.name, email: admin.email });

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
}

// GET /api/auth/me
async function getProfile(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, created_at FROM admins WHERE id = ?',
      [req.admin.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
}

module.exports = { login, getProfile };
