# Trust Constitution

Status: **FROZEN**

## Core Field: trust_score

- 存储位置：agents表trust_score字段
- 范围：0-100
- 基础分：50

## Calculation: TrustScoreFactors

```
agent_id: string
unique_users: number         // 独立用户数
time_span_days: number       // 时间跨度（天）
channel_diversity: number    // 渠道跨度
verification_sources: number // 验证来源数
attribution_accuracy: number // 归因准确率
calculated_score: number     // 计算结果→写入trust_score
```

## 加分规则

| 因子 | 算法 | 上限 |
|---|---|---|
| 独立用户数 | 每10人+5 | +20 |
| 时间跨度 | 每7天+2 | +10 |
| 渠道跨度 | 每多1渠道+3 | +9 |
| 验证来源 | 每多1来源+4 | +8 |
| 归因准确率 | 准确率×3 | +3 |

## Verification Levels

| Level | trust_score范围 | 说明 |
|---|---|---|
| L0 | 0-49 | Unverified |
| L1 | 50-64 | Basic |
| L2 | 65-79 | Verified |
| L3 | 80-89 | Trusted |
| L4 | 90-100 | Premium |

## Rules

1. trust_score字段名不变
2. L0-L4等级定义不变
3. TrustScoreFactors是独立接口，不动AgentIdentity
4. 加分算法可配置化调整（上限和系数），但维度不变
5. recalcTrustScore需要owner或auditor权限
6. 任何Breaking Change必须升级协议版本
