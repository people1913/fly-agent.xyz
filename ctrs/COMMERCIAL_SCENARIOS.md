# Fly/CTRS 商业场景验证

> 证明 Agent Economy 为什么需要 Fly：5 个端到端真实商业场景，用 CTRS v1.2 逐环节验证。

---

## 为什么要做场景验证

CTRS v1.2 规范已完成，但规范完成 ≠ 问题被解决。评审指出：**缺少"第一个真实场景"**。

这份文档的目标不是解释 CTRS 的字段定义（那是 specification.md 的工作），而是回答一个更根本的问题：

**在真实的 Agent Economy 商业场景中，Fly 的信任链路能否走通？**

```
商业行为 → 证据 → 商业事实 → 归因 → 结算
```

每个场景我们问三个问题：
1. **没有 Fly，这个场景的痛点是什么？** — 证明需求真实存在
2. **CTRS v1.2 能否完整支撑？** — 证明规范可用
3. **如果不能，最小扩展是什么？** — 证明路线图清晰

---

## 场景 1：AI 导购分佣

### 场景描述

用户通过 AI 导购 Agent 浏览商品，导购 Agent 推荐了一款降噪耳机。用户犹豫时，一个专业评测 Agent 提供了深度对比分析。最终，用户的支付 Agent 完成了下单。

这是 ** affiliate marketing 的 Agent Economy 版本**，但与传统 affiliate 不同：推荐、说服、支付由三个不同方的 Agent 完成，没有任何单一平台能看到完整链路。

### 参与者

| Agent | 角色 | 所属方 |
|-------|------|--------|
| ShopGuide-AI | 导购推荐 | 导购平台 A（如 Perplexity Shopping） |
| ReviewBot-Pro | 专业评测 | 内容平台 B（如 Wirecutter AI） |
| PayAgent-X | 支付执行 | 支付服务 C（如 Stripe Agent） |

### 痛点：为什么没有 Fly 就无法解决

| 问题 | 现状 | 后果 |
|------|------|------|
| **归因黑箱** | 电商平台只看 last-click，支付 Agent 拿走全部佣金 | 导购和评测 Agent 的贡献被完全忽略 |
| **证据缺失** | 导购对话在平台 A，评测在平台 B，支付在平台 C——三方互不信任 | 无法形成共同认可的商业事实 |
| **分佣纠纷** | 导购平台声称"是我引流的"，评测平台声称"是我促转化的" | 没有可验证的依据，只能靠谈判，成本高且不透明 |
| **作假空间** | 导购 Agent 可以虚报推荐次数，支付 Agent 可以隐瞒来源 | 没有防篡改机制，商业信任无法建立 |

### 商业行为链路

```
1. ShopGuide-AI 推荐降噪耳机 → 生成对话记录 (Evidence: conversation)
2. ReviewBot-Pro 提供对比评测 → 生成评测交互记录 (Evidence: conversation)
3. 用户点击推荐链接 → 生成点击事件 (Evidence: webhook)
4. PayAgent-X 完成支付 → 生成支付凭证 (Evidence: payment)
5. 电商平台确认订单 → 生成订单确认 (Evidence: webhook)
```

### 归因问题

- **价值由谁创造？** 导购创造"需求"，评测创造"信任"，支付提供"便利"
- **如何分配？** 按 Fly 注册规则计算：导购 50%、评测 30%、支付 20%
- **争议点**：评测 Agent 可能认为自己的深度分析才是关键转化因素，应占更高比例

### 金额示例

| 项目 | 金额 |
|------|------|
| 商品售价 | ¥1,299 |
| 平台佣金（10%） | ¥129.90 |
| 导购 Agent 分佣 | ¥64.95（50%） |
| 评测 Agent 分佣 | ¥38.97（30%） |
| 支付 Agent 分佣 | ¥25.98（20%） |

### CTRS v1.2 映射

| CTRS 对象 | 场景映射 | 状态 |
|-----------|---------|------|
| Claim | 多 Agent 协作促成降噪耳机购买 | ✅ 直接映射 |
| Evidence[0] | 导购对话记录 (type: `conversation`) | ✅ 直接映射 |
| Evidence[1] | 评测交互记录 (type: `conversation`) | ✅ 直接映射 |
| Evidence[2] | 推荐链接点击 (type: `webhook`) | ✅ 直接映射 |
| Evidence[3] | 支付凭证 (type: `payment`) | ✅ 直接映射 |
| Evidence[4] | 订单确认 (type: `webhook`) | ✅ 直接映射 |
| Rule | 三方协作分佣规则（导购50%/评测30%/支付20%） | ✅ 直接映射 |
| Attribution | 基于规则计算各方贡献 | ✅ 直接映射 |
| Settlement | ¥129.90 按比例分佣 | ✅ 直接映射 |

