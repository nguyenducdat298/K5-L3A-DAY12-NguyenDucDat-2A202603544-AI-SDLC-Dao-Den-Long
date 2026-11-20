"""Load and expose tuning parameters from game.contract.json."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ScoreTuning:
    per_mote: int
    per_lantern: int
    per_stun: int
    per_second_left: int
    per_flame_left: int


@dataclass(frozen=True)
class Tuning:
    player_speed: float
    carry_capacity: int
    lantern_cost: int
    lantern_count_night1: int
    pickup_radius: float
    interact_radius: float
    pulse_cost: int
    pulse_radius: float
    night1_duration_s: float
    flames: int
    invuln_s: float
    hit_drop_ratio: float
    pulse_stun_s: float
    pulse_push_m: float
    pulse_cooldown_s: float
    safe_radius: float
    shade_speed: float
    shade_hit_radius: float
    fall_enabled: bool
    score: ScoreTuning


def load_contract(path: Path | None = None) -> dict[str, Any]:
    if path is None:
        path = Path(__file__).resolve().parents[2] / "game.contract.json"
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_tuning(path: Path | None = None) -> Tuning:
    data = load_contract(path)
    t = data["tuning"]
    s = t["score"]
    return Tuning(
        player_speed=float(t["player_speed"]),
        carry_capacity=int(t["carry_capacity"]),
        lantern_cost=int(t["lantern_cost"]),
        lantern_count_night1=int(t["lantern_count_night1"]),
        pickup_radius=float(t["pickup_radius"]),
        interact_radius=float(t["interact_radius"]),
        pulse_cost=int(t["pulse_cost"]),
        pulse_radius=float(t["pulse_radius"]),
        night1_duration_s=float(t["night1_duration_s"]),
        flames=int(t["flames"]),
        invuln_s=float(t["invuln_s"]),
        hit_drop_ratio=float(t["hit_drop_ratio"]),
        pulse_stun_s=float(t["pulse_stun_s"]),
        pulse_push_m=float(t["pulse_push_m"]),
        pulse_cooldown_s=float(t["pulse_cooldown_s"]),
        safe_radius=float(t["safe_radius"]),
        shade_speed=float(t["shade_speed"]),
        shade_hit_radius=float(t["shade_hit_radius"]),
        fall_enabled=bool(t["fall_enabled"]),
        score=ScoreTuning(
            per_mote=int(s["per_mote"]),
            per_lantern=int(s["per_lantern"]),
            per_stun=int(s["per_stun"]),
            per_second_left=int(s["per_second_left"]),
            per_flame_left=int(s["per_flame_left"]),
        ),
    )
