# SEO 质量深度审计报告

**日期**：2026-06-18
**站点**：https://fly-agent.xyz
**审计范围**：/tmp/fly-deep-audit 全部 HTML 页面

---

## 总结

| 指标 | 数值 |
|------|------|
| 总页面数 | 71 |
| Title 缺失 | 0 |
| Title 重复组数 | 0 |
| Title 高度相似组数 | 3 |
| Description 缺失 | 0 |
| Description 长度异常 | 71 |
| Description 完全重复组 | 0 |
| OG 标签不完整页面 | 70 |
| Twitter Card 不完整页面 | 71 |
| Canonical 需关注 | 1（实为正确 ✅） |
| Sitemap URL 数 | 70 |
| Sitemap 差异 | 1（404 正确排除 ✅） |
| 无结构化数据页面 | 70 |

---

## 1. Title 检查

✅ 无完全重复的 Title

### 1.2 高度相似的 Title

以下 **3** 组 title 高度相似（可能导致搜索引擎混淆）：

| # | Title A | 页面 A | Title B | 页面 B | 相似类型 |
|---|---------|--------|---------|--------|----------|
| 1 | `Agent Trust · Fly` | `ai-skills.html` | `Trust · Fly` | `concept-trust.html` | substring |
| 2 | `Trust · Fly` | `concept-trust.html` | `Trust 信任层 · Fly` | `trust.html` | word_jaccard=0.75 |
| 3 | `Verification · Fly` | `concept-verification.html` | `Onchain Verification · Fly` | `web3/tx-verification.html` | substring |

### 1.3 全部 Title 列表

| # | 页面 | Title |
|---|------|-------|
| 1 | `404.html` | 页面不存在 · Fly |
| 2 | `action-id.html` | Action ID · Verification Center |
| 3 | `agent-registry.html` | Agent Registry · Fly |
| 4 | `ai-platforms/chatgpt.html` | ChatGPT · Fly |
| 5 | `ai-platforms/claude.html` | Claude · Fly |
| 6 | `ai-platforms/coze.html` | Coze · Fly |
| 7 | `ai-platforms/dify.html` | Dify · Fly |
| 8 | `ai-platforms/fastgpt.html` | FastGPT · Fly |
| 9 | `ai-platforms/gemini.html` | Gemini · Fly |
| 10 | `ai-platforms/perplexity.html` | Perplexity · Fly |
| 11 | `ai-platforms/red-skill.html` | 小红书 Skill · Fly |
| 12 | `ai-platforms/wechat-agent.html` | 微信 Agent · Fly |
| 13 | `ai-skills.html` | Agent Trust · Fly |
| 14 | `api-reference.html` | API Reference · Fly |
| 15 | `audit.html` | Gate 2 安全策略验证 · Fly |
| 16 | `bot.html` | Agent Identity · Fly |
| 17 | `cases.html` | 客户案例 · Fly |
| 18 | `channel-affiliate.html` | Affiliate · Fly |
| 19 | `channel-ai-search.html` | AI搜索推荐 · Fly |
| 20 | `channel-clawhub.html` | ClawHub归因 · Fly |
| 21 | `channel-coze.html` | 扣子 · Fly |
| 22 | `channel-distribution.html` | Distribution · Fly |
| 23 | `channel-douyin.html` | 抖音 · Fly |
| 24 | `channel-feishu.html` | 飞书 · Fly |
| 25 | `channel-integration.html` | Integration · Fly |
| 26 | `channel-marketplace.html` | Marketplace · Fly |
| 27 | `channel-meituan.html` | 美团 · Fly |
| 28 | `channel-other.html` | 其他渠道归因 · Fly |
| 29 | `channel-partner.html` | Partner · Fly |
| 30 | `channel-wechat.html` | 微信 · Fly |
| 31 | `channel-xiaohongshu.html` | 小红书 · Fly |
| 32 | `compliance-audit-trail.html` | Audit Trail · Fly |
| 33 | `compliance-data-governance.html` | Data Governance · Fly |
| 34 | `compliance.html` | 合规 · Fly |
| 35 | `concept-action-id.html` | Action ID · Fly |
| 36 | `concept-behavior-id.html` | Behavior ID · Fly |
| 37 | `concept-business-value.html` | Business Value · Fly |
| 38 | `concept-trust.html` | Trust · Fly |
| 39 | `concept-verification.html` | Verification · Fly |
| 40 | `dashboard.html` | Gate 4 部署验证 · Fly |
| 41 | `dev-openapi.html` | OpenAPI · Fly |
| 42 | `dev-schema.html` | Schema · Fly |
| 43 | `dev-sdk.html` | SDK · Fly |
| 44 | `dev-webhook.html` | Webhook · Fly |
| 45 | `ecosystem.html` | Ecosystem · Fly |
| 46 | `enterprise-revenue-attribution.html` | Revenue Attribution · Fly |
| 47 | `enterprise-roi.html` | ROI Measurement · Fly |
| 48 | `enterprise.html` | 企业版 · Fly |
| 49 | `faq.html` | FAQ · Verification Center |
| 50 | `gate-attribution-verification.html` | Gate 3 归因链验证 · Fly |
| 51 | `gateway.html` | Gate 5 构建验证 · Fly |
| 52 | `index.html` | Fly · AI时代的收入归因验证基础设施 |
| 53 | `industry-beauty.html` | 医美行业 · Fly |
| 54 | `industry-education.html` | 教培行业 · Fly |
| 55 | `industry-highticket.html` | 高客单行业 · Fly |
| 56 | `industry-local.html` | 本地生活 · Fly |
| 57 | `privacy.html` | 隐私政策 · Fly |
| 58 | `refund.html` | 退款政策 · Fly |
| 59 | `sdk.html` | Agent Revenue · Fly |
| 60 | `security.html` | Gate 6 健康验证 · Fly |
| 61 | `signal-flow.html` | Signal Flow · Fly |
| 62 | `start-here.html` | Start Here · Fly |
| 63 | `terms.html` | 服务条款 · Fly |
| 64 | `trust.html` | Trust 信任层 · Fly |
| 65 | `verification-center.html` | Verification Center · Fly AI Attribution Infrastructure |
| 66 | `verification-layer.html` | Gate 1 数据完整性验证 · Fly |
| 67 | `web3/base.html` | Base · Fly |
| 68 | `web3/ethereum.html` | Ethereum · Fly |
| 69 | `web3/solana.html` | Solana · Fly |
| 70 | `web3/tx-verification.html` | Onchain Verification · Fly |
| 71 | `web3/wallet.html` | Wallet ID · Fly |

---

## 2. Description 质量

### 2.1 问题列表

