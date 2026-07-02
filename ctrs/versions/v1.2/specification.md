# CTRS (Commercial Trust Report Specification) v1.2

## 1. 引言

### 1.1 目的

本规范定义了 **商业信任报告（Commercial Trust Report, CTRS）** 的数据格式、验证规则和交互协议。CTRS 旨在为 Agent 商业场景提供一种可验证、可追溯、可审计的信任记录标准，使多 Agent 协作中的价值归因与结算具有机器可验证的确定性。

### 1.2 范围

本规范适用于：

- 生成、验证和存储商业信任报告的所有实现
- 基于 Agent 协作的价值归因计算
- 多方参与的结算分润场景
- 跨平台互操作验证

本规范不定义：

- 具体的传输协议（HTTP/gRPC 等）
- 用户界面展示方式
- 具体的支付结算执行机制

### 1.3 术语定义

| 术语 | 定义 |
|------|------|
| **Report** | 一份完整的商业信任报告，包含 Claim、Evidence、Rule、Attribution 和 Settlement 五层结构 |
| **Claim** | 声明层，描述"谁做了什么"的事实主张 |
| **Evidence** | 证据层，支撑 Claim 的可验证数据 |
| **Rule** | 规则层，定义归因计算的方法和参数，是一等对象（First-Class Object） |
| **Attribution** | 归因层，基于 Evidence 和 Rule 计算各参与方的贡献 |
| **Settlement** | 结算层，基于 Attribution 给出各参与方的分润建议 |
| **Issuer** | 报告或规则的签发者，具有可验证的身份标识 |
| **Registry** | 注册表，用于验证 Rule 和 Issuer 的合法性和信任等级 |

### 1.4 RFC 2119 关键词声明

本规范中使用的关键词 **MUST**、**MUST NOT**、**REQUIRED**、**SHALL**、**SHALL NOT**、**SHOULD**、**SHOULD NOT**、**RECOMMENDED**、**MAY** 和 **OPTIONAL** 遵循 [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt) 的定义：

- **MUST** / **REQUIRED** / **SHALL**：绝对要求，违反即为不合格实现
- **MUST NOT** / **SHALL NOT**：绝对禁止
- **SHOULD** / **RECOMMENDED**：推荐但非强制；存在合理理由时可忽略，但需充分理解其影响
- **MAY** / **OPTIONAL**：完全可选

---

## 2. 核心概念

### 2.1 Report 生命周期

一份 CTRS Report 从创建到结算经历以下状态：

```
draft → verified → eligible → settled
                   ↘ disputed
```

| 状态 | 说明 |
|------|------|
| `draft` | 初始草稿，尚未验证 |
| `verified` | 已通过 Schema 完整性、Hash 完整性等基础验证 |
| `eligible` | 已通过全部验证（含 Registry 检查），可进入结算流程（v1.2 新增） |
| `settled` | 结算已完成 |
| `disputed` | 存在争议，需人工介入 |

### 2.2 七层结构定义

CTRS Report 由以下层级构成：

| 层级 | 名称 | 对象 | 职责 |
|------|------|------|------|
| L0 | 元数据 | Report 顶层 | 标识、版本、时间戳、状态 |
| L1 | 声明 | Claim | 描述事实主张 |
| L2 | 证据 | Evidence[] | 提供可验证的数据支撑 |
| L3 | 规则 | Rule | 定义归因方法和参数（一等对象） |
| L4 | 归因 | Attribution | 基于 Rule 和 Evidence 计算贡献 |
| L5 | 结算 | Settlement | 基于归因结果生成分润方案 |
| L6 | 注册表 | Registry（外部） | 验证 Rule 和 Issuer 的合法性 |

### 2.3 数据流模型

```
Claim ──→ Evidence[] ──→ Rule ──→ Attribution ──→ Settlement
  │            │            │           │              │
  │            │            │           │              │
  └── claim_id ←── claim_ref    rule_hash ←── rule_hash  attribution_ref
                  (引用一致性)   (Hash 绑定)               (引用一致性)
```

**核心约束**：

- Evidence MUST 通过 `claim_ref` 引用 Claim
- Attribution MUST 通过 `rule_hash` 绑定 Rule（而非 Rule 文本）
- Settlement MUST 通过 `attribution_ref` 引用 Attribution
- 所有 Hash 绑定 MUST 可通过重新计算验证

---

## 3. 消息格式

### 3.1 Report 对象

Report 是 CTRS 的顶层容器。

#### MUST 字段（强制）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `report_id` | string | UUID v4 | Report 唯一标识符 |
| `schema_version` | string | const `"CTRS-v1.2"` | 规范版本标识符 |
| `type` | string | const `"CommercialTrustReport"` | 类型标识符 |
| `created_at` | string | ISO 8601 datetime | Report 创建时间 |
| `claim` | object | Claim 对象 | 声明层 |
| `evidence` | array | Evidence 对象数组，minItems: 1 | 证据层 |
| `attribution` | object | Attribution 对象 | 归因层 |
| `settlement` | object | Settlement 对象 | 结算层 |

#### SHOULD 字段（推荐）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `status` | string | enum: `draft` \| `verified` \| `disputed` \| `settled` \| `eligible` | Report 当前状态 |
| `issuer` | object | `{id: string, name: string}` | 报告签发者 |
| `rule` | object | Rule 对象 | 归因规则（v1.1+ 推荐为 MUST） |

