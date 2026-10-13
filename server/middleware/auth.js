const { pool } = require('../config/db');
const { readToken } = require('../utils/tokens');

// Staff-only routes. The account is checked on every request, so deactivating an admin ends their session at once.
async function authMiddleware(req, res, next) {
  // Public user tokens are signed with the same secret; readToken only accepts admin tokens here
  const token = readToken(req, 'admin');
  if (!token) {
    return res.status(401).json({ message: 'Please log in to continue.' });
  }

  try {
    const [[admin]] = await pool.query('SELECT id, name, email, is_active FROM admins WHERE id = ?', [token.id]);
    if (!admin || !admin.is_active) {
      return res.status(401).json({ message: 'Your session has ended. Please log in again.' });
    }
    req.admin = { id: admin.id, name: admin.name, email: admin.email, role: 'admin' };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authMiddleware;
