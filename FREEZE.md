# Fly 冻结区定义

## 统一定义
Fly = AI时代的收入归因验证基础设施

禁止使用：
- Signal Infrastructure
- Trusted Signal Chain
- Verified State Transition
- Agent Signal OS

## 冻结文件（绝不修改）
| 文件 | MD5 | 冻结时间 |
|---|---|---|
| index.html | 8922e18cc1510f53518f32ae32f6a62e | 2026-06-10 |
| concept-behavior-id.html | e4ae4cea70f107f6692c721c5faf2024 | 2026-06-10 |
| concept-action-id.html | 431cd3d2159d14bc13e9f8f186635214 | 2026-06-10 |
| concept-verification.html | ad6c2cf9eea6bc2ab5bc7c62a45454e0 | 2026-06-10 |
| concept-trust.html | 4069259f83f958ba9cf682a5e6410856 | 2026-06-10 |
| concept-business-value.html | fa44c0a4502ef61d33d0f3c23155a118 | 2026-06-10 |

## 冻结内容
- 首页文案和布局
- SVG链路图（6节点+中文说明）
- 5个核心概念产品页
- Fly概念定义

## 执行优先级
P0 冻结（已完成）
P1 nav-shared.js 导航骨架
P2 验证体系6页 → Gate 1-6业务语言
P3 企业层（Revenue Attribution + ROI Measurement）
P4 AI Native（改名+内容）
P5 Web3（改名，不急着扩）
P6 开发者（SDK/Webhook/Schema/OpenAPI）
P7 合规（Audit Trail + Data Governance）
P8 渠道生态（子分组）

---

## 修订记录 2026-07-20（对齐修订，用户已授权）

### 1. 统一定义更新（supersedes 上文「统一定义」）
Fly = **自动化经济时代的商业价值确认协议**（2026-07-18 冻结定义）

> 它不创造交易，不执行服务，而是在真实商业事件发生后，通过
> Claim → Evidence → Attribution → Trust Record，
> 确认不同自动化参与者创造了多少商业价值。

冻结边界：
- Fly ≠ GEO 公司
- Fly ≠ AI 客服公司
- Fly ≠ 支付协议（Settlement Ready ≠ Settlement Executed）

归因原则 #1（冻结）：Fly 不证明收入的单一来源；Fly 证明每个参与者在一次商业事件中可验证的贡献。

### 2. 术语修订
- **Attestation → Attribution**：归因是唯一概念，Attestation 已废弃。全站（导航 / 概念页 / FAQ / llms.txt / 服务条款）已统一。
- 四层链路冻结为：**Claim → Evidence → Attribution → Trust Record**。
- concept-verification.html 页面语义由「证明层」改为「归因层」（Attribution 归因引擎）。

### 3. 重新冻结（2026-07-20，取代 2026-06-10 冻结表）
2026-06-10 之后站点持续演进但冻结表未更新，原 MD5 全部失效。现按修订后内容重新冻结：

| 文件 | MD5 | 冻结时间 |
|---|---|---|
| index.html | 8945a01d2c18e8167097d2b3a96fa226 | 2026-07-20 |
| concept-behavior-id.html | 9c5bd6ec03f382986eb0385ecf9ba57e | 2026-07-20 |
| concept-action-id.html | 265322369815e49013a2a30a5817ca2a | 2026-07-20 |
| concept-verification.html | 654f3454cf7b26d489708e0f0728692e | 2026-07-20 |
| concept-trust.html | 39a706ff4ea75dff831ac1d55bc7f912 | 2026-07-20 |
| concept-business-value.html | 27f452d533f4cbe0223871316f3e70ef | 2026-07-20 |

### 4. 安全修订
- verify.html 移除硬编码 API key（该 key 属于线上 API_KEYS，属泄露凭证，已列入轮换清单）。/v1/verify 与 /v1/records/recent 当前为无鉴权端点，页面不再携带 Authorization 头。
- worker/wrangler.toml（含 .bak / noKV 变体）中的 IP_SALT / API_KEYS 明文已清洗为占位符，真实值须通过 `wrangler secret put` 注入并轮换。
