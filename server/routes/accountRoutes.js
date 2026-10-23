const express = require('express');
const router = express.Router();
const { getAllAccounts, resetAuthenticator } = require('../controllers/accountController');
const authMiddleware = require('../middleware/auth');

// Admin-protected: public website accounts, and resetting a user's authenticator when they lose their phone
router.get('/', authMiddleware, getAllAccounts);
router.post('/:id/reset-authenticator', authMiddleware, resetAuthenticator);

module.exports = router;
