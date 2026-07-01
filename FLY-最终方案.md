# Fly 最终方案 v2

## 一、Fly 为什么存在（协议逻辑，已冻结）

### 完整因果链

```
Agent 经济 → 商业行为跨平台 → 没有任何参与方拥有完整事实 → 商业归因失效 → 需要独立的商业信任协议 → Fly
```

### 互联网时代
```
用户 → 平台 → 商家
```
平台就是裁判。淘宝知道谁带来的，Google 知道谁点的，Amazon 知道谁推荐的。平台自己就是数据库，所以它可以分钱。

### Agent 时代
```
用户 → 自己的 Agent → OpenAI → Claude → 搜索 Agent → 购物 Agent → 支付 Agent → 商家
```
平台还在，但没有任何一个平台拥有完整事实。
**谁还能证明是谁创造了价值？**

### 旧方法为什么失效
互联网归因依赖 Cookie、Referral、UTM、Last Click、平台日志——因为平台拥有整个过程。
Agent 时代，链路被拆开：OpenAI / Claude / MCP / Stripe / Shopify，每个人只知道自己这一段，没有任何一个人知道完整链路。

**商业归因断了。不是技术断了，是商业信任断了。**

### Fly 解决什么
Fly 不解决 AI，不解决 Agent。
Fly 解决的是：
> **没有任何参与方拥有完整事实的时候，谁来形成一份所有人都接受的商业事实。**

### Agent 为什么让 Fly 成立
Agent 全部都是程序。程序天然留下行为：
- Agent A 推荐商品 → Evidence
- Agent B 介绍客户 → Evidence
- Payment Agent 完成支付 → Evidence

Agent 越多，Evidence 越多。
> **Agent 时代第一次让商业行为天然可以留下标准化证据，所以 Fly 才能建立商业信任。**

### 一句话定位
> **互联网时代，平台负责归因；Agent 时代，商业行为跨平台发生，没有任何参与方拥有完整事实，因此市场第一次需要一个独立的商业信任协议来形成可结算的商业归因。Fly 不是因为 AI 而诞生，而是因为 Agent 经济让"谁创造了价值"变成了一个无法由任何单一参与方证明的问题。**

---

## 二、定位（已冻结）

**Fly · 商业信任协议 · AI归因验证**

Fly 不是 AI 产品。Fly 是商业价值归因验证基础设施。
AI 只是当前创造价值的主体之一，未来还有 Agent、Workflow、Automation、MCP。
Fly 证明的是商业价值，不是 AI。

---

## 三、首页叙事（已冻结）

四句话，四个职责：

```
新的商业价值正在涌现                              ← Why Now（时代变化）
但没有人能完整证明这份价值属于谁                    ← Problem（市场问题）
Fly 让每一次商业行为有迹可循、有据可证、有账可算      ← Capability（Fly 做什么）
让商业价值，可归因、可信任、可结算                   ← Outcome（用户得到什么）
```

颜色规则：灰 = 连接/辅助，黑 = 核心强调
- 第2行：但没有人能(灰) / 完整证明(黑) / 这份价值属于谁(灰)

---

## 四、核心洞察：Report 就是产品

### 产品重心转移

```
旧：Fly → 网站 → 协议 → Report
新：Fly → Commercial Trust Report（产品）
          → 网站只是展示入口
          → 协议只是底层实现
```

任何人、任何系统接触 Fly，最终拿到的都是一份 Report：
- 接 API → 拿到 Report
- 点 Verify → 看到 Report
- 商家结算 → 依据 Report

**Report 是真正的产品。**

### 升级：从 Report 到 Specification

当开始参考 W3C VC、SCITT、DID、MCP 后，Fly 已经不只是"一份 Report"，而是在定义**一种 Report 标准**。

> **Commercial Trust Report Specification (CTRS)**

以后任何平台、任何 Agent、任何 SaaS，都可以生成符合 CTRS 的 Report。
Fly 才真正像一个协议，而不是一个产品。

### 三层命名原则

同一个东西，三个层次，各层各管各的：

