/**
 * Fly API Worker v2.15.0 — Cloudflare Worker Entry Point
 * 纯原生Worker API，无第三方依赖
 * 
 * 8层6协议架构：L1-L8
 * 6协议：AIP + FSS + FVP + ATP + FGP + ALP
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
 *   GET  /v1/proof/:actionId                  — v2.9.0: 归因链证明生成（Gate 3）
 *   POST /v1/backup/d1                        — v2.10.0: D1 SQL 备份存储
 *   GET  /v1/backup/d1/list                   — v2.11.0: 备份历史记录列表
 *   GET  /v1/backup/d1/{backup_id}            — v2.11.0: 下载指定备份 SQL
 *   POST /v1/backup/d1/restore/{backup_id}    — v2.13.0: Dry-run 恢复计划
 *   GET  /v1/backup/d1/verify                 — v2.10.0: D1 备份完整性验证
 * 
 * v2.15.0 新增（Third-party Replay API）：
 *   POST /v1/replay                           — 事件流重放→CTRS Report（确定性、无状态、无需鉴权）
 *   POST /v1/replay/verify                    — 验证Report可通过重放重建（硬约束③）
 *
 * v2.14.0 新增（External Event Layer）：
 *   POST /v1/webhooks/stripe                  — Stripe Webhook事件接收+签名验证
 *   POST /v1/webhooks/shopify                 — Shopify Webhook事件接收+HMAC验证
 *   POST /v1/webhooks/custom                  — 通用Webhook（Bearer鉴权）
 *   GET  /v1/events                           — 外部事件列表查询（支持过滤+统计）
 *   GET  /v1/events/:id                       — 单个外部事件详情（含raw_payload）
 * 
 * v2.10.0 新增：
 *   - Backup API：POST /v1/backup/d1 接收 SQL 存入 KV（SHA-256 哈希校验）
 *   - Backup API：GET /v1/backup/d1/verify 验证最近备份完整性
 *   - 与 /v1/admin/backup（元数据统计）职责分离
 * 
 * v2.9.0 新增：
 *   - AttributionProof 可审计证明层（Gate 3 核心）
 *   - schema_version 版本化 proof 结构
 *   - KV 链式 proof_hash（前向链接防篡改）
 *   - HMAC 签名验证
 *   - settlement_eligible 结算判定
 *   - blockers 不满足原因列表
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
  // v2.14.0: External Event Layer — Webhook签名验证密钥
  STRIPE_WEBHOOK_SECRET?: string;  // Stripe Webhook签名密钥（未配置则事件存为pending）
  SHOPIFY_WEBHOOK_SECRET?: string; // Shopify Webhook HMAC密钥（未配置则事件存为pending）
}

type SignalType = "impression" | "click" | "consult" | "booking" | "deal";
type SignalQuality = "raw" | "verified" | "bot" | "unknown";
type VerifierType = "system" | "human" | "audit" | "external";
type GovernanceRole = "owner" | "operator" | "verifier" | "auditor";
type PrincipalType = "human" | "agent" | "system";
type Permission = "agent:create" | "agent:update" | "verification:create" | "verification:approve" | "trust:recalculate" | "audit:view" | "policy:update" | "policy:assign_role" | "data:delete";
type ActorType = "user" | "agent" | "system";
type AuditAction = "created" | "updated" | "deleted" | "status_changed" | "verified" | "confirmed" | "rejected";

// ============================================================
// v2.14.0: External Event Layer — 外部事件接收类型
// ============================================================
type ExternalEventSource = "stripe" | "shopify" | "custom";
type ExternalEventStatus = "received" | "validated" | "linked" | "rejected";

const RolePermissions: Record<string, Permission[]> = {
  owner: ["agent:create", "agent:update", "verification:create", "verification:approve", "trust:recalculate", "audit:view", "policy:update", "policy:assign_role", "data:delete"],
  operator: ["agent:create", "agent:update", "verification:create", "audit:view"],
  verifier: ["verification:create", "verification:approve", "audit:view"],
  auditor: ["audit:view", "trust:recalculate"],
};

// ============================================================
// v2.9.0: AttributionProof — 可审计归因证明（Gate 3 核心）
// ============================================================

/** 归因证明对象 v1.0 — 金融级可审计结构 */
interface AttributionProof {
  // 元数据
  schema_version: string;          // "1.0" — 结构版本号
  proof_id: string;                // "prf_xxx" — 唯一标识
  action_id: string;               // 归因对象
  agent_id: string;                // 关联Agent
  generated_at: string;            // ISO时间戳

  // 信任状态
  trust_score: number;             // 当前agent信任分
  trust_factors: {
    unique_users: number;
    channel_diversity: number;
    verification_sources: number;
    time_span_days: number;
  };

  // 验证状态
  verification: {
    status: "unverified" | "verified" | "rejected";
    count: number;
    latest_id: string | null;
    self_verification_blocked: boolean;
  };

  // 信号质量
  signal: {
    quality: SignalQuality;
    human_score: number;
    bot_detected: boolean;
  };

  // 审计链
  audit: {
    latest_hash: string;
    event_count: number;
    chain_valid: boolean;
  };

  // 结算判定
  settlement: {
    eligible: boolean;
    blockers: string[];            // 不满足时列出原因
  };

  // 防篡改（链式 + 签名）
  integrity: {
    prev_proof_hash: string;       // KV中上一个proof的hash（链式链接）
    proof_hash: string;            // 本proof内容的SHA-256
    signature: string;             // HMAC-SHA256签名
  };
}

/**
 * 生成归因证明对象
 * 从已有Execution/Validation层提取事实，封装为可审计Proof
 */
