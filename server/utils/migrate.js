/**
 * Idempotent migrations run on server start, so existing databases pick up
 * schema additions without re-running setup-db (which drops all data).
 */
const { pool } = require('../config/db');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runMigrations() {
  // Public website user accounts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      phone VARCHAR(15) NOT NULL UNIQUE,
      password VARCHAR(255) DEFAULT NULL,
      blood_group_id INT DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      token_version INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id)
    )
  `);

  // A password is optional at the database level. Every new account gets one; an account
  // without one can't log in.
  // Older databases had it NOT NULL; existing hashes are kept as they are.
  const [[pwCol]] = await pool.query(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password'`
  );
  if (pwCol && pwCol.IS_NULLABLE === 'NO') {
    await pool.query('ALTER TABLE users MODIFY password VARCHAR(255) DEFAULT NULL');
    console.log('Migration: users.password is now nullable');
  }

  // Every login token carries this number; raising it (on a password reset) signs out all older sessions
  if (!(await columnExists('users', 'token_version'))) {
    await pool.query('ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0');
    console.log('Migration: added users.token_version');
  }

  // Authenticator app (TOTP) login. totp_secret is the encrypted secret (NULL = not set up yet),
  // totp_last_step the last accepted 30s step so a code can't be used twice,
  // mfa_failures / mfa_locked_until the lockout after too many wrong codes.
  const mfaColumns = {
    totp_secret: 'VARCHAR(255) DEFAULT NULL',
    totp_last_step: 'BIGINT DEFAULT NULL',
    mfa_failures: 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    mfa_locked_until: 'DATETIME DEFAULT NULL'
  };
  for (const [column, definition] of Object.entries(mfaColumns)) {
    if (!(await columnExists('users', column))) {
      await pool.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
      console.log(`Migration: added users.${column}`);
    }
  }

  // One-time backup codes for a lost phone. Only an HMAC of each code is stored.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_backup_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      code_hash CHAR(64) NOT NULL,
      used_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_backup_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Emailed codes are no longer used
  await pool.query('DROP TABLE IF EXISTS otp_codes');

  // Link donor profiles and blood requests to the account that created them
  for (const table of ['donors', 'blood_requests']) {
    if (!(await columnExists(table, 'user_id'))) {
      await pool.query(
        `ALTER TABLE ${table} ADD COLUMN user_id INT DEFAULT NULL, ADD FOREIGN KEY (user_id) REFERENCES users(id)`
      );
      console.log(`Migration: added ${table}.user_id`);
    }
  }
}

module.exports = { runMigrations };
