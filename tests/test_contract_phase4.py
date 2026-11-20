"""Automated Test Suite for Phase 4 (TICKET-04 — Release v1.0.0 · Test Contract v1.3).

Verifies:
1. Benchmark Scene & CLI (bench.py --seed 42 --duration <d> --out bench.json):
   - 200 Shades in wander state, 100 Motes, 3 lit lanterns L1..L3 with fuel = 100.
   - avg_fps >= 60, p1_low_fps >= 30, load_ms <= 10000, contract_version == "1.3".
2. Soak Test CLI (soak.py --seed 7 --nights <n> --out soak.json):
   - crashes == 0, mem_end_mb <= 1.2 * mem_start_mb, results array matches nights count.
3. Local Leaderboard & CLI Export (run_game.py --export-leaderboard out.json):
   - Name validation 3..12 chars [A-Za-z0-9_], top 10 cap, descending score sorting with earlier achieved_at tie-break.
"""

from __future__ import annotations

import json
import pathlib
import tempfile
import unittest

from bench import run_benchmark
from run_game import add_leaderboard_entry, export_leaderboard, load_leaderboard, save_leaderboard
from soak import run_soak
from src.sim import GameSimulation, load_contract


class TestContractPhase4(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = load_contract()
        self.tuning = self.contract["tuning"]

    def test_contract_v13_bench_and_soak_cmds(self) -> None:
        self.assertEqual(self.contract["contract_version"], "1.3")
        self.assertEqual(self.contract["bench_cmd"], "python3 bench.py")
        self.assertEqual(self.contract["soak_cmd"], "python3 soak.py")

    def test_benchmark_scene_and_runner(self) -> None:
        sim = GameSimulation(tuning=self.tuning, seed=42, night=1)
        sim.setup_benchmark_scene()
        self.assertEqual(len(sim.shades), 200)
        self.assertEqual(len(sim.motes), 100)
        self.assertEqual(sim.player["pos"], [0.0, 0.0, 0.0])

        lit_lanterns = [l for l in sim.lanterns if l["lit"]]
        self.assertEqual([l["id"] for l in lit_lanterns], ["L1", "L2", "L3"])
        for l in lit_lanterns:
            self.assertEqual(l["fuel_ticks"], 6000)

        # Advance 10 benchmark ticks: fuel must NOT decay, motes must NOT be picked up, shades wander
        for _ in range(10):
            sim.step_benchmark()
        self.assertEqual(len(sim.shades), 200)
        self.assertEqual(len(sim.motes), 100)
        for l in lit_lanterns:
            self.assertEqual(l["fuel_ticks"], 6000)

        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = str(pathlib.Path(tmpdir) / "bench_test.json")
            rc = run_benchmark(seed=42, duration_s=0.3, out_path=out_path, open_window=False, warmup_s=0.1)
            self.assertEqual(rc, 0)
            data = json.loads(pathlib.Path(out_path).read_text(encoding="utf-8"))
            self.assertEqual(data["contract_version"], "1.3")
            self.assertGreaterEqual(data["avg_fps"], 60.0)
            self.assertGreaterEqual(data["p1_low_fps"], 30.0)
            self.assertLessEqual(data["load_ms"], 10000)
            self.assertGreater(data["frames"], 0)
            self.assertIn("frame_ms_p95", data)
            self.assertIn("peak_mem_mb", data)
            self.assertTrue(data["vsync_off"])

    def test_soak_runner_stability_and_memory_bound(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = str(pathlib.Path(tmpdir) / "soak_test.json")
            rc = run_soak(seed=7, nights=3, out_path=out_path)
            self.assertEqual(rc, 0)
            data = json.loads(pathlib.Path(out_path).read_text(encoding="utf-8"))
            self.assertEqual(data["nights"], 3)
            self.assertEqual(data["crashes"], 0)
            self.assertEqual(len(data["results"]), 3)
            self.assertLessEqual(data["mem_end_mb"], 1.2 * data["mem_start_mb"] + 1.0)

    def test_local_leaderboard_validation_sorting_top10_and_export(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            lb_path = pathlib.Path(tmpdir) / "leaderboard.json"
            out_path = pathlib.Path(tmpdir) / "exported.json"

            # Invalid names (<3 chars or >12 chars) must raise ValueError
            with self.assertRaises(ValueError):
                add_leaderboard_entry({"name": "ab", "score": 100, "nights_won": 1, "seed": 42}, path=lb_path)
            with self.assertRaises(ValueError):
                add_leaderboard_entry({"name": "TooLongName1234", "score": 100, "nights_won": 1, "seed": 42}, path=lb_path)

            # Insert 12 valid entries including a tie in score to verify tie-break & top-10 cap
            for i in range(11):
                add_leaderboard_entry(
                    {
                        "name": f"Player_{i:02d}",
                        "score": 100 * (i + 1),
                        "nights_won": i % 4,
                        "achieved_at": f"2026-11-20T16:{i:02d}:00+07:00",
                        "seed": 42 + i,
                    },
                    path=lb_path,
                )
            # Tie score = 1100 achieved LATER than Player_10 -> Player_10 must rank #1, Tie_Later #2
            add_leaderboard_entry(
                {
                    "name": "Tie_Later",
                    "score": 1100,
                    "nights_won": 3,
                    "achieved_at": "2026-11-20T16:59:00+07:00",
                    "seed": 99,
                },
                path=lb_path,
            )

            rc = export_leaderboard(str(out_path), path=lb_path)
            self.assertEqual(rc, 0)
            exported = json.loads(out_path.read_text(encoding="utf-8"))
            entries = exported["entries"]
            self.assertEqual(len(entries), 10)
            self.assertEqual(entries[0]["name"], "Player_10")
            self.assertEqual(entries[1]["name"], "Tie_Later")
            self.assertEqual(entries[0]["score"], 1100)
            self.assertEqual(entries[1]["score"], 1100)


if __name__ == "__main__":
    unittest.main()
