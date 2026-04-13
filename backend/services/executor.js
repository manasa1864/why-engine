const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/*
 * ========================================
 * ENGINE 1: CODE EXECUTION ENGINE
 * ========================================
 * - Judge0 sandboxed execution
 * - 10s CPU timeout, 128MB memory limit
 * - No network access in sandbox
 * - Retry logic with exponential backoff
 * - Graceful error handling
 */

function getHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (config.judge0.apiKey && config.judge0.apiUrl.includes('rapidapi')) {
    h['X-RapidAPI-Key'] = config.judge0.apiKey;
    h['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
  } else if (config.judge0.apiKey) {
    h['X-Auth-Token'] = config.judge0.apiKey;
  }
  return h;
}

async function withRetry(fn, retries = 2, delay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries) throw e;
      logger.warn('Executor', `Attempt ${i+1} failed, retrying...`, { error: e.message });
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
}

async function executeCode(code, language, stdin = '') {
  if (!code?.trim()) return { stdout: '', stderr: 'No code provided', status: 'Error', time: '0', memory: '0' };
  const lang = config.languages[language];
  if (!lang) return { stdout: '', stderr: `Unsupported language: ${language}`, status: 'Error', time: '0', memory: '0' };

  try {
    const result = await withRetry(async () => {
      const { data } = await axios.post(
        `${config.judge0.apiUrl}/submissions?base64_encoded=false&wait=true&fields=stdout,stderr,status,time,memory,exit_code,compile_output,status_id`,
        {
          source_code: code,
          language_id: lang.id,
          stdin: stdin || '',
          cpu_time_limit: 10,
          cpu_extra_time: 2,
          wall_time_limit: 15,
          memory_limit: 128000,
          max_processes_and_or_threads: 30,
          enable_network: false,
        },
        { headers: getHeaders(), timeout: config.judge0.timeout }
      );
      return data;
    });

    return {
      stdout: result.stdout || '',
      stderr: result.stderr || result.compile_output || '',
      status: result.status?.description || 'Unknown',
      statusId: result.status_id || 0,
      time: result.time || '0',
      memory: result.memory ? `${(result.memory / 1024).toFixed(1)} MB` : '0 MB',
      exitCode: result.exit_code ?? -1,
    };
  } catch (err) {
    logger.error('Executor', 'Execution failed', err, { language });
    return {
      stdout: '',
      stderr: `Execution error: ${err.response?.data?.message || err.message}. Check Judge0 config in .env`,
      status: 'Service Error', statusId: -1, time: '0', memory: '0', exitCode: -1,
    };
  }
}

async function executeWithInput(code, language, input) {
  return executeCode(code, language, input);
}

module.exports = { executeCode, executeWithInput };
