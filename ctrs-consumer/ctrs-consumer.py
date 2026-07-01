"""
CTRS v1.2 独立消费者（Independent Consumer）
=============================================
与 Fly 协议的任何生成/验证/注册代码零共享。
仅依赖：CTRS JSON Schema + Registry 文件格式。

证明：CTRS 是一个可被第三方独立实现的协议，不是一个私有系统。

使用方式：
  python ctrs-consumer.py                          # 验证最近一份 Report
  python ctrs-consumer.py <report_id>              # 验证指定 Report
  python ctrs-consumer.py <path/to/report.json>    # 验证本地文件
"""

import json
import hashlib
import os
import sys
from datetime import datetime, timezone

# ═══════════════════════════════════════════════════════════════
#  路径配置（独立于 Fly 内部路径，仅读取已知公开位置）
# ═══════════════════════════════════════════════════════════════

# Fly 数据目录（codeact 在 fly-agent.xyz 的同级）
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_FLY_ROOT = os.path.join(_SCRIPT_DIR, "..")
_CODEACT_OUTPUT = os.path.join(_FLY_ROOT, "..", "codeact", "output")
_STORE_DIR = os.path.join(_CODEACT_OUTPUT, "fly-store")
_REGISTRY_DIR = os.path.join(_CODEACT_OUTPUT, "fly-registry")

# 已知 Schema 版本
KNOWN_SCHEMA_VERSIONS = {"CTRS-v1.0", "CTRS-v1.1", "CTRS-v1.2"}


# ═══════════════════════════════════════════════════════════════
#  工具函数
# ═══════════════════════════════════════════════════════════════

def _sha256(data: dict) -> str:
    """对 dict 做 SHA-256（canonical JSON）"""
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _latest_report_path() -> str:
    """获取最近修改的 Report 文件"""
    files = [f for f in os.listdir(_STORE_DIR) if f.endswith(".json")]
    if not files:
        return None
    files.sort(key=lambda f: os.path.getmtime(os.path.join(_STORE_DIR, f)), reverse=True)
    return os.path.join(_STORE_DIR, files[0])


# ═══════════════════════════════════════════════════════════════
#  Registry 读取（只读，不依赖 registry.py）
# ═══════════════════════════════════════════════════════════════

def load_rule_registry() -> dict:
    path = os.path.join(_REGISTRY_DIR, "rule-registry.json")
    if not os.path.exists(path):
        return {}
    return _load_json(path)


def load_issuer_registry() -> dict:
    path = os.path.join(_REGISTRY_DIR, "issuer-registry.json")
    if not os.path.exists(path):
        return {}
    return _load_json(path)


# ═══════════════════════════════════════════════════════════════
#  独立验证器（Independent Verifier）
#  不导入 ctrs-v1.2-verify.py，从零实现全部 10 项检查
# ═══════════════════════════════════════════════════════════════

