/**
 * Utility to seed admin user with a bcrypt-hashed password.
 * Run: node scripts/seedAdmin.js
 */
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blood_bank_db',
    port: process.env.DB_PORT || 3306
  });

  try {
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if admin already exists
    const [existing] = await connection.query('SELECT id FROM admins WHERE email = ?', ['admin@bloodbank.com']);

    if (existing.length > 0) {
      // Update the password
      await connection.query('UPDATE admins SET password = ? WHERE email = ?', [hashedPassword, 'admin@bloodbank.com']);
      console.log('Admin password updated successfully.');
    } else {
      // Insert new admin
      await connection.query(
        'INSERT INTO admins (name, email, password) VALUES (?, ?, ?)',
        ['Dr. Rajesh Kumar', 'admin@bloodbank.com', hashedPassword]
      );
      console.log('Admin user created successfully.');
    }

    console.log('');
    console.log('Login credentials:');
    console.log('  Email:    admin@bloodbank.com');
    console.log('  Password: admin123');
    console.log('');
  } catch (error) {
    console.error('Seed admin error:', error.message);
  } finally {
    await connection.end();
  }
}

seedAdmin();