| 层次 | 名字 | 给谁用 | 作用 |
|------|------|--------|------|
| 市场层 | **Fly Report** | 客户 | 别人买、别人认 |
| 标准层 | **CTRS** | 开发者 | 开发者遵循 |
| 实现层 | **Evidence → Verification → Attribution** | 协议内部 | 系统运行 |

- 客户记住 Fly Report
- 开发者实现 CTRS
- 协议内部运行 Evidence → Verification → Attribution

这不是三条产品线。对外永远只有一条主线：Fly Report。

---

### Report 就是信任

Report 不是"解释为什么可信"，Report 本身就是信任。

就像今天大家相信 Git Commit、银行流水、发票、Stripe Receipt——不是因为官网写了《为什么可信》，而是文档本身包含了足够信息让别人能够验证。

Fly Report 天然回答：
```
这是谁产生的？
有什么证据？
证据来自哪里？
为什么归因给它？
依据哪条规则？
为什么可以结算？
如何再次验证？
```

---

## 五、Agent 时代落地

Fly 服务于 Agent Economy，但首先被开发者、平台和商家集成。

今天真正接 Fly 的是开发者、平台、商家。Agent 是未来的调用者。
所以产品为 Agent Economy 设计，但 GTM 从开发者/平台/商家切入。

| | 互联网时代 | Agent 时代 |
|---|---|---|
| 信任方式 | 人签合同 → 人看报告 → 人决定付款 | Agent 产生行为 → 机器记录证据 → 机器验证归因 → 自动结算 |
| 结算特征 | 低频、大额、月结 | 高频、小额、碎片化 |
| Report 要求 | 人看得懂就行 | 机器可读 + 自动可验证 + 跨平台通用 |

### Fly 在标准中的位置

```
Google Attribution \
W3C VC           ----\
SCITT              --------> Fly CTRS
Agent Audit Trail  ----/
Stripe Settlement /
```

Fly 不是任何一个标准。Fly 是商业归因 + 可验证凭证 + 审计链 + 商业结算组合出来的新协议。
标准只是引用，Schema 围绕 Fly 自己设计。

---

## 六、Schema Principles（五条原则，高于 JSON）

任何 Report、任何字段、任何功能，都必须遵守这五条原则：

### 1. Report is Verifiable
所有报告必须可验证。任何人拿到 Report，都能独立验证其真实性。

### 2. Evidence is Immutable
所有证据不可篡改。一旦记录，任何修改都会破坏完整性指纹。

### 3. Rules are Transparent
归因规则必须引用。归因不是 Fly 自己算的，是引用了一套公开规则。

### 4. Settlement is Reproducible
任何人用相同证据和相同规则，重新计算得到相同结算结论。

### 5. Trust Records are Versioned
任何更新形成新版本。历史记录不可删除，只能追加。

---

## 七、Commercial Trust Report Specification（CTRS）v2

### 核心公式

```
Claim + Evidence + Rule = Attribution → Settlement → Trust Record
```

### 数据流

```
Claim → Evidence → Verification → Attribution → Settlement → Trust Record
                                ↑ 验证证据    ↑ 引用 Rules
```

- **Claim**：Fly 要证明什么（声明）
- **Evidence**：支撑 Claim 的证据
- **Verification**：验证证据真实性（必须在归因之前）
- **Attribution**：引用 Rules 对已验证证据进行归因（Evidence + Rule = Attribution）
- **Settlement**：生成结算建议
- **Trust Record**：最终沉淀，可长期引用、追加、版本化、重新验证

### Schema 结构（7 层）

```
Commercial Trust Report (CTRS)
├── report          # Layer 1: 报告元信息
├── claims          # Layer 2: 声明（Fly 要证明什么）
├── evidence        # Layer 3: 证据（支撑声明的数据）
├── verification    # Layer 4: 验证（证据真实性校验）
├── attribution     # Layer 5: 归因（Evidence + Rule = Attribution）
├── settlement      # Layer 6: 结算（可结算方和金额）
└── trust_record    # Layer 7: 信任记录（最终产物）
```

