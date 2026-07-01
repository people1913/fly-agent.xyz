"""
Fly Trust Loop v1.2 — 完整协议闭环（含 Social Authority）
=========================================================
证明：
  1. 两个互不认识的 Agent，对同一份 Report 独立验证，得到一致结论
  2. Rule 作为一等对象，可追溯、可验证、不可伪造
  3. Issuer 可信度可被第三方独立评估

闭环流程：
  Phase 1: 注册 Issuer（建立信任锚点）
  Phase 2: Agent A 构建 Rule → 注册到 Registry → 生成 Report → Store
  Phase 3: Agent B 从 Store 加载 → 独立验证（10 项检查）→ 结论

十个协议成立条件（三层）：
  Layer 1 - Execution Truth:
    1. Generate    2. Evidence Hash  3. Version
    4. Evidence-Claim Ref  5. Attribution Consistency  6. Settlement Correctness
  Layer 2 - Structural Identity:
    7. Rule Integrity  8. Attribution-Rule Binding
  Layer 3 - Social Authority:
    9. Rule Registration  10. Issuer Trust
"""

import json
import sys
import os
import uuid
import importlib.util
from datetime import datetime, timezone

_scripts_dir = os.path.dirname(os.path.abspath(__file__))


def _load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(_scripts_dir, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


gen = _load_module("ctrs_v1_1_generator", "ctrs-v1.1-generator.py")
ver = _load_module("ctrs_v1_2_verify", "ctrs-v1.2-verify.py")
sto = _load_module("ctrs_v1_store", "ctrs-v1-store.py")
reg = _load_module("ctrs_v1_2_registry", "ctrs-v1.2-registry.py")


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc).isoformat()


def _print_section(title):
    print()
    print("=" * 72)
    print(f"  {title}")
    print("=" * 72)
    print()


def _print_subsection(title):
    print()
    print(f"┌─────────────────────────────────────────────────────────┐")
    print(f"│  {title}")
    print(f"└─────────────────────────────────────────────────────────┘")
    print()


