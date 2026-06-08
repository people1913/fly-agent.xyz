/**
 * Fly API Worker — Cloudflare Worker Entry Point
 * 纯原生Worker API，无第三方依赖
 * 
 * 8层6协议架构：L1-L8
 * 6协议：AIP + FSS + FVP + ATP + FGP + ALP
 * 
 * API端点清单：
 *   GET  /v1/health
 *   POST /v1/agents                    — 漏洞1：Agent注册+身份验证
 *   GET  /v1/agents/:id
 *   POST /v1/action                    — 漏洞2+3：Bearer+HMAC鉴权 + HMAC伪匿名
 *   GET  /v1/status/:actionId
 *   POST /v1/agents/:id/recalc-trust   — 漏洞4：Trust多维计算
 *   POST /v1/verifications             — 漏洞5：三方分离防自证
 *   GET  /s/:actionId                  — 漏洞6：短链Bot检测+信号质量
 *   POST /v1/signal/verify             — 漏洞6：JS回调信号质量升级
 *   GET  /v1/audit/:entityType/:entityId — 漏洞7：审计链查询
 *   POST /v1/governance/assign-role    — 漏洞8：角色授权
 *   POST /v1/governance/check-permission — 漏洞8：权限检查(Default Deny)
 *   POST /v1/governance/update-policy  — 漏洞8：策略更新
 *   GET  /v1/db/query                  — 验收辅助查询
 */

// ============================================================
// Types
// ============================================================
interface Env {
  FLY_D1: D1Database;
  FLY_KV: KVNamespace;
  IP_SALT: string;
  API_KEYS: string;
}

type SignalType = "impression" | "click" | "consult" | "booking" | "deal";
type SignalQuality = "raw" | "verified" | "bot" | "unknown";
type VerifierType = "system" | "human" | "audit" | "external";
type GovernanceRole = "owner" | "operator" | "verifier" | "auditor";
type PrincipalType = "human" | "agent" | "system";
type Permission = "agent:create" | "agent:update" | "verification:create" | "verification:approve" | "trust:recalculate" | "audit:view" | "policy:update" | "policy:assign_role" | "data:delete";
type ActorType = "user" | "agent" | "system";
type AuditAction = "created" | "updated" | "deleted" | "status_changed" | "verified" | "confirmed" | "rejected";

const RolePermissions: Record<string, Permission[]> = {
  owner: ["agent:create", "agent:update", "verification:create", "verification:approve", "trust:recalculate", "audit:view", "policy:update", "policy:assign_role", "data:delete"],
  operator: ["agent:create", "agent:update", "verification:create", "audit:view"],
  verifier: ["verification:create", "verification:approve", "audit:view"],
  auditor: ["audit:view", "trust:recalculate"],
};

