"""
CTRS v1.2 Report Verifier
===========================
Fly Protocol - Commercial Trust Report Verification (with Social Authority)

Extends v1.1 verifier with:
  - Rule registry verification (is this rule registered?)
  - Issuer trust evaluation (is the issuer trusted?)
  - Full trust chain: Evidence → Rule Identity → Rule Authority

Verification checks (10 total):
  1. Schema completeness
  2. Claim integrity
  3. Evidence hash integrity
  4. Rule integrity (v1.1)
  5. Attribution-rule binding (v1.1)
  6. Evidence-claim reference
  7. Attribution consistency
  8. Settlement correctness
  9. Rule registration (v1.2 NEW)
  10. Issuer trust (v1.2 NEW)
"""

import hashlib
import json
import os
import importlib.util

_scripts_dir = os.path.dirname(os.path.abspath(__file__))

# Import registry module
_spec = importlib.util.spec_from_file_location(
    "ctrs_v1_2_registry",
    os.path.join(_scripts_dir, "ctrs-v1.2-registry.py")
)
reg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(reg)


def _compute_evidence_hash(data: dict) -> str:
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _compute_rule_hash(definition: dict) -> str:
    canonical = json.dumps(definition, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ── v1.0 checks ────────────────────────────────────────────────

def _check_schema_completeness(report: dict) -> dict:
    required_fields = [
        "report_id", "schema_version", "type", "created_at",
        "status", "issuer", "claim", "evidence", "rule",
        "attribution", "settlement",
    ]
    missing = [f for f in required_fields if f not in report]
    return {
        "check": "schema_completeness",
        "passed": len(missing) == 0,
        "detail": f"Missing fields: {missing}" if missing else "All required fields present",
    }


def _check_claim_integrity(report: dict) -> dict:
    claim = report.get("claim", {})
    required = ["claim_id", "type", "subject", "description", "timestamp", "parties"]
    missing = [f for f in required if f not in claim]
    return {
        "check": "claim_integrity",
        "passed": len(missing) == 0,
        "detail": f"Missing claim fields: {missing}" if missing else "Claim fields complete",
    }


def _check_evidence_hash_integrity(report: dict) -> dict:
    evidence_list = report.get("evidence", [])
    if not evidence_list:
        return {"check": "evidence_hash_integrity", "passed": False, "detail": "No evidence found"}

    issues = []
    for ev in evidence_list:
        stored_hash = ev.get("hash", "")
        computed_hash = _compute_evidence_hash(ev.get("data", {}))
        if computed_hash != stored_hash:
            issues.append(f"Evidence {ev.get('evidence_id', '?')}: hash mismatch")

    return {
        "check": "evidence_hash_integrity",
        "passed": len(issues) == 0,
        "detail": "; ".join(issues) if issues else "All evidence hashes verified",
    }


def _check_rule_integrity(report: dict) -> dict:
    """v1.1: hash(rule.definition) == rule.hash"""
    rule = report.get("rule", {})
    if not rule:
        return {"check": "rule_integrity", "passed": False, "detail": "No rule in report"}

    required_rule_fields = ["rule_id", "issuer", "version", "hash", "definition"]
    missing = [f for f in required_rule_fields if f not in rule]
    if missing:
        return {"check": "rule_integrity", "passed": False, "detail": f"Rule missing: {missing}"}

    stored_hash = rule["hash"]
    computed_hash = _compute_rule_hash(rule["definition"])
    if computed_hash != stored_hash:
        return {
            "check": "rule_integrity",
            "passed": False,
            "detail": f"Rule hash mismatch! stored={stored_hash[:16]}..., computed={computed_hash[:16]}...",
        }

    return {
        "check": "rule_integrity",
        "passed": True,
        "detail": f"Rule integrity verified (rule_id={rule['rule_id']}, issuer={rule['issuer']})",
    }


def _check_attribution_rule_binding(report: dict) -> dict:
    """v1.1: attribution.rule_hash == rule.hash"""
    rule = report.get("rule", {})
    attribution = report.get("attribution", {})
    rule_hash = rule.get("hash", "")
    attr_hash = attribution.get("rule_hash", "")

    if not attr_hash:
        return {"check": "attribution_rule_binding", "passed": False, "detail": "Missing rule_hash in attribution"}
    if attr_hash != rule_hash:
        return {"check": "attribution_rule_binding", "passed": False, "detail": f"Attribution rule_hash mismatch"}

    return {"check": "attribution_rule_binding", "passed": True, "detail": "Attribution correctly bound to rule_hash"}


def _check_evidence_claim_ref(report: dict) -> dict:
    claim_id = report.get("claim", {}).get("claim_id", "")
    issues = []
    for ev in report.get("evidence", []):
        if ev.get("claim_ref", "") != claim_id:
            issues.append(f"Evidence {ev.get('evidence_id', '?')}: claim_ref mismatch")
    return {
        "check": "evidence_claim_ref",
        "passed": len(issues) == 0,
        "detail": "; ".join(issues) if issues else "All evidence references correct",
    }


def _check_attribution_consistency(report: dict) -> dict:
    attribution = report.get("attribution", {})
    claim_id = report.get("claim", {}).get("claim_id", "")
    issues = []

    if attribution.get("claim_ref", "") != claim_id:
        issues.append("Attribution claim_ref mismatch")

    result_entries = attribution.get("result", [])
    if result_entries:
        total_pct = sum(int(r.get("contribution_pct", "0")) for r in result_entries)
        if total_pct != 100:
            issues.append(f"Attribution percentages sum to {total_pct}%, expected 100%")

    if not attribution.get("rule_hash"):
        issues.append("Attribution missing rule_hash")

    return {
        "check": "attribution_consistency",
        "passed": len(issues) == 0,
        "detail": "; ".join(issues) if issues else "Attribution is consistent",
    }


def _check_settlement_correctness(report: dict) -> dict:
    attribution = report.get("attribution", {})
    settlement = report.get("settlement", {})
    issues = []

    if settlement.get("attribution_ref", "") != attribution.get("attribution_id", ""):
        issues.append("Settlement attribution_ref mismatch")

    result_map = {r["party_id"]: r for r in attribution.get("result", [])}
    for split_entry in settlement.get("split", []):
        pid = split_entry.get("party_id", "")
        if pid not in result_map:
            issues.append(f"Settlement split for {pid} not in attribution")
            continue
        attr = result_map[pid]
        if split_entry.get("share_pct") != attr.get("contribution_pct"):
            issues.append(f"Settlement pct mismatch for {pid}")
        if split_entry.get("share_amount") != attr.get("attributed_value"):
            issues.append(f"Settlement amount mismatch for {pid}")

    result_ids = {r["party_id"] for r in attribution.get("result", [])}
    eligible_ids = set(settlement.get("eligible_parties", []))
    if result_ids != eligible_ids:
        issues.append("Eligible parties mismatch")

    split_sum = sum(int(s.get("share_amount", "0")) for s in settlement.get("split", []))
    total = int(settlement.get("amount", "0"))
    if split_sum != total:
        issues.append(f"Settlement split sum ({split_sum}) != total ({total})")

    return {
        "check": "settlement_correctness",
        "passed": len(issues) == 0,
        "detail": "; ".join(issues) if issues else "Settlement correctly reflects attribution",
    }


# ── v1.2 NEW checks ────────────────────────────────────────────

def _check_rule_registration(report: dict) -> dict:
    """
    v1.2: Check if the rule is registered in the Rule Registry.
    This answers: "Has this rule been published to the public registry?"
    """
    rule = report.get("rule", {})
    if not rule:
        return {
            "check": "rule_registration",
            "passed": False,
            "detail": "No rule in report",
        }

    reg_result = reg.verify_registration(rule)
    return {
        "check": "rule_registration",
        "passed": reg_result["registered"],
        "detail": reg_result["detail"],
    }


def _check_issuer_trust(report: dict) -> dict:
    """
    v1.2: Check if the rule issuer is trusted.
    This answers: "Is the entity that defined this rule a trusted authority?"
    """
    rule = report.get("rule", {})
    if not rule:
        return {
            "check": "issuer_trust",
            "passed": False,
            "detail": "No rule in report",
        }

    trust_result = reg.trust_check(rule)
    return {
        "check": "issuer_trust",
        "passed": trust_result["trusted"],
        "detail": (
            f"Issuer {rule['issuer']} trust_level={trust_result['trust_level']} "
            f"({trust_result['detail']})"
        ),
        "trust_level": trust_result["trust_level"],
    }


# ── Main verify function ───────────────────────────────────────

def verify_report(report: dict) -> dict:
    """
    Verify a CTRS v1.2 Fly Report for trustworthiness.

    10 checks covering all three protocol layers:
      Layer 1 - Execution Truth:  checks 1-3, 6-8
      Layer 2 - Structural Identity: checks 4-5
      Layer 3 - Social Authority: checks 9-10
    """
    checks = [
        # Layer 1: Execution Truth
        _check_schema_completeness(report),
        _check_claim_integrity(report),
        _check_evidence_hash_integrity(report),
        _check_evidence_claim_ref(report),
        _check_attribution_consistency(report),
        _check_settlement_correctness(report),
        # Layer 2: Structural Identity (v1.1)
        _check_rule_integrity(report),
        _check_attribution_rule_binding(report),
        # Layer 3: Social Authority (v1.2 NEW)
        _check_rule_registration(report),
        _check_issuer_trust(report),
    ]

    issues = [c for c in checks if not c["passed"]]
    all_passed = len(issues) == 0

    return {
        "valid": all_passed,
        "checks": checks,
        "issues": [c["detail"] for c in issues],
    }
