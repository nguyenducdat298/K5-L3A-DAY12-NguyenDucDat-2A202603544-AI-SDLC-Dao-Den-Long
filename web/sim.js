// Deterministic 60Hz Simulation Core in ES Module JS (synchronized 1:1 with src/sim.py & Test Contract v1.1)

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
  randint(low, high) {
    if (high <= low) return low;
    return low + Math.floor(this.nextFloat() * (high - low + 1));
  }
  shuffle(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function round3(v) {
  const r = Math.round(Number(v) * 1000) / 1000;
  return Math.abs(r) < 1e-9 ? 0 : r;
}

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function dist3D(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function ptPolar(cx, cz, r, deg, y = 0.0) {
  const rad = (deg * Math.PI) / 180.0;
  return [round3(cx + r * Math.cos(rad)), round3(y), round3(cz + r * Math.sin(rad))];
}

export function buildNightMapConfig(night = 1) {
  if (night === 1) {
    const lanternCoords = [
      [0.0, 0.0, 25.0],
      [23.8, 0.0, 7.7],
      [14.7, 0.0, -20.2],
      [-14.7, 0.0, -20.2],
      [-23.8, 0.0, 7.7],
    ];
    const motePoints = [];
    for (let i = 0; i < 8; i++) motePoints.push(ptPolar(0, 0, 12.0, i * 45.0));
    for (let i = 0; i < 16; i++) motePoints.push(ptPolar(0, 0, 33.0, i * 22.5));
    const shadePoints = [];
    for (let i = 0; i < 12; i++) shadePoints.push(ptPolar(0, 0, 37.0, 15.0 + i * 30.0));
    return {
      duration_s: 300.0,
      shade_speed: 4.0,
      shade_interval_ticks: 480,
      shade_max: 6,
      lanterns: lanternCoords.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0 })),
      mote_points: motePoints,
      shade_points: shadePoints,
      charms: [],
      jump_pads: [],
    };
  }
  if (night === 2) {
    const lanternCoords = [
      [0.0, 0.0, 20.0],
      [17.0, 0.0, -10.0],
      [-17.0, 0.0, -10.0],
      [70.0, 0.0, 20.0],
      [87.0, 0.0, -10.0],
      [53.0, 0.0, -10.0],
    ];
    const motePoints = [];
    const shadePoints = [];
    for (const [cx, cz] of [
      [0.0, 0.0],
      [70.0, 0.0],
    ]) {
      for (let i = 0; i < 4; i++) motePoints.push(ptPolar(cx, cz, 10.0, i * 90.0));
      for (let i = 0; i < 8; i++) motePoints.push(ptPolar(cx, cz, 22.0, i * 45.0));
      for (let i = 0; i < 8; i++) shadePoints.push(ptPolar(cx, cz, 26.0, 22.5 + i * 45.0));
    }
    return {
      duration_s: 330.0,
      shade_speed: 4.0,
      shade_interval_ticks: 420,
      shade_max: 8,
      lanterns: lanternCoords.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0 })),
      mote_points: motePoints,
      shade_points: shadePoints,
      charms: [{ id: "C1", pos: [35.0, 0.0, 0.0], available: true, respawn_ticks: 0 }],
      jump_pads: [
        { pos: [20.0, 0.0, 18.0], radius: 1.0, vy: 14.0, h_speed: 24.0, target: [70.0, 0.0, 0.0] },
        { pos: [50.0, 0.0, -18.0], radius: 1.0, vy: 14.0, h_speed: 24.0, target: [0.0, 0.0, 0.0] },
      ],
    };
  }
  // Night 3 — Đảo Chuông
  const lanternCoords = [
    [0.0, 6.0, 6.0],
    [18.0, 3.0, 10.0],
    [-18.0, 3.0, 10.0],
    [35.0, 0.0, -10.0],
    [-35.0, 0.0, -10.0],
    [20.0, 0.0, -35.0],
    [-20.0, 0.0, -35.0],
  ];
  const motePoints = [];
  for (let i = 0; i < 18; i++) motePoints.push(ptPolar(0, 0, 34.0, i * 20.0, 0.0));
  for (const deg of [20, 40, 60, 80, 100, 120, 140, 160]) motePoints.push(ptPolar(0, 0, 18.0, deg, 3.0));
  for (const deg of [45, 135, 225, 315]) motePoints.push(ptPolar(0, 0, 5.0, deg, 6.0));
  const shadePoints = [];
  for (let i = 0; i < 16; i++) shadePoints.push(ptPolar(0, 0, 43.0, i * 22.5, 0.0));
  return {
    duration_s: 360.0,
    shade_speed: 4.5,
    shade_interval_ticks: 360,
    shade_max: 10,
    lanterns: lanternCoords.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0 })),
    mote_points: motePoints,
    shade_points: shadePoints,
    charms: [
      { id: "C1", pos: [30.0, 0.0, 25.0], available: true, respawn_ticks: 0 },
      { id: "C2", pos: [-30.0, 0.0, 25.0], available: true, respawn_ticks: 0 },
    ],
    jump_pads: [{ pos: [0.0, 3.0, 13.0], radius: 1.0, vy: 12.0, vel_xz: [0.0, -8.0] }],
  };
}

