# Fly 官网网站结构图

> 审计时间：只读审计，未修改任何文件
> 基于 `nav-shared.js` (v25) 及 66 个 HTML 文件分析

---

## 信息架构概览

nav-shared.js 定义了 **9 个导航分组**，共 **56 个可点击条目**（含 2 个子标签分隔符），映射 **56 个导航链接**（其中 `/` 指向 index.html）。

---

## 树形结构

```
fly-agent.xyz
│
├── 🏠 首页 (index.html)
│   └── 独立单页架构：无侧边栏，自有header+CSS，Landing Page
│
├── 📦 1. 核心概念 (#1A3D2E 深绿) [默认展开]
│   ├── / → index.html .................. Fly概念（首页）
│   ├── /concept-behavior-id.html ....... Behavior ID（行为身份标识）
│   ├── /concept-action-id.html ......... Action ID（动作标识）
│   ├── /concept-verification.html ...... Verification（验证）
│   ├── /concept-trust.html ............. Trust（信任）
│   ├── /concept-business-value.html .... Business Value（商业价值）
│   └── /faq.html ....................... 常见问题
│
├── 🛡️ 2. 验证体系 (#059669 绿色) [默认展开]
│   ├── /verification-layer.html ........ Gate 1 数据完整性验证
│   ├── /audit.html ..................... Gate 2 安全策略验证
│   ├── /trust.html ..................... Gate 3 归因链验证
│   ├── /dashboard.html ................. Gate 4 部署验证
│   ├── /gateway.html ................... Gate 5 构建验证
│   └── /security.html .................. Gate 6 健康验证
│
├── 🤖 3. AI Native (#7C3AED 紫色) [默认展开]
│   ├── /agent-registry.html ............ Agent Registry（Agent注册中心）
│   ├── /bot.html ....................... Agent Identity（Agent身份）
│   ├── /ai-skills.html ................. Agent Trust（Agent信任）
│   └── /sdk.html ....................... Agent Revenue（Agent收入）
│
├── 🧠 4. AI Platforms (#6366F1 靛蓝) [默认收起]
│   ├── /ai-platforms/chatgpt.html ...... ChatGPT
│   ├── /ai-platforms/claude.html ....... Claude
│   ├── /ai-platforms/gemini.html ....... Gemini
│   ├── /ai-platforms/perplexity.html ... Perplexity
│   ├── /ai-platforms/coze.html ......... Coze
│   ├── /ai-platforms/dify.html ......... Dify
│   ├── /ai-platforms/fastgpt.html ...... FastGPT
│   ├── /ai-platforms/red-skill.html .... 小红书 Skill
│   └── /ai-platforms/wechat-agent.html . 微信 Agent
│
├── 🏢 5. 企业 (#0891B2 青色)
│   ├── /enterprise.html ................ Enterprise（企业版）
│   ├── /cases.html ..................... Cases（案例）
│   ├── /enterprise-revenue-attribution.html  Revenue Attribution
│   └── /enterprise-roi.html ............ ROI Measurement
│
├── ⛓️ 6. Web3 (#475569 青灰) [默认收起]
│   ├── /web3/wallet.html ............... Wallet ID（钱包身份）
│   └── /web3/tx-verification.html ...... Onchain Verification（链上验证）
│   │
│   ├── ⚠️ 未被导航引用的Web3页面：
│   │   ├── /web3/base.html ............. Base L2 链上归因
│   │   ├── /web3/ethereum.html ......... Ethereum 链上归因
│   │   └── /web3/solana.html ........... Solana 链上归因
│
├── 🔧 7. 开发者 (#EA580C 橙色) [默认收起]
│   ├── /signal-flow.html ............... Signal Flow（信号流）
│   ├── /api-reference.html ............. API Reference
│   ├── /dev-sdk.html ................... SDK
│   ├── /dev-webhook.html ............... Webhook
│   ├── /dev-schema.html ................ Schema
│   ├── /dev-openapi.html ............... OpenAPI
│   └── /ecosystem.html ................. Ecosystem（生态）
│
├── 📋 8. 合规 (#64748B 灰色)
│   ├── /compliance.html ................ Compliance（合规总览）
│   ├── /compliance-audit-trail.html .... Audit Trail（审计追踪）
│   ├── /compliance-data-governance.html  Data Governance（数据治理）
│   ├── /privacy.html ................... Privacy（隐私政策）
│   └── /terms.html ..................... Terms（服务条款）
│
├── 📡 9. 渠道 (#D97706 暖黄)
│   ├── ── 平台渠道 ──
│   │   ├── /channel-douyin.html ........ 抖音
│   │   ├── /channel-xiaohongshu.html ... 小红书
│   │   ├── /channel-wechat.html ........ 微信
│   │   ├── /channel-meituan.html ....... 美团
│   │   ├── /channel-feishu.html ........ 飞书
│   │   ├── /channel-coze.html .......... Coze
│   │   └── /channel-ai-search.html ..... AI搜索
│   │
│   └── ── 合作生态 ──
│       ├── /channel-partner.html ....... Partner
│       ├── /channel-affiliate.html ..... Affiliate
│       ├── /channel-marketplace.html ... Marketplace
│       ├── /channel-integration.html ... Integration
│       └── /channel-distribution.html .. Distribution
│
├── ⚠️ 10. 未被导航引用的页面（孤立页面）
│   ├── 404.html ........................ 404错误页（预期孤立）
│   ├── channel-clawhub.html ............ ClawHub渠道归因
│   ├── channel-other.html .............. 其他渠道归因
│   ├── contract-test.html .............. 合同测试页（空壳）
│   ├── deploy-e2e-test-0610.html ....... E2E部署测试页（测试用）
│   ├── industry-beauty.html ............ 美妆行业方案
│   └── industry-highticket.html ........ 高客单价行业方案
│
└── 🔒 基础设施文件
    ├── nav-shared.js ................... 共享侧边栏（v25）
    └── worker/ ......................... Cloudflare Worker（后端）
```

---

## 核心概念关系

```
Behavior ID ──→ Action ID ──→ Verification ──→ Trust ──→ Business Value
    │               │              │               │             │
    └── 行为身份 ────→ 动作标识 ──→ 验证层 ─────→ 信任层 ──→ 商业价值
```

## 验证体系层级

```
Gate 1 (数据完整性) → Gate 2 (安全策略) → Gate 3 (归因链)
                                              ↓
Gate 6 (健康验证) ← Gate 5 (构建验证) ← Gate 4 (部署验证)
```

## 页面架构类型

| 类型 | 文件数 | 说明 |
|------|--------|------|
| 独立单页 | 1 | index.html：自有header/CSS/JS，无侧边栏 |
| 侧边栏布局 | 60 | 加载nav-shared.js，统一侧边栏+内容区 |
| 无导航页 | 5 | 404.html / contract-test / deploy-e2e-test / index.html |
