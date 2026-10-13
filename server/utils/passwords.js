const bcrypt = require('bcrypt');

const MIN_LENGTH = 8;
const MAX_BYTES = 72; // bcrypt ignores everything past 72 bytes, so longer passwords would be silently cut
const ROUNDS = 10;

// Compared against when there is no account (or no password), so a wrong email takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('no-account-timing-equaliser', ROUNDS);

// Message describing why a new password is not allowed, or null when it is fine
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password) > MAX_BYTES) {
    return 'Password is too long. Use at most 72 characters.';
  }
  return null;
}

function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

async function checkPassword(password, hash) {
  const match = await bcrypt.compare(String(password), hash || DUMMY_HASH);
  return Boolean(hash) && match;
}

module.exports = { passwordProblem, hashPassword, checkPassword };
