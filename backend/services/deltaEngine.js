/*
 * ========================================
 * ENGINE 4: MULTI-ATTEMPT / DELTA ENGINE
 * ========================================
 * Compares successive code attempts:
 *   - Test case pass/fail changes
 *   - Execution status changes
 *   - Static analysis improvement
 *   - Error type changes
 *   - Code complexity changes
 *   - Overall progress direction
 */

function computeDelta(prev, curr) {
  if (!prev) return { comparedWithAttempt: 0, improvements: [], regressions: [], unchanged: ['First attempt — no comparison available'], overallProgress: 'first_attempt', testCasesDelta: { newlyPassing: 0, newlyFailing: 0 } };

  const imp = [], reg = [], unc = [];

  // Execution status
  const ps = prev.executionResult?.status, cs = curr.executionResult?.status;
  if (ps !== 'Accepted' && cs === 'Accepted') imp.push('Code now compiles and runs successfully');
  else if (ps === 'Accepted' && cs !== 'Accepted') reg.push(`Code broke — status: ${cs}`);
  else if (ps === cs) unc.push(`Execution status unchanged: ${cs || 'unknown'}`);
  else if (cs === 'Accepted') imp.push(`Status improved: ${ps} → ${cs}`);
  else reg.push(`Status changed: ${ps} → ${cs}`);

  // Test cases
  const pt = (prev.testCases || []), ct = (curr.testCases || []);
  const pp = pt.filter(t => t.passed).length, cp = ct.filter(t => t.passed).length;
  let newlyPassing = 0, newlyFailing = 0;

  if (cp > pp) { newlyPassing = cp - pp; imp.push(`${newlyPassing} more test(s) passing (${pp}/${pt.length} → ${cp}/${ct.length})`); }
  else if (cp < pp) { newlyFailing = pp - cp; reg.push(`${newlyFailing} test(s) now failing (${pp}/${pt.length} → ${cp}/${ct.length})`); }
  else unc.push(`Tests unchanged: ${cp}/${ct.length} passing`);

  // Failing categories
  const prevFail = new Set(pt.filter(t => !t.passed).map(t => t.category));
  const currFail = new Set(ct.filter(t => !t.passed).map(t => t.category));
  for (const c of prevFail) if (!currFail.has(c)) imp.push(`Fixed: ${c} tests now pass`);
  for (const c of currFail) if (!prevFail.has(c)) reg.push(`New failures in: ${c} tests`);

  // Static analysis
  const pi = prev.staticAnalysis?.issues?.length || 0, ci = curr.staticAnalysis?.issues?.length || 0;
  if (ci < pi) imp.push(`Static issues reduced: ${pi} → ${ci}`);
  else if (ci > pi) reg.push(`Static issues increased: ${pi} → ${ci}`);

  // Error type
  const pe = prev.whyAnalysis?.cognitiveTaxonomy?.errorType;
  const ce = curr.whyAnalysis?.cognitiveTaxonomy?.errorType;
  if (pe && ce && pe !== ce) {
    if (ce === 'NO_ERROR') imp.push(`Error resolved! (was: ${pe})`);
    else unc.push(`Error type changed: ${pe} → ${ce}`);
  }

  // Code length
  const pl = (prev.code || '').split('\n').length, cl = (curr.code || '').split('\n').length;
  if (Math.abs(cl - pl) > 3) {
    if (cl < pl) imp.push(`Code simplified: ${pl} → ${cl} lines`);
    else unc.push(`Code grew: ${pl} → ${cl} lines`);
  }

  const overall = imp.length > reg.length ? 'improved' : reg.length > imp.length ? 'regressed' : 'same';
  return { comparedWithAttempt: prev.attemptNumber || 1, improvements: imp, regressions: reg, unchanged: unc, overallProgress: overall, testCasesDelta: { newlyPassing, newlyFailing } };
}

module.exports = { computeDelta };
