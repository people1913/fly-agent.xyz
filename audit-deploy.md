# 部署与版本深度审计报告

**日期**：2026-06-18 10:20 UTC+8  
**审计范围**：Pages 部署、Worker 版本、导航版本号、缓存策略、CI/CD、DNS、SSL  
**仓库**：people1913/fly-agent.xyz (commit `ef97c9a`)  
**审计性质**：只读检查，未修改任何配置

---

## 总结

| 维度 | 状态 | 说明 |
|------|------|------|
| Pages 部署 | ✅ 正常 | 最新构建成功，与仓库 HEAD 一致 |
| Worker 路由一致性 | ✅ 一致 | 线上 fly-api 路由与仓库完全匹配 |
| Worker 版本号 | ⚠️ 混乱 | 4 处版本号标识不一致（v3.0.0 / v3.0.2 / 3.0.1 / v2.9.0） |
| 导航版本号 | ✅ 统一 | 69 个文件统一使用 `?v=20260616h` |
| 缓存策略 | ❌ 异常 | `_headers` 文件完全不生效 |
| CI/CD | ✅ 正常 | deploy.yml + fly-monitor.yml 配置合理 |
| DNS | ✅ 正常 | Pages→GitHub, API→Cloudflare |
| SSL | ✅ 有效 | 两域名证书均在有效期内 |
| fly-api-production | ⚠️ 落后 | 版本 2.11.0，比 fly-api (v3.0.0) 落后 |

**问题数**：6（1 个严重、2 个中等、3 个低）

---

## 1. Pages 部署

### 1.1 部署状态

| 项目 | 值 |
|------|-----|
| 状态 | `built`（正常） |
| CNAME | `fly-agent.xyz` |
| 构建类型 | `legacy`（GitHub 内置构建，非 Actions） |
| 来源分支 | `main`，路径 `/` |
| 域名验证 | `verified` |
| HTTPS 强制 | ✅ 是 |
| 证书到期 | **2026-08-22**（距今 65 天） |
| 证书覆盖域 | `fly-agent.xyz`, `www.fly-agent.xyz` |
| 自定义 404 | ✅ 有 |

### 1.2 最近构建记录

| # | 时间 (UTC) | 状态 | Commit | 耗时 |
|---|-----------|------|--------|------|
| 1 | 2026-06-17 13:14:16 | ✅ built | `ef97c9a` | 8s |
| 2 | 2026-06-17 13:14:08 | ❌ errored | `ef80e43` | 0s |
| 3 | 2026-06-17 13:13:52 | ❌ errored | `e57fc6e` | 0s |
| 4 | 2026-06-17 13:13:48 | ❌ errored | `731251b` | 0s |
| 5 | 2026-06-17 13:13:45 | ❌ errored | `75e9970` | 0s |

**分析**：最近一次 push 触发了 5 次构建，前 4 次失败（duration=0，快速 push 导致旧构建取消），最后一次成功。当前线上版本与仓库 HEAD `ef97c9a` 完全一致。

### 1.3 页面统计

| 项目 | 值 |
|------|-----|
| HTML 文件总数 | 71 |
| 使用 nav-shared.js | 69 个文件 |
| 不使用 nav-shared.js | 2 个（`index.html`, `404.html`）— 设计如此 |

---

## 2. Worker 版本

### 2.1 线上 Worker 列表

| Worker 名称 | 最后修改 | 版本标识 | 备注 |
|-------------|---------|---------|------|
| `fly-api` | 2026-06-17 12:42:59 UTC | v3.0.0 | 主 API，绑定 api.fly-agent.xyz |
| `fly-api-production` | 2026-06-14 05:53:49 UTC | 2.11.0 | 旧版本，4天前 |
| `fly-coze-token` | 2026-06-14 08:47:35 UTC | - | 独立用途 |

### 2.2 fly-api 路由一致性 ✅

**线上路由与仓库路由 100% 匹配**，共 19 个精确路由 + 10 个前缀路由：

**精确路由（19个）**：
```
/attribution/ingest    /attribution/list    /attribution/settlements
/dashboard    /internal/trigger-queue
/v1/action    /v1/admin/alert/test    /v1/admin/backup    /v1/admin/kv    /v1/admin/metrics
/v1/agents    /v1/audit/verify-chain    /v1/db/query
/v1/governance/assign-role    /v1/governance/check-permission    /v1/governance/update-policy
/v1/health    /v1/signal/verify    /v1/verifications
```

**前缀路由（10个）**：
```
/attribution/replay/*    /attribution/settle/*    /attribution/settlement/*
/attribution/shadow/*    /attribution/status/*    /attribution/verify/*
/s/*    /v1/agents/*    /v1/audit/*    /v1/status/*
```

### 2.3 Worker 绑定