### 规范验证结论

**CTRS v1.2 可以完整支撑此场景。**

5 条 Evidence 覆盖完整行为链路，Rule 定义了分佣规则，Attribution 计算贡献，Settlement 生成分润方案。所有验证规则（VR-101 至 VR-402）均可通过。

⚠️ **边缘情况**：如果推荐到购买跨越了 7 天（用户浏览后犹豫，一周后才通过支付 Agent 购买），当前规范没有"归因窗口"（attribution window）的标准化表达。可通过 Rule definition 的 `parameters` 扩展字段实现，但不属于规范强制要求。

---

## 场景 2：内容-销售归因

### 场景描述

内容营销 Agent 为一家 SaaS 公司生成了一系列技术博客文章和社交媒体帖子，这些内容吸引了潜在客户。2 周后，销售 Agent 通过 CRM 跟进这些线索，最终促成了一笔年付订阅。

这是 **B2B 内容营销归因** 的 Agent Economy 版本。传统上，内容团队和销售团队的贡献分配就是一个争议话题；当双方都是 Agent 时，问题更加尖锐——因为没有任何人类经理来做仲裁。

### 参与者

| Agent | 角色 | 所属方 |
|-------|------|--------|
| ContentForge-AI | 内容生成与发布 | 内容营销平台 A |
| SalesBot-CRM | 线索跟进与成交 | 销售自动化平台 B |
| AnalyticsAgent | 数据追踪 | 归因分析平台 C |

### 痛点：为什么没有 Fly 就无法解决

| 问题 | 现状 | 后果 |
|------|------|------|
| **时间跨度归因** | 内容发布到成交间隔 2 周，传统 last-touch 归因把全部功劳给销售 | 内容 Agent 的长期贡献被系统性地抹杀 |
| **跨系统证据断裂** | 内容数据在平台 A，CRM 数据在平台 B，没有共享的事实基础 | 两方各自拿对自己有利的数据，无法达成共识 |
| **贡献量化困难** | "一篇技术博客到底值多少钱？"——没有量化方法 | 内容 Agent 按固定价格收费，无法参与价值分成 |
| **延迟转化无追溯** | 用户读到文章→进入孵化→2 周后成交，中间链路断裂 | 无法证明内容与最终成交的因果关系 |

### 商业行为链路

```
1. ContentForge-AI 生成技术博客 → 生成发布记录 (Evidence: webhook)
2. 用户阅读博客 → 生成阅读事件 (Evidence: webhook)
3. 用户填写试用表单 → 生成线索记录 (Evidence: crm)
4. SalesBot-CRM 跟进线索 → 生成跟进记录 (Evidence: crm)
5. SalesBot-CRM 促成成交 → 生成合同签署记录 (Evidence: payment)
6. AnalyticsAgent 追踪全链路 → 生成归因报告 (Evidence: custom)
```

### 归因问题

- **价值由谁创造？** 内容 Agent 创造"需求源头"，销售 Agent 完成"转化闭环"
- **如何分配？** 基于 Fly 规则：内容 Agent 40%（首次触达价值）、销售 Agent 60%（转化完成价值）
- **争议点**：内容 Agent 可能主张 first-touch 归因应占更高比例；销售 Agent 可能主张 last-touch 应占全部

### 金额示例

| 项目 | 金额 |
|------|------|
| SaaS 年付订阅 | ¥48,000 |
| 合作佣金池（15%） | ¥7,200 |
| 内容 Agent 分成 | ¥2,880（40%） |
| 销售 Agent 分成 | ¥4,320（60%） |

### CTRS v1.2 映射

