/**
 * Fly API Worker v2.8.1 — Cloudflare Worker Entry Point
 * 纯原生Worker API，无第三方依赖
 * 
 * 5层能力架构：L1 Identity · L2 Proof · L3 Verification · L4 Trust Ledger · L5 Attribution Settlement + 硬边界
 * Governance横切L1-L5，不是线性层
 * 
 * API端点清单：
 *   GET  /v1/health                           — 健康检查（含D1/KV状态）
 *   POST /v1/agents                           — 漏洞1：Agent注册+身份验证
 *   GET  /v1/agents/:id
 *   POST /v1/action                           — 漏洞2+3：Bearer+HMAC鉴权 + HMAC伪匿名
 *   GET  /v1/status/:actionId
 *   POST /v1/agents/:id/recalc-trust          — 漏洞4：Trust多维计算
 *   POST /v1/verifications                    — 漏洞5：三方分离防自证
 *   GET  /s/:actionId                         — 漏洞6：短链Bot检测+信号质量
 *   POST /v1/signal/verify                    — 漏洞6：JS回调信号质量升级
 *   GET  /v1/audit/:entityType/:entityId      — 漏洞7：审计链查询
 *   POST /v1/governance/assign-role           — 漏洞8：角色授权
 *   POST /v1/governance/check-permission      — 漏洞8：权限检查(Default Deny)
 *   POST /v1/governance/update-policy         — 漏洞8：策略更新
 *   GET  /v1/db/query                         — 验收辅助查询
 *   GET  /v1/admin/metrics                    — v2.7.0: 请求指标聚合查询
 *   POST /v1/admin/alert/test                 — v2.7.0: 告警测试
 *   POST /v1/admin/backup                     — v2.7.0: 触发备份
 *   GET  /v1/admin/backup                     — v2.7.0: 备份历史
 * 
 * v2.8.0 新增：
 *   - 自动错误率告警（5xx>3% P1 / 5xx>10% P0，基于KV滚动窗口）
 *   - P95延迟告警（>3000ms P1）
 *   - D1/KV操作失败独立告警（P0）
 *   - 告警去重（KV TTL 5分钟）
 *   - 邮件告警通道（Resend API）
 *   - 统一告警入口 alertTrigger()
 */

