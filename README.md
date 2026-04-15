# WHY Engine for Programmers

> An AI-powered cognitive coding coach that analyses not just your code errors — but the **thinking mistakes** behind them.

Most debuggers tell you *what* broke. WHY Engine tells you *why you thought it was correct* — tracing errors back to the cognitive patterns shaping how you approach problems.

---

## What Is WHY Engine?

WHY Engine is a full-stack web application that combines a Monaco-powered code editor, sandboxed code execution, AST-based static analysis, AI-driven reasoning, and a personal cognitive profiling system. Every time you run and analyse code, the app builds a deeper picture of your thinking — tracking blind spots, measuring improvement over time, and giving you concrete, tailored suggestions.

**It is not a linter. It is not a code reviewer. It is a mirror for your mind.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Monaco Editor (`@monaco-editor/react`) |
| Charts | Recharts (Pie, Area, Line, Bar, Radar charts) |
| Backend | Node.js, Express 4 |
| Database | Supabase (PostgreSQL) |
| AI / LLM | Groq API — Llama 3.3-70b (primary), with 4-model fallback chain |
| Code Execution | Judge0 (sandboxed, language-agnostic) |
| AST Analysis | Acorn + acorn-walk (JavaScript), regex-based pattern analysis (Python, C++, Java) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Security | Helmet, CORS, express-rate-limit, express-validator, input sanitization |
| Fonts | Inter (UI), JetBrains Mono (editor) |

---

## Supported Languages

Python · JavaScript · TypeScript · C++ · C · Java · Go · Rust · Ruby

---

## Quick Start

### Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) project
- A free [Groq API key](https://console.groq.com/keys) (for AI analysis)
- Judge0 public endpoint (`https://ce.judge0.com`) — no key required

### 1. Clone the repository

```bash
git clone <repo-url>
cd why-engine-fixed
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
```

Fill in `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
GROQ_API_KEY=gsk_...
JUDGE0_API_URL=https://ce.judge0.com
JWT_SECRET=any-random-string-at-least-32-chars
PORT=5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

```bash
npm install
npm start          # production
# or
npm run dev        # development with nodemon auto-reload
```

Backend runs on **port 5000**. On startup it verifies Supabase connectivity and reports service status in the console.

### 3. Frontend setup

```bash
cd frontend
npm install
npm start          # runs on port 3000, proxies /api to :5000
```

Open `http://localhost:3000` in your browser.

### 4. Verify services

Navigate to **Settings** in the app. The Service Status section shows live green/red dots for:
- Groq AI
- Judge0 execution
- Supabase database
- Backend server

Or hit `http://localhost:5000/api/health` directly to see JSON status.

To diagnose Groq AI issues specifically, open `http://localhost:5000/api/groq-test` — it sends a test prompt and reports any auth or network errors with fix instructions.

---

## Environment Variables Reference

| Variable | Where to get it | Required |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role | Yes |
| `GROQ_API_KEY` | console.groq.com/keys | Yes (for AI analysis) |
| `JUDGE0_API_URL` | `https://ce.judge0.com` | Yes (for code execution) |
| `JWT_SECRET` | Any random 32+ character string | Yes |
| `PORT` | Your choice, default `5000` | No |
| `CLIENT_URL` | Frontend origin, default `http://localhost:3000` | No |
| `NODE_ENV` | `development` or `production` | No |

---

## Pages & Features

### Register / Login

Standard JWT-based authentication. On registration, WHY Engine creates a personal cognitive profile tied to your account — all analysis history, error patterns, and skill scores are stored per-user.

---

### Workspace

The core of the application. Everything happens here.

**Pre-Coding Thinking Panel**
Before writing a single line, you fill in:
- **Problem Statement** — what you are trying to solve
- **Your Approach** — how you plan to solve it
- **Edge Cases You're Aware Of** — empty input, negatives, overflow, etc.
- **Expected Complexity** — O(n), O(n log n), O(n²), etc.

This pre-coding snapshot is compared against your actual implementation during the WHY analysis to identify gaps between intention and execution.

Toggle with the **Show / Hide Thinking** button or `Ctrl+Shift+T`.

**Monaco Code Editor**
A fully-featured VS Code-style editor powered by Monaco:
- Syntax highlighting for all 9 supported languages
- Language autodetection — when you paste code, WHY Engine detects the language and prompts you to switch
- Language starter templates pre-loaded for every language
- Configurable font size, font family (JetBrains Mono / Fira Code / Cascadia Code / Consolas), line height, tab size, word wrap, bracket pair colorization, minimap, IntelliSense / autocomplete, cursor blinking style, and whitespace rendering
- All editor settings persist in localStorage and apply instantly

**Integrated Terminal**
- Appears when you hit **Run** (or `Ctrl+Enter`)
- Accepts stdin input before execution — type input and press Enter, or Shift+Enter for multi-line input
- Up/Down arrow keys navigate command history (last 50 entries)
- Shows stdout in teal, stderr in red, execution status and timing
- Clear with `Ctrl+L`

**Code Execution (Judge0)**
Code is sent to Judge0's sandboxed execution environment. Returns:
- stdout / stderr
- Execution status (Accepted, Wrong Answer, Runtime Error, TLE, etc.)
- Execution time in seconds
- Memory usage

**WHY Analysis — 15-Step Pipeline**
The full analysis triggered by the **Analyze** button or `Ctrl+Shift+A`. Runs a 15-step pipeline server-side:

| Step | What it does |
|---|---|
| 1. `pre_coding_check` | Stores your pre-coding thinking snapshot (approach, edge cases, complexity) |
| 2. `execution` | Runs your code through Judge0 |
| 3. `static_analysis` | AST analysis (JavaScript via Acorn) or regex pattern analysis (Python, C++, Java, etc.) |
| 4. `test_generation` | Generates deterministic test cases tailored to the problem |
| 5. `test_execution` | Runs each generated test case against your code and scores results |
| 6. `multi_attempt_load` | Fetches previous attempts for the same problem to enable comparison |
| 7. `ai_reasoning` | Sends everything to Groq (Llama 3.3-70b) with a structured, language-aware prompt |
| 8. `confidence_evaluation` | Stamps a confidence score + records data sources used |
| 9. `delta_analysis` | Compares this attempt against previous ones to show progress or regression |
| 10. `entry_build` | Assembles the full entry object with all analysis sections |
| 11. `save_history` | Persists the entry to Supabase under the current chat |
| 12. `update_profile` | Updates your thinking profile and cognitive timeline in Supabase |
| 13. `update_dashboard` | Tracked via profile update |
| 14. `response_format` | Serialises the structured JSON response for the frontend |
| 15. `complete` | Done |

**WHY Analysis Output — 10 Sections**

Every analysis returns all 10 sections:

1. **Mistake Summary** — a plain-English summary of what went wrong
2. **Why It's Wrong** — deep reasoning tied to language semantics and the specific mistake
3. **Thought Process** — a reconstruction of what the developer was likely thinking
4. **Root Cause** — the fundamental cognitive or conceptual error
5. **Failing Cases** — specific inputs that expose the bug
6. **Line-by-Line Walkthrough** — annotated code review at the line level
7. **Correct Logic** — step-by-step explanation of the right algorithm
8. **Correct Code** — a full working solution
9. **Optimized Code** — the best possible solution with time and space complexity
10. **Mental Model** — how to think about this class of problems in future

Plus: confidence score · cognitive taxonomy classification · 3-level progressive hints · delta comparison against previous attempts · multiple alternative approaches

**Groq AI Model Fallback Chain**
If the primary model fails, the pipeline automatically retries in order:
1. `llama-3.3-70b-versatile` (best quality)
2. `llama3-70b-8192` (reliable fallback)
3. `llama-3.1-8b-instant` (fast, good JSON compliance)
4. `llama3-8b-8192` (last resort)

**Project & Chat Management (Sidebar)**
- Create, rename, and delete projects
- Each project holds multiple analysis chats
- Create, rename, and delete individual analysis sessions
- Selecting a past chat restores the code, language, problem statement, and last analysis result

**Keyboard Shortcuts**

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Run code |
| `Ctrl+Shift+A` | Full WHY analysis |
| `Ctrl+Shift+T` | Toggle thinking panel |
| `Ctrl+Shift+N` | New analysis (within active project) |
| `Ctrl+L` | Clear terminal |
| `Ctrl+Shift+1` | Navigate to Dashboard |
| `Ctrl+Shift+2` | Navigate to Profile |
| `Ctrl+Shift+3` | Navigate to Settings |

**Auto-Analyze on Run**
An optional setting that automatically triggers the full WHY pipeline every time you run code, so no manual step is needed.

---

### Dashboard

A high-level cognitive overview rebuilt from your entire analysis history.

**Stat Cards**
- Total analyses run
- Execution success rate with contextual label (Great / Room to improve / Focus on fundamentals)
- Current daily streak and personal best streak
- Top error pattern — your single most frequent mistake type

**Error Distribution (Pie Chart)**
Donut chart showing the breakdown of mistake types across all analyses. Click any slice to highlight it. Categories: Edge Cases, Logic Errors, Syntax, Optimization, Boundaries, Off-by-One, Wrong Approach, Incomplete.

**Accuracy Over Time (Area Chart)**
Your analysis confidence score per attempt, plotted as an area chart. An upward trend indicates improving thinking quality.

**Cognitive Timeline — Weekly (Line Chart)**
Four lines showing weekly average scores for:
- Edge Case awareness (red)
- Logic (teal)
- Optimization (gold)
- Overall composite score (mint, dashed)

This is the clearest signal of long-term improvement.

**Failure Heatmap**
Bar chart showing raw error frequency per mistake type. Red = weakness, green = strength.

**Focus Areas**
Topics where WHY Engine consistently detects gaps. Dynamically generated from your error history.

**Recurring Thinking Patterns**
Habits detected across multiple analyses — not one-off mistakes, but patterns in how you approach problems, with frequency counts.

---

### Profile

A deep map of your individual thinking style, built from every analysis.

**Summary Stats Strip**
Total analyses · Successful · Success rate · Current streak · Number of projects

**Error Frequency Bar Chart**
Vertical bar chart of how many times each mistake type has appeared. Clickable bars to isolate a category.

**Skill Web (Radar Chart)**
A 6-axis radar showing your strength across: Edge Cases, Logic, Syntax, Optimization, Boundaries, Completeness. A fuller, rounder shape means you are well-rounded. Sunken areas are where you lose marks.

**Strength & Weakness Map**
Horizontal bars for 8 skill dimensions. Strength is computed as `100 - (error rate × 2)`. Green = Strong (70+), Yellow = OK (40–70), Red = Weak (<40).

**Cognitive Timeline**
Same weekly line chart as dashboard — also available on Profile for detailed review.

**Personalized Suggestions**
Concrete, actionable drills generated from your actual error distribution — not generic advice. For example:
- If you frequently miss edge cases: *"Before coding: what happens with empty input? Single element? Zero? Negative?"*
- If you have logic errors: *"Write pseudocode first, trace with small examples, then code."*
- If you have optimization misses: *"Study hash maps, two-pointer, sliding window, and binary search patterns."*

**Thinking Patterns**
Cards showing recurring patterns with occurrence counts and last-seen dates.

**Focus Areas**
Tags of weak topics pulled from your analysis history.

---

### Settings

All settings save instantly to localStorage — no save button needed. A green "Saved" badge flashes on change.

**Appearance**
- Editor font size (12–20px)
- Editor theme: Dark (VS Code), Light (VS Code), High Contrast
- Font family: JetBrains Mono, Fira Code, Cascadia Code, Consolas, Courier New, System Default
- Line height (1.4–1.8)

**Editor Behaviour**
- Tab size (2 / 4 / 8 spaces)
- Word wrap (Off / On / Bounded)
- Minimap toggle
- Bracket pair colorization toggle
- Autocomplete / IntelliSense toggle
- Render whitespace (None / Selection / Trailing / All)
- Cursor blinking style (Blink / Smooth / Phase / Expand / Solid)

**Workflow**
- Default language for new analyses
- Show/hide thinking panel by default
- Hint reveal mode (Progressive click-to-reveal / All hidden / Always visible)
- Auto-analyze on Run toggle

**Keyboard Shortcuts Reference**
Full shortcut table displayed in-page.

**Service Status**
Live health indicators for Groq AI, Judge0, Supabase, and the backend server. Reads from `/api/health`.

---

## Backend Architecture

```
backend/
├── config/index.js          — all environment config + language system
├── db/supabase.js           — Supabase client
├── middleware/
│   ├── auth.js              — JWT verification middleware
│   ├── errorHandler.js      — global 404 + error handler
│   └── sanitize.js          — input sanitisation
├── models/
│   ├── User.js              — user creation + thinking profile management
│   ├── Project.js           — project CRUD
│   └── Chat.js              — chat sessions + jsonb entries array
├── routes/
│   ├── auth.js              — POST /register, POST /login, GET /me
│   ├── code.js              — POST /run, POST /analyze (15-step pipeline)
│   ├── projects.js          — full CRUD for projects and nested chats
│   ├── analysis.js          — GET chat history
│   └── profile.js           — GET stats, GET timeline, GET/PATCH settings
└── services/
    ├── llmEngine.js         — Groq AI reasoning, 4-model fallback chain
    ├── executor.js          — Judge0 sandboxed code execution
    ├── staticAnalysis.js    — AST (Acorn) + regex pattern analysis
    ├── testCaseEngine.js    — deterministic + problem-aware test generation
    ├── deltaEngine.js       — multi-attempt comparison and regression detection
    └── profileService.js   — cognitive profile updates + timeline aggregation
```

## Frontend Architecture

```
frontend/src/
├── pages/
│   ├── WorkspacePage.js     — editor, terminal, thinking panel, analysis trigger
│   ├── DashboardPage.js     — overview charts and cognitive timeline
│   ├── ProfilePage.js       — skill web, strength map, personalized suggestions
│   ├── SettingsPage.js      — editor config, workflow, service health
│   ├── LoginPage.js         — JWT login
│   └── RegisterPage.js      — account creation
├── components/
│   ├── common/Sidebar.js    — project/chat navigation
│   └── workspace/AnalysisPanel.js — 10-section analysis results display
├── context/
│   ├── AuthContext.js       — global auth state
│   └── ThemeContext.js      — dark/light theme toggle
├── utils/api.js             — Axios instance with JWT interceptor
└── styles/index.css         — complete design system (Glacier Salt palette)
```

---

## Design System

**Palette — Glacier Salt**

| Token | Value | Usage |
|---|---|---|
| Background primary | `#0F1921` | Page background |
| Background secondary | `#162028` | Editor, cards |
| Background tertiary | `#1E2E38` | Hover, input backgrounds |
| Teal (accent) | `#56B8B0` | Primary interactive colour |
| Teal light | `#B3E8DF` | Primary text, highlights |
| Gold | `#E0C97E` | Warnings, emphasis |
| Error | `#e07878` | Errors, weak skill indicators |

**Fonts:** Inter (UI) · JetBrains Mono (editor and code)

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| PATCH | `/api/projects/:id` | Rename project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/chats` | List chats in project |
| POST | `/api/projects/:id/chats` | Create chat |
| PATCH | `/api/projects/:id/chats/:cid` | Rename chat |
| DELETE | `/api/projects/:id/chats/:cid` | Delete chat |
| POST | `/api/code/run` | Execute code (Judge0) |
| POST | `/api/code/analyze` | Full 15-step WHY analysis |
| GET | `/api/analysis/chat/:id` | Get chat history with all entries |
| GET | `/api/profile/stats` | Get cognitive stats + error distribution |
| GET | `/api/profile/timeline` | Get weekly cognitive timeline |
| GET | `/api/health` | Service health check |
| GET | `/api/groq-test` | Groq connectivity diagnostic |

---

## Security

- JWT authentication on all protected routes
- bcryptjs password hashing
- Helmet HTTP security headers
- Rate limiting on all `/api/` routes
- Input sanitisation middleware on every request
- express-validator on auth and code routes
- CORS restricted to configured client origin
- 5MB request body limit

---

## Version

**v2.1** — Current stable build with all pipeline fixes applied.

Key fixes from v1 → v2:
- Groq API: `response_format` now only sent to models that support it; JSON parse strips markdown fences; early exit on 401/403 auth failures
- Code pipeline: race condition in `resolvedChatId` assignment fixed; full step-by-step logging added
- Health check: endpoint returns plain `'configured'` / `'not_configured'` strings matching frontend comparison
- Keyboard shortcuts wired correctly in WorkspacePage
- Dashboard cognitive timeline (was blank) now renders
- All missing CSS classes added to design system