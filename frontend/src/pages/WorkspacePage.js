import { useState, useEffect, useRef, useCallback } from 'react';
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
    n = int(input("Enter a number: "))
    print(n)

solve()`,
  javascript:
`// Write your solution here
function solve() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', line => {
    console.log(line.trim());
    rl.close();
  });
}
solve();`,
  cpp:
`#include <iostream>
using namespace std;
int main() {
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
    printf("%d\\n", n);
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
    println!("{}", s.trim());
}`,
  typescript: `function solve(): void {
  // your code
}
solve();`,
  ruby: `n = gets.to_i
puts n`,
};

export default function WorkspacePage() {
  const { theme } = useTheme();

  /* ── state ── */
  const [projects, setProjects]   = useState([]);
  const [proj, setProj]           = useState(null);
  const [chats, setChats]         = useState([]);
  const [chat, setChat]           = useState(null);
  const [lang, setLang]           = useState('python');
  const [code, setCode]           = useState(STARTERS.python);
  const [problem, setProblem]     = useState('');
  const [approach, setApproach]   = useState('');
  const [edges, setEdges]         = useState('');
  const [complexity, setComplexity] = useState('');
  const [showThink, setShowThink] = useState(true);
  const [result, setResult]       = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [running, setRunning]     = useState(false);

  /* ── terminal state ── */
  const [termOpen, setTermOpen]   = useState(false);
  const [termLines, setTermLines] = useState([]);
  const [stdinVal, setStdinVal]   = useState('');
  const [awaitingInput, setAwaitingInput] = useState(false);
  const stdinRef  = useRef(null);
  const termOutputRef = useRef(null);

  /* ── load projects on mount ── */
  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  /* ── load chats when project changes ── */
  useEffect(() => {
    if (proj) {
      api.get(`/projects/${proj._id}/chats`).then(r => setChats(r.data)).catch(() => {});
    } else {
      setChats([]);
    }
  }, [proj]);

  /* ── scroll terminal to bottom ── */
  useEffect(() => {
    if (termOutputRef.current) {
      termOutputRef.current.scrollTop = termOutputRef.current.scrollHeight;
    }
  }, [termLines]);

  /* ── helpers ── */
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
    } catch {}
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
    } catch {}
  };

  const selChat = async c => {
    setChat(c);
    try {
      const { data } = await api.get(`/analysis/chat/${c._id}`);
      if (data.entries?.length) {
        const l = data.entries[data.entries.length - 1];
        setCode(l.code || '');
        setLang(l.language || 'python');
        setProblem(l.problemStatement || '');
        setApproach(l.preCodingThinking?.approach || '');
        setEdges(l.preCodingThinking?.edgeCases || '');
        setComplexity(l.preCodingThinking?.expectedComplexity || '');
        setResult({
          executionResult: l.executionResult,
          staticAnalysis: l.staticAnalysis?.issues,
          testCases: l.testCases,
          whyAnalysis: l.whyAnalysis,
          deltaAnalysis: l.deltaAnalysis,
          attemptNumber: l.attemptNumber,
          pipelineSteps: l.pipelineSteps,
          processingTime: l.processingTime,
        });
      }
    } catch {}
  };

  /* ── Run: open terminal, execute ── */
  const run = useCallback(async (stdinOverride) => {
    if (!code.trim()) return;

    // Open terminal if not open
    setTermOpen(true);
    setRunning(true);

    const stdin = stdinOverride !== undefined ? stdinOverride : stdinVal;

    addTermLine(`> Running ${lang}...`, 't-dim');

    try {
      const { data } = await api.post('/code/run', { code, language: lang, stdin });
      setResult(p => ({ ...p, executionResult: data }));

      if (data.stdout) {
        addTermLine(data.stdout, data.status === 'Accepted' ? 't-ok' : '');
      }
      if (data.stderr) {
        addTermLine(data.stderr, 't-err');
      }
      addTermLine(
        `[${data.status}]  time: ${data.time}s  memory: ${data.memory}`,
        data.status === 'Accepted' ? 't-info' : 't-err'
      );
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      addTermLine(`Error: ${msg}`, 't-err');
      setResult(p => ({ ...p, executionResult: { stderr: msg, status: 'Error' } }));
    } finally {
      setRunning(false);
      setAwaitingInput(false);
    }
  }, [code, lang, stdinVal, addTermLine]);

  /* ── Run button clicked: show terminal, focus stdin ── */
  const handleRunClick = () => {
    setTermOpen(true);
    setTermLines([]);
    setStdinVal('');
    setAwaitingInput(true);
    setTimeout(() => stdinRef.current?.focus(), 80);
  };

  /* ── Terminal stdin submit ── */
  const handleTerminalSubmit = useCallback(e => {
    if (e.key === 'Enter' && awaitingInput) {
      addTermLine(`$ ${stdinVal}`, 't-dim');
      run(stdinVal);
      setAwaitingInput(false);
    }
  }, [awaitingInput, stdinVal, run, addTermLine]);

  /* ── Analyze ── */
  const analyze = async () => {
    if (!code.trim()) return;
    if (!proj) { alert('Create or select a project first.'); return; }
    setAnalyzing(true);
    try {
      const { data } = await api.post('/code/analyze', {
        code,
        language: lang,
        problemStatement: problem,
        preCodingThinking: { approach, edgeCases: edges, expectedComplexity: complexity },
        chatId: chat?._id,
        projectId: proj._id,
      });
      setResult(data);
      if (data.chatId && !chat) {
        const nc = { _id: data.chatId, title: (problem || 'Analysis').slice(0, 60) };
        setChat(nc);
        setChats(p => [nc, ...p]);
      }
    } catch (e) {
      setResult({
        executionResult: { stderr: e.response?.data?.error || e.message, status: 'Error' },
        pipelineSteps: e.response?.data?.pipelineSteps,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  /* ── Language change ── */
  const chLang = v => {
    setLang(v);
    const isDefault = Object.values(STARTERS).some(s => code.trim() === s.trim());
    if (!code || isDefault) setCode(STARTERS[v] || '');
  };

  /* ── Terminal clear ── */
  const clearTerminal = () => setTermLines([]);

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
      />

      <div className="main">
        {/* Top bar */}
        <div className="top">
          <div className="top-t">
            {proj
              ? <><b>{proj.name}</b>{chat ? ` / ${chat.title}` : ''}</>
              : 'Select or create a project to begin'
            }
          </div>
          <div className="top-a">
            <button
              className="btn btn-g btn-sm"
              onClick={() => setShowThink(t => !t)}
            >
              {showThink ? 'Hide' : 'Show'} Thinking
            </button>
            <button
              className="btn btn-s btn-sm"
              onClick={handleRunClick}
              disabled={running || !code.trim()}
              title="Run code (Ctrl+Enter)"
            >
              {running ? <><div className="spinner" /> Running</> : 'Run'}
            </button>
            <button
              className="btn btn-p btn-sm"
              onClick={analyze}
              disabled={analyzing || !code.trim()}
              title="Full WHY analysis"
            >
              {analyzing ? <><div className="spinner" /> Analyzing</> : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Workspace */}
        <div className="ws">
          {/* Left: editor column */}
          <div className="ws-ed">
            {/* Pre-coding thinking panel */}
            {showThink && (
              <div className="think">
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
                    <label>Edge Cases</label>
                    <input
                      value={edges}
                      onChange={e => setEdges(e.target.value)}
                      placeholder="What could go wrong?"
                    />
                  </div>
                  <div>
                    <label>Expected Complexity</label>
                    <input
                      value={complexity}
                      onChange={e => setComplexity(e.target.value)}
                      placeholder="O(n), O(n log n)..."
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
              <span className="att">Attempt #{result?.attemptNumber || 1}</span>
            </div>

            {/* Monaco editor */}
            <div style={{ flex: 1 }}>
              <Editor
                height="100%"
                language={lang === 'cpp' ? 'cpp' : lang}
                value={code}
                onChange={v => setCode(v || '')}
                theme={theme === 'light' ? 'vs' : 'vs-dark'}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                  minimap: { enabled: false },
                  padding: { top: 12, bottom: 12 },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  bracketPairColorization: { enabled: true },
                  renderLineHighlight: 'line',
                  suggest: { showKeywords: true },
                }}
              />
            </div>

            {/* Terminal panel — appears when Run is clicked */}
            {termOpen && (
              <div className="terminal-wrap">
                <div className="terminal-bar">
                  <span>Terminal</span>
                  <div className="terminal-bar-actions">
                    <button
                      className="btn btn-g btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                      onClick={clearTerminal}
                    >
                      Clear
                    </button>
                    <button
                      className="btn-i"
                      style={{ width: 22, height: 22, fontSize: '0.85rem' }}
                      onClick={() => { setTermOpen(false); setAwaitingInput(false); }}
                      title="Close terminal"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                <div className="terminal-output" ref={termOutputRef}>
                  {termLines.map((ln, i) => (
                    <div key={i} className={ln.type}>{ln.text}</div>
                  ))}
                  {awaitingInput && !running && (
                    <div className="t-dim" style={{ fontStyle: 'italic', marginTop: 2 }}>
                      [Provide stdin below and press Enter to execute — leave empty if no input needed]
                    </div>
                  )}
                  {running && (
                    <div className="t-dim" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                      Executing...
                    </div>
                  )}
                </div>

                {/* stdin input row */}
                <div className="terminal-stdin-row">
                  <span className="terminal-prompt">&gt;</span>
                  <input
                    ref={stdinRef}
                    className="terminal-input"
                    value={stdinVal}
                    onChange={e => setStdinVal(e.target.value)}
                    onKeyDown={handleTerminalSubmit}
                    placeholder={awaitingInput ? 'Type stdin and press Enter...' : ''}
                    disabled={running || !awaitingInput}
                    spellCheck={false}
                  />
                  {awaitingInput && !running && (
                    <button
                      className="btn btn-p btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => {
                        addTermLine(`$ ${stdinVal}`, 't-dim');
                        run(stdinVal);
                        setAwaitingInput(false);
                      }}
                    >
                      Execute
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: analysis panel */}
          <AnalysisPanel result={result} loading={analyzing} language={lang} />
        </div>
      </div>
    </div>
  );
}
