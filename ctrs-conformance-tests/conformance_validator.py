#!/usr/bin/env python3
"""
CTRS v1.2 一致性测试验证器 (Conformance Validator)
=================================================
验证任意 CTRS 实现是否符合 CTRS v1.2 协议规范。

使用方式：
  # 远程模式 — 向被测实现发送请求并验证响应
  python conformance_validator.py --test tests/test_001_basic_report.json --endpoint https://api.fly-agent.xyz/v1/verify

  # 本地模式 — 直接验证一份 CTRS Report JSON
  python conformance_validator.py --test tests/test_001_basic_report.json --report report.json

  # 批量运行
  python conformance_validator.py --all --endpoint https://api.fly-agent.xyz/v1/verify

依赖：Python 3.7+，仅使用标准库（json, hashlib, urllib, argparse 等）
"""

import json
import hashlib
import argparse
import sys
import os
import time
from datetime import datetime, timezone

# ═══════════════════════════════════════════════════════════════
#  工具函数
# ═══════════════════════════════════════════════════════════════

def _sha256(data: dict) -> str:
    """对 dict 做 SHA-256（canonical JSON），与 CTRS Generator 一致"""
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load_json(path: str):
    """加载 JSON 文件"""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _http_post_json(url: str, payload: dict, timeout: int = 30) -> dict:
    """发送 POST 请求（JSON body），返回 JSON 响应。仅使用标准库。"""
    import urllib.request
    import urllib.error

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body[:500]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"连接失败: {e.reason}")


# ═══════════════════════════════════════════════════════════════
#  Registry 加载
# ═══════════════════════════════════════════════════════════════

def _load_registry(registry_dir: str = None) -> tuple:
    """
    加载 Rule Registry 和 Issuer Registry。
    如果未指定目录，尝试默认位置。
    """
    if registry_dir is None:
        # 尝试几个可能的位置
        candidates = [
            os.path.join(os.path.dirname(__file__), "..", "codeact", "output", "fly-registry"),
            os.path.join(os.path.dirname(__file__), "..", "..", "codeact", "output", "fly-registry"),
        ]
        # 也尝试通过环境变量
        env_dir = os.environ.get("CTRS_REGISTRY_DIR")
        if env_dir:
            candidates.insert(0, env_dir)
        
        for candidate in candidates:
            if os.path.isdir(candidate):
                registry_dir = candidate
                break
    
    rule_registry = {}
    issuer_registry = {}
    
    if registry_dir and os.path.isdir(registry_dir):
        rule_path = os.path.join(registry_dir, "rule-registry.json")
        if os.path.exists(rule_path):
            rule_registry = _load_json(rule_path)
        
        issuer_path = os.path.join(registry_dir, "issuer-registry.json")
        if os.path.exists(issuer_path):
            issuer_registry = _load_json(issuer_path)
    
    return rule_registry, issuer_registry


# ═══════════════════════════════════════════════════════════════
#  10 项一致性检查（与 ctrs-consumer.py 一致）
# ═══════════════════════════════════════════════════════════════

def check_schema_completeness(report: dict) -> dict:
    """检查 1: Schema 完整性 — 所有 required 字段存在"""
    required_keys = {"claim", "evidence", "rule", "attribution", "settlement", "schema_version"}
    missing = required_keys - set(report.keys())
    passed = len(missing) == 0
    return {
        "check": "schema_completeness",
        "passed": passed,
        "detail": "所有必需字段存在" if passed else f"缺少字段: {missing}",
        "layer": 1,
    }


def check_claim_integrity(report: dict) -> dict:
    """检查 2: Claim 完整性 — claim_id, type, subject 存在"""
    claim = report.get("claim", {})
    claim_required = {"claim_id", "type", "subject"}
    claim_missing = claim_required - set(claim.keys())
    passed = len(claim_missing) == 0
    return {
        "check": "claim_integrity",
        "passed": passed,
        "detail": f"Claim 包含 {len(claim_required)} 个必需字段" if passed else f"Claim 缺少: {claim_missing}",
        "layer": 1,
    }


