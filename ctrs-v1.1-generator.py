"""
CTRS v1.1 Report Generator
============================
Fly Protocol - Commercial Trust Report Generator

Key v1.1 changes:
  - Rule is First-Class Object (rule_id + issuer + version + hash + definition)
  - Attribution binds to rule_hash, not rule text
  - hash(rule.definition) == rule.hash is enforced at generation time

Formula: Evidence + Rule = Attribution
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


def _compute_evidence_hash(data: dict) -> str:
    """SHA-256 of evidence data for immutability."""
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _compute_rule_hash(definition: dict) -> str:
    """
    SHA-256 of rule definition.
    This is the core of v1.1: rule identity is its hash.
    """
    canonical = json.dumps(definition, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _verify_evidence_integrity(evidence: dict) -> bool:
    data = evidence.get("data", {})
    stored_hash = evidence.get("hash", "")
    return _compute_evidence_hash(data) == stored_hash


def _verify_rule_integrity(rule: dict) -> bool:
    """
    v1.1 critical check: hash(rule.definition) == rule.hash
    Ensures the rule definition hasn't been tampered with.
    """
    definition = rule.get("definition", {})
    stored_hash = rule.get("hash", "")
    return _compute_rule_hash(definition) == stored_hash


def build_rule(
    rule_id: str,
    issuer: str,
    version: str,
    definition: dict,
) -> dict:
    """
    Build a Rule as First-Class Object.
    Automatically computes the hash from definition.

    Input:
    - rule_id: unique identifier
    - issuer: who defined this rule (DID / agent_id / org_id)
    - version: semver string
    - definition: the actual rule content (name, method, parameters, etc.)

    Output: Complete Rule object with computed hash
    """
    rule_hash = _compute_rule_hash(definition)
    return {
        "rule_id": rule_id,
        "issuer": issuer,
        "version": version,
        "hash": rule_hash,
        "definition": definition,
        "created_at": _now_iso(),
    }


def _compute_attribution(
    claim: dict,
    evidence_list: list,
    rule: dict,
) -> dict:
    """
    Compute attribution based on Evidence + Rule = Attribution.

    v1.1 change: attribution.result references rule_hash, not rule text.
    The reasoning includes rule_id and rule_hash for traceability.
    """
    claim_id = claim["claim_id"]
    definition = rule["definition"]
    parameters = definition.get("parameters", {})
    method = definition.get("method", "proportional")

    total_value = parameters.get("total_value", "0")
    currency = parameters.get("currency", "USD")
    splits = parameters.get("splits", {})  # { party_id: percentage_str }

    # Build attribution result per party
    result_entries = []
    total_value_int = int(total_value)

    for party_id, pct_str in splits.items():
        pct_int = int(pct_str)
        attributed_value = total_value_int * pct_int // 100
        result_entries.append({
            "party_id": party_id,
            "contribution_pct": pct_str,
            "attributed_value": str(attributed_value),
        })

    # Build reasoning — references rule_hash, not rule text
    party_names = {p["id"]: p.get("name", p["id"]) for p in claim.get("parties", [])}
    reasoning_parts = []
    for entry in result_entries:
        name = party_names.get(entry["party_id"], entry["party_id"])
        reasoning_parts.append(
            f"{name}({entry['party_id']}): {entry['contribution_pct']}% "
            f"= {currency} {entry['attributed_value']}"
        )

    reasoning = (
        f"Attribution based on rule '{definition.get('name', 'unknown')}' "
        f"(rule_id={rule['rule_id']}, rule_hash={rule['hash'][:16]}...): "
        + ", ".join(reasoning_parts)
    )

    return {
        "attribution_id": _uuid(),
        "claim_ref": claim_id,
        "rule_hash": rule["hash"],  # v1.1: bind to hash, not text
        "method": method,
        "confidence": parameters.get("confidence", 1.0),
        "result": result_entries,
        "reasoning": reasoning,
        "attributed_at": _now_iso(),
    }


def _compute_settlement(attribution: dict, rule: dict) -> dict:
    """Compute settlement from attribution results."""
    definition = rule["definition"]
    parameters = definition.get("parameters", {})
    total_value = parameters.get("total_value", "0")
    currency = parameters.get("currency", "USD")

    split_entries = []
    eligible_parties = []

    for entry in attribution["result"]:
        split_entries.append({
            "party_id": entry["party_id"],
            "share_pct": entry["contribution_pct"],
            "share_amount": entry["attributed_value"],
        })
        eligible_parties.append(entry["party_id"])

    return {
        "settlement_id": _uuid(),
        "attribution_ref": attribution["attribution_id"],
        "status": "eligible",
        "amount": total_value,
        "currency": currency,
        "split": split_entries,
        "eligible_parties": eligible_parties,
    }


def generate_report(claim: dict, evidence_list: list, rule: dict) -> dict:
    """
    Generate a complete Fly Report (CTRS v1.1).

    Input:
    - claim: 声明（谁做了什么）
    - evidence_list: 证据列表
    - rule: Rule as First-Class Object (must have rule_id, issuer, version, hash, definition)

    Output: Complete Fly Report JSON (CTRS v1.1)

    Process:
    1. Verify rule integrity: hash(rule.definition) == rule.hash
    2. Process evidence: compute & verify hashes
    3. Compute attribution: Evidence + rule_hash → Attribution
    4. Compute settlement
    5. Assemble full report
    """
    # Step 0: Verify rule integrity BEFORE anything else
    if not _verify_rule_integrity(rule):
        raise ValueError(
            f"Rule integrity check failed! "
            f"rule_id={rule.get('rule_id')}, "
            f"stored_hash={rule.get('hash', '')[:16]}..., "
            f"computed_hash={_compute_rule_hash(rule.get('definition', {}))[:16]}..."
        )

    # Step 1: Process evidence - compute hashes
    processed_evidence = []
    for ev in evidence_list:
        ev_copy = dict(ev)
        if "hash" not in ev_copy or not ev_copy["hash"]:
            ev_copy["hash"] = _compute_evidence_hash(ev_copy.get("data", {}))
        ev_copy["claim_ref"] = claim["claim_id"]
        if "evidence_id" not in ev_copy or not ev_copy["evidence_id"]:
            ev_copy["evidence_id"] = _uuid()
        if "timestamp" not in ev_copy or not ev_copy["timestamp"]:
            ev_copy["timestamp"] = _now_iso()
        processed_evidence.append(ev_copy)

    # Step 2: Verify evidence integrity
    for ev in processed_evidence:
        if not _verify_evidence_integrity(ev):
            raise ValueError(
                f"Evidence integrity check failed: evidence_id={ev.get('evidence_id')}"
            )

    # Step 3: Compute attribution (binds to rule_hash)
    attribution = _compute_attribution(claim, processed_evidence, rule)

    # Step 4: Compute settlement
    settlement = _compute_settlement(attribution, rule)

    # Step 5: Assemble full report
    report = {
        "report_id": _uuid(),
        "schema_version": "CTRS-v1.1",
        "type": "CommercialTrustReport",
        "created_at": _now_iso(),
        "status": "verified",
        "issuer": {
            "id": "fly-protocol",
            "name": "Fly Protocol Engine",
        },
        "claim": claim,
        "evidence": processed_evidence,
        "rule": rule,
        "attribution": attribution,
        "settlement": settlement,
    }

    return report
