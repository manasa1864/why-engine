const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/*
 * ========================================
 * ENGINE 5: LLM REASONING ENGINE (Groq)
 * ========================================
 * - Language-specific analysis (Python vs JS vs C++ etc. get distinct feedback)
 * - Structured JSON output
 * - Confidence + uncertainty scoring
 * - Cognitive debugger taxonomy
 * - Multiple approaches
 * - Pre-coding thinking comparison
 * - Graceful fallback when unavailable
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── Language-specific knowledge injected into every prompt ──────────────────
const LANGUAGE_CONTEXT = {
  python: `
PYTHON-SPECIFIC RULES (apply these strictly):
- Check for off-by-one in range() calls (range(n) vs range(1,n+1))
- Identify missing input() wrapping or int()/float() casting
- Note Python's GIL and its impact on threading
- Check list comprehension correctness vs equivalent loops
- Identify mutable default arguments as a common Python trap
- Note differences between is/== and their misuse
- Highlight when print() vs return confusion causes silent bugs
- Flag missing sys.stdin for competitive programming patterns
- Note 0-indexed lists and slice behavior [a:b] excludes b`,

  javascript: `
JAVASCRIPT-SPECIFIC RULES (apply these strictly):
- Check for var vs let/const scoping bugs
- Identify async/await and Promise misuse (missing await, unhandled rejections)
- Note == vs === type coercion traps
- Check for closure-in-loop bugs (classic for-var pattern)
- Flag prototype chain and 'this' binding issues
- Note NaN comparison traps (NaN !== NaN)
- Check array methods: forEach does not return, map/filter/reduce patterns
- Identify callback hell vs async patterns
- Note 0-indexed arrays and off-by-one in .length checks`,

  typescript: `
TYPESCRIPT-SPECIFIC RULES (apply these strictly):
- Check type assertion safety (as Type vs unknown casts)
- Identify missing null/undefined checks (strict null checks)
- Note interface vs type alias tradeoffs
- Flag any usage that defeats type safety
- Check generic constraint issues
- Note enum vs union type tradeoffs
- Identify incorrect return type annotations`,

  cpp: `
C++-SPECIFIC RULES (apply these strictly):
- Check for memory leaks (new without delete, raw pointers)
- Identify buffer overflows and out-of-bounds array access
- Note integer overflow in int vs long long (competitive programming)
- Check for uninitialized variables
- Flag missing #include directives
- Note cin/cout sync issues (ios::sync_with_stdio)
- Check for undefined behavior (signed overflow, null deref)
- Note pass-by-value vs pass-by-reference performance
- Identify missing return statements in non-void functions`,

  c: `
C-SPECIFIC RULES (apply these strictly):
- Check for buffer overflows and unsafe string functions (strcpy, gets)
- Identify memory leaks (malloc without free)
- Note undefined behavior: signed overflow, null pointer deref
- Check printf/scanf format string mismatches
- Flag uninitialized pointer usage
- Note integer truncation when assigning int to smaller types
- Check for missing return in non-void functions`,

  java: `
JAVA-SPECIFIC RULES (apply these strictly):
- Check for NullPointerException risks (null deref)
- Identify == vs .equals() for String/Object comparison
- Note Integer autoboxing/unboxing performance and NPE risks
- Check Scanner vs BufferedReader for competitive programming
- Flag missing array bounds checks
- Note int overflow (use long for large computations)
- Check for off-by-one in array/list indexing
- Identify ConcurrentModificationException patterns`,

  go: `
GO-SPECIFIC RULES (apply these strictly):
- Check for goroutine leaks and channel deadlocks
- Identify nil pointer dereference risks
- Note slice append behavior and capacity surprises
- Check error return value handling (ignoring errors)
- Flag missing defer for resource cleanup
- Note map concurrent access issues
- Check integer overflow in int vs int64`,

  rust: `
RUST-SPECIFIC RULES (apply these strictly):
- Check for ownership and borrowing violations
- Identify lifetime annotation issues
- Note unwrap() and expect() vs proper error handling
- Check for integer overflow in debug vs release mode
- Flag unnecessary clone() calls (performance)
- Note difference between String and &str
- Check for off-by-one in iterator usage`,

  ruby: `
RUBY-SPECIFIC RULES (apply these strictly):
- Check for nil handling (NoMethodError on nil)
- Identify symbol vs string confusion
- Note mutable default arguments
- Check block vs proc vs lambda differences
- Flag missing .to_i/.to_s conversions on input
- Note gets.chomp requirement for input`,
};

// ─── Base system prompt ───────────────────────────────────────────────────────
function buildSystemPrompt(language) {
  const langCtx = LANGUAGE_CONTEXT[language] || `Analyze ${language.toUpperCase()} code with language-specific best practices.`;
  return `You are the WHY Engine — a senior software engineer and cognitive coach that analyzes BOTH code correctness AND developer thinking patterns.

${langCtx}

CRITICAL: Different languages cause different thinking patterns and bugs. Your analysis MUST reflect the specific language "${language}" — the same logical approach can manifest as completely different bugs depending on language.

RESPOND ONLY WITH VALID JSON. No markdown, no backticks, no explanation outside the JSON.

OUTPUT SCHEMA (ALL fields required):
{
  "mistakeSummary": "Concise paragraph: what went wrong, specific to ${language}",
  "whyWrong": "Deep WHY — connect to ${language} semantics, runtime behavior, CS fundamentals",
  "thoughtProcess": "Step-by-step what the developer was likely thinking when writing this in ${language}",
  "rootCause": "The fundamental cognitive error or ${language}-specific misconception",
  "failingCases": ["specific input → expected output → actual output"],
  "lineByLine": [{"line": 1, "code": "exact code snippet", "explanation": "what it does + issue if any", "hasIssue": false}],
  "correctLogic": "Numbered steps of the correct algorithm",
  "correctCode": "Complete working solution in ${language}",
  "correctCodeWalkthrough": "Why each section of the correct code works in ${language}",
  "optimizedCode": "Best possible ${language} solution",
  "optimizedComplexity": "O(n log n) time, O(1) space — explain why",
  "userCodeComplexity": "O(?) time, O(?) space — analyze the submitted code",
  "mentalModel": "How to think about this class of problems in ${language} going forward",
  "multipleApproaches": [
    {"name": "Brute Force", "description": "approach", "complexity": "O(n²)", "spaceComplexity": "O(1)", "code": "${language} code", "pros": ["simple"], "cons": ["slow"]},
    {"name": "Optimized", "description": "approach", "complexity": "O(n)", "spaceComplexity": "O(n)", "code": "${language} code", "pros": ["fast"], "cons": ["memory"]}
  ],
  "confidence": {
    "analysisConfidence": 0.85,
    "uncertainAreas": ["areas where inference was required"],
    "dataSourcesUsed": ["execution", "ast", "test_cases", "ai"]
  },
  "cognitiveTaxonomy": {
    "errorType": "EDGE_CASE_MISS",
    "confidence": 0.87,
    "category": "Edge Case Awareness",
    "pattern": "Forgot boundary condition",
    "subPatterns": ["Missing empty check", "No zero handling"],
    "languageSpecificPattern": "${language}-specific issue pattern"
  },
  "hintsProvided": [
    {"level": 1, "hint": "Subtle nudge — what should you think about?"},
    {"level": 2, "hint": "Medium hint — narrow the problem area"},
    {"level": 3, "hint": "Direct hint — what specifically to fix"}
  ],
  "thinkingComparison": {
    "approachMatch": 70,
    "edgeCasesCovered": 30,
    "complexityMatch": true,
    "gaps": ["What the developer missed vs their stated plan"]
  }
}

ERROR TYPES: EDGE_CASE_MISS | LOGIC_ERROR | SYNTAX_ERROR | OPTIMIZATION_MISS | BOUNDARY_ERROR | OFF_BY_ONE | WRONG_APPROACH | INCOMPLETE_SOLUTION | TYPE_ERROR | LANGUAGE_MISUSE | NO_ERROR
CATEGORIES: Logical Reasoning | Pattern Recognition | Edge Case Awareness | Optimization | Language Mechanics | Algorithm Knowledge | Data Structure Understanding | Problem Decomposition`;
}

// ─── Main analysis function ───────────────────────────────────────────────────
async function generateWhyAnalysis({
  code, language, problemStatement, preCodingThinking,
  executionResult, staticAnalysisIssues, testCaseResults, previousAttempts = []
}) {
  if (!config.groq.apiKey) {
    logger.warn('LLM', 'No GROQ_API_KEY — using fallback analysis');
    return fallback({ code, language, executionResult, staticAnalysisIssues, testCaseResults });
  }

  const lang = language || 'python';

  const userPrompt = buildUserPrompt({
    code, lang, problemStatement, preCodingThinking,
    executionResult, staticAnalysisIssues, testCaseResults, previousAttempts
  });

  const models = [config.groq.model, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (const model of models) {
    try {
      logger.info('LLM', `Trying model: ${model}`);
      const { data } = await axios.post(GROQ_URL, {
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(lang) },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.15,
        max_tokens: 7000,
        top_p: 0.9,
        response_format: { type: 'json_object' },
      }, {
        headers: {
          'Authorization': `Bearer ${config.groq.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: config.groq.timeout,
      });

      const raw = data.choices?.[0]?.message?.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      // Stamp data sources
      if (parsed.confidence) {
        parsed.confidence.dataSourcesUsed = [
          'execution',
          staticAnalysisIssues?.length ? 'ast' : null,
          testCaseResults?.length ? 'test_cases' : null,
          'ai',
        ].filter(Boolean);
        parsed.confidence.modelUsed = model;
      }

      logger.info('LLM', `Analysis complete via ${model}`);
      return parsed;

    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message;
      logger.warn('LLM', `Model ${model} failed (${status}): ${msg}`);

      // Don't retry on auth failure
      if (status === 401 || status === 403) break;

      // For 404 (model not found) or 400 (bad request), try next model
      if (status === 404 || status === 400) continue;
    }
  }

  logger.error('LLM', 'All models failed — using fallback');
  return fallback({ code, language: lang, executionResult, staticAnalysisIssues, testCaseResults });
}

// ─── User prompt builder ──────────────────────────────────────────────────────
function buildUserPrompt({ code, lang, problemStatement, preCodingThinking, executionResult, staticAnalysisIssues, testCaseResults, previousAttempts }) {
  const exec = executionResult || {};
  const issues = staticAnalysisIssues || [];
  const tests = testCaseResults || [];
  const prev = previousAttempts || [];

  return `## PROBLEM STATEMENT
${problemStatement || 'Not specified'}

## LANGUAGE: ${lang.toUpperCase()}
Analyze this code as ${lang} — apply ${lang}-specific idioms, pitfalls, and best practices.

## PRE-CODING THINKING (what developer planned)
- Approach: ${preCodingThinking?.approach || 'Not provided'}
- Edge cases considered: ${preCodingThinking?.edgeCases || 'Not provided'}
- Expected complexity: ${preCodingThinking?.expectedComplexity || 'Not provided'}

## SUBMITTED CODE (${lang})
\`\`\`${lang}
${code}
\`\`\`

## EXECUTION RESULT (OBJECTIVE FACT — do not contradict)
Status: ${exec.status || 'Unknown'}
Exit Code: ${exec.exitCode ?? 'N/A'}
Stdout: ${exec.stdout || '(empty)'}
Stderr: ${exec.stderr || '(none)'}
Time: ${exec.time || 'N/A'}s
Memory: ${exec.memory || 'N/A'}

## STATIC ANALYSIS (OBJECTIVE FACT)
${issues.length ? issues.map(i => `[${i.severity.toUpperCase()}] Line ${i.line}: ${i.message}${i.suggestion ? ` → ${i.suggestion}` : ''}`).join('\n') : 'No static issues detected'}

## TEST CASE RESULTS (OBJECTIVE FACT)
${tests.length ? tests.map(t => `[${t.passed ? 'PASS' : 'FAIL'}] ${t.description} | Input: "${t.input}" | Expected: "${t.expectedOutput || 'any'}" | Got: "${t.actualOutput}"`).join('\n') : 'No test cases run'}

${prev.length ? `## ATTEMPT HISTORY
This is attempt #${prev.length + 1}. Previous errors to keep in mind:
${prev.slice(-2).map((a, i) => `Attempt ${a.attemptNumber || i + 1}: ${a.whyAnalysis?.cognitiveTaxonomy?.errorType || 'unknown'} — ${a.whyAnalysis?.rootCause || 'N/A'}`).join('\n')}` : ''}

Provide the full WHY analysis as valid JSON matching the schema exactly. Be specific to ${lang} — the same logical mistake in Python vs C++ vs JavaScript manifests differently.`;
}

// ─── Fallback (when AI unavailable) ──────────────────────────────────────────
function fallback({ language, executionResult, staticAnalysisIssues, testCaseResults }) {
  const exec = executionResult || {};
  const hasErr = exec.stderr || (exec.status && exec.status !== 'Accepted');
  const failed = (testCaseResults || []).filter(t => !t.passed);
  const issues = staticAnalysisIssues || [];

  let errorType = 'LOGIC_ERROR';
  let category = 'Logical Reasoning';

  if (exec.status?.toLowerCase().includes('compilation') || exec.status?.toLowerCase().includes('syntax')) {
    errorType = 'SYNTAX_ERROR'; category = 'Language Mechanics';
  } else if (issues.some(i => i.type === 'PERFORMANCE')) {
    errorType = 'OPTIMIZATION_MISS'; category = 'Optimization';
  } else if (failed.some(t => t.category === 'edge_case' || t.category === 'empty')) {
    errorType = 'EDGE_CASE_MISS'; category = 'Edge Case Awareness';
  } else if (failed.some(t => t.category === 'boundary')) {
    errorType = 'BOUNDARY_ERROR'; category = 'Edge Case Awareness';
  }

  const summaryText = hasErr
    ? `Runtime error in ${language}: ${exec.status} — ${(exec.stderr || '').slice(0, 300)}`
    : failed.length
    ? `${failed.length} test case(s) failed. Review logic for the failing inputs.`
    : 'Code executed. Configure GROQ_API_KEY for deep cognitive analysis.';

  return {
    mistakeSummary: summaryText,
    whyWrong: hasErr ? `Execution failed with: ${exec.status}. Check stderr for details.` : 'See failing test cases for clues.',
    thoughtProcess: 'AI analysis unavailable — configure GROQ_API_KEY in backend/.env for thought process inference.',
    rootCause: hasErr ? `${language} runtime/compile error` : failed.length ? 'Logic issue causing test failures' : 'No critical issues detected',
    failingCases: failed.map(t => `${t.description}: "${t.input}" → expected "${t.expectedOutput}" got "${t.actualOutput}"`),
    lineByLine: issues.map(i => ({ line: i.line, code: '', explanation: `[${i.severity}] ${i.message}`, hasIssue: i.severity === 'error' })),
    correctLogic: 'Configure GROQ_API_KEY to see correct logic suggestions.',
    correctCode: '',
    correctCodeWalkthrough: '',
    optimizedCode: '',
    optimizedComplexity: '',
    userCodeComplexity: issues.some(i => i.type === 'PERFORMANCE') ? 'O(n²) or worse — static analysis detected nested loops' : 'Analysis unavailable',
    mentalModel: 'Configure GROQ_API_KEY for mental model coaching.',
    multipleApproaches: [],
    confidence: {
      analysisConfidence: hasErr ? 0.6 : failed.length ? 0.4 : 0.3,
      uncertainAreas: ['AI reasoning unavailable — only execution + static data used'],
      dataSourcesUsed: ['execution', issues.length ? 'ast' : null, testCaseResults?.length ? 'test_cases' : null].filter(Boolean),
      modelUsed: 'none',
    },
    cognitiveTaxonomy: {
      errorType,
      confidence: 0.4,
      category,
      pattern: 'Auto-detected from execution + static analysis',
      subPatterns: [],
      languageSpecificPattern: `${language} execution failure`,
    },
    hintsProvided: [],
    thinkingComparison: { approachMatch: 0, edgeCasesCovered: 0, complexityMatch: false, gaps: ['AI unavailable'] },
  };
}

module.exports = { generateWhyAnalysis };
