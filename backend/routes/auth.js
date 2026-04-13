const express = require('express');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const auth = require('../middleware/auth');
const config = require('../config');
const { registerRules, loginRules } = require('../utils/validators');
const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: config.rateLimit.maxAuth, message: { error: 'Too many attempts. Wait 15 min.' } });
const genToken = (id) => jwt.sign({ userId: id }, config.jwt.secret, { expiresIn: config.jwt.expire });

router.post('/register', authLimiter, registerRules, async (req, res) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
    const { username, email, password } = req.body;
    if (await User.findOne({ email, username }))
      return res.status(400).json({ error: 'User already exists' });
    const user = await User.create({ username, email, password });
    res.status(201).json({ token: genToken(user.id), user: User.toPublic(user) });
  } catch (e) { res.status(500).json({ error: 'Registration failed' }); }
});

router.post('/login', authLimiter, loginRules, async (req, res) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await User.comparePassword(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: genToken(user.id), user: User.toPublic(user) });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

router.get('/me', auth, (req, res) => res.json({ user: User.toPublic(req.user) }));

module.exports = router;
