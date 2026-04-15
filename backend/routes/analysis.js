const express = require('express');
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const router = express.Router();

// GET /api/analysis/chat/:chatId — Get full chat with all entries
router.get('/chat/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ id: req.params.chatId, user_id: req.userId });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (e) {
    res.status(500).json({ error: `Failed to fetch chat: ${e.message}` });
  }
});

// DELETE /api/analysis/chat/:chatId
router.delete('/chat/:chatId', auth, async (req, res) => {
  try {
    await Chat.findOneAndDelete({ id: req.params.chatId, user_id: req.userId });
    res.json({ message: 'Chat deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// GET /api/analysis/history — Paginated chat history
router.get('/history', auth, async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    const chats = await Chat.findHistory({ user_id: req.userId, limit: +limit, offset: +skip });
    const total = await Chat.count({ user_id: req.userId });
    res.json({ chats, total });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
