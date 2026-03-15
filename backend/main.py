"""
Family Assets Manager - Desktop App Entry Point
Launches Flask backend + pywebview native window
"""
import threading
import webview
from app import app, init_db


def start_server():
    app.run(host="127.0.0.1", port=5000, use_reloader=False)


if __name__ == "__main__":
    init_db()

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    webview.create_window(
        "家庭资产管理",
        "http://127.0.0.1:5000",
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    webview.start()