#### MAY 字段（可选）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `metadata` | object | additionalProperties: true | 自定义元数据 |
| `proof` | object | 扩展对象 | 证明信息（如数字签名） |

### 3.2 Claim 对象

Claim 描述"谁做了什么"的事实主张。

#### MUST 字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `claim_id` | string | UUID | Claim 唯一标识符 |
| `type` | string | 非空 | Claim 类型（如 `multi_agent_conversion`） |
| `subject` | string | 非空 | Claim 主题概述 |
| `description` | string | 非空 | Claim 详细描述 |
| `timestamp` | string | ISO 8601 datetime | 事件发生时间 |
| `parties` | array | Party 对象数组，minItems: 1 | 参与方列表 |

#### Party 对象

| 字段 | 级别 | 类型 | 说明 |
|------|------|------|------|
| `id` | MUST | string | 参与方标识符 |
| `role` | MUST | string | 参与方角色（如 `recommender`, `buyer`） |
| `name` | MAY | string | 参与方显示名称 |

### 3.3 Evidence 对象

Evidence 提供 Claim 的可验证数据支撑。

#### MUST 字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `evidence_id` | string | UUID | Evidence 唯一标识符 |
| `claim_ref` | string | MUST 等于关联 Claim 的 `claim_id` | 引用所属 Claim |
| `type` | string | enum: `webhook` \| `conversation` \| `mcp` \| `payment` \| `crm` \| `stripe` \| `custom` | 证据类型 |
| `source` | string | 非空 | 证据来源标识 |
| `timestamp` | string | ISO 8601 datetime | 证据采集时间 |
| `data` | object | additionalProperties: true | 证据原始数据 |
| `hash` | string | SHA-256 hex | 证据数据的 Hash 值 |

#### Hash 计算规则

Evidence Hash 的计算方式：

```
hash = SHA-256(JSON.stringify(data, sort_keys=True))
```

实现 MUST 在验证时重新计算 `hash` 并与存储值比对。任何不匹配 MUST 导致验证失败。

### 3.4 Rule 对象

Rule 是归因计算的一等对象（First-Class Object）。自 v1.1 起，Rule 不再是简单字符串，而是具有独立身份的对象。

#### MUST 字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `rule_id` | string | 非空 | Rule 唯一标识符 |
| `issuer` | string | DID/agent_id/org_id | Rule 签发者标识符 |
| `version` | string | semver | Rule 版本号 |
| `hash` | string | SHA-256 hex | Rule definition 的 Hash 值 |
| `definition` | object | Definition 对象 | Rule 实际内容 |
| `created_at` | string | ISO 8601 datetime | Rule 创建时间 |

#### Definition 对象

| 字段 | 级别 | 类型 | 说明 |
|------|------|------|------|
| `name` | MUST | string | 人类可读的规则名称 |
| `method` | MUST | string | 归因方法（如 `proportional`, `weighted`） |
| `parameters` | MUST | object | 规则参数（splits, weights, thresholds 等） |
| `description` | SHOULD | string | 人类可读的规则描述 |
| `visibility` | MAY | string | enum: `public` \| `private` \| `shared` |

#### Hash 计算规则

Rule Hash 的计算方式：

```
hash = SHA-256(JSON.stringify(definition, sort_keys=True))
```

**关键约束**：Attribution MUST 通过 `rule_hash` 绑定 Rule 的 `hash` 值，而不是绑定 Rule 文本。这确保了 Rule 内容的任何修改都能被检测到。

### 3.5 Attribution 对象

Attribution 基于 Evidence 和 Rule 计算各参与方的贡献。

#### MUST 字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `attribution_id` | string | UUID | Attribution 唯一标识符 |
| `claim_ref` | string | MUST 等于 Claim 的 `claim_id` | 引用所属 Claim |
| `rule_hash` | string | MUST 等于 Rule 的 `hash` | 绑定 Rule（Hash 绑定） |
| `method` | string | 非空 | 归因方法名称 |
| `confidence` | number | 0 ≤ value ≤ 1 | 归因置信度（v1.2 统一为 0-1 浮点数） |
| `result` | array | Result 对象数组，minItems: 1 | 各参与方的归因结果 |
| `reasoning` | string | 非空 | 归因推理说明 |
| `attributed_at` | string | ISO 8601 datetime | 归因计算时间 |

#### Result 对象

| 字段 | 级别 | 类型 | 说明 |
|------|------|------|------|
| `party_id` | MUST | string | 参与方标识符 |
| `contribution_pct` | MUST | string | 贡献百分比（字符串表示） |
| `attributed_value` | MUST | string | 归因金额（字符串表示） |

#### v1.2 变更说明

`confidence` 字段从 v1.1 的整数范围（70-95）改为 0-1 浮点数。实现 MUST 使用浮点格式。

### 3.6 Settlement 对象

Settlement 基于 Attribution 给出各参与方的分润方案。

#### MUST 字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `settlement_id` | string | UUID | Settlement 唯一标识符 |
| `attribution_ref` | string | MUST 等于 Attribution 的 `attribution_id` | 引用 Attribution |
| `status` | string | enum: `eligible` \| `pending` \| `settled` \| `disputed` | 结算状态 |
| `amount` | string | 非空 | 结算总金额（字符串表示） |
| `currency` | string | ISO 4217 | 货币代码 |
| `split` | array | Split 对象数组，minItems: 1 | 各参与方的分润详情 |
| `eligible_parties` | array | string 数组 | 符合结算资格的参与方列表 |

#### Split 对象

