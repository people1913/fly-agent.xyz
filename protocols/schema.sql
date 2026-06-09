-- ============================================================
-- Fly D1 Schema — Layer 2: 数据库
-- 基于 Cloudflare D1 (SQLite)
-- 四张核心表，对应四个协议
-- ============================================================

-- 1. agents — Agent 身份
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,              -- agt_{uuid}
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL,           -- claude | codex | cursor | dify | coze | custom
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

-- 2. actions — Action Signal（信号）
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,              -- act_{uuid}
  agent_id TEXT NOT NULL,
  channel TEXT NOT NULL,            -- douyin | xiaohongshu | wechat | meituan | feishu | geo | direct
  user_id TEXT NOT NULL,            -- sha256脱敏ID
  signal_type TEXT NOT NULL,        -- impression | click | consult | booking | deal
  short_id TEXT,                    -- FLY-HY-001 营销短链ID（可选）
  metadata TEXT,                    -- JSON扩展字段
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_actions_agent ON actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_actions_channel ON actions(channel);
CREATE INDEX IF NOT EXISTS idx_actions_signal ON actions(signal_type);
CREATE INDEX IF NOT EXISTS idx_actions_short ON actions(short_id);
CREATE INDEX IF NOT EXISTS idx_actions_user ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_created ON actions(created_at);

-- 3. verifications — Verification Record（验证）
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,              -- vrf_{uuid}
  action_id TEXT NOT NULL,
  verifier TEXT NOT NULL,           -- system | human | api | audit
  result TEXT NOT NULL DEFAULT 'pending',  -- pending | verified | rejected
  confidence REAL NOT NULL DEFAULT 0.0,
  evidence TEXT,                    -- JSON数组，哈希引用
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (action_id) REFERENCES actions(id)
);

CREATE INDEX IF NOT EXISTS idx_verifications_action ON verifications(action_id);
CREATE INDEX IF NOT EXISTS idx_verifications_result ON verifications(result);
CREATE INDEX IF NOT EXISTS idx_verifications_created ON verifications(created_at);

-- 4. attributions — Attribution Record（归因）
CREATE TABLE IF NOT EXISTS attributions (
  id TEXT PRIMARY KEY,              -- att_{uuid}
  action_id TEXT NOT NULL,
  lead_id TEXT,
  deal_id TEXT,
  commission REAL,
  attribution_type TEXT NOT NULL,   -- deterministic | probabilistic | unattributed
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | paid
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (action_id) REFERENCES actions(id)
);

CREATE INDEX IF NOT EXISTS idx_attributions_action ON attributions(action_id);
CREATE INDEX IF NOT EXISTS idx_attributions_status ON attributions(status);
CREATE INDEX IF NOT EXISTS idx_attributions_type ON attributions(attribution_type);
CREATE INDEX IF NOT EXISTS idx_attributions_lead ON attributions(lead_id);
CREATE INDEX IF NOT EXISTS idx_attributions_deal ON attributions(deal_id);

-- ============================================================
-- 数据铁律约束
-- ============================================================
-- 90天自动过期（D1不支持event scheduler，由Worker层执行）
-- 24h去重由Worker层在写入时检查

-- 初始化：默认系统Agent
INSERT OR IGNORE INTO agents (id, owner_id, provider, runtime, version, trust_score, verification_level)
VALUES ('agt_system', 'system', 'fly', 'fly-gateway', '1.0', 100.0, 'L4');
