const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Chat = require('../models/Chat');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ username: user.username, thinkingProfile: user.thinking_profile, createdAt: user.created_at });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/timeline', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const tp = user?.thinking_profile || {};
    res.json({ cognitiveTimeline: tp.cognitiveTimeline || [], accuracyHistory: tp.accuracyHistory || [] });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const tp = user?.thinking_profile || {};
    const [totalChats, solvedChats] = await Promise.all([
      Chat.count({ user_id: req.userId }),
      Chat.count({ user_id: req.userId, status: 'solved' })
    ]);
    res.json({
      totalAnalyses: tp.totalAnalyses || 0,
      totalSuccessful: tp.totalSuccessful || 0,
      successRate: tp.totalAnalyses > 0 ? Math.round((tp.totalSuccessful / tp.totalAnalyses) * 100) : 0,
      totalChats, solvedChats,
      currentStreak: tp.currentStreak || 0,
      longestStreak: tp.longestStreak || 0,
      errorDistribution: tp.errorDistribution || {},
      weakTopics: tp.weakTopics || [],
      patterns: (tp.patterns || []).sort((a, b) => b.frequency - a.frequency).slice(0, 10),
      recentAccuracy: (tp.accuracyHistory || []).slice(-30),
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
