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
      password VARCHAR(255) NOT NULL,
      blood_group_id INT DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id)
    )
  `);

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
