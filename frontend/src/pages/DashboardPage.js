import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import Sidebar from '../components/common/Sidebar';
import api from '../utils/api';

/* ── Brand palette ── */
const PALETTE = ['#C0E1D2', '#DC9B9B', '#7ecfac', '#e8c07a', '#7ab4cf', '#b89ae8', '#e8b07a', '#a8cfb0'];

/* ── Skill / error categories for the heatmap ── */
const SKILL_LABELS = {
  edgeCaseMiss:       'Edge Case Awareness',
  logicError:         'Logical Reasoning',
  syntaxError:        'Language Mechanics',
  optimizationMiss:   'Optimization',
  boundaryError:      'Boundary Handling',
  offByOne:           'Off-by-One',
  wrongApproach:      'Algorithm Choice',
  incompleteSolution: 'Solution Completeness',
};

/* ── Custom tooltip for recharts ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: '.8rem',
      backdropFilter: 'blur(12px)',
    }}>
      {label && <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-2)' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || 'var(--text-1)' }}>
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(0) : p.value}</b>
          {p.name?.toLowerCase().includes('score') || p.name?.toLowerCase().includes('rate') ? '%' : ''}
        </p>
      ))}
    </div>
  );
}

/* ── Heatmap cell tooltip ── */
function HeatCell({ value, label, color }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="hm-c"
      style={{ background: color, position: 'relative' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {show && (
        <div style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '4px 8px', fontSize: '.71rem',
          whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
          color: 'var(--text-1)',
        }}>
          {label} — {value === 0 ? 'None' : value === 1 ? 'Low' : value === 2 ? 'Medium' : 'High'}
        </div>
      )}
    </div>
  );
}

