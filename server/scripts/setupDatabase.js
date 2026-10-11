/**
 * Automated Database Setup Utility
 * Executes database/schema.sql and database/seed.sql, and verifies admin credentials.
 * Run via: npm run setup-db
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function setupDatabase() {
  console.log('==============================================');
  console.log('Blood Bank Management System - DB Setup');
  console.log('==============================================');

  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    multipleStatements: true
  };

  console.log(`Connecting to MySQL at ${config.host}:${config.port} as user "${config.user}"...`);

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✓ Successfully connected to MySQL server.');
  } catch (err) {
    console.error('✗ Connection failed:', err.message);
    console.log('');
    console.log('Please check your server/.env file:');
    console.log('1. Ensure MySQL service is running.');
    console.log('2. Set DB_PASSWORD=your_actual_mysql_root_password in server/.env');
    process.exit(1);
  }

  try {
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const seedPath = path.join(__dirname, '..', '..', 'database', 'seed.sql');

    console.log('Executing schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);
    console.log('✓ Database schema created successfully (blood_bank_db).');

    console.log('Executing seed.sql...');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await connection.query(seedSql);
    console.log('✓ Seed data inserted successfully.');

    // Ensure admin user password is properly hashed with bcrypt
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await connection.query(
      'UPDATE blood_bank_db.admins SET password = ? WHERE email = ?',
      [hashedPassword, 'admin@bloodbank.com']
    );
    console.log('✓ Admin user credentials verified.');

    console.log('');
    console.log('==============================================');
    console.log('SETUP COMPLETE!');
    console.log('Default Admin Login:');
    console.log('  Email:    admin@bloodbank.com');
    console.log('  Password: admin123');
    console.log('==============================================');
  } catch (err) {
    console.error('✗ Error during database initialization:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