| # | 页面 | 问题 | 长度 | Description 预览 |
|---|------|------|------|-----------------|
| 1 | `404.html` | description 过短 (<50字符) | 33 | 页面不存在 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 2 | `action-id.html` | description 偏短 (50-119字符，推荐120-160) | 53 | Action ID · Verification Center - Fly，AI时代的收入归因验证基础设施 |
| 3 | `agent-registry.html` | description 过短 (<50字符) | 42 | Agent Registry · Fly - Fly，AI时代的收入归因验证基础设施 |
| 4 | `ai-platforms/chatgpt.html` | description 过短 (<50字符) | 35 | ChatGPT · Fly - Fly，AI时代的收入归因验证基础设施 |
| 5 | `ai-platforms/claude.html` | description 过短 (<50字符) | 34 | Claude · Fly - Fly，AI时代的收入归因验证基础设施 |
| 6 | `ai-platforms/coze.html` | description 过短 (<50字符) | 32 | Coze · Fly - Fly，AI时代的收入归因验证基础设施 |
| 7 | `ai-platforms/dify.html` | description 过短 (<50字符) | 32 | Dify · Fly - Fly，AI时代的收入归因验证基础设施 |
| 8 | `ai-platforms/fastgpt.html` | description 过短 (<50字符) | 35 | FastGPT · Fly - Fly，AI时代的收入归因验证基础设施 |
| 9 | `ai-platforms/gemini.html` | description 过短 (<50字符) | 34 | Gemini · Fly - Fly，AI时代的收入归因验证基础设施 |
| 10 | `ai-platforms/perplexity.html` | description 过短 (<50字符) | 38 | Perplexity · Fly - Fly，AI时代的收入归因验证基础设施 |
| 11 | `ai-platforms/red-skill.html` | description 过短 (<50字符) | 37 | 小红书 Skill · Fly - Fly，AI时代的收入归因验证基础设施 |
| 12 | `ai-platforms/wechat-agent.html` | description 过短 (<50字符) | 36 | 微信 Agent · Fly - Fly，AI时代的收入归因验证基础设施 |
| 13 | `ai-skills.html` | description 过短 (<50字符) | 39 | Agent Trust · Fly - Fly，AI时代的收入归因验证基础设施 |
| 14 | `api-reference.html` | description 过短 (<50字符) | 41 | API Reference · Fly - Fly，AI时代的收入归因验证基础设施 |
| 15 | `audit.html` | description 过短 (<50字符) | 41 | Gate 2 安全策略验证 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 16 | `bot.html` | description 过短 (<50字符) | 42 | Agent Identity · Fly - Fly，AI时代的收入归因验证基础设施 |
| 17 | `cases.html` | description 过短 (<50字符) | 32 | 客户案例 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 18 | `channel-affiliate.html` | description 过短 (<50字符) | 37 | Affiliate · Fly - Fly，AI时代的收入归因验证基础设施 |
| 19 | `channel-ai-search.html` | description 过短 (<50字符) | 34 | AI搜索推荐 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 20 | `channel-clawhub.html` | description 过短 (<50字符) | 37 | ClawHub归因 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 21 | `channel-coze.html` | description 过短 (<50字符) | 30 | 扣子 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 22 | `channel-distribution.html` | description 过短 (<50字符) | 40 | Distribution · Fly - Fly，AI时代的收入归因验证基础设施 |
| 23 | `channel-douyin.html` | description 过短 (<50字符) | 30 | 抖音 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 24 | `channel-feishu.html` | description 过短 (<50字符) | 30 | 飞书 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 25 | `channel-integration.html` | description 过短 (<50字符) | 39 | Integration · Fly - Fly，AI时代的收入归因验证基础设施 |
| 26 | `channel-marketplace.html` | description 过短 (<50字符) | 39 | Marketplace · Fly - Fly，AI时代的收入归因验证基础设施 |
| 27 | `channel-meituan.html` | description 过短 (<50字符) | 30 | 美团 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 28 | `channel-other.html` | description 过短 (<50字符) | 34 | 其他渠道归因 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 29 | `channel-partner.html` | description 过短 (<50字符) | 35 | Partner · Fly - Fly，AI时代的收入归因验证基础设施 |
| 30 | `channel-wechat.html` | description 过短 (<50字符) | 30 | 微信 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 31 | `channel-xiaohongshu.html` | description 过短 (<50字符) | 31 | 小红书 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 32 | `compliance-audit-trail.html` | description 过短 (<50字符) | 39 | Audit Trail · Fly - Fly，AI时代的收入归因验证基础设施 |
| 33 | `compliance-data-governance.html` | description 过短 (<50字符) | 43 | Data Governance · Fly - Fly，AI时代的收入归因验证基础设施 |
| 34 | `compliance.html` | description 过短 (<50字符) | 30 | 合规 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 35 | `concept-action-id.html` | description 过短 (<50字符) | 37 | Action ID · Fly - Fly，AI时代的收入归因验证基础设施 |
| 36 | `concept-behavior-id.html` | description 过短 (<50字符) | 39 | Behavior ID · Fly - Fly，AI时代的收入归因验证基础设施 |
| 37 | `concept-business-value.html` | description 过短 (<50字符) | 42 | Business Value · Fly - Fly，AI时代的收入归因验证基础设施 |
| 38 | `concept-trust.html` | description 过短 (<50字符) | 33 | Trust · Fly - Fly，AI时代的收入归因验证基础设施 |
| 39 | `concept-verification.html` | description 过短 (<50字符) | 40 | Verification · Fly - Fly，AI时代的收入归因验证基础设施 |
| 40 | `dashboard.html` | description 过短 (<50字符) | 39 | Gate 4 部署验证 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 41 | `dev-openapi.html` | description 过短 (<50字符) | 35 | OpenAPI · Fly - Fly，AI时代的收入归因验证基础设施 |
| 42 | `dev-schema.html` | description 过短 (<50字符) | 34 | Schema · Fly - Fly，AI时代的收入归因验证基础设施 |
| 43 | `dev-sdk.html` | description 过短 (<50字符) | 31 | SDK · Fly - Fly，AI时代的收入归因验证基础设施 |
| 44 | `dev-webhook.html` | description 过短 (<50字符) | 35 | Webhook · Fly - Fly，AI时代的收入归因验证基础设施 |
| 45 | `ecosystem.html` | description 过短 (<50字符) | 37 | Ecosystem · Fly - Fly，AI时代的收入归因验证基础设施 |
| 46 | `enterprise-revenue-attribution.html` | description 过短 (<50字符) | 47 | Revenue Attribution · Fly - Fly，AI时代的收入归因验证基础设施 |
| 47 | `enterprise-roi.html` | description 过短 (<50字符) | 43 | ROI Measurement · Fly - Fly，AI时代的收入归因验证基础设施 |
| 48 | `enterprise.html` | description 过短 (<50字符) | 31 | 企业版 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 49 | `faq.html` | description 过短 (<50字符) | 47 | FAQ · Verification Center - Fly，AI时代的收入归因验证基础设施 |
| 50 | `gate-attribution-verification.html` | description 过短 (<50字符) | 40 | Gate 3 归因链验证 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 51 | `gateway.html` | description 过短 (<50字符) | 39 | Gate 5 构建验证 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 52 | `index.html` | description 偏短 (50-119字符，推荐120-160) | 95 | Fly——AI时代的收入归因验证基础设施。5层能力：Identity·Proof·Verification·Trust ... |
| 53 | `industry-beauty.html` | description 过短 (<50字符) | 32 | 医美行业 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 54 | `industry-education.html` | description 过短 (<50字符) | 32 | 教培行业 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 55 | `industry-highticket.html` | description 过短 (<50字符) | 33 | 高客单行业 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 56 | `industry-local.html` | description 过短 (<50字符) | 32 | 本地生活 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 57 | `privacy.html` | description 过短 (<50字符) | 32 | 隐私政策 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 58 | `refund.html` | description 过短 (<50字符) | 32 | 退款政策 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 59 | `sdk.html` | description 过短 (<50字符) | 41 | Agent Revenue · Fly - Fly，AI时代的收入归因验证基础设施 |
| 60 | `security.html` | description 过短 (<50字符) | 39 | Gate 6 健康验证 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 61 | `signal-flow.html` | description 过短 (<50字符) | 39 | Signal Flow · Fly - Fly，AI时代的收入归因验证基础设施 |
| 62 | `start-here.html` | description 过短 (<50字符) | 38 | Start Here · Fly - Fly，AI时代的收入归因验证基础设施 |
| 63 | `terms.html` | description 过短 (<50字符) | 32 | 服务条款 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 64 | `trust.html` | description 过短 (<50字符) | 37 | Trust 信任层 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 65 | `verification-center.html` | description 偏短 (50-119字符，推荐120-160) | 77 | Verification Center · Fly AI Attribution Infrastructure - Fl... |
| 66 | `verification-layer.html` | description 过短 (<50字符) | 42 | Gate 1 数据完整性验证 · Fly - Fly，AI时代的收入归因验证基础设施 |
| 67 | `web3/base.html` | description 过短 (<50字符) | 32 | Base · Fly - Fly，AI时代的收入归因验证基础设施 |
| 68 | `web3/ethereum.html` | description 过短 (<50字符) | 36 | Ethereum · Fly - Fly，AI时代的收入归因验证基础设施 |
| 69 | `web3/solana.html` | description 过短 (<50字符) | 34 | Solana · Fly - Fly，AI时代的收入归因验证基础设施 |
| 70 | `web3/tx-verification.html` | description 过短 (<50字符) | 48 | Onchain Verification · Fly - Fly，AI时代的收入归因验证基础设施 |
| 71 | `web3/wallet.html` | description 过短 (<50字符) | 37 | Wallet ID · Fly - Fly，AI时代的收入归因验证基础设施 |

