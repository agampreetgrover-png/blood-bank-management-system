const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMyAccount } = require('../controllers/userController');
const { userAuth } = require('../middleware/userAuth');

// Public website accounts (separate from admin accounts in /api/auth)
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', userAuth, getMyAccount);

module.exports = router;