async function generateAttributionProof(env: Env, actionId: string): Promise<AttributionProof | { error: string }> {
  // 1. 查询action
  const action = await env.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(actionId).first() as any;
  if (!action) return { error: "action not found" };

  const agentId = action.agent_id as string;
  const metadata = JSON.parse((action.metadata as string) || '{}');

  // 2. 查询agent + trust
  const agent = await env.FLY_D1.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first() as any;
  const trustScore = agent ? (agent.trust_score as number) : 0;

  // 3. 计算trust_factors
  const uniqueUsers = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
  const channelDiv = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT channel) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
  const verifSources = await env.FLY_D1.prepare("SELECT COUNT(DISTINCT verifier) as cnt FROM verifications v JOIN actions a ON v.action_id = a.id WHERE a.agent_id = ?").bind(agentId).first();
  const timeSpan = await env.FLY_D1.prepare("SELECT CAST(julianday('now') - julianday(MIN(created_at)) AS INTEGER) as days FROM actions WHERE agent_id = ?").bind(agentId).first();
  const trustFactors = {
    unique_users: (uniqueUsers?.cnt as number) || 0,
    channel_diversity: (channelDiv?.cnt as number) || 0,
    verification_sources: (verifSources?.cnt as number) || 0,
    time_span_days: (timeSpan?.days as number) || 0,
  };

  // 4. 查询verification状态
  const verifications = await env.FLY_D1.prepare("SELECT * FROM verifications WHERE action_id = ? ORDER BY created_at DESC").bind(actionId).all();
  const vList = verifications.results as any[];
  const vCount = vList.length;
  const hasApproved = vList.some(v => v.result === 'approved' || v.result === 'verified');
  const hasRejected = vList.some(v => v.result === 'rejected');
  const vStatus: "unverified" | "verified" | "rejected" = hasApproved ? "verified" : hasRejected ? "rejected" : "unverified";
  const selfVerifBlocked = vList.some(v => v.verifier === agentId);

  // 5. 信号质量
  const signalQuality = (metadata.signal_quality as SignalQuality) || "raw";
  const humanScore = (metadata.human_score as number) || 0;
  const botDetected = signalQuality === "bot";

  // 6. 审计链
  const auditEvents = await env.FLY_D1.prepare("SELECT * FROM audit_events WHERE entity_type = 'action' AND entity_id = ? ORDER BY created_at ASC").bind(actionId).all();
  const aList = auditEvents.results as any[];
  let auditChainValid = true;
  let latestAuditHash = '0';
  for (const evt of aList) {
    const hashInput = `${evt.prev_hash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
    const expected = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (evt.event_hash !== expected) { auditChainValid = false; break; }
    latestAuditHash = evt.event_hash as string;
  }

  // 7. 结算判定
  const blockers: string[] = [];
  if (trustScore < 60) blockers.push(`trust_score ${trustScore} < 60`);
  if (vStatus !== "verified") blockers.push(`verification status: ${vStatus}`);
  if (signalQuality === "bot") blockers.push("bot signal detected");
  if (!auditChainValid) blockers.push("audit chain integrity failed");
  if (selfVerifBlocked) blockers.push("self-verification detected");
  const settlementEligible = blockers.length === 0;

  // 8. 链式proof_hash（KV中取上一个）
  const prevProofHash = (await env.FLY_KV.get("proof:latest_hash")) || "0";

  // 9. 构建proof对象（不含integrity字段）
  const proofCore = {
    schema_version: "1.0",
    action_id: actionId,
    agent_id: agentId,
    trust_score: trustScore,
    trust_factors: trustFactors,
    verification: {
      status: vStatus,
      count: vCount,
      latest_id: vList.length > 0 ? vList[0].id : null,
      self_verification_blocked: selfVerifBlocked,
    },
    signal: {
      quality: signalQuality,
      human_score: humanScore,
      bot_detected: botDetected,
    },
    audit: {
      latest_hash: latestAuditHash,
      event_count: aList.length,
      chain_valid: auditChainValid,
    },
    settlement: {
      eligible: settlementEligible,
      blockers: blockers,
    },
    prev_proof_hash: prevProofHash,
  };

  // 10. 计算proof_hash
  const proofHashInput = JSON.stringify(proofCore);
  const proofHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(proofHashInput));
  const proofHash = Array.from(new Uint8Array(proofHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  // 11. HMAC签名
  const signature = await hmacSha256(env.IP_SALT || 'fly-attribution-salt-2026', proofHash);

  // 12. 更新KV链
  await env.FLY_KV.put("proof:latest_hash", proofHash);

  // 13. 返回完整proof
  return {
    ...proofCore,
    generated_at: new Date().toISOString(),
    proof_id: `prf_${crypto.randomUUID()}`,
    integrity: {
      prev_proof_hash: prevProofHash,
      proof_hash: proofHash,
      signature: signature,
    },
  } as AttributionProof;
}

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
// v2.15.0: Third-party Replay API — 确定性重放与验证
// ============================================================

/** Replay 输入事件 */
interface ReplayEvent {
  type: "webhook" | "stripe" | "payment" | "conversation" | "custom";
  source: string;
  timestamp: string;
  data: Record<string, any>;
  hash?: string;
}

/** Replay 输入 claim */
interface ReplayClaim {
  subject: string;
  action: string;
  context?: Record<string, any>;
}

/** Replay 输入 rule */
interface ReplayRule {
  method: "proportional" | "weighted" | "first_touch" | "last_touch";
  parameters?: Record<string, any>;
}

/**
 * 确定性 SHA-256 — 返回十六进制字符串
 * 相同输入永远返回相同输出
 */
async function deterministicSha256(input: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 确定性 ID 生成 — 基于 SHA-256 内容派生
 * 格式: prefix_hex12 (如 ev_a1b2c3d4e5f6)
 * 相同内容永远生成相同 ID
 */
async function deterministicId(prefix: string, content: string): Promise<string> {
  const hash = await deterministicSha256(content);
  return `${prefix}_${hash.slice(0, 12)}`;
}

/**
 * eventsToEvidence — 将输入事件流转换为 CTRS v1.2 Evidence 数组
 * 确定性：相同事件 + 相同 claimId → 相同 Evidence 数组
 */
async function eventsToEvidence(events: ReplayEvent[], claimId: string): Promise<any[]> {
  const evidenceArr: any[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    // 确定性 evidence_id：基于事件内容的 SHA-256
    const evCanonical = JSON.stringify({ idx: i, type: ev.type, source: ev.source, timestamp: ev.timestamp, data: ev.data }, Object.keys({ idx: i, type: ev.type, source: ev.source, timestamp: ev.timestamp, data: ev.data }).sort());
    const evidenceId = await deterministicId('ev', evCanonical);

    // 计算证据数据 hash（CTRS 要求 SHA-256(data)）
    const dataCanonical = JSON.stringify(ev.data, Object.keys(ev.data).sort());
    const dataHash = await deterministicSha256(dataCanonical);

    // 验证输入 hash（如果提供）
    const inputHashValid = ev.hash ? ev.hash === dataHash : true;

    evidenceArr.push({
      evidence_id: evidenceId,
      claim_ref: claimId,
      type: ev.type,
      source: ev.source,
      timestamp: ev.timestamp,
      data: ev.data,
      hash: dataHash,
      _input_hash_valid: inputHashValid,
    });
  }
  return evidenceArr;
}

/**
 * calculateAttribution — 根据规则方法计算贡献分配
 * 支持 proportional / first_touch / last_touch / weighted
 * 确定性：相同事件 + 相同规则 → 相同结果
 */
function calculateAttribution(events: ReplayEvent[], rule: ReplayRule, totalValue: number, currency: string): {
  method: string;
  contributors: { party_id: string; contribution_pct: string; attributed_value: string }[];
  confidence: number;
  reasoning: string;
} {
  // 提取唯一来源（保持顺序）
  const seenSources = new Set<string>();
  const uniqueSources: string[] = [];
  for (const ev of events) {
    if (!seenSources.has(ev.source)) {
      seenSources.add(ev.source);
      uniqueSources.push(ev.source);
    }
  }

  const n = uniqueSources.length;
  if (n === 0) {
    return {
      method: rule.method,
      contributors: [],
      confidence: 0,
      reasoning: "No events provided, cannot calculate attribution",
    };
  }

  let contributors: { party_id: string; contribution_pct: string; attributed_value: string }[] = [];

  switch (rule.method) {
    case 'proportional': {
      // 均等分配
      const pct = Math.floor(100 / n);
      const remainder = 100 - pct * n;
      contributors = uniqueSources.map((src, i) => {
        const extra = i < remainder ? 1 : 0;
        const totalPct = pct + extra;
        const value = Math.round((totalValue * totalPct / 100) * 100) / 100;
        return { party_id: src, contribution_pct: String(totalPct), attributed_value: String(value) };
      });
      break;
    }

    case 'first_touch': {
      // 100% 归给最早事件来源
      contributors = uniqueSources.map((src, i) => {
        const pct = i === 0 ? 100 : 0;
        const value = i === 0 ? totalValue : 0;
        return { party_id: src, contribution_pct: String(pct), attributed_value: String(value) };
      });
      break;
    }

    case 'last_touch': {
      // 100% 归给最晚事件来源
      contributors = uniqueSources.map((src, i) => {
        const pct = i === n - 1 ? 100 : 0;
        const value = i === n - 1 ? totalValue : 0;
        return { party_id: src, contribution_pct: String(pct), attributed_value: String(value) };
      });
      break;
    }

    case 'weighted': {
      // 基于 rule.parameters.weights 的权重分配
      const weights: Record<string, number> = (rule.parameters?.weights as Record<string, number>) || {};
      const defaultWeight = 1;
      const rawWeights = uniqueSources.map(src => weights[src] ?? defaultWeight);
      const totalWeight = rawWeights.reduce((a, b) => a + b, 0);

      // 先分配整数百分比，再处理余数
      const rawPcts = rawWeights.map(w => (w / totalWeight) * 100);
      const intPcts = rawPcts.map(p => Math.floor(p));
      const pctRemainder = 100 - intPcts.reduce((a, b) => a + b, 0);

      // 按小数部分从大到小分配余数
      const fractionalOrder = rawPcts.map((p, i) => ({ idx: i, frac: p - Math.floor(p) })).sort((a, b) => b.frac - a.frac);
      for (let i = 0; i < pctRemainder; i++) {
        intPcts[fractionalOrder[i].idx]++;
      }

      contributors = uniqueSources.map((src, i) => {
        const value = Math.round((totalValue * intPcts[i] / 100) * 100) / 100;
        return { party_id: src, contribution_pct: String(intPcts[i]), attributed_value: String(value) };
      });
      break;
    }

    default: {
      // 未知方法，回退到 proportional
      const pct = Math.floor(100 / n);
      const remainder = 100 - pct * n;
      contributors = uniqueSources.map((src, i) => {
        const extra = i < remainder ? 1 : 0;
        const totalPct = pct + extra;
        const value = Math.round((totalValue * totalPct / 100) * 100) / 100;
        return { party_id: src, contribution_pct: String(totalPct), attributed_value: String(value) };
      });
    }
  }

  // 置信度：基于证据数量（0-1 浮点，CTRS v1.2 标准）
  const confidence = Math.min(1.0, 0.5 + events.length * 0.1);

  // 推理文本
  const parts = contributors.map(c => `${c.party_id}: ${c.contribution_pct}% = ${currency} ${c.attributed_value}`);
  const reasoning = `Replay attribution (${rule.method}): ${parts.join(', ')}`;

  return { method: rule.method, contributors, confidence, reasoning };
}

/**
 * replayReport — 从事件流重建完整的 CTRS v1.2 Report
 * 确定性：相同输入永远生成相同 Report
 * 无状态：不依赖 D1/KV
 */
async function replayReport(events: ReplayEvent[], claim: ReplayClaim, rule: ReplayRule): Promise<{ report: any; replayId: string }> {
  // 1. 确定性 claim_id — 基于 claim 内容
  const claimCanonical = JSON.stringify({ subject: claim.subject, action: claim.action, context: claim.context || {} }, Object.keys({ subject: claim.subject, action: claim.action, context: claim.context || {} }).sort());
  const claimId = await deterministicId('clm', claimCanonical);

  // 2. 确定性 report_id — 基于 claim + events + rule
  const reportCanonical = JSON.stringify({
    claim: { subject: claim.subject, action: claim.action },
    events: events.map(e => ({ type: e.type, source: e.source, timestamp: e.timestamp, data: e.data })),
    rule: { method: rule.method, parameters: rule.parameters || {} },
  });
  const reportId = await deterministicId('rpt', reportCanonical);
  const replayId = await deterministicId('rpl', reportCanonical);

  // 3. 确定性时间戳 — 使用事件流中最早的时间戳（确定性，不依赖 now）
  const timestamps = events.map(e => e.timestamp).filter(Boolean).sort();
  const createdAt = timestamps.length > 0 ? timestamps[0] : new Date().toISOString();

  // 4. 转换事件为 Evidence
  const evidenceArr = await eventsToEvidence(events, claimId);
  // 移除内部验证标记（不写入最终 Report）
  const cleanEvidence = evidenceArr.map((e: any) => {
    const { _input_hash_valid, ...rest } = e;
    return rest;
  });

  // 5. 计算 total_value
  const totalValue = (rule.parameters?.total_value as number) || 0;
  const currency = (rule.parameters?.currency as string) || "USD";

  // 6. 计算归因
  const attrResult = calculateAttribution(events, rule, totalValue, currency);

  // 7. 确定性 rule 对象
  const ruleDefinition = {
    name: `replay-rule-${rule.method}`,
    method: rule.method,
    parameters: {
      ...rule.parameters,
    },
    description: `Auto-generated rule for replay (method: ${rule.method})`,
    visibility: "public" as const,
  };
  const ruleDefCanonical = JSON.stringify(ruleDefinition, Object.keys(ruleDefinition).sort());
  const ruleHash = await deterministicSha256(ruleDefCanonical);
  const ruleId = await deterministicId('rule', ruleDefCanonical);

  const ruleObj = {
    rule_id: ruleId,
    issuer: "replay-api",
    version: "1.0.0",
    hash: ruleHash,
    definition: ruleDefinition,
    created_at: createdAt,
  };

  // 8. 确定性 attribution_id
  const attrCanonical = JSON.stringify({ method: attrResult.method, contributors: attrResult.contributors, confidence: attrResult.confidence });
  const attributionId = await deterministicId('attr', attrCanonical);

  const attribution = {
    attribution_id: attributionId,
    claim_ref: claimId,
    rule_hash: ruleHash,
    method: attrResult.method,
    confidence: attrResult.confidence,
    result: attrResult.contributors,
    reasoning: attrResult.reasoning,
    attributed_at: createdAt,
  };

  // 9. Settlement
  const settlementStatus = evidenceArr.length >= 2 ? "eligible" : "pending";
  const settlementSplits = attrResult.contributors.map(c => ({
    party_id: c.party_id,
    share_pct: c.contribution_pct,
    share_amount: c.attributed_value,
  }));
  const eligibleParties = attrResult.contributors.map(c => c.party_id);

  const settlementCanonical = JSON.stringify({ attribution_ref: attributionId, status: settlementStatus, amount: String(totalValue), currency, splits: settlementSplits });
  const settlementId = await deterministicId('stl', settlementCanonical);

  const settlement = {
    settlement_id: settlementId,
    attribution_ref: attributionId,
    status: settlementStatus,
    amount: String(totalValue),
    currency,
    split: settlementSplits,
    eligible_parties: eligibleParties,
  };

  // 10. Claim 对象
  const claimObj = {
    claim_id: claimId,
    type: "conversion",
    subject: claim.subject,
    description: claim.action,
    timestamp: createdAt,
    parties: [
      { id: claim.subject, role: "agent", name: claim.subject },
      ...Object.keys(claim.context || {}).map(k => ({ id: k, role: "context", name: k })),
    ],
  };

  // 11. 构建完整 CTRS Report
  const report = {
    report_id: reportId,
    schema_version: "CTRS-v1.2",
    type: "CommercialTrustReport",
    created_at: createdAt,
    status: settlementStatus === "eligible" ? "verified" : "draft",
    issuer: { id: "fly-replay-api", name: "Fly Replay Engine" },
    claim: claimObj,
    evidence: cleanEvidence,
    rule: ruleObj,
    attribution,
    settlement,
    verification: {
      schema_valid: true,
      evidence_hashes_valid: evidenceArr.every((e: any) => e._input_hash_valid !== false),
      replay_id: replayId,
    },
  };

  return { report, replayId };
}

/**
 * verifyReplay — 验证给定 Report 是否可通过重放重建
 * 用 events 重新生成 Report，对比是否一致
 */
async function verifyReplay(report: any, events: ReplayEvent[]): Promise<{
  valid: boolean;
  checks: {
    schema_valid: boolean;
    evidence_count_match: boolean;
    evidence_hashes_match: boolean;
    attribution_reproducible: boolean;
  };
  replay_report_id: string;
  original_report_id: string;
  mismatches: string[];
}> {
  const mismatches: string[] = [];

  // 1. Schema 基本验证
  const requiredFields = ["report_id", "schema_version", "type", "created_at", "status", "issuer", "claim", "evidence", "rule", "attribution", "settlement"];
  const missingFields = requiredFields.filter(f => !(f in report));
  const schemaValid = missingFields.length === 0;
  if (!schemaValid) mismatches.push(`Missing required fields: ${missingFields.join(', ')}`);

  // 2. 用相同 events 重放生成 Report
  const claim: ReplayClaim = {
    subject: report.claim?.subject || report.claim?.parties?.[0]?.id || "unknown",
    action: report.claim?.description || "",
    context: {},
  };
  const rule: ReplayRule = {
    method: (report.rule?.definition?.method as ReplayRule['method']) || "proportional",
    parameters: report.rule?.definition?.parameters || {},
  };

  const { report: replayedReport } = await replayReport(events, claim, rule);

  // 3. Evidence 数量匹配
  const originalEvidence = report.evidence || [];
  const replayedEvidence = replayedReport.evidence || [];
  const evidenceCountMatch = originalEvidence.length === replayedEvidence.length;
  if (!evidenceCountMatch) mismatches.push(`Evidence count: original=${originalEvidence.length}, replayed=${replayedEvidence.length}`);

  // 4. Evidence hash 匹配
  let evidenceHashesMatch = true;
  for (let i = 0; i < Math.min(originalEvidence.length, replayedEvidence.length); i++) {
    if (originalEvidence[i].hash !== replayedEvidence[i].hash) {
      evidenceHashesMatch = false;
      mismatches.push(`Evidence[${i}] hash mismatch: original=${originalEvidence[i].hash?.slice(0, 16)}..., replayed=${replayedEvidence[i].hash?.slice(0, 16)}...`);
    }
  }
  if (!evidenceHashesMatch && !mismatches.some(m => m.includes('hash mismatch'))) mismatches.push("Evidence hashes do not match");

  // 5. Attribution 可重放
  const attributionReproducible = report.attribution?.method === replayedReport.attribution?.method
    && JSON.stringify(report.attribution?.result) === JSON.stringify(replayedReport.attribution?.result);
  if (!attributionReproducible) mismatches.push("Attribution result is not reproducible from the given events");

  // 6. report_id 一致性
  const reportIdMatch = report.report_id === replayedReport.report_id;
  if (!reportIdMatch) mismatches.push(`report_id mismatch: original=${report.report_id}, replayed=${replayedReport.report_id}`);

  const valid = schemaValid && evidenceCountMatch && evidenceHashesMatch && attributionReproducible && reportIdMatch;

  return {
    valid,
    checks: {
      schema_valid: schemaValid,
      evidence_count_match: evidenceCountMatch,
      evidence_hashes_match: evidenceHashesMatch,
      attribution_reproducible: attributionReproducible,
    },
    replay_report_id: replayedReport.report_id,
    original_report_id: report.report_id,
    mismatches,
  };
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
// v2.14.0: External Event Layer — 签名验证与标准化
// ============================================================

/**
 * 初始化 external_events 表（幂等，IF NOT EXISTS）
 * 首次请求时调用，确保表结构就绪
 */
async function initExternalEventsTable(env: Env): Promise<void> {
  await env.FLY_D1.prepare(`
    CREATE TABLE IF NOT EXISTS external_events (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      raw_payload TEXT NOT NULL,
      normalized_type TEXT,
      normalized_data TEXT,
      hash TEXT NOT NULL,
      signature_valid INTEGER DEFAULT 0,
      status TEXT DEFAULT 'received',
      claim_ref TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(source, source_event_id)
    )
  `).run();
}

/**
 * 验证 Stripe Webhook 签名
 * Stripe-Signature 头格式：t=timestamp,v1=signature[,v0=...]
 * 签名计算：HMAC-SHA256(webhook_secret, "${timestamp}.${rawBody}")
 * 
 * @returns 0=未配置密钥(pending), 1=验证通过, 2=验证失败
 */
async function verifyStripeSignature(payload: string, signatureHeader: string | null, secret: string | undefined): Promise<number> {
  if (!secret) return 0; // 未配置密钥，存为 pending
  if (!signatureHeader) return 2; // 无签名头，验证失败

  // 解析 Stripe-Signature 头
  const parts: Record<string, string> = {};
  for (const item of signatureHeader.split(',')) {
    const [key, value] = item.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }

  const timestamp = parts['t'];
  const v1Signature = parts['v1'];
  if (!timestamp || !v1Signature) return 2;

  // 构造签名字符串：timestamp.payload
  const signedPayload = `${timestamp}.${payload}`;
  const computedSignature = await hmacSha256(secret, signedPayload);

  // 比较签名（恒定时间比较，防时序攻击）
  if (computedSignature.length !== v1Signature.length) return 2;
  let mismatch = 0;
  for (let i = 0; i < computedSignature.length; i++) {
    mismatch |= computedSignature.charCodeAt(i) ^ v1Signature.charCodeAt(i);
  }
  return mismatch === 0 ? 1 : 2;
}

/**
 * 验证 Shopify Webhook HMAC 签名
 * X-Shopify-Hmac-Sha256 头：Base64编码的HMAC-SHA256签名
 * 
 * @returns 0=未配置密钥(pending), 1=验证通过, 2=验证失败
 */
async function verifyShopifyHmac(payload: string, hmacHeader: string | null, secret: string | undefined): Promise<number> {
  if (!secret) return 0; // 未配置密钥，存为 pending
  if (!hmacHeader) return 2; // 无签名头，验证失败

  // 计算 HMAC-SHA256 并 Base64 编码
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload));
  const computedBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // 恒定时间比较
  if (computedBase64.length !== hmacHeader.length) return 2;
  let mismatch = 0;
  for (let i = 0; i < computedBase64.length; i++) {
    mismatch |= computedBase64.charCodeAt(i) ^ hmacHeader.charCodeAt(i);
  }
  return mismatch === 0 ? 1 : 2;
}

/**
 * Stripe 事件标准化 → CTRS Evidence 格式
 * 将 Stripe webhook 事件转换为 CTRS v1.2 标准 Evidence 对象
 */
function normalizeStripeEvent(payload: any): { normalized_type: string; normalized_data: string } {
  const eventType = payload.type || 'unknown';
  const eventId = payload.id || 'unknown';
  const created = payload.created ? new Date(payload.created * 1000).toISOString() : new Date().toISOString();

  // 提取核心业务数据
  const dataObject = payload.data?.object || {};
  const normalizedData = {
    evidence_id: `ev_ext_${crypto.randomUUID()}`,
    claim_ref: null, // 后续链接时填充
    type: "stripe",
    source: "stripe",
    timestamp: created,
    data: {
      stripe_event_id: eventId,
      stripe_event_type: eventType,
      amount: dataObject.amount ?? null,
      currency: dataObject.currency ?? null,
      customer: dataObject.customer ?? null,
      status: dataObject.status ?? null,
      description: dataObject.description ?? null,
      metadata: dataObject.metadata ?? null,
    },
    hash: "0", // 运行时计算
  };

  return {
    normalized_type: "stripe",
    normalized_data: JSON.stringify(normalizedData),
  };
}

/**
 * Shopify 事件标准化 → CTRS Evidence 格式
 * 将 Shopify webhook 事件转换为 CTRS v1.2 标准 Evidence 对象
 */
function normalizeShopifyEvent(payload: any): { normalized_type: string; normalized_data: string } {
  const topic = payload.topic || payload.event_type || 'unknown';
  const orderId = payload.id || payload.order_id || 'unknown';

  const normalizedData = {
    evidence_id: `ev_ext_${crypto.randomUUID()}`,
    claim_ref: null, // 后续链接时填充
    type: "webhook",
    source: "shopify",
    timestamp: payload.created_at || payload.updated_at || new Date().toISOString(),
    data: {
      shopify_event_type: topic,
      shopify_order_id: String(orderId),
      order_number: payload.order_number ?? payload.number ?? null,
      total_price: payload.total_price ?? null,
      currency: payload.currency ?? null,
      financial_status: payload.financial_status ?? null,
      fulfillment_status: payload.fulfillment_status ?? null,
      customer: payload.customer ? {
        id: payload.customer.id ?? null,
        email: payload.customer.email ?? null,
      } : null,
      line_items_count: payload.line_items?.length ?? null,
    },
    hash: "0", // 运行时计算
  };

  return {
    normalized_type: "webhook",
    normalized_data: JSON.stringify(normalizedData),
  };
}

/**
 * 存储外部事件到 D1
 * 包含幂等去重、hash 计算、标准化转换
 * 
 * @returns { id, status, dedup } dedup=true 表示事件已存在（幂等）
 */
async function storeExternalEvent(env: Env, params: {
  source: ExternalEventSource;
  source_event_id: string;
  event_type: string;
  raw_payload: string;
  signature_valid: number; // 0=未验证 1=有效 2=无效
  normalized_type?: string;
  normalized_data?: string;
}): Promise<{ id: string; status: string; dedup: boolean }> {
  // 确保 external_events 表存在
  await initExternalEventsTable(env);

  // 计算 SHA-256(raw_payload)
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(params.raw_payload));
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  // 幂等去重：检查是否已存在
  const existing = await env.FLY_D1.prepare(
    "SELECT id, status FROM external_events WHERE source = ? AND source_event_id = ?"
  ).bind(params.source, params.source_event_id).first();

  if (existing) {
    return { id: existing.id as string, status: existing.status as string, dedup: true };
  }

  // 确定状态：签名有效 → validated，签名无效 → rejected，未验证 → received
  let status: ExternalEventStatus = 'received';
  if (params.signature_valid === 1) {
    status = 'validated';
  } else if (params.signature_valid === 2) {
    status = 'rejected';
  }

  const eventId = `evt_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  await env.FLY_D1.prepare(
    `INSERT INTO external_events (id, source, source_event_id, event_type, raw_payload, normalized_type, normalized_data, hash, signature_valid, status, claim_ref, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).bind(
    eventId,
    params.source,
    params.source_event_id,
    params.event_type,
    params.raw_payload,
    params.normalized_type || null,
    params.normalized_data || null,
    hash,
    params.signature_valid,
    status,
    timestamp
  ).run();

  // 写审计日志
  await writeAuditEvent(env, {
    request_id: `req_${crypto.randomUUID()}`,
    entity_type: 'external_event',
    entity_id: eventId,
    action: 'created',
    actor_type: 'system',
    actor_id: `sys_${params.source}_webhook`,
    actor_name: `${params.source}-webhook-receiver`,
    source: params.source,
    reason: `external_event_received:${params.event_type}`,
    before: '{}',
    after: JSON.stringify({ id: eventId, source: params.source, event_type: params.event_type, signature_valid: params.signature_valid, status }),
  });

  return { id: eventId, status, dedup: false };
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
          return json({ status, version: '2.14.0', layers: 8, protocols: 6, db: dbStatus, kv: kvStatus, timestamp: new Date().toISOString() });
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

        // === v2.9.0: 归因链证明生成（Gate 3 核心）===
        if (path.startsWith('/v1/proof/') && method === 'GET') {
          const actionId = path.split('/v1/proof/')[1];
          const proof = await generateAttributionProof(env, actionId);
          if ('error' in proof) return json({ error: proof.error }, 404);
          return json(proof);
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
          await alertTrigger(env, 'TEST', '告警测试 - 这是一个测试告警', { trigger: 'manual', version: 'v2.8.0' });
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

        // === v2.10.0: D1 SQL 备份存储 ===
        if (path === '/v1/backup/d1' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          // 读取 SQL 内容
          const sqlContent = await request.text();
          if (!sqlContent || sqlContent.length < 10) {
            return json({ error: 'empty or invalid SQL content' }, 400);
          }
          // 计算 SHA-256 哈希
          const encoder = new TextEncoder();
          const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(sqlContent));
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const backupHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          // 生成备份记录
          const backupId = `bak_${crypto.randomUUID()}`;
          const timestamp = new Date().toISOString();
          const metadata = {
            backup_id: backupId,
            timestamp,
            sql_size: sqlContent.length,
            backup_hash: backupHash,
            source: 'd1-export',
            status: 'active'
          };
          // 存储 SQL 到 KV
          await env.FLY_KV.put(`backup:d1:${backupId}`, sqlContent, { expirationTtl: 86400 * 30 });
          // 存储元数据
          await env.FLY_KV.put(`backup:d1:meta:${backupId}`, JSON.stringify(metadata), { expirationTtl: 86400 * 30 });
          // 更新 latest 指针
          await env.FLY_KV.put('backup:d1:latest', JSON.stringify({
            backup_id: backupId,
            timestamp,
            sql_size: sqlContent.length,
            backup_hash: backupHash
          }));
          // 追加到备份历史
          const historyKey = 'backups:history';
          const historyRaw = await env.FLY_KV.get(historyKey);
          const history = historyRaw ? JSON.parse(historyRaw) : [];
          history.push({ ...metadata, type: 'd1-sql' });
          if (history.length > 30) history.splice(0, history.length - 30);
          await env.FLY_KV.put(historyKey, JSON.stringify(history));
          // 写入审计链
          await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'backup', entity_id: backupId, action: 'created', actor_type: 'system', actor_id: 'sys_backup', actor_name: 'd1-backup-service', source: 'backup', reason: 'd1_backup_stored', before: '{}', after: JSON.stringify({ backup_hash: backupHash, sql_size: sqlContent.length, storage: 'kv' }) });
          return json({ success: true, backup: { id: backupId, backup_hash: backupHash, sql_size: sqlContent.length, created_at: timestamp } });
        }

        // === v2.10.0: D1 备份完整性验证 ===
        if (path === '/v1/backup/d1/verify' && method === 'GET') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          // 读取最新备份元数据
          const latestRaw = await env.FLY_KV.get('backup:d1:latest');
          if (!latestRaw) {
            return json({ success: true, verified: false, reason: 'no backup found' });
          }
          const latest = JSON.parse(latestRaw);
          // 读取备份 SQL 内容
          const sqlContent = await env.FLY_KV.get(`backup:d1:${latest.backup_id}`);
          if (!sqlContent) {
            return json({ success: true, verified: false, reason: 'SQL content missing (expired or deleted)', backup_id: latest.backup_id });
          }
          // 重新计算哈希
          const encoder = new TextEncoder();
          const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(sqlContent));
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const currentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const hashMatch = currentHash === latest.backup_hash;
          // 写入审计链
          await writeAuditEvent(env, { request_id: `req_${crypto.randomUUID()}`, entity_type: 'backup', entity_id: latest.backup_id, action: 'verified', actor_type: 'system', actor_id: 'sys_backup', actor_name: 'd1-backup-service', source: 'backup', reason: 'd1_backup_verified', before: JSON.stringify({ stored_hash: latest.backup_hash }), after: JSON.stringify({ verified: hashMatch, computed_hash: currentHash }) });
          return json({
            success: true,
            verified: hashMatch,
            backup_id: latest.backup_id,
            stored_hash: latest.backup_hash,
            computed_hash: currentHash,
            sql_size: sqlContent.length,
            timestamp: latest.timestamp
          });
        }

        // === v2.11.0: 备份列表 ===
        if (path === '/v1/backup/d1/list' && method === 'GET') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const historyRaw = await env.FLY_KV.get('backups:history');
          const history = historyRaw ? JSON.parse(historyRaw) : [];
          const backups = history.reverse().map((h: any) => ({
            id: h.backup_id,
            timestamp: h.timestamp,
            sql_size: h.sql_size,
            backup_hash: h.backup_hash,
            status: h.status || 'active'
          }));
          return json({ success: true, total: backups.length, backups });
        }

        // === v2.11.0: 下载指定备份 SQL ===
        if (path.startsWith('/v1/backup/d1/bak_') && method === 'GET') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const backupId = path.split('/').pop();
          const sqlContent = await env.FLY_KV.get(`backup:d1:${backupId}`);
          if (!sqlContent) {
            return json({ error: 'backup not found or expired' }, 404);
          }
          return new Response(sqlContent, {
            headers: { 'Content-Type': 'application/sql', 'Content-Length': String(new TextEncoder().encode(sqlContent).length) }
          });
        }

        // === v2.13.0: Dry-run 恢复计划 ===
        if (path.startsWith('/v1/backup/d1/restore/bak_') && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const backupId = path.split('/').pop()!;
          // 读取备份 SQL
          const sqlContent = await env.FLY_KV.get(`backup:d1:${backupId}`);
          if (!sqlContent) {
            return json({ error: 'backup not found or expired' }, 404);
          }
          // 解析请求体
          const body: any = await request.json().catch(() => ({}));
          const isDryRun = body.dry_run === true;
          // 从备份 SQL 中提取表名
          const backupTableMatches = [...sqlContent.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?[`"']?(\w+)[`"']?\s*\(/gi)];
          const backupTables = backupTableMatches.map(m => m[1].toLowerCase());
          // 查询 D1 当前表列表
          const tablesResult = await env.FLY_D1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all();
          const currentTables = (tablesResult.results as any[]).map(r => (r.name as string).toLowerCase());
          // 计算差异
          const newTables = backupTables.filter(t => !currentTables.includes(t));
          const existingTables = backupTables.filter(t => currentTables.includes(t));
          const warnings: string[] = [];
          for (const t of existingTables) {
            warnings.push(`表 '${t}' 已存在，恢复将覆盖现有数据`);
          }
          if (!isDryRun) {
            warnings.push('非 dry_run 模式暂不支持实际恢复（安全限制）');
          }
          // 写入审计链
          await writeAuditEvent(env, {
            request_id: `req_${crypto.randomUUID()}`,
            entity_type: 'backup',
            entity_id: backupId,
            action: 'restored',
            actor_type: 'system',
            actor_id: 'sys_backup',
            actor_name: 'd1-backup-service',
            source: 'backup',
            reason: isDryRun ? 'd1_backup_restore_dry_run' : 'd1_backup_restore_attempted',
            before: JSON.stringify({ current_tables: currentTables }),
            after: JSON.stringify({ backup_tables: backupTables, new_tables: newTables, warnings_count: warnings.length, dry_run: isDryRun })
          });
          return json({
            dry_run: isDryRun,
            plan: {
              backup_tables: backupTables,
              current_tables: currentTables,
              new_tables: newTables,
              existing_tables: existingTables,
              warnings
            },
            backup_id: backupId,
            sql_size: sqlContent.length
          });
        }

        // ── v2.12.0: POST /v1/verify ── CTRS v1.2 商业归因报告生成
        // 支持两种请求格式：
        //   新格式（CTRS v1.2）：包含 claim, evidence, rule 结构化字段
        //   旧格式（向后兼容）：只包含 agent_id, evidence: string[], amount
        if (method === "POST" && path === "/v1/verify") {
          const body = await request.json().catch(() => null);
          if (!body || !body.agent_id) return json({ error: "agent_id required" }, 400);
          const { agent_id, channel, user_id, signal_type, amount } = body;
          const now = new Date().toISOString();

          // ── 判断请求格式：新格式包含 rule 对象 ──
          const isCtrsV12 = body.rule && typeof body.rule === "object" && body.rule.rule_id;

          if (isCtrsV12) {
            // ══════════════════════════════════════════════════════
            // CTRS v1.2 新格式处理
            // ══════════════════════════════════════════════════════

            // ── 1. 解析结构化输入 ──
            const claimInput = body.claim || {
              claim_id: `clm_${crypto.randomUUID()}`,
              type: signal_type || "conversion",
              subject: `商业归因 - ${agent_id}`,
              description: `Agent ${agent_id} 的商业转化`,
              timestamp: now,
              parties: [{ id: agent_id, role: "agent", name: agent_id }]
            };
            const evidenceInput = Array.isArray(body.evidence) ? body.evidence : [];
            const ruleInput = body.rule;
            const currency = body.currency || "USD";

            // ── 2. Rule 完整性校验 ──
            // 计算 rule_hash = SHA-256(JSON.stringify(rule.definition))
            const ruleDefCanonical = JSON.stringify(ruleInput.definition, Object.keys(ruleInput.definition).sort());
            const ruleHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ruleDefCanonical));
            const computedRuleHash = Array.from(new Uint8Array(ruleHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            // 验证 rule.hash == computedRuleHash（完整性检查）
            if (ruleInput.hash && ruleInput.hash !== computedRuleHash) {
              return json({
                error: "rule_integrity_failed",
                detail: `Rule hash 不匹配: 提交=${ruleInput.hash.slice(0, 16)}..., 计算=${computedRuleHash.slice(0, 16)}...`,
                rule_id: ruleInput.rule_id
              }, 400);
            }

            // 如果 rule 没提供 hash，使用计算值
            const ruleHash = ruleInput.hash || computedRuleHash;

            // ── 3. Evidence Hash 校验 ──
            for (const ev of evidenceInput) {
              if (ev.hash && ev.data) {
                const evDataCanonical = JSON.stringify(ev.data, Object.keys(ev.data).sort());
                const evHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(evDataCanonical));
                const computedEvHash = Array.from(new Uint8Array(evHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
                if (ev.hash !== computedEvHash) {
                  return json({
                    error: "evidence_integrity_failed",
                    detail: `Evidence hash 不匹配: evidence_id=${ev.evidence_id}`,
                    evidence_id: ev.evidence_id
                  }, 400);
                }
              }
            }

            // ── 4. 归因推理引擎 — 从 rule.definition.parameters.splits 计算 ──
            const splits = ruleInput.definition?.parameters?.splits || {};
            const totalValue = parseFloat(ruleInput.definition?.parameters?.total_value || String(amount || 0));
            const splitEntries = Object.entries(splits); // [[party_id, pct_string], ...]

            // 计算 attribution.result[]
            const attributionResults = splitEntries.map(([partyId, pctStr]) => {
              const pct = parseFloat(pctStr as string);
              const attrValue = Math.round((totalValue * pct / 100) * 100) / 100;
              return {
                party_id: partyId,
                contribution_pct: String(pct),
                attributed_value: String(attrValue),
              };
            });

            // confidence: 0-1 浮点（基于证据数量，不再用 70-95 整数）
            const confidence = Math.min(1.0, 0.7 + (evidenceInput.length * 0.05));

            // 归因推理文本
            const method = ruleInput.definition?.method || "proportional";
            const reasoningParts = attributionResults.map(r =>
              `${r.party_id}: ${r.contribution_pct}% = ${currency} ${r.attributed_value}`
            );
            const reasoning = `基于规则 '${ruleInput.definition?.name || ruleInput.rule_id}' (rule_id=${ruleInput.rule_id}, rule_hash=${ruleHash.slice(0, 16)}...): ${reasoningParts.join(', ')}`;

            // ── 5. 构建 Settlement ──
            const settlementSplits = attributionResults.map(r => ({
              party_id: r.party_id,
              share_pct: r.contribution_pct,
              share_amount: r.attributed_value,
            }));
            const eligibleParties = attributionResults.map(r => r.party_id);
            const settlementStatus = evidenceInput.length >= 2 ? "eligible" : "pending";

            // ── 6. 构建 Rule 一等对象（确保 hash 正确） ──
            const ruleObj = {
              rule_id: ruleInput.rule_id,
              issuer: ruleInput.issuer || agent_id,
              version: ruleInput.version || "1.0.0",
              hash: ruleHash,
              definition: ruleInput.definition,
              created_at: ruleInput.created_at || now,
            };

            // ── 7. 构建 Evidence 数组（补充缺失字段） ──
            const evidenceArr = evidenceInput.map((ev: any, idx: number) => ({
              evidence_id: ev.evidence_id || `ev_${crypto.randomUUID()}`,
              claim_ref: ev.claim_ref || claimInput.claim_id,
              type: ev.type || "custom",
              source: ev.source || agent_id,
              timestamp: ev.timestamp || now,
              data: ev.data || {},
              hash: ev.hash || "0",
            }));

            // ── 8. 构建 Attribution 对象 ──
            const attributionId = `attr_${crypto.randomUUID()}`;
            const attribution = {
              attribution_id: attributionId,
              claim_ref: claimInput.claim_id,
              rule_hash: ruleHash,
              method,
              confidence,
              result: attributionResults,
              reasoning,
              attributed_at: now,
            };

            // ── 9. 构建 Settlement 对象 ──
            const settlementId = `stl_${crypto.randomUUID()}`;
            const settlement = {
              settlement_id: settlementId,
              attribution_ref: attributionId,
              status: settlementStatus,
              amount: String(totalValue),
              currency,
              split: settlementSplits,
              eligible_parties: eligibleParties,
            };

            // ── 10. 构建完整 CTRS Report ──
            const reportId = `rpt_${crypto.randomUUID()}`;
            const ctrsReport = {
              report_id: reportId,
              schema_version: "CTRS-v1.2",
              type: "CommercialTrustReport",
              created_at: now,
              status: settlementStatus === "eligible" ? "verified" : "draft",
              issuer: { id: "fly-protocol", name: "Fly Attribution Engine" },
              claim: claimInput,
              evidence: evidenceArr,
              rule: ruleObj,
              attribution,
              settlement,
            };

            // ── 11. 写入 D1（兼容旧表结构） ──
            const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const shortId = actionId.slice(-6);
            // 旧 metadata 格式保留兼容
            const legacyMetadata = JSON.stringify({
              claim: claimInput.subject || claimInput.description,
              evidence: evidenceArr.map((e: any) => e.type),
              attribution_basis: {
                conclusion: reasoning,
                reasons: evidenceArr.map((e: any) => e.type),
                confidence_score: Math.round(confidence * 100),
                conversion_path: `${channel || "unknown"} → ${signal_type || "conversion"}`
              },
              settlement_basis: {
                eligible: settlementStatus === "eligible",
                revenue: totalValue,
                commission: settlementSplits.reduce((sum, s) => sum + parseFloat(s.share_amount), 0),
              },
              amount: totalValue,
              // 新增：完整 CTRS Report 引用
              ctrs_report_id: reportId,
            });
            await env.FLY_D1.prepare(
              "INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))"
            ).bind(actionId, agent_id, channel || "unknown", user_id || "anonymous", signal_type || "conversion", shortId, legacyMetadata).run();

            // ── 12. 创建 verification 记录 ──
            const verifId = `ver_${crypto.randomUUID()}`;
            await env.FLY_D1.prepare(
              "INSERT INTO verifications (id, action_id, verifier, result, confidence, evidence, created_at) VALUES (?,?,?,?,?,?,datetime('now'))"
            ).bind(verifId, actionId, "fly_attribution_engine", settlementStatus === "eligible" ? "pass" : "pending", Math.round(confidence * 100), JSON.stringify(evidenceArr.map((e: any) => e.type))).run();

            // ── 13. 写入 fly-store（KV 存储） ──
            // 存储 CTRS Report 到 KV，key = report_id
            const reportCanonical = JSON.stringify(ctrsReport, Object.keys(ctrsReport).sort());
            const storageHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reportCanonical));
            const storageHash = Array.from(new Uint8Array(storageHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            await env.FLY_KV.put(`ctrs:report:${reportId}`, JSON.stringify({
              ...ctrsReport,
              _store_meta: { storage_hash: storageHash, version: 1, stored_at: now }
            }));

            // ── 14. 写入 rule-registry（KV 存储） ──
            const regKey = `ctrs:registry:rules:${ruleObj.rule_id}`;
            const existingRegRaw = await env.FLY_KV.get(regKey);
            const existingReg: any[] = existingRegRaw ? JSON.parse(existingRegRaw) : [];
            // 检查是否已有相同 hash 的注册
            const alreadyRegistered = existingReg.some((r: any) => r.rule_hash === ruleObj.hash);
            if (!alreadyRegistered) {
              existingReg.push({
                rule_id: ruleObj.rule_id,
                rule_hash: ruleObj.hash,
                issuer: ruleObj.issuer,
                issuer_trust_at_registration: "trusted",
                version: ruleObj.version,
                rule: ruleObj,
                registered_at: now,
                status: "active",
              });
              await env.FLY_KV.put(regKey, JSON.stringify(existingReg));
            }

            // ── 15. 写入审计链 ──
            await writeAuditEvent(env, {
              request_id: `req_${crypto.randomUUID()}`,
              entity_type: "attribution",
              entity_id: actionId,
              action: "created",
              actor_type: "api",
              actor_id: agent_id,
              actor_name: "attribution_api",
              source: "verify",
              reason: "ctrs_v1.2_report_issued",
              before: "{}",
              after: JSON.stringify({
                report_id: reportId,
                schema_version: "CTRS-v1.2",
                confidence,
                settlement_status: settlementStatus,
                amount: totalValue,
                rule_id: ruleObj.rule_id,
                rule_hash: ruleHash.slice(0, 16) + "...",
                storage_hash: storageHash.slice(0, 16) + "...",
              })
            });

            // ── 16. 返回完整 CTRS Report ──
            return json({
              ...ctrsReport,
              // 兼容旧字段
              verification_id: verifId,
              timestamp: now,
            }, 201);

          } else {
            // ══════════════════════════════════════════════════════
            // 旧格式处理（向后兼容）
            // ══════════════════════════════════════════════════════
            const { claim, evidence } = body;

            // ── 旧归因推理引擎 ──
            const evidenceLabels: Record<string, string> = {
              "recommendation_recorded": "AI 推荐已记录",
              "conversation_verified": "对话链路已验证",
              "conversion_confirmed": "商业转化已确认",
              "user_id_verified": "用户身份已验证",
              "channel_tracked": "渠道来源已追踪",
              "timestamp_verified": "时间戳已验证"
            };
            const evidenceArr = Array.isArray(evidence) ? evidence : [];
            const attributionReasons = evidenceArr.map((e: string) => evidenceLabels[e] || e);
            const confidence = Math.min(95, 70 + evidenceArr.length * 5);

            const attribution_basis = {
              conclusion: `该商业转化归属于 ${agent_id}`,
              reasons: attributionReasons,
              confidence_score: confidence,
              confidence_calculation: `基础分 70 + 已验证证据(${evidenceArr.length}) × 5 = ${confidence}`,
              conversion_path: `${channel || "unknown"} → ${signal_type || "conversion"}`
            };

            // ── 旧结算规则引擎 ──
            const SETTLEMENT_RULES = {
              min_evidence: 2,
              base_rate: 0.10,
              evidence_bonus: 0.02,
              max_rate: 0.20
            };
            const eligible = evidenceArr.length >= SETTLEMENT_RULES.min_evidence;
            const calculatedRate = Math.min(SETTLEMENT_RULES.max_rate, 
              SETTLEMENT_RULES.base_rate + (evidenceArr.length * SETTLEMENT_RULES.evidence_bonus));
            const commission = Math.round(((amount || 0) * calculatedRate) * 100) / 100;

            const settlement_basis = {
              eligible,
              eligibility_reason: eligible
                ? `已验证证据(${evidenceArr.length}) ≥ 最低要求(${SETTLEMENT_RULES.min_evidence})`
                : `已验证证据(${evidenceArr.length}) < 最低要求(${SETTLEMENT_RULES.min_evidence})`,
              rate_calculation: `基础费率 ${SETTLEMENT_RULES.base_rate * 100}% + 证据加成(${evidenceArr.length} × ${SETTLEMENT_RULES.evidence_bonus * 100}%) = ${(calculatedRate * 100).toFixed(1)}%`,
              rate_applied: calculatedRate,
              revenue: amount || 0,
              commission
            };

            // 1. 创建 action 记录
            const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const shortId = actionId.slice(-6);
            const metadata = JSON.stringify({
              claim: claim || attribution_basis.conclusion,
              evidence: evidenceArr,
              attribution_basis,
              settlement_basis,
              amount: amount || 0
            });
            await env.FLY_D1.prepare(
              "INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))"
            ).bind(actionId, agent_id, channel || "unknown", user_id || "anonymous", signal_type || "conversion", shortId, metadata).run();

            // 2. 创建 verification 记录
            const verifId = `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await env.FLY_D1.prepare(
              "INSERT INTO verifications (id, action_id, verifier, result, confidence, evidence, created_at) VALUES (?,?,?,?,?,?,datetime('now'))"
            ).bind(verifId, actionId, "fly_attribution_engine", eligible ? "pass" : "insufficient_evidence", confidence, JSON.stringify(evidenceArr)).run();

            // 3. 写入审计链
            await writeAuditEvent(env, {
              request_id: `req_${crypto.randomUUID()}`,
              entity_type: "attribution",
              entity_id: actionId,
              action: "created",
              actor_type: "api",
              actor_id: agent_id,
              actor_name: "attribution_api",
              source: "verify",
              reason: "commercial_attribution_issued",
              before: "{}",
              after: JSON.stringify({ confidence, eligible, commission, amount: amount || 0 })
            });

            return json({
              record_id: actionId,
              verification_id: verifId,
              status: eligible ? "verified" : "insufficient_evidence",
              claim: attribution_basis.conclusion,
              confidence,
              settlement_eligible: eligible,
              commission_eligible: commission,
              revenue: amount || 0,
              attribution_basis,
              settlement_basis,
              timestamp: new Date().toISOString()
            }, 201);
          }
        }

        // ── v2.11.0: GET /v1/records/recent ── 查询最近归因记录
        if (method === "GET" && path === "/v1/records/recent") {
          const limit = parseInt(url.searchParams.get("limit") || "20");
          const result = await env.FLY_D1.prepare(
            "SELECT v.id as verification_id, v.action_id, v.result, v.confidence, v.evidence, v.created_at, a.agent_id, a.channel, a.signal_type, a.metadata FROM verifications v LEFT JOIN actions a ON v.action_id = a.id ORDER BY v.created_at DESC LIMIT ?"
          ).bind(limit).all();
          const records = (result.results || []).map((r: any) => {
            let meta: any = {};
            try { meta = JSON.parse(r.metadata || "{}"); } catch {}
            const amount = meta.amount || 0;
            return {
              record_id: r.action_id,
              verification_id: r.verification_id,
              agent_id: r.agent_id,
              channel: r.channel,
              signal_type: r.signal_type,
              claim: meta.claim || `Attributed to ${r.agent_id}`,
              confidence: r.confidence,
              revenue: amount,
              commission_eligible: meta.settlement_basis?.commission || amount * (meta.commission_rate || 0.15),
              status: r.result,
              attribution_basis: meta.attribution_basis || null,
              settlement_basis: meta.settlement_basis || null,
              created_at: r.created_at
            };
          });
          return json({ total: records.length, records });
        }

        // ============================================================
        // v2.12.0: CTRS v1.2 API 端点
        // ============================================================

        // ── GET /v1/ctrs/report/:reportId ── 获取 CTRS Report ──
        if (path.startsWith('/v1/ctrs/report/') && method === 'GET') {
          const reportId = path.split('/v1/ctrs/report/')[1];
          const reportRaw = await env.FLY_KV.get(`ctrs:report:${reportId}`);
          if (!reportRaw) return json({ error: "report not found", report_id: reportId }, 404);
          const reportData = JSON.parse(reportRaw);
          // 分离存储元信息
          const storeMeta = reportData._store_meta || {};
          // 验证 storage_hash
          const { _store_meta, ...pureReport } = reportData;
          const verifyCanonical = JSON.stringify(pureReport, Object.keys(pureReport).sort());
          const verifyHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifyCanonical));
          const verifyHash = Array.from(new Uint8Array(verifyHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          const hashValid = verifyHash === storeMeta.storage_hash;
          return json({
            report: pureReport,
            store_meta: { ...storeMeta, hash_valid: hashValid },
          });
        }

        // ── GET /v1/ctrs/registry/rules ── 查询规则注册表 ──
        if (path === '/v1/ctrs/registry/rules' && method === 'GET') {
          // 列出 KV 中所有 ctrs:registry:rules:* 的条目
          const list = await env.FLY_KV.list({ prefix: 'ctrs:registry:rules:' });
          const rules: any[] = [];
          for (const key of list.keys) {
            const raw = await env.FLY_KV.get(key.name);
            if (raw) {
              try { rules.push(...JSON.parse(raw)); } catch {}
            }
          }
          return json({ total: rules.length, rules });
        }

        // ── GET /v1/ctrs/registry/issuers ── 查询发行者注册表 ──
        if (path === '/v1/ctrs/registry/issuers' && method === 'GET') {
          const list = await env.FLY_KV.list({ prefix: 'ctrs:registry:issuers:' });
          const issuers: any[] = [];
          for (const key of list.keys) {
            const raw = await env.FLY_KV.get(key.name);
            if (raw) {
              try { issuers.push(JSON.parse(raw)); } catch {}
            }
          }
          return json({ total: issuers.length, issuers });
        }

        // ── POST /v1/ctrs/registry/issuers ── 注册发行者 ──
        if (path === '/v1/ctrs/registry/issuers' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body: any = await request.json();
          if (!body.issuer_id || !body.name) return json({ error: "issuer_id and name required" }, 400);
          const issuerRecord = {
            issuer_id: body.issuer_id,
            name: body.name,
            trust_level: body.trust_level || "trusted",
            registered_at: new Date().toISOString(),
            metadata: body.metadata || {},
          };
          await env.FLY_KV.put(`ctrs:registry:issuers:${body.issuer_id}`, JSON.stringify(issuerRecord));
          return json({ success: true, ...issuerRecord }, 201);
        }

        // ============================================================
        // v2.14.0: External Event Layer — Webhook 接收端点
        // ============================================================

        // === POST /v1/webhooks/stripe — 接收 Stripe Webhook 事件 ===
        if (path === '/v1/webhooks/stripe' && method === 'POST') {
          const rawBody = await request.text();
          let payload: any;
          try {
            payload = JSON.parse(rawBody);
          } catch {
            return json({ error: "invalid JSON payload" }, 400);
          }

          // 验证 Stripe 签名
          const signatureHeader = request.headers.get('Stripe-Signature');
          const signatureValid = await verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);

          // 硬约束：有签名但验证失败则拒绝（签名无效=rejected）
          // 无签名密钥=0(pending)，签名有效=1(validated)
          if (signatureValid === 2) {
            // 签名验证失败：仍然入库但标记为 rejected
            const result = await storeExternalEvent(env, {
              source: 'stripe',
              source_event_id: payload.id || `stripe_${Date.now()}`,
              event_type: payload.type || 'unknown',
              raw_payload: rawBody,
              signature_valid: 2,
              ...normalizeStripeEvent(payload),
            });
            return json({ received: true, id: result.id, status: 'rejected', reason: 'signature_verification_failed' }, 202);
          }

          // 标准化并存储
          const normalized = normalizeStripeEvent(payload);
          const result = await storeExternalEvent(env, {
            source: 'stripe',
            source_event_id: payload.id || `stripe_${Date.now()}`,
            event_type: payload.type || 'unknown',
            raw_payload: rawBody,
            signature_valid: signatureValid,
            ...normalized,
          });

          return json({
            received: true,
            id: result.id,
            status: result.status,
            dedup: result.dedup,
            signature_valid: signatureValid === 1 ? true : signatureValid === 0 ? 'pending_no_secret' : false,
            normalized_type: normalized.normalized_type,
          }, result.dedup ? 200 : 201);
        }

        // === POST /v1/webhooks/shopify — 接收 Shopify Webhook 事件 ===
        if (path === '/v1/webhooks/shopify' && method === 'POST') {
          const rawBody = await request.text();
          let payload: any;
          try {
            payload = JSON.parse(rawBody);
          } catch {
            return json({ error: "invalid JSON payload" }, 400);
          }

          // 验证 Shopify HMAC 签名
          const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
          const signatureValid = await verifyShopifyHmac(rawBody, hmacHeader, env.SHOPIFY_WEBHOOK_SECRET);

          // 硬约束：签名验证失败则标记 rejected
          if (signatureValid === 2) {
            const result = await storeExternalEvent(env, {
              source: 'shopify',
              source_event_id: String(payload.id || payload.order_id || `shopify_${Date.now()}`),
              event_type: payload.topic || payload.event_type || 'unknown',
              raw_payload: rawBody,
              signature_valid: 2,
              ...normalizeShopifyEvent(payload),
            });
            return json({ received: true, id: result.id, status: 'rejected', reason: 'signature_verification_failed' }, 202);
          }

          // 标准化并存储
          const normalized = normalizeShopifyEvent(payload);
          const result = await storeExternalEvent(env, {
            source: 'shopify',
            source_event_id: String(payload.id || payload.order_id || `shopify_${Date.now()}`),
            event_type: payload.topic || payload.event_type || 'unknown',
            raw_payload: rawBody,
            signature_valid: signatureValid,
            ...normalized,
          });

          return json({
            received: true,
            id: result.id,
            status: result.status,
            dedup: result.dedup,
            signature_valid: signatureValid === 1 ? true : signatureValid === 0 ? 'pending_no_secret' : false,
            normalized_type: normalized.normalized_type,
          }, result.dedup ? 200 : 201);
        }

        // === POST /v1/webhooks/custom — 通用 Webhook（需 Bearer 鉴权）===
        if (path === '/v1/webhooks/custom' && method === 'POST') {
          const auth = await verifyBearerToken(request.headers.get('Authorization'), env);
          if (!auth.ok) return json({ error: auth.error }, 401);

          const rawBody = await request.text();
          let payload: any;
          try {
            payload = JSON.parse(rawBody);
          } catch {
            return json({ error: "invalid JSON payload" }, 400);
          }

          // 自定义 webhook 必须提供 source_event_id 和 event_type
          const sourceEventId = payload.source_event_id || payload.event_id || `custom_${Date.now()}`;
          const eventType = payload.event_type || payload.type || 'custom';

          // 自定义来源不做签名验证（通过 Bearer token 鉴权）
          const result = await storeExternalEvent(env, {
            source: 'custom',
            source_event_id: String(sourceEventId),
            event_type: eventType,
            raw_payload: rawBody,
            signature_valid: 0, // 自定义来源无签名验证机制，标记为未验证
            normalized_type: payload.normalized_type || 'custom',
            normalized_data: payload.normalized_data ? JSON.stringify(payload.normalized_data) : JSON.stringify({
              evidence_id: `ev_ext_${crypto.randomUUID()}`,
              claim_ref: payload.claim_ref || null,
              type: "custom",
              source: payload.source_name || "custom",
              timestamp: new Date().toISOString(),
              data: payload.data || payload,
              hash: "0",
            }),
          });

          return json({
            received: true,
            id: result.id,
            status: result.status,
            dedup: result.dedup,
          }, result.dedup ? 200 : 201);
        }

        // === GET /v1/events — 查询外部事件列表 ===
        if (path === '/v1/events' && method === 'GET') {
          const source = url.searchParams.get('source');
          const status = url.searchParams.get('status');
          const claimRef = url.searchParams.get('claim_ref');
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
          const offset = parseInt(url.searchParams.get('offset') || '0');

          // 构建 SQL（不返回 raw_payload 以减少响应体积，详情接口返回完整数据）
          let sql = "SELECT id, source, source_event_id, event_type, normalized_type, hash, signature_valid, status, claim_ref, created_at FROM external_events WHERE 1=1";
          const binds: any[] = [];

          if (source) {
            sql += " AND source = ?";
            binds.push(source);
          }
          if (status) {
            sql += " AND status = ?";
            binds.push(status);
          }
          if (claimRef) {
            sql += " AND claim_ref = ?";
            binds.push(claimRef);
          }

          // 统计总数
          let countSql = sql.replace("SELECT id, source, source_event_id, event_type, normalized_type, hash, signature_valid, status, claim_ref, created_at", "SELECT COUNT(*) as total");
          const countResult = await env.FLY_D1.prepare(countSql).bind(...binds).first();
          const total = (countResult?.total as number) || 0;

          // 查询列表
          sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
          binds.push(limit, offset);

          const result = await env.FLY_D1.prepare(sql).bind(...binds).all();

          // 统计按 source 和 status 分布
          const statsResult = await env.FLY_D1.prepare("SELECT source, status, COUNT(*) as cnt FROM external_events GROUP BY source, status").all();
          const stats: Record<string, Record<string, number>> = {};
          for (const row of statsResult.results as any[]) {
            if (!stats[row.source]) stats[row.source] = {};
            stats[row.source][row.status] = row.cnt;
          }

          return json({
            total,
            limit,
            offset,
            events: result.results,
            stats,
          });
        }

        // === GET /v1/events/:id — 查询单个外部事件详情 ===
        if (path.startsWith('/v1/events/evt_') && method === 'GET') {
          const eventId = path.split('/v1/events/')[1];
          const event = await env.FLY_D1.prepare("SELECT * FROM external_events WHERE id = ?").bind(eventId).first();
          if (!event) return json({ error: "event not found" }, 404);

          // 解析 JSON 字段
          let normalizedData: any = null;
          try {
            normalizedData = JSON.parse(event.normalized_data as string);
          } catch {}

          return json({
            event: {
              id: event.id,
              source: event.source,
              source_event_id: event.source_event_id,
              event_type: event.event_type,
              raw_payload: event.raw_payload,
              normalized_type: event.normalized_type,
              normalized_data: normalizedData,
              hash: event.hash,
              signature_valid: event.signature_valid,
              status: event.status,
              claim_ref: event.claim_ref,
              created_at: event.created_at,
            },
          });
        }

        // ============================================================
        // v2.15.0: Third-party Replay API — 确定性重放与验证
        // ============================================================

        // ── POST /v1/replay — 从事件流重建 CTRS Report ──
        if (path === '/v1/replay' && method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body) return json({ error: "invalid JSON body" }, 400);

          // 验证必填字段
          if (!Array.isArray(body.events) || body.events.length === 0) {
            return json({ error: "events array is required and must not be empty" }, 400);
          }
          if (!body.claim || !body.claim.subject) {
            return json({ error: "claim.subject is required" }, 400);
          }
          if (!body.rule || !body.rule.method) {
            return json({ error: "rule.method is required" }, 400);
          }

          // 验证 rule.method 合法性
          const validMethods = ["proportional", "weighted", "first_touch", "last_touch"];
          if (!validMethods.includes(body.rule.method)) {
            return json({ error: `rule.method must be one of: ${validMethods.join(', ')}` }, 400);
          }

          // 验证每个 event 结构
          for (let i = 0; i < body.events.length; i++) {
            const ev = body.events[i];
            if (!ev.type || !ev.source || !ev.timestamp) {
              return json({ error: `events[${i}] missing required field (type, source, timestamp)` }, 400);
            }
            if (!ev.data || typeof ev.data !== 'object') {
              return json({ error: `events[${i}].data must be an object` }, 400);
            }
          }

          // 构建 Replay 输入
          const replayEvents: ReplayEvent[] = body.events.map((ev: any) => ({
            type: ev.type,
            source: ev.source,
            timestamp: ev.timestamp,
            data: ev.data,
            hash: ev.hash,
          }));
          const replayClaim: ReplayClaim = {
            subject: body.claim.subject,
            action: body.claim.action || "",
            context: body.claim.context,
          };
          const replayRule: ReplayRule = {
            method: body.rule.method,
            parameters: body.rule.parameters,
          };

          // 重放生成 Report（纯函数，无状态）
          const { report, replayId } = await replayReport(replayEvents, replayClaim, replayRule);

          return json(report, 200, { 'X-Replay-Id': replayId });
        }

        // ── POST /v1/replay/verify — 验证 Report 可通过重放重建 ──
        if (path === '/v1/replay/verify' && method === 'POST') {
          const body: any = await request.json().catch(() => null);
          if (!body) return json({ error: "invalid JSON body" }, 400);

          // 验证必填字段
          if (!body.report || typeof body.report !== 'object') {
            return json({ error: "report object is required" }, 400);
          }
          if (!Array.isArray(body.events) || body.events.length === 0) {
            return json({ error: "events array is required and must not be empty" }, 400);
          }

          // 验证每个 event 结构
          for (let i = 0; i < body.events.length; i++) {
            const ev = body.events[i];
            if (!ev.type || !ev.source || !ev.timestamp) {
              return json({ error: `events[${i}] missing required field (type, source, timestamp)` }, 400);
            }
            if (!ev.data || typeof ev.data !== 'object') {
              return json({ error: `events[${i}].data must be an object` }, 400);
            }
          }

          // 构建 Replay 事件
          const replayEvents: ReplayEvent[] = body.events.map((ev: any) => ({
            type: ev.type,
            source: ev.source,
            timestamp: ev.timestamp,
            data: ev.data,
            hash: ev.hash,
          }));

          // 验证重放
          const result = await verifyReplay(body.report, replayEvents);

          return json(result, 200, { 'X-Replay-Id': `rpl_verify_${result.replay_report_id}` });
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
};
