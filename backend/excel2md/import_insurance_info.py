"""
Import insurance basic info from Excel, matching and merging with existing DB records.
"""
import sys
import os
import json
import re
import sqlite3
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from excel_tool import parse_excel_to_dfs

DB_PATH = os.path.join(os.path.expanduser("~"), ".family-assets-mgr", "data.db")
EXCEL_PATH = os.path.join(os.path.dirname(__file__), "保单基本信息.xlsx")


def parse_basic_info():
    """Parse basic info Excel."""
    results = parse_excel_to_dfs(EXCEL_PATH)
    df = list(results.values())[0]

    policies = []
    for _, row in df.iterrows():
        payment_str = str(row.get("交费期间", ""))
        payment_years = None
        m = re.match(r"(\d+)年", payment_str)
        if m:
            payment_years = int(m.group(1))

        start_date_raw = row.get("生效日期")
        if hasattr(start_date_raw, "strftime"):
            start_date = start_date_raw.strftime("%Y-%m-%d")
        else:
            start_date = str(start_date_raw).strip() if start_date_raw else None

        premium = row.get("保费（元）")
        try:
            premium = float(premium)
        except (ValueError, TypeError):
            premium = None

        policies.append({
            "name": str(row.get("险种", "")).strip(),
            "insurer": str(row.get("保司", "")).strip(),
            "insurance_type": str(row.get("险种类型", "")).strip(),
            "start_date": start_date,
            "coverage_period": str(row.get("保障期间", "")).strip(),
            "sum_insured": str(row.get("基本保额", "")).strip(),
            "annual_premium": premium,
            "payment_years": payment_years,
            "policyholder": str(row.get("投保人", "")).strip(),
        })

    return policies


def name_matches(excel_name, db_name):
    """Check if names match (one contains the other, or core parts match)."""
    if excel_name in db_name or db_name in excel_name:
        return True
    # Compare core part before first parenthesis
    core_excel = excel_name.split("（")[0].split("(")[0]
    core_db = db_name.split("（")[0].split("(")[0]
    return len(core_excel) > 4 and (core_excel in core_db or core_db in core_excel)


def match_db_record(policy, db_records):
    """Match a policy to an existing DB record by name + policy_no date matching."""
    candidates = [r for r in db_records if not r["matched"] and name_matches(policy["name"], r["name"])]

    if not candidates:
        return None

    if len(candidates) == 1:
        return candidates[0]

    # Multiple candidates (same product, different policyholders) - match by start_date proximity
    # DB start_date may be off by ~1 year due to cash value table calculation
    policy_start = policy["start_date"]
    if not policy_start:
        return candidates[0]

    best = None
    best_diff = float("inf")
    d1 = datetime.strptime(policy_start, "%Y-%m-%d")

    for rec in candidates:
        db_start = rec["meta"].get("start_date", "")
        if not db_start:
            continue
        d2 = datetime.strptime(db_start, "%Y-%m-%d")
        # Allow matching with ~1 year offset (cash value table calculation may add 1 year)
        diff = abs((d1 - d2).days)
        # Also check d1 + 1 year ≈ d2
        diff_plus_year = abs((d1.replace(year=d1.year + 1) - d2).days)
        actual_diff = min(diff, diff_plus_year)

        if actual_diff < best_diff:
            best_diff = actual_diff
            best = rec

    return best if best and best_diff < 5 else (candidates[0] if candidates else None)


def run(dry_run=True):
    policies = parse_basic_info()
    print(f"Parsed {len(policies)} policies from Excel\n")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    rows = conn.execute("SELECT id, name, meta FROM accounts WHERE category = 'insurance'").fetchall()
    db_records = []
    for r in rows:
        meta = json.loads(r["meta"]) if r["meta"] else {}
        db_records.append({"id": r["id"], "name": r["name"], "meta": meta, "matched": False})

    max_order = conn.execute("SELECT COALESCE(MAX(sort_order), 0) FROM accounts").fetchone()[0]
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for p in policies:
        match = match_db_record(p, db_records)

        update_fields = {
            "insurer": p["insurer"],
            "insurance_type": p["insurance_type"],
            "coverage_period": p["coverage_period"],
            "sum_insured": p["sum_insured"],
            "payment_years": p["payment_years"],
            "policyholder": p["policyholder"],
        }
        if p["annual_premium"]:
            update_fields["annual_premium"] = p["annual_premium"]

        if match:
            match["matched"] = True
            old_meta = match["meta"]
            old_meta.update(update_fields)
            # Use the actual start_date from basic info (more accurate)
            if p["start_date"]:
                old_meta["start_date"] = p["start_date"]

            if dry_run:
                print(f"[UPDATE] id={match['id']} {match['name']}")
                print(f"  ← {p['policyholder']} | {p['insurer']} | {p['insurance_type']} | 生效{p['start_date']} | 年缴¥{p['annual_premium']}")
            else:
                conn.execute(
                    "UPDATE accounts SET meta = ?, updated_at = ? WHERE id = ?",
                    (json.dumps(old_meta, ensure_ascii=False), now, match["id"]),
                )
                print(f"[UPDATED] id={match['id']} {match['name']}")
        else:
            meta = {
                "platform": "明亚保险",
                "start_date": p["start_date"],
                **update_fields,
            }

            if dry_run:
                print(f"[INSERT] {p['name']}")
                print(f"  {p['policyholder']} | {p['insurer']} | {p['insurance_type']} | 生效{p['start_date']} | 年缴¥{p['annual_premium']}")
            else:
                max_order += 1
                conn.execute(
                    "INSERT INTO accounts (name, category, enabled, sort_order, meta, created_at, updated_at) VALUES (?, 'insurance', 1, ?, ?, ?, ?)",
                    (p["name"], max_order, json.dumps(meta, ensure_ascii=False), now, now),
                )
                print(f"[INSERTED] {p['name']}")

    if not dry_run:
        conn.commit()
        print(f"\nDone!")
    else:
        print(f"\n[DRY RUN] Run with --apply to execute.")

    conn.close()


if __name__ == "__main__":
    run(dry_run="--apply" not in sys.argv)
