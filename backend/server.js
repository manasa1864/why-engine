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

// Security & parsing
app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(sanitize);
if (config.nodeEnv !== 'test') app.use(morgan('dev'));

// Global rate limit
app.use('/api/', rateLimit({ windowMs: config.rateLimit.windowMs, max: config.rateLimit.maxGeneral, message: { error: 'Too many requests' } }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/code', require('./routes/code'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/profile', require('./routes/profile'));

// Health check
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  judge0: config.judge0.apiUrl ? 'configured' : 'NOT configured',
  groq: config.groq.apiKey ? 'configured' : 'NOT configured',
  supabase: config.supabase.url ? 'configured' : 'NOT configured'
}));

app.use(notFound);
app.use(errorHandler);

// Start — verify Supabase connection then listen
async function start() {
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
    process.exit(1);
  }
  console.log('✅ Supabase connected');
  app.listen(config.port, () => {
    console.log(`✅ Server on port ${config.port}`);
    console.log(`   Judge0:   ${config.judge0.apiUrl ? '✓' : '✗ NOT configured'}`);
    console.log(`   Groq:     ${config.groq.apiKey ? '✓' : '✗ NOT configured'}`);
    console.log(`   Supabase: ${config.supabase.url ? '✓' : '✗ NOT configured'}`);
  });
}

start();
