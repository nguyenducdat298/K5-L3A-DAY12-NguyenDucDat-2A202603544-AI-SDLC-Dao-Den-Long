"""Pure deterministic simulation core for Đảo Đèn Lồng (Night 1)."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from .contract import Tuning
from .rng import SeededRNG

TICK_RATE = 60
DT = 1.0 / TICK_RATE
ISLAND_RADIUS = 25.0
GRAVITY = 22.0
JUMP_VEL = 8.0
DEFAULT_MOTE_TARGET = 15
DEFAULT_SHADE_INITIAL = 2
DEFAULT_SHADE_MAX = 5
MOTE_RESPAWN_INTERVAL_TICKS = 180
SHADE_SPAWN_INTERVAL_TICKS = 600


def _r3(val: float) -> float:
    res = round(float(val), 3)
    return 0.0 if res == 0.0 else res


def _pos3(pos: list[float]) -> list[float]:
    return [_r3(pos[0]), _r3(pos[1]), _r3(pos[2])]


def dist_xz(a: list[float], b: list[float]) -> float:
    return math.hypot(a[0] - b[0], a[2] - b[2])


@dataclass
class InputState:
    move_x: float = 0.0
    move_z: float = 0.0
    cam_yaw_deg: float = 0.0
    jump: bool = False
    interact: bool = False
    pulse: bool = False


@dataclass
class PlayerState:
    pos: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    vel_y: float = 0.0
    flames: int = 3
    carried: int = 0
    invuln_s: float = 0.0
    pulse_cooldown_s: float = 0.0


@dataclass
class LanternState:
    id: str
    pos: list[float]
    deposited: int = 0
    lit: bool = False


@dataclass
class ShadeState:
    id: str
    pos: list[float]
    state: str = "chase"
    stun_s: float = 0.0


@dataclass
class MoteState:
    id: str
    pos: list[float]


@dataclass
class Simulation:
    tuning: Tuning
    rng: SeededRNG
    player: PlayerState
    lanterns: list[LanternState]
    shades: list[ShadeState]
    motes: list[MoteState]
    initial_duration_s: float
    random_motes: bool = True
    random_shades: bool = True
    tick: int = 0
    sim_tick: int = 0
    state: str = "playing"
    score: int = 0
    next_mote_idx: int = 1
    next_shade_idx: int = 1
    mote_spawn_timer: int = 0
    shade_spawn_timer: int = 0
    prev_input: InputState = field(default_factory=InputState)

    @property
    def time_left_s(self) -> float:
        return max(0.0, self.initial_duration_s - self.sim_tick / TICK_RATE)

    def spawn_mote_random(self) -> MoteState:
        angle = self.rng.uniform(0.0, 2.0 * math.pi)
        radius = math.sqrt(self.rng.random()) * (ISLAND_RADIUS - 2.5)
        x = math.cos(angle) * radius
        z = math.sin(angle) * radius
        mote = MoteState(id=f"M{self.next_mote_idx}", pos=[x, 0.0, z])
        self.next_mote_idx += 1
        self.motes.append(mote)
        return mote

    def spawn_shade_random(self) -> ShadeState:
        angle = self.rng.uniform(0.0, 2.0 * math.pi)
        radius = ISLAND_RADIUS - 1.5
        x = math.cos(angle) * radius
        z = math.sin(angle) * radius
        shade = ShadeState(id=f"S{self.next_shade_idx}", pos=[x, 0.0, z], state="chase")
        self.next_shade_idx += 1
        self.shades.append(shade)
        return shade

    def to_snapshot(self) -> dict[str, Any]:
        return {
            "type": "snapshot",
            "tick": self.tick,
            "sim_tick": self.sim_tick,
            "state": self.state,
            "time_left_s": _r3(self.time_left_s),
            "score": self.score,
            "player": {
                "pos": _pos3(self.player.pos),
                "flames": self.player.flames,
                "carried": self.player.carried,
            },
            "lanterns": [
                {
                    "id": l.id,
                    "pos": _pos3(l.pos),
                    "lit": l.lit,
                    "deposited": l.deposited,
                }
                for l in self.lanterns
            ],
            "shades": [
                {
                    "id": s.id,
                    "pos": _pos3(s.pos),
                    "state": s.state,
                }
                for s in self.shades
            ],
            "motes_active": len(self.motes),
            "motes": [
                {"id": m.id, "pos": _pos3(m.pos)}
                for m in self.motes
            ],
        }


def default_lanterns(count: int) -> list[LanternState]:
    lanterns: list[LanternState] = []
    ring_r = 15.0
    for i in range(count):
        angle = (2.0 * math.pi * i) / count - math.pi / 2.0
        x = math.cos(angle) * ring_r
        z = math.sin(angle) * ring_r
        lanterns.append(LanternState(id=f"L{i + 1}", pos=[x, 0.0, z]))
    return lanterns


def create_simulation(
    tuning: Tuning,
    seed: int,
    scenario: dict[str, Any] | None = None,
) -> Simulation:
    rng = SeededRNG(seed)
    player = PlayerState(pos=[0.0, 0.0, 0.0], flames=tuning.flames, carried=0)
    lanterns = default_lanterns(tuning.lantern_count_night1)
    duration_s = tuning.night1_duration_s
    random_motes = True
    random_shades = True

    sim = Simulation(
        tuning=tuning,
        rng=rng,
        player=player,
        lanterns=lanterns,
        shades=[],
        motes=[],
        initial_duration_s=duration_s,
        random_motes=random_motes,
        random_shades=random_shades,
    )

    if scenario is not None:
        if "random_motes" in scenario:
            sim.random_motes = bool(scenario["random_motes"])
        if "random_shades" in scenario:
            sim.random_shades = bool(scenario["random_shades"])
        if "time_left_s" in scenario:
            sim.initial_duration_s = float(scenario["time_left_s"])

        if "player" in scenario and isinstance(scenario["player"], dict):
            p = scenario["player"]
            if "pos" in p:
                sim.player.pos = [float(p["pos"][0]), float(p["pos"][1]), float(p["pos"][2])]
            if "carried" in p:
                sim.player.carried = int(p["carried"])
            if "flames" in p:
                sim.player.flames = int(p["flames"])

        if "lanterns" in scenario:
            by_id = {l.id: l for l in sim.lanterns}
            for item in scenario["lanterns"]:
                lid = str(item["id"])
                if lid not in by_id:
                    target = LanternState(id=lid, pos=[0.0, 0.0, 0.0])
                    sim.lanterns.append(target)
                    by_id[lid] = target
                else:
                    target = by_id[lid]
                if "pos" in item:
                    target.pos = [float(item["pos"][0]), float(item["pos"][1]), float(item["pos"][2])]
                if "deposited" in item:
                    target.deposited = int(item["deposited"])
                if "lit" in item:
                    target.lit = bool(item["lit"])
                elif target.deposited >= tuning.lantern_cost:
                    target.lit = True

        if "motes" in scenario:
            for item in scenario["motes"]:
                if isinstance(item, dict):
                    pos = item["pos"]
                    mid = str(item.get("id", f"M{sim.next_mote_idx}"))
                else:
                    pos = item
                    mid = f"M{sim.next_mote_idx}"
                sim.next_mote_idx += 1
                sim.motes.append(MoteState(id=mid, pos=[float(pos[0]), float(pos[1]), float(pos[2])]))
        elif sim.random_motes:
            for _ in range(DEFAULT_MOTE_TARGET):
                sim.spawn_mote_random()

        if "shades" in scenario:
            for item in scenario["shades"]:
                if isinstance(item, dict):
                    pos = item["pos"]
                    sid = str(item.get("id", f"S{sim.next_shade_idx}"))
                else:
                    pos = item
                    sid = f"S{sim.next_shade_idx}"
                sim.next_shade_idx += 1
                sim.shades.append(
                    ShadeState(id=sid, pos=[float(pos[0]), float(pos[1]), float(pos[2])], state="chase")
                )
        elif sim.random_shades:
            for _ in range(DEFAULT_SHADE_INITIAL):
                sim.spawn_shade_random()
    else:
        for _ in range(DEFAULT_MOTE_TARGET):
            sim.spawn_mote_random()
        for _ in range(DEFAULT_SHADE_INITIAL):
            sim.spawn_shade_random()

    return sim


def apply_frame(prev: InputState, frame: dict[str, Any]) -> InputState:
    move = frame.get("move")
    if move is not None:
        mx = float(move[0])
        mz = float(move[1])
    else:
        mx, mz = prev.move_x, prev.move_z

    return InputState(
        move_x=mx,
        move_z=mz,
        cam_yaw_deg=float(frame["cam_yaw_deg"]) if "cam_yaw_deg" in frame else prev.cam_yaw_deg,
        jump=bool(frame["jump"]) if "jump" in frame else prev.jump,
        interact=bool(frame["interact"]) if "interact" in frame else prev.interact,
        pulse=bool(frame["pulse"]) if "pulse" in frame else prev.pulse,
    )


def step_tick(sim: Simulation, curr_input: InputState) -> list[dict[str, Any]]:
    """Advance simulation by exactly 1 tick (1/60s) and return events emitted."""
    if sim.state != "playing":
        return []

    events: list[dict[str, Any]] = []
    sim.tick += 1
    sim.sim_tick += 1
    ev_tick = sim.tick
    t = sim.tuning

    # 1. Timers & Cooldowns
    if sim.player.invuln_s > 0.0:
        sim.player.invuln_s = max(0.0, sim.player.invuln_s - DT)
    if sim.player.pulse_cooldown_s > 0.0:
        sim.player.pulse_cooldown_s = max(0.0, sim.player.pulse_cooldown_s - DT)
    for shade in sim.shades:
        if shade.stun_s > 0.0:
            shade.stun_s = max(0.0, shade.stun_s - DT)
            if shade.stun_s <= 0.0:
                shade.state = "chase"

    # 2. Edges & Player Movement
    jump_edge = curr_input.jump and not sim.prev_input.jump
    interact_edge = curr_input.interact and not sim.prev_input.interact
    pulse_edge = curr_input.pulse and not sim.prev_input.pulse
    sim.prev_input = curr_input

    mx = max(-1.0, min(1.0, curr_input.move_x))
    mz = max(-1.0, min(1.0, curr_input.move_z))
    mag = math.hypot(mx, mz)
    if mag > 1.0:
        mx /= mag
        mz /= mag

    theta = math.radians(curr_input.cam_yaw_deg)
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)
    wx = mx * cos_t + mz * sin_t
    wz = -mx * sin_t + mz * cos_t

    sim.player.pos[0] += wx * t.player_speed * DT
    sim.player.pos[2] += wz * t.player_speed * DT

    if jump_edge and sim.player.pos[1] <= 0.001:
        sim.player.vel_y = JUMP_VEL
    if sim.player.pos[1] > 0.0 or sim.player.vel_y != 0.0:
        sim.player.pos[1] += sim.player.vel_y * DT
        sim.player.vel_y -= GRAVITY * DT
        if sim.player.pos[1] <= 0.0:
            sim.player.pos[1] = 0.0
            sim.player.vel_y = 0.0

    if not t.fall_enabled:
        r = math.hypot(sim.player.pos[0], sim.player.pos[2])
        if r > ISLAND_RADIUS:
            scale = ISLAND_RADIUS / r
            sim.player.pos[0] *= scale
            sim.player.pos[2] *= scale

    # 3. Pickup Motes
    remaining_motes: list[MoteState] = []
    for mote in sim.motes:
        if (
            sim.player.carried < t.carry_capacity
            and dist_xz(sim.player.pos, mote.pos) <= t.pickup_radius
        ):
            sim.player.carried += 1
            sim.score += t.score.per_mote
            events.append({
                "type": "event",
                "tick": ev_tick,
                "name": "mote_picked",
                "data": {"carried": sim.player.carried},
            })
        else:
            remaining_motes.append(mote)
    sim.motes = remaining_motes

    # 4. Interact (Deposit & Light Lantern)
    if interact_edge and sim.player.carried > 0:
        candidates = [
            (dist_xz(sim.player.pos, l.pos), l.id, l)
            for l in sim.lanterns
            if not l.lit and dist_xz(sim.player.pos, l.pos) <= t.interact_radius
        ]
        if candidates:
            candidates.sort(key=lambda item: (item[0], item[1]))
            target = candidates[0][2]
            need = max(0, t.lantern_cost - target.deposited)
            amount = min(sim.player.carried, need)
            if amount > 0:
                sim.player.carried -= amount
                target.deposited += amount
                events.append({
                    "type": "event",
                    "tick": ev_tick,
                    "name": "deposit",
                    "data": {
                        "lantern_id": target.id,
                        "amount": amount,
                        "deposited": target.deposited,
                    },
                })
                if target.deposited >= t.lantern_cost:
                    target.lit = True
                    sim.score += t.score.per_lantern
                    events.append({
                        "type": "event",
                        "tick": ev_tick,
                        "name": "lantern_lit",
                        "data": {"lantern_id": target.id},
                    })

    # 5. Pulse
    if pulse_edge and sim.player.carried >= t.pulse_cost and sim.player.pulse_cooldown_s <= 0.0:
        sim.player.carried -= t.pulse_cost
        sim.player.pulse_cooldown_s = t.pulse_cooldown_s
        stunned_ids: list[str] = []
        for shade in sim.shades:
            d = dist_xz(sim.player.pos, shade.pos)
            if d <= t.pulse_radius:
                if d > 1e-6:
                    dx = (shade.pos[0] - sim.player.pos[0]) / d
                    dz = (shade.pos[2] - sim.player.pos[2]) / d
                else:
                    dx = sin_t
                    dz = cos_t
                shade.pos[0] += dx * t.pulse_push_m
                shade.pos[2] += dz * t.pulse_push_m
                shade.stun_s = t.pulse_stun_s
                shade.state = "stunned"
                sim.score += t.score.per_stun
                stunned_ids.append(shade.id)
        events.append({
            "type": "event",
            "tick": ev_tick,
            "name": "pulse",
            "data": {"stunned_ids": stunned_ids},
        })

    # 6. Random Spawns & Shade AI
    if sim.random_motes:
        sim.mote_spawn_timer += 1
        if sim.mote_spawn_timer >= MOTE_RESPAWN_INTERVAL_TICKS:
            sim.mote_spawn_timer = 0
            if len(sim.motes) < DEFAULT_MOTE_TARGET:
                sim.spawn_mote_random()

    if sim.random_shades:
        sim.shade_spawn_timer += 1
        if sim.shade_spawn_timer >= SHADE_SPAWN_INTERVAL_TICKS:
            sim.shade_spawn_timer = 0
            if len(sim.shades) < DEFAULT_SHADE_MAX:
                new_shade = sim.spawn_shade_random()
                events.append({
                    "type": "event",
                    "tick": ev_tick,
                    "name": "shade_spawned",
                    "data": {"id": new_shade.id},
                })

    lit_lanterns = [l for l in sim.lanterns if l.lit]
    for shade in sim.shades:
        if shade.stun_s <= 0.0:
            shade.state = "chase"
            dx = sim.player.pos[0] - shade.pos[0]
            dz = sim.player.pos[2] - shade.pos[2]
            d = math.hypot(dx, dz)
            if d > 1e-6:
                step = min(d, t.shade_speed * DT)
                shade.pos[0] += (dx / d) * step
                shade.pos[2] += (dz / d) * step

        for lantern in lit_lanterns:
            ld = dist_xz(shade.pos, lantern.pos)
            if ld < t.safe_radius:
                if ld > 1e-6:
                    ux = (shade.pos[0] - lantern.pos[0]) / ld
                    uz = (shade.pos[2] - lantern.pos[2]) / ld
                else:
                    ux, uz = 0.0, 1.0
                shade.pos[0] = lantern.pos[0] + ux * t.safe_radius
                shade.pos[2] = lantern.pos[2] + uz * t.safe_radius

    # 7. Shade Collision
    player_in_safe = any(dist_xz(sim.player.pos, l.pos) <= t.safe_radius for l in lit_lanterns)
    if sim.player.invuln_s <= 0.0 and not player_in_safe:
        hit = any(
            shade.stun_s <= 0.0 and dist_xz(sim.player.pos, shade.pos) <= t.shade_hit_radius
            for shade in sim.shades
        )
        if hit:
            dropped = math.floor(sim.player.carried * t.hit_drop_ratio)
            sim.player.carried -= dropped
            sim.player.flames = max(0, sim.player.flames - 1)
            sim.player.invuln_s = t.invuln_s
            events.append({
                "type": "event",
                "tick": ev_tick,
                "name": "player_hit",
                "data": {
                    "by": "shade",
                    "flames": sim.player.flames,
                    "dropped": dropped,
                },
            })

    # 8. Win / Lose Checks
    if sim.lanterns and all(l.lit for l in sim.lanterns):
        sim.state = "won"
        sim.score += int(sim.time_left_s) * t.score.per_second_left + sim.player.flames * t.score.per_flame_left
        events.append({
            "type": "event",
            "tick": ev_tick,
            "name": "game_over",
            "data": {"result": "won", "reason": "all_lit"},
        })
    elif sim.player.flames <= 0:
        sim.state = "lost"
        events.append({
            "type": "event",
            "tick": ev_tick,
            "name": "game_over",
            "data": {"result": "lost", "reason": "no_flames"},
        })
    elif sim.time_left_s <= 0.0:
        sim.state = "lost"
        events.append({
            "type": "event",
            "tick": ev_tick,
            "name": "game_over",
            "data": {"result": "lost", "reason": "dawn"},
        })

    return events
