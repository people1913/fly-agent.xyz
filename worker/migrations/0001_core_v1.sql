-- ============================================================
-- Fly D1 Migration 001: V1 Core Tables
-- 对应 protocols/schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  runtime TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  trust_score REAL NOT NULL DEFAULT 50.0,
  verification_level TEXT NOT NULL DEFAULT 'L0',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agents_provider ON agents(provider);
CREATE INDEX IF NOT EXISTS idx_agents_trust ON agents(trust_score);
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  user_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  short_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_actions_agent ON actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_actions_channel ON actions(channel);
CREATE INDEX IF NOT EXISTS idx_actions_signal ON actions(signal_type);
CREATE INDEX IF NOT EXISTS idx_actions_short ON actions(short_id);
CREATE INDEX IF NOT EXISTS idx_actions_user ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_created ON actions(created_at);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  verifier TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  confidence REAL NOT NULL DEFAULT 0.0,
  evidence TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (action_id) REFERENCES actions(id)
);

CREATE INDEX IF NOT EXISTS idx_verifications_action ON verifications(action_id);
CREATE INDEX IF NOT EXISTS idx_verifications_result ON verifications(result);
CREATE INDEX IF NOT EXISTS idx_verifications_created ON verifications(created_at);

CREATE TABLE IF NOT EXISTS attributions (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  lead_id TEXT,
  deal_id TEXT,
  commission REAL,
  attribution_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (action_id) REFERENCES actions(id)
);

CREATE INDEX IF NOT EXISTS idx_attributions_action ON attributions(action_id);
CREATE INDEX IF NOT EXISTS idx_attributions_status ON attributions(status);
CREATE INDEX IF NOT EXISTS idx_attributions_type ON attributions(attribution_type);
CREATE INDEX IF NOT EXISTS idx_attributions_lead ON attributions(lead_id);
CREATE INDEX IF NOT EXISTS idx_attributions_deal ON attributions(deal_id);

-- 初始系统Agent
INSERT OR IGNORE INTO agents (id, owner_id, provider, runtime, version, trust_score, verification_level)
VALUES ('agt_system', 'system', 'fly', 'fly-gateway', '1.0', 100.0, 'L4');
