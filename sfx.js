(function () {
  class SFX {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.comp = null;
      this.delay = null;
      this.unlocked = false;
      this._bindUnlock();
      this._combo = { count: 0, lastTs: 0 };
      this._comboWindowMs = 650; // time between shatters to keep combo alive
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

        // --- combo logic (successive panes = stronger)
        const tNow = performance.now();
        if (tNow - this._combo.lastTs <= this._comboWindowMs) {
            this._combo.count++;
        } else {
            this._combo.count = 1;
        }
        this._combo.lastTs = tNow;

        // map combo -> boosts
        // combo 1,2,3,4,5+  => mult 1.00,1.15,1.28,1.38,1.45
        const comboIdx = this._combo.count;
        const comboMult = Math.min(1.45, 1 + 0.15 * (comboIdx - 1) ** 0.85);

        // final psychoacoustic intensity with clamp
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        const I = clamp(intensity * comboMult, 0.25, 1.5);

        // subtle “pitch down” as combo grows (feels weightier)
        const comboToneDrop = 1 - Math.min(0.18, 0.04 * (comboIdx - 1)); // 0..-18%

        // --- Root bus for this event
        const rootGain = ctx.createGain();
        rootGain.gain.value = 0.8 * I;
        rootGain.connect(this.bus);

        // --- Impact bus (shared)
        const impact = ctx.createGain();
        impact.gain.value = 1.0;
        impact.connect(rootGain);

        // --- Noise burst (body)
        const len = Math.floor(ctx.sampleRate * duration);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            const t = i / len;
            const dec = Math.pow(1 - t, 1.8);
            ch[i] = (Math.random() * 2 - 1) * dec * (1 - t * 0.15);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = (900 + 400 * I) * comboToneDrop;

        const presence = ctx.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 1800 * comboToneDrop;
        presence.Q.value = 0.8;
        presence.gain.value = 2.5;

        const deEss = ctx.createBiquadFilter();
        deEss.type = "peaking";
        deEss.frequency.value = 3200;
        deEss.Q.value = 1.0;
        deEss.gain.value = -7;

        const shelf = ctx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.value = 6000;
        shelf.gain.value = -4;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = (7000 - 1500 * (1 - Math.min(I, 1))) * (0.95 + 0.05 * comboToneDrop);
        lp.Q.value = 0.7;

        const shaper = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i / 128) - 1;
            curve[i] = Math.tanh(1.5 * x);
        }
        shaper.curve = curve;
        shaper.oversample = "2x";

        src.connect(hp).connect(presence).connect(deEss).connect(shelf).connect(lp).connect(shaper).connect(impact);

        // --- Sparkles (scaled with combo)
        const sparkleBus = ctx.createGain();
        // start lower, then scale with combo (feels “more shards” each pane)
        const baseSpark = 0.28;
        sparkleBus.gain.value = (baseSpark + 0.10 * Math.min(comboIdx - 1, 4)) * I;
        sparkleBus.connect(rootGain);

        const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (panL && panR) {
            panL.pan.value = -0.3;
            panR.pan.value = 0.3;
            sparkleBus.connect(panL).connect(rootGain);
            sparkleBus.connect(panR).connect(rootGain);
        }

        const sparkCount = Math.round((6 + 6 * I) + 1.2 * Math.min(comboIdx - 1, 5));
        for (let i = 0; i < sparkCount; i++) {
            const t0 = now + 0.012 * i;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();

            const f0 = (1200 + Math.random() * 1400) * comboToneDrop;
            const det = (Math.random() - 0.5) * 30;
            osc.type = "triangle";
            osc.frequency.setValueAtTime(f0 + det, t0);
            osc.frequency.exponentialRampToValueAtTime(f0 * 0.8, t0 + 0.12);

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

        // --- Broad glass bands (a touch more on higher combo)
        const freqs = [1400, 1900, 2400, 3000].map(f => f * comboToneDrop);
        freqs.forEach((f, i) => {
            const bp = ctx.createBiquadFilter();
            bp.type = "bandpass";
            bp.frequency.value = f * (1 + (Math.random() - 0.5) * 0.04);
            bp.Q.value = 4.5 + i * 0.8;

            const g = ctx.createGain();
            const base = 0.22 + 0.09 * i;
            g.gain.setValueAtTime(base * (1 + 0.12 * Math.min(comboIdx - 1, 5)), now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.28 + 0.06 * i);

            lp.connect(bp).connect(g).connect(impact);
        });

        this.delay.delayTime.setTargetAtTime(0.08 + 0.006 * Math.min(comboIdx - 1, 5), ctx.currentTime, 0.02);

        // go
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
