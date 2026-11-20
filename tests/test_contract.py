"""Automated unit and Test Contract v1.0 tests for Đảo Đèn Lồng."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from src.core.contract import load_tuning
from src.core.sim import InputState, create_simulation, step_tick

REPO_ROOT = Path(__file__).resolve().parents[1]


def run_headless(
    seed: int,
    ticks: int,
    scenario: dict | None = None,
    inputs: dict | None = None,
    snapshot_every: int = 10,
) -> tuple[int, str, list[dict]]:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        out_path = tmp_dir / "out.jsonl"
        cmd = [
            "uv",
            "run",
            "python",
            "-m",
            "src.headless",
            "--seed",
            str(seed),
            "--night",
            "1",
            "--ticks",
            str(ticks),
            "--out",
            str(out_path),
            "--snapshot-every",
            str(snapshot_every),
        ]
        if scenario is not None:
            sc_path = tmp_dir / "scenario.json"
            sc_path.write_text(json.dumps(scenario), encoding="utf-8")
            cmd.extend(["--scenario", str(sc_path)])
        if inputs is not None:
            in_path = tmp_dir / "inputs.json"
            in_path.write_text(json.dumps(inputs), encoding="utf-8")
            cmd.extend(["--inputs", str(in_path)])

        proc = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        lines = []
        if out_path.exists():
            lines = [json.loads(line) for line in out_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        return proc.returncode, proc.stderr, lines


class TestContractV1(unittest.TestCase):
    def test_determinism_identical_output(self) -> None:
        inputs = {"frames": [{"tick": 0, "move": [0.5, 0.5]}, {"tick": 60, "pulse": True}]}
        rc1, _, lines1 = run_headless(seed=42, ticks=120, inputs=inputs)
        rc2, _, lines2 = run_headless(seed=42, ticks=120, inputs=inputs)
        self.assertEqual(rc1, 0)
        self.assertEqual(rc2, 0)
        self.assertEqual(lines1, lines2)
        self.assertEqual(lines1[0]["type"], "snapshot")
        self.assertEqual(lines1[0]["tick"], 0)
        self.assertEqual(lines1[-1]["type"], "end")
        self.assertEqual(lines1[-1]["ticks"], 120)

    def test_pickup_deposit_and_win(self) -> None:
        scenario = {
            "player": {"pos": [0, 0, 0], "carried": 0, "flames": 3},
            "random_motes": False,
            "random_shades": False,
            "motes": [[0, 0, 2.0], [0, 0, 4.0], [0, 0, 6.0]],
            "shades": [],
            "lanterns": [
                {"id": "L1", "pos": [0, 0, 7.0], "deposited": 0},
                {"id": "L2", "pos": [15, 0, 0], "lit": True, "deposited": 3},
                {"id": "L3", "pos": [0, 0, 15], "lit": True, "deposited": 3},
                {"id": "L4", "pos": [-15, 0, 0], "lit": True, "deposited": 3},
                {"id": "L5", "pos": [0, 0, -15], "lit": True, "deposited": 3},
            ],
            "time_left_s": 100.0,
        }
        inputs = {
            "frames": [
                {"tick": 0, "move": [0, 1], "cam_yaw_deg": 0},
                {"tick": 70, "move": [0, 0], "interact": True},
            ]
        }
        rc, err, lines = run_headless(seed=1, ticks=100, scenario=scenario, inputs=inputs)
        self.assertEqual(rc, 0, err)
        events = [x for x in lines if x["type"] == "event"]
        names = [e["name"] for e in events]
        self.assertEqual(names.count("mote_picked"), 3)
        self.assertIn("deposit", names)
        self.assertIn("lantern_lit", names)
        self.assertIn("game_over", names)
        end = lines[-1]
        self.assertEqual(end["state"], "won")
        self.assertGreater(end["score"], 0)

    def test_pulse_stuns_and_pushes_shade(self) -> None:
        scenario = {
            "player": {"pos": [0, 0, 0], "carried": 2, "flames": 3},
            "random_motes": False,
            "random_shades": False,
            "motes": [],
            "shades": [{"id": "S1", "pos": [3.0, 0, 0]}],
        }
        inputs = {"frames": [{"tick": 0, "pulse": True}]}
        rc, err, lines = run_headless(seed=1, ticks=10, scenario=scenario, inputs=inputs, snapshot_every=1)
        self.assertEqual(rc, 0, err)
        pulse_events = [x for x in lines if x["type"] == "event" and x["name"] == "pulse"]
        self.assertEqual(len(pulse_events), 1)
        self.assertEqual(pulse_events[0]["data"]["stunned_ids"], ["S1"])
        snap1 = [x for x in lines if x["type"] == "snapshot" and x["tick"] == 1][0]
        self.assertEqual(snap1["shades"][0]["state"], "stunned")
        self.assertGreater(snap1["shades"][0]["pos"][0], 6.0)
        self.assertEqual(snap1["player"]["carried"], 1)

    def test_shade_hit_and_no_flames_loss(self) -> None:
        scenario = {
            "player": {"pos": [0, 0, 0], "carried": 2, "flames": 1},
            "random_motes": False,
            "random_shades": False,
            "motes": [],
            "shades": [{"id": "S1", "pos": [0.5, 0, 0]}],
        }
        rc, err, lines = run_headless(seed=1, ticks=10, scenario=scenario)
        self.assertEqual(rc, 0, err)
        events = [x for x in lines if x["type"] == "event"]
        self.assertTrue(any(e["name"] == "player_hit" and e["data"]["dropped"] == 1 for e in events))
        self.assertEqual(lines[-1]["state"], "lost")

    def test_dawn_loss(self) -> None:
        scenario = {
            "random_motes": False,
            "random_shades": False,
            "motes": [],
            "shades": [],
            "time_left_s": 0.5,
        }
        rc, err, lines = run_headless(seed=1, ticks=60, scenario=scenario)
        self.assertEqual(rc, 0, err)
        self.assertEqual(lines[-1]["state"], "lost")
        self.assertEqual(lines[-1]["ticks"], 30)
        game_over = [x for x in lines if x["type"] == "event" and x["name"] == "game_over"][0]
        self.assertEqual(game_over["data"]["reason"], "dawn")

    def test_safe_radius_blocks_shade(self) -> None:
        tuning = load_tuning()
        sim = create_simulation(
            tuning=tuning,
            seed=1,
            scenario={
                "player": {"pos": [0, 0, 0], "carried": 0, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "motes": [],
                "shades": [{"id": "S1", "pos": [5.0, 0, 0]}],
                "lanterns": [{"id": "L1", "pos": [0, 0, 0], "lit": True, "deposited": 3}],
            },
        )
        for _ in range(30):
            step_tick(sim, InputState())
        dist = (sim.shades[0].pos[0] ** 2 + sim.shades[0].pos[2] ** 2) ** 0.5
        self.assertGreaterEqual(dist, tuning.safe_radius - 1e-6)
        self.assertEqual(sim.player.flames, 3)

    def test_malformed_inputs_exit_2(self) -> None:
        bad_inputs = {"frames": [{"tick": 5, "move": [0, 1]}, {"tick": 5, "move": [0, 0]}]}
        rc, err, _ = run_headless(seed=1, ticks=10, inputs=bad_inputs)
        self.assertEqual(rc, 2)
        self.assertIn("strictly greater", err)


if __name__ == "__main__":
    unittest.main()
