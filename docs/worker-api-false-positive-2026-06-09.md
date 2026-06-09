# Fly Worker API 误报复盘

## 事件
技术支持 Agent 报告：
* /v1/verify 返回 404
* /v1/attribution 返回 404
* /v1/audit 返回 404

并推断 Worker 部署异常。

## 调查结果
上述三个路径并非 Fly Worker 实际定义路由。

Worker 实际公开接口：
* POST /v1/agents
* POST /v1/action
* GET /v1/status/:actionId
* POST /v1/audit/verify-chain
* POST /v1/verifications
* GET /s/:shortId
* GET /v1/health
* GET /dashboard
* POST /v1/verifications
* POST /v1/signal/verify
* GET /v1/audit/export/:agentId
* GET /v1/audit/:agentId
* POST /v1/governance/assign-role
* POST /v1/governance/check-permission
* POST /v1/governance/update-policy
* GET /v1/db/query
* POST /v1/agents/:agentId/recalc-trust

访问未定义路由返回 404 属于正常行为。

## 根因
验证脚本使用了错误 API 路径。
属于监控逻辑错误，不属于服务故障。

## 影响
无生产影响。Worker 服务正常运行。无需重新部署。

## 结论
False Positive（误报）。状态：Closed.

## 纠正措施
1. 更新技术文档，写入正确API路由清单
2. 更新技术支持AGENT的健康检查路径
3. 避免后续重复误报
