/**
 * Fly Worker API — Layer 3: 接口标准
 * 
 * 基于 Hono 框架，跑在 Cloudflare Worker 上
 * 三组核心路由 + 短链路由
 * 
 * 铁律：不验不改 — 修改前必须看现状→描述现象→定位根因→才动手
 */

import { AgentIdentity, ActionSignal, VerificationRecord, AttributionRecord, SignalType, VerificationResult, AttributionType, AttributionStatus } from './core';
import { APIRequestAuth, TrustScoreFactors, VerificationContext, VerificationRules, VerifierType, detectBot, determineSignalQuality, SignalQuality, RATE_LIMIT, DefaultHumanScoreConfig, AuditEvent, ActorType, AuditAction, GovernanceRole, PrincipalType, Permission, RolePermissions, RoleAssignment, PolicyRule, DefaultPolicies, GOVERNANCE_DEFAULT_DENY, hasPermission, checkPolicy } from './security-governance';

// ============================================================
// 环境变量绑定
// ============================================================
export interface Env {
  FLY_D1: D1Database;          // Cloudflare D1
  FLY_KV: KVNamespace;         // 向后兼容，迁移完成后可移除
  IP_SALT: string;             // IP哈希盐值
  API_KEYS: string;            // 授权API Key列表（逗号分隔）
}

// ============================================================
// API 路由定义
// ============================================================

/**
 * POST /v1/action
 * 创建 Action Signal
 * 
 * 鉴权：Bearer token + HMAC签名（漏洞2修复）
 * Body: { agent_id, channel, user_id, signal_type, metadata? }
 * Response: { success: true, action_id: "act_xxx" }
 */
export async function createAction(c: any, env: Env): Promise<Response> {
  // === 漏洞2修复：API请求鉴权 ===
  const authResult = await verifyAPIAuth(c, env);
  if (!authResult.ok) {
    return Response.json({ error: authResult.error }, { status: 401 });
  }
  
  const body = await c.req.json();
  
  // === 漏洞3修复：user_id伪匿名增强 ===
  // 客户端传来的user_id明文，服务端用HMAC_SHA256加盐哈希后存库
  if (body.user_id) {
    body.user_id = await hmacUserId(body.user_id, env);
  }
  
  // 校验 signal_type
  const validTypes: SignalType[] = ["impression", "click", "consult", "booking", "deal"];
  if (!validTypes.includes(body.signal_type)) {
    return Response.json({ error: "invalid signal_type" }, { status: 400 });
  }
  
  // 校验 channel
  const validChannels = ["douyin", "xiaohongshu", "wechat", "meituan", "feishu", "geo", "direct"];
  if (!validChannels.includes(body.channel)) {
    return Response.json({ error: "invalid channel" }, { status: 400 });
  }
  
  // 数据铁律：检查 metadata 中是否有禁用字段
  if (body.metadata) {
    const forbidden = ["phone", "name", "id_card", "address", "bank_card"];
    const keys = Object.keys(body.metadata);
    const violation = keys.find(k => forbidden.includes(k));
    if (violation) {
      return Response.json({ error: `forbidden field: ${violation}` }, { status: 400 });
    }
  }
  
  // 24h去重：同一user_id + 同一action去重
  const dedupKey = `dedup:${body.user_id}:${body.agent_id}:${body.channel}`;
  const existing = await env.FLY_D1.prepare(
    "SELECT id FROM actions WHERE user_id = ? AND agent_id = ? AND channel = ? AND signal_type = ? AND created_at > datetime('now', '-24 hours') LIMIT 1"
  ).bind(body.user_id, body.agent_id, body.channel, body.signal_type).first();
  
  if (existing) {
    return Response.json({ success: true, action_id: existing.id, dedup: true });
  }
  
  const actionId = `act_${crypto.randomUUID()}`;
  
  // 漏洞6条件1：所有事件都能有signal_quality（signal_type与signal_quality正交）
  const metadata = body.metadata ? JSON.parse(JSON.stringify(body.metadata)) : {};
  metadata.signal_quality = body.signal_quality || "raw";  // 默认raw，API调用方可传verified
  metadata.human_score = body.human_score || 0;
  
  await env.FLY_D1.prepare(
    "INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  ).bind(
    actionId, body.agent_id, body.channel, body.user_id, body.signal_type,
    body.short_id || null, JSON.stringify(metadata)
  ).run();
  
  return Response.json({ success: true, action_id, signal_quality: metadata.signal_quality });
}

