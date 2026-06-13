#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fly GEO Agent Server - ERC-8183 Provider

A GEO optimization service provider that:
  1. Receives GEO optimization requests from local businesses via ERC-8183
  2. Generates GEO diagnostic reports based on business info and package type
  3. Returns formatted reports as deliverables

Built with BNBAgent SDK v0.3.3
"""

import logging
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import HTTPException, FastAPI
from pydantic import BaseModel
import httpx

# Load .env from project root
env_file = os.environ.get("ENV_FILE", ".env")
load_dotenv(Path(__file__).resolve().parent.parent / env_file)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("fly-geo-agent")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Server port
PORT = int(os.getenv("PORT", "8003"))

# ERC-8183 Contract addresses (BSC Mainnet)
COMMERCE_ADDRESS = os.getenv("ERC8183_COMMERCE_ADDRESS", "0xea4daa3100a767e886fded867729ae7446476eba6")
ROUTER_ADDRESS = os.getenv("ERC8183_ROUTER_ADDRESS", "0x51895229e12f9876011789b04f8698af06ccd6da")
POLICY_ADDRESS = os.getenv("ERC8183_POLICY_ADDRESS", "0x9c01845705b3078aa2e8cff7520a6376fd766de5")
REGISTRY_ADDRESS = os.getenv("ERC8183_REGISTRY_ADDRESS", "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432")

# Provider wallet address
PROVIDER_WALLET = "0x5460BeEd186E1b3786713AFf6eD71962C1CBE931"

# ---------------------------------------------------------------------------
# GEO Service Pricing Packages
# ---------------------------------------------------------------------------

GEO_PACKAGES = {
    "starter": {
        "name": "GEO诊断尝鲜",
        "price": 9.9,
        "price_wei": "9900000000000000000",
        "description": "基础GEO诊断，生成店铺在线可见性报告",
        "features": [
            "店铺基础信息分析",
            "主要平台曝光度检查",
            "关键词覆盖诊断",
            "初步优化建议（3-5条）"
        ],
        "delivery_days": 1
    },
    "basic": {
        "name": "基础GEO优化",
        "price": 59,
        "price_wei": "59000000000000000000",
        "description": "月度基础GEO优化服务",
        "features": [
            "完整GEO诊断报告",
            "Google Business Profile优化",
            "百度地图标注优化",
            "高德地图信息完善",
            "大众点评SEO建议",
            "月度效果追踪",
            "专属优化建议（10+条）"
        ],
        "delivery_days": 3
    },
    "pro": {
        "name": "深度GEO代运营",
        "price": 299,
        "price_wei": "299000000000000000000",
        "description": "月度深度GEO代运营服务",
        "features": [
            "全面GEO诊断+月度报告",
            "多平台统一信息管理",
            "本地化内容策略制定",
            "竞争对手GEO分析",
            "用户评价体系优化",
            "地图API集成建议",
            "数据驱动的持续优化",
            "7x24小时问题响应",
            "每月策略复盘会议"
        ],
        "delivery_days": 7
    },
    "enterprise": {
        "name": "全托管代运营",
        "price": 999,
        "price_wei": "999000000000000000000",
        "description": "月度全托管GEO代运营服务",
        "features": [
            "企业级GEO全面托管",
            "多门店统一管理",
            "跨区域GEO策略部署",
            "定制化平台对接",
            "专属客户成功经理",
            "实时数据看板",
            "危机公关快速响应",
            "季度业务增长报告",
            "API数据接口开放",
            "优先技术支持"
        ],
        "delivery_days": 14
    }
}

# ---------------------------------------------------------------------------
# GEO Report Generation Functions
# ---------------------------------------------------------------------------

def parse_job_description(description: str) -> dict:
    """
    Parse job description to extract business info and package type.
    
    Expected format:
    - "GEO诊断尝鲜 - 店铺名: xxx, 行业: xxx, 地址: xxx"
    - "基础GEO优化 - 店铺: xxx, 行业: xxx, 位置: xxx"
    """
    result = {
        "package_type": "starter",
        "store_name": "",
        "industry": "",
        "address": "",
        "contact": "",
        "website": "",
        "raw_description": description
    }
    
    # Detect package type
    desc_lower = description.lower()
    if "全托管" in description or "enterprise" in desc_lower:
        result["package_type"] = "enterprise"
    elif "深度" in description or "pro" in desc_lower:
        result["package_type"] = "pro"
    elif "基础" in description or "basic" in desc_lower:
        result["package_type"] = "basic"
    else:
        result["package_type"] = "starter"
    
    # Extract fields using simple parsing
    parts = description.split("-")
    if len(parts) >= 2:
        for part in parts[1:]:
            part = part.strip()
            if "店铺" in part or "店名" in part or "名称" in part:
                result["store_name"] = part.split(":")[-1].strip()
            elif "行业" in part or "类型" in part:
                result["industry"] = part.split(":")[-1].strip()
            elif "地址" in part or "位置" in part:
                result["address"] = part.split(":")[-1].strip()
            elif "联系" in part or "电话" in part:
                result["contact"] = part.split(":")[-1].strip()
            elif "网站" in part or "网址" in part:
                result["website"] = part.split(":")[-1].strip()
    
    return result


def generate_starter_diagnosis(store_info: dict) -> str:
    """Generate GEO diagnosis report via DeepSeek AI."""
    from deepseek_geo import diagnose
    return diagnose(store_info, "starter")

def _old_starter_backup(store_info: dict) -> str:
    """[DEPRECATED] Old template report."""
    package = GEO_PACKAGES["starter"]
    
    report = f"""# 🗺️ GEO诊断尝鲜报告

