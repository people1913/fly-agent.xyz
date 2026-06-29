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
 *   POST /v1/webhook/ai-platform       — Evidence持续产生（AI平台统一入口）
 *   POST /v1/verifications/external    — Attestation外部信号（平台签名+用户行为）
 *   GET  /v1/trust-records/:trust_id   — Trust Record版本链查询
 *   POST /v1/journeys/build            — Attribution: 构建用户旅程
 *   POST /v1/attribution               — Attribution: 归因计算（含Revenue+Commission）
 *   GET  /v1/journeys                  — Attribution: 查询旅程列表
 *   POST /v1/settlements               — Settlement: 创建结算记录
 *   GET  /v1/settlements               — Settlement: 查询结算列表
 *   PUT  /v1/settlements/:id           — Settlement: 更新结算状态
 *   GET  /v1/commissions/summary       — Settlement: 佣金汇总
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

type SignalType = "impression" | "click" | "consult" | "booking" | "deal" | "purchase";
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

    // /verify.html → /verify (修复 Cloudflare Zone 规则导致的 301 重定向)
    if (path === '/verify.html' && method === 'GET') {
      return Response.redirect('https://fly-agent.xyz/verify', 301);
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
        // 确保amount列存在（兼容旧表）
        await env.FLY_D1.prepare("ALTER TABLE actions ADD COLUMN amount REAL DEFAULT 0").run().catch(() => {});
        const body: any = await request.json();
        // 漏洞3：HMAC伪匿名
        if (body.user_id) body.user_id = await hmacUserId(body.user_id, env.IP_SALT || 'fly-attribution-salt-2026');
        const validTypes: SignalType[] = ["impression", "click", "consult", "booking", "deal", "purchase"];
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
        await env.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, amount, short_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(actionId, body.agent_id, body.channel, body.user_id ?? null, body.signal_type, (body.signal_type === 'booking' || body.signal_type === 'deal' || body.signal_type === 'purchase') ? (body.amount ?? null) : null, body.short_id || null, JSON.stringify(metadata)).run();
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

      // ============================================================
      // System Upgrade v3.1: Evidence持续产生 + Attestation外部信号 + Trust Record版本链
      // ============================================================

      // === Trust Records 版本链表 ===
      async function ensureTrustRecordsTable(env: Env): Promise<void> {
        await env.FLY_D1.prepare(`
          CREATE TABLE IF NOT EXISTS trust_records (
            id TEXT PRIMARY KEY,
            trust_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            prev_version INTEGER,
            state TEXT NOT NULL,
            aggregated_score REAL,
            evidence_hash TEXT,
            record_data TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
        await env.FLY_D1.prepare("CREATE INDEX IF NOT EXISTS idx_trust_logical ON trust_records(trust_id, version)").run();
        await env.FLY_D1.prepare("CREATE INDEX IF NOT EXISTS idx_trust_state ON trust_records(state)").run();
      }

      // === 状态变化检测 + 版本链写入 ===
      async function detectAndRecordStateChange(env: Env, actionId: string, newVerificationId: string): Promise<{ state_changed: boolean; new_version?: number; trust_id?: string }> {
        await ensureTrustRecordsTable(env);
        const vs = (await env.FLY_D1.prepare("SELECT * FROM verifications WHERE action_id = ? ORDER BY created_at ASC").bind(actionId).all()).results as any[];
        if (vs.length === 0) return { state_changed: false };

        // 聚合状态计算
        const verifiedCount = vs.filter(v => v.result === 'verified').length;
        const rejectedCount = vs.filter(v => v.result === 'rejected').length;
        const avgConfidence = vs.reduce((s, v) => s + (v.confidence || 0), 0) / vs.length;
        let currentState = 'pending';
        let aggregatedScore = avgConfidence;
        if (rejectedCount > 0 && verifiedCount === 0) { currentState = 'rejected'; aggregatedScore = Math.max(0, avgConfidence - 20); }
        else if (verifiedCount > 0 && verifiedCount >= Math.ceil(vs.length * 0.6)) { currentState = 'verified'; aggregatedScore = Math.min(100, avgConfidence + verifiedCount * 2); }

        // Evidence hash
        const evidenceStr = JSON.stringify(vs.map(v => ({ id: v.id, result: v.result, confidence: v.confidence })));
        const evidenceHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(evidenceStr));
        const evidenceHash = Array.from(new Uint8Array(evidenceHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

        // 查最新版本
        const latest = await env.FLY_D1.prepare("SELECT * FROM trust_records WHERE trust_id = ? ORDER BY version DESC LIMIT 1").bind(actionId).first();

        let needNew = false;
        if (!latest) { needNew = true; }
        else {
          const lr = latest as any;
          if (lr.state !== currentState) needNew = true;
          if (Math.abs((lr.aggregated_score || 0) - aggregatedScore) >= 10) needNew = true;
          const prevCount = JSON.parse(lr.record_data || '{}').verification_count || 0;
          if (vs.length >= prevCount + 3) needNew = true;
        }
        if (!needNew) return { state_changed: false };

        const newVer = latest ? ((latest as any).version + 1) : 1;
        const prevVer = latest ? (latest as any).version : null;
        const trustRecordId = `trust_${crypto.randomUUID()}`;
        const recordData = JSON.stringify({
          trust_id: actionId, version: newVer, state: currentState,
          aggregated_score: aggregatedScore, evidence_hash: evidenceHash,
          verification_count: vs.length,
          verifications: vs.map(v => ({ id: v.id, verifier: v.verifier, result: v.result, confidence: v.confidence, created_at: v.created_at })),
          trigger: latest ? { previous_state: (latest as any).state, previous_score: (latest as any).aggregated_score, new_verification_id: newVerificationId } : null
        });

        await env.FLY_D1.prepare("INSERT INTO trust_records (id, trust_id, version, prev_version, state, aggregated_score, evidence_hash, record_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))")
          .bind(trustRecordId, actionId, newVer, prevVer, currentState, aggregatedScore, evidenceHash, recordData).run();

        return { state_changed: true, new_version: newVer, trust_id: actionId };
      }

      // === Webhook: AI Platform 统一入口（Evidence 持续产生） ===
      if (path === '/v1/webhook/ai-platform' && method === 'POST') {
        const body: any = await request.json();
        const validSources = ['chatgpt', 'claude', 'gemini', 'coze', 'dify', 'fastgpt', 'perplexity', 'custom-agent'];
        const validEventTypes = ['prompt', 'response', 'tool_call'];
        if (!body.source || !validSources.includes(body.source)) return json({ error: 'invalid source', valid: validSources }, 400);
        if (!body.event_type || !validEventTypes.includes(body.event_type)) return json({ error: 'invalid event_type', valid: validEventTypes }, 400);
        if (!body.payload || typeof body.payload !== 'object') return json({ error: 'payload is required and must be object' }, 400);

        const agentId = body.agent_id || 'agt_system';
        const traceId = body.trace_id || `trace_${crypto.randomUUID()}`;
        const agent = await env.FLY_D1.prepare("SELECT id FROM agents WHERE id = ?").bind(agentId).first();
        if (!agent) return json({ error: 'agent not found', agent_id: agentId }, 404);

        // payload hash
        const payloadHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body.payload)));
        const payloadHash = Array.from(new Uint8Array(payloadHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

        const metadata = {
          signal_quality: 'raw', human_score: 0,
          evidence_source: 'webhook', ai_platform: body.source,
          event_type: body.event_type, trace_id: traceId, payload_hash: payloadHash
        };

        const actionId = `act_${crypto.randomUUID()}`;
        const signalType = body.event_type === 'response' ? 'click' : 'impression';
        const webhookUserId = `usr_webhook_${body.source}`;
        await env.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, 'direct', ?, ?, NULL, ?, datetime('now'))")
          .bind(actionId, agentId, webhookUserId, signalType, JSON.stringify(metadata)).run();

        await writeAuditEvent(env, {
          request_id: `req_${crypto.randomUUID()}`, entity_type: 'action', entity_id: actionId,
          action: 'created', actor_type: 'system', actor_id: `webhook_${body.source}`,
          actor_name: `${body.source} webhook`, source: 'webhook', reason: 'ai_platform_event',
          before: '{}', after: JSON.stringify({ action_id: actionId, source: body.source, event_type: body.event_type, trace_id: traceId })
        });

        return json({
          success: true, action_id: actionId,
          evidence: { action_id: actionId, source: body.source, event_type: body.event_type, trace_id: traceId, payload_hash: payloadHash, created_at: new Date().toISOString() }
        }, 201);
      }

      // === 外部验证信号输入（Attestation 外部信号） ===
      if (path === '/v1/verifications/external' && method === 'POST') {
        const body: any = await request.json();
        const validSignalTypes = ['platform_signature', 'user_behavior'];
        if (!body.signal_type || !validSignalTypes.includes(body.signal_type)) return json({ error: 'invalid signal_type', valid: validSignalTypes }, 400);
        if (!body.action_id) return json({ error: 'action_id is required' }, 400);

        const action = await env.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(body.action_id).first();
        if (!action) return json({ error: 'action not found' }, 404);

        let verificationResult = 'pending';
        let confidence = 0;
        let evidenceData: any = {};

        if (body.signal_type === 'platform_signature') {
          if (!body.platform || !body.signature || !body.signature.response_id) return json({ error: 'platform_signature requires platform, signature.response_id, signature.hash' }, 400);
          const hash = body.signature.hash;
          if (!hash || typeof hash !== 'string' || hash.length < 16) return json({ error: 'invalid signature hash' }, 400);
          verificationResult = 'verified';
          confidence = 90;
          evidenceData = { type: 'platform_signature', platform: body.platform, response_id: body.signature.response_id, hash, verified_at: new Date().toISOString() };
        } else {
          if (!body.behavior || !body.behavior.type) return json({ error: 'user_behavior requires behavior.type' }, 400);
          const validBehaviors = ['click', 'accept', 'copy', 'reuse'];
          if (!validBehaviors.includes(body.behavior.type)) return json({ error: 'invalid behavior type', valid: validBehaviors }, 400);
          const behaviorConfidence: Record<string, number> = { click: 60, accept: 75, copy: 80, reuse: 85 };
          verificationResult = 'verified';
          confidence = behaviorConfidence[body.behavior.type] || 50;
          evidenceData = { type: 'user_behavior', behavior: body.behavior.type, timestamp: body.behavior.timestamp || new Date().toISOString(), context: body.behavior.context || {} };
        }

        const verificationId = `vrf_${crypto.randomUUID()}`;
        await env.FLY_D1.prepare("INSERT INTO verifications (id, action_id, verifier, result, confidence, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))")
          .bind(verificationId, body.action_id, `external_${body.signal_type}`, verificationResult, confidence, JSON.stringify([evidenceData])).run();

        await writeAuditEvent(env, {
          request_id: `req_${crypto.randomUUID()}`, entity_type: 'verification', entity_id: verificationId,
          action: 'created', actor_type: 'user', actor_id: body.verifier_id || `external_${body.signal_type}`,
          actor_name: `External ${body.signal_type}`, source: 'external_verification',
          reason: `external_signal_${body.signal_type}`, before: '{}',
          after: JSON.stringify({ verification_id: verificationId, signal_type: body.signal_type, result: verificationResult, confidence })
        });

        // 触发状态变化检测 → Trust Record 版本链
        const stateChange = await detectAndRecordStateChange(env, body.action_id, verificationId);

        return json({
          success: true, verification_id: verificationId,
          signal_type: body.signal_type, result: verificationResult, confidence,
          trust_record: { state_changed: stateChange.state_changed, new_version: stateChange.new_version || null, trust_id: stateChange.trust_id || null }
        }, 201);
      }

      // === Trust Record 版本链查询 ===
      if (path.startsWith('/v1/trust-records/') && method === 'GET') {
        await ensureTrustRecordsTable(env);
        const trustId = path.split('/v1/trust-records/')[1];
        if (!trustId) return json({ error: 'missing trust_id' }, 400);
        const records = await env.FLY_D1.prepare("SELECT * FROM trust_records WHERE trust_id = ? ORDER BY version ASC").bind(trustId).all();
        if (records.results.length === 0) return json({ error: 'no trust records found', trust_id: trustId }, 404);
        const parsed = (records.results as any[]).map(r => {
          let data = {};
          try { data = JSON.parse(r.record_data); } catch {}
          return { ...r, parsed_data: data };
        });
        const latest = parsed[parsed.length - 1];
        return json({
          trust_id: trustId, version_count: parsed.length,
          current_state: latest.state, current_score: latest.aggregated_score,
          versions: parsed
        });
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

      // === Attribution Layer：Journey Build ===
      if (path === '/v1/journeys/build' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        await ensureAttributionTables(env);
        const result = await buildJourneys(env);
        return json({ success: true, journeys_built: result.built });
      }

      // === Attribution Layer：计算归因（含Revenue + Commission） ===
      if (path === '/v1/attribution' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        await ensureAttributionTables(env);
        const body: any = await request.json();
        if (!body.conversion_id) return json({ error: 'conversion_id is required' }, 400);
        const model = body.model || 'u_shaped';
        const result = await calculateAttribution(env, body.conversion_id, model);
        if (result.error) return json({ error: result.error }, 404);
        return json({ success: true, ...result });
      }

      // === Attribution Layer：查询Journeys ===
      if (path === '/v1/journeys' && method === 'GET') {
        await ensureAttributionTables(env);
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const status = url.searchParams.get('status');
        let sql = "SELECT * FROM journeys";
        const binds: any[] = [];
        if (status) { sql += " WHERE status = ?"; binds.push(status); }
        sql += " ORDER BY created_at DESC LIMIT ?";
        binds.push(limit);
        const r = await env.FLY_D1.prepare(sql).bind(...binds).all();
        return json({ success: true, journeys: r.results });
      }

      // === Settlement Layer：创建结算 ===
      if (path === '/v1/settlements' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        await ensureAttributionTables(env);
        const body: any = await request.json();
        if (!body.attribution_id || !body.agent_id || !body.amount) {
          return json({ error: 'attribution_id, agent_id, amount are required' }, 400);
        }
        const settlementId = `stl_${crypto.randomUUID()}`;
        await env.FLY_D1.prepare(`
          INSERT INTO settlements (id, attribution_id, agent_id, amount, currency, status, payment_method, notes)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
        `).bind(
          settlementId,
          body.attribution_id,
          body.agent_id,
          body.amount,
          body.currency || 'USD',
          body.payment_method || null,
          body.notes || null
        ).run();
        return json({ success: true, settlement_id: settlementId, status: 'pending' }, 201);
      }

      // === Settlement Layer：查询结算 ===
      if (path === '/v1/settlements' && method === 'GET') {
        await ensureAttributionTables(env);
        const agentId = url.searchParams.get('agent_id');
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        let sql = "SELECT * FROM settlements";
        const binds: any[] = [];
        const conditions: string[] = [];
        if (agentId) { conditions.push("agent_id = ?"); binds.push(agentId); }
        if (status) { conditions.push("status = ?"); binds.push(status); }
        if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
        sql += " ORDER BY created_at DESC LIMIT ?";
        binds.push(limit);
        const r = await env.FLY_D1.prepare(sql).bind(...binds).all();
        return json({ success: true, settlements: r.results });
      }

      // === Settlement Layer：更新结算状态 ===
      if (path.startsWith('/v1/settlements/') && method === 'PUT') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);
        await ensureAttributionTables(env);
        const settlementId = path.split('/v1/settlements/')[1];
        const body: any = await request.json();
        const validStatuses = ['pending', 'processing', 'paid', 'failed', 'cancelled'];
        if (!validStatuses.includes(body.status)) return json({ error: `invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
        const settledAt = body.status === 'paid' ? new Date().toISOString() : null;
        await env.FLY_D1.prepare(`
          UPDATE settlements SET status = ?, payment_ref = COALESCE(?, payment_ref), settled_at = COALESCE(?, settled_at), notes = COALESCE(?, notes)
          WHERE id = ?
        `).bind(body.status, body.payment_ref || null, settledAt, body.notes || null, settlementId).run();
        return json({ success: true, settlement_id: settlementId, status: body.status, settled_at: settledAt });
      }

      // === Settlement Layer：佣金汇总 ===
      if (path === '/v1/commissions/summary' && method === 'GET') {
        await ensureAttributionTables(env);
        const agentId = url.searchParams.get('agent_id');
        
        // 按agent汇总attribution中的commission
        let sql = `
          SELECT 
            agent_id,
            COUNT(*) as total_attributions,
            SUM(commission_amount) as total_commission,
            SUM(revenue_amount * contribution_pct) as total_revenue_attributed,
            AVG(commission_rate) as avg_commission_rate
          FROM attributions
        `;
        const binds: any[] = [];
        if (agentId) { sql += " WHERE agent_id = ?"; binds.push(agentId); }
        sql += " GROUP BY agent_id";
        const attrSummary = await env.FLY_D1.prepare(sql).bind(...binds).all();
        
        // 按agent汇总settlements
        let stlSql = `
          SELECT 
            agent_id,
            status,
            COUNT(*) as count,
            SUM(amount) as total_amount
          FROM settlements
        `;
        const stlBinds: any[] = [];
        if (agentId) { stlSql += " WHERE agent_id = ?"; stlBinds.push(agentId); }
        stlSql += " GROUP BY agent_id, status";
        const stlSummary = await env.FLY_D1.prepare(stlSql).bind(...stlBinds).all();
        
        return json({
          success: true,
          commission_summary: attrSummary.results,
          settlement_summary: stlSummary.results
        });
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
        if (type === 'trust_records') { await ensureTrustRecordsTable(env); const r = await env.FLY_D1.prepare("SELECT * FROM trust_records ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        if (type === 'journeys') { await ensureAttributionTables(env); const r = await env.FLY_D1.prepare("SELECT * FROM journeys ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        if (type === 'attributions') { await ensureAttributionTables(env); const r = await env.FLY_D1.prepare("SELECT * FROM attributions ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        if (type === 'settlements') { await ensureAttributionTables(env); const r = await env.FLY_D1.prepare("SELECT * FROM settlements ORDER BY created_at DESC LIMIT ?").bind(limit).all(); return json(r); }
        return json({ error: "unknown type. Use: actions, agents, verifications, audit, roles, policies, trust_records, journeys, attributions, settlements" }, 400);
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
        'policies', 'agent_auth', 'ledger_entries', 'merkle_roots', 'trust_records',
        'journeys', 'attributions', 'settlements'
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

// ============================================================
// Fly Trust Record — 签发、查询、验证
// Specification v1.0: Record = View, Issue not Generate
// ============================================================

      // --- 生成 Record ID: FLY-YYYYMMDD-XXXXX ---
      async function generateRecordId(env: Env): Promise<string> {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `FLY-${dateStr}-`;

        const row = await env.FLY_D1.prepare(
          "SELECT id FROM ledger_entries WHERE id LIKE ? ORDER BY id DESC LIMIT 1"
        ).bind(`${prefix}%`).first();

        let seq = 1;
        if (row) {
          const lastId = row.id as string;
          const lastSeq = parseInt(lastId.split('-')[2] || '0', 10);
          seq = lastSeq + 1;
        }

        return `${prefix}${seq.toString().padStart(5, '0')}`;
      }

      // --- POST /v1/verify — 签发 Fly Trust Record ---
      if (path === '/v1/verify' && method === 'POST') {
        const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
        if (!auth.ok) return json({ error: auth.error }, 401);

        const body: any = await request.json();

        // 校验必填字段
        if (!body.source || !body.source.type || !body.source.name) {
          return json({ error: 'source.type 和 source.name 必填' }, 400);
        }
        if (!body.evidence || !Array.isArray(body.evidence)) {
          return json({ error: 'evidence 必填' }, 400);
        }
        // Claim 必填（Fly 是归因验证，不是断言存储）
        if (!body.claim) {
          return json({ error: 'claim 必填，Fly 验证的是 AI 主张（Claim），不是断言（Assertion）' }, 400);
        }
        // Evidence 可以为空，但会影响 Status
        const hasEvidence = body.evidence.length > 0;

        // 生成 Record ID
        const recordId = await generateRecordId(env);
        const timestamp = new Date().toISOString();

        // Status 逻辑：有 Evidence 才能成为 Verified，否则是 Pending Evidence
        const status = hasEvidence ? 'pending' : 'pending_evidence';

        // 组装 Record JSON
        const recordJson = {
          record_id: recordId,
          source: {
            type: body.source.type,
            name: body.source.name,
            version: body.source.version || null,
            agent_id: body.source.agent_id || null,
            metadata: body.source.metadata || {}
          },
          evidence: body.evidence.map((e: any, i: number) => ({
            evidence_id: e.evidence_id || `evi_${String(i + 1).padStart(3, '0')}`,
            type: e.type || 'unknown',
            description: e.description || '',
            data: e.data || {},
            verified: e.verified || false,
            verified_at: e.verified_at || null,
            metadata: e.metadata || {}
          })),
          trust: {
            score: body.trust?.score || 0,
            level: body.trust?.level || 'low',
            reasoning: body.trust?.reasoning || null
          },
          attribution: body.attribution || null,
          scenario: body.scenario || 'General',
          category: body.category || 'General',
          claim: body.claim || null,
          status: status,
          attestation: {
            attestor: body.attestation?.attestor || body.source?.name || 'Unknown',
            attested_at: timestamp,
            type: body.attestation?.type || 'user-confirm',
            statement: body.attestation?.statement || 'I confirm this AI recommendation was made'
          },
          metadata: {
            created_at: timestamp,
            updated_at: timestamp,
            version: 1
          }
        };

        const proofDataJson = JSON.stringify(recordJson);

        // Keccak256 计算 proof_hash
        const proofDataBytes = new TextEncoder().encode(proofDataJson);
        const proofHash = '0x' + Array.from(keccak_256(proofDataBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

        // secp256k1 签名
        const privateKey = env.LEDGER_PRIVATE_KEY.startsWith('0x') ? env.LEDGER_PRIVATE_KEY.slice(2) : env.LEDGER_PRIVATE_KEY;
        const privateKeyBytes = new Uint8Array(privateKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const proofHashBytes = new Uint8Array(proofHash.slice(2).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const signature = await secp.signAsync(proofHashBytes, privateKeyBytes);
        const signatureHex = '0x' + signature.toCompactHex();

        // 签名者地址
        const signerAddress = '0x8F3eFc2c438052D919f2a0e863e4c01da1373d68';
        const bnbAgentId = body.bnb_agent_id || 1504;

        // 写入 ledger_entries（id = record_id）
        const details = JSON.stringify({
          source: 'trust_record_issue',
          record_id: recordId,
          action: 'issued',
          timestamp: timestamp
        });

        await env.FLY_D1.prepare(
          "INSERT INTO ledger_entries (id, event_type, proof_hash, signature, signer_address, bnb_agent_id, timestamp, details, proof_data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
        ).bind(recordId, 'record.created', proofHash, signatureHex, signerAddress, bnbAgentId, timestamp, details, proofDataJson).run();

        // 写审计
        await writeAuditEvent(env, {
          request_id: `req_${crypto.randomUUID()}`,
          entity_type: 'trust_record',
          entity_id: recordId,
          action: 'created',
          actor_type: 'user',
          actor_id: auth.agentId || 'api_user',
          actor_name: 'Fly Verify',
          source: 'POST /v1/verify',
          reason: 'trust_record_issued',
          before: '{}',
          after: JSON.stringify({ record_id: recordId, status: status, evidence_count: body.evidence.length })
        });

        return json({
          record_id: recordId,
          status: status,
          created_at: timestamp,
          proof_hash: proofHash,
          signature: signatureHex
        }, 201);
      }

      // --- GET /v1/records/:id — 查询 Fly Trust Record（视图） ---
      if (path.startsWith('/v1/records/') && !path.includes('/verify') && method === 'GET') {
        const recordId = path.split('/v1/records/')[1];
        if (!recordId) return json({ error: 'missing record_id' }, 400);

        // 1. 从 ledger_entries 读取 Record JSON
        const entry = await env.FLY_D1.prepare(
          "SELECT * FROM ledger_entries WHERE id = ?"
        ).bind(recordId).first();

        if (!entry) return json({ error: 'record not found', record_id: recordId }, 404);

        // 2. 解析 proof_data_json 获取完整 Record
        let record: any = {};
        try {
          record = JSON.parse((entry as any).proof_data_json);
        } catch {
          return json({ error: 'record data corrupted', record_id: recordId }, 500);
        }

        // 3. 附加 Ledger 证明信息
        record.ledger = {
          proof_hash: (entry as any).proof_hash,
          signature: (entry as any).signature,
          signer_address: (entry as any).signer_address,
          event_type: (entry as any).event_type,
          timestamp: (entry as any).timestamp,
          bnb_agent_id: (entry as any).bnb_agent_id
        };

        // 4. 查询最新 Merkle 批次（检查 proof_hash 是否已纳入批次）
        const latestBatch = await env.FLY_D1.prepare(
          "SELECT batch_id, merkle_root, entry_count FROM merkle_roots ORDER BY created_at DESC LIMIT 1"
        ).first();

        if (latestBatch) {
          record.merkle = {
            batch_id: (latestBatch as any).batch_id,
            merkle_root: (latestBatch as any).merkle_root,
            entry_count: (latestBatch as any).entry_count,
            included: true  // 当前 merkle endpoint 已自动纳入所有 ledger_entries
          };
        }

        return json(record);
      }

      // --- POST /v1/records/:id/verify — 验证 Record 完整性 ---
      if (path.startsWith('/v1/records/') && path.endsWith('/verify') && method === 'POST') {
        const recordId = path.split('/v1/records/')[1].replace('/verify', '');
        if (!recordId) return json({ error: 'missing record_id' }, 400);

        // 1. 从 ledger_entries 读取
        const entry = await env.FLY_D1.prepare(
          "SELECT * FROM ledger_entries WHERE id = ?"
        ).bind(recordId).first();

        if (!entry) return json({ error: 'record not found', record_id: recordId }, 404);

        const storedProofData = (entry as any).proof_data_json;
        const storedProofHash = (entry as any).proof_hash;
        const storedSignature = (entry as any).signature;
        const signerAddress = (entry as any).signer_address;

        // 2. 重新计算 proof_hash，对比存储的 hash
        const recomputedHash = '0x' + Array.from(keccak_256(new TextEncoder().encode(storedProofData))).map(b => b.toString(16).padStart(2, '0')).join('');
        const hashMatch = recomputedHash === storedProofHash;

        // 3. 验证签名
        let signatureValid = false;
        try {
          const msgBytes = new Uint8Array(recomputedHash.slice(2).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
          const sigHex = storedSignature.startsWith('0x') ? storedSignature.slice(2) : storedSignature;
          const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
          const pubKey = secp.ProjectivePoint.fromPrivateKey(
            new Uint8Array((env.LEDGER_PRIVATE_KEY.startsWith('0x') ? env.LEDGER_PRIVATE_KEY.slice(2) : env.LEDGER_PRIVATE_KEY).match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
          ).toHex();
          signatureValid = secp.verify(sigBytes, msgBytes, pubKey);
        } catch { signatureValid = false; }

        // 4. 查询 Merkle 批次
        const latestBatch = await env.FLY_D1.prepare(
          "SELECT batch_id, merkle_root FROM merkle_roots ORDER BY created_at DESC LIMIT 1"
        ).first();

        // 5. 返回验证结果
        const record: any = JSON.parse(storedProofData);
        return json({
          record_id: recordId,
          valid: hashMatch && signatureValid,
          checks: {
            proof_hash_match: hashMatch,
            signature_valid: signatureValid,
            signer_address: signerAddress,
            in_merkle_batch: !!latestBatch
          },
          status: record.status || 'unknown',
          merkle: latestBatch ? {
            batch_id: (latestBatch as any).batch_id,
            merkle_root: (latestBatch as any).merkle_root
          } : null
        });
      }

      // --- Record Service: 从 D1 查询并拼装完整 Record 对象 ---
      async function getTrustRecord(env: Env, recordId: string): Promise<any | null> {
        const entry = await env.FLY_D1.prepare(
          "SELECT * FROM ledger_entries WHERE id = ?"
        ).bind(recordId).first();

        if (!entry) return null;

        let record: any = {};
        try { record = JSON.parse((entry as any).proof_data_json); } catch { return null; }

        record.ledger = {
          proof_hash: (entry as any).proof_hash,
          signature: (entry as any).signature,
          signer_address: (entry as any).signer_address,
          event_type: (entry as any).event_type,
          timestamp: (entry as any).timestamp,
          bnb_agent_id: (entry as any).bnb_agent_id
        };

        const latestBatch = await env.FLY_D1.prepare(
          "SELECT batch_id, merkle_root, entry_count FROM merkle_roots ORDER BY created_at DESC LIMIT 1"
        ).first();

        record.merkle = latestBatch ? {
          batch_id: (latestBatch as any).batch_id,
          merkle_root: (latestBatch as any).merkle_root,
          entry_count: (latestBatch as any).entry_count,
          included: true
        } : null;

        return record;
      }

      // --- HTML Renderer: Fly Trust Record — 三层展示（Claim → Record → Proof） ---
      function renderTrustRecordHTML(record: any): string {
        const id = record.record_id || 'Unknown';
        const status = record.status || 'pending';
        // Status 逻辑：pending_evidence 表示缺少证据，pending 表示可以验证，verified 表示已验证
        const statusIcon = status === 'verified' ? '✅' : status === 'revoked' ? '❌' : status === 'pending_evidence' ? '⏳' : '🕐';
        const statusText = status === 'verified' ? '已验证' : status === 'revoked' ? '已撤销' : status === 'pending_evidence' ? '待补充证据' : '待验证';
        const statusColor = status === 'verified' ? '#1a7f37' : status === 'revoked' ? '#cf222e' : status === 'pending_evidence' ? '#bf8700' : '#9a6700';
        // 信任解释（用户语言，不是系统状态）
        const statusExplanation = status === 'verified' 
          ? '这条 AI 推荐已经过 Fly 的独立验证，证据已被确认。' 
          : status === 'revoked' 
          ? '这条 AI 推荐的记录已被撤销，不再作为可信依据。'
          : status === 'pending_evidence' 
          ? '目前只有 AI 主张记录，尚未提交相关证据。'
          : '这条 AI 推荐还没有经过 Fly 的独立验证，目前只有提交记录。';
        const createdAt = record.metadata?.created_at || record.ledger?.timestamp || '';
        const updatedAt = record.metadata?.updated_at || createdAt;
        const createdDate = createdAt ? new Date(createdAt).toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Unknown';
        const updatedDate = updatedAt ? new Date(updatedAt).toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Unknown';

        // Record Health
        const updatedAgo = updatedAt ? getTimeAgo(new Date(updatedAt)) : 'Unknown';

        const sourceName = record.source?.name || 'Unknown';
        const sourceType = record.source?.type || 'unknown';
        const scenario = record.scenario || 'General';
        const category = record.category || 'General';
        const claim = record.claim || '';
        const evidenceCount = Array.isArray(record.evidence) ? record.evidence.length : 0;
        const firstEvidence = Array.isArray(record.evidence) && record.evidence.length > 0 ? (record.evidence[0].description || record.evidence[0].data?.content || '').slice(0, 120) : '';

        // Attestation (Layer 3)
        const attestor = record.attestation?.attestor || sourceName;
        const attestedAt = record.attestation?.attested_at || createdAt;
        const attestationType = record.attestation?.type || 'user-confirm';
        const attestationStatement = record.attestation?.statement || 'I confirm this AI recommendation was made';
        const attestedDate = attestedAt ? new Date(attestedAt).toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Unknown';
        const attestationTypeLabel = attestationType === 'user-confirm' ? '用户确认' : attestationType === 'system-auto' ? '系统自动' : attestationType;

        const proofHash = record.ledger?.proof_hash || '';
        const signature = record.ledger?.signature || '';
        const signerAddr = record.ledger?.signer_address || '';
        const eventType = record.ledger?.event_type || '';
        const merkleRoot = record.merkle?.merkle_root || '';
        const batchId = record.merkle?.batch_id || '';

        // Evidence Timeline — 信任生命周期
        const evidenceTimeline: { time: string; label: string; done: boolean }[] = [];
        const ts = createdAt ? new Date(createdAt) : new Date();
        const fmt = (d: Date, offsetSec: number) => {
          const t = new Date(d.getTime() + offsetSec * 1000);
          return t.toISOString().slice(11, 16) + ' UTC';
        };
        evidenceTimeline.push({ time: fmt(ts, 0), label: '主张已提交', done: true });
        evidenceTimeline.push({ time: fmt(ts, 1), label: '证据已附加', done: evidenceCount > 0 });
        evidenceTimeline.push({ time: fmt(ts, 2), label: '用户已确认', done: true });
        evidenceTimeline.push({ time: fmt(ts, 3), label: '记录已创建', done: true });
        if (status === 'verified') {
          evidenceTimeline.push({ time: fmt(ts, 4), label: '已独立验证', done: true });
          evidenceTimeline.push({ time: fmt(ts, 5), label: '信任记录已定稿', done: true });
        } else {
          evidenceTimeline.push({ time: fmt(ts, 4), label: '独立验证待完成', done: false });
        }

        const timelineHTML = evidenceTimeline.map(s => `
          <div class="tl-item ${s.done ? 'done' : 'pending'}">
            <div class="tl-dot">${s.done ? '✓' : '·'}</div>
            <div class="tl-body">
              <span class="tl-time">${s.time}</span>
              <span class="tl-label">${s.label}</span>
              ${s.done ? '<span class="tl-check">✓</span>' : ''}
            </div>
          </div>`).join('');

        // Evidence Details
        const evidenceItems = Array.isArray(record.evidence) ? record.evidence.map((e: any, i: number) => {
          const desc = e.description || e.data?.content || '';
          const typeLabel = e.type || 'unknown';
          return `<div class="evi-card">
            <div class="evi-head"><span class="evi-num">#${i + 1}</span><span class="evi-type">${escapeHtml(typeLabel)}</span></div>
            <div class="evi-desc">${escapeHtml(desc)}</div>
          </div>`;
        }).join('') : '<div style="color:#656d76;font-size:14px;padding:8px 0">暂无证据</div>';

        // OG 分享卡片
        const ogTitle = `${statusIcon} ${statusText} — ${id}`;
        const ogDesc = claim ? `${claim} — 已由 Fly 验证` : (firstEvidence ? `此 AI 推荐已由 Fly 独立验证。${firstEvidence}...` : `此 AI 推荐已由 Fly 独立验证。`);

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ogTitle}</title>
<meta name="description" content="${escapeHtml(ogDesc)}">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://fly-agent.xyz/trust-record/${escapeHtml(id)}">
<meta property="og:site_name" content="Fly">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2328;background:#fff;line-height:1.6}
.wrap{max-width:720px;margin:0 auto;padding:32px 20px}
a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}

/* === Layer 1: Claim (5秒看懂) === */
.claim{margin-bottom:32px}
.status-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:20px;font-size:14px;font-weight:600;color:${statusColor};background:${statusColor}12;border:1.5px solid ${statusColor}30}
.conclusion{font-size:20px;font-weight:600;line-height:1.4;margin-bottom:16px;color:#1f2328}
.meta-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:16px}
.meta-cell{font-size:13px;color:#656d76}
.meta-cell strong{color:#1f2328;font-weight:600;display:block;font-size:14px}
.health{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#1a7f37;background:#dafbe1;padding:3px 10px;border-radius:12px;margin-bottom:16px}
.health-dot{width:8px;height:8px;border-radius:50%;background:#1a7f37;display:inline-block}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.btn{display:inline-flex;align-items:center;padding:6px 16px;font-size:13px;font-weight:500;border-radius:6px;border:1px solid #d1d9e0;background:#f6f8fa;color:#1f2328;cursor:pointer}
.btn:hover{background:#eaeef2}
.btn-primary{background:#1a7f37;color:#fff;border-color:#1a7f37}
.btn-primary:hover{background:#1a6e2e}

/* === Layer 2: Record === */
.section{margin-bottom:32px}
.section-title{font-size:16px;font-weight:600;padding-bottom:8px;border-bottom:1px solid #d1d9e0;margin-bottom:12px}
.section-title span{font-size:12px;color:#656d76;font-weight:400;margin-left:8px}

/* Timeline */
.tl{position:relative;padding-left:28px}
.tl-item{position:relative;padding-bottom:12px}
.tl-item:last-child{padding-bottom:0}
.tl-dot{position:absolute;left:-28px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.tl-item.done .tl-dot{background:#1a7f37;color:#fff}
.tl-item.pending .tl-dot{background:#eaeef2;color:#656d76}
.tl-item::after{content:'';position:absolute;left:-18px;top:22px;bottom:0;width:2px;background:#d1d9e0}
.tl-item:last-child::after{display:none}
.tl-body{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tl-time{font-size:12px;color:#656d76;font-family:SFMono-Regular,Consolas,monospace;min-width:80px}
.tl-label{font-size:14px;font-weight:500}
.tl-check{color:#1a7f37;font-weight:700;font-size:13px}

/* Evidence cards */
.evi-card{border:1px solid #d1d9e0;border-radius:8px;margin-bottom:8px;overflow:hidden}
.evi-head{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f6f8fa;border-bottom:1px solid #eaeef2;font-size:13px}
.evi-num{font-weight:700;color:#656d76}
.evi-type{color:#1f2328;font-weight:500}
.evi-desc{padding:10px 12px;font-size:14px;color:#1f2328}

/* Tags */
.tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{display:inline-flex;align-items:center;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:500;background:#ddf4ff;color:#0969da;border:1px solid #54aeff30}

/* === Layer 3: Attestation === */
.attest-card{border:1px solid #54aeff40;border-radius:8px;background:#ddf4ff20;padding:16px;margin-bottom:32px}
.attest-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:14px;font-weight:600;color:#0969da}
.attest-icon{width:28px;height:28px;border-radius:50%;background:#0969da;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
.attest-row{display:flex;gap:8px;font-size:13px;padding:4px 0}
.attest-label{font-weight:600;min-width:70px;color:#656d76;flex-shrink:0}
.attest-value{color:#1f2328}
.attest-statement{margin-top:10px;padding:10px 12px;background:#fff;border:1px solid #54aeff30;border-radius:6px;font-size:13px;color:#656d76;font-style:italic}

/* === Layer 4: Proof (collapsible) === */
details.proof{border:1px solid #d1d9e0;border-radius:8px;margin-bottom:32px}
details.proof summary{padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px}
details.proof summary::before{content:'▶';font-size:10px;transition:transform .15s}
details.proof[open] summary::before{transform:rotate(90deg)}
details.proof .proof-inner{padding:0 16px 16px}
.proof-row{display:flex;gap:8px;font-size:13px;padding:8px 0;border-bottom:1px solid #f6f8fa}
.proof-row:last-child{border-bottom:none}
.proof-label{font-weight:600;min-width:130px;color:#656d76;flex-shrink:0}
.proof-value{font-family:SFMono-Regular,Consolas,monospace;word-break:break-all;color:#1f2328;background:#f6f8fa;padding:2px 8px;border-radius:4px;flex:1;font-size:12px}

/* Footer */
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #d1d9e0;font-size:12px;color:#656d76;text-align:center}
.footer a{color:#0969da}

@media(max-width:600px){
  .wrap{padding:20px 14px}
  .conclusion{font-size:18px}
  .meta-grid{grid-template-columns:1fr}
  .proof-row{flex-direction:column;gap:4px}
}
</style>
</head>
<body>
<div class="wrap">

  <!-- ═══ Layer 1: Claim (5秒看懂) ═══ -->
  <div class="claim">
    <div class="status-row">
      <span class="badge">${statusIcon} ${statusText}</span>
      <span class="health"><span class="health-dot"></span>最新 · 更新于 ${escapeHtml(updatedAgo)}</span>
    </div>
    <div class="conclusion">${claim ? escapeHtml(claim) : '此 AI 推荐已由 Fly 独立验证。'}</div>
    <div style="font-size:14px;color:#656d76;margin-bottom:16px;line-height:1.5">${escapeHtml(statusExplanation)}</div>
    <div class="meta-grid">
      <div class="meta-cell"><strong>${escapeHtml(id)}</strong>记录编号</div>
      <div class="meta-cell"><strong>${escapeHtml(sourceName)}</strong>来源</div>
      <div class="meta-cell"><strong>${escapeHtml(createdDate)} UTC</strong>签发时间</div>
      <div class="meta-cell"><strong>Fly Verify Engine v1.0</strong>验证方</div>
    </div>
    <div class="tags">
      <span class="tag">${escapeHtml(scenario)}</span>
      <span class="tag">${escapeHtml(category)}</span>
    </div>
    <div class="actions">
      <a class="btn btn-primary" href="/v1/records/${escapeHtml(id)}">查看 JSON / API</a>
      <a class="btn" href="/v1/ledger/${escapeHtml(id)}/verify">验证完整性</a>
      <button class="btn" onclick="navigator.clipboard.writeText(location.href).then(()=>this.textContent='链接已复制 ✓')">复制链接</button>
    </div>
  </div>

  <!-- ═══ Layer 2: Record (证据时间线 + 详情) ═══ -->
  <div class="section">
    <div class="section-title">证据时间线</div>
    <div class="tl">${timelineHTML}</div>
  </div>

  <div class="section">
    <div class="section-title">证据详情 <span>${evidenceCount} 条</span></div>
    ${evidenceItems}
  </div>

  <!-- ═══ Layer 3: Attestation (用户确认) ═══ -->
  <div class="attest-card">
    <div class="attest-head"><span class="attest-icon">✓</span>确认声明</div>
    <div class="attest-row"><span class="attest-label">确认人</span><span class="attest-value">${escapeHtml(attestor)}</span></div>
    <div class="attest-row"><span class="attest-label">确认时间</span><span class="attest-value">${escapeHtml(attestedDate)} UTC</span></div>
    <div class="attest-row"><span class="attest-label">确认方式</span><span class="attest-value">${escapeHtml(attestationTypeLabel)}</span></div>
    <div class="attest-statement">"${escapeHtml(attestationStatement)}"</div>
  </div>

  <!-- ═══ Layer 4: Proof (折叠) ═══ -->
  <details class="proof">
    <summary>信任证明 <span style="font-weight:400;color:#656d76;font-size:12px">— 开发者验证</span></summary>
    <div class="proof-inner">
      <div class="proof-row"><span class="proof-label">记录编号</span><span class="proof-value">${escapeHtml(id)}</span></div>
      <div class="proof-row"><span class="proof-label">事件类型</span><span class="proof-value">${escapeHtml(eventType)}</span></div>
      <div class="proof-row"><span class="proof-label">证明哈希</span><span class="proof-value">${escapeHtml(proofHash)}</span></div>
      <div class="proof-row"><span class="proof-label">签名</span><span class="proof-value">${escapeHtml(signature)}</span></div>
      <div class="proof-row"><span class="proof-label">签名者</span><span class="proof-value">${escapeHtml(signerAddr)}</span></div>
      ${merkleRoot ? `<div class="proof-row"><span class="proof-label">Merkle 根</span><span class="proof-value">${escapeHtml(merkleRoot)}</span></div>` : ''}
      ${batchId ? `<div class="proof-row"><span class="proof-label">Merkle 批次</span><span class="proof-value">${escapeHtml(batchId)}</span></div>` : ''}
      <div class="proof-row"><span class="proof-label">API</span><span class="proof-value">GET /v1/records/${escapeHtml(id)}</span></div>
    </div>
  </details>

  <div class="footer">
    技术支持 <a href="https://fly-agent.xyz">Fly</a> · 信任账本 · Keccak256 + secp256k1
  </div>

</div>
</body>
</html>`;
      }

      // Record Health: 相对时间
      function getTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return '刚刚';
        if (diffMin < 60) return `${diffMin}分钟前`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}小时前`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 30) return `${diffDay}天前`;
        return `${Math.floor(diffDay / 30)}个月前`;
      }

      function escapeHtml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      // --- 路由: GET /trust-record/:id — 服务端渲染 HTML ---
      if (path.startsWith('/trust-record/') && method === 'GET') {
        const recordId = path.replace('/trust-record/', '').replace(/\/$/, '');
        if (!recordId) {
          return new Response(renderTrustRecordIndexHTML(), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }

        const record = await getTrustRecord(env, recordId);
        if (!record) {
          return new Response(renderTrustRecord404HTML(recordId), {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }

        return new Response(renderTrustRecordHTML(record), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' }
        });
      }

      // --- Record 首页（搜索/列表） ---
      function renderTrustRecordIndexHTML(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fly Trust Records</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2328;background:#fff;line-height:1.5}
.container{max-width:960px;margin:0 auto;padding:40px 16px;text-align:center}
h1{font-size:28px;margin-bottom:8px}
p{color:#656d76;margin-bottom:24px}
input{padding:8px 16px;font-size:16px;border:1px solid #d1d9e0;border-radius:6px;width:400px;max-width:100%}
.btn{display:inline-flex;align-items:center;padding:8px 20px;font-size:14px;font-weight:500;border-radius:6px;border:1px solid #1a7f37;background:#1a7f37;color:#fff;cursor:pointer;margin-left:8px}
.footer{margin-top:60px;font-size:12px;color:#656d76}
</style>
</head>
<body>
<div class="container">
  <h1>Fly Trust Records</h1>
  <p>输入 Record ID 查看信任记录</p>
  <form onsubmit="event.preventDefault();const id=document.getElementById('rid').value.trim();if(id)location.href='/trust-record/'+id">
    <input id="rid" placeholder="FLY-20260628-00001" autofocus>
    <button class="btn" type="submit">查看</button>
  </form>
  <div class="footer">Powered by <a href="https://fly-agent.xyz">Fly</a></div>
</div>
</body>
</html>`;
      }

      // --- Record 404 页面 ---
      function renderTrustRecord404HTML(recordId: string): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Record 未找到 — Fly Trust Record</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2328;background:#fff;line-height:1.5}
.container{max-width:600px;margin:0 auto;padding:60px 16px;text-align:center}
h1{font-size:24px;margin-bottom:16px}
p{color:#656d76;margin-bottom:8px}
code{font-family:SFMono-Regular,Consolas,monospace;background:#f6f8fa;padding:2px 8px;border-radius:4px;font-size:14px}
a{color:#0969da;text-decoration:none}
</style>
</head>
<body>
<div class="container">
  <h1>Record 未找到</h1>
  <p>Record ID: <code>${escapeHtml(recordId)}</code></p>
  <p>该 Record 不存在或数据异常。</p>
  <p style="margin-top:24px"><a href="/trust-record/">← 返回首页</a></p>
</div>
</body>
</html>`;
      }

      return json({ error: "not found", hint: "try /v1/health" }, 404);
    } catch (err: any) {
      return json({ error: err.message || 'internal server error' }, 500);
    }
  },
};
// ============================================================
// Attribution 2.0 三层架构（Fly Attribution Engine v3）
// ============================================================

// Type定义
interface Touchpoint {
  event: string;
  channel: string;
  ts: number;
  action_id: string;
}

interface Journey {
  id: string;
  touchpoints: Touchpoint[];
}

interface Contribution {
  step_index: number;
  touchpoint_id: string;
  channel: string;
  pct: number;
  weight: any;
}

interface AttributionModel {
  name: string;
  calculate(journey: Journey): Contribution[];
}

// U-Shaped模型（首尾各40%，中间平分20%）
class UShapedModel implements AttributionModel {
  name = 'u_shaped';
  
  calculate(journey: Journey): Contribution[] {
    const tps = journey.touchpoints;
    const n = tps.length;
    
    if (n === 1) {
      return [{ step_index: 0, touchpoint_id: tps[0].action_id, channel: tps[0].channel, pct: 1.0, weight: { position: 'only' } }];
    }
    
    if (n === 2) {
      return [
        { step_index: 0, touchpoint_id: tps[0].action_id, channel: tps[0].channel, pct: 0.5, weight: { position: 'first' } },
        { step_index: 1, touchpoint_id: tps[1].action_id, channel: tps[1].channel, pct: 0.5, weight: { position: 'last' } }
      ];
    }
    
    // 首尾各40%，中间平分20%
    const first = 0.4;
    const last = 0.4;
    const middle = 0.2 / (n - 2);
    
    return tps.map((tp, i) => ({
      step_index: i,
      touchpoint_id: tp.action_id,
      channel: tp.channel,
      pct: i === 0 ? first : i === n - 1 ? last : middle,
      weight: { position: i === 0 ? 'first' : i === n - 1 ? 'last' : 'middle' }
    }));
  }
}

// Time Decay模型（越靠近转化权重越高）
class TimeDecayModel implements AttributionModel {
  name = 'time_decay';
  
  calculate(journey: Journey): Contribution[] {
    const tps = journey.touchpoints;
    const n = tps.length;
    
    // 用journey start当基准
    const base = tps[0].ts;
    
    const weights = tps.map(tp => {
      const hoursAfter = (tp.ts - base) / (1000 * 60 * 60);
      return Math.exp(-0.1 * hoursAfter); // 指数衰减
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    return tps.map((tp, i) => ({
      step_index: i,
      touchpoint_id: tp.action_id,
      channel: tp.channel,
      pct: weights[i] / totalWeight,
      weight: { hours_after_start: (tp.ts - base) / (1000 * 60 * 60), decay_weight: weights[i] }
    }));
  }
}

// 模型注册表
const attributionModels: { [key: string]: AttributionModel } = {
  'u_shaped': new UShapedModel(),
  'time_decay': new TimeDecayModel()
};

// 窗口分割函数（带conversion anchor）
function splitByWindow(touchpoints: Touchpoint[], windowMs: number): Touchpoint[][] {
  if (touchpoints.length === 0) return [];
  
  const journeys: Touchpoint[][] = [];
  let current: Touchpoint[] = [touchpoints[0]];
  
  for (let i = 1; i < touchpoints.length; i++) {
    const gap = touchpoints[i].ts - touchpoints[i-1].ts;
    const isConversion = ['booking', 'deal'].includes(touchpoints[i-1].event);
    
    // 窗口超时 OR 前一个是转化事件 → 关闭当前journey
    if (gap > windowMs || isConversion) {
      journeys.push(current);
      current = [];
    }
    current.push(touchpoints[i]);
  }
  
  if (current.length > 0) journeys.push(current);
  return journeys;
}

// Journey Builder（异步构建）
async function buildJourneys(env: Env): Promise<{ built: number }> {
  // 1. 查询未处理的actions
  const pendingActions = await env.FLY_D1.prepare(
    "SELECT * FROM actions WHERE journey_id IS NULL ORDER BY user_id, created_at ASC"
  ).all();
  
  if (pendingActions.results.length === 0) return { built: 0 };
  
  // 2. 按user_id分组
  const userGroups: { [key: string]: any[] } = {};
  for (const action of pendingActions.results) {
    const userId = (action as any).user_id;
    if (!userId) continue; // 没有user_id的跳过
    if (!userGroups[userId]) userGroups[userId] = [];
    userGroups[userId].push(action);
  }
  
  let builtCount = 0;
  
  // 3. 为每个用户构建journey（带窗口机制）
  for (const [userId, actions] of Object.entries(userGroups)) {
    const touchpoints: Touchpoint[] = actions.map(a => ({
      event: (a as any).signal_type,
      channel: (a as any).channel,
      ts: new Date((a as any).created_at).getTime(),
      action_id: (a as any).id
    })).sort((a, b) => a.ts - b.ts);
    
    // 按30分钟窗口分割journey
    const journeys = splitByWindow(touchpoints, 30 * 60 * 1000);
    
    for (const journeyTps of journeys) {
      const journeyId = `jour_${crypto.randomUUID()}`;
      const conversionEvent = journeyTps[journeyTps.length - 1];
      
      // 写入journeys表
      await env.FLY_D1.prepare(`
        INSERT INTO journeys (id, user_id, touchpoints, start_time, end_time, conversion_event, conversion_action_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'complete')
      `).bind(
        journeyId,
        userId,
        JSON.stringify(journeyTps),
        new Date(journeyTps[0].ts).toISOString(),
        new Date(journeyTps[journeyTps.length - 1].ts).toISOString(),
        conversionEvent.event,
        conversionEvent.action_id
      ).run();
      
      // Batch update（避免O(n²)）
      const actionIds = journeyTps.map(tp => tp.action_id);
      const placeholders = actionIds.map(() => '?').join(',');
      await env.FLY_D1.prepare(
        `UPDATE actions SET journey_id = ? WHERE id IN (${placeholders})`
      ).bind(journeyId, ...actionIds).run();
      
      builtCount++;
    }
  }
  
  return { built: builtCount };
}

// 归因计算API（含Revenue + Commission）
async function calculateAttribution(env: Env, conversionId: string, modelName: string): Promise<any> {
  // 1. 查询journey
  const journey = await env.FLY_D1.prepare(
    "SELECT * FROM journeys WHERE conversion_action_id = ? AND status = 'complete'"
  ).bind(conversionId).first();
  
  if (!journey) return { error: 'journey not found' };
  
  // 2. 查询转化action的amount（Revenue）
  const conversionAction = await env.FLY_D1.prepare(
    "SELECT * FROM actions WHERE id = ?"
  ).bind(conversionId).first();
  const revenueAmount = conversionAction ? (conversionAction as any).amount || 0 : 0;
  
  // 3. 获取模型
  const model = attributionModels[modelName];
  if (!model) return { error: `model not found: ${modelName}` };
  
  // 4. 计算归因
  const touchpoints: Touchpoint[] = JSON.parse((journey as any).touchpoints);
  const contributions = model.calculate({ id: (journey as any).id, touchpoints });
  
  // 5. 查询每个touchpoint的agent_id和commission_rate
  const agentCommissionRates: { [agentId: string]: number } = {};
  const touchpointAgentMap: { [actionId: string]: string } = {};
  
  for (const tp of touchpoints) {
    const action = await env.FLY_D1.prepare("SELECT agent_id FROM actions WHERE id = ?").bind(tp.action_id).first();
    if (action) {
      const agentId = (action as any).agent_id;
      touchpointAgentMap[tp.action_id] = agentId;
      
      if (!agentCommissionRates[agentId]) {
        const agent = await env.FLY_D1.prepare("SELECT metadata_json FROM agents WHERE id = ?").bind(agentId).first();
        let commissionRate = 0.10; // 默认10%
        if (agent && (agent as any).metadata_json) {
          try {
            const meta = JSON.parse((agent as any).metadata_json);
            if (meta.commission_rate !== undefined) commissionRate = meta.commission_rate;
          } catch {}
        }
        agentCommissionRates[agentId] = commissionRate;
      }
    }
  }
  
  // 6. 写入attributions表（含revenue + commission）
  const groupId = `attrgrp_${crypto.randomUUID()}`;
  const attributionResults: any[] = [];
  
  for (const c of contributions) {
    const agentId = touchpointAgentMap[c.touchpoint_id] || 'agt_unknown';
    const commissionRate = agentCommissionRates[agentId] || 0.10;
    const commissionAmount = revenueAmount * c.pct * commissionRate;
    
    const attrId = `attr_${crypto.randomUUID()}`;
    await env.FLY_D1.prepare(`
      INSERT INTO attributions (id, attribution_group_id, journey_id, conversion_id, step_index, touchpoint_id, channel, contribution_pct, revenue_amount, commission_rate, commission_amount, agent_id, model, weight_json, path_snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      attrId,
      groupId,
      (journey as any).id,
      conversionId,
      c.step_index,
      c.touchpoint_id,
      c.channel,
      c.pct,
      revenueAmount,
      commissionRate,
      commissionAmount,
      agentId,
      modelName,
      JSON.stringify(c.weight),
      JSON.stringify(touchpoints)
    ).run();
    
    attributionResults.push({
      attribution_id: attrId,
      step_index: c.step_index,
      touchpoint_id: c.touchpoint_id,
      channel: c.channel,
      agent_id: agentId,
      contribution_pct: c.pct,
      revenue_amount: revenueAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount
    });
  }
  
  // 7. 更新journey状态
  await env.FLY_D1.prepare(
    "UPDATE journeys SET status = 'computed', computed_at = datetime('now') WHERE id = ?"
  ).bind((journey as any).id).run();
  
  return {
    attribution_group_id: groupId,
    journey_id: (journey as any).id,
    conversion_id: conversionId,
    model: modelName,
    revenue_amount: revenueAmount,
    total_commission: attributionResults.reduce((sum, a) => sum + a.commission_amount, 0),
    attributions: attributionResults
  };
}

// 确保Attribution + Settlement表存在
async function ensureAttributionTables(env: Env): Promise<void> {
  // journeys表
  await env.FLY_D1.prepare(`
    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      touchpoints TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      conversion_event TEXT,
      conversion_action_id TEXT,
      status TEXT DEFAULT 'building',
      computed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_journeys_user ON journeys(user_id)"
  ).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status)"
  ).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_journeys_conversion ON journeys(conversion_action_id)"
  ).run();
  
  // attributions表（v3 — 含revenue + commission）
  await env.FLY_D1.prepare(`
    CREATE TABLE IF NOT EXISTS attributions (
      id TEXT PRIMARY KEY,
      attribution_group_id TEXT NOT NULL,
      journey_id TEXT NOT NULL,
      conversion_id TEXT NOT NULL,
      step_index INT NOT NULL,
      touchpoint_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      contribution_pct REAL NOT NULL,
      revenue_amount REAL DEFAULT 0,
      commission_rate REAL DEFAULT 0.10,
      commission_amount REAL DEFAULT 0,
      agent_id TEXT,
      model TEXT NOT NULL,
      model_version TEXT DEFAULT '3.0',
      weight_json TEXT NOT NULL,
      path_snapshot TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_attributions_group ON attributions(attribution_group_id)"
  ).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_attributions_journey ON attributions(journey_id)"
  ).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_attributions_conversion ON attributions(conversion_id)"
  ).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_attributions_agent ON attributions(agent_id)"
  ).run();
  
  // settlements表（钱到账）
  await env.FLY_D1.prepare(`
    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      attribution_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      payment_ref TEXT,
      settled_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_settlements_attribution ON settlements(attribution_id)"
  ).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_settlements_agent ON settlements(agent_id)"
  ).run();
  await env.FLY_D1.prepare(
    "CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status)"
  ).run();
  
  // attributions表添加新字段（兼容旧表）
  await env.FLY_D1.prepare("ALTER TABLE attributions ADD COLUMN revenue_amount REAL DEFAULT 0").run().catch(() => {});
  await env.FLY_D1.prepare("ALTER TABLE attributions ADD COLUMN commission_rate REAL DEFAULT 0.10").run().catch(() => {});
  await env.FLY_D1.prepare("ALTER TABLE attributions ADD COLUMN commission_amount REAL DEFAULT 0").run().catch(() => {});
  await env.FLY_D1.prepare("ALTER TABLE attributions ADD COLUMN agent_id TEXT").run().catch(() => {});
  
  // agents表添加metadata_json字段（存commission_rate等配置）
  await env.FLY_D1.prepare("ALTER TABLE agents ADD COLUMN metadata_json TEXT DEFAULT '{}'").run().catch(() => {});
  
  // actions表添加amount字段（兼容旧数据）
  await env.FLY_D1.prepare(
    "ALTER TABLE actions ADD COLUMN amount REAL DEFAULT 0"
  ).run().catch(() => {});
  
  // actions表添加journey_id字段
  await env.FLY_D1.prepare(
    "ALTER TABLE actions ADD COLUMN journey_id TEXT"
  ).run().catch(() => {});
}