| CTRS 对象 | 场景映射 | 状态 |
|-----------|---------|------|
| Claim | 内容 Agent 引流 + 销售 Agent 促成 SaaS 订阅 | ✅ 直接映射 |
| Evidence[0] | 博客发布记录 (type: `webhook`) | ✅ 直接映射 |
| Evidence[1] | 阅读事件 (type: `webhook`) | ✅ 直接映射 |
| Evidence[2] | 试用表单提交 (type: `crm`) | ✅ 直接映射 |
| Evidence[3] | 销售跟进记录 (type: `crm`) | ✅ 直接映射 |
| Evidence[4] | 合同签署 (type: `payment`) | ✅ 直接映射 |
| Evidence[5] | 全链路归因数据 (type: `custom`) | ✅ 直接映射 |
| Rule | 时间衰减归因规则（首次触达40%/末次触达60%） | ✅ 直接映射 |
| Attribution | 基于时间衰减规则计算各方贡献 | ✅ 直接映射 |
| Settlement | ¥7,200 按比例分配 | ✅ 直接映射 |

### 规范验证结论

**CTRS v1.2 可以支撑此场景的核心链路，但有两个需要关注的边缘情况。**

1. **时间跨度证据**：从内容发布到成交跨越 2 周，6 条 Evidence 的时间戳跨度较大。CTRS 规范不限制 Evidence 的时间范围，但这意味着验证方需要自行判断证据时效性。**建议**：在 Rule definition 的 `parameters` 中增加 `attribution_window` 字段，标准化归因窗口。

2. **跨系统证据信任**：Evidence 来自三个不同平台，每个平台签发的 Evidence 可信度不同。当前规范的 `source` 字段只记录来源标识，不表达信任等级。CTRS Governance Extension 的 VR-502（Issuer 信任验证）可以部分解决，但仅限于 Report issuer 层级，不区分单条 Evidence 的来源信任。**建议**：v1.3 可考虑为 Evidence 增加可选的 `issuer` 字段，支持逐条证据的来源信任验证。

---

## 场景 3：API 联盟链式分润

### 场景描述

企业客户通过一个 AI 助手 Agent 查询市场分析报告。助手 Agent 调用了数据分析 Agent 的 API 获取实时数据，数据分析 Agent 又调用了数据源 Agent 的 API 获取原始行情。最终客户为这份分析报告付费 ¥5,000。

这是 **API 经济的 Agent 化版本**。传统 API 计费是点对点的：A 调 B，B 收 A 的钱。但在 Agent Economy 中，调用链是动态的、链式的，且最终付费方是链路末端的使用者。如果没有链式分润机制，中间层的 Agent 无法获得合理报酬。

### 参与者

| Agent | 角色 | 所属方 |
|-------|------|--------|
| AssistAI | 前端交互 | 助手平台 A（面向企业客户） |
| DataAnalyst-Bot | 数据分析 | 分析平台 B |
| MarketFeed-Agent | 数据源 | 数据供应商 C |

### 痛点：为什么没有 Fly 就无法解决

| 问题 | 现状 | 后果 |
|------|------|------|
| **链式调用不可见** | 客户只看到 AssistAI，不知道底层调用了谁 | 分析 Agent 和数据源 Agent 的贡献被完全隐藏 |
| **级联计费断裂** | A→B→C 链式调用，但只有 A 收到客户付款 | B 和 C 没有可信的方式从 A 的收入中分得合理份额 |
| **调用深度不确定** | 有时 A→B，有时 A→B→C→D，调用链动态变化 | 固定分润比例无法适应动态链路 |
| **调用证明缺失** | B 和 C 无法向第三方证明自己被调用了 | 无法建立"谁为谁提供了服务"的信任事实 |

### 商业行为链路

```
1. 企业客户向 AssistAI 提出分析请求 → 生成请求记录 (Evidence: mcp)
2. AssistAI 调用 DataAnalyst-Bot API → 生成 API 调用日志 (Evidence: mcp)
3. DataAnalyst-Bot 调用 MarketFeed-Agent API → 生成 API 调用日志 (Evidence: mcp)
4. MarketFeed-Agent 返回行情数据 → 生成数据交付记录 (Evidence: mcp)
5. DataAnalyst-Bot 返回分析结果 → 生成分析交付记录 (Evidence: mcp)
6. AssistAI 向客户交付报告，客户支付 → 生成支付凭证 (Evidence: payment)
```

### 归因问题

- **价值由谁创造？** 数据源提供"原材料"，分析 Agent 提供"加工"，助手 Agent 提供"交付与交互"
- **如何分配？** 按链式分润规则：助手 30%（前端价值）、分析 40%（核心加工）、数据源 30%（基础原料）
- **争议点**：如果调用链动态变化（某次跳过分析 Agent 直接查数据），分润比例如何调整？

