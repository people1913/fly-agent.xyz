# CTRS v1.2 一致性测试套件 (Conformance Test Suite)

> 验证任何第三方 CTRS 实现是否兼容 CTRS v1.2 协议规范

## 概述

本测试套件为 CTRS (Commercial Trust Report Specification) v1.2 提供标准化的一致性验证。类似于 JSON Schema Test Suite、OAuth 2.0 Conformance Tests 和 JWT Conformance Tests，任何声称兼容 CTRS v1.2 的实现都应该通过本套件中的所有测试。

### 设计原则

1. **可移植性** — 仅依赖 Python 3.7+ 标准库，无需安装第三方包
2. **独立性** — 不依赖 Fly 内部代码，与任何 CTRS 实现解耦
3. **真实性** — 测试用例使用真实数据结构，不是 mock
4. **完整性** — 覆盖 CTRS v1.2 全部 3 层 10 项检查

## 快速开始

### 远程模式（推荐）

向被测实现的 API 端点发送测试输入并验证响应：

```bash
# 运行单个测试
python conformance_validator.py \
  --test tests/test_001_basic_report.json \
  --endpoint https://api.fly-agent.xyz/v1/verify

# 运行所有测试
python conformance_validator.py \
  --all \
  --endpoint https://api.fly-agent.xyz/v1/verify
```

### 本地模式

直接验证一份 CTRS Report JSON 文件：

```bash
# 验证单个测试
python conformance_validator.py \
  --test tests/test_001_basic_report.json \
  --report my_report.json

# 验证所有测试
python conformance_validator.py \
  --all \
  --report my_report.json
```

### 一键运行

```bash
# 使用默认端点运行所有测试
bash run_all_tests.sh

# 指定端点
ENDPOINT=https://your-api.example.com/v1/verify bash run_all_tests.sh
```

## 测试用例清单

### 基础层 (Layer 1: Execution Truth)

| 测试 ID | 名称 | 描述 | 预期结果 |
|---------|------|------|---------|
| test_001 | 基础 Report 生成 | 单 Agent 基础归因 | ✅ PASS |
| test_002 | 多方参与归因 | 3+ Agent 协作归因 | ✅ PASS |
| test_003 | Evidence Hash 校验 | SHA-256 完整性验证 | ✅ PASS |
| test_004 | Claim-Evidence 引用 | claim_ref 一致性 | ✅ PASS |
| test_005 | Attribution 一致性 | attribution.claim_ref 验证 | ✅ PASS |
| test_006 | 结算金额分配 | split 加总 == amount | ✅ PASS |

### 结构层 (Layer 2: Structural Identity)

| 测试 ID | 名称 | 描述 | 预期结果 |
|---------|------|------|---------|
| test_007 | Rule Hash 完整性 | hash(definition) == rule.hash | ✅ PASS |
| test_008 | Attribution-Rule 绑定 | attribution.rule_hash == rule.hash | ✅ PASS |

### 治理层 (Layer 3: Social Authority)

| 测试 ID | 名称 | 描述 | 预期结果 |
|---------|------|------|---------|
| test_009 | Rule 注册验证 | Rule 存在于 Registry | ✅ PASS |
| test_010 | Issuer 信任评估 | Issuer trust_level 可信 | ✅ PASS |

### 边界层 (Boundary Tests)

| 测试 ID | 名称 | 描述 | 预期结果 |
|---------|------|------|---------|
| test_011 | 篡改 Evidence Hash | 故意篡改 hash，应检测到 | ❌ FAIL (evidence_hash_integrity) |
| test_012 | 未注册 Rule | 使用未注册规则，应拒绝 | ❌ FAIL (rule_registration) |
| test_013 | 不可信 Issuer | 使用不可信签发者，应拒绝 | ❌ FAIL (issuer_trust) |

## 10 项一致性检查

验证器实现以下 10 项检查，与 CTRS Consumer 规范完全一致：

### Layer 1: Execution Truth（执行真实性）

