# API 与归因链路深度审计报告

**日期**：2026-06-18  
**审计范围**：api.fly-agent.xyz 全路由端到端测试  
**API 基址**：https://api.fly-agent.xyz  
**认证方式**：Authorization: Bearer `<api-key>`（注意：x-api-key header 无效）

---

## 总结

| 维度 | 结果 |
|------|------|
| 端到端归因链路 | ❌ **不通** — 核心写入端点（/v1/action、/v1/signal/verify）全部 500 |
| API 存活 | ⚠️ 部分正常 — 健康检查、Dashboard、Admin Backup 可工作；写入类端点全部故障 |
| 问题总数 | **16**（严重 5 / 高 5 / 中 4 / 低 2） |

---

## 1. 健康检查

**状态**：✅ 正常 (HTTP 200)

```json
{
  "status": "ok",
  "version": "v3.0.0",
  "layers": 5,
  "boundary": "Payment/Clearing — Fly不进入",
  "db": "ok",
  "kv": "ok",
  "bridge": "attribution_payloads",
  "event_sourced": true,
  "timestamp": "2026-06-18T02:20:44.861Z"
}
```

- DB/KV 状态正常
- 响应时间 ~1.0s（偏慢）
- Content-Type: application/json ✅

---

## 2. 端到端链路测试

### Step A - 创建 Action (POST /v1/action)：❌ 失败

**发现的认证问题**：
- 原始规格指定 `x-api-key` header → **无效**，返回 401 `{"error":"missing Authorization header"}`
- 实际需要使用 `Authorization: Bearer <api-key>`

**Schema 探测结果**：
- 必填字段：`signal_type`（白名单：`click`, `impression`）、`channel`（白名单：`douyin`, `xiaohongshu`, `wechat`, `direct` 等）
- 其他 signal_type 值（view, visit, purchase, conversion, signup 等 20+ 种）均返回 400 `invalid signal_type`

**致命错误**：通过验证后，所有请求均返回 HTTP 500：
```json
{"error":"D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'"}
```
这是 Cloudflare D1 数据库绑定错误，说明某个必需字段的值在代码中为 `undefined`，导致 SQL INSERT 失败。**该端点当前完全不可用**。

### Step B - 上报 Signal (POST /v1/signal/verify)：❌ 失败

- 使用有效 action_id → 返回 404 `{"error":"not found"}`（因 Step A 无法创建 action）
- 使用 signal_type + channel 组合 → 同样返回 D1_TYPE_ERROR 500
- **严重安全问题**：该端点**不校验 Authorization header**，无认证即可调用（但因 D1 bug 同样 500）

### Step C - 查询 Verification (POST /v1/verifications)：❌ 失败

- 空 body → 403 `{"error":"verification rejected: verifier cannot be the same as subject (self-verification forbidden)"}`
- 传入不同 verifier/subject 值 → **始终**返回相同的 403 错误
- 使用不同字段名（verifier_id/subject_id, from/to, agent_id/target_id）→ 同样 403
- **结论**：自检逻辑有 bug，端点完全不可用

### Step D - Dashboard (GET /dashboard)：⚠️ 有安全问题

- 状态：✅ 可访问，返回系统统计信息
- **安全问题**：**无需认证**即可访问，任何人可获取系统内部数据

```json
{
  "version": "v3.0.2",
  "db": "ok",
  "kv": "ok",
  "tables": {
    "agents": 46, "actions": 28, "verifications": 7,
    "audit_events": 254, "role_assignments": 5, "policies": 1
  },
  "total_records": 341,
  "latest_activity": {"event":"created","entity":"agent","at":"2026-06-18T01:52:51.686Z"}
}
```

### Step E - Admin Backup (POST /v1/admin/backup)：✅ 正常

- 需认证 ✅
- 成功创建备份：`backup_id: bak_a1e4dd8a-...`，341 records
- 无认证 → 401 ✅

---

## 3. 错误响应格式

### 格式一致性分析

