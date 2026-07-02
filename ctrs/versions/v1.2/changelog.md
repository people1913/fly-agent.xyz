# CTRS v1.2 变更记录

## v1.2-post-ff (2026-07-02) — Feature Freeze 后改进

### 新增

- **VR 追溯元数据**: 为所有验证规则（VR-101~VR-502）添加追溯元数据，包括对应的规范 Section、涉及字段和测试用例路径
- **追溯矩阵**: 新增 `traceability-matrix.json`，提供 VR → Section → Fields → Test Cases 的结构化映射，共覆盖 22 条验证规则
- **版本兼容策略章节**: 在规范中新增第 7 章"版本兼容策略"，包括：
  - 7.1 版本号规范（SemVer 2.0.0）
  - 7.2 兼容性分类（FULL/GRACE/BREAKING 三级声明）
  - 7.3 Consumer 兼容性策略（strict/graceful/negotiated，默认 graceful）
  - 7.4 版本协商机制
  - 7.5 v1.3 兼容性预告（GRACE 级别）
- **互操作测试向量扩展**: 将测试向量从 `expected_output` 扩展为完整的 `expected` 结构，包含：
  - `report`: Report 级别约束
  - `verify_result`: 验证结果（status + 10 项 checks + failed_checks + 统计）
  - `settlement`: 结算期望（status + amount + split_sum + split 明细 + eligible_parties_count）

### 变更

- 测试向量 `expected_output` 字段重构为 `expected`，子结构从 `report_constraints`/`settlement_constraints`/`verification_checks` 统一为 `report`/`verify_result`/`settlement`

---

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