| 绑定名 | 类型 | 说明 |
|--------|------|------|
| FLY_D1 | D1 | fly-db (71a75dc8-76c5-4563-bf6f-0aa47f76ff95) |
| FLY_KV | KV | fea93561708c4272886554d83e546922 |
| ALERT_EMAIL_TO | Secret | 告警邮箱 |
| API_KEYS | Secret | API 密钥 |
| FLY_API_KEY | Secret | Fly API Key |
| GITHUB_TOKEN | Secret | GitHub Token |
| RESEND_API_KEY | Secret | 邮件服务 |
| TELEGRAM_BOT_TOKEN | Secret | Telegram Bot |
| TELEGRAM_CHAT_ID | Secret | Telegram Chat |

### 2.4 健康检查

```json
{
    "status": "ok",
    "version": "v3.0.0",
    "layers": 5,
    "boundary": "Payment/Clearing — Fly不进入",
    "db": "ok",
    "kv": "ok",
    "bridge": "attribution_payloads",
    "event_sourced": true
}
```

D1 数据库大小：573,440 bytes (~560KB)，容量充足。

### 2.5 fly-api vs fly-api-production 差异

| 对比项 | fly-api | fly-api-production |
|--------|---------|-------------------|
| 最后部署 | 06-17 12:42 UTC | 06-14 05:53 UTC |
| 代码大小 | 103 KB | 70 KB |
| 健康版本 | v3.0.0 | 2.11.0 |
| Attribution 路由 | 9 个（含 replay/settle/shadow 等） | 3 个（仅 ingest/list/status） |
| Admin 路由 | ✅ 有 4 个 | ❌ 无 |
| Signal/Verify | ✅ 有 | ❌ 无 |

---

## 3. 导航版本号

### 3.1 版本号统一性 ✅

所有 69 个使用 `nav-shared.js` 的 HTML 文件均引用 `?v=20260616h`，完全统一。

### 3.2 版本号格式

- 格式：`YYYYMMDD` + 可选字母后缀（如 `h`）
- 当前值：`20260616h`
- 引用位置：`<script src="/nav-shared.js?v=20260616h"></script>`

### 3.3 不使用 nav-shared 的页面

| 页面 | 原因 |
|------|------|
| `index.html` | 独立首页，有自己的 header/nav 实现 |
| `404.html` | 错误页，无导航需求 |

---

## 4. 缓存策略

### 4.1 _headers 文件 ❌ 不生效

仓库中存在 `_headers` 文件，意图为所有页面设置 `no-cache, no-store, must-revalidate`：

```
/
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
/*.html
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
```

**但实际响应头显示缓存策略与 _headers 完全矛盾**：

| 资源 | 实际 cache-control | 实际 expires |
|------|-------------------|-------------|
| `/`（index.html） | `max-age=600` | Wed, 17 Jun 2026 23:49:40 GMT |
| `/signal-flow.html` | `max-age=600` | Thu, 18 Jun 2026 02:02:39 GMT |
| `/nav-shared.js?v=20260616h` | `max-age=600` | Thu, 18 Jun 2026 02:32:01 GMT |

**根因**：Pages `build_type` 为 `legacy`（GitHub 内置构建），**`_headers` 文件仅在 `workflow` 构建模式下生效**。legacy 模式下 `_headers` 和 `_redirects` 文件均被 GitHub 忽略。

**影响**：
- HTML 页面被 Fastly CDN 缓存 10 分钟（max-age=600）
- nav-shared.js 也被缓存 10 分钟
- 用户更新内容后，最坏情况需等待 10 分钟才能看到
- 当前靠 `?v=20260616h` 版本号参数**部分缓解**（浏览器因 URL 变化会重新请求 JS）
- 但 HTML 页面本身仍会被缓存，新页面/改名的链接在 10 分钟内可能 404

### 4.2 API 缓存

API (`api.fly-agent.xyz`) 由 Cloudflare 默认处理，响应头无 cache-control，行为正确（DYNAMIC）。

---

## 5. CI/CD

### 5.1 deploy.yml（Worker 部署）

| 项目 | 配置 |
|------|------|
| 触发条件 | push 到 main，路径 `worker/src/index.ts`, `worker/wrangler.jsonc`, `worker/package.json` |
| 手动触发 | ✅ 支持 workflow_dispatch |
| 部署方式 | `cloudflare/wrangler-action@v3` |
| Node 版本 | 20 |

### 5.2 fly-monitor.yml（健康监控）

| 项目 | 配置 |
|------|------|
| 触发方式 | `repository_dispatch: cf_cron_trigger` + push to main |
| 检查项 | health probe (HTTP 200) + short-link probe |
| 依赖检查 | D1 capacity + KV capacity |
| 失败通知 | ✅ 有 notify-failure job（条件触发） |

**评价**：CI/CD 配置合理。Worker 部署自动化，监控覆盖核心端点。注意 `fly-monitor.yml` 的 cron 触发依赖外部 `repository_dispatch`，非 GitHub 原生 cron。

---

## 6. DNS

