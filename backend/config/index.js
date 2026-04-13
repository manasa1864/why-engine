require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
  jwt: { secret: process.env.JWT_SECRET || 'dev-fallback-secret', expire: process.env.JWT_EXPIRE || '7d' },
  judge0: {
    apiUrl: process.env.JUDGE0_API_URL || 'https://ce.judge0.com',
    apiKey: process.env.JUDGE0_API_KEY || '',
    timeout: parseInt(process.env.JUDGE0_TIMEOUT) || 30000,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    timeout: parseInt(process.env.GROQ_TIMEOUT) || 60000,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxGeneral: parseInt(process.env.RATE_LIMIT_MAX_GENERAL) || 100,
    maxCode: parseInt(process.env.RATE_LIMIT_MAX_CODE) || 30,
    maxAuth: parseInt(process.env.RATE_LIMIT_MAX_AUTH) || 20,
  },
  // ===== PLUGGABLE LANGUAGE SYSTEM =====
  // Add a new language here and it works everywhere automatically
  languages: {
    python:     { id: 71, executor: 'judge0', parser: 'pattern', label: 'Python' },
    javascript: { id: 63, executor: 'judge0', parser: 'ast',     label: 'JavaScript' },
    typescript: { id: 74, executor: 'judge0', parser: 'ast',     label: 'TypeScript' },
    cpp:        { id: 54, executor: 'judge0', parser: 'pattern', label: 'C++' },
    c:          { id: 50, executor: 'judge0', parser: 'pattern', label: 'C' },
    java:       { id: 62, executor: 'judge0', parser: 'pattern', label: 'Java' },
    go:         { id: 60, executor: 'judge0', parser: 'pattern', label: 'Go' },
    rust:       { id: 73, executor: 'judge0', parser: 'pattern', label: 'Rust' },
    ruby:       { id: 72, executor: 'judge0', parser: 'pattern', label: 'Ruby' },
  },
  errorTypes: [
    'EDGE_CASE_MISS','LOGIC_ERROR','SYNTAX_ERROR','OPTIMIZATION_MISS',
    'BOUNDARY_ERROR','OFF_BY_ONE','WRONG_APPROACH','INCOMPLETE_SOLUTION',
    'TYPE_ERROR','CONCURRENCY_ERROR','NO_ERROR'
  ],
  cognitiveCategories: [
    'Logical Reasoning','Pattern Recognition','Edge Case Awareness',
    'Optimization','Language Mechanics','Algorithm Knowledge',
    'Data Structure Understanding','Problem Decomposition'
  ],
};
