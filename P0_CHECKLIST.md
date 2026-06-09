# P0 Runtime Acceptance Checklist

每日检查，连续7天全部通过 = Stable

## 检查项

| # | 检查项 | 验证方式 | 通过标准 |
|---|---|---|---|
| 1 | 网站首页可访问 | curl https://fly-agent.xyz | HTTP 200 |
| 2 | 在线聊天可用 | 页面JS聊天组件加载 | 无报错 |
| 3 | 短链跳转正常 | curl https://fly-agent.xyz/s/{actionId} | 302跳转 |
| 4 | Action Signal写入 | POST /v1/action | 返回action_id |
| 5 | Verification写入 | POST /v1/verifications | 返回verification_id |
| 6 | Trust Score更新 | POST /v1/agents/:id/recalc-trust | 返回calculated_score |
| 7 | Attribution归因 | 查attributions表 | 有关联记录 |
| 8 | Audit Event记录 | GET /v1/audit/:entityType/:entityId | chain_valid=true |
| 9 | Governance权限校验 | POST /v1/governance/check-permission | Default Deny生效 |
| 10 | 所有接口健康 | 逐个API调用 | 无5xx |

## 状态追踪

| 日期 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 状态 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Day1 | | | | | | | | | | | |
| Day2 | | | | | | | | | | | |
| Day3 | | | | | | | | | | | |
| Day4 | | | | | | | | | | | |
| Day5 | | | | | | | | | | | |
| Day6 | | | | | | | | | | | |
| Day7 | | | | | | | | | | | |

## 稳定性判定

- 7/7天全部通过 → **Stable**
- 5-6/7天通过 → **Degraded**（排查失败项）
- <5/7天通过 → **Unstable**（停止新功能，全力修）
