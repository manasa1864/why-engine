const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

module.exports = async (req, res, next) => {
  try {
    const header = req.header('Authorization');
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Authentication required' });
    const token = header.replace('Bearer ', '');
    let decoded;
    try { decoded = jwt.verify(token, config.jwt.secret); }
    catch (e) { return res.status(401).json({ error: e.name === 'TokenExpiredError' ? 'Token expired, please login again' : 'Invalid token' }); }
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication error' });
  }
};
