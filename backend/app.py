import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from database import get_db, init_db, row_to_dict, rows_to_list, export_all_data, import_data
from quote import get_stock_quotes, get_fund_quotes

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")
CORS(app)


@app.route("/")
def index():
    return app.send_static_file("index.html")


# ─── Accounts ────────────────────────────────────────────────

@app.route("/api/accounts", methods=["GET"])
def list_accounts():
    conn = get_db()
    rows = conn.execute("SELECT * FROM accounts ORDER BY category, sort_order, id").fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/accounts", methods=["POST"])
def create_account():
    data = request.json
    now = datetime.now().isoformat()
    meta = json.dumps(data.get("meta", {}), ensure_ascii=False)
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO accounts (name, category, enabled, sort_order, meta, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (data["name"], data["category"], 1, data.get("sort_order", 0), meta, now, now),
    )
    conn.commit()
    account = row_to_dict(conn.execute("SELECT * FROM accounts WHERE id=?", (cursor.lastrowid,)).fetchone())
    conn.close()
    return jsonify(account), 201


@app.route("/api/accounts/<int:account_id>", methods=["PUT"])
def update_account(account_id):
    data = request.json
    now = datetime.now().isoformat()
    meta = json.dumps(data.get("meta", {}), ensure_ascii=False)
    conn = get_db()
    conn.execute(
        "UPDATE accounts SET name=?, category=?, sort_order=?, meta=?, updated_at=? WHERE id=?",
        (data["name"], data["category"], data.get("sort_order", 0), meta, now, account_id),
    )
    conn.commit()
    account = row_to_dict(conn.execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone())
    conn.close()
    return jsonify(account)


@app.route("/api/accounts/<int:account_id>/toggle", methods=["POST"])
def toggle_account(account_id):
    conn = get_db()
    conn.execute("UPDATE accounts SET enabled = 1 - enabled, updated_at = ? WHERE id=?", (datetime.now().isoformat(), account_id))
    conn.commit()
    account = row_to_dict(conn.execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone())
    conn.close()
    return jsonify(account)


@app.route("/api/accounts/<int:account_id>", methods=["DELETE"])
def delete_account(account_id):
    conn = get_db()
    conn.execute("DELETE FROM accounts WHERE id=?", (account_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/accounts/reorder", methods=["POST"])
def reorder_accounts():
    """Receive ordered list of {id, sort_order} and batch update."""
    items = request.json  # [{id: 1, sort_order: 0}, {id: 2, sort_order: 1}, ...]
    now = datetime.now().isoformat()
    conn = get_db()
    for item in items:
        conn.execute("UPDATE accounts SET sort_order=?, updated_at=? WHERE id=?", (item["sort_order"], now, item["id"]))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ─── Snapshots ───────────────────────────────────────────────

@app.route("/api/snapshots", methods=["GET"])
def list_snapshots():
    conn = get_db()
    rows = conn.execute("SELECT * FROM snapshots ORDER BY date DESC").fetchall()
    result = []
    for row in rows:
        s = dict(row)
        # Add category breakdown
        cats = conn.execute(
            "SELECT category, SUM(amount) as total, COUNT(*) as count FROM snapshot_items WHERE snapshot_id=? GROUP BY category",
            (s["id"],),
        ).fetchall()
        s["categories"] = {r["category"]: {"total": r["total"], "count": r["count"]} for r in cats}
        result.append(s)
    conn.close()
    return jsonify(result)


@app.route("/api/snapshots/<int:snapshot_id>", methods=["GET"])
def get_snapshot(snapshot_id):
    conn = get_db()
    snapshot = row_to_dict(conn.execute("SELECT * FROM snapshots WHERE id=?", (snapshot_id,)).fetchone())
    if not snapshot:
        conn.close()
        return jsonify({"error": "not found"}), 404
    items = rows_to_list(conn.execute("SELECT * FROM snapshot_items WHERE snapshot_id=? ORDER BY category, account_name", (snapshot_id,)).fetchall())
    conn.close()
    snapshot["items"] = items
    return jsonify(snapshot)


@app.route("/api/snapshots/latest", methods=["GET"])
def get_latest_snapshots():
    conn = get_db()
    rows = conn.execute("SELECT * FROM snapshots ORDER BY date DESC LIMIT 2").fetchall()
    result = []
    for row in rows:
        s = dict(row)
        items = rows_to_list(conn.execute("SELECT * FROM snapshot_items WHERE snapshot_id=? ORDER BY category, account_name", (s["id"],)).fetchall())
        s["items"] = items
        result.append(s)
    conn.close()
    return jsonify(result)


@app.route("/api/snapshots", methods=["POST"])
def create_snapshot():
    data = request.json
    now = datetime.now().isoformat()
    items = data.get("items", [])
    total = sum(item["amount"] for item in items)
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO snapshots (date, total_amount, notes, created_at) VALUES (?,?,?,?)",
            (data["date"], total, data.get("notes", ""), now),
        )
        snapshot_id = cursor.lastrowid
        for item in items:
            item_meta = json.dumps(item.get("meta", {}), ensure_ascii=False)
            conn.execute(
                "INSERT INTO snapshot_items (snapshot_id, account_id, account_name, category, amount, meta) VALUES (?,?,?,?,?,?)",
                (snapshot_id, item["account_id"], item["account_name"], item["category"], item["amount"], item_meta),
            )
        conn.commit()
        snapshot = row_to_dict(conn.execute("SELECT * FROM snapshots WHERE id=?", (snapshot_id,)).fetchone())
        snapshot["items"] = rows_to_list(conn.execute("SELECT * FROM snapshot_items WHERE snapshot_id=?", (snapshot_id,)).fetchall())
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500
    conn.close()
    return jsonify(snapshot), 201


@app.route("/api/snapshots/<int:snapshot_id>", methods=["DELETE"])
def delete_snapshot(snapshot_id):
    conn = get_db()
    conn.execute("DELETE FROM snapshots WHERE id=?", (snapshot_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ─── Dashboard ───────────────────────────────────────────────

@app.route("/api/dashboard/trend", methods=["GET"])
def dashboard_trend():
    conn = get_db()
    snapshots = rows_to_list(conn.execute("SELECT id, date, total_amount FROM snapshots ORDER BY date ASC").fetchall())
    result = []
    for s in snapshots:
        items = rows_to_list(conn.execute("SELECT category, SUM(amount) as total FROM snapshot_items WHERE snapshot_id=? GROUP BY category", (s["id"],)).fetchall())
        entry = {"date": s["date"], "total": s["total_amount"]}
        for item in items:
            entry[item["category"]] = item["total"]
        result.append(entry)
    conn.close()
    return jsonify(result)


# ─── Quotes (Price Fetch) ───────────────────────────────────

@app.route("/api/quote/batch", methods=["POST"])
def batch_quotes():
    data = request.json
    result = {}
    stock_codes = data.get("stocks", [])
    fund_codes = data.get("funds", [])
    if stock_codes:
        result["stocks"] = get_stock_quotes(stock_codes)
    if fund_codes:
        result["funds"] = get_fund_quotes(fund_codes)
    return jsonify(result)


# ─── Export / Import ─────────────────────────────────────────

@app.route("/api/export", methods=["GET"])
def export_data():
    return jsonify(export_all_data())


@app.route("/api/import", methods=["POST"])
def import_data_route():
    data = request.json
    try:
        import_data(data)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
