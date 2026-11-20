"""Automated Regression Test Suite for Phase 1 Core Behaviors under Contract v1.2.

Note on Phase 3 (TICKET-03) breaking changes (see CHANGELOG.md & docs/notes/phase3-adr-and-spec.md):
- contract_version updated to "1.2"; night1_duration_s updated from 300s to 240s.
- [REPLACED] "all_lit" early win replaced by "dawn_survived" at time_left_s == 0 with >= ceil(0.6 * N) lit lanterns.
  In win_all_lit_scenario.json, we set time_left_s to 2.05s (123 ticks) so lighting L1 at tick 121 is followed by dawn_survived win at tick 123.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

from headless import run_headless
from src.sim import GameSimulation, load_contract

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
SCENARIOS_DIR = REPO_ROOT / "tests" / "scenarios"


class TestContractPhase1(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = load_contract()
        self.tuning = self.contract["tuning"]

    def test_contract_json_structure(self) -> None:
        self.assertEqual(self.contract["contract_version"], "1.3")
        self.assertEqual(self.contract["team"], "2A202603544-NguyenDucDat")
        self.assertIn("build_cmd", self.contract)
        self.assertIn("run_cmd", self.contract)
        self.assertIn("headless_cmd", self.contract)
        self.assertIn("bench_cmd", self.contract)
        self.assertIn("soak_cmd", self.contract)
        self.assertEqual(self.tuning["lantern_count_night1"], 5)
        for key in (
            "player_speed",
            "dash_speed",
            "dash_duration_s",
            "dash_cooldown_s",
            "carry_capacity",
            "capacity_max",
            "lantern_cost",
            "relight_cost",
            "fuel_max",
            "fuel_decay_per_s",
            "fuel_per_mote",
            "low_fuel_threshold",
            "drain_per_s",
            "win_ratio",
            "pickup_radius",
            "interact_radius",
            "pulse_cost",
            "pulse_radius",
            "night1_duration_s",
            "night2_duration_s",
            "night3_duration_s",
            "flames",
            "invuln_s",
            "hit_drop_ratio",
            "pulse_stun_s",
            "pulse_push_m",
            "pulse_cooldown_s",
            "safe_radius",
            "shade_speed",
            "shade_hit_radius",
            "fall_enabled",
            "score",
        ):
            self.assertIn(key, self.tuning)

    def test_movement_and_cam_yaw_rotation(self) -> None:
        sim = GameSimulation(
            self.tuning,
            seed=1,
            scenario={"random_motes": False, "random_shades": False, "motes": [], "shades": []},
        )
        # Move along +Z for 120 ticks at 6.0 m/s -> z = 12.0; night1_duration_s=240 -> time_left_s=238.0
        sim.step({"move": [0, 1], "cam_yaw_deg": 0})
        for _ in range(119):
            sim.step()
        snap = sim.get_snapshot()
        self.assertEqual(snap["tick"], 120)
        self.assertEqual(snap["time_left_s"], 238.0)
        self.assertEqual(snap["player"]["pos"], [0.0, 0.0, 12.0])

        sim2 = GameSimulation(
            self.tuning,
            seed=1,
            scenario={"random_motes": False, "random_shades": False, "motes": [], "shades": []},
        )
        sim2.step({"move": [0, 1], "cam_yaw_deg": 90})
        for _ in range(59):
            sim2.step()
        snap2 = sim2.get_snapshot()
        self.assertEqual(snap2["player"]["pos"], [6.0, 0.0, 0.0])

    def test_win_dawn_survived_scenario_cli(self) -> None:
        """Updated from Phase 1 test_win_all_lit_scenario_cli due to Ticket-03 replacing all_lit with dawn_survived."""
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "win.jsonl"
            rc = run_headless(
                [
                    "--seed",
                    "7",
                    "--night",
                    "1",
                    "--scenario",
                    str(SCENARIOS_DIR / "win_all_lit_scenario.json"),
                    "--inputs",
                    str(SCENARIOS_DIR / "win_all_lit_inputs.json"),
                    "--ticks",
                    "300",
                    "--out",
                    str(out_file),
                    "--snapshot-every",
                    "60",
                ]
            )
            self.assertEqual(rc, 0)
            lines = [json.loads(line) for line in out_file.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(lines[0]["type"], "snapshot")
            self.assertEqual(lines[0]["tick"], 0)
            self.assertEqual(lines[-1]["type"], "end")
            self.assertEqual(lines[-1]["state"], "won")

            events = [r for r in lines if r["type"] == "event"]
            event_names = [e["name"] for e in events]
            self.assertEqual(
                event_names,
                ["mote_picked", "mote_picked", "mote_picked", "deposit", "lantern_lit", "game_over"],
            )
            lit_ev = next(e for e in events if e["name"] == "lantern_lit")
            self.assertEqual(lit_ev["data"], {"lantern_id": "L1", "relight": False})
            go_ev = events[-1]
            self.assertEqual(go_ev["data"], {"result": "won", "reason": "dawn_survived"})

    def test_pulse_stun_push_and_safe_radius(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "pulse.jsonl"
            rc = run_headless(
                [
                    "--seed",
                    "10",
                    "--night",
                    "1",
                    "--scenario",
                    str(SCENARIOS_DIR / "pulse_and_safe_zone_scenario.json"),
                    "--inputs",
                    str(SCENARIOS_DIR / "pulse_and_safe_zone_inputs.json"),
                    "--ticks",
                    "250",
                    "--out",
                    str(out_file),
                    "--snapshot-every",
                    "10",
                ]
            )
            self.assertEqual(rc, 0)
            lines = [json.loads(line) for line in out_file.read_text(encoding="utf-8").splitlines()]
            pulse_events = [r for r in lines if r["type"] == "event" and r["name"] == "pulse"]
            self.assertEqual(len(pulse_events), 1)
            self.assertEqual(pulse_events[0]["tick"], 1)
            self.assertEqual(pulse_events[0]["data"], {"stunned_ids": ["S1"]})

            snap20 = next(r for r in lines if r["type"] == "snapshot" and r["tick"] == 20)
            self.assertEqual(snap20["shades"][0]["state"], "stunned")
            self.assertAlmostEqual(snap20["shades"][0]["pos"][2], 5.0, places=3)

    def test_lose_no_flames_and_hit_drop(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "lose_flames.jsonl"
            rc = run_headless(
                [
                    "--seed",
                    "3",
                    "--night",
                    "1",
                    "--scenario",
                    str(SCENARIOS_DIR / "lose_no_flames_scenario.json"),
                    "--ticks",
                    "100",
                    "--out",
                    str(out_file),
                ]
            )
            self.assertEqual(rc, 0)
            lines = [json.loads(line) for line in out_file.read_text(encoding="utf-8").splitlines()]
            events = [r for r in lines if r["type"] == "event"]
            self.assertEqual([e["name"] for e in events], ["player_hit", "game_over"])
            self.assertEqual(events[0]["data"], {"by": "shade", "flames": 0, "dropped": 1})
            self.assertEqual(events[1]["data"], {"result": "lost", "reason": "no_flames"})
            self.assertEqual(lines[-1]["state"], "lost")

    def test_lose_dawn(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "lose_dawn.jsonl"
            rc = run_headless(
                [
                    "--seed",
                    "3",
                    "--night",
                    "1",
                    "--scenario",
                    str(SCENARIOS_DIR / "lose_dawn_scenario.json"),
                    "--ticks",
                    "100",
                    "--out",
                    str(out_file),
                ]
            )
            self.assertEqual(rc, 0)
            lines = [json.loads(line) for line in out_file.read_text(encoding="utf-8").splitlines()]
            events = [r for r in lines if r["type"] == "event"]
            self.assertEqual(len(events), 1)
            self.assertEqual(events[0]["name"], "game_over")
            self.assertEqual(events[0]["tick"], 60)
            self.assertEqual(events[0]["data"], {"result": "lost", "reason": "dawn"})
            self.assertEqual(lines[-1]["ticks"], 60)
            self.assertEqual(lines[-1]["state"], "lost")

    def test_determinism_identical_sha256(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out1 = pathlib.Path(tmp) / "run1.jsonl"
            out2 = pathlib.Path(tmp) / "run2.jsonl"
            args = ["--seed", "2026", "--night", "1", "--ticks", "600", "--snapshot-every", "15"]
            self.assertEqual(run_headless(args + ["--out", str(out1)]), 0)
            self.assertEqual(run_headless(args + ["--out", str(out2)]), 0)
            h1 = hashlib.sha256(out1.read_bytes()).hexdigest()
            h2 = hashlib.sha256(out2.read_bytes()).hexdigest()
            self.assertEqual(h1, h2)

    def test_invalid_inputs_or_scenario_returns_exit_code_2(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bad_inputs = pathlib.Path(tmp) / "bad_inputs.json"
            bad_inputs.write_text(
                json.dumps({"frames": [{"tick": 10, "move": [0, 1]}, {"tick": 10, "move": [0, 0]}]}),
                encoding="utf-8",
            )
            out_file = pathlib.Path(tmp) / "out.jsonl"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(REPO_ROOT / "headless.py"),
                    "--seed",
                    "1",
                    "--night",
                    "1",
                    "--inputs",
                    str(bad_inputs),
                    "--ticks",
                    "50",
                    "--out",
                    str(out_file),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 2)
            self.assertTrue(len(proc.stderr.strip()) > 0)


if __name__ == "__main__":
    unittest.main()
