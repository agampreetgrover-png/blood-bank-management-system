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

  // A password is optional at the database level. Every new account gets one, and an account
  // without one sets it through "Forgot password?" before it can log in.
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

  // One-time codes for sign up / login / password reset. Only an HMAC of the code is stored.
  // For sign up, the details the user entered wait here (payload) until the email is verified.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(100) NOT NULL,
      purpose ENUM('signup', 'login', 'reset') NOT NULL,
      code_hash CHAR(64) NOT NULL,
      payload TEXT DEFAULT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_otp_lookup (email, purpose, created_at)
    )
  `);

  const [[purposeCol]] = await pool.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'otp_codes' AND COLUMN_NAME = 'purpose'`
  );
  if (!purposeCol.COLUMN_TYPE.includes("'reset'")) {
    await pool.query("ALTER TABLE otp_codes MODIFY purpose ENUM('signup', 'login', 'reset') NOT NULL");
    console.log('Migration: otp_codes.purpose now allows reset');
  }

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
