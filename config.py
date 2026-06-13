"""
配置文件 - 管理所有敏感配置
请复制 .env.example 为 .env 并填入实际值
"""
import os

# Coze API配置
COZE_API_TOKEN = os.environ.get('COZE_API_TOKEN', '')
COZE_BOT_ID = os.environ.get('COZE_BOT_ID', '')
COZE_USER_ID = os.environ.get('COZE_USER_ID', '')

# 蝉镜API配置
CHANJING_AK = os.environ.get('CHANJING_AK', '')  # 蝉镜Access Key
CHANJING_SK = os.environ.get('CHANJING_SK', '')  # 蝉镜Secret Key
CHANJING_API_KEY = os.environ.get('CHANJING_API_KEY', '')  # 兼容旧版（直接API密钥）
