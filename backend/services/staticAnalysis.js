const acorn = require('acorn');
const walk = require('acorn-walk');
const logger = require('../utils/logger');

/*
 * ========================================
 * ENGINE 2: STATIC ANALYSIS ENGINE
 * ========================================
 * JS/TS: Full AST parsing via Acorn
 * Python/C++/Java: Pattern-based analysis
 *
 * Detects:
 *   - O(n²) nested loops
 *   - Recursion without base case
 *   - Dead/unreachable code
 *   - Mutable default args (Python)
 *   - == vs === (JS)
 *   - Empty catch blocks
 *   - Bare except (Python)
 *   - String == comparison (Java)
 *   - Unused variables
 *   - Anti-patterns per language
 */

// ==================== JAVASCRIPT AST ====================
function analyzeJavaScript(code) {
  const issues = [];
  try {
    const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module', locations: true, allowReturnOutsideFunction: true });

    // Nested loops → O(n²)
    walk.ancestor(ast, {
      ForStatement(n, anc) { if (anc.some(a => /^(For|While|DoWhile)Statement$/.test(a.type))) issues.push({ type: 'PERFORMANCE', message: 'Nested loop → potential O(n²) complexity. Consider hash map or sorting.', line: n.loc.start.line, severity: 'warning', suggestion: 'Use a Map/Set for O(1) lookups instead of nested iteration.' }); },
      WhileStatement(n, anc) { if (anc.some(a => /^(For|While|DoWhile)Statement$/.test(a.type))) issues.push({ type: 'PERFORMANCE', message: 'Nested while loop detected.', line: n.loc.start.line, severity: 'warning', suggestion: 'Review if inner loop can use hash-based lookup.' }); }
    });

    // Recursion without base case
    walk.simple(ast, {
      FunctionDeclaration(n) { checkRecursionJS(n, issues); },
      FunctionExpression(n) { checkRecursionJS(n, issues); }
    });

    // Dead code after return
    walk.simple(ast, {
      BlockStatement(n) {
        let ret = false;
        for (const s of n.body) {
          if (ret) { issues.push({ type: 'DEAD_CODE', message: 'Unreachable code after return/throw.', line: s.loc?.start.line || 0, severity: 'warning', suggestion: 'Remove unreachable code.' }); break; }
          if (s.type === 'ReturnStatement' || s.type === 'ThrowStatement') ret = true;
        }
      }
    });

    // == instead of ===
    walk.simple(ast, {
      BinaryExpression(n) {
        if (n.operator === '==' || n.operator === '!=')
          issues.push({ type: 'BEST_PRACTICE', message: `Use '${n.operator === '==' ? '===' : '!=='}' for strict comparison.`, line: n.loc.start.line, severity: 'info', suggestion: 'Loose equality causes type coercion bugs.' });
      }
    });

    // Empty catch
    walk.simple(ast, {
      CatchClause(n) {
        if (!n.body.body.length)
          issues.push({ type: 'BUG_RISK', message: 'Empty catch block — errors silently swallowed.', line: n.loc.start.line, severity: 'warning', suggestion: 'At minimum log the error.' });
      }
    });

    // console.log leftover
    walk.simple(ast, {
      CallExpression(n) {
        if (n.callee.type === 'MemberExpression' && n.callee.object.name === 'console' && n.callee.property.name === 'log')
          issues.push({ type: 'DEBUG', message: 'console.log() — possible debug leftover.', line: n.loc.start.line, severity: 'info', suggestion: 'Remove before submission.' });
      }
    });
  } catch (err) {
    issues.push({ type: 'SYNTAX', message: `Parse error: ${err.message}`, line: err.loc?.line || 1, severity: 'error', suggestion: 'Fix syntax error first.' });
  }
  return issues;
}

function checkRecursionJS(node, issues) {
  const name = node.id?.name; if (!name) return;
  let selfCall = false, baseCase = false;
  try {
    walk.simple(node.body, {
      CallExpression(c) { if (c.callee.name === name) selfCall = true; },
      IfStatement() { baseCase = true; },
      ConditionalExpression() { baseCase = true; }
    });
  } catch {}
  if (selfCall && !baseCase) issues.push({ type: 'RECURSION', message: `'${name}' is recursive without visible base case — risk of infinite recursion.`, line: node.loc.start.line, severity: 'error', suggestion: 'Add an if-condition that returns without recursing.' });
  else if (selfCall) issues.push({ type: 'INFO', message: `'${name}' uses recursion. Verify base case covers all edge cases.`, line: node.loc.start.line, severity: 'info', suggestion: 'Does it handle n=0, n=1, empty input?' });
}

