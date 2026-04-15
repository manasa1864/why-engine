const config = require('./config');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const supabase = require('./db/supabase');

const app = express();

app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: config.clientUrl, credentials: true, methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(sanitize);

if (config.nodeEnv !== 'test') app.use(morgan('dev'));

app.use('/api/', rateLimit({ windowMs: config.rateLimit.windowMs, max: config.rateLimit.maxGeneral, message: { error: 'Too many requests' }, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/code',     require('./routes/code'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/profile',  require('./routes/profile'));

// Health check — fix: return simple strings so frontend === checks work
app.get('/api/health', (_req, res) => {
  const groqKey = config.groq?.apiKey;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    judge0:   config.judge0.apiUrl ? 'configured' : 'not_configured',
    groq:     (groqKey && groqKey.length > 10) ? 'configured' : 'not_configured',
    supabase: config.supabase.url ? 'configured' : 'not_configured',
  });
});

// Groq connectivity test — hit /api/groq-test in browser to diagnose AI issues
app.get('/api/groq-test', async (_req, res) => {
  const axios = require('axios');
  const groqKey = config.groq?.apiKey;
  if (!groqKey || groqKey.length < 10) {
    return res.json({ ok: false, reason: 'no_key', message: 'GROQ_API_KEY is not set in backend/.env' });
  }
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Reply with the word OK only.' }], max_tokens: 5 },
      { headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const reply = response.data?.choices?.[0]?.message?.content || '(empty)';
    res.json({ ok: true, model: 'llama-3.3-70b-versatile', reply });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;
    let fix = '';
    if (status === 401 || status === 403) fix = 'API key is invalid or expired — get a new one at console.groq.com/keys';
    else if (status === 429) fix = 'Rate limit hit — wait 1 minute and try again';
    else if (!status) fix = 'Network error — check internet connection or firewall blocking api.groq.com';
    else fix = `Unexpected error — status ${status}`;
    res.json({ ok: false, status, message: msg, fix });
  }
});

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connected');
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    const groqKey = config.groq?.apiKey;
    console.log(`\n🚀 WHY Engine — port ${config.port} [${config.nodeEnv}]`);
    console.log(`   Judge0:   ${config.judge0.apiUrl ? '✓' : '✗ not configured'}`);
    console.log(`   Groq:     ${groqKey && groqKey.length > 10 ? '✓ key loaded' : '✗ MISSING — set GROQ_API_KEY in .env'}`);
    console.log(`   Supabase: ✓ connected`);
    if (!groqKey || groqKey.length < 10) {
      console.warn('\n⚠️  GROQ_API_KEY not set — WHY analysis uses fallback mode only');
      console.warn('   Get free key: https://console.groq.com/keys\n');
    }
  });
}

start();
