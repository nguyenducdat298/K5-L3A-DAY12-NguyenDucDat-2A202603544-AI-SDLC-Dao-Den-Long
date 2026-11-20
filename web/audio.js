// Procedural Web Audio API Synthesizer for Đảo Đèn Lồng (Cozy Anime Soundtrack & SFX, 0KB external assets)

export class CozyAudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playMotePickup(carried = 1) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    // Pentatonic scale notes: C5, D5, E5, G5, A5, C6
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = notes[Math.min(notes.length - 1, Math.max(0, carried - 1))];
    this._playBellNote(freq, 0.35, 0.14, "sine");
    this._playBellNote(freq * 2, 0.22, 0.05, "triangle", 0.03);
  }

  playDeposit() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this._playBellNote(440, 0.28, 0.12, "triangle");
    this._playBellNote(659.25, 0.35, 0.12, "sine", 0.07);
  }

  playLanternLit() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    // Warm anime shrine chord arpeggio
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    chord.forEach((f, i) => {
      this._playBellNote(f, 1.1, 0.11, "sine", i * 0.06);
    });
  }

  playPulse() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playHit() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.35);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  playGameOver(won = true) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 311.13, 261.63];
    notes.forEach((f, i) => {
      this._playBellNote(f, 0.9, 0.13, "sine", i * 0.14);
    });
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
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}