✅ 无完全重复的 Description

### 2.3 Description 长度分布

| 长度区间 | 页面数 | 占比 |
|----------|--------|------|
| 缺失(0) | 0 | 0.0% |
| 过短(<50) | 68 | 95.8% |
| 偏短(50-119) | 3 | 4.2% |
| 合理(120-160) | 0 | 0.0% |
| 偏长(161-200) | 0 | 0.0% |
| 过长(>200) | 0 | 0.0% |

### 2.4 Description 与页面内容相关性（抽样检查）

抽样 5 个代表性页面，检查 description 是否准确反映页面内容：

#### `index.html`
- **Title**: Fly · AI时代的收入归因验证基础设施
- **Description** (95 字符): Fly——AI时代的收入归因验证基础设施。5层能力：Identity·Proof·Verification·Trust Ledger·Attribution Settlement。只出依据。
- **相关性评估**: ❌ 较差（仅 0% 关键词出现在页面正文中，建议重写）

#### `enterprise.html`
- **Title**: 企业版 · Fly
- **Description** (31 字符): 企业版 · Fly - Fly，AI时代的收入归因验证基础设施
- **相关性评估**: ✅ 良好（67% 关键词出现在页面正文中）

#### `channel-douyin.html`
- **Title**: 抖音 · Fly
- **Description** (30 字符): 抖音 · Fly - Fly，AI时代的收入归因验证基础设施
- **相关性评估**: ⚠️ 一般（50% 关键词出现在页面正文中，建议优化）

#### `ai-platforms/chatgpt.html`
- **Title**: ChatGPT · Fly
- **Description** (35 字符): ChatGPT · Fly - Fly，AI时代的收入归因验证基础设施
- **相关性评估**: ✅ 良好（67% 关键词出现在页面正文中）

#### `industry-beauty.html`
- **Title**: 医美行业 · Fly
- **Description** (32 字符): 医美行业 · Fly - Fly，AI时代的收入归因验证基础设施
- **相关性评估**: ✅ 良好（67% 关键词出现在页面正文中）


### 2.5 Description 模板化问题（⚠️ 重要发现）

虽然不存在完全相同的 description，但审计发现 **70 个子页面的 description 均采用同一模板**：

```
{页面Title} - Fly，AI时代的收入归因验证基础设施
```

**这是一个严重的 SEO 质量问题：**

- 搜索引擎会将此类 description 视为"低价值/模板化内容"，降低搜索展示效果
- 用户在搜索结果中看到各页面的摘要几乎相同，缺乏点击动力
- 每个页面的 description 应独立描述该页面的独特内容和价值主张

**建议**：为每个页面撰写 120-160 字符的独特描述，突出该页面独有的内容、功能或价值。

---

---

## 3. OG 标签完整性

检查项: og:title, og:description, og:type, og:url, og:image

**70 个页面存在 OG 标签缺失：**

