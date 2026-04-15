const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Chat = require('../models/Chat');
const router = express.Router();

// GET /api/profile — Full thinking profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      username: user.username,
      email: user.email,
      thinkingProfile: user.thinking_profile || {},
      createdAt: user.created_at,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET /api/profile/timeline — Cognitive timeline data
router.get('/timeline', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const tp = user?.thinking_profile || {};
    res.json({
      cognitiveTimeline: tp.cognitiveTimeline || [],
      accuracyHistory: (tp.accuracyHistory || []).slice(-30),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// GET /api/profile/stats — Dashboard stats
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const tp = user?.thinking_profile || {};

    const [totalChats, solvedChats] = await Promise.all([
      Chat.count({ user_id: req.userId }),
      Chat.count({ user_id: req.userId, status: 'solved' }),
    ]);

    res.json({
      totalAnalyses: tp.totalAnalyses || 0,
      totalSuccessful: tp.totalSuccessful || 0,
      successRate: tp.totalAnalyses > 0
        ? Math.round((tp.totalSuccessful / tp.totalAnalyses) * 100)
        : 0,
      totalChats,
      solvedChats,
      currentStreak: tp.currentStreak || 0,
      longestStreak: tp.longestStreak || 0,
      errorDistribution: tp.errorDistribution || {},
      weakTopics: tp.weakTopics || [],
      patterns: (tp.patterns || [])
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      recentAccuracy: (tp.accuracyHistory || []).slice(-30),
      cognitiveTimeline: (tp.cognitiveTimeline || []).slice(-12),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// PUT /api/profile/settings — Update user settings
router.put('/settings', auth, async (req, res) => {
  try {
    const { theme, defaultLanguage, whyBeforeWhatMode, showHintsFirst } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentSettings = user.settings || {};
    const updatedSettings = {
      ...currentSettings,
      ...(theme && { theme }),
      ...(defaultLanguage && { defaultLanguage }),
      ...(typeof whyBeforeWhatMode === 'boolean' && { whyBeforeWhatMode }),
      ...(typeof showHintsFirst === 'boolean' && { showHintsFirst }),
    };

    await User.findByIdAndUpdate(req.userId, { settings: updatedSettings });
    res.json({ settings: updatedSettings });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
