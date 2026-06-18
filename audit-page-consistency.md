# 页面一致性深度审计报告
日期：2026-06-18

## 总结
- **总页面数**：71（含 index.html、404.html 两个特殊页面）
- **常规页面数**：69（排除 index.html 和 404.html）
- **基准页面**：signal-flow.html（定版基准）
- **一致项**：2
- **不一致项**：4
  - Topbar CSS 差异（6 页）
  - Footer 缺失（68 页）
  - CSS 变量差异（4 个变量）
  - 字体引入不一致（3 种模式）

| 审计项 | 状态 | 详情 |
|--------|------|------|
| Topbar CSS | ❌ 6页差异 | 基准: height:52px; padding:0 32px; 无border-bottom |
| Sidebar | ✅ 全部引入 | 通过 nav-shared.js 统一渲染 |
| Footer | ❌ 68页缺失 | 仅 compliance.html 有 footer |
| CSS :root 变量 | ❌ 4个变量有差异 | 详见第4节 |
| 导航链接 | ✅ 无死链 | 有效链接 50 个 |
| 字体引入 | ❌ 3种模式 | 详见第6节 |

## 1. Topbar 一致性

### 基准（signal-flow.html）
```css
.topbar { height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; flex-shrink: 0 }
```
- Topbar HTML 结构：`<h1>Signal Flow 信号流</h1>`

### ❌ CSS 差异（6 个页面）

- **verification-center.html**
  ```
  无 .topbar CSS 定义
  ```
- **web3/base.html**
  ```
  无 .topbar CSS 定义
  ```
- **web3/ethereum.html**
  ```
  无 .topbar CSS 定义
  ```
- **web3/solana.html**
  ```
  无 .topbar CSS 定义
  ```
- **web3/tx-verification.html**
  ```
  无 .topbar CSS 定义
  ```
- **web3/wallet.html**
  ```
  无 .topbar CSS 定义
  ```

## 2. Sidebar 一致性

侧边栏通过 `nav-shared.js` 统一渲染，所有页面共享同一份导航数据结构。

✅ 所有 69 个常规页面均引入了 nav-shared.js。

### nav-shared.js 导航数据
- 导航分组：5 组
  - Identity 身份层
  - Trust 信任层
  - Verification 验证层
  - Attribution 归因层
  - Governance 治理层
- 总导航链接数：50

## 3. Footer 一致性

### 有 footer 的页面

- 内容：`<div class="container">© 2026 杭州九运智领科技 · Fly · AI Agent信任与归因基础设施</div>`
  - 共 1 页：compliance.html

### ❌ 无 footer 的常规页面（68 个）

- action-id.html
- agent-registry.html
- ai-platforms/chatgpt.html
- ai-platforms/claude.html
- ai-platforms/coze.html
- ai-platforms/dify.html
- ai-platforms/fastgpt.html
- ai-platforms/gemini.html
- ai-platforms/perplexity.html
- ai-platforms/red-skill.html
- ai-platforms/wechat-agent.html
- ai-skills.html
- api-reference.html
- audit.html
- bot.html
- cases.html
- channel-affiliate.html
- channel-ai-search.html
- channel-clawhub.html
- channel-coze.html
- channel-distribution.html
- channel-douyin.html
- channel-feishu.html
- channel-integration.html
- channel-marketplace.html
- channel-meituan.html
- channel-other.html
- channel-partner.html
- channel-wechat.html
- channel-xiaohongshu.html
- compliance-audit-trail.html
- compliance-data-governance.html
- concept-action-id.html
- concept-behavior-id.html
- concept-business-value.html
- concept-trust.html
- concept-verification.html
- dashboard.html
- dev-openapi.html
- dev-schema.html
- dev-sdk.html
- dev-webhook.html
- ecosystem.html
- enterprise-revenue-attribution.html
- enterprise-roi.html
- enterprise.html
- faq.html
- gate-attribution-verification.html
- gateway.html
- industry-beauty.html
- industry-education.html
- industry-highticket.html
- industry-local.html
- privacy.html
- refund.html
- sdk.html
- security.html
- signal-flow.html
- start-here.html
- terms.html
- trust.html
- verification-center.html
- verification-layer.html
- web3/base.html
- web3/ethereum.html
- web3/solana.html
- web3/tx-verification.html
- web3/wallet.html

## 4. CSS 变量一致性

共发现 **22** 个 CSS 变量。

### ❌ 存在差异的变量（4 个，仅统计常规页面）

#### `--bg`（2 种值）

