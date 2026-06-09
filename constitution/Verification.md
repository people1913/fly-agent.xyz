# Verification Constitution

Status: **FROZEN**

## Core Interface: VerificationRecord

```
verification_id: string   // vrf_{uuid}
action_id: string
verifier: string
result: string            // verified | rejected | pending
confidence: number        // 0-1
evidence: object[]
timestamp: string
```

## Extension: VerificationContext

```
verification_id: string
issuer: string            // 发起验证方
subject: string           // 被验证对象
verifier: string          // 验证执行方
verifier_id: string       // 验证者ID（必须存在于role_assignments表）
verifier_type: string     // system | human | audit | external
```

## 5条铁律

| # | 规则 | 说明 |
|---|---|---|
| 1 | verifier ≠ subject | 防自证 |
| 2 | verifier_id必须非空 | 防假审计员 |
| 3 | verified必须附带evidence | 防空验证 |
| 4 | L2+必须audit/external来源 | 防低来源升高级 |
| 5 | 互刷超阈值降权 | 防A帮B刷B帮A刷 |

## Verifier Types

| verifier_type | 说明 | 可用于 |
|---|---|---|
| system | 系统自动验证 | L0→L1 |
| human | 人工验证 | L0→L1 |
| audit | 审计员验证 | L2+ |
| external | 外部第三方验证 | L2+ |

## Rules

1. VerificationRecord核心接口禁止修改
2. VerificationContext是独立扩展，不动VerificationRecord
3. 5条铁律不可降级
4. verifier_type允许新增（需Constitution修订）
5. 任何Breaking Change必须升级协议版本