**生成时间**: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}  
**服务套餐**: {package['name']}  
**生成方式**: Fly GEO Agent (ERC-8183 Provider)

---

## 📋 店铺信息

| 项目 | 信息 |
|------|------|
| 店铺名称 | {store_info.get('store_name', '待补充')} |
| 所属行业 | {store_info.get('industry', '待补充')} |
| 店铺地址 | {store_info.get('address', '待补充')} |
| 联系方式 | {store_info.get('contact', '待补充')} |
| 官方网站 | {store_info.get('website', '待补充')} |

---

## 🔍 GEO可见性诊断

### 1. 搜索引擎可见性

| 平台 | 状态 | 建议 |
|------|------|------|
| Google 搜索 | ⚠️ 待检测 | 建议完善 Google Business Profile |
| 百度搜索 | ⚠️ 待检测 | 建议完善百度地图标注 |
| Bing 搜索 | ⚠️ 待检测 | 建议同步基础信息 |

### 2. 地图平台覆盖

| 地图 | 标注状态 | 完善度 |
|------|----------|--------|
| 高德地图 | ⚠️ 待确认 | 待完善 |
| 百度地图 | ⚠️ 待确认 | 待完善 |
| 腾讯地图 | ⚠️ 待确认 | 待完善 |
| Google Maps | ⚠️ 待确认 | 待完善 |

### 3. 本地目录曝光

| 目录类型 | 覆盖状态 |
|----------|----------|
| 大众点评 | ⚠️ 待入驻 |
| 美团 | ⚠️ 待入驻 |
| 口碑/支付宝 | ⚠️ 待入驻 |

---

## 💡 初步优化建议

1. **完善Google Business Profile** - 必做项，添加店铺照片、营业时间、联系方式
2. **统一店铺名称** - 确保所有平台使用一致的店铺名称和地址格式
3. **添加本地关键词** - 在店铺描述中添加地理位置相关关键词
4. **获取客户评价** - 积极引导客户在Google和百度留下评价
5. **完善营业时间** - 确保所有平台营业时间一致且准确

---

## 📊 后续服务推荐

您当前体验的是 **GEO诊断尝鲜** 服务，如需更深入的优化建议，建议升级至：

