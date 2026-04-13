# WHY Engine for Programmers

> ChatGPT + LeetCode + a Cognitive Coach

AI-powered coding analysis that diagnoses not just errors, but your **thinking mistakes**.

## 5 Core Engines

| # | Engine | File | What It Does |
|---|--------|------|-------------|
| 1 | Code Execution | `services/executor.js` | Judge0 sandbox, 10s timeout, 128MB memory, retry logic |
| 2 | Static Analysis | `services/staticAnalysis.js` | AST parsing (JS), patterns (Python/C++/Java), O(n²) detection, recursion, dead code |
| 3 | Test Case | `services/testCaseEngine.js` | Edge/boundary/stress/problem-aware test generation |
| 4 | Multi-Attempt | `services/deltaEngine.js` | Compares attempts, tracks improvements vs regressions |
| 5 | LLM Reasoning | `services/llmEngine.js` | Groq AI, all 10 WHY sections, confidence, taxonomy, hints |
| + | Profile Tracker | `services/profileService.js` | Error distribution, cognitive timeline, patterns, streaks |

## 15-Step System Flow

1. User logs in → 2. Selects project → 3. Enters problem → 4. Pre-coding thinking stored →
5. Writes code → 6. Clicks Analyze → 7. Code Execution (Judge0) → 8. Static Analysis (AST) →
9. Test Case Generation → 10. Multi-attempt comparison → 11. AI Reasoning (Groq) →
12. Confidence evaluation → 13. Response formatting → 14. Save to chat history →
15. Update dashboard + cognitive timeline

## WHY Analysis Output (10 Sections)

1. Mistake Summary → 2. Why It's Wrong → 3. Thought Process → 4. Root Cause →
5. Failing Cases → 6. Line-by-Line → 7. Correct Logic → 8. Correct Code →
9. Optimized Code → 10. Mental Model

**Plus:** Confidence Engine, Cognitive Taxonomy, Multiple Approaches, WHY-Before-WHAT Hints, Thinking Comparison

---

## HOW TO EXECUTE

### Prerequisites
- **Node.js 18+** — download from https://nodejs.org
- **MongoDB** — free cluster at https://mongodb.com/atlas
- **Judge0 API key** — from https://rapidapi.com (search "Judge0 CE")
- **Groq API key** — free at https://console.groq.com

### Step 1: Setup Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in your values:
```
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/why-engine?retryWrites=true&w=majority
JUDGE0_API_KEY=your-rapidapi-key
GROQ_API_KEY=gsk_your-groq-key
JWT_SECRET=any-random-string-here
```

Then:
```bash
npm install
npm run dev
```

You should see:
```
✅ MongoDB connected
✅ Server on port 5000
   Judge0: ✓
   Groq:   ✓
```

### Step 2: Setup Frontend (new terminal)

```bash
cd frontend
npm install
npm start
```

Opens http://localhost:3000 automatically.

### Step 3: Use It

1. **Register** an account
2. **Create a project** (click + in sidebar)
3. **Write your problem** in the thinking panel
4. **Write your approach**, edge cases, expected complexity
5. **Write code** in the Monaco editor
6. **Click ▶ Run** to just execute
7. **Click 🧠 Analyze** for the full 15-step WHY pipeline
8. **Check tabs**: Output → WHY Analysis → Test Cases → Delta
9. **Visit Dashboard** to see error patterns, heatmap, streaks
10. **Visit Profile** for cognitive timeline and personalized suggestions

---

## FAQ

**Can my friend use the same .env values?**
Yes — you'll share the same database and API rate limits. For separate data, create separate MongoDB clusters.

**What if I don't have a Groq key?**
The app still works — you get execution, static analysis, and test cases. WHY analysis falls back to data-only mode.

**What if Judge0 fails?**
Check your API key. The app shows the error message with guidance.

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET/POST | /api/projects | List/Create projects |
| GET/POST | /api/projects/:id/chats | List/Create chats |
| POST | /api/code/run | Execute code only |
| POST | /api/code/analyze | Full 15-step pipeline |
| POST | /api/code/compare | Compare attempts |
| POST | /api/code/generate-testcases | Generate tests |
| GET | /api/analysis/chat/:id | Get chat entries |
| GET | /api/profile/stats | Detailed stats |
| GET | /api/profile/timeline | Cognitive timeline |

## Tech Stack

**Backend:** Node.js, Express, MongoDB, JWT, bcrypt, Acorn (AST), Axios
**Frontend:** React, Monaco Editor, Recharts, React Router
**APIs:** Judge0 (execution), Groq (AI reasoning)
