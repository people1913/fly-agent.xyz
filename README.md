# Fly

**自动化经济时代的商业价值确认协议**

> 当多个 Agent 协作促成一笔交易——谁创造了商业价值？Fly 让每一份贡献都被证明。

---

## 核心问题

Agent Economy 正在成形。推荐 Agent 引流、讲解 Agent 促成决策、支付 Agent 完成交易——但商业归因却是失真的：

- 谁贡献了多少？**没有可验证的依据**
- 结算怎么分？**凭感觉，不凭证据**
- 贡献被低估的 Agent 拿不到合理报酬，贡献被高估的 Agent 获得不当收益

没有信任链，Agent 经济的商业模式就无法闭环。

## Fly 如何解决

Fly 通过 **CTRS**（Commercial Trust Report Specification）形成共同认可的商业事实：

```
商业行为 → 证据采集 → 商业事实确认 → 规则归因 → 结算分润
```

这不是简单的数据格式——而是一条从行为到结算的完整信任链路。每一步都可验证、可追溯、可审计。

## 一个例子：三个 Agent 完成交易

用户购买一块 $2,400 的高级手表，三个 Agent 协作促成：

| Agent | 做了什么 | Fly 如何证明 |
|-------|---------|-------------|
| 推荐 Agent | 根据用户偏好推荐了 Premium Watch X1 | 对话记录 + 推荐动作 → 证据链 Hash 绑定 |
| 讲解 Agent | 讲解瑞士机芯、蓝宝石镜面等产品细节 | 对话记录 + 交互数据 → 证据链 Hash 绑定 |
| 支付 Agent | 完成支付流程 | 支付凭证 → 证据链 Hash 绑定 |

Fly 基于注册规则计算归因：

```
推荐 Agent → 45%（$1,080）
讲解 Agent → 35%（$840）
支付 Agent → 20%（$480）
```

每一分钱的分配都有证据支撑、规则可查、机器可验证。不是"我觉得"，而是"Fly 证明"。

## 从愿景到实例

Fly 的设计遵循清晰的叙事线，从"为什么需要"到"运行实例"：

```
Agent Economy
Today's commercial activities are created across multiple agents and platforms.
↓
Fly
A commercial value confirmation protocol for the automation economy.
↓
CTRS
The specification that defines how commercial facts are constructed and verified.
↓
Fly Report
A verifiable commercial attribution report.
```

- **Agent Economy** — 为什么今天需要新的协议？多 Agent 协作已成现实，但商业归因失真，结算缺乏依据，需要新的信任基础设施。
- **Fly** — 解决什么商业问题？让每一份商业贡献都被证明，建立从行为到结算的完整信任链路。
- **CTRS** — 协议规范是什么？数据格式、验证规则、交互协议的精确定义。→ [`ctrs/`](./ctrs/)
- **Fly Report** — 运行实例是什么？按照 CTRS 规范生成的具体商业信任报告，可验证、可追溯、可审计。→ [`ctrs/examples/`](./ctrs/examples/)

**Fly 是品牌，CTRS 是规范。** 就像：

- **Let's Encrypt**（市场记住的名字）和 **ACME**（开发者的协议）
- **HTTP/2**（用户知道的概念）和 **HPACK**（工程师实现的规范）

市场记住 Fly，开发者知道 CTRS，Report 让信任可交付。

## 仓库结构

```
fly-agent.xyz/
├── README.md              ← 你在这里：Fly 的故事
├── ctrs/                  ← CTRS 技术规范（Fly 的 Specification）
│   ├── README.md          ← CTRS 规范入口
│   ├── versions/          ← 已发布的规范版本
│   ├── tests/             ← 测试用例（L1-L3 验证）
│   ├── interop/           ← 互操作测试向量
│   └── examples/          ← Agent 商业场景示例
├── docs/                  ← 产品文档
└── ...                    ← 网站与工程资源
```

## 了解更多

沿叙事线逐层深入：

- **Agent Economy：** → 上文「核心问题」已阐述
- **Fly：** → 你正在阅读
- **CTRS 协议规范：** → [`ctrs/`](./ctrs/)
- **Fly Report 实例：** → [`ctrs/examples/`](./ctrs/examples/)
- **想验证规范合规性？** → [`ctrs/tests/`](./ctrs/tests/)

---

*Fly — Prove what matters.*