- **基础GEO优化** (59 USDT/月) - 完整诊断报告+持续优化
- **深度GEO代运营** (299 USDT/月) - 全方位代运营服务
- **全托管代运营** (999 USDT/月) - 企业级全面托管

---

## 📞 联系我们

如需了解更多服务详情，请访问：https://fly-agent.xyz

---

*本报告由 Fly GEO Agent 自动生成 | Powered by ERC-8183 Protocol*
"""
    return report


def generate_basic_optimization(store_info: dict) -> str:
    """Generate GEO optimization report via DeepSeek AI."""
    from deepseek_geo import diagnose
    return diagnose(store_info, "basic")

def _old_basic_backup(store_info: dict) -> str:
    """[DEPRECATED] Old template report."""
    package = GEO_PACKAGES["basic"]
    
    report = f"""# 📈 基础GEO优化报告

**生成时间**: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}  
**服务套餐**: {package['name']}  
**交付周期**: {package['delivery_days']}个工作日  
**生成方式**: Fly GEO Agent (ERC-8183 Provider)

---

## 📋 店铺信息

| 项目 | 信息 |
|------|------|
| 店铺名称 | {store_info.get('store_name', '待补充')} |
| 所属行业 | {store_info.get('industry', '待补充')} |
| 店铺地址 | {store_info.get('address', '待补充')} |
| 联系方式 | {store_info.get('contact', '待补充')} |
| 官方网站 | {store_info.get('website', '待补充')} |

---

## 🎯 优化策略概览

### 核心优化方向

1. **Google Business Profile 深度优化**
   - 完善商家信息（名称、地址、电话、网址）
   - 优化商家类别选择
   - 添加高质量店铺照片（外观、内部、产品）
   - 设置营业时间并保持更新
   - 撰写有吸引力的商家描述

2. **百度地图标注优化**
   - 确认标注位置准确
   - 完善店铺实拍图
   - 添加服务项目详情
   - 开启智能客服功能

3. **高德地图信息完善**
   - 同步百度地图信息
   - 添加营销活动标签
   - 优化导航引导信息

4. **大众点评SEO策略**
   - 优化店铺名称关键词
   - 完善店铺简介
   - 设置吸引人的团购套餐
   - 建立评价引导机制

---

## 📅 优化执行计划

| 阶段 | 时间 | 内容 |
|------|------|------|
| 第一阶段 | Day 1-2 | 账号审计+问题诊断 |
| 第二阶段 | Day 3-5 | 核心平台信息优化 |
| 第三阶段 | Day 6-7 | 效果验证+报告输出 |

---

## 📊 预期效果指标

| 指标 | 现状预估 | 3个月目标 |
|------|----------|-----------|
| 地图曝光量 | 待测 | +50% |
| 搜索排名 | 待测 | Top 3 |
| 到店转化 | 待测 | +30% |
| 评价数量 | 待增 | +20条/月 |

---

## 📝 专属优化建议（10+条）

### 短期优化（本周执行）

1. 统一所有平台的店铺名称和地址格式
2. 在Google Business Profile添加至少10张高质量照片
3. 完善所有平台的营业时间设置
4. 回复所有现有客户评价（积极+专业）
5. 添加店铺官方网站的链接

### 中期优化（本月执行）

6. 建立本地SEO关键词库（20+关键词）
7. 每周发布1-2条店铺动态更新
8. 开展客户评价引导活动
9. 优化店铺描述，突出本地化特色
10. 建立多平台信息同步机制

### 长期优化（持续执行）

11. 定期分析竞争对手GEO策略
12. 持续优化内容质量和更新频率
13. 建立客户反馈收集机制
14. 追踪GEO数据指标并持续改进
15. 定期更新店铺资质和证书信息

---

## 📞 后续服务支持

**本月包含服务**：
- 5次紧急问题响应
- 1次月度策略复盘
- 实时数据监控看板
- 邮件/群内技术支持