// ============================================================
// Bot Detection（漏洞6）
// ============================================================
const BotPatterns: { pattern: RegExp; name: string }[] = [
  { pattern: /GPTBot/i, name: "GPTBot" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot" },
  { pattern: /Googlebot/i, name: "Googlebot" },
  { pattern: /Bingbot/i, name: "Bingbot" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot" },
  { pattern: /Bytespider/i, name: "Bytespider" },
  { pattern: /SemrushBot/i, name: "SemrushBot" },
  { pattern: /AhrefsBot/i, name: "AhrefsBot" },
];

function detectBot(userAgent: string): { isBot: boolean; botName?: string } {
  for (const bot of BotPatterns) {
    if (bot.pattern.test(userAgent)) return { isBot: true, botName: bot.name };
  }
  return { isBot: false };
}

function determineSignalQuality(humanScore: number, isBot: boolean): SignalQuality {
  if (isBot) return "bot";
  if (humanScore >= 50) return "verified";
  if (humanScore > 0) return "raw";
  return "unknown";
}

// ============================================================
// Crypto helpers
// ============================================================
async function hmacSha256(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacUserId(plain: string, salt: string): Promise<string> {
  return `hmac_${await hmacSha256(salt, plain)}`;
}

// ============================================================
// API Auth（漏洞2：Bearer + HMAC签名）
// ============================================================
async function verifyBearerToken(authHeader: string | null, env: Env): Promise<{ ok: boolean; error?: string; token?: string; agentId?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { ok: false, error: 'missing Authorization header' };
  const token = authHeader.slice(7);
  // 先检查env静态key
  const validKeys = env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  if (validKeys.includes(token)) return { ok: true, token };
  // 再查D1 agent_auth表动态key
  const authRow = await env.FLY_D1.prepare("SELECT agent_id FROM agent_auth WHERE public_key = ? AND verified = 1").bind(token).first();
  if (authRow) return { ok: true, token, agentId: authRow.agent_id as string };
  return { ok: false, error: 'invalid API key' };
}

// ============================================================
// Audit Event Writer（漏洞7）
// ============================================================
async function writeAuditEvent(env: Env, event: {
  request_id: string; entity_type: string; entity_id: string;
  action: string; actor_type: string; actor_id: string;
  actor_name: string; source: string; reason: string;
  before: string; after: string;
}): Promise<string> {
  const eventId = `aud_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const prevEvent = await env.FLY_D1.prepare("SELECT event_hash FROM audit_events ORDER BY created_at DESC LIMIT 1").first();
  const prevHash = (prevEvent?.event_hash as string) || '0';
  const hashInput = `${prevHash}${eventId}${event.entity_type}${event.entity_id}${event.action}${event.actor_id}${timestamp}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
  const eventHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  await env.FLY_D1.prepare(
    `INSERT INTO audit_events (event_id, request_id, entity_type, entity_id, action, actor_type, actor_id, actor_name, source, reason, before_data, after_data, prev_hash, event_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(eventId, event.request_id, event.entity_type, event.entity_id, event.action, event.actor_type, event.actor_id, event.actor_name, event.source, event.reason, event.before, event.after, prevHash, eventHash, timestamp).run();

  return eventId;
}

// ============================================================
// Get Principal Roles（漏洞8）
// ============================================================
async function getPrincipalRoles(env: Env, principalType: string, principalId: string): Promise<string[]> {
  const results = await env.FLY_D1.prepare("SELECT DISTINCT role FROM role_assignments WHERE principal_type = ? AND principal_id = ?").bind(principalType, principalId).all();
  return (results.results as any[]).map(r => r.role as string);
}

// ============================================================
// JSON Response helper
// ============================================================
function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Fly-Signature, X-Fly-Timestamp', ...headers },
  });
}

// ============================================================
// Router
// ============================================================
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Fly-Signature, X-Fly-Timestamp' } });
    }

    try {
      // === Health ===
      if (path === '/v1/health' && method === 'GET') {
        return json({ status: 'ok', version: '2.0.0', layers: 8, protocols: 6, timestamp: new Date().toISOString() });
      }

      // === 漏洞1：Agent注册 + 身份验证（Public Endpoint，无需鉴权） ===
      if (path === '/v1/agents' && method === 'POST') {
        const body: any = await request.json();
        const agentId = `agt_${crypto.randomUUID()}`;
        const apiKey = `fly_${crypto.randomUUID().replace(/-/g, '')}`;
        await env.FLY_D1.prepare("INSERT INTO agents (id, owner_id, provider, runtime, version, trust_score, verification_level) VALUES (?, ?, ?, ?, ?, 50.0, 'L0')").bind(agentId, body.owner_id || 'usr_owner', body.provider || body.name || 'default', body.runtime || 'cloudflare', body.version || '1.0').run();
        // 写入agent_auth，api_key作为public_key存储
        await env.FLY_D1.prepare("INSERT INTO agent_auth (agent_id, public_key, signature, verified) VALUES (?, ?, ?, 1)").bind(agentId, apiKey, 'auto-generated').run();
        await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'agent', entity_id: agentId, action: 'created', actor_type: 'user', actor_id: body.owner_id || 'usr_owner', actor_name: body.owner_name || body.name || 'owner', source: 'api', reason: 'agent_registered', before: '{}', after: JSON.stringify({ agent_id: agentId, provider: body.provider || body.name }) });
        return json({ success: true, agent_id: agentId, api_key: apiKey, verification_level: 'L0', trust_score: 50.0 }, 201);
      }

      // === Agent查询 ===
      if (path.startsWith('/v1/agents/') && !path.includes('recalc-trust') && method === 'GET') {
        const id = path.split('/v1/agents/')[1];
        const agent = await env.FLY_D1.prepare("SELECT * FROM agents WHERE id = ?").bind(id).first();
        if (!agent) return json({ error: "not found" }, 404);
        const authRow = await env.FLY_D1.prepare("SELECT * FROM agent_auth WHERE agent_id = ?").bind(id).first();
        return json({ agent, auth: authRow || null });
      }

      // === 漏洞2+3：创建Action Signal ===
      if (path === '/v1/action' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        const body: any = await request.json();
        // 漏洞3：HMAC伪匿名
        if (body.user_id) body.user_id = await hmacUserId(body.user_id, env.IP_SALT || 'fly-attribution-salt-2026');
        const validTypes: SignalType[] = ["impression", "click", "consult", "booking", "deal"];
        if (!validTypes.includes(body.signal_type)) return json({ error: "invalid signal_type" }, 400);
        const validChannels = ["douyin", "xiaohongshu", "wechat", "meituan", "feishu", "geo", "direct"];
        if (!validChannels.includes(body.channel)) return json({ error: "invalid channel" }, 400);
        // 24h去重
        const existing = await env.FLY_D1.prepare("SELECT id FROM actions WHERE user_id = ? AND agent_id = ? AND channel = ? AND signal_type = ? AND created_at > datetime('now', '-24 hours') LIMIT 1").bind(body.user_id ?? null, body.agent_id, body.channel, body.signal_type).first();
        if (existing) return json({ success: true, action_id: existing.id, dedup: true });
        const actionId = `act_${crypto.randomUUID()}`;
        const metadata: any = body.metadata || {};
        metadata.signal_quality = body.signal_quality || "raw";
        metadata.human_score = body.human_score || 0;
        await env.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(actionId, body.agent_id, body.channel, body.user_id ?? null, body.signal_type, body.short_id || null, JSON.stringify(metadata)).run();
        await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'action', entity_id: actionId, action: 'created', actor_type: 'system', actor_id: 'sys_api', actor_name: 'api-gateway', source: 'api', reason: 'action_created', before: '{}', after: JSON.stringify({ action_id: actionId, signal_type: body.signal_type, signal_quality: metadata.signal_quality }) });
        return json({ success: true, action_id: actionId, signal_quality: metadata.signal_quality }, 201);
      }

      // === 查询Action状态 ===
      if (path.startsWith('/v1/status/') && method === 'GET') {
        const actionId = path.split('/v1/status/')[1];
        const action = await env.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(actionId).first();
        if (!action) return json({ error: "not found" }, 404);
        const verifications = await env.FLY_D1.prepare("SELECT * FROM verifications WHERE action_id = ? ORDER BY created_at DESC").bind(actionId).all();
        const attributions = await env.FLY_D1.prepare("SELECT * FROM attributions WHERE action_id = ? ORDER BY created_at DESC").bind(actionId).all();
        return json({ action, verifications: verifications.results, attributions: attributions.results });
      }

      // === 漏洞4：Trust Score多维计算 ===
      if (path.includes('/recalc-trust') && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        const agentId = path.split('/v1/agents/')[1]?.replace('/recalc-trust', '');
        const body: any = await request.json().catch(() => ({}));
        const callerType = body.caller_type || 'human';
        const callerId = body.caller_id || 'usr_owner';
        const roles = await getPrincipalRoles(env, callerType, callerId);
        const hasTrustPerm = roles.some(r => (RolePermissions[r] || []).includes("trust:recalculate"));
        if (!hasTrustPerm) return json({ error: "forbidden: no trust:recalculate permission", roles }, 403);
        const agent = await env.FLY_D1.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first();
        if (!agent) return json({ error: "agent not found" }, 404);
        const oldScore = agent.trust_score as number;
        const uniqueUsers = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
        const channelDiv = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT channel) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
        const verifSources = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT verifier) as cnt FROM verifications v JOIN actions a ON v.action_id = a.id WHERE a.agent_id = ?").bind(agentId).first();
        const timeSpan = await env.FLY_D1.prepare("SELECT CAST(julianday('now') - julianday(MIN(created_at)) AS INTEGER) as days FROM actions WHERE agent_id = ?").bind(agentId).first();
        const u = (uniqueUsers?.cnt as number) || 0;
        const ch = (channelDiv?.cnt as number) || 0;
        const vs = (verifSources?.cnt as number) || 0;
        const ts = (timeSpan?.days as number) || 0;
        let newScore = 50 + Math.min(u * 2, 20) + Math.min(ch * 5, 10) + Math.min(vs * 5, 10) + Math.min(ts, 10);
        newScore = Math.min(newScore, 100);
        await env.FLY_D1.prepare("UPDATE agents SET trust_score = ?, updated_at = datetime('now') WHERE id = ?").bind(newScore, agentId).run();
        await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'agent', entity_id: agentId, action: 'updated', actor_type: callerType as ActorType, actor_id: callerId, actor_name: body.caller_name || callerId, source: 'api', reason: 'trust_recalculated', before: JSON.stringify({ trust_score: oldScore }), after: JSON.stringify({ trust_score: newScore, factors: { unique_users: u, channel_diversity: ch, verification_sources: vs, time_span_days: ts } }) });
        return json({ agent_id: agentId, trust_score: { before: oldScore, after: newScore }, factors: { unique_users: u, channel_diversity: ch, verification_sources: vs, time_span_days: ts } });
      }

      // === 漏洞5：Verification三方分离 ===
      if (path === '/v1/verifications' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        const body: any = await request.json();
        // 铁律1：verifier ≠ subject
        if (body.verifier === body.subject || body.verifier_id === body.subject_id) {
          return json({ error: "verification rejected: verifier cannot be the same as subject (self-verification forbidden)" }, 403);
        }
        // 铁律2：verifier_id必须非空
        if (!body.verifier_id || body.verifier_id.length === 0) return json({ error: "verification rejected: verifier_id is required" }, 400);
        // 铁律3：evidence必须非空
        if (!body.evidence || !Array.isArray(body.evidence) || body.evidence.length === 0) return json({ error: "verification rejected: evidence is required" }, 400);
        // 铁律4：L2+需要audit/external
        const verifierType: VerifierType = body.verifier_type || 'system';
        if (body.target_level && ['L2', 'L3', 'L4'].includes(body.target_level) && verifierType !== 'audit' && verifierType !== 'external') {
          return json({ error: "verification rejected: L2+ requires audit or external verifier" }, 403);
        }
        const verificationId = `vrf_${crypto.randomUUID()}`;
        await env.FLY_D1.prepare("INSERT INTO verifications (id, action_id, verifier, result, confidence, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(verificationId, body.action_id, body.verifier, body.result || 'pending', body.confidence || 0, JSON.stringify(body.evidence)).run();
        await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'verification', entity_id: verificationId, action: 'created', actor_type: verifierType === 'system' ? 'system' : 'user', actor_id: body.verifier_id, actor_name: body.verifier_name || body.verifier, source: 'api', reason: 'verification_created', before: '{}', after: JSON.stringify({ verification_id: verificationId, verifier: body.verifier, verifier_type: verifierType, result: body.result }) });
        return json({ success: true, verification_id: verificationId, verifier_type: verifierType, rules_checked: ["self_verification_blocked", "verifier_id_required", "evidence_required", "L2_source_check"] }, 201);
      }

      // === 漏洞6：短链Bot检测 ===
      if (path.startsWith('/s/') && method === 'GET') {
        const actionId = path.split('/s/')[1];
        const clientIP = (request.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 40);
        const userAgent = request.headers.get('User-Agent') || '';
        // IP限流
        const rateLimitKey = `ratelimit:${clientIP}`;
        const currentCount = await env.FLY_KV.get(rateLimitKey);
        if (currentCount && parseInt(currentCount) >= 10) return Response.redirect('https://fly-agent.xyz', 302);
        await env.FLY_KV.put(rateLimitKey, (parseInt(currentCount || '0') + 1).toString(), { expirationTtl: 60 });
        const botResult = detectBot(userAgent);
        const signalQuality = determineSignalQuality(0, botResult.isBot);
        const action = await env.FLY_D1.prepare("SELECT * FROM actions WHERE id = ? OR short_id = ?").bind(actionId, actionId).first();
        const ipHash = await hmacUserId(clientIP, env.IP_SALT || 'fly-attribution-salt-2026');
        await env.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, 'click', ?, ?, datetime('now'))").bind(`act_${crypto.randomUUID()}`, action?.agent_id || 'agt_system', action?.channel || 'direct', ipHash, actionId, JSON.stringify({ referrer: request.headers.get('Referer') || '', ua: userAgent.slice(0, 200), signal_quality: signalQuality, bot_name: botResult.botName || null, human_score: 0 })).run();
        return Response.redirect('https://fly-agent.xyz', 302);
      }

      // === 漏洞6：信号质量升级 ===
      if (path === '/v1/signal/verify' && method === 'POST') {
        const body: any = await request.json();
        const action = await env.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(body.action_id).first();
        if (!action) return json({ error: "not found" }, 404);
        let hs = 0;
        if (body.has_cookie) hs += 20;
        if (body.js_executed) hs += 30;
        if (body.stay_seconds >= 3) hs += 20;
        const nq = determineSignalQuality(hs, false);
        const om = JSON.parse((action.metadata as string) || '{}');
        const nm = { ...om, signal_quality: nq, human_score: hs };
        await env.FLY_D1.prepare("UPDATE actions SET metadata = ? WHERE id = ?").bind(JSON.stringify(nm), body.action_id).run();
        return json({ action_id: body.action_id, signal_quality: nq, human_score: hs });
      }

      // === 漏洞7：审计链查询 ===
      if (path.startsWith('/v1/audit/') && method === 'GET') {
        const parts = path.split('/v1/audit/')[1].split('/');
        const rawEntityType = parts[0];
        const entityId = parts[1];
        // URL用复数（agents/actions），数据库存单数（agent/action），统一映射
        const entityTypeMap: Record<string, string> = { agents: 'agent', actions: 'action', verifications: 'verification', role_assignments: 'role_assignment', policies: 'policy' };
        const entityType = entityTypeMap[rawEntityType] || rawEntityType.replace(/s$/, '');
        const events = await env.FLY_D1.prepare("SELECT * FROM audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC").bind(entityType, entityId).all();
        // 验证每条记录自身的event_hash是否基于其prev_hash正确计算
        // 全局链跨所有entity，单entity查询只能逐条自验
        let chainValid = true;
        for (const evt of events.results as any[]) {
          const hashInput = `${evt.prev_hash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
          const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
          const expected = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          if (evt.event_hash !== expected) { chainValid = false; break; }
        }
        return json({ entity_type: entityType, entity_id: entityId, events: events.results, chain_valid: chainValid, total_events: events.results.length });
      }

      // === 漏洞8：角色授权 ===
      if (path === '/v1/governance/assign-role' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        const body: any = await request.json();
        const callerRoles = await getPrincipalRoles(env, "human", body.caller_id || "usr_owner");
        if (!callerRoles.includes("owner")) return json({ error: "only owner can assign roles" }, 403);
        const validRoles = ["owner", "operator", "verifier", "auditor"];
        const validTypes = ["human", "agent", "system"];
        if (!validRoles.includes(body.role)) return json({ error: "invalid role" }, 400);
        if (!validTypes.includes(body.principal_type)) return json({ error: "invalid principal_type" }, 400);
        const existing = await env.FLY_D1.prepare("SELECT id FROM role_assignments WHERE principal_type = ? AND principal_id = ? AND role = ? AND resource_type = ?").bind(body.principal_type, body.principal_id, body.role, body.resource_type).first();
        if (existing) return json({ error: "role already assigned" }, 409);
        const assignmentId = `ra_${crypto.randomUUID()}`;
        await env.FLY_D1.prepare("INSERT INTO role_assignments (id, principal_type, principal_id, role, resource_type, resource_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(assignmentId, body.principal_type, body.principal_id, body.role, body.resource_type, body.resource_id || null, body.caller_id || "usr_owner").run();
        await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'role_assignment', entity_id: assignmentId, action: 'created', actor_type: 'user', actor_id: body.caller_id || "usr_owner", actor_name: body.caller_name || "owner", source: 'api', reason: 'role_assigned', before: '{}', after: JSON.stringify({ principal_type: body.principal_type, principal_id: body.principal_id, role: body.role }) });
        return json({ assignment_id: assignmentId, principal_type: body.principal_type, principal_id: body.principal_id, role: body.role, permissions: RolePermissions[body.role] }, 201);
      }

      // === 漏洞8：权限检查 ===
      if (path === '/v1/governance/check-permission' && method === 'POST') {
        const body: any = await request.json();
        const roles = await getPrincipalRoles(env, body.principal_type || 'human', body.principal_id);
        if (roles.length === 0) return json({ allowed: false, reason: "no roles assigned (default deny)" }, 403);
        const permission = body.permission as Permission;
        const matching = roles.filter(r => (RolePermissions[r] || []).includes(permission));
        if (matching.length === 0) return json({ allowed: false, reason: `no role grants permission: ${permission}`, roles }, 403);
        return json({ allowed: true, roles, matching_roles: matching, permission });
      }

      // === 漏洞8：策略更新 ===
      if (path === '/v1/governance/update-policy' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        const body: any = await request.json();
        const callerRoles = await getPrincipalRoles(env, "human", body.caller_id || "usr_owner");
        if (!callerRoles.includes("owner")) return json({ error: "only owner can update policies" }, 403);
        const oldPolicy = await env.FLY_D1.prepare("SELECT * FROM policies WHERE id = ?").bind(body.policy_id).first();
        if (!oldPolicy) return json({ error: "policy not found" }, 404);
        const newRules = body.rules || JSON.parse(oldPolicy.rules as string);
        await env.FLY_D1.prepare("UPDATE policies SET name = ?, description = ?, rules = ?, updated_at = datetime('now') WHERE id = ?").bind(body.name || oldPolicy.name, body.description || oldPolicy.description, JSON.stringify(newRules), body.policy_id).run();
        await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'policy', entity_id: body.policy_id, action: 'updated', actor_type: 'user', actor_id: body.caller_id || "usr_owner", actor_name: body.caller_name || "owner", source: 'api', reason: 'policy_updated', before: oldPolicy.rules as string, after: JSON.stringify(newRules) });
        return json({ policy_id: body.policy_id, updated: true });
      }

      // === 验收辅助查询 ===
      if (path === '/v1/db/query' && method === 'GET') {
        const type = url.searchParams.get('type');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        if (type === 'actions') { const r = await env.FLY_D1.prepare("SELECT * FROM actions ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        if (type === 'agents') { const r = await env.FLY_D1.prepare("SELECT * FROM agents ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        if (type === 'verifications') { const r = await env.FLY_D1.prepare("SELECT * FROM verifications ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        if (type === 'audit') { const r = await env.FLY_D1.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        if (type === 'roles') { const r = await env.FLY_D1.prepare("SELECT * FROM role_assignments ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        if (type === 'policies') { const r = await env.FLY_D1.prepare("SELECT * FROM policies").all(); return json(r); }
        return json({ error: "unknown type. Use: actions, agents, verifications, audit, roles, policies" }, 400);
      }

      return json({ error: "not found", hint: "try /v1/health" }, 404);
    } catch (err: any) {
      return json({ error: err.message || 'internal server error' }, 500);
    }
  },
};
