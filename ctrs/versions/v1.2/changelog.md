# CTRS v1.2 变更记录

## v1.2 (2026-07)

### 新增

- **Settlement `eligible` 状态**: `settlement.status` 新增 `eligible` 枚举值，表示已通过全部验证、可进入结算流程
- **Report `eligible` 状态**: `status` 字段新增 `eligible` 枚举值
- **Social Authority 层（L6）**: 新增 Rule 注册验证 + Issuer 信任评估层

### 变更

- **`confidence` 浮点化**: `attribution.confidence` 从整数范围（70-95）统一改为 0-1 浮点数格式
  - 旧格式: `confidence: 85`（整数百分比）
  - 新格式: `confidence: 0.85`（浮点小数）

### 修复

- 明确 Evidence `type` 枚举值: `webhook`, `conversation`, `mcp`, `payment`, `crm`, `stripe`, `custom`
- 明确 Settlement `status` 枚举值: `eligible`, `pending`, `settled`, `disputed`

---

## v1.1 (2026-06)

### 新增

- **Rule 一等对象**: Rule 从简单字符串升级为 First-Class Object，包含 `rule_id`, `issuer`, `version`, `hash`, `definition`, `created_at`
- **Attribution Hash 绑定**: Attribution 只能通过 `rule_hash` 引用 Rule，不允许直接引用 Rule 文本
- **Rule 完整性验证**: 新增 `hash(rule.definition) == rule.hash` 验证规则

### 变更

- Rule 字段从字符串类型改为完整结构化对象
- Attribution 绑定方式从文本引用改为 Hash 绑定

---

## v1.0 (2026-06)

### 初始版本

- 五层结构: Claim, Evidence, Rule, Attribution, Settlement
- 基础验证: Schema 完整性, Hash 完整性, 引用一致性
- SHA-256 Hash 算法
- JSON Schema 定义
