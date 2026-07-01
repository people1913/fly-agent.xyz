"""
CTRS v1.1 Report Verifier
===========================
Fly Protocol - Commercial Trust Report Verification

v1.1 additions:
  - Rule integrity check: hash(rule.definition) == rule.hash
  - Attribution-rule binding check: attribution.rule_hash == rule.hash

Verifies that a Fly Report is trustworthy by checking:
1. Schema completeness (v1.1 includes rule field)
2. Evidence hash integrity (immutability)
3. Rule integrity (v1.1: rule definition matches its hash)
4. Attribution-rule binding (v1.1: attribution binds to rule_hash)
5. Attribution consistency
6. Settlement correctness
"""

import hashlib
import json


def _compute_evidence_hash(data: dict) -> str:
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _compute_rule_hash(definition: dict) -> str:
    """SHA-256 of rule definition — the identity of a Rule in v1.1."""
    canonical = json.dumps(definition, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _check_schema_completeness(report: dict) -> dict:
    """Check all required top-level fields (v1.1 adds 'rule')."""
    required_fields = [
        "report_id",
        "schema_version",
        "type",
        "created_at",
        "status",
        "issuer",
        "claim",
        "evidence",
        "rule",         # v1.1: rule is now a top-level required field
        "attribution",
        "settlement",
    ]
    missing = [f for f in required_fields if f not in report]
    return {
        "check": "schema_completeness",
        "passed": len(missing) == 0,
        "detail": f"Missing fields: {missing}" if missing else "All required fields present (v1.1)",
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
    """Verify that no evidence data has been tampered with."""
    evidence_list = report.get("evidence", [])
    if not evidence_list:
        return {
            "check": "evidence_hash_integrity",
            "passed": False,
            "detail": "No evidence found in report",
        }

    issues = []
    for ev in evidence_list:
        stored_hash = ev.get("hash", "")
        computed_hash = _compute_evidence_hash(ev.get("data", {}))
        if computed_hash != stored_hash:
            issues.append(
                f"Evidence {ev.get('evidence_id', '?')}: hash mismatch "
                f"(stored={stored_hash[:16]}..., computed={computed_hash[:16]}...)"
            )

    return {
        "check": "evidence_hash_integrity",
        "passed": len(issues) == 0,
        "detail": "; ".join(issues) if issues else "All evidence hashes verified",
    }


def _check_rule_integrity(report: dict) -> dict:
    """
    v1.1 critical check: hash(rule.definition) == rule.hash
    This ensures the rule definition has not been tampered with.
    Without this, anyone could forge attribution rules.
    """
    rule = report.get("rule", {})
    if not rule:
        return {
            "check": "rule_integrity",
            "passed": False,
            "detail": "No rule found in report (v1.1 requires rule as first-class object)",
        }

    # Check required rule fields
    required_rule_fields = ["rule_id", "issuer", "version", "hash", "definition"]
    missing = [f for f in required_rule_fields if f not in rule]
    if missing:
        return {
            "check": "rule_integrity",
            "passed": False,
            "detail": f"Rule missing required fields: {missing}",
        }

    # Core check: hash(definition) == hash
    stored_hash = rule["hash"]
    computed_hash = _compute_rule_hash(rule["definition"])

    if computed_hash != stored_hash:
        return {
            "check": "rule_integrity",
            "passed": False,
            "detail": (
                f"Rule integrity FAILED! "
                f"rule_id={rule['rule_id']}, issuer={rule['issuer']}, "
                f"stored_hash={stored_hash[:16]}..., "
                f"computed_hash={computed_hash[:16]}... "
                f"— Rule definition may have been tampered with!"
            ),
        }

    return {
        "check": "rule_integrity",
        "passed": True,
        "detail": (
            f"Rule integrity verified (rule_id={rule['rule_id']}, "
            f"issuer={rule['issuer']}, version={rule['version']})"
        ),
    }


def _check_attribution_rule_binding(report: dict) -> dict:
    """
    v1.1 critical check: attribution.rule_hash must match rule.hash.
    This ensures attribution is bound to the specific rule version,
    not to arbitrary text that could be swapped.
    """
    rule = report.get("rule", {})
    attribution = report.get("attribution", {})
    issues = []

    rule_hash = rule.get("hash", "")
    attr_rule_hash = attribution.get("rule_hash", "")

    if not attr_rule_hash:
        issues.append("Attribution missing rule_hash (v1.1 requires binding to rule_hash)")
    elif attr_rule_hash != rule_hash:
        issues.append(
            f"Attribution rule_hash mismatch! "
            f"attribution.rule_hash={attr_rule_hash[:16]}..., "
            f"rule.hash={rule_hash[:16]}... "
            f"— Attribution was computed with a different rule!"
        )

    return {
        "check": "attribution_rule_binding",
        "passed": len(issues) == 0,
        "detail": "; ".join(issues) if issues else "Attribution correctly bound to rule_hash",
    }


def _check_evidence_claim_ref(report: dict) -> dict:
    claim_id = report.get("claim", {}).get("claim_id", "")
    evidence_list = report.get("evidence", [])
    issues = []

    for ev in evidence_list:
        if ev.get("claim_ref", "") != claim_id:
            issues.append(
                f"Evidence {ev.get('evidence_id', '?')}: claim_ref mismatch"
            )

    return {
        "check": "evidence_claim_ref",
        "passed": len(issues) == 0,
        "detail": "; ".join(issues) if issues else "All evidence references correct claim",
    }


def _check_attribution_consistency(report: dict) -> dict:
    attribution = report.get("attribution", {})
    claim_id = report.get("claim", {}).get("claim_id", "")
    issues = []

    if attribution.get("claim_ref", "") != claim_id:
        issues.append(f"Attribution claim_ref mismatch")

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

    attribution_id = attribution.get("attribution_id", "")
    if settlement.get("attribution_ref", "") != attribution_id:
        issues.append(f"Settlement attribution_ref mismatch")

    result_map = {r["party_id"]: r for r in attribution.get("result", [])}
    for split_entry in settlement.get("split", []):
        party_id = split_entry.get("party_id", "")
        if party_id not in result_map:
            issues.append(f"Settlement split for {party_id} not in attribution")
            continue

        attr_entry = result_map[party_id]
        if split_entry.get("share_pct") != attr_entry.get("contribution_pct"):
            issues.append(f"Settlement pct mismatch for {party_id}")
        if split_entry.get("share_amount") != attr_entry.get("attributed_value"):
            issues.append(f"Settlement amount mismatch for {party_id}")

    result_party_ids = {r["party_id"] for r in attribution.get("result", [])}
    eligible_party_ids = set(settlement.get("eligible_parties", []))
    if result_party_ids != eligible_party_ids:
        issues.append("Eligible parties mismatch between attribution and settlement")

    split_sum = sum(int(s.get("share_amount", "0")) for s in settlement.get("split", []))
    total_amount = int(settlement.get("amount", "0"))
    if split_sum != total_amount:
        issues.append(f"Settlement split sum ({split_sum}) != total ({total_amount})")

    return {
        "check": "settlement_correctness",
        "passed": len(issues) == 0,
        "detail": "; ".join(issues) if issues else "Settlement correctly reflects attribution",
    }


def verify_report(report: dict) -> dict:
    """
    Verify a CTRS v1.1 Fly Report for trustworthiness.

    Checks (in order):
    1. Schema completeness (includes rule field)
    2. Claim integrity
    3. Evidence hash integrity
    4. Rule integrity — hash(definition) == hash  [v1.1 NEW]
    5. Attribution-rule binding — attribution.rule_hash == rule.hash  [v1.1 NEW]
    6. Evidence-claim reference consistency
    7. Attribution consistency
    8. Settlement correctness

    Output:
    {
        "valid": true/false,
        "checks": [...],
        "issues": [...]
    }
    """
    checks = [
        _check_schema_completeness(report),
        _check_claim_integrity(report),
        _check_evidence_hash_integrity(report),
        _check_rule_integrity(report),              # v1.1 NEW
        _check_attribution_rule_binding(report),     # v1.1 NEW
        _check_evidence_claim_ref(report),
        _check_attribution_consistency(report),
        _check_settlement_correctness(report),
    ]

    issues = [c for c in checks if not c["passed"]]
    all_passed = len(issues) == 0

    return {
        "valid": all_passed,
        "checks": checks,
        "issues": [c["detail"] for c in issues],
    }
