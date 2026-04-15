import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* SVG icon helpers — no emojis */
function Icon({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="nav-icon">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  workspace: 'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m8 0h3a2 2 0 002-2v-3M9 9h6M9 12h6M9 15h4',
  dashboard: 'M4 6h16M4 12h8m-8 6h16',
  profile:   'M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z',
  settings:  'M12 15a3 3 0 100-6 3 3 0 000 6zm7.07-4.24l1.22-.7a.5.5 0 00.18-.68l-2-3.46a.5.5 0 00-.68-.18l-1.22.7a7 7 0 00-1.21-.7V4.5a.5.5 0 00-.5-.5h-4a.5.5 0 00-.5.5v1.44A7 7 0 008.63 7.1l-1.22-.7a.5.5 0 00-.68.18l-2 3.46a.5.5 0 00.18.68l1.22.7a7 7 0 000 1.4l-1.22.7a.5.5 0 00-.18.68l2 3.46a.5.5 0 00.68.18l1.22-.7a7 7 0 001.21.7v1.44c0 .28.22.5.5.5h4a.5.5 0 00.5-.5v-1.44a7 7 0 001.21-.7l1.22.7a.5.5 0 00.68-.18l2-3.46a.5.5 0 00-.18-.68l-1.22-.7a7 7 0 000-1.4z',
  folder:    'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  chat:      'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  logout:    'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  pencil:    'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:     'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
};

/* Small icon-only action button */
function ActBtn({ d, onClick, danger, title }) {
  return (
    <button
      className={`sb-act-btn${danger ? ' danger' : ''}`}
      onClick={onClick}
      title={title}
      tabIndex={-1}
    >
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </button>
  );
}

export default function Sidebar({
  projects = [], chats = [],
  activeProject, activeChat,
  onSelectProject, onSelectChat, onNewProject, onNewChat,
  onRenameProject, onDeleteProject,
  onRenameChat,    onDeleteChat,
}) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [showNewProj, setShowNewProj] = useState(false);
  const [projName,    setProjName]    = useState('');

  /* Rename state for projects */
  const [editingProjId,  setEditingProjId]  = useState(null);
  const [editProjName,   setEditProjName]   = useState('');

  /* Rename state for chats */
  const [editingChatId,  setEditingChatId]  = useState(null);
  const [editChatTitle,  setEditChatTitle]  = useState('');

  const create = () => {
    if (projName.trim()) {
      onNewProject(projName.trim());
      setProjName('');
      setShowNewProj(false);
    }
  };

  const commitProjRename = (id) => {
    if (editProjName.trim() && onRenameProject) onRenameProject(id, editProjName.trim());
    setEditingProjId(null);
  };

  const commitChatRename = (projId, chatId) => {
    if (editChatTitle.trim() && onRenameChat) onRenameChat(projId, chatId, editChatTitle.trim());
    setEditingChatId(null);
  };

  return (
    <div className="sb">
      {/* Header */}
      <div className="sb-head">
        <div className="logo">W</div>
        <div>
          <h1>WHY Engine</h1>
          <span>Cognitive Code Analyzer</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="sb-nav">
        <button className={`nav-i ${loc.pathname === '/' ? 'on' : ''}`} onClick={() => nav('/')}>
          <Icon d={ICONS.workspace} />Workspace
        </button>
        <button className={`nav-i ${loc.pathname === '/dashboard' ? 'on' : ''}`} onClick={() => nav('/dashboard')}>
          <Icon d={ICONS.dashboard} />Dashboard
        </button>
        <button className={`nav-i ${loc.pathname === '/profile' ? 'on' : ''}`} onClick={() => nav('/profile')}>
          <Icon d={ICONS.profile} />Thinking Profile
        </button>
        <button className={`nav-i ${loc.pathname === '/settings' ? 'on' : ''}`} onClick={() => nav('/settings')}>
          <Icon d={ICONS.settings} />Settings
        </button>
      </div>

      {/* Projects section label */}
      <div className="sb-lbl">
        Projects
        <button
          className="btn-i"
          style={{ width: 22, height: 22, fontSize: '1rem' }}
          onClick={() => setShowNewProj(v => !v)}
          title="New project"
        >
          +
        </button>
      </div>

      {/* New project input */}
      {showNewProj && (
        <div className="sb-inp">
          <input
            value={projName}
            onChange={e => setProjName(e.target.value)}
            placeholder="Project name..."
            onKeyDown={e => {
              if (e.key === 'Enter') create();
              if (e.key === 'Escape') setShowNewProj(false);
            }}
            autoFocus
          />
          <button className="btn btn-p btn-sm" onClick={create}>Add</button>
          <button className="btn btn-g btn-sm" onClick={() => { setShowNewProj(false); setProjName(''); }}>
            &times;
          </button>
        </div>
      )}

      {/* Project + chat list */}
      <div className="sb-proj">
        {projects.length === 0 ? (
          <div style={{ padding: '22px 12px', color: 'var(--text-3)', fontSize: '.82rem', textAlign: 'center', lineHeight: 1.6 }}>
            No projects yet.<br />Click + to create one.
          </div>
        ) : (
          projects.map(p => (
            <div key={p._id}>
              {/* ── Project row ── */}
              {editingProjId === p._id ? (
                <div className="sb-inp" style={{ padding: '4px 8px 6px' }}>
                  <input
                    value={editProjName}
                    onChange={e => setEditProjName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitProjRename(p._id);
                      if (e.key === 'Escape') setEditingProjId(null);
                    }}
                    autoFocus
                  />
                  <button className="btn btn-p btn-sm" onClick={() => commitProjRename(p._id)}>OK</button>
                  <button className="btn btn-g btn-sm" onClick={() => setEditingProjId(null)}>&times;</button>
                </div>
              ) : (
                <div
                  className={`p-item ${activeProject?._id === p._id ? 'on' : ''}`}
                  onClick={() => onSelectProject(p)}
                >
                  <Icon d={ICONS.folder} size={14} />
                  <span className="sb-item-name">{p.name}</span>
                  <div className="sb-item-actions">
                    <ActBtn
                      d={ICONS.pencil}
                      title="Rename project"
                      onClick={e => {
                        e.stopPropagation();
                        setEditingProjId(p._id);
                        setEditProjName(p.name);
                      }}
                    />
                    <ActBtn
                      d={ICONS.trash}
                      title="Delete project"
                      danger
                      onClick={e => {
                        e.stopPropagation();
                        if (onDeleteProject) onDeleteProject(p._id);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ── Chat rows (only when project is active) ── */}
              {activeProject?._id === p._id && (
                <>
                  {chats.map(c => (
                    editingChatId === c._id ? (
                      <div key={c._id} className="sb-inp" style={{ padding: '3px 8px 5px 28px' }}>
                        <input
                          value={editChatTitle}
                          onChange={e => setEditChatTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitChatRename(p._id, c._id);
                            if (e.key === 'Escape') setEditingChatId(null);
                          }}
                          autoFocus
                        />
                        <button className="btn btn-p btn-sm" onClick={() => commitChatRename(p._id, c._id)}>OK</button>
                        <button className="btn btn-g btn-sm" onClick={() => setEditingChatId(null)}>&times;</button>
                      </div>
                    ) : (
                      <div
                        key={c._id}
                        className={`c-item ${activeChat?._id === c._id ? 'on' : ''}`}
                        onClick={() => onSelectChat(c)}
                      >
                        <span className="sb-item-name">{c.title}</span>
                        <div className="sb-item-actions">
                          <ActBtn
                            d={ICONS.pencil}
                            title="Rename analysis"
                            onClick={e => {
                              e.stopPropagation();
                              setEditingChatId(c._id);
                              setEditChatTitle(c.title);
                            }}
                          />
                          <ActBtn
                            d={ICONS.trash}
                            title="Delete analysis"
                            danger
                            onClick={e => {
                              e.stopPropagation();
                              if (onDeleteChat) onDeleteChat(p._id, c._id);
                            }}
                          />
                        </div>
                      </div>
                    )
                  ))}
                  <button className="new-c" onClick={onNewChat}>
                    + New Analysis
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="sb-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="avatar">
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <span style={{ fontSize: '.82rem', fontWeight: 600 }}>{user?.username}</span>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn-i" onClick={logout} title="Sign out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS.logout} />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
