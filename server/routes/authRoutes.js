const express = require('express');
const router = express.Router();
const { login, getProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter(), login);
router.get('/me', authMiddleware, getProfile);

module.exports = router;
