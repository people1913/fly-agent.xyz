/**
 * Fly Security & Governance Layer
 * 
 * 铁律执行：
 *   好的不动 — V1四个接口(core.ts)一字不改，五级信号不改，L0-L4不改，三层归因不改，四张表不改
 *   缺的补 — 安全/治理用新接口补，不往旧接口塞字段
 *   更好的换 — 整体替换时再换，不打补丁
 */

// V1 不动：AgentIdentity / ActionSignal / VerificationRecord / AttributionRecord
// V1 不动：SignalTypes / VerificationLevels / AttributionType / AttributionStatus
// V1 不动：agents / actions / verifications / attributions 四张表

// ============================================================
// 补丁1：Agent 身份验证（新接口，不动AgentIdentity）
// ============================================================
export interface AgentAuth {
  agent_id: string
  public_key: string
  signature: string
  timestamp: string
  verified: boolean
}

// ============================================================
// 补丁2：API 请求鉴权（新接口）
// ============================================================
export interface APIRequestAuth {
  authorization: string     // Bearer {api_key}
  signature: string         // HMAC-SHA256(secret, body)
  timestamp: string
}

// ============================================================
// 补丁3：伪匿名增强（字段名不变，生成方式升级）
// ============================================================
// V1 user_id = sha256(plaintext)
// V2 user_id = HMAC_SHA256(plaintext, server_salt)
// 旧数据前缀 sha256_，新数据前缀 hmac_，向后兼容

// ============================================================
// 补丁4：Trust Score 多维计算（新接口，不动AgentIdentity.trust_score）
// ============================================================
export interface TrustScoreFactors {
  agent_id: string
  unique_users: number
  time_span_days: number
  channel_diversity: number
  verification_sources: number
  attribution_accuracy: number
  calculated_score: number  // 计算结果写入 trust_score
}

// ============================================================
// 补丁5：Verification 三方分离（新接口，不动VerificationRecord）
// 老师5.1: verifier_type区分来源，L2+必须audit/external
// 老师5.2: verifier_id必须存在，防假审计员
// 老师5.3: verified必须附带evidence
// ============================================================
export type VerifierType = "system" | "human" | "audit" | "external";

export interface VerificationContext {
  verification_id: string
  issuer: string
  subject: string
  verifier: string
  verifier_id: string       // 老师5.2: 必须存在于role_assignments表
  verifier_type: VerifierType // 老师5.1: 来源分类
}

// 验证规则（铁律级）
export const VerificationRules = {
  // 规则1: verifier ≠ subject（防自证）
  canVerify(subject: string, verifier: string): boolean {
    return verifier !== subject;
  },

  // 规则2: verifier_id必须非空（老师5.2）
  hasVerifierId(verifier_id: string): boolean {
    return !!verifier_id && verifier_id.length > 0;
  },

  // 规则3: verified必须附带evidence（老师5.3）
  hasEvidence(evidence: unknown[]): boolean {
    return Array.isArray(evidence) && evidence.length >= 1;
  },

  // 规则4: L2+必须包含audit或external来源（老师5.1）
  canUpgradeToL2(verifier_type: VerifierType): boolean {
    return verifier_type === "audit" || verifier_type === "external";
  },

  // 规则5: 互刷检测阈值
  MUTUAL_VERIFY_THRESHOLD: 3, // 连续互刷超过3次降权
} as const;

// ============================================================
// 补丁6：Bot Detection + 信号质量层
// 老师: signal_type不改，新增signal_quality分离业务事件与风控状态
// ============================================================

export type SignalQuality = "raw" | "verified" | "bot" | "unknown";

export interface SignalVerification {
  signal_quality: SignalQuality
  human_score: number    // 0-100
  bot_detected: boolean
  bot_name?: string      // 如果是bot，记录哪个bot
}

