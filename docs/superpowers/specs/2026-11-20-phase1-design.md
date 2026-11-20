# Phase 1 Design Doc — Đảo Đèn Lồng (PRD-0 & Test Contract v1.0)

## 1. Intent & Why
Build **Đảo Đèn Lồng — Đêm 1: Đảo Bến**, a cozy 3D third-person game where Mây collects fireflies (đom đóm) to light 5 Great Lanterns while fending off Ink Shades (Bóng Mực) with a light pulse. The architecture must guarantee **exact parity** between the 3D playable game and the automated **headless Test Contract v1.0** runner.

## 2. Approaches Considered
- **Approach A: TypeScript + Three.js (Vite) + Node.js Headless**
  - *Pros:* Great web 3D visuals, fast headless.
  - *Cons:* `node` and `npm` are not installed on the current machine, risking setup time/environment failure during the 60-minute Phase 1 window.
- **Approach B (Selected): Python 3.12 (`uv`) + Pure-Python Simulation Core + `pygame-ce` / `PyOpenGL` 3D Client**
  - *Pros:* `python3` and `uv` are already installed; headless runs in pure Python stdlib (<100ms for 10,000 ticks, zero GPU/window); `src/core/sim.py` is shared 1:1 with the 3D client; cross-platform on Linux and macOS.
  - *Cons:* 3D visuals are built with OpenGL primitives rather than Three.js PBR shaders (acceptable per PRD-0: "Đồ họa đơn giản nhưng đẹp, không cần chân thực").

## 3. Core Tuning & Assumptions (`game.contract.json`)
- **Island:** Circular island radius `25.0m` (`fall_enabled: false`, player clamped to `r <= 25.0`).
- **Player (`Mây`):** `player_speed: 6.0` m/s, `carry_capacity: 5`, `flames: 3`, `invuln_s: 1.5`, `hit_drop_ratio: 0.5` (`floor(carried * 0.5)`, dropped motes lost).
- **Lanterns (5 in Night 1):** `L1..L5` placed symmetrically at radius `15.0m`, `lantern_cost: 3`, `interact_radius: 2.5`, `safe_radius: 4.5` (active only when `lit: true`; shades are pushed/clamped outside `safe_radius`).
- **Motes (Đom đóm):** `pickup_radius: 1.8`. Not picked up if `carried >= carry_capacity`. Default Night 1 spawns 15 deterministic motes; respawns motes periodically up to 15 active if `random_motes: true`.
- **Pulse:** `pulse_cost: 1`, `pulse_radius: 5.0`, `pulse_stun_s: 2.5`, `pulse_push_m: 4.0`, `pulse_cooldown_s: 2.0`. Ignored if `carried < pulse_cost` or `cooldown > 0`.
- **Shades (Bóng Mực):** `shade_speed: 3.8` m/s, `shade_hit_radius: 1.0`. Default Night 1 starts with 2 shades and spawns more deterministically up to 5 if `random_shades: true`.
- **Time & Score:** `night1_duration_s: 180`. `score`: `per_mote: 10`, `per_lantern: 100`, `per_stun: 25`, `per_second_left: 5`, `per_flame_left: 50` (time/flame bonuses awarded only on `won`).

## 4. Tick Order (60 Hz fixed, 1 tick = 1/60s)
1. Update timers (`time_left_s`, `invuln_s`, `pulse_cooldown_s`, shade `stun_s`, spawn timers).
2. Read input frame `k`, apply `cam_yaw_deg` movement, jump Y-physics (visual/3D only), clamp to island radius.
3. Pickup motes within `pickup_radius` (if `carried < carry_capacity`) -> `mote_picked`.
4. Process `interact` (edge `false -> true`): deposit `min(carried, need)` to nearest unlit lantern within `interact_radius` -> `deposit`, and if `deposited >= lantern_cost` -> `lantern_lit`.
5. Process `pulse` (edge `false -> true`): if `carried >= pulse_cost` and `cooldown <= 0` -> stun & push shades within `pulse_radius` -> `pulse`.
6. Spawn random motes/shades (if enabled) and move active non-stunned shades toward player, respecting `safe_radius` around `lit` lanterns.
7. Check shade collision within `shade_hit_radius` (if `invuln_s <= 0` and player not inside a lit lantern's `safe_radius`) -> `player_hit`.
8. Check win (`all_lit`) first, then lose (`no_flames`, `dawn`) -> `game_over` and stop.

## 5. Creative Additions (`src/client/` only)
1. **Dynamic Cozy Lighting & Fog:** Sky/fog transitions from dark purple-black to warm indigo/amber as more lanterns are lit.
2. **Mây's Nón Lá & Hanging Lantern:** Mây wears a conical hat (`nón lá`) with a hanging lantern whose glow scales with `carried`, plus a golden expanding ring on `pulse`.
3. **Procedural Web-free Audio:** Synthesized chime/bell SFX on pickup/lantern lit and low rumble when shades are close, using Python `math` + `pygame.mixer` (zero external audio files).
4. **Micro-narrative:** Short fairy-tale intro/victory overlay on Start/Win screens.