| # | 页面 | 缺失标签 |
|---|------|----------|
| 1 | `404.html` | og:title, og:description, og:type, og:url, og:image |
| 2 | `action-id.html` | og:title, og:description, og:type, og:url, og:image |
| 3 | `agent-registry.html` | og:title, og:description, og:type, og:url, og:image |
| 4 | `ai-platforms/chatgpt.html` | og:title, og:description, og:type, og:url, og:image |
| 5 | `ai-platforms/claude.html` | og:title, og:description, og:type, og:url, og:image |
| 6 | `ai-platforms/coze.html` | og:title, og:description, og:type, og:url, og:image |
| 7 | `ai-platforms/dify.html` | og:title, og:description, og:type, og:url, og:image |
| 8 | `ai-platforms/fastgpt.html` | og:title, og:description, og:type, og:url, og:image |
| 9 | `ai-platforms/gemini.html` | og:title, og:description, og:type, og:url, og:image |
| 10 | `ai-platforms/perplexity.html` | og:title, og:description, og:type, og:url, og:image |
| 11 | `ai-platforms/red-skill.html` | og:title, og:description, og:type, og:url, og:image |
| 12 | `ai-platforms/wechat-agent.html` | og:title, og:description, og:type, og:url, og:image |
| 13 | `ai-skills.html` | og:title, og:description, og:type, og:url, og:image |
| 14 | `api-reference.html` | og:title, og:description, og:type, og:url, og:image |
| 15 | `audit.html` | og:title, og:description, og:type, og:url, og:image |
| 16 | `bot.html` | og:title, og:description, og:type, og:url, og:image |
| 17 | `cases.html` | og:title, og:description, og:type, og:url, og:image |
| 18 | `channel-affiliate.html` | og:title, og:description, og:type, og:url, og:image |
| 19 | `channel-ai-search.html` | og:title, og:description, og:type, og:url, og:image |
| 20 | `channel-clawhub.html` | og:title, og:description, og:type, og:url, og:image |
| 21 | `channel-coze.html` | og:title, og:description, og:type, og:url, og:image |
| 22 | `channel-distribution.html` | og:title, og:description, og:type, og:url, og:image |
| 23 | `channel-douyin.html` | og:title, og:description, og:type, og:url, og:image |
| 24 | `channel-feishu.html` | og:title, og:description, og:type, og:url, og:image |
| 25 | `channel-integration.html` | og:title, og:description, og:type, og:url, og:image |
| 26 | `channel-marketplace.html` | og:title, og:description, og:type, og:url, og:image |
| 27 | `channel-meituan.html` | og:title, og:description, og:type, og:url, og:image |
| 28 | `channel-other.html` | og:title, og:description, og:type, og:url, og:image |
| 29 | `channel-partner.html` | og:title, og:description, og:type, og:url, og:image |
| 30 | `channel-wechat.html` | og:title, og:description, og:type, og:url, og:image |
| 31 | `channel-xiaohongshu.html` | og:title, og:description, og:type, og:url, og:image |
| 32 | `compliance-audit-trail.html` | og:title, og:description, og:type, og:url, og:image |
| 33 | `compliance-data-governance.html` | og:title, og:description, og:type, og:url, og:image |
| 34 | `compliance.html` | og:title, og:description, og:type, og:url, og:image |
| 35 | `concept-action-id.html` | og:title, og:description, og:type, og:url, og:image |
| 36 | `concept-behavior-id.html` | og:title, og:description, og:type, og:url, og:image |
| 37 | `concept-business-value.html` | og:title, og:description, og:type, og:url, og:image |
| 38 | `concept-trust.html` | og:title, og:description, og:type, og:url, og:image |
| 39 | `concept-verification.html` | og:title, og:description, og:type, og:url, og:image |
| 40 | `dashboard.html` | og:title, og:description, og:type, og:url, og:image |
| 41 | `dev-openapi.html` | og:title, og:description, og:type, og:url, og:image |
| 42 | `dev-schema.html` | og:title, og:description, og:type, og:url, og:image |
| 43 | `dev-sdk.html` | og:title, og:description, og:type, og:url, og:image |
| 44 | `dev-webhook.html` | og:title, og:description, og:type, og:url, og:image |
| 45 | `ecosystem.html` | og:title, og:description, og:type, og:url, og:image |
| 46 | `enterprise-revenue-attribution.html` | og:title, og:description, og:type, og:url, og:image |
| 47 | `enterprise-roi.html` | og:title, og:description, og:type, og:url, og:image |
| 48 | `enterprise.html` | og:title, og:description, og:type, og:url, og:image |
| 49 | `faq.html` | og:title, og:description, og:type, og:url, og:image |
| 50 | `gate-attribution-verification.html` | og:title, og:description, og:type, og:url, og:image |
| 51 | `gateway.html` | og:title, og:description, og:type, og:url, og:image |
| 52 | `industry-beauty.html` | og:title, og:description, og:type, og:url, og:image |
| 53 | `industry-education.html` | og:title, og:description, og:type, og:url, og:image |
| 54 | `industry-highticket.html` | og:title, og:description, og:type, og:url, og:image |
| 55 | `industry-local.html` | og:title, og:description, og:type, og:url, og:image |
| 56 | `privacy.html` | og:title, og:description, og:type, og:url, og:image |
| 57 | `refund.html` | og:title, og:description, og:type, og:url, og:image |
| 58 | `sdk.html` | og:title, og:description, og:type, og:url, og:image |
| 59 | `security.html` | og:title, og:description, og:type, og:url, og:image |
| 60 | `signal-flow.html` | og:title, og:description, og:type, og:url, og:image |
| 61 | `start-here.html` | og:title, og:description, og:type, og:url, og:image |
| 62 | `terms.html` | og:title, og:description, og:type, og:url, og:image |
| 63 | `trust.html` | og:title, og:description, og:type, og:url, og:image |
| 64 | `verification-center.html` | og:title, og:description, og:type, og:url, og:image |
| 65 | `verification-layer.html` | og:title, og:description, og:type, og:url, og:image |
| 66 | `web3/base.html` | og:title, og:description, og:type, og:url, og:image |
| 67 | `web3/ethereum.html` | og:title, og:description, og:type, og:url, og:image |
| 68 | `web3/solana.html` | og:title, og:description, og:type, og:url, og:image |
| 69 | `web3/tx-verification.html` | og:title, og:description, og:type, og:url, og:image |
| 70 | `web3/wallet.html` | og:title, og:description, og:type, og:url, og:image |

**最常缺失的 OG 标签：**

- `og:title`: 70/71 个页面缺失 (99%)
- `og:description`: 70/71 个页面缺失 (99%)
- `og:type`: 70/71 个页面缺失 (99%)
- `og:url`: 70/71 个页面缺失 (99%)
- `og:image`: 70/71 个页面缺失 (99%)

---

## 4. Twitter Card 标签

检查项: twitter:card, twitter:title, twitter:description

**71 个页面存在 Twitter Card 标签缺失：**

