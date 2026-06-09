# Fly Constitution

Status: **FROZEN**

## 三大铁律

| 铁律 | 含义 | 违反后果 |
|---|---|---|
| 好的不动 | 跑通的别碰 | 废操作 |
| 缺的补 | 缺什么补什么 | 用新接口新表，不往旧接口塞字段 |
| 更好的换 | 有更优方案再换 | 整体替换，不打补丁 |

## 架构（8层 + 6协议）

| Layer | 名称 | 可替换 | 协议 |
|---|---|---|---|
| L1 | Runtime | ✅ 可替换 | — |
| L2 | Adapter | ✅ 可替换 | — |
| L3 | Gateway | ❌ 不可替换 | — |
| L4 | Identity | ❌ 不可替换 | AIP — Agent Identity Protocol |
| L5 | Verification | ❌ 不可替换 | FVP — Fly Verification Protocol |
| L6 | Attribution | ❌ 不可替换 | ATP — Attribution Protocol |
| L7 | Governance | ❌ 不可替换 | FGP — Fly Governance Protocol |
| L8 | Audit | ❌ 不可替换 | ALP — Audit Ledger Protocol |

信号协议：FSS — Fly Signal Standard（跨L4-L6）

## 子宪法文件

| 文件 | 协议 | 状态 |
|---|---|---|
| AgentIdentity.md | AIP | FROZEN |
| ActionSignal.md | FSS | FROZEN |
| Verification.md | FVP | FROZEN |
| Trust.md | — | FROZEN |
| Attribution.md | ATP | FROZEN |
| AuditLedger.md | ALP | FROZEN |
| Governance.md | FGP | FROZEN |

## V1核心不动

- 4个核心接口：AgentIdentity / ActionSignal / VerificationRecord / AttributionRecord
- 五级信号：impression / click / consult / booking / deal
- L0-L4等级定义
- 三层归因：Channel / Agent / Cross-Channel
- D1四表：agents / actions / verifications / attributions

## 任何AI修改前必须

1. 先读取本文件
2. 再读取对应子宪法
3. 违反三铁律的一切输出都是废操作

## 版本

- V1: 4接口 + 五级信号 + 三层归因 + 四表（地基）
- V2: 8个安全漏洞修复 + Governance + Audit + Bot Detection（补丁层，不动V1）

## Breaking Change规则

任何Breaking Change必须升级协议版本，并在本文件记录。
