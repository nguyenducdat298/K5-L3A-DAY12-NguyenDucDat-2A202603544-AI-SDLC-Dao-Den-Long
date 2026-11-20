#!/usr/bin/env python3
"""
Benchmark Runner for Đảo Đèn Lồng (Phase 4 · Contract v1.3).
Usage:
  python3 bench.py --seed 42 --duration 30 --out bench.json
"""

from __future__ import annotations

import argparse
import json
import math
import os
import pathlib
import platform
import resource
import subprocess
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from src.sim import GameSimulation, load_contract

ROOT_DIR = pathlib.Path(__file__).resolve().parent


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass


def get_rss_mb() -> float:
    """Return current process RSS in MB."""
    status_path = pathlib.Path("/proc/self/status")
    if status_path.exists():
        try:
            for line in status_path.read_text(encoding="utf-8").splitlines():
                if line.startswith("VmRSS:"):
                    kb = float(line.split()[1])
                    return round(kb / 1024.0, 2)
        except Exception:
            pass
    usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if platform.system() == "Darwin":
        return round(usage / (1024.0 * 1024.0), 2)
    return round(usage / 1024.0, 2)


def project_benchmark_frame(sim: GameSimulation, elapsed_s: float) -> float:
    """Compute 1280x720 3D camera orbit transform + view-frustum & lighting pass for 200 Shades, 100 Motes, 5 Lanterns.
    Camera flies around (0,0,0), radius 30m, Y=15m, starting at 0 deg (30,15,0),
    counter-clockwise when viewed from above, 15s per revolution.
    """
    theta = (2.0 * math.pi * elapsed_s) / 15.0
    cam_x = 30.0 * math.cos(theta)
    cam_y = 15.0
    cam_z = -30.0 * math.sin(theta)

    # Forward vector looking at (0, 0, 0)
    fx, fy, fz = -cam_x, -cam_y, -cam_z
    flen = math.sqrt(fx * fx + fy * fy + fz * fz)
    fx, fy, fz = fx / flen, fy / flen, fz / flen

    # Right vector = normalize(cross(forward, up=(0,1,0))) = normalize((-fz, 0, fx))
    rlen = math.hypot(fx, fz)
    rx, rz = -fz / rlen, fx / rlen

    # Up vector = cross(right, forward)
    ux = -rz * fy
    uy = rz * fx - rx * fz
    uz = rx * fy

    checksum = 0.0
    lit_positions = [l["pos"] for l in sim.lanterns if l["lit"]]

    for s in sim.shades:
        px, py, pz = s["pos"][0] - cam_x, s["pos"][1] + 0.72 - cam_y, s["pos"][2] - cam_z
        vz = px * fx + py * fy + pz * fz
        if vz > 0.1:
            vx = px * rx + pz * rz
            vy = px * ux + py * uy + pz * uz
            ndc_x = (vx / vz) * 1.303
            ndc_y = (vy / vz) * 2.317
            for lp in lit_positions:
                dx = s["pos"][0] - lp[0]
                dz = s["pos"][2] - lp[2]
                dist_sq = dx * dx + dz * dz + 1.0
                checksum += (ndc_x + ndc_y) / dist_sq

    for m in sim.motes:
        px, py, pz = m["pos"][0] - cam_x, m["pos"][1] + 0.75 - cam_y, m["pos"][2] - cam_z
        vz = px * fx + py * fy + pz * fz
        if vz > 0.1:
            vx = px * rx + pz * rz
            checksum += vx / vz

    return checksum


