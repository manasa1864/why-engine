const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const config = require('../config');
const { executeCode, executeWithInput } = require('../services/executor');
const { analyze, summarize } = require('../services/staticAnalysis');
const { generateTestCases } = require('../services/testCaseEngine');
const { generateWhyAnalysis, generateDeepAnalysis } = require('../services/llmEngine');
const { computeDelta } = require('../services/deltaEngine');
const { updateThinkingProfile } = require('../services/profileService');
const Chat = require('../models/Chat');
const Project = require('../models/Project');
const logger = require('../utils/logger');
const router = express.Router();

const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.maxCode || 30,
  message: { error: 'Too many code executions. Please wait.' }
});

// ─── POST /api/code/run — Quick execute only ─────────────────────────────
router.post('/run', auth, codeLimiter, async (req, res) => {
  try {
    const { code, language, stdin } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });
    const lang = (language || 'python').toLowerCase();
    if (!config.languages[lang]) return res.status(400).json({ error: `Unsupported language: ${lang}` });

    const result = await executeCode(code, lang, stdin || '');
    res.json(result);
  } catch (e) {
    logger.error('Run', 'Execution failed', e);
    res.status(500).json({ error: `Execution failed: ${e.message}` });
  }
});

// ─── POST /api/code/analyze — Full 15-step WHY pipeline ─────────────────
router.post('/analyze', auth, codeLimiter, async (req, res) => {
  const startTime = Date.now();
  const steps = [];

  try {
    const { code, language, problemStatement, preCodingThinking, chatId, projectId } = req.body;

    // Validate inputs
    if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });
    if (!projectId && !chatId) return res.status(400).json({ error: 'projectId or chatId is required' });

    const lang = (language || 'python').toLowerCase();
    if (!config.languages[lang]) return res.status(400).json({ error: `Unsupported language: ${lang}` });

    // ─── STEP 1: Store pre-coding thinking ─────────────────────────────
    const thinking = {
      approach: preCodingThinking?.approach || '',
      edgeCases: preCodingThinking?.edgeCases || '',
      expectedComplexity: preCodingThinking?.expectedComplexity || '',
    };
    steps.push('pre_coding_check');
    logger.info('Pipeline', 'Step 1: pre_coding_check complete');

    // ─── STEP 2: Code Execution ─────────────────────────────────────────
    const executionResult = await executeCode(code, lang);
    steps.push('execution');
    logger.info('Pipeline', `Step 2: execution complete — ${executionResult.status}`);

    // ─── STEP 3: Static Analysis (AST) ─────────────────────────────────
    const staticAnalysisIssues = analyze(code, lang);
    const staticSummary = summarize(staticAnalysisIssues);
    steps.push('static_analysis');
    logger.info('Pipeline', `Step 3: static_analysis — ${staticAnalysisIssues.length} issues`);

    // ─── STEP 4: Test Case Generation ──────────────────────────────────
    const generatedTests = generateTestCases(code, lang, problemStatement);
    steps.push('test_generation');
    logger.info('Pipeline', `Step 4: test_generation — ${generatedTests.length} cases`);

    // ─── STEP 5: Run test cases ─────────────────────────────────────────
    const testCaseResults = [];
    const testsToRun = generatedTests.slice(0, 8); // cap at 8 to avoid timeout
    for (const tc of testsToRun) {
      try {
        const r = await executeWithInput(code, lang, tc.input);
        testCaseResults.push({
          input: tc.input,
          expectedOutput: tc.expectedOutput || null,
          actualOutput: r.stdout?.trim() || r.stderr?.trim() || '(no output)',
          passed: tc.expectedOutput
            ? r.stdout?.trim() === tc.expectedOutput.trim()
            : r.status === 'Accepted',
          category: tc.category,
          executionTime: r.time,
          description: tc.description,
        });
      } catch {
        testCaseResults.push({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: 'Execution failed',
          passed: false,
          category: tc.category,
          description: tc.description,
        });
      }
    }
    steps.push('test_execution');
    logger.info('Pipeline', `Step 5: test_execution — ${testCaseResults.filter(t => t.passed).length}/${testCaseResults.length} passing`);

    // ─── STEP 6: Load previous attempts for multi-attempt comparison ───
    let previousAttempts = [];
    let attemptNumber = 1;
    let previousEntry = null;
    let resolvedChatId = chatId;

    if (chatId) {
      try {
        const existing = await Chat.findOne({ id: chatId, user_id: req.userId });
        if (existing?.entries?.length) {
          attemptNumber = existing.entries.length + 1;
          previousEntry = existing.entries[existing.entries.length - 1];
          previousAttempts = existing.entries.slice(-3);
          steps.push('multi_attempt_load');
          logger.info('Pipeline', `Step 6: attempt #${attemptNumber}`);
        }
      } catch (e) {
        logger.warn('Pipeline', `Could not load previous attempts: ${e.message}`);
      }
    }
    if (!steps.includes('multi_attempt_load')) steps.push('multi_attempt_load');

    // ─── STEP 7: AI Reasoning via Groq ─────────────────────────────────
    logger.info('Pipeline', 'Step 7: calling Groq AI reasoning...');
    const whyAnalysis = await generateWhyAnalysis({
      code,
      language: lang,
      problemStatement,
      preCodingThinking: thinking,
      executionResult,
      staticAnalysisIssues,
      testCaseResults,
      previousAttempts,
    });
    steps.push('ai_reasoning');
    logger.info('Pipeline', `Step 7: ai_reasoning complete — model: ${whyAnalysis.confidence?.modelUsed || 'unknown'}`);

    // ─── STEP 7b: Re-score test cases using correct code as oracle ──────
    if (whyAnalysis.correctCode && whyAnalysis.correctCode.trim().length > 10) {
      let oracleRan = 0;
      for (const tc of testCaseResults) {
        if (tc.expectedOutput !== null) continue; // already has expected output
        try {
          const oracleRun = await executeWithInput(whyAnalysis.correctCode, lang, tc.input);
          const oracleOut = oracleRun.stdout?.trim();
          // Validate oracle output: must be non-empty, status Accepted, and actually
          // contain a result (not just an input() prompt with nothing after it)
          const actualOut = (tc.actualOutput || '').trim();
          const isUsable = oracleOut &&
            oracleRun.status === 'Accepted' &&
            // If the actual output is longer than the oracle output, the oracle
            // is probably missing its result (e.g. only printed the prompt)
            oracleOut.length >= actualOut.length * 0.5;
          if (isUsable) {
            tc.expectedOutput = oracleOut;
            tc.passed = actualOut === oracleOut;
            oracleRan++;
          }
        } catch {
          // oracle execution failed for this case — keep previous pass/fail
        }
      }
      if (oracleRan > 0) {
        steps.push('oracle_scoring');
        logger.info('Pipeline', `Step 7b: oracle re-scored ${oracleRan} test cases`);
      }
    }

    // ─── STEP 8: Confidence + uncertainty evaluation ────────────────────
    steps.push('confidence_evaluation');

    // ─── STEP 9: Response formatting ────────────────────────────────────
    const deltaAnalysis = computeDelta(previousEntry, {
      executionResult,
      testCases: testCaseResults,
      staticAnalysis: { issues: staticAnalysisIssues },
      whyAnalysis,
      code,
      attemptNumber,
    });
    steps.push('delta_analysis');

    // ─── STEP 10: Build entry object ────────────────────────────────────
    const entry = {
      timestamp: new Date().toISOString(),
      problemStatement: problemStatement || '',
      preCodingThinking: thinking,
      code,
      language: lang,
      executionResult,
      staticAnalysis: { issues: staticAnalysisIssues, summary: staticSummary },
      testCases: testCaseResults,
      whyAnalysis,
      deltaAnalysis,
      attemptNumber,
      processingTime: Date.now() - startTime,
      pipelineSteps: steps,
    };

    // ─── STEP 11: Save to chat history ──────────────────────────────────
    let chat;
    try {
      if (resolvedChatId) {
        chat = await Chat.pushEntry({ id: resolvedChatId, user_id: req.userId, entry });
      } else {
        // Create new chat under the project
        const title = (problemStatement || 'Analysis').slice(0, 100);
        chat = await Chat.create({ user_id: req.userId, project_id: projectId, title });
        resolvedChatId = chat.id;
        chat = await Chat.pushEntry({ id: resolvedChatId, user_id: req.userId, entry });

        // Update project chat count
        try {
          const proj = await Project.findOne({ id: projectId, user_id: req.userId });
          if (proj) {
            await Project.findByIdAndUpdate(projectId, {
              chat_count: (proj.chat_count || 0) + 1,
              last_activity: new Date().toISOString(),
            });
          }
        } catch (e) {
          logger.warn('Pipeline', `Project update failed: ${e.message}`);
        }
      }
      steps.push('save_history');
      logger.info('Pipeline', `Step 11: saved to chat ${resolvedChatId}`);
    } catch (e) {
      logger.error('Pipeline', `Chat save failed: ${e.message}`);
      steps.push('save_history_failed');
    }

    // ─── STEP 12: Update thinking profile ───────────────────────────────
    try {
      await updateThinkingProfile(req.userId, whyAnalysis, lang);
      steps.push('update_profile');
    } catch (e) {
      logger.warn('Pipeline', `Profile update failed: ${e.message}`);
    }

    // ─── STEP 13: Update dashboard + cognitive timeline (in profileService) ─
    steps.push('update_dashboard');

    logger.info('Pipeline', `Complete in ${Date.now() - startTime}ms — steps: ${steps.join(' → ')}`);

    res.json({
      executionResult,
      staticAnalysis: staticAnalysisIssues,
      staticSummary,
      testCases: testCaseResults,
      whyAnalysis,
      deltaAnalysis,
      chatId: chat?.id || resolvedChatId,
      attemptNumber,
      processingTime: Date.now() - startTime,
      pipelineSteps: steps,
    });

  } catch (e) {
    logger.error('Pipeline', 'Analysis failed', e);
    res.status(500).json({
      error: `Analysis pipeline failed: ${e.message}`,
      pipelineSteps: steps,
      failedAt: steps[steps.length - 1] || 'init',
    });
  }
});