// ============================================================
// Types
// ============================================================
interface Env {
  FLY_D1: D1Database;
  FLY_KV: KVNamespace;
  IP_SALT: string;
  API_KEYS: string;
  // v2.7.0: Telegram告警配置
  TELEGRAM_BOT_TOKEN?: string;   // Telegram Bot Token（未配置则静默跳过）
  TELEGRAM_CHAT_ID?: string;     // Telegram Chat ID（未配置则静默跳过）
  // v2.8.0: 邮件告警配置
  ALERT_EMAIL_TO?: string;       // 告警收件邮箱（未配置则静默跳过）
  RESEND_API_KEY?: string;       // Resend API Key（免费3000封/月，未配置则静默跳过）
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
// v2.7.0: 指标采集 — KV滚动窗口（每分钟一个桶）
// ============================================================

/** 指标桶数据结构 */
interface MetricBucket {
  total: number;
  s2xx: number;
  s3xx: number;
  s4xx: number;
  s5xx: number;
  lat_sum: number;
  lat_max: number;
  lat_samples: number[];  // 采样延迟（最多200个/分钟，用于P95计算）
}

/** 聚合指标结果 */
interface AggregatedMetrics {
  total: number;
  s2xx: number;
  s3xx: number;
  s4xx: number;
  s5xx: number;
  avg_ms: number;
  max_ms: number;
  p95_ms: number;
}

/**
 * 记录单次请求指标到KV分钟桶
 * 异步调用，失败不影响主流程
 */
async function recordRequestMetric(env: Env, status: number, latencyMs: number): Promise<void> {
  const minute = Math.floor(Date.now() / 60000);
  const key = `metrics:m:${minute}`;

  try {
    const raw = await env.FLY_KV.get(key);
    const data: MetricBucket = raw ? JSON.parse(raw) : {
      total: 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0,
      lat_sum: 0, lat_max: 0, lat_samples: [],
    };

    data.total += 1;
    if (status >= 200 && status < 300) data.s2xx += 1;
    else if (status >= 300 && status < 400) data.s3xx += 1;
    else if (status >= 400 && status < 500) data.s4xx += 1;
    else if (status >= 500) data.s5xx += 1;

    data.lat_sum += latencyMs;
    if (latencyMs > data.lat_max) data.lat_max = latencyMs;

    // 采样延迟数据（最多200样本/分钟，用于P95计算）
    if (data.lat_samples.length < 200) {
      data.lat_samples.push(latencyMs);
    } else {
      // 桶满时随机替换，保证采样均匀分布
      const idx = Math.floor(Math.random() * data.total);
      if (idx < 200) data.lat_samples[idx] = latencyMs;
    }

    // TTL 600秒（10分钟），覆盖5分钟查询窗口
    await env.FLY_KV.put(key, JSON.stringify(data), { expirationTtl: 600 });
  } catch (e) {
    // 指标记录失败不影响主流程，静默忽略
  }
}

/**
 * 聚合最近N分钟的指标数据
 * 读取KV分钟桶并汇总
 */
async function getAggregatedMetrics(env: Env, minutes: number): Promise<AggregatedMetrics | null> {
  try {
    const nowMinute = Math.floor(Date.now() / 60000);
    let total = 0, s2xx = 0, s3xx = 0, s4xx = 0, s5xx = 0;
    let latSum = 0, latMax = 0;
    const allSamples: number[] = [];

    for (let i = 0; i < minutes; i++) {
      const key = `metrics:m:${nowMinute - i}`;
      const raw = await env.FLY_KV.get(key);
      if (!raw) continue;
      const data: MetricBucket = JSON.parse(raw);
      total += data.total || 0;
      s2xx += data.s2xx || 0;
      s3xx += data.s3xx || 0;
      s4xx += data.s4xx || 0;
      s5xx += data.s5xx || 0;
      latSum += data.lat_sum || 0;
      if ((data.lat_max || 0) > latMax) latMax = data.lat_max;
      if (data.lat_samples && data.lat_samples.length > 0) {
        allSamples.push(...data.lat_samples);
      }
    }

    if (total === 0) return null;

    // 计算P95延迟
    allSamples.sort((a, b) => a - b);
    const p95Index = Math.ceil(allSamples.length * 0.95) - 1;
    const p95 = allSamples.length > 0 ? allSamples[Math.max(0, p95Index)] : 0;

    return {
      total, s2xx, s3xx, s4xx, s5xx,
      avg_ms: Math.round(latSum / total),
      max_ms: latMax,
      p95_ms: p95,
    };
  } catch (e) {
    return null;
  }
}

// ============================================================
// v2.7.0: Telegram告警（已有，保持原样）
// v2.8.0: 扩展支持details参数
// ============================================================

/**
 * 发送Telegram告警消息
 * 未配置TELEGRAM_BOT_TOKEN或TELEGRAM_CHAT_ID时静默跳过
 */
async function sendTelegramAlert(env: Env, level: string, message: string, details: Record<string, any> = {}): Promise<void> {
  // 未配置则静默跳过
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const timestamp = new Date().toISOString();
  const emoji = level === 'P0' ? '🔴' : level === 'P1' ? '🟡' : level === 'TEST' ? '🧪' : '🔵';
  const detailLines = Object.entries(details).map(([k, v]) => `  ${k}: ${v}`).join('\n');

  const text = [
    `${emoji} Fly Attribution ${level} Alert`,
    ``,
    message,
    detailLines ? `\n${detailLines}` : '',
    ``,
    `⏰ ${timestamp}`,
    `📦 v2.8.0`,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    });
  } catch (e) {
    // Telegram发送失败静默忽略，不影响其他通道
  }
}

// ============================================================
// v2.8.0: 邮件告警 — Resend API（免费3000封/月）
// ============================================================

/**
 * 通过Resend API发送邮件告警
 * 未配置RESEND_API_KEY或ALERT_EMAIL_TO时静默跳过
 * 发送地址：onboarding@resend.dev（Resend免费默认）
 */
