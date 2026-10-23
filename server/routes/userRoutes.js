const express = require('express');
const router = express.Router();
const {
  startSignup, verifySignup, loginUser, verifyLogin, resetPassword, regenerateBackupCodes, getMyAccount
} = require('../controllers/userController');
const { userAuth } = require('../middleware/userAuth');
const { limiter, loginLimiter } = require('../middleware/rateLimit');

// Per IP, on top of the per-account wrong-code lockout in utils/totp.js
const signupLimiter = limiter(20);
const verifyLimiter = limiter(40);

// Public website accounts (separate from admin accounts in /api/auth). Two-factor with an authenticator app.
// Sign up: details + password at /signup return a QR code; a code from the app at /signup/verify creates the account.
// Login: email/phone + password at /login, then the app code (or a backup code) at /login/verify.
//   Accounts without an authenticator set one up during that step.
// Forgotten password: email/phone + app code (or a backup code) + new password at /password/reset.
router.post('/signup', signupLimiter, startSignup);
router.post('/signup/verify', verifyLimiter, verifySignup);
router.post('/login', loginLimiter(), loginUser);
router.post('/login/verify', verifyLimiter, verifyLogin);
router.post('/password/reset', verifyLimiter, resetPassword);
router.post('/mfa/backup-codes', verifyLimiter, userAuth, regenerateBackupCodes);
router.get('/me', userAuth, getMyAccount);

module.exports = router;