**联系我们**：https://fly-agent.xyz

---

*本报告由 Fly GEO Agent 生成 | 服务期限：一个月 | Powered by ERC-8183 Protocol*
"""
    return report


def generate_pro_report(store_info: dict) -> str:
    """Generate GEO deep report via DeepSeek AI."""
    from deepseek_geo import diagnose
    return diagnose(store_info, "pro")

def _old_pro_backup(store_info: dict) -> str:
    """[DEPRECATED] Old template report."""
    package = GEO_PACKAGES["pro"]
    
    report = f"""# 🚀 深度GEO代运营月度报告

**生成时间**: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}  
**服务套餐**: {package['name']}  
**交付周期**: {package['delivery_days']}个工作日  
**生成方式**: Fly GEO Agent (ERC-8183 Provider)

---

## 📋 店铺信息

| 项目 | 信息 |
|------|------|
| 店铺名称 | {store_info.get('store_name', '待补充')} |
| 所属行业 | {store_info.get('industry', '待补充')} |
| 店铺地址 | {store_info.get('address', '待补充')} |
| 联系方式 | {store_info.get('contact', '待补充')} |
| 官方网站 | {store_info.get('website', '待补充')} |

---

## 🎯 深度优化策略

### 多平台统一信息管理

| 平台 | 当前状态 | 优化目标 | 负责人 |
|------|----------|----------|--------|
| Google Business | 待审计 | Top 3 Local Pack | FLY Agent |
| 百度地图 | 待审计 | 精选推荐 | FLY Agent |
| 高德地图 | 待审计 | 五星标注 | FLY Agent |
| 大众点评 | 待审计 | 区域Top 10 | FLY Agent |
| 美团 | 待审计 | 热门商户 | FLY Agent |
| 腾讯地图 | 待审计 | 标注优化 | FLY Agent |

### 本地化内容策略

1. **本地关键词矩阵**
   - 核心关键词：{store_info.get('industry', '行业')}+{store_info.get('address', '地区')}
   - 长尾关键词：{store_info.get('store_name', '店铺')}+附近
   - 品牌关键词：{store_info.get('store_name', '店铺')}评价

2. **内容发布计划**
   - 每周2篇本地化内容
   - 每月1篇深度行业分析
   - 实时热点借势营销

3. **多媒体优化**
   - 每月更新10+张店铺实拍
   - 定期发布短视频内容
   - 360°全景图制作

### 竞争对手GEO分析

| 竞品名称 | GEO优势 | 我方对策 |
|----------|---------|----------|
| 竞品A | 评价数量多 | 提升评价质量 |
| 竞品B | 位置更优 | 强化线上可见性 |
| 竞品C | 内容丰富 | 差异化内容策略 |

### 用户评价体系优化

1. **评价获取机制**
   - 店内引导物料铺设
   - 离店短信/邮件提醒
   - 评价激励计划

2. **评价响应策略**
   - 5星评价：感谢+展示
   - 中评：感谢+改进承诺
   - 差评：24小时内专业回复

3. **评价内容优化**
   - 引导用户提及本地关键词
   - 鼓励上传实拍图片
   - 建立UGC内容库

---

## 📊 效果追踪指标

| 指标类别 | 指标名称 | 本月目标 |
|----------|----------|----------|
| 曝光 | 地图搜索曝光量 | +100% |
| 曝光 | 本地搜索排名 | Top 3 |
| 流量 | 点击转化率 | +50% |
| 转化 | 到店咨询量 | +30% |
| 口碑 | 月新增评价 | +30条 |
| 口碑 | 评价平均分 | 4.5+ |

---

## 🛠️ 技术集成建议

### 地图API集成

1. **地址标准化API**
   - 确保地址格式统一
   - 支持多语言地址

2. **地图嵌入优化**
   - 官网嵌入多地图导航
   - 简化到店路线引导