| 字段 | 级别 | 类型 | 说明 |
|------|------|------|------|
| `party_id` | MUST | string | 参与方标识符 |
| `share_pct` | MUST | string | 分润百分比（字符串表示） |
| `share_amount` | MUST | string | 分润金额（字符串表示） |

#### v1.2 变更说明

Settlement `status` 新增 `eligible` 枚举值，表示已通过全部验证、可进入结算流程。此前版本只有 `pending`/`settled`/`disputed`。

### 3.7 Issuer 对象

Issuer 描述报告或规则的签发者。

#### MUST 字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | string | 非空 | 签发者标识符 |
| `name` | string | 非空 | 签发者显示名称 |

---

## 4. 验证规则

### 4.1 验证层级

CTRS 验证分为三个层级：

| 层级 | 名称 | 验证内容 |
|------|------|---------|
| L1 | Schema 完整性 | 字段存在性、类型正确性、格式合法性 |
| L2 | Hash 完整性 | 数据哈希验证、引用一致性 |
| L3 | 注册表验证 | Rule 注册状态、Issuer 信任等级 |

### 4.2 L1: Schema 完整性

#### VR-101: Report 必填字段检查

- **规则 ID**: VR-101
- **验证逻辑**: Report 对象 MUST 包含所有 MUST 字段（`report_id`, `schema_version`, `type`, `created_at`, `claim`, `evidence`, `attribution`, `settlement`）
- **失败条件**: 任一 MUST 字段缺失
- **示例**: 缺少 `report_id` → 验证失败
- **追溯元数据**:
  - Section: 3.1 Report 对象
  - Fields: report_id, schema_version, type, created_at, claim, evidence, attribution, settlement
  - Test Cases: tests/v1.2/core/schema-completeness.json#test-001

#### VR-102: Claim 必填字段检查

- **规则 ID**: VR-102
- **验证逻辑**: Claim 对象 MUST 包含 `claim_id`, `type`, `subject`, `description`, `timestamp`, `parties`
- **失败条件**: 任一 MUST 字段缺失
- **示例**: 缺少 `claim_id` → 验证失败
- **追溯元数据**:
  - Section: 3.2 Claim 对象
  - Fields: claim_id, type, subject, description, timestamp, parties
  - Test Cases: tests/v1.2/core/claim-completeness.json#test-001

#### VR-103: Evidence 必填字段检查

- **规则 ID**: VR-103
- **验证逻辑**: 每个 Evidence 对象 MUST 包含 `evidence_id`, `claim_ref`, `type`, `source`, `timestamp`, `data`, `hash`
- **失败条件**: 任一 MUST 字段缺失
- **示例**: 缺少 `hash` → 验证失败
- **追溯元数据**:
  - Section: 3.3 Evidence 对象
  - Fields: evidence_id, claim_ref, type, source, timestamp, data, hash
  - Test Cases: tests/v1.2/core/evidence-completeness.json#test-001

#### VR-104: Evidence type 枚举检查

- **规则 ID**: VR-104
- **验证逻辑**: `evidence[].type` MUST 为以下枚举值之一: `webhook`, `conversation`, `mcp`, `payment`, `crm`, `stripe`, `custom`
- **失败条件**: `type` 值不在枚举范围内
- **示例**: `type: "email"` → 验证失败
- **追溯元数据**:
  - Section: 3.3 Evidence 对象
  - Fields: evidence[].type
  - Test Cases: tests/v1.2/core/evidence-type-enum.json#test-001

#### VR-105: Rule 必填字段检查

- **规则 ID**: VR-105
- **验证逻辑**: Rule 对象 MUST 包含 `rule_id`, `issuer`, `version`, `hash`, `definition`, `created_at`
- **失败条件**: 任一 MUST 字段缺失
- **示例**: 缺少 `rule_id` → 验证失败
- **追溯元数据**:
  - Section: 3.4 Rule 对象
  - Fields: rule_id, issuer, version, hash, definition, created_at
  - Test Cases: tests/v1.2/core/rule-completeness.json#test-001

#### VR-106: Attribution 必填字段检查

- **规则 ID**: VR-106
- **验证逻辑**: Attribution 对象 MUST 包含 `attribution_id`, `claim_ref`, `rule_hash`, `method`, `confidence`, `result`, `reasoning`, `attributed_at`
- **失败条件**: 任一 MUST 字段缺失
- **示例**: 缺少 `rule_hash` → 验证失败
- **追溯元数据**:
  - Section: 3.5 Attribution 对象
  - Fields: attribution_id, claim_ref, rule_hash, method, confidence, result, reasoning, attributed_at
  - Test Cases: tests/v1.2/core/attribution-completeness.json#test-001

#### VR-107: Settlement 必填字段检查

- **规则 ID**: VR-107
- **验证逻辑**: Settlement 对象 MUST 包含 `settlement_id`, `attribution_ref`, `status`, `amount`, `currency`, `split`, `eligible_parties`
- **失败条件**: 任一 MUST 字段缺失
- **示例**: 缺少 `currency` → 验证失败
- **追溯元数据**:
  - Section: 3.6 Settlement 对象
  - Fields: settlement_id, attribution_ref, status, amount, currency, split, eligible_parties
  - Test Cases: tests/v1.2/core/settlement-completeness.json#test-001

#### VR-108: schema_version 常量检查

