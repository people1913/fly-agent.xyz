#!/usr/bin/env python3
"""DeepSeek-powered GEO diagnosis - replaces template reports with real AI analysis."""

import os
import logging
import httpx
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger("fly-geo-agent")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

SYSTEM_PROMPT = """你是Fly GEO Agent，专业的本地商家AI搜索可见性诊断专家。
根据店铺信息生成GEO（Generative Engine Optimization）诊断报告。

核心要求：
1. Markdown格式输出
2. 包含：店铺信息表、AI搜索可见性评分(1-10)、各平台覆盖诊断、具体优化建议
3. 针对该店铺的行业和地区给出精准建议，不要泛泛而谈
4. 每个建议要具体到可执行步骤
5. 用中文，专业但易懂，避免技术术语
6. 不要出现Web3/链上/合约/区块链等术语
7. 报告结尾加：*本报告由 Fly GEO Agent 生成 | fly-agent.xyz*

套餐级别区分：
- starter(9.9): 基础诊断+5条建议
- basic(59/月): 完整诊断+10条建议+执行计划
- pro(299/月): 深度诊断+15条建议+月度计划+竞品分析
- enterprise(999/月): 全面诊断+20条建议+季度计划+竞品分析+专人对接方案"""


def diagnose(store_info: dict, package_type: str = "starter") -> str:
    """Call DeepSeek to generate real GEO diagnosis report."""
    now = datetime.now().strftime('%Y年%m月%d日 %H:%M')
    store_name = store_info.get('store_name', '未提供')
    industry = store_info.get('industry', '未提供')
    address = store_info.get('address', '未提供')
    contact = store_info.get('contact', '未提供')
    website = store_info.get('website', '未提供')

    user_prompt = f"""请为以下店铺生成GEO诊断报告。

## 店铺信息
- 店名：{store_name}
- 行业：{industry}
- 地址：{address}
- 联系：{contact}
- 网站：{website}
- 套餐级别：{package_type}

生成时间：{now}

请根据店铺的行业和地址，给出针对性的AI搜索可见性诊断和优化建议。"""

    if not DEEPSEEK_API_KEY:
        logger.warning("DeepSeek API key not configured, using fallback")
        return _fallback(store_info, package_type, now)

    try:
        resp = httpx.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
            json={
                "model": DEEPSEEK_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 3000,
                "temperature": 0.7
            },
            timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        report = data["choices"][0]["message"]["content"]
        logger.info(f"DeepSeek GEO report generated for {store_name}")
        return report
    except Exception as e:
        logger.error(f"DeepSeek API failed: {e}")
        return _fallback(store_info, package_type, now)


def _fallback(store_info: dict, package_type: str, now: str) -> str:
    """Fallback when DeepSeek unavailable."""
    return f"""# GEO诊断报告

**生成时间**: {now}
**服务套餐**: {package_type}

⚠️ AI诊断服务暂时不可用，请稍后重试。

店铺：{store_info.get('store_name', 'N/A')}
行业：{store_info.get('industry', 'N/A')}
地址：{store_info.get('address', 'N/A')}

联系我们：https://fly-agent.xyz

*本报告由 Fly GEO Agent 生成 | fly-agent.xyz*"""