3. **Schema标记**
   - LocalBusiness Schema
   - Restaurant/FoodEstablishment Schema（如适用）
   - Product Schema（如适用）

---

## 📅 月度工作计划

| 周次 | 主要工作 | 交付物 |
|------|----------|--------|
| 第1周 | 全面审计+策略制定 | 审计报告 |
| 第2周 | 核心平台优化 | 优化记录 |
| 第3周 | 内容营销执行 | 内容日历 |
| 第4周 | 数据复盘+策略调整 | 月度报告 |

---

## 🔧 紧急响应机制

**响应时效**：
- 🔴 紧急问题（曝光异常）：4小时内响应
- 🟡 重要问题（排名下降）：24小时内响应
- 🟢 一般咨询：48小时内响应

**联系方式**：7x24小时在线支持

---

## 📞 定期会议

| 会议类型 | 频率 | 参与方 |
|----------|------|--------|
| 周进度同步 | 每周 | 执行团队 |
| 月度复盘 | 每月 | 双方管理层 |
| 策略调整 | 按需 | 核心成员 |

---

*本报告由 Fly GEO Agent 生成 | 服务期限：一个月 | Powered by ERC-8183 Protocol*
"""
    return report


def generate_enterprise_report(store_info: dict) -> str:
    """Generate GEO enterprise report via DeepSeek AI."""
    from deepseek_geo import diagnose
    return diagnose(store_info, "enterprise")

def _old_enterprise_backup(store_info: dict) -> str:
    """[DEPRECATED] Old template report."""
    package = GEO_PACKAGES["enterprise"]
    
    report = f"""# 🏢 企业级全托管GEO代运营服务协议

**生成时间**: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}  
**服务套餐**: {package['name']}  
**交付周期**: {package['delivery_days']}个工作日  
**服务等级**: 企业级 SLA保障  
**生成方式**: Fly GEO Agent (ERC-8183 Provider)

---

## 📋 企业信息

| 项目 | 信息 |
|------|------|
| 企业名称 | {store_info.get('store_name', '待补充')} |
| 所属行业 | {store_info.get('industry', '待补充')} |
| 总部地址 | {store_info.get('address', '待补充')} |
| 联系方式 | {store_info.get('contact', '待补充')} |
| 官方网站 | {store_info.get('website', '待补充')} |

---

## 🎯 全托管服务范围

### 1. 多门店统一管理

| 功能模块 | 服务内容 | 优先级 |
|----------|----------|--------|
| 门店信息管理 | 统一更新所有门店信息 | P0 |
| 品牌一致性 | 跨平台品牌视觉统一 | P0 |
| 门店定位校准 | 确保所有门店位置准确 | P1 |
| 批量操作 | 支持多门店批量更新 | P1 |

### 2. 跨区域GEO策略

**区域划分策略**：
- 核心商圈：高曝光优先
- 新兴区域：品牌建设优先
- 竞争激烈区：差异化策略

**多语言/本地化**：
- 中文简体/繁体支持
- 英文本地化优化
- 少数民族语言支持（如适用）

### 3. 定制化平台对接

| 平台类型 | 对接服务 |
|----------|----------|
| 主流地图 | Google/百度/高德/腾讯 |
| 本地生活 | 大众点评/美团/口碑 |
| 社交媒体 | 微信/微博/小红书 |
| 企业系统 | API开放支持 |

### 4. 专属客户成功经理

**服务配置**：
- 🎯 专属客户成功经理1名
- 📱 7x24小时紧急响应
- 📊 实时数据看板访问
- 🎓 季度业务增长培训

---

## 📊 实时数据看板

### 核心指标监控

| 指标 | 实时状态 | 日报 | 周报 | 月报 |
|------|----------|------|------|------|
| 曝光量 | ✅ | ✅ | ✅ | ✅ |
| 点击率 | ✅ | ✅ | ✅ | ✅ |
| 转化率 | ✅ | ✅ | ✅ | ✅ |
| 评价健康度 | ✅ | ✅ | ✅ | ✅ |
| 排名变化 | ✅ | ✅ | ✅ | ✅ |
| 竞品对比 | - | - | ✅ | ✅ |