def check_evidence_hash_integrity(report: dict) -> dict:
    """检查 3: Evidence Hash 完整性 — hash(data) == stored_hash"""
    evidence_list = report.get("evidence", [])
    if not evidence_list:
        return {
            "check": "evidence_hash_integrity",
            "passed": False,
            "detail": "Evidence 列表为空",
            "layer": 1,
        }
    
    failed_indices = []
    for i, ev in enumerate(evidence_list):
        expected_hash = ev.get("hash")
        if not expected_hash:
            failed_indices.append(i)
            continue
        ev_data = ev.get("data", {})
        actual_hash = _sha256(ev_data)
        if actual_hash != expected_hash:
            failed_indices.append(i)
    
    passed = len(failed_indices) == 0
    detail = f"{len(evidence_list)} 条 Evidence hash 全部验证通过"
    if not passed:
        detail = f"Evidence[{failed_indices}] hash 不匹配 — 数据可能被篡改"
    
    return {
        "check": "evidence_hash_integrity",
        "passed": passed,
        "detail": detail,
        "layer": 1,
    }


def check_evidence_claim_ref(report: dict) -> dict:
    """检查 4: Evidence-Claim 引用一致性 — evidence.claim_ref == claim.claim_id"""
    claim = report.get("claim", {})
    claim_id = claim.get("claim_id")
    evidence_list = report.get("evidence", [])
    
    if not claim_id:
        return {
            "check": "evidence_claim_ref",
            "passed": False,
            "detail": "Claim 缺少 claim_id",
            "layer": 1,
        }
    
    mismatched = [i for i, ev in enumerate(evidence_list) if ev.get("claim_ref") != claim_id]
    passed = len(mismatched) == 0
    
    return {
        "check": "evidence_claim_ref",
        "passed": passed,
        "detail": f"所有 Evidence 引用 claim_id={claim_id[:8]}..." if passed else f"Evidence[{mismatched}] 引用了错误的 claim_id",
        "layer": 1,
    }


def check_attribution_consistency(report: dict) -> dict:
    """检查 5: Attribution 一致性 — attribution.claim_ref == claim.claim_id"""
    claim = report.get("claim", {})
    claim_id = claim.get("claim_id")
    attribution = report.get("attribution", {})
    attr_claim_ref = attribution.get("claim_ref")
    
    passed = attr_claim_ref == claim_id and claim_id is not None
    
    return {
        "check": "attribution_consistency",
        "passed": passed,
        "detail": "Attribution 引用正确的 claim_id" if passed else "Attribution claim_ref 与 Claim 不一致",
        "layer": 1,
    }


def check_settlement_correctness(report: dict) -> dict:
    """检查 6: Settlement 正确性 — split 加总 == amount，attribution_ref 一致"""
    settlement = report.get("settlement", {})
    attribution = report.get("attribution", {})
    
    # 验证 attribution_ref
    attr_ref = settlement.get("attribution_ref")
    attr_id = attribution.get("attribution_id")
    ref_ok = attr_ref == attr_id
    
    # 验证金额加总
    total_amount = float(settlement.get("amount", 0))
    split_sum = sum(float(s.get("share_amount", 0)) for s in settlement.get("split", []))
    amount_ok = abs(total_amount - split_sum) < 0.01  # 浮点容差
    
    passed = ref_ok and amount_ok
    
    if not ref_ok and not amount_ok:
        detail = f"attribution_ref 不一致 且 金额不匹配: total={total_amount}, sum={split_sum}"
    elif not ref_ok:
        detail = f"attribution_ref 不一致: settlement={attr_ref}, attribution={attr_id}"
    elif not amount_ok:
        detail = f"金额不匹配: total={total_amount}, split_sum={split_sum}"
    else:
        detail = f"结算金额 {total_amount} = 分账合计 {split_sum}"
    
    return {
        "check": "settlement_correctness",
        "passed": passed,
        "detail": detail,
        "layer": 1,
    }


