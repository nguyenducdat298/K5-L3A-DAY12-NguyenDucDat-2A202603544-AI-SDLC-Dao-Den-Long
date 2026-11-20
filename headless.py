#!/usr/bin/env python3
"""Headless CLI runner for Đảo Đèn Lồng (Phase 2 - Test Contract v1.1).

Usage:
  python3 headless.py --seed <int> --night <1|2|3> [--scenario <file.json>] [--inputs <file.json>] \
      --ticks <int> --out <file.jsonl> [--snapshot-every <int, default 10>]
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from typing import Any

from src.sim import (
    ContractFormatError,
    GameSimulation,
    load_contract,
    parse_inputs_data,
    validate_scenario_data,
)


def load_json_file(path_str: str, label: str) -> Any:
    path = pathlib.Path(path_str)
    if not path.is_file():
        raise ContractFormatError(f"{label} file not found: {path_str}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ContractFormatError(f"Invalid JSON in {label} file '{path_str}': {exc}") from exc
    except OSError as exc:
        raise ContractFormatError(f"Cannot read {label} file '{path_str}': {exc}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Đảo Đèn Lồng Headless Simulator (Test Contract v1.1)",
        allow_abbrev=False,
    )
    parser.add_argument("--seed", type=int, default=1, help="Random seed (integer)")
    parser.add_argument("--night", type=int, default=1, help="Night number (1, 2, or 3)")
    parser.add_argument("--scenario", type=str, default=None, help="Path to scenario JSON file")
    parser.add_argument("--inputs", type=str, default=None, help="Path to inputs JSON file")
    parser.add_argument("--ticks", type=int, required=True, help="Maximum ticks to simulate")
    parser.add_argument("--out", type=str, required=True, help="Output JSONL file path")
    parser.add_argument(
        "--snapshot-every",
        type=int,
        default=10,
        help="Emit snapshot every N ticks (default: 10)",
    )
    return parser


def run_headless(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        code = exc.code if isinstance(exc.code, int) else 1
        return code if code != 0 else 0

    if args.ticks < 0:
        print("Error: --ticks must be >= 0", file=sys.stderr)
        return 1
    if args.snapshot_every <= 0:
        print("Error: --snapshot-every must be >= 1", file=sys.stderr)
        return 1
    if args.night not in (1, 2, 3):
        print(f"Error: Unsupported --night {args.night} (must be 1, 2, or 3)", file=sys.stderr)
        return 1

    try:
        scenario_data: dict[str, Any] | None = None
        if args.scenario is not None:
            raw_scenario = load_json_file(args.scenario, "scenario")
            scenario_data = validate_scenario_data(raw_scenario)

        frames_by_tick: dict[int, dict[str, Any]] = {}
        if args.inputs is not None:
            raw_inputs = load_json_file(args.inputs, "inputs")
            frames_by_tick = parse_inputs_data(raw_inputs)

        contract = load_contract()
        tuning = contract["tuning"]
        sim = GameSimulation(
            tuning=tuning,
            seed=args.seed,
            night=args.night,
            scenario=scenario_data,
        )
    except ContractFormatError as exc:
        print(f"Contract format error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"Initialization error: {exc}", file=sys.stderr)
        return 1

    out_path = pathlib.Path(args.out)
    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as f:
            # Snapshot tick 0: after building scenario, before applying input
            f.write(json.dumps(sim.get_snapshot(), separators=(",", ":")) + "\n")

            for k in range(args.ticks):
                if sim.state in ("won", "lost"):
                    break
                frame_delta = frames_by_tick.get(k)
                events = sim.step(frame_delta)
                for ev in events:
                    f.write(json.dumps(ev, separators=(",", ":")) + "\n")
                # Step 12: Emit snapshot if on schedule
                if sim.tick % args.snapshot_every == 0:
                    f.write(json.dumps(sim.get_snapshot(), separators=(",", ":")) + "\n")
                if sim.state in ("won", "lost"):
                    break

            end_record = {
                "type": "end",
                "ticks": sim.tick,
                "state": sim.state,
                "score": int(sim.score),
            }
            f.write(json.dumps(end_record, separators=(",", ":")) + "\n")
    except Exception as exc:
        print(f"Runtime/IO error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(run_headless())
