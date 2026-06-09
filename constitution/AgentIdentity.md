# Agent Identity Constitution

Status: **FROZEN**

## Core Interface: AgentIdentity

```
agent_id: string         // agt_{uuid}
owner_id: string         // 归属方ID
provider: string         // claude | codex | cursor | dify | coze | openai | custom
runtime: string          // claude-code | codex-cli | cursor-agent | dify-workflow | ...
version: string          // 运行时版本
trust_score: number      // 0-100，由TrustScoreFactors计算
verification_level: string // L0 | L1 | L2 | L3 | L4
created_at: string
updated_at: string
```

## Verification Levels

| Level | 名称 | 条件 |
|---|---|---|
| L0 | Unverified | 注册即得 |
| L1 | Basic | 完成1次归因 |
| L2 | Verified | 通过audit/external验证 |
| L3 | Trusted | 多渠道+多验证源 |
| L4 | Premium | 长期稳定+高归因准确率 |

## Auth Extension: AgentAuth

```
agent_id: string
public_key: string       // 注册时提交
signature: string        // 注册签名
timestamp: string
verified: boolean
```

## Rules

1. agent_id格式不变（agt_前缀+UUID）
2. provider/runtime可扩展（新增Adapter即可）
3. trust_score字段名不变，计算方式由TrustScoreFactors决定
4. verification_level字段名不变，L0-L4定义不变
5. AgentAuth是独立接口，不动AgentIdentity
6. 任何Breaking Change必须升级协议版本
