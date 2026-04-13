-- ============================================
-- WHY ENGINE — SUPABASE SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  thinking_profile JSONB DEFAULT '{
    "totalAnalyses": 0,
    "totalSuccessful": 0,
    "errorDistribution": {
      "edgeCaseMiss": 0, "logicError": 0, "syntaxError": 0,
      "optimizationMiss": 0, "boundaryError": 0, "offByOne": 0,
      "wrongApproach": 0, "incompleteSolution": 0,
      "typeError": 0, "concurrencyError": 0
    },
    "accuracyHistory": [],
    "weakTopics": [],
    "cognitiveTimeline": [],
    "patterns": [],
    "currentStreak": 0,
    "longestStreak": 0,
    "lastActiveDate": null
  }',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT DEFAULT '',
  language      TEXT DEFAULT 'python',
  chat_count    INT DEFAULT 0,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  project_id     UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title          TEXT DEFAULT 'Untitled Analysis',
  entries        JSONB DEFAULT '[]',
  total_attempts INT DEFAULT 0,
  status         TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'solved', 'abandoned')),
  tags           JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id    ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_user_id       ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_project_id    ON chats(project_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at    ON chats(updated_at DESC);
