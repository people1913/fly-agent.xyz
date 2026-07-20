# 数据库拓扑 · 2026-07-20

Fly 的数据分**线上服务层**（Cloudflare，支撑 api.fly-agent.xyz）与**生产线层**（本地，Trust Record 生产线，私有）两部分。

## 1. 线上服务层（Cloudflare）

绑定关系见 worker/wrangler.toml：

| 绑定名 | 类型 | 资源 | 说明 |
|---|---|---|---|
| FLY_D1 | D1 | fly-db (id: 71a75dc8-76c5-4563-bf6f-0aa47f76ff95) | 归因记录主库 |
| FLY_KV | KV | — | 缓存/状态 |

### D1 主要表（worker 实际查询）

- `verifications` — 归因验证记录（/v1/verify 写入，/v1/records/recent 读取）
- `actions` — 行为记录（records/recent 通过 LEFT JOIN 取 channel / signal_type / meta）

无鉴权读路径：GET /v1/records/recent（直接 SELECT）。
写路径：POST /v1/verify（当前无鉴权，见 ALIGNMENT-2026-07-20.md §7）。

备份：`wrangler d1 export fly-db --remote --output backup-$(date +%Y%m%d).sql`（详见 backup-restore-runbook.md）。

## 2. 生产线层（本地，私有，不入本仓）

Trust Record 的生产环境，位于私有部署目录：

| 组件 | 说明 |
|---|---|
| fly.db（SQLite） | Trust Record 链本地主库，append-only |
| fly-db/evidence/ | 原始证据文件（SHA-256 入链） |
| fly-registry/ | Trust Record 生产输出（ctrs-conformance-tests 的测试对象） |
| generators / capture 脚本 | capture_* 流程，生成 Trust Record 后过 canonical validator |

已产出：Trust Record #001（修正版，chain_2fa59565aea3d0c6，10/10 PASS）。

**纪律**：生产线数据含真实商家证据与个人信息，**永不推送到公开仓库**；计划迁入独立 PRIVATE 仓库（决策点⑥）。

## 3. 一致性规则

1. 线上 D1 是**服务查询层**；Trust Record 的**权威源**是生产线 fly.db 链。
2. 任何写入 D1 的代码变更须先确认与 /v1/verify 两个分支（CTRS v1.2 / 旧格式）的 schema 兼容。
3. 线上健康探针只依赖 /v1/health 的 version + db=ok/kv=ok（见 监控告警体系设计方案.md）。
