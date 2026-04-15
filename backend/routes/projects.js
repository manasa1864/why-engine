const express = require('express');
const { validationResult } = require('express-validator');
const Project = require('../models/Project');
const Chat = require('../models/Chat');
const auth = require('../middleware/auth');
const { projectRules } = require('../utils/validators');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try { res.json(await Project.find({ user_id: req.userId })); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch projects' }); }
});

router.post('/', auth, projectRules, async (req, res) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
    const proj = await Project.create({ user_id: req.userId, name: req.body.name.trim(), description: req.body.description || '', language: req.body.language || 'python' });
    res.status(201).json(proj);
  } catch (e) { res.status(500).json({ error: 'Failed to create project' }); }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const existing = await Project.findOne({ id: req.params.id, user_id: req.userId });
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const proj = await Project.findByIdAndUpdate(req.params.id, { name: name.trim() });
    res.json(proj);
  } catch (e) { res.status(500).json({ error: 'Failed to rename project' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Project.findByIdAndDelete({ id: req.params.id, user_id: req.userId });
    await Chat.deleteMany({ project_id: req.params.id, user_id: req.userId });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete' }); }
});

router.get('/:id/chats', auth, async (req, res) => {
  try { res.json(await Chat.findSummary({ user_id: req.userId, project_id: req.params.id })); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch chats' }); }
});

router.patch('/:id/chats/:chatId', auth, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const chat = await Chat.update({ id: req.params.chatId, user_id: req.userId, updates: { title: title.trim() } });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (e) { res.status(500).json({ error: 'Failed to rename chat' }); }
});

router.delete('/:id/chats/:chatId', auth, async (req, res) => {
  try {
    await Chat.findOneAndDelete({ id: req.params.chatId, user_id: req.userId });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete chat' }); }
});

router.post('/:id/chats', auth, async (req, res) => {
  try {
    const proj = await Project.findOne({ id: req.params.id, user_id: req.userId });
    if (!proj) return res.status(404).json({ error: 'Project not found' });
    const chat = await Chat.create({ user_id: req.userId, project_id: req.params.id, title: req.body.title || 'New Analysis' });
    await Project.findByIdAndUpdate(req.params.id, { chat_count: proj.chat_count + 1, last_activity: new Date().toISOString() });
    res.status(201).json(chat);
  } catch (e) { res.status(500).json({ error: 'Failed to create chat' }); }
});

module.exports = router;
