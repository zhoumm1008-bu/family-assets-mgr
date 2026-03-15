import sqlite3
import os
import json
from datetime import datetime

DB_DIR = os.path.join(os.path.expanduser("~"), ".family-assets-mgr")
DB_PATH = os.path.join(DB_DIR, "data.db")


def get_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('cash','deposit','wealth','stocks','funds','options','insurance','other')),
            enabled INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            meta TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            total_amount REAL NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS snapshot_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            account_name TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            meta TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_snapshot_items_snapshot_id ON snapshot_items(snapshot_id);
        CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);
    """)
    # Migration: add meta columns if missing (for existing databases)
    for table, col in [("accounts", "meta"), ("snapshot_items", "meta")]:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT NOT NULL DEFAULT '{{}}'")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # column already exists

    # Migration: update CHECK constraint to include new categories (deposit, wealth)
    # SQLite doesn't support ALTER CHECK, so recreate the table if needed
    try:
        conn.execute("INSERT INTO accounts (name, category, enabled, sort_order, meta, created_at, updated_at) VALUES ('__test__', 'deposit', 1, -1, '{}', '', '')")
        conn.execute("DELETE FROM accounts WHERE name = '__test__'")
        conn.commit()
    except sqlite3.IntegrityError:
        # Old CHECK constraint, need to migrate - use explicit column names to avoid order issues
        conn.executescript("""
            ALTER TABLE accounts RENAME TO accounts_old;
            CREATE TABLE accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL CHECK(category IN ('cash','deposit','wealth','stocks','funds','options','insurance','other')),
                enabled INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0,
                meta TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO accounts (id, name, category, enabled, sort_order, meta, created_at, updated_at)
                SELECT id, name, category, enabled, sort_order, meta, created_at, updated_at FROM accounts_old;
            DROP TABLE accounts_old;
        """)

    conn.commit()
    conn.close()


def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    # Auto-parse meta JSON
    if "meta" in d and isinstance(d["meta"], str):
        try:
            d["meta"] = json.loads(d["meta"])
        except (json.JSONDecodeError, TypeError):
            d["meta"] = {}
    return d


def rows_to_list(rows):
    return [row_to_dict(r) for r in rows]


def export_all_data():
    conn = get_db()
    data = {
        "accounts": rows_to_list(conn.execute("SELECT * FROM accounts").fetchall()),
        "snapshots": rows_to_list(conn.execute("SELECT * FROM snapshots").fetchall()),
        "snapshot_items": rows_to_list(conn.execute("SELECT * FROM snapshot_items").fetchall()),
        "exported_at": datetime.now().isoformat(),
    }
    conn.close()
    return data


def import_data(data):
    conn = get_db()
    try:
        conn.execute("DELETE FROM snapshot_items")
        conn.execute("DELETE FROM snapshots")
        conn.execute("DELETE FROM accounts")
        for a in data.get("accounts", []):
            meta = a.get("meta", {})
            if isinstance(meta, dict):
                meta = json.dumps(meta, ensure_ascii=False)
            conn.execute(
                "INSERT INTO accounts (id, name, category, enabled, sort_order, meta, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
                (a["id"], a["name"], a["category"], a["enabled"], a["sort_order"], meta, a["created_at"], a["updated_at"]),
            )
        for s in data.get("snapshots", []):
            conn.execute(
                "INSERT INTO snapshots (id, date, total_amount, notes, created_at) VALUES (?,?,?,?,?)",
                (s["id"], s["date"], s["total_amount"], s["notes"], s["created_at"]),
            )
        for si in data.get("snapshot_items", []):
            meta = si.get("meta", {})
            if isinstance(meta, dict):
                meta = json.dumps(meta, ensure_ascii=False)
            conn.execute(
                "INSERT INTO snapshot_items (id, snapshot_id, account_id, account_name, category, amount, meta) VALUES (?,?,?,?,?,?,?)",
                (si["id"], si["snapshot_id"], si["account_id"], si["account_name"], si["category"], si["amount"], meta),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