def check_rule_integrity(report: dict) -> dict:
    """检查 7: Rule 完整性 — hash(rule.definition) == rule.hash"""
    rule = report.get("rule", {})
    rule_required = {"rule_id", "issuer", "version", "hash", "definition"}
    rule_missing = rule_required - set(rule.keys())
    
    if rule_missing:
        return {
            "check": "rule_integrity",
            "passed": False,
            "detail": f"Rule 缺少必需字段: {rule_missing}",
            "layer": 2,
        }
    
    definition = rule.get("definition")
    if not definition:
        return {
            "check": "rule_integrity",
            "passed": False,
            "detail": "Rule definition 为空",
            "layer": 2,
        }
    
    expected_hash = rule.get("hash")
    actual_hash = _sha256(definition)
    passed = expected_hash == actual_hash
    
    return {
        "check": "rule_integrity",
        "passed": passed,
        "detail": "Rule 定义 hash 验证通过，未被篡改" if passed else f"Rule hash 不匹配: 期望 {expected_hash[:16]}..., 实际 {actual_hash[:16]}...",
        "layer": 2,
    }


def check_attribution_rule_binding(report: dict) -> dict:
    """检查 8: Attribution-Rule 绑定 — attribution.rule_hash == rule.hash"""
    attribution = report.get("attribution", {})
    rule = report.get("rule", {})
    
    attr_rule_hash = attribution.get("rule_hash")
    report_rule_hash = rule.get("hash")
    
    passed = attr_rule_hash == report_rule_hash and attr_rule_hash is not None
    
    return {
        "check": "attribution_rule_binding",
        "passed": passed,
        "detail": f"Attribution 绑定到 rule_hash={attr_rule_hash[:16]}..." if passed else "Attribution 未正确绑定到 Rule",
        "layer": 2,
    }


def check_rule_registration(report: dict, rule_registry: dict) -> dict:
    """检查 9: Rule 注册验证 — rule_id + rule_hash 存在于 registry"""
    rule = report.get("rule", {})
    rule_id = rule.get("rule_id")
    rule_hash = rule.get("hash")
    
    registered_rules = rule_registry.get(rule_id, [])
    rule_registered = False
    registered_info = None
    for entry in registered_rules:
        if entry.get("rule_hash") == rule_hash:
            rule_registered = True
            registered_info = entry
            break
    
    return {
        "check": "rule_registration",
        "passed": rule_registered,
        "detail": f"Rule 已在 Registry 注册 (issuer: {registered_info.get('issuer', 'N/A')})" if rule_registered else f"Rule 未在 Registry 中找到 (rule_id={rule_id})",
        "layer": 3,
    }


def check_issuer_trust(report: dict, issuer_registry: dict) -> dict:
    """检查 10: Issuer 信任评估 — issuer trust_level ∈ {trusted, verified}"""
    rule = report.get("rule", {})
    rule_issuer = rule.get("issuer")
    
    issuer_info = issuer_registry.get(rule_issuer)
    issuer_trusted = False
    trust_level = "unknown"
    if issuer_info:
        trust_level = issuer_info.get("trust_level", "unknown")
        issuer_trusted = trust_level in ("trusted", "verified")
    
    return {
        "check": "issuer_trust",
        "passed": issuer_trusted,
        "detail": f"Issuer {rule_issuer} 信任级别: {trust_level}",
        "layer": 3,
    }


# ═══════════════════════════════════════════════════════════════
#  核心验证函数
# ═══════════════════════════════════════════════════════════════

