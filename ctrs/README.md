# CTRS — Layer 2：Fly 的协议规范

> **CTRS = Commercial Trust Report Specification**
> 这是 [Fly](../)（Layer 1）协议的技术规范。CTRS 不是独立协议——它是 Fly 的 Specification，就像 ACME 是 Let's Encrypt 的协议一样。

---

## 四层叙事中的定位

CTRS 在 Fly 四层叙事中处于 **Layer 2**：

| Layer | 名称 | 回答的问题 | 指向 |
|-------|------|-----------|------|
| Layer 0 | Agent Economy | 为什么今天需要新的协议？ | [../README.md](../) 开头 |
| **Layer 1** | **Fly** | **解决什么商业问题？** | **[../README.md](../)** |
| **→ Layer 2** | **CTRS** | **协议规范是什么？** | **← 你在这里** |
| Layer 3 | Fly Report | 协议运行后的实例是什么？ | [./examples/](./examples/) |

**层级关系：**

```
Layer 0: Agent Economy（为什么需要）
  → Layer 1: Fly（解决什么问题）[../]
    → Layer 2: CTRS（协议规范是什么）← 你在这里
      → Layer 3: Fly Report（运行实例是什么）[./examples/]
```

## 为什么需要 CTRS

Agent Economy 正在成形。当多个 Agent 协作促成一笔商业交易——推荐、讲解、支付——谁来证明谁贡献了多少？没有可验证的信任链，商业归因就会失真，结算就缺乏依据，Agent 经济的商业模式就无法闭环。

CTRS 确保 Fly 的每一份 Report 都能被：

- **验证** — 证据可追溯到原始商业行为，Hash 绑定防止篡改
- **归因** — 基于注册规则计算每个 Agent 的贡献比例，机器可验证
- **结算** — 从归因结果直接生成可执行的结算方案

核心验证链路：

```
商业行为 → 证据采集 → 商业事实确认 → 规则归因 → 结算分润
```

而不是：

```
JSON → Schema → Parser
```

## Agent Economy 中的定位

CTRS 在 Agent Economy 栈中的位置：

| 层级 | 解决的问题 | CTRS 的角色 |
|------|-----------|------------|
| 商业行为 | Agent 做了什么？ | Claim 层记录"谁做了什么" |
| 证据 | 怎么证明？ | Evidence 层采集对话、支付、CRM 等商业证据 |
| 规则 | 按什么标准归因？ | Rule 层定义归因方法，一等对象可注册可审计 |
| 归因 | 各方贡献多少？ | Attribution 层基于证据和规则计算贡献 |
| 结算 | 谁该收多少钱？ | Settlement 层生成可执行的分润方案 |

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
├── examples/                    # Agent Commerce Scenario
│   └── v1.2-commerce-scenario.json   # 三Agent协作归因示例
└── README.md                    # 本文件
```

## 核心概念

### 七层结构

| 层级 | 名称 | 职责 | Agent Economy 语义 |
|------|------|------|-------------------|
| L0 | 元数据 | Report 标识、版本、时间戳、状态 | 商业交易身份 |
| L1 | 声明 (Claim) | 描述"谁做了什么" | 商业行为事实 |
| L2 | 证据 (Evidence) | 可验证的数据支撑 | 商业行为证据 |
| L3 | 规则 (Rule) | 归因方法与参数（一等对象） | 归因规则 |
| L4 | 归因 (Attribution) | 基于 Rule 和 Evidence 的贡献计算 | 商业贡献量化 |
| L5 | 结算 (Settlement) | 分润方案 | 商业结算执行 |
| L6 | 注册表 (Registry) | Rule/Issuer 合法性验证 | 信任基础设施 |

### 验证层级

| 层级 | 验证内容 | 测试位置 |
|------|---------|---------|
| L1 | Schema 完整性 | `tests/v1.2/core/schema-completeness.json` |
| L2 | Hash 完整性 + 引用一致性 | `tests/v1.2/core/hash-and-reference.json` |
| L3 | 注册表验证 | `tests/v1.2/optional/registry-verification.json` |

### 商业行为验证流程

```
1. Agent A 推荐产品（商业行为）
   ↓ 证据采集
2. 对话记录 + 支付凭证（Evidence）
   ↓ 事实确认
3. 多 Agent 协作促成交易（Claim）
   ↓ 规则归因
4. 推荐45% / 讲解35% / 支付渠道20%（Attribution）
   ↓ 结算分润
5. 各方结算方案（Settlement）
```

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
report = json.load(open('ctrs/examples/v1.2-commerce-scenario.json'))
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

---

*CTRS 是 Fly 的 Specification。返回 [Fly 主页](../) 了解全貌。*
