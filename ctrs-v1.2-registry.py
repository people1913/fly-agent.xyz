"""
CTRS v1.2 Rule Registry
========================
Fly Protocol - Social Authority Layer

v1.1 solved: Rule Identity (who defined it, what version, what hash)
v1.2 solves: Rule Authority (is this issuer trusted? is this rule registered?)

Without Registry:
  - Anyone can claim to be an issuer
  - No way to check if a rule is legitimate
  - Attribution could reference a fabricated rule

With Registry:
  - Rules are registered with their hash
  - Issuers are tracked with trust levels
  - Third parties can verify: "is this rule registered? by whom? at what trust level?"

Core functions:
  register_rule(rule, issuer_trust_level) → registration record
  lookup_rule(rule_id) → registered rule + trust info
  lookup_by_hash(rule_hash) → find rule by its fingerprint
  verify_registration(rule) → check if rule is registered and matches
  trust_check(rule) → full trust evaluation (registered + hash match + issuer trusted)
"""

import hashlib
import json
import os
from datetime import datetime, timezone

_REGISTRY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "output", "fly-registry")
_REGISTRY_FILE = os.path.join(_REGISTRY_DIR, "rule-registry.json")
_ISSUER_FILE = os.path.join(_REGISTRY_DIR, "issuer-registry.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _compute_rule_hash(definition: dict) -> str:
    canonical = json.dumps(definition, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _ensure_dirs():
    os.makedirs(_REGISTRY_DIR, exist_ok=True)


def _load_json(path: str, default) -> any:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def _save_json(path: str, data):
    _ensure_dirs()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ═══════════════════════════════════════════════════════════════
#  Issuer Registry（发行者注册表）
# ═══════════════════════════════════════════════════════════════

def register_issuer(
    issuer_id: str,
    name: str,
    trust_level: str = "trusted",
    metadata: dict = None,
) -> dict:
    """
    Register an issuer in the trust registry.

    trust_level:
      - "trusted":     fully trusted, rules auto-accepted
      - "verified":    identity verified, rules need validation
      - "unverified":  not verified, rules flagged for review
      - "revoked":     no longer trusted, rules rejected

    Returns: registration record
    """
    _ensure_dirs()
    registry = _load_json(_ISSUER_FILE, {})

    record = {
        "issuer_id": issuer_id,
        "name": name,
        "trust_level": trust_level,
        "registered_at": _now_iso(),
        "metadata": metadata or {},
    }
    registry[issuer_id] = record
    _save_json(_ISSUER_FILE, registry)
    return record


def get_issuer(issuer_id: str) -> dict | None:
    """Look up an issuer by ID."""
    registry = _load_json(_ISSUER_FILE, {})
    return registry.get(issuer_id)


def update_issuer_trust(issuer_id: str, trust_level: str) -> dict | None:
    """Update an issuer's trust level."""
    registry = _load_json(_ISSUER_FILE, {})
    if issuer_id not in registry:
        return None
    registry[issuer_id]["trust_level"] = trust_level
    registry[issuer_id]["updated_at"] = _now_iso()
    _save_json(_ISSUER_FILE, registry)
    return registry[issuer_id]


# ═══════════════════════════════════════════════════════════════
#  Rule Registry（规则注册表）
# ═══════════════════════════════════════════════════════════════

def register_rule(rule: dict) -> dict:
    """
    Register a Rule in the global registry.

    Input: Rule as First-Class Object (from v1.1)
    Output: Registration record with registry metadata

    The registry stores:
    - The full rule (including definition)
    - Registration timestamp
    - Issuer trust level at time of registration
    - Registration status
    """
    _ensure_dirs()
    registry = _load_json(_REGISTRY_FILE, {})

    rule_id = rule["rule_id"]
    rule_hash = rule["hash"]

    # Verify rule integrity before registering
    computed_hash = _compute_rule_hash(rule["definition"])
    if computed_hash != rule_hash:
        raise ValueError(
            f"Rule integrity check failed during registration! "
            f"rule_id={rule_id}, stored_hash={rule_hash[:16]}..., "
            f"computed_hash={computed_hash[:16]}..."
        )

    # Look up issuer trust level
    issuer_id = rule["issuer"]
    issuer = get_issuer(issuer_id)
    issuer_trust = issuer["trust_level"] if issuer else "unknown"

    # Register
    registration = {
        "rule_id": rule_id,
        "rule_hash": rule_hash,
        "issuer": issuer_id,
        "issuer_trust_at_registration": issuer_trust,
        "version": rule["version"],
        "rule": rule,  # full rule stored for reference
        "registered_at": _now_iso(),
        "status": "active",
    }

    # Support multiple versions of same rule_id
    if rule_id not in registry:
        registry[rule_id] = []
    registry[rule_id].append(registration)

    _save_json(_REGISTRY_FILE, registry)

    return {
        "rule_id": rule_id,
        "rule_hash": rule_hash,
        "issuer": issuer_id,
        "issuer_trust": issuer_trust,
        "status": "registered",
        "registered_at": registration["registered_at"],
    }


def lookup_rule(rule_id: str) -> list:
    """
    Look up all versions of a rule by rule_id.
    Returns list of registration records (newest last).
    """
    registry = _load_json(_REGISTRY_FILE, {})
    return registry.get(rule_id, [])


def lookup_by_hash(rule_hash: str) -> list:
    """
    Look up a rule by its hash.
    Returns all matching registrations (could be multiple if same hash registered by different issuers).
    """
    registry = _load_json(_REGISTRY_FILE, {})
    results = []
    for rule_id, registrations in registry.items():
        for reg in registrations:
            if reg["rule_hash"] == rule_hash:
                results.append(reg)
    return results


def verify_registration(rule: dict) -> dict:
    """
    Check if a rule is registered and its hash matches.
    This is the key v1.2 verification: "has this rule been published to the registry?"
    """
    rule_id = rule["rule_id"]
    rule_hash = rule["hash"]

    registrations = lookup_rule(rule_id)
    if not registrations:
        return {
            "registered": False,
            "detail": f"Rule {rule_id} not found in registry",
            "trust_level": "unknown",
        }

    # Find matching hash
    for reg in registrations:
        if reg["rule_hash"] == rule_hash:
            return {
                "registered": True,
                "detail": f"Rule {rule_id} v{reg['version']} registered by {reg['issuer']}",
                "trust_level": reg["issuer_trust_at_registration"],
                "registered_at": reg["registered_at"],
            }

    # Rule ID found but hash doesn't match → possible tampering or version mismatch
    latest = registrations[-1]
    return {
        "registered": False,
        "detail": (
            f"Rule {rule_id} found in registry but hash mismatch! "
            f"Registry hash: {latest['rule_hash'][:16]}..., "
            f"Provided hash: {rule_hash[:16]}... "
            f"— Rule may have been tampered with or is an unregistered version."
        ),
        "trust_level": "unknown",
    }


def trust_check(rule: dict) -> dict:
    """
    Full trust evaluation for a rule.
    Combines: registration check + hash verification + issuer trust level.

    Returns:
    {
        "trusted": bool,
        "checks": {
            "registered": bool,
            "hash_match": bool,
            "issuer_known": bool,
            "issuer_trusted": bool,
        },
        "trust_level": str,
        "detail": str
    }
    """
    rule_id = rule["rule_id"]
    rule_hash = rule["hash"]
    issuer_id = rule["issuer"]

    # Check 1: Is issuer known?
    issuer = get_issuer(issuer_id)
    issuer_known = issuer is not None
    issuer_trust = issuer["trust_level"] if issuer else "unknown"

    # Check 2: Is issuer trusted?
    issuer_trusted = issuer_trust in ("trusted", "verified")

    # Check 3: Is rule registered?
    reg_result = verify_registration(rule)
    registered = reg_result["registered"]

    # Check 4: Hash match (already covered by verify_registration, but explicit)
    computed_hash = _compute_rule_hash(rule["definition"])
    hash_match = computed_hash == rule_hash

    # Overall trust
    all_passed = registered and hash_match and issuer_known and issuer_trusted

    trust_level = "distrusted"
    if all_passed:
        trust_level = "trusted"
    elif registered and hash_match and issuer_known:
        trust_level = "partially_trusted"  # known issuer but not trusted level
    elif registered and hash_match:
        trust_level = "unverified_issuer"  # registered but issuer unknown

    detail_parts = []
    detail_parts.append(f"registered={'✅' if registered else '❌'}")
    detail_parts.append(f"hash_match={'✅' if hash_match else '❌'}")
    detail_parts.append(f"issuer_known={'✅' if issuer_known else '❌'}")
    detail_parts.append(f"issuer_trusted={'✅' if issuer_trusted else '❌'}")

    return {
        "trusted": all_passed,
        "checks": {
            "registered": registered,
            "hash_match": hash_match,
            "issuer_known": issuer_known,
            "issuer_trusted": issuer_trusted,
        },
        "trust_level": trust_level,
        "detail": ", ".join(detail_parts),
        "issuer_id": issuer_id,
        "issuer_trust": issuer_trust,
    }


def list_all_rules() -> list:
    """List all registered rule IDs."""
    registry = _load_json(_REGISTRY_FILE, {})
    return list(registry.keys())


def list_all_issuers() -> list:
    """List all registered issuers."""
    registry = _load_json(_ISSUER_FILE, {})
    return list(registry.values())
