/*
 * ========================================
 * ENGINE 3: TEST CASE ENGINE
 * ========================================
 * Generates deterministic test cases:
 *   - Edge cases (empty, null, single)
 *   - Boundary (0, -1, INT_MAX/MIN)
 *   - Stress (large inputs)
 *   - Problem-aware (keywords in problem statement)
 *   - Input-pattern-aware (detects what code reads)
 */

function detectInputPattern(code, lang) {
  const p = { integer: false, string: false, array: false, float: false, multi: false };
  if (lang === 'python') {
    if (/int\s*\(\s*input\s*\(\)/.test(code)) p.integer = true;
    if (/float\s*\(\s*input\s*\(\)/.test(code)) p.float = true;
    if (/input\s*\(\)/.test(code) && !p.integer && !p.float) p.string = true;
    if (/map\s*\(\s*int.*input\(\).*\.split/.test(code)) p.array = true;
    if ((code.match(/input\(\)/g) || []).length > 1) p.multi = true;
  } else if (lang === 'javascript') {
    if (/parseInt|Number\(/.test(code)) p.integer = true;
    if (/readline|process\.stdin/.test(code)) p.string = true;
  } else if (lang === 'cpp' || lang === 'c') {
    if (/cin\s*>>|scanf.*%d/.test(code)) p.integer = true;
    if (/getline|gets|scanf.*%s/.test(code)) p.string = true;
  } else if (lang === 'java') {
    if (/nextInt|nextLong/.test(code)) p.integer = true;
    if (/nextLine|next\(\)/.test(code)) p.string = true;
  }
  return p;
}

function generateTestCases(code, language, problemStatement = '') {
  const cases = [];
  const p = detectInputPattern(code, language);

  // Always test empty input
  cases.push({ input: '', expectedOutput: null, category: 'empty', description: 'Empty input — null/empty handling' });

  if (p.integer) {
    cases.push(
      { input: '0', expectedOutput: null, category: 'edge_case', description: 'Zero input' },
      { input: '1', expectedOutput: null, category: 'boundary', description: 'Minimum positive' },
      { input: '-1', expectedOutput: null, category: 'negative', description: 'Negative input' },
      { input: '2', expectedOutput: null, category: 'basic', description: 'Small positive' },
      { input: '-100', expectedOutput: null, category: 'negative', description: 'Larger negative' },
      { input: '1000000', expectedOutput: null, category: 'large_input', description: 'Large number — performance test' },
      { input: '2147483647', expectedOutput: null, category: 'boundary', description: 'INT_MAX (2^31-1)' },
      { input: '-2147483648', expectedOutput: null, category: 'boundary', description: 'INT_MIN (-2^31)' },
    );
  } else if (p.array) {
    cases.push(
      { input: '1\n42', expectedOutput: null, category: 'edge_case', description: 'Single element array' },
      { input: '5\n1 2 3 4 5', expectedOutput: null, category: 'basic', description: 'Sorted array' },
      { input: '5\n5 4 3 2 1', expectedOutput: null, category: 'edge_case', description: 'Reverse sorted' },
      { input: '5\n1 1 1 1 1', expectedOutput: null, category: 'edge_case', description: 'All same elements' },
      { input: '3\n-1 0 1', expectedOutput: null, category: 'negative', description: 'Mixed negative/zero/positive' },
      { input: '2\n0 0', expectedOutput: null, category: 'boundary', description: 'All zeros' },
    );
  } else if (p.string) {
    cases.push(
      { input: 'a', expectedOutput: null, category: 'edge_case', description: 'Single character' },
      { input: 'hello', expectedOutput: null, category: 'basic', description: 'Simple string' },
      { input: 'aaa', expectedOutput: null, category: 'edge_case', description: 'All same chars' },
      { input: 'a b c', expectedOutput: null, category: 'edge_case', description: 'String with spaces' },
      { input: ' ', expectedOutput: null, category: 'edge_case', description: 'Just a space' },
      { input: 'AbCdEf', expectedOutput: null, category: 'edge_case', description: 'Mixed case' },
    );
  } else if (p.float) {
    cases.push(
      { input: '0.0', expectedOutput: null, category: 'edge_case', description: 'Zero float' },
      { input: '-3.14', expectedOutput: null, category: 'negative', description: 'Negative float' },
      { input: '999999.99', expectedOutput: null, category: 'large_input', description: 'Large float' },
    );
  } else {
    // Generic fallback
    cases.push(
      { input: '0', expectedOutput: null, category: 'edge_case', description: 'Zero/falsy' },
      { input: '1', expectedOutput: null, category: 'basic', description: 'Simple input' },
      { input: '-1', expectedOutput: null, category: 'negative', description: 'Negative' },
      { input: 'hello', expectedOutput: null, category: 'basic', description: 'String input' },
    );
  }

  // ===== PROBLEM-AWARE test cases =====
  const prob = (problemStatement || '').toLowerCase();
  if (prob.includes('palindrome')) {
    cases.push({ input: 'racecar', expectedOutput: null, category: 'basic', description: 'Known palindrome' });
    cases.push({ input: 'hello', expectedOutput: null, category: 'basic', description: 'Not a palindrome' });
  }
  if (prob.includes('fibonacci') || prob.includes('fib')) {
    cases.push({ input: '0', expectedOutput: '0', category: 'edge_case', description: 'Fib(0)=0' });
    cases.push({ input: '1', expectedOutput: '1', category: 'edge_case', description: 'Fib(1)=1' });
    cases.push({ input: '10', expectedOutput: '55', category: 'basic', description: 'Fib(10)=55' });
  }
  if (prob.includes('prime')) {
    cases.push({ input: '1', expectedOutput: null, category: 'edge_case', description: '1 is NOT prime' });
    cases.push({ input: '2', expectedOutput: null, category: 'boundary', description: 'Smallest prime' });
    cases.push({ input: '0', expectedOutput: null, category: 'edge_case', description: '0 is NOT prime' });
  }
  if (prob.includes('sort')) {
    cases.push({ input: '1\n1', expectedOutput: null, category: 'edge_case', description: 'Single element sort' });
  }
  if (prob.includes('sum') || prob.includes('two sum')) {
    cases.push({ input: '1\n0', expectedOutput: null, category: 'edge_case', description: 'Single element for sum' });
  }
  if (prob.includes('reverse')) {
    cases.push({ input: 'a', expectedOutput: null, category: 'edge_case', description: 'Single char reverse' });
    cases.push({ input: '', expectedOutput: null, category: 'empty', description: 'Empty reverse' });
  }

  return cases;
}

module.exports = { generateTestCases, detectInputPattern };
