(function () {
  class SFX {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.comp = null;
      this.delay = null;
      this.unlocked = false;
      this._bindUnlock();
    }

    _ctx() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this._buildMaster();
      }
      return this.ctx;
    }

    _buildMaster() {
      const ctx = this.ctx;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.knee.value = 24;
      this.comp.ratio.value = 3;
      this.comp.attack.value = 0.002;
      this.comp.release.value = 0.20;

      this.delay = ctx.createDelay(0.4);
      this.delay.delayTime.value = 0.08;
      const fb = ctx.createGain();
      fb.gain.value = 0.25;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 700;
      this.delay.connect(hp).connect(fb).connect(this.delay);

      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const sum = ctx.createGain();

      sum.connect(this.comp);
      sum.connect(this.delay);
      this.delay.connect(this.comp);

      this.comp.connect(this.master).connect(ctx.destination);
      this.bus = sum;
    }

    _bindUnlock() {
      const tryResume = () => {
        const ctx = this._ctx();
        if (ctx.state === "suspended") ctx.resume();
        this.unlocked = true;
        window.removeEventListener("pointerdown", tryResume);
        window.removeEventListener("keydown", tryResume);
        console.log("AudioContext unlocked");
      };
      window.addEventListener("pointerdown", tryResume, { once: true });
      window.addEventListener("keydown", tryResume, { once: true });
    }

    shatter({ intensity = 1, duration = 0.95 } = {}) {
      const ctx = this._ctx();
      const now = ctx.currentTime + 0.005;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      intensity = clamp(intensity, 0.2, 1.5);

      const rootGain = ctx.createGain();
      rootGain.gain.value = 0.85 * intensity;
      rootGain.connect(this.bus);

      const impact = ctx.createGain();
      impact.gain.value = 1.0;
      impact.connect(rootGain);

      const len = Math.floor(ctx.sampleRate * duration);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const dec = Math.pow(1 - t, 1.6);
        ch[i] = (Math.random() * 2 - 1) * dec;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1600 + 600 * intensity;

      const tilt = ctx.createBiquadFilter();
      tilt.type = "peaking";
      tilt.frequency.value = 3200;
      tilt.Q.value = 0.7;
      tilt.gain.value = 5 + 4 * intensity;

      src.connect(hp).connect(tilt).connect(impact);

      const freqs = [1700, 2200, 2800, 3500, 4300];
      freqs.forEach((f, i) => {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f * (1 + (Math.random() - 0.5) * 0.06);
        bp.Q.value = 8 + i * 2;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5 + 0.15 * i, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.45 + 0.1 * i);

        tilt.connect(bp).connect(g).connect(impact);
      });

      const sparkleBus = ctx.createGain();
      sparkleBus.gain.value = 0.7 * intensity;
      sparkleBus.connect(rootGain);

      const pannerL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const pannerR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pannerL && pannerR) {
        pannerL.pan.value = -0.35;
        pannerR.pan.value = 0.35;
        sparkleBus.connect(pannerL).connect(rootGain);
        sparkleBus.connect(pannerR).connect(rootGain);
      }

      const sparkCount = 10 + Math.floor(12 * intensity);
      for (let i = 0; i < sparkCount; i++) {
        const t0 = now + 0.015 * i;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const f0 = 2200 + Math.random() * 3200;
        const det = (Math.random() - 0.5) * 60;
        osc.type = "sine";
        osc.frequency.setValueAtTime(f0 + det, t0);

        g.gain.setValueAtTime(0.0, t0);
        g.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.06, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18 + Math.random() * 0.1);

        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f0;
        bp.Q.value = 6;

        osc.connect(bp).connect(g).connect(sparkleBus);
        osc.start(t0);
        osc.stop(t0 + 0.25);
      }

      src.start(now);
      src.stop(now + duration);
    }

    testSound() {
      const ctx = this._ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4 note for simplicity
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1);
    }
  }

  window.SFX = SFX;
})();
