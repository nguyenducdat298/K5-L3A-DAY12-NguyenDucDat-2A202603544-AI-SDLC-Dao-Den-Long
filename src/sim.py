"""Pure deterministic 60Hz game simulation core for Đảo Đèn Lồng (Phase 1 - Test Contract v1.0)."""

from __future__ import annotations

import json
import math
import pathlib
from typing import Any

TICK_RATE = 60
DT = 1.0 / TICK_RATE
EPS = 1e-9


class ContractFormatError(ValueError):
    """Raised when --inputs or --scenario file violates Test Contract v1.0 format (exit code 2)."""


class Mulberry32:
    """Deterministic 32-bit PRNG matching JS Mulberry32 bit-for-bit."""

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF

    def next_float(self) -> float:
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        t = (t ^ (t >> 14)) & 0xFFFFFFFF
        return t / 4294967296.0

    def uniform(self, low: float, high: float) -> float:
        return low + (high - low) * self.next_float()


def round3(val: float) -> float:
    r = round(float(val), 3)
    return 0.0 if abs(r) < 1e-9 else r


def round_pos(pos: list[float]) -> list[float]:
    return [round3(pos[0]), round3(pos[1]), round3(pos[2])]


def dist_xz(a: list[float], b: list[float]) -> float:
    return math.hypot(float(a[0]) - float(b[0]), float(a[2]) - float(b[2]))


def is_num(val: Any) -> bool:
    return isinstance(val, (int, float)) and not isinstance(val, bool) and math.isfinite(float(val))


def validate_vec3(val: Any, name: str) -> list[float]:
    if not isinstance(val, list) or len(val) != 3 or not all(is_num(x) for x in val):
        raise ContractFormatError(f"Invalid 3D position for {name}: {val!r}")
    return [float(val[0]), float(val[1]), float(val[2])]


def load_contract(contract_path: str | pathlib.Path | None = None) -> dict[str, Any]:
    if contract_path is None:
        contract_path = pathlib.Path(__file__).resolve().parent.parent / "game.contract.json"
    path = pathlib.Path(contract_path)
    return json.loads(path.read_text(encoding="utf-8"))


def parse_inputs_data(data: Any) -> dict[int, dict[str, Any]]:
    if not isinstance(data, dict) or "frames" not in data or not isinstance(data["frames"], list):
        raise ContractFormatError("Inputs JSON must be an object containing a 'frames' list.")

    frames_by_tick: dict[int, dict[str, Any]] = {}
    last_tick = -1
    allowed_bool_keys = ("jump", "interact", "pulse", "dash")

    for idx, frame in enumerate(data["frames"]):
        if not isinstance(frame, dict) or "tick" not in frame:
            raise ContractFormatError(f"Frame {idx} must be an object with 'tick'.")
        tick = frame["tick"]
        if not isinstance(tick, int) or isinstance(tick, bool) or tick < 0:
            raise ContractFormatError(f"Frame {idx} has invalid 'tick': {tick!r}")
        if tick <= last_tick:
            raise ContractFormatError(
                f"Frame ticks must be strictly increasing (got tick {tick} after {last_tick})."
            )
        last_tick = tick

        parsed_frame: dict[str, Any] = {}
        if "move" in frame:
            mv = frame["move"]
            if not isinstance(mv, list) or len(mv) != 2 or not all(is_num(v) for v in mv):
                raise ContractFormatError(f"Frame at tick {tick} has invalid 'move': {mv!r}")
            mx, mz = float(mv[0]), float(mv[1])
            if abs(mx) > 1.0 + 1e-6 or abs(mz) > 1.0 + 1e-6:
                raise ContractFormatError(
                    f"Frame at tick {tick} 'move' components must be in [-1, 1]: {mv!r}"
                )
            parsed_frame["move"] = [mx, mz]

        if "cam_yaw_deg" in frame:
            yaw = frame["cam_yaw_deg"]
            if not is_num(yaw):
                raise ContractFormatError(f"Frame at tick {tick} has invalid 'cam_yaw_deg': {yaw!r}")
            parsed_frame["cam_yaw_deg"] = float(yaw)

        for bk in allowed_bool_keys:
            if bk in frame:
                if not isinstance(frame[bk], bool):
                    raise ContractFormatError(f"Frame at tick {tick} field '{bk}' must be boolean.")
                parsed_frame[bk] = frame[bk]

        frames_by_tick[tick] = parsed_frame

    return frames_by_tick