/**
 * GET /v1/status/:actionId
 * 查询 Action 状态（含验证和归因）
 */
export async function queryAction(c: any, env: Env): Promise<Response> {
  const actionId = c.req.param("actionId");
  
  const action = await env.FLY_D1.prepare(
    "SELECT * FROM actions WHERE id = ?"
  ).bind(actionId).first();
  
  if (!action) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  
  // 查关联验证
  const verifications = await env.FLY_D1.prepare(
    "SELECT * FROM verifications WHERE action_id = ? ORDER BY created_at DESC"
  ).bind(actionId).all();
  
  // 查关联归因
  const attributions = await env.FLY_D1.prepare(
    "SELECT * FROM attributions WHERE action_id = ? ORDER BY created_at DESC"
  ).bind(actionId).all();
  
  return Response.json({
    action,
    verifications: verifications.results,
    attributions: attributions.results,
  });
}

/**
 * GET /s/:actionId
 * 短链跳转（营销入口）
 * 漏洞6修复：Bot检测 + 信号质量分层 + IP限流
 */
export async function shortLinkRedirect(c: any, env: Env): Promise<Response> {
  const actionId = c.req.param("actionId");
  const clientIP = (c.req.header('CF-Connecting-IP') || 'unknown').slice(0, 40);
  const userAgent = c.req.header('User-Agent') || '';

  // === 漏洞6修复层1：IP限流（同IP 1分钟最多10次）===
  const rateLimitKey = `ratelimit:${clientIP}`;
  const currentCount = await env.FLY_KV.get(rateLimitKey);
  if (currentCount && parseInt(currentCount) >= RATE_LIMIT.maxRequests) {
    return Response.redirect('https://fly-agent.xyz', 302); // 静默拒绝，不暴露
  }
  const newCount = (parseInt(currentCount || '0') + 1).toString();
  await env.FLY_KV.put(rateLimitKey, newCount, { expirationTtl: RATE_LIMIT.windowSeconds });

  // === 漏洞6修复层2：Bot检测 ===
  const botResult = detectBot(userAgent);

  // === 漏洞6修复层3：信号质量判定 ===
  // 短链跳转阶段只有初始数据，没有cookie/JS/停留时间，所以human_score=0
  // bot → signal_quality="bot"
  // 非bot → signal_quality="raw"（后续可通过JS回调升级为verified）
  const signalQuality: SignalQuality = determineSignalQuality(0, botResult.isBot);

  // 查找 action
  const action = await env.FLY_D1.prepare(
    "SELECT * FROM actions WHERE id = ? OR short_id = ?"
  ).bind(actionId, actionId).first();
  
  // 记录点击信号（signal_type保持"click"不变，signal_quality写入metadata）
  const ip_hash = await hmacUserId(clientIP, env);
  
  await env.FLY_D1.prepare(
    "INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, 'click', ?, ?, datetime('now'))"
  ).bind(
    `act_${crypto.randomUUID()}`, action?.agent_id || 'agt_system',
    action?.channel || 'direct', ip_hash,
    actionId,
    JSON.stringify({ 
      referrer: c.req.header('Referer') || '', 
      ua: userAgent.slice(0, 200),
      signal_quality: signalQuality,        // 新增：信号质量
      bot_name: botResult.botName || null,  // 新增：bot名称
      human_score: 0,                       // 新增：初始0，JS回调可升级
    })
  ).run();
  
  // 302跳转
  const targetUrl = 'https://fly-agent.xyz';
  return Response.redirect(targetUrl, 302);
}

// ============================================================
// 漏洞6修复：信号质量升级API（JS回调）
// ============================================================

