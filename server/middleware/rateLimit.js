const rateLimit = require('express-rate-limit');

// Per-IP cap over a 15 minute window, on top of the per-email limits in utils/otp.js
function limiter(limit, options = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again in a few minutes.' },
    ...options
  });
}

// Password logins only count failures, so staff and users who get it right are never locked out
const loginLimiter = () => limiter(20, { skipSuccessfulRequests: true });

module.exports = { limiter, loginLimiter };