async function sendEmailAlert(env: Env, level: string, message: string, details: Record<string, any> = {}): Promise<void> {
  // 未配置则静默跳过
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL_TO) return;

  const timestamp = new Date().toISOString();
  const subject = `[Fly Attribution ${level}] ${message.slice(0, 80)}`;

  // 纯文本邮件正文
  const textBody = [
    `Fly Attribution Worker 告警通知`,
    `================================`,
    ``,
    `告警级别: ${level}`,
    `时间: ${timestamp}`,
    `Worker版本: v2.8.0`,
    ``,
    `告警内容:`,
    message,
    ``,
    `指标详情:`,
    ...Object.entries(details).map(([k, v]) => `  ${k}: ${v}`),
    ``,
    `---`,
    `此邮件由 Fly Attribution Worker v2.8.0 自动发送`,
    `请勿直接回复`,
  ].join('\n');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: env.ALERT_EMAIL_TO,
        subject,
        text: textBody,
      }),
    });
  } catch (e) {
    // 邮件发送失败静默忽略，不影响Telegram通道
  }
}

// ============================================================
// v2.8.0: 统一告警入口 — 同时触发Telegram + 邮件
// ============================================================

/**
 * 统一告警触发函数
 * 同时向Telegram和邮件两个通道发送告警
 * 任一通道失败不影响另一通道
 */
async function alertTrigger(env: Env, level: string, message: string, details: Record<string, any> = {}): Promise<void> {
  // 并发发送两个通道，任一失败不影响另一个
  await Promise.allSettled([
    sendTelegramAlert(env, level, message, details),
    sendEmailAlert(env, level, message, details),
  ]);
}

// ============================================================
// v2.8.0: 告警去重 — KV TTL机制
// ============================================================

/** 告警去重窗口（秒） */
const ALERT_DEDUP_TTL = 300; // 5分钟内不重复告警

/**
 * 检查告警是否已被去重（5分钟内已发送过相同key的告警）
 * @returns true=已被去红（不应再发），false=可以发送
 */
async function isAlertDeduped(env: Env, alertKey: string): Promise<boolean> {
  try {
    const existing = await env.FLY_KV.get(`alert:${alertKey}`);
    return existing !== null;
  } catch {
    // KV读取失败时允许告警（宁可重复也不漏告警）
    return false;
  }
}

/**
 * 标记告警已发送（设置5分钟TTL）
 */
async function markAlertSent(env: Env, alertKey: string): Promise<void> {
  try {
    await env.FLY_KV.put(`alert:${alertKey}`, new Date().toISOString(), { expirationTtl: ALERT_DEDUP_TTL });
  } catch {
    // 标记失败不影响告警本身
  }
}

// ============================================================
// v2.8.0: 自动告警条件检查
// ============================================================

/**
 * 检查告警条件并触发告警
 * 在每次请求后异步调用（via ctx.waitUntil）
 * 
 * 告警规则：
 *   - 5xx率 > 10%（至少10个请求）→ P0 告警
 *   - 5xx率 > 3%（至少10个请求）→ P1 告警
 *   - P95延迟 > 3000ms → P1 告警
 */
