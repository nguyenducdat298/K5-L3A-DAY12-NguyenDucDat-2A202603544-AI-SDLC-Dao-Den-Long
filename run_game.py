#!/usr/bin/env python3
"""Launch the 3D Anime Web Game server & Leaderboard Manager for Đảo Đèn Lồng (Contract v1.3)."""

from __future__ import annotations

import argparse
import datetime
import functools
import http.server
import json
import pathlib
import re
import socket
import ssl
import sys
import webbrowser
from typing import Any

REPO_ROOT = pathlib.Path(__file__).resolve().parent
LEADERBOARD_PATH = REPO_ROOT / "data" / "leaderboard.json"
NAME_REGEX = re.compile(r"^[A-Za-z0-9_\u00C0-\u1EF9]{3,12}$")


def sort_and_trim_leaderboard(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort by score descending; ties broken by who achieved it first (achieved_at ascending). Keep top 10."""
    def sort_key(item: dict[str, Any]) -> tuple[int, str]:
        score = int(item.get("score", 0))
        achieved = str(item.get("achieved_at", ""))
        return (-score, achieved)

    valid: list[dict[str, Any]] = []
    for e in entries:
        if not isinstance(e, dict):
            continue
        name = str(e.get("name", "")).strip()
        if not NAME_REGEX.match(name):
            continue
        valid.append(
            {
                "name": name,
                "score": int(e.get("score", 0)),
                "nights_won": max(0, min(3, int(e.get("nights_won", 0)))),
                "achieved_at": str(
                    e.get("achieved_at")
                    or datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds")
                ),
                "seed": int(e.get("seed", 42)),
            }
        )
    valid.sort(key=sort_key)
    return valid[:10]


def load_leaderboard(path: pathlib.Path = LEADERBOARD_PATH) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        entries = raw.get("entries", []) if isinstance(raw, dict) else raw
        if not isinstance(entries, list):
            return []
        return sort_and_trim_leaderboard(entries)
    except Exception:
        return []


def save_leaderboard(entries: list[dict[str, Any]], path: pathlib.Path = LEADERBOARD_PATH) -> list[dict[str, Any]]:
    trimmed = sort_and_trim_leaderboard(entries)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"entries": trimmed}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return trimmed


def add_leaderboard_entry(entry: dict[str, Any], path: pathlib.Path = LEADERBOARD_PATH) -> list[dict[str, Any]]:
    name = str(entry.get("name", "")).strip()
    if not NAME_REGEX.match(name):
        raise ValueError("Tên người chơi phải từ 3–12 ký tự (chữ cái, chữ số hoặc dấu gạch dưới '_').")
    now_iso = datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds")
    new_item = {
        "name": name,
        "score": int(entry.get("score", 0)),
        "nights_won": max(0, min(3, int(entry.get("nights_won", 0)))),
        "achieved_at": str(entry.get("achieved_at") or now_iso),
        "seed": int(entry.get("seed", 42)),
    }
    current = load_leaderboard(path)
    current.append(new_item)
    return save_leaderboard(current, path)


def export_leaderboard(out_file: str, path: pathlib.Path = LEADERBOARD_PATH) -> int:
    entries = load_leaderboard(path)
    out_path = pathlib.Path(out_file)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"entries": entries}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


class GameHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed_path = self.path.split("?", 1)[0]
        if parsed_path == "/api/leaderboard":
            self._send_json(200, {"entries": load_leaderboard()})
            return
        if parsed_path in ("/", "/index.html"):
            query = ("?" + self.path.split("?", 1)[1]) if "?" in self.path else ""
            self.path = "/web/index.html" + query
        super().do_GET()

    def do_POST(self) -> None:
        parsed_path = self.path.split("?", 1)[0]
        if parsed_path == "/api/leaderboard":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                raw_body = self.rfile.read(length).decode("utf-8")
                data = json.loads(raw_body) if raw_body else {}
                updated = add_leaderboard_entry(data)
                self._send_json(200, {"ok": True, "entries": updated})
            except ValueError as exc:
                self._send_json(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                self._send_json(500, {"ok": False, "error": str(exc)})
            return
        self._send_json(404, {"ok": False, "error": "Not found"})

    def log_message(self, fmt: str, *args: object) -> None:
        pass


def find_free_port(preferred: int = 8765) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", preferred)) != 0:
            return preferred
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def main() -> int:
    parser = argparse.ArgumentParser(description="Chạy game 3D Đảo Đèn Lồng (Contract v1.3)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Địa chỉ bind (mặc định: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=0, help="Cổng HTTP/HTTPS (mặc định: tự chọn 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Không tự mở trình duyệt")
    parser.add_argument("--export-leaderboard", type=str, default="", help="Xuất bảng xếp hạng ra file JSON rồi thoát")
    parser.add_argument("--ssl-cert", type=str, default="", help="Đường dẫn chứng chỉ SSL (PEM) cho HTTPS")
    parser.add_argument("--ssl-key", type=str, default="", help="Đường dẫn khóa riêng SSL (PEM) cho HTTPS")
    args = parser.parse_args()

    if args.export_leaderboard:
        return export_leaderboard(args.export_leaderboard)

    port = args.port if args.port > 0 else find_free_port(8765)
    handler = functools.partial(GameHTTPRequestHandler, directory=str(REPO_ROOT))
    server = http.server.ThreadingHTTPServer((args.host, port), handler)

    scheme = "http"
    if args.ssl_cert and args.ssl_key:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile=args.ssl_cert, keyfile=args.ssl_key)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        scheme = "https"

    display_host = "127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host
    url = f"{scheme}://{display_host}:{port}/web/index.html"
    print("============================================================")
    print("  ĐẢO ĐÈN LỒNG (3D Anime Edition · Release v1.0.0)")
    print(f"  Mở trình duyệt tại: {url}")
    print("  Nhấn Ctrl+C để dừng server.")
    print("============================================================", flush=True)

    if not args.no_browser and args.host == "127.0.0.1":
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
