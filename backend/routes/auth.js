const express = require('express');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const auth = require('../middleware/auth');
const config = require('../config');
const { registerRules, loginRules } = require('../utils/validators');
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.maxAuth,
  message: { error: 'Too many attempts. Wait 15 min.' }
});

const genToken = (id) => jwt.sign({ userId: id }, config.jwt.secret, { expiresIn: config.jwt.expire });

// POST /api/auth/register
router.post('/register', authLimiter, registerRules, async (req, res) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
    const { username, email, password } = req.body;
    if (await User.findOne({ email }))
      return res.status(400).json({ error: 'User with this email already exists' });
    if (await User.findOne({ username }))
      return res.status(400).json({ error: 'Username already taken' });
    const user = await User.create({ username, email, password });
    res.status(201).json({ token: genToken(user.id), user: User.toPublic(user) });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Registration failed: ' + e.message });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, loginRules, async (req, res) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await User.comparePassword(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: genToken(user.id), user: User.toPublic(user) });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Login failed: ' + e.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: User.toPublic(user) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
