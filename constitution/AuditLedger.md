# AuditLedger · 落地页首页替换

## 变更记录
| 项目 | 内容 |
|------|------|
| 日期 | 2026-06-09 |
| 操作 | 替换 index.html 为落地页Hero首页 |
| 文件 | `index.html` |
| 旧内容 | "Fly · 沙盒验证"（验证层子页面） |
| 新内容 | "Fly · AI Agent信任与归因基础设施"（Hero落地页） |
| 来源 | `fly-landing-page/index.html`（历史已确认的设计稿） |
| 推送方式 | GitHub API PUT |
| commit | ad745b48 |
| 旧sha | 99ef69930ade3a2a2b8271995339ddc7ddd077a4 |
| 新sha | e1856000dd68b31101f30003ceb80e914191f530 |

## 影响检查
- 影响数据库：否
- 影响API：否
- 影响已有数据：否
- Breaking Change：否

## 验证
- `https://fly-agent.xyz/` → 200，标题 "Fly · AI Agent信任与归因基础设施" ✅
- Hero区：溯源Fly按钮、每一次AI推荐、Action ID、Google Analytics对比 ✅
- 用户确认：首页是对的 ✅

## 状态
**FROZEN**
