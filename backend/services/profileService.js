const User = require('../models/User');
const logger = require('../utils/logger');

const FIELD_MAP = {
  EDGE_CASE_MISS: 'edgeCaseMiss', LOGIC_ERROR: 'logicError', SYNTAX_ERROR: 'syntaxError',
  OPTIMIZATION_MISS: 'optimizationMiss', BOUNDARY_ERROR: 'boundaryError', OFF_BY_ONE: 'offByOne',
  WRONG_APPROACH: 'wrongApproach', INCOMPLETE_SOLUTION: 'incompleteSolution',
  TYPE_ERROR: 'typeError', CONCURRENCY_ERROR: 'concurrencyError'
};

function weekStr(d = new Date()) {
  const o = new Date(d);
  const j = new Date(o.getFullYear(), 0, 1);
  return `${o.getFullYear()}-W${String(Math.ceil(((o - j) / 864e5 + j.getDay() + 1) / 7)).padStart(2, '0')}`;
}

async function updateThinkingProfile(userId, whyAnalysis, language) {
  const tax = whyAnalysis?.cognitiveTaxonomy;
  if (!tax) return;
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Work on a mutable copy of thinking_profile
    const tp = JSON.parse(JSON.stringify(user.thinking_profile || {}));
    tp.totalAnalyses = (tp.totalAnalyses || 0) + 1;
    tp.errorDistribution = tp.errorDistribution || {};
    tp.accuracyHistory = tp.accuracyHistory || [];
    tp.cognitiveTimeline = tp.cognitiveTimeline || [];
    tp.patterns = tp.patterns || [];
    tp.weakTopics = tp.weakTopics || [];

    const ok = tax.errorType === 'NO_ERROR';
    const field = FIELD_MAP[tax.errorType];
    const now = new Date();
    const week = weekStr(now);

    // 1. Counters
    if (field) tp.errorDistribution[field] = (tp.errorDistribution[field] || 0) + 1;
    if (ok) tp.totalSuccessful = (tp.totalSuccessful || 0) + 1;
    tp.lastActiveDate = now.toISOString();

    // 2. Accuracy history (keep last 200)
    tp.accuracyHistory.push({ date: now, score: ok ? 1 : 1 - (tax.confidence || 0.5), errorType: tax.errorType, language });
    if (tp.accuracyHistory.length > 200) tp.accuracyHistory = tp.accuracyHistory.slice(-200);

    // 3. Cognitive timeline
    const score = ok ? 85 : 35;
    const ex = tp.cognitiveTimeline.find(t => t.week === week);
    if (ex) {
      ex.totalAttempts++;
      const f = 1 / ex.totalAttempts;
      if (tax.category?.includes('Edge')) ex.edgeCaseScore = Math.round(ex.edgeCaseScore * (1 - f) + score * f);
      if (tax.category?.includes('Optim')) ex.optimizationScore = Math.round(ex.optimizationScore * (1 - f) + score * f);
      if (tax.category?.includes('Logic') || tax.category?.includes('Algorithm')) ex.logicScore = Math.round(ex.logicScore * (1 - f) + score * f);
      ex.overallScore = Math.round((ex.edgeCaseScore + ex.optimizationScore + ex.logicScore) / 3);
    } else {
      tp.cognitiveTimeline.push({
        week, weekStart: now, totalAttempts: 1,
        edgeCaseScore: tax.category?.includes('Edge') ? score : 50,
        optimizationScore: tax.category?.includes('Optim') ? score : 50,
        logicScore: (tax.category?.includes('Logic') || tax.category?.includes('Algorithm')) ? score : 50,
        overallScore: score
      });
      if (tp.cognitiveTimeline.length > 52) tp.cognitiveTimeline.shift();
    }

    // 4. Patterns
    if (tax.pattern) {
      const ep = tp.patterns.find(p => p.pattern === tax.pattern);
      if (ep) { ep.frequency++; ep.lastSeen = now; }
      else tp.patterns.push({ pattern: tax.pattern, frequency: 1, firstSeen: now, lastSeen: now });
      if (tp.patterns.length > 50) tp.patterns.shift();
    }

    // 5. Weak topics
    const dist = tp.errorDistribution;
    const total = Object.values(dist).reduce((a, b) => a + (b || 0), 0) || 1;
    const weak = [];
    if ((dist.edgeCaseMiss || 0) / total > 0.25) weak.push('Edge Case Handling');
    if ((dist.logicError || 0) / total > 0.25) weak.push('Algorithm Logic');
    if ((dist.optimizationMiss || 0) / total > 0.2) weak.push('Optimization');
    if ((dist.boundaryError || 0) / total > 0.15) weak.push('Boundary Conditions');
    if ((dist.offByOne || 0) / total > 0.15) weak.push('Off-by-One Errors');
    if ((dist.wrongApproach || 0) / total > 0.2) weak.push('Algorithm Selection');
    if ((dist.syntaxError || 0) / total > 0.2) weak.push('Language Syntax');
    tp.weakTopics = weak;

    // 6. Streak
    const today = new Date(now).setHours(0, 0, 0, 0);
    const last = tp.lastActiveDate ? new Date(tp.lastActiveDate).setHours(0, 0, 0, 0) : null;
    let streak = tp.currentStreak || 0;
    if (!last) streak = 1;
    else { const diff = Math.floor((today - last) / 864e5); if (diff === 1) streak++; else if (diff > 1) streak = 1; }
    tp.currentStreak = streak;
    tp.longestStreak = Math.max(streak, tp.longestStreak || 0);

    await User.findByIdAndUpdate(userId, { thinking_profile: tp });

    logger.info('Profile', 'Updated', { userId, errorType: tax.errorType });
  } catch (err) {
    logger.error('Profile', 'Update failed', err);
  }
}

module.exports = { updateThinkingProfile };
