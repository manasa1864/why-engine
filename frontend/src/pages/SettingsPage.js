import { useState, useEffect } from 'react';
import Sidebar from '../components/common/Sidebar';
import api from '../utils/api';

function Toggle({ checked, onChange }) {
  return (
    <label className="theme-switch" style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="theme-track" />
      <span className="theme-thumb" />
    </label>
  );
}

function ChipRow({ options, value, onChange }) {
  return (
    <div className="chip-row">
      {options.map(o => (
        <button
          key={o.value ?? o}
          className={`chip-btn ${value === (o.value ?? o) ? 'on' : ''}`}
          onClick={() => onChange(o.value ?? o)}
        >
          {o.label ?? o}
        </button>
      ))}
    </div>
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select className="st-select" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SettingsRow({ label, description, children }) {
  return (
    <div className="st-row">
      <div className="st-row-left">
        <div className="st-label">{label}</div>
        {description && <div className="st-desc">{description}</div>}
      </div>
      <div className="st-row-right">{children}</div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="st-section">
      <div className="st-section-hd">
        {icon && <span className="st-section-icon">{icon}</span>}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [projects, setProjects] = useState([]);
  const [health,   setHealth]   = useState(null);
  const [saved,    setSaved]    = useState(false);

  /* Appearance */
  const [fontSize,    setFontSizeS]    = useState(() => parseInt(localStorage.getItem('why_fontSize') || '14'));
  const [editorTheme, setEditorThemeS] = useState(() => localStorage.getItem('why_editorTheme') || 'vs-dark');
  const [fontFamily,  setFontFamilyS]  = useState(() => localStorage.getItem('why_fontFamily') || "'JetBrains Mono', monospace");
  const [lineHeight,  setLineHeightS]  = useState(() => parseFloat(localStorage.getItem('why_lineHeight') || '1.55'));

  /* Editor behaviour */
  const [tabSize,           setTabSizeS]     = useState(() => parseInt(localStorage.getItem('why_tabSize') || '4'));
  const [wordWrap,          setWordWrapS]    = useState(() => localStorage.getItem('why_wordWrap') || 'off');
  const [minimap,           setMinimapS]     = useState(() => localStorage.getItem('why_minimap') !== 'false');
  const [brackets,          setBracketsS]    = useState(() => localStorage.getItem('why_brackets') !== 'false');
  const [autocomplete,      setAutocompleteS]= useState(() => localStorage.getItem('why_autocomplete') !== 'false');
  const [renderWhitespace,  setRenderWSS]    = useState(() => localStorage.getItem('why_renderWS') || 'selection');
  const [cursorBlinking,    setCursorBlinkS] = useState(() => localStorage.getItem('why_cursorBlinking') || 'smooth');

  /* Workflow */
  const [showThink,   setShowThinkS]   = useState(() => localStorage.getItem('why_showThink') !== 'false');
  const [hintMode,    setHintModeS]    = useState(() => localStorage.getItem('why_hintMode') || 'progressive');
  const [autoAnalyze, setAutoAnalyzeS] = useState(() => localStorage.getItem('why_autoAnalyze') === 'true');
  const [defaultLang, setDefaultLangS] = useState(() => localStorage.getItem('why_defaultLang') || 'python');

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    api.get('/health').then(r => setHealth(r.data)).catch(() => setHealth({ status: 'unreachable' }));
  }, []);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1400); };

  const save = (key, val) => { localStorage.setItem(key, val); flash(); };

  const setFontSize    = v => { setFontSizeS(v);    save('why_fontSize', v); };
  const setEditorTheme = v => { setEditorThemeS(v); save('why_editorTheme', v); };
  const setFontFamily  = v => { setFontFamilyS(v);  save('why_fontFamily', v); };
  const setLineHeight  = v => { setLineHeightS(v);  save('why_lineHeight', v); };
  const setTabSize     = v => { setTabSizeS(v);     save('why_tabSize', v); };
  const setWordWrap    = v => { setWordWrapS(v);     save('why_wordWrap', v); };
  const setMinimap     = v => { setMinimapS(v);      save('why_minimap', v); };
  const setBrackets    = v => { setBracketsS(v);     save('why_brackets', v); };
  const setAC          = v => { setAutocompleteS(v); save('why_autocomplete', v); };
  const setRenderWS    = v => { setRenderWSS(v);     save('why_renderWS', v); };
  const setCursorBlink = v => { setCursorBlinkS(v);  save('why_cursorBlinking', v); };
  const setShowThink   = v => { setShowThinkS(v);    save('why_showThink', v); };
  const setHintMode    = v => { setHintModeS(v);     save('why_hintMode', v); };
  const setAutoAnalyze = v => { setAutoAnalyzeS(v);  save('why_autoAnalyze', v); };
  const setDefaultLang = v => { setDefaultLangS(v);  save('why_defaultLang', v); };

  const serviceStatus = (key) => {
    if (health === null) return 'unk';
    return health?.[key] === 'configured' ? 'ok' : 'err';
  };
  const serviceText = (key) => {
    if (health === null) return 'Checking…';
    return health?.[key] === 'configured' ? 'Connected' : 'Not configured';
  };

  const SHORTCUTS = [
    { action: 'Run code',          keys: ['Ctrl', 'Enter'] },
    { action: 'Full WHY analysis', keys: ['Ctrl', 'Shift', 'A'] },
    { action: 'Toggle thinking',   keys: ['Ctrl', 'Shift', 'T'] },
    { action: 'New analysis',      keys: ['Ctrl', 'Shift', 'N'] },
    { action: 'Clear terminal',    keys: ['Ctrl', 'L'] },
    { action: 'Go to Dashboard',   keys: ['Ctrl', 'Shift', '1'] },
    { action: 'Go to Profile',     keys: ['Ctrl', 'Shift', '2'] },
    { action: 'Go to Settings',    keys: ['Ctrl', 'Shift', '3'] },
  ];

  return (
    <div className="app">
      <Sidebar
        projects={projects} chats={[]}
        onSelectProject={() => {}} onSelectChat={() => {}}
        onNewProject={() => {}} onNewChat={() => {}}
      />
      <div className="main">
        <div className="st-page">

          {/* Header */}
          <div className="st-hd">
            <div className="st-hd-icon">⚙</div>
            <div>
              <h2 className="st-hd-title">Settings</h2>
              <p className="st-hd-sub">All changes save instantly to your browser.</p>
            </div>
            {saved && (
              <div className="st-saved-badge">&#10003; Saved</div>
            )}
          </div>

          {/* ── Appearance ── */}
          <Section icon="" title="Appearance">
            <SettingsRow label="Editor Font Size" description="Size of code text inside Monaco">
              <ChipRow
                options={[12,13,14,15,16,18,20].map(s => ({ value: s, label: String(s) }))}
                value={fontSize}
                onChange={setFontSize}
              />
            </SettingsRow>
            <SettingsRow label="Editor Theme" description="Colour theme inside the code editor">
              <SelectInput value={editorTheme} onChange={setEditorTheme} options={[
                { value: 'vs-dark',  label: 'Dark (VS Code)' },
                { value: 'vs',       label: 'Light (VS Code)' },
                { value: 'hc-black', label: 'High Contrast' },
              ]} />
            </SettingsRow>
            <SettingsRow label="Font Family" description="Monospace font used in the editor">
              <SelectInput value={fontFamily} onChange={setFontFamily} options={[
                { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
                { value: "'Fira Code', monospace",       label: 'Fira Code' },
                { value: "'Cascadia Code', monospace",   label: 'Cascadia Code' },
                { value: "'Consolas', monospace",        label: 'Consolas' },
                { value: "'Courier New', monospace",     label: 'Courier New' },
                { value: 'monospace',                    label: 'System Default' },
              ]} />
            </SettingsRow>
            <SettingsRow label="Line Height" description="Vertical spacing between code lines">
              <ChipRow
                options={[1.4, 1.5, 1.55, 1.6, 1.7, 1.8].map(v => ({ value: v, label: String(v) }))}
                value={lineHeight}
                onChange={setLineHeight}
              />
            </SettingsRow>
          </Section>

          {/* ── Editor Behaviour ── */}
          <Section icon="" title="Editor Behaviour">
            <SettingsRow label="Tab Size" description="Spaces per indent level">
              <ChipRow
                options={[2, 4, 8].map(s => ({ value: s, label: String(s) }))}
                value={tabSize}
                onChange={setTabSize}
              />
            </SettingsRow>
            <SettingsRow label="Word Wrap" description="Wrap long lines">
              <ChipRow
                options={[
                  { value: 'off',     label: 'Off' },
                  { value: 'on',      label: 'On' },
                  { value: 'bounded', label: 'Bounded' },
                ]}
                value={wordWrap}
                onChange={setWordWrap}
              />
            </SettingsRow>
            <SettingsRow label="Minimap" description="Code overview on the right side">
              <Toggle checked={minimap} onChange={setMinimap} />
            </SettingsRow>
            <SettingsRow label="Bracket Pair Colorization" description="Colour matching brackets differently">
              <Toggle checked={brackets} onChange={setBrackets} />
            </SettingsRow>
            <SettingsRow label="Autocomplete / IntelliSense" description="Keyword and snippet suggestions">
              <Toggle checked={autocomplete} onChange={setAC} />
            </SettingsRow>
            <SettingsRow label="Render Whitespace" description="Show invisible characters">
              <SelectInput value={renderWhitespace} onChange={setRenderWS} options={[
                { value: 'none',      label: 'None' },
                { value: 'selection', label: 'Selection only' },
                { value: 'trailing',  label: 'Trailing only' },
                { value: 'all',       label: 'All' },
              ]} />
            </SettingsRow>
            <SettingsRow label="Cursor Blinking" description="Animation style for the cursor">
              <SelectInput value={cursorBlinking} onChange={setCursorBlink} options={[
                { value: 'blink',  label: 'Blink' },
                { value: 'smooth', label: 'Smooth' },
                { value: 'phase',  label: 'Phase' },
                { value: 'expand', label: 'Expand' },
                { value: 'solid',  label: 'Solid (no blink)' },
              ]} />
            </SettingsRow>
          </Section>

          {/* ── Workflow ── */}
          <Section icon="" title="Workflow">
            <SettingsRow label="Default Language" description="Pre-selected language for new analyses">
              <SelectInput value={defaultLang} onChange={setDefaultLang} options={[
                { value: 'python',     label: 'Python' },
                { value: 'javascript', label: 'JavaScript' },
                { value: 'typescript', label: 'TypeScript' },
                { value: 'cpp',        label: 'C++' },
                { value: 'c',          label: 'C' },
                { value: 'java',       label: 'Java' },
                { value: 'go',         label: 'Go' },
                { value: 'rust',       label: 'Rust' },
                { value: 'ruby',       label: 'Ruby' },
              ]} />
            </SettingsRow>
            <SettingsRow label="Show Thinking Panel by Default" description="Pre-coding thinking section above the editor">
              <Toggle checked={showThink} onChange={setShowThink} />
            </SettingsRow>
            <SettingsRow label="Hint Reveal Mode" description="How hints are revealed in WHY Analysis">
              <SelectInput value={hintMode} onChange={setHintMode} options={[
                { value: 'progressive', label: 'Progressive (click to reveal)' },
                { value: 'all-hidden',  label: 'All hidden — manual reveal' },
                { value: 'all-visible', label: 'Always visible' },
              ]} />
            </SettingsRow>
            <SettingsRow label="Auto-Analyze on Run" description="Trigger full WHY pipeline after every Run">
              <Toggle checked={autoAnalyze} onChange={setAutoAnalyze} />
            </SettingsRow>
          </Section>

          {/* ── Keyboard Shortcuts ── */}
          <Section icon="" title="Keyboard Shortcuts">
            <div className="st-shortcuts">
              {SHORTCUTS.map(s => (
                <div key={s.action} className="st-shortcut">
                  <span className="st-shortcut-action">{s.action}</span>
                  <span className="st-shortcut-keys">
                    {s.keys.map((k, i) => (
                      <span key={i}>
                        <kbd>{k}</kbd>
                        {i < s.keys.length - 1 && <span className="st-plus">+</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Service Status ── */}
          <Section icon="" title="Service Status">
            <div className="st-services">
              {[
                { key: 'groq',     label: 'Groq AI',  icon: '' },
                { key: 'judge0',   label: 'Judge0',   icon: '' },
                { key: 'supabase', label: 'Supabase', icon: '' },
              ].map(svc => (
                <div key={svc.key} className={`st-svc st-svc-${serviceStatus(svc.key)}`}>
                  <span className="st-svc-dot" />
                  <span className="st-svc-icon">{svc.icon}</span>
                  <div>
                    <div className="st-svc-name">{svc.label}</div>
                    <div className="st-svc-text">{serviceText(svc.key)}</div>
                  </div>
                </div>
              ))}
              <div className={`st-svc st-svc-${health?.status === 'ok' ? 'ok' : health === null ? 'unk' : 'err'}`}>
                <span className="st-svc-dot" />
                <span className="st-svc-icon"></span>
                <div>
                  <div className="st-svc-name">Backend</div>
                  <div className="st-svc-text">
                    {health === null ? 'Checking…' : health?.status === 'ok' ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            </div>
            <div className="st-env-hint">
              Set API keys in{' '}
              <code>backend/.env</code>
              {' '}to enable AI analysis, deep explanations, and test-case scoring.
            </div>
          </Section>

          {/* ── About ── */}
          <Section icon="" title="About WHY Engine">
            <div className="st-about">
              <div className="st-about-title">WHY Engine for Programmers v2.1</div>
              <p className="st-about-desc">
                An AI-powered cognitive coding coach that analyses not just code errors — but the
                developer's <em>thinking mistakes</em>. Features a 15-step reasoning pipeline,
                Groq AI deep explanations, Judge0 sandboxed execution, AST static analysis,
                smart test-case oracle scoring, and per-session skill profiling.
              </p>
              <div className="st-tags">
                <span className="tag tag-c">Groq · Llama 3.3</span>
                <span className="tag tag-i">Judge0 Execution</span>
                <span className="tag tag-s">AST Static Analysis</span>
                <span className="tag tag-w">Cognitive Taxonomy</span>
                <span className="tag tag-e">15-Step Pipeline</span>
                <span className="tag tag-c">Oracle Test Scoring</span>
              </div>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