- **规则 ID**: VR-108
- **验证逻辑**: `schema_version` MUST 为 `"CTRS-v1.2"`
- **失败条件**: 值不等于 `"CTRS-v1.2"`
- **示例**: `schema_version: "1.2"` → 验证失败
- **追溯元数据**:
  - Section: 3.1 Report 对象
  - Fields: schema_version
  - Test Cases: tests/v1.2/core/schema-version-check.json#test-001

#### VR-109: type 常量检查

- **规则 ID**: VR-109
- **验证逻辑**: `type` MUST 为 `"CommercialTrustReport"`
- **失败条件**: 值不等于 `"CommercialTrustReport"`
- **示例**: `type: "TrustReport"` → 验证失败
- **追溯元数据**:
  - Section: 3.1 Report 对象
  - Fields: type
  - Test Cases: tests/v1.2/core/type-constant-check.json#test-001

#### VR-110: confidence 范围检查

- **规则 ID**: VR-110
- **验证逻辑**: `attribution.confidence` MUST 为 0 到 1 之间的浮点数
- **失败条件**: 值 < 0 或 > 1，或非数值类型
- **示例**: `confidence: 95` → 验证失败（v1.2 不再接受整数百分比）
- **追溯元数据**:
  - Section: 3.5 Attribution 对象
  - Fields: attribution.confidence
  - Test Cases: tests/v1.2/core/confidence-range.json#test-001

#### VR-111: Settlement status 枚举检查

- **规则 ID**: VR-111
- **验证逻辑**: `settlement.status` MUST 为以下枚举值之一: `eligible`, `pending`, `settled`, `disputed`
- **失败条件**: 值不在枚举范围内
- **示例**: `status: "approved"` → 验证失败
- **追溯元数据**:
  - Section: 3.6 Settlement 对象
  - Fields: settlement.status
  - Test Cases: tests/v1.2/core/settlement-status-enum.json#test-001

#### VR-112: Report status 枚举检查

- **规则 ID**: VR-112
- **验证逻辑**: `status`（如存在）MUST 为以下枚举值之一: `draft`, `verified`, `disputed`, `settled`, `eligible`
- **失败条件**: 值不在枚举范围内
- **示例**: `status: "approved"` → 验证失败
- **追溯元数据**:
  - Section: 3.1 Report 对象
  - Fields: status
  - Test Cases: tests/v1.2/core/report-status-enum.json#test-001

### 4.3 L2: Hash 完整性

#### VR-201: Evidence Hash 完整性

- **规则 ID**: VR-201
- **验证逻辑**: 对每个 Evidence，重新计算 `SHA-256(JSON.stringify(evidence.data, sort_keys=True))`，与 `evidence.hash` 比对
- **失败条件**: 任一 Evidence 的 Hash 不匹配
- **示例**: 数据被篡改导致 Hash 不一致 → 验证失败
- **追溯元数据**:
  - Section: 3.3 Evidence 对象
  - Fields: evidence[].hash, evidence[].data
  - Test Cases: tests/v1.2/integrity/evidence-hash-integrity.json#test-001

#### VR-202: Rule Hash 完整性

- **规则 ID**: VR-202
- **验证逻辑**: 重新计算 `SHA-256(JSON.stringify(rule.definition, sort_keys=True))`，与 `rule.hash` 比对
- **失败条件**: Hash 不匹配
- **示例**: Rule definition 被修改但 hash 未更新 → 验证失败
- **追溯元数据**:
  - Section: 3.4 Rule 对象
  - Fields: rule.hash, rule.definition
  - Test Cases: tests/v1.2/integrity/rule-hash-integrity.json#test-001

### 4.4 L3: 引用一致性

#### VR-301: Evidence-Claim 引用一致性

- **规则 ID**: VR-301
- **验证逻辑**: 每个 `evidence[].claim_ref` MUST 等于 `claim.claim_id`
- **失败条件**: 任一 `claim_ref` 不匹配
- **示例**: `claim_ref` 指向不存在的 Claim → 验证失败
- **追溯元数据**:
  - Section: 3.3 Evidence 对象 → 3.2 Claim 对象
  - Fields: evidence[].claim_ref, claim.claim_id
  - Test Cases: tests/v1.2/consistency/evidence-claim-ref.json#test-001

#### VR-302: Attribution-Claim 引用一致性

- **规则 ID**: VR-302
- **验证逻辑**: `attribution.claim_ref` MUST 等于 `claim.claim_id`
- **失败条件**: `claim_ref` 不匹配
- **示例**: Attribution 引用了不同的 Claim → 验证失败
- **追溯元数据**:
  - Section: 3.5 Attribution 对象 → 3.2 Claim 对象
  - Fields: attribution.claim_ref, claim.claim_id
  - Test Cases: tests/v1.2/consistency/attribution-claim-ref.json#test-001

#### VR-303: Attribution-Rule Hash 绑定

- **规则 ID**: VR-303
- **验证逻辑**: `attribution.rule_hash` MUST 等于 `rule.hash`
- **失败条件**: `rule_hash` 不匹配
- **示例**: Rule 被修改但 Attribution 仍引用旧 Hash → 验证失败
- **追溯元数据**:
  - Section: 3.5 Attribution 对象 → 3.4 Rule 对象
  - Fields: attribution.rule_hash, rule.hash
  - Test Cases: tests/v1.2/consistency/attribution-rule-binding.json#test-001

#### VR-304: Settlement-Attribution 引用一致性