| 端点 | 场景 | HTTP码 | 响应格式 | 一致性 |
|------|------|--------|----------|--------|
| /v1/action | 缺 signal_type | 400 | `{"error":"..."}` | ✅ |
| /v1/action | 缺 channel | 400 | `{"error":"..."}` | ✅ |
| /v1/action | D1 bug | 500 | `{"error":"D1_TYPE_ERROR:..."}` | ❌ 应隐藏内部错误 |
| /v1/action | 无认证 | 401 | `{"error":"missing Authorization header"}` | ✅ |
| /v1/action | 无效 key | 401 | `{"error":"invalid API key"}` | ✅ |
| /v1/action | JSON解析失败 | 500 | `{"error":"Expected property name..."}` | ❌ 应为 400 |
| /v1/signal/verify | 无认证 | 500 | D1_TYPE_ERROR | ❌ 未检查认证 |
| /v1/signal/verify | 无效 action_id | 404 | `{"error":"not found"}` | ✅ |
| /v1/verifications | 空 body | 403 | `{"error":"verification rejected:..."}` | ✅ |
| /v1/admin/backup | 无认证 | 401 | `{"error":"missing Authorization header"}` | ✅ |
| 不存在路由 | 任意 | 404 | `{"error":"not found","hint":"try /v1/health"}` | ✅ |
| 错误HTTP方法 | GET/PUT/DELETE | 404 | 同上 | ⚠️ 应为 405 |

### 问题：
1. **错误格式基本统一** — 全部使用 `{"error":"..."}` 结构，但缺少 `status_code`、`timestamp`、`request_id` 等辅助字段
2. **JSON 解析错误返回 500** 而非 400（泄露内部解析器信息）
3. **D1 内部错误直接暴露**给客户端（应替换为通用 500 消息）
4. **错误方法返回 404** 而非 405 Method Not Allowed

---

## 4. 边界情况

### 4.1 并发请求
- 10 个并发请求全部返回相同 D1 500 错误
- 无崩溃、无超时
- **无速率限制** — 20 个连续请求全部成功响应（HTTP 200 on health）
- ⚠️ 无 Rate Limiting 保护

### 4.2 大 Body（10KB JSON）
- 被接受并处理（未触发 body size 限制）
- 同样返回 D1 500
- ⚠️ 无请求体大小限制

### 4.3 特殊 Content-Type
| Content-Type | 结果 | 问题 |
|---|---|---|
| text/plain | D1 500 | ❌ 未验证 Content-Type |
| application/x-www-form-urlencoded | 500 JSON parse error | ❌ 应返回 415 |
| multipart/form-data | 500 JSON parse error | ❌ 应返回 415 |
| 无 Content-Type | D1 500 | ❌ 未验证 Content-Type |

### 4.4 注入测试
| 测试类型 | 结果 | 评价 |
|---|---|---|
| SQL注入（signal_type） | 400 invalid signal_type | ✅ 白名单拦截 |
| SQL注入（channel） | 400 invalid channel | ✅ 白名单拦截 |
| SQL注入（action_id） | 404 not found | ✅ 参数化查询 |
| XSS（signal_type） | 400 invalid signal_type | ✅ 白名单拦截 |
| XSS（channel） | 400 invalid channel | ✅ 白名单拦截 |
| Null bytes | 500 JSON parse error | ⚠️ 应返回 400 |
| Unicode emoji | D1 500 | ⚠️ 通过验证但 D1 失败 |

### 4.5 CORS 安全
```
access-control-allow-origin: *
access-control-allow-headers: Content-Type, Authorization, X-Fly-Signature, X-Fly-Timestamp
access-control-allow-methods: GET, POST, OPTIONS
```
- ⚠️ `allow-origin: *` 允许任意域名跨域访问
- 暴露自定义 header 名 `X-Fly-Signature, X-Fly-Timestamp`

### 4.6 安全 Header 缺失
- ❌ 无 `Strict-Transport-Security`
- ❌ 无 `X-Content-Type-Options`
- ❌ 无 `X-Frame-Options`
- ❌ 无 `Content-Security-Policy`
- ❌ 无 `X-RateLimit-*` 响应头

---

## 问题清单

