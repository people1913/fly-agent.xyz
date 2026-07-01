# CTRS v1.2 Independent Consumer

## 这是什么

一个**完全独立**的 CTRS v1.2 消费者实现。

- **零代码共享**：不导入 Fly 的 generator、verify、registry 任何模块
- **仅依赖**：CTRS JSON Schema + Registry 文件格式
- **目的**：证明 CTRS v1.2 是一个可被第三方独立实现的协议标准

## 它证明了什么

> 任何一个系统，只要知道 CTRS 的 Schema 和 Registry 格式，
> 就可以独立验证一份 Report 的真实性、完整性和可结算性。

## 验证覆盖

10 项检查，三层协议：

| 层级 | 检查项 | 含义 |
|------|--------|------|
| Layer 1 | schema_completeness | Report 包含所有必需字段 |
| Layer 1 | claim_integrity | Claim 结构完整 |
| Layer 1 | evidence_hash_integrity | Evidence 数据未被篡改 |
| Layer 1 | evidence_claim_ref | Evidence 正确引用 Claim |
| Layer 1 | attribution_consistency | Attribution 引用正确的 Claim |
| Layer 1 | settlement_correctness | 结算金额加总正确 |
| Layer 2 | rule_integrity | Rule 定义 hash 未被篡改 |
| Layer 2 | attribution_rule_binding | Attribution 绑定到正确的 Rule hash |
| Layer 3 | rule_registration | Rule 已在 Registry 注册 |
| Layer 3 | issuer_trust | Issuer 信任级别可信 |

## 使用方式

```bash
python ctrs-consumer.py                          # 验证最近一份 Report
python ctrs-consumer.py <report_id>              # 验证指定 Report
python ctrs-consumer.py <path/to/report.json>    # 验证本地文件
```

## 协议意义

这是 CTRS v1.2 的**第二个独立实现**。

- 第一个实现：Fly 协议引擎（generator + verify + registry）
- 第二个实现：本消费者（独立从零实现）

两个实现对同一份 Report 得出一致结论 → **协议成立**。