export class GameSimulationJS {
  constructor(tuning, seed = 1, night = 1) {
    this.tuning = tuning;
    this.seed = seed >>> 0;
    this.night = Number(night) || 1;
    this.rng = new Mulberry32(this.seed);
    this.mapCfg = buildNightMapConfig(this.night);

    this.tick = 0;
    this.sim_tick = 0;
    this.state = "playing";
    this.score = 0;

    const durKey = `night${this.night}_duration_s`;
    this.initial_duration_s = Number(tuning[durKey] || this.mapCfg.duration_s);
    this.time_left_s = this.initial_duration_s;

    this.player = {
      pos: [0.0, 0.0, 0.0],
      vel: [0.0, 0.0, 0.0],
      flames: Number(tuning.flames || 3),
      carried: 0,
      grounded: true,
      facing_dir: [0.0, 1.0],
      facingYaw: 0.0,
    };

    this.invuln_ticks = 0;
    this.dash_cd_ticks = 0;
    this.dash_active_ticks = 0;
    this.dash_dir = [0.0, 1.0];
    this.pulse_cd_ticks = 0;
    this.charm_ticks = 0;
    this.fall_wait_ticks = 0;
    this.jumppad_flight = false;
    this.jumppad_vel_xz = [0.0, 0.0];

    this.wind_enabled = this.night === 3;
    this.wind_active = false;
    this.wind_warning = false;
    this.wind_dir_deg = 35.0;
    this.wind_ticks_left = 0;

    this.input_state = {
      move: [0.0, 0.0],
      cam_yaw_deg: 0.0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false,
    };

    this.lanterns = this.mapCfg.lanterns.map((l) => ({ ...l, pos: [...l.pos] }));
    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.charms = this.mapCfg.charms.map((c) => ({ ...c, pos: [...c.pos] }));

    this.nextMoteSeq = 1;
    this.nextShadeSeq = 1;
    this.nextDrifterSeq = 1;

    const pts = this.rng.shuffle(this.mapCfg.mote_points);
    for (const pt of pts.slice(0, 20)) {
      this.motes.push({
        id: `M${this.nextMoteSeq++}`,
        pos: [...pt],
        kind: "random",
        ttl_ticks: null,
      });
    }
  }

  _computeFloorHeight(x, z, oldY) {
    if (this.night === 1) {
      return Math.hypot(x, z) <= 40.0 + EPS ? 0.0 : null;
    }
    if (this.night === 2) {
      if (Math.hypot(x, z) <= 28.0 + EPS) return 0.0;
      if (Math.hypot(x - 70.0, z) <= 28.0 + EPS) return 0.0;
      if (x >= 26.0 - EPS && x <= 44.0 + EPS && z >= -2.0 - EPS && z <= 2.0 + EPS) return 0.0;
      return null;
    }
    if (this.night === 3) {
      const r = Math.hypot(x, z);
      if (r > 45.0 + EPS) return null;
      if (r <= 8.0 + EPS && oldY >= 5.75) return 6.0;
      for (const deg of [30.0, 150.0]) {
        const rad = (deg * Math.PI) / 180.0;
        const ca = Math.cos(rad);
        const sa = Math.sin(rad);
        const pPar = x * ca + z * sa;
        const pPerp = Math.abs(-x * sa + z * ca);
        if (pPerp <= 1.5 + EPS && pPar >= 23.8 && pPar <= 30.2) {
          const t = Math.max(0.0, Math.min(1.0, (30.0 - pPar) / 6.0));
          const rampY = 3.0 * t;
          if (oldY >= rampY - 0.45) return rampY;
        }
      }
      if (r >= 12.0 - EPS && r <= 24.0 + EPS && z > 0.0 && oldY >= 2.75) return 3.0;
      return 0.0;
    }
    return 0.0;
  }

