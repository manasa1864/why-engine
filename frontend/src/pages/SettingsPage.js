import { useState, useEffect } from 'react';
import Sidebar from '../components/common/Sidebar';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';

/* ── Reusable row ── */
function SettingsRow({ label, description, children }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{label}</div>
        {description && <div className="settings-desc">{description}</div>}
      </div>
      <div className="settings-right">{children}</div>
    </div>
  );
}

/* ── Section header ── */
function Section({ title, children }) {
  return (
    <div className="settings-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* ── Keyboard shortcut display ── */
function Shortcut({ keys }) {
  return (
    <span className="kbd">
      {keys.map((k, i) => (
        <span key={i}>
          <kbd>{k}</kbd>
          {i < keys.length - 1 && <span style={{ color: 'var(--text-3)', margin: '0 2px' }}>+</span>}
        </span>
      ))}
    </span>
  );
}

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [projects, setProjects] = useState([]);
  const [health, setHealth]     = useState(null);
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('why_fontSize') || '14'));
  const [editorTheme, setEditorTheme] = useState(() => localStorage.getItem('why_editorTheme') || 'vs-dark');
  const [showThinkByDefault, setShowThinkByDefault] = useState(
    () => localStorage.getItem('why_showThink') !== 'false'
  );
  const [hintMode, setHintMode] = useState(
    () => localStorage.getItem('why_hintMode') || 'progressive'
  );
  const [autoAnalyze, setAutoAnalyze] = useState(
    () => localStorage.getItem('why_autoAnalyze') === 'true'
  );

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    api.get('/health').then(r => setHealth(r.data)).catch(() => setHealth({ status: 'unreachable' }));
  }, []);

  /* ── Persist preferences ── */
  const setFs = v => { setFontSize(v); localStorage.setItem('why_fontSize', v); };
  const setEt = v => { setEditorTheme(v); localStorage.setItem('why_editorTheme', v); };
  const setStd = v => { setShowThinkByDefault(v); localStorage.setItem('why_showThink', v); };
  const setHm  = v => { setHintMode(v); localStorage.setItem('why_hintMode', v); };
  const setAa  = v => { setAutoAnalyze(v); localStorage.setItem('why_autoAnalyze', v); };

  /* ── API status helpers ── */
  function StatusBadge({ configured, label }) {
    const cls = health === null ? 'unk' : configured ? 'ok' : 'err';
    const text = health === null ? 'Checking...' : configured ? 'Configured' : 'Not configured';
    return (
      <div className={`api-status ${cls}`}>
        <div className="api-status-dot" />
        {label}: {text}
      </div>
    );
  }

  /* ── Toggle switch ── */
  function Toggle({ checked, onChange, label }) {
    return (
      <label className="theme-switch" title={label} style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="theme-track" />
        <span className="theme-thumb" />
      </label>
    );
  }

  return (
    <div className="app">
      <Sidebar
        projects={projects} chats={[]}
        onSelectProject={() => {}} onSelectChat={() => {}}
        onNewProject={() => {}} onNewChat={() => {}}
      />

      <div className="main">
        <div className="settings">
          <h2>Settings</h2>
          <p>Customize your WHY Engine experience. Preferences are saved to your browser.</p>

          {/* ── Appearance ── */}
          <Section title="Appearance">
            <SettingsRow
              label="Theme"
              description="Switch between dark and light mode"
            >
              <span style={{ fontSize: '.8rem', color: 'var(--text-3)' }}>
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
              <Toggle checked={theme === 'light'} onChange={toggle} label="Toggle theme" />
            </SettingsRow>

            <SettingsRow label="Editor Font Size" description="Applies to the code editor">
              <div className="font-size-sel">
                {[12, 13, 14, 15, 16, 18].map(s => (
                  <button
                    key={s}
                    className={`font-size-btn ${fontSize === s ? 'on' : ''}`}
                    onClick={() => setFs(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow label="Editor Theme" description="Visual theme inside the Monaco editor">
              <select
                value={editorTheme}
                onChange={e => setEt(e.target.value)}
                style={{ fontSize: '.81rem', padding: '4px 10px' }}
              >
                <option value="vs-dark">Dark (VS Code)</option>
                <option value="vs">Light (VS Code)</option>
                <option value="hc-black">High Contrast Dark</option>
              </select>
            </SettingsRow>
          </Section>

          {/* ── Workspace ── */}
          <Section title="Workspace">
            <SettingsRow
              label="Show Thinking Panel by Default"
              description="The pre-coding thinking section above the editor"
            >
              <Toggle
                checked={showThinkByDefault}
                onChange={setStd}
                label="Toggle thinking panel default"
              />
            </SettingsRow>

            <SettingsRow
              label="Hint Mode"
              description="How hints are revealed in the WHY Analysis panel"
            >
              <select
                value={hintMode}
                onChange={e => setHm(e.target.value)}
                style={{ fontSize: '.81rem', padding: '4px 10px' }}
              >
                <option value="progressive">Progressive (click to reveal)</option>
                <option value="all-hidden">All hidden — manual reveal</option>
                <option value="all-visible">Always visible</option>
              </select>
            </SettingsRow>

            <SettingsRow
              label="Auto-Analyze on Run"
              description="Automatically trigger full analysis after each Run (costs more time)"
            >
              <Toggle checked={autoAnalyze} onChange={setAa} label="Auto analyze toggle" />
            </SettingsRow>
          </Section>

          {/* ── Keyboard shortcuts ── */}
          <Section title="Keyboard Shortcuts">
            {[
              { action: 'Run code',          keys: ['Ctrl', 'Enter'] },
              { action: 'Full analysis',      keys: ['Ctrl', 'Shift', 'A'] },
              { action: 'Toggle thinking',    keys: ['Ctrl', 'Shift', 'T'] },
              { action: 'New analysis (chat)', keys: ['Ctrl', 'Shift', 'N'] },
              { action: 'Clear terminal',     keys: ['Ctrl', 'L'] },
              { action: 'Toggle theme',       keys: ['Ctrl', 'Shift', 'D'] },
              { action: 'Go to Dashboard',    keys: ['Ctrl', 'Shift', '1'] },
              { action: 'Go to Profile',      keys: ['Ctrl', 'Shift', '2'] },
              { action: 'Go to Settings',     keys: ['Ctrl', 'Shift', '3'] },
            ].map(s => (
              <SettingsRow key={s.action} label={s.action}>
                <Shortcut keys={s.keys} />
              </SettingsRow>
            ))}
          </Section>

          {/* ── API Status ── */}
          <Section title="Service Status">
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ fontSize: '.84rem', color: 'var(--text-2)', fontWeight: 500 }}>
                Backend services used by WHY Engine
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <StatusBadge label="Groq AI"   configured={health?.groq   === 'configured'} />
                <StatusBadge label="Judge0"    configured={health?.judge0 === 'configured'} />
                <StatusBadge label="Database"  configured={health?.supabase === 'configured'} />
                <div className={`api-status ${health?.status === 'ok' ? 'ok' : 'err'}`}>
                  <div className="api-status-dot" />
                  Backend: {health?.status === 'ok' ? 'Online' : health === null ? 'Checking...' : 'Offline'}
                </div>
              </div>
              <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginTop: 2 }}>
                Configure API keys in <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 3 }}>backend/.env</code> to unlock full analysis.
              </div>
            </div>
          </Section>

          {/* ── About ── */}
          <Section title="About">
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ fontSize: '.9rem', fontWeight: 700 }}>WHY Engine for Programmers</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-3)', lineHeight: 1.65 }}>
                An AI-powered cognitive coding coach that analyzes not just code errors — but the
                developer's thinking mistakes. Powered by Groq (Llama 3.3), Judge0 execution, AST
                static analysis, and a multi-engine cognitive pipeline.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                <span className="tag tag-c">Groq · Llama 3.3</span>
                <span className="tag tag-i">Judge0 Execution</span>
                <span className="tag tag-s">AST Static Analysis</span>
                <span className="tag tag-w">Cognitive Taxonomy</span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