### 详细字段

#### Layer 1: Report（报告元信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| report_id | string | 唯一标识 |
| schema_version | string | CTRS 版本号 |
| type | string | 固定 "CommercialTrustReport" |
| created_at | timestamp | 生成时间 |
| status | enum | draft / verified / attested / settlement_ready |
| issuer | object | 签发方（参考 W3C VC issuer） |

#### Layer 2: Claims（声明）

| 字段 | 类型 | 说明 |
|------|------|------|
| claim_id | string | 声明唯一标识 |
| type | string | 声明类型（attribution / contribution / conversion） |
| subject | object | 声明主体（谁做了什么） |
| description | string | 声明内容描述 |
| timestamp | timestamp | 声明时间 |
| parties | array | 参与方列表 |

> 先有 Claim，后有 Evidence。Claim 定义 Fly 要证明什么。

#### Layer 3: Evidence（证据）

| 字段 | 类型 | 说明 |
|------|------|------|
| evidence_id | string | 证据唯一标识 |
| claim_ref | string | 关联的 Claim ID |
| type | enum | webhook / conversation / mcp / payment / crm / stripe / custom |
| source | string | 证据来源（平台/Agent/系统） |
| timestamp | timestamp | 证据时间 |
| data | object | 原始证据数据 |
| hash | string | 证据指纹（防篡改） |

#### Layer 4: Verification（验证）

| 字段 | 类型 | 说明 |
|------|------|------|
| verification_id | string | 验证唯一标识 |
| method | string | 验证方法 |
| checks | array | 验证项（signature / hash / issuer / timestamp / integrity） |
| result | enum | passed / failed / partial |
| verified_evidence | array[evidence_id] | 通过验证的证据 |
| rejected_evidence | array[evidence_id] | 未通过的证据 |
| reasoning | string | 验证逻辑说明 |
| verified_at | timestamp | 验证时间 |

> Verification 必须在 Attribution 之前。没有验证的证据不能用于归因。

#### Layer 5: Attribution（归因）

| 字段 | 类型 | 说明 |
|------|------|------|
| attribution_id | string | 归因唯一标识 |
| claim_ref | string | 关联的 Claim ID |
| rules_ref | array[rule_id] | 引用的规则 ID 列表 |
| method | string | 归因方法描述 |
| confidence | float | 置信度 0-1 |
| result | object | 归因结果（谁贡献了多少） |
| reasoning | string | 归因逻辑链 |
| attributed_at | timestamp | 归因时间 |

> **Attribution 只能引用 rule_hash，不允许引用 rule text。** 归因结果必须可追溯到具体规则指纹和具体证据。

#### Rules（归因规则，v1.1 升级为 First-Class Object）

| 字段 | 类型 | 说明 |
|------|------|------|
| rule_id | string | 规则唯一标识 |
| issuer | string | 规则发布者标识（DID / agent_id / org_id） |
| version | string | 规则版本（semver） |
| hash | string | 规则指纹 SHA-256(definition) |
| definition | object | 规则定义（名称、方法、参数等） |
| created_at | timestamp | 创建时间 |

> **v1.1 核心变更：Rule 从字符串升级为 First-Class Object。**
> Rule 不再是 generator 传入的临时字符串，而是带身份（issuer）、版本（version）、指纹（hash）的可追溯对象。
> 验证时：`hash(rule.definition) == rule.hash` 必须成立。
> 这解决的是"规则不可伪造"，不是"谁有权定义规则"——后者属于治理层，不在 v1.1 范围。

#### Layer 6: Settlement（结算）

| 字段 | 类型 | 说明 |
|------|------|------|
| settlement_id | string | 结算唯一标识 |
| attribution_ref | string | 关联的 Attribution ID |
| status | enum | eligible / pending / settled / disputed |
| amount | object | 结算金额/比例 |
| currency | string | 币种 |
| split | object | 分配方案（谁拿多少） |
| eligible_parties | array | 可结算方 |

