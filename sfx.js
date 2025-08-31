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

    shatter({ intensity = 1, duration = 0.9 } = {}) {
        const ctx = this._ctx();
        const now = ctx.currentTime + 0.005;
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        intensity = clamp(intensity, 0.2, 1.5);

        // --- Root bus for this event
        const rootGain = ctx.createGain();
        rootGain.gain.value = 0.8 * intensity; // slightly lower overall
        rootGain.connect(this.bus);

        // --- Impact bus (shared by components)
        const impact = ctx.createGain();
        impact.gain.value = 1.0;
        impact.connect(rootGain);

        // --- Noise burst (body of the shatter) ---
        const len = Math.floor(ctx.sampleRate * duration);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            const t = i / len;
            // Slight tilt to avoid buzzy highs; softer tail
            const dec = Math.pow(1 - t, 1.8);
            ch[i] = (Math.random() * 2 - 1) * dec * (1 - t * 0.15);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;

        // Keep some low-mid body, not too thin
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 900 + 400 * intensity;

        // Gentle presence (adds 'thunk' without shrillness)
        const presence = ctx.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 1800;
        presence.Q.value = 0.8;
        presence.gain.value = 2.5; // small boost vs old +5 @ 3.2k

        // De-ess / harshness taming
        const deEss = ctx.createBiquadFilter();
        deEss.type = "peaking";
        deEss.frequency.value = 3200;
        deEss.Q.value = 1.0;
        deEss.gain.value = -7; // tame the ear-piercing band

        // Smooth top end
        const shelf = ctx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.value = 6000;
        shelf.gain.value = -4;

        // Overall low-pass to keep it sweet
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 7000 - 1500 * (1 - Math.min(intensity, 1));
        lp.Q.value = 0.7;

        // Optional soft-sat to round transients (pre-impact)
        const shaper = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i / 128) - 1;
            curve[i] = Math.tanh(1.5 * x); // gentle
        }
        shaper.curve = curve;
        shaper.oversample = "2x";

        src.connect(hp)
            .connect(presence)
            .connect(deEss)
            .connect(shelf)
            .connect(lp)
            .connect(shaper)
            .connect(impact);

        // --- Sparkles / tinkles (much softer, lower band & triangle waves) ---
        const sparkleBus = ctx.createGain();
        sparkleBus.gain.value = 0.35 * intensity; // was 0.7 → less bright
        sparkleBus.connect(rootGain);

        const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (panL && panR) {
            panL.pan.value = -0.3;
            panR.pan.value = 0.3;
            sparkleBus.connect(panL).connect(rootGain);
            sparkleBus.connect(panR).connect(rootGain);
        }

        const sparkCount = 7 + Math.floor(8 * intensity); // fewer sparks
        for (let i = 0; i < sparkCount; i++) {
            const t0 = now + 0.012 * i;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();

            // Lower range keeps it sweet (1.2–2.6 kHz)
            const f0 = 1200 + Math.random() * 1400;
            const det = (Math.random() - 0.5) * 30;
            osc.type = "triangle"; // softer than sine here due to filter
            osc.frequency.setValueAtTime(f0 + det, t0);
            osc.frequency.exponentialRampToValueAtTime(f0 * 0.8, t0 + 0.12);

            // Envelope: quick in, quick out, very low level
            g.gain.setValueAtTime(0.0, t0);
            g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.03, t0 + 0.012);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16 + Math.random() * 0.05);

            const bp = ctx.createBiquadFilter();
            bp.type = "bandpass";
            bp.frequency.value = f0;
            bp.Q.value = 5;

            osc.connect(bp).connect(g).connect(sparkleBus);
            osc.start(t0);
            osc.stop(t0 + 0.22);
        }

        // --- Subtle glass bands (calmer, wider Q, lower gains) ---
        const freqs = [1400, 1900, 2400, 3000];
        freqs.forEach((f, i) => {
            const bp = ctx.createBiquadFilter();
            bp.type = "bandpass";
            bp.frequency.value = f * (1 + (Math.random() - 0.5) * 0.04);
            bp.Q.value = 4.5 + i * 0.8;

            const g = ctx.createGain();
            // much gentler & faster decay than before
            g.gain.setValueAtTime(0.25 + 0.1 * i, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.28 + 0.06 * i);

            lp.connect(bp).connect(g).connect(impact);
        });

        // Fire!
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