| # | 问题 | 严重度 | 复现方式 | 建议 |
|---|------|--------|----------|------|
| 1 | **D1_TYPE_ERROR 导致 /v1/action 完全不可用** | 🔴 严重 | POST /v1/action 带有效 signal_type+channel | 修复 DB schema 与代码的字段映射，确保所有必需列都有值绑定 |
| 2 | **D1_TYPE_ERROR 导致 /v1/signal/verify 完全不可用** | 🔴 严重 | POST /v1/signal/verify 带有效 signal_type+channel | 同上 |
| 3 | **Verifications 端点自检逻辑 bug** | 🔴 严重 | POST /v1/verifications 带不同 verifier/subject | 修复 self-verification 判断逻辑，可能是在提取字段前就做了比较 |
| 4 | **Dashboard 无需认证** | 🔴 严重 | GET /dashboard（不带任何 header） | 添加认证中间件 |
| 5 | **signal/verify 无需认证** | 🔴 严重 | POST /v1/signal/verify（不带 Authorization） | 添加认证中间件 |
| 6 | **CORS allow-origin: * ** | 🟠 高 | 任意 Origin 请求 | 限制为可信域名列表 |
| 7 | **无安全响应 Header** | 🟠 高 | 检查 response headers | 添加 HSTS, X-Content-Type-Options, CSP, X-Frame-Options |
| 8 | **认证方式与文档不一致** | 🟠 高 | 使用 x-api-key header | 更新文档或同时支持两种认证方式 |
| 9 | **JSON 解析错误返回 500** | 🟠 高 | 发送非 JSON body | 应在 JSON 解析阶段捕获并返回 400 |
| 10 | **D1 内部错误直接暴露** | 🟠 高 | 触发 D1 bug | 生产环境应返回通用错误消息，隐藏内部实现细节 |
| 11 | **无速率限制** | 🟡 中 | 20 个连续请求全部成功 | 添加 rate limiting（如 100 req/min per API key） |
| 12 | **无 Content-Type 验证** | 🟡 中 | 发送 text/plain 等非 JSON Content-Type | 非 application/json 应返回 415 |
| 13 | **无请求体大小限制** | 🟡 中 | 发送 10KB+ body | 添加合理上限（如 1KB） |
| 14 | **版本不一致（health v3.0.0 vs dashboard v3.0.2）** | 🟡 中 | 对比两个端点的 version 字段 | 统一版本号来源 |
| 15 | **错误 HTTP 方法返回 404 而非 405** | 🟢 低 | GET /v1/action | 返回 405 Method Not Allowed + Allow header |
| 16 | **响应时间偏慢（~1-2s）** | 🟢 低 | 测量各端点响应时间 | 优化 D1 查询、考虑添加缓存 |

---

## 附录

### A. 认证方式发现

| Header | 结果 |
|--------|------|
| `x-api-key: <key>` | ❌ 401 "missing Authorization header" |
| `Authorization: Bearer <key>` | ✅ 通过认证 |
| `Authorization: ApiKey <key>` | ❌ 401 |
| `X-Fly-Signature` + `X-Fly-Timestamp` | ❌ 401（不替代 Authorization） |
| 无效 key | ❌ 401 "invalid API key" |

### B. 有效枚举值

| 字段 | 有效值 |
|------|--------|
| signal_type | `click`, `impression` |
| channel | `douyin`, `xiaohongshu`, `wechat`, `direct`（可能更多） |

### C. 端点状态汇总

| 端点 | 方法 | 认证 | 状态 | 说明 |
|------|------|------|------|------|
| /v1/health | GET | 不需要 | ✅ 正常 | |
| /v1/action | POST | 需要 | ❌ 500 | D1 bug |
| /v1/signal/verify | POST | **不需要** | ❌ 500 | D1 bug + 无认证 |
| /v1/verifications | POST | 需要 | ❌ 403 | 自检逻辑 bug |
| /dashboard | GET | **不需要** | ⚠️ 正常但无认证 | 信息泄露风险 |
| /v1/admin/backup | POST | 需要 | ✅ 正常 | |

### D. 测试数据标注

所有测试数据均包含 `audit` 标识，便于清理：
- user_agent: `audit-bot`
- page/url: `/test-audit`
- action_id: `test-invalid-123`, `test-001`
- campaign: `audit-campaign`
- 注：因 D1 bug，实际上没有测试数据被成功写入数据库
