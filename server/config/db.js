const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blood_bank_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully');
    connection.release();
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    console.error('\n[DATABASE SETUP TIP]:');
    console.error('1. Make sure MySQL service is running.');
    console.error('2. Update server/.env with your MySQL root password: DB_PASSWORD=your_password');
    console.error('3. Run "npm run setup-db" inside the server directory to create database and tables.\n');
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