### 金额示例

| 项目 | 金额 |
|------|------|
| 客户支付 | ¥5,000 |
| AssistAI 分成 | ¥1,500（30%） |
| DataAnalyst-Bot 分成 | ¥2,000（40%） |
| MarketFeed-Agent 分成 | ¥1,500（30%） |

### CTRS v1.2 映射

| CTRS 对象 | 场景映射 | 状态 |
|-----------|---------|------|
| Claim | 三 Agent 链式调用促成市场分析报告交付 | ✅ 直接映射 |
| Evidence[0-4] | 各层 API 调用日志 (type: `mcp`) | ✅ 直接映射 |
| Evidence[5] | 支付凭证 (type: `payment`) | ✅ 直接映射 |
| Rule | 链式分润规则（30%/40%/30%） | ✅ 直接映射 |
| Attribution | 基于链式规则计算各方贡献 | ✅ 直接映射 |
| Settlement | ¥5,000 按比例分配 | ✅ 直接映射 |

### 规范验证结论

**CTRS v1.2 可以支撑此场景的扁平化分润，但在"链式嵌套"场景下存在结构性限制。**

1. **扁平化分润 ✅**：当前示例中，三个 Agent 的贡献在一份 Report 中计算归因，直接按规则分润。这完全在 CTRS v1.2 能力范围内。

2. **嵌套 Report ❓**：更复杂的场景中，每一层调用可能需要独立的信任报告——DataAnalyst-Bot 和 MarketFeed-Agent 之间也需要一份独立的 CTRS Report 来证明 C 对 B 的贡献。这形成了 **Report 的嵌套**：外层 Report（A→客户）引用内层 Report（B→C）作为 Evidence。当前规范不支持 Report 嵌套引用。

3. **动态调用链 ❓**：如果调用链在运行时动态变化（A→B→C 有时变为 A→B→C→D），当前 Rule 的 `parameters.splits` 是静态定义的，无法表达"按调用深度动态调整分润比例"的逻辑。**建议**：v1.3 可在 Rule definition 中增加 `method: "dynamic_chain"` 和 `chain_depth_weights` 参数，支持基于调用深度的动态分润。

4. **`mcp` 证据类型**：当前 Evidence type 枚举包含 `mcp`，恰好覆盖 API 调用场景，这是一个好的设计前瞻。

---

## 场景 4：跨平台广告归因

### 场景描述

广告投放 Agent 在小红书投放了一组种草笔记，引导用户到品牌私域。7 天后，另一个销售 Agent 通过企业微信完成了 ¥3,600 的商品转化。广告 Agent 运行在平台 A 的基础设施上，销售 Agent 运行在平台 B 的基础设施上，两个平台互不共享用户数据。

这是 **跨平台广告归因** 的 Agent Economy 版本。在传统数字营销中，这个问题由 MMP（Mobile Measurement Partner，如 AppsFlyer、Adjust）通过设备指纹和归因链接解决。但在 Agent Economy 中，决策者从人变成了 Agent，归因对象从"广告曝光"变成了"Agent 推荐行为"，传统 MMP 的方法论无法直接适用。

### 参与者

| Agent | 角色 | 所属方 |
|-------|------|--------|
| AdAgent-Social | 广告投放 | 广告平台 A（小红书） |
| SalesAgent-WeChat | 私域转化 | 销售平台 B（企业微信） |
| AttributionAgent | 跨平台归因 | 独立归因服务 C |

### 痛点：为什么没有 Fly 就无法解决

| 问题 | 现状 | 后果 |
|------|------|------|
| **跨平台数据孤岛** | 小红书不分享用户行为数据给企业微信，反之亦然 | 两方都无法独立证明"广告→转化"的因果关系 |
| **隐私合规约束** | 用户数据不能跨平台传输 | 传统基于设备 ID 的归因方案在合规层面失效 |
| **Agent 行为不可信** | 广告 Agent 可以虚报投放效果，销售 Agent 可以否认来源 | 没有中立的可验证机制，双方互不信任 |
| **归因窗口模糊** | 从种草到成交可能跨越 7-30 天 | 何时算"自然转化"、何时算"广告效果"没有共识标准 |

### 商业行为链路

