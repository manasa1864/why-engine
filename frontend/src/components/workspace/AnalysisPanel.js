import { useState } from 'react';

/* ─── Tiny section helpers (no emojis) ─── */
function Sec({ title, content }) {
  if (!content) return null;
  return (
    <div className="a-sec">
      <h3>{title}</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
    </div>
  );
}

function CodeBlock({ title, code, badge }) {
  if (!code) return null;
  return (
    <div className="a-sec">
      <h3>
        {title}
        {badge && (
          <span className="tag tag-c" style={{ marginLeft: 8, fontWeight: 600 }}>{badge}</span>
        )}
      </h3>
      <pre>{code}</pre>
    </div>
  );
}

function ComplexityBadge({ label, value }) {
  if (!value) return null;
  const lower = (value || '').toLowerCase();
  const cls = lower.includes('n²') || lower.includes('n^2') || lower.includes('2^n')
    ? 'time-bad'
    : lower.includes('n log') || lower.includes('n·log') || lower.includes('nlogn')
    ? 'time-warn'
    : 'time-ok';
  return (
    <div className={`complexity-badge ${cls}`}>
      <span className="cb-label">{label}</span>
      {value}
    </div>
  );
}

export default function AnalysisPanel({ result, loading, language }) {
  const [tab, setTab]     = useState('output');
  const [hints, setHints] = useState(new Set());

  const toggleHint = i => setHints(prev => {
    const n = new Set(prev);
    n.has(i) ? n.delete(i) : n.add(i);
    return n;
  });

  /* ── Empty state ── */
  if (!result && !loading) {
    return (
      <div className="ws-pan">
        <div className="tabs">
          <button className="tab on">Output</button>
          <button className="tab">WHY Analysis</button>
          <button className="tab">Tests</button>
          <button className="tab">Delta</button>
        </div>
        <div className="pan">
          <div className="empty">
            <div className="empty-icon">&#9881;</div>
            <p>Run or Analyze your code to see results</p>
            <p style={{ fontSize: '.77rem' }}>
              Run = execute only &nbsp;|&nbsp; Analyze = full WHY pipeline
            </p>
          </div>
        </div>
      </div>
    );
  }

  const a = result?.whyAnalysis || {};
  const exec = result?.executionResult || {};

  const tabs = [
    { id: 'output', label: 'Output' },
    { id: 'why',    label: 'WHY Analysis' },
    { id: 'tests',  label: 'Tests', count: result?.testCases?.length },
    { id: 'delta',  label: 'Delta' },
  ];

  return (
    <div className="ws-pan">
      {/* Tab bar */}
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count != null && <span className="cnt">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="pan">
        {/* Loading */}
        {loading && (
          <div className="loading" style={{ flexDirection: 'column', gap: 14 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
            <span>Running full analysis pipeline...</span>
            <div style={{ fontSize: '.74rem', color: 'var(--text-3)', textAlign: 'center' }}>
              Execution → Static Analysis → Test Cases → AI Reasoning → Profiling
            </div>
          </div>
        )}

        {/* ══════════════ OUTPUT TAB ══════════════ */}
        {!loading && tab === 'output' && result && (
          <div className="fade">
            {/* Output box */}
            <div className={`out ${exec.stderr ? 'err' : exec.status === 'Accepted' ? 'ok' : ''}`}>
              {exec.stdout || exec.stderr || '(no output)'}
            </div>

            {/* Execution metadata */}
            <div className="out-m">
              <span>
                Status:{' '}
                <b style={{ color: exec.status === 'Accepted' ? 'var(--ok)' : 'var(--err)' }}>
                  {exec.status}
                </b>
              </span>
              <span>Time: <b>{exec.time}s</b></span>
              <span>Memory: <b>{exec.memory}</b></span>
              {result.processingTime && (
                <span>Pipeline: <b>{(result.processingTime / 1000).toFixed(1)}s</b></span>
              )}
            </div>

            {/* Complexity row — from AI or static analysis */}
            {(a.userCodeComplexity || a.optimizedComplexity) && (
              <div className="complexity-row">
                <ComplexityBadge label="Your code" value={a.userCodeComplexity} />
                <ComplexityBadge label="Optimized" value={a.optimizedComplexity} />
              </div>
            )}

            {/* Language badge */}
            {language && (
              <div style={{ marginTop: 8 }}>
                <span className="tag tag-i">{language.toUpperCase()}</span>
                {a.cognitiveTaxonomy?.languageSpecificPattern && (
                  <span style={{ fontSize: '.77rem', color: 'var(--text-3)' }}>
                    {a.cognitiveTaxonomy.languageSpecificPattern}
                  </span>
                )}
              </div>
            )}

            {/* Static issues */}
            {result.staticAnalysis?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h4 style={{
                  fontSize: '.71rem', fontWeight: 700,
                  color: 'var(--text-3)', textTransform: 'uppercase',
                  marginBottom: 8, letterSpacing: '.06em',
                }}>
                  Static Analysis ({result.staticAnalysis.length})
                </h4>
                {result.staticAnalysis.map((issue, j) => (
                  <div key={j} className={`iss ${issue.severity}`}>
                    <div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '.71rem', marginRight: 8 }}>
                        L{issue.line}
                      </span>
                      {issue.message}
                    </div>
                    {issue.suggestion && (
                      <div className="iss-sug">Suggestion: {issue.suggestion}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pipeline steps */}
            {result.pipelineSteps && (
              <div style={{ marginTop: 12, fontSize: '.71rem', color: 'var(--text-3)' }}>
                Pipeline: {result.pipelineSteps.join(' → ')}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ WHY ANALYSIS TAB ══════════════ */}
        {!loading && tab === 'why' && result && (
          <div className="fade">
            {/* Confidence */}
            {a.confidence && (
              <div className="a-sec">
                <h3>Analysis Confidence</h3>
                <div className="conf-row">
                  <span
                    className="conf-val"
                    style={{
                      color: (a.confidence.analysisConfidence || 0) > 0.7
                        ? 'var(--ok)'
                        : (a.confidence.analysisConfidence || 0) > 0.4
                        ? 'var(--warn)'
                        : 'var(--err)',
                    }}
                  >
                    {Math.round((a.confidence.analysisConfidence || 0) * 100)}%
                  </span>
                  <div className="conf-bar">
                    <div
                      className={`conf-fill ${
                        (a.confidence.analysisConfidence || 0) > 0.7 ? 'hi' :
                        (a.confidence.analysisConfidence || 0) > 0.4 ? 'md' : 'lo'
                      }`}
                      style={{ width: `${(a.confidence.analysisConfidence || 0) * 100}%` }}
                    />
                  </div>
                </div>
                {a.confidence.uncertainAreas?.length > 0 && (
                  <p style={{ marginTop: 6, fontSize: '.77rem' }}>
                    Uncertain: {a.confidence.uncertainAreas.join(', ')}
                  </p>
                )}
                {a.confidence.dataSourcesUsed?.length > 0 && (
                  <div style={{ marginTop: 5, fontSize: '.71rem', color: 'var(--text-3)' }}>
                    Sources:{' '}
                    {a.confidence.dataSourcesUsed.map(s => (
                      <span key={s} className="tag tag-c" style={{ marginLeft: 3 }}>{s}</span>
                    ))}
                    {a.confidence.modelUsed && a.confidence.modelUsed !== 'none' && (
                      <span className="tag tag-i" style={{ marginLeft: 3 }}>{a.confidence.modelUsed}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Complexity (from AI) */}
            {(a.userCodeComplexity || a.optimizedComplexity) && (
              <div className="a-sec">
                <h3>Complexity Analysis</h3>
                <div className="complexity-row" style={{ marginTop: 0 }}>
                  <ComplexityBadge label="Submitted code" value={a.userCodeComplexity} />
                  <ComplexityBadge label="Optimized"      value={a.optimizedComplexity} />
                </div>
              </div>
            )}

            {/* Error classification */}
            {a.cognitiveTaxonomy && (
              <div className="a-sec">
                <h3>Error Classification</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span className="tag tag-e">{a.cognitiveTaxonomy.errorType}</span>
                  <span className="tag tag-c">{a.cognitiveTaxonomy.category}</span>
                  {a.cognitiveTaxonomy.confidence && (
                    <span className="tag tag-w">
                      {Math.round(a.cognitiveTaxonomy.confidence * 100)}%
                    </span>
                  )}
                  {language && <span className="tag tag-i">{language.toUpperCase()}</span>}
                </div>
                {a.cognitiveTaxonomy.pattern && <p>{a.cognitiveTaxonomy.pattern}</p>}
                {a.cognitiveTaxonomy.languageSpecificPattern && (
                  <p style={{ marginTop: 4, fontSize: '.8rem', color: 'var(--info)' }}>
                    {language}-specific: {a.cognitiveTaxonomy.languageSpecificPattern}
                  </p>
                )}
                {a.cognitiveTaxonomy.subPatterns?.length > 0 && (
                  <ul style={{ marginTop: 4 }}>
                    {a.cognitiveTaxonomy.subPatterns.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Thinking comparison */}
            {a.thinkingComparison && a.thinkingComparison.approachMatch > 0 && (
              <div className="a-sec">
                <h3>Thinking vs Reality</h3>
                <div className="think-cmp">
                  <div className="think-cmp-item">
                    <div
                      className="think-cmp-val"
                      style={{ color: a.thinkingComparison.approachMatch > 60 ? 'var(--ok)' : 'var(--warn)' }}
                    >
                      {a.thinkingComparison.approachMatch}%
                    </div>
                    <div className="think-cmp-lbl">Approach</div>
                  </div>
                  <div className="think-cmp-item">
                    <div
                      className="think-cmp-val"
                      style={{ color: a.thinkingComparison.edgeCasesCovered > 60 ? 'var(--ok)' : 'var(--err)' }}
                    >
                      {a.thinkingComparison.edgeCasesCovered}%
                    </div>
                    <div className="think-cmp-lbl">Edge Cases</div>
                  </div>
                  <div className="think-cmp-item">
                    <div
                      className="think-cmp-val"
                      style={{ color: a.thinkingComparison.complexityMatch ? 'var(--ok)' : 'var(--err)' }}
                    >
                      {a.thinkingComparison.complexityMatch ? 'Match' : 'Miss'}
                    </div>
                    <div className="think-cmp-lbl">Complexity</div>
                  </div>
                </div>
                {a.thinkingComparison.gaps?.length > 0 && (
                  <>
                    <p style={{ fontSize: '.77rem', fontWeight: 600, marginTop: 6 }}>Gaps identified:</p>
                    <ul>
                      {a.thinkingComparison.gaps.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Hints — reveal on click */}
            {a.hintsProvided?.length > 0 && (
              <div className="a-sec">
                <h3>Guided Hints</h3>
                <p style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: 8 }}>
                  Try these before reading the solution — click to reveal.
                </p>
                {a.hintsProvided.map((h, i) => (
                  <div
                    key={i}
                    className={`hint ${hints.has(i) ? '' : 'hid'}`}
                    onClick={() => toggleHint(i)}
                  >
                    <div className="hint-lv">
                      {h.level === 1 ? 'Subtle' : h.level === 2 ? 'Medium' : 'Direct'} hint
                      {!hints.has(i) && ' — click to reveal'}
                    </div>
                    <div className="hint-t">{h.hint}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Core WHY sections */}
            <Sec title="Mistake Summary"    content={a.mistakeSummary} />
            <Sec title="Why It Is Wrong"    content={a.whyWrong} />
            <Sec title="Your Thought Process" content={a.thoughtProcess} />
            <Sec title="Root Cause"         content={a.rootCause} />

            {/* Failing cases */}
            {a.failingCases?.length > 0 && (
              <div className="a-sec">
                <h3>Failing Cases</h3>
                <ul>
                  {a.failingCases.map((c, i) => (
                    <li key={i} style={{ fontFamily: 'var(--mono)', fontSize: '.8rem' }}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Line-by-line */}
            {a.lineByLine?.length > 0 && (
              <div className="a-sec">
                <h3>Line-by-Line Analysis</h3>
                {a.lineByLine.map((ln, i) => (
                  <div key={i} className={`ln ${ln.hasIssue ? 'bad' : ''}`}>
                    <span className="ln-n">L{ln.line}</span>
                    <div>
                      {ln.code && (
                        <code style={{ display: 'block', marginBottom: 2 }}>{ln.code}</code>
                      )}
                      <span>{ln.explanation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Correct logic + code */}
            <Sec title="Correct Logic" content={a.correctLogic} />
            <CodeBlock title="Correct Code" code={a.correctCode} badge={language?.toUpperCase()} />
            <Sec title="Correct Code Walkthrough" content={a.correctCodeWalkthrough} />

            {/* Optimized solution */}
            {a.optimizedCode && (
              <div className="a-sec">
                <h3>
                  Optimized Solution
                  {a.optimizedComplexity && (
                    <span className="tag tag-c" style={{ marginLeft: 8 }}>
                      {a.optimizedComplexity}
                    </span>
                  )}
                </h3>
                <pre>{a.optimizedCode}</pre>
              </div>
            )}

            {/* Mental model */}
            <Sec title="Mental Model" content={a.mentalModel} />

            {/* Multiple approaches */}
            {a.multipleApproaches?.length > 0 && (
              <div className="a-sec">
                <h3>Multiple Approaches</h3>
                {a.multipleApproaches.map((ap, i) => (
                  <div key={i} className="ap">
                    <div className="ap-h">
                      <span className="ap-n">{ap.name}</span>
                      <div>
                        <span className="ap-c">{ap.complexity}</span>
                        {ap.spaceComplexity && (
                          <span className="ap-c" style={{ marginLeft: 8 }}>
                            Space: {ap.spaceComplexity}
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '.84rem', marginBottom: 6 }}>{ap.description}</p>
                    {(ap.pros?.length > 0 || ap.cons?.length > 0) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '.77rem' }}>
                        {ap.pros?.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--ok)', fontSize: '.69rem', marginBottom: 2 }}>
                              PROS
                            </div>
                            <ul style={{ paddingLeft: 14 }}>
                              {ap.pros.map((p, j) => <li key={j}>{p}</li>)}
                            </ul>
                          </div>
                        )}
                        {ap.cons?.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--err)', fontSize: '.69rem', marginBottom: 2 }}>
                              CONS
                            </div>
                            <ul style={{ paddingLeft: 14 }}>
                              {ap.cons.map((c, j) => <li key={j}>{c}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {ap.code && <pre style={{ marginTop: 7 }}>{ap.code}</pre>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ TESTS TAB ══════════════ */}
        {!loading && tab === 'tests' && result && (
          <div className="fade">
            {result.testCases?.length > 0 && (
              <div style={{ marginBottom: 10, fontSize: '.82rem', color: 'var(--text-3)' }}>
                {result.testCases.filter(t => t.passed).length} / {result.testCases.length} passing
              </div>
            )}
            {(result.testCases || []).map((t, i) => (
              <div key={i} className={`tc ${t.passed ? 'pass' : 'fail'}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tc-in">
                    Input: "{t.input || '(empty)'}" → {t.actualOutput || '(none)'}
                  </div>
                  {t.expectedOutput && (
                    <div style={{ fontSize: '.74rem', color: 'var(--text-3)', marginTop: 1 }}>
                      Expected: {t.expectedOutput}
                    </div>
                  )}
                  <div className="tc-d">{t.description || t.category}</div>
                </div>
                <span className={`badge ${t.passed ? 'pass' : 'fail'}`}>
                  {t.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
            {!result.testCases?.length && (
              <div className="empty"><p>No test cases generated</p></div>
            )}
          </div>
        )}

        {/* ══════════════ DELTA TAB ══════════════ */}
        {!loading && tab === 'delta' && result && (
          <div className="fade">
            {result.deltaAnalysis && result.deltaAnalysis.overallProgress !== 'first_attempt' ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                  <span
                    className={`tag ${
                      result.deltaAnalysis.overallProgress === 'improved' ? 'tag-s' :
                      result.deltaAnalysis.overallProgress === 'regressed' ? 'tag-e' : 'tag-w'
                    }`}
                    style={{ fontSize: '.84rem', padding: '5px 14px' }}
                  >
                    {result.deltaAnalysis.overallProgress === 'improved' ? 'IMPROVED' :
                     result.deltaAnalysis.overallProgress === 'regressed' ? 'REGRESSED' : 'UNCHANGED'}
                  </span>
                </div>
                {result.deltaAnalysis.improvements?.length > 0 && (
                  <div className="d-sec imp">
                    <h4>Improvements</h4>
                    {result.deltaAnalysis.improvements.map((x, i) => (
                      <div key={i} className="d-item">+ {x}</div>
                    ))}
                  </div>
                )}
                {result.deltaAnalysis.regressions?.length > 0 && (
                  <div className="d-sec reg">
                    <h4>Regressions</h4>
                    {result.deltaAnalysis.regressions.map((x, i) => (
                      <div key={i} className="d-item">- {x}</div>
                    ))}
                  </div>
                )}
                {result.deltaAnalysis.unchanged?.length > 0 && (
                  <div className="d-sec unc">
                    <h4>Unchanged</h4>
                    {result.deltaAnalysis.unchanged.map((x, i) => (
                      <div key={i} className="d-item">= {x}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty">
                <p>Submit multiple attempts on the same chat to see progress delta.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
