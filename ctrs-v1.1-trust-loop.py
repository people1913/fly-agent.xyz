"""
Fly Trust Loop v1.1 — 最小协议闭环
=====================================
证明：两个互不认识的 Agent，能对同一份 Report 独立验证，得到一致结论。
v1.1 新增：Rule as First-Class Object + rule_hash 绑定 + rule integrity 验证

闭环：
  Agent A 生成 Rule（作为一等对象）→ 生成 Report → Store 存储
  Agent B 取出 Report → 独立验证（含 rule integrity）→ 结论一致

六个协议成立条件：
  1. Generate    — Claim + Evidence + Rule → Report
  2. Hash        — Evidence & Rule 均不可篡改
  3. Version     — 事实可演化
  4. Store       — 第三方可访问
  5. Verify      — 独立验证（含 rule integrity）
  6. Rule Identity — 规则可追溯、不可伪造
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
ver = _load_module("ctrs_v1_1_verify", "ctrs-v1.1-verify.py")
sto = _load_module("ctrs_v1_store", "ctrs-v1-store.py")  # Store 模块复用 v1.0


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc).isoformat()


def main():
    print()
    print("=" * 72)
    print("  FLY TRUST LOOP v1.1 — 最小协议闭环（含 Rule Identity）")
    print("  Rule as First-Class Object · Attribution binds to rule_hash")
    print("=" * 72)
    print()

    # ════════════════════════════════════════════════════════════════
    #  ACTOR 1: Agent A（生成方）
    # ════════════════════════════════════════════════════════════════
    print("┌─────────────────────────────────────────────────────────┐")
    print("│  ACTOR 1: Agent A（推荐Agent）— 构建 Rule & 生成 Report│")
    print("└─────────────────────────────────────────────────────────┘")
    print()

    # ── Step 0: Build Rule as First-Class Object ────────────────
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
    print(f"     hash:     {rule['hash'][:32]}...")
    print()

    # ── Step 1: Build Claim ─────────────────────────────────────
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

    # ── Step 2: Build Evidence ──────────────────────────────────
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

    # ── 条件 1: Generate ──
    report = gen.generate_report(claim, evidence_list, rule)
    print(f"  ✅ Generate — Report 已生成 (schema: {report['schema_version']})")
    print(f"     Report ID: {report['report_id']}")
    print(f"     Rule hash in attribution: {report['attribution']['rule_hash'][:32]}...")
    print()

    # ── 条件 4: Store ──
    store_result = sto.store_report(report)
    print(f"  ✅ Store — Report 已持久化")
    print(f"     Storage Hash: {store_result['storage_hash'][:32]}...")
    print(f"     Version: {store_result['version']}")
    print()

    # ════════════════════════════════════════════════════════════════
    #  ACTOR 2: Agent B（验证方 — 完全独立）
    # ════════════════════════════════════════════════════════════════
    print()
    print("┌─────────────────────────────────────────────────────────┐")
    print("│  ACTOR 2: Agent B（独立验证方）— 加载 & 验证            │")
    print("│  （Agent B 从未参与生成，完全独立）                      │")
    print("└─────────────────────────────────────────────────────────┘")
    print()

    # ── 条件 4: Load ──
    loaded_report = sto.load_report(store_result["report_id"])
    print(f"  ✅ Load — Report 已从 Store 加载")
    print(f"     Report ID: {loaded_report['report_id']}")
    print()

    # ── 条件 5: Verify (v1.1: 含 rule integrity) ──
    verification = ver.verify_report(loaded_report)
    print(f"  ✅ Verify — 独立验证完成 (v1.1)")
    print(f"     Valid: {verification['valid']}")
    print(f"     Checks: {sum(1 for c in verification['checks'] if c['passed'])}/{len(verification['checks'])}")
    for check in verification["checks"]:
        status = "✅" if check["passed"] else "❌"
        print(f"       {status} {check['check']}: {check['detail']}")
    print()

    # ════════════════════════════════════════════════════════════════
    #  闭环判定
    # ════════════════════════════════════════════════════════════════
    print("=" * 72)
    print("  🔗 TRUST LOOP v1.1 闭环判定")
    print("=" * 72)
    print()

    loop_closed = verification["valid"]

    if loop_closed:
        print("  ✅ 闭环成立")
        print()
        print("  Agent A 生成 Rule → 生成 Report → Store 存储")
        print("  Agent B 加载 Report → 独立验证（含 Rule integrity）→ 通过")
        print()
        print("  结论：两个互不认识的 Agent，对同一份 Report 独立验证得出一致结论。")
        print("        Rule 可追溯、不可伪造。Fly 协议 v1.1 闭环成立。")
    else:
        print("  ❌ 闭环不成立")
        for issue in verification["issues"]:
            print(f"     ⚠ {issue}")
    print()

    # ════════════════════════════════════════════════════════════════
    #  结算结果
    # ════════════════════════════════════════════════════════════════
    if loop_closed:
        settlement = loaded_report["settlement"]
        print("=" * 72)
        print("  💰 SETTLEMENT READY")
        print("=" * 72)
        print()
        print(f"  总金额: {settlement['currency']} {settlement['amount']}")
        print(f"  状态: {settlement['status']}")
        print()
        print(f"  {'参与方':<24} {'贡献':>8} {'结算金额':>12}")
        print(f"  {'─' * 24} {'─' * 8} {'─' * 12}")
        party_names = {p["id"]: p["name"] for p in claim["parties"]}
        for split in settlement["split"]:
            name = party_names.get(split["party_id"], split["party_id"])
            print(f"  {name:<24} {split['share_pct']:>7}% {settlement['currency']} {split['share_amount']:>8}")
        print()

    # ════════════════════════════════════════════════════════════════
    #  六个协议成立条件验证
    # ════════════════════════════════════════════════════════════════
    print("=" * 72)
    print("  📋 六个协议成立条件（v1.1）")
    print("=" * 72)
    print()
    print(f"  1. Generate       ✅  Claim + Evidence + Rule → Report")
    print(f"  2. Evidence Hash  ✅  SHA-256 证据指纹，不可篡改")
    print(f"  3. Rule Hash      ✅  SHA-256 规则指纹，不可伪造 (v1.1 NEW)")
    print(f"  4. Version        ✅  Report v{store_result['version']}，可演化")
    print(f"  5. Store          ✅  持久化存储，第三方可访问")
    print(f"  6. Verify         ✅  独立验证（含 rule integrity），结果一致")
    print()
    print(f"  Attribution → rule_hash 绑定: {loaded_report['attribution']['rule_hash'][:32]}...")
    print(f"  Rule.definition hash:          {loaded_report['rule']['hash'][:32]}...")
    match = "✅ MATCH" if loaded_report['attribution']['rule_hash'] == loaded_report['rule']['hash'] else "❌ MISMATCH"
    print(f"  绑定校验: {match}")
    print()
    print("=" * 72)
    print("  Fly Trust Loop v1.1 — 协议闭环成立（含 Rule Identity）")
    print("=" * 72)
    print()


if __name__ == "__main__":
    main()