/**
 * POST /v1/signal/verify
 * 前端JS回调，升级信号质量 raw → verified
 * 
 * Body: { action_id, has_cookie, js_executed, stay_seconds }
 * Response: { signal_quality, human_score }
 */
export async function verifySignalQuality(c: any, env: Env): Promise<Response> {
  const body = await c.req.json();

  // 查action
  const action = await env.FLY_D1.prepare(
    "SELECT * FROM actions WHERE id = ?"
  ).bind(body.action_id).first();

  if (!action) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // 计算human_score
  let humanScore = 0;
  if (body.has_cookie) humanScore += 20;
  if (body.js_executed) humanScore += 30;
  if (body.stay_seconds >= 3) humanScore += 20;
  // 后续事件由createAction的signal_type=consult/booking/deal触发，这里不处理

  const newQuality = determineSignalQuality(humanScore, false);

  // 更新metadata里的signal_quality和human_score
  const oldMetadata = JSON.parse((action.metadata as string) || '{}');
  const newMetadata = {
    ...oldMetadata,
    signal_quality: newQuality,
    human_score: humanScore,
  };

  await env.FLY_D1.prepare(
    "UPDATE actions SET metadata = ? WHERE id = ?"
  ).bind(JSON.stringify(newMetadata), body.action_id).run();

  return Response.json({
    action_id: body.action_id,
    signal_quality: newQuality,
    human_score: humanScore,
  });
}

// ============================================================
// Agent Registry API
// ============================================================

/**
 * POST /v1/agents/register
 * 注册 Agent
 * Body: { provider, runtime, version, owner_id }
 * Response: { agent_id, trust_score: 50, verification_level: "L0" }
 */
export async function registerAgent(c: any, env: Env): Promise<Response> {
  const body = await c.req.json();
  
  const agentId = `agt_${crypto.randomUUID()}`;
  
  await env.FLY_D1.prepare(
    "INSERT INTO agents (id, owner_id, provider, runtime, version, trust_score, verification_level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 50.0, 'L0', datetime('now'), datetime('now'))"
  ).bind(agentId, body.owner_id, body.provider, body.runtime, body.version || '1.0').run();
  
  return Response.json({
    agent_id: agentId,
    trust_score: 50,
    verification_level: "L0",
  });
}

/**
 * GET /v1/agents/:agentId
 * 查询 Agent 信息
 */
export async function queryAgent(c: any, env: Env): Promise<Response> {
  const agentId = c.req.param("agentId");
  
  const agent = await env.FLY_D1.prepare(
    "SELECT * FROM agents WHERE id = ?"
  ).bind(agentId).first();
  
  if (!agent) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  
  return Response.json(agent);
}

// ============================================================
// 漏洞4修复：Trust Score 多维计算（防刷分）
// ============================================================

/**
 * POST /v1/agents/:agentId/recalc-trust
 * 重新计算 Agent 的 Trust Score
 * 
 * 多维因子：独立用户数 / 时间跨度 / 渠道跨度 / 验证来源 / 归因准确率
 * 基础分50，每项加分有上限，总分0-100
 */