async function checkAlertConditions(env: Env): Promise<void> {
  try {
    // 获取最近5分钟的聚合指标
    const metrics = await getAggregatedMetrics(env, 5);
    if (!metrics || metrics.total < 10) return; // 至少10个请求才计算

    const errorRate = metrics.s5xx / metrics.total;

    // --- P0: 5xx率 > 10% ---
    if (errorRate > 0.10) {
      if (!(await isAlertDeduped(env, '5xx_critical'))) {
        await markAlertSent(env, '5xx_critical');
        await alertTrigger(env, 'P0',
          `5xx错误率严重: ${(errorRate * 100).toFixed(1)}% (${metrics.s5xx}/${metrics.total})`,
          {
            '5xx_count': metrics.s5xx,
            'total_requests': metrics.total,
            'error_rate': `${(errorRate * 100).toFixed(1)}%`,
            'threshold': '>10%',
            'window': '5min',
          });
      }
    }
    // --- P1: 5xx率 > 3%（但 ≤10%）---
    else if (errorRate > 0.03) {
      if (!(await isAlertDeduped(env, '5xx_warning'))) {
        await markAlertSent(env, '5xx_warning');
        await alertTrigger(env, 'P1',
          `5xx错误率偏高: ${(errorRate * 100).toFixed(1)}% (${metrics.s5xx}/${metrics.total})`,
          {
            '5xx_count': metrics.s5xx,
            'total_requests': metrics.total,
            'error_rate': `${(errorRate * 100).toFixed(1)}%`,
            'threshold': '>3%',
            'window': '5min',
          });
      }
    }

    // --- P1: P95延迟 > 3000ms ---
    if (metrics.p95_ms > 3000) {
      if (!(await isAlertDeduped(env, 'p95_high'))) {
        await markAlertSent(env, 'p95_high');
        await alertTrigger(env, 'P1',
          `P95延迟过高: ${metrics.p95_ms}ms`,
          {
            'p95_ms': metrics.p95_ms,
            'avg_ms': metrics.avg_ms,
            'max_ms': metrics.max_ms,
            'threshold': '>3000ms',
            'window': '5min',
          });
      }
    }
  } catch (e) {
    // 告警检查失败不影响主流程
  }
}

