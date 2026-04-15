import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import Sidebar from '../components/common/Sidebar';
import AnalysisPanel from '../components/workspace/AnalysisPanel';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';

const LANGS = [
  { v: 'python',     l: 'Python' },
  { v: 'javascript', l: 'JavaScript' },
  { v: 'typescript', l: 'TypeScript' },
  { v: 'cpp',        l: 'C++' },
  { v: 'c',          l: 'C' },
  { v: 'java',       l: 'Java' },
  { v: 'go',         l: 'Go' },
  { v: 'rust',       l: 'Rust' },
  { v: 'ruby',       l: 'Ruby' },
];

const STARTERS = {
  python:
`# Write your solution here
def solve():
    n = int(input())
    print(n)

solve()`,
  javascript:
`// Write your solution here
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
let lines = [];
rl.on('line', line => lines.push(line.trim()));
rl.on('close', () => {
  const n = parseInt(lines[0]);
  console.log(n);
});`,
  cpp:
`#include <iostream>
using namespace std;
int main() {
    ios::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    cin >> n;
    cout << n << endl;
    return 0;
}`,
  java:
`import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(n);
    }
}`,
  c:
`#include <stdio.h>
int main() {
    int n;
    scanf("%d", &n);
    printf("%d\n", n);
    return 0;
}`,
  go:
`package main
import "fmt"
func main() {
    var n int
    fmt.Scan(&n)
    fmt.Println(n)
}`,
  rust:
`use std::io;
fn main() {
    let mut s = String::new();
    io::stdin().read_line(&mut s).unwrap();
    let n: i64 = s.trim().parse().unwrap_or(0);
    println!("{}", n);
}`,
  typescript:
`import * as readline from 'readline';
const rl = readline.createInterface({ input: process.stdin });
let lines: string[] = [];
rl.on('line', (line: string) => lines.push(line.trim()));
rl.on('close', () => {
  const n = parseInt(lines[0]);
  console.log(n);
});`,
  ruby:
`n = gets.to_i
puts n`,
};

