# Attribution Constitution

Status: **FROZEN**

## Core Interface: AttributionRecord

```
attribution_id: string    // attr_{uuid}
action_id: string
agent_id: string
source_agent_id: string?  // 归因来源Agent
channel: string
attribution_type: string  // first_touch | last_touch | multi_touch | custom
weight: number            // 0-1
status: string            // pending | confirmed | rejected
timestamp: string
```

## Attribution Types

| Type | 说明 |
|---|---|
| first_touch | 首次触达归因 |
| last_touch | 最终触达归因 |
| multi_touch | 多触点归因 |
| custom | 自定义归因 |

## Attribution Status

| Status | 说明 |
|---|---|
| pending | 待确认 |
| confirmed | 已确认 |
| rejected | 已拒绝 |

## Three-Layer Attribution

```
Layer 1: Channel Attribution（渠道归因）
Layer 2: Agent Attribution（Agent归因）
Layer 3: Cross-Channel Attribution（跨渠道归因）
```

## Rules

1. AttributionRecord核心接口禁止修改
2. attribution_type允许新增（需Constitution修订）
3. attribution_status禁止修改
4. 三层归因框架不变
5. 归因只统计signal_quality=verified的事件
6. attribution.update需要Owner+Auditor双重授权
7. 任何Breaking Change必须升级协议版本