#### Layer 7: Trust Record（信任记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| record_id | string | 记录唯一标识 |
| report_ref | string | 关联 Report ID |
| content_hash | string | 内容完整性指纹 |
| receipt | object | 收据信息 |
| merkle_root | string | Merkle Tree 根哈希 |
| audit_trail | array | 审计链（参考 IETF AAT hash-chained records） |
| created_at | timestamp | 记录时间 |
| version | integer | 版本号 |
| status | enum | active / superseded / archived |
| verification_url | string | 在线验证地址 |

> Trust Record 是最终产物。可长期引用、不断追加、版本化、重新验证。

---

## 八、Fly 最终证明什么

Fly 最终不是证明 AI 存在、AI 生成、AI 推荐。

Fly 最终证明的是：
```
商业价值 → 商业事实 → 商业归因 → 商业结算
```

Fly 最后的输出不是 "Verified"，而是：
> **This commercial attribution is settlement ready.**

客户买的不是验证。客户买的是：**这份商业价值，我敢拿去结算。**

---

## 九、CTRS 版本演进与协议边界

### 版本定性

| 版本 | 目标 | 状态 |
|------|------|------|
| **v1.0** | 能跑（Execution Complete）| ✅ 已完成 |
| **v1.1** | 不可篡改（Trust Complete）| ✅ 已完成 |
| **v1.2+** | 可治理（Ecosystem Complete）| ⏳ 待定 |

### 三层协议结构

```
Layer 1: Execution Truth    → 证据是否真实（v1.0 已解决）
Layer 2: Structural Identity → Rule 是什么 / 从哪来（v1.1 补全）
Layer 3: Social Authority    → 谁被信任（v1.2+ / 生态层）
```

### v1.0 已完成的协议成立条件

1. **Generate** — Claim + Evidence + Rule → Report ✅
2. **Hash** — SHA-256 证据指纹，不可篡改 ✅
3. **Version** — Report 可演化，历史可追溯 ✅
4. **Store** — 持久化存储，第三方可访问 ✅
5. **Verify** — 独立验证，结果一致 ✅

### v1.1 新增（Rule 身份层）

1. **Rule Schema 升级（Identity Layer）**
   Rule 从字符串升级为带 `rule_id + issuer + version + hash + definition` 的结构体

2. **Attribution 绑定 rule_hash（Referential Integrity Layer）**
   Attribution 只能引用 rule_hash，不允许引用 rule text

3. **Verify 增加 rule integrity（Cryptographic Consistency Layer）**
   `hash(rule.definition) == rule.hash` 必须成立

### v1.1 不做的（明确排除）

- Rule registry governance
- Issuer reputation / whitelist
- 联盟治理结构
- "谁有权发布 Rule"的定义

> **核心判断：Identity 可以标准化，Authority 不能在早期协议里标准化。**
> v1.1 只做"Rule 的身份可追溯性"，不做"Rule 的权威性定义"。

### 暂不做
- Logo / 动画 / UI 微调
- 再改首页文案
- 继续推导定位
- API 重命名（等产品定型后再优化）

---

## 十、永久约束

1. **定位冻结**：首页文案不再调整
2. **不再推导定位**：定位问题已回答，进入产品阶段
3. **一切围绕 CTRS**：每个决策都检验——它是否让 Report 更成立？
4. **Agent 时代优先**：设计从 Agent 经济出发，GTM 从开发者/商家切入
5. **Schema 驱动**：先 Schema，再链路，再 UI，不反过来
6. **Report = 信任**：不单独写"为什么可信"，Report 本身就是答案
7. **五条原则不可违反**：Verifiable / Immutable / Transparent / Reproducible / Versioned

---

## 十一、终局目标

未来别人记住 Fly，不是因为首页。
而是因为一句话：

> **"把 Fly Report 发给我。"**

就像今天大家会说：发合同、发发票、发 Git Commit、发 Stripe Receipt。

Fly Report 成为 Agent Economy 中跨平台共同认可的商业事实载体。
这就是 Fly 的终局。
