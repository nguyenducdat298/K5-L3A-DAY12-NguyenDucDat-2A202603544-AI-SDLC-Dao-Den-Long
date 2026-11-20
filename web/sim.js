// Deterministic 60Hz Simulation Core in ES Module JS (synchronized 1:1 with src/sim.py & game.contract.json)

export const TICK_RATE = 60;
export const DT = 1.0 / TICK_RATE;
const EPS = 1e-9;

export class Mulberry32 {
  constructor(seed = 1) {
    this.state = seed >>> 0;
  }
  nextFloat() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    t = (t ^ (t >>> 14)) >>> 0;
    return t / 4294967296.0;
  }
  uniform(low, high) {
    return low + (high - low) * this.nextFloat();
  }
}

export function round3(v) {
  const r = Math.round(Number(v) * 1000) / 1000;
  return Math.abs(r) < 1e-9 ? 0 : r;
}

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function defaultNight1Lanterns(count = 5) {
  const radius = 16.0;
  const list = [];
  for (let i = 0; i < count; i++) {
    const angle = (2.0 * Math.PI * i) / count;
    list.push({
      id: `L${i + 1}`,
      pos: [round3(radius * Math.sin(angle)), 0.0, round3(radius * Math.cos(angle))],
      lit: false,
      deposited: 0,
    });
  }
  return list;
}

export class GameSimulationJS {
  constructor(tuning, seed = 1) {
    this.tuning = tuning;
    this.seed = seed >>> 0;
    this.rng = new Mulberry32(this.seed);

    this.tick = 0;
    this.sim_tick = 0;
    this.state = "playing";
    this.score = 0;

    this.initial_duration_s = Number(tuning.night1_duration_s);
    this.time_left_s = this.initial_duration_s;

    this.player = {
      pos: [0.0, 0.0, 0.0],
      vy: 0.0,
      flames: Number(tuning.flames),
      carried: 0,
      facingYaw: 0.0,
    };
    this.invuln_timer = 0.0;
    this.pulse_cooldown = 0.0;

    this.input_state = {
      move: [0.0, 0.0],
      cam_yaw_deg: 0.0,
      jump: false,
      interact: false,
      pulse: false,
    };

    this.lanterns = defaultNight1Lanterns(Number(tuning.lantern_count_night1 || 5));
    this.motes = [];
    this.shades = [];
    this.nextMoteSeq = 1;
    this.nextShadeSeq = 1;

    for (let i = 0; i < 22; i++) {
      this.motes.push(this._spawnRandomMote());
    }
    for (let i = 0; i < 3; i++) {
      this.shades.push(this._spawnRandomShade());
    }
  }

  _spawnRandomMote(minR = 3.5, maxR = 21.0) {
    const angle = this.rng.uniform(0, 2 * Math.PI);
    const r = Math.sqrt(this.rng.uniform(minR * minR, maxR * maxR));
    const mote = {
      id: `M${this.nextMoteSeq++}`,
      pos: [round3(r * Math.sin(angle)), 0.0, round3(r * Math.cos(angle))],
    };
    return mote;
  }

  _spawnRandomShade(minR = 20.0, maxR = 25.0) {
    const safeR = Number(this.tuning.safe_radius);
    let pos = [0.0, 0.0, maxR];
    for (let k = 0; k < 16; k++) {
      const angle = this.rng.uniform(0, 2 * Math.PI);
      const r = this.rng.uniform(minR, maxR);
      const cand = [round3(r * Math.sin(angle)), 0.0, round3(r * Math.cos(angle))];
      if (distXZ(cand, this.player.pos) < 10.0) continue;
      if (this.lanterns.some((l) => l.lit && distXZ(cand, l.pos) < safeR + 1.0)) continue;
      pos = cand;
      break;
    }
    return {
      id: `S${this.nextShadeSeq++}`,
      pos,
      state: "chase",
      stun_timer: 0.0,
    };
  }