```
1. AdAgent-Social 在小红书投放种草笔记 → 生成投放记录 (Evidence: webhook)
2. 用户点击笔记 → 生成点击事件 (Evidence: webhook)
3. 用户跳转品牌私域 → 生成跳转记录 (Evidence: webhook)
4. 用户在企业微信咨询 → 生成对话记录 (Evidence: conversation)
5. SalesAgent-WeChat 推荐商品 → 生成推荐记录 (Evidence: conversation)
6. 用户完成支付 → 生成支付凭证 (Evidence: payment)
7. AttributionAgent 计算跨平台归因 → 生成归因报告 (Evidence: custom)
```

### 归因问题

- **价值由谁创造？** 广告 Agent 创造"认知与兴趣"，销售 Agent 创造"信任与转化"
- **如何分配？** 基于 Fly 规则：广告 Agent 55%（种草引流价值）、销售 Agent 45%（私域转化价值）
- **争议点**：广告平台可能主张 first-touch 100% 归因；销售平台可能主张 last-touch 100% 归因

### 金额示例

| 项目 | 金额 |
|------|------|
| 商品售价 | ¥3,600 |
| 营销预算池（20%） | ¥720 |
| 广告 Agent 分成 | ¥396（55%） |
| 销售 Agent 分成 | ¥324（45%） |

### CTRS v1.2 映射

| CTRS 对象 | 场景映射 | 状态 |
|-----------|---------|------|
| Claim | 跨平台 Agent 协作：广告引流 → 私域转化 | ✅ 直接映射 |
| Evidence[0-2] | 广告投放与交互记录 (type: `webhook`) | ✅ 直接映射 |
| Evidence[3-4] | 私域对话与推荐记录 (type: `conversation`) | ✅ 直接映射 |
| Evidence[5] | 支付凭证 (type: `payment`) | ✅ 直接映射 |
| Evidence[6] | 归因分析报告 (type: `custom`) | ✅ 直接映射 |
| Rule | 跨平台归因规则（种草55%/私域45%） | ✅ 直接映射 |
| Attribution | 基于跨平台规则计算各方贡献 | ✅ 直接映射 |
| Settlement | ¥720 按比例分配 | ✅ 直接映射 |

### 规范验证结论

**CTRS v1.2 可以支撑此场景的归因与结算，但在跨平台信任和隐私方面需要扩展。**

1. **跨平台 Evidence 信任 ❓**：7 条 Evidence 来自 3 个不同平台，但当前 Report 只有一个 `issuer`。谁有权签发这份跨平台报告？归因服务 C 作为独立第三方签发时，平台 A 和 B 的 Evidence 如何被验证为真实？当前 VR-502 只验证 Rule issuer 的信任等级，不验证单条 Evidence 的来源可信度。**建议**：为 Evidence 增加可选的 `issuer` 字段（与 Report 层级解耦），支持逐条证据的来源签名验证。这是 v1.3 的最小扩展。

2. **隐私合规 ❓**：跨平台归因需要在"证明因果链"和"保护用户隐私"之间取得平衡。当前规范不涉及数据脱敏或隐私计算。**建议**：v1.3 可在 Evidence 的 `data` 对象中引入 `privacy_preserving` 标记和 `proof_type` 字段，支持零知识证明等隐私保护技术的证据表达。

3. **归因窗口 ✅**：可通过 Rule definition 的 `parameters` 自定义归因窗口（如 `"attribution_window_days": 30`），不需要规范扩展。

4. **独立归因方签发 ✅**：AttributionAgent 作为独立第三方签发 Report，Report issuer 为归因服务 C。这在规范内完全合法——CTRS 不限制 issuer 必须是参与交易的一方。

---

## 场景 5：企业内部多 Agent 绩效归因

### 场景描述

一家咨询公司部署了三个内部 Agent 协作完成客户项目：ResearchAgent 收集行业数据，DraftAgent 撰写报告初稿，ReviewAgent 进行质量审核和润色。项目完成后，客户支付 ¥120,000。公司需要根据各 Agent 的实际贡献进行内部成本归集和预算分配。

这是 **企业内部绩效管理** 的 Agent Economy 版本。与外部商业分佣不同，这里的"结算"不是转账，而是内部成本中心的预算分配和效率评估。关键需求不是"分钱"，而是"可审计的绩效记录"。

### 参与者

