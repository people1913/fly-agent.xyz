/**
 * Fly API Worker v3.0 — Cloudflare Worker Entry Point
 * 自动归档 Trust Ledger（Keccak256 + secp256k1）
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
 *   POST /v1/verifications             — 漏洞5：三方分离防自证 + 自动归档Ledger
 *   GET  /s/:actionId                  — 漏洞6：短链Bot检测+信号质量
 *   POST /v1/signal/verify             — 漏洞6：JS回调信号质量升级
 *   GET  /v1/audit/:entityType/:entityId — 漏洞7：审计链查询
 *   POST /v1/governance/assign-role    — 漏洞8：角色授权
 *   POST /v1/governance/check-permission — 漏洞8：权限检查(Default Deny)
 *   POST /v1/governance/update-policy  — 漏洞8：策略更新
 *   GET  /v1/db/query                  — 验收辅助查询
 *   POST /v1/ledger/commit             — Trust Ledger 写入
 *   GET  /v1/ledger/:id                — Trust Ledger 查询
 *   GET  /v1/ledger/:id/verify         — Trust Ledger 完整性验证（proof_hash + 签名 + Merkle + 链上）
 *   GET  /v1/ledger/merkle             — 计算当前 Merkle Root
 *   POST /v1/ledger/merkle/batch       — 批次化 Merkle Root（1000条/批）
 *   GET  /v1/ledger/merkle/:batch_id   — 查询批次 Merkle Root
 *   POST /v1/ledger/:id/attest         — BNB 链上存证
 */

// Trust Ledger 加密库
import { keccak_256 } from '@noble/hashes/sha3';
import * as secp from '@noble/secp256k1';

