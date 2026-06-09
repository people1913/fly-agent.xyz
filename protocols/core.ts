/**
 * Fly Core Protocols — Layer 1: 永远不变
 * 
 * 四个核心接口定义 Fly 的数据基础。
 * 上层代码可以重写，这四个接口不能改字段语义。
 */

// ============================================================
// 1. Agent Identity — Agent 身份协议
// ============================================================
export interface AgentIdentity {
  agent_id: string          // 全局唯一ID，格式：agt_{uuid}
  owner_id: string          // 归属者ID
  provider: string          // 运行时提供方：claude | codex | cursor | dify | coze | custom
  runtime: string           // 运行时环境：claude-code | codex-cli | cursor-agent | dify-flow | coze-bot
  version: string           // Agent 版本号
  trust_score: number       // 信任分 0-100，新注册=50
  verification_level: string // 验证等级：L0 | L1 | L2 | L3 | L4
  created_at: string        // ISO8601
}

export const VerificationLevels = {
  L0: { label: "未验证", description: "刚注册，无任何验证记录" },
  L1: { label: "基础验证", description: "至少1个action_id完成归因闭环" },
  L2: { label: "持续验证", description: "归因准确率≥80%，持续7天" },
  L3: { label: "高度可信", description: "归因准确率≥90%，持续30天，无违规" },
  L4: { label: "企业认证", description: "完成企业资质审核+L3全部条件" },
} as const;

// ============================================================
// 2. Action Signal — 信号协议
// ============================================================
export interface ActionSignal {
  action_id: string         // 全局唯一ID，格式：act_{uuid}
  agent_id: string          // 产生此信号的Agent
  channel: string           // 渠道：douyin | xiaohongshu | wechat | meituan | feishu | geo | direct
  user_id: string           // 脱敏用户ID（sha256），严禁原始手机号/姓名/地址
  signal_type: SignalType   // 信号类型
  timestamp: string         // ISO8601
  metadata: Record<string, unknown> // 扩展字段，不存敏感信息
}

export const SignalTypes = {
  impression: { label: "曝光", order: 1 },
  click:      { label: "点击", order: 2 },
  consult:    { label: "咨询", order: 3 },
  booking:    { label: "预约", order: 4 },
  deal:       { label: "成交", order: 5 },
} as const;

export type SignalType = keyof typeof SignalTypes;

// 营销短链ID格式（向后兼容现有 FLY-HY-001 格式）
export interface MarketingActionId {
  short_id: string          // FLY-HY-001 格式，用于营销短链
  action_id: string         // act_{uuid} 格式，系统内部使用
  campaign: string          // 归属活动
  channel: string           // 归属渠道
}

// ============================================================
// 3. Verification Record — 验证协议
// ============================================================
export interface VerificationRecord {
  verification_id: string   // 全局唯一ID，格式：vrf_{uuid}
  action_id: string         // 被验证的Action
  verifier: string          // 验证方：system | human | api | audit
  result: VerificationResult
  confidence: number        // 置信度 0-1
  evidence: string[]        // 验证证据链（哈希引用）
  created_at: string        // ISO8601
}

export type VerificationResult = "pending" | "verified" | "rejected";

export const VerificationTransitions = {
  pending:  ["verified", "rejected"],
  verified: ["rejected"],
  rejected: [],
} as const;

// ============================================================
// 4. Attribution Record — 归因协议
// ============================================================
export interface AttributionRecord {
  attribution_id: string    // 全局唯一ID，格式：att_{uuid}
  action_id: string         // 源Action
  lead_id: string           // 线索ID
  deal_id?: string          // 成交ID（可选）
  commission?: number       // 佣金金额（可选）
  attribution_type: AttributionType
  status: AttributionStatus
  created_at: string        // ISO8601
}

export type AttributionType = 
  | "deterministic"   // 确定归因
  | "probabilistic"   // 概率归因
  | "unattributed";   // 未归因

export type AttributionStatus = "pending" | "confirmed" | "paid";

export const AttributionTransitions = {
  pending:       ["confirmed", "unattributed"],
  confirmed:     ["paid"],
  paid:          [],
  unattributed:  ["pending"],
} as const;

// ============================================================
// 数据铁律校验（运行时强制）
// ============================================================
export const DataConstraints = {
  allowedFields: ["action_id", "pseudonymized_id", "order_id", "amount", "timestamp"],
  forbiddenFields: ["phone", "name", "id_card", "address", "bank_card"],
  maxRetentionDays: 90,
  dedupWindowHours: 24,
} as const;