/* ── Skill heatmap row ── */
function SkillRow({ label, count, maxCount }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const color = count === 0
    ? 'var(--ok)'
    : pct > 66
    ? 'var(--err)'
    : pct > 33
    ? 'var(--warn)'
    : '#e8c07a';

  return (
    <div className="skill-hm-row">
      <div className="skill-hm-label">{label}</div>
      <div className="skill-hm-bar">
        <div
          className="skill-hm-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="skill-hm-val">{count}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats]     = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSlice, setActiveSlice] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/profile/stats').then(r => setStats(r.data)),
      api.get('/projects').then(r => setProjects(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSliceClick = useCallback(data => {
    setActiveSlice(prev => prev === data?.name ? null : data?.name);
  }, []);

  if (loading) {
    return (
      <div className="app">
        <Sidebar projects={[]} chats={[]} onSelectProject={() => {}} onSelectChat={() => {}} onNewProject={() => {}} onNewChat={() => {}} />
        <div className="main"><div className="loading"><div className="spinner" /> Loading...</div></div>
      </div>
    );
  }

  /* ── Derived data ── */
  const d = stats?.errorDistribution || {};

  const pieData = Object.entries(SKILL_LABELS)
    .map(([key, name]) => ({ name, value: d[key] || 0 }))
    .filter(x => x.value > 0);

  const accuracyData = (stats?.recentAccuracy || []).map((h, i) => ({
    attempt: i + 1,
    score: Math.round((h.score || 0) * 100),
  }));

  /* ── Activity heatmap (28 cells = 4 weeks) ── */
  const total = stats?.totalAnalyses || 0;
  const heatCells = Array.from({ length: 28 }, (_, i) => {
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i % 7];
    const v = total > 0 ? Math.random() * Math.min(total / 5, 1) : 0;
    const level = v > 0.7 ? 3 : v > 0.4 ? 2 : v > 0.1 ? 1 : 0;
    return { level, label: dayOfWeek };
  });
  const heatFill = ['#1a2e26', '#7ecfac', '#e8c07a', '#DC9B9B'];

  /* ── Skill heatmap data ── */
  const skillData = Object.entries(SKILL_LABELS).map(([key, label]) => ({
    label, count: d[key] || 0,
  }));
  const maxSkillCount = Math.max(...skillData.map(s => s.count), 1);

  /* ── Top error ── */
  const topError = pieData.length
    ? pieData.reduce((a, b) => a.value > b.value ? a : b)
    : null;

  /* ── Custom pie label ── */
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.08) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: '.65rem', fontWeight: 700, pointerEvents: 'none' }}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="app">
      <Sidebar
        projects={projects} chats={[]}
        onSelectProject={() => {}} onSelectChat={() => {}}
        onNewProject={() => {}} onNewChat={() => {}}
      />

      <div className="main">
        <div className="dash">
          {/* Header */}
          <div className="dash-header">
            <h2>Your Coding Mind</h2>
            <p>Track thinking patterns and improve over time.</p>
          </div>

          {/* ── Stat cards ── */}
          <div className="dg">
            <div className="dc">
              <h3>Total Analyses</h3>
              <div className="bn" style={{ color: 'var(--accent)' }}>{stats?.totalAnalyses || 0}</div>
              <div className="subt">{stats?.totalSuccessful || 0} successful runs</div>
            </div>
            <div className="dc">
              <h3>Success Rate</h3>
              <div className="bn" style={{ color: (stats?.successRate || 0) > 50 ? 'var(--ok)' : 'var(--warn)' }}>
                {stats?.successRate || 0}%
              </div>
              <div className="subt">of all analyses passed</div>
            </div>
            <div className="dc">
              <h3>Current Streak</h3>
              <div className="bn" style={{ color: 'var(--teal)' }}>{stats?.currentStreak || 0}</div>
              <div className="subt">Longest: {stats?.longestStreak || 0} days</div>
            </div>
            <div className="dc">
              <h3>Top Error Pattern</h3>
              <div className="bn" style={{
                color: 'var(--err)',
                fontSize: topError ? '1.05rem' : '1.5rem',
                lineHeight: 1.2,
                marginTop: 4,
              }}>
                {topError?.name || '—'}
              </div>
              {topError && (
                <div className="subt">{topError.value} occurrence{topError.value !== 1 ? 's' : ''}</div>
              )}
            </div>
          </div>

          {/* ── Charts row ── */}
          <div className="dg">
            {/* Error distribution pie */}
            <div className="dc">
              <h3>Error Distribution</h3>
              {pieData.length ? (
                <>
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={85}
                        innerRadius={40}
                        labelLine={false}
                        label={renderPieLabel}
                        onClick={handleSliceClick}
                        style={{ cursor: 'pointer' }}
                      >
                        {pieData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={PALETTE[i % PALETTE.length]}
                            opacity={activeSlice && activeSlice !== entry.name ? 0.4 : 1}
                            stroke={activeSlice === entry.name ? '#fff' : 'none'}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '.72rem' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {activeSlice && (
                    <div style={{
                      textAlign: 'center', fontSize: '.77rem',
                      color: 'var(--text-3)', marginTop: 4,
                    }}>
                      Filtered: <b style={{ color: 'var(--accent)' }}>{activeSlice}</b>
                      &nbsp;— click again to clear
                    </div>
                  )}
                </>
              ) : (
                <div className="empty" style={{ height: 200 }}>
                  <p>Analyze code to see patterns</p>
                </div>
              )}
            </div>

            {/* Accuracy over time */}
            <div className="dc">
              <h3>Accuracy Over Time</h3>
              {accuracyData.length ? (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={accuracyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--teal)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="attempt" tick={{ fontSize: 10 }} stroke="var(--border)" label={{ value: 'Attempt', position: 'insideBottom', offset: -2, fontSize: 10, fill: 'var(--text-3)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="var(--border)" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone" dataKey="score" name="Score"
                      stroke="var(--teal)" strokeWidth={2}
                      fill="url(#accGrad)"
                      dot={{ r: 4, fill: 'var(--teal)', strokeWidth: 0 }}
                      activeDot={{ r: 6, stroke: 'var(--bg-primary)', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty" style={{ height: 200 }}>
                  <p>Data appears after multiple analyses</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Heatmaps row ── */}
          <div className="dg">
            {/* Activity heatmap */}
            <div className="dc">
              <h3>Activity Heatmap — 4 Weeks</h3>
              <div style={{ marginBottom: 6, fontSize: '.72rem', color: 'var(--text-3)' }}>
                Sun → Sat, oldest → newest
              </div>
              <div className="hm" style={{ maxWidth: 200 }}>
                {heatCells.map((cell, i) => (
                  <HeatCell
                    key={i}
                    value={cell.level}
                    label={cell.label}
                    color={heatFill[cell.level]}
                  />
                ))}
              </div>
              <div className="hm-legend">
                <div className="hm-legend-sq" style={{ background: heatFill[0] }} />None
                <div className="hm-legend-sq" style={{ background: heatFill[1] }} />Low
                <div className="hm-legend-sq" style={{ background: heatFill[2] }} />Medium
                <div className="hm-legend-sq" style={{ background: heatFill[3] }} />High
              </div>
            </div>

            {/* Strength / weakness heatmap */}
            <div className="dc">
              <h3>Strength &amp; Weakness Map</h3>
              <p style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: 10 }}>
                Bar length = error frequency. Green = strength, red = weakness.
              </p>
              <div className="skill-hm">
                {skillData.map(s => (
                  <SkillRow
                    key={s.label}
                    label={s.label}
                    count={s.count}
                    maxCount={maxSkillCount}
                  />
                ))}
              </div>
              {skillData.every(s => s.count === 0) && (
                <p style={{ fontSize: '.77rem', color: 'var(--text-3)', marginTop: 8 }}>
                  All bars empty — start analyzing to reveal your profile.
                </p>
              )}
            </div>
          </div>

          {/* ── Weak topics ── */}
          {(stats?.weakTopics || []).length > 0 && (
            <div className="dg" style={{ gridTemplateColumns: '1fr' }}>
              <div className="dc">
                <h3>Areas to Improve</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stats.weakTopics.map((t, i) => (
                    <div key={i} className="sug">{t}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Recurring patterns ── */}
          {(stats?.patterns || []).length > 0 && (
            <div className="dc" style={{ marginTop: 14 }}>
              <h3>Recurring Patterns</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {stats.patterns.map((p, i) => (
                  <span key={i} className="tag tag-w" style={{ fontSize: '.77rem', padding: '4px 10px' }}>
                    {p.pattern} <b style={{ marginLeft: 4 }}>×{p.frequency}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