### 数据看板访问

- **URL**: 实时访问
- **更新频率**: 每小时
- **历史数据**: 12个月
- **导出功能**: Excel/CSV/PDF

---

## 🛡️ 危机公关快速响应

### 响应等级

| 等级 | 场景 | 响应时间 | 处理方式 |
|------|------|----------|----------|
| S级 | 重大舆情/曝光归零 | 30分钟 | 紧急处理+CEO通知 |
| A级 | 大量负面评价 | 2小时 | 专业公关团队介入 |
| B级 | 单条严重差评 | 4小时 | 标准公关流程 |
| C级 | 一般问题 | 24小时 | 常规处理 |

### 危机预案

1. **预防机制**
   - 7x24舆情监控
   - 评价预警系统
   - 竞品动态追踪

2. **应急响应**
   - 快速定位问题
   - 制定应对策略
   - 执行+效果追踪

3. **事后复盘**
   - 根因分析
   - 优化方案制定
   - 预防措施落地

---

## 📈 季度业务增长报告

### 报告内容

1. **整体GEO健康度评分**
2. **各平台表现分析**
3. **竞品对比洞察**
4. **季度目标达成情况**
5. **下季度优化建议**
6. **ROI分析报告**

### 报告会议

- **频率**: 每季度
- **时长**: 2小时
- **参与者**: 双方管理层
- **产出**: 双方签字确认

---

## 🔌 API数据接口

### 可用API

| 接口类型 | 权限 | 说明 |
|----------|------|------|
| 曝光数据 | 读 | 实时/历史曝光数据 |
| 排名数据 | 读 | 各关键词排名 |
| 评价数据 | 读 | 评价列表+分析 |
| 门店管理 | 读写 | 门店信息管理 |

### 技术支持

- **SLA**: 99.9%可用性
- **响应时间**: <1秒
- **文档**: 完整API文档
- **SDK**: Python/JavaScript/Go

---

## 📅 服务里程碑

| 阶段 | 时间 | 目标 | 验收标准 |
|------|------|------|----------|
| 启动期 | 第1个月 | 完成所有门店接入 | 100%接入 |
| 优化期 | 第2-3个月 | 核心指标提升 | 曝光+100% |
| 稳定期 | 第4-6个月 | 持续稳定增长 | 排名Top 3 |
| 成熟期 | 第7-12个月 | 行业领先 | 市场份额提升 |

---

## 👥 专属服务团队

| 角色 | 人数 | 职责 |
|------|------|------|
| 客户成功经理 | 1 | 整体协调、进度汇报 |
| GEO策略专家 | 2 | 策略制定、效果优化 |
| 内容运营 | 2 | 内容创作、发布管理 |
| 技术支持 | 1 | 数据分析、API对接 |
| 客服专员 | 2 | 日常响应、问题处理 |

---

## 📞 联系信息

**专属客服通道**：
- 企业服务热线：VIP专线
- 微信群：7x24小时在线
- 邮件：enterprise@fly-agent.xyz
- 紧急电话：24小时响应

---

## 📜 服务协议

本服务遵循ERC-8183 Protocol标准，所有交易通过智能合约托管，
确保服务透明度和资金安全。

**合约地址**: {COMMERCE_ADDRESS}  
**服务期限**: 一个月（自动续约）  
**付款方式**: USDT (BSC)

---