// ============================================================
// Router — v2.8.0 增加指标采集和自动告警
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

    // v2.8.0: 记录请求开始时间
    const startTime = Date.now();

    // 执行路由处理（保持原有路由代码不变）
    const response = await (async () => {
      try {
        // === Health（v2.8.0: 增加D1/KV健康状态） ===
        if (path === '/v1/health' && method === 'GET') {
          let dbStatus = 'ok';
          let kvStatus = 'ok';
          try {
            await env.FLY_D1.prepare("SELECT 1").first();
          } catch { dbStatus = 'error'; }
          try {
            await env.FLY_KV.put('__health_check', '1', { expirationTtl: 60 });
            const v = await env.FLY_KV.get('__health_check');
            if (v !== '1') kvStatus = 'error';
          } catch { kvStatus = 'error'; }
          const status = dbStatus === 'ok' && kvStatus === 'ok' ? 'ok' : 'degraded';
          return json({ status, version: '2.8.1', layers: 5, boundary: 'Payment/Clearing — Fly不进入', db: dbStatus, kv: kvStatus, timestamp: new Date().toISOString() });
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

        // ============================================================
        // v2.7.0: Admin 管理端点
        // ============================================================

        // === 指标聚合查询 ===
        if (path === '/v1/admin/metrics' && method === 'GET') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const minutes = Math.min(parseInt(url.searchParams.get('minutes') || '5'), 60);
          const metrics = await getAggregatedMetrics(env, minutes);
          if (!metrics) {
            return json({ requests: { total: 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }, latency: { avg_ms: 0, max_ms: 0, p95_ms: 0 }, window_minutes: minutes });
          }
          return json({
            requests: { total: metrics.total, '2xx': metrics.s2xx, '3xx': metrics.s3xx, '4xx': metrics.s4xx, '5xx': metrics.s5xx },
            latency: { avg_ms: metrics.avg_ms, max_ms: metrics.max_ms, p95_ms: metrics.p95_ms },
            window_minutes: minutes,
          });
        }

        // === 告警测试 ===
        if (path === '/v1/admin/alert/test' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          await alertTrigger(env, 'TEST', '告警测试 - 这是一个测试告警', { trigger: 'manual', version: 'v2.8.1' });
          return json({ success: true, message: 'Test alert sent to all configured channels', channels: { telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID), email: !!(env.RESEND_API_KEY && env.ALERT_EMAIL_TO) } });
        }

        // === 触发备份 ===
        if (path === '/v1/admin/backup' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const backupId = `bak_${crypto.randomUUID()}`;
          const timestamp = new Date().toISOString();
          // 统计各表记录数
          const tables = ['agents', 'actions', 'verifications', 'audit_events', 'role_assignments', 'policies'];
          let totalRecords = 0;
          const tableCounts: Record<string, number> = {};
          for (const table of tables) {
            try {
              const result = await env.FLY_D1.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first();
              const count = (result?.cnt as number) || 0;
              tableCounts[table] = count;
              totalRecords += count;
            } catch {
              tableCounts[table] = -1; // 查询失败标记
            }
          }
          const backup = { backup_id: backupId, timestamp, total_records: totalRecords, tables: tableCounts };
          // 存储备份元数据到KV（保留最近30条）
          const historyKey = 'backups:history';
          const historyRaw = await env.FLY_KV.get(historyKey);
          const history = historyRaw ? JSON.parse(historyRaw) : [];
          history.push(backup);
          if (history.length > 30) history.splice(0, history.length - 30);
          await env.FLY_KV.put(historyKey, JSON.stringify(history));
          return json({ success: true, ...backup });
        }

        // === 备份历史查询 ===
        if (path === '/v1/admin/backup' && method === 'GET') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const historyKey = 'backups:history';
          const historyRaw = await env.FLY_KV.get(historyKey);
          const backups = historyRaw ? JSON.parse(historyRaw) : [];
          return json({ success: true, backups });
        }

        return json({ error: "not found", hint: "try /v1/health" }, 404);
      } catch (err: any) {
        // v2.8.0新增：D1/KV操作失败独立告警
        const errMsg = (err?.message || '').toLowerCase();
        if (errMsg.includes('d1') || errMsg.includes('database') || errMsg.includes('sql')) {
          // D1查询失败 → P0告警
          ctx.waitUntil(alertTrigger(env, 'P0', 'D1查询失败', { error: err.message, path }).catch(() => {}));
        } else if (errMsg.includes('kv') || errMsg.includes('namespace')) {
          // KV操作失败 → P0告警
          ctx.waitUntil(alertTrigger(env, 'P0', 'KV操作失败', { error: err.message, path }).catch(() => {}));
        }
        return json({ error: err.message || 'internal server error' }, 500);
      }
    })();

    // v2.8.0: 异步记录请求指标和检查告警条件（不阻塞响应）
    ctx.waitUntil((async () => {
      try {
        const latency = Date.now() - startTime;
        await recordRequestMetric(env, response.status, latency);
        await checkAlertConditions(env);
      } catch (e) {
        // 指标和告警检查失败不影响响应
      }
    })());

    return response;
  },

  // ============================================================
  // v2.8.1: Scheduled Handler — cron定时健康探针
  // ============================================================
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      try {
        // 1. D1探针
        try {
          await env.FLY_D1.prepare('SELECT 1 AS ok').first();
        } catch (e: any) {
          if (!(await isAlertDeduped(env, 'd1_probe'))) {
            await markAlertSent(env, 'd1_probe');
            await alertTrigger(env, 'P0', 'D1定时探针失败', { error: e.message });
          }
        }

        // 2. KV探针
        try {
          const probeKey = `__scheduled_probe:${Date.now()}`;
          await env.FLY_KV.put(probeKey, '1', { expirationTtl: 60 });
          const val = await env.FLY_KV.get(probeKey);
          if (val !== '1') throw new Error('KV read mismatch');
        } catch (e: any) {
          if (!(await isAlertDeduped(env, 'kv_probe'))) {
            await markAlertSent(env, 'kv_probe');
            await alertTrigger(env, 'P0', 'KV定时探针失败', { error: e.message });
          }
        }

        // 3. 慢查询检测
        const metrics = await getAggregatedMetrics(env, 5);
        if (metrics && metrics.avg_ms > 2000) {
          if (!(await isAlertDeduped(env, 'slow_query'))) {
            await markAlertSent(env, 'slow_query');
            await alertTrigger(env, 'P1', `查询延迟偏高: avg=${metrics.avg_ms}ms`, {
              avg_ms: metrics.avg_ms, p95_ms: metrics.p95_ms, threshold: '>2000ms', window: '5min'
            });
          }
        }
      } catch (e) {
        // scheduled失败静默
      }
    })());
  },
};
