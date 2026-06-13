#!/usr/bin/env python3
"""
FLY智能营销助手 - 企业微信智能机器人 v6

v5→v6 核心升级：补齐四步闭环
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
① 记得住：客户档案自动提取 + JSON持久化 + 二次来访识别
② 出得全：文案+配图（保持v5能力）
③ 发得出：标准化输出格式（保持v5能力）
④ 回得来：方案发出后代码控制追问 + 效果反馈识别 + 方案历史

从竞品补的：
- 多维客户画像（6维度：行业/店名/痛点/风格/平台/老板称呼）
- 效果反馈闭环（满意→锁定风格 / 不满意→换方向）
- enter_chat智能识别（老用户不重复发欢迎语）
- 3轮递进引导（每轮展示已建档信息）
- 个性化锁死话术（展示客户档案+推荐套餐）
- 铁律第10条修正（允许代码控制追问，禁止Bot机械追问）
"""

import asyncio
import io
import json
import logging
import os
import platform
import re
import signal
import sys
import time
from collections import OrderedDict
from datetime import datetime, timedelta

import requests
from wecom_aibot_sdk import WSClient, generate_req_id, DefaultLogger, WeComMediaType

# ====== 配置 ======
WECOM_BOT_ID = "aibuBmU-brY2KyqNIRr5iUquqzf2Lq-mONe"
WECOM_BOT_SECRET = "ZINkK7Oh2OhD5lrJ2ujGdEyjebRt9EczpWrklpwV7Sj"

COZE_BOT_ID = "7634446147243311138"
COZE_API_TOKEN = "sat_TZOQ6PbNVji5YHZoqzr8bFzCWN5I8k7wEDyan9kfaVBfrBladvimJksZynzIZNaq"
COZE_API_URL = "https://api.coze.cn/v3/chat"

# 客户档案持久化目录
PROFILE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_profiles")
os.makedirs(PROFILE_DIR, exist_ok=True)

# ====== 日志配置 ======
logger_instance = logging.getLogger("fly_aibot_v6")
logger_instance.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger_instance.addHandler(handler)


# ====== 文案质量铁律（v6修正版）======
QUALITY_INSTRUCTION = """
【文案质量铁律——必须严格遵守，违反直接删除该段落】
1. 禁止输出"配图建议""图片建议""封面建议""建议配图""配图说明"。如果需要配图说明，只写"FLY已为你生成专属配图"。
2. 文案必须有人物、有场景、有情绪，禁止空洞卖点罗列。例如不说"专业养生馆"，说"张姐下班拐进来，肩上那块硬疙瘩揉完她长出一口气——'终于活了'"。
3. 禁止输出"XX区XX路""XX区""XX路""X路X号""X市X区""XX路XX号"等任何占位符。如果客户没给地址，用情感场景替代，不要留填空。
4. 禁止输出"XX区上班族"等模板占位符。
5. 标题必须口语化、有冲击力。不要"XX区上班族必冲"这种模板句。
6. 文案要有反转刺穿感，不要鸡汤安慰。
7. 每条文案必须可以直接复制发布，禁止出现"请替换""请修改""根据实际情况""请根据""可补充"等指令。
8. 热门话题/标签自然融入文案末尾，不要单独列一栏。
9. 不要在文案开头加"您好""你好"等寒暄语。客户说了需求，直接给文案，像朋友直接甩内容过来。
10. 禁止Bot自己加追问语（如"效果怎么样""给我说说"等）。追问由代码控制，Bot不要自作主张。
"""


# ====== 客户档案自动提取器 ======
class ProfileExtractor:
    """从用户消息中提取客户画像（6维度）"""

    INDUSTRY_MAP = {
        "奶茶": "奶茶店", "茶饮": "奶茶店", "果茶": "奶茶店",
        "火锅": "火锅店", "烧烤": "烧烤店", "串串": "串串店",
        "烘焙": "烘焙店", "蛋糕": "烘焙店", "面包": "烘焙店",
        "美甲": "美甲店", "美睫": "美睫店", "美业": "美容美甲",
        "美容": "美容院", "皮肤管理": "美容院", "养生": "养生馆",
        "足疗": "足疗店", "按摩": "按摩店", "SPA": "SPA馆",
        "服装": "服装店", "女装": "服装店", "男装": "服装店",
        "花店": "花店", "鲜花": "花店",
        "宠物": "宠物店", "猫咖": "宠物店",
        "健身": "健身房", "瑜伽": "瑜伽馆",
        "培训": "培训机构", "教育": "教育机构", "辅导": "培训机构",
        "酒吧": "酒吧", "清吧": "酒吧",
        "民宿": "民宿", "酒店": "酒店",
        "摄影": "摄影店", "写真": "摄影店",
        "汽车": "汽车服务", "洗车": "汽车服务", "汽修": "汽车服务",
        "房产": "房产中介", "中介": "房产中介",
        "餐饮": "餐饮", "饭店": "餐饮", "餐厅": "餐饮",
        "水果": "水果店", "便利店": "便利店", "超市": "便利店",
    }

    PLATFORM_MAP = {
        "朋友圈": "朋友圈", "微信": "朋友圈",
        "小红书": "小红书", "红书": "小红书",
        "抖音": "抖音", "短视频": "抖音",
        "快手": "快手",
        "大众点评": "大众点评", "点评": "大众点评",
    }

    @classmethod
    def extract(cls, message: str, current_profile: dict = None) -> dict:
        """从消息中提取/更新客户画像，返回需要更新的字段"""
        if current_profile is None:
            current_profile = {}

        updates = {}
        msg = message.strip()

        # 1. 行业识别
        for keyword, industry in cls.INDUSTRY_MAP.items():
            if keyword in msg and not current_profile.get("industry"):
                updates["industry"] = industry
                break

        # 2. 店名识别
        shop_patterns = [
            r'(?:我的店叫|店名叫|叫)["\s]*([^，。！？\n]{2,10})',
            r'(?:我是|我叫)([^，。！？\n]{2,6})(?:的|老板|店长|老板娘)',
            r'([^，。！？\n]{2,8})(?:的老板|老板娘|店长)',
        ]
        if not current_profile.get("shop_name"):
            for pattern in shop_patterns:
                m = re.search(pattern, msg)
                if m:
                    updates["shop_name"] = m.group(1).strip()
                    break

        # 3. 痛点识别
        pain_keywords = {
            "没人来": "客流少", "没客人": "客流少", "生意差": "生意差",
            "没人知道": "知名度低", "没人认识": "知名度低", "没知名度": "知名度低",
            "留不住客": "复购低", "回头客少": "复购低", "客户流失": "复购低",
            "竞争大": "竞争激烈", "旁边开了": "竞争激烈", "对面开了": "竞争激烈",
            "不会写": "不会写文案", "不会营销": "不会营销",
            "引流": "需要引流", "获客": "需要获客", "拉新": "需要拉新",
        }
        pains = list(current_profile.get("pain_points", []))
        for keyword, pain in pain_keywords.items():
            if keyword in msg and pain not in pains:
                pains.append(pain)
        if pains and pains != list(current_profile.get("pain_points", [])):
            updates["pain_points"] = pains[:5]

        # 4. 风格偏好
        style_map = {
            "接地气": "接地气", "实在": "接地气", "大白话": "接地气",
            "文艺": "文艺", "清新": "文艺", "小资": "文艺",
            "搞笑": "搞笑", "幽默": "搞笑", "段子": "搞笑",
            "专业": "专业", "正式": "专业",
            "温情": "温情", "走心": "温情", "暖心": "温情",
        }
        if not current_profile.get("style"):
            for keyword, style in style_map.items():
                if keyword in msg:
                    updates["style"] = style
                    break

        # 5. 平台偏好
        platforms = list(current_profile.get("platforms", []))
        for keyword, platform in cls.PLATFORM_MAP.items():
            if keyword in msg and platform not in platforms:
                platforms.append(platform)
        if platforms and platforms != list(current_profile.get("platforms", [])):
            updates["platforms"] = platforms[:4]

        # 6. 老板称呼
        name_patterns = [
            r'(?:叫我|我是)([^，。！？\n]{2,4})(?:姐|哥|老板|老板娘)',
            r'([^，。！？\n]{2,4})(?:姐|哥|老板|老板娘)(?:好|的)',
        ]
        if not current_profile.get("boss_name"):
            for pattern in name_patterns:
                m = re.search(pattern, msg)
                if m:
                    raw = m.group(0)
                    title = ""
                    if "老板娘" in raw: title = "老板娘"
                    elif "姐" in raw: title = "姐"
                    elif "哥" in raw: title = "哥"
                    elif "老板" in raw: title = "老板"
                    name = m.group(1).strip()
                    if name and title:
                        updates["boss_name"] = f"{name}{title}"
                    break


        # 7. 预算
        if not current_profile.get("budget"):
            m_budget = re.search(r'(?:预算|花|投入|费用)(?:大概|大约|约)?(\d+)(?:元|块|万)', msg)
            if m_budget:
                updates["budget"] = m_budget.group(1)

        # 8. 地址
        if not current_profile.get("location"):
            m_loc = re.search(r'([^，。！？\n]{2,6}(?:区|路|街|镇|县))', msg)
            if m_loc and len(m_loc.group(1).strip()) >= 2:
                updates["location"] = m_loc.group(1).strip()

        # 9. 目标人群
        audience_map = {"上班族": "上班族", "白领": "上班族", "学生": "学生",
            "年轻人": "年轻人", "宝妈": "宝妈", "情侣": "情侣", "中老年": "中老年"}
        if not current_profile.get("target_audience"):
            for kw, aud in audience_map.items():
                if kw in msg:
                    updates["target_audience"] = aud
                    break

        # 10. 竞品
        for kw in ["旁边", "对面", "隔壁"]:
            if kw in msg:
                comps = list(current_profile.get("competitors", []))
                m_comp = re.search(kw + r'(?:的|有|开了)([^，。！？\n]{2,8})', msg)
                if m_comp and m_comp.group(1).strip() not in comps:
                    comps.append(m_comp.group(1).strip())
                    updates["competitors"] = comps[:3]
                break

        return updates


