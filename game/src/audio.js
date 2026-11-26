// audio.js — engine, wind and event sounds synthesised with WebAudio.
// No audio files: every sound is generated from oscillators and noise.

export function createAudioEngine() {
  let ctx = null;
  let engineOsc = null, engineGain = null, windGain = null, windFilter = null;
  return {
    start() {
      if (ctx) { ctx.resume(); return; }
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      ctx = new AudioCtor();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      // Wind: filtered noise whose gain follows airspeed.
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(ctx.destination);
      noise.start();
    },
    update(throttle, speed, stalled, boost = 0) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(52 + throttle * 95 + boost * 42, t, 0.08);
      engineGain.gain.setTargetAtTime(0.015 + throttle * 0.05 + boost * 0.04, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.13, speed * 0.0011 + boost * 0.025), t, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 9 + boost * 520, t, 0.2);
      if (stalled) engineOsc.frequency.setTargetAtTime(38, t, 0.05);
    },
    chime(kind) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const notes = kind === 'ring' ? [880, 1318]
        : kind === 'drop' ? [520, 390]
          : kind === 'hit' ? [740, 1108, 1480]
            : kind === 'fire' ? [1180, 760] : [660, 880, 1100];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === 'fire' ? 'square' : 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(kind === 'fire' ? 0.045 : 0.12, t + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t + i * 0.09);
        osc.stop(t + i * 0.09 + 0.32);
      });
    },
    thud() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.32);
    },
  };
}