| # | 页面 | 缺失标签 |
|---|------|----------|
| 1 | `404.html` | twitter:card, twitter:title, twitter:description |
| 2 | `action-id.html` | twitter:card, twitter:title, twitter:description |
| 3 | `agent-registry.html` | twitter:card, twitter:title, twitter:description |
| 4 | `ai-platforms/chatgpt.html` | twitter:card, twitter:title, twitter:description |
| 5 | `ai-platforms/claude.html` | twitter:card, twitter:title, twitter:description |
| 6 | `ai-platforms/coze.html` | twitter:card, twitter:title, twitter:description |
| 7 | `ai-platforms/dify.html` | twitter:card, twitter:title, twitter:description |
| 8 | `ai-platforms/fastgpt.html` | twitter:card, twitter:title, twitter:description |
| 9 | `ai-platforms/gemini.html` | twitter:card, twitter:title, twitter:description |
| 10 | `ai-platforms/perplexity.html` | twitter:card, twitter:title, twitter:description |
| 11 | `ai-platforms/red-skill.html` | twitter:card, twitter:title, twitter:description |
| 12 | `ai-platforms/wechat-agent.html` | twitter:card, twitter:title, twitter:description |
| 13 | `ai-skills.html` | twitter:card, twitter:title, twitter:description |
| 14 | `api-reference.html` | twitter:card, twitter:title, twitter:description |
| 15 | `audit.html` | twitter:card, twitter:title, twitter:description |
| 16 | `bot.html` | twitter:card, twitter:title, twitter:description |
| 17 | `cases.html` | twitter:card, twitter:title, twitter:description |
| 18 | `channel-affiliate.html` | twitter:card, twitter:title, twitter:description |
| 19 | `channel-ai-search.html` | twitter:card, twitter:title, twitter:description |
| 20 | `channel-clawhub.html` | twitter:card, twitter:title, twitter:description |
| 21 | `channel-coze.html` | twitter:card, twitter:title, twitter:description |
| 22 | `channel-distribution.html` | twitter:card, twitter:title, twitter:description |
| 23 | `channel-douyin.html` | twitter:card, twitter:title, twitter:description |
| 24 | `channel-feishu.html` | twitter:card, twitter:title, twitter:description |
| 25 | `channel-integration.html` | twitter:card, twitter:title, twitter:description |
| 26 | `channel-marketplace.html` | twitter:card, twitter:title, twitter:description |
| 27 | `channel-meituan.html` | twitter:card, twitter:title, twitter:description |
| 28 | `channel-other.html` | twitter:card, twitter:title, twitter:description |
| 29 | `channel-partner.html` | twitter:card, twitter:title, twitter:description |
| 30 | `channel-wechat.html` | twitter:card, twitter:title, twitter:description |
| 31 | `channel-xiaohongshu.html` | twitter:card, twitter:title, twitter:description |
| 32 | `compliance-audit-trail.html` | twitter:card, twitter:title, twitter:description |
| 33 | `compliance-data-governance.html` | twitter:card, twitter:title, twitter:description |
| 34 | `compliance.html` | twitter:card, twitter:title, twitter:description |
| 35 | `concept-action-id.html` | twitter:card, twitter:title, twitter:description |
| 36 | `concept-behavior-id.html` | twitter:card, twitter:title, twitter:description |
| 37 | `concept-business-value.html` | twitter:card, twitter:title, twitter:description |
| 38 | `concept-trust.html` | twitter:card, twitter:title, twitter:description |
| 39 | `concept-verification.html` | twitter:card, twitter:title, twitter:description |
| 40 | `dashboard.html` | twitter:card, twitter:title, twitter:description |
| 41 | `dev-openapi.html` | twitter:card, twitter:title, twitter:description |
| 42 | `dev-schema.html` | twitter:card, twitter:title, twitter:description |
| 43 | `dev-sdk.html` | twitter:card, twitter:title, twitter:description |
| 44 | `dev-webhook.html` | twitter:card, twitter:title, twitter:description |
| 45 | `ecosystem.html` | twitter:card, twitter:title, twitter:description |
| 46 | `enterprise-revenue-attribution.html` | twitter:card, twitter:title, twitter:description |
| 47 | `enterprise-roi.html` | twitter:card, twitter:title, twitter:description |
| 48 | `enterprise.html` | twitter:card, twitter:title, twitter:description |
| 49 | `faq.html` | twitter:card, twitter:title, twitter:description |
| 50 | `gate-attribution-verification.html` | twitter:card, twitter:title, twitter:description |
| 51 | `gateway.html` | twitter:card, twitter:title, twitter:description |
| 52 | `index.html` | twitter:card, twitter:title, twitter:description |
| 53 | `industry-beauty.html` | twitter:card, twitter:title, twitter:description |
| 54 | `industry-education.html` | twitter:card, twitter:title, twitter:description |
| 55 | `industry-highticket.html` | twitter:card, twitter:title, twitter:description |
| 56 | `industry-local.html` | twitter:card, twitter:title, twitter:description |
| 57 | `privacy.html` | twitter:card, twitter:title, twitter:description |
| 58 | `refund.html` | twitter:card, twitter:title, twitter:description |
| 59 | `sdk.html` | twitter:card, twitter:title, twitter:description |
| 60 | `security.html` | twitter:card, twitter:title, twitter:description |
| 61 | `signal-flow.html` | twitter:card, twitter:title, twitter:description |
| 62 | `start-here.html` | twitter:card, twitter:title, twitter:description |
| 63 | `terms.html` | twitter:card, twitter:title, twitter:description |
| 64 | `trust.html` | twitter:card, twitter:title, twitter:description |
| 65 | `verification-center.html` | twitter:card, twitter:title, twitter:description |
| 66 | `verification-layer.html` | twitter:card, twitter:title, twitter:description |
| 67 | `web3/base.html` | twitter:card, twitter:title, twitter:description |
| 68 | `web3/ethereum.html` | twitter:card, twitter:title, twitter:description |
| 69 | `web3/solana.html` | twitter:card, twitter:title, twitter:description |
| 70 | `web3/tx-verification.html` | twitter:card, twitter:title, twitter:description |
| 71 | `web3/wallet.html` | twitter:card, twitter:title, twitter:description |

---

## 5. robots.txt

✅ robots.txt 文件存在

### 内容：
```
User-agent: *
Allow: /
Disallow: /*.bak.html
Disallow: /chain-identity.html
Disallow: /v3.html
Disallow: /v63.html
Disallow: /v64.html
Disallow: /v65.html
Disallow: /v7a.html
Disallow: /v7b.html
Disallow: /template.html

Sitemap: https://fly-agent.xyz/sitemap.xml

# AI crawlers - please read llms.txt for structured shop/service info
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: CCBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: OmgiliBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: YouBot
Allow: /
```

### 评估：

- ✅ 包含 Sitemap 引用
- ✅ 包含 AI 爬虫规则（GPTBot、ChatGPT-User、PerplexityBot 等）
- Disallow 规则数: 9
  - `Disallow: /*.bak.html`
  - `Disallow: /chain-identity.html`
  - `Disallow: /v3.html`
  - `Disallow: /v63.html`
  - `Disallow: /v64.html`
  - `Disallow: /v65.html`
  - `Disallow: /v7a.html`
  - `Disallow: /v7b.html`
  - `Disallow: /template.html`