  _enforceSafeZones(pos) {
    const safeR = Number(this.tuning.safe_radius);
    if (safeR <= 0) return;
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      const d = distXZ(pos, l.pos);
      if (d < safeR) {
        const ux = d > EPS ? (pos[0] - l.pos[0]) / d : 0.0;
        const uz = d > EPS ? (pos[2] - l.pos[2]) / d : 1.0;
        pos[0] = l.pos[0] + ux * safeR;
        pos[2] = l.pos[2] + uz * safeR;
      }
    }
  }

  step(frameDelta = null) {
    if (this.state !== "playing") return [];

    const eventTick = this.tick + 1;
    const events = [];

    if (this.pulse_cooldown > 0) this.pulse_cooldown = Math.max(0, this.pulse_cooldown - DT);
    if (this.invuln_timer > 0) this.invuln_timer = Math.max(0, this.invuln_timer - DT);

    const prevJump = Boolean(this.input_state.jump);
    const prevInteract = Boolean(this.input_state.interact);
    const prevPulse = Boolean(this.input_state.pulse);

    if (frameDelta) {
      if (frameDelta.move !== undefined) {
        this.input_state.move = [Number(frameDelta.move[0]), Number(frameDelta.move[1])];
      }
      if (frameDelta.cam_yaw_deg !== undefined) {
        this.input_state.cam_yaw_deg = Number(frameDelta.cam_yaw_deg);
      }
      if (frameDelta.jump !== undefined) this.input_state.jump = Boolean(frameDelta.jump);
      if (frameDelta.interact !== undefined) this.input_state.interact = Boolean(frameDelta.interact);
      if (frameDelta.pulse !== undefined) this.input_state.pulse = Boolean(frameDelta.pulse);
    }

    const jumpTriggered = !prevJump && Boolean(this.input_state.jump);
    const interactTriggered = !prevInteract && Boolean(this.input_state.interact);
    const pulseTriggered = !prevPulse && Boolean(this.input_state.pulse);

    let [mx, mz] = this.input_state.move;
    const mag = Math.hypot(mx, mz);
    if (mag > 1.0) {
      mx /= mag;
      mz /= mag;
    }

    const theta = (this.input_state.cam_yaw_deg * Math.PI) / 180.0;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const wx = mx * cosT + mz * sinT;
    const wz = -mx * sinT + mz * cosT;

    const speed = Number(this.tuning.player_speed);
    this.player.pos[0] += wx * speed * DT;
    this.player.pos[2] += wz * speed * DT;

    // Gentle island boundary in interactive 3D mode (island radius 26m)
    const rFromCenter = Math.hypot(this.player.pos[0], this.player.pos[2]);
    if (rFromCenter > 26.0) {
      this.player.pos[0] = (this.player.pos[0] / rFromCenter) * 26.0;
      this.player.pos[2] = (this.player.pos[2] / rFromCenter) * 26.0;
    }

    if ( Math.hypot(wx, wz) > 0.05 ) {
      this.player.facingYaw = Math.atan2(wx, wz);
    }

    if (jumpTriggered && this.player.pos[1] <= EPS) {
      this.player.vy = 5.8;
    }
    if (this.player.pos[1] > 0 || this.player.vy > 0) {
      this.player.pos[1] += this.player.vy * DT;
      this.player.vy -= 16.0 * DT;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.vy = 0;
      }
    }

    // 4. Pickup motes
    const pickupR = Number(this.tuning.pickup_radius);
    const capacity = Number(this.tuning.carry_capacity);
    const perMote = Number(this.tuning.score.per_mote);
    const rem = [];
    for (const m of this.motes) {
      if (this.player.carried < capacity && distXZ(this.player.pos, m.pos) <= pickupR + EPS) {
        this.player.carried += 1;
        this.score += perMote;
        events.push({
          type: "event",
          tick: eventTick,
          name: "mote_picked",
          data: { carried: this.player.carried, pos: [...m.pos] },
        });
      } else {
        rem.push(m);
      }
    }
    this.motes = rem;
    if (this.motes.length < 14) {
      this.motes.push(this._spawnRandomMote(6.0, 22.0));
    }

    // 5. Interact with nearest unlit lantern
    if (interactTriggered && this.player.carried > 0) {
      const interactR = Number(this.tuning.interact_radius);
      const lanternCost = Number(this.tuning.lantern_cost);
      const cands = this.lanterns
        .filter((l) => !l.lit && distXZ(this.player.pos, l.pos) <= interactR + EPS)
        .sort((a, b) => distXZ(this.player.pos, a.pos) - distXZ(this.player.pos, b.pos));
      if (cands.length > 0) {
        const target = cands[0];
        const need = Math.max(0, lanternCost - target.deposited);
        const amount = Math.min(this.player.carried, need);
        if (amount > 0) {
          this.player.carried -= amount;
          target.deposited += amount;
          events.push({
            type: "event",
            tick: eventTick,
            name: "deposit",
            data: { lantern_id: target.id, amount, deposited: target.deposited },
          });
          if (target.deposited >= lanternCost && !target.lit) {
            target.lit = true;
            this.score += Number(this.tuning.score.per_lantern);
            events.push({
              type: "event",
              tick: eventTick,
              name: "lantern_lit",
              data: { lantern_id: target.id, pos: [...target.pos] },
            });
            for (const s of this.shades) this._enforceSafeZones(s.pos);
          }
        }
      }
    }

    // 6. Pulse
    const justStunned = new Set();
    const pulseCost = Number(this.tuning.pulse_cost);
    if (pulseTriggered && this.player.carried >= pulseCost && this.pulse_cooldown <= EPS) {
      this.player.carried -= pulseCost;
      this.pulse_cooldown = Number(this.tuning.pulse_cooldown_s);
      const pulseR = Number(this.tuning.pulse_radius);
      const pushM = Number(this.tuning.pulse_push_m);
      const stunS = Number(this.tuning.pulse_stun_s);
      const perStun = Number(this.tuning.score.per_stun);
      const stunnedIds = [];

      for (const s of this.shades) {
        const d = distXZ(this.player.pos, s.pos);
        if (d <= pulseR + EPS) {
          s.state = "stunned";
          s.stun_timer = stunS;
          const ux = d > EPS ? (s.pos[0] - this.player.pos[0]) / d : Math.sin(theta);
          const uz = d > EPS ? (s.pos[2] - this.player.pos[2]) / d : Math.cos(theta);
          s.pos[0] += ux * pushM;
          s.pos[2] += uz * pushM;
          this._enforceSafeZones(s.pos);
          stunnedIds.push(s.id);
          justStunned.add(s.id);
          this.score += perStun;
        }
      }
      events.push({
        type: "event",
        tick: eventTick,
        name: "pulse",
        data: { stunned_ids: stunnedIds },
      });
    }

    // 7. Shades AI
    if (eventTick % 1800 === 0 && this.shades.length < 5) {
      const ns = this._spawnRandomShade();
      this.shades.push(ns);
      events.push({
        type: "event",
        tick: eventTick,
        name: "shade_spawned",
        data: { id: ns.id },
      });
    }

    const shadeSpeed = Number(this.tuning.shade_speed);
    for (const s of this.shades) {
      if (justStunned.has(s.id)) continue;
      if (s.state === "stunned") {
        s.stun_timer = Math.max(0, s.stun_timer - DT);
        if (s.stun_timer <= EPS) {
          s.stun_timer = 0;
          s.state = "chase";
        }
      }
      if (s.state !== "stunned") {
        const d = distXZ(this.player.pos, s.pos);
        const stepD = shadeSpeed * DT;
        if (d > EPS) {
          const moveD = Math.min(d, stepD);
          s.pos[0] += ((this.player.pos[0] - s.pos[0]) / d) * moveD;
          s.pos[2] += ((this.player.pos[2] - s.pos[2]) / d) * moveD;
        }
        this._enforceSafeZones(s.pos);
      }
    }

    // 8. Collision
    const hitR = Number(this.tuning.shade_hit_radius);
    const safeR = Number(this.tuning.safe_radius);
    const inSafe = this.lanterns.some((l) => l.lit && distXZ(this.player.pos, l.pos) <= safeR + EPS);
    if (this.invuln_timer <= EPS && !inSafe) {
      for (const s of this.shades) {
        if (s.state === "stunned") continue;
        if (distXZ(this.player.pos, s.pos) <= hitR + EPS) {
          this.player.flames = Math.max(0, this.player.flames - 1);
          const dropped = Math.floor(this.player.carried * Number(this.tuning.hit_drop_ratio));
          this.player.carried = Math.max(0, this.player.carried - dropped);
          this.invuln_timer = Number(this.tuning.invuln_s);
          events.push({
            type: "event",
            tick: eventTick,
            name: "player_hit",
            data: { by: "shade", flames: this.player.flames, dropped },
          });
          break;
        }
      }
    }

    // 9. Advance tick & check win/lose
    this.tick = eventTick;
    this.sim_tick = eventTick;
    this.time_left_s = this.initial_duration_s - this.tick / TICK_RATE;

    if (this.lanterns.every((l) => l.lit)) {
      this.state = "won";
      const bonus =
        Math.round(Math.max(0, this.time_left_s) * Number(this.tuning.score.per_second_left)) +
        this.player.flames * Number(this.tuning.score.per_flame_left);
      this.score += bonus;
      events.push({
        type: "event",
        tick: eventTick,
        name: "game_over",
        data: { result: "won", reason: "all_lit" },
      });
    } else if (this.player.flames <= 0) {
      this.state = "lost";
      events.push({
        type: "event",
        tick: eventTick,
        name: "game_over",
        data: { result: "lost", reason: "no_flames" },
      });
    } else if (this.time_left_s <= EPS) {
      this.time_left_s = 0;
      this.state = "lost";
      events.push({
        type: "event",
        tick: eventTick,
        name: "game_over",
        data: { result: "lost", reason: "dawn" },
      });
    }

    return events;
  }
}
