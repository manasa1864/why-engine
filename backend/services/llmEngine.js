const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/*
 * ========================================
 * ENGINE 5: LLM REASONING ENGINE (Groq)
 * ========================================
 * FIX LOG:
 *  - Use axios directly (not groq-sdk) — avoids import issues
 *  - response_format: json_object only on supported models
 *  - Strip markdown fences before JSON.parse
 *  - Robust retry across 3 Groq models
 *  - Detailed language-specific prompts
 *  - Full 10-section WHY output schema
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Models in priority order — verified active on Groq as of 2025
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',  // best quality
  'llama3-70b-8192',          // reliable fallback
  'llama-3.1-8b-instant',     // fast, good JSON compliance
  'llama3-8b-8192',           // last resort small model
];

// ─── Language-specific knowledge ─────────────────────────────────────────────
const LANGUAGE_CONTEXT = {
  python: `PYTHON-SPECIFIC:
- range(n) is 0..n-1; range(1, n+1) is 1..n — off-by-one is common
- int(input()) vs input() — missing cast = string comparison bug
- Mutable default args: def f(x=[]) is shared across calls — use x=None
- is/== difference: None checks must use is/is not
- range(len(arr)) antipattern — prefer enumerate()
- Bare except: catches SystemExit/KeyboardInterrupt — use except Exception
- list.sort() mutates in-place, returns None — sorted() returns new list
- Python GIL prevents true threading parallelism`,

  javascript: `JAVASCRIPT-SPECIFIC:
- var is function-scoped; let/const are block-scoped — closure-in-loop bug
- == coerces types; === does not — use ===
- async/await: missing await makes Promise object truthy, not its value
- forEach does NOT return a value; map/filter/reduce do
- NaN !== NaN — use Number.isNaN()
- 0 == false == "" == null in loose equality
- Array methods return new arrays; sort() mutates in place`,

  typescript: `TYPESCRIPT-SPECIFIC:
- any defeats type safety — use unknown + narrowing
- Non-null assertion ! can cause runtime NPE if wrong
- interface merges; type alias cannot be extended the same way
- Generics constraints: T extends object
- Enum vs union types — prefer union for tree-shaking`,

  cpp: `C++-SPECIFIC:
- int overflow: use long long for large computations
- Array out-of-bounds is UB — no runtime exception
- Missing #include causes cryptic errors
- cin/cout sync: ios::sync_with_stdio(false); cin.tie(NULL)
- new without delete = memory leak
- Uninitialized variables contain garbage — always init
- endl flushes buffer (slow); prefer "\\n"`,

  c: `C-SPECIFIC:
- malloc/calloc without free = memory leak
- strcpy/gets unsafe — use strncpy/fgets
- printf/scanf format mismatch = UB
- Integer truncation when assigning to smaller type
- NULL pointer deref = segfault
- No bool type in C89 — use int 0/1`,

  java: `JAVA-SPECIFIC:
- == compares references for objects; use .equals() for value equality
- Integer autoboxing: Integer i = null; i + 1 throws NPE
- Scanner.nextLine() after nextInt() leaves newline — consume it
- int overflow: use long; long overflow: use BigInteger
- Array index bounds checked at runtime — ArrayIndexOutOfBoundsException
- Collections.sort() vs Arrays.sort() — different params`,

  go: `GO-SPECIFIC:
- Goroutine leak: goroutine blocked on channel, GC cannot collect it
- nil map read is ok; nil map write panics
- Slice append beyond capacity creates new backing array
- Error return must be checked — gofmt-enforced
- defer runs LIFO at function return, not block exit
- sync.Mutex vs sync.RWMutex — readers can concurrent-read`,

  rust: `RUST-SPECIFIC:
- Ownership: moved value cannot be used again
- Borrowing: &T immutable ref; &mut T mutable ref — cannot have both at once
- unwrap() panics on None/Err — use ? or if let
- Integer overflow panics in debug, wraps in release
- String vs &str: String is owned heap; &str is borrowed slice
- Vec.iter() yields references; into_iter() yields owned values`,

  ruby: `RUBY-SPECIFIC:
- nil handling: NoMethodError on nil is Ruby's NPE
- gets.chomp required for input — gets includes trailing newline
- Symbol vs String: :foo vs "foo" — symbols are immutable, interned
- puts vs print vs p — p calls .inspect (debug), puts adds newline
- method? conventions: arr.empty? arr.nil? arr.include?`,
};

// ─── System prompt builder ─────────────────────────────────────────────────
function buildSystemPrompt(language) {
  const langCtx = LANGUAGE_CONTEXT[language] || `Analyze ${language.toUpperCase()} code carefully.`;
  return `You are the WHY Engine — a senior software engineer and cognitive coach.
Your job: analyze BOTH code correctness AND developer thinking patterns in ${language.toUpperCase()}.

${langCtx}

RESPOND ONLY WITH VALID JSON. No markdown fences, no backticks, no text outside JSON.

REQUIRED OUTPUT SCHEMA (every field is mandatory):
{
  "mistakeSummary": "Concise paragraph: what went wrong, specific to ${language}",
  "whyWrong": "Deep WHY — connect to ${language} semantics, runtime behavior, CS fundamentals",
  "thoughtProcess": "Step-by-step: what the developer was likely thinking when they wrote this",
  "rootCause": "The fundamental cognitive error or ${language}-specific misconception",
  "failingCases": ["specific input → expected output → actual output (string array, min 1 item)"],
  "lineByLine": [{"line": 1, "code": "exact code snippet", "explanation": "what it does + any issue", "hasIssue": false}],
  "correctLogic": "Numbered steps of the correct algorithm",
  "correctCode": "Complete working ${language} solution",
  "correctCodeWalkthrough": "Why each section of the correct code works",
  "optimizedCode": "Best possible ${language} solution",
  "optimizedComplexity": "O(?) time, O(?) space — explain why",
  "userCodeComplexity": "O(?) time, O(?) space — analyze submitted code",
  "mentalModel": "How to think about this class of problems in ${language} going forward",
  "multipleApproaches": [
    {"name": "Brute Force", "description": "approach", "complexity": "O(n²)", "spaceComplexity": "O(1)", "code": "${language} code", "pros": ["simple"], "cons": ["slow"]},
    {"name": "Optimized", "description": "approach", "complexity": "O(n)", "spaceComplexity": "O(n)", "code": "${language} code", "pros": ["fast"], "cons": ["uses extra memory"]}
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
    "languageSpecificPattern": "${language}-specific issue"
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
  },
  "stepByStepFix": {
    "simpleExplanation": "One sentence max: what went wrong in plain language a 7-year-old could understand — no jargon at all",
    "analogyExplanation": "A vivid 2-3 sentence story or game/cooking/real-life analogy that makes the exact mistake completely obvious. Make the reader go 'AHA!'",
    "steps": [
      {
        "stepNumber": 1,
        "title": "Short title for this step (3-5 words)",
        "action": "Exactly what to do — be super concrete, like you're talking to a beginner who has never done this before",
        "reason": "Why this step matters — super simple, one sentence",
        "check": "How to know this step worked — what should you see or test?"
      }
    ],
    "goldenRule": "The ONE rule to tape above your monitor and never forget — short, punchy, memorable. Make it stick."
  }
}

errorType must be one of: EDGE_CASE_MISS | LOGIC_ERROR | SYNTAX_ERROR | OPTIMIZATION_MISS | BOUNDARY_ERROR | OFF_BY_ONE | WRONG_APPROACH | INCOMPLETE_SOLUTION | TYPE_ERROR | LANGUAGE_MISUSE | NO_ERROR
category must be one of: Logical Reasoning | Pattern Recognition | Edge Case Awareness | Optimization | Language Mechanics | Algorithm Knowledge | Data Structure Understanding | Problem Decomposition

stepByStepFix.steps MUST have 3-5 concrete, actionable steps. Each step's action must be specific enough that a complete beginner can follow it without any prior knowledge.`;
}

// ─── User prompt builder ──────────────────────────────────────────────────
function buildUserPrompt({ code, lang, problemStatement, preCodingThinking, executionResult, staticAnalysisIssues, testCaseResults, previousAttempts }) {
  const exec = executionResult || {};
  const issues = staticAnalysisIssues || [];
  const tests = testCaseResults || [];
  const prev = previousAttempts || [];

  return `## PROBLEM STATEMENT
${problemStatement || 'Not specified by user'}

## LANGUAGE: ${lang.toUpperCase()}
Analyze this as ${lang} — apply ${lang}-specific idioms, pitfalls, and best practices.

## PRE-CODING THINKING (developer's plan before writing)
- Approach: ${preCodingThinking?.approach || 'Not provided'}
- Edge cases considered: ${preCodingThinking?.edgeCases || 'Not provided'}
- Expected complexity: ${preCodingThinking?.expectedComplexity || 'Not provided'}

## SUBMITTED CODE
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

## STATIC ANALYSIS FINDINGS (OBJECTIVE FACT)
${issues.length
  ? issues.map(i => `[${i.severity?.toUpperCase() || 'INFO'}] Line ${i.line || '?'}: ${i.message}${i.suggestion ? ' → ' + i.suggestion : ''}`).join('\n')
  : 'No static issues detected'}

## TEST CASE RESULTS (OBJECTIVE FACT)
${tests.length
  ? tests.map(t => `[${t.passed ? 'PASS' : 'FAIL'}] ${t.description || t.category} | Input: "${t.input}" | Expected: "${t.expectedOutput || 'any'}" | Got: "${t.actualOutput}"`).join('\n')
  : 'No test cases run'}

${prev.length
  ? `## ATTEMPT HISTORY\nThis is attempt #${prev.length + 1}. Previous errors:\n${prev.slice(-2).map((a, i) => `Attempt ${a.attemptNumber || i + 1}: ${a.whyAnalysis?.cognitiveTaxonomy?.errorType || 'unknown'} — ${a.whyAnalysis?.rootCause || 'N/A'}`).join('\n')}`
  : ''}

Respond with ONLY the JSON object. No preamble, no markdown fences.`;
}

// ─── Main analysis function ───────────────────────────────────────────────
async function generateWhyAnalysis({ code, language, problemStatement, preCodingThinking, executionResult, staticAnalysisIssues, testCaseResults, previousAttempts = [] }) {
  const apiKey = config.groq?.apiKey || process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    logger.warn('LLM', 'No GROQ_API_KEY — using fallback analysis');
    return buildFallback({ code, language, executionResult, staticAnalysisIssues, testCaseResults, reason: 'no_key' });
  }

  const lang = (language || 'python').toLowerCase();

  const userPrompt = buildUserPrompt({
    code, lang, problemStatement, preCodingThinking,
    executionResult, staticAnalysisIssues, testCaseResults, previousAttempts
  });
  const systemPrompt = buildSystemPrompt(lang);

  let lastGroqError = null;

  for (const model of GROQ_MODELS) {
    try {
      logger.info('LLM', `Trying Groq model: ${model}`);

      const requestBody = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.15,
        max_tokens: 6000,
        top_p: 0.9,
      };

      // response_format json_object — all llama models support it
      if (model.includes('llama')) {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await axios.post(GROQ_URL, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: config.groq?.timeout || 90000,
      });

      const raw = response.data?.choices?.[0]?.message?.content || '{}';
      let parsed;

      try {
        parsed = JSON.parse(raw);
      } catch {
        // Strip markdown fences if model ignored instruction
        const cleaned = raw
          .replace(/^```(?:json)?\s*/m, '')
          .replace(/```\s*$/m, '')
          .trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch (e2) {
          // Extract first { ... } block
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
          } else {
            throw new Error(`JSON parse failed: ${e2.message}`);
          }
        }
      }

      // Stamp metadata
      if (!parsed.confidence) parsed.confidence = {};
      parsed.confidence.dataSourcesUsed = [
        'execution',
        staticAnalysisIssues?.length ? 'ast' : null,
        testCaseResults?.length ? 'test_cases' : null,
        'ai',
      ].filter(Boolean);
      parsed.confidence.modelUsed = model;

      logger.info('LLM', `Analysis complete via ${model}`);
      return parsed;

    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message;
      lastGroqError = { status, msg };
      logger.warn('LLM', `Model ${model} failed (${status}): ${msg}`);

      // Auth failure — stop immediately, all models will fail
      if (status === 401 || status === 403) {
        logger.error('LLM', 'Groq auth failed — check GROQ_API_KEY');
        lastGroqError.reason = 'invalid_key';
        break;
      }
      // Model not found or bad request — try next
      if (status === 404 || status === 400) continue;
      // Rate limit — wait briefly then try next model
      if (status === 429) {
        lastGroqError.reason = 'rate_limited';
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      // Network or timeout — try next model
      if (!status) lastGroqError.reason = 'network_error';
    }
  }

  logger.error('LLM', `All Groq models failed — last error: ${JSON.stringify(lastGroqError)}`);
  return buildFallback({ code, language: lang, executionResult, staticAnalysisIssues, testCaseResults, reason: 'api_failed', groqError: lastGroqError });
}

// ─── Fallback (no AI or API failed) ──────────────────────────────────────
// reason: 'no_key' = GROQ_API_KEY missing, 'api_failed' = key set but all calls failed
function buildFallback({ language, executionResult, staticAnalysisIssues, testCaseResults, reason = 'no_key', groqError = null }) {
  const exec   = executionResult || {};
  const hasErr = !!(exec.stderr || (exec.status && exec.status !== 'Accepted'));
  const failed = (testCaseResults || []).filter(t => !t.passed);
  const issues = staticAnalysisIssues || [];
  const noKey  = reason === 'no_key';

  // ── Derive error type from execution + static data ──────────────────────
  let errorType = 'LOGIC_ERROR';
  let category  = 'Logical Reasoning';

  const stderrLow = (exec.stderr || '').toLowerCase();
  if (exec.status?.toLowerCase().includes('compilation') || stderrLow.includes('syntaxerror') || stderrLow.includes('syntax error')) {
    errorType = 'SYNTAX_ERROR'; category = 'Language Mechanics';
  } else if (stderrLow.includes('eoferror') || stderrLow.includes('eof')) {
    errorType = 'INCOMPLETE_SOLUTION'; category = 'Problem Decomposition';
  } else if (stderrLow.includes('indexerror') || stderrLow.includes('index out of') || stderrLow.includes('array index')) {
    errorType = 'BOUNDARY_ERROR'; category = 'Edge Case Awareness';
  } else if (stderrLow.includes('nameerror') || stderrLow.includes('undefined') || stderrLow.includes('is not defined')) {
    errorType = 'SYNTAX_ERROR'; category = 'Language Mechanics';
  } else if (stderrLow.includes('typeerror') || stderrLow.includes('attributeerror')) {
    errorType = 'TYPE_ERROR'; category = 'Language Mechanics';
  } else if (stderrLow.includes('recursionerror') || stderrLow.includes('stack overflow')) {
    errorType = 'WRONG_APPROACH'; category = 'Algorithm Knowledge';
  } else if (issues.some(i => i.type === 'PERFORMANCE')) {
    errorType = 'OPTIMIZATION_MISS'; category = 'Optimization';
  } else if (failed.some(t => t.category === 'edge_case' || t.category === 'empty')) {
    errorType = 'EDGE_CASE_MISS'; category = 'Edge Case Awareness';
  } else if (failed.some(t => t.category === 'boundary')) {
    errorType = 'BOUNDARY_ERROR'; category = 'Edge Case Awareness';
  }

  // ── Derive summary from real error info ──────────────────────────────────
  const stderrSnippet = (exec.stderr || '').slice(0, 400);
  const summaryText = hasErr
    ? `Your ${language} code produced a runtime error: ${exec.status}. ${stderrSnippet ? 'Error: ' + stderrSnippet.split('\n').slice(-3).join(' ') : ''}`
    : failed.length
    ? `${failed.length} out of ${testCaseResults.length} test case(s) failed. The logic has issues with ${failed.map(t => t.category || 'edge cases').filter((v, i, a) => a.indexOf(v) === i).join(', ')}.`
    : 'Code executed without runtime errors.';

  const whyWrongText = hasErr
    ? `The execution failed with "${exec.status}". ${stderrSnippet ? 'Stderr: ' + stderrSnippet : 'Check that your code handles all input cases.'}`
    : failed.length
    ? `${failed.length} test case(s) failed. Inspect the input/output pairs to identify where the logic breaks.`
    : 'No runtime errors detected — review logic for edge case correctness.';

  const rootCauseText = hasErr
    ? `${language} ${errorType.toLowerCase().replace(/_/g, ' ')} — ${stderrSnippet.split('\n')[0] || exec.status}`
    : failed.length
    ? `Logic issue in ${category.toLowerCase()} — ${failed.length} test case(s) fail`
    : 'No critical errors detected';

  // Build a specific message based on the actual Groq failure reason
  let groqDiag = '';
  if (groqError) {
    if (groqError.reason === 'invalid_key' || groqError.status === 401 || groqError.status === 403) {
      groqDiag = 'Groq API key is invalid or expired — get a new key at console.groq.com/keys and update backend/.env.';
    } else if (groqError.reason === 'rate_limited' || groqError.status === 429) {
      groqDiag = 'Groq API rate limit hit — wait a minute and try again.';
    } else if (groqError.reason === 'network_error') {
      groqDiag = 'Cannot reach Groq API — check your internet connection or firewall.';
    } else {
      groqDiag = `Groq API error (${groqError.status || 'unknown'}): ${groqError.msg || 'unknown error'}.`;
    }
  }

  const aiUnavailableNote = noKey
    ? 'Set GROQ_API_KEY in backend/.env for full AI-powered analysis.'
    : groqDiag || 'AI analysis temporarily unavailable — restart the backend server and try again.';

  const correctLogicText = noKey
    ? `Set GROQ_API_KEY in backend/.env for AI-generated correct logic. ${stderrSnippet ? 'Fix the error shown in stderr first.' : ''}`
    : `${aiUnavailableNote} ${stderrSnippet ? 'Immediate fix: resolve the error in stderr: ' + stderrSnippet.split('\n').slice(-2).join(' ') : 'Check the failing test cases below for logic clues.'}`;

  const hasPerf = issues.some(i => i.type === 'PERFORMANCE');
  const complexityText = hasPerf
    ? 'O(n²) or worse — nested loop structure detected by static analysis'
    : `Could not determine — ${aiUnavailableNote}`;

  return {
    mistakeSummary:      summaryText,
    whyWrong:            whyWrongText,
    thoughtProcess:      `Analysis based on execution result and static analysis only. ${aiUnavailableNote}`,
    rootCause:           rootCauseText,
    failingCases:        failed.map(t => `${t.description || t.category}: "${t.input}" → expected "${t.expectedOutput || 'any'}" got "${t.actualOutput}"`),
    lineByLine:          issues.slice(0, 10).map(i => ({ line: i.line || 0, code: '', explanation: `[${i.severity || 'info'}] ${i.message}`, hasIssue: i.severity === 'error' })),
    correctLogic:        correctLogicText,
    correctCode:         '',
    correctCodeWalkthrough: '',
    optimizedCode:       '',
    optimizedComplexity: '',
    userCodeComplexity:  complexityText,
    mentalModel:         `Focus on understanding the error: "${rootCauseText}". ${aiUnavailableNote}`,
    multipleApproaches:  [],
    confidence: {
      analysisConfidence: hasErr ? 0.55 : failed.length ? 0.45 : 0.35,
      uncertainAreas:     [`Full AI reasoning unavailable (${reason})`],
      dataSourcesUsed:    ['execution', issues.length ? 'ast' : null, testCaseResults?.length ? 'test_cases' : null].filter(Boolean),
      modelUsed:          `fallback-${reason}`,
    },
    cognitiveTaxonomy: {
      errorType,
      confidence: 0.5,
      category,
      pattern:                 'Auto-detected from execution output + static analysis',
      subPatterns:             [],
      languageSpecificPattern: `${language} ${errorType.toLowerCase().replace(/_/g, ' ')}`,
    },
    hintsProvided:      [],
    thinkingComparison: { approachMatch: 0, edgeCasesCovered: 0, complexityMatch: false, gaps: [`Full analysis unavailable — ${reason === 'no_key' ? 'GROQ_API_KEY not set' : 'AI service unreachable'}`] },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEEP ANALYSIS — ultra-detailed child-friendly line-by-line + complexity
// ═══════════════════════════════════════════════════════════════════════════

function buildDeepSystemPrompt() {
  return `You are the world's most gifted programming teacher — warm, vivid, obsessively detailed, and beloved by students worldwide.
Your mission: produce the MOST COMPREHENSIVE line-by-line code explanation that exists anywhere on the internet.
Explain EVERY LINE as if talking to a curious, smart 10-year-old who has never seen code before.
Beat LeetCode, GeeksForGeeks, and every tutorial site by being 10x more clear and specific.

RESPOND ONLY WITH VALID JSON. No markdown fences, no backticks, no text outside JSON.

REQUIRED OUTPUT SCHEMA (every field is mandatory — skimping on any field is failure):
{
  "userCodeLines": [
    {
      "lineNumber": 1,
      "code": "exact line of code here",
      "childExplanation": "MANDATORY: minimum 4-5 rich sentences. You MUST cover ALL FOUR of these points: (1) What does this line actually do in the simplest possible English? (2) Give a vivid real-world analogy — use cooking, games, toys, school, sports — make it unforgettable. (3) What would happen if you deleted this line? What breaks? (4) What is the single most common beginner mistake with this type of line?",
      "ahaInsight": "The ONE insight about this line that makes a beginner's eyes go wide — the thing that suddenly makes it all click. One powerful sentence.",
      "role": "short label — what this line does (e.g., 'define function', 'loop start', 'read input', 'conditional check', 'base case', 'recursive call')",
      "timeContrib": "Exact time contribution with clear reasoning — e.g., 'O(1) — this line just stores one value, like writing one word on a sticky note, always takes the same time no matter how big n is' or 'O(n) — this loop runs exactly n times, once for each item, like shaking hands with every person in a line of n people'",
      "spaceContrib": "Exact space contribution with clear reasoning — e.g., 'O(1) — one integer variable, always a tiny fixed box in memory no matter what' or 'O(n) — this list grows as n grows, like needing one locker for every student'"
    }
  ],
  "optimizedCodeLines": [
    {
      "lineNumber": 1,
      "code": "exact line",
      "childExplanation": "Same standard — minimum 4-5 sentences covering: what it does, real-world analogy, what breaks without it, common mistake. PLUS explain why this optimized version is smarter than the user's version at this same point.",
      "ahaInsight": "The insight about why THIS line is the key to the optimization — what clever trick or insight does it embody?",
      "role": "label",
      "timeContrib": "time contribution with reasoning",
      "spaceContrib": "space contribution with reasoning"
    }
  ],
  "timeComplexityDeepDive": {
    "userCode": {
      "overall": "e.g., O(n²)",
      "realWorldMeaning": "Use concrete numbers: 'If n=10: does 100 operations. If n=100: does 10,000 operations. If n=1000: does 1,000,000 operations. If n=1,000,000: does 1 TRILLION operations — a computer doing 1 billion operations per second would take 1000 seconds!' Make it viscerally clear why this matters.",
      "bottleneck": "Name the exact line numbers and explain in one sentence why those lines are the biggest time cost",
      "sections": [
        {
          "label": "descriptive name for this code section",
          "lines": "e.g., '3-7'",
          "contribution": "O(?) — what this section contributes to the total",
          "explanation": "Walk through this section like a detective: what does it do, how many times does it run (with n=10 as a concrete example), and why does it cost this much? Be specific enough that a student could trace it by hand."
        }
      ]
    },
    "optimizedCode": {
      "overall": "e.g., O(n)",
      "realWorldMeaning": "Same concrete-numbers format: n=10, n=100, n=1000, n=1,000,000",
      "bottleneck": "What is the dominant cost and why",
      "sections": [
        {
          "label": "section name",
          "lines": "line range",
          "contribution": "O(?)",
          "explanation": "Same detective walkthrough — how does this clever approach avoid the expensive operations of the user's code?"
        }
      ]
    },
    "speedupExplanation": "This is the GRAND COMPARISON. For n=1000: user code does X operations, optimized does Y operations, that is Z times faster. For n=1,000,000: user code would take X seconds, optimized takes Y milliseconds. Use a story analogy: 'Imagine you are looking for your friend in a city. The user code is like knocking on every door (1,000,000 doors). The optimized code is like using Google Maps (3 steps).' Make this so vivid the reader will never forget it."
  },
  "spaceComplexityDeepDive": {
    "userCode": {
      "overall": "e.g., O(n)",
      "explanation": "Total memory story: 'If n=1000, this code needs about X KB of memory. That is like storing X pages of text.' Make the memory usage feel real and tangible.",
      "dataStructures": [
        {
          "name": "exact variable or structure name from the code",
          "type": "int / list / dict / stack / etc.",
          "space": "O(?)",
          "explanation": "Imagine this like [vivid analogy: a shelf, a notebook, a stack of plates, etc.]. When n=100, this holds X items and takes Y bytes. When n=1000, it holds Z items. This is important because..."
        }
      ]
    },
    "optimizedCode": {
      "overall": "e.g., O(1)",
      "explanation": "Memory story with concrete numbers: n=1000 uses how much? n=1,000,000 uses how much?",
      "dataStructures": [
        {
          "name": "variable name",
          "type": "type",
          "space": "O(?)",
          "explanation": "vivid analogy + concrete numbers"
        }
      ]
    },
    "tradeoffExplanation": "The TIME vs SPACE tradeoff story. Explain it like a choice: 'The fast solution is like a chef who keeps every ingredient chopped and ready in bowls (uses more counter space / memory) so cooking is instant. The memory-efficient solution is like a chef who chops each ingredient only when needed (no extra bowls / no extra memory) but it takes longer to cook.' Be this vivid and concrete. Finish with: 'In practice, which should you pick and why?'"
  }
}

CRITICAL RULES — violating these means your response is wrong:
- childExplanation MUST cover all 4 points and be minimum 4-5 sentences — no exceptions
- ahaInsight must be genuinely insightful, not just a restatement of childExplanation
- timeContrib and spaceContrib must give the Big-O AND a concrete human analogy
- sections in timeComplexityDeepDive MUST cover every single line — no line left unexplained
- speedupExplanation MUST use actual numbers for n=1000 and n=1,000,000
- Every explanation must be so clear that someone who has never programmed can understand it`;
}

async function generateDeepAnalysis({ code, language, optimizedCode, userCodeComplexity, optimizedComplexity }) {
  const apiKey = config.groq?.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return { error: 'GROQ_API_KEY not configured — deep analysis requires Groq AI' };
  }

  const lang = (language || 'python').toLowerCase();
  const hasOptimized = optimizedCode && optimizedCode.trim().length > 10;

  const userPrompt = `## USER'S SUBMITTED CODE (${lang.toUpperCase()})
\`\`\`${lang}
${code}
\`\`\`

## OPTIMIZED/CORRECT CODE (${lang.toUpperCase()})
\`\`\`${lang}
${hasOptimized ? optimizedCode : '(No optimized version available — analyze user code twice, treating it as both user and optimized)'}
\`\`\`

## KNOWN COMPLEXITIES
User code:     ${userCodeComplexity || 'derive from code'}
Optimized:     ${optimizedComplexity || 'derive from code'}

TASK:
1. Go through EVERY SINGLE LINE of both codes and give a child-friendly explanation.
2. Break down time complexity section-by-section with concrete counting examples.
3. Break down space complexity data-structure-by-data-structure.
4. Compare both approaches with vivid real-world numbers.

Respond with ONLY the JSON object. No preamble.`;

  for (const model of GROQ_MODELS) {
    try {
      logger.info('LLM', `Deep analysis: trying model ${model}`);

      const requestBody = {
        model,
        messages: [
          { role: 'system', content: buildDeepSystemPrompt() },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens:  16000,
        top_p: 0.9,
      };

      if (model.includes('llama')) {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await axios.post(GROQ_URL, requestBody, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: config.groq?.timeout || 120000,
      });

      const raw = response.data?.choices?.[0]?.message?.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
          else throw new Error('JSON parse failed');
        }
      }

      logger.info('LLM', `Deep analysis complete via ${model}`);
      return parsed;

    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message;
      logger.warn('LLM', `Deep analysis model ${model} failed (${status}): ${msg}`);
      if (status === 401 || status === 403) break;
      if (status === 404 || status === 400) continue;
      if (status === 429) { await new Promise(r => setTimeout(r, 2000)); continue; }
    }
  }

  return { error: 'Deep analysis failed — all Groq models exhausted' };
}

module.exports = { generateWhyAnalysis, generateDeepAnalysis };