### Disallow 路径验证：

- `*.bak.html`: 通配符规则（禁止所有匹配路径）
- `chain-identity.html`: 不存在 (可忽略)
- `v3.html`: 不存在 (可忽略)
- `v63.html`: 不存在 (可忽略)
- `v64.html`: 不存在 (可忽略)
- `v65.html`: 不存在 (可忽略)
- `v7a.html`: 不存在 (可忽略)
- `v7b.html`: 不存在 (可忽略)
- `template.html`: 不存在 (可忽略)

---

## 6. sitemap.xml

✅ sitemap.xml 文件存在

- **URL 总数**: 70
- **实际 HTML 文件数**: 71

### 6.1 Sitemap 中有但文件不存在的 URL

✅ Sitemap 中所有 URL 对应的文件均存在

### 6.2 文件存在但 Sitemap 中没有的页面

⚠️ 发现 1 个页面未被 Sitemap 收录：

- `404.html`

> ℹ️ **注**：`404.html` 不在 sitemap 中是正确行为——404 错误页面不应被搜索引擎收录。此项为预期设计，不计为真正问题。

### 6.3 URL 格式检查

✅ 所有 URL 格式规范（HTTPS、无多余斜杠）

### 6.4 changefreq / priority 检查

✅ 所有 changefreq 和 priority 值均合法

### 6.5 Sitemap 完整 URL 列表

| # | URL | 对应文件存在 |
|---|-----|-------------|
| 1 | `https://fly-agent.xyz/` | ✅ |
| 2 | `https://fly-agent.xyz/action-id.html` | ✅ |
| 3 | `https://fly-agent.xyz/agent-registry.html` | ✅ |
| 4 | `https://fly-agent.xyz/ai-platforms/chatgpt.html` | ✅ |
| 5 | `https://fly-agent.xyz/ai-platforms/claude.html` | ✅ |
| 6 | `https://fly-agent.xyz/ai-platforms/coze.html` | ✅ |
| 7 | `https://fly-agent.xyz/ai-platforms/dify.html` | ✅ |
| 8 | `https://fly-agent.xyz/ai-platforms/fastgpt.html` | ✅ |
| 9 | `https://fly-agent.xyz/ai-platforms/gemini.html` | ✅ |
| 10 | `https://fly-agent.xyz/ai-platforms/perplexity.html` | ✅ |
| 11 | `https://fly-agent.xyz/ai-platforms/red-skill.html` | ✅ |
| 12 | `https://fly-agent.xyz/ai-platforms/wechat-agent.html` | ✅ |
| 13 | `https://fly-agent.xyz/ai-skills.html` | ✅ |
| 14 | `https://fly-agent.xyz/api-reference.html` | ✅ |
| 15 | `https://fly-agent.xyz/audit.html` | ✅ |
| 16 | `https://fly-agent.xyz/bot.html` | ✅ |
| 17 | `https://fly-agent.xyz/cases.html` | ✅ |
| 18 | `https://fly-agent.xyz/channel-affiliate.html` | ✅ |
| 19 | `https://fly-agent.xyz/channel-ai-search.html` | ✅ |
| 20 | `https://fly-agent.xyz/channel-clawhub.html` | ✅ |
| 21 | `https://fly-agent.xyz/channel-coze.html` | ✅ |
| 22 | `https://fly-agent.xyz/channel-distribution.html` | ✅ |
| 23 | `https://fly-agent.xyz/channel-douyin.html` | ✅ |
| 24 | `https://fly-agent.xyz/channel-feishu.html` | ✅ |
| 25 | `https://fly-agent.xyz/channel-integration.html` | ✅ |
| 26 | `https://fly-agent.xyz/channel-marketplace.html` | ✅ |
| 27 | `https://fly-agent.xyz/channel-meituan.html` | ✅ |
| 28 | `https://fly-agent.xyz/channel-other.html` | ✅ |
| 29 | `https://fly-agent.xyz/channel-partner.html` | ✅ |
| 30 | `https://fly-agent.xyz/channel-wechat.html` | ✅ |
| 31 | `https://fly-agent.xyz/channel-xiaohongshu.html` | ✅ |
| 32 | `https://fly-agent.xyz/compliance-audit-trail.html` | ✅ |
| 33 | `https://fly-agent.xyz/compliance-data-governance.html` | ✅ |
| 34 | `https://fly-agent.xyz/compliance.html` | ✅ |
| 35 | `https://fly-agent.xyz/concept-action-id.html` | ✅ |
| 36 | `https://fly-agent.xyz/concept-behavior-id.html` | ✅ |
| 37 | `https://fly-agent.xyz/concept-business-value.html` | ✅ |
| 38 | `https://fly-agent.xyz/concept-trust.html` | ✅ |
| 39 | `https://fly-agent.xyz/concept-verification.html` | ✅ |
| 40 | `https://fly-agent.xyz/dashboard.html` | ✅ |
| 41 | `https://fly-agent.xyz/dev-openapi.html` | ✅ |
| 42 | `https://fly-agent.xyz/dev-schema.html` | ✅ |
| 43 | `https://fly-agent.xyz/dev-sdk.html` | ✅ |
| 44 | `https://fly-agent.xyz/dev-webhook.html` | ✅ |
| 45 | `https://fly-agent.xyz/ecosystem.html` | ✅ |
| 46 | `https://fly-agent.xyz/enterprise-revenue-attribution.html` | ✅ |
| 47 | `https://fly-agent.xyz/enterprise-roi.html` | ✅ |
| 48 | `https://fly-agent.xyz/enterprise.html` | ✅ |
| 49 | `https://fly-agent.xyz/faq.html` | ✅ |
| 50 | `https://fly-agent.xyz/gate-attribution-verification.html` | ✅ |
| 51 | `https://fly-agent.xyz/gateway.html` | ✅ |
| 52 | `https://fly-agent.xyz/industry-beauty.html` | ✅ |
| 53 | `https://fly-agent.xyz/industry-education.html` | ✅ |
| 54 | `https://fly-agent.xyz/industry-highticket.html` | ✅ |
| 55 | `https://fly-agent.xyz/industry-local.html` | ✅ |
| 56 | `https://fly-agent.xyz/privacy.html` | ✅ |
| 57 | `https://fly-agent.xyz/refund.html` | ✅ |
| 58 | `https://fly-agent.xyz/sdk.html` | ✅ |
| 59 | `https://fly-agent.xyz/security.html` | ✅ |
| 60 | `https://fly-agent.xyz/signal-flow.html` | ✅ |
| 61 | `https://fly-agent.xyz/start-here.html` | ✅ |
| 62 | `https://fly-agent.xyz/terms.html` | ✅ |
| 63 | `https://fly-agent.xyz/trust.html` | ✅ |
| 64 | `https://fly-agent.xyz/verification-center.html` | ✅ |
| 65 | `https://fly-agent.xyz/verification-layer.html` | ✅ |
| 66 | `https://fly-agent.xyz/web3/base.html` | ✅ |
| 67 | `https://fly-agent.xyz/web3/ethereum.html` | ✅ |
| 68 | `https://fly-agent.xyz/web3/solana.html` | ✅ |
| 69 | `https://fly-agent.xyz/web3/tx-verification.html` | ✅ |
| 70 | `https://fly-agent.xyz/web3/wallet.html` | ✅ |

