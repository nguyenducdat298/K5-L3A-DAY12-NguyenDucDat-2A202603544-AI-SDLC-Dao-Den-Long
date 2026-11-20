"""Automated Test Suite for Phase 2 (TICKET-02 — "Ba hòn đảo" · Test Contract v1.1)."""

from __future__ import annotations

import json
import pathlib
import tempfile
import time
import unittest

from headless import run_headless
from src.sim import GameSimulation, load_contract

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
SCENARIOS_DIR = REPO_ROOT / "tests" / "scenarios"


class TestContractPhase2(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = load_contract()
        self.tuning = self.contract["tuning"]

    def test_night1_standardized_map_and_spawns(self) -> None:
        sim = GameSimulation(self.tuning, seed=42, night=1)
        snap0 = sim.get_snapshot()
        self.assertEqual(snap0["night"], 1)
        self.assertEqual(len(snap0["lanterns"]), 5)
        self.assertEqual(snap0["lanterns"][0]["pos"], [0.0, 0.0, 25.0])
        self.assertEqual(snap0["motes_active"], 20)
        self.assertEqual(len(snap0["shades"]), 0)

        # Advance 300 ticks -> at tick 240 a mote spawns (21), at tick 300 two shades S1, S2 spawn
        spawned_events = []
        for _ in range(300):
            evs = sim.step()
            spawned_events.extend(e for e in evs if e["name"] == "shade_spawned")
        self.assertEqual(len(spawned_events), 2)
        self.assertEqual([e["data"]["id"] for e in spawned_events], ["S1", "S2"])
        self.assertEqual(len(sim.motes), 21)

    def test_dash_mechanic_cli(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "dash.jsonl"
            rc = run_headless(
                [
                    "--seed",
                    "1",
                    "--night",
                    "1",
                    "--scenario",
                    str(SCENARIOS_DIR / "p2_dash_scenario.json"),
                    "--inputs",
                    str(SCENARIOS_DIR / "p2_dash_inputs.json"),
                    "--ticks",
                    "20",
                    "--out",
                    str(out_file),
                    "--snapshot-every",
                    "12",
                ]
            )
            self.assertEqual(rc, 0)
            lines = [json.loads(l) for l in out_file.read_text(encoding="utf-8").splitlines()]
            dash_evs = [r for r in lines if r["type"] == "event" and r["name"] == "dash"]
            self.assertEqual(len(dash_evs), 1)
            self.assertEqual(dash_evs[0]["tick"], 1)
            # 12 ticks at 14.0 m/s = 2.8 m
            snap12 = next(r for r in lines if r["type"] == "snapshot" and r["tick"] == 12)
            self.assertAlmostEqual(snap12["player"]["pos"][2], 2.8, places=3)
            self.assertGreater(snap12["player"]["dash_cd_s"], 1.2)

    def test_pause_and_resume_freezes_sim_tick(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "pause.jsonl"
            rc = run_headless(
                [
                    "--seed",
                    "1",
                    "--night",
                    "1",
                    "--scenario",
                    str(SCENARIOS_DIR / "p2_dash_scenario.json"),
                    "--inputs",
                    str(SCENARIOS_DIR / "p2_pause_inputs.json"),
                    "--ticks",
                    "30",
                    "--out",
                    str(out_file),
                    "--snapshot-every",
                    "5",
                ]
            )
            self.assertEqual(rc, 0)
            lines = [json.loads(l) for l in out_file.read_text(encoding="utf-8").splitlines()]
            ev_names = [(r["tick"], r["name"]) for r in lines if r["type"] == "event"]
            self.assertIn((11, "paused"), ev_names)
            self.assertIn((26, "resumed"), ev_names)
            # At tick 20 (during pause), state is "paused" and sim_tick stays at 10
            snap20 = next(r for r in lines if r["type"] == "snapshot" and r["tick"] == 20)
            self.assertEqual(snap20["state"], "paused")
            self.assertEqual(snap20["sim_tick"], 10)

    def test_fall_off_island_and_respawn(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "fall.jsonl"
            rc = run_headless(
                [
                    "--seed",
                    "1",
                    "--night",
                    "1",
                    "--scenario",
                    str(SCENARIOS_DIR / "p2_fall_respawn_scenario.json"),
                    "--inputs",
                    str(SCENARIOS_DIR / "p2_fall_respawn_inputs.json"),
                    "--ticks",
                    "150",
                    "--out",
                    str(out_file),
                    "--snapshot-every",
                    "10",
                ]
            )
            self.assertEqual(rc, 0)
            lines = [json.loads(l) for l in out_file.read_text(encoding="utf-8").splitlines()]
            hit_evs = [r for r in lines if r["type"] == "event" and r["name"] == "player_hit"]
            self.assertEqual(len(hit_evs), 1)
            self.assertEqual(hit_evs[0]["data"], {"by": "fall", "flames": 1, "dropped": 0, "lost": 4})
            # At tick 150 (after 60-tick wait), player is respawned at [0, 0, 0] with invuln=True
            snap150 = next(r for r in lines if r["type"] == "snapshot" and r["tick"] == 150)
            self.assertEqual(snap150["player"]["pos"], [0.0, 0.0, 0.0])
            self.assertTrue(snap150["player"]["invuln"])

    def test_shade_hit_dropped_motes_and_recoil(self) -> None:
        sim = GameSimulation(
            self.tuning,
            seed=5,
            night=1,
            scenario={
                "player": {"pos": [0, 0, 0], "carried": 5, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "motes": [],
                "shades": [{"id": "S1", "pos": [0, 0, 0.8], "state": "chase"}],
            },
        )
        evs = sim.step()
        hit_ev = next(e for e in evs if e["name"] == "player_hit")
        self.assertEqual(hit_ev["data"], {"by": "shade", "flames": 2, "dropped": 2})
        self.assertEqual(sim.shades[0]["state"], "recoil")
        self.assertEqual(len(sim.motes), 2)
        self.assertTrue(all(m["kind"] == "dropped" and m["ttl_ticks"] == 480 for m in sim.motes))

    def test_drifter_steal_and_pulse_drop_cli(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "drifter.jsonl"
            rc = run_headless(
                [
                    "--seed",
                    "9",
                    "--night",
                    "2",
                    "--scenario",
                    str(SCENARIOS_DIR / "p2_drifter_steal_drop_scenario.json"),
                    "--inputs",
                    str(SCENARIOS_DIR / "p2_drifter_steal_drop_inputs.json"),
                    "--ticks",
                    "40",
                    "--out",
                    str(out_file),
                    "--snapshot-every",
                    "10",
                ]
            )
            self.assertEqual(rc, 0)
            lines = [json.loads(l) for l in out_file.read_text(encoding="utf-8").splitlines()]
            events = [r for r in lines if r["type"] == "event"]
            ev_names = [e["name"] for e in events]
            self.assertIn("drifter_steal", ev_names)
            self.assertIn("drifter_drop", ev_names)
            steal_ev = next(e for e in events if e["name"] == "drifter_steal")
            self.assertEqual(steal_ev["data"], {"drifter_id": "D1", "amount": 3, "carried": 3})
            drop_ev = next(e for e in events if e["name"] == "drifter_drop")
            self.assertEqual(drop_ev["data"], {"drifter_id": "D1", "amount": 3})
            # 3 dropped motes should now exist on the map
            snap30 = next(r for r in lines if r["type"] == "snapshot" and r["tick"] == 30)
            self.assertEqual(snap30["motes_active"], 3)
            self.assertTrue(all(m["kind"] == "dropped" for m in snap30["motes"]))

    def test_night2_charm_and_jumppad(self) -> None:
        # 1. Pick up Wind Charm C1 at (35, 0, 0) on the bamboo bridge
        sim = GameSimulation(
            self.tuning,
            seed=2,
            night=2,
            scenario={
                "player": {"pos": [34.5, 0, 0], "carried": 0, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "random_drifters": False,
                "motes": [],
                "shades": [],
            },
        )
        evs = sim.step({"move": [1, 0]})
        charm_ev = next(e for e in evs if e["name"] == "charm_picked")
        self.assertEqual(charm_ev["data"], {"charm_id": "C1", "charm_ticks": 600})
        self.assertFalse(sim.charms[0]["available"])

        # 2. Step onto Jump Pad A at (20, 0, 18) -> launches to Island B
        sim_pad = GameSimulation(
            self.tuning,
            seed=2,
            night=2,
            scenario={
                "player": {"pos": [20.0, 0.0, 18.0], "carried": 0, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "random_drifters": False,
                "motes": [],
                "shades": [],
            },
        )
        sim_pad.step()
        self.assertFalse(sim_pad.player["grounded"])
        self.assertAlmostEqual(sim_pad.player["vel"][1], 14.0, places=3)
        for _ in range(90):
            sim_pad.step()
        self.assertTrue(sim_pad.player["grounded"])
        # Landed safely on Island B (within 28m of (70, 0, 0))
        dist_to_b = ((sim_pad.player["pos"][0] - 70.0) ** 2 + sim_pad.player["pos"][2] ** 2) ** 0.5
        self.assertLessEqual(dist_to_b, 28.0)

    def test_night3_tiers_ramps_jumppad_and_wind(self) -> None:
        # Test Jump Pad at (0, 3, 13) on Tier 1 launching to Tier 2 (Y=6, R<=8)
        sim = GameSimulation(
            self.tuning,
            seed=3,
            night=3,
            scenario={
                "player": {"pos": [0.0, 3.0, 13.0], "carried": 0, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "random_drifters": False,
                "wind_enabled": False,
                "motes": [],
                "shades": [],
            },
        )
        sim.step()
        self.assertAlmostEqual(sim.player["vel"][1], 12.0, places=3)
        self.assertAlmostEqual(sim.player["vel"][2], -8.0, places=3)
        for _ in range(60):
            sim.step()
        self.assertTrue(sim.player["grounded"])
        self.assertAlmostEqual(sim.player["pos"][1], 6.0, places=3)
        self.assertLessEqual((sim.player["pos"][0] ** 2 + sim.player["pos"][2] ** 2) ** 0.5, 8.0)

    def test_headless_21600_ticks_performance(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out_file = pathlib.Path(tmp) / "full_night3.jsonl"
            t0 = time.perf_counter()
            rc = run_headless(
                [
                    "--seed",
                    "42",
                    "--night",
                    "3",
                    "--ticks",
                    "21600",
                    "--out",
                    str(out_file),
                    "--snapshot-every",
                    "60",
                ]
            )
            elapsed = time.perf_counter() - t0
            self.assertEqual(rc, 0)
            self.assertLess(elapsed, 30.0, f"Headless 21600 ticks took {elapsed:.2f}s (> 30s limit)")


if __name__ == "__main__":
    unittest.main()
