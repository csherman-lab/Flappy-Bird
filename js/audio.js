/** Procedural sound effects via Web Audio — no external files needed */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('flappy3d-muted') === '1';
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('flappy3d-muted', this.muted ? '1' : '0');
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  _tone(freq, duration, type = 'sine', gain = 0.15, detune = 0) {
    if (this.muted) return;
    const ctx = this._ensureContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (detune) osc.detune.setValueAtTime(detune, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  flap() {
    if (this.muted) return;
    const ctx = this._ensureContext();
    const bufSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  score() {
    this._tone(880, 0.08, 'square', 0.08);
    setTimeout(() => this._tone(1175, 0.12, 'square', 0.07), 60);
  }

  hit() {
    if (this.muted) return;
    const ctx = this._ensureContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  swoosh() {
    this._tone(320, 0.06, 'triangle', 0.04);
  }
}