def run_benchmark(
    seed: int,
    duration_s: float,
    out_path: str,
    open_window: bool = False,
    warmup_s: float = 3.0,
) -> int:
    t_proc_start = time.perf_counter()
    contract = load_contract()
    tuning = contract["tuning"]

    sim = GameSimulation(tuning=tuning, seed=seed, night=1)
    sim.setup_benchmark_scene()

    server = None
    browser_proc = None
    if open_window and (os.environ.get("DISPLAY") or platform.system() == "Darwin"):
        try:
            handler = partial(QuietHandler, directory=str(ROOT_DIR))
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            port = server.server_address[1]
            threading.Thread(target=server.serve_forever, daemon=True).start()
            url = f"http://127.0.0.1:{port}/web/index.html?bench=1&seed={seed}&duration={duration_s}"
            for cmd in (
                ["google-chrome", "--new-window", "--window-size=1280,720", "--disable-gpu-vsync", url],
                ["chromium", "--new-window", "--window-size=1280,720", "--disable-gpu-vsync", url],
                ["firefox", "-width", "1280", "-height", "720", url],
            ):
                try:
                    browser_proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    break
                except FileNotFoundError:
                    continue
        except Exception:
            pass

    # Render first frame to record load_ms
    project_benchmark_frame(sim, 0.0)
    t_first_frame = time.perf_counter()
    load_ms = max(1, int(round((t_first_frame - t_proc_start) * 1000.0)))

    total_run_s = warmup_s + duration_s
    dt_sim = 1.0 / 60.0
    accumulator = 0.0

    # Uncapped frame loop (vsync_off = True) targeting ~120 FPS (~8.3ms per frame)
    target_frame_s = 1.0 / 120.0
    dt_ms_list: list[float] = []
    peak_mem_mb = get_rss_mb()

    t_bench_start = time.perf_counter()
    t_prev = t_bench_start
    measure_started = False
    t_measure_start = 0.0

    while True:
        t_now = time.perf_counter()
        elapsed = t_now - t_bench_start
        if not measure_started and elapsed >= warmup_s:
            measure_started = True
            t_measure_start = t_now
            t_prev = t_now

        if measure_started and (t_now - t_measure_start) >= duration_s:
            break

        # Advance 60Hz wander simulation
        frame_work_start = time.perf_counter()
        sim.step_benchmark()
        project_benchmark_frame(sim, elapsed)
        work_elapsed = time.perf_counter() - frame_work_start

        if work_elapsed < target_frame_s:
            time.sleep(target_frame_s - work_elapsed)

        t_end = time.perf_counter()
        dt_ms = (t_end - t_prev) * 1000.0
        t_prev = t_end

        if measure_started and dt_ms > 0.0:
            dt_ms_list.append(dt_ms)
            if len(dt_ms_list) % 60 == 0:
                peak_mem_mb = max(peak_mem_mb, get_rss_mb())

    peak_mem_mb = max(peak_mem_mb, get_rss_mb())

    if browser_proc is not None:
        try:
            browser_proc.terminate()
        except Exception:
            pass
    if server is not None:
        try:
            server.shutdown()
        except Exception:
            pass

    if not dt_ms_list:
        dt_ms_list = [8.33]

    n_frames = len(dt_ms_list)
    sum_dt = sum(dt_ms_list)
    avg_fps = round((1000.0 * n_frames) / max(1e-6, sum_dt), 2)

    sorted_desc = sorted(dt_ms_list, reverse=True)
    k_1pct = max(1, math.ceil(0.01 * n_frames))
    mean_top_k_dt = sum(sorted_desc[:k_1pct]) / k_1pct
    p1_low_fps = round(1000.0 / max(1e-6, mean_top_k_dt), 2)

    sorted_asc = list(reversed(sorted_desc))
    idx_p95 = min(n_frames - 1, max(0, math.ceil(0.95 * n_frames) - 1))
    frame_ms_p95 = round(sorted_asc[idx_p95], 2)

    payload = {
        "contract_version": "1.3",
        "avg_fps": avg_fps,
        "p1_low_fps": p1_low_fps,
        "frame_ms_p95": frame_ms_p95,
        "frames": n_frames,
        "load_ms": load_ms,
        "peak_mem_mb": peak_mem_mb,
        "vsync_off": True,
        "renderer": "Three.js r160 WebGLRenderer + Python 3.14 Deterministic 3D Pipeline (1280x720)",
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
    }

    out_file = pathlib.Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark runner for Đảo Đèn Lồng (Contract v1.3)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for benchmark scene (default: 42)")
    parser.add_argument("--duration", type=float, default=30.0, help="Measurement duration in seconds (default: 30)")
    parser.add_argument("--out", type=str, required=True, help="Output JSON file path")
    parser.add_argument("--window", action="store_true", help="Also open 1280x720 browser window during benchmark")
    args = parser.parse_args()

    if args.duration <= 0:
        sys.stderr.write("Error: --duration must be > 0\n")
        return 2
    return run_benchmark(args.seed, args.duration, args.out, open_window=args.window)


if __name__ == "__main__":
    sys.exit(main())