def verify(report: dict, rule_registry: dict, issuer_registry: dict) -> dict:
    """
    独立验证一份 CTRS Report。
    返回: { valid: bool, checks: [...], issues: [...] }
    """
    checks = []
    issues = []

    # ── Layer 1: Execution Truth ──────────────────────────────

    # 1. Schema 完整性
    required_keys = {"claim", "evidence", "rule", "attribution", "settlement", "schema_version"}
    missing = required_keys - set(report.keys())
    passed = len(missing) == 0
    checks.append({
        "layer": 1,
        "check": "schema_completeness",
        "passed": passed,
        "detail": "所有必需字段存在" if passed else f"缺少: {missing}",
    })
    if not passed:
        issues.append(f"Schema 不完整: 缺少 {missing}")

    # 2. Claim 完整性
    claim = report.get("claim", {})
    claim_required = {"claim_id", "type", "subject"}
    claim_missing = claim_required - set(claim.keys())
    passed = len(claim_missing) == 0
    checks.append({
        "layer": 1,
        "check": "claim_integrity",
        "passed": passed,
        "detail": f"Claim 包含 {len(claim_required)} 个必需字段" if passed else f"Claim 缺少: {claim_missing}",
    })
    if not passed:
        issues.append(f"Claim 不完整: 缺少 {claim_missing}")

    # 3. Evidence Hash 完整性
    # 注意：Generator 只 hash evidence["data"] 字段，不是整个 evidence 对象
    evidence_list = report.get("evidence", [])
    hash_ok = True
    for ev in evidence_list:
        expected_hash = ev.get("hash")
        if not expected_hash:
            hash_ok = False
            break
        ev_data = ev.get("data", {})
        actual_hash = _sha256(ev_data)
        if actual_hash != expected_hash:
            hash_ok = False
            break
    checks.append({
        "layer": 1,
        "check": "evidence_hash_integrity",
        "passed": hash_ok,
        "detail": f"{len(evidence_list)} 条 Evidence hash 全部验证通过" if hash_ok else "Evidence hash 不匹配",
    })
    if not hash_ok:
        issues.append("Evidence hash 验证失败 — 数据可能被篡改")

    # 4. Evidence-Claim 引用一致性
    claim_id = claim.get("claim_id")
    ref_ok = all(ev.get("claim_ref") == claim_id for ev in evidence_list)
    checks.append({
        "layer": 1,
        "check": "evidence_claim_ref",
        "passed": ref_ok,
        "detail": f"所有 Evidence 引用 claim_id={claim_id[:8]}..." if ref_ok else "Evidence 引用了错误的 claim_id",
    })
    if not ref_ok:
        issues.append("Evidence 的 claim_ref 与 Claim 的 claim_id 不一致")

    # 5. Attribution 一致性
    attribution = report.get("attribution", {})
    attr_claim_ref = attribution.get("claim_ref")
    attr_consistent = attr_claim_ref == claim_id
    checks.append({
        "layer": 1,
        "check": "attribution_consistency",
        "passed": attr_consistent,
        "detail": "Attribution 引用正确的 claim_id" if attr_consistent else "Attribution claim_ref 不匹配",
    })
    if not attr_consistent:
        issues.append("Attribution 的 claim_ref 与 Claim 不一致")

    # 6. Settlement 正确性
    settlement = report.get("settlement", {})
    attr_ref = settlement.get("attribution_ref")
    settlement_correct = attr_ref == attribution.get("attribution_id")
    # 验证金额加总
    total_amount = float(settlement.get("amount", 0))
    split_sum = sum(float(s.get("share_amount", 0)) for s in settlement.get("split", []))
    amount_correct = abs(total_amount - split_sum) < 0.001
    all_correct = settlement_correct and amount_correct
    checks.append({
        "layer": 1,
        "check": "settlement_correctness",
        "passed": all_correct,
        "detail": f"结算金额 {total_amount} = 分账合计 {split_sum}" if all_correct else f"金额不匹配: total={total_amount}, sum={split_sum}",
    })
    if not all_correct:
        issues.append("Settlement 金额或引用不一致")

    # ── Layer 2: Structural Identity (v1.1) ──────────────────

    # 7. Rule 完整性
    rule = report.get("rule", {})
    rule_required = {"rule_id", "issuer", "version", "hash", "definition"}
    rule_missing = rule_required - set(rule.keys())
    rule_hash_ok = False
    if not rule_missing and rule.get("definition"):
        expected_rule_hash = rule.get("hash")
        actual_rule_hash = _sha256(rule["definition"])
        rule_hash_ok = expected_rule_hash == actual_rule_hash
    rule_integrity = len(rule_missing) == 0 and rule_hash_ok
    checks.append({
        "layer": 2,
        "check": "rule_integrity",
        "passed": rule_integrity,
        "detail": "Rule 定义 hash 验证通过，未被篡改" if rule_integrity else "Rule 定义被篡改或字段缺失",
    })
    if not rule_integrity:
        issues.append("Rule 完整性验证失败")

    # 8. Attribution-Rule 绑定
    attr_rule_hash = attribution.get("rule_hash")
    report_rule_hash = rule.get("hash")
    binding_ok = attr_rule_hash == report_rule_hash and attr_rule_hash is not None
    checks.append({
        "layer": 2,
        "check": "attribution_rule_binding",
        "passed": binding_ok,
        "detail": f"Attribution 绑定到 rule_hash={attr_rule_hash[:32]}..." if binding_ok else "Attribution 未正确绑定到 Rule",
    })
    if not binding_ok:
        issues.append("Attribution 的 rule_hash 与 Rule 的 hash 不一致")

    # ── Layer 3: Social Authority (v1.2) ─────────────────────

    # 9. Rule 注册验证
    registered_rules = rule_registry.get(rule.get("rule_id"), [])
    rule_registered = False
    registered_info = None
    for entry in registered_rules:
        if entry.get("rule_hash") == report_rule_hash:
            rule_registered = True
            registered_info = entry
            break
    checks.append({
        "layer": 3,
        "check": "rule_registration",
        "passed": rule_registered,
        "detail": f"Rule 已在 Registry 注册 (issuer: {registered_info.get('issuer', 'N/A')})" if rule_registered else "Rule 未在 Registry 中找到",
    })
    if not rule_registered:
        issues.append("Rule 未在 Registry 中注册")

    # 10. Issuer 信任评估
    rule_issuer = rule.get("issuer")
    issuer_info = issuer_registry.get(rule_issuer)
    issuer_trusted = False
    trust_level = "unknown"
    if issuer_info:
        trust_level = issuer_info.get("trust_level", "unknown")
        issuer_trusted = trust_level in ("trusted", "verified")
    checks.append({
        "layer": 3,
        "check": "issuer_trust",
        "passed": issuer_trusted,
        "detail": f"Issuer {rule_issuer} 信任级别: {trust_level}",
        "trust_level": trust_level,
    })
    if not issuer_trusted:
        issues.append(f"Issuer 不可信: {rule_issuer} (trust_level={trust_level})")

    # ── 汇总 ─────────────────────────────────────────────────
    passed_count = sum(1 for c in checks if c["passed"])
    return {
        "valid": passed_count == len(checks),
        "checks": checks,
        "issues": issues,
        "summary": {
            "total": len(checks),
            "passed": passed_count,
            "failed": len(checks) - passed_count,
        },
    }