export async function recalcTrustScore(c: any, env: Env): Promise<Response> {
  const agentId = c.req.param("agentId");

  // 1. 查该Agent的action统计
  const stats = await env.FLY_D1.prepare(`
    SELECT 
      COUNT(DISTINCT user_id) as unique_users,
      MIN(created_at) as first_action,
      MAX(created_at) as last_action,
      COUNT(DISTINCT channel) as channel_diversity
    FROM actions WHERE agent_id = ?
  `).bind(agentId).first();

  // 2. 查验证来源数
  const verifyStats = await env.FLY_D1.prepare(`
    SELECT COUNT(DISTINCT verifier) as verification_sources
    FROM verifications v
    JOIN actions a ON v.action_id = a.id
    WHERE a.agent_id = ? AND v.result = 'verified'
  `).bind(agentId).first();

  // 3. 查归因准确率（confirmed / total）
  const attrStats = await env.FLY_D1.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed
    FROM attributions attr
    JOIN actions a ON attr.action_id = a.id
    WHERE a.agent_id = ?
  `).bind(agentId).first();

  // 4. 组装多维因子
  const factors: TrustScoreFactors = {
    agent_id: agentId,
    unique_users: (stats?.unique_users as number) || 0,
    time_span_days: calcDays(stats?.first_action as string, stats?.last_action as string),
    channel_diversity: (stats?.channel_diversity as number) || 0,
    verification_sources: (verifyStats?.verification_sources as number) || 0,
    attribution_accuracy: calcAccuracy(attrStats?.total as number, attrStats?.confirmed as number),
    calculated_score: 0,
  };

  // 5. 计算最终分数（基础分50，各因子加分有上限）
  let score = 50;
  score += Math.min(20, Math.floor(factors.unique_users / 10) * 5);      // 独立用户：每10人+5，上限+20
  score += Math.min(10, Math.floor(factors.time_span_days / 7) * 2);    // 时间跨度：每7天+2，上限+10
  score += Math.min(9, (Math.max(0, factors.channel_diversity - 1)) * 3); // 渠道跨度：每多1渠道+3，上限+9
  score += Math.min(8, factors.verification_sources * 4);                // 验证来源：每多1来源+4，上限+8
  score += Math.min(3, Math.floor(factors.attribution_accuracy * 3));    // 归因准确率：准确率*3，上限+3

  factors.calculated_score = Math.min(100, Math.max(0, score));

  // 6. 写回agents表的trust_score字段
  await env.FLY_D1.prepare(
    "UPDATE agents SET trust_score = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(factors.calculated_score, agentId).run();

  return Response.json(factors);
}

function calcDays(first: string | null, last: string | null): number {
  if (!first || !last) return 0;
  const ms = new Date(last).getTime() - new Date(first).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function calcAccuracy(total: number | null, confirmed: number | null): number {
  if (!total || total === 0) return 0;
  return (confirmed || 0) / total;
}

// ============================================================
// 漏洞5修复：Verification 三方分离 + 5条铁律
// ============================================================

/**
 * POST /v1/verifications
 * 创建验证记录（强制三方分离 + 规则约束）
 * 
 * Body: { action_id, issuer, subject, verifier, verifier_id, verifier_type, result, confidence, evidence[] }
 * Response: { verification_id, passed_rules: string[] }
 */
export async function createVerification(c: any, env: Env): Promise<Response> {
  const body = await c.req.json();
  const failedRules: string[] = [];

  // 规则1: verifier ≠ subject（防自证）
  if (!VerificationRules.canVerify(body.subject, body.verifier)) {
    return Response.json({ error: "verifier cannot equal subject (self-verification)" }, { status: 400 });
  }

  // 规则2: verifier_id必须非空（老师5.2: 防假审计员）
  if (!VerificationRules.hasVerifierId(body.verifier_id)) {
    return Response.json({ error: "verifier_id is required" }, { status: 400 });
  }

  // 规则3: verified必须附带evidence（老师5.3）
  if (body.result === "verified" && !VerificationRules.hasEvidence(body.evidence || [])) {
    return Response.json({ error: "verified result requires at least 1 evidence" }, { status: 400 });
  }

  // 规则2补充: verifier_id必须存在于role_assignments表
  const roleExists = await env.FLY_D1.prepare(
    "SELECT id FROM role_assignments WHERE id = ? AND role = ? LIMIT 1"
  ).bind(body.verifier_id, body.verifier_type === "audit" ? "auditor" : body.verifier_type).first();
  
  if (!roleExists) {
    return Response.json({ error: `verifier_id ${body.verifier_id} not authorized as ${body.verifier_type}` }, { status: 403 });
  }

  // 规则4: L2+升级检查（查subject当前等级）
  const agent = await env.FLY_D1.prepare(
    "SELECT verification_level FROM agents WHERE id = ?"
  ).bind(body.subject).first();
  
  const currentLevel = (agent?.verification_level as string) || "L0";
  const isL2Plus = ["L2", "L3", "L4"].includes(currentLevel);
  
  if (isL2Plus && !VerificationRules.canUpgradeToL2(body.verifier_type)) {
    return Response.json({ 
      error: `L2+ requires audit or external verifier, got ${body.verifier_type}` 
    }, { status: 400 });
  }

  // 规则5: 互刷检测（查最近互相验证次数）
  const mutualCount = await env.FLY_D1.prepare(`
    SELECT COUNT(*) as cnt FROM verifications v
    JOIN actions a ON v.action_id = a.id
    WHERE a.agent_id = ? AND v.verifier = ? AND v.created_at > datetime('now', '-7 days')
  `).bind(body.subject, body.issuer).first();
  
  if ((mutualCount?.cnt as number) >= VerificationRules.MUTUAL_VERIFY_THRESHOLD) {
    // 降权：trust_score -10
    await env.FLY_D1.prepare(
      "UPDATE agents SET trust_score = MAX(0, trust_score - 10) WHERE id = ?"
    ).bind(body.issuer).run();
    
    return Response.json({ 
      error: `mutual verification detected (>${VerificationRules.MUTUAL_VERIFY_THRESHOLD} times), trust score penalized` 
    }, { status: 429 });
  }

  // 全部通过，写入verifications表
  const verificationId = `vrf_${crypto.randomUUID()}`;
  await env.FLY_D1.prepare(
    "INSERT INTO verifications (id, action_id, verifier, result, confidence, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  ).bind(verificationId, body.action_id, body.verifier, body.result, body.confidence).run();

  return Response.json({
    verification_id: verificationId,
    rules_passed: [
      "verifier ≠ subject",
      "verifier_id authorized",
      "evidence required",
      isL2Plus ? "L2+ verifier_type check" : "L0-L1 no extra check",
      "mutual verify check",
    ],
  });
}

// ============================================================
// 漏洞7修复：Audit Ledger — 审计写入 + 查询
// 状态: FROZEN
// ============================================================

/**
 * 写入审计事件（内部函数，所有数据变更都应调用）
 */
export async function writeAuditEvent(env: Env, event: {
  request_id: string
  entity_type: string
  entity_id: string
  action: AuditAction
  actor_type: ActorType
  actor_id: string
  actor_name: string
  source: string
  reason: string
  before: string
  after: string
}): Promise<string> {
  const eventId = `aud_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  // 查前一条审计记录的event_hash
  const prevEvent = await env.FLY_D1.prepare(
    "SELECT event_hash FROM audit_events ORDER BY created_at DESC LIMIT 1"
  ).first();
  const prevHash = (prevEvent?.event_hash as string) || '0';

  // 计算当前event_hash: SHA256(prev_hash + event_id + entity_type + entity_id + action + actor_id + timestamp)
  const hashInput = `${prevHash}${eventId}${event.entity_type}${event.entity_id}${event.action}${event.actor_id}${timestamp}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
  const eventHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  await env.FLY_D1.prepare(
    `INSERT INTO audit_events (event_id, request_id, entity_type, entity_id, action, actor_type, actor_id, actor_name, source, reason, before_data, after_data, prev_hash, event_hash, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(eventId, event.request_id, event.entity_type, event.entity_id, event.action, event.actor_type, event.actor_id, event.actor_name, event.source, event.reason, event.before, event.after, prevHash, eventHash).run();

  return eventId;
}

/**
 * GET /v1/audit/:entityType/:entityId
 * 查询某实体的完整审计链
 */
export async function queryAuditChain(c: any, env: Env): Promise<Response> {
  const entityType = c.req.param("entityType");
  const entityId = c.req.param("entityId");

  const events = await env.FLY_D1.prepare(
    "SELECT * FROM audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC"
  ).bind(entityType, entityId).all();

  // 验证hash链完整性
  let chainValid = true;
  let prevHash = '0';
  for (const evt of events.results as any[]) {
    const hashInput = `${prevHash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
    const expected = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (evt.event_hash !== expected) {
      chainValid = false;
      break;
    }
    prevHash = evt.event_hash;
  }

  return Response.json({
    entity_type: entityType,
    entity_id: entityId,
    events: events.results,
    chain_valid: chainValid,
    total_events: events.results.length,
  });
}

export interface RuntimeAdapter {
  registerAgent(env: Env, config: { provider: string; runtime: string; version: string; owner_id: string }): Promise<{ agent_id: string }>;
  createAction(env: Env, signal: Omit<ActionSignal, 'action_id' | 'timestamp'>): Promise<{ action_id: string }>;
  verifyAction(env: Env, actionId: string, result: VerificationResult, confidence: number): Promise<{ verification_id: string }>;
  queryAction(env: Env, actionId: string): Promise<any>;
}

// ============================================================
// 漏洞8修复：Governance API — 角色授权 + 权限检查 + 策略管理
// 老师4补刀：Principal/Role/Permission三层分离 + Default Deny + Audit集成
// ============================================================

/**
 * POST /v1/governance/assign-role
 * 授予角色（仅owner可操作，变更写入Audit Ledger）
 */
export async function assignRole(c: any, env: Env): Promise<Response> {
  const authResult = await verifyAPIAuth(c, env);
  if (!authResult.ok) return Response.json({ error: authResult.error }, { status: 401 });

  const body = await c.req.json();

  // 只有owner能assign_role
  const callerRoles = await getPrincipalRoles(env, "human", body.caller_id || "usr_owner");
  if (!callerRoles.includes("owner")) {
    return Response.json({ error: "only owner can assign roles" }, { status: 403 });
  }

  const validRoles: GovernanceRole[] = ["owner", "operator", "verifier", "auditor"];
  const validTypes: PrincipalType[] = ["human", "agent", "system"];
  if (!validRoles.includes(body.role)) return Response.json({ error: "invalid role" }, { status: 400 });
  if (!validTypes.includes(body.principal_type)) return Response.json({ error: "invalid principal_type" }, { status: 400 });

  const existing = await env.FLY_D1.prepare(
    "SELECT id FROM role_assignments WHERE principal_type = ? AND principal_id = ? AND role = ? AND resource_type = ?"
  ).bind(body.principal_type, body.principal_id, body.role, body.resource_type).first();

  if (existing) return Response.json({ error: "role already assigned" }, { status: 409 });

  const assignmentId = `ra_${crypto.randomUUID()}`;
  const requestId = `req_${crypto.randomUUID()}`;

  await env.FLY_D1.prepare(
    "INSERT INTO role_assignments (id, principal_type, principal_id, role, resource_type, resource_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  ).bind(assignmentId, body.principal_type, body.principal_id, body.role, body.resource_type, body.resource_id || null, body.caller_id || "usr_owner").run();

  // Audit集成：角色变更写入Audit Ledger
  await writeAuditEvent(env, {
    request_id: requestId,
    entity_type: "role_assignment",
    entity_id: assignmentId,
    action: "created",
    actor_type: "user",
    actor_id: body.caller_id || "usr_owner",
    actor_name: body.caller_name || "owner",
    source: "api",
    reason: "role_assigned",
    before: "{}",
    after: JSON.stringify({ principal_type: body.principal_type, principal_id: body.principal_id, role: body.role }),
  });

  return Response.json({
    assignment_id: assignmentId,
    principal_type: body.principal_type,
    principal_id: body.principal_id,
    role: body.role,
    permissions: RolePermissions[body.role as GovernanceRole],
  });
}

/**
 * POST /v1/governance/check-permission
 * 检查权限（Default Deny：没规则=拒绝）
 */
export async function checkPermission(c: any, env: Env): Promise<Response> {
  const body = await c.req.json();
  const roles = await getPrincipalRoles(env, body.principal_type, body.principal_id);

  if (roles.length === 0) {
    return Response.json({ allowed: false, reason: "no roles assigned (default deny)" }, { status: 403 });
  }

  const permission = body.permission as Permission;
  const matchingRoles = roles.filter(r => hasPermission(r, permission));

  if (matchingRoles.length === 0) {
    return Response.json({ allowed: false, reason: `no role grants permission: ${permission}`, roles }, { status: 403 });
  }

  let policyMatch = true;
  if (body.resource) policyMatch = checkPolicy(body.resource, roles);

  return Response.json({ allowed: matchingRoles.length > 0 && policyMatch, roles, matching_roles: matchingRoles, permission, policy_match: policyMatch });
}

/**
 * POST /v1/governance/update-policy
 * 更新治理策略（仅owner可操作，变更写入Audit Ledger）
 */
export async function updatePolicy(c: any, env: Env): Promise<Response> {
  const authResult = await verifyAPIAuth(c, env);
  if (!authResult.ok) return Response.json({ error: authResult.error }, { status: 401 });

  const body = await c.req.json();
  const callerRoles = await getPrincipalRoles(env, "human", body.caller_id || "usr_owner");
  if (!callerRoles.includes("owner")) return Response.json({ error: "only owner can update policies" }, { status: 403 });

  const oldPolicy = await env.FLY_D1.prepare("SELECT * FROM policies WHERE id = ?").bind(body.policy_id).first();
  if (!oldPolicy) return Response.json({ error: "policy not found" }, { status: 404 });

  const newRules = body.rules || JSON.parse(oldPolicy.rules as string);
  await env.FLY_D1.prepare(
    "UPDATE policies SET name = ?, description = ?, rules = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(body.name || oldPolicy.name, body.description || oldPolicy.description, JSON.stringify(newRules), body.policy_id).run();

  // Audit集成：策略变更写入Audit Ledger
  await writeAuditEvent(env, {
    request_id: `req_${crypto.randomUUID()}`,
    entity_type: "policy",
    entity_id: body.policy_id,
    action: "updated",
    actor_type: "user",
    actor_id: body.caller_id || "usr_owner",
    actor_name: body.caller_name || "owner",
    source: "api",
    reason: "policy_updated",
    before: oldPolicy.rules as string,
    after: JSON.stringify(newRules),
  });

  return Response.json({ policy_id: body.policy_id, updated: true });
}

// --- 内部函数：查主体的所有角色 ---
async function getPrincipalRoles(env: Env, principalType: string, principalId: string): Promise<GovernanceRole[]> {
  const results = await env.FLY_D1.prepare(
    "SELECT DISTINCT role FROM role_assignments WHERE principal_type = ? AND principal_id = ?"
  ).bind(principalType, principalId).all();
  return (results.results as any[]).map(r => r.role as GovernanceRole);
}

// ============================================================
// 工具函数
// ============================================================

async function hashIP(ip: string, env: Env): Promise<string> {
  const salt = env.IP_SALT || 'fly-attribution-salt-2026';
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// 漏洞3修复：user_id HMAC伪匿名
// 旧数据: sha256(plaintext) → 前缀 sha256_
// 新数据: HMAC_SHA256(plaintext, server_salt) → 前缀 hmac_
// ============================================================
async function hmacUserId(plainUserId: string, env: Env): Promise<string> {
  const salt = env.IP_SALT || 'fly-attribution-salt-2026';
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(plainUserId));
  const hashArray = Array.from(new Uint8Array(sigBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `hmac_${hash}`;
}

// ============================================================
// 漏洞2修复：API请求鉴权（Bearer + HMAC）
// ============================================================
async function verifyAPIAuth(c: any, env: Env): Promise<{ ok: boolean; error?: string }> {
  // 1. Bearer Token 校验
  const authHeader = c.req.header('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, error: 'missing Authorization header' };
  }
  const token = authHeader.slice(7);
  const validKeys = (env.API_KEYS || '').split(',').map((k: string) => k.trim()).filter(Boolean);
  if (!validKeys.includes(token)) {
    return { ok: false, error: 'invalid API key' };
  }

  // 2. HMAC 签名校验
  const signature = c.req.header('X-Fly-Signature') || '';
  const timestamp = c.req.header('X-Fly-Timestamp') || '';
  if (!signature || !timestamp) {
    return { ok: false, error: 'missing signature or timestamp' };
  }

  // 3. 时间窗口防重放（5分钟）
  const now = Date.now();
  const reqTime = parseInt(timestamp, 10);
  if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
    return { ok: false, error: 'request expired' };
  }

  // 4. HMAC-SHA256 验证
  const body = await c.req.text();
  const message = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const expectedSig = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (signature !== expectedSig) {
    return { ok: false, error: 'invalid signature' };
  }

  return { ok: true };
}