1. **schema_completeness** — 检查所有 required 字段存在（report_id, schema_version, type, created_at, status, issuer, claim, evidence, rule, attribution, settlement）
2. **claim_integrity** — claim_id, type, subject 必须存在
3. **evidence_hash_integrity** — SHA-256(evidence.data) == evidence.hash
4. **evidence_claim_ref** — evidence.claim_ref == claim.claim_id
5. **attribution_consistency** — attribution.claim_ref == claim.claim_id
6. **settlement_correctness** — sum(split.share_amount) == amount，attribution_ref 一致

### Layer 2: Structural Identity（结构身份）

7. **rule_integrity** — SHA-256(rule.definition) == rule.hash
8. **attribution_rule_binding** — attribution.rule_hash == rule.hash

### Layer 3: Social Authority（社会授权）

9. **rule_registration** — rule_id + rule_hash 存在于 Rule Registry
10. **issuer_trust** — issuer trust_level ∈ {trusted, verified}

## 输出示例

### 单个测试

```
CTRS Conformance Test: test_001
名称: 基础 CTRS Report 生成
类别: positive
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ schema_completeness: 所有必需字段存在
  ✅ claim_integrity: Claim 包含 3 个必需字段
  ✅ evidence_hash_integrity: 1 条 Evidence hash 全部验证通过
  ✅ evidence_claim_ref: 所有 Evidence 引用 claim_id=claim-00...
  ✅ attribution_consistency: Attribution 引用正确的 claim_id
  ✅ settlement_correctness: 结算金额 500.0 = 分账合计 500.0
  ✅ rule_integrity: Rule 定义 hash 验证通过，未被篡改
  ✅ attribution_rule_binding: Attribution 绑定到 rule_hash=4eeede5dee38e7cd...
  ✅ rule_registration: Rule 已在 Registry 注册
  ✅ issuer_trust: Issuer did:fly:demo-platform 信任级别: trusted

Result: PASS ✅
```

### 批量测试

```
CTRS Conformance Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━
  test_001: PASS ✅
  test_002: PASS ✅
  test_003: PASS ✅
  ...
  test_011: FAIL ❌
  test_012: FAIL ❌
  test_013: FAIL ❌

Summary: 10/13 PASSED
```

## 测试用例格式

每个测试用例 JSON 包含以下字段：

```json
{
  "test_id": "test_001",
  "name": "测试名称",
  "description": "测试描述",
  "layer": 1,
  "category": "positive | negative",
  "input": {
    "claim": {...},
    "evidence": [...],
    "rule": {...}
  },
  "expected_output": {
    "schema_version": "CTRS-v1.2",
    ...
  },
  "checks": ["schema_completeness", "claim_integrity", ...],
  "expected_fail_checks": [],
  "expected_result": "PASS | FAIL"
}
```

### 关键字段说明

- **category**: `positive` 表示预期全部检查通过，`negative` 表示预期某些检查失败
- **expected_fail_checks**: 负面测试中预期失败的检查项列表
- **input**: 发送给被测实现的输入数据（claim + evidence + rule）
- **checks**: 本测试覆盖的检查项列表

## Registry 配置

Layer 3 的两项检查（rule_registration、issuer_trust）需要访问 Registry。支持以下方式：

1. **命令行指定**: `--registry /path/to/fly-registry`
2. **环境变量**: `CTRS_REGISTRY_DIR=/path/to/fly-registry`
3. **默认路径**: 自动查找 `../fly-registry/`（Trust Record 生产线目录，私有部署，不入本仓库）

Registry 目录应包含：
- `rule-registry.json` — 规则注册表
- `issuer-registry.json` — 签发者注册表

如果未找到 Registry，Layer 3 检查将显示警告但不会导致测试失败。

## 为你的实现编写测试

如果你的 CTRS 实现有特殊的业务逻辑，可以扩展测试用例：

1. 在 `tests/` 目录创建新的 `test_xxx_name.json` 文件
2. 按照[测试用例格式](#测试用例格式)填写内容
3. 确保 `input` 使用真实的 CTRS 数据结构
4. 对于负面测试，设置 `category: "negative"` 和 `expected_fail_checks`

## 协议参考

- CTRS v1.2 Schema: `ctrs-v1.2-schema.json`
- CTRS Consumer 参考: `ctrs-consumer/ctrs-consumer.py`
- E2E Demo Report: `ctrs-e2e-demo-report.json`

## 许可证

MIT License — 自由使用、修改和分发