def run_conformance_test(
    test_file: str,
    report: dict,
    rule_registry: dict,
    issuer_registry: dict,
) -> dict:
    """
    运行单个一致性测试。
    
    参数:
    - test_file: 测试用例 JSON 路径
    - report: 被测 CTRS Report（从端点获取或本地加载）
    - rule_registry: Rule 注册表
    - issuer_registry: Issuer 注册表
    
    返回:
    {
        "test_id": "test_001",
        "status": "PASS" | "FAIL",
        "checks": { "schema_completeness": True, ... },
        "failed_checks": [],
        "message": "All checks passed" | "Failed: ..."
    }
    """
    test_case = _load_json(test_file)
    test_id = test_case.get("test_id", "unknown")
    
    # 执行 10 项检查
    check_results = [
        check_schema_completeness(report),
        check_claim_integrity(report),
        check_evidence_hash_integrity(report),
        check_evidence_claim_ref(report),
        check_attribution_consistency(report),
        check_settlement_correctness(report),
        check_rule_integrity(report),
        check_attribution_rule_binding(report),
        check_rule_registration(report, rule_registry),
        check_issuer_trust(report, issuer_registry),
    ]
    
    # 构建结果
    checks_dict = {}
    failed_checks = []
    check_details = {}
    
    for cr in check_results:
        check_name = cr["check"]
        checks_dict[check_name] = cr["passed"]
        check_details[check_name] = cr["detail"]
        if not cr["passed"]:
            failed_checks.append(check_name)
    
    # 如果测试用例指定了只检查某些项目，过滤
    test_checks = test_case.get("checks", [])
    if test_checks:
        # 只关注测试用例中列出的检查
        relevant_failed = [c for c in failed_checks if c in test_checks]
    else:
        relevant_failed = failed_checks
    
    # 对于负面测试：expected_fail_checks 中的检查应该 FAIL
    expected_fail_checks = test_case.get("expected_fail_checks", [])
    category = test_case.get("category", "positive")
    
    if category == "negative" and expected_fail_checks:
        # 负面测试：期望的检查应该 FAIL，其他应该 PASS
        unexpected_pass = []
        unexpected_fail = []
        for check_name in test_checks:
            if check_name in expected_fail_checks:
                if checks_dict.get(check_name, True):
                    unexpected_pass.append(check_name)  # 应该 FAIL 但 PASS 了
            else:
                if not checks_dict.get(check_name, False):
                    unexpected_fail.append(check_name)  # 应该 PASS 但 FAIL 了
        
        passed = len(unexpected_pass) == 0 and len(unexpected_fail) == 0
        if unexpected_pass:
            msg = f"期望 FAIL 但 PASS: {unexpected_pass}"
        elif unexpected_fail:
            msg = f"期望 PASS 但 FAIL: {unexpected_fail}"
        else:
            msg = "负面测试通过 — 预期失败的检查确实失败"
    else:
        # 正面测试：所有检查应该 PASS
        passed = len(relevant_failed) == 0
        if passed:
            msg = "All checks passed"
        else:
            msg = f"Failed: {relevant_failed}"
    
    return {
        "test_id": test_id,
        "test_name": test_case.get("name", ""),
        "status": "PASS" if passed else "FAIL",
        "checks": checks_dict,
        "check_details": check_details,
        "failed_checks": relevant_failed,
        "message": msg,
        "category": category,
    }