| 域名 | 类型 | 值 | 指向 | 状态 |
|------|------|-----|------|------|
| `fly-agent.xyz` | A | 185.199.108-111.153 | GitHub Pages | ✅ |
| `api.fly-agent.xyz` | A | 172.67.172.13, 104.21.63.218 | Cloudflare Proxy | ✅ |
| `www.fly-agent.xyz` | - | Pages 自动管理 | GitHub Pages | ✅ |

---

## 7. SSL

| 域名 | 签发机构 | 生效日期 | 到期日期 | 剩余 | 状态 |
|------|---------|---------|---------|------|------|
| `fly-agent.xyz` | Let's Encrypt R12 | 2026-05-23 | **2026-08-22** | 65天 | ✅ |
| `api.fly-agent.xyz` | Google Trust Services WE1 | 2026-06-08 | **2026-09-06** | 80天 | ✅ |

---

## 8. 版本号一致性详细分析

### 8.1 仓库内的版本号分布（4 处不一致）

| 位置 | 版本号 | 用途 |
|------|--------|------|
| `worker/package.json` | `3.0.1` | npm 包版本（仅供标识） |
| `worker/src/index.ts:1078` | `v3.0.0` | `/v1/health` 响应 |
| `worker/src/index.ts:1235` | `v3.0.2` | debug/admin 端点版本 |
| `worker/src/index.ts:1379` | `v2.9.0` | 告警测试硬编码（遗留） |

### 8.2 线上 vs 仓库

| 对比项 | 线上 | 仓库 | 一致？ |
|--------|------|------|--------|
| /v1/health version | v3.0.0 | v3.0.0 | ✅ |
| 路由定义 | 19 精确 + 10 前缀 | 19 精确 + 10 前缀 | ✅ |
| 代码大小 | 103 KB | 源码 → 编译后一致 | ✅ |

---

## 问题清单

| # | 问题 | 严重度 | 详情 | 建议 |
|---|------|--------|------|------|
| 1 | **`_headers` 文件完全不生效** | 🔴 高 | legacy 构建模式不支持 `_headers`。实际 HTML/JS 缓存 max-age=600（10分钟），与预期的 no-cache 完全矛盾 | **方案A（推荐）**：迁移 Pages 到 GitHub Actions 部署（workflow 模式），`_headers` 即可生效<br>**方案B**：在每个 HTML 的 `<head>` 中添加 `<meta http-equiv="Cache-Control" content="no-cache">` 作为兜底<br>**方案C**：接受 10 分钟缓存，依赖 `?v=` 参数解决 JS 更新 |
| 2 | **Worker 内部版本号混乱** | 🟡 中 | health=v3.0.0, debug=v3.0.2, alert=v2.9.0, package.json=3.0.1，四处不同版本 | 统一为单一版本源（如从 package.json 或常量读取），避免多处硬编码 |
| 3 | **fly-api-production 版本严重落后** | 🟡 中 | 版本 2.11.0，缺少 6 个 attribution 路由和 4 个 admin 路由，代码量少 33KB | 如果不再使用，应删除或标记 deprecated；如果仍需使用，应重新部署 |
| 4 | package.json 存在 UTF-8 BOM | 🟢 低 | `worker/package.json` 含 BOM 头，可能导致某些工具解析失败 | `sed -i '1s/^\xEF\xBB\xBF//' worker/package.json` |
| 5 | 构建失败率 80%（4/5） | 🟢 低 | 快速连续 push 导致旧构建取消，最终构建成功 | 非实质性问题；可考虑在 workflow 中加 concurrency 控制 |
| 6 | 证书到期提醒 | 🟢 低 | fly-agent.xyz 证书 65 天后到期 | Pages 证书自动续期，无需手动操作 |

---

## 附录

### A. 仓库最新 commit

```
ef97c9a  2026-06-17 21:14:06 +0800
统一 topbar 样式：去掉 border-bottom，padding 对齐内容区 32px — verification-layer.html
```

### B. Worker 关键配置

```
Name: fly-api
D1: fly-db (71a75dc8-76c5-4563-bf6f-0aa47f76ff95)
KV: fea93561708c4272886554d83e546922
Route: api.fly-agent.xyz/*
Cron: */5 * * * *
Compatibility: 2024-12-01 + nodejs_compat
```

### C. 实际缓存响应头

```
# fly-agent.xyz/ (GitHub Pages via Fastly)
HTTP/2 200
cache-control: max-age=600
etag: "6a329e34-54af"
last-modified: Wed, 17 Jun 2026 13:16:36 GMT
x-cache: HIT
server: GitHub.com
via: 1.1 varnish

# api.fly-agent.xyz/v1/health (Cloudflare Workers)
HTTP/2 200
server: cloudflare
cf-cache-status: DYNAMIC
access-control-allow-origin: *
```

---

*报告生成时间：2026-06-18 10:25 UTC+8*
*审计工具：GitHub API, Cloudflare API, curl, dig, openssl*
