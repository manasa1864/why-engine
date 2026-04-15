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
 *
 * Expected outputs are set precisely wherever the correct answer
 * can be derived statically. For the rest, the correct-code oracle
 * (run in code.js after LLM returns correctCode) fills them in.
 */

function detectInputPattern(code, lang) {
  const p = { integer: false, string: false, array: false, float: false, multi: false, matrix: false };
  if (lang === 'python') {
    // Match int(input()) AND int(input("prompt")) — the \( without closing paren is intentional
    if (/int\s*\(\s*input\s*\(/.test(code)) p.integer = true;
    if (/float\s*\(\s*input\s*\(/.test(code)) p.float = true;
    // Match any input( call not already matched above
    if (/input\s*\(/.test(code) && !p.integer && !p.float) p.string = true;
    if (/map\s*\(\s*int.*input\s*\(.*\.split/.test(code)) p.array = true;
    if (/for.*range.*int.*input/.test(code) && code.includes('[]')) p.matrix = true;
    if ((code.match(/input\s*\(/g) || []).length > 1) p.multi = true;
  } else if (lang === 'javascript') {
    if (/parseInt|Number\(/.test(code)) p.integer = true;
    if (/readline|process\.stdin/.test(code)) p.string = true;
    if (/split\s*\(/.test(code)) p.array = true;
  } else if (lang === 'cpp' || lang === 'c') {
    if (/cin\s*>>|scanf.*%d/.test(code)) p.integer = true;
    if (/getline|gets|scanf.*%s/.test(code)) p.string = true;
    if (/\[\s*\d+\s*\]/.test(code)) p.array = true;
  } else if (lang === 'java') {
    if (/nextInt|nextLong/.test(code)) p.integer = true;
    if (/nextLine|next\(\)/.test(code)) p.string = true;
    if (/new\s+int\[|ArrayList/.test(code)) p.array = true;
  } else if (lang === 'go') {
    if (/fmt\.Scan/.test(code)) p.integer = true;
  } else if (lang === 'rust') {
    if (/parse::<i/.test(code) || /parse::<u/.test(code)) p.integer = true;
    if (/read_line/.test(code)) p.string = true;
  }
  return p;
}

function generateTestCases(code, language, problemStatement = '') {
  const cases = [];
  const p = detectInputPattern(code, language);
  const prob = (problemStatement || '').toLowerCase();

  // ── PROBLEM-SPECIFIC (highest accuracy — known expected outputs) ─────────

  if (prob.includes('fibonacci') || prob.includes('fib')) {
    cases.push(
      { input: '0',  expectedOutput: '0',  category: 'edge_case',  description: 'Fib(0) = 0' },
      { input: '1',  expectedOutput: '1',  category: 'edge_case',  description: 'Fib(1) = 1' },
      { input: '2',  expectedOutput: '1',  category: 'basic',      description: 'Fib(2) = 1' },
      { input: '5',  expectedOutput: '5',  category: 'basic',      description: 'Fib(5) = 5' },
      { input: '10', expectedOutput: '55', category: 'basic',      description: 'Fib(10) = 55' },
      { input: '20', expectedOutput: '6765', category: 'stress',   description: 'Fib(20) = 6765' },
    );
    return cases;
  }

  if (prob.includes('factorial')) {
    cases.push(
      { input: '0',  expectedOutput: '1',   category: 'edge_case', description: '0! = 1' },
      { input: '1',  expectedOutput: '1',   category: 'edge_case', description: '1! = 1' },
      { input: '5',  expectedOutput: '120', category: 'basic',     description: '5! = 120' },
      { input: '10', expectedOutput: '3628800', category: 'basic', description: '10! = 3628800' },
      { input: '-1', expectedOutput: null,  category: 'negative',  description: 'Negative factorial (edge)' },
    );
    return cases;
  }

  if (prob.includes('prime') || prob.includes('is prime')) {
    cases.push(
      { input: '0',  expectedOutput: null, category: 'edge_case',  description: '0 is NOT prime' },
      { input: '1',  expectedOutput: null, category: 'edge_case',  description: '1 is NOT prime' },
      { input: '2',  expectedOutput: null, category: 'boundary',   description: 'Smallest prime' },
      { input: '3',  expectedOutput: null, category: 'basic',      description: 'Prime: 3' },
      { input: '4',  expectedOutput: null, category: 'basic',      description: 'Not prime: 4' },
      { input: '17', expectedOutput: null, category: 'basic',      description: 'Prime: 17' },
      { input: '1000000007', expectedOutput: null, category: 'stress', description: 'Large prime' },
    );
    return cases;
  }

  if (prob.includes('palindrome')) {
    cases.push(
      { input: '',        expectedOutput: null, category: 'empty',    description: 'Empty string' },
      { input: 'a',       expectedOutput: null, category: 'edge_case',description: 'Single char is palindrome' },
      { input: 'aa',      expectedOutput: null, category: 'basic',    description: 'Two same chars' },
      { input: 'racecar', expectedOutput: null, category: 'basic',    description: 'Known palindrome' },
      { input: 'hello',   expectedOutput: null, category: 'basic',    description: 'Not a palindrome' },
      { input: 'A',       expectedOutput: null, category: 'basic',    description: 'Uppercase single' },
      { input: 'abba',    expectedOutput: null, category: 'basic',    description: 'Even-length palindrome' },
      { input: 'abcba',   expectedOutput: null, category: 'basic',    description: 'Odd-length palindrome' },
    );
    return cases;
  }

  if (prob.includes('reverse')) {
    cases.push(
      { input: '',        expectedOutput: '',       category: 'empty',    description: 'Empty reverse' },
      { input: 'a',       expectedOutput: 'a',      category: 'edge_case',description: 'Single char' },
      { input: 'hello',   expectedOutput: 'olleh',  category: 'basic',    description: 'Reverse hello' },
      { input: 'abcde',   expectedOutput: 'edcba',  category: 'basic',    description: 'Reverse 5 chars' },
      { input: '12345',   expectedOutput: '54321',  category: 'basic',    description: 'Reverse digits' },
    );
    return cases;
  }

  if (prob.includes('two sum') || (prob.includes('sum') && prob.includes('target'))) {
    cases.push(
      { input: '4\n2 7 11 15\n9', expectedOutput: null, category: 'basic',    description: 'Classic two sum' },
      { input: '2\n0 0\n0',       expectedOutput: null, category: 'edge_case',description: 'Two zeros' },
      { input: '1\n5\n5',         expectedOutput: null, category: 'edge_case',description: 'Single element' },
      { input: '3\n-1 0 1\n0',    expectedOutput: null, category: 'negative', description: 'Negatives sum to 0' },
    );
    return cases;
  }

  if (prob.includes('sort') || prob.includes('sorting')) {
    cases.push(
      { input: '1\n42',           expectedOutput: '42',         category: 'edge_case', description: 'Single element' },
      { input: '5\n5 4 3 2 1',    expectedOutput: '1 2 3 4 5',  category: 'basic',     description: 'Reverse order' },
      { input: '5\n1 2 3 4 5',    expectedOutput: '1 2 3 4 5',  category: 'basic',     description: 'Already sorted' },
      { input: '5\n1 1 1 1 1',    expectedOutput: '1 1 1 1 1',  category: 'edge_case', description: 'All duplicates' },
      { input: '3\n-3 0 3',       expectedOutput: '-3 0 3',     category: 'negative',  description: 'Negative numbers' },
      { input: '0',               expectedOutput: '',           category: 'empty',     description: 'Empty array' },
    );
    return cases;
  }

  if (prob.includes('gcd') || prob.includes('greatest common divisor')) {
    cases.push(
      { input: '12 8',   expectedOutput: '4',  category: 'basic',    description: 'GCD(12,8)=4' },
      { input: '7 5',    expectedOutput: '1',  category: 'basic',    description: 'Coprime numbers' },
      { input: '0 5',    expectedOutput: '5',  category: 'edge_case',description: 'GCD(0,5)=5' },
      { input: '5 0',    expectedOutput: '5',  category: 'edge_case',description: 'GCD(5,0)=5' },
      { input: '100 75', expectedOutput: '25', category: 'basic',    description: 'GCD(100,75)=25' },
    );
    return cases;
  }

  if (prob.includes('power') || prob.includes('exponent') || (prob.includes('x') && prob.includes('n'))) {
    cases.push(
      { input: '2 0',  expectedOutput: '1',   category: 'edge_case', description: 'x^0=1' },
      { input: '2 1',  expectedOutput: '2',   category: 'basic',     description: 'x^1=x' },
      { input: '2 10', expectedOutput: '1024',category: 'basic',     description: '2^10=1024' },
      { input: '0 5',  expectedOutput: '0',   category: 'edge_case', description: '0^n=0' },
      { input: '1 100',expectedOutput: '1',   category: 'edge_case', description: '1^n=1' },
    );
    return cases;
  }

  if (prob.includes('binary search') || prob.includes('search')) {
    cases.push(
      { input: '5\n1 3 5 7 9\n5',  expectedOutput: null, category: 'basic',    description: 'Target found' },
      { input: '5\n1 3 5 7 9\n4',  expectedOutput: null, category: 'basic',    description: 'Target not found' },
      { input: '1\n42\n42',        expectedOutput: null, category: 'edge_case',description: 'Single element found' },
      { input: '1\n42\n1',         expectedOutput: null, category: 'edge_case',description: 'Single element not found' },
      { input: '5\n1 3 5 7 9\n1',  expectedOutput: null, category: 'boundary', description: 'First element' },
      { input: '5\n1 3 5 7 9\n9',  expectedOutput: null, category: 'boundary', description: 'Last element' },
    );
    return cases;
  }

  if (prob.includes('anagram')) {
    cases.push(
      { input: 'listen\nsilent', expectedOutput: null, category: 'basic',    description: 'Classic anagram' },
      { input: 'hello\nworld',   expectedOutput: null, category: 'basic',    description: 'Not anagram' },
      { input: 'a\na',           expectedOutput: null, category: 'edge_case',description: 'Single char match' },
      { input: 'a\nb',           expectedOutput: null, category: 'edge_case',description: 'Single char mismatch' },
      { input: '\n',             expectedOutput: null, category: 'empty',    description: 'Both empty' },
    );
    return cases;
  }

  // ── GENERIC FALLBACK — pattern-aware ──────────────────────────────────────

  // Always test empty
  cases.push({ input: '', expectedOutput: null, category: 'empty', description: 'Empty input — crash resistance' });

  if (p.integer) {
    cases.push(
      { input: '0',          expectedOutput: null, category: 'edge_case',  description: 'Zero' },
      { input: '1',          expectedOutput: null, category: 'boundary',   description: 'Minimum positive (1)' },
      { input: '-1',         expectedOutput: null, category: 'negative',   description: 'Negative one' },
      { input: '2',          expectedOutput: null, category: 'basic',      description: 'Small positive' },
      { input: '-100',       expectedOutput: null, category: 'negative',   description: 'Larger negative' },
      { input: '1000000',    expectedOutput: null, category: 'stress',     description: '10^6 — performance' },
      { input: '2147483647', expectedOutput: null, category: 'boundary',   description: 'INT_MAX (2^31-1)' },
      { input: '-2147483648',expectedOutput: null, category: 'boundary',   description: 'INT_MIN (-2^31)' },
    );
  } else if (p.array) {
    cases.push(
      { input: '1\n42',          expectedOutput: null, category: 'edge_case', description: 'Single element' },
      { input: '2\n1 2',         expectedOutput: null, category: 'boundary',  description: 'Two elements' },
      { input: '5\n1 2 3 4 5',   expectedOutput: null, category: 'basic',     description: 'Ascending array' },
      { input: '5\n5 4 3 2 1',   expectedOutput: null, category: 'edge_case', description: 'Descending array' },
      { input: '5\n1 1 1 1 1',   expectedOutput: null, category: 'edge_case', description: 'All same elements' },
      { input: '3\n-1 0 1',      expectedOutput: null, category: 'negative',  description: 'Mixed negative/zero/positive' },
      { input: '2\n0 0',         expectedOutput: null, category: 'boundary',  description: 'All zeros' },
      { input: '6\n3 1 4 1 5 9', expectedOutput: null, category: 'basic',     description: 'Random unsorted' },
    );
  } else if (p.string) {
    cases.push(
      { input: 'a',       expectedOutput: null, category: 'edge_case', description: 'Single character' },
      { input: 'hello',   expectedOutput: null, category: 'basic',     description: 'Simple word' },
      { input: 'aaa',     expectedOutput: null, category: 'edge_case', description: 'All same chars' },
      { input: 'a b c',   expectedOutput: null, category: 'edge_case', description: 'String with spaces' },
      { input: ' ',       expectedOutput: null, category: 'edge_case', description: 'Just a space' },
      { input: 'AbCdEf',  expectedOutput: null, category: 'edge_case', description: 'Mixed case' },
      { input: '12345',   expectedOutput: null, category: 'basic',     description: 'Digits as string' },
    );
  } else if (p.float) {
    cases.push(
      { input: '0.0',       expectedOutput: null, category: 'edge_case', description: 'Zero float' },
      { input: '1.0',       expectedOutput: null, category: 'basic',     description: 'One' },
      { input: '-3.14',     expectedOutput: null, category: 'negative',  description: 'Negative float' },
      { input: '0.001',     expectedOutput: null, category: 'boundary',  description: 'Very small float' },
      { input: '999999.99', expectedOutput: null, category: 'stress',    description: 'Large float' },
    );
  } else {
    // Fully generic
    cases.push(
      { input: '0',     expectedOutput: null, category: 'edge_case', description: 'Zero/falsy input' },
      { input: '1',     expectedOutput: null, category: 'basic',     description: 'Simple positive' },
      { input: '-1',    expectedOutput: null, category: 'negative',  description: 'Negative' },
      { input: 'hello', expectedOutput: null, category: 'basic',     description: 'String input' },
    );
  }

  return cases;
}

module.exports = { generateTestCases, detectInputPattern };
