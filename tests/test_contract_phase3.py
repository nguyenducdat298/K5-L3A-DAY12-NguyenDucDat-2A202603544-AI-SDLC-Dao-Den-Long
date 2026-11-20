"""Automated Test Suite for Phase 3 (TICKET-03 — CHANGE REQUEST "Đèn cạn dầu" · Test Contract v1.2)."""

from __future__ import annotations

import json
import pathlib
import tempfile
import unittest

from headless import run_headless
from src.sim import GameSimulation, load_contract

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


class TestContractPhase3(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = load_contract()
        self.tuning = self.contract["tuning"]

    def test_lantern_fuel_decay_out_and_relight(self) -> None:
        # L1 starts lit with fuel = 1.0 (60 ticks); player waits near L1 with 5 motes, then relights at tick 61
        sim = GameSimulation(
            self.tuning,
            seed=1,
            night=1,
            scenario={
                "player": {"pos": [0, 0, 24.0], "carried": 5, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "motes": [],
                "shades": [],
                "lanterns": [{"id": "L1", "pos": [0, 0, 25.0], "lit": True, "fuel": 1.0}],
                "time_left_s": 240,
            },
        )
        out_events = []
        for _ in range(60):
            out_events.extend(sim.step())
        # At tick 60, L1 runs out of fuel and emits lantern_out
        self.assertTrue(any(e["name"] == "lantern_out" and e["data"]["lantern_id"] == "L1" for e in out_events))
        l1 = sim.lanterns[0]
        self.assertFalse(l1["lit"])
        self.assertEqual(l1["deposited"], 0)
        self.assertTrue(l1["ever_lit"])

        # Now interact to relight L1 using only 5 motes (relight_cost = 5)
        evs = sim.step({"interact": True})
        lit_ev = next(e for e in evs if e["name"] == "lantern_lit")
        self.assertEqual(lit_ev["data"], {"lantern_id": "L1", "relight": True})
        self.assertTrue(l1["lit"])
        self.assertEqual(l1["fuel_ticks"], 6000)
        self.assertEqual(l1["relit_count"], 1)
        # Score: 5 motes * 5 (+25) + relight (+40) = 65
        self.assertEqual(sim.score, 65)
        # Capacity increased from 10 to 12 (10 + 2 * 1)
        self.assertEqual(sim.player["capacity"], 12)

    def test_refuel_and_safe_zone_restoration(self) -> None:
        # L1 is lit with fuel = 25.0 (< 30, so safe zone is inactive) and S1 is at 3.0m from L1
        sim = GameSimulation(
            self.tuning,
            seed=1,
            night=1,
            scenario={
                "player": {"pos": [0, 0, 24.0], "carried": 4, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "motes": [],
                "shades": [{"id": "S1", "pos": [0, 0, 22.0], "state": "wander"}],
                "lanterns": [{"id": "L1", "pos": [0, 0, 25.0], "lit": True, "fuel": 25.0}],
                "time_left_s": 240,
            },
        )
        evs = sim.step({"interact": True})
        ref_ev = next(e for e in evs if e["name"] == "refuel")
        self.assertEqual(ref_ev["data"]["lantern_id"], "L1")
        self.assertEqual(ref_ev["data"]["amount"], 4)
        self.assertGreaterEqual(ref_ev["data"]["fuel"], 64.0)
        # Score: 4 * 5 = 20
        self.assertEqual(sim.score, 20)

        # Since fuel is now >= 30, S1 inside 6m safe_radius is pushed out to >= 6m within 30 ticks
        for _ in range(30):
            sim.step({"interact": False})
        d_s1_l1 = abs(sim.shades[0]["pos"][2] - 25.0)
        self.assertGreaterEqual(d_s1_l1, 5.99)

    def test_shade_drain_and_pulse_bonus_15(self) -> None:
        # L1 at (0,0,25) has fuel = 20.0 (< 30). S1 in wander at (0,0,22) moves to L1, enters drain at <= 2m
        sim = GameSimulation(
            self.tuning,
            seed=1,
            night=1,
            scenario={
                "player": {"pos": [0, 0, 0], "carried": 3, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "motes": [],
                "shades": [{"id": "S1", "pos": [0, 0, 22.5], "state": "wander"}],
                "lanterns": [{"id": "L1", "pos": [0, 0, 25.0], "lit": True, "fuel": 20.0}],
                "time_left_s": 240,
            },
        )
        all_evs = []
        for _ in range(70):
            all_evs.extend(sim.step())
        self.assertEqual(sim.shades[0]["state"], "drain")
        # Every 60 ticks of draining emits fuel_drain
        drain_evs = [e for e in all_evs if e["name"] == "fuel_drain"]
        self.assertEqual(len(drain_evs), 1)
        self.assertEqual(drain_evs[0]["data"]["lantern_id"], "L1")
        self.assertEqual(drain_evs[0]["data"]["shade_id"], "S1")

        # Now move player within pulse range (but > 6m or pulse immediately while S1 is in drain)
        sim.player["pos"] = [0.0, 0.0, 20.0]
        evs_pulse = sim.step({"pulse": True})
        self.assertTrue(any(e["name"] == "pulse" for e in evs_pulse))
        # Hitting a draining shade awards +15 points!
        self.assertEqual(sim.score, 15)
        self.assertEqual(sim.shades[0]["state"], "stunned")

        # When stun expires (120 ticks), shade returns to wander
        for _ in range(120):
            sim.step({"pulse": False})
        self.assertEqual(sim.shades[0]["state"], "wander")

    def test_dynamic_capacity_progression(self) -> None:
        sim = GameSimulation(
            self.tuning,
            seed=1,
            night=1,
            scenario={
                "player": {"pos": [0, 0, 0], "carried": 0, "flames": 3, "successful_lights": 3},
                "random_motes": False,
                "random_shades": False,
                "motes": [],
                "shades": [],
            },
        )
        snap = sim.get_snapshot()
        self.assertEqual(snap["player"]["capacity"], 16)

    def test_dawn_survived_win_and_no_early_win(self) -> None:
        # All 5 lanterns lit with time_left_s = 1.0s (60 ticks) -> must NOT end early at tick 1; wins at tick 60!
        sim = GameSimulation(
            self.tuning,
            seed=1,
            night=1,
            scenario={
                "player": {"pos": [0, 0, 0], "carried": 0, "flames": 3},
                "random_motes": False,
                "random_shades": False,
                "motes": [],
                "shades": [],
                "lanterns": [
                    {"id": "L1", "lit": True, "fuel": 80},
                    {"id": "L2", "lit": True, "fuel": 80},
                    {"id": "L3", "lit": True, "fuel": 80},
                    {"id": "L4", "lit": False},
                    {"id": "L5", "lit": False},
                ],
                "time_left_s": 1.0,
            },
        )
        for _ in range(59):
            sim.step()
            self.assertEqual(sim.state, "playing")
        evs = sim.step()
        self.assertEqual(sim.state, "won")
        go_ev = next(e for e in evs if e["name"] == "game_over")
        self.assertEqual(go_ev["data"], {"result": "won", "reason": "dawn_survived"})
        # 3 lit lanterns each with fuel = 79.0 -> 3 * (50 + 79) + 3 flames * 50 = 387 + 150 = 537
        self.assertEqual(sim.score, 537)


if __name__ == "__main__":
    unittest.main()