# ====== 用户状态管理（v6完整版）======
class UserManager:
    """
    管理用户的使用次数、付费状态、客户档案、方案历史
    v6新增：profile/plan_history/feedback字段 + JSON持久化 + 过期检查
    """
    FREE_ROUNDS = 3

    def __init__(self, profile_dir: str = PROFILE_DIR):
        self._users = {}
        self._profile_dir = profile_dir
        self._load_all()

    def _profile_path(self, user_id: str) -> str:
        safe_id = re.sub(r'[^a-zA-Z0-9_]', '_', user_id)
        return os.path.join(self._profile_dir, f"{safe_id}.json")

    def _load_all(self):
        if not os.path.exists(self._profile_dir):
            return
        for fname in os.listdir(self._profile_dir):
            if fname.endswith('.json'):
                try:
                    with open(os.path.join(self._profile_dir, fname), 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        user_id = data.get("user_id", fname.replace('.json', ''))
                        self._users[user_id] = data
                except Exception as e:
                    logger_instance.warning(f"加载用户档案失败 {fname}: {e}")
        logger_instance.info(f"已加载 {len(self._users)} 个用户档案")

    def _save(self, user_id: str):
        if user_id not in self._users:
            return
        try:
            path = self._profile_path(user_id)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(self._users[user_id], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger_instance.error(f"保存用户档案失败 {user_id}: {e}")

    def get_user(self, user_id: str) -> dict:
        if user_id not in self._users:
            self._users[user_id] = {
                "user_id": user_id,
                "round": 0,
                "paid": False,
                "paid_type": None,
                "paid_expire": None,
                "profile": {
                    "industry": None,
                    "shop_name": None,
                    "pain_points": [],
                    "style": None,
                    "platforms": [],
                    "boss_name": None,
                    "budget": None,
                    "competitors": [],
                    "mood": None,
                    "business_hours": None,
                    "location": None,
                    "target_audience": None,
                },
                "plan_history": [],
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "last_active": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "last_followup": None,
                "visit_count": 0,
            }
            self._save(user_id)
        return self._users[user_id]

    def is_locked(self, user_id: str) -> bool:
        user = self.get_user(user_id)
        if user["paid"] and user.get("paid_expire"):
            try:
                expire = datetime.strptime(user["paid_expire"], "%Y-%m-%d %H:%M")
                if datetime.now() > expire:
                    user["paid"] = False
                    user["paid_type"] = None
                    self._save(user_id)
            except ValueError:
                pass
        return not user["paid"] and user["round"] >= self.FREE_ROUNDS

    def increment(self, user_id: str) -> int:
        user = self.get_user(user_id)
        user["round"] += 1
        user["last_active"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        self._save(user_id)
        return user["round"]

    def remaining(self, user_id: str) -> int:
        user = self.get_user(user_id)
        if user["paid"]:
            return 999
        return max(0, self.FREE_ROUNDS - user["round"])

    def unlock(self, user_id: str, paid_type: str = "monthly"):
        user = self.get_user(user_id)
        user["paid"] = True
        user["paid_type"] = paid_type
        duration_map = {"7day": 7, "monthly": 30, "yearly": 365}
        days = duration_map.get(paid_type, 30)
        if days:
            user["paid_expire"] = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d %H:%M")
        else:
            user["paid_expire"] = None
        self._save(user_id)

    def update_profile(self, user_id: str, updates: dict):
        user = self.get_user(user_id)
        profile = user.get("profile", {})
        for key, value in updates.items():
            profile[key] = value
        user["profile"] = profile
        user["last_active"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        self._save(user_id)
        logger_instance.info(f"更新客户画像 {user_id}: {updates}")

    def add_plan(self, user_id: str, plan_name: str, channels: list = None, style: str = None):
        user = self.get_user(user_id)
        plan = {
            "name": plan_name,
            "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "style": style or user.get("profile", {}).get("style", ""),
            "channels": channels or [],
            "feedback": None,
        }
        user["plan_history"].append(plan)
        if len(user["plan_history"]) > 20:
            user["plan_history"] = user["plan_history"][-20:]
        self._save(user_id)
        logger_instance.info(f"记录方案 {user_id}: {plan_name}")

    def update_plan_feedback(self, user_id: str, feedback: str):
        user = self.get_user(user_id)
        if user["plan_history"]:
            user["plan_history"][-1]["feedback"] = feedback
            self._save(user_id)
            logger_instance.info(f"方案反馈 {user_id}: {feedback}")

    def get_last_plan(self, user_id: str) -> dict:
        user = self.get_user(user_id)
        if user["plan_history"]:
            return user["plan_history"][-1]
        return None

    def is_returning(self, user_id: str) -> bool:
        user = self.get_user(user_id)
        return len(user.get("plan_history", [])) > 0

    def get_boss_name(self, user_id: str) -> str:
        user = self.get_user(user_id)
        return user.get("profile", {}).get("boss_name", "")

    def record_visit(self, user_id: str):
        user = self.get_user(user_id)
        user["visit_count"] = user.get("visit_count", 0) + 1
        user["last_active"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        self._save(user_id)


user_manager = UserManager()

# ====== 同行案例库 ======
CASE_LIBRARY = {
    "奶茶店": [
        {"name": "清凉一夏·暑假促销", "platform": "朋友圈", "style": "活力",
         "copy": "隔壁奶茶店排队到门口，我的店却没人进。不是味道差，是你还没让人知道。5年老店，熟客都夸好，就是新客不来。转发这条，周三免费喝。",
         "effect": "活动当天到店率提升180%"},
        {"name": "新品尝鲜·限时免费", "platform": "小红书", "style": "接地气",
         "copy": "开奶茶店5年，第一次做杨枝甘露。怕翻车，先请你免费喝。仅限本周六，前50名。",
         "effect": "小红书曝光5万+，到店转化35%"},
        {"name": "会员日·第二杯1元", "platform": "抖音", "style": "搞笑",
         "copy": "别人家第二杯半价，我家第二杯1块钱。不是因为我不赚钱，是因为我喝过你推荐的奶茶也想回个礼。",
         "effect": "会员日当天营业额翻3倍"},
    ],
    "火锅店": [
        {"name": "母亲节·带妈妈吃顿好的", "platform": "朋友圈", "style": "温情",
         "copy": "母亲节，带妈妈吃顿好的。不是外卖，是坐下来，涮着毛肚聊着天的那种。到店消费满200送198套餐。",
         "effect": "活动当天到店率提升180%"},
        {"name": "深夜食堂·22点后半价", "platform": "小红书", "style": "文艺",
         "copy": "加班到10点，楼下火锅还亮着灯。老板说22点后半价，锅底随便选。深夜的火锅，比白天更治愈。",
         "effect": "夜间客流从5桌涨到25桌"},
    ],
    "烘焙店": [
        {"name": "520·用甜品说爱", "platform": "小红书", "style": "浪漫",
         "copy": "520，用甜品说爱。买一送一，表白蛋糕限时抢。不是我甜，是你该对TA甜一点。",
         "effect": "小红书曝光10万+，到店转化35%"},
    ],
    "美甲店": [
        {"name": "指尖换新·预约爆满中", "platform": "朋友圈", "style": "精致",
         "copy": "过年做美甲，来年运气好~春夏新款到了，预约已经排到下周。这周还有3个空档，手慢无。",
         "effect": "预约转化率60%"},
    ],
    "美容院": [
        {"name": "换季护肤·皮肤管理师支招", "platform": "小红书", "style": "专业",
         "copy": "换季脸干到起皮？别乱涂了。皮肤管理师1对1方案，第一次体验只要9.9。你的脸，值得一次认真对待。",
         "effect": "新客增长200%"},
    ],
    "养生馆": [
        {"name": "张姐的长出一口气", "platform": "朋友圈", "style": "接地气",
         "copy": "张姐下班拐进来，肩上那块硬疙瘩揉完她长出一口气——'终于活了'。不是推拿，是活过来了。新客体验价68。",
         "effect": "新客转化率45%"},
    ],
    "服装店": [
        {"name": "试衣间自由", "platform": "朋友圈", "style": "搞笑",
         "copy": "试了8件买了2件，店员说姐你再试试。这才是逛街该有的待遇，不用看脸色，不用赶时间。新到春装，来试。",
         "effect": "到店试穿率提升90%"},
    ],
    "健身房": [
        {"name": "你不是没时间", "platform": "抖音", "style": "反转",
         "copy": "你说没时间健身，但刷短视频一刷两小时。每天30分钟，换一个好身体。不是鸡汤，是算账。首月99，不续不收。",
         "effect": "体验课转化率28%"},
    ],
    "花店": [
        {"name": "每周一花·治愈打工日", "platform": "小红书", "style": "文艺",
         "copy": "周一最需要的不只是咖啡，还有一束花。19.9每周一花，包月79。你的工位，值得被认真装饰。",
         "effect": "包月订阅客户月增40%"},
    ],
    "宠物店": [
        {"name": "它不会说话但它在等你", "platform": "朋友圈", "style": "走心",
         "copy": "你上班它在家，等你回来尾巴摇成螺旋桨。周末带它来洗个澡吧，它不会说谢谢，但它会蹭你。新客洗澡+美容套餐58。",
         "effect": "周末预约满员率95%"},
    ],
}

INDUSTRY_ALIASES = {
    "茶饮店": "奶茶店", "果茶店": "奶茶店", "串串店": "火锅店",
    "蛋糕店": "烘焙店", "面包店": "烘焙店", "美睫店": "美甲店",
    "美容美甲": "美甲店", "皮肤管理": "美容院",
    "足疗店": "养生馆", "按摩店": "养生馆", "SPA馆": "养生馆",
    "女装店": "服装店", "男装店": "服装店", "瑜伽馆": "健身房",
    "鲜花店": "花店", "猫咖": "宠物店", "餐饮": "火锅店",
}

def find_cases(industry, limit=2):
    cases = CASE_LIBRARY.get(industry, [])
    if not cases:
        alias = INDUSTRY_ALIASES.get(industry)
        if alias:
            cases = CASE_LIBRARY.get(alias, [])
    return cases[:limit]

def format_cases(cases):
    if not cases:
        return ""
    parts = []
    for c in cases:
        parts.append(f"📋 同行案例·{c['name']}（{c['platform']}）\n效果：{c['effect']}\n文案：{c['copy'][:60]}...")
    return "\n\n".join(parts)

# ====== SOP自动跟进 ======
FOLLOWUP_SCRIPTS = {
    "1hour": "{boss_name}，还在吗？刚才帮你做的方案还满意吗？你还有{remaining}次免费体验没用哦~",
    "24hour": "{boss_name}，昨天帮你做的方案用了没？如果效果不好告诉我，我帮你换个方向~",
    "3day": "{boss_name}，3天没见了~上次{industry}的方案试了没？\n限时优惠：9.9元7天无限次，优惠码「FIRST99」\n回复「解锁」就行",
    "7day": "{boss_name}，最后一次打扰~\n你的需求我记着呢：{shop_name}（{industry}），痛点{pain_str}\n年卡999元=83元/月，每天不到3块钱\n回复「解锁」或直接说需求，我还在",
}
FOLLOWUP_NODES = [
    {"delay_hours": 1, "key": "1hour"},
    {"delay_hours": 24, "key": "24hour"},
    {"delay_hours": 72, "key": "3day"},
    {"delay_hours": 168, "key": "7day"},
]



# ====== 蝉镜数字人 ======
CHANJING_APP_ID = "cfe043af"
CHANJING_SECRET = "a63880e2d21545dcac9297b6e9993cfe"
CHANJING_BASE = "https://www.chanjing.cc/api"

def _get_chanjing_token():
    try:
        resp = requests.post(
            f"{CHANJING_BASE}/open/v1/access_token",
            json={"app_id": CHANJING_APP_ID, "secret_key": CHANJING_SECRET},
            timeout=10
        )
        data = resp.json()
        if data.get("code") == 0:
            return data["data"]["access_token"]
        logger_instance.error(f"蝉镜token失败: {data}")
        return None
    except Exception as e:
        logger_instance.error(f"蝉镜token异常: {e}")
        return None

def create_chanjing_video(text: str, timeout: int = 120) -> str:
    text = text[:15] if len(text) > 15 else text
    token = _get_chanjing_token()
    if not token:
        return None
    payload = {
        "person": {
            "id": "4fb93b8a099c496c90da45cbad37b32f",
            "x": 0, "y": 0, "width": 1080, "height": 1920,
            "figure_type": "whole_body"
        },
        "audio": {
            "tts": {
                "text": [text], "speed": 1,
                "audio_man": "C-CASE-38f44fdd1928442e9932fe38e67c5f2b"
            },
            "type": "tts", "volume": 100, "language": "cn"
        },
        "bg_color": "#EDEDED", "screen_width": 1080, "screen_height": 1920
    }
    try:
        resp = requests.post(
            f"{CHANJING_BASE}/open/v1/create_video",
            headers={"access_token": token}, json=payload, timeout=15
        )
        data = resp.json()
        if data.get("code") != 0:
            logger_instance.error(f"蝉镜创建视频失败: {data}")
            return None
        video_id = data["data"]
        logger_instance.info(f"蝉镜视频创建成功: {video_id}")
    except Exception as e:
        logger_instance.error(f"蝉镜创建视频异常: {e}")
        return None
    start = time.time()
    while time.time() - start < timeout:
        time.sleep(5)
        try:
            resp = requests.get(
                f"{CHANJING_BASE}/open/v1/video",
                params={"id": video_id},
                headers={"access_token": token}, timeout=10
            )
            data = resp.json()
            if data.get("code") == 0:
                status = data["data"].get("status")
                if status == 30:
                    return data["data"].get("video_url")
                elif status == 40:
                    logger_instance.error(f"蝉镜视频生成失败: {data}")
                    return None
        except Exception as e:
            logger_instance.error(f"蝉镜轮询异常: {e}")
    logger_instance.error("蝉镜视频生成超时")
    return None

def check_followup(user_data):
    if user_data.get("paid"):
        return None
    last_active_str = user_data.get("last_active")
    if not last_active_str:
        return None
    try:
        last_active = datetime.strptime(last_active_str, "%Y-%m-%d %H:%M")
    except ValueError:
        return None
    hours_since = (datetime.now() - last_active).total_seconds() / 3600
    last_fu = user_data.get("last_followup") or {}
    profile = user_data.get("profile", {})
    boss_name = profile.get("boss_name") or "老板"
    industry = profile.get("industry") or "您的行业"
    shop_name = profile.get("shop_name") or "您的店铺"
    pain_str = "、".join(profile.get("pain_points", [])[:3]) or "待了解"
    remaining = max(0, 3 - user_data.get("round", 0))
    for node in FOLLOWUP_NODES:
        if hours_since < node["delay_hours"]:
            break
        if last_fu.get(node["key"]):
            continue
        template = FOLLOWUP_SCRIPTS.get(node["key"])
        if not template:
            continue
        msg = template.format(boss_name=boss_name, industry=industry,
                              shop_name=shop_name, pain_str=pain_str, remaining=remaining)
        return (node["key"], msg)
    return None




# ====== 3轮递进引导 ======
def get_round_hint(round_num: int, profile: dict) -> str:
    industry = profile.get("industry") or "待识别"
    shop_name = profile.get("shop_name") or "您的店铺"
    pain_points = profile.get("pain_points", [])
    pain_str = "、".join(pain_points[:3]) if pain_points else "待了解"
    style = profile.get("style") or "待确认"

    if round_num == 1:
        return (
            f"📝 已记录：{shop_name}（{industry}）\n\n"
            f"你还有2次免费体验，继续说需求就行~\n"
            f"比如「帮我做个母亲节活动」「想引流周边3公里客户」"
        )
    elif round_num == 2:
        return (
            f"📝 你的档案：{shop_name}（{industry}）\n"
            f"痛点：{pain_str}\n\n"
            f"⚠️ 最后1次免费体验！想要什么尽管说~\n"
            f"「帮我做朋友圈方案」「给我来条小红书笔记」"
        )
    elif round_num >= 3:
        return get_locked_message(profile)

    return ""


def get_locked_message(profile: dict) -> str:
    industry = profile.get("industry") or "您的行业"
    shop_name = profile.get("shop_name") or "您的店铺"
    pain_points = profile.get("pain_points", [])
    pain_str = "、".join(pain_points[:3]) if pain_points else "待了解"
    style = profile.get("style") or "待确认"
    boss_name = profile.get("boss_name") or "老板"

    return (
        f"🎁 {boss_name}，免费体验已用完！\n\n"
        f"我已经记住了你的信息：\n"
        f"🏪 {shop_name}（{industry}）\n"
        f"💡 痛点：{pain_str}\n"
        f"✍️ 风格偏好：{style}\n\n"
        f"解锁完整版，我继续帮你：\n"
        f"━━━━━━━━━━━━━\n"
        f"💰 9.9元/7天体验\n"
        f"🔥 59元/月（推荐）\n"
        f"👑 999元/年卡（83元/月）\n"
        f"━━━━━━━━━━━━━\n\n"
        f"回复「解锁」了解详情\n"
        f"优惠码「FIRST99」可用"
    )


# ====== 二次来访识别 ======
def get_returning_greeting(user_id: str) -> str:
    user = user_manager.get_user(user_id)
    profile = user.get("profile", {})
    boss_name = profile.get("boss_name") or "老板"
    last_plan = user_manager.get_last_plan(user_id)

    if last_plan:
        plan_name = last_plan.get("name", "那套方案")
        feedback = last_plan.get("feedback")

        if feedback == "满意":
            return f"{boss_name}，上次「{plan_name}」效果不错吧？要继续同一风格再来一套？"
        elif feedback == "需调整":
            return f"{boss_name}，上次「{plan_name}」说效果不太行，这次换个方向？"
        else:
            return f"{boss_name}！上次「{plan_name}」发了没？效果怎么样？"
    else:
        industry = profile.get("industry", "")
        if industry:
            return f"{boss_name}，又来了！{industry}这边还有什么要推的？"
        return f"{boss_name}，欢迎回来！有什么新需求？"


# ====== 效果反馈识别 ======
def detect_feedback(message: str) -> str:
    positive_keywords = [
        "不错", "很好", "可以", "有人问", "有客户", "效果好", "有人来",
        "赞", "行", "挺棒", "很赞", "火了", "爆了", "咨询多了", "有转化",
        "满意", "可以可以", "牛", "厉害",
    ]
    negative_keywords = [
        "没人问", "没效果", "不行", "不好", "没变化", "没客户",
        "太差", "没反响", "没人看", "没咨询", "没用", "浪费",
        "不好使", "没动静", "一般般", "不理想",
    ]

    msg = message.strip()
    for kw in negative_keywords:
        if kw in msg:
            return "需调整"
    for kw in positive_keywords:
        if kw in msg:
            return "满意"
    return None


# ====== 方案名称提取 ======
def extract_plan_name(bot_reply: str) -> str:
    lines = [l.strip() for l in bot_reply.split('\n') if l.strip()]
    if lines:
        return lines[0][:20]
    return "营销方案"


# ====== 消息去重器 ======
class MessageDeduplicator:
    def __init__(self, max_size=2000, ttl_seconds=120):
        self._cache = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds

    def _make_key(self, msg_id: str = "", from_user: str = "", content: str = "") -> str:
        content_hint = content[:50] if content else ""
        return f"{msg_id}:{from_user}:{content_hint}"

    def is_duplicate(self, msg_id: str = "", from_user: str = "", content: str = "") -> bool:
        now = time.time()
        key = self._make_key(msg_id, from_user, content)

        expired = [k for k, (ts, _) in self._cache.items() if now - ts > self._ttl]
        for k in expired:
            del self._cache[k]

        if key in self._cache:
            return True

        self._cache[key] = (time.time(), True)

        while len(self._cache) > self._max_size:
            self._cache.popitem(last=False)

        return False


deduplicator = MessageDeduplicator()


# ====== 清洗扣子Bot输出 ======
def _clean_coze_output(text: str) -> str:
    if not text:
        return text

    text = re.sub(r'\{[^{}]*"log_id"[^{}]*\}', '', text)
    text = re.sub(r'\{[^{}]*"plugin_id"[^{}]*\}', '', text)
    text = re.sub(r'\{[^{}]*"msg_type"[^{}]*\}', '', text)
    text = re.sub(r'\{[^{}]*"arguments"[^{}]*\}', '', text)
    text = re.sub(r'\{[^{}]*"image_urls"[^{}]*\}', '', text)
    text = re.sub(r'\{"name":"doubaotuxiangshengcheng[^}]*\}', '', text)

    text = re.sub(r'!\[.*?\]\(https?://[^\)]+\)', '', text)
    text = re.sub(r'\[图片?\]\(https?://[^\)]+\)', '', text)

    text = re.sub(r'再发一条.*$', '', text, flags=re.DOTALL)
    text = re.sub(r'推荐一些.*$', '', text, flags=re.DOTALL)
    text = re.sub(r'朋友圈配图有哪些.*$', '', text, flags=re.DOTALL)

    paragraphs = text.split('\n')
    seen = set()
    unique_paragraphs = []
    for p in paragraphs:
        stripped = p.strip()
        if not stripped:
            unique_paragraphs.append(p)
            continue
        normalized = re.sub(r'\s+', '', stripped)
        if normalized not in seen:
            seen.add(normalized)
            unique_paragraphs.append(p)

    text = '\n'.join(unique_paragraphs)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


# ====== 后处理函数 ======
def post_process_reply(text: str) -> str:
    if not text:
        return text

    lines = text.split('\n')
    result_lines = []
    skipping_section = False

    for line in lines:
        stripped = line.strip()

        if re.match(r'^#{1,3}\s', stripped) or re.match(r'^\*\*', stripped):
            skipping_section = False

        lower = stripped.lower()
        skip_keywords = ['配图建议', '图片建议', '封面建议', '配图说明', '建议配图', '热门话题', '热门标签']
        for kw in skip_keywords:
            if kw in lower:
                skipping_section = True
                break

        if '发布时间' in lower:
            skipping_section = True

        if skipping_section:
            continue

        result_lines.append(line)

    text = '\n'.join(result_lines)

    text = text.replace('XX区XX路XX号', '')
    text = text.replace('XX区XX路', '')
    text = text.replace('XX路XX号', '')
    for ph in ['XX号线XX站', 'XX号线', 'XX站', 'XX区', 'XX路', 'XX号', 'X路X号', 'X市X区', 'X号线', 'X站']:
        text = text.replace(ph, '')
    text = re.sub(r'X{2,}', '', text)
    text = re.sub(r'（可补充.*?）', '', text)
    text = re.sub(r'\(可补充.*?\)', '', text)
    text = re.sub(r'可补充具体.*', '', text)
    text = re.sub(r'\[.*?门牌号.*?\]', '', text)

    instruction_patterns = [
        r'这套发出去之后效果怎么样.*',
        r'给我说说.*调整下一套.*',
        r'[，。\n].*请[替换修改根据实际情况调整填写自行]+.*',
        r'.*请[替换修改根据实际情况调整填写自行]+.*',
        r'.*根据实际情况.*',
        r'.*可补充.*',
    ]
    for pattern in instruction_patterns:
        text = re.sub(pattern, '', text)

    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'!\[.*?\]\(https?://[^\)]+\)', '', text)
    text = re.sub(r'\[图片?\]\(https?://[^\)]+\)', '', text)
    text = re.sub(r'^[\-\•]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'【[^】]*(?:朋友圈|小红书|抖音|视频|文案|笔记|脚本|方案)[^】]*】\s*', '', text)

    text = re.sub(r'，\s*，', '，', text)
    text = re.sub(r'。\s*。', '。', text)
    text = re.sub(r'：\s*：', '：', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'^\n+', '', text)
    text = re.sub(r'\n+$', '', text)

    text = text.strip()
    if not text:
        return text
    text = re.sub(r'^您好[，。,\s、]*', '', text)
    text = re.sub(r'^你好[，。,\s、]*', '', text)
    text = re.sub(r'^哈喽[，。,\s、]*', '', text)
    text = re.sub(r'^嗨[，。,\s、]*', '', text)

    text = ' '.join(text.split())
    text = re.sub(r'，\s*，', '，', text)
    text = re.sub(r'。\s*。', '。', text)

    return text.strip()


# ====== 扣子API流式调用（v6：注入客户档案上下文）======
def call_coze_stream(content: str, user_id: str = "wecom_user", profile: dict = None) -> str:
    headers = {
        "Authorization": f"Bearer {COZE_API_TOKEN}",
        "Content-Type": "application/json"
    }

    profile_context = ""
    if profile:
        parts = []
        if profile.get("industry"):
            parts.append(f"行业：{profile['industry']}")
        if profile.get("shop_name"):
            parts.append(f"店名：{profile['shop_name']}")
        if profile.get("boss_name"):
            parts.append(f"称呼：{profile['boss_name']}")
        if profile.get("pain_points"):
            parts.append(f"痛点：{'、'.join(profile['pain_points'][:3])}")
        if profile.get("style"):
            parts.append(f"偏好风格：{profile['style']}")
        if profile.get("platforms"):
            parts.append(f"常用平台：{'、'.join(profile['platforms'][:3])}")
        if profile.get("budget"):
            parts.append(f"推广预算：{profile['budget']}元")
        if profile.get("location"):
            parts.append(f"店铺位置：{profile['location']}")
        if profile.get("target_audience"):
            parts.append(f"目标人群：{profile['target_audience']}")
        if profile.get("competitors"):
            parts.append(f"附近竞品：{'、'.join(profile['competitors'][:3])}")

        if parts:
            profile_context = f"\n\n【客户档案——根据这些信息个性化回复】\n" + "\n".join(f"- {p}" for p in parts) + "\n"

    plan_history = ""
    user_data = user_manager.get_user(user_id)
    recent_plans = user_data.get("plan_history", [])[-2:]
    if recent_plans:
        plan_parts = []
        for p in recent_plans:
            fb = p.get("feedback", "待确认")
            plan_parts.append(f"- {p.get('name', '方案')}（{p.get('style', '')}，反馈：{fb}）")
        plan_history = f"\n【方案历史——不要重复被否定的风格】\n" + "\n".join(plan_parts) + "\n"

    # 注入同行案例
    case_context = ""
    _ind = profile.get("industry") if profile else None
    if _ind:
        _cases = find_cases(_ind)
        if _cases:
            _cp = []
            for _c in _cases:
                _cp.append(f"- {_c['name']}（{_c['platform']}，{_c['style']}风格，效果：{_c['effect']}）\n  文案：{_c['copy'][:80]}")
            case_context = "\n【同行案例参考——可以借鉴结构和风格，但不要照搬】\n" + "\n".join(_cp) + "\n"

    guided_message = f"{QUALITY_INSTRUCTION}{profile_context}{plan_history}{case_context}\n客户需求：{content}"

    payload = {
        "bot_id": COZE_BOT_ID,
        "user_id": user_id,
        "stream": True,
        "auto_save_history": False,
        "additional_messages": [
            {
                "role": "user",
                "content": guided_message,
                "content_type": "text"
            }
        ]
    }

    content_deltas = []
    reasoning_deltas = []
    current_event = ""

    try:
        response = requests.post(
            COZE_API_URL,
            headers=headers,
            json=payload,
            stream=True,
            timeout=60
        )
    except requests.exceptions.Timeout:
        logger_instance.error("Coze API connection timeout")
        return None
    except Exception as e:
        logger_instance.error(f"Coze API connection error: {e}")
        return None

    if response.status_code != 200:
        logger_instance.error(f"Coze API HTTP {response.status_code}: {response.text[:200]}")
        return None

    try:
        for line in response.iter_lines(decode_unicode=False):
            if not line:
                continue

            try:
                decoded = line.decode('utf-8')
            except Exception:
                try:
                    decoded = line.decode('latin-1', errors='replace')
                except Exception:
                    continue

            if decoded.startswith('event:'):
                current_event = decoded[6:].strip()
                continue

            if decoded.startswith('data:'):
                data_str = decoded[5:].strip()
                if data_str == '[DONE]':
                    break

                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                if current_event != 'conversation.message.delta':
                    continue

                ct = data.get("content", "")
                rt = data.get("reasoning_content", "")

                if ct:
                    content_deltas.append(ct)
                elif rt:
                    reasoning_deltas.append(rt)

    except requests.exceptions.Timeout:
        logger_instance.error("Coze API read timeout")
        return None
    except Exception as e:
        logger_instance.error(f"Coze stream error: {e}")
        return None

    content_text = "".join(content_deltas)
    reasoning_text = "".join(reasoning_deltas)

    image_urls = []
    img_matches = re.findall(r'"image_urls":\s*\["(https?://[^"]+)"', content_text)
    image_urls.extend(img_matches)
    img_matches2 = re.findall(r'(https?://[^\s\)\"\]]+?\.(?:png|jpg|jpeg|webp))', content_text)
    for u in img_matches2:
        if u not in image_urls:
            image_urls.append(u)

    if content_text:
        content_text = _clean_coze_output(content_text)

    logger_instance.info(f"content={len(content_text)}字 reasoning={len(reasoning_text)}字 images={len(image_urls)}")

    if content_text:
        return {"text": content_text, "images": image_urls}
    elif reasoning_text:
        logger_instance.warning("content为空，降级使用reasoning_content")
        return reasoning_text
    else:
        return None


# ====== 下载图片并上传到企微 ======
async def download_and_upload_image(client: WSClient, img_url: str, index: int) -> str:
    try:
        resp = requests.get(img_url, timeout=30)
        if resp.status_code != 200:
            logger_instance.error(f"下载图片失败: HTTP {resp.status_code}")
            return None

        image_bytes = resp.content
        if len(image_bytes) < 100:
            logger_instance.error(f"图片太小({len(image_bytes)}字节)，可能无效")
            return None

        filename = f"fly_image_{index}.png"
        result = await client.upload_media(
            file_data=image_bytes,
            type="image",
            filename=filename
        )

        media_id = None
        if isinstance(result, dict):
            media_id = result.get("media_id")
        elif hasattr(result, 'media_id'):
            media_id = result.media_id

        if media_id:
            logger_instance.info(f"图片上传成功: media_id={media_id}")
            return media_id
        else:
            logger_instance.error(f"图片上传失败: {result}")
            return None

    except Exception as e:
        logger_instance.error(f"下载/上传图片异常: {e}")
        return None


# ====== 事件处理器 ======
def setup_event_handlers(client: WSClient):

    def on_connected():
        logger_instance.info("=" * 50)
        logger_instance.info("✅ WebSocket连接成功")
        logger_instance.info("=" * 50)
    client.on("connected", on_connected)

    def on_authenticated():
        logger_instance.info("=" * 50)
        logger_instance.info("🔐 FLY智能营销助手 v6 已上线！")
        logger_instance.info("  四步闭环 · 全+省心+有价值")
        logger_instance.info("=" * 50)
    client.on("authenticated", on_authenticated)

    def on_disconnected(reason):
        logger_instance.warning(f"连接断开: {reason}")
    client.on("disconnected", on_disconnected)

    def on_reconnecting(attempt):
        logger_instance.warning(f"正在第 {attempt} 次重连...")
    client.on("reconnecting", on_reconnecting)

    def on_error(error):
        logger_instance.error(f"发生错误: {error}")
    client.on("error", on_error)

    async def on_text_message(frame):
        body = frame.get("body", {})
        text_content = body.get("text", {}).get("content", "")
        from_user = body.get("from", {}).get("userid", "unknown")

        if "@" in text_content:
            parts = text_content.split(" ", 1)
            if len(parts) > 1:
                text_content = parts[1].strip()
            else:
                for mention in ["@FLY", "@Fly", "@fly"]:
                    text_content = text_content.replace(mention, "").strip()

        if not text_content:
            return

        msg_id = body.get("msgid", "")
        if deduplicator.is_duplicate(msg_id, from_user, text_content):
            logger_instance.info(f"跳过重复: msgid={msg_id} user={from_user}")
            return

        logger_instance.info(f"用户({from_user}): {text_content[:80]}")

        # ===== 闭环①：提取客户画像 =====
        user_data = user_manager.get_user(from_user)
        profile_updates = ProfileExtractor.extract(text_content, user_data.get("profile", {}))
        if profile_updates:
            user_manager.update_profile(from_user, profile_updates)
            user_data = user_manager.get_user(from_user)

        # ===== 闭环④：检测效果反馈 =====
        feedback = detect_feedback(text_content)
        if feedback:
            user_manager.update_plan_feedback(from_user, feedback)
            logger_instance.info(f"检测到反馈: {feedback}")
            stream_id = generate_req_id("feedback")
            if feedback == "满意":
                profile = user_data.get("profile", {})
                style = profile.get("style", "这个风格")
                fb_msg = f"太好了！{style}风格锁定✅\n\n继续用这个风格再来一套？\n回复需求我就给你生成~"
            else:
                fb_msg = f"收到，那换个方向试~\n\n告诉我这次想要什么感觉？\n比如「接地气点」「搞笑的」「走心路线」"
            await client.reply_stream(frame, stream_id, fb_msg, finish=True)
            return

        # 特殊关键词
        # 案例查询
        if stripped in ['案例', '同行案例', '看看同行']:
            sid = generate_req_id("case")
            _ind = user_data.get("profile", {}).get("industry")
            if _ind:
                _cs = find_cases(_ind)
                if _cs:
                    await client.reply_stream(frame, sid, format_cases(_cs), finish=True)
                    return
            await client.reply_stream(frame, sid, "告诉我你是什么行业，我给你看同行成功案例~\n比如「我是开奶茶店的」", finish=True)
            return

        # 爆款复刻
        if stripped.startswith('复刻') or stripped.startswith('参考'):
            link = stripped[2:].strip()
            if link and (link.startswith('http') or link.startswith('www')):
                sid = generate_req_id("viral")
                await client.reply_stream(frame, sid, "收到参考链接！我来分析爆款的钩子和结构，帮你做同风格~", finish=False)
                viral_prompt = (f"【爆款复刻请求】\n参考链接：{link}\n"
                    f"请分析：1.核心钩子 2.情绪曲线 3.结构模板\n"
                    f"然后为客户生成同风格但不同内容的版本\n不要照搬，提炼结构后重新创作")
                await stream_coze_to_wecom(client, frame, viral_prompt, from_user)
                user_manager.increment(from_user)
                return

        # 发布指令
        if stripped in ['发朋友圈', '发小红书', '发布']:
            sid = generate_req_id("pub")
            await client.reply_stream(frame, sid,
                "📱 发布功能准备就绪！\n\n先告诉我你想发什么内容？\n"
                "比如「发个母亲节活动的朋友圈」\n\n"
                "我会先生成文案+配图让你确认，你说「确认」我才发", finish=True)
            return


        # 蝉镜数字人视频
        if stripped in ['视频', '数字人', '做个视频', '生成视频']:
            sid = generate_req_id("video")
            await client.reply_stream(frame, sid, "🎬 正在生成数字人视频，稍等~", finish=False)
            try:
                last_plan = user_manager.get_last_plan(from_user)
                video_text = last_plan.get("name", "FLY推广搭档") if last_plan else "FLY推广搭档"
                video_url = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: create_chanjing_video(video_text)
                )
                if video_url:
                    await client.reply_stream(frame, sid, f"🎬 数字人视频已生成！\n{video_url}", finish=True)
                else:
                    await client.reply_stream(frame, sid, "视频生成失败，请稍后再试~", finish=True)
            except Exception as e:
                logger_instance.error(f"蝉镜视频生成失败: {e}")
                await client.reply_stream(frame, sid, "视频服务暂时不可用~", finish=True)
            return

        # 批量出方案
        if stripped in ['批量', '出5条', '出10条', '批量出方案'] or (stripped.startswith('出') and '条' in stripped):
            num = 5
            m_batch = re.search(r'出(\d+)条', stripped)
            if m_batch:
                num = min(int(m_batch.group(1)), 10)
            batch_prompt = f"【批量出方案请求】请一次出{num}条不同风格的推广文案，每条1个配图+1段短配文(2-3句)，风格各不相同，按编号列出。"
            await stream_coze_to_wecom(client, frame, batch_prompt, from_user)
            user_manager.increment(from_user)
            return

        # 内容日历
        if stripped in ['日历', '内容日历', '排期', '发什么'] or stripped.startswith('这周发什么') or stripped.startswith('本月'):
            cal_prompt = "【内容日历请求】根据客户行业和当前时间，生成一周推广内容日历。每天1条：星期几、内容主题、发布平台、发布时间、文案要点。格式为表格。"
            await stream_coze_to_wecom(client, frame, cal_prompt, from_user)
            user_manager.increment(from_user)
            return

        # GEO排名查询
        if stripped in ['排名', '查排名', '我的排名', '我的店排第几'] or stripped.startswith('查排名'):
            geo_prompt = "【GEO排名查询请求】客户想查看店铺在本地搜索中的排名。请先询问：1.店名 2.所在区域 3.行业。收到信息后给出GEO优化建议。"
            await stream_coze_to_wecom(client, frame, geo_prompt, from_user)
            user_manager.increment(from_user)
            return

        if text_content.strip() in ['解锁', '价格', '套餐', '付费', '购买']:
            stream_id = generate_req_id("price")
            profile = user_data.get("profile", {})
            boss_name = profile.get("boss_name") or "老板"
            price_msg = (
                f"{boss_name}，FLY套餐👇\n\n"
                f"💰 9.9元/7天体验\n"
                f"  体验无限次文案+配图\n\n"
                f"🔥 59元/月（推荐）\n"
                f"  无限次文案+配图+优先响应\n\n"
                f"💎 999元/年卡\n"
                f"  全部功能+专属客服\n\n"
                f"优惠码「FIRST99」可用\n"
                f"回复「我要买」开通"
            )
            await client.reply_stream(frame, stream_id, price_msg, finish=True)
            return

        # 3轮锁死
        if user_manager.is_locked(from_user):
            stream_id = generate_req_id("locked")
            profile = user_data.get("profile", {})
            locked_msg = get_locked_message(profile)
            await client.reply_stream(frame, stream_id, locked_msg, finish=True)
            logger_instance.info(f"用户{from_user}已锁死，已发个性化付费引导")
            return

        # ===== 闭环①：二次来访识别 =====
        if user_manager.is_returning(from_user):
            short_msg = len(text_content.strip()) <= 10
            last_plan = user_manager.get_last_plan(from_user)
            if last_plan and last_plan.get("feedback") is None and short_msg:
                stream_id = generate_req_id("returning")
                boss_name = user_data.get("profile", {}).get("boss_name", "老板")
                plan_name = last_plan.get("name", "上次的方案")
                greet_msg = f"{boss_name}，上次「{plan_name}」发了没？效果怎么样？"
                await client.reply_stream(frame, stream_id, greet_msg, finish=True)

        # 正常处理
        await stream_coze_to_wecom(client, frame, text_content, from_user)

        used = user_manager.increment(from_user)

        # ===== 3轮递进引导 =====
        try:
            hint_stream_id = generate_req_id("round_hint")
            profile = user_data.get("profile", {})

            if used <= user_manager.FREE_ROUNDS:
                hint = get_round_hint(used, profile)
                if hint:
                    await client.reply_stream(frame, hint_stream_id, hint, finish=True)
        except Exception as e:
            logger_instance.error(f"发轮次提示失败: {e}")

    client.on("message.text", on_text_message)

    async def on_voice_message(frame):
        body = frame.get("body", {})
        voice_content = body.get("voice", {}).get("content", "")
        from_user = body.get("from", {}).get("userid", "unknown")
        msg_id = body.get("msgid", "")

        if deduplicator.is_duplicate(msg_id, from_user, voice_content):
            logger_instance.info(f"跳过重复语音: {msg_id}")
            return

        if not voice_content:
            await client.reply_welcome(frame, {
                "msgtype": "text",
                "text": {"content": "没听清，请用文字再说一下你的需求~"}
            })
            return

        logger_instance.info(f"用户({from_user})语音: {voice_content[:80]}")

        user_data = user_manager.get_user(from_user)
        profile_updates = ProfileExtractor.extract(voice_content, user_data.get("profile", {}))
        if profile_updates:
            user_manager.update_profile(from_user, profile_updates)

        feedback = detect_feedback(voice_content)
        if feedback:
            user_manager.update_plan_feedback(from_user, feedback)

        await stream_coze_to_wecom(client, frame, voice_content, from_user)
        user_manager.increment(from_user)

    client.on("message.voice", on_voice_message)

    async def on_enter_chat(frame):
        body = frame.get("body", {})
        from_user = body.get("from", {}).get("userid", "unknown")

        user_manager.record_visit(from_user)
        user_data = user_manager.get_user(from_user)
        visit_count = user_data.get("visit_count", 0)

        if user_manager.is_returning(from_user) or visit_count > 1:
            greet = get_returning_greeting(from_user)
            await client.reply_welcome(frame, {
                "msgtype": "text",
                "text": {"content": greet}
            })
        else:
            await client.reply_welcome(frame, {
                "msgtype": "text",
                "text": {
                    "content": (
                        "你好！我是FLY，你的专属推广搭档🔥\n\n"
                        "我可以帮你：\n"
                        "✍️ 写爆款文案（小红书/抖音/朋友圈）\n"
                        "🎬 生成配图和视频脚本\n"
                        "📈 营销策略诊断\n\n"
                        "直接说你的需求就行！\n"
                        "比如「我是开奶茶店的，想引流周边客户」"
                    )
                }
            })
    client.on("event.enter_chat", on_enter_chat)

    async def on_mixed_message(frame):
        body = frame.get("body", {})
        items = body.get("mixed", {}).get("msg_item", [])
        from_user = body.get("from", {}).get("userid", "unknown")
        msg_id = body.get("msgid", "")

        text_parts = []
        for item in items:
            if item.get("msgtype") == "text":
                text_parts.append(item.get("text", {}).get("content", ""))

        if text_parts:
            content = " ".join(text_parts)
            if deduplicator.is_duplicate(msg_id, from_user, content):
                logger_instance.info(f"跳过重复图文: {msg_id}")
                return

            user_data = user_manager.get_user(from_user)
            profile_updates = ProfileExtractor.extract(content, user_data.get("profile", {}))
            if profile_updates:
                user_manager.update_profile(from_user, profile_updates)

            logger_instance.info(f"用户({from_user})图文: {content[:80]}")
            await stream_coze_to_wecom(client, frame, content, from_user)
    client.on("message.mixed", on_mixed_message)

    async def on_image_message(frame):
        body = frame.get("body", {})
        from_user = body.get("from", {}).get("userid", "unknown")
        image_url = body.get("image", {}).get("url", "")
        logger_instance.info(f"用户({from_user})图片: {image_url}")
        await client.reply_welcome(frame, {
            "msgtype": "text",
            "text": {"content": "收到图片！请配合文字描述一下你的需求，这样我能更好地帮到你~"}
        })
    client.on("message.image", on_image_message)


# ====== 核心流式处理 ======
async def stream_coze_to_wecom(client: WSClient, frame, content: str, from_user: str):
    stream_id = generate_req_id("stream")
    user_id = from_user or "wecom_user"

    user_data = user_manager.get_user(from_user)
    profile = user_data.get("profile", {})

    try:
        await client.reply_stream(
            frame, stream_id,
            "正在为你生成方案...",
            finish=False
        )
    except Exception as e:
        logger_instance.error(f"发初始消息失败: %s", e)
        return

    loop = asyncio.get_event_loop()
    api_done = asyncio.Event()

    async def keepalive():
        count = 0
        while not api_done.is_set():
            await asyncio.sleep(5)
            if api_done.is_set():
                break
            count += 1
            try:
                await client.reply_stream(
                    frame, stream_id,
                    f"正在为你生成方案{'.' * (count % 4)}",
                    finish=False
                )
            except Exception:
                break

    keepalive_task = asyncio.create_task(keepalive())

    start_time = time.time()
    try:
        raw_content = await loop.run_in_executor(
            None,
            lambda: call_coze_stream(content, user_id, profile)
        )
    except Exception as e:
        logger_instance.error(f"调用Coze异常: %s", e)
        raw_content = None
    finally:
        api_done.set()
        keepalive_task.cancel()
        try:
            await keepalive_task
        except asyncio.CancelledError:
            pass

    elapsed = time.time() - start_time
    logger_instance.info(f"API耗时: {elapsed:.1f}秒")

    if raw_content:
        if isinstance(raw_content, dict):
            text_content = raw_content["text"]
            image_urls = raw_content["images"]
        else:
            text_content = raw_content
            image_urls = re.findall(r'https://[^\s\)\"\]]+?\.(?:png|jpg|jpeg|webp)', raw_content)
            image_urls = list(dict.fromkeys(image_urls))

        processed = post_process_reply(text_content)
        processed = processed.strip()

        logger_instance.info(f"后处理{len(processed)}字, 图片{len(image_urls)}张, 耗时{elapsed:.1f}s")

        if len(processed) > 5:
            try:
                await client.reply_stream(
                    frame, stream_id,
                    processed,
                    finish=True
                )
                logger_instance.info("✅ 文案发送成功: %s...", processed[:50])

                for idx, img_url in enumerate(image_urls[:3]):
                    try:
                        media_id = await download_and_upload_image(client, img_url, idx)
                        if media_id:
                            await client.reply_media(frame, "image", media_id)
                            logger_instance.info(f"✅ 图片{idx+1}发送成功: media_id={media_id}")
                        else:
                            logger_instance.warning(f"图片{idx+1}上传失败，跳过")
                    except Exception as e:
                        logger_instance.error(f"图片{idx+1}发送失败: {e}")

                # ===== 记录方案历史 =====
                plan_name = extract_plan_name(processed)
                user_manager.add_plan(
                    from_user,
                    plan_name=plan_name,
                    channels=[],
                    style=profile.get("style")
                )

                # ===== 代码控制的追问（闭环④） =====
                try:
                    followup_id = generate_req_id("followup")
                    boss_name = profile.get("boss_name") or "老板"
                    followup_msg = f"发出了告诉我效果{boss_name}，我帮你调整下一套~"
                    await client.reply_stream(frame, followup_id, followup_msg, finish=True)
                    logger_instance.info("✅ 发送代码控制追问")
                except Exception as e:
                    logger_instance.error(f"发送追问失败: {e}")

            except Exception as e:
                logger_instance.error(f"发最终消息失败: %s", e)
        else:
            try:
                await client.reply_stream(
                    frame, stream_id,
                    "暂时没有生成内容，请换个方式描述你的需求。",
                    finish=True
                )
            except Exception:
                pass
    else:
        try:
            await client.reply_stream(
                frame, stream_id,
                "AI服务暂时异常，请稍后再试。",
                finish=True
            )
        except Exception:
            pass


# ====== 主入口 ======
def main():
    logger_instance.info("=" * 50)
    logger_instance.info("FLY智能营销助手 - 企微 v6 Ultimate")
    logger_instance.info("四步闭环 · 全+省心+有价值")
    logger_instance.info(f"客户档案目录：{PROFILE_DIR}")
    logger_instance.info("=" * 50)

    client = WSClient(
        bot_id=WECOM_BOT_ID,
        secret=WECOM_BOT_SECRET,
        reconnect_interval=2000,
        max_reconnect_attempts=-1,
        heartbeat_interval=30000,
        logger=logger_instance,
    )

    setup_event_handlers(client)

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    def shutdown():
        logger_instance.info("正在停止机器人...")
        client.disconnect()
        loop.stop()

    if platform.system() != "Windows":
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, shutdown)

    # SOP跟进检查
    async def followup_checker():
        while True:
            await asyncio.sleep(600)
            try:
                for _uid, _udata in list(user_manager._users.items()):
                    _result = check_followup(_udata)
                    if _result:
                        _key, _msg = _result
                        logger_instance.info(f"🔔 需跟进 {_uid}: [{_key}] {_msg[:50]}")
                        if not _udata.get("last_followup"):
                            _udata["last_followup"] = {}
                        _udata["last_followup"][_key] = datetime.now().strftime("%Y-%m-%d %H:%M")
                        user_manager._save(_uid)
            except Exception as e:
                logger_instance.error(f"跟进检查异常: {e}")

    asyncio.ensure_future(followup_checker())

    try:
        loop.run_until_complete(client.connect())
        loop.run_forever()
    except KeyboardInterrupt:
        shutdown()
    finally:
        client.disconnect()
        loop.close()


if __name__ == "__main__":
    main()