  _enforceBellTower(pos) {
    if (this.night === 3 && pos[1] >= 5.5) {
      const r = Math.hypot(pos[0], pos[2]);
      if (r < 2.0) {
        if (r > EPS) {
          pos[0] = (pos[0] / r) * 2.0;
          pos[2] = (pos[2] / r) * 2.0;
        } else {
          pos[0] = 2.0;
          pos[2] = 0.0;
        }
        return true;
      }
    }
    return false;
  }

  _enforceSafeZonesForShade(shade) {
    const safeR = Number(this.tuning.safe_radius || 6.0);
    let blocked = false;
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      if (shade.pushout_lantern_id === l.id && shade.pushout_ticks_left > 0) continue;
      const d = distXZ(shade.pos, l.pos);
      if (d < safeR) {
        const ux = d > EPS ? (shade.pos[0] - l.pos[0]) / d : 1.0;
        const uz = d > EPS ? (shade.pos[2] - l.pos[2]) / d : 0.0;
        shade.pos[0] = l.pos[0] + ux * safeR;
        shade.pos[2] = l.pos[2] + uz * safeR;
        blocked = true;
      }
    }
    return blocked;
  }

  _spawnDroppedMotes(center, count, ringDrop = true) {
    for (let i = 0; i < count; i++) {
      let px = center[0];
      let pz = center[2];
      if (ringDrop) {
        const angle = this.rng.uniform(0, 2 * Math.PI);
        const r = this.rng.uniform(1.5, 2.5);
        px = round3(center[0] + r * Math.cos(angle));
        pz = round3(center[2] + r * Math.sin(angle));
      } else {
        const angle = (2 * Math.PI * i) / Math.max(1, count);
        const r = count > 1 ? 0.45 : 0.0;
        px = round3(center[0] + r * Math.cos(angle));
        pz = round3(center[2] + r * Math.sin(angle));
      }
      this.motes.push({
        id: `M${this.nextMoteSeq++}`,
        pos: [px, round3(center[1]), pz],
        kind: "dropped",
        ttl_ticks: 480,
      });
    }
  }

  step(frameDelta = null) {
    if (this.state === "won" || this.state === "lost") return [];

    const eventTick = this.tick + 1;
    const events = [];

    const prevJump = Boolean(this.input_state.jump);
    const prevInteract = Boolean(this.input_state.interact);
    const prevPulse = Boolean(this.input_state.pulse);
    const prevDash = Boolean(this.input_state.dash);
    const prevPause = Boolean(this.input_state.pause);

    if (frameDelta) {
      if (frameDelta.move !== undefined) this.input_state.move = [Number(frameDelta.move[0]), Number(frameDelta.move[1])];
      if (frameDelta.cam_yaw_deg !== undefined) this.input_state.cam_yaw_deg = Number(frameDelta.cam_yaw_deg);
      if (frameDelta.jump !== undefined) this.input_state.jump = Boolean(frameDelta.jump);
      if (frameDelta.interact !== undefined) this.input_state.interact = Boolean(frameDelta.interact);
      if (frameDelta.pulse !== undefined) this.input_state.pulse = Boolean(frameDelta.pulse);
      if (frameDelta.dash !== undefined) this.input_state.dash = Boolean(frameDelta.dash);
      if (frameDelta.pause !== undefined) this.input_state.pause = Boolean(frameDelta.pause);
    }

    const pauseTriggered = !prevPause && Boolean(this.input_state.pause);
    if (this.state === "paused") {
      if (pauseTriggered) {
        this.state = "playing";
        events.push({ type: "event", tick: eventTick, name: "resumed", data: {} });
      } else {
        this.tick = eventTick;
        return events;
      }
    } else if (pauseTriggered) {
      this.state = "paused";
      this.tick = eventTick;
      events.push({ type: "event", tick: eventTick, name: "paused", data: {} });
      return events;
    }

    const jumpTriggered = !prevJump && Boolean(this.input_state.jump);
    const interactTriggered = !prevInteract && Boolean(this.input_state.interact);
    const pulseTriggered = !prevPulse && Boolean(this.input_state.pulse);
    const dashTriggered = !prevDash && Boolean(this.input_state.dash);

    // Step 2: Decrement counters
    this.tick = eventTick;
    this.sim_tick += 1;
    this.time_left_s = Math.max(0, this.initial_duration_s - this.sim_tick / TICK_RATE);

    if (this.dash_cd_ticks > 0) this.dash_cd_ticks--;
    if (this.dash_active_ticks > 0) this.dash_active_ticks--;
    if (this.pulse_cd_ticks > 0) this.pulse_cd_ticks--;
    if (this.invuln_ticks > 0) this.invuln_ticks--;
    if (this.charm_ticks > 0) {
      this.charm_ticks--;
      this.dash_cd_ticks = 0;
    }

    if (this.fall_wait_ticks > 0) {
      this.fall_wait_ticks--;
      if (this.fall_wait_ticks === 0 && this.player.flames > 0) {
        this.player.pos = [0, 0, 0];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.facing_dir = [0, 1];
        this.invuln_ticks = 90;
      }
    }

    for (const s of this.shades) {
      if ((s.state === "stunned" || s.state === "recoil" || s.state === "spawning") && s.state_ticks_left > 0) {
        s.state_ticks_left--;
        if (s.state_ticks_left === 0) {
          s.state = distXZ(this.player.pos, s.pos) <= 12.0 + EPS ? "chase" : "wander";
        }
      }
    }

    this.motes = this.motes.filter((m) => {
      if (m.ttl_ticks !== null && m.ttl_ticks !== undefined) {
        m.ttl_ticks--;
        return m.ttl_ticks > 0;
      }
      return true;
    });

    for (const c of this.charms) {
      if (!c.available && c.respawn_ticks > 0) {
        c.respawn_ticks--;
        if (c.respawn_ticks === 0) c.available = true;
      }
    }

    if (this.wind_enabled) {
      if (this.wind_ticks_left > 0) {
        this.wind_ticks_left--;
        if (this.wind_ticks_left === 0) this.wind_active = false;
      }
      const mod1800 = this.sim_tick % 1800;
      if (mod1800 === 1680) {
        this.wind_dir_deg = round3(this.rng.uniform(0, 360));
        this.wind_warning = true;
        events.push({ type: "event", tick: eventTick, name: "wind_warning", data: { dir_deg: this.wind_dir_deg } });
      }
      if (this.sim_tick > 0 && mod1800 === 0) {
        this.wind_warning = false;
        this.wind_active = true;
        this.wind_ticks_left = 300;
      }
    }

    // Step 3: Player movement
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
    const wMag = Math.hypot(wx, wz);
    if (wMag > 1e-6) {
      this.player.facing_dir = [wx / wMag, wz / wMag];
      this.player.facingYaw = Math.atan2(wx, wz);
    }

    if (this.fall_wait_ticks === 0) {
      const canDash = this.dash_active_ticks === 0 && (this.dash_cd_ticks === 0 || this.charm_ticks > 0);
      if (dashTriggered && canDash) {
        this.dash_active_ticks = 12;
        this.dash_cd_ticks = this.charm_ticks > 0 ? 0 : 90;
        this.dash_dir = wMag > 1e-6 ? [wx / wMag, wz / wMag] : [...this.player.facing_dir];
        this.jumppad_flight = false;
        events.push({ type: "event", tick: eventTick, name: "dash", data: {} });
      }

      if (jumpTriggered && this.player.grounded && this.dash_active_ticks === 0) {
        this.player.vel[1] = 7.0;
        this.player.grounded = false;
        events.push({ type: "event", tick: eventTick, name: "jump", data: {} });
      }

      if (this.dash_active_ticks > 0) {
        this.player.vel[0] = this.dash_dir[0] * 14.0;
        this.player.vel[2] = this.dash_dir[1] * 14.0;
        this.player.vel[1] = 0.0;
      } else if (this.jumppad_flight) {
        this.player.vel[0] = this.jumppad_vel_xz[0];
        this.player.vel[2] = this.jumppad_vel_xz[1];
        this.player.vel[1] -= 20.0 * DT;
      } else {
        const runSpd = this.charm_ticks > 0 ? 7.2 : Number(this.tuning.player_speed || 6.0);
        this.player.vel[0] = wx * runSpd;
        this.player.vel[2] = wz * runSpd;
        if (!this.player.grounded) {
          this.player.vel[1] -= 20.0 * DT;
        } else {
          this.player.vel[1] = 0.0;
        }
      }

      if (this.wind_active) {
        const wrad = (this.wind_dir_deg * Math.PI) / 180.0;
        this.player.vel[0] += 2.0 * Math.cos(wrad);
        this.player.vel[2] += 2.0 * Math.sin(wrad);
      }

      const oldY = this.player.pos[1];
      this.player.pos[0] += this.player.vel[0] * DT;
      this.player.pos[1] += this.player.vel[1] * DT;
      this.player.pos[2] += this.player.vel[2] * DT;

      this._enforceBellTower(this.player.pos);

      const floorY = this._computeFloorHeight(this.player.pos[0], this.player.pos[2], oldY);
      if (floorY !== null) {
        if (this.player.pos[1] <= floorY + 1e-6 && this.player.vel[1] <= 0 && oldY >= floorY - 0.5) {
          this.player.pos[1] = floorY;
          this.player.vel[1] = 0.0;
          this.player.grounded = true;
          this.jumppad_flight = false;
        } else if (this.player.pos[1] > floorY + 1e-6) {
          this.player.grounded = false;
        }
      } else {
        this.player.grounded = false;
      }

      for (const pad of this.mapCfg.jump_pads) {
        if (distXZ(this.player.pos, pad.pos) <= pad.radius + EPS && Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.35) {
          this.player.pos[1] = pad.pos[1];
          this.player.vel[1] = pad.vy;
          if (pad.vel_xz) {
            this.jumppad_vel_xz = [...pad.vel_xz];
          } else {
            const dx = pad.target[0] - this.player.pos[0];
            const dz = pad.target[2] - this.player.pos[2];
            const d = Math.hypot(dx, dz);
            this.jumppad_vel_xz = d > EPS ? [(dx / d) * pad.h_speed, (dz / d) * pad.h_speed] : [pad.h_speed, 0];
          }
          this.player.vel[0] = this.jumppad_vel_xz[0];
          this.player.vel[2] = this.jumppad_vel_xz[1];
          this.player.grounded = false;
          this.jumppad_flight = true;
          this.dash_active_ticks = 0;
          events.push({ type: "event", tick: eventTick, name: "jump", data: { pad: true } });
          break;
        }
      }

      if (this.player.pos[1] < -10.0) {
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.player.vel = [0, 0, 0];
        this.dash_active_ticks = 0;
        this.jumppad_flight = false;
        events.push({
          type: "event",
          tick: eventTick,
          name: "player_hit",
          data: { by: "fall", flames: this.player.flames, dropped: 0, lost },
        });
        if (this.player.flames > 0) this.fall_wait_ticks = 60;
      }
    }

    // Step 4: Pickup motes and charms
    if (this.fall_wait_ticks === 0) {
      const pickupR = Number(this.tuning.pickup_radius || 1.0);
      const cap = Number(this.tuning.carry_capacity || 10);
      const rem = [];
      for (const m of this.motes) {
        if (
          this.player.carried < cap &&
          distXZ(this.player.pos, m.pos) <= pickupR + EPS &&
          Math.abs(this.player.pos[1] - m.pos[1]) <= 1.5 + EPS
        ) {
          this.player.carried++;
          events.push({ type: "event", tick: eventTick, name: "mote_picked", data: { carried: this.player.carried } });
        } else {
          rem.push(m);
        }
      }
      this.motes = rem;

      for (const c of this.charms) {
        if (
          c.available &&
          distXZ(this.player.pos, c.pos) <= pickupR + EPS &&
          Math.abs(this.player.pos[1] - c.pos[1]) <= 1.5 + EPS
        ) {
          c.available = false;
          c.respawn_ticks = 2700;
          this.charm_ticks = 600;
          this.dash_cd_ticks = 0;
          events.push({
            type: "event",
            tick: eventTick,
            name: "charm_picked",
            data: { charm_id: c.id, charm_ticks: 600 },
          });
        }
      }
    }

    // Step 5: Interact with lantern
    if (this.fall_wait_ticks === 0 && interactTriggered && this.player.carried > 0) {
      const interactR = Number(this.tuning.interact_radius || 2.0);
      const lanternCost = Number(this.tuning.lantern_cost || 10);
      const perMote = Number(this.tuning.score.per_mote || 10);
      const cands = this.lanterns
        .filter(
          (l) =>
            !l.lit &&
            distXZ(this.player.pos, l.pos) <= interactR + EPS &&
            Math.abs(this.player.pos[1] - l.pos[1]) <= 2.0 + EPS
        )
        .sort((a, b) => distXZ(this.player.pos, a.pos) - distXZ(this.player.pos, b.pos));
      if (cands.length > 0) {
        const target = cands[0];
        const need = Math.max(0, lanternCost - target.deposited);
        const amount = Math.min(this.player.carried, need);
        if (amount > 0) {
          this.player.carried -= amount;
          target.deposited += amount;
          this.score += amount * perMote;
          events.push({
            type: "event",
            tick: eventTick,
            name: "deposit",
            data: { lantern_id: target.id, amount, deposited: target.deposited },
          });
          if (target.deposited >= lanternCost && !target.lit) {
            target.lit = true;
            this.score += Number(this.tuning.score.per_lantern || 100);
            events.push({ type: "event", tick: eventTick, name: "lantern_lit", data: { lantern_id: target.id } });
            const safeR = Number(this.tuning.safe_radius || 6.0);
            for (const s of this.shades) {
              if (distXZ(s.pos, target.pos) < safeR) {
                s.pushout_lantern_id = target.id;
                s.pushout_ticks_left = 30;
              }
            }
          }
        }
      }
    }

    // Step 6: Update safe zones
    const safeR = Number(this.tuning.safe_radius || 6.0);
    for (const s of this.shades) {
      if (s.pushout_lantern_id && s.pushout_ticks_left > 0) {
        const l = this.lanterns.find((x) => x.id === s.pushout_lantern_id);
        if (l && l.lit) {
          const d = distXZ(s.pos, l.pos);
          if (d < safeR) {
            const stepOut = (safeR - d) / Math.max(1, s.pushout_ticks_left);
            const ux = d > EPS ? (s.pos[0] - l.pos[0]) / d : 1.0;
            const uz = d > EPS ? (s.pos[2] - l.pos[2]) / d : 0.0;
            s.pos[0] += ux * stepOut;
            s.pos[2] += uz * stepOut;
          }
          s.pushout_ticks_left--;
          if (s.pushout_ticks_left <= 0 || distXZ(s.pos, l.pos) >= safeR - 1e-5) {
            s.pushout_lantern_id = null;
            s.pushout_ticks_left = 0;
          }
        }
      }
      this._enforceSafeZonesForShade(s);
    }

    // Step 7: Pulse (Tỏa Sáng)
    const pulseCost = Number(this.tuning.pulse_cost || 3);
    if (this.fall_wait_ticks === 0 && pulseTriggered && this.player.carried >= pulseCost && this.pulse_cd_ticks === 0) {
      this.player.carried -= pulseCost;
      this.pulse_cd_ticks = 180;
      const pulseR = Number(this.tuning.pulse_radius || 5.0);
      const pulseCenter = [this.player.pos[0], this.player.pos[1] + 0.8, this.player.pos[2]];
      const stunnedIds = [];

      for (const s of this.shades) {
        const sCenter = [s.pos[0], s.pos[1] + 0.8, s.pos[2]];
        if (dist3D(pulseCenter, sCenter) <= pulseR + EPS || dist3D(pulseCenter, s.pos) <= pulseR + EPS) {
          s.state = "stunned";
          s.state_ticks_left = 120;
          const dXZ = distXZ(this.player.pos, s.pos);
          s.push_dir = dXZ > EPS ? [(s.pos[0] - this.player.pos[0]) / dXZ, (s.pos[2] - this.player.pos[2]) / dXZ] : [1, 0];
          s.push_ticks_left = 15;
          stunnedIds.push(s.id);
          this.score += Number(this.tuning.score.per_stun || 5);
        }
      }

      for (const d of this.drifters) {
        if (d.state === "removed") continue;
        if (distXZ(this.player.pos, d.pos) <= pulseR + EPS) {
          if (d.state === "chase") {
            d.state = "flee";
            d.flee_ticks_left = 240;
          } else if (d.state === "flee" && d.stolen > 0) {
            const amt = d.stolen;
            d.stolen = 0;
            d.flee_ticks_left = 120;
            this._spawnDroppedMotes(d.pos, amt, false);
            events.push({ type: "event", tick: eventTick, name: "drifter_drop", data: { drifter_id: d.id, amount: amt } });
          }
        }
      }

      events.push({ type: "event", tick: eventTick, name: "pulse", data: { stunned_ids: stunnedIds } });
    }

    // Step 8: Move Shades & Drifters
    const shadeSpeed = this.mapCfg.shade_speed;
    for (const s of this.shades) {
      if (s.push_ticks_left > 0) {
        const stepPush = 4.0 / 15.0;
        s.pos[0] += s.push_dir[0] * stepPush;
        s.pos[2] += s.push_dir[1] * stepPush;
        s.push_ticks_left--;
        if (this._enforceBellTower(s.pos) || this._enforceSafeZonesForShade(s)) s.push_ticks_left = 0;
        continue;
      }
      if (s.state === "stunned" || s.state === "spawning") continue;
      if (s.state === "recoil") {
        s.pos[0] += s.recoil_dir[0] * (2.0 / 60.0);
        s.pos[2] += s.recoil_dir[1] * (2.0 / 60.0);
        this._enforceBellTower(s.pos);
        this._enforceSafeZonesForShade(s);
        continue;
      }
      const dP = distXZ(this.player.pos, s.pos);
      if (s.state === "wander" && dP <= 12.0 + EPS && this.fall_wait_ticks === 0) s.state = "chase";
      else if (s.state === "chase" && (dP > 18.0 + EPS || this.fall_wait_ticks > 0)) s.state = "wander";

      if (s.state === "chase") {
        const stepD = shadeSpeed * DT;
        if (dP > EPS) {
          const moveD = Math.min(dP, stepD);
          s.pos[0] += ((this.player.pos[0] - s.pos[0]) / dP) * moveD;
          s.pos[2] += ((this.player.pos[2] - s.pos[2]) / dP) * moveD;
        }
        this._enforceBellTower(s.pos);
        this._enforceSafeZonesForShade(s);
      }
    }

    for (const d of this.drifters) {
      if (d.state === "removed") continue;
      const dP = distXZ(this.player.pos, d.pos);
      if (d.state === "idle" || d.state === "chase") {
        if (this.fall_wait_ticks === 0 && this.player.carried >= 5 && dP <= 15.0 + EPS && !d.has_stolen) {
          d.state = "chase";
        } else {
          d.state = "idle";
        }
        if (d.state === "chase") {
          const stepD = 7.0 * DT;
          if (dP > EPS) {
            const moveD = Math.min(dP, stepD);
            d.pos[0] += ((this.player.pos[0] - d.pos[0]) / dP) * moveD;
            d.pos[2] += ((this.player.pos[2] - d.pos[2]) / dP) * moveD;
          }
        } else {
          d.orbit_angle = (d.orbit_angle || 0) + 1.5 * DT;
          d.pos[0] += Math.cos(d.orbit_angle) * 2.0 * DT;
          d.pos[2] += Math.sin(d.orbit_angle) * 2.0 * DT;
        }
      } else if (d.state === "flee") {
        const stepD = 7.0 * DT;
        const ux = dP > EPS ? (d.pos[0] - this.player.pos[0]) / dP : 1.0;
        const uz = dP > EPS ? (d.pos[2] - this.player.pos[2]) / dP : 0.0;
        d.pos[0] += ux * stepD;
        d.pos[2] += uz * stepD;
        d.flee_ticks_left--;
        if (d.flee_ticks_left <= 0) d.state = "removed";
      }
    }

    // Step 9: Collisions (Drifters steal first, then Shades hit)
    if (this.fall_wait_ticks === 0) {
      for (const d of this.drifters) {
        if (d.state === "flee" || d.state === "removed" || d.has_stolen) continue;
        if (distXZ(this.player.pos, d.pos) <= 1.2 + EPS && this.player.carried > 0) {
          const amount = Math.min(3, this.player.carried);
          this.player.carried -= amount;
          d.stolen = amount;
          d.has_stolen = true;
          d.state = "flee";
          d.flee_ticks_left = 240;
          events.push({
            type: "event",
            tick: eventTick,
            name: "drifter_steal",
            data: { drifter_id: d.id, amount, carried: this.player.carried },
          });
        }
      }

      if (this.invuln_ticks === 0) {
        for (const s of this.shades) {
          if (s.state === "stunned" || s.state === "recoil" || s.state === "spawning" || s.pushout_ticks_left > 0) continue;
          if (distXZ(this.player.pos, s.pos) <= 1.0 + EPS && Math.abs(this.player.pos[1] - s.pos[1]) <= 1.5 + EPS) {
            this.player.flames = Math.max(0, this.player.flames - 1);
            const dropped = Math.floor(this.player.carried / 2);
            this.player.carried -= dropped;
            this.invuln_ticks = 90;
            const dP = distXZ(this.player.pos, s.pos);
            s.recoil_dir =
              dP > EPS
                ? [(s.pos[0] - this.player.pos[0]) / dP, (s.pos[2] - this.player.pos[2]) / dP]
                : [-this.player.facing_dir[0], -this.player.facing_dir[1]];
            s.state = "recoil";
            s.state_ticks_left = 60;
            if (dropped > 0) this._spawnDroppedMotes(this.player.pos, dropped, true);
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
    }

    // Step 10: Spawns
    if (this.sim_tick > 0 && this.sim_tick % 240 === 0 && this.motes.length < 30) {
      const emptyPts = this.mapCfg.mote_points.filter((pt) =>
        this.motes.every((m) => distXZ(pt, m.pos) > 0.3 || Math.abs(pt[1] - m.pos[1]) > 0.5)
      );
      if (emptyPts.length > 0) {
        const chosen = emptyPts[this.rng.randint(0, emptyPts.length - 1)];
        this.motes.push({ id: `M${this.nextMoteSeq++}`, pos: [...chosen], kind: "random", ttl_ticks: null });
      }
    }

    const interval = this.mapCfg.shade_interval_ticks;
    const maxShades = this.mapCfg.shade_max;
    let toSpawn = 0;
    if (this.sim_tick === 300) toSpawn = 2;
    else if (this.sim_tick > 300 && (this.sim_tick - 300) % interval === 0) toSpawn = 1;

    for (let i = 0; i < toSpawn; i++) {
      if (this.shades.length >= maxShades) break;
      const validPts = this.mapCfg.shade_points.filter(
        (pt) =>
          distXZ(pt, this.player.pos) >= 15.0 - EPS &&
          this.shades.every((s) => distXZ(pt, s.pos) > 0.5) &&
          this.lanterns.every((l) => !l.lit || distXZ(pt, l.pos) >= safeR)
      );
      if (validPts.length === 0) break;
      const chosen = validPts[this.rng.randint(0, validPts.length - 1)];
      const sid = `S${this.nextShadeSeq++}`;
      this.shades.push({
        id: sid,
        pos: [...chosen],
        state: "spawning",
        state_ticks_left: 1,
        push_ticks_left: 0,
        push_dir: [1, 0],
        recoil_dir: [0, 1],
        pushout_lantern_id: null,
        pushout_ticks_left: 0,
      });
      events.push({ type: "event", tick: eventTick, name: "shade_spawned", data: { id: sid } });
    }

    if ((this.night === 2 || this.night === 3) && this.sim_tick > 0 && this.sim_tick % 1200 === 0) {
      const activeD = this.drifters.filter((d) => d.state !== "removed");
      if (activeD.length < 2 && this.mapCfg.shade_points.length > 0) {
        const chosen = this.mapCfg.shade_points[this.rng.randint(0, this.mapCfg.shade_points.length - 1)];
        this.drifters.push({
          id: `D${this.nextDrifterSeq++}`,
          pos: [...chosen],
          state: "idle",
          stolen: 0,
          has_stolen: false,
          flee_ticks_left: 0,
          orbit_angle: 0,
        });
      }
    }

    // Step 11: Win / Lose check
    if (this.player.flames <= 0) {
      this.state = "lost";
      events.push({ type: "event", tick: eventTick, name: "game_over", data: { result: "lost", reason: "no_flames" } });
    } else if (this.lanterns.every((l) => l.lit)) {
      this.state = "won";
      const bonus =
        Math.floor(Math.max(0, this.time_left_s)) * Number(this.tuning.score.per_second_left || 2) +
        this.player.flames * Number(this.tuning.score.per_flame_left || 50);
      this.score += bonus;
      events.push({ type: "event", tick: eventTick, name: "game_over", data: { result: "won", reason: "all_lit" } });
    } else if (this.time_left_s <= EPS) {
      this.time_left_s = 0;
      this.state = "lost";
      events.push({ type: "event", tick: eventTick, name: "game_over", data: { result: "lost", reason: "dawn" } });
    }

    return events;
  }
}
