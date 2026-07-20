# 对齐修订记录 · 2026-07-20

本次提交是一次**全仓一致性对齐**：GitHub 仓库、线上部署、协议、代码、数据库、文档六个维度统一对齐到 2026-07-18 冻结定义。用户已授权执行（勘察报告 + AGENT 思维对齐方案，7 个决策点全部确认）。

## 1. 冻结定义对齐

全站统一定义（取代所有旧定位表述）：

> Fly 是自动化经济时代的商业价值确认协议。它不创造交易，不执行服务，而是在真实商业事件发生后，通过 Claim → Evidence → Attribution → Trust Record，确认不同自动化参与者创造了多少商业价值。

三条冻结边界：
- Fly ≠ GEO 公司
- Fly ≠ AI 客服公司
- Fly ≠ 支付协议（Settlement Ready ≠ Settlement Executed）

废弃的旧表述：
- "AI时代的收入归因验证基础设施"（FREEZE.md 旧定义，已 supersede）
- "商业信任协议 / Commercial Trust Protocol"（全站清除）
- 旧 5 层能力模型（Identity / Proof / Verification / Trust Ledger / Attribution Settlement）
- Signal Infrastructure / Trusted Signal Chain / Verified State Transition / Agent Signal OS（FREEZE.md 原禁用项，维持禁用）

## 2. 术语统一：Attestation → Attribution

归因是**唯一概念**，Attestation 已废弃。涉及文件：

| 文件 | 修订 |
|---|---|
| nav-shared.js | 导航「Attestation 证明层」→「Attribution 归因层」 |
| concept-verification.html | 全页 8 处 Attestation→Attribution；页面语义从「证明层」改为「归因层」；定义、公理、STEP 3、meta description 重写 |
| concept-action-id.html | 2 处 Attestation→Attribution |
| concept-trust.html | 3 处「Attestation 证明」→「Attribution 结果」 |
| concept-business-value.html | 链路表述统一为 Claim→Evidence→Attribution→Trust Record |
| terms.html | 链路统一 + 协议名更新 |
| agent-registry.html | 「为后续的 Attestation 提供身份验证依据」→「为后续的 Attribution 提供身份锚定依据」 |
| index.html | FAQ「什么是Attribution Settlement」→「什么是Attribution」，答案重写为归因层定义 |
| faq.html | JSON-LD 与可见文案 Layer 3 统一为 Attribution（归因） |

## 3. 协议表述对齐

- 协议：CTRS v1.2（schema 锁定）
- 归因规则：v1.3 pair-wise（method=pairwise_temporal_causal，以 CTRS Rule 对象表达，**非 schema 分叉**）
- compliance.html：`Fly Commercial Trust Protocol v1.0` → `Fly CTRS v1.2`
- worker/src/index.ts 文件头注释：五层模型 + CTRS v1.2 + v1.3 pair-wise Rule + 三条边界
- worker /v1/health：layers 5, protocols 1, protocol CTRS-v1.2

## 4. API 文档真实性对齐（以瞎猜接口为耻，以认真查询为荣）

faq.html「如何接入Fly」此前列出不存在/未实现的接口，已全部替换为 worker 实际路由：

| 实际路由 | 说明 | 鉴权 |
|---|---|---|
| POST /v1/verify | 签发归因报告（CTRS v1.2 分支 + 旧格式分支） | 当前无鉴权（见 §7 风险） |
| POST /v1/replay | 确定性重放验证 | — |
| GET /v1/records/recent | 查询最近归因记录 | 无鉴权 |
| GET /v1/health | 健康检查 | 无 |

已删除的虚构内容：/claim、/evidence、/verify 三端点说法、MCP 接入、SDK 下载、指向不存在页面的链接（api-reference.html / dev-sdk.html / dev-openapi.html / ctrs-spec.html）。

## 5. verify.html 修复（此前功能必然失败）

根因（三处）：
1. **从未发送 `agent_id`** — worker /v1/verify 要求 `body.agent_id`，否则 400。页面必败。
2. **发送死键 `attestation:{...}`** — worker 无任何 'attestation' 引用，该字段被丢弃；且内含个人姓名 PII。
3. **携带无效 Authorization 头** — /v1/verify 与 /v1/records/recent 均为无鉴权路由。

修复：
- payload 增加 `agent_id: 'web_verify_user'`、`evidence` 字符串数组（匹配 worker 旧格式分支）、`channel`/`signal_type`/`metadata.source`；删除 `attestation` 死键与 PII。
- 移除两个请求的 Authorization 头。
- **安全：移除硬编码 API key**（见 §7）。

## 6. 导航与索引一致性

- robots.txt：删除 6 处指向不存在页面的 Allow（ctrs-spec.html ×3、api-reference.html、dev-schema.html、dev-sdk.html、dev-openapi.html）；保留 ctrs-v1.2-schema.json（文件存在）。
- llms.txt：全文重写——冻结定义、四层链路、三条边界、真实 API 列表、FAQ。
- README.md：定位行更新为商业价值确认协议。
- index.html JSON-LD Organization description、FAQ 答案、logo-sub 更新。
- privacy.html / terms.html / compliance.html / FLY-最终方案.md：协议名统一。
- FREEZE.md：2026-07-20 修订——定义 supersede、术语修订、6 文件重新冻结（新 MD5）、安全修订记录。

## 7. 安全修订（凭证卫生）

| 问题 | 处置 | 后续动作（用户侧） |
|---|---|---|
| verify.html 硬编码 `fly_` 前缀 API key，且该 key 属于线上 API_KEYS（公开页面携带活凭证） | 已从页面移除（正则清洗，值未入本记录） | **轮换该 key** |
| worker/wrangler.toml（含 .bak / noKV 变体）IP_SALT / API_KEYS 明文 | 已清洗为 `REPLACE_VIA_WRANGLER_SECRET` 占位符 | `wrangler secret put` 注入并轮换 |
| /v1/verify 无鉴权接受写入 | 本次未改 worker 行为（属行为变更，需单独决策） | 建议评估加 verifyBearerToken |

## 8. 部署与仓库结构

- worker v2.17.0 代码（index.ts 3938 行 + package.json）并入本仓 worker/ 目录——此前 worker 代码仅存在于部署快照与孤儿分支，主仓缺失。孤儿分支 worker-v2.17 @1c400ded 已保留于远端（抢救完成）。
- docs/database-topology.md：数据库拓扑文档（本次新增）。
- docs/backup-restore-runbook.md：备份命令更新为 `wrangler d1 export`（原 codeact 路径已不存在）。
- ctrs-conformance-tests/README.md：registry 路径引用更新为 `../fly-registry/`（私有部署目录，不入本仓）。

## 9. 本次明确未做（边界纪律）

- 未改 worker 运行时行为（仅注释与 health 元数据）。
- 未删任何文件（含 people1913-fly-agent.xyz-c330069/ 嵌套快照——≠main，标记保留）。
- 未动 D1 / KV 数据。
- 未新增协议、层、概念页（Genesis 判据优先，30 天只做两件事）。

---
执行：Fly_Claude Code · 授权：用户（2026-07-20 勘察报告 7 决策点确认）