- `#fff` → 63 页（多数页面）
- `#FFFFFF` → 1 页: verification-center.html

#### `--bg3`（2 种值）

- `#F1F5F9` → 63 页（多数页面）
- `#F4F6F8` → 1 页: verification-center.html

#### `--text3`（2 种值）

- `#64748B` → 63 页（多数页面）
- `#2563EB` → 1 页: verification-center.html

#### `--text4`（2 种值）

- `#94A3B8` → 63 页（多数页面）
- `#60A5FA` → 1 页: verification-center.html

### 全部变量列表（22 个）
`--bg`, `--bg2`, `--bg3`, `--bg4`, `--blue`, `--blue-light`, `--border`, `--dark`, `--deep-green`, `--mint`, `--mint-border`, `--mono`, `--nav-w`, `--nav-w-c`, `--sans`, `--sidebar-w`, `--tan`, `--tan-light`, `--text`, `--text2`, `--text3`, `--text4`

## 5. 导航链接可达性

- 有效内部链接：50 个
- 死链：0 个

✅ 所有内部导航链接均指向真实存在的页面，无死链。

## 6. JS/CSS 引入一致性

### 外部 JS 引入

- `/nav-shared.js?v=20260616h` → 69 页
- `<无外部JS>` → 2 页: 404.html, index.html

### Google Fonts 引入（常规页面）

- `Inter, Noto Sans SC` → 50 页
- `Inter, JetBrains Mono, Noto Sans SC` → 14 页
- **无字体导入** → 5 页: web3/base.html, web3/ethereum.html, web3/solana.html, web3/tx-verification.html, web3/wallet.html

### ❌ 字体引入不一致分析

**主要差异点 — JetBrains Mono 字体：**
- 包含 `JetBrains Mono` 的页面：14 个
  - action-id.html, channel-clawhub.html, channel-other.html, compliance.html, concept-behavior-id.html, faq.html, industry-beauty.html, industry-education.html, industry-highticket.html, industry-local.html, signal-flow.html, start-here.html, trust.html, verification-center.html
- 不包含 `JetBrains Mono` 的页面：50 个
  - agent-registry.html, ai-platforms/chatgpt.html, ai-platforms/claude.html, ai-platforms/coze.html, ai-platforms/dify.html, ai-platforms/fastgpt.html, ai-platforms/gemini.html, ai-platforms/perplexity.html, ai-platforms/red-skill.html, ai-platforms/wechat-agent.html, ai-skills.html, api-reference.html, audit.html, bot.html, cases.html...
- 完全无字体导入的页面：5 个
  - web3/base.html, web3/ethereum.html, web3/solana.html, web3/tx-verification.html, web3/wallet.html

**影响**：缺少 JetBrains Mono 的页面无法正确渲染 `var(--mono)` 字体（代码块等），建议统一引入包含 JetBrains Mono 的字体组合。

## 问题清单

| # | 问题 | 严重度 | 影响页面数 | 建议 |
|---|------|--------|-----------|------|
| 1 | Topbar CSS 与基准不一致 | 🔴 高 | 6 | 统一为基准 `.topbar { height:52px; padding:0 32px; ... }`，无 border-bottom |
| 2 | 缺少 footer | 🟡 中 | 68 | 添加统一 footer（参考 compliance.html） |
| 3 | CSS 变量 `--bg` 有 2 种值 | 🟡 中 | 1 页偏离 | 统一为多数值 `#fff` |
| 4 | CSS 变量 `--bg3` 有 2 种值 | 🟡 中 | 1 页偏离 | 统一为多数值 `#F1F5F9` |
| 5 | CSS 变量 `--text3` 有 2 种值 | 🟡 中 | 1 页偏离 | 统一为多数值 `#64748B` |
| 6 | CSS 变量 `--text4` 有 2 种值 | 🟡 中 | 1 页偏离 | 统一为多数值 `#94A3B8` |
| 7 | Google Fonts 引入不一致 | 🟡 中 | 55 页缺少 JetBrains Mono | 统一引入含 JetBrains Mono 的字体组合 |

## 附录：特殊页面说明

- **index.html**：首页，使用完全不同的布局（无 sidebar、无 topbar、有固定 header 导航和 footer），属于独立设计，不纳入一致性对比。
- **404.html**：错误页，无 sidebar、无 topbar、无 footer，使用独立样式，属于特殊页面，不纳入一致性对比。

---
*报告由 audit_consistency.py 自动生成，仅审计不修改任何代码。*
