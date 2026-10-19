const jwt = require('jsonwebtoken');

// Staff and public accounts share one signing key; the role claim keeps the kinds of token apart.
// mfa: password accepted, waiting for the authenticator code. signup: details entered, authenticator not set up yet.
const LIFETIME = { admin: '24h', user: '7d', mfa: '5m', signup: '10m' };

function signToken(role, claims) {
  return jwt.sign({ ...claims, role }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: LIFETIME[role]
  });
}

// Payload of a valid, unexpired token with the given role, or null.
// Used directly for the pending mfa/signup tokens, which are sent in the JSON body.
function verifyToken(token, role) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return payload.role === role ? payload : null;
  } catch {
    return null;
  }
}

// Same, for the bearer token in the Authorization header
function readToken(req, role) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7), role);
}

module.exports = { signToken, readToken, verifyToken };
