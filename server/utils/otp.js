const crypto = require('crypto');
const { pool } = require('../config/db');
const { OTP_TTL_MINUTES } = require('./mailer');

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

// Six digits is easy to brute force offline, so the stored value is an HMAC keyed with a server secret
function hashCode(email, purpose, code) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
  return crypto.createHmac('sha256', secret).update(`${purpose}:${email}:${code}`).digest('hex');
}

// Creates a fresh code and invalidates earlier ones for the same email + purpose.
// Returns { code, id }, or { throttled: true, retryAfter } when the email asked for codes too often.
// cooldown: true on the throttle result means an unused code went out less than a minute ago and can still be entered.
// All timing is done in SQL (NOW()) so JS/database timezone differences can't skew expiry.
async function issueOtp(email, purpose, payload = null) {
  // A code that was already used doesn't hold up the next one
  const [[last]] = await pool.query(
    `SELECT GREATEST(0, ? - TIMESTAMPDIFF(SECOND, created_at, NOW())) AS wait
     FROM otp_codes WHERE email = ? AND purpose = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1`,
    [RESEND_COOLDOWN_SECONDS, email, purpose]
  );
  if (last && last.wait > 0) {
    return { throttled: true, retryAfter: last.wait, cooldown: true };
  }

  // Counted per purpose: anyone can ask for reset codes for any email, and that mustn't use up the
  // login codes the owner needs (login codes can only be asked for with the right password)
  const [[hourly]] = await pool.query(
    'SELECT COUNT(*) AS sent FROM otp_codes WHERE email = ? AND purpose = ? AND created_at > NOW() - INTERVAL 1 HOUR',
    [email, purpose]
  );
  if (hourly.sent >= MAX_SENDS_PER_HOUR) {
    return { throttled: true, retryAfter: 3600 };
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await pool.query(
    'UPDATE otp_codes SET consumed_at = NOW() WHERE email = ? AND purpose = ? AND consumed_at IS NULL',
    [email, purpose]
  );
  const [result] = await pool.query(
    `INSERT INTO otp_codes (email, purpose, code_hash, payload, expires_at)
     VALUES (?, ?, ?, ?, NOW() + INTERVAL ? MINUTE)`,
    [email, purpose, hashCode(email, purpose, code), payload ? JSON.stringify(payload) : null, OTP_TTL_MINUTES]
  );
  return { code, id: result.insertId };
}

// Used when the email could not be sent, so the user isn't locked out by the resend cooldown
async function discardOtp(id) {
  await pool.query('DELETE FROM otp_codes WHERE id = ?', [id]);
}

// Checks a submitted code. On success the code is used up and the stored sign up details are returned.
// Result: { ok: true, payload } or { ok: false, status, message }
async function consumeOtp(email, purpose, code) {
  const invalid = { ok: false, status: 400, message: 'That code is invalid or has expired. Request a new one.' };

  if (!/^\d{6}$/.test(String(code || ''))) {
    return { ok: false, status: 400, message: 'Enter the 6-digit code from your email.' };
  }

  const [rows] = await pool.query(
    `SELECT id, code_hash, payload, attempts FROM otp_codes
     WHERE email = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [email, purpose]
  );
  const row = rows[0];
  if (!row) return invalid;

  // Count the attempt before comparing, atomically, so parallel guesses can't exceed the limit
  const [counted] = await pool.query(
    'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ? AND attempts < ? AND consumed_at IS NULL',
    [row.id, MAX_ATTEMPTS]
  );
  if (counted.affectedRows === 0) {
    return { ok: false, status: 429, message: 'Too many incorrect attempts. Request a new code.' };
  }

  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(hashCode(email, purpose, code), 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      status: 400,
      message: left > 0
        ? `Incorrect code. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`
        : 'Too many incorrect attempts. Request a new code.'
    };
  }

  const [used] = await pool.query(
    'UPDATE otp_codes SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL',
    [row.id]
  );
  if (used.affectedRows === 0) return invalid;

  return { ok: true, payload: row.payload ? JSON.parse(row.payload) : null };
}

module.exports = { issueOtp, discardOtp, consumeOtp, RESEND_COOLDOWN_SECONDS, OTP_TTL_MINUTES };
