import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line,
} from 'recharts';
import Sidebar from '../components/common/Sidebar';
import api from '../utils/api';

const PALETTE = ['#56B8B0','#e07878','#B3E8DF','#E0C97E','#7ab4cf','#b89ae8','#E0C97E','#56B8B0'];

const SKILL_LABELS = {
  edgeCaseMiss:       'Edge Cases',
  logicError:         'Logic Errors',
  syntaxError:        'Syntax',
  optimizationMiss:   'Optimization',
  boundaryError:      'Boundaries',
  offByOne:           'Off-by-One',
  wrongApproach:      'Wrong Approach',
  incompleteSolution: 'Incomplete',
};

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:'.8rem', backdropFilter:'blur(12px)' }}>
      {label && <p style={{ fontWeight:600, marginBottom:4, color:'var(--text-2)' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || 'var(--text-1)' }}>
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(0) : p.value}</b>
          {p.name?.toLowerCase().includes('score') ? '%' : ''}
        </p>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="dc">
      <h3>{label}</h3>
      <div className="bn" style={{ color }}>{value}</div>
      {sub && <div className="subt">{sub}</div>}
    </div>
  );
}

function SkillRow({ label, count, maxCount }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const color = count === 0 ? 'var(--ok)' : pct > 66 ? 'var(--err)' : pct > 33 ? 'var(--warn)' : '#e8c07a';
  return (
    <div className="skill-hm-row">
      <div className="skill-hm-label">{label}</div>
      <div className="skill-hm-bar">
        <div className="skill-hm-fill" style={{ width:`${Math.max(pct,0)}%`, background:color }} />
      </div>
      <div className="skill-hm-val" style={{ color, minWidth:28 }}>{count}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats]       = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeSlice, setActiveSlice] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/profile/stats').then(r => setStats(r.data)),
      api.get('/projects').then(r => setProjects(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSlice = useCallback(data => {
    setActiveSlice(prev => prev === data?.name ? null : data?.name);
  }, []);

  if (loading) {
    return (
      <div className="app">
        <Sidebar projects={[]} chats={[]} onSelectProject={() => {}} onSelectChat={() => {}} onNewProject={() => {}} onNewChat={() => {}} />
        <div className="main"><div className="loading"><div className="spinner" /> Loading dashboard...</div></div>
      </div>
    );
  }

  const d = stats?.errorDistribution || {};

  /* ── Pie chart — error types ── */
  const pieData = Object.entries(SKILL_LABELS)
    .map(([key, name]) => ({ name, value: d[key] || 0 }))
    .filter(x => x.value > 0);

  /* ── Accuracy area chart ── */
  const accuracyData = (stats?.recentAccuracy || []).map((h, i) => ({
    attempt: i + 1,
    score: Math.round((h.score || 0) * 100),
  }));

  /* ── Cognitive timeline line chart ── */
  const timelineData = (stats?.cognitiveTimeline || []).slice(-8);

  /* ── Skill heatmap ── */
  const skillData = Object.entries(SKILL_LABELS).map(([key, label]) => ({ label, count: d[key] || 0 }));
  const maxSkill = Math.max(...skillData.map(s => s.count), 1);

  const topError = pieData.length ? pieData.reduce((a, b) => a.value > b.value ? a : b) : null;

  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.08) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * R);
    const y = cy + r * Math.sin(-midAngle * R);
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
        onSelectProject={p => nav('/', { state: { project: p } })}
        onSelectChat={() => {}} onNewProject={() => {}} onNewChat={() => {}}
      />

      <div className="main">
        <div className="dash">
          {/* Header */}
          <div className="dash-header">
            <h2>Your Coding Mind</h2>
            <p>Every time you click ⚡ Analyze, WHY Engine records your error patterns and thinking gaps. This dashboard shows what you struggle with most — so you know exactly what to practice.</p>
          </div>

          {/* ── Stat cards ── */}
          <div className="dg">
            <StatCard label="Total Analyses" value={stats?.totalAnalyses || 0}
              sub={`${stats?.totalSuccessful || 0} passed execution`} color="var(--accent)" />
            <StatCard label="Success Rate"
              value={`${stats?.successRate || 0}%`}
              sub={`${(stats?.successRate || 0) > 70 ? 'Great — keep it up' : (stats?.successRate || 0) > 40 ? 'Room to improve' : 'Focus on fundamentals'}`}
              color={(stats?.successRate || 0) > 50 ? 'var(--ok)' : 'var(--warn)'} />
            <StatCard label="Current Streak" value={`${stats?.currentStreak || 0}d`}
              sub={`Best: ${stats?.longestStreak || 0} days · consistency builds intuition`} color="var(--teal)" />
            <div className="dc">
              <h3>Top Error Pattern</h3>
              <div className="bn" style={{ color:'var(--err)', fontSize: topError ? '1rem':'1.5rem', lineHeight:1.2, marginTop:4 }}>
                {topError?.name || '—'}
              </div>
              {topError
                ? <div className="subt">{topError.value} time{topError.value !== 1 ? 's' : ''} — your #1 blind spot</div>
                : <div className="subt">No errors recorded yet</div>
              }
            </div>
          </div>

          {/* ── Weak topics quick-access ── */}
          {(stats?.weakTopics || []).length > 0 && (
            <div className="dc">
              <h3>Focus Areas</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
                Topics where WHY Engine consistently finds gaps in your thinking. Practicing these will have the highest impact on your score.
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                {stats.weakTopics.map((t, i) => (
                  <span key={i} className="tag tag-e" style={{ padding:'4px 12px' }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Charts row: error pie + accuracy area ── */}
          <div className="dg">
            <div className="dc">
              <h3>Error Distribution</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
                Which mistake types come up most in your analyses. Click a slice to highlight it.
              </p>
              {pieData.length ? (
                <>
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={85} innerRadius={40}
                        labelLine={false} label={renderPieLabel}
                        onClick={handleSlice} style={{ cursor:'pointer' }}>
                        {pieData.map((e, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]}
                            opacity={activeSlice && activeSlice !== e.name ? 0.35 : 1}
                            stroke={activeSlice === e.name ? '#fff' : 'none'} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:'.72rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {activeSlice && (
                    <p style={{ textAlign:'center', fontSize:'.75rem', color:'var(--text-3)', marginTop:4 }}>
                      Viewing: <b style={{ color:'var(--accent)' }}>{activeSlice}</b> — click again to clear
                    </p>
                  )}
                </>
              ) : (
                <div className="empty" style={{ height:200 }}>
                  <div className="empty-icon">📊</div>
                  <p>Analyze code to see your error distribution</p>
                </div>
              )}
            </div>

            <div className="dc">
              <h3>Accuracy Over Time</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
                Your analysis score per attempt. An upward trend means your thinking is improving.
              </p>
              {accuracyData.length > 1 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={accuracyData} margin={{ top:5, right:10, left:-20, bottom:0 }}>
                    <defs>
                      <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--teal)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="attempt" tick={{ fontSize:10 }} stroke="var(--border)" />
                    <YAxis domain={[0,100]} tick={{ fontSize:10 }} stroke="var(--border)" />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="score" name="Score"
                      stroke="var(--teal)" strokeWidth={2} fill="url(#accGrad)"
                      dot={{ r:4, fill:'var(--teal)', strokeWidth:0 }}
                      activeDot={{ r:6, stroke:'var(--bg-primary)', strokeWidth:2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty" style={{ height:200 }}>
                  <p>Appears after multiple analyses</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Cognitive Timeline + Skill Heatmap ── */}
          <div className="dg">
            <div className="dc">
              <h3>Cognitive Timeline — Weekly</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
                How your skill scores change week by week. A rising "Overall" line means you are actually getting better at thinking through problems.
              </p>
              {timelineData.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timelineData} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="week" tick={{ fontSize:9 }} stroke="var(--border)" />
                    <YAxis domain={[0,100]} tick={{ fontSize:9 }} stroke="var(--border)" />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize:'.72rem' }} />
                    <Line type="monotone" dataKey="edgeCaseScore"    stroke="#e07878" name="Edge Cases"   strokeWidth={2} dot={{ r:3 }} />
                    <Line type="monotone" dataKey="logicScore"        stroke="#56B8B0" name="Logic"        strokeWidth={2} dot={{ r:3 }} />
                    <Line type="monotone" dataKey="optimizationScore" stroke="#E0C97E" name="Optimization" strokeWidth={2} dot={{ r:3 }} />
                    <Line type="monotone" dataKey="overallScore"      stroke="#B3E8DF" name="Overall"      strokeWidth={2} dot={{ r:3 }} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty" style={{ height:200 }}>
                  <p>Weekly evolution appears after consistent usage</p>
                </div>
              )}
            </div>

            <div className="dc">
              <h3>Failure Heatmap</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:10 }}>
                Bar = error frequency &nbsp;·&nbsp; Red = weakness, green = strength
              </p>
              <div className="skill-hm">
                {skillData.map(s => (
                  <SkillRow key={s.label} label={s.label} count={s.count} maxCount={maxSkill} />
                ))}
              </div>
              {skillData.every(s => s.count === 0) && (
                <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginTop:8 }}>
                  All green — no errors recorded yet. Start analyzing!
                </p>
              )}
            </div>
          </div>

          {/* ── Recurring patterns ── */}
          {(stats?.patterns || []).length > 0 && (
            <div className="dc">
              <h3>Recurring Thinking Patterns</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
                Habits WHY Engine has detected across multiple analyses — not one-off mistakes, but patterns in how you think.
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                {stats.patterns.map((p, i) => (
                  <span key={i} className="tag tag-w" style={{ fontSize:'.77rem', padding:'4px 10px' }}>
                    {p.pattern} <b style={{ marginLeft:4 }}>×{p.frequency}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!stats?.totalAnalyses && (
            <div className="dc" style={{ textAlign:'center', padding:'32px 20px' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🧠</div>
              <h3>Your cognitive dashboard starts here</h3>
              <p style={{ color:'var(--text-3)', marginTop:8 }}>
                Run your first code analysis to see patterns, heatmaps, and timelines.
              </p>
              <button className="btn btn-p" style={{ marginTop:16 }} onClick={() => nav('/')}>
                Go to Workspace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
