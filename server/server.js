const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/db');
const { runMigrations } = require('./utils/migrate');
const { checkMailer } = require('./utils/mailer');

// Import routes
const authRoutes = require('./routes/authRoutes');
const donorRoutes = require('./routes/donorRoutes');
const donationRoutes = require('./routes/donationRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const patientRoutes = require('./routes/patientRoutes');
const requestRoutes = require('./routes/requestRoutes');
const issueRoutes = require('./routes/issueRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const publicRoutes = require('./routes/publicRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Blood Bank Management System API is running.' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// Start server
async function startServer() {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set in server/.env. It is needed to sign login tokens.');
    process.exit(1);
  }
  await testConnection();
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/health`);
  });
  checkMailer(); // not awaited: a slow mail server shouldn't hold up startup
}

startServer();
