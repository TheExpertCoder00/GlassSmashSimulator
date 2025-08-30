// Minimal WebAudio shatter SFX (dependency-free).
// Usage: const sfx = new SFX(); sfx.shatter();
(function () {
  class SFX {
    constructor() {
      this.ctx = null;
      this.unlocked = false;
      this._bindUnlock();
    }

    _getCtx() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      return this.ctx;
    }

    _bindUnlock() {
      const tryResume = () => {
        const ctx = this._getCtx();
        if (ctx.state === "suspended") ctx.resume();
        this.unlocked = true;
        window.removeEventListener("pointerdown", tryResume);
        window.removeEventListener("keydown", tryResume);
      };
      // Browsers require a user gesture before audio can start.
      window.addEventListener("pointerdown", tryResume, { once: true });
      window.addEventListener("keydown", tryResume, { once: true });
    }

    shatter({ duration = 0.9, timeScale = 1 } = {}) {
      const ctx = this._getCtx();
      const now = ctx.currentTime + 0.01;

      // --- noise burst (the crunchy “glass”)
      const len = Math.floor(ctx.sampleRate * duration);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // bright noise with decay
        ch[i] = (Math.random() * 2 - 1) * (1.0 - t) * (0.6 + 0.4 * (1.0 - t));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;

      // a few resonant bands for sparkle
      const freqs = [1800, 2400, 3200, 4000];
      const bands = freqs.map((f, i) => {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f;
        bp.Q.value = 8 + i * 2;
        return bp;
      });

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration / timeScale);

      // wiring
      noise.connect(hp);
      let tail = hp;
      for (const b of bands) tail.connect(b);
      const sum = ctx.createGain();
      for (const b of bands) b.connect(sum);
      sum.connect(gain).connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration / timeScale);
    }
  }

  window.SFX = SFX;
})();
