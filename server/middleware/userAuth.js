const jwt = require('jsonwebtoken');

function readUserToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded.role === 'user' ? decoded : null;
  } catch {
    return null;
  }
}

// Requires a signed-in public website user
function userAuth(req, res, next) {
  const user = readUserToken(req);
  if (!user) {
    return res.status(401).json({ message: 'Please log in to continue.' });
  }
  req.user = user;
  next();
}

module.exports = { userAuth };