- **规则 ID**: VR-304
- **验证逻辑**: `settlement.attribution_ref` MUST 等于 `attribution.attribution_id`
- **失败条件**: `attribution_ref` 不匹配
- **示例**: Settlement 引用了不同的 Attribution → 验证失败
- **追溯元数据**:
  - Section: 3.6 Settlement 对象 → 3.5 Attribution 对象
  - Fields: settlement.attribution_ref, attribution.attribution_id
  - Test Cases: tests/v1.2/consistency/settlement-attribution-ref.json#test-001

### 4.5 L3: 金额正确性

#### VR-401: Settlement 分润金额正确性

- **规则 ID**: VR-401
- **验证逻辑**: `sum(settlement.split[].share_amount)` MUST 等于 `settlement.amount`
- **失败条件**: 分润金额加总不等于总金额
- **示例**: `amount: "120"`, splits 加总 = 119 → 验证失败
- **追溯元数据**:
  - Section: 3.6 Settlement 对象
  - Fields: settlement.split[].share_amount, settlement.amount
  - Test Cases: tests/v1.2/settlement/settlement-amount-correctness.json#test-001

#### VR-402: Settlement 参与方与 Attribution 一致

- **规则 ID**: VR-402
- **验证逻辑**: `settlement.eligible_parties` 中的每个 `party_id` MUST 存在于 `attribution.result[].party_id`
- **失败条件**: 存在不一致的 `party_id`
- **示例**: Settlement 包含 `agent-d` 但 Attribution 中无此人 → 验证失败
- **追溯元数据**:
  - Section: 3.6 Settlement 对象 → 3.5 Attribution 对象
  - Fields: settlement.eligible_parties, attribution.result[].party_id
  - Test Cases: tests/v1.2/settlement/settlement-party-consistency.json#test-001

### 4.6 L3: 注册表验证

#### VR-501: Rule 注册验证

- **规则 ID**: VR-501
- **验证逻辑**: `rule.rule_id` 和 `rule.hash` MUST 存在于 Rule Registry
- **失败条件**: Rule 未注册或 Hash 不匹配
- **示例**: Rule 未在 Registry 中注册 → 验证失败
- **追溯元数据**:
  - Section: 4.6 L3 注册表验证
  - Fields: rule.rule_id, rule.hash
  - Test Cases: tests/v1.2/registry/rule-registration.json#test-001

#### VR-502: Issuer 信任验证

- **规则 ID**: VR-502
- **验证逻辑**: Rule 的 `issuer` 在 Issuer Registry 中的 `trust_level` MUST 为 `trusted` 或 `verified`
- **失败条件**: Issuer 不存在或 `trust_level` 不符合要求
- **示例**: Issuer 的 `trust_level` 为 `unverified` → 验证失败
- **追溯元数据**:
  - Section: 4.6 L3 注册表验证
  - Fields: rule.issuer
  - Test Cases: tests/v1.2/registry/issuer-trust.json#test-001

---

## 5. 安全考虑

### 5.1 Hash 算法要求

- CTRS v1.2 MUST 使用 SHA-256 作为 Hash 算法
- 所有 Hash 值 MUST 以十六进制字符串形式存储
- 实现 SHOULD 考虑未来支持更安全算法的扩展机制

### 5.2 防篡改机制

CTRS 通过以下机制保证数据不可篡改：

1. **Evidence Hash**: 每个 Evidence 的数据 Hash 确保证据原始数据未被修改
2. **Rule Hash**: Rule 的 Definition Hash 确保归因规则未被修改
3. **Hash 绑定**: Attribution 通过 `rule_hash` 绑定 Rule，而非引用可变文本
4. **引用完整性**: 各层之间的引用关系（`claim_ref`, `attribution_ref`, `rule_hash`）确保结构完整性

### 5.3 金额安全

- 所有金额 MUST 以字符串形式存储，避免浮点精度问题
- 分润金额加总 MUST 严格等于总金额
- 货币代码 MUST 遵循 ISO 4217 标准

### 5.4 时间戳安全

- 所有时间戳 MUST 使用 ISO 8601 格式
- 实现 SHOULD 验证时间戳的合理性（如不早于 Claim 时间）

---

## 6. 扩展性

### 6.1 自定义字段

CTRS 允许在以下对象中添加自定义字段：

- Report 顶层（`additionalProperties: true`）
- Claim 对象（`additionalProperties: true`）
- Evidence 对象（`additionalProperties: true`）
- Rule 对象（`additionalProperties: true`）
- Rule Definition 对象（`additionalProperties: true`）
- Attribution 对象（`additionalProperties: true`）
- Settlement 对象（`additionalProperties: true`）

自定义字段 MUST NOT 覆盖规范定义的字段名称。实现 SHOULD 忽略无法识别的自定义字段。

### 6.2 版本兼容

- `schema_version` 字段标识当前 Report 遵循的规范版本
- 实现 SHOULD 支持向后兼容：v1.2 实现 SHOULD 能读取 v1.1 格式的 Report
- 版本间的主要差异：
  - v1.1 → v1.2: 新增 `eligible` 结算状态，`confidence` 改为浮点数，新增 Social Authority 层
  - v1.0 → v1.1: Rule 升级为一等对象，Attribution 绑定 `rule_hash`

---

## 7. 版本兼容策略

### 7.1 版本号规范

CTRS 遵循 Semantic Versioning 2.0.0（https://semver.org/）：

- **MAJOR**（主版本）：不兼容的 API 变更
- **MINOR**（次版本）：向后兼容的功能新增
- **PATCH**（补丁版本）：向后兼容的问题修复