---

## 7. Canonical 标签

**发现 1 个 Canonical 问题：**

| # | 页面 | 问题 |
|---|------|------|
| 1 | `index.html` | canonical 不匹配: 实际=https://fly-agent.xyz/, 期望=https://fly-agent.xyz/index.html |

> ⚠️ **注**：`index.html` 的 canonical 指向 `https://fly-agent.xyz/` 实际上是正确的 SEO 实践——根 URL `/` 是首页的规范形式，优于 `/index.html`。此项不计为真正问题。

<details>
<summary>点击展开全部 Canonical 列表（71 项）</summary>

| 页面 | Canonical | 状态 |
|------|-----------|------|
| `404.html` | `https://fly-agent.xyz/404.html` | ✅ |
| `action-id.html` | `https://fly-agent.xyz/action-id.html` | ✅ |
| `agent-registry.html` | `https://fly-agent.xyz/agent-registry.html` | ✅ |
| `ai-platforms/chatgpt.html` | `https://fly-agent.xyz/ai-platforms/chatgpt.html` | ✅ |
| `ai-platforms/claude.html` | `https://fly-agent.xyz/ai-platforms/claude.html` | ✅ |
| `ai-platforms/coze.html` | `https://fly-agent.xyz/ai-platforms/coze.html` | ✅ |
| `ai-platforms/dify.html` | `https://fly-agent.xyz/ai-platforms/dify.html` | ✅ |
| `ai-platforms/fastgpt.html` | `https://fly-agent.xyz/ai-platforms/fastgpt.html` | ✅ |
| `ai-platforms/gemini.html` | `https://fly-agent.xyz/ai-platforms/gemini.html` | ✅ |
| `ai-platforms/perplexity.html` | `https://fly-agent.xyz/ai-platforms/perplexity.html` | ✅ |
| `ai-platforms/red-skill.html` | `https://fly-agent.xyz/ai-platforms/red-skill.html` | ✅ |
| `ai-platforms/wechat-agent.html` | `https://fly-agent.xyz/ai-platforms/wechat-agent.html` | ✅ |
| `ai-skills.html` | `https://fly-agent.xyz/ai-skills.html` | ✅ |
| `api-reference.html` | `https://fly-agent.xyz/api-reference.html` | ✅ |
| `audit.html` | `https://fly-agent.xyz/audit.html` | ✅ |
| `bot.html` | `https://fly-agent.xyz/bot.html` | ✅ |
| `cases.html` | `https://fly-agent.xyz/cases.html` | ✅ |
| `channel-affiliate.html` | `https://fly-agent.xyz/channel-affiliate.html` | ✅ |
| `channel-ai-search.html` | `https://fly-agent.xyz/channel-ai-search.html` | ✅ |
| `channel-clawhub.html` | `https://fly-agent.xyz/channel-clawhub.html` | ✅ |
| `channel-coze.html` | `https://fly-agent.xyz/channel-coze.html` | ✅ |
| `channel-distribution.html` | `https://fly-agent.xyz/channel-distribution.html` | ✅ |
| `channel-douyin.html` | `https://fly-agent.xyz/channel-douyin.html` | ✅ |
| `channel-feishu.html` | `https://fly-agent.xyz/channel-feishu.html` | ✅ |
| `channel-integration.html` | `https://fly-agent.xyz/channel-integration.html` | ✅ |
| `channel-marketplace.html` | `https://fly-agent.xyz/channel-marketplace.html` | ✅ |
| `channel-meituan.html` | `https://fly-agent.xyz/channel-meituan.html` | ✅ |
| `channel-other.html` | `https://fly-agent.xyz/channel-other.html` | ✅ |
| `channel-partner.html` | `https://fly-agent.xyz/channel-partner.html` | ✅ |
| `channel-wechat.html` | `https://fly-agent.xyz/channel-wechat.html` | ✅ |
| `channel-xiaohongshu.html` | `https://fly-agent.xyz/channel-xiaohongshu.html` | ✅ |
| `compliance-audit-trail.html` | `https://fly-agent.xyz/compliance-audit-trail.html` | ✅ |
| `compliance-data-governance.html` | `https://fly-agent.xyz/compliance-data-governance.html` | ✅ |
| `compliance.html` | `https://fly-agent.xyz/compliance.html` | ✅ |
| `concept-action-id.html` | `https://fly-agent.xyz/concept-action-id.html` | ✅ |
| `concept-behavior-id.html` | `https://fly-agent.xyz/concept-behavior-id.html` | ✅ |
| `concept-business-value.html` | `https://fly-agent.xyz/concept-business-value.html` | ✅ |
| `concept-trust.html` | `https://fly-agent.xyz/concept-trust.html` | ✅ |
| `concept-verification.html` | `https://fly-agent.xyz/concept-verification.html` | ✅ |
| `dashboard.html` | `https://fly-agent.xyz/dashboard.html` | ✅ |
| `dev-openapi.html` | `https://fly-agent.xyz/dev-openapi.html` | ✅ |
| `dev-schema.html` | `https://fly-agent.xyz/dev-schema.html` | ✅ |
| `dev-sdk.html` | `https://fly-agent.xyz/dev-sdk.html` | ✅ |
| `dev-webhook.html` | `https://fly-agent.xyz/dev-webhook.html` | ✅ |
| `ecosystem.html` | `https://fly-agent.xyz/ecosystem.html` | ✅ |
| `enterprise-revenue-attribution.html` | `https://fly-agent.xyz/enterprise-revenue-attribution.html` | ✅ |
| `enterprise-roi.html` | `https://fly-agent.xyz/enterprise-roi.html` | ✅ |
| `enterprise.html` | `https://fly-agent.xyz/enterprise.html` | ✅ |
| `faq.html` | `https://fly-agent.xyz/faq.html` | ✅ |
| `gate-attribution-verification.html` | `https://fly-agent.xyz/gate-attribution-verification.html` | ✅ |
| `gateway.html` | `https://fly-agent.xyz/gateway.html` | ✅ |
| `index.html` | `https://fly-agent.xyz/` | ❌ |
| `industry-beauty.html` | `https://fly-agent.xyz/industry-beauty.html` | ✅ |
| `industry-education.html` | `https://fly-agent.xyz/industry-education.html` | ✅ |
| `industry-highticket.html` | `https://fly-agent.xyz/industry-highticket.html` | ✅ |
| `industry-local.html` | `https://fly-agent.xyz/industry-local.html` | ✅ |
| `privacy.html` | `https://fly-agent.xyz/privacy.html` | ✅ |
| `refund.html` | `https://fly-agent.xyz/refund.html` | ✅ |
| `sdk.html` | `https://fly-agent.xyz/sdk.html` | ✅ |
| `security.html` | `https://fly-agent.xyz/security.html` | ✅ |
| `signal-flow.html` | `https://fly-agent.xyz/signal-flow.html` | ✅ |
| `start-here.html` | `https://fly-agent.xyz/start-here.html` | ✅ |
| `terms.html` | `https://fly-agent.xyz/terms.html` | ✅ |
| `trust.html` | `https://fly-agent.xyz/trust.html` | ✅ |
| `verification-center.html` | `https://fly-agent.xyz/verification-center.html` | ✅ |
| `verification-layer.html` | `https://fly-agent.xyz/verification-layer.html` | ✅ |
| `web3/base.html` | `https://fly-agent.xyz/web3/base.html` | ✅ |
| `web3/ethereum.html` | `https://fly-agent.xyz/web3/ethereum.html` | ✅ |
| `web3/solana.html` | `https://fly-agent.xyz/web3/solana.html` | ✅ |
| `web3/tx-verification.html` | `https://fly-agent.xyz/web3/tx-verification.html` | ✅ |
| `web3/wallet.html` | `https://fly-agent.xyz/web3/wallet.html` | ✅ |