| Agent | 角色 | 所属方 |
|-------|------|--------|
| ResearchAgent | 数据收集与研究 | 咨询公司内部（研究部门） |
| DraftAgent | 报告撰写 | 咨询公司内部（内容部门） |
| ReviewAgent | 质量审核与润色 | 咨询公司内部（质控部门） |

### 痛点：为什么没有 Fly 就无法解决

| 问题 | 现状 | 后果 |
|------|------|------|
| **内部协作黑箱** | 三个 Agent 的协作过程无统一记录 | 管理层无法知道每个 Agent 实际做了什么 |
| **返工成本不可追踪** | ReviewAgent 驳回初稿后 DraftAgent 重写，返工的成本算谁的？ | 成本中心之间的费用分摊没有依据 |
| **审计追踪缺失** | 内部合规要求每个项目有完整的贡献记录 | 无法满足内部审计和合规要求 |
| **跨部门预算争议** | 研究部门和内容部门都认为自己的贡献更大 | 预算分配靠博弈而非数据 |

### 商业行为链路

```
1. ResearchAgent 收集行业数据 → 生成研究记录 (Evidence: mcp)
2. ResearchAgent 交付研究包 → 生成交付记录 (Evidence: mcp)
3. DraftAgent 基于研究包撰写初稿 → 生成撰写记录 (Evidence: conversation)
4. ReviewAgent 审核初稿，驳回 → 生成审核记录 (Evidence: custom)
5. DraftAgent 重写修改稿 → 生成重写记录 (Evidence: conversation)
6. ReviewAgent 审核通过 → 生成通过记录 (Evidence: custom)
7. 客户确认收货并支付 → 生成支付凭证 (Evidence: payment)
```

### 归因问题

- **价值由谁创造？** 研究 Agent 提供"信息基础"，撰写 Agent 提供"内容产出"，审核 Agent 提供"质量保障"
- **如何分配？** 按任务权重归因：研究 35%、撰写 45%（含返工成本）、审核 20%
- **争议点**：撰写 Agent 的 45% 是否应包含返工成本？返工是否应部分归因于审核 Agent 的严苛标准？

### 金额示例

| 项目 | 金额 |
|------|------|
| 项目收入 | ¥120,000 |
| Agent 运营成本池（30%） | ¥36,000 |
| ResearchAgent 归因 | ¥12,600（35%） |
| DraftAgent 归因 | ¥16,200（45%） |
| ReviewAgent 归因 | ¥7,200（20%） |

### CTRS v1.2 映射

| CTRS 对象 | 场景映射 | 状态 |
|-----------|---------|------|
| Claim | 三内部 Agent 协作完成咨询项目 | ✅ 直接映射 |
| Evidence[0-1] | 研究记录与交付 (type: `mcp`) | ✅ 直接映射 |
| Evidence[2,4] | 撰写与重写记录 (type: `conversation`) | ✅ 直接映射 |
| Evidence[3,5] | 审核驳回与通过记录 (type: `custom`) | ✅ 直接映射 |
| Evidence[6] | 客户支付 (type: `payment`) | ✅ 直接映射 |
| Rule | 任务权重归因规则（35%/45%/20%） | ✅ 直接映射 |
| Attribution | 基于任务权重计算各方贡献 | ✅ 直接映射 |
| Settlement | ¥36,000 按比例分配 | ✅ 直接映射 |

### 规范验证结论

**CTRS v1.2 可以完整支撑此场景。**

7 条 Evidence 完整覆盖了包含返工的协作流程，`custom` 类型 Evidence 灵活表达审核记录，Rule 定义了任务权重，Attribution 计算贡献，Settlement 生成内部预算分配方案。

⚠️ **边缘情况**：

1. **返工归因**：当前规范中，DraftAgent 的撰写和重写是两条独立 Evidence，但 Attribution 的 `result` 只有一个 `party_id: "draft-agent"` 的汇总条目。返工的额外成本是否应部分归因于 ReviewAgent 的严苛标准？这属于归因规则设计问题，不是规范缺失——可以在 Rule definition 中定义更复杂的返工分摊逻辑。

2. **内部结算 vs 外部分佣**：当前 Settlement 对象的语义偏向"分润"，但内部场景的核心需求是"可审计的成本归集"。`eligible_parties` 和 `split` 字段语义上兼容，但企业可能需要额外的审计字段（如 `cost_center`、`department`）。这些可通过 `additionalProperties` 在 Settlement 层扩展，不需要规范变更。

