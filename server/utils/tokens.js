const jwt = require('jsonwebtoken');

// Staff and public accounts share one signing key; the role claim keeps the two kinds of token apart
const LIFETIME = { admin: '24h', user: '7d' };

function signToken(role, claims) {
  return jwt.sign({ ...claims, role }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: LIFETIME[role]
  });
}

// Payload of a valid, unexpired bearer token with the given role, or null
function readToken(req, role) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return payload.role === role ? payload : null;
  } catch {
    return null;
  }
}

module.exports = { signToken, readToken };
