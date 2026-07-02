# CTRS — Commercial Trust Report Specification

> Agent 商业场景的可验证、可追溯、可审计信任记录标准

## 概述

CTRS（Commercial Trust Report Specification）定义了一种用于 Agent 商业协作的价值归因与结算协议。它通过分层结构、Hash 绑定和注册表验证，确保信任记录的完整性和可审计性。

## 目录结构

```
ctrs/
├── versions/                    # 已发布版本
│   └── v1.2/
│       ├── specification.md     # 规范文档（核心）
│       ├── schema.json          # 机器可读 JSON Schema
│       └── changelog.md         # 版本变更记录
├── tests/                       # 测试用例
│   └── v1.2/
│       ├── core/                # 强制测试（L1-L2）
│       │   ├── schema-completeness.json
│       │   └── hash-and-reference.json
│       └── optional/            # 可选测试（L3 注册表）
│           └── registry-verification.json
├── interop/                     # 互操作测试
│   └── test_vectors/
│       └── v1.2.json            # 互操作测试向量
├── examples/                    # 参考示例
│   └── v1.2-demo-report.json   # 完整 Report 示例
└── README.md                    # 本文件
```

## 核心概念

### 七层结构

| 层级 | 名称 | 职责 |
|------|------|------|
| L0 | 元数据 | Report 标识、版本、时间戳、状态 |
| L1 | 声明 (Claim) | 描述"谁做了什么" |
| L2 | 证据 (Evidence) | 可验证的数据支撑 |
| L3 | 规则 (Rule) | 归因方法与参数（一等对象） |
| L4 | 归因 (Attribution) | 基于 Rule 和 Evidence 的贡献计算 |
| L5 | 结算 (Settlement) | 分润方案 |
| L6 | 注册表 (Registry) | Rule/Issuer 合法性验证 |

### 验证层级

| 层级 | 验证内容 | 测试位置 |
|------|---------|---------|
| L1 | Schema 完整性 | `tests/v1.2/core/schema-completeness.json` |
| L2 | Hash 完整性 + 引用一致性 | `tests/v1.2/core/hash-and-reference.json` |
| L3 | 注册表验证 | `tests/v1.2/optional/registry-verification.json` |

## 规范版本

| 版本 | 状态 | 关键变更 |
|------|------|---------|
| v1.2 | 当前 | `eligible` 状态、`confidence` 浮点化、Social Authority 层 |
| v1.1 | 已发布 | Rule 一等对象、Hash 绑定 |
| v1.0 | 已发布 | 初始版本、五层结构 |

## RFC 2119 合规

本规范严格遵循 [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt) 关键词：

- **MUST** / **REQUIRED** — 强制要求
- **SHOULD** / **RECOMMENDED** — 推荐但非强制
- **MAY** / **OPTIONAL** — 完全可选

所有字段在规范文档中都有明确的 MUST/SHOULD/MAY 标注。

## 快速开始

### 1. 阅读 Spec

```bash
# 阅读当前版本的规范文档
cat ctrs/versions/v1.2/specification.md
```

### 2. 验证 JSON Schema

```bash
# 使用 JSON Schema 验证工具检查 Report 格式
python3 -c "
import json, jsonschema
schema = json.load(open('ctrs/versions/v1.2/schema.json'))
report = json.load(open('ctrs/examples/v1.2-demo-report.json'))
jsonschema.validate(report, schema)
print('Schema 验证通过')
"
```

### 3. 运行测试向量

```bash
# 加载互操作测试向量
cat ctrs/interop/test_vectors/v1.2.json | python3 -m json.tool
```

## 实现指南

1. **生成 Report**: 按照 `specification.md` 第3章的消息格式构建 Report 对象
2. **计算 Hash**: 使用 `SHA-256(JSON.stringify(data, sort_keys=True))` 计算 Evidence 和 Rule 的 Hash
3. **验证 Report**: 按照第4章的验证规则依次执行 L1→L2→L3 检查
4. **注册 Rule**: 在 Rule Registry 中注册规则，确保 L3 验证可通过
5. **信任评估**: 在 Issuer Registry 中维护签发者信任等级

## 贡献

本仓库遵循成熟协议的组织模式（参考 HTML Spec / JSON Schema 的版本分离和测试组织方式）。

- 规范变更需更新 `specification.md` 和 `schema.json`
- 新增测试用例需可追溯到规范章节
- 互操作测试向量需包含完整的输入和预期输出