版本号格式为 `<major>.<minor>.<patch>`，示例：`1.2.0`。

Pre-release 版本格式：`1.3.0-alpha`, `1.3.0-beta.1`, `2.0.0-rc.1`。

### 7.2 兼容性分类

每个版本变更必须声明兼容性级别：

| 级别 | 含义 | Consumer 行为 | 示例 |
|------|------|--------------|------|
| **FULL** | 完全兼容，Consumer 无需修改 | 正常处理 | 修复文档错误、PATCH 版本升级 |
| **GRACE** | 可选字段新增，旧 Consumer 可忽略 | 警告后继续 | 新增 `metadata` 字段、新增枚举值 |
| **BREAKING** | 不兼容，Consumer 必须升级 | 拒绝处理 | 删除 MUST 字段、修改字段语义 |

**变更与兼容性级别的对应关系**：

| 变更类型 | 版本递增 | 兼容性级别 |
|---------|---------|-----------|
| 新增可选字段 | MINOR | GRACE |
| 新增枚举值 | MINOR | GRACE |
| 新增 MUST 字段 | MAJOR | BREAKING |
| 删除字段 | MAJOR | BREAKING |
| 修改字段语义 | MAJOR | BREAKING |
| 修复非语义问题 | PATCH | FULL |

### 7.3 Consumer 兼容性策略

Consumer 实现应支持以下三种策略：

- **strict**: 只接受完全相同的 `schema_version`，遇到未知字段即拒绝。适用于对数据格式有严格要求的场景。
- **graceful**: 接受相同 MAJOR 版本，忽略新增的未知字段。适用于需要向前兼容的通用场景。
- **negotiated**: 通过协商确定兼容版本。Provider 在响应中声明支持的版本列表，Consumer 选择最佳版本。适用于多版本共存的复杂场景。

**默认策略**: graceful

**策略配置示例**：

```json
{
  "compatibility": {
    "mode": "graceful",
    "accepted_versions": ["1.0.x", "1.1.x", "1.2.x"],
    "on_unknown_field": "warn"
  }
}
```

### 7.4 版本协商机制

Provider 可以在响应中声明支持的版本：

```json
{
  "schema_version": "CTRS-v1.2",
  "supported_versions": ["1.0.0", "1.1.0", "1.2.0"],
  "deprecated_versions": ["1.0.0"],
  "breaking_change_in": "2.0.0"
}
```

Consumer SHOULD 优先使用响应的 `schema_version`，以支持滚动升级。

### 7.5 v1.3 兼容性预告

CTRS v1.3 计划为 **GRACE** 级别：

- 新增可选字段（如 `proof`、`registry_refs`）
- 不删除或修改现有 MUST 字段
- 现有 Consumer 可继续工作，无需修改

---

## 8. Compliance Levels（合规级别）

### 8.1 设计理念

CTRS 采用 **RFC 风格的 Compliance Levels 体系**，借鉴 OAuth 2.0（Core + Extensions）、JWT/JWS/JWE（分层规范）和 OpenAPI（compliance levels）等成熟协议的经验，遵循"稳定核心 + 多个扩展"模式。

核心设计原则：

1. **渐进式采用**：实现者可以从最小的 Core 级别起步，无需部署外部基础设施即可完成基础验证
2. **可组合扩展**：每个 Extension 独立定义，实现者按需组合，不要求全有或全无
3. **互操作保证**：同一 Compliance Level 的实现之间 MUST 具有完全的互操作性
4. **向后兼容**：高 Level 实现 MUST 能正确处理低 Level 的 Report

### 8.2 Level 定义

#### CTRS Core

**标识符**: `ctrs-core`

CTRS Core 是最小可验证实现。Core 实现能够对一份 Report 的结构完整性和数学正确性进行端到端验证，**不依赖任何外部服务**。

Core 实现者 MUST：

- 实现所有 Core 层级的对象（Report、Claim、Evidence、Rule、Attribution、Settlement）及其 MUST 字段
- 实现 VR-101 至 VR-402 的全部验证规则（共 20 条）
- 正确处理 `draft`、`verified`、`eligible`、`settled` 状态转换
- 支持 SHA-256 Hash 计算和验证
- Report 中 `issuer` 字段为 SHOULD（推荐但非强制）
- Report 中 `rule` 字段为 SHOULD（推荐但非强制），但若存在 MUST 满足 VR-105/VR-202/VR-303

Core 实现者 MAY：

- 忽略 Registry 相关验证（VR-501、VR-502）
- 将 `disputed` 状态视为合法但不做争议流程处理

#### CTRS Governance Extension

**标识符**: `ctrs-governance`

Governance Extension 在 Core 基础上增加注册表和信任基础设施，确保 Rule 和 Issuer 的合法性可通过外部 Registry 验证。

Governance 实现者 MUST 满足 Core 的全部要求，并额外：

- 实现 VR-501（Rule 注册验证）和 VR-502（Issuer 信任验证）
- Report 中 `issuer` 字段升级为 MUST（不再仅是 SHOULD）
- Report 中 `rule` 字段升级为 MUST（不再仅是 SHOULD）
- 实现 Issuer 对象的完整验证（包括 `id` 和 `name` 的合法性检查）
- 支持 Rule Registry 的查询接口（按 `rule_id` + `hash` 查询注册状态）
- 支持 Issuer Registry 的查询接口（按 `issuer.id` 查询信任等级）
- 信任等级 MUST 为 `trusted` 或 `verified` 才能通过验证
- 实现 `eligible` 状态的完整语义：Report MUST 通过 VR-501 和 VR-502 才能进入 `eligible` 状态