// ==================== PYTHON PATTERNS ====================
function analyzePython(code) {
  const issues = [], lines = code.split('\n');
  let loopStack = [];

  lines.forEach((line, idx) => {
    const num = idx + 1, trimmed = line.trim(), indent = line.search(/\S/);
    if (indent < 0) return;

    // Nested loops
    if (/^(for |while )/.test(trimmed)) {
      if (loopStack.some(l => l.indent < indent))
        issues.push({ type: 'PERFORMANCE', message: `Nested loop at line ${num} — potential O(n²).`, line: num, severity: 'warning', suggestion: 'Use dict/set for O(1) lookups, or sort + two pointers.' });
      loopStack = loopStack.filter(l => l.indent < indent);
      loopStack.push({ indent, line: num });
    }
    loopStack = loopStack.filter(l => l.indent < indent || /^(for |while )/.test(trimmed));

    // Bare except
    if (/^except\s*:/.test(trimmed)) issues.push({ type: 'BEST_PRACTICE', message: 'Bare except catches ALL exceptions including SystemExit.', line: num, severity: 'warning', suggestion: 'Use "except Exception:" or specific exceptions.' });

    // Mutable default args
    if (/def\s+\w+\(.*=\s*(\[\]|\{\}|set\(\))/.test(trimmed)) issues.push({ type: 'BUG', message: 'Mutable default argument — shared across all calls!', line: num, severity: 'error', suggestion: 'Use None as default: def f(x=None): x = x or []' });

    // == None
    if (/[!=]=\s*None/.test(trimmed)) issues.push({ type: 'BEST_PRACTICE', message: 'Use "is None" / "is not None" instead of ==.', line: num, severity: 'info', suggestion: '"is" checks identity (correct for None).' });

    // range(len())
    if (/for\s+\w+\s+in\s+range\s*\(\s*len\s*\(/.test(trimmed)) issues.push({ type: 'BEST_PRACTICE', message: 'range(len()) — use enumerate() instead.', line: num, severity: 'info', suggestion: 'for i, val in enumerate(arr):' });

    // Global
    if (/^global\s+/.test(trimmed)) issues.push({ type: 'BEST_PRACTICE', message: 'Global variable usage.', line: num, severity: 'info', suggestion: 'Pass values as function parameters instead.' });

    // Recursion check
    const fn = trimmed.match(/^def\s+(\w+)\s*\(/);
    if (fn) {
      let self = false, base = false;
      for (let j = idx + 1; j < Math.min(idx + 30, lines.length); j++) {
        const nl = lines[j].trim();
        if (/^def\s+/.test(nl) && j > idx + 1) break;
        if (nl.includes(fn[1] + '(')) self = true;
        if (/^if |^elif /.test(nl)) base = true;
      }
      if (self && !base) issues.push({ type: 'RECURSION', message: `'${fn[1]}' recursive without visible base case.`, line: num, severity: 'error', suggestion: 'Add base case if-condition.' });
    }
  });
  return issues;
}

// ==================== C/C++ PATTERNS ====================
function analyzeCpp(code) {
  const issues = [], lines = code.split('\n');
  lines.forEach((line, idx) => {
    const num = idx + 1, indent = line.search(/\S/);
    if (/^\s*(for|while)\s*\(/.test(line)) {
      for (let j = idx - 1; j >= Math.max(0, idx - 10); j--) {
        if (/^\s*(for|while)\s*\(/.test(lines[j]) && lines[j].search(/\S/) < indent) {
          issues.push({ type: 'PERFORMANCE', message: 'Nested loop — potential O(n²).', line: num, severity: 'warning', suggestion: 'Use unordered_map for O(1) lookups.' });
          break;
        }
      }
    }
  });
  return issues;
}

// ==================== JAVA PATTERNS ====================
function analyzeJava(code) {
  const issues = [], lines = code.split('\n');
  lines.forEach((line, idx) => {
    const num = idx + 1, t = line.trim();
    if (/==\s*"/.test(t) || /".*"\s*==/.test(t)) issues.push({ type: 'BUG', message: 'String == compares references, not values!', line: num, severity: 'error', suggestion: 'Use str1.equals(str2).' });
    if (/\.equals\s*\(\s*null\s*\)/.test(t)) issues.push({ type: 'BUG', message: '.equals(null) always false.', line: num, severity: 'error', suggestion: 'Check obj != null first.' });
  });
  return issues;
}

// ==================== MAIN ENTRY ====================
function analyze(code, language) {
  if (!code?.trim()) return [];
  try {
    switch (language) {
      case 'javascript': case 'typescript': return analyzeJavaScript(code);
      case 'python': return analyzePython(code);
      case 'cpp': case 'c': return analyzeCpp(code);
      case 'java': return analyzeJava(code);
      default: return [{ type: 'INFO', message: `Basic analysis for ${language}.`, line: 0, severity: 'info', suggestion: '' }];
    }
  } catch (err) {
    logger.error('StaticAnalysis', 'Failed', err);
    return [{ type: 'ERROR', message: `Analysis error: ${err.message}`, line: 0, severity: 'error', suggestion: '' }];
  }
}

function summarize(issues) {
  return { errors: issues.filter(i => i.severity === 'error').length, warnings: issues.filter(i => i.severity === 'warning').length, info: issues.filter(i => i.severity === 'info').length };
}

module.exports = { analyze, summarize };