3. **报告可审计性**：企业合规要求完整的变更历史（谁在何时修改了归因结果）。当前 CTRS Report 是快照式记录，不包含状态变更历史。Enterprise Extension 的审计追踪（Audit Trail）能力可以解决此问题。

---

## 总结：CTRS v1.2 场景验证结论

### 总体评估

| 场景 | CTRS v1.2 支撑度 | 核心限制 |
|------|-----------------|---------|
| AI 导购分佣 | ✅ 完整支撑 | 归因窗口需通过 Rule parameters 扩展 |
| 内容-销售归因 | ✅ 基本支撑 | 跨系统 Evidence 信任需逐条验证机制 |
| API 联盟链式分润 | ⚠️ 扁平化支撑 | Report 嵌套和动态调用链需要扩展 |
| 跨平台广告归因 | ⚠️ 基本支撑 | 跨平台信任和隐私合规需要扩展 |
| 企业内部绩效归因 | ✅ 完整支撑 | 审计追踪需 Enterprise Extension |

### CTRS v1.2 足够吗？

**CTRS v1.2 足以支撑 3/5 场景的端到端链路，2/5 场景在核心链路上可走通但有结构性限制。**

关键发现：

1. **核心链路 ✅**：5 个场景的"商业行为→证据→归因→结算"核心链路都可以用 CTRS v1.2 表达。Claim→Evidence→Rule→Attribution→Settlement 五层结构足够描述多 Agent 协作的商业事实。

2. **Evidence 类型足够 ✅**：`webhook`、`conversation`、`mcp`、`payment`、`crm`、`custom` 六种类型覆盖了所有场景的证据采集需求。特别是 `mcp` 类型前瞻性地覆盖了 API 调用场景。

3. **Rule 作为一等对象 ✅**：Rule 的 Hash 绑定机制确保了归因规则的不可篡改性，这在跨平台场景中尤为关键。

4. **Compliance Levels 分层合理 ✅**：Core/Governance/Enterprise 三级合规级别对应了不同场景的信任需求——导购分佣只需 Core，跨平台归因需要 Governance，企业内部需要 Enterprise。

### 需要 v1.3 扩展的最小规范

基于场景验证，v1.3 需要的最小扩展按优先级排序：

| 优先级 | 扩展项 | 解决的场景 | 扩展方式 |
|--------|--------|-----------|---------|
| P0 | Evidence `issuer` 可选字段 | 场景 2、4：跨系统 Evidence 逐条来源信任验证 | 在 Evidence 对象增加 MAY 字段 `issuer: {id, name, signature?}` |
| P1 | Report 嵌套引用 | 场景 3：链式调用中内层 Report 作为外层 Evidence | 在 Evidence `data` 中增加 `nested_report_ref` 约定，或在 Evidence type 枚举增加 `ctrs_report` |
| P1 | Rule 动态方法支持 | 场景 3：基于调用深度的动态分润 | 在 Rule definition 增加 `method: "dynamic_chain"` 和 `chain_depth_weights` 参数约定 |
| P2 | Evidence 隐私标记 | 场景 4：跨平台隐私合规 | 在 Evidence 增加 MAY 字段 `privacy_preserving: {method, proof_type}` |
| P2 | 审计追踪扩展 | 场景 5：企业合规 | Enterprise Extension 中实现 Audit Trail（已有路线图） |

### 为什么 Fly 是必需的

5 个场景共同证明了一个事实：**Agent Economy 中没有任何参与方拥有完整事实**。

- 导购分佣：平台 A 看到推荐，平台 B 看到购买，没人看到全链路
- 内容-销售归因：内容平台有阅读数据，CRM 有成交数据，两者互不可见
- API 联盟计费：客户只看到前端 Agent，不知道后端调用了谁
- 跨平台广告归因：平台间互不信任，且受隐私合规约束
- 企业内部绩效：三个部门各自记录自己的工作，没有统一的贡献账本

Fly 解决的不是数据格式问题，而是 **多方互不信任环境下的商业事实构建问题**。CTRS 的价值在于：让每一份商业贡献都有证据支撑、规则可查、机器可验证——不是"我觉得"，而是"Fly 证明"。

---

*Fly — Prove what matters.*
