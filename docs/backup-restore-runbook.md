# D1 Backup & Restore Runbook

> Fly 数据库备份与恢复标准操作流程
> 
> 创建日期: 2026-06-30
> 最后验证: 2026-06-30（全链路验收通过）

---

## 1. 备份系统架构

```
Production D1
     ↓ (Cloudflare D1 Export API)
SQL 文件 (~450KB)
     ↓ (POST /v1/backup/d1)
Worker Backup API
     ↓ (SHA-256 + KV 存储)
backup:d1:{id} (SQL 内容, 30天 TTL)
backup:d1:meta:{id} (元数据)
backup:d1:latest (最新指针)
     ↓ (审计链)
audit_events (entity_type=backup, action=created)
```

## 2. 自动备份（定时任务）

**触发方式**: Calendar 日程，每天 12:50 执行

**命令**: `wrangler d1 export fly-db --remote --output backup-$(date +%Y%m%d).sql`

**流程**:
1. 触发 D1 Export API（polling 模式）
2. 轮询等待导出完成
3. 下载 SQL 文件
4. POST 到 `/v1/backup/d1`
5. GET `/v1/backup/d1/verify` 验证完整性
6. 提交结果

**成功标准**:
- SQL 大小 > 100 bytes
- 备份 ID 返回（格式 `bak_xxx`）
- 验证返回 `verified: true`

---

## 3. 手动备份验证

### 3.1 验证最新备份完整性

```bash
curl -s "https://api.fly-agent.xyz/v1/backup/d1/verify" \
  -H "Authorization: Bearer fly_demo_key_2026"
```

**预期响应**:
```json
{
  "success": true,
  "verified": true,
  "backup_id": "bak_xxx",
  "stored_hash": "...",
  "computed_hash": "...",
  "sql_size": 450000
}
```

### 3.2 查看备份审计记录

```bash
curl -s "https://api.fly-agent.xyz/v1/db/query?type=audit&sql=SELECT%20*%20FROM%20audit_events%20WHERE%20entity_type%3D'backup'%20ORDER%20BY%20created_at%20DESC%20LIMIT%205" \
  -H "Authorization: Bearer fly_demo_key_2026"
```

---

## 4. 恢复测试（全链路验收）

> **重要**: 恢复测试会创建新的 D1 数据库，产生少量费用。测试完成后必须清理。

### 4.1 导出生产数据库

```bash
CF_TOKEN="cfut_xxx"
ACCOUNT_ID="014fc3114b2e2befeac9aaaf08a09a5b"
D1_ID="71a75dc8-76c5-4563-bf6f-0aa47f76ff95"
EXPORT_URL="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${D1_ID}/export"

# 触发导出
curl -s -X POST "$EXPORT_URL" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"output_format":"polling"}'

# 记录返回的 bookmark
BOOKMARK="xxx"

# 轮询等待完成
curl -s -X POST "$EXPORT_URL" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"output_format\":\"polling\",\"current_bookmark\":\"${BOOKMARK}\"}"

# 从返回的 signed_url 下载 SQL
curl -s -o /tmp/prod-backup.sql "$SIGNED_URL"
```

### 4.2 创建测试 D1

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"fly-test-restore-YYYYMMDD"}'

# 记录返回的 TEST_D1_ID
```

### 4.3 导入 SQL 到测试 D1

```bash
# 创建 JSON 请求文件
jq -n --rawfile sql /tmp/prod-backup.sql '{"sql": $sql}' > /tmp/restore-request.json

# 执行导入
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${TEST_D1_ID}/query" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @/tmp/restore-request.json
```

**注意**: 可能会报 "table xxx already exists"，这是因为部分语句已成功执行，可忽略。

### 4.4 数据对比验收

**检查表结构**:
```bash
curl -s -X POST ".../query" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT name FROM sqlite_master WHERE type=\"table\" ORDER BY name"}'
```

**对比数据量**:

| 表名 | 生产 D1 预期 | 测试 D1 实际 |
|------|--------------|--------------|
| agents | ~68 | ? |
| actions | ~45 | ? |
| audit_events | ~350+ | ? |
| verifications | ~27 | ? |
| trust_records | ~3 | ? |

**抽查关键数据**:
```bash
# 最新审计记录
curl -s -X POST ".../query" \
  -d '{"sql": "SELECT event_id, entity_type, action FROM audit_events ORDER BY created_at DESC LIMIT 1"}'
```

### 4.5 清理测试环境

```bash
curl -s -X DELETE "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${TEST_D1_ID}" \
  -H "Authorization: Bearer ${CF_TOKEN}"
```

---

## 5. 常见失败场景

| 现象 | 原因 | 解决方案 |
|------|------|----------|
| POST /v1/backup/d1 返回 404 | Worker 未部署或路由错误 | 检查 Worker 部署状态，确认路由配置 |
| 备份验证 verified=false | SQL 内容被篡改或存储损坏 | 重新执行备份，检查 KV 存储 |
| 恢复后数据量不一致 | SQL 导入中断或表结构问题 | 检查导入日志，重新创建测试 D1 |
| 审计链无 backup 记录 | writeAuditEvent 未调用 | 检查 Worker 代码，确认审计链集成 |
| 恢复测试费用过高 | 测试 D1 未清理 | 立即删除测试 D1 |

---

## 6. 关键配置

### Cloudflare

- Account ID: `014fc3114b2e2befeac9aaaf08a09a5b`
- Production D1 ID: `71a75dc8-76c5-4563-bf6f-0aa47f76ff95`
- KV Namespace ID: `fea93561708c4272886554d83e546922`
- API Token: 需 Workers 管理权限 + D1 编辑权限

### Worker API

- Health: `GET https://api.fly-agent.xyz/v1/health`
- Backup Store: `POST https://api.fly-agent.xyz/v1/backup/d1`
- Backup Verify: `GET https://api.fly-agent.xyz/v1/backup/d1/verify`
- API Key: `fly_demo_key_2026`

### 审计链

- entity_type: `backup`（新规范，2026-06-30 起）
- 历史兼容: `d1_backup`（旧记录保留，不迁移）
- 查询: `WHERE entity_type IN ('backup', 'd1_backup')`

---

## 7. 治理决策记录

### 2026-06-30: entity_type 统一

- **决策**: `entity_type=backup` 为正式规范
- **历史兼容**: `d1_backup` 保留不迁移
- **原因**: 哈希链不可篡改优先于命名一致性
- **影响**: 查询需兼容两种值

### 2026-06-30: Backup API 独立

- **决策**: `/v1/backup/*` 作为独立备份服务，与 `/v1/admin/*` 管理接口职责分离
- **原因**: 语义不同，避免未来扩展时互相影响
- **影响**: 新增备份类型（KV/R2）直接扩展 `/v1/backup/` 路径

---

## 8. 验收检查清单

恢复测试完成后，确认以下项目：

- [ ] SQL 文件大小合理（>100KB）
- [ ] 备份 ID 返回（格式 `bak_xxx`）
- [ ] 哈希验证通过（`verified: true`）
- [ ] 测试 D1 创建成功
- [ ] 23 个表全部存在
- [ ] 各表数据量与生产一致
- [ ] 抽查数据内容正确
- [ ] 审计链有 `entity_type=backup` 记录
- [ ] 测试 D1 已清理

---

*本文档由 2026-06-30 恢复测试验收生成，作为后续运维参考。*
