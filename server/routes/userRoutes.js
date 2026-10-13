const express = require('express');
const router = express.Router();
const {
  requestSignupOtp, verifySignup, loginUser, verifyLogin, requestResetOtp, resetPassword, getMyAccount
} = require('../controllers/userController');
const { userAuth } = require('../middleware/userAuth');
const { limiter, loginLimiter } = require('../middleware/rateLimit');

// Every code request sends an email, so cap them per IP on top of the per-email limits in utils/otp.js
const requestLimiter = limiter(20);
const verifyLimiter = limiter(40);

// Public website accounts (separate from admin accounts in /api/auth).
// Sign up: details + password, then the emailed code is verified at /signup/verify to create the account.
// Login (two-factor): email/phone + password at /login emails a code, which /login/verify checks.
// Forgotten password: an emailed code (/password/request-otp), then /password/reset with the code and new password.
router.post('/signup/request-otp', requestLimiter, requestSignupOtp);
router.post('/signup/verify', verifyLimiter, verifySignup);
router.post('/login', loginLimiter(), loginUser);
router.post('/login/verify', verifyLimiter, verifyLogin);
router.post('/password/request-otp', requestLimiter, requestResetOtp);
router.post('/password/reset', verifyLimiter, resetPassword);
router.get('/me', userAuth, getMyAccount);

module.exports = router;
