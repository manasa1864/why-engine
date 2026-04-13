const log = (level, context, message, data = {}) => {
  const entry = { level, time: new Date().toISOString(), context, message, ...data };
  if (data.error instanceof Error) { entry.error = data.error.message; entry.stack = data.error.stack?.split('\n').slice(0,3).join(' | '); }
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  fn(JSON.stringify(entry));
};
module.exports = {
  info: (ctx, msg, data) => log('INFO', ctx, msg, data),
  warn: (ctx, msg, data) => log('WARN', ctx, msg, data),
  error: (ctx, msg, err, data) => log('ERROR', ctx, msg, { error: err, ...data }),
};
