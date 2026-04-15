import { useState } from 'react';
import api from '../../utils/api';

/* ─── Safe string coercion — LLM can return arrays or objects ─── */
function safeStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.join('\n');
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

/* ─── Tiny section helpers ─── */
function Sec({ title, content }) {
  const str = safeStr(content);
  if (!str) return null;
  return (
    <div className="a-sec">
      <h3>{title}</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{str}</p>
    </div>
  );
}

function CodeBlock({ title, code, badge }) {
  const str = safeStr(code);
  if (!str) return null;
  return (
    <div className="a-sec">
      <h3>
        {title}
        {badge && <span className="tag tag-c" style={{ marginLeft: 8, fontWeight: 600 }}>{badge}</span>}
      </h3>
      <pre>{str}</pre>
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

/* ─── Heatmap: 2D scatter plot with gradient background ─── */
function deriveHeatmapItems(result, a) {
  const exec   = result?.executionResult || {};
  const tests  = result?.testCases       || [];
  const issues = result?.staticAnalysis  || [];
  const tc     = a?.thinkingComparison   || {};

  const passRate = tests.length > 0
    ? tests.filter(t => t.passed).length / tests.length
    : (exec.status === 'Accepted' ? 0.7 : 0.2);

  const errorTests = tests.filter(t => t.category === 'edge_case');
  const edgePass   = errorTests.length > 0
    ? errorTests.filter(t => t.passed).length / errorTests.length
    : (tc.edgeCasesCovered != null ? tc.edgeCasesCovered / 100 : 0.5);

  const boundaryTests = tests.filter(t => t.category === 'boundary');
  const boundaryPass  = boundaryTests.length > 0
    ? boundaryTests.filter(t => t.passed).length / boundaryTests.length
    : 0.5;

  const hasComplexityMiss = !!(
    a?.userCodeComplexity && a?.optimizedComplexity &&
    a.userCodeComplexity !== a.optimizedComplexity &&
    (a.userCodeComplexity?.includes('n²') || a.userCodeComplexity?.includes('n^2') ||
     a.userCodeComplexity?.includes('2^n'))
  );
  const algoScore = hasComplexityMiss ? 0.25
    : (a?.userCodeComplexity === a?.optimizedComplexity ? 0.9 : 0.55);

  const errorCount   = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const codeQuality  = Math.max(0, 1 - errorCount * 0.3 - warningCount * 0.1);

  const complexityMatch = tc.complexityMatch != null ? (tc.complexityMatch ? 0.88 : 0.28) : 0.5;
  const approachScore   = tc.approachMatch   != null ? tc.approachMatch / 100 : 0.5;

  const runtimeSafe = exec.status === 'Accepted' ? 0.9
    : exec.status?.includes('TLE')  ? 0.35
    : exec.status?.includes('MLE')  ? 0.45
    : (exec.status ? 0.1 : 0.6);

  // Each item: { name, score (0-1, 1=strong), impact (0-1) }
  return [
    { name: 'Correctness',         score: passRate,       impact: 1.00 },
    { name: 'Edge Cases',          score: edgePass,       impact: 0.88 },
    { name: 'Algorithm Choice',    score: algoScore,      impact: 0.92 },
    { name: 'Code Quality',        score: codeQuality,    impact: 0.72 },
    { name: 'Complexity Insight',  score: complexityMatch,impact: 0.80 },
    { name: 'Problem Understanding',score: approachScore, impact: 0.85 },
    { name: 'Boundary Handling',   score: boundaryPass,   impact: 0.70 },
    { name: 'Runtime Safety',      score: runtimeSafe,    impact: 0.90 },
  ];
}

/* ─── Skill Heatmap (grid) ─── */
function SkillHeatmap({ items, compact }) {
  return (
    <div className={`hm-grid${compact ? ' hm-grid-compact' : ''}`}>
      {items.map((item, i) => {
        const pct  = Math.round(item.score * 100);
        const tier = item.score > 0.65 ? 'ok' : item.score > 0.38 ? 'warn' : 'err';
        return (
          <div key={i} className={`hm-cell hm-cell-${tier}`}>
            <div className="hm-cell-top">
              <span className="hm-cell-name">{item.name}</span>
              <span className="hm-cell-pct">{pct}%</span>
            </div>
            <div className="hm-cell-bar">
              <div className="hm-cell-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Deep Analysis components ─── */
function DeepCodeLine({ line }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`deep-line ${line.code === '' ? 'deep-line-empty' : ''}`}
      onClick={() => setOpen(v => !v)}
      style={{ cursor: 'pointer' }}
    >
      <div className="deep-line-header">
        <span className="deep-line-num">L{line.lineNumber}</span>
        <code className="deep-line-code">{line.code || '(blank line)'}</code>
        {line.role && <span className="deep-line-role">{line.role}</span>}
        <span className="deep-line-chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="deep-line-body">
          <p className="deep-line-explain">{line.childExplanation}</p>
          {line.ahaInsight && (
            <div className="deep-aha">
              <span className="deep-aha-icon">&#128161;</span>
              <span>{line.ahaInsight}</span>
            </div>
          )}
          <div className="deep-line-badges">
            {line.timeContrib && (
              <div className="deep-badge deep-badge-time">
                <span className="deep-badge-label">Time</span>
                {line.timeContrib}
              </div>
            )}
            {line.spaceContrib && (
              <div className="deep-badge deep-badge-space">
                <span className="deep-badge-label">Space</span>
                {line.spaceContrib}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ComplexitySection({ title, data, colorClass }) {
  if (!data) return null;
  return (
    <div className="deep-complexity-card">
      <div className={`deep-complexity-header ${colorClass}`}>
        <span className="deep-complexity-title">{title}</span>
        <span className="deep-complexity-overall">{data.overall}</span>
      </div>
      {data.realWorldMeaning && (
        <div className="deep-complexity-meaning">{data.realWorldMeaning}</div>
      )}
      {data.bottleneck && (
        <div className="deep-complexity-bottleneck">
          <span style={{ fontWeight: 700, color: 'var(--warn)' }}>Bottleneck:</span> {data.bottleneck}
        </div>
      )}
      {data.sections?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {data.sections.map((s, i) => (
            <div key={i} className="deep-section-row">
              <div className="deep-section-label">{s.label}
                {s.lines && <span className="deep-section-lines"> (lines {s.lines})</span>}
              </div>
              <span className="deep-section-contrib">{s.contribution}</span>
              <p className="deep-section-explain">{s.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpaceSection({ title, data, colorClass }) {
  if (!data) return null;
  return (
    <div className="deep-complexity-card">
      <div className={`deep-complexity-header ${colorClass}`}>
        <span className="deep-complexity-title">{title}</span>
        <span className="deep-complexity-overall">{data.overall}</span>
      </div>
      {data.explanation && (
        <div className="deep-complexity-meaning">{data.explanation}</div>
      )}
      {data.dataStructures?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {data.dataStructures.map((ds, i) => (
            <div key={i} className="deep-section-row">
              <div className="deep-section-label">
                <code style={{ fontFamily: 'var(--mono)', fontSize: '.75rem' }}>{ds.name}</code>
                {ds.type && <span className="deep-section-lines"> ({ds.type})</span>}
              </div>
              <span className="deep-section-contrib">{ds.space}</span>
              <p className="deep-section-explain">{ds.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Baby-level step-by-step fix guide ─── */
const WEAKNESS_TIPS = {
  'Correctness':            'Trace your code line-by-line on paper with a tiny example (n=3). Does every step match what you expected? This catches most bugs instantly.',
  'Edge Cases':             'Before coding, write down 3 "weird" inputs: what if n=0? What if the list is empty? What if two items are equal? Test all of them.',
  'Algorithm Choice':       'Ask yourself before writing a single line: "Is there a pattern here — sorting, hashing, binary search — that could make this way faster?" Think first, code second.',
  'Code Quality':           'Read your code out loud. Every variable called "x" or "temp" should be renamed to say exactly what it stores — this alone prevents half your bugs.',
  'Complexity Insight':     'Count your loops. One loop = O(n). A loop inside a loop = O(n²). With n=10,000 that is 100 million steps. Always estimate before you run.',
  'Problem Understanding':  'Re-read the problem statement and underline every constraint. Write out 2 concrete examples with their expected answers BEFORE you start coding.',
  'Boundary Handling':      'Always test: index 0, index length-1, n=0, n=1, and negative numbers. These five checks catch 80% of off-by-one and boundary bugs.',
  'Runtime Safety':         'Ask: what is the maximum allowed n? If n=100,000 and your algorithm is O(n²), that is 10 billion steps — most judges will timeout at ~100 million.',
};

function BabyGuide({ a, hmItems }) {
  const fix       = a?.stepByStepFix;
  const weakItems = (hmItems || [])
    .filter(it => it.score < 0.65)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  // Derive steps from correctLogic when LLM fix is unavailable (older analyses)
  // correctLogic can be a string, array, or object depending on API version
  const steps = fix?.steps?.length
    ? fix.steps
    : (typeof a?.correctLogic === 'string' && a.correctLogic
        ? a.correctLogic
            .split('\n')
            .filter(Boolean)
            .map((s, i) => ({ stepNumber: i + 1, action: s.replace(/^\d+[\.\)]\s*/, '').trim() }))
        : null);

  const hasContent = fix || a?.rootCause || steps?.length || weakItems.length;
  if (!hasContent) return null;

  return (
    <div className="a-sec">
      <h3>How to Fix This — Baby Steps</h3>

      {/* What went wrong */}
      {(fix?.simpleExplanation || a?.rootCause) && (
        <div className="baby-explain">
          <span className="baby-icon">&#128269;</span>
          <p>{fix?.simpleExplanation || a?.rootCause}</p>
        </div>
      )}

      {/* Vivid analogy */}
      {fix?.analogyExplanation && (
        <div className="baby-analogy">
          <span className="baby-icon">&#128161;</span>
          <p>{fix.analogyExplanation}</p>
        </div>
      )}

      {/* Step-by-step */}
      {steps?.length > 0 && (
        <div className="baby-steps">
          {steps.map((s, i) => (
            <div key={i} className="baby-step">
              <div className="baby-step-num">{s.stepNumber || i + 1}</div>
              <div className="baby-step-body">
                {s.title && <div className="baby-step-title">{s.title}</div>}
                <div className="baby-step-action">{s.action}</div>
                {s.reason && <div className="baby-step-reason">{s.reason}</div>}
                {s.check && <div className="baby-step-check">&#10003; Check: {s.check}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Weaknesses to improve */}
      {weakItems.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="baby-weak-header">Skills to work on</div>
          {weakItems.map((item, i) => (
            <div key={i} className="baby-weakness">
              <div className="baby-weakness-top">
                <span className="baby-weakness-name">{item.name}</span>
                <span className="baby-weakness-pct" style={{
                  color: item.score > 0.38 ? 'var(--warn)' : 'var(--err)',
                }}>
                  {Math.round(item.score * 100)}%
                </span>
              </div>
              <p className="baby-weakness-tip">
                {WEAKNESS_TIPS[item.name] || `Practice more ${item.name.toLowerCase()} problems to build this skill.`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Golden rule */}
      {fix?.goldenRule && (
        <div className="baby-golden">
          <span style={{ fontWeight: 800, fontSize: '.8rem' }}>&#128204; Remember this forever:</span>
          <p style={{ fontStyle: 'italic', margin: '5px 0 0', fontSize: '.88rem' }}>{fix.goldenRule}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PANEL
══════════════════════════════════════════════════════════════════ */
export default function AnalysisPanel({ result, loading, language, code }) {
  const [tab, setTab] = useState('output');
  const [hints, setHints] = useState(() => {
    const mode = localStorage.getItem('why_hintMode') || 'progressive';
    return mode === 'all-visible' ? new Set([0,1,2,3,4]) : new Set();
  });

  // Deep analysis state
  const [deep,        setDeep]        = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError,   setDeepError]   = useState(null);

  const toggleHint = i => setHints(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  const loadDeep = async () => {
    if (!result || !code) return;
    const a = result?.whyAnalysis || {};
    setDeepLoading(true);
    setDeepError(null);
    try {
      const { data } = await api.post('/code/deep-analysis', {
        code,
        language,
        optimizedCode:       a.optimizedCode       || '',
        userCodeComplexity:  a.userCodeComplexity   || '',
        optimizedComplexity: a.optimizedComplexity  || '',
      });
      if (data.error) { setDeepError(data.error); }
      else { setDeep(data); }
    } catch (e) {
      setDeepError(e.response?.data?.error || e.message);
    } finally {
      setDeepLoading(false);
    }
  };

  /* ── Empty state ── */
  if (!result && !loading) {
    return (
      <div className="ws-pan">
        <div className="tabs">
          {['Output','WHY Analysis','Tests','Deep Analysis','Heatmap','Delta'].map(l => (
            <button key={l} className="tab">{l}</button>
          ))}
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

  const a       = result?.whyAnalysis || {};
  const exec    = result?.executionResult || {};
  const hmItems = result ? deriveHeatmapItems(result, a) : [];

  const tabs = [
    { id: 'output', label: 'Output' },
    { id: 'why',    label: 'WHY Analysis' },
    { id: 'tests',  label: 'Tests', count: result?.testCases?.length },
    { id: 'deep',   label: 'Deep Analysis' },
    { id: 'heatmap',label: 'Heatmap' },
    { id: 'delta',  label: 'Delta' },
  ];

  return (
    <div className="ws-pan">
      {/* Tab bar */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
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

        {/* ══════ OUTPUT TAB ══════ */}
        {!loading && tab === 'output' && result && (
          <div className="fade">
            <div className={`out ${exec.stderr ? 'err' : exec.status === 'Accepted' ? 'ok' : ''}`}>
              {exec.stdout || exec.stderr || '(no output)'}
            </div>
            <div className="out-m">
              <span>Status: <b style={{ color: exec.status === 'Accepted' ? 'var(--ok)' : 'var(--err)' }}>{exec.status}</b></span>
              <span>Time: <b>{exec.time}s</b></span>
              <span>Memory: <b>{exec.memory}</b></span>
              {result.processingTime && <span>Pipeline: <b>{(result.processingTime/1000).toFixed(1)}s</b></span>}
            </div>
            {(a.userCodeComplexity || a.optimizedComplexity) && (
              <div className="complexity-row">
                <ComplexityBadge label="Your code" value={a.userCodeComplexity} />
                <ComplexityBadge label="Optimized"  value={a.optimizedComplexity} />
              </div>
            )}
            {language && (
              <div style={{ marginTop: 8 }}>
                <span className="tag tag-i">{language.toUpperCase()}</span>
                {a.cognitiveTaxonomy?.languageSpecificPattern && (
                  <span style={{ fontSize: '.77rem', color: 'var(--text-3)', marginLeft: 8 }}>
                    {a.cognitiveTaxonomy.languageSpecificPattern}
                  </span>
                )}
              </div>
            )}
            {result.staticAnalysis?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h4 style={{ fontSize: '.71rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.06em' }}>
                  Static Analysis ({result.staticAnalysis.length})
                </h4>
                {result.staticAnalysis.map((issue, j) => (
                  <div key={j} className={`iss ${issue.severity}`}>
                    <div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '.71rem', marginRight: 8 }}>L{issue.line}</span>
                      {issue.message}
                    </div>
                    {issue.suggestion && <div className="iss-sug">Suggestion: {issue.suggestion}</div>}
                  </div>
                ))}
              </div>
            )}
            {result.pipelineSteps && (
              <div style={{ marginTop: 12, fontSize: '.71rem', color: 'var(--text-3)' }}>
                Pipeline: {result.pipelineSteps.join(' → ')}
              </div>
            )}
          </div>
        )}

        {/* ══════ WHY ANALYSIS TAB ══════ */}
        {!loading && tab === 'why' && result && (
          <div className="fade">
            {a.confidence && (
              <div className="a-sec">
                <h3>Analysis Confidence</h3>
                <div className="conf-row">
                  <span className="conf-val" style={{ color: (a.confidence.analysisConfidence||0)>0.7?'var(--ok)':(a.confidence.analysisConfidence||0)>0.4?'var(--warn)':'var(--err)' }}>
                    {Math.round((a.confidence.analysisConfidence||0)*100)}%
                  </span>
                  <div className="conf-bar">
                    <div className={`conf-fill ${(a.confidence.analysisConfidence||0)>0.7?'hi':(a.confidence.analysisConfidence||0)>0.4?'md':'lo'}`}
                      style={{ width:`${(a.confidence.analysisConfidence||0)*100}%` }} />
                  </div>
                </div>
                {a.confidence.uncertainAreas?.length > 0 && (
                  <p style={{ marginTop:6, fontSize:'.77rem' }}>Uncertain: {a.confidence.uncertainAreas.join(', ')}</p>
                )}
                {a.confidence.dataSourcesUsed?.length > 0 && (
                  <div style={{ marginTop:5, fontSize:'.71rem', color:'var(--text-3)' }}>
                    Sources: {a.confidence.dataSourcesUsed.map(s => (
                      <span key={s} className="tag tag-c" style={{ marginLeft:3 }}>{s}</span>
                    ))}
                    {a.confidence.modelUsed && a.confidence.modelUsed !== 'none' && (
                      <span className="tag tag-i" style={{ marginLeft:3 }}>{a.confidence.modelUsed}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {(a.userCodeComplexity || a.optimizedComplexity) && (
              <div className="a-sec">
                <h3>Complexity Analysis</h3>
                <div className="complexity-row" style={{ marginTop: 0 }}>
                  <ComplexityBadge label="Submitted code" value={a.userCodeComplexity} />
                  <ComplexityBadge label="Optimized"      value={a.optimizedComplexity} />
                </div>
              </div>
            )}

            {a.cognitiveTaxonomy && (
              <div className="a-sec">
                <h3>Error Classification</h3>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                  <span className="tag tag-e">{a.cognitiveTaxonomy.errorType}</span>
                  <span className="tag tag-c">{a.cognitiveTaxonomy.category}</span>
                  {a.cognitiveTaxonomy.confidence && <span className="tag tag-w">{Math.round(a.cognitiveTaxonomy.confidence*100)}%</span>}
                  {language && <span className="tag tag-i">{language.toUpperCase()}</span>}
                </div>
                {a.cognitiveTaxonomy.pattern && <p>{a.cognitiveTaxonomy.pattern}</p>}
                {a.cognitiveTaxonomy.languageSpecificPattern && (
                  <p style={{ marginTop:4, fontSize:'.8rem', color:'var(--info)' }}>
                    {language}-specific: {a.cognitiveTaxonomy.languageSpecificPattern}
                  </p>
                )}
                {a.cognitiveTaxonomy.subPatterns?.length > 0 && (
                  <ul style={{ marginTop:4 }}>
                    {a.cognitiveTaxonomy.subPatterns.map((s,i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            )}

            {a.thinkingComparison && a.thinkingComparison.approachMatch > 0 && (
              <div className="a-sec">
                <h3>Thinking vs Reality</h3>
                <div className="think-cmp">
                  {[
                    ['Approach',   a.thinkingComparison.approachMatch + '%',   a.thinkingComparison.approachMatch > 60],
                    ['Edge Cases', a.thinkingComparison.edgeCasesCovered + '%', a.thinkingComparison.edgeCasesCovered > 60],
                    ['Complexity', a.thinkingComparison.complexityMatch ? 'Match' : 'Miss', a.thinkingComparison.complexityMatch],
                  ].map(([lbl, val, good]) => (
                    <div key={lbl} className="think-cmp-item">
                      <div className="think-cmp-val" style={{ color: good ? 'var(--ok)' : 'var(--err)' }}>{val}</div>
                      <div className="think-cmp-lbl">{lbl}</div>
                    </div>
                  ))}
                </div>
                {a.thinkingComparison.gaps?.length > 0 && (
                  <>
                    <p style={{ fontSize:'.77rem', fontWeight:600, marginTop:6 }}>Gaps identified:</p>
                    <ul>{a.thinkingComparison.gaps.map((g,i) => <li key={i}>{g}</li>)}</ul>
                  </>
                )}
              </div>
            )}

            {/* ── Skill Profile (compact radar) embedded in thinking profile ── */}
            {hmItems.length > 0 && (
              <div className="a-sec">
                <h3>Skill Profile</h3>
                <p style={{ fontSize:'.75rem', color:'var(--text-3)', marginBottom:10, lineHeight:1.5 }}>
                  Where you stand right now — green = strong, yellow = needs work, red = weakness.
                </p>
                <SkillHeatmap items={hmItems} compact />
              </div>
            )}

            {/* ── Baby-level fix guide based on weaknesses ── */}
            <BabyGuide a={a} hmItems={hmItems} />

            {a.hintsProvided?.length > 0 && (
              <div className="a-sec">
                <h3>Guided Hints</h3>
                <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
                  Try these before reading the solution — click to reveal.
                </p>
                {a.hintsProvided.map((h,i) => (
                  <div key={i} className={`hint ${hints.has(i)?'':'hid'}`} onClick={() => toggleHint(i)}>
                    <div className="hint-lv">
                      {h.level===1?'Subtle':h.level===2?'Medium':'Direct'} hint
                      {!hints.has(i) && ' — click to reveal'}
                    </div>
                    <div className="hint-t">{h.hint}</div>
                  </div>
                ))}
              </div>
            )}

            <Sec title="Mistake Summary"      content={a.mistakeSummary} />
            <Sec title="Why It Is Wrong"      content={a.whyWrong} />
            <Sec title="Your Thought Process" content={a.thoughtProcess} />
            <Sec title="Root Cause"           content={a.rootCause} />

            {a.failingCases?.length > 0 && (
              <div className="a-sec">
                <h3>Failing Cases</h3>
                <ul>{a.failingCases.map((c,i) => <li key={i} style={{ fontFamily:'var(--mono)', fontSize:'.8rem' }}>{c}</li>)}</ul>
              </div>
            )}

            {a.lineByLine?.length > 0 && (
              <div className="a-sec">
                <h3>Line-by-Line Analysis</h3>
                {a.lineByLine.map((ln,i) => (
                  <div key={i} className={`ln ${ln.hasIssue?'bad':''}`}>
                    <span className="ln-n">L{ln.line}</span>
                    <div>
                      {ln.code && <code style={{ display:'block', marginBottom:2 }}>{ln.code}</code>}
                      <span>{ln.explanation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Sec title="Correct Logic" content={a.correctLogic} />
            <CodeBlock title="Correct Code" code={a.correctCode} badge={language?.toUpperCase()} />
            <Sec title="Correct Code Walkthrough" content={a.correctCodeWalkthrough} />

            {a.optimizedCode && (
              <div className="a-sec">
                <h3>
                  Optimized Solution
                  {a.optimizedComplexity && <span className="tag tag-c" style={{ marginLeft:8 }}>{a.optimizedComplexity}</span>}
                </h3>
                <pre>{safeStr(a.optimizedCode)}</pre>
              </div>
            )}

            <Sec title="Mental Model" content={a.mentalModel} />

            {a.multipleApproaches?.length > 0 && (
              <div className="a-sec">
                <h3>Multiple Approaches</h3>
                {a.multipleApproaches.map((ap,i) => (
                  <div key={i} className="ap">
                    <div className="ap-h">
                      <span className="ap-n">{ap.name}</span>
                      <div>
                        <span className="ap-c">{ap.complexity}</span>
                        {ap.spaceComplexity && <span className="ap-c" style={{ marginLeft:8 }}>Space: {ap.spaceComplexity}</span>}
                      </div>
                    </div>
                    <p style={{ fontSize:'.84rem', marginBottom:6 }}>{ap.description}</p>
                    {(ap.pros?.length > 0 || ap.cons?.length > 0) && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:'.77rem' }}>
                        {ap.pros?.length > 0 && (
                          <div>
                            <div style={{ fontWeight:700, color:'var(--ok)', fontSize:'.69rem', marginBottom:2 }}>PROS</div>
                            <ul style={{ paddingLeft:14 }}>{ap.pros.map((p,j) => <li key={j}>{p}</li>)}</ul>
                          </div>
                        )}
                        {ap.cons?.length > 0 && (
                          <div>
                            <div style={{ fontWeight:700, color:'var(--err)', fontSize:'.69rem', marginBottom:2 }}>CONS</div>
                            <ul style={{ paddingLeft:14 }}>{ap.cons.map((c,j) => <li key={j}>{c}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                    {ap.code && <pre style={{ marginTop:7 }}>{ap.code}</pre>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ TESTS TAB ══════ */}
        {!loading && tab === 'tests' && result && (
          <div className="fade">
            {result.testCases?.length > 0 && (
              <div style={{ marginBottom:10, fontSize:'.82rem', color:'var(--text-3)' }}>
                {result.testCases.filter(t => t.passed).length} / {result.testCases.length} passing
                <span style={{ marginLeft:8, fontSize:'.74rem' }}>
                  {result.testCases.some(t => t.expectedOutput !== null)
                    ? '— scored against correct code oracle'
                    : '— scored on execution success'}
                </span>
              </div>
            )}
            {(result.testCases || []).map((t, i) => (
              <div key={i} className={`tc ${t.passed ? 'pass' : 'fail'}`}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="tc-in">
                    <b>Input:</b> <span style={{ fontFamily:'var(--mono)' }}>{JSON.stringify(t.input || '(empty)')}</span>
                  </div>
                  <div className="tc-in" style={{ marginTop:2 }}>
                    <b>Got:</b> <span style={{ fontFamily:'var(--mono)' }}>{t.actualOutput || '(none)'}</span>
                  </div>
                  {t.expectedOutput != null && (
                    <div style={{ fontSize:'.74rem', color:'var(--text-3)', marginTop:1 }}>
                      Expected: <span style={{ fontFamily:'var(--mono)' }}>{t.expectedOutput}</span>
                    </div>
                  )}
                  <div className="tc-d">{t.description || t.category}</div>
                </div>
                <span className={`badge ${t.passed ? 'pass' : 'fail'}`}>{t.passed ? 'PASS' : 'FAIL'}</span>
              </div>
            ))}
            {!result.testCases?.length && (
              <div className="empty"><p>No test cases generated</p></div>
            )}
          </div>
        )}

        {/* ══════ DEEP ANALYSIS TAB ══════ */}
        {!loading && tab === 'deep' && (
          <div className="fade">
            {!deep && !deepLoading && (
              <div className="deep-trigger">
                <div className="deep-trigger-icon">&#128300;</div>
                <p style={{ fontWeight:700, fontSize:'.95rem', marginBottom:6 }}>
                  Ultra-Deep Code Explanation
                </p>
                <p style={{ fontSize:'.82rem', color:'var(--text-3)', marginBottom:14, lineHeight:1.6 }}>
                  Every line explained like you are 10 years old, plus a complete
                  breakdown of exactly <em>why</em> the time and space complexity
                  is what it is — with real-world numbers. Powered by Groq AI.
                </p>
                {!result
                  ? <p style={{ color:'var(--warn)', fontSize:'.8rem' }}>Run an analysis first to enable deep dive.</p>
                  : (
                    <button className="btn btn-gold" onClick={loadDeep} disabled={deepLoading}>
                      Generate Deep Analysis
                    </button>
                  )
                }
              </div>
            )}

            {deepLoading && (
              <div className="loading" style={{ flexDirection:'column', gap:14 }}>
                <div className="spinner" style={{ width:28, height:28 }} />
                <span>Generating ultra-detailed explanation...</span>
                <div style={{ fontSize:'.74rem', color:'var(--text-3)', textAlign:'center' }}>
                  Analysing every line · Building complexity breakdown · This takes ~30–60 seconds
                </div>
              </div>
            )}

            {deepError && (
              <div className="err-msg" style={{ margin:0 }}>{deepError}</div>
            )}

            {deep && !deepLoading && (
              <>
                {/* ── User code line-by-line ── */}
                {deep.userCodeLines?.length > 0 && (
                  <div className="a-sec">
                    <h3>Your Code — Line by Line</h3>
                    <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:10 }}>
                      Click any line to expand its explanation.
                    </p>
                    {deep.userCodeLines.map((ln, i) => <DeepCodeLine key={i} line={ln} index={i} />)}
                  </div>
                )}

                {/* ── Optimized code line-by-line ── */}
                {deep.optimizedCodeLines?.length > 0 && (
                  <div className="a-sec">
                    <h3>Optimized Code — Line by Line</h3>
                    <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:10 }}>
                      Compare how the best solution thinks about the same problem.
                    </p>
                    {deep.optimizedCodeLines.map((ln, i) => <DeepCodeLine key={i} line={ln} index={i} />)}
                  </div>
                )}

                {/* ── Time complexity breakdown ── */}
                {deep.timeComplexityDeepDive && (
                  <div className="a-sec">
                    <h3>Time Complexity — Full Breakdown</h3>
                    <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:8 }}>
                      <ComplexitySection
                        title="Your Code"
                        data={deep.timeComplexityDeepDive.userCode}
                        colorClass="deep-header-user"
                      />
                      <ComplexitySection
                        title="Optimized Code"
                        data={deep.timeComplexityDeepDive.optimizedCode}
                        colorClass="deep-header-opt"
                      />
                      {deep.timeComplexityDeepDive.speedupExplanation && (
                        <div className="deep-tradeoff">
                          <div style={{ fontWeight:700, fontSize:'.77rem', marginBottom:5, color:'var(--info)' }}>
                            Speed Comparison
                          </div>
                          <p style={{ fontSize:'.84rem', lineHeight:1.65 }}>
                            {deep.timeComplexityDeepDive.speedupExplanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Space complexity breakdown ── */}
                {deep.spaceComplexityDeepDive && (
                  <div className="a-sec">
                    <h3>Space Complexity — Full Breakdown</h3>
                    <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:8 }}>
                      <SpaceSection
                        title="Your Code"
                        data={deep.spaceComplexityDeepDive.userCode}
                        colorClass="deep-header-user"
                      />
                      <SpaceSection
                        title="Optimized Code"
                        data={deep.spaceComplexityDeepDive.optimizedCode}
                        colorClass="deep-header-opt"
                      />
                      {deep.spaceComplexityDeepDive.tradeoffExplanation && (
                        <div className="deep-tradeoff">
                          <div style={{ fontWeight:700, fontSize:'.77rem', marginBottom:5, color:'var(--info)' }}>
                            Time vs Space Tradeoff
                          </div>
                          <p style={{ fontSize:'.84rem', lineHeight:1.65 }}>
                            {deep.spaceComplexityDeepDive.tradeoffExplanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ marginTop:10, textAlign:'center' }}>
                  <button className="btn btn-g btn-sm" onClick={() => { setDeep(null); setDeepError(null); }}>
                    Regenerate
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════ HEATMAP TAB ══════ */}
        {!loading && tab === 'heatmap' && (
          <div className="fade">
            {!result ? (
              <div className="empty">
                <div className="empty-icon">&#127919;</div>
                <p>Run an analysis to see your skill profile</p>
              </div>
            ) : (
              <>
                {/* Title */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>
                    Skill Profile
                  </p>
                  <p style={{ fontSize: '.75rem', color: 'var(--text-3)', lineHeight: 1.55 }}>
                    <span style={{ color:'var(--ok)' }}>Green</span> = strength &nbsp;·&nbsp;
                    <span style={{ color:'var(--warn)' }}>Yellow</span> = needs work &nbsp;·&nbsp;
                    <span style={{ color:'var(--err)' }}>Red</span> = weakness
                  </p>
                </div>

                {/* Radar chart */}
                <SkillHeatmap items={hmItems} />

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--border)', margin: '18px 0 14px' }} />

                {/* Ranked bar chart */}
                <div>
                  <h4 style={{ fontSize: '.71rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                    Skills Ranked by Score
                  </h4>
                  {[...hmItems].sort((x, y) => y.score - x.score).map((item, i) => {
                    const c = item.score > 0.65 ? 'var(--ok)' : item.score > 0.38 ? 'var(--warn)' : 'var(--err)';
                    const label = item.score > 0.65 ? 'Strong' : item.score > 0.38 ? 'Developing' : 'Weak';
                    return (
                      <div key={i} className="hm-bar-row">
                        <div className="hm-bar-meta">
                          <span className="hm-bar-name">{item.name}</span>
                          <span className="hm-bar-label" style={{ color: c }}>{label}</span>
                        </div>
                        <div className="hm-bar-track">
                          <div className="hm-bar-fill" style={{ width: `${item.score * 100}%`, background: c }} />
                        </div>
                        <span className="hm-bar-pct" style={{ color: c }}>{Math.round(item.score * 100)}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Weakness tips */}
                {hmItems.some(it => it.score < 0.65) && (
                  <div style={{ marginTop: 18 }}>
                    <h4 style={{ fontSize: '.71rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                      How to Improve
                    </h4>
                    {[...hmItems]
                      .filter(it => it.score < 0.65)
                      .sort((x, y) => x.score - y.score)
                      .map((item, i) => (
                        <div key={i} className="baby-weakness">
                          <div className="baby-weakness-top">
                            <span className="baby-weakness-name">{item.name}</span>
                            <span className="baby-weakness-pct" style={{ color: item.score > 0.38 ? 'var(--warn)' : 'var(--err)' }}>
                              {Math.round(item.score * 100)}%
                            </span>
                          </div>
                          <p className="baby-weakness-tip">
                            {WEAKNESS_TIPS[item.name] || `Practice more ${item.name.toLowerCase()} problems.`}
                          </p>
                        </div>
                      ))
                    }
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════ DELTA TAB ══════ */}
        {!loading && tab === 'delta' && result && (
          <div className="fade">
            {result.deltaAnalysis && result.deltaAnalysis.overallProgress !== 'first_attempt' ? (
              <>
                <div style={{ textAlign:'center', marginBottom:14 }}>
                  <span className={`tag ${
                    result.deltaAnalysis.overallProgress === 'improved'  ? 'tag-s' :
                    result.deltaAnalysis.overallProgress === 'regressed' ? 'tag-e' : 'tag-w'
                  }`} style={{ fontSize:'.84rem', padding:'5px 14px' }}>
                    {result.deltaAnalysis.overallProgress === 'improved'  ? 'IMPROVED' :
                     result.deltaAnalysis.overallProgress === 'regressed' ? 'REGRESSED' : 'UNCHANGED'}
                  </span>
                </div>
                {result.deltaAnalysis.improvements?.length > 0 && (
                  <div className="d-sec imp">
                    <h4>Improvements</h4>
                    {result.deltaAnalysis.improvements.map((x,i) => <div key={i} className="d-item">+ {x}</div>)}
                  </div>
                )}
                {result.deltaAnalysis.regressions?.length > 0 && (
                  <div className="d-sec reg">
                    <h4>Regressions</h4>
                    {result.deltaAnalysis.regressions.map((x,i) => <div key={i} className="d-item">- {x}</div>)}
                  </div>
                )}
                {result.deltaAnalysis.unchanged?.length > 0 && (
                  <div className="d-sec unc">
                    <h4>Unchanged</h4>
                    {result.deltaAnalysis.unchanged.map((x,i) => <div key={i} className="d-item">= {x}</div>)}
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