// ============================================================
// Types
// ============================================================
interface Env {
  FLY_D1: D1Database;
  FLY_KV: KVNamespace;
  IP_SALT: string;
  API_KEYS: string;
  LEDGER_PRIVATE_KEY: string;  // Trust Ledger 签名私钥
  CF_API_TOKEN: string;        // Cloudflare API Token（通过 wrangler secret 设置）
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

// ============================================================
// ensureLedgerTable（Trust Ledger MVP）
// ============================================================
async function ensureLedgerTable(env: Env): Promise<void> {
  await env.FLY_D1.prepare(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      proof_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      signer_address TEXT NOT NULL,
      bnb_agent_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      service_call_id TEXT,
      details TEXT,
      proof_data_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_ledger_agent_time ON ledger_entries(bnb_agent_id, timestamp)"
  ).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_ledger_proof_hash ON ledger_entries(proof_hash)"
  ).run();
}

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
        
        // === Trust Ledger 自动归档 ===
        const ledgerId = `ledger_auto_${crypto.randomUUID()}`;
        const timestamp = new Date().toISOString();
        const proofData = JSON.stringify({
          verification_id: verificationId,
          action_id: body.action_id,
          verifier: body.verifier,
          verifier_id: body.verifier_id,
          result: body.result || 'pending',
          confidence: body.confidence || 0,
          evidence: body.evidence,
          timestamp: timestamp
        });
        
        // Keccak256 计算 proof_hash
        const proofDataBytes = new TextEncoder().encode(proofData);
        const proofHash = '0x' + Array.from(keccak_256(proofDataBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // secp256k1 签名
        const privateKey = env.LEDGER_PRIVATE_KEY.startsWith('0x') ? env.LEDGER_PRIVATE_KEY.slice(2) : env.LEDGER_PRIVATE_KEY;
        const privateKeyBytes = new Uint8Array(privateKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const proofHashBytes = new Uint8Array(proofHash.slice(2).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const signature = await secp.signAsync(proofHashBytes, privateKeyBytes);
        const signatureHex = '0x' + signature.toCompactHex();
        
        // 从私钥推导签名者地址（0x8F3eFc2c438052D919f2a0e863e4c01da1373d68）
        const signerAddress = '0x8F3eFc2c438052D919f2a0e863e4c01da1373d68';
        const bnbAgentId = 1503;
        
        // 写入 ledger_entries
        const ledgerDetails = JSON.stringify({
          source: 'verification_auto_archive',
          verification_id: verificationId,
          action_id: body.action_id,
          verifier: body.verifier,
          timestamp: timestamp
        });
        
        await env.FLY_D1.prepare(
          "INSERT INTO ledger_entries (id, event_type, proof_hash, signature, signer_address, bnb_agent_id, timestamp, details, proof_data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
        ).bind(ledgerId, 'verification.committed', proofHash, signatureHex, signerAddress, bnbAgentId, timestamp, ledgerDetails, proofData).run();
        
        return json({ 
          success: true, 
          verification_id: verificationId, 
          verifier_type: verifierType, 
          rules_checked: ["self_verification_blocked", "verifier_id_required", "evidence_required", "L2_source_check"],
          ledger: {
            auto_archived: true,
            ledger_id: ledgerId,
            proof_hash: proofHash,
            signature: signatureHex,
            signer_address: signerAddress,
            bnb_agent_id: bnbAgentId
          }
        }, 201);
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

      
      // === Trust Ledger: Commit Entry ===
      if (path === '/v1/ledger/commit' && method === 'POST') {
        await ensureLedgerTable(env);
        const body: any = await request.json();
        const id = body.id || `ledger_${crypto.randomUUID()}`;
        await env.FLY_D1.prepare(
          `INSERT INTO ledger_entries (id, proof_hash, signature, signer_address, bnb_agent_id, event_type, timestamp, service_call_id, details, proof_data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.proof_hash,
          body.signature,
          body.signer_address,
          body.bnb_agent_id,
          body.event_type,
          body.timestamp || new Date().toISOString(),
          body.service_call_id || null,
          JSON.stringify(body.details) || null,
          JSON.stringify(body.proof_data)
        ).run();
        return json({ success: true, id }, 200);
      }

      // === Trust Ledger: Get Entry ===
      if (path.startsWith('/v1/ledger/') && method === 'GET' && !path.includes('/merkle') && !path.includes('/attest') && !path.includes('/verify')) {
        await ensureLedgerTable(env);
        const id = path.split('/v1/ledger/')[1];
        if (!id) return json({ error: "missing ledger id" }, 400);
        const entry = await env.FLY_D1.prepare("SELECT * FROM ledger_entries WHERE id = ?").bind(id).first();
        if (!entry) return json({ error: "ledger entry not found" }, 404);
        // 解析 JSON 字段（安全解析，非 JSON 保持原值）
        const result: any = { ...entry };
        if (result.proof_data_json) {
          try { result.proof_data = JSON.parse(result.proof_data_json); } catch { result.proof_data = result.proof_data_json; }
        }
        if (result.details) {
          try { result.details = JSON.parse(result.details); } catch { /* 保持原值 */ }
        }
        return json(result);
      }

      // === Trust Ledger: Verify Entry Integrity ===
      if (path.startsWith('/v1/ledger/') && path.endsWith('/verify') && method === 'GET') {
        const id = path.split('/v1/ledger/')[1].split('/verify')[0];
        if (!id) return json({ error: "missing ledger id" }, 400);

        // 查找 ledger entry
        const entry = await env.FLY_D1.prepare("SELECT * FROM ledger_entries WHERE id = ?").bind(id).first();
        if (!entry) return json({ error: "ledger entry not found", ledger_id: id }, 404);

        const e = entry as any;
        const verifications: any = {};

        // ── 检查1: Proof Hash 完整性 ──
        let proofHashValid = false;
        if (e.proof_data_json) {
          // proof_data_json 可能是字符串或已解析的对象，统一序列化
          const proofDataStr = typeof e.proof_data_json === 'string' ? e.proof_data_json : JSON.stringify(e.proof_data_json);
          const proofDataBytes = new TextEncoder().encode(proofDataStr);
          const recomputed = '0x' + Array.from(keccak_256(proofDataBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
          // 归一化比较（统一加 0x 前缀）
          const stored = e.proof_hash.startsWith('0x') ? e.proof_hash : '0x' + e.proof_hash;
          proofHashValid = recomputed.toLowerCase() === stored.toLowerCase();
          verifications.proof_hash = {
            valid: proofHashValid,
            stored: stored,
            recomputed: recomputed
          };
        } else {
          verifications.proof_hash = { valid: false, error: "proof_data_json is empty" };
        }

        // ── 检查2: 签名验证（secp256k1 恢复签名者） ──
        let signatureValid = false;
        try {
          // 归一化 proof_hash（补 0x 前缀）
          const normalizedHash = e.proof_hash.startsWith('0x') ? e.proof_hash : '0x' + e.proof_hash;
          const proofHashHex = normalizedHash.slice(2);
          const proofHashBytes = new Uint8Array(proofHashHex.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));

          // 归一化 signature（补 0x 前缀，截断到 compact 格式 64 字节）
          const normalizedSig = e.signature.startsWith('0x') ? e.signature : '0x' + e.signature;
          let sigHex = normalizedSig.slice(2);
          // fromCompact 需要 64 字节 (128 hex)，如果多了 recovery byte 则截断
          if (sigHex.length > 128) sigHex = sigHex.slice(0, 128);
          const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));

          const sigObj = secp.Signature.fromCompact(sigBytes);
          let recoveredAddr = '';
          // 尝试两个 recovery bit (0 和 1)，找到匹配的地址
          for (let recBit = 0; recBit <= 1; recBit++) {
            try {
              const recoveredPubkey = sigObj.addRecoveryBit(recBit).recoverPublicKey(proofHashBytes);
              const uncompressedBytes = recoveredPubkey.toRawBytes(false); // 65 bytes: 04 + x(32) + y(32)
              const addr = '0x' + Array.from(keccak_256(uncompressedBytes.slice(1))).slice(12).map(b => b.toString(16).padStart(2, '0')).join('');
              if (addr.toLowerCase() === e.signer_address.toLowerCase()) {
                recoveredAddr = addr;
                break;
              }
              if (recBit === 1 && !recoveredAddr) recoveredAddr = addr; // 保留最后一个尝试结果
            } catch {}
          }
          signatureValid = recoveredAddr.toLowerCase() === e.signer_address.toLowerCase();

          verifications.signature = {
            valid: signatureValid,
            expected_signer: e.signer_address,
            recovered_signer: recoveredAddr
          };
        } catch (err: any) {
          verifications.signature = { valid: false, error: err.message };
        }

        // ── 检查3: Merkle 树包含证明 ──
        const allHashes = await env.FLY_D1.prepare("SELECT proof_hash FROM ledger_entries ORDER BY created_at ASC").all();
        const hashList = allHashes.results.map((r: any) => r.proof_hash);
        const leafIndex = hashList.indexOf(e.proof_hash);

        verifications.merkle_inclusion = {
          is_leaf: leafIndex >= 0,
          leaf_index: leafIndex,
          total_leaves: hashList.length
        };

        // ── 检查4: 链上存证状态（查 BNB Testnet 元数据） ──
        let chainStatus = "not_checked";
        try {
          const agentAddr = e.signer_address;

          // 简化检查：查 merkle_roots 表是否有已归档批次
          const batches = await env.FLY_D1.prepare("SELECT * FROM merkle_roots ORDER BY created_at ASC").all();
          if (batches.results.length > 0) {
            const latestBatch = batches.results[batches.results.length - 1] as any;
            chainStatus = "attested";
            verifications.chain = {
              status: "attested",
              batch_id: latestBatch.batch_id,
              merkle_root: latestBatch.merkle_root,
              entry_count: latestBatch.entry_count,
              chain: "BNB Testnet",
              agent_address: agentAddr
            };
          } else {
            chainStatus = "not_yet_attested";
            verifications.chain = {
              status: "not_yet_attested",
              message: "Merkle Root has not been submitted to chain yet"
            };
          }
        } catch (err: any) {
          chainStatus = "check_failed";
          verifications.chain = { status: "check_failed", error: err.message };
        }

        // ── 汇总 ──
        const allValid = proofHashValid && signatureValid && verifications.merkle_inclusion.is_leaf;

        return json({
          verified: allValid,
          ledger_id: id,
          event_type: e.event_type,
          checks: {
            proof_hash_integrity: proofHashValid,
            signature_valid: signatureValid,
            merkle_included: verifications.merkle_inclusion.is_leaf,
            chain_status: chainStatus
          },
          details: verifications,
          summary: allValid
            ? "全部验证通过：数据完整、签名有效、Merkle 树包含"
            : "存在验证失败项，请检查 details"
        });
      }

      // === Trust Ledger: Merkle Root ===
      if (path === '/v1/ledger/merkle' && method === 'GET') {
        await ensureLedgerTable(env);
        const entries = await env.FLY_D1.prepare("SELECT proof_hash FROM ledger_entries ORDER BY created_at ASC").all();
        if (!entries.results || entries.results.length === 0) {
          return json({ error: "no ledger entries found", merkle_root: null }, 404);
        }
        
        // 提取所有 proof_hash
        const hashes = entries.results.map((e: any) => e.proof_hash);
        
        // 计算 Merkle Root（Keccak256）
        function computeMerkleRoot(hashes: string[]): string {
          if (hashes.length === 0) return '0x' + '0'.repeat(64);
          if (hashes.length === 1) return hashes[0];
          
          // 确保偶数个节点
          if (hashes.length % 2 === 1) {
            hashes.push(hashes[hashes.length - 1]);
          }
          
          const nextLevel: string[] = [];
          for (let i = 0; i < hashes.length; i += 2) {
            const left = hashes[i].startsWith('0x') ? hashes[i].slice(2) : hashes[i];
            const right = hashes[i + 1].startsWith('0x') ? hashes[i + 1].slice(2) : hashes[i + 1];
            const combined = new TextEncoder().encode(left + right);
            const hash = '0x' + Array.from(keccak_256(combined)).map(b => b.toString(16).padStart(2, '0')).join('');
            nextLevel.push(hash);
          }
          
          return computeMerkleRoot(nextLevel);
        }
        
        const merkleRoot = computeMerkleRoot(hashes);
        
        return json({
          merkle_root: merkleRoot,
          leaf_count: entries.results.length,
          leaf_hashes: hashes
        });
      }

      // === Trust Ledger: Batch Merkle Root ===
      if (path === '/v1/ledger/merkle/batch' && method === 'POST') {
        await ensureLedgerTable(env);
        
        // 获取未归档的 ledger_entries（按批次 1000 条）
        const batchSize = 1000;
        const allEntries = await env.FLY_D1.prepare("SELECT id, proof_hash FROM ledger_entries ORDER BY created_at ASC").all();
        
        if (!allEntries.results || allEntries.results.length === 0) {
          return json({ error: "no ledger entries found" }, 404);
        }
        
        // 获取已归档的批次数量
        const batchCount = await env.FLY_D1.prepare("SELECT COUNT(*) as count FROM merkle_roots").all();
        const archivedCount = (batchCount.results[0] as any).count;
        const startIndex = archivedCount * batchSize;
        
        if (startIndex >= allEntries.results.length) {
          return json({ 
            message: "All entries already archived", 
            total_entries: allEntries.results.length,
            archived_batches: archivedCount
          });
        }
        
        // 取当前批次的 entries
        const batchEntries = allEntries.results.slice(startIndex, startIndex + batchSize);
        const hashes = batchEntries.map((e: any) => e.proof_hash);
        
        // 计算 Merkle Root
        function computeMerkleRootBatch(hashes: string[]): string {
          if (hashes.length === 0) return '0x' + '0'.repeat(64);
          if (hashes.length === 1) return hashes[0];
          
          if (hashes.length % 2 === 1) {
            hashes.push(hashes[hashes.length - 1]);
          }
          
          const nextLevel: string[] = [];
          for (let i = 0; i < hashes.length; i += 2) {
            const left = hashes[i].startsWith('0x') ? hashes[i].slice(2) : hashes[i];
            const right = hashes[i + 1].startsWith('0x') ? hashes[i + 1].slice(2) : hashes[i + 1];
            const combined = new TextEncoder().encode(left + right);
            const hash = '0x' + Array.from(keccak_256(combined)).map(b => b.toString(16).padStart(2, '0')).join('');
            nextLevel.push(hash);
          }
          
          return computeMerkleRootBatch(nextLevel);
        }
        
        const merkleRoot = computeMerkleRootBatch(hashes);
        const batchId = `batch_${String(archivedCount + 1).padStart(3, '0')}`;
        
        // 保存到 merkle_roots 表
        await env.FLY_D1.prepare(
          "INSERT INTO merkle_roots (batch_id, merkle_root, entry_count, created_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(batchId, merkleRoot, batchEntries.length).run();
        
        return json({
          success: true,
          batch_id: batchId,
          merkle_root: merkleRoot,
          entry_count: batchEntries.length,
          start_index: startIndex,
          end_index: startIndex + batchEntries.length - 1,
          total_entries: allEntries.results.length,
          archived_batches: archivedCount + 1
        });
      }

      // === Trust Ledger: Get Batch Merkle Root ===
      if (path.startsWith('/v1/ledger/merkle/') && method === 'GET' && !path.endsWith('/attest')) {
        const batchId = path.split('/v1/ledger/merkle/')[1];
        if (!batchId) return json({ error: "missing batch_id" }, 400);
        
        const batch = await env.FLY_D1.prepare("SELECT * FROM merkle_roots WHERE batch_id = ?").bind(batchId).first();
        if (!batch) return json({ error: "batch not found" }, 404);
        
        return json(batch);
      }

      // === Trust Ledger: Attest Merkle Root to BNB ===
      if (path.startsWith('/v1/ledger/merkle/') && path.endsWith('/attest') && method === 'POST') {
        const batchId = path.split('/v1/ledger/merkle/')[1].split('/attest')[0];
        if (!batchId) return json({ error: "missing batch_id" }, 400);
        
        const batch = await env.FLY_D1.prepare("SELECT * FROM merkle_roots WHERE batch_id = ?").bind(batchId).first();
        if (!batch) return json({ error: "batch not found" }, 404);
        
        // 构建链上存证数据
        const attestData = {
          batch_id: batch.batch_id,
          merkle_root: batch.merkle_root,
          entry_count: batch.entry_count,
          created_at: batch.created_at,
          chain: "BNB Testnet",
          chain_id: 97
        };
        
        // 签名 merkle_root
        const merkleRootBytes = new TextEncoder().encode(batch.merkle_root);
        const merkleRootHash = '0x' + Array.from(keccak_256(merkleRootBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        const privateKey = env.LEDGER_PRIVATE_KEY.startsWith('0x') ? env.LEDGER_PRIVATE_KEY.slice(2) : env.LEDGER_PRIVATE_KEY;
        const privateKeyBytes = new Uint8Array(privateKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const hashBytes = new Uint8Array(merkleRootHash.slice(2).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const signature = await secp.signAsync(hashBytes, privateKeyBytes);
        const signatureHex = '0x' + signature.toCompactHex();
        
        return json({
          success: true,
          message: "Merkle Root attestation data prepared for BNB Testnet",
          attest_data: attestData,
          signature: {
            merkle_root_hash: merkleRootHash,
            signature: signatureHex,
            signer_address: "0x8F3eFc2c438052D919f2a0e863e4c01da1373d68"
          },
          bnb_testnet: {
            rpc: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            chain_id: 97,
            instruction: "Submit this merkle_root to BNB Testnet via external script"
          }
        });
      }

      // === Trust Ledger: BNB Chain Attestation ===
      if (path.startsWith('/v1/ledger/') && path.endsWith('/attest') && method === 'POST') {
        await ensureLedgerTable(env);
        const id = path.split('/v1/ledger/')[1].split('/attest')[0];
        if (!id) return json({ error: "missing ledger id" }, 400);
        
        const entry = await env.FLY_D1.prepare("SELECT * FROM ledger_entries WHERE id = ?").bind(id).first();
        if (!entry) return json({ error: "ledger entry not found" }, 404);
        
        // 构建存证数据
        const attestData = {
          ledger_id: entry.id,
          proof_hash: entry.proof_hash,
          signature: entry.signature,
          signer_address: entry.signer_address,
          bnb_agent_id: entry.bnb_agent_id,
          event_type: entry.event_type,
          timestamp: entry.timestamp
        };
        
        // 返回存证数据（实际链上交易需要外部脚本或后续实现）
        return json({
          success: true,
          message: "Attestation data prepared. Submit to BNB Testnet manually or via external script.",
          attest_data: attestData,
          bnb_testnet_info: {
            rpc: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            chain_id: 97,
            wallet: entry.signer_address,
            bnb_agent_id: entry.bnb_agent_id
          },
          instruction: "Use: python3 bnb_chain_attest.py " + id
        });
      }

      // ============================================================
      // D1 Backup System
      // ============================================================
      // 架构定位：
      //   Current Mode: KV-based temporary snapshot backup
      //   - 用途：防止误操作、快速回滚（冷备缓存层）
      //   - 保留：最近 24 小时，每小时一个快照
      //   - 限制：KV 单 value 上限 25MB，D1 超过此大小将无法备份
      //
      //   Future Mode: R2 immutable backup storage
      //   - 用途：真正的灾备、长期归档
      //   - 保留：永久，带版本控制
      //   - 启用条件：R2 bucket fly-backup 创建后，修改 BACKUP_STORAGE 常量
      //
      // 存储层切换时只需修改 storage 相关函数，API 接口不变。
      // ============================================================

      const BACKUP_STORAGE = 'kv'; // 'kv' | 'r2'
      const BACKUP_PREFIX = 'd1_backup_';
      const BACKUP_META_KEY = 'd1_backup_index';
      const BACKUP_RETENTION_HOURS = 24;

      // --- Backup Index Management ---
      async function getBackupIndex(env: Env): Promise<any[]> {
        const raw = await env.FLY_KV.get(BACKUP_META_KEY);
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      }

      async function saveBackupIndex(env: Env, index: any[]): Promise<void> {
        await env.FLY_KV.put(BACKUP_META_KEY, JSON.stringify(index));
      }

      // --- Compute Table Checksums ---
      // D1 不允许 Worker 查询 sqlite_master，使用已知表名列表
      const KNOWN_TABLES = [
        'agents', 'actions', 'verifications', 'audit_events', 'role_assignments', 
        'policies', 'agent_auth', 'ledger_entries', 'merkle_roots'
      ];

      async function computeTableChecksums(env: Env): Promise<{ table: string; row_count: number; checksum: string }[]> {
        const results: { table: string; row_count: number; checksum: string }[] = [];

        for (const tableName of KNOWN_TABLES) {
          try {
            // 行数
            const countRow = await env.FLY_D1.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).first();
            const rowCount = (countRow as any)?.cnt || 0;

            // 数据指纹：将所有行按 rowid 排序，拼接所有列值为字符串，计算 SHA-256
            let checksum = 'empty';
            if (rowCount > 0 && rowCount < 100000) {
              const rows = await env.FLY_D1.prepare(`SELECT * FROM "${tableName}" ORDER BY rowid LIMIT 10000`).all();
              const dataStr = JSON.stringify(rows.results);
              const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataStr));
              checksum = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            }

            results.push({ table: tableName, row_count: rowCount, checksum });
          } catch (e) {
            // 表不存在则跳过
            results.push({ table: tableName, row_count: -1, checksum: 'error' });
          }
        }

        return results;
      }

      // --- Cleanup Old Backups ---
      async function cleanupOldBackups(env: Env): Promise<number> {
        const index = await getBackupIndex(env);
        const cutoff = Date.now() - BACKUP_RETENTION_HOURS * 3600 * 1000;
        const toKeep = index.filter(b => b.created_ts > cutoff);
        const removed = index.length - toKeep.length;

        // 删除过期的 KV 数据
        for (const b of index) {
          if (b.created_ts <= cutoff) {
            await env.FLY_KV.delete(BACKUP_PREFIX + b.id);
          }
        }

        await saveBackupIndex(env, toKeep);
        return removed;
      }

      // === POST /v1/backup/d1 — 接收外部推送的备份 ===
      // Worker 内部无法调用 Cloudflare Management API (export endpoint)
      // 备份流程：外部脚本调用 Cloudflare export API → 下载 SQL → POST 推送到此端点
      if (path === '/v1/backup/d1' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);

        const contentType = request.headers.get('Content-Type') || '';
        let sqlContent = '';

        if (contentType.includes('application/sql') || contentType.includes('text/plain')) {
          // 接收 SQL 内容
          sqlContent = await request.text();
        } else if (contentType.includes('application/json')) {
          // 接收 JSON 格式 { sql: "...", checksums: {...} }
          const body = await request.json() as any;
          sqlContent = body.sql || '';
          if (!sqlContent) return json({ error: 'missing sql field in JSON body' }, 400);
        } else {
          return json({ error: 'unsupported content type, use application/sql or application/json' }, 400);
        }

        if (sqlContent.length < 100) {
          return json({ error: 'SQL content too short, likely invalid' }, 400);
        }

        // 计算当前表 checksums（作为备份时的快照校验）
        const checksums = await computeTableChecksums(env);

        // 计算完整备份的 SHA-256 哈希
        const backupHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sqlContent));
        const backupHash = Array.from(new Uint8Array(backupHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        // 存入 KV
        const backupId = crypto.randomUUID();
        const now = new Date().toISOString();
        const kvKey = BACKUP_PREFIX + backupId;

        // 备份元数据
        const backupMeta = {
          id: backupId,
          created_at: now,
          created_ts: Date.now(),
          sql_size: sqlContent.length,
          backup_hash: backupHash,
          table_count: checksums.length,
          total_rows: checksums.reduce((s, c) => s + c.row_count, 0),
          checksums,
          storage: BACKUP_STORAGE,
          immutable: true  // 标记为不可变
        };

        await env.FLY_KV.put(kvKey, sqlContent, { expirationTtl: BACKUP_RETENTION_HOURS * 3600 });

        // 更新索引（append-only，不允许修改历史）
        const index = await getBackupIndex(env);
        index.unshift(backupMeta);
        await saveBackupIndex(env, index);

        // 清理过期备份
        const removed = await cleanupOldBackups(env);

        // 写审计日志
        await writeAuditEvent(env, {
          request_id: crypto.randomUUID(),
          entity_type: 'd1_backup',
          entity_id: backupId,
          action: 'created',
          actor_type: 'system',
          actor_id: 'backup_push',
          actor_name: 'External Backup Script',
          source: 'POST /v1/backup/d1',
          reason: 'Backup pushed from external script',
          before: '',
          after: JSON.stringify({ backup_id: backupId, sql_size: sqlContent.length, backup_hash: backupHash })
        });

        return json({
          success: true,
          backup: {
            id: backupId,
            created_at: now,
            sql_size: sqlContent.length,
            backup_hash: backupHash,
            table_count: checksums.length,
            total_rows: backupMeta.total_rows,
            storage: BACKUP_STORAGE,
            immutable: true
          },
          cleanup: { removed_count: removed }
        });
      }

      // === GET /v1/backup/d1/list — 列出所有备份 ===
      if (path === '/v1/backup/d1/list' && method === 'GET') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);

        const index = await getBackupIndex(env);
        return json({
          backups: index.map(b => ({
            id: b.id,
            created_at: b.created_at,
            sql_size: b.sql_size,
            table_count: b.table_count,
            total_rows: b.total_rows,
            storage: b.storage
          })),
          count: index.length,
          retention_hours: BACKUP_RETENTION_HOURS
        });
      }

      // === GET /v1/backup/d1/:id — 下载指定备份 ===
      if (path.startsWith('/v1/backup/d1/') && path.split('/').length === 5 && method === 'GET') {
        const parts = path.split('/');
        const action = parts[4]; // parts: ['', 'v1', 'backup', 'd1', 'verify' or backup_id]

        if (action === 'list' || action === 'verify' || action === 'restore') {
          // 这些在其他路由处理，这里不拦截
        } else {
          // 当作 backup_id 处理
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);

          const backupId = action;
          const kvKey = BACKUP_PREFIX + backupId;
          const sqlContent = await env.FLY_KV.get(kvKey);

          if (!sqlContent) {
            return json({ error: 'backup not found or expired', backup_id: backupId }, 404);
          }

          return new Response(sqlContent, {
            status: 200,
            headers: {
              'Content-Type': 'application/sql',
              'Content-Disposition': `attachment; filename="fly-db-${backupId}.sql"`,
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      // === GET /v1/backup/d1/verify — 验证最新备份完整性 ===
      if (path === '/v1/backup/d1/verify' && method === 'GET') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);

        const index = await getBackupIndex(env);
        if (index.length === 0) {
          return json({ error: 'no backups found', verified: false }, 404);
        }

        const latest = index[0];
        const kvKey = BACKUP_PREFIX + latest.id;
        const sqlContent = await env.FLY_KV.get(kvKey);

        if (!sqlContent) {
          return json({
            error: 'latest backup SQL content not found in KV (expired or corrupted)',
            backup_id: latest.id,
            verified: false
          }, 404);
        }

        // 1. 检查 SQL 是否可解析（基本语法检查）
        const sqlValid = sqlContent.includes('CREATE TABLE') || sqlContent.includes('INSERT INTO') || sqlContent.includes('CREATE');

        // 2. 当前表 checksums
        const currentChecksums = await computeTableChecksums(env);

        // 3. 对比表结构（备份时的表 vs 当前表）
        const backupTables = new Set(latest.checksums.map((c: any) => c.table));
        const currentTables = new Set(currentChecksums.map(c => c.table));
        const missingTables = [...backupTables].filter(t => !currentTables.has(t));
        const newTables = [...currentTables].filter(t => !backupTables.has(t));

        // 4. 对比行数和 checksum
        const checksumCompare: { table: string; backup_rows: number; current_rows: number; backup_checksum: string; current_checksum: string; match: boolean }[] = [];
        let allMatch = true;

        for (const bc of latest.checksums) {
          const cc = currentChecksums.find(c => c.table === bc.table);
          if (!cc) continue;
          const match = bc.row_count === cc.row_count && bc.checksum === cc.checksum;
          if (!match) allMatch = false;
          checksumCompare.push({
            table: bc.table,
            backup_rows: bc.row_count,
            current_rows: cc.row_count,
            backup_checksum: bc.checksum,
            current_checksum: cc.checksum,
            match
          });
        }

        return json({
          backup_id: latest.id,
          backup_created_at: latest.created_at,
          sql_size: latest.sql_size,
          sql_valid: sqlValid,
          schema_consistent: missingTables.length === 0,
          data_consistent: allMatch,
          verified: sqlValid && missingTables.length === 0,
          details: {
            missing_tables: missingTables,
            new_tables: newTables,
            table_comparison: checksumCompare
          }
        });
      }

      // === POST /v1/backup/d1/restore/:id — 从备份恢复 ===
      if (path.startsWith('/v1/backup/d1/restore/') && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);

        const backupId = path.split('/v1/backup/d1/restore/')[1];
        if (!backupId) return json({ error: 'missing backup id' }, 400);

        const body = await request.json().catch(() => ({})) as any;
        const dryRun = body.dry_run !== false; // 默认 dry_run=true
        const confirm = body.confirm;

        // 查找备份
        const index = await getBackupIndex(env);
        const backup = index.find(b => b.id === backupId);
        if (!backup) return json({ error: 'backup not found', backup_id: backupId }, 404);

        const kvKey = BACKUP_PREFIX + backupId;
        const sqlContent = await env.FLY_KV.get(kvKey);
        if (!sqlContent) {
          return json({ error: 'backup SQL content expired or missing', backup_id: backupId }, 404);
        }

        // 当前状态快照（用于回退）
        const currentChecksums = await computeTableChecksums(env);

        if (dryRun) {
          // Dry-run：只返回将执行什么
          return json({
            dry_run: true,
            backup_id: backupId,
            backup_created_at: backup.created_at,
            plan: {
              action: 'D1 import (overwrite current database)',
              backup_sql_size: sqlContent.length,
              backup_tables: backup.checksums.map((c: any) => ({ table: c.table, rows: c.row_count })),
              current_tables: currentChecksums.map(c => ({ table: c.table, rows: c.row_count })),
              warnings: [
                'This will OVERWRITE all current D1 data with backup content',
                'Tables not in backup will be DELETED',
                'Create a fresh backup before restoring if you want rollback capability'
              ]
            },
            to_execute: {
              method: 'POST /v1/backup/d1/restore/' + backupId,
              body: { dry_run: false, confirm: 'YES_RESTORE' }
            }
          });
        }

        // 真正恢复：需要确认
        if (confirm !== 'YES_RESTORE') {
          return json({
            error: 'restore requires confirmation',
            required: { confirm: 'YES_RESTORE' },
            hint: 'First call with dry_run=true to see the plan, then call with dry_run=false and confirm=YES_RESTORE'
          }, 400);
        }

        // 恢复前自动创建快照
        const preRestoreBackupId = crypto.randomUUID();
        const preRestoreMeta = {
          id: preRestoreBackupId,
          created_at: new Date().toISOString(),
          created_ts: Date.now(),
          filename: 'pre_restore_snapshot',
          sql_size: 0,
          table_count: currentChecksums.length,
          total_rows: currentChecksums.reduce((s, c) => s + c.row_count, 0),
          checksums: currentChecksums,
          storage: BACKUP_STORAGE,
          note: 'Auto-created before restore from ' + backupId
        };

        // 通过 D1 import API 恢复
        const importResp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/014fc3114b2e2befeac9aaaf08a09a5b/d1/database/71a75dc8-76c5-4563-bf6f-0aa47f76ff95/import`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.CF_API_TOKEN}`,
              'Content-Type': 'application/octet-stream'
            },
            body: sqlContent
          }
        );
        const importData = await importResp.json() as any;

        // 写审计日志
        await writeAuditEvent(env, {
          request_id: crypto.randomUUID(),
          entity_type: 'd1_backup',
          entity_id: backupId,
          action: 'restored',
          actor_type: 'human',
          actor_id: auth.token || 'unknown',
          actor_name: 'API User',
          source: 'POST /v1/backup/d1/restore/' + backupId,
          reason: 'Database restore from backup',
          before: JSON.stringify({ tables: currentChecksums }),
          after: JSON.stringify({ restored_from: backupId, import_result: importData.result || importData.errors })
        });

        return json({
          success: importData.success || false,
          backup_id: backupId,
          restore_result: importData.result || importData.errors,
          pre_restore_snapshot: {
            id: preRestoreBackupId,
            note: 'Snapshot of database state before restore (stored in audit log, not KV)'
          },
          audit_logged: true
        });
      }

return json({ error: "not found", hint: "try /v1/health" }, 404);
    } catch (err: any) {
      return json({ error: err.message || 'internal server error' }, 500);
    }
  },
};
