const { pool } = require('../config/db');
const { readToken } = require('../utils/tokens');

// Requires a signed-in public website user. The account is checked on every request, so a deactivated
// account or a password reset (which raises token_version) ends older sessions at once.
async function userAuth(req, res, next) {
  const token = readToken(req, 'user');
  if (!token) {
    return res.status(401).json({ message: 'Please log in to continue.' });
  }

  try {
    const [[user]] = await pool.query(
      'SELECT id, full_name, email, is_active, token_version FROM users WHERE id = ?',
      [token.id]
    );
    if (!user || !user.is_active || user.token_version !== token.ver) {
      return res.status(401).json({ message: 'Your session has ended. Please log in again.' });
    }
    req.user = { id: user.id, name: user.full_name, email: user.email, role: 'user' };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { userAuth };
