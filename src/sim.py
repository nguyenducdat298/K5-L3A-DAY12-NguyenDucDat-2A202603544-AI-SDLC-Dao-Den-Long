"""Pure deterministic 60Hz game simulation core for Đảo Đèn Lồng (Phase 2 - Test Contract v1.1)."""

from __future__ import annotations

import json
import math
import pathlib
from typing import Any

TICK_RATE = 60
DT = 1.0 / TICK_RATE
EPS = 1e-9

VALID_SHADE_STATES = {"spawning", "wander", "chase", "recoil", "stunned"}
VALID_DRIFTER_STATES = {"idle", "chase", "flee", "removed"}


class ContractFormatError(ValueError):
    """Raised when --inputs or --scenario file violates Test Contract v1.1 format (exit code 2)."""


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

    def randint(self, low: int, high: int) -> int:
        if high <= low:
            return low
        return low + int(math.floor(self.next_float() * (high - low + 1)))

    def shuffle(self, items: list[Any]) -> list[Any]:
        arr = list(items)
        for i in range(len(arr) - 1, 0, -1):
            j = int(math.floor(self.next_float() * (i + 1)))
            arr[i], arr[j] = arr[j], arr[i]
        return arr


def round3(val: float) -> float:
    r = round(float(val), 3)
    return 0.0 if abs(r) < 1e-9 else r


def round_pos(pos: list[float]) -> list[float]:
    return [round3(pos[0]), round3(pos[1]), round3(pos[2])]


def dist_xz(a: list[float], b: list[float]) -> float:
    return math.hypot(float(a[0]) - float(b[0]), float(a[2]) - float(b[2]))


def dist_3d(a: list[float], b: list[float]) -> float:
    return math.sqrt(
        (float(a[0]) - float(b[0])) ** 2
        + (float(a[1]) - float(b[1])) ** 2
        + (float(a[2]) - float(b[2])) ** 2
    )


def pt_polar(cx: float, cz: float, r: float, deg: float, y: float = 0.0) -> list[float]:
    """Angle measured from +X axis, counter-clockwise in XZ plane."""
    rad = math.radians(deg)
    return [round3(cx + r * math.cos(rad)), round3(y), round3(cz + r * math.sin(rad))]


def is_num(val: Any) -> bool:
    return isinstance(val, (int, float)) and not isinstance(val, bool) and math.isfinite(float(val))


def is_nonneg_int(val: Any) -> bool:
    return isinstance(val, int) and not isinstance(val, bool) and val >= 0


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
    allowed_bool_keys = ("jump", "interact", "pulse", "dash", "pause")

    for idx, frame in enumerate(data["frames"]):
        if not isinstance(frame, dict) or "tick" not in frame:
            raise ContractFormatError(f"Frame {idx} must be an object with 'tick'.")
        tick = frame["tick"]
        if not is_nonneg_int(tick):
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
        if "vel" in p:
            validate_vec3(p["vel"], "player.vel")
        for int_key in ("carried", "flames", "invuln_ticks", "dash_cd_ticks", "pulse_cd_ticks", "charm_ticks"):
            if int_key in p and not is_nonneg_int(p[int_key]):
                raise ContractFormatError(f"Invalid 'player.{int_key}' in scenario.")

    for rk in ("random_motes", "random_shades", "random_drifters", "wind_enabled"):
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
            if "state" in s and s["state"] not in VALID_SHADE_STATES:
                raise ContractFormatError(f"Invalid shade state at shades[{i}]: {s['state']!r}")
            if "state_ticks_left" in s and not is_nonneg_int(s["state_ticks_left"]):
                raise ContractFormatError(f"Invalid state_ticks_left at shades[{i}].")

    if "lanterns" in data:
        if not isinstance(data["lanterns"], list):
            raise ContractFormatError("'lanterns' in scenario must be a list.")
        for i, l in enumerate(data["lanterns"]):
            if not isinstance(l, dict) or "id" not in l or not isinstance(l["id"], str):
                raise ContractFormatError(f"Invalid lantern entry at lanterns[{i}]: {l!r}")
            if "pos" in l:
                validate_vec3(l["pos"], f"lanterns[{i}].pos")
            if "deposited" in l and not is_nonneg_int(l["deposited"]):
                raise ContractFormatError(f"Invalid 'deposited' at lanterns[{i}].")
            if "lit" in l and not isinstance(l["lit"], bool):
                raise ContractFormatError(f"Invalid 'lit' at lanterns[{i}].")

    if "drifters" in data:
        if not isinstance(data["drifters"], list):
            raise ContractFormatError("'drifters' in scenario must be a list.")
        for i, d in enumerate(data["drifters"]):
            if not isinstance(d, dict) or "pos" not in d:
                raise ContractFormatError(f"Invalid drifter entry at drifters[{i}]: {d!r}")
            validate_vec3(d["pos"], f"drifters[{i}].pos")
            if "state" in d and d["state"] not in VALID_DRIFTER_STATES:
                raise ContractFormatError(f"Invalid drifter state at drifters[{i}]: {d['state']!r}")

    if "charms" in data:
        if not isinstance(data["charms"], list):
            raise ContractFormatError("'charms' in scenario must be a list.")
        for i, c in enumerate(data["charms"]):
            if not isinstance(c, dict):
                raise ContractFormatError(f"Invalid charm entry at charms[{i}]: {c!r}")
            if "pos" in c:
                validate_vec3(c["pos"], f"charms[{i}].pos")

    return data


# --- Canonical Map Definitions (TICKET-02 Part 2) ---