Governance 实现者 SHOULD：

- 支持 Rule 的版本生命周期管理（注册、更新、废弃）
- 支持 Issuer 信任等级的升降级审计日志
- 实现 Trust Policy 配置（可配置哪些 `trust_level` 是可接受的）

#### CTRS Enterprise Extension

**标识符**: `ctrs-enterprise`

Enterprise Extension 在 Governance 基础上增加企业级业务流程支持，覆盖争议处理、审计追踪和复杂结算场景。

Enterprise 实现者 MUST 满足 Governance 的全部要求，并额外：

- 实现 `disputed` 状态的完整争议工作流：
  - 支持争议发起（任何参与方均可发起争议）
  - 支持争议证据提交（dispute evidence 独立于原始 Evidence）
  - 支持争议解决（人工裁决或仲裁规则判定）
  - 争议解决后状态 MUST 转换为 `eligible` 或 `settled`
- 实现 `proof` 字段（Report MAY 字段升级为 SHOULD）：
  - 支持数字签名验证（Ed25519 或 ECDSA P-256）
  - 签名对象 MUST 包含 `algorithm`、`value`、`issuer`
  - 验证时 MUST 检查签名与 Report 内容的一致性
- 实现 Multi-Settlement 支持：
  - 单份 Report 可关联多个 Settlement（如分期结算、多币种结算）
  - 每个 Settlement MUST 独立满足 VR-401 和 VR-402
  - 多 Settlement 之间 MUST NOT 存在金额重叠

Enterprise 实现者 SHOULD：

- 实现审计追踪（Audit Trail）：
  - 记录 Report 的每次状态变更及操作者
  - 审计日志 MUST 不可篡改（使用 Hash 链或 Merkle Tree）
  - 审计日志 SHOULD 可导出为标准格式
- 实现合规监控面板：
  - 聚合统计各 Level 的验证通过率
  - 实时告警异常验证模式
- 支持批量 Report 验证和批量结算

### 8.3 验证规则与 Compliance Level 映射

| 验证规则 | 规则名称 | 验证层级 | Compliance Level |
|---------|---------|---------|-----------------|
| VR-101 | Report 必填字段检查 | L1 | Core |
| VR-102 | Claim 必填字段检查 | L1 | Core |
| VR-103 | Evidence 必填字段检查 | L1 | Core |
| VR-104 | Evidence type 枚举检查 | L1 | Core |
| VR-105 | Rule 必填字段检查 | L1 | Core |
| VR-106 | Attribution 必填字段检查 | L1 | Core |
| VR-107 | Settlement 必填字段检查 | L1 | Core |
| VR-108 | schema_version 常量检查 | L1 | Core |
| VR-109 | type 常量检查 | L1 | Core |
| VR-110 | confidence 范围检查 | L1 | Core |
| VR-111 | Settlement status 枚举检查 | L1 | Core |
| VR-112 | Report status 枚举检查 | L1 | Core |
| VR-201 | Evidence Hash 完整性 | L2 | Core |
| VR-202 | Rule Hash 完整性 | L2 | Core |
| VR-301 | Evidence-Claim 引用一致性 | L3 | Core |
| VR-302 | Attribution-Claim 引用一致性 | L3 | Core |
| VR-303 | Attribution-Rule Hash 绑定 | L3 | Core |
| VR-304 | Settlement-Attribution 引用一致性 | L3 | Core |
| VR-401 | Settlement 分润金额正确性 | L3 | Core |
| VR-402 | Settlement 参与方与 Attribution 一致 | L3 | Core |
| VR-501 | Rule 注册验证 | L3 | Governance |
| VR-502 | Issuer 信任验证 | L3 | Governance |

**设计说明**：

- **Core 包含 20 条规则**（VR-101 至 VR-402）：覆盖 Schema 完整性、Hash 完整性、引用一致性和金额正确性，这些规则仅依赖 Report 内部数据即可验证
- **Governance 包含 2 条规则**（VR-501、VR-502）：涉及外部 Registry 依赖，需要部署基础设施
- **Enterprise 不增加新的验证规则 ID**，而是在 Governance 基础上扩展业务流程（争议、签名、多结算），这些扩展的验证逻辑通过现有规则在不同业务上下文中应用

### 8.4 Compliance Level 声明

#### 声明格式

实现者 MUST 通过 `compliance` 对象声明其符合的 Compliance Level：

```json
{
  "compliance": {
    "levels": ["ctrs-core"],
    "extensions": []
  }
}
```

多 Level 声明示例：

```json
{
  "compliance": {
    "levels": ["ctrs-core", "ctrs-governance", "ctrs-enterprise"],
    "extensions": ["dispute-workflow", "digital-signature", "multi-settlement"]
  }
}
```

#### 声明规则

1. `levels` 数组 MUST 按顺序包含已实现的 Level（Core 始终在最前）
2. 实现了高 Level 隐含实现了所有低 Level：声明 `ctrs-governance` 时 MUST 同时声明 `ctrs-core`
3. `extensions` 数组列出 Enterprise 下已实现的具体扩展功能
4. 实现 MAY 仅声明 Core，不实现任何 Extension

#### 验证器行为

验证器 MUST 根据 Report 的声明 Compliance Level 决定验证范围：

