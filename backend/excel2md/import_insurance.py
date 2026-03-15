"""
Parse insurance cash value Excel and import into database.
"""
import sys
import os
import json
import sqlite3
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
from excel_tool import parse_excel_to_dfs

DB_PATH = os.path.join(os.path.expanduser("~"), ".family-assets-mgr", "data.db")
EXCEL_PATH = os.path.join(os.path.dirname(__file__), "保单现金价值.xlsx")


def parse_policies():
    """Parse Excel into list of policy dicts."""
    results = parse_excel_to_dfs(EXCEL_PATH)
    df = list(results.values())[0]

    cols = list(df.columns)
    policies = []

    # Columns come in pairs: (保单年度末, 现金价值) for each policy
    # But duplicate column names cause issues, so use iloc by position
    for i in range(0, len(cols), 2):
        header = cols[i]
        parts = header.split("保单号：")
        product_name = parts[0].strip()
        policy_no = parts[1].strip() if len(parts) > 1 else ""

        date_col_idx = i
        value_col_idx = i + 1

        cash_values = []
        start_date = None

        for row_idx in range(len(df)):
            date_val = df.iloc[row_idx, date_col_idx]
            cv_val = df.iloc[row_idx, value_col_idx]

            # Skip header row
            if isinstance(date_val, str) and "保单" in date_val:
                continue

            if date_val is None or cv_val is None:
                continue

            date_str = str(date_val).strip()
            if not date_str or date_str == "0" or date_str == "nan":
                continue

            try:
                cv = float(cv_val)
            except (ValueError, TypeError):
                continue

            if start_date is None:
                start_date = date_str

            cash_values.append(cv)

        if not cash_values or not start_date:
            continue

        # start_date = first year end - 1 year
        first_end = datetime.strptime(start_date, "%Y-%m-%d")
        actual_start = first_end.replace(year=first_end.year - 1)

        policies.append({
            "name": product_name,
            "policy_no": policy_no,
            "start_date": actual_start.strftime("%Y-%m-%d"),
            "cash_value_table": cash_values,
        })

    return policies


def import_to_db(policies, dry_run=True):
    """Import policies into database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Get max sort_order
    max_order = conn.execute("SELECT COALESCE(MAX(sort_order), 0) FROM accounts").fetchone()[0]

    for p in policies:
        # Use product name + policy_no suffix as unique name to handle same product different policyholders
        name = p["name"]

        meta = {
            "platform": "明亚保险",
            "start_date": p["start_date"],
            "cash_value_table": p["cash_value_table"],
            "policy_no": p["policy_no"],
        }

        if dry_run:
            print(f"  [INSERT] {name}")
            print(f"    保单号: {p['policy_no']}")
            print(f"    生效日期: {p['start_date']}")
            print(f"    现金价值表: {len(p['cash_value_table'])} 年")
            print(f"    第1年末: {p['cash_value_table'][0]}, 最后: {p['cash_value_table'][-1]}")
        else:
            max_order += 1
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(
                "INSERT INTO accounts (name, category, enabled, sort_order, meta, created_at, updated_at) VALUES (?, 'insurance', 1, ?, ?, ?, ?)",
                (name, max_order, json.dumps(meta, ensure_ascii=False), now, now),
            )
            print(f"  [INSERTED] {name} (保单号: {p['policy_no']})")

    if not dry_run:
        conn.commit()
        print(f"\nDone! {len(policies)} policies imported.")
    else:
        print(f"\n[DRY RUN] {len(policies)} policies would be inserted. Run with --apply to execute.")

    conn.close()


if __name__ == "__main__":
    policies = parse_policies()
    print(f"Found {len(policies)} policies in Excel:\n")

    dry_run = "--apply" not in sys.argv
    import_to_db(policies, dry_run=dry_run)