*本报告由 Fly GEO Agent 生成 | 企业级全托管服务 | Powered by ERC-8183 Protocol*
"""
    return report


def generate_geo_report(store_info: dict, package_type: str = "starter") -> str:
    """Generate GEO report based on package type."""
    
    generators = {
        "starter": generate_starter_diagnosis,
        "basic": generate_basic_optimization,
        "pro": generate_pro_report,
        "enterprise": generate_enterprise_report
    }
    
    generator = generators.get(package_type, generate_starter_diagnosis)
    return generator(store_info)


# ---------------------------------------------------------------------------
# ERC-8183 Task Handler
# ---------------------------------------------------------------------------

def process_task(job: dict) -> tuple[str, dict]:
    """
    Process a funded ERC-8183 job and return the GEO diagnostic result.
    
    The SDK calls this for each funded job automatically.
    Receives the full job dict, returns (result_string, metadata).
    """
    from bnbagent.erc8183 import JobDescription
    
    raw_description = job.get("description", "GEO诊断尝鲜")
    logger.info(f"Processing GEO job: {raw_description[:100]}...")
    
    # Parse job description
    parsed = JobDescription.from_str(raw_description)
    task_description = parsed.task if parsed else raw_description
    
    # Extract store info and package type
    store_info = parse_job_description(task_description)
    package_type = store_info.get("package_type", "starter")
    
    logger.info(f"Package type: {package_type}, Store: {store_info.get('store_name', 'N/A')}")
    
    # Generate GEO report
    report = generate_geo_report(store_info, package_type)
    
    # Return report and metadata
    metadata = {
        "agent": "fly-geo-agent",
        "package_type": package_type,
        "store_name": store_info.get("store_name", ""),
        "industry": store_info.get("industry", ""),
        "generated_at": datetime.now().isoformat()
    }
    
    logger.info(f"GEO report generated for {store_info.get('store_name', 'store')}")
    return report, metadata


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class GEODiagnosisRequest(BaseModel):
    """Direct GEO diagnosis request model."""
    store_name: str
    industry: str = ""
    address: str = ""
    contact: str = ""
    website: str = ""
    package_type: str = "starter"


class GEODiagnosisResponse(BaseModel):
    """GEO diagnosis response model."""
    success: bool
    package_type: str
    store_name: str
    report: str
    metadata: dict


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    agent: str
    version: str
    timestamp: str


# ---------------------------------------------------------------------------
# App Creation (Lazy Loading for Network Independence)
# ---------------------------------------------------------------------------

def get_config():
    """Get ERC-8183 config, lazy loading."""
    from bnbagent.erc8183.config import ERC8183Config
    from bnbagent.storage import LocalStorageProvider
    
    _storage = LocalStorageProvider.from_env()
    return ERC8183Config.from_env(storage=_storage)


def create_app() -> FastAPI:
    """Create FastAPI app with ERC-8183 integration."""
    from bnbagent.erc8183.server import create_erc8183_app
    
    config = get_config()
    return create_erc8183_app(config=config, on_job=process_task)


# Try to create app, but allow graceful fallback
try:
    app = create_app()
    APP_CREATED = True
except Exception as e:
    logger.warning(f"Could not connect to BSC network: {e}")
    logger.warning("Creating standalone app without ERC-8183 integration")
    
    # Create a standalone FastAPI app for testing
    app = FastAPI(title="Fly GEO Agent", version="1.0.0")
    APP_CREATED = False
    
    @app.get("/erc8183/health")
    async def erc8183_health():
        """Health check for ERC-8183 endpoints."""
        return {
            "status": "healthy" if APP_CREATED else "degraded",
            "erc8183_connected": APP_CREATED,
            "agent": "fly-geo-agent",
            "timestamp": datetime.now().isoformat()
        }

# ---------------------------------------------------------------------------
# Additional Direct HTTP Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Fly GEO Agent",
        "version": "1.0.0",
        "description": "GEO optimization service provider for local businesses",
        "erc8183_endpoints": {
            "health": "/erc8183/health",
            "negotiate": "/erc8183/negotiate",
            "status": "/erc8183/status"
        },
        "direct_endpoints": {
            "geo_diagnosis": "/geo-diagnosis",
            "packages": "/packages",
            "health": "/health"
        }
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if APP_CREATED else "degraded",
        agent="fly-geo-agent",
        version="1.0.0",
        timestamp=datetime.now().isoformat()
    )


@app.post("/geo-diagnosis", response_model=GEODiagnosisResponse)
async def geo_diagnosis(request: GEODiagnosisRequest):
    """
    Direct GEO diagnosis endpoint (for testing without ERC-8183).
    
    This endpoint allows direct testing of the GEO report generation.
    For production, use ERC-8183 protocol via /erc8183/* endpoints.
    """
    try:
        # Build store info
        store_info = {
            "store_name": request.store_name,
            "industry": request.industry,
            "address": request.address,
            "contact": request.contact,
            "website": request.website,
            "package_type": request.package_type
        }
        
        # Generate report
        report = generate_geo_report(store_info, request.package_type)
        
        return GEODiagnosisResponse(
            success=True,
            package_type=request.package_type,
            store_name=request.store_name,
            report=report,
            metadata={
                "agent": "fly-geo-agent",
                "generated_at": datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"GEO diagnosis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/packages", response_model=dict)
async def list_packages():
    """List available GEO packages."""
    return {
        "packages": GEO_PACKAGES,
        "default_currency": "USDT",
        "network": "BSC Mainnet"
    }


@app.get("/packages/{package_type}", response_model=dict)
async def get_package(package_type: str):
    """Get specific package details."""
    if package_type not in GEO_PACKAGES:
        raise HTTPException(status_code=404, detail=f"Package '{package_type}' not found")
    return GEO_PACKAGES[package_type]


@app.post("/geo-diagnosis-preview")
async def geo_diagnosis_preview(
    store_name: str,
    industry: str = "",
    address: str = "",
    package_type: str = "starter"
):
    """
    Preview GEO diagnosis report (GET request for quick testing).
    """
    store_info = {
        "store_name": store_name,
        "industry": industry,
        "address": address,
        "package_type": package_type
    }
    
    report = generate_geo_report(store_info, package_type)
    
    return {
        "success": True,
        "package_type": package_type,
        "store_name": store_name,
        "report": report
    }


# ---------------------------------------------------------------------------
# Startup Banner
# ---------------------------------------------------------------------------

_storage_info = "LocalStorageProvider"

print(f"""
{'='*60}
  Fly GEO Agent (ERC-8183 Provider)
{'='*60}
  Network:        BSC Mainnet (chain_id=56)
  RPC:            {os.getenv('RPC_URL', 'N/A')}
  Port:           {PORT}
  
  Contracts:
    Commerce:     {COMMERCE_ADDRESS}
    Router:       {ROUTER_ADDRESS}
    Policy:       {POLICY_ADDRESS}
  
  Provider:       {PROVIDER_WALLET}
  Storage:        {_storage_info}
  Paymaster:      {os.getenv('ERC8183_PAYMASTER_URL', 'N/A')}
  
  ERC-8183 Status: {'✅ Connected' if APP_CREATED else '⚠️ Standalone Mode'}
  
  ERC-8183 Endpoints:
    POST /erc8183/negotiate     — Negotiation
    GET  /erc8183/job/{{id}}      — Job details
    GET  /erc8183/status        — Agent status
    GET  /erc8183/health       — Health check
  
  Direct Endpoints (Testing):
    GET  /                       — Root info
    GET  /health                 — Health check
    POST /geo-diagnosis          — Direct GEO diagnosis
    GET  /geo-diagnosis-preview  — Quick preview (GET)
    GET  /packages               — List all packages
    GET  /packages/{{type}}       — Package details
  
  GEO Packages:
    starter:   9.9 USDT   — GEO诊断尝鲜
    basic:     59 USDT/月  — 基础GEO优化
    pro:       299 USDT/月 — 深度GEO代运营
    enterprise: 999 USDT/月 — 全托管代运营
{'='*60}
""")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(app, host="0.0.0.0", port=PORT)
