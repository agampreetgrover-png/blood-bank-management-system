// Authenticator app (TOTP) two-factor login: secrets, codes, backup codes and the wrong-code lockout.
// Works with Google Authenticator, Microsoft Authenticator and any other RFC 6238 app.
const crypto = require('crypto');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');
const { pool } = require('../config/db');

const ISSUER = 'Blood Bank';
const TOTP_OPTIONS = { issuer: ISSUER, algorithm: 'SHA1', digits: 6, period: 30 };
const WINDOW = 1; // accept the previous and next 30s code too, for clock drift

const BACKUP_COUNT = 8;
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, which are easy to mix up

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const INCORRECT = { ok: false, status: 400, message: 'Incorrect code.' };
const LOCKED = { ok: false, status: 429, message: 'Too many incorrect codes. Try again in 15 minutes.' };

// 32-byte key for encrypting secrets and hashing backup codes. Changing it breaks every saved authenticator.
function serverKey() {
  return crypto.createHash('sha256').update(process.env.MFA_SECRET || process.env.JWT_SECRET).digest();
}

// AES-256-GCM. Stored as base64 of iv (12) + auth tag (16) + ciphertext.
function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', serverKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

// Throws if the value was tampered with or encrypted with a different key
function decryptSecret(stored) {
  const data = Buffer.from(String(stored), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', serverKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}

// New random 160-bit secret, base32 encoded (what authenticator apps expect)
function newSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function totpFor(secret, label = '') {
  return new OTPAuth.TOTP({ ...TOTP_OPTIONS, label, secret: OTPAuth.Secret.fromBase32(secret) });
}

// What the user needs to add the account to their app: a QR code, or the key typed in by hand
async function setupInfo(secret, email) {
  const uri = totpFor(secret, email).toString();
  const qr = await QRCode.toDataURL(uri);
  return { secret, qr, uri };
}

// Checks a 6-digit code against a plain base32 secret. Returns the 30s time step it belongs to,
// or null. A step at or before lastStep was already used, so the same code can't be replayed.
function checkCode(secret, code, lastStep = null) {
  const token = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(token)) return null;

  const totp = totpFor(secret);
  const now = Date.now();
  const delta = totp.validate({ token, timestamp: now, window: WINDOW });
  if (delta === null) return null;

  const step = totp.counter({ timestamp: now }) + delta;
  if (lastStep !== null && lastStep !== undefined && step <= Number(lastStep)) return null;
  return step;
}

// "abcd-2345" -> "ABCD2345"
function normalizeBackupCode(code) {
  return String(code || '').toUpperCase().replace(/[\s-]/g, '');
}

// 8 characters ignoring the dash. TOTP codes are 6 digits, so the two can't be confused.
function looksLikeBackupCode(code) {
  return /^[A-Z0-9]{8}$/.test(normalizeBackupCode(code));
}

function hashBackupCode(code) {
  return crypto.createHmac('sha256', serverKey()).update(normalizeBackupCode(code)).digest('hex');
}

function randomBackupCode() {
  let chars = '';
  for (let i = 0; i < 8; i++) chars += BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)];
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// Replaces the user's backup codes and returns the new ones in plain text (shown to the user once).
// Pass a transaction connection to make it part of a bigger change.
async function newBackupCodes(userId, conn = pool) {
  const codes = Array.from({ length: BACKUP_COUNT }, randomBackupCode);
  await conn.query('DELETE FROM user_backup_codes WHERE user_id = ?', [userId]);
  await conn.query(
    'INSERT INTO user_backup_codes (user_id, code_hash) VALUES ?',
    [codes.map((code) => [userId, hashBackupCode(code)])]
  );
  return codes;
}

// Uses up one backup code. Atomic, so the same code can't be used twice in parallel.
async function useBackupCode(userId, code) {
  if (!looksLikeBackupCode(code)) return false;
  const [result] = await pool.query(
    'UPDATE user_backup_codes SET used_at = NOW() WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1',
    [userId, hashBackupCode(code)]
  );
  return result.affectedRows === 1;
}

async function backupCodesLeft(userId) {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS left_count FROM user_backup_codes WHERE user_id = ? AND used_at IS NULL',
    [userId]
  );
  return Number(row.left_count);
}

// A wrong code. The 5th in a row locks codes for 15 minutes and starts the count again.
// Both assignments read the old mfa_failures, as MySQL applies them left to right.
async function recordFailure(userId) {
  await pool.query(
    `UPDATE users SET
       mfa_locked_until = IF(mfa_failures + 1 >= ?, NOW() + INTERVAL ? MINUTE, mfa_locked_until),
       mfa_failures = IF(mfa_failures + 1 >= ?, 0, mfa_failures + 1)
     WHERE id = ?`,
    [MAX_FAILURES, LOCK_MINUTES, MAX_FAILURES, userId]
  );
  const [[row]] = await pool.query('SELECT mfa_locked_until > NOW() AS locked FROM users WHERE id = ?', [userId]);
  return row && row.locked ? LOCKED : INCORRECT;
}

async function clearFailures(userId) {
  await pool.query('UPDATE users SET mfa_failures = 0, mfa_locked_until = NULL WHERE id = ?', [userId]);
}

// Checks a code for an existing account, with the lockout. Result: { ok: true, step, usedBackup }
// or { ok: false, status, message }.
// - Default: the account's saved authenticator, or a backup code. The accepted step is saved.
// - allowBackup: false accepts only the authenticator.
// - pendingSecret (encrypted): checks a secret that is being set up and isn't saved yet. The caller saves it with the step.
async function verifyUserCode(userId, code, { allowBackup = true, pendingSecret = null } = {}) {
  const [[row]] = await pool.query(
    'SELECT totp_secret, totp_last_step, mfa_locked_until > NOW() AS locked FROM users WHERE id = ?',
    [userId]
  );
  if (!row || (!pendingSecret && !row.totp_secret)) return INCORRECT;
  if (row.locked) return LOCKED;

  if (!pendingSecret && allowBackup && looksLikeBackupCode(code)) {
    if (!(await useBackupCode(userId, code))) return recordFailure(userId);
    await clearFailures(userId);
    return { ok: true, step: null, usedBackup: true };
  }

  let secret;
  try {
    secret = decryptSecret(pendingSecret || row.totp_secret);
  } catch (error) {
    console.error(`Could not decrypt the authenticator secret of user ${userId}:`, error.message);
    return INCORRECT;
  }

  const step = checkCode(secret, code, pendingSecret ? null : row.totp_last_step);
  if (step === null) return recordFailure(userId);

  if (!pendingSecret) {
    // Claimed atomically, so two requests with the same code can't both get in
    const [claimed] = await pool.query(
      `UPDATE users SET totp_last_step = ?, mfa_failures = 0, mfa_locked_until = NULL
       WHERE id = ? AND (totp_last_step IS NULL OR totp_last_step < ?)`,
      [step, userId, step]
    );
    if (claimed.affectedRows === 0) return recordFailure(userId);
  }
  return { ok: true, step, usedBackup: false };
}

module.exports = {
  encryptSecret,
  decryptSecret,
  newSecret,
  setupInfo,
  checkCode,
  normalizeBackupCode,
  looksLikeBackupCode,
  newBackupCodes,
  useBackupCode,
  backupCodesLeft,
  verifyUserCode,
  INCORRECT
};