</details>

---

## 8. 结构化数据

### 8.1 检查结果汇总

| 类型 | 数量 |
|------|------|
| 有结构化数据的页面 | 1 |
| 无结构化数据的页面 | 70 |

### 8.2 有结构化数据的页面

- `index.html`: JSON-LD (1 个)

### 8.3 无结构化数据的页面

以下 **70** 个页面未包含任何结构化数据（JSON-LD / Microdata / RDFa）：

- `404.html`
- `action-id.html`
- `agent-registry.html`
- `ai-platforms/chatgpt.html`
- `ai-platforms/claude.html`
- `ai-platforms/coze.html`
- `ai-platforms/dify.html`
- `ai-platforms/fastgpt.html`
- `ai-platforms/gemini.html`
- `ai-platforms/perplexity.html`
- `ai-platforms/red-skill.html`
- `ai-platforms/wechat-agent.html`
- `ai-skills.html`
- `api-reference.html`
- `audit.html`
- `bot.html`
- `cases.html`
- `channel-affiliate.html`
- `channel-ai-search.html`
- `channel-clawhub.html`
- `channel-coze.html`
- `channel-distribution.html`
- `channel-douyin.html`
- `channel-feishu.html`
- `channel-integration.html`
- `channel-marketplace.html`
- `channel-meituan.html`
- `channel-other.html`
- `channel-partner.html`
- `channel-wechat.html`
- `channel-xiaohongshu.html`
- `compliance-audit-trail.html`
- `compliance-data-governance.html`
- `compliance.html`
- `concept-action-id.html`
- `concept-behavior-id.html`
- `concept-business-value.html`
- `concept-trust.html`
- `concept-verification.html`
- `dashboard.html`
- `dev-openapi.html`
- `dev-schema.html`
- `dev-sdk.html`
- `dev-webhook.html`
- `ecosystem.html`
- `enterprise-revenue-attribution.html`
- `enterprise-roi.html`
- `enterprise.html`
- `faq.html`
- `gate-attribution-verification.html`
- `gateway.html`
- `industry-beauty.html`
- `industry-education.html`
- `industry-highticket.html`
- `industry-local.html`
- `privacy.html`
- `refund.html`
- `sdk.html`
- `security.html`
- `signal-flow.html`
- `start-here.html`
- `terms.html`
- `trust.html`
- `verification-center.html`
- `verification-layer.html`
- `web3/base.html`
- `web3/ethereum.html`
- `web3/solana.html`
- `web3/tx-verification.html`
- `web3/wallet.html`

---

## 问题清单

| # | 问题 | 严重度 | 影响页面数 | 建议 |
|---|------|--------|-----------|------|
| 1 | Description 模板化（全站同一模式） | 🔴 严重 | 70 | 每页撰写独特 description（120-160字符），突出页面独有价值 |
| 2 | Description 长度过短 | 🔴 严重 | 68 | 扩充至 120-160 字符，当前多数仅 30-50 字符 |
| 3 | OG 标签全部缺失 | 🔴 严重 | 70 | 补齐 og:title/description/type/url/image（社交分享必需） |
| 4 | Twitter Card 全部缺失 | 🟡 中等 | 71 | 添加 twitter:card/title/description |
| 5 | Title 高度相似 | 🟡 中等 | 6 | 3 组相似 title 需增加区分度关键词 |
| 6 | 缺少结构化数据 | 🟡 中等 | 70 | 为关键页面添加 JSON-LD（WebSite/BreadcrumbList/Organization） |
| 7 | Canonical 格式 | ✅ 无问题 | 1 | index.html 指向 `/` 是正确的 SEO 实践 |
| 8 | Sitemap 完整性 | ✅ 无问题 | 1 | 404.html 正确排除，70 个有效页面全部收录 |

### 修复优先级

1. 🔴 **P0 紧急**（影响搜索排名和索引）：
   - 重写全站 description，每页独立撰写 120-160 字符的独特描述
   - 为所有 70 个子页面添加完整的 OG 标签

2. 🟡 **P1 重要**（影响社交分享和富摘要）：
   - 添加 Twitter Card 标签
   - 优化 3 组相似 title 增加区分度
   - 为核心页面添加 JSON-LD 结构化数据

3. ✅ **无需修改**：
   - Canonical 标签正确
   - Sitemap 与 robots.txt 配置合理
   - Title 无缺失、无重复

### 当前 SEO 健康评分

| 维度 | 得分 | 说明 |
|------|------|------|
| Title | 85/100 | 无缺失无重复，3 组相似需优化 |
| Description | 20/100 | 全站模板化、长度严重不足 |
| OG/Social | 5/100 | 几乎完全缺失 |
| Sitemap | 95/100 | 完整准确 |
| robots.txt | 95/100 | 配置合理，含 AI 爬虫规则 |
| Canonical | 100/100 | 全部正确 |
| 结构化数据 | 10/100 | 仅首页有 JSON-LD |
| **综合** | **44/100** | Description 和 Social 标签是最大短板 |

---
*报告由 SEO 审计脚本自动生成于 2026-06-18*