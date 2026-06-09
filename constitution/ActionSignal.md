# Action Signal Constitution

Status: **FROZEN**

## Core Interface: ActionSignal

```
action_id: string        // act_{uuid}
agent_id: string
channel: string          // douyin | xiaohongshu | wechat | meituan | feishu | geo | direct
user_id: string          // HMAC_SHA256(明文, server_salt)，前缀hmac_
signal_type: string      // impression | click | consult | booking | deal
short_id: string?
metadata: object
timestamp: string
```

## Signal Types（五级信号，禁止修改）

| signal_type | 说明 |
|---|---|
| impression | 曝光 |
| click | 点击 |
| consult | 咨询 |
| booking | 预约 |
| deal | 成交 |

## Signal Quality（风控层，与signal_type正交）

| signal_quality | 说明 |
|---|---|
| raw | 初始记录，未验证 |
| verified | 通过行为验证 |
| bot | 机器人触发 |
| unknown | 无法判定 |

## 关键原则

- signal_type是业务事件层，signal_quality是风控层，两者彻底正交
- 任何signal都可以带quality，不限于click
- 归因只统计signal_quality=verified的事件
- human_score配置化（HumanScoreConfig），不写死进协议

## Rules

1. 五级信号禁止增删改
2. signal_quality允许新增枚举值（需Constitution修订）
3. user_id生成方式：HMAC_SHA256(明文, server_salt)，旧数据sha256_前缀兼容
4. channel允许扩展
5. 任何Breaking Change必须升级协议版本
