#!/usr/bin/env python3
"""
Soak Test Runner for Đảo Đèn Lồng (Phase 4 · Contract v1.3).
Usage:
  python3 soak.py --seed 7 --nights 10 --out soak.json
"""

import argparse
import gc
import json
import math
import os
import platform
import random
import resource
import sys
import time
from pathlib import Path

from src.sim import GameSimulation, load_contract


def get_rss_mb() -> float:
    """Return current process RSS in MB."""
    status_path = Path("/proc/self/status")
    if status_path.exists():
        try:
            for line in status_path.read_text(encoding="utf-8").splitlines():
                if line.startswith("VmRSS:"):
                    parts = line.split()
                    kb = float(parts[1])
                    return round(kb / 1024.0, 2)
        except Exception:
            pass
    usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if platform.system() == "Darwin":
        return round(usage / (1024.0 * 1024.0), 2)
    return round(usage / 1024.0, 2)


def run_soak(seed: int, nights: int, out_path: str) -> int:
    t0 = time.perf_counter()
    contract = load_contract()
    tuning = contract["tuning"]

    crashes = 0
    results = []
    mem_start_mb = None

    sim = None
    for i in range(nights):
        night_num = (i % 3) + 1
        night_seed = seed + i
        rng = random.Random(night_seed)

        try:
            sim = GameSimulation(tuning=tuning, seed=night_seed, night=night_num)
            if i == 0:
                gc.collect()
                mem_start_mb = get_rss_mb()

            max_ticks = int(sim.initial_duration_s * 60)
            move_x = 0.0
            move_z = 0.0

            for tick in range(max_ticks):
                if tick % 30 == 0:
                    angle = rng.uniform(0.0, 2.0 * math.pi)
                    move_x = round(math.cos(angle), 4)
                    move_z = round(math.sin(angle), 4)

                frame_input = {
                    "move": [move_x, move_z],
                    "jump": rng.random() < 0.05,
                    "dash": rng.random() < 0.03,
                    "pulse": rng.random() < 0.02,
                    "interact": rng.random() < 0.10,
                }
                sim.step(frame_input)
                if sim.state in ("won", "lost"):
                    break

            results.append(sim.state if sim.state in ("won", "lost") else "lost")
        except Exception as exc:
            sys.stderr.write(f"[soak] Crash on night index {i} (night={night_num}, seed={night_seed}): {exc}\n")
            crashes += 1
            results.append("crashed")

    # Reset after the final night before measuring mem_end_mb
    if sim is not None:
        sim = GameSimulation(tuning=tuning, seed=seed, night=1)
    gc.collect()
    mem_end_mb = get_rss_mb()
    if mem_start_mb is None:
        mem_start_mb = mem_end_mb

    duration_s = round(time.perf_counter() - t0, 2)
    payload = {
        "nights": nights,
        "crashes": crashes,
        "results": results,
        "mem_start_mb": mem_start_mb,
        "mem_end_mb": mem_end_mb,
        "duration_s": duration_s,
    }

    out_file = Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return 0 if crashes == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Soak test runner for Đảo Đèn Lồng (Contract v1.3)")
    parser.add_argument("--seed", type=int, default=7, help="Base seed (night i uses seed + i)")
    parser.add_argument("--nights", type=int, default=10, help="Number of consecutive nights to run")
    parser.add_argument("--out", type=str, required=True, help="Output JSON file path")
    args = parser.parse_args()

    if args.nights <= 0:
        sys.stderr.write("Error: --nights must be > 0\n")
        return 2
    return run_soak(args.seed, args.nights, args.out)


if __name__ == "__main__":
    sys.exit(main())