| 声明 Level | 必须通过的验证规则 | 允许的状态 |
|-----------|----------------|-----------|
| `ctrs-core` | VR-101 至 VR-402 | draft, verified, eligible, settled |
| `ctrs-governance` | VR-101 至 VR-502 | draft, verified, eligible, settled |
| `ctrs-enterprise` | VR-101 至 VR-502 + 扩展验证 | draft, verified, eligible, settled, disputed |

验证器遇到超出声明 Level 的验证需求时 SHOULD 发出警告而非失败。例如，Core 验证器遇到 `disputed` 状态 SHOULD 发出警告但 MAY 继续处理。

#### Report 中的 Compliance Level 标注

Report MAY 在 `metadata` 中标注其目标 Compliance Level：

```json
{
  "metadata": {
    "compliance_level": "ctrs-governance"
  }
}
```

此标注仅供信息目的，验证器 MUST NOT 仅凭此标注就跳过更高 Level 的验证。验证范围由验证器自身的 Compliance Level 声明决定。

### 8.5 互操作矩阵

| 验证器 ↓ / Report → | Core Report | Governance Report | Enterprise Report |
|---------------------|-------------|-------------------|-------------------|
| **Core 验证器** | 完全通过 | 跳过 VR-501/502，其余通过 | 跳过 VR-501/502 + 扩展，核心通过 |
| **Governance 验证器** | 完全通过 | 完全通过 | 跳过扩展，核心 + 治理通过 |
| **Enterprise 验证器** | 完全通过 | 完全通过 | 完全通过 |

**说明**：高 Level 验证器 MUST 能正确处理低 Level Report。低 Level 验证器处理高 Level Report 时，仅验证其支持的规则，对超出范围的规则 SHOULD 发出警告。

### 8.6 与成熟协议的对比

| 协议 | 核心规范 | 扩展方式 | CTRS 借鉴点 |
|------|---------|---------|------------|
| **OAuth 2.0** | RFC 6749（Core） | 独立 RFC 定义各 Grant Type | "核心 + 多扩展"的发布模式 |
| **JWT/JWS/JWE** | RFC 7519/7515/7516 分层 | 各层独立实现 | 对象能力分层（Core 只做基础验证） |
| **OpenAPI** | 3.1 Core Spec | Format/Security/Webhooks 扩展 | Compliance Level 声明机制 |
| **FIDO2** | Core + WebAuthn | 扩展认证方式 | 渐进式采用路径 |

CTRS 的创新点在于：Compliance Level 同时绑定**验证规则集合**和**基础设施依赖**，使实现者可以清晰评估每个 Level 的部署成本和验证能力边界。

---

## 附录

### 附录 A: 完整 JSON Schema

参见同目录下的 `schema.json` 文件。

### 附录 B: 示例 Report

参见 `examples/` 目录下的示例文件。

### 附录 C: 验证算法伪代码

```
function validate_report(report, rule_registry, issuer_registry):
    issues = []
    
    // L1: Schema 完整性
    for field in MUST_FIELDS:
        if field not in report:
            issues.append("缺失必填字段: " + field)
    
    for evidence in report.evidence:
        for field in EVIDENCE_MUST_FIELDS:
            if field not in evidence:
                issues.append("Evidence 缺失必填字段: " + field)
        if evidence.type not in EVIDENCE_TYPE_ENUM:
            issues.append("Evidence type 非法: " + evidence.type)
    
    // L2: Hash 完整性
    for evidence in report.evidence:
        computed = sha256(json_sort_keys(evidence.data))
        if computed != evidence.hash:
            issues.append("Evidence Hash 不匹配: " + evidence.evidence_id)
    
    computed_rule_hash = sha256(json_sort_keys(report.rule.definition))
    if computed_rule_hash != report.rule.hash:
        issues.append("Rule Hash 不匹配")
    
    // L3: 引用一致性
    for evidence in report.evidence:
        if evidence.claim_ref != report.claim.claim_id:
            issues.append("Evidence claim_ref 不匹配")
    
    if report.attribution.claim_ref != report.claim.claim_id:
        issues.append("Attribution claim_ref 不匹配")
    
    if report.attribution.rule_hash != report.rule.hash:
        issues.append("Attribution rule_hash 不匹配")
    
    if report.settlement.attribution_ref != report.attribution.attribution_id:
        issues.append("Settlement attribution_ref 不匹配")
    
    // L3: 金额正确性
    total = sum(float(split.share_amount) for split in report.settlement.split)
    if abs(total - float(report.settlement.amount)) > 0.001:
        issues.append("分润金额加总不等于总金额")
    
    // L3: 注册表验证
    if rule_registry:
        rule_entry = rule_registry.find(report.rule.rule_id, report.rule.hash)
        if not rule_entry:
            issues.append("Rule 未在 Registry 中注册")
    
    if issuer_registry:
        issuer = issuer_registry.find(report.rule.issuer)
        if not issuer or issuer.trust_level not in ["trusted", "verified"]:
            issues.append("Issuer 未受信任: " + report.rule.issuer)
    
    return {valid: len(issues) == 0, issues: issues}
```

---

## 版本历史

| 版本 | 日期 | 变更摘要 |
|------|------|---------|
| v1.0 | 2026-06 | 初始版本：五层结构、基础验证 |
| v1.1 | 2026-06 | Rule 升级为一等对象，Attribution 绑定 rule_hash |
| v1.2 | 2026-07 | 新增 eligible 状态，confidence 浮点化，Social Authority 层，Compliance Levels（Core/Governance/Enterprise） |