def validate_scenario_data(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ContractFormatError("Scenario JSON must be an object.")

    if "player" in data:
        p = data["player"]
        if not isinstance(p, dict):
            raise ContractFormatError("'player' in scenario must be an object.")
        if "pos" in p:
            validate_vec3(p["pos"], "player.pos")
        if "carried" in p and (not isinstance(p["carried"], int) or isinstance(p["carried"], bool) or p["carried"] < 0):
            raise ContractFormatError("Invalid 'player.carried' in scenario.")
        if "flames" in p and (not isinstance(p["flames"], int) or isinstance(p["flames"], bool) or p["flames"] < 0):
            raise ContractFormatError("Invalid 'player.flames' in scenario.")

    for rk in ("random_motes", "random_shades"):
        if rk in data and not isinstance(data[rk], bool):
            raise ContractFormatError(f"'{rk}' in scenario must be boolean.")

    if "time_left_s" in data:
        if not is_num(data["time_left_s"]) or float(data["time_left_s"]) < 0:
            raise ContractFormatError("Invalid 'time_left_s' in scenario.")

    if "motes" in data:
        if not isinstance(data["motes"], list):
            raise ContractFormatError("'motes' in scenario must be a list.")
        for i, m in enumerate(data["motes"]):
            if isinstance(m, list):
                validate_vec3(m, f"motes[{i}]")
            elif isinstance(m, dict) and "pos" in m:
                validate_vec3(m["pos"], f"motes[{i}].pos")
            else:
                raise ContractFormatError(f"Invalid mote entry at motes[{i}]: {m!r}")

    if "shades" in data:
        if not isinstance(data["shades"], list):
            raise ContractFormatError("'shades' in scenario must be a list.")
        for i, s in enumerate(data["shades"]):
            if not isinstance(s, dict) or "pos" not in s:
                raise ContractFormatError(f"Invalid shade entry at shades[{i}]: {s!r}")
            validate_vec3(s["pos"], f"shades[{i}].pos")
            if "id" in s and not isinstance(s["id"], str):
                raise ContractFormatError(f"Invalid shade id at shades[{i}].")

    if "lanterns" in data:
        if not isinstance(data["lanterns"], list):
            raise ContractFormatError("'lanterns' in scenario must be a list.")
        for i, l in enumerate(data["lanterns"]):
            if not isinstance(l, dict) or "id" not in l or not isinstance(l["id"], str):
                raise ContractFormatError(f"Invalid lantern entry at lanterns[{i}]: {l!r}")
            if "pos" in l:
                validate_vec3(l["pos"], f"lanterns[{i}].pos")
            if "deposited" in l and (
                not isinstance(l["deposited"], int) or isinstance(l["deposited"], bool) or l["deposited"] < 0
            ):
                raise ContractFormatError(f"Invalid 'deposited' at lanterns[{i}].")
            if "lit" in l and not isinstance(l["lit"], bool):
                raise ContractFormatError(f"Invalid 'lit' at lanterns[{i}].")

    return data


def default_night1_lanterns(count: int = 5) -> list[dict[str, Any]]:
    radius = 16.0
    lanterns: list[dict[str, Any]] = []
    for i in range(count):
        angle = (2.0 * math.pi * i) / count
        x = round3(radius * math.sin(angle))
        z = round3(radius * math.cos(angle))
        lanterns.append(
            {
                "id": f"L{i + 1}",
                "pos": [x, 0.0, z],
                "lit": False,
                "deposited": 0,
            }
        )
    return lanterns


class GameSimulation:
    """Deterministic 60 tick/s simulation of Đảo Đèn Lồng (Night 1)."""

    def __init__(
        self,
        tuning: dict[str, Any],
        seed: int = 1,
        night: int = 1,
        scenario: dict[str, Any] | None = None,
    ) -> None:
        if night != 1:
            raise ValueError(f"Unsupported night: {night} (Phase 1 supports night 1).")
        self.tuning = tuning
        self.seed = int(seed)
        self.night = int(night)
        self.rng = Mulberry32(self.seed)

        self.tick = 0
        self.sim_tick = 0
        self.state = "playing"
        self.score = 0

        self.initial_duration_s = float(tuning["night1_duration_s"])
        self.time_left_s = self.initial_duration_s

        self.player: dict[str, Any] = {
            "pos": [0.0, 0.0, 0.0],
            "vy": 0.0,
            "flames": int(tuning["flames"]),
            "carried": 0,
        }
        self.invuln_timer = 0.0
        self.pulse_cooldown = 0.0

        # Persistent input state across frames
        self.input_state: dict[str, Any] = {
            "move": [0.0, 0.0],
            "cam_yaw_deg": 0.0,
            "jump": False,
            "interact": False,
            "pulse": False,
            "dash": False,
        }

        self.random_motes = True
        self.random_shades = True
        self.lanterns = default_night1_lanterns(int(tuning.get("lantern_count_night1", 5)))
        self.motes: list[dict[str, Any]] = []
        self.shades: list[dict[str, Any]] = []
        self.next_mote_seq = 1
        self.next_shade_seq = 1

        self._apply_scenario(scenario)

    def _spawn_random_mote(self, min_r: float = 3.5, max_r: float = 21.0) -> dict[str, Any]:
        angle = self.rng.uniform(0.0, 2.0 * math.pi)
        r = math.sqrt(self.rng.uniform(min_r * min_r, max_r * max_r))
        pos = [round3(r * math.sin(angle)), 0.0, round3(r * math.cos(angle))]
        mote = {"id": f"M{self.next_mote_seq}", "pos": pos}
        self.next_mote_seq += 1
        return mote

    def _spawn_random_shade(self, min_r: float = 20.0, max_r: float = 25.0) -> dict[str, Any]:
        safe_r = float(self.tuning["safe_radius"])
        pos = [0.0, 0.0, max_r]
        for _ in range(16):
            angle = self.rng.uniform(0.0, 2.0 * math.pi)
            r = self.rng.uniform(min_r, max_r)
            candidate = [round3(r * math.sin(angle)), 0.0, round3(r * math.cos(angle))]
            if dist_xz(candidate, self.player["pos"]) < 10.0:
                continue
            if any(l["lit"] and dist_xz(candidate, l["pos"]) < safe_r + 1.0 for l in self.lanterns):
                continue
            pos = candidate
            break
        shade = {
            "id": f"S{self.next_shade_seq}",
            "pos": pos,
            "state": "chase",
            "stun_timer": 0.0,
        }
        self.next_shade_seq += 1
        return shade

    def _apply_scenario(self, scenario: dict[str, Any] | None) -> None:
        if scenario is not None:
            validate_scenario_data(scenario)
        else:
            scenario = {}

        if "time_left_s" in scenario:
            self.initial_duration_s = float(scenario["time_left_s"])
            self.time_left_s = self.initial_duration_s

        if "player" in scenario:
            sp = scenario["player"]
            if "pos" in sp:
                self.player["pos"] = [float(sp["pos"][0]), float(sp["pos"][1]), float(sp["pos"][2])]
            if "carried" in sp:
                self.player["carried"] = int(sp["carried"])
            if "flames" in sp:
                self.player["flames"] = int(sp["flames"])

        if "random_motes" in scenario:
            self.random_motes = bool(scenario["random_motes"])
        if "random_shades" in scenario:
            self.random_shades = bool(scenario["random_shades"])

        # Update lanterns by ID (L1..L5)
        lantern_cost = int(self.tuning["lantern_cost"])
        if "lanterns" in scenario:
            by_id = {l["id"]: l for l in self.lanterns}
            for sl in scenario["lanterns"]:
                lid = sl["id"]
                if lid not in by_id:
                    raise ContractFormatError(f"Unknown lantern id in scenario: {lid!r}")
                target = by_id[lid]
                if "pos" in sl:
                    target["pos"] = [float(sl["pos"][0]), float(sl["pos"][1]), float(sl["pos"][2])]
                if "deposited" in sl:
                    target["deposited"] = int(sl["deposited"])
                if "lit" in sl:
                    target["lit"] = bool(sl["lit"])
                    if target["lit"] and "deposited" not in sl and target["deposited"] < lantern_cost:
                        target["deposited"] = lantern_cost
                elif target["deposited"] >= lantern_cost:
                    target["lit"] = True

        # Initialize motes
        if "motes" in scenario:
            self.motes = []
            for m in scenario["motes"]:
                if isinstance(m, list):
                    pos = [float(m[0]), float(m[1]), float(m[2])]
                    mid = f"M{self.next_mote_seq}"
                else:
                    pos = [float(m["pos"][0]), float(m["pos"][1]), float(m["pos"][2])]
                    mid = str(m.get("id", f"M{self.next_mote_seq}"))
                self.next_mote_seq += 1
                self.motes.append({"id": mid, "pos": pos})
        elif self.random_motes:
            for _ in range(22):
                self.motes.append(self._spawn_random_mote())

        # Initialize shades
        if "shades" in scenario:
            self.shades = []
            used_ids: set[str] = set()
            for s in scenario["shades"]:
                pos = [float(s["pos"][0]), float(s["pos"][1]), float(s["pos"][2])]
                if "id" in s:
                    sid = str(s["id"])
                else:
                    while f"S{self.next_shade_seq}" in used_ids:
                        self.next_shade_seq += 1
                    sid = f"S{self.next_shade_seq}"
                used_ids.add(sid)
                if sid.startswith("S") and sid[1:].isdigit():
                    self.next_shade_seq = max(self.next_shade_seq, int(sid[1:]) + 1)
                else:
                    self.next_shade_seq += 1
                self.shades.append(
                    {
                        "id": sid,
                        "pos": pos,
                        "state": str(s.get("state", "chase")),
                        "stun_timer": 0.0,
                    }
                )
        elif self.random_shades:
            for _ in range(3):
                self.shades.append(self._spawn_random_shade())

    def get_snapshot(self) -> dict[str, Any]:
        return {
            "type": "snapshot",
            "tick": self.tick,
            "sim_tick": self.sim_tick,
            "state": self.state,
            "time_left_s": round3(max(0.0, self.time_left_s)),
            "score": int(self.score),
            "player": {
                "pos": round_pos(self.player["pos"]),
                "flames": int(self.player["flames"]),
                "carried": int(self.player["carried"]),
            },
            "lanterns": [
                {
                    "id": l["id"],
                    "pos": round_pos(l["pos"]),
                    "lit": bool(l["lit"]),
                    "deposited": int(l["deposited"]),
                }
                for l in self.lanterns
            ],
            "shades": [
                {
                    "id": s["id"],
                    "pos": round_pos(s["pos"]),
                    "state": s["state"],
                }
                for s in self.shades
            ],
            "motes_active": len(self.motes),
            "motes": [{"id": m["id"], "pos": round_pos(m["pos"])} for m in self.motes],
        }

    def _enforce_safe_zones(self, pos: list[float]) -> None:
        safe_r = float(self.tuning["safe_radius"])
        if safe_r <= 0:
            return
        for l in self.lanterns:
            if not l["lit"]:
                continue
            d = dist_xz(pos, l["pos"])
            if d < safe_r:
                if d > EPS:
                    ux = (pos[0] - l["pos"][0]) / d
                    uz = (pos[2] - l["pos"][2]) / d
                else:
                    ux, uz = 0.0, 1.0
                pos[0] = l["pos"][0] + ux * safe_r
                pos[2] = l["pos"][2] + uz * safe_r

    def step(self, frame_delta: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Execute step k (reading input at tick k) and transition to tick k + 1."""
        if self.state != "playing":
            return []

        event_tick = self.tick + 1
        events: list[dict[str, Any]] = []

        # 1. Decrement cooldowns/timers
        if self.pulse_cooldown > 0.0:
            self.pulse_cooldown = max(0.0, self.pulse_cooldown - DT)
        if self.invuln_timer > 0.0:
            self.invuln_timer = max(0.0, self.invuln_timer - DT)

        # 2. Read input frame for tick k and detect rising edges (false -> true)
        prev_jump = bool(self.input_state["jump"])
        prev_interact = bool(self.input_state["interact"])
        prev_pulse = bool(self.input_state["pulse"])

        if frame_delta:
            for k, v in frame_delta.items():
                if k == "move":
                    self.input_state["move"] = [float(v[0]), float(v[1])]
                else:
                    self.input_state[k] = v

        jump_triggered = (not prev_jump) and bool(self.input_state["jump"])
        interact_triggered = (not prev_interact) and bool(self.input_state["interact"])
        pulse_triggered = (not prev_pulse) and bool(self.input_state["pulse"])

        # 3. Player movement & jump
        mx, mz = float(self.input_state["move"][0]), float(self.input_state["move"][1])
        mag = math.hypot(mx, mz)
        if mag > 1.0:
            mx /= mag
            mz /= mag

        theta = math.radians(float(self.input_state["cam_yaw_deg"]))
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        wx = mx * cos_t + mz * sin_t
        wz = -mx * sin_t + mz * cos_t

        speed = float(self.tuning["player_speed"])
        self.player["pos"][0] += wx * speed * DT
        self.player["pos"][2] += wz * speed * DT

        if jump_triggered and self.player["pos"][1] <= EPS:
            self.player["vy"] = 5.5
        if self.player["pos"][1] > 0.0 or self.player["vy"] > 0.0:
            self.player["pos"][1] += self.player["vy"] * DT
            self.player["vy"] -= 16.0 * DT
            if self.player["pos"][1] <= 0.0:
                self.player["pos"][1] = 0.0
                self.player["vy"] = 0.0

        # 4. Pickup motes
        pickup_r = float(self.tuning["pickup_radius"])
        capacity = int(self.tuning["carry_capacity"])
        per_mote = int(self.tuning["score"]["per_mote"])

        remaining_motes: list[dict[str, Any]] = []
        for m in self.motes:
            if self.player["carried"] < capacity and dist_xz(self.player["pos"], m["pos"]) <= pickup_r + EPS:
                self.player["carried"] += 1
                self.score += per_mote
                events.append(
                    {
                        "type": "event",
                        "tick": event_tick,
                        "name": "mote_picked",
                        "data": {"carried": int(self.player["carried"])},
                    }
                )
            else:
                remaining_motes.append(m)
        self.motes = remaining_motes

        if self.random_motes and len(self.motes) < 12:
            self.motes.append(self._spawn_random_mote(min_r=6.0, max_r=22.0))

        # 5. Interact (deposit into nearest unlit lantern within interact_radius)
        if interact_triggered and self.player["carried"] > 0:
            interact_r = float(self.tuning["interact_radius"])
            lantern_cost = int(self.tuning["lantern_cost"])
            candidates = [
                l
                for l in self.lanterns
                if (not l["lit"]) and dist_xz(self.player["pos"], l["pos"]) <= interact_r + EPS
            ]
            if candidates:
                candidates.sort(key=lambda l: (dist_xz(self.player["pos"], l["pos"]), l["id"]))
                target_l = candidates[0]
                need = max(0, lantern_cost - int(target_l["deposited"]))
                amount = min(int(self.player["carried"]), need)
                if amount > 0:
                    self.player["carried"] -= amount
                    target_l["deposited"] += amount
                    events.append(
                        {
                            "type": "event",
                            "tick": event_tick,
                            "name": "deposit",
                            "data": {
                                "lantern_id": target_l["id"],
                                "amount": int(amount),
                                "deposited": int(target_l["deposited"]),
                            },
                        }
                    )
                    if target_l["deposited"] >= lantern_cost and not target_l["lit"]:
                        target_l["lit"] = True
                        self.score += int(self.tuning["score"]["per_lantern"])
                        events.append(
                            {
                                "type": "event",
                                "tick": event_tick,
                                "name": "lantern_lit",
                                "data": {"lantern_id": target_l["id"]},
                            }
                        )
                        # Push any shades currently inside the newly lit lantern's safe_radius
                        for s in self.shades:
                            self._enforce_safe_zones(s["pos"])

        # 6. Pulse (Tỏa sáng)
        just_stunned_ids: set[str] = set()
        pulse_cost = int(self.tuning["pulse_cost"])
        if pulse_triggered and self.player["carried"] >= pulse_cost and self.pulse_cooldown <= EPS:
            self.player["carried"] -= pulse_cost
            self.pulse_cooldown = float(self.tuning["pulse_cooldown_s"])
            pulse_r = float(self.tuning["pulse_radius"])
            push_m = float(self.tuning["pulse_push_m"])
            stun_s = float(self.tuning["pulse_stun_s"])
            per_stun = int(self.tuning["score"]["per_stun"])

            stunned_ids: list[str] = []
            for s in self.shades:
                d = dist_xz(self.player["pos"], s["pos"])
                if d <= pulse_r + EPS:
                    s["state"] = "stunned"
                    s["stun_timer"] = stun_s
                    if d > EPS:
                        ux = (s["pos"][0] - self.player["pos"][0]) / d
                        uz = (s["pos"][2] - self.player["pos"][2]) / d
                    else:
                        ux, uz = math.sin(theta), math.cos(theta)
                    s["pos"][0] += ux * push_m
                    s["pos"][2] += uz * push_m
                    self._enforce_safe_zones(s["pos"])
                    stunned_ids.append(s["id"])
                    just_stunned_ids.add(s["id"])
                    self.score += per_stun

            events.append(
                {
                    "type": "event",
                    "tick": event_tick,
                    "name": "pulse",
                    "data": {"stunned_ids": stunned_ids},
                }
            )

        # 7. Shade AI & periodic spawning
        if self.random_shades and event_tick % 240 == 0 and len(self.shades) < 5:
            new_shade = self._spawn_random_shade()
            self.shades.append(new_shade)
            events.append(
                {
                    "type": "event",
                    "tick": event_tick,
                    "name": "shade_spawned",
                    "data": {"id": new_shade["id"]},
                }
            )

        shade_speed = float(self.tuning["shade_speed"])
        for s in self.shades:
            if s["id"] in just_stunned_ids:
                continue
            if s["state"] == "stunned":
                s["stun_timer"] = max(0.0, s["stun_timer"] - DT)
                if s["stun_timer"] <= EPS:
                    s["stun_timer"] = 0.0
                    s["state"] = "chase"
            if s["state"] != "stunned":
                d = dist_xz(self.player["pos"], s["pos"])
                step_d = shade_speed * DT
                if d > EPS:
                    move_d = min(d, step_d)
                    s["pos"][0] += ((self.player["pos"][0] - s["pos"][0]) / d) * move_d
                    s["pos"][2] += ((self.player["pos"][2] - s["pos"][2]) / d) * move_d
                self._enforce_safe_zones(s["pos"])

        # 8. Shade collision with player (player_hit)
        hit_r = float(self.tuning["shade_hit_radius"])
        safe_r = float(self.tuning["safe_radius"])
        player_in_safe_zone = any(
            l["lit"] and dist_xz(self.player["pos"], l["pos"]) <= safe_r + EPS for l in self.lanterns
        )
        if self.invuln_timer <= EPS and not player_in_safe_zone:
            for s in self.shades:
                if s["state"] == "stunned":
                    continue
                if dist_xz(self.player["pos"], s["pos"]) <= hit_r + EPS:
                    self.player["flames"] = max(0, int(self.player["flames"]) - 1)
                    drop_ratio = float(self.tuning["hit_drop_ratio"])
                    dropped = int(math.floor(self.player["carried"] * drop_ratio))
                    self.player["carried"] = max(0, int(self.player["carried"]) - dropped)
                    self.invuln_timer = float(self.tuning["invuln_s"])
                    events.append(
                        {
                            "type": "event",
                            "tick": event_tick,
                            "name": "player_hit",
                            "data": {
                                "by": "shade",
                                "flames": int(self.player["flames"]),
                                "dropped": int(dropped),
                            },
                        }
                    )
                    break

        # 9. Advance tick counter & time_left_s, then check game_over
        self.tick = event_tick
        self.sim_tick = event_tick
        self.time_left_s = self.initial_duration_s - (self.tick / float(TICK_RATE))

        if all(l["lit"] for l in self.lanterns) and len(self.lanterns) > 0:
            self.state = "won"
            per_sec = float(self.tuning["score"]["per_second_left"])
            per_flame = int(self.tuning["score"]["per_flame_left"])
            bonus = int(round(max(0.0, self.time_left_s) * per_sec)) + int(self.player["flames"]) * per_flame
            self.score += bonus
            events.append(
                {
                    "type": "event",
                    "tick": event_tick,
                    "name": "game_over",
                    "data": {"result": "won", "reason": "all_lit"},
                }
            )
        elif self.player["flames"] <= 0:
            self.state = "lost"
            events.append(
                {
                    "type": "event",
                    "tick": event_tick,
                    "name": "game_over",
                    "data": {"result": "lost", "reason": "no_flames"},
                }
            )
        elif self.time_left_s <= EPS:
            self.time_left_s = 0.0
            self.state = "lost"
            events.append(
                {
                    "type": "event",
                    "tick": event_tick,
                    "name": "game_over",
                    "data": {"result": "lost", "reason": "dawn"},
                }
            )

        return events