export const BotPatterns: readonly { pattern: RegExp; name: string }[] = [
  { pattern: /GPTBot/i, name: "GPTBot" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot" },
  { pattern: /Claude-User/i, name: "ClaudeUser" },
  { pattern: /Googlebot/i, name: "Googlebot" },
  { pattern: /Bingbot/i, name: "Bingbot" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot" },
  { pattern: /Slackbot/i, name: "Slackbot" },
  { pattern: /Twitterbot/i, name: "Twitterbot" },
  { pattern: /facebookexternalhit/i, name: "Facebook" },
  { pattern: /LinkedInBot/i, name: "LinkedIn" },
  { pattern: /Discordbot/i, name: "Discord" },
  { pattern: /Bytespider/i, name: "Bytespider" },
  { pattern: /SemrushBot/i, name: "SemrushBot" },
  { pattern: /AhrefsBot/i, name: "AhrefsBot" },
];

export function detectBot(userAgent: string): { isBot: boolean; botName?: string } {
  for (const bot of BotPatterns) {
    if (bot.pattern.test(userAgent)) {
      return { isBot: true, botName: bot.name };
    }
  }
  return { isBot: false };
}

// human_score 计算（老师条件2：配置化，不写死进协议）
export interface HumanScoreConfig {
  cookie: number       // 默认20
  js: number           // 默认30
  dwell: number        // 默认20，停留>N秒
  followup: number     // 默认30，后续事件
  threshold: number    // 默认50，≥此值=verified
  dwell_seconds: number // 默认3
}

export const DefaultHumanScoreConfig: HumanScoreConfig = {
  cookie: 20,
  js: 30,
  dwell: 20,
  followup: 30,
  threshold: 50,
  dwell_seconds: 3,
};

export function calcHumanScore(factors: {
  hasCookie: boolean
  jsExecuted: boolean
  stayOverSecs: number
  hasFollowUpEvent: boolean
}, config?: HumanScoreConfig): number {
  const c = config || DefaultHumanScoreConfig;
  let score = 0;
  if (factors.hasCookie) score += c.cookie;
  if (factors.jsExecuted) score += c.js;
  if (factors.stayOverSecs >= c.dwell_seconds) score += c.dwell;
  if (factors.hasFollowUpEvent) score += c.followup;
  return score;
}

export function determineSignalQuality(humanScore: number, isBot: boolean, config?: HumanScoreConfig): SignalQuality {
  const threshold = config?.threshold || DefaultHumanScoreConfig.threshold;
  if (isBot) return "bot";
  if (humanScore >= threshold) return "verified";
  if (humanScore > 0) return "raw";
  return "unknown";
}

// IP限流：同IP 1分钟最多10次
export const RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 10,
} as const;

// ============================================================
// 补丁7：审计事件链（新接口+新表，不动V1四表）
// 老师: actor拆三字段 + reason + source + request_id + hash链防篡改
// 状态: FROZEN — 禁止删除/重命名字段，禁止修改hash计算规则
// ============================================================
export type ActorType = "user" | "agent" | "system";
export type AuditAction = "created" | "updated" | "deleted" | "status_changed" | "verified" | "confirmed" | "rejected";

export interface AuditEvent {
  event_id: string           // aud_{uuid}
  request_id: string         // req_{uuid} 串联同次操作的多条审计记录
  entity_type: string        // agent | action | verification | attribution | policy
  entity_id: string
  action: AuditAction
  actor_type: ActorType      // 谁：user/agent/system
  actor_id: string           // 谁的ID：usr_xxx / agt_xxx / sys_xxx
  actor_name: string         // 谁的名字：Alice / Claude-Code / auto-verify
  source: string             // 从哪改：dashboard / api / worker / cron / system
  reason: string             // 为什么改：manual_correction / verification_failed / fraud_detected / auto_upgrade
  before: string             // 改前（JSON序列化）
  after: string              // 改后（JSON序列化）
  timestamp: string
  prev_hash: string          // 前一条审计记录的event_hash
  event_hash: string         // SHA256(prev_hash + event_id + entity_type + entity_id + action + actor_id + timestamp)
}

// ============================================================
// 补丁8：Governance Layer（新接口+新表）
// 老师4补刀：
//   1. System从Role拆到PrincipalType — Role回答"能干什么"，PrincipalType回答"你是谁"
//   2. 新增Permission — Role是Permission的集合，明确映射
//   3. PolicyEngine默认拒绝 — 没有规则=拒绝，不是允许
//   4. 所有角色/权限变更写入Audit Ledger
// ============================================================

// --- Principal Type（主体类型）：回答"你是谁" ---
export type PrincipalType = "human" | "agent" | "system";

// --- Role（角色）：回答"你能干什么" ---
// System不再是Role，而是PrincipalType
export type GovernanceRole = "owner" | "operator" | "verifier" | "auditor";

// --- Permission（权限点） ---
export type Permission =
  | "agent:create"
  | "agent:update"
  | "verification:create"
  | "verification:approve"
  | "trust:recalculate"
  | "audit:view"
  | "policy:update"
  | "policy:assign_role";

// --- Role → Permission 映射（RBAC） ---
export const RolePermissions: Record<GovernanceRole, Permission[]> = {
  owner: [
    "agent:create", "agent:update",
    "verification:create", "verification:approve",
    "trust:recalculate",
    "audit:view",
    "policy:update", "policy:assign_role",
  ],
  operator: [
    "agent:create", "agent:update",
    "verification:create",
    "audit:view",
  ],
  verifier: [
    "verification:create", "verification:approve",
    "audit:view",
  ],
  auditor: [
    "verification:approve",
    "trust:recalculate",
    "audit:view",
    "policy:assign_role",
  ],
};

// --- RoleAssignment：主体+角色绑定 ---
export interface RoleAssignment {
  id: string                      // ra_{uuid}
  principal_type: PrincipalType   // human | agent | system
  principal_id: string            // usr_xxx | agt_xxx | sys_xxx
  role: GovernanceRole            // owner | operator | verifier | auditor
  resource_type: string           // agent | verification | attribution | policy | system
  resource_id?: string            // 具体资源ID，空=全局
  granted_by: string              // 授予者principal_id
  created_at: string
}

// --- Policy Engine：Default Deny ---
export interface GovernancePolicy {
  id: string
  name: string
  rules: PolicyRule[]
  created_at: string
}

export interface PolicyRule {
  resource: string                 // 操作资源：deal.confirm / attribution.update / ...
  require: GovernanceRole[]        // 需要的角色
  condition?: string               // 可选条件表达式
}

// Default Deny: 没有规则匹配=拒绝
export const GOVERNANCE_DEFAULT_DENY = true;

export const DefaultPolicies: PolicyRule[] = [
  { resource: "deal.confirm",        require: ["verifier", "auditor"] },
  { resource: "attribution.update",   require: ["owner", "auditor"] },
  { resource: "agent.register",      require: ["operator"] },
  { resource: "policy.update",       require: ["owner"] },
  { resource: "policy.assign_role",  require: ["owner"] },
  { resource: "data.delete",         require: ["owner", "auditor"] },
  { resource: "trust.recalculate",   require: ["owner", "auditor"] },
];

// --- 权限检查函数 ---
export function hasPermission(role: GovernanceRole, permission: Permission): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}

