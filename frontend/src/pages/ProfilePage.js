import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import Sidebar from '../components/common/Sidebar';
import api from '../utils/api';

const SKILL_COLOR = {
  'Edge Case':'#e07878','Logic':'#56B8B0','Syntax':'#B3E8DF',
  'Optimization':'#E0C97E','Boundary':'#7ab4cf','Off-by-One':'#e07878',
  'Wrong Approach':'#b89ae8','Incomplete':'#E0C97E',
};

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:'.8rem', backdropFilter:'blur(12px)' }}>
      {label && <p style={{ fontWeight:600, marginBottom:4, color:'var(--text-2)' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill || 'var(--text-1)' }}>
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(0) : p.value}</b>
        </p>
      ))}
    </div>
  );
}

function StrengthBar({ label, errorCount, totalAnalyses }) {
  const safeTotal = totalAnalyses || 1;
  const errorRate = Math.min((errorCount / safeTotal) * 100, 100);
  const strength  = Math.max(100 - errorRate * 2, 0);
  const color = strength >= 70 ? 'var(--ok)' : strength >= 40 ? 'var(--warn)' : 'var(--err)';
  return (
    <div className="skill-hm-row" style={{ marginBottom:5 }}>
      <div className="skill-hm-label">{label}</div>
      <div className="skill-hm-bar">
        <div className="skill-hm-fill" style={{ width:`${Math.max(strength,3)}%`, background:color, transition:'width .8s ease' }} />
      </div>
      <div className="skill-hm-val" style={{ color, fontSize:'.7rem' }}>
        {strength >= 60 ? 'Strong' : strength >= 30 ? 'OK' : 'Weak'}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [stats,    setStats]    = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [activeBar, setActiveBar] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/profile/stats').then(r => setStats(r.data)),
      api.get('/profile/timeline').then(r => setTimeline(r.data)),
      api.get('/projects').then(r => setProjects(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="app">
        <Sidebar projects={[]} chats={[]} onSelectProject={() => {}} onSelectChat={() => {}} onNewProject={() => {}} onNewChat={() => {}} />
        <div className="main"><div className="loading"><div className="spinner" /> Loading profile...</div></div>
      </div>
    );
  }

  const d     = stats?.errorDistribution || {};
  const total = stats?.totalAnalyses || 0;

  const barData = [
    { name:'Edge Case',   c: d.edgeCaseMiss       || 0 },
    { name:'Logic',       c: d.logicError          || 0 },
    { name:'Syntax',      c: d.syntaxError         || 0 },
    { name:'Optimization',c: d.optimizationMiss    || 0 },
    { name:'Boundary',    c: d.boundaryError       || 0 },
    { name:'Off-by-One',  c: d.offByOne            || 0 },
    { name:'Wrong Approach',c: d.wrongApproach     || 0 },
    { name:'Incomplete',  c: d.incompleteSolution  || 0 },
  ].filter(x => x.c > 0);

  const radarData = [
    { subject:'Edge Cases',   A: Math.max(100 - ((d.edgeCaseMiss      || 0) / Math.max(total,1)) * 200, 10) },
    { subject:'Logic',        A: Math.max(100 - ((d.logicError         || 0) / Math.max(total,1)) * 200, 10) },
    { subject:'Syntax',       A: Math.max(100 - ((d.syntaxError        || 0) / Math.max(total,1)) * 200, 10) },
    { subject:'Optimization', A: Math.max(100 - ((d.optimizationMiss   || 0) / Math.max(total,1)) * 200, 10) },
    { subject:'Boundaries',   A: Math.max(100 - ((d.boundaryError      || 0) / Math.max(total,1)) * 200, 10) },
    { subject:'Completeness', A: Math.max(100 - ((d.incompleteSolution || 0) / Math.max(total,1)) * 200, 10) },
  ];

  const ct = timeline?.cognitiveTimeline || [];

  const suggestions = [];
  if (!total) {
    suggestions.push({ label:'Getting started', text:'Start analyzing code to receive personalized coaching.' });
  } else {
    if ((d.edgeCaseMiss     || 0) > 2) suggestions.push({ label:'Edge cases',       text:'Before coding: what happens with empty input? Single element? Zero? Negative?' });
    if ((d.logicError       || 0) > 2) suggestions.push({ label:'Logic errors',      text:'Write pseudocode first, trace with small examples, then code.' });
    if ((d.optimizationMiss || 0) > 1) suggestions.push({ label:'Optimization',      text:'Study hash maps, two-pointer, sliding window, and binary search patterns.' });
    if ((d.boundaryError    || 0) > 1) suggestions.push({ label:'Boundaries',        text:'"< n" vs "<= n" matters. Always verify the first and last element.' });
    if ((d.offByOne         || 0) > 1) suggestions.push({ label:'Off-by-one',        text:'Does index 0 and the last index process correctly? Check both ends.' });
    if ((d.wrongApproach    || 0) > 1) suggestions.push({ label:'Approach selection',text:'Consider 2–3 strategies before committing to code.' });
    if (!suggestions.length)           suggestions.push({ label:'Keep going',         text:'Strong profile so far. Keep analyzing to refine your cognitive map.' });
  }

  const strengthMap = [
    { label:'Edge Case Awareness',   key:'edgeCaseMiss' },
    { label:'Logical Reasoning',     key:'logicError' },
    { label:'Language Mechanics',    key:'syntaxError' },
    { label:'Optimization',          key:'optimizationMiss' },
    { label:'Boundary Handling',     key:'boundaryError' },
    { label:'Off-by-One Precision',  key:'offByOne' },
    { label:'Algorithm Choice',      key:'wrongApproach' },
    { label:'Solution Completeness', key:'incompleteSolution' },
  ];

  return (
    <div className="app">
      <Sidebar projects={projects} chats={[]}
        onSelectProject={() => {}} onSelectChat={() => {}} onNewProject={() => {}} onNewChat={() => {}} />

      <div className="main">
        <div className="prof">
          <h2>Thinking Profile</h2>
          <p style={{ fontSize:'.84rem', color:'var(--text-3)', marginBottom:8 }}>
            A deep map of how your brain approaches coding problems — where you excel and where you have blind spots. Built from every analysis you have run.
          </p>

          {/* Stat summary */}
          <div className="sr" title="Quick snapshot of your overall activity and consistency">
            {[
              { lb:'Analyses',   vl: total,                       color:'var(--accent)' },
              { lb:'Successful', vl: stats?.totalSuccessful || 0, color:'var(--ok)' },
              { lb:'Rate',       vl:`${stats?.successRate || 0}%`,color:(stats?.successRate||0)>50?'var(--ok)':'var(--warn)' },
              { lb:'Streak',     vl: stats?.currentStreak || 0,   color:'var(--teal)' },
              { lb:'Projects',   vl: projects.length,             color:'var(--text-2)' },
            ].map(s => (
              <div key={s.lb} className="si">
                <div className="lb">{s.lb}</div>
                <div className="vl" style={{ color:s.color }}>{s.vl}</div>
              </div>
            ))}
          </div>

          {/* Charts row: error frequency + skill radar */}
          <div className="dg" style={{ marginTop:14 }}>
            <div className="dc">
              <h3>Error Frequency</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
                How many times each mistake type appeared across all your analyses. Tall bars = recurring blind spots worth targeting.
              </p>
              {barData.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData} margin={{ top:4, right:4, left:-24, bottom:40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:9 }} stroke="var(--border)" angle={-30} textAnchor="end" height={55} />
                    <YAxis tick={{ fontSize:10 }} stroke="var(--border)" allowDecimals={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="c" name="Errors" radius={[5,5,0,0]}
                      onClick={d => setActiveBar(prev => prev === d.name ? null : d.name)}
                      style={{ cursor:'pointer' }}>
                      {barData.map((e, i) => (
                        <Cell key={i} fill={SKILL_COLOR[e.name] || 'var(--accent)'}
                          opacity={activeBar && activeBar !== e.name ? 0.35 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty" style={{ height:200 }}>
                  <div className="empty-icon">📊</div>
                  <p>No error data yet — start analyzing code</p>
                </div>
              )}
            </div>

            <div className="dc">
              <h3>Skill Web</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:6 }}>
                A radar view of all 6 core coding dimensions. A fuller, rounder shape means you are well-rounded. Sunken areas are where you drop marks.
              </p>
              {total > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <RadarChart data={radarData} margin={{ top:10, right:20, bottom:10, left:20 }}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize:10, fill:'var(--text-3)' }} />
                    <PolarRadiusAxis angle={90} domain={[0,100]} tick={{ fontSize:9, fill:'var(--text-3)' }} axisLine={false} />
                    <Radar name="Skill" dataKey="A" stroke="var(--teal)" fill="var(--teal)" fillOpacity={0.18} strokeWidth={2} />
                    <Tooltip content={<ChartTip />} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty" style={{ height:210 }}>
                  <p>Skill web unlocks after your first analysis</p>
                </div>
              )}
            </div>
          </div>

          {/* Strength / Weakness map */}
          <div className="dc">
            <h3>Strength &amp; Weakness Map</h3>
            <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:10 }}>
              Each bar shows your skill strength from 0–100. Longer bar = stronger. Computed by comparing how often you make that mistake vs how many problems you have analyzed. Green = Strong (70+), Yellow = OK (40–70), Red = Weak (&lt;40).
            </p>
            <div className="skill-hm" style={{ gap:7 }}>
              {strengthMap.map(s => (
                <StrengthBar key={s.key} label={s.label} errorCount={d[s.key] || 0} totalAnalyses={total} />
              ))}
            </div>
          </div>

          {/* Cognitive Timeline */}
          <div className="dc">
            <h3>Cognitive Timeline — Weekly</h3>
            <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
              Your skill scores over time, grouped by week. The dashed blue "Overall" line is your composite score — a rising trend means you are genuinely improving at algorithmic thinking.
            </p>
            {ct.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={ct} margin={{ top:4, right:10, left:-20, bottom:0 }}>
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
              <div className="empty" style={{ height:160 }}>
                <p>Weekly evolution appears after consistent usage across multiple sessions</p>
              </div>
            )}
          </div>

          {/* Personalized suggestions + patterns */}
          <div className="dg">
            <div className="dc">
              <h3>Personalized Suggestions</h3>
              <p style={{ fontSize:'.77rem', color:'var(--text-3)', marginBottom:8 }}>
                Concrete drills tailored to your actual error history — not generic advice.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:4 }}>
                {suggestions.map((s, i) => (
                  <div key={i} className="sug" style={{ flexDirection:'column', gap:3 }}>
                    <span style={{ fontWeight:700, fontSize:'.77rem', color:'var(--accent)' }}>{s.label}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {(stats?.patterns || []).length > 0 && (
              <div className="dc">
                <h3>Thinking Patterns</h3>
                <div className="pattern-grid" style={{ marginTop:4 }}>
                  {stats.patterns.map((p, i) => (
                    <div key={i} className="pattern-card">
                      <div className="pc-name">{p.pattern}</div>
                      <div className="pc-meta">
                        ×{p.frequency} occurrence{p.frequency !== 1 ? 's' : ''}
                        {p.lastSeen && ` · ${new Date(p.lastSeen).toLocaleDateString()}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Weak topics */}
          {(stats?.weakTopics || []).length > 0 && (
            <div className="dc">
              <h3>Focus Areas</h3>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                {stats.weakTopics.map((t, i) => (
                  <span key={i} className="tag tag-e" style={{ fontSize:'.81rem', padding:'5px 12px' }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
