// Procedural Web Audio API Synthesizer for Đảo Đèn Lồng (Phase 2 + Vandal FPS / Evernight / Genshin Dash SFX)

export class CozyAudioEngine {
  constructor(initialVolume = 0.75) {
    this.ctx = null;
    this.muted = false;
    this.volume = Math.max(0, Math.min(1, Number(initialVolume)));
    this.bgmTimer = null;
    this.bgmNoteIdx = 0;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, Number(vol)));
  }

  _ensureCtx() {
    if (this.muted || this.volume <= 0.001) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  startBGM() {
    if (this.bgmTimer) return;
    const melody = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
    this.bgmTimer = setInterval(() => {
      if (this.muted || this.volume <= 0.01) return;
      const freq = melody[this.bgmNoteIdx % melody.length];
      this.bgmNoteIdx++;
      this._playBellNote(freq * 0.5, 1.4, 0.025, "sine", 0);
    }, 1500);
  }

  // Vandal Heavy Rifle Shot SFX (Punchy low-end thump + metallic crack)
  playVandalShot() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Punchy low-mid barrel thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    gain.gain.setValueAtTime(0.24 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);

    // High metallic transient click
    this._playBellNote(1480, 0.05, 0.09, "square", 0);
  }

  // Vandal Magazine Reload SFX
  playReload() {
    this._playBellNote(320, 0.08, 0.1, "square", 0.0);
    this._playBellNote(240, 0.08, 0.1, "triangle", 0.12);
    this._playBellNote(520, 0.1, 0.12, "square", 0.45);
    this._playBellNote(680, 0.12, 0.12, "triangle", 0.55);
  }

  // Ammo Magazine Pickup SFX
  playAmmoPickup() {
    this._playBellNote(480, 0.09, 0.11, "square", 0.0);
    this._playBellNote(720, 0.12, 0.12, "triangle", 0.07);
  }

  // 1. Nhặt Memoria (Mote / Charm pickup)
  playMotePickup(carried = 1) {
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 987.77, 1046.5, 1174.66, 1318.5, 1567.98];
    const freq = notes[Math.min(notes.length - 1, Math.max(0, carried - 1))];
    this._playBellNote(freq, 0.32, 0.13, "sine");
    this._playBellNote(freq * 1.5, 0.2, 0.05, "triangle", 0.03);
  }

  playCharmPickup() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._playBellNote(f, 0.45, 0.12, "triangle", i * 0.045);
    });
  }

  // 2. Thắp đèn (Deposit & Lantern Lit)
  playDeposit() {
    this._playBellNote(440, 0.25, 0.11, "triangle");
    this._playBellNote(659.25, 0.3, 0.11, "sine", 0.06);
  }

  playLanternLit() {
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    chord.forEach((f, i) => {
      this._playBellNote(f, 1.0, 0.11, "sine", i * 0.055);
    });
  }

  // 3. Tỏa sáng (Pulse)
  playPulse() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.35);
    gain.gain.setValueAtTime(0.18 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // 4. Bị đánh (Hit / Fall / Steal)
  playHit() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.36);
    gain.gain.setValueAtTime(0.16 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  // 5. Nhảy (Jump / Jump Pad)
  playJump(isPad = false) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(isPad ? 240 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(isPad ? 680 : 420, now + (isPad ? 0.28 : 0.15));
    gain.gain.setValueAtTime(0.1 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isPad ? 0.3 : 0.16));
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isPad ? 0.3 : 0.16));
  }

  // 6. Lướt (Genshin Elemental Dash SFX)
  playDash() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.2);
    gain.gain.setValueAtTime(0.14 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
    this._playBellNote(1046.5, 0.22, 0.08, "sine", 0.02);
  }

  // 7 & 8. Thắng / Thua
  playGameOver(won = true) {
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 311.13, 261.63];
    notes.forEach((f, i) => {
      this._playBellNote(f, 0.85, 0.13, "sine", i * 0.13);
    });
  }

  // 9. Bóng Mực xuất hiện (shade_spawned)
  playShadeSpawned() {
    this._playBellNote(130.81, 0.45, 0.09, "triangle", 0);
    this._playBellNote(123.47, 0.5, 0.09, "sine", 0.08);
  }

  // 10. Đếm ngược 10 s cuối & Cảnh báo Gió Đêm 3
  playCountdownTick() {
    this._playBellNote(880.0, 0.12, 0.08, "sine", 0);
  }

  playWindWarning() {
    this._playBellNote(587.33, 0.5, 0.09, "sine", 0);
    this._playBellNote(440.0, 0.6, 0.09, "triangle", 0.15);
  }

  _playBellNote(freq, duration = 0.4, peakGain = 0.12, type = "sine", delay = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain * this.volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}
