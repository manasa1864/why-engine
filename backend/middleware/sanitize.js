// Prevents NoSQL injection by stripping $ operators from input
module.exports = (req, res, next) => {
  const clean = (obj) => {
    if (typeof obj === 'string') return obj.replace(/\$/g, '');
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        if (!k.startsWith('$')) out[k] = clean(obj[k]);
      }
      return out;
    }
    return obj;
  };
  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  next();
};