# ═══════════════════════════════════════════════════════════════
#  主程序
# ═══════════════════════════════════════════════════════════════

def main():
    # 确定要验证的 Report
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if os.path.isfile(arg):
            report_path = arg
        else:
            # 当作 report_id 处理
            report_path = os.path.join(_STORE_DIR, f"{arg}.json")
    else:
        report_path = _latest_report_path()

    if not report_path or not os.path.exists(report_path):
        print("❌ 未找到可验证的 Report")
        print(f"   Store 目录: {_STORE_DIR}")
        sys.exit(1)

    # 加载 Report
    report = _load_json(report_path)
    report_id = report.get("report_id", "unknown")

    # 加载 Registry
    rule_reg = load_rule_registry()
    issuer_reg = load_issuer_registry()

    # 输出
    print()
    print("█" * 64)
    print("█" + " " * 62 + "█")
    print("█" + "  CTRS v1.2 独立消费者 — Independent Verification".center(62) + "█")
    print("█" + "  与 Fly 生成/验证代码零共享，仅依赖 JSON Schema".center(62) + "█")
    print("█" + " " * 62 + "█")
    print("█" * 64)

    print()
    print(f"  📄 Report: {report_id}")
    print(f"  📋 Schema: {report.get('schema_version')}")
    print(f"  📅 创建时间: {report.get('created_at')}")
    print()

    # 执行独立验证
    result = verify(report, rule_reg, issuer_reg)

    # 分层输出结果
    layer_names = {
        1: "Execution Truth（执行真实性）",
        2: "Structural Identity（结构身份）",
        3: "Social Authority（社会权威）",
    }

    for layer_num in [1, 2, 3]:
        layer_checks = [c for c in result["checks"] if c["layer"] == layer_num]
        if not layer_checks:
            continue
        print(f"  ── Layer {layer_num}: {layer_names[layer_num]} ──")
        for c in layer_checks:
            icon = "✅" if c["passed"] else "❌"
            extra = f" [{c.get('trust_level')}]" if c.get("trust_level") else ""
            print(f"    {icon} {c['check']}: {c['detail']}{extra}")
        print()

    # 汇总
    s = result["summary"]
    print(f"  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  总计: {s['passed']}/{s['total']} 项通过")

    if result["valid"]:
        print()
        print("  ✅ 结论: 此 Report 通过独立验证")
        print("     — 数据来源独立（非 Fly 内部代码）")
        print("     — 验证逻辑独立（从零实现）")
        print("     — 协议可被第三方独立实现")
        print()

        # 结算信息
        settlement = report.get("settlement", {})
        attribution = report.get("attribution", {})
        print(f"  💰 Settlement Ready")
        print(f"     总金额: {settlement.get('currency')} {settlement.get('amount')}")
        print(f"     状态:   {settlement.get('status')}")
        print()
        print(f"     {'参与方':<20} {'比例':>6} {'金额':>10}")
        print(f"     {'─' * 20} {'─' * 6} {'─' * 10}")
        for split in settlement.get("split", []):
            print(f"     {split['party_id']:<20} {split['share_pct']:>5}% {settlement.get('currency')} {split['share_amount']:>6}")
        print()

        # 协议成立声明
        print("  ┌────────────────────────────────────────────────────┐")
        print("  │  证明：CTRS v1.2 是一个可被独立实现的协议标准     │")
        print("  │  本消费者与 Fly 生成代码零共享                     │")
        print("  │  仅依赖 JSON Schema + Registry 文件格式            │")
        print("  └────────────────────────────────────────────────────┘")
    else:
        print()
        print("  ❌ 结论: 验证失败")
        for issue in result["issues"]:
            print(f"     ⚠ {issue}")

    print()
    print("=" * 64)


if __name__ == "__main__":
    main()
