-- ============================================================
-- Fly D1 Migration 002: V2 Security & Governance Tables
-- 对应 protocols/schema-additions.sql
-- 漏洞1-8全部补丁
-- ============================================================

-- 补丁1：Agent 身份验证
CREATE TABLE IF NOT EXISTS agent_auth (
  agent_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  signature TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- 补丁7：审计事件链（FROZEN）
CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_data TEXT,
  after_data TEXT,
  prev_hash TEXT NOT NULL DEFAULT '0',
  event_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_events(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);

-- 补丁8：Governance — 角色授权
CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  granted_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_role_principal ON role_assignments(principal_type, principal_id);
CREATE INDEX IF NOT EXISTS idx_role_resource ON role_assignments(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_role_role ON role_assignments(role);

-- 补丁8：Governance — 策略（Default Deny）
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rules TEXT NOT NULL,
  default_deny INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO policies (id, name, description, rules, default_deny) VALUES (
  'pol_default',
  'Default Governance Policy',
  'Fly默认治理策略 — 没有规则匹配=拒绝',
  '[{"resource":"deal.confirm","require":["verifier","auditor"]},{"resource":"attribution.update","require":["owner","auditor"]},{"resource":"agent.register","require":["operator"]},{"resource":"policy.update","require":["owner"]},{"resource":"policy.assign_role","require":["owner"]},{"resource":"data.delete","require":["owner","auditor"]},{"resource":"trust.recalculate","require":["owner","auditor"]}]',
  1
);

-- 初始Owner角色
INSERT OR IGNORE INTO role_assignments (id, principal_type, principal_id, role, resource_type, granted_by, created_at) VALUES (
  'ra_bootstrap_owner',
  'human',
  'usr_owner',
  'owner',
  'system',
  'sys_bootstrap',
  datetime('now')
);