def build_night_map_config(night: int) -> dict[str, Any]:
    if night == 1:
        # Đêm 1 — Đảo Bến
        lantern_coords = [
            (0.0, 0.0, 25.0),
            (23.8, 0.0, 7.7),
            (14.7, 0.0, -20.2),
            (-14.7, 0.0, -20.2),
            (-23.8, 0.0, 7.7),
        ]
        mote_points: list[list[float]] = []
        for i in range(8):
            mote_points.append(pt_polar(0.0, 0.0, 12.0, i * 45.0))
        for i in range(16):
            mote_points.append(pt_polar(0.0, 0.0, 33.0, i * 22.5))

        shade_points = [pt_polar(0.0, 0.0, 37.0, 15.0 + i * 30.0) for i in range(12)]
        return {
            "duration_s": 300.0,
            "shade_speed": 4.0,
            "shade_interval_ticks": 480,
            "shade_max": 6,
            "lanterns": [
                {"id": f"L{i + 1}", "pos": [x, y, z], "lit": False, "deposited": 0}
                for i, (x, y, z) in enumerate(lantern_coords)
            ],
            "mote_points": mote_points,
            "shade_points": shade_points,
            "charms": [],
            "jump_pads": [],
        }

    if night == 2:
        # Đêm 2 — Đảo Cau
        lantern_coords = [
            (0.0, 0.0, 20.0),
            (17.0, 0.0, -10.0),
            (-17.0, 0.0, -10.0),
            (70.0, 0.0, 20.0),
            (87.0, 0.0, -10.0),
            (53.0, 0.0, -10.0),
        ]
        mote_points = []
        shade_points = []
        for cx, cz in ((0.0, 0.0), (70.0, 0.0)):
            for i in range(4):
                mote_points.append(pt_polar(cx, cz, 10.0, i * 90.0))
            for i in range(8):
                mote_points.append(pt_polar(cx, cz, 22.0, i * 45.0))
            for i in range(8):
                shade_points.append(pt_polar(cx, cz, 26.0, 22.5 + i * 45.0))
        return {
            "duration_s": 330.0,
            "shade_speed": 4.0,
            "shade_interval_ticks": 420,
            "shade_max": 8,
            "lanterns": [
                {"id": f"L{i + 1}", "pos": [x, y, z], "lit": False, "deposited": 0}
                for i, (x, y, z) in enumerate(lantern_coords)
            ],
            "mote_points": mote_points,
            "shade_points": shade_points,
            "charms": [
                {"id": "C1", "pos": [35.0, 0.0, 0.0], "available": True, "respawn_ticks": 0}
            ],
            "jump_pads": [
                {"pos": [20.0, 0.0, 18.0], "radius": 1.0, "vy": 14.0, "h_speed": 24.0, "target": [70.0, 0.0, 0.0]},
                {"pos": [50.0, 0.0, -18.0], "radius": 1.0, "vy": 14.0, "h_speed": 24.0, "target": [0.0, 0.0, 0.0]},
            ],
        }

    if night == 3:
        # Đêm 3 — Đảo Chuông
        lantern_coords = [
            (0.0, 6.0, 6.0),
            (18.0, 3.0, 10.0),
            (-18.0, 3.0, 10.0),
            (35.0, 0.0, -10.0),
            (-35.0, 0.0, -10.0),
            (20.0, 0.0, -35.0),
            (-20.0, 0.0, -35.0),
        ]
        mote_points = []
        for i in range(18):
            mote_points.append(pt_polar(0.0, 0.0, 34.0, i * 20.0, y=0.0))
        for deg in (20.0, 40.0, 60.0, 80.0, 100.0, 120.0, 140.0, 160.0):
            mote_points.append(pt_polar(0.0, 0.0, 18.0, deg, y=3.0))
        for deg in (45.0, 135.0, 225.0, 315.0):
            mote_points.append(pt_polar(0.0, 0.0, 5.0, deg, y=6.0))

        shade_points = [pt_polar(0.0, 0.0, 43.0, i * 22.5, y=0.0) for i in range(16)]
        return {
            "duration_s": 360.0,
            "shade_speed": 4.5,
            "shade_interval_ticks": 360,
            "shade_max": 10,
            "lanterns": [
                {"id": f"L{i + 1}", "pos": [x, y, z], "lit": False, "deposited": 0}
                for i, (x, y, z) in enumerate(lantern_coords)
            ],
            "mote_points": mote_points,
            "shade_points": shade_points,
            "charms": [
                {"id": "C1", "pos": [30.0, 0.0, 25.0], "available": True, "respawn_ticks": 0},
                {"id": "C2", "pos": [-30.0, 0.0, 25.0], "available": True, "respawn_ticks": 0},
            ],
            "jump_pads": [
                {"pos": [0.0, 3.0, 13.0], "radius": 1.0, "vy": 12.0, "vel_xz": [0.0, -8.0]},
            ],
        }

    raise ValueError(f"Unsupported night: {night} (must be 1, 2, or 3).")