def main():
    print()
    print("█" * 72)
    print("█" + " " * 70 + "█")
    print("█" + "  FLY TRUST LOOP v1.2 — FULL PROTOCOL CLOSED LOOP".center(70) + "█")
    print("█" + "  Rule as First-Class Object + Social Authority Layer".center(70) + "█")
    print("█" + " " * 70 + "█")
    print("█" * 72)

    # ════════════════════════════════════════════════════════════════
    #  PHASE 1: 注册 Issuer（建立信任锚点）
    # ════════════════════════════════════════════════════════════════
    _print_section("PHASE 1: 注册 Issuer — 建立信任锚点")

    # 注册一个可信的 Issuer
    issuer_record = reg.register_issuer(
        issuer_id="did:fly:platform-x",
        name="Platform X — Agent Commerce Platform",
        trust_level="trusted",
        metadata={
            "description": "Leading agent commerce platform, audited by Fly Foundation",
            "audit_date": "2026-06-01",
        },
    )
    print(f"  ✅ Issuer 已注册")
    print(f"     ID:         {issuer_record['issuer_id']}")
    print(f"     Name:       {issuer_record['name']}")
    print(f"     Trust:      {issuer_record['trust_level']}")
    print(f"     Registered: {issuer_record['registered_at']}")

    # ════════════════════════════════════════════════════════════════
    #  PHASE 2: Agent A — 构建 Rule → 注册 → 生成 Report → Store
    # ════════════════════════════════════════════════════════════════
    _print_section("PHASE 2: Agent A — 构建 Rule & 生成 Report")

    # Step 1: Build Rule as First-Class Object
    rule = gen.build_rule(
        rule_id="rule-multi-agent-v1",
        issuer="did:fly:platform-x",
        version="1.0.0",
        definition={
            "name": "三Agent协作归因规则",
            "method": "proportional",
            "description": "推荐40% / 讲解35% / 支付渠道25%",
            "parameters": {
                "total_value": "120",
                "currency": "USD",
                "splits": {
                    "agent-a": "40",
                    "agent-b": "35",
                    "agent-c": "25",
                },
            },
            "visibility": "public",
        },
    )
    print(f"  📜 Rule 构建完成（First-Class Object）")
    print(f"     rule_id:  {rule['rule_id']}")
    print(f"     issuer:   {rule['issuer']}")
    print(f"     version:  {rule['version']}")
    print(f"     hash:     {rule['hash'][:40]}...")

    # Step 2: Register Rule in Registry
    _print_subsection("注册 Rule 到 Registry")
    reg_result = reg.register_rule(rule)
    print(f"  ✅ Rule 已注册到全局 Registry")
    print(f"     rule_id:        {reg_result['rule_id']}")
    print(f"     issuer:         {reg_result['issuer']}")
    print(f"     issuer_trust:   {reg_result['issuer_trust']}")
    print(f"     status:         {reg_result['status']}")

    # Step 3: Build Claim & Evidence
    claim_id = _uuid()
    claim = {
        "claim_id": claim_id,
        "type": "multi_agent_conversion",
        "subject": "User 购买 Product X，由多 Agent 协作促成",
        "description": (
            "Agent A 推荐 → Agent B 讲解 → Agent C 完成支付。"
            "交易金额 $120。"
        ),
        "timestamp": _now(),
        "parties": [
            {"id": "agent-a", "role": "recommender", "name": "Agent A（推荐Agent）"},
            {"id": "agent-b", "role": "explainer", "name": "Agent B（讲解Agent）"},
            {"id": "agent-c", "role": "payment_agent", "name": "Agent C（支付Agent）"},
            {"id": "user-1", "role": "buyer", "name": "User"},
        ],
    }

    evidence_list = [
        {
            "evidence_id": _uuid(),
            "claim_ref": claim_id,
            "type": "conversation",
            "source": "agent-a",
            "timestamp": _now(),
            "data": {
                "action": "product_recommendation",
                "product_id": "product-x",
                "recommended_to": "user-1",
                "message": "根据你的偏好，推荐 Product X，好评率 98%，预算内。",
            },
        },
        {
            "evidence_id": _uuid(),
            "claim_ref": claim_id,
            "type": "conversation",
            "source": "agent-b",
            "timestamp": _now(),
            "data": {
                "action": "product_explanation",
                "product_id": "product-x",
                "explained_to": "user-1",
                "message": "Product X：1) 高端做工 2) 两年质保 3) 30天无理由退。",
                "duration_seconds": 180,
            },
        },
        {
            "evidence_id": _uuid(),
            "claim_ref": claim_id,
            "type": "payment",
            "source": "agent-c",
            "timestamp": _now(),
            "data": {
                "action": "payment_completed",
                "transaction_id": f"TXN-{_uuid()[:8]}",
                "product_id": "product-x",
                "buyer": "user-1",
                "amount": "120",
                "currency": "USD",
                "status": "completed",
            },
        },
    ]

    # Step 4: Generate Report
    report = gen.generate_report(claim, evidence_list, rule)
    print(f"  ✅ Report 已生成 (schema: {report['schema_version']})")
    print(f"     Report ID: {report['report_id']}")

    # Step 5: Store
    store_result = sto.store_report(report)
    print(f"  ✅ Report 已持久化到 Store")
    print(f"     Storage Hash: {store_result['storage_hash'][:32]}...")
    print(f"     Version: {store_result['version']}")

    # ════════════════════════════════════════════════════════════════
    #  PHASE 3: Agent B — 独立验证
    # ════════════════════════════════════════════════════════════════
    _print_section("PHASE 3: Agent B（独立验证方）— 加载 & 全链路验证")

    # Load from Store
    loaded_report = sto.load_report(store_result["report_id"])
    print(f"  ✅ Report 已从 Store 加载")
    print(f"     Report ID: {loaded_report['report_id']}")

    # Verify (10 checks)
    verification = ver.verify_report(loaded_report)

    _print_subsection("验证结果（10 项检查，三层覆盖）")

    layer1_checks = verification["checks"][:6]
    layer2_checks = verification["checks"][6:8]
    layer3_checks = verification["checks"][8:]

    print("  ── Layer 1: Execution Truth ──")
    for check in layer1_checks:
        status = "✅" if check["passed"] else "❌"
        print(f"    {status} {check['check']}: {check['detail']}")

    print()
    print("  ── Layer 2: Structural Identity ──")
    for check in layer2_checks:
        status = "✅" if check["passed"] else "❌"
        print(f"    {status} {check['check']}: {check['detail']}")

    print()
    print("  ── Layer 3: Social Authority ──")
    for check in layer3_checks:
        status = "✅" if check["passed"] else "❌"
        extra = ""
        if "trust_level" in check:
            extra = f" [trust={check['trust_level']}]"
        print(f"    {status} {check['check']}: {check['detail']}{extra}")

    passed_count = sum(1 for c in verification["checks"] if c["passed"])
    print(f"\n  总计: {passed_count}/{len(verification['checks'])} checks passed")

    # ════════════════════════════════════════════════════════════════
    #  闭环判定
    # ════════════════════════════════════════════════════════════════
    _print_section("🔗 TRUST LOOP v1.2 闭环判定")

    loop_closed = verification["valid"]

    if loop_closed:
        print("  ✅ 闭环成立")
        print()
        print("  ┌─────────────────────────────────────────────────────────────┐")
        print("  │  Agent A 构建 Rule → 注册到 Registry → 生成 Report → Store │")
        print("  │  Agent B 从 Store 加载 → 独立验证（10 项）→ 全部通过       │")
        print("  └─────────────────────────────────────────────────────────────┘")
        print()
        print("  结论：")
        print("    1. 两个互不认识的 Agent，对同一份 Report 独立验证得出一致结论")
        print("    2. Rule 可追溯、可验证、不可伪造（Rule Identity ✔）")
        print("    3. Issuer 可信度可被第三方独立评估（Social Authority ✔）")
        print()
        print("  → Fly 协议从「能跑」升级到「不可篡改」再到「可治理」。")
    else:
        print("  ❌ 闭环不成立")
        for issue in verification["issues"]:
            print(f"     ⚠ {issue}")

    # ════════════════════════════════════════════════════════════════
    #  结算结果
    # ════════════════════════════════════════════════════════════════
    if loop_closed:
        _print_section("💰 SETTLEMENT READY")

        settlement = loaded_report["settlement"]
        print(f"  总金额: {settlement['currency']} {settlement['amount']}")
        print(f"  状态:   {settlement['status']}")
        print()
        print(f"  {'参与方':<24} {'贡献':>8} {'结算金额':>12}")
        print(f"  {'─' * 24} {'─' * 8} {'─' * 12}")
        party_names = {p["id"]: p["name"] for p in claim["parties"]}
        for split in settlement["split"]:
            name = party_names.get(split["party_id"], split["party_id"])
            print(f"  {name:<24} {split['share_pct']:>7}% {settlement['currency']} {split['share_amount']:>8}")

    # ════════════════════════════════════════════════════════════════
    #  v1.2 新增能力对比
    # ════════════════════════════════════════════════════════════════
    _print_section("📊 v1.0 → v1.1 → v1.2 演进总结")

    print("  ┌────────────────────┬──────────┬──────────┬──────────┐")
    print("  │ 能力               │  v1.0    │  v1.1    │  v1.2    │")
    print("  ├────────────────────┼──────────┼──────────┼──────────┤")
    print("  │ Evidence Hash      │    ✅     │    ✅     │    ✅    │")
    print("  │ Rule as Object     │    ❌     │    ✅     │    ✅    │")
    print("  │ Rule Hash          │    ❌     │    ✅     │    ✅    │")
    print("  │ Attribution绑定    │    ❌     │    ✅     │    ✅    │")
    print("  │ Rule Registry      │    ❌     │    ❌     │    ✅    │")
    print("  │ Issuer Trust       │    ❌     │    ❌     │    ✅    │")
    print("  │ 第三方独立验证     │    部分   │    完整   │    完整  │")
    print("  │ 规则不可伪造       │    ❌     │    ✅     │    ✅    │")
    print("  │ 规则来源可审计     │    ❌     │    ❌     │    ✅    │")
    print("  └────────────────────┴──────────┴──────────┴──────────┘")

    print()
    print("=" * 72)
    print("  Fly Trust Loop v1.2 — 协议完整闭环（含 Social Authority）")
    print("=" * 72)
    print()


if __name__ == "__main__":
    main()