export function checkPolicy(
  resource: string,
  roles: GovernanceRole[],
  policies: PolicyRule[] = DefaultPolicies,
): boolean {
  // 找匹配的规则
  const rule = policies.find(r => r.resource === resource);
  if (!rule) {
    // Default Deny：没规则=拒绝
    return !GOVERNANCE_DEFAULT_DENY;
  }
  // 至少有一个角色满足要求
  return rule.require.some(required => roles.includes(required));
}

// ============================================================
// 架构（8层 + 6协议）
// ============================================================
export const FlyArchitecture = {
  layers: [
    { level: 1, name: "Runtime",      replaceable: true  },
    { level: 2, name: "Adapter",      replaceable: true  },
    { level: 3, name: "Gateway",      replaceable: false },
    { level: 4, name: "Identity",     replaceable: false },
    { level: 5, name: "Verification", replaceable: false },
    { level: 6, name: "Attribution",  replaceable: false },
    { level: 7, name: "Governance",   replaceable: false },
    { level: 8, name: "Audit",        replaceable: false },
  ],
  protocols: [
    { name: "AIP", full: "Agent Identity Protocol" },
    { name: "FSS", full: "Fly Signal Standard" },
    { name: "FVP", full: "Fly Verification Protocol" },
    { name: "ATP", full: "Attribution Protocol" },
    { name: "FGP", full: "Fly Governance Protocol" },
    { name: "ALP", full: "Audit Ledger Protocol" },
  ],
} as const;