class GameSimulation:
    """Deterministic 60 tick/s simulation of Đảo Đèn Lồng (Contract v1.1 - Nights 1, 2, 3)."""

    def __init__(
        self,
        tuning: dict[str, Any],
        seed: int = 1,
        night: int = 1,
        scenario: dict[str, Any] | None = None,
    ) -> None:
        if night not in (1, 2, 3):
            raise ValueError(f"Unsupported night: {night} (Contract v1.1 supports 1, 2, 3).")
        self.tuning = tuning
        self.seed = int(seed)
        self.night = int(night)
        self.rng = Mulberry32(self.seed)

        self.map_cfg = build_night_map_config(self.night)

        self.tick = 0
        self.sim_tick = 0
        self.state = "playing"
        self.score = 0

        dur_key = f"night{self.night}_duration_s"
        self.initial_duration_s = float(tuning.get(dur_key, self.map_cfg["duration_s"]))
        self.time_left_s = self.initial_duration_s

        self.player: dict[str, Any] = {
            "pos": [0.0, 0.0, 0.0],
            "vel": [0.0, 0.0, 0.0],
            "flames": int(tuning.get("flames", 3)),
            "carried": 0,
            "grounded": True,
            "facing_dir": [0.0, 1.0],  # +Z
        }

        self.invuln_ticks = 0
        self.dash_cd_ticks = 0
        self.dash_active_ticks = 0
        self.dash_dir = [0.0, 1.0]
        self.pulse_cd_ticks = 0
        self.charm_ticks = 0
        self.fall_wait_ticks = 0
        self.jumppad_flight = False
        self.jumppad_vel_xz = [0.0, 0.0]

        self.wind_enabled = self.night == 3
        self.wind_active = False
        self.wind_dir_deg = 0.0
        self.wind_ticks_left = 0

        self.input_state: dict[str, Any] = {
            "move": [0.0, 0.0],
            "cam_yaw_deg": 0.0,
            "jump": False,
            "interact": False,
            "pulse": False,
            "dash": False,
            "pause": False,
        }

        self.random_motes = True
        self.random_shades = True
        self.random_drifters = self.night in (2, 3)

        self.lanterns: list[dict[str, Any]] = [dict(l, pos=list(l["pos"])) for l in self.map_cfg["lanterns"]]
        self.motes: list[dict[str, Any]] = []
        self.shades: list[dict[str, Any]] = []
        self.drifters: list[dict[str, Any]] = []
        self.charms: list[dict[str, Any]] = [dict(c, pos=list(c["pos"])) for c in self.map_cfg["charms"]]

        self.next_mote_seq = 1
        self.next_shade_seq = 1
        self.next_drifter_seq = 1

        self._apply_scenario(scenario)

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
            if "vel" in sp:
                self.player["vel"] = [float(sp["vel"][0]), float(sp["vel"][1]), float(sp["vel"][2])]
            if "carried" in sp:
                self.player["carried"] = int(sp["carried"])
            if "flames" in sp:
                self.player["flames"] = int(sp["flames"])
            if "grounded" in sp:
                self.player["grounded"] = bool(sp["grounded"])
            if "invuln_ticks" in sp:
                self.invuln_ticks = int(sp["invuln_ticks"])
            if "dash_cd_ticks" in sp:
                self.dash_cd_ticks = int(sp["dash_cd_ticks"])
            if "pulse_cd_ticks" in sp:
                self.pulse_cd_ticks = int(sp["pulse_cd_ticks"])
            if "charm_ticks" in sp:
                self.charm_ticks = int(sp["charm_ticks"])

        if "random_motes" in scenario:
            self.random_motes = bool(scenario["random_motes"])
        if "random_shades" in scenario:
            self.random_shades = bool(scenario["random_shades"])
        if "random_drifters" in scenario:
            self.random_drifters = bool(scenario["random_drifters"])
        if "wind_enabled" in scenario:
            self.wind_enabled = bool(scenario["wind_enabled"])
        if "wind" in scenario and isinstance(scenario["wind"], dict):
            self.wind_active = bool(scenario["wind"].get("active", False))
            self.wind_dir_deg = float(scenario["wind"].get("dir_deg", 0.0))
            if self.wind_active:
                self.wind_ticks_left = int(scenario["wind"].get("ticks_left", 300))

        # Update lanterns by ID
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

        # Initialize motes (20 initial motes at 20 distinct spawn points when random_motes=True)
        if "motes" in scenario:
            self.motes = []
            for m in scenario["motes"]:
                if isinstance(m, list):
                    pos = [float(m[0]), float(m[1]), float(m[2])]
                    mid = f"M{self.next_mote_seq}"
                    kind = "random"
                    ttl_ticks = None
                else:
                    pos = [float(m["pos"][0]), float(m["pos"][1]), float(m["pos"][2])]
                    mid = str(m.get("id", f"M{self.next_mote_seq}"))
                    kind = str(m.get("kind", "random"))
                    if "ttl_ticks" in m and m["ttl_ticks"] is not None:
                        ttl_ticks = int(m["ttl_ticks"])
                    elif "ttl_s" in m and m["ttl_s"] is not None:
                        ttl_ticks = int(round(float(m["ttl_s"]) * TICK_RATE))
                    else:
                        ttl_ticks = 480 if kind == "dropped" else None
                self.next_mote_seq += 1
                self.motes.append({"id": mid, "pos": pos, "kind": kind, "ttl_ticks": ttl_ticks})
        elif self.random_motes:
            pts = self.rng.shuffle(self.map_cfg["mote_points"])
            for pt in pts[:20]:
                self.motes.append(
                    {
                        "id": f"M{self.next_mote_seq}",
                        "pos": list(pt),
                        "kind": "random",
                        "ttl_ticks": None,
                    }
                )
                self.next_mote_seq += 1

        # Initialize shades (default empty at tick 0; 2 spawn at tick 300 if random_shades=True)
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

                default_state = "chase" if dist_xz(pos, self.player["pos"]) <= 12.0 + EPS else "wander"
                st = str(s.get("state", default_state))
                ticks_left = int(s.get("state_ticks_left", 120 if st == "stunned" else (60 if st == "recoil" else 0)))
                self.shades.append(
                    {
                        "id": sid,
                        "pos": pos,
                        "anchor": list(pos),
                        "state": st,
                        "state_ticks_left": ticks_left,
                        "push_ticks_left": 0,
                        "push_dir": [1.0, 0.0],
                        "recoil_dir": [0.0, 1.0],
                        "pushout_lantern_id": None,
                        "pushout_ticks_left": 0,
                    }
                )

        # Initialize drifters
        if "drifters" in scenario:
            self.drifters = []
            for d in scenario["drifters"]:
                pos = [float(d["pos"][0]), float(d["pos"][1]), float(d["pos"][2])]
                did = str(d.get("id", f"D{self.next_drifter_seq}"))
                if did.startswith("D") and did[1:].isdigit():
                    self.next_drifter_seq = max(self.next_drifter_seq, int(did[1:]) + 1)
                else:
                    self.next_drifter_seq += 1
                st = str(d.get("state", "idle"))
                stolen = int(d.get("stolen", 0))
                flee_ticks = int(d.get("state_ticks_left", 240 if st == "flee" else 0))
                self.drifters.append(
                    {
                        "id": did,
                        "pos": pos,
                        "state": st,
                        "stolen": stolen,
                        "has_stolen": stolen > 0,
                        "flee_ticks_left": flee_ticks,
                        "orbit_angle": 0.0,
                    }
                )

        # Initialize charms
        if "charms" in scenario:
            self.charms = []
            default_charm_pos = {c["id"]: c["pos"] for c in self.map_cfg["charms"]}
            for idx, c in enumerate(scenario["charms"]):
                cid = str(c.get("id", f"C{idx + 1}"))
                pos = (
                    [float(c["pos"][0]), float(c["pos"][1]), float(c["pos"][2])]
                    if "pos" in c
                    else list(default_charm_pos.get(cid, [35.0, 0.0, 0.0]))
                )
                avail = bool(c.get("available", True))
                if "respawn_ticks" in c:
                    rt = int(c["respawn_ticks"])
                elif "respawn_s" in c:
                    rt = int(round(float(c["respawn_s"]) * TICK_RATE))
                else:
                    rt = 0 if avail else 2700
                self.charms.append({"id": cid, "pos": pos, "available": avail, "respawn_ticks": rt})

    def get_snapshot(self) -> dict[str, Any]:
        return {
            "type": "snapshot",
            "tick": self.tick,
            "sim_tick": self.sim_tick,
            "night": self.night,
            "state": self.state,
            "time_left_s": round3(max(0.0, self.time_left_s)),
            "score": int(self.score),
            "wind": {
                "active": bool(self.wind_active),
                "dir_deg": round3(self.wind_dir_deg),
            },
            "player": {
                "pos": round_pos(self.player["pos"]),
                "vel": round_pos(self.player["vel"]),
                "flames": int(self.player["flames"]),
                "carried": int(self.player["carried"]),
                "grounded": bool(self.player["grounded"]),
                "invuln": bool(self.invuln_ticks > 0),
                "dash_cd_s": round3(self.dash_cd_ticks / float(TICK_RATE)),
                "pulse_cd_s": round3(self.pulse_cd_ticks / float(TICK_RATE)),
                "charm_s": round3(self.charm_ticks / float(TICK_RATE)),
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
            "motes": [
                {
                    "id": m["id"],
                    "pos": round_pos(m["pos"]),
                    "kind": m["kind"],
                    "ttl_s": round3(m["ttl_ticks"] / float(TICK_RATE)) if m["ttl_ticks"] is not None else None,
                }
                for m in self.motes
            ],
            "drifters": [
                {
                    "id": d["id"],
                    "pos": round_pos(d["pos"]),
                    "state": d["state"],
                    "stolen": int(d["stolen"]),
                }
                for d in self.drifters
                if d["state"] != "removed"
            ],
            "charms": [
                {
                    "id": c["id"],
                    "pos": round_pos(c["pos"]),
                    "available": bool(c["available"]),
                    "respawn_s": round3(c["respawn_ticks"] / float(TICK_RATE)),
                }
                for c in self.charms
            ],
        }

    # --- Map Terrain & Obstacle Helpers ---

    def _compute_floor_height(self, x: float, z: float, old_y: float) -> float | None:
        if not bool(self.tuning.get("fall_enabled", True)):
            return 0.0

        if self.night == 1:
            if math.hypot(x, z) <= 40.0 + EPS:
                return 0.0
            return None

        if self.night == 2:
            if math.hypot(x, z) <= 28.0 + EPS:
                return 0.0
            if math.hypot(x - 70.0, z) <= 28.0 + EPS:
                return 0.0
            if 26.0 - EPS <= x <= 44.0 + EPS and -2.0 - EPS <= z <= 2.0 + EPS:
                return 0.0
            return None

        if self.night == 3:
            r = math.hypot(x, z)
            if r > 45.0 + EPS:
                return None

            # Tier 2: Disk R <= 8.0 at Y = 6.0
            if r <= 8.0 + EPS and old_y >= 5.75:
                return 6.0

            # 2 Ramps at 30 deg and 150 deg (width 3m, r=30 at Y=0 to r=24 at Y=3)
            for deg in (30.0, 150.0):
                rad = math.radians(deg)
                ca, sa = math.cos(rad), math.sin(rad)
                p_par = x * ca + z * sa
                p_perp = abs(-x * sa + z * ca)
                if p_perp <= 1.5 + EPS and 23.8 <= p_par <= 30.2:
                    t = max(0.0, min(1.0, (30.0 - p_par) / 6.0))
                    ramp_y = 3.0 * t
                    if old_y >= ramp_y - 0.45:
                        return ramp_y

            # Tier 1: Ring 12 <= r <= 24, z > 0 at Y = 3.0
            if 12.0 - EPS <= r <= 24.0 + EPS and z > 0.0 and old_y >= 2.75:
                return 3.0

            return 0.0

        return 0.0

    def _enforce_bell_tower_obstacle(self, pos: list[float]) -> bool:
        """Night 3 Bell Tower at center of Tier 2 (Y >= 5.5, radius 2.0 m). Returns True if collided."""
        if self.night == 3 and pos[1] >= 5.5:
            r = math.hypot(pos[0], pos[2])
            if r < 2.0:
                if r > EPS:
                    pos[0] = (pos[0] / r) * 2.0
                    pos[2] = (pos[2] / r) * 2.0
                else:
                    pos[0], pos[2] = 2.0, 0.0
                return True
        return False

    def _enforce_safe_zones_for_shade(self, shade: dict[str, Any]) -> bool:
        """Block external shades at 6.0 m safe_radius around lit lanterns. Returns True if blocked."""
        safe_r = float(self.tuning["safe_radius"])
        if safe_r <= 0:
            return False
        blocked = False
        pos = shade["pos"]
        for l in self.lanterns:
            if not l["lit"]:
                continue
            if shade.get("pushout_lantern_id") == l["id"] and shade.get("pushout_ticks_left", 0) > 0:
                continue
            d = dist_xz(pos, l["pos"])
            if d < safe_r:
                if d > EPS:
                    ux = (pos[0] - l["pos"][0]) / d
                    uz = (pos[2] - l["pos"][2]) / d
                else:
                    ux, uz = 1.0, 0.0
                pos[0] = l["pos"][0] + ux * safe_r
                pos[2] = l["pos"][2] + uz * safe_r
                blocked = True
        return blocked

    def _spawn_dropped_motes(self, center: list[float], count: int, ring_Drop: bool = True) -> None:
        for i in range(count):
            if ring_Drop:
                angle = self.rng.uniform(0.0, 2.0 * math.pi)
                r = self.rng.uniform(1.5, 2.5)
                px = round3(center[0] + r * math.cos(angle))
                pz = round3(center[2] + r * math.sin(angle))
            else:
                angle = (2.0 * math.pi * i) / max(1, count)
                r = 0.4 if count > 1 else 0.0
                px = round3(center[0] + r * math.cos(angle))
                pz = round3(center[2] + r * math.sin(angle))
            self.motes.append(
                {
                    "id": f"M{self.next_mote_seq}",
                    "pos": [px, round3(center[1]), pz],
                    "kind": "dropped",
                    "ttl_ticks": 480,
                }
            )
            self.next_mote_seq += 1

    @staticmethod
    def _entity_sort_key(ent: dict[str, Any]) -> tuple[int, str]:
        eid = str(ent["id"])
        numPart = eid[1:]
        if numPart.isdigit():
            return (int(numPart), eid)
        return (999999, eid)

    # --- Main 12-Step Tick Execution ---

    def step(self, frame_delta: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Execute step k (reading input at tick k) and transition to tick k + 1."""
        if self.state in ("won", "lost"):
            return []

        event_tick = self.tick + 1
        events: list[dict[str, Any]] = []

        # --- STEP 1: Read input (handle pause first; if just paused, stop step here) ---
        prev_jump = bool(self.input_state["jump"])
        prev_interact = bool(self.input_state["interact"])
        prev_pulse = bool(self.input_state["pulse"])
        prev_dash = bool(self.input_state["dash"])
        prev_pause = bool(self.input_state["pause"])

        if frame_delta:
            for k, v in frame_delta.items():
                if k == "move":
                    self.input_state["move"] = [float(v[0]), float(v[1])]
                else:
                    self.input_state[k] = v

        pause_triggered = (not prev_pause) and bool(self.input_state["pause"])

        if self.state == "paused":
            if pause_triggered:
                self.state = "playing"
                events.append({"type": "event", "tick": event_tick, "name": "resumed", "data": {}})
            else:
                self.tick = event_tick
                return events
        else:
            if pause_triggered:
                self.state = "paused"
                self.tick = event_tick
                events.append({"type": "event", "tick": event_tick, "name": "paused", "data": {}})
                return events

        jump_triggered = (not prev_jump) and bool(self.input_state["jump"])
        interact_triggered = (not prev_interact) and bool(self.input_state["interact"])
        pulse_triggered = (not prev_pulse) and bool(self.input_state["pulse"])
        dash_triggered = (not prev_dash) and bool(self.input_state["dash"])

        # --- STEP 2: Decrement counters: time, cooldowns, invuln, stun, charm, dropped mote TTL, charm respawn ---
        self.tick = event_tick
        self.sim_tick += 1
        self.time_left_s = max(0.0, self.initial_duration_s - (self.sim_tick / float(TICK_RATE)))

        if self.dash_cd_ticks > 0:
            self.dash_cd_ticks -= 1
        if self.dash_active_ticks > 0:
            self.dash_active_ticks -= 1
        if self.pulse_cd_ticks > 0:
            self.pulse_cd_ticks -= 1
        if self.invuln_ticks > 0:
            self.invuln_ticks -= 1
        if self.charm_ticks > 0:
            self.charm_ticks -= 1
            self.dash_cd_ticks = 0

        if self.fall_wait_ticks > 0:
            self.fall_wait_ticks -= 1
            if self.fall_wait_ticks == 0 and self.player["flames"] > 0:
                self.player["pos"] = [0.0, 0.0, 0.0]
                self.player["vel"] = [0.0, 0.0, 0.0]
                self.player["grounded"] = True
                self.player["facing_dir"] = [0.0, 1.0]
                self.invuln_ticks = 90

        for s in self.shades:
            if s["state"] in ("stunned", "recoil", "spawning") and s["state_ticks_left"] > 0:
                s["state_ticks_left"] -= 1
                if s["state_ticks_left"] == 0:
                    d_to_p = dist_xz(self.player["pos"], s["pos"])
                    s["state"] = "chase" if d_to_p <= 12.0 + EPS else "wander"

        kept_motes: list[dict[str, Any]] = []
        for m in self.motes:
            if m["ttl_ticks"] is not None:
                m["ttl_ticks"] -= 1
                if m["ttl_ticks"] <= 0:
                    continue
            kept_motes.append(m)
        self.motes = kept_motes

        for c in self.charms:
            if not c["available"] and c["respawn_ticks"] > 0:
                c["respawn_ticks"] -= 1
                if c["respawn_ticks"] == 0:
                    c["available"] = True

        # Night 3 Strong Wind cycle (every 30s = 1800 ticks, lasts 5s = 300 ticks)
        if self.wind_enabled:
            if self.wind_ticks_left > 0:
                self.wind_ticks_left -= 1
                if self.wind_ticks_left == 0:
                    self.wind_active = False
            if self.sim_tick > 0 and self.sim_tick % 1800 == 0:
                self.wind_active = True
                self.wind_ticks_left = 300
                self.wind_dir_deg = round3(self.rng.uniform(0.0, 360.0))

        # --- STEP 3: Move Mây (jump, dash, jump pad, wind) and check fall off island ---
        mx, mz = float(self.input_state["move"][0]), float(self.input_state["move"][1])
        mag = math.hypot(mx, mz)
        if mag > 1.0:
            mx /= mag
            mz /= mag

        theta = math.radians(float(self.input_state["cam_yaw_deg"]))
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        wx = mx * cos_t + mz * sin_t
        wz = -mx * sin_t + mz * cos_t
        w_mag = math.hypot(wx, wz)
        if w_mag > 1e-6:
            self.player["facing_dir"] = [wx / w_mag, wz / w_mag]

        if self.fall_wait_ticks == 0:
            # Dash trigger
            can_dash = (self.dash_active_ticks == 0) and (self.dash_cd_ticks == 0 or self.charm_ticks > 0)
            if dash_triggered and can_dash:
                self.dash_active_ticks = int(round(float(self.tuning.get("dash_duration_s", 0.2)) * TICK_RATE))
                self.dash_cd_ticks = (
                    0
                    if self.charm_ticks > 0
                    else int(round(float(self.tuning.get("dash_cooldown_s", 1.5)) * TICK_RATE))
                )
                if w_mag > 1e-6:
                    self.dash_dir = [wx / w_mag, wz / w_mag]
                else:
                    self.dash_dir = list(self.player["facing_dir"])
                self.jumppad_flight = False
                events.append({"type": "event", "tick": event_tick, "name": "dash", "data": {}})

            # Jump trigger
            if jump_triggered and self.player["grounded"] and self.dash_active_ticks == 0:
                self.player["vel"][1] = 7.0
                self.player["grounded"] = False

            # Compute horizontal & vertical velocity
            if self.dash_active_ticks > 0:
                dash_spd = float(self.tuning.get("dash_speed", 14.0))
                self.player["vel"][0] = self.dash_dir[0] * dash_spd
                self.player["vel"][2] = self.dash_dir[1] * dash_spd
                # Airborne dash preserves height
                self.player["vel"][1] = 0.0
            elif self.jumppad_flight:
                self.player["vel"][0] = self.jumppad_vel_xz[0]
                self.player["vel"][2] = self.jumppad_vel_xz[1]
                self.player["vel"][1] -= 20.0 * DT
            else:
                run_spd = 7.2 if self.charm_ticks > 0 else float(self.tuning["player_speed"])
                self.player["vel"][0] = wx * run_spd
                self.player["vel"][2] = wz * run_spd
                if not self.player["grounded"]:
                    self.player["vel"][1] -= 20.0 * DT
                else:
                    self.player["vel"][1] = 0.0

            if self.wind_active:
                wrad = math.radians(self.wind_dir_deg)
                self.player["vel"][0] += 2.0 * math.cos(wrad)
                self.player["vel"][2] += 2.0 * math.sin(wrad)

            old_y = self.player["pos"][1]
            self.player["pos"][0] += self.player["vel"][0] * DT
            self.player["pos"][1] += self.player["vel"][1] * DT
            self.player["pos"][2] += self.player["vel"][2] * DT

            self._enforce_bell_tower_obstacle(self.player["pos"])

            floor_y = self._compute_floor_height(self.player["pos"][0], self.player["pos"][2], old_y)
            if floor_y is not None:
                if self.player["pos"][1] <= floor_y + 1e-6 and self.player["vel"][1] <= 0.0 and old_y >= floor_y - 0.5:
                    self.player["pos"][1] = floor_y
                    self.player["vel"][1] = 0.0
                    self.player["grounded"] = True
                    self.jumppad_flight = False
                elif self.player["pos"][1] > floor_y + 1e-6:
                    self.player["grounded"] = False
            else:
                self.player["grounded"] = False

            # Jump pads check
            for pad in self.map_cfg["jump_pads"]:
                if (
                    dist_xz(self.player["pos"], pad["pos"]) <= pad["radius"] + EPS
                    and abs(self.player["pos"][1] - pad["pos"][1]) <= 0.35
                ):
                    self.player["pos"][1] = pad["pos"][1]
                    self.player["vel"][1] = float(pad["vy"])
                    if "vel_xz" in pad:
                        self.jumppad_vel_xz = [float(pad["vel_xz"][0]), float(pad["vel_xz"][1])]
                    else:
                        tx, tz = float(pad["target"][0]), float(pad["target"][2])
                        dx = tx - self.player["pos"][0]
                        dz = tz - self.player["pos"][2]
                        d = math.hypot(dx, dz)
                        h_spd = float(pad["h_speed"])
                        self.jumppad_vel_xz = [(dx / d) * h_spd, (dz / d) * h_spd] if d > EPS else [h_spd, 0.0]
                    self.player["vel"][0] = self.jumppad_vel_xz[0]
                    self.player["vel"][2] = self.jumppad_vel_xz[1]
                    self.player["grounded"] = False
                    self.jumppad_flight = True
                    self.dash_active_ticks = 0
                    break

            # Fall off island check (Y < -10)
            if self.player["pos"][1] < -10.0:
                lost_motes = int(self.player["carried"])
                self.player["carried"] = 0
                self.player["flames"] = max(0, int(self.player["flames"]) - 1)
                self.player["vel"] = [0.0, 0.0, 0.0]
                self.dash_active_ticks = 0
                self.jumppad_flight = False
                events.append(
                    {
                        "type": "event",
                        "tick": event_tick,
                        "name": "player_hit",
                        "data": {
                            "by": "fall",
                            "flames": int(self.player["flames"]),
                            "dropped": 0,
                            "lost": lost_motes,
                        },
                    }
                )
                if self.player["flames"] > 0:
                    self.fall_wait_ticks = 60

        # --- STEP 4: Pickup motes and charms (XZ <= 1.0 m, |dY| <= 1.5 m) ---
        if self.fall_wait_ticks == 0:
            pickup_r = float(self.tuning["pickup_radius"])
            capacity = int(self.tuning["carry_capacity"])
            rem_motes: list[dict[str, Any]] = []
            for m in self.motes:
                if (
                    self.player["carried"] < capacity
                    and dist_xz(self.player["pos"], m["pos"]) <= pickup_r + EPS
                    and abs(self.player["pos"][1] - m["pos"][1]) <= 1.5 + EPS
                ):
                    self.player["carried"] += 1
                    events.append(
                        {
                            "type": "event",
                            "tick": event_tick,
                            "name": "mote_picked",
                            "data": {"carried": int(self.player["carried"])},
                        }
                    )
                else:
                    rem_motes.append(m)
            self.motes = rem_motes

            for c in self.charms:
                if (
                    c["available"]
                    and dist_xz(self.player["pos"], c["pos"]) <= pickup_r + EPS
                    and abs(self.player["pos"][1] - c["pos"][1]) <= 1.5 + EPS
                ):
                    c["available"] = False
                    c["respawn_ticks"] = 2700
                    self.charm_ticks = 600
                    self.dash_cd_ticks = 0
                    events.append(
                        {
                            "type": "event",
                            "tick": event_tick,
                            "name": "charm_picked",
                            "data": {"charm_id": c["id"], "charm_ticks": 600},
                        }
                    )

        # --- STEP 5: Interact with lantern (deposit & lantern_lit) ---
        if self.fall_wait_ticks == 0 and interact_triggered and self.player["carried"] > 0:
            interact_r = float(self.tuning["interact_radius"])
            lantern_cost = int(self.tuning["lantern_cost"])
            per_mote_score = int(self.tuning["score"]["per_mote"])
            candidates = [
                l
                for l in self.lanterns
                if (not l["lit"])
                and dist_xz(self.player["pos"], l["pos"]) <= interact_r + EPS
                and abs(self.player["pos"][1] - l["pos"][1]) <= 2.0 + EPS
            ]
            if candidates:
                candidates.sort(key=lambda l: (dist_xz(self.player["pos"], l["pos"]), l["id"]))
                target_l = candidates[0]
                need = max(0, lantern_cost - int(target_l["deposited"]))
                amount = min(int(self.player["carried"]), need)
                if amount > 0:
                    self.player["carried"] -= amount
                    target_l["deposited"] += amount
                    self.score += amount * per_mote_score
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
                        safe_r = float(self.tuning["safe_radius"])
                        for s in self.shades:
                            if dist_xz(s["pos"], target_l["pos"]) < safe_r:
                                s["pushout_lantern_id"] = target_l["id"]
                                s["pushout_ticks_left"] = 30

        # --- STEP 6: Update safe zones (push shades inside newly lit lantern out within <= 30 ticks) ---
        safe_r = float(self.tuning["safe_radius"])
        lantern_by_id = {l["id"]: l for l in self.lanterns}
        for s in self.shades:
            plid = s.get("pushout_lantern_id")
            if plid and s.get("pushout_ticks_left", 0) > 0:
                l = lantern_by_id.get(plid)
                if l and l["lit"]:
                    d = dist_xz(s["pos"], l["pos"])
                    rem_t = int(s["pushout_ticks_left"])
                    if d < safe_r:
                        step_out = (safe_r - d) / float(max(1, rem_t))
                        ux = (s["pos"][0] - l["pos"][0]) / d if d > EPS else 1.0
                        uz = (s["pos"][2] - l["pos"][2]) / d if d > EPS else 0.0
                        s["pos"][0] += ux * step_out
                        s["pos"][2] += uz * step_out
                    s["pushout_ticks_left"] = rem_t - 1
                    if s["pushout_ticks_left"] <= 0 or dist_xz(s["pos"], l["pos"]) >= safe_r - 1e-5:
                        s["pushout_lantern_id"] = None
                        s["pushout_ticks_left"] = 0
                else:
                    s["pushout_lantern_id"] = None
                    s["pushout_ticks_left"] = 0
            self._enforce_safe_zones_for_shade(s)

        # --- STEP 7: Tỏa Sáng (Pulse) ---
        pulse_cost = int(self.tuning["pulse_cost"])
        if (
            self.fall_wait_ticks == 0
            and pulse_triggered
            and self.player["carried"] >= pulse_cost
            and self.pulse_cd_ticks == 0
        ):
            self.player["carried"] -= pulse_cost
            self.pulse_cd_ticks = int(round(float(self.tuning["pulse_cooldown_s"]) * TICK_RATE))
            pulse_r = float(self.tuning["pulse_radius"])
            stun_ticks = int(round(float(self.tuning["pulse_stun_s"]) * TICK_RATE))
            per_stun_score = int(self.tuning["score"]["per_stun"])
            pulse_center = [self.player["pos"][0], self.player["pos"][1] + 0.8, self.player["pos"][2]]

            stunned_ids: list[str] = []
            for s in sorted(self.shades, key=self._entity_sort_key):
                shade_center = [s["pos"][0], s["pos"][1] + 0.8, s["pos"][2]]
                if dist_3d(pulse_center, shade_center) <= pulse_r + EPS or dist_3d(pulse_center, s["pos"]) <= pulse_r + EPS:
                    s["state"] = "stunned"
                    s["state_ticks_left"] = stun_ticks
                    d_xz = dist_xz(self.player["pos"], s["pos"])
                    if d_xz > EPS:
                        ux = (s["pos"][0] - self.player["pos"][0]) / d_xz
                        uz = (s["pos"][2] - self.player["pos"][2]) / d_xz
                    else:
                        ux, uz = 1.0, 0.0  # Duplicate position pushes along +X
                    s["push_ticks_left"] = 15
                    s["push_dir"] = [ux, uz]
                    stunned_ids.append(s["id"])
                    self.score += per_stun_score

            # Pulse vs Drifters
            for d in sorted(self.drifters, key=self._entity_sort_key):
                if d["state"] == "removed":
                    continue
                d_center = [d["pos"][0], d["pos"][1] + 0.8, d["pos"][2]]
                if dist_3d(pulse_center, d_center) <= pulse_r + EPS or dist_xz(self.player["pos"], d["pos"]) <= pulse_r + EPS:
                    if d["state"] == "chase":
                        d["state"] = "flee"
                        d["flee_ticks_left"] = 240
                    elif d["state"] == "flee" and d["stolen"] > 0:
                        amt = int(d["stolen"])
                        d["stolen"] = 0
                        d["flee_ticks_left"] = 120
                        self._spawn_dropped_motes(d["pos"], amt, ring_Drop=False)
                        events.append(
                            {
                                "type": "event",
                                "tick": event_tick,
                                "name": "drifter_drop",
                                "data": {"drifter_id": d["id"], "amount": amt},
                            }
                        )

            events.append(
                {
                    "type": "event",
                    "tick": event_tick,
                    "name": "pulse",
                    "data": {"stunned_ids": stunned_ids},
                }
            )

        # --- STEP 8: Move Shades and Drifters ---
        shade_speed = float(self.map_cfg["shade_speed"])
        for s in self.shades:
            if s.get("push_ticks_left", 0) > 0:
                step_push = float(self.tuning["pulse_push_m"]) / 15.0
                s["pos"][0] += s["push_dir"][0] * step_push
                s["pos"][2] += s["push_dir"][1] * step_push
                s["push_ticks_left"] -= 1
                if self._enforce_bell_tower_obstacle(s["pos"]) or self._enforce_safe_zones_for_shade(s):
                    s["push_ticks_left"] = 0
                continue

            if s["state"] in ("stunned", "spawning"):
                continue

            if s["state"] == "recoil":
                step_rec = 2.0 / 60.0
                s["pos"][0] += s["recoil_dir"][0] * step_rec
                s["pos"][2] += s["recoil_dir"][1] * step_rec
                self._enforce_bell_tower_obstacle(s["pos"])
                self._enforce_safe_zones_for_shade(s)
                continue

            # wander <-> chase transitions (detect 12m, lose 18m)
            d_p = dist_xz(self.player["pos"], s["pos"])
            if s["state"] == "wander" and d_p <= 12.0 + EPS and self.fall_wait_ticks == 0:
                s["state"] = "chase"
            elif s["state"] == "chase" and (d_p > 18.0 + EPS or self.fall_wait_ticks > 0):
                s["state"] = "wander"

            if s["state"] == "chase":
                step_d = shade_speed * DT
                if d_p > EPS:
                    move_d = min(d_p, step_d)
                    s["pos"][0] += ((self.player["pos"][0] - s["pos"][0]) / d_p) * move_d
                    s["pos"][2] += ((self.player["pos"][2] - s["pos"][2]) / d_p) * move_d
                self._enforce_bell_tower_obstacle(s["pos"])
                self._enforce_safe_zones_for_shade(s)

        # Move Drifters (Gió Lạc)
        for d in self.drifters:
            if d["state"] == "removed":
                continue
            d_p = dist_xz(self.player["pos"], d["pos"])
            if d["state"] in ("idle", "chase"):
                if self.fall_wait_ticks == 0 and self.player["carried"] >= 5 and d_p <= 15.0 + EPS and not d["has_stolen"]:
                    d["state"] = "chase"
                else:
                    d["state"] = "idle"

                if d["state"] == "chase":
                    step_d = 7.0 * DT
                    if d_p > EPS:
                        move_d = min(d_p, step_d)
                        d["pos"][0] += ((self.player["pos"][0] - d["pos"][0]) / d_p) * move_d
                        d["pos"][2] += ((self.player["pos"][2] - d["pos"][2]) / d_p) * move_d
                else:
                    d["orbit_angle"] = d.get("orbit_angle", 0.0) + 1.5 * DT
                    d["pos"][0] += math.cos(d["orbit_angle"]) * 2.0 * DT
                    d["pos"][2] += math.sin(d["orbit_angle"]) * 2.0 * DT
            elif d["state"] == "flee":
                step_d = 7.0 * DT
                if d_p > EPS:
                    ux = (d["pos"][0] - self.player["pos"][0]) / d_p
                    uz = (d["pos"][2] - self.player["pos"][2]) / d_p
                else:
                    ux, uz = 1.0, 0.0
                d["pos"][0] += ux * step_d
                d["pos"][2] += uz * step_d
                d["flee_ticks_left"] -= 1
                if d["flee_ticks_left"] <= 0:
                    d["state"] = "removed"

        # --- STEP 9: Collision: Drifters steal first, then Shades hit (sorted by ID ascending) ---
        if self.fall_wait_ticks == 0:
            # 9a. Drifters steal
            for d in sorted(self.drifters, key=self._entity_sort_key):
                if d["state"] in ("flee", "removed") or d["has_stolen"]:
                    continue
                if dist_xz(self.player["pos"], d["pos"]) <= 1.2 + EPS:
                    amount = min(3, int(self.player["carried"]))
                    self.player["carried"] -= amount
                    d["stolen"] = amount
                    d["has_stolen"] = True
                    d["state"] = "flee"
                    d["flee_ticks_left"] = 240
                    events.append(
                        {
                            "type": "event",
                            "tick": event_tick,
                            "name": "drifter_steal",
                            "data": {
                                "drifter_id": d["id"],
                                "amount": int(amount),
                                "carried": int(self.player["carried"]),
                            },
                        }
                    )

            # 9b. Shades hit (max 1 flame lost per tick)
            hit_r = float(self.tuning["shade_hit_radius"])
            if self.invuln_ticks == 0:
                for s in sorted(self.shades, key=self._entity_sort_key):
                    if s["state"] in ("stunned", "recoil", "spawning"):
                        continue
                    if s.get("pushout_ticks_left", 0) > 0:
                        continue
                    if (
                        dist_xz(self.player["pos"], s["pos"]) <= hit_r + EPS
                        and abs(self.player["pos"][1] - s["pos"][1]) <= 1.5 + EPS
                    ):
                        self.player["flames"] = max(0, int(self.player["flames"]) - 1)
                        dropped = int(self.player["carried"]) // 2
                        self.player["carried"] -= dropped
                        self.invuln_ticks = 90

                        d_p = dist_xz(self.player["pos"], s["pos"])
                        if d_p > EPS:
                            rx = (s["pos"][0] - self.player["pos"][0]) / d_p
                            rz = (s["pos"][2] - self.player["pos"][2]) / d_p
                        else:
                            rx, rz = -self.player["facing_dir"][0], -self.player["facing_dir"][1]
                        s["state"] = "recoil"
                        s["state_ticks_left"] = 60
                        s["recoil_dir"] = [rx, rz]

                        if dropped > 0:
                            self._spawn_dropped_motes(self.player["pos"], dropped, ring_Drop=True)

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

        # --- STEP 10: Scheduled spawns (motes, shades, drifters — interactable from next tick) ---
        # 10a. Motes: at tick 240, 480, ... spawn 1 at an empty point if active < 30
        if self.random_motes and self.sim_tick > 0 and self.sim_tick % 240 == 0 and len(self.motes) < 30:
            empty_pts = [
                pt
                for pt in self.map_cfg["mote_points"]
                if all(dist_xz(pt, m["pos"]) > 0.3 or abs(pt[1] - m["pos"][1]) > 0.5 for m in self.motes)
            ]
            if empty_pts:
                chosen = empty_pts[self.rng.randint(0, len(empty_pts) - 1)]
                self.motes.append(
                    {
                        "id": f"M{self.next_mote_seq}",
                        "pos": list(chosen),
                        "kind": "random",
                        "ttl_ticks": None,
                    }
                )
                self.next_mote_seq += 1

        # 10b. Shades: 2 at tick 300, then 1 every interval up to max
        if self.random_shades:
            interval = int(self.map_cfg["shade_interval_ticks"])
            max_shades = int(self.map_cfg["shade_max"])
            to_spawn = 0
            if self.sim_tick == 300:
                to_spawn = 2
            elif self.sim_tick > 300 and (self.sim_tick - 300) % interval == 0:
                to_spawn = 1

            for _ in range(to_spawn):
                if len(self.shades) >= max_shades:
                    break
                valid_pts = [
                    pt
                    for pt in self.map_cfg["shade_points"]
                    if dist_xz(pt, self.player["pos"]) >= 15.0 - EPS
                    and all(dist_xz(pt, s["pos"]) > 0.5 for s in self.shades)
                    and all((not l["lit"]) or dist_xz(pt, l["pos"]) >= safe_r for l in self.lanterns)
                ]
                if not valid_pts:
                    break
                chosen = valid_pts[self.rng.randint(0, len(valid_pts) - 1)]
                sid = f"S{self.next_shade_seq}"
                self.next_shade_seq += 1
                self.shades.append(
                    {
                        "id": sid,
                        "pos": list(chosen),
                        "anchor": list(chosen),
                        "state": "spawning",
                        "state_ticks_left": 1,
                        "push_ticks_left": 0,
                        "push_dir": [1.0, 0.0],
                        "recoil_dir": [0.0, 1.0],
                        "pushout_lantern_id": None,
                        "pushout_ticks_left": 0,
                    }
                )
                events.append(
                    {
                        "type": "event",
                        "tick": event_tick,
                        "name": "shade_spawned",
                        "data": {"id": sid},
                    }
                )

        # 10c. Drifters (Night 2 & 3): at tick 1200, 2400, ... max 2 active
        if self.night in (2, 3) and self.random_drifters and self.sim_tick > 0 and self.sim_tick % 1200 == 0:
            active_drifters = [d for d in self.drifters if d["state"] != "removed"]
            if len(active_drifters) < 2 and self.map_cfg["shade_points"]:
                chosen = self.map_cfg["shade_points"][self.rng.randint(0, len(self.map_cfg["shade_points"]) - 1)]
                did = f"D{self.next_drifter_seq}"
                self.next_drifter_seq += 1
                self.drifters.append(
                    {
                        "id": did,
                        "pos": list(chosen),
                        "state": "idle",
                        "stolen": 0,
                        "has_stolen": False,
                        "flee_ticks_left": 0,
                        "orbit_angle": 0.0,
                    }
                )

        # --- STEP 11: Win / Lose check (no_flames -> all_lit -> dawn) ---
        if self.player["flames"] <= 0:
            self.state = "lost"
            events.append(
                {
                    "type": "event",
                    "tick": event_tick,
                    "name": "game_over",
                    "data": {"result": "lost", "reason": "no_flames"},
                }
            )
        elif all(l["lit"] for l in self.lanterns) and len(self.lanterns) > 0:
            self.state = "won"
            per_sec = int(self.tuning["score"]["per_second_left"])
            per_flame = int(self.tuning["score"]["per_flame_left"])
            bonus = int(math.floor(max(0.0, self.time_left_s))) * per_sec + int(self.player["flames"]) * per_flame
            self.score += bonus
            events.append(
                {
                    "type": "event",
                    "tick": event_tick,
                    "name": "game_over",
                    "data": {"result": "won", "reason": "all_lit"},
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
