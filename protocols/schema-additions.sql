-- ============================================================
-- Fly D1 Schema — 新增表（V1四表不动）
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
  event_id TEXT PRIMARY KEY,       -- aud_{uuid}
  request_id TEXT NOT NULL,        -- req_{uuid} 串联同次操作
  entity_type TEXT NOT NULL,       -- agent | action | verification | attribution | policy
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,            -- created | updated | deleted | status_changed | verified | confirmed | rejected
  actor_type TEXT NOT NULL,        -- user | agent | system
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  source TEXT NOT NULL,            -- dashboard | api | worker | cron | system
  reason TEXT NOT NULL,            -- manual_correction | verification_failed | fraud_detected | auto_upgrade
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
-- 老师4补刀：System拆到PrincipalType，Role只留4个
-- PrincipalType: human | agent | system（回答"你是谁"）
-- Role: owner | operator | verifier | auditor（回答"你能干什么"）
CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY,               -- ra_{uuid}
  principal_type TEXT NOT NULL,       -- human | agent | system
  principal_id TEXT NOT NULL,         -- usr_xxx | agt_xxx | sys_xxx
  role TEXT NOT NULL,                 -- owner | operator | verifier | auditor
  resource_type TEXT NOT NULL,        -- agent | verification | attribution | policy | system
  resource_id TEXT,                   -- 具体资源ID，空=全局
  granted_by TEXT NOT NULL,           -- 授予者principal_id
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_role_principal ON role_assignments(principal_type, principal_id);
CREATE INDEX IF NOT EXISTS idx_role_resource ON role_assignments(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_role_role ON role_assignments(role);

-- 补丁8：Governance — 策略（Default Deny：没规则=拒绝）
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,              -- pol_{uuid}
  name TEXT NOT NULL,
  description TEXT,
  rules TEXT NOT NULL,              -- JSON
  default_deny INTEGER NOT NULL DEFAULT 1,  -- 1=默认拒绝
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

-- 初始Owner角色（首次部署时授予）
INSERT OR IGNORE INTO role_assignments (id, principal_type, principal_id, role, resource_type, granted_by, created_at) VALUES (
  'ra_bootstrap_owner',
  'human',
  'usr_owner',
  'owner',
  'system',
  'sys_bootstrap',
  datetime('now')
);