def format_result(result: dict) -> str:
    """格式化单个测试结果为可读输出"""
    lines = []
    lines.append(f"CTRS Conformance Test: {result['test_id']}")
    lines.append(f"名称: {result['test_name']}")
    lines.append(f"类别: {result['category']}")
    lines.append("━" * 40)
    
    for check_name, passed in result["checks"].items():
        icon = "✅" if passed else "❌"
        detail = result["check_details"].get(check_name, "")
        lines.append(f"  {icon} {check_name}: {detail}")
    
    lines.append("")
    status_icon = "✅" if result["status"] == "PASS" else "❌"
    lines.append(f"Result: {result['status']} {status_icon}")
    
    if result["failed_checks"]:
        lines.append(f"  失败检查: {result['failed_checks']}")
    
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════
#  主程序
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="CTRS v1.2 一致性测试验证器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 远程模式 — 向被测实现发送请求
  python conformance_validator.py --test tests/test_001_basic_report.json --endpoint https://api.fly-agent.xyz/v1/verify

  # 本地模式 — 直接验证一份 CTRS Report
  python conformance_validator.py --test tests/test_001_basic_report.json --report report.json

  # 批量运行所有测试
  python conformance_validator.py --all --endpoint https://api.fly-agent.xyz/v1/verify

  # 指定 Registry 目录
  python conformance_validator.py --all --endpoint https://api.fly-agent.xyz/v1/verify --registry /path/to/fly-registry
        """,
    )
    
    # 测试来源（互斥）
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--test", help="单个测试用例 JSON 文件路径")
    source_group.add_argument("--all", action="store_true", help="运行 tests/ 目录下所有测试")
    
    # Report 来源（互斥，但如果测试用例自带 report 则都可选）
    report_group = parser.add_mutually_exclusive_group(required=False)
    report_group.add_argument("--endpoint", help="被测实现的 API 端点 URL")
    report_group.add_argument("--report", help="本地 CTRS Report JSON 文件路径")
    
    # 可选参数
    parser.add_argument("--registry", help="Registry 目录路径", default=None)
    parser.add_argument("--timeout", type=int, help="HTTP 请求超时（秒）", default=30)
    parser.add_argument("--output", help="输出结果到 JSON 文件", default=None)
    parser.add_argument("--verbose", "-v", action="store_true", help="详细输出")
    
    args = parser.parse_args()
    
    # 加载 Registry
    rule_registry, issuer_registry = _load_registry(args.registry)
    
    if rule_registry:
        print(f"[信息] 已加载 Rule Registry: {len(rule_registry)} 条规则")
    else:
        print("[警告] 未找到 Rule Registry — rule_registration 和 issuer_trust 检查将跳过")
    
    # 确定测试文件列表
    if args.all:
        tests_dir = os.path.join(os.path.dirname(__file__), "tests")
        test_files = sorted([
            os.path.join(tests_dir, f)
            for f in os.listdir(tests_dir)
            if f.startswith("test_") and f.endswith(".json")
        ])
    else:
        test_files = [args.test]
    
    # 运行测试
    all_results = []
    
    for test_file in test_files:
        if not os.path.exists(test_file):
            print(f"[错误] 测试文件不存在: {test_file}")
            continue
        
        test_case = _load_json(test_file)
        test_id = test_case.get("test_id", "unknown")
        
        if args.verbose:
            print(f"\n[运行] {test_id}: {test_case.get('name', '')}")
        
        # 获取 CTRS Report
        try:
            if args.endpoint:
                # 远程模式：向端点发送测试输入
                payload = test_case.get("input", {})
                report = _http_post_json(args.endpoint, payload, timeout=args.timeout)
            elif "report" in test_case:
                # 测试内嵌模式：测试用例自带完整 Report（用于负面测试）
                report = test_case["report"]
            elif args.report:
                # 本地模式：直接加载 Report 文件
                report = _load_json(args.report)
            else:
                raise RuntimeError("未指定 Report 来源：请使用 --endpoint、--report，或在测试用例中嵌入 report 字段")
        except Exception as e:
            result = {
                "test_id": test_id,
                "test_name": test_case.get("name", ""),
                "status": "FAIL",
                "checks": {},
                "check_details": {},
                "failed_checks": ["request_failed"],
                "message": f"获取 Report 失败: {e}",
                "category": test_case.get("category", "positive"),
            }
            all_results.append(result)
            print(format_result(result))
            print()
            continue
        
        # 执行验证
        result = run_conformance_test(
            test_file=test_file,
            report=report,
            rule_registry=rule_registry,
            issuer_registry=issuer_registry,
        )
        
        all_results.append(result)
        print(format_result(result))
        print()
    
    # 汇总
    if len(all_results) > 1:
        print()
        print("CTRS Conformance Test Suite")
        print("━" * 40)
        for r in all_results:
            icon = "✅" if r["status"] == "PASS" else "❌"
            print(f"  {r['test_id']}: {r['status']} {icon}")
        
        pass_count = sum(1 for r in all_results if r["status"] == "PASS")
        total_count = len(all_results)
        print()
        print(f"Summary: {pass_count}/{total_count} PASSED")
        
        if pass_count < total_count:
            failed = [r for r in all_results if r["status"] == "FAIL"]
            print(f"\n失败测试:")
            for r in failed:
                print(f"  {r['test_id']}: {r['message']}")
    
    # 输出到文件
    if args.output:
        output_dir = os.path.dirname(args.output)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        print(f"\n[输出] 结果已保存到 {args.output}")
    
    # 返回码
    sys.exit(0 if all(r["status"] == "PASS" for r in all_results) else 1)


if __name__ == "__main__":
    main()