/* ── Language autodetect ── */
function detectLanguage(code) {
  if (!code || code.trim().length < 8) return null;
  const c = code.trim();

  // Java — must be before C/C++ (public class is very specific)
  if (/public\s+class\s+\w+/.test(c) || /import\s+java\./.test(c) || /System\.out\.print/.test(c)) return 'java';

  // C++ — before C (has unique markers)
  if (/#include\s*<(iostream|vector|string|algorithm|map|set|queue|stack|bits)/.test(c) ||
      /using\s+namespace\s+std/.test(c) || /cout\s*<</.test(c) || /cin\s*>>/.test(c)) return 'cpp';

  // C — after C++ check
  if (/#include\s*<(stdio|stdlib|string|math|time)\.h>/.test(c) && !/cout/.test(c)) return 'c';

  // Python
  if (/def\s+\w+\s*\(/.test(c) || /^import\s+\w+/m.test(c) || /^from\s+\w+\s+import/m.test(c) ||
      /print\s*\(/.test(c) || /int\s*\(\s*input\s*\(\)\s*\)/.test(c) || /:\s*$/.test(c.split('\n')[0])) return 'python';

  // TypeScript — before JS (has type annotations)
  if (/:\s*(string|number|boolean|void|any)\b/.test(c) || /interface\s+\w+/.test(c) ||
      /<[A-Z][A-Za-z]+>/.test(c) || /as\s+(string|number|boolean)/.test(c)) return 'typescript';

  // JavaScript
  if (/const\s+\w+\s*=/.test(c) || /let\s+\w+\s*=/.test(c) || /require\s*\(/.test(c) ||
      /console\.log/.test(c) || /=>\s*\{/.test(c) || /function\s+\w+\s*\(/.test(c)) return 'javascript';

  // Go
  if (/^package\s+main/m.test(c) || /func\s+main\s*\(\s*\)/.test(c) || /import\s+"fmt"/.test(c) ||
      /fmt\.Print/.test(c) || /fmt\.Scan/.test(c)) return 'go';

  // Rust
  if (/fn\s+main\s*\(\s*\)/.test(c) || /let\s+mut\s+/.test(c) || /println!\s*\(/.test(c) ||
      /use\s+std::/.test(c) || /impl\s+\w+/.test(c)) return 'rust';

  // Ruby
  if (/puts\s+/.test(c) || /gets\.chomp/.test(c) || /\.each\s+do\s*\|/.test(c) ||
      /def\s+\w+\n/.test(c)) return 'ruby';

  return null;
}

export default function WorkspacePage() {
  const { theme } = useTheme();
  const nav = useNavigate();

  /* ── State ── */
  const [projects, setProjects]     = useState([]);
  const [proj, setProj]             = useState(null);
  const [chats, setChats]           = useState([]);
  const [chat, setChat]             = useState(null);
  const [lang, setLang]             = useState('python');
  const [code, setCode]             = useState(STARTERS.python);
  const [problem, setProblem]       = useState('');
  const [approach, setApproach]     = useState('');
  const [edges, setEdges]           = useState('');
  const [complexity, setComplexity] = useState('');
  const [showThink, setShowThink]   = useState(
    () => localStorage.getItem('why_showThink') !== 'false'
  );
  const [result, setResult]         = useState(null);
  const [analyzing, setAnalyzing]   = useState(false);
  const [running, setRunning]       = useState(false);
  const [termOpen, setTermOpen]     = useState(false);
  const [termLines, setTermLines]   = useState([]);
  const [stdinVal, setStdinVal]     = useState('');
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [cmdHistory, setCmdHistory]   = useState([]);
  const [historyIdx, setHistoryIdx]   = useState(-1);
  const [autoDetected, setAutoDetected] = useState(null);

  const stdinRef      = useRef(null);
  const termOutputRef = useRef(null);
  const editorRef     = useRef(null);

  /* ── Load projects on mount ── */
  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  /* ── Load chats when project changes ── */
  useEffect(() => {
    if (proj) {
      api.get(`/projects/${proj._id}/chats`).then(r => setChats(r.data)).catch(() => {});
    } else {
      setChats([]);
    }
  }, [proj]);

  /* ── Auto-scroll terminal ── */
  useEffect(() => {
    if (termOutputRef.current) {
      termOutputRef.current.scrollTop = termOutputRef.current.scrollHeight;
    }
  }, [termLines]);

  /* ── Autodetect language when code changes ── */
  useEffect(() => {
    const detected = detectLanguage(code);
    if (detected && detected !== lang) {
      // Only suggest if current code isn't the starter template
      const isStarter = Object.values(STARTERS).some(s => code.trim() === s.trim());
      if (!isStarter) {
        setAutoDetected(detected);
      }
    } else {
      setAutoDetected(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); handleRunClick(); return;
      }
      if (e.key === 'A' && e.shiftKey) {
        e.preventDefault(); analyze(); return;
      }
      if (e.key === 'T' && e.shiftKey) {
        e.preventDefault(); setShowThink(v => !v); return;
      }
      if (e.key === 'N' && e.shiftKey) {
        e.preventDefault(); if (proj) newChat(); return;
      }
      if (e.key === 'l' || e.key === 'L') {
        if (termOpen) { e.preventDefault(); setTermLines([]); } return;
      }
      if (e.key === '!' || (e.shiftKey && e.key === '1')) {
        e.preventDefault(); nav('/dashboard'); return;
      }
      if (e.key === '@' || (e.shiftKey && e.key === '2')) {
        e.preventDefault(); nav('/profile'); return;
      }
      if (e.key === '#' || (e.shiftKey && e.key === '3')) {
        e.preventDefault(); nav('/settings'); return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj, code, lang, termOpen, stdinVal, awaitingInput, running, analyzing]);

  /* ── Helpers ── */
  const addTermLine = useCallback((text, type = '') => {
    setTermLines(prev => [...prev, { text, type }]);
  }, []);

  const newProj = async name => {
    try {
      const { data } = await api.post('/projects', { name, language: lang });
      setProjects(p => [data, ...p]);
      setProj(data);
      setChat(null);
      setResult(null);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to create project');
    }
  };

  const renameProj = async (id, name) => {
    try {
      const { data } = await api.patch(`/projects/${id}`, { name });
      setProjects(p => p.map(x => x._id === id ? { ...x, name: data.name } : x));
      if (proj?._id === id) setProj(p => ({ ...p, name: data.name }));
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to rename project');
    }
  };

  const deleteProj = async id => {
    if (!window.confirm('Delete this project and all its analyses?')) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects(p => p.filter(x => x._id !== id));
      if (proj?._id === id) { setProj(null); setChat(null); setResult(null); }
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete project');
    }
  };

  const newChat = async () => {
    if (!proj) return;
    try {
      const { data } = await api.post(`/projects/${proj._id}/chats`, {
        title: problem || 'New Analysis',
      });
      setChats(p => [data, ...p]);
      setChat(data);
      setResult(null);
      setCode(STARTERS[lang] || '');
      setProblem('');
      setApproach('');
      setEdges('');
      setComplexity('');
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to create chat');
    }
  };

  const renameChat = async (projId, chatId, title) => {
    try {
      const { data } = await api.patch(`/projects/${projId}/chats/${chatId}`, { title });
      setChats(p => p.map(c => c._id === chatId ? { ...c, title: data.title } : c));
      if (chat?._id === chatId) setChat(c => ({ ...c, title: data.title }));
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to rename analysis');
    }
  };

  const deleteChat = async (projId, chatId) => {
    if (!window.confirm('Delete this analysis?')) return;
    try {
      await api.delete(`/projects/${projId}/chats/${chatId}`);
      setChats(p => p.filter(c => c._id !== chatId));
      if (chat?._id === chatId) { setChat(null); setResult(null); }
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete analysis');
    }
  };

  const selChat = async c => {
    setChat(c);
    try {
      const { data } = await api.get(`/analysis/chat/${c._id}`);
      if (data.entries?.length) {
        const last = data.entries[data.entries.length - 1];
        setCode(last.code || '');
        setLang(last.language || 'python');
        setProblem(last.problemStatement || '');
        setApproach(last.preCodingThinking?.approach || '');
        setEdges(last.preCodingThinking?.edgeCases || '');
        setComplexity(last.preCodingThinking?.expectedComplexity || '');
        setResult({
          executionResult:  last.executionResult,
          staticAnalysis:   last.staticAnalysis?.issues,
          staticSummary:    last.staticAnalysis?.summary,
          testCases:        last.testCases,
          whyAnalysis:      last.whyAnalysis,
          deltaAnalysis:    last.deltaAnalysis,
          attemptNumber:    last.attemptNumber,
          pipelineSteps:    last.pipelineSteps,
          processingTime:   last.processingTime,
        });
      }
    } catch {
      // Chat may be new with no entries — ok
    }
  };

  /* ── Run code ── */
  const run = useCallback(async (stdinOverride) => {
    if (!code.trim()) return;
    setRunning(true);
    const stdin = stdinOverride !== undefined ? stdinOverride : stdinVal;
    addTermLine(`▶  ${lang.toUpperCase()} · ${new Date().toLocaleTimeString()}`, 't-info');
    try {
      const { data } = await api.post('/code/run', { code, language: lang, stdin });
      setResult(p => ({ ...(p || {}), executionResult: data }));
      if (data.stdout) {
        data.stdout.split('\n').forEach(line => {
          if (line !== '') addTermLine(line, data.status === 'Accepted' ? 't-ok' : '');
        });
      }
      if (data.stderr) {
        data.stderr.split('\n').forEach(line => {
          if (line !== '') addTermLine(line, 't-err');
        });
      }
      const statusColor = data.status === 'Accepted' ? 't-ok' : 't-err';
      addTermLine(`─── ${data.status}  ·  ${data.time}s  ·  ${data.memory} ───`, statusColor);
      if (localStorage.getItem('why_autoAnalyze') === 'true' && proj) {
        analyze();
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      addTermLine(`✗ Error: ${msg}`, 't-err');
      setResult(p => ({ ...(p || {}), executionResult: { stderr: msg, status: 'Error' } }));
    } finally {
      setRunning(false);
      setAwaitingInput(false);
      addTermLine('', '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, lang, stdinVal, addTermLine, proj]);

  const handleRunClick = () => {
    setTermOpen(true);
    setTermLines([]);
    setStdinVal('');
    setAwaitingInput(true);
    setTimeout(() => stdinRef.current?.focus(), 80);
  };

  const handleTerminalKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !e.shiftKey && awaitingInput) {
      e.preventDefault();
      const val = stdinVal;
      if (val) {
        setCmdHistory(h => [val, ...h.slice(0, 49)]);
      }
      setHistoryIdx(-1);
      addTermLine(`$ ${val || '(no input)'}`, 't-dim');
      run(val);
      setAwaitingInput(false);
      return;
    }
    // Shift+Enter = newline in input
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      setStdinVal(v => v + '\n');
      return;
    }
    // Up arrow — history
    if (e.key === 'ArrowUp' && awaitingInput) {
      e.preventDefault();
      setHistoryIdx(i => {
        const next = Math.min(i + 1, cmdHistory.length - 1);
        if (cmdHistory[next] !== undefined) setStdinVal(cmdHistory[next]);
        return next;
      });
    }
    // Down arrow — history
    if (e.key === 'ArrowDown' && awaitingInput) {
      e.preventDefault();
      setHistoryIdx(i => {
        const next = Math.max(i - 1, -1);
        setStdinVal(next === -1 ? '' : cmdHistory[next] || '');
        return next;
      });
    }
  }, [awaitingInput, stdinVal, run, addTermLine, cmdHistory]);

  /* ── Full analysis ── */
  const analyze = useCallback(async () => {
    if (!code.trim()) return;
    if (!proj) { alert('Create or select a project first.'); return; }
    setAnalyzing(true);
    try {
      const { data } = await api.post('/code/analyze', {
        code,
        language: lang,
        problemStatement: problem,
        preCodingThinking: { approach, edgeCases: edges, expectedComplexity: complexity },
        chatId:    chat?._id   || null,
        projectId: proj?._id   || null,
      });
      setResult(data);
      if (data.chatId && !chat?._id) {
        const newC = { _id: data.chatId, id: data.chatId, title: (problem || 'Analysis').slice(0, 60) };
        setChat(newC);
        setChats(p => [newC, ...p]);
      }
    } catch (e) {
      const errMsg = e.response?.data?.error || e.message;
      setResult({
        executionResult: { stderr: errMsg, status: 'Error' },
        pipelineSteps:   e.response?.data?.pipelineSteps || [],
        failedAt:        e.response?.data?.failedAt,
      });
    } finally {
      setAnalyzing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, lang, problem, approach, edges, complexity, chat, proj]);

  const chLang = v => {
    setLang(v);
    setAutoDetected(null);
    const isDefault = Object.values(STARTERS).some(s => code.trim() === s.trim());
    if (!code || isDefault) setCode(STARTERS[v] || '');
  };

  const acceptDetected = () => {
    if (autoDetected) {
      setLang(autoDetected);
      setAutoDetected(null);
    }
  };

  /* ── Editor options from settings ── */
  const fontSize       = parseInt(localStorage.getItem('why_fontSize') || '14');
  const editorTheme    = localStorage.getItem('why_editorTheme') || (theme === 'light' ? 'vs' : 'vs-dark');
  const tabSize        = parseInt(localStorage.getItem('why_tabSize') || (lang === 'python' ? '4' : '2'));
  const wordWrap       = localStorage.getItem('why_wordWrap') || 'off';
  const fontFamily     = localStorage.getItem('why_fontFamily') || "'JetBrains Mono', 'Fira Code', monospace";
  const lineHeight     = parseFloat(localStorage.getItem('why_lineHeight') || '1.55');
  const minimapEnabled = localStorage.getItem('why_minimap') !== 'false';
  const bracketsEnabled= localStorage.getItem('why_brackets') !== 'false';
  const acEnabled      = localStorage.getItem('why_autocomplete') !== 'false';
  const renderWS       = localStorage.getItem('why_renderWS') || 'selection';
  const cursorBlink    = localStorage.getItem('why_cursorBlinking') || 'smooth';

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        chats={chats}
        activeProject={proj}
        activeChat={chat}
        onSelectProject={p => { setProj(p); setChat(null); setResult(null); }}
        onSelectChat={selChat}
        onNewProject={newProj}
        onNewChat={newChat}
        onRenameProject={renameProj}
        onDeleteProject={deleteProj}
        onRenameChat={renameChat}
        onDeleteChat={deleteChat}
      />

      <div className="main">
        {/* ── Top bar ── */}
        <div className="top">
          <div className="top-t">
            {proj
              ? <><b>{proj.name}</b>{chat ? ` / ${chat.title}` : ' — select or create an analysis'}</>
              : 'Select or create a project to begin'
            }
          </div>
          <div className="top-a">
            <button
              className="btn btn-g btn-sm"
              onClick={() => setShowThink(t => !t)}
              title="Ctrl+Shift+T"
            >
              {showThink ? 'Hide Thinking' : 'Show Thinking'}
            </button>
            <button
              className="btn btn-s btn-sm"
              onClick={handleRunClick}
              disabled={running || !code.trim()}
              title="Run code — Ctrl+Enter"
            >
              {running ? <><div className="spinner" /> Running</> : '▶ Run'}
            </button>
            <button
              className="btn btn-gold btn-sm"
              onClick={analyze}
              disabled={analyzing || !code.trim()}
              title="Full WHY analysis — Ctrl+Shift+A"
            >
              {analyzing ? <><div className="spinner" /> Analyzing...</> : 'Analyze'}
            </button>
          </div>
        </div>

        {/* ── Workspace ── */}
        <div className="ws">
          {/* Left: editor column */}
          <div className="ws-ed">

            {/* Pre-coding thinking panel */}
            {showThink && (
              <div className="think">
                <div className="think-hd">
                  <span>Pre-Coding Thinking Check</span>
                  <span style={{ fontSize: '.72rem', color: 'var(--text-3)' }}>
                    Fill before coding — compared against your implementation
                  </span>
                </div>
                <label>Problem Statement</label>
                <textarea
                  value={problem}
                  onChange={e => setProblem(e.target.value)}
                  placeholder="Describe the problem you are solving..."
                  rows={2}
                />
                <div className="think-g">
                  <div>
                    <label>Your Approach</label>
                    <input
                      value={approach}
                      onChange={e => setApproach(e.target.value)}
                      placeholder="How will you solve it?"
                    />
                  </div>
                  <div>
                    <label>Edge Cases You're Aware Of</label>
                    <input
                      value={edges}
                      onChange={e => setEdges(e.target.value)}
                      placeholder="Empty input, negatives, overflow..."
                    />
                  </div>
                  <div>
                    <label>Expected Complexity</label>
                    <input
                      value={complexity}
                      onChange={e => setComplexity(e.target.value)}
                      placeholder="O(n), O(n log n), O(n²)..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Editor toolbar */}
            <div className="ed-bar">
              <select
                className="lang-sel"
                value={lang}
                onChange={e => chLang(e.target.value)}
              >
                {LANGS.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
              </select>

              {/* Autodetect banner */}
              {autoDetected && (
                <div className="autodetect-banner">
                  <span>Detected: <b>{autoDetected.toUpperCase()}</b></span>
                  <button className="btn btn-p btn-sm" style={{ padding: '2px 8px', fontSize: '.7rem' }}
                    onClick={acceptDetected}>Switch</button>
                  <button className="btn-i" style={{ width: 18, height: 18, fontSize: '.75rem' }}
                    onClick={() => setAutoDetected(null)}>×</button>
                </div>
              )}

              <span className="att" style={{ marginLeft: 'auto' }}>
                Attempt #{result?.attemptNumber || 1}
              </span>
              {result?.pipelineSteps && (
                <span style={{ fontSize: '.68rem', color: 'var(--text-3)' }}>
                  {result.pipelineSteps.length} steps{result.processingTime ? ` · ${(result.processingTime/1000).toFixed(1)}s` : ''}
                </span>
              )}
            </div>

            {/* Monaco Editor */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
              <Editor
                height="100%"
                language={lang === 'cpp' ? 'cpp' : lang}
                value={code}
                onChange={v => setCode(v || '')}
                theme={editorTheme}
                onMount={(ed, monaco) => {
                  editorRef.current = ed;
                  ed.layout();
                  // monaco.editor.remeasureFonts() recalculates character widths
                  // after custom fonts load — without this Monaco uses fallback
                  // metrics and every click lands one character off from the cursor
                  requestAnimationFrame(() => { ed.layout(); monaco.editor.remeasureFonts(); });
                  setTimeout(() => { ed.layout(); monaco.editor.remeasureFonts(); }, 200);
                  setTimeout(() => { ed.layout(); monaco.editor.remeasureFonts(); }, 600);
                  // Also remeasure once the browser finishes loading all fonts
                  document.fonts.ready.then(() => { ed.layout(); monaco.editor.remeasureFonts(); });
                  // ResizeObserver keeps layout correct after panel resizes
                  const container = ed.getContainerDomNode();
                  if (container?.parentElement) {
                    const ro = new ResizeObserver(() => ed.layout());
                    ro.observe(container.parentElement);
                  }
                }}
                options={{
                  fontSize,
                  fontFamily,
                  minimap: { enabled: minimapEnabled },
                  padding: { top: 12, bottom: 12 },
                  scrollBeyondLastLine: false,
                  wordWrap,
                  lineHeight,
                  lineNumbers: 'on',
                  smoothScrolling: true,
                  cursorBlinking: cursorBlink,
                  cursorStyle: 'line',
                  bracketPairColorization: { enabled: bracketsEnabled },
                  renderLineHighlight: 'line',
                  suggest: { showKeywords: acEnabled },
                  quickSuggestions: acEnabled ? { other: true, comments: false, strings: false } : false,
                  tabSize,
                  automaticLayout: false,
                  fixedOverflowWidgets: true,
                  accessibilitySupport: 'off',
                  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  renderWhitespace: renderWS,
                  glyphMargin: false,
                  folding: true,
                  foldingHighlight: false,
                  lineNumbersMinChars: 3,
                }}
              />
            </div>

            {/* Terminal */}
            {termOpen && (
              <div className="terminal-wrap">
                <div className="terminal-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="terminal-dots">
                      <span className="t-dot t-dot-red" />
                      <span className="t-dot t-dot-yellow" />
                      <span className="t-dot t-dot-green" />
                    </div>
                    <span>Terminal</span>
                    {running && <span className="t-dim" style={{ fontSize: '.68rem' }}>running...</span>}
                  </div>
                  <div className="terminal-bar-actions">
                    <button
                      className="term-btn"
                      onClick={() => setTermLines([])}
                      title="Clear terminal — Ctrl+L"
                    >
                      Clear
                    </button>
                    <button
                      className="term-btn term-btn-close"
                      onClick={() => { setTermOpen(false); setAwaitingInput(false); }}
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="terminal-output" ref={termOutputRef}>
                  {termLines.map((ln, i) => (
                    <div key={i} className={`term-line ${ln.type}`}>{ln.text || '\u00A0'}</div>
                  ))}
                  {running && (
                    <div className="term-line t-dim" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div className="spinner" style={{ width: 11, height: 11, borderWidth: 1.5 }} />
                      <span>Executing...</span>
                    </div>
                  )}
                </div>

                {/* Stdin input row — VSCode style */}
                <div className="terminal-stdin-row">
                  <span className="terminal-prompt">
                    {awaitingInput && !running ? '›' : '$'}
                  </span>
                  <textarea
                    ref={stdinRef}
                    className="terminal-input terminal-textarea"
                    value={stdinVal}
                    onChange={e => setStdinVal(e.target.value)}
                    onKeyDown={handleTerminalKeyDown}
                    placeholder={
                      awaitingInput && !running
                        ? 'Type stdin · Enter to run · Shift+Enter for newline · ↑↓ history'
                        : running ? 'Running...' : 'Press Run to execute'
                    }
                    disabled={running || !awaitingInput}
                    spellCheck={false}
                    rows={stdinVal.includes('\n') ? Math.min(stdinVal.split('\n').length + 1, 5) : 1}
                  />
                  {awaitingInput && !running && (
                    <button
                      className="btn btn-p btn-sm term-run-btn"
                      onClick={() => {
                        if (stdinVal) setCmdHistory(h => [stdinVal, ...h.slice(0, 49)]);
                        addTermLine(`$ ${stdinVal || '(no input)'}`, 't-dim');
                        run(stdinVal);
                        setAwaitingInput(false);
                      }}
                      title="Execute (Enter)"
                    >
                      Run
                    </button>
                  )}
                </div>

                <div className="terminal-hint">
                  {awaitingInput && !running
                    ? 'Enter to run · Shift+Enter to add a new line (for multi-line input) · ↑↓ command history · Ctrl+L to clear'
                    : running ? 'Executing in sandbox...' : 'Press ▶ Run button to start a new execution'}
                </div>
              </div>
            )}
          </div>

          {/* Right: analysis panel */}
          <AnalysisPanel result={result} loading={analyzing} language={lang} code={code} />
        </div>
      </div>
    </div>
  );
}