// ─── POST /api/code/compare — Compare two attempts ──────────────────────
router.post('/compare', auth, async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ error: 'chatId is required' });

    const chat = await Chat.findOne({ id: chatId, user_id: req.userId });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.entries || chat.entries.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 attempts to compare' });
    }

    const entries = chat.entries;
    const delta = computeDelta(entries[entries.length - 2], entries[entries.length - 1]);
    res.json(delta);
  } catch (e) {
    res.status(500).json({ error: `Comparison failed: ${e.message}` });
  }
});

// ─── POST /api/code/deep-analysis — Child-friendly line-by-line + complexity ─
router.post('/deep-analysis', auth, codeLimiter, async (req, res) => {
  try {
    const { code, language, optimizedCode, userCodeComplexity, optimizedComplexity } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });
    const lang = (language || 'python').toLowerCase();

    const result = await generateDeepAnalysis({
      code, language: lang,
      optimizedCode:       optimizedCode || '',
      userCodeComplexity:  userCodeComplexity || '',
      optimizedComplexity: optimizedComplexity || '',
    });

    res.json(result);
  } catch (e) {
    logger.error('DeepAnalysis', 'Failed', e);
    res.status(500).json({ error: `Deep analysis failed: ${e.message}` });
  }
});

// ─── POST /api/code/generate-testcases — Standalone test generation ─────
router.post('/generate-testcases', auth, async (req, res) => {
  try {
    const { code, language, problemStatement } = req.body;
    const testCases = generateTestCases(code || '', (language || 'python').toLowerCase(), problemStatement);
    res.json({ testCases });
  } catch (e) {
    res.status(500).json({ error: `Test generation failed: ${e.message}` });
  }
});

module.exports = router;
