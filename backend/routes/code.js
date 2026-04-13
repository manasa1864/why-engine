const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const config = require('../config');
const { executeCode, executeWithInput } = require('../services/executor');
const { analyze, summarize } = require('../services/staticAnalysis');
const { generateTestCases } = require('../services/testCaseEngine');
const { generateWhyAnalysis } = require('../services/llmEngine');
const { computeDelta } = require('../services/deltaEngine');
const { updateThinkingProfile } = require('../services/profileService');
const Chat = require('../models/Chat');
const Project = require('../models/Project');
const logger = require('../utils/logger');
const router = express.Router();

const codeLimiter = rateLimit({ windowMs: 15*60*1000, max: config.rateLimit.maxCode, message: { error: 'Too many executions. Please wait.' } });

// POST /run — Quick execute only
router.post('/run', auth, codeLimiter, async (req, res) => {
  try {
    const { code, language, stdin } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });
    res.json(await executeCode(code, language || 'python', stdin || ''));
  } catch (e) { res.status(500).json({ error: 'Execution failed' }); }
});

// POST /analyze — FULL 15-STEP PIPELINE
router.post('/analyze', auth, codeLimiter, async (req, res) => {
  const startTime = Date.now();
  const steps = [];
  try {
    const { code, language, problemStatement, preCodingThinking, chatId, projectId } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });
    if (!projectId && !chatId) return res.status(400).json({ error: 'Project or chat ID required' });
    const lang = language || 'python';
    if (!config.languages[lang]) return res.status(400).json({ error: `Unsupported language: ${lang}` });

    steps.push('pre_coding_check');

    const executionResult = await executeCode(code, lang);
    steps.push('execution');

    const staticAnalysisIssues = analyze(code, lang);
    const staticSummary = summarize(staticAnalysisIssues);
    steps.push('static_analysis');

    const generatedTests = generateTestCases(code, lang, problemStatement);
    steps.push('test_generation');
    const testCaseResults = [];
    for (const tc of generatedTests.slice(0, 8)) {
      try {
        const r = await executeWithInput(code, lang, tc.input);
        testCaseResults.push({
          input: tc.input, expectedOutput: tc.expectedOutput || null,
          actualOutput: r.stdout?.trim() || r.stderr?.trim() || '(no output)',
          passed: tc.expectedOutput ? r.stdout?.trim() === tc.expectedOutput.trim() : r.status === 'Accepted',
          category: tc.category, executionTime: r.time, description: tc.description
        });
      } catch { testCaseResults.push({ input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: 'Failed', passed: false, category: tc.category, description: tc.description }); }
    }
    steps.push('test_execution');

    let previousAttempts = [], attemptNumber = 1, previousEntry = null;
    if (chatId) {
      const existing = await Chat.findOne({ id: chatId, user_id: req.userId });
      if (existing?.entries?.length) {
        attemptNumber = existing.entries.length + 1;
        previousEntry = existing.entries[existing.entries.length - 1];
        previousAttempts = existing.entries.slice(-3);
        steps.push('multi_attempt_load');
      }
    }

    const whyAnalysis = await generateWhyAnalysis({ code, language: lang, problemStatement, preCodingThinking, executionResult, staticAnalysisIssues, testCaseResults, previousAttempts });
    steps.push('ai_reasoning');
    steps.push('confidence_evaluation');

    const deltaAnalysis = computeDelta(previousEntry, { executionResult, testCases: testCaseResults, staticAnalysis: { issues: staticAnalysisIssues }, whyAnalysis, code, attemptNumber });
    steps.push('delta_analysis');

    const entry = {
      timestamp: new Date(), problemStatement: problemStatement || '',
      preCodingThinking: { approach: preCodingThinking?.approach || '', edgeCases: preCodingThinking?.edgeCases || '', expectedComplexity: preCodingThinking?.expectedComplexity || '' },
      code, language: lang, executionResult, staticAnalysis: { issues: staticAnalysisIssues, summary: staticSummary },
      testCases: testCaseResults, whyAnalysis, deltaAnalysis, attemptNumber,
      processingTime: Date.now() - startTime, pipelineSteps: steps
    };

    let chat;
    if (chatId) {
      chat = await Chat.pushEntry({ id: chatId, user_id: req.userId, entry });
    } else {
      chat = await Chat.create({ user_id: req.userId, project_id: projectId, title: (problemStatement || 'Analysis').slice(0, 100) });
      chat = await Chat.pushEntry({ id: chat.id, user_id: req.userId, entry });
      const proj = await Project.findOne({ id: projectId, user_id: req.userId });
      if (proj) await Project.findByIdAndUpdate(projectId, { chat_count: proj.chat_count + 1, last_activity: new Date().toISOString() });
    }
    steps.push('save_history');

    await updateThinkingProfile(req.userId, whyAnalysis, lang);
    steps.push('update_profile');

    res.json({ executionResult, staticAnalysis: staticAnalysisIssues, staticSummary, testCases: testCaseResults, whyAnalysis, deltaAnalysis, chatId: chat?.id, attemptNumber, processingTime: Date.now() - startTime, pipelineSteps: steps });
  } catch (e) {
    logger.error('Pipeline', 'Analysis failed', e);
    res.status(500).json({ error: `Analysis failed: ${e.message}`, pipelineSteps: steps, failedAt: steps[steps.length - 1] || 'init' });
  }
});

// POST /compare
router.post('/compare', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ id: req.body.chatId, user_id: req.userId });
    if (!chat || chat.entries.length < 2) return res.status(400).json({ error: 'Need 2+ attempts' });
    const e = chat.entries;
    res.json(computeDelta(e[e.length - 2], e[e.length - 1]));
  } catch (e) { res.status(500).json({ error: 'Comparison failed' }); }
});

// POST /generate-testcases
router.post('/generate-testcases', auth, async (req, res) => {
  try { res.json({ testCases: generateTestCases(req.body.code || '', req.body.language || 'python', req.body.problemStatement) }); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
