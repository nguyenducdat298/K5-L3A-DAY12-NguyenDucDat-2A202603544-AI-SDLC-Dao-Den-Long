"""Headless CLI runner for Test Contract v1.0."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from src.core.contract import load_tuning
from src.core.sim import InputState, apply_frame, create_simulation, step_tick


class ContractInputError(Exception):
    """Raised when --scenario or --inputs has invalid JSON or schema."""


def _load_json(path_str: str, label: str) -> dict[str, Any]:
    path = Path(path_str)
    if not path.is_file():
        raise FileNotFoundError(f"{label} file not found: {path_str}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ContractInputError(f"Malformed JSON in {label}: {exc}") from exc
    if not isinstance(data, dict):
        raise ContractInputError(f"{label} root must be a JSON object")
    return data


def _validate_inputs(data: dict[str, Any]) -> dict[int, dict[str, Any]]:
    frames = data.get("frames")
    if frames is None:
        return {}
    if not isinstance(frames, list):
        raise ContractInputError("inputs.frames must be an array")
    by_tick: dict[int, dict[str, Any]] = {}
    prev_tick = -1
    for idx, frame in enumerate(frames):
        if not isinstance(frame, dict) or "tick" not in frame:
            raise ContractInputError(f"inputs.frames[{idx}] must be an object with 'tick'")
        tick = frame["tick"]
        if not isinstance(tick, int) or isinstance(tick, bool) or tick < 0:
            raise ContractInputError(f"inputs.frames[{idx}].tick must be a non-negative integer")
        if tick <= prev_tick:
            raise ContractInputError(
                f"inputs.frames[{idx}].tick ({tick}) must be strictly greater than previous ({prev_tick})"
            )
        if "move" in frame:
            mv = frame["move"]
            if (
                not isinstance(mv, list)
                or len(mv) != 2
                or not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in mv)
            ):
                raise ContractInputError(f"inputs.frames[{idx}].move must be [x, z]")
        prev_tick = tick
        by_tick[tick] = frame
    return by_tick


def _validate_scenario(data: dict[str, Any]) -> None:
    if "motes" in data and not isinstance(data["motes"], list):
        raise ContractInputError("scenario.motes must be an array")
    if "shades" in data and not isinstance(data["shades"], list):
        raise ContractInputError("scenario.shades must be an array")
    if "lanterns" in data and not isinstance(data["lanterns"], list):
        raise ContractInputError("scenario.lanterns must be an array")
    if "player" in data and not isinstance(data["player"], dict):
        raise ContractInputError("scenario.player must be an object")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Đảo Đèn Lồng Headless Runner")
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--night", type=int, required=True)
    parser.add_argument("--scenario", type=str, default=None)
    parser.add_argument("--inputs", type=str, default=None)
    parser.add_argument("--ticks", type=int, required=True)
    parser.add_argument("--out", type=str, required=True)
    parser.add_argument("--snapshot-every", type=int, default=10)

    try:
        args = parser.parse_args(argv)
        if args.night != 1:
            print(f"Unsupported night: {args.night} (Phase 1 supports --night 1)", file=sys.stderr)
            return 1
        if args.ticks < 0:
            print("--ticks must be >= 0", file=sys.stderr)
            return 1
        if args.snapshot_every <= 0:
            print("--snapshot-every must be > 0", file=sys.stderr)
            return 1

        scenario_data: dict[str, Any] | None = None
        if args.scenario is not None:
            scenario_data = _load_json(args.scenario, "scenario")
            _validate_scenario(scenario_data)

        frames_by_tick: dict[int, dict[str, Any]] = {}
        if args.inputs is not None:
            inputs_data = _load_json(args.inputs, "inputs")
            frames_by_tick = _validate_inputs(inputs_data)

        tuning = load_tuning()
        sim = create_simulation(tuning=tuning, seed=args.seed, scenario=scenario_data)
    except ContractInputError as exc:
        print(f"Contract input error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    curr_input = InputState()
    lines: list[str] = []
    lines.append(json.dumps(sim.to_snapshot(), separators=(",", ":")))

    for k in range(args.ticks):
        if sim.state != "playing":
            break
        if k in frames_by_tick:
            curr_input = apply_frame(curr_input, frames_by_tick[k])
        events = step_tick(sim, curr_input)
        for ev in events:
            lines.append(json.dumps(ev, separators=(",", ":")))
        if sim.tick % args.snapshot_every == 0:
            lines.append(json.dumps(sim.to_snapshot(), separators=(",", ":")))

    end_obj = {
        "type": "end",
        "ticks": sim.tick,
        "state": sim.state,
        "score": sim.score,
    }
    lines.append(json.dumps(end_obj, separators=(",", ":")))

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
