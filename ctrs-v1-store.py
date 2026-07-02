"""
CTRS v1.2 Report Store
========================
Fly Protocol - Report 持久化存储层

核心功能：
  store_report(report) → 存储 Report 到 fly-store/，返回 {report_id, storage_hash, version}
  load_report(report_id) → 从 fly-store/ 加载 Report
  list_reports() → 列出所有存储的 Report

存储路径: ./codeact/output/fly-store/<report_id>.json
完整性: storage_hash = SHA-256(Report JSON)

依赖：ctrs-v1.2-trust-loop.py 第 43 行通过 _load_module("ctrs_v1_store", "ctrs-v1-store.py") 引用此模块
"""

import hashlib
import json
import os
from datetime import datetime, timezone

# ═══════════════════════════════════════════════════════════════
#  路径配置（与 ctrs-v1.2-registry.py 保持一致的风格）
# ═══════════════════════════════════════════════════════════════

_STORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "codeact", "output", "fly-store")


def _now_iso() -> str:
    """返回当前 UTC 时间的 ISO 8601 字符串"""
    return datetime.now(timezone.utc).isoformat()


def _compute_storage_hash(report: dict) -> str:
    """
    计算 Report 的存储哈希（canonical JSON → SHA-256）
    用于完整性校验：存储后读取时验证数据未被篡改
    """
    canonical = json.dumps(report, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _ensure_dirs():
    """确保存储目录存在"""
    os.makedirs(_STORE_DIR, exist_ok=True)


def _report_path(report_id: str) -> str:
    """根据 report_id 构建文件路径"""
    return os.path.join(_STORE_DIR, f"{report_id}.json")


# ═══════════════════════════════════════════════════════════════
#  核心函数
# ═══════════════════════════════════════════════════════════════

def store_report(report: dict) -> dict:
    """
    存储 Report 到 fly-store/ 目录。

    处理流程：
      1. 计算 storage_hash = SHA-256(Report JSON)
      2. 检查是否已有同 report_id 的 Report（版本管理）
      3. 写入 ./codeact/output/fly-store/<report_id>.json
      4. 返回存储元信息

    参数:
      report: 完整的 CTRS Report 字典，必须包含 report_id

    返回:
      {
        "report_id": str,
        "storage_hash": str,   # SHA-256(Report JSON)
        "version": int,        # 版本号（同一 report_id 每次更新 +1）
        "stored_at": str       # ISO 8601 时间戳
      }
    """
    _ensure_dirs()

    report_id = report.get("report_id")
    if not report_id:
        raise ValueError("Report 必须包含 report_id 字段")

    # 计算存储哈希
    storage_hash = _compute_storage_hash(report)

    # 版本管理：检查是否已有同 report_id 的 Report
    version = 1
    existing_path = _report_path(report_id)
    if os.path.exists(existing_path):
        try:
            with open(existing_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            # 如果是带版本元信息的存储格式，读取版本号
            if isinstance(existing, dict) and "_store_meta" in existing:
                version = existing["_store_meta"].get("version", 0) + 1
            else:
                # 旧格式（纯 Report），版本从 2 开始
                version = 2
        except (json.JSONDecodeError, KeyError):
            version = 2

    # 构建存储对象（Report + 存储元信息）
    stored_at = _now_iso()
    store_meta = {
        "storage_hash": storage_hash,
        "version": version,
        "stored_at": stored_at,
    }

    # 写入文件：Report 数据 + _store_meta
    storage_obj = {**report, "_store_meta": store_meta}

    with open(existing_path, "w", encoding="utf-8") as f:
        json.dump(storage_obj, f, indent=2, ensure_ascii=False)

    return {
        "report_id": report_id,
        "storage_hash": storage_hash,
        "version": version,
        "stored_at": stored_at,
    }


def load_report(report_id: str, verify_hash: bool = True) -> dict:
    """
    从 fly-store/ 加载 Report。

    处理流程：
      1. 读取 <report_id>.json
      2. 如有 _store_meta，验证 storage_hash（可选）
      3. 返回纯 Report 数据（去除 _store_meta）

    参数:
      report_id: Report 的唯一标识符
      verify_hash: 是否验证 storage_hash（默认 True）

    返回:
      完整的 CTRS Report 字典（不含 _store_meta）

    异常:
      FileNotFoundError: Report 不存在
      ValueError: 哈希验证失败（数据可能被篡改）
    """
    path = _report_path(report_id)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Report {report_id} 不存在于 fly-store/")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 分离存储元信息和 Report 数据
    store_meta = data.pop("_store_meta", None)

    # 哈希校验
    if verify_hash and store_meta and "storage_hash" in store_meta:
        computed_hash = _compute_storage_hash(data)
        if computed_hash != store_meta["storage_hash"]:
            raise ValueError(
                f"Report {report_id} storage_hash 校验失败！"
                f"存储哈希: {store_meta['storage_hash'][:16]}..., "
                f"计算哈希: {computed_hash[:16]}... "
                f"— 数据可能已被篡改"
            )

    return data


def list_reports() -> list:
    """
    列出所有存储的 Report。

    返回:
      [
        {
          "report_id": str,
          "schema_version": str,
          "status": str,
          "created_at": str,
          "storage_hash": str,
          "version": int,
          "stored_at": str
        },
        ...
      ]
    按存储时间倒序排列（最新在前）
    """
    _ensure_dirs()

    reports = []
    for filename in os.listdir(_STORE_DIR):
        if not filename.endswith(".json"):
            continue

        path = os.path.join(_STORE_DIR, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            store_meta = data.get("_store_meta", {})
            report_id = data.get("report_id", filename.replace(".json", ""))

            reports.append({
                "report_id": report_id,
                "schema_version": data.get("schema_version", "unknown"),
                "status": data.get("status", "unknown"),
                "created_at": data.get("created_at", "unknown"),
                "storage_hash": store_meta.get("storage_hash", "N/A"),
                "version": store_meta.get("version", 1),
                "stored_at": store_meta.get("stored_at", "unknown"),
            })
        except (json.JSONDecodeError, KeyError):
            # 跳过损坏的文件
            continue

    # 按存储时间倒序排列
    reports.sort(key=lambda r: r.get("stored_at", ""), reverse=True)
    return reports


# ═══════════════════════════════════════════════════════════════
#  便捷函数
# ═══════════════════════════════════════════════════════════════

def delete_report(report_id: str) -> bool:
    """
    删除指定 Report（谨慎使用，通常不建议删除信任记录）。

    参数:
      report_id: Report 的唯一标识符

    返回:
      True = 删除成功, False = Report 不存在
    """
    path = _report_path(report_id)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


def get_store_stats() -> dict:
    """
    获取 Store 统计信息。

    返回:
      {
        "total_reports": int,
        "store_dir": str,
        "reports_by_status": { status: count, ... },
        "reports_by_schema_version": { version: count, ... }
      }
    """
    all_reports = list_reports()
    by_status = {}
    by_version = {}
    for r in all_reports:
        s = r.get("status", "unknown")
        v = r.get("schema_version", "unknown")
        by_status[s] = by_status.get(s, 0) + 1
        by_version[v] = by_version.get(v, 0) + 1

    return {
        "total_reports": len(all_reports),
        "store_dir": _STORE_DIR,
        "reports_by_status": by_status,
        "reports_by_schema_version": by_version,
    }
