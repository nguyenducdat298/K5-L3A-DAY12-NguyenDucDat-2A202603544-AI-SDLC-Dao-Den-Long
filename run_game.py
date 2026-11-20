#!/usr/bin/env python3
"""Launch the 3D Anime Web Game server for Đảo Đèn Lồng (Phase 1)."""

from __future__ import annotations

import argparse
import functools
import http.server
import pathlib
import socket
import sys
import webbrowser

REPO_ROOT = pathlib.Path(__file__).resolve().parent


class GameHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path in ("/", "/index.html"):
            self.path = "/web/index.html"
        super().do_GET()

    def log_message(self, fmt: str, *args: object) -> None:
        # Keep terminal output clean
        pass


def find_free_port(preferred: int = 8765) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", preferred)) != 0:
            return preferred
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def main() -> int:
    parser = argparse.ArgumentParser(description="Chạy game 3D Đảo Đèn Lồng")
    parser.add_argument("--port", type=int, default=0, help="Cổng HTTP (mặc định: tự chọn 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Không tự mở trình duyệt")
    args = parser.parse_args()

    port = args.port if args.port > 0 else find_free_port(8765)
    handler = functools.partial(GameHTTPRequestHandler, directory=str(REPO_ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)

    url = f"http://127.0.0.1:{port}/web/index.html"
    print(f"============================================================")
    print(f"  ĐẢO ĐÈN LỒNG (3D Anime Edition) — Đêm 1: Đảo Bến")
    print(f"  Mở trình duyệt tại: {url}")
    print(f"  Nhấn Ctrl+C để dừng server.")
    print(f"============================================================", flush=True)

    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng server Đảo Đèn Lồng.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
