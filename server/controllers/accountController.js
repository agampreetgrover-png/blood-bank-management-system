const { pool } = require('../config/db');

// GET /api/accounts?search= - public website accounts, newest first. Secrets are never sent.
async function getAllAccounts(req, res) {
  try {
    const { search } = req.query;
    let query = `
      SELECT u.id, u.full_name, u.email, u.phone, bg.group_name AS blood_group, u.is_active,
             (u.totp_secret IS NOT NULL) AS has_authenticator,
             (SELECT COUNT(*) FROM user_backup_codes c WHERE c.user_id = u.id AND c.used_at IS NULL) AS backup_codes_left,
             u.created_at
      FROM users u
      LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY u.created_at DESC, u.id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows.map((row) => ({
      ...row,
      has_authenticator: Boolean(row.has_authenticator),
      backup_codes_left: Number(row.backup_codes_left)
    })));
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ message: 'Failed to fetch accounts.' });
  }
}

// POST /api/accounts/:id/reset-authenticator
// Removes the user's authenticator and backup codes and signs them out everywhere.
// At their next login (with their password) they set up a new authenticator.
async function resetAuthenticator(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE users SET totp_secret = NULL, totp_last_step = NULL, mfa_failures = 0, mfa_locked_until = NULL,
         token_version = token_version + 1
       WHERE id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Account not found.' });
    }
    await conn.query('DELETE FROM user_backup_codes WHERE user_id = ?', [req.params.id]);
    await conn.commit();

    res.json({ message: 'Authenticator reset. The user will set it up again at their next login.' });
  } catch (error) {
    await conn.rollback();
    console.error('Reset authenticator error:', error);
    res.status(500).json({ message: 'Failed to reset the authenticator.' });
  } finally {
    conn.release();
  }
}

module.exports = { getAllAccounts, resetAuthenticator };
