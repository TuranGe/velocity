// ── Ambient Audio Engine ──────────────────────────────────────
// Generative lo-fi/ambient backing tracks for focus & break music.
//
// This replaces the old single-frequency drone with an actual evolving
// piece of music:
//   - A 4-chord progression that the pad cycles through, crossfading
//     between chords so harmony moves over time
//   - A soft rhythmic backbone (kick + hi-hat) on a slow beat grid —
//     gives the "rises and falls" feel that was missing
//   - A sparse melodic arpeggio that wanders over the current chord
//   - Long attack/release envelopes everywhere — nothing snaps on/off
//
// Three moods, each a different progression/tempo/feel:
//   lofi      — Cmaj9 → Am7 → Fmaj7 → G7   (warm, jazzy, ~70 BPM)
//   nature    — Fmaj9 → Dm7 → Bbmaj7 → C   (airy, slow, ~60 BPM) + rain wash
//   deepwork  — Gm9 → Ebmaj7 → Cm7 → D7sus (sparse, minimal, ~55 BPM)

const PROGRESSIONS = {
  lofi: {
    bpm: 70,
    chords: [
      [130.81, 164.81, 196.00, 246.94], // Cmaj9  (C E G B)
      [110.00, 130.81, 164.81, 220.00], // Am7    (A C E A)
      [87.31,  130.81, 174.61, 220.00], // Fmaj7  (F C F A)
      [98.00,  123.47, 174.61, 196.00], // G7     (G B F G)
    ],
    melody: [523.25, 587.33, 659.25, 698.46, 783.99], // C5 D5 E5 F5 G5
  },
  nature: {
    bpm: 60,
    chords: [
      [87.31,  130.81, 174.61, 220.00], // Fmaj9-ish (F C F A)
      [73.42,  110.00, 146.83, 220.00], // Dm7       (D A D A)
      [58.27,  116.54, 146.83, 174.61], // Bbmaj7    (Bb Bb D F)
      [65.41,  130.81, 164.81, 196.00], // C         (C C E G)
    ],
    melody: [523.25, 587.33, 698.46, 783.99, 880.00], // C5 D5 F5 G5 A5
  },
  deepwork: {
    bpm: 55,
    chords: [
      [98.00,  146.83, 174.61, 233.08], // Gm9    (G D F Bb)
      [77.78,  116.54, 155.56, 196.00], // Ebmaj7 (Eb Bb D G)
      [65.41,  98.00,  146.83, 195.99], // Cm7    (C G D# G)
      [73.42,  110.00, 146.83, 220.00], // D7sus  (D A D A)
    ],
    melody: [392.00, 466.16, 523.25, 587.33], // G4 Bb4 C5 D5
  },
};

export function createAmbientEngine() {
  let ctx = null;
  let masterGain = null;
  let nodes = [];
  let timers = [];
  let playing = false;
  let currentTrack = 'lofi';

  function clearTimers() {
    timers.forEach(id => clearTimeout(id));
    timers = [];
  }

  // ── Pad voices: 4 oscillators whose frequencies glide between chords ──
  function buildPad(progression) {
    const padBus = ctx.createGain();
    padBus.gain.value = 1;

    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 1600;
    warmth.Q.value = 0.4;
    warmth.connect(padBus);
    padBus.connect(masterGain);

    const voiceGains = [0.20, 0.15, 0.12, 0.09];
    const voices = progression.chords[0].map((freq, i) => {
      const osc = ctx.createOscillator();
      const voiceGain = ctx.createGain();

      osc.type = i < 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * (3 + i * 0.6);

      voiceGain.gain.setValueAtTime(0, ctx.currentTime);
      voiceGain.gain.linearRampToValueAtTime(voiceGains[i], ctx.currentTime + 2.5 + i * 0.4);

      osc.connect(voiceGain);
      voiceGain.connect(warmth);
      osc.start();

      nodes.push(osc, voiceGain);
      return osc;
    });

    nodes.push(warmth, padBus);

    // Cycle through the chord progression, gliding each voice's pitch
    const beatSeconds = 60 / progression.bpm;
    const chordSeconds = beatSeconds * 4; // 1 chord per "bar"
    let chordIndex = 0;

    function nextChord() {
      if (!ctx) return;
      chordIndex = (chordIndex + 1) % progression.chords.length;
      const chord = progression.chords[chordIndex];
      voices.forEach((osc, i) => {
        // Smooth glide to the new chord tone — avoids any clicking
        osc.frequency.linearRampToValueAtTime(chord[i], ctx.currentTime + chordSeconds * 0.6);
      });
      timers.push(setTimeout(nextChord, chordSeconds * 1000));
    }
    timers.push(setTimeout(nextChord, chordSeconds * 1000));

    return { chordSeconds, beatSeconds, getChord: () => progression.chords[chordIndex] };
  }

  // ── Rhythm: soft kick + airy hat, gives the music its "pulse" ──
  function buildRhythm(beatSeconds) {
    const rhythmBus = ctx.createGain();
    rhythmBus.gain.value = 0;
    rhythmBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
    rhythmBus.connect(masterGain);
    nodes.push(rhythmBus);

    function playKick(time) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, time);
      osc.frequency.exponentialRampToValueAtTime(38, time + 0.22);
      gain.gain.setValueAtTime(0.16, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);
      osc.connect(gain);
      gain.connect(rhythmBus);
      osc.start(time);
      osc.stop(time + 0.35);
    }

    function playHat(time, soft = false) {
      const bufSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(soft ? 0.015 : 0.03, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

      src.connect(hp);
      hp.connect(gain);
      gain.connect(rhythmBus);
      src.start(time);
    }

    // Slow groove: kick on beats 1 & 3, soft hats on the off-beats —
    // gives a gentle "rise and fall" rhythmic pulse without being busy.
    let beat = 0;
    function scheduleBeat() {
      if (!ctx) return;
      const t = ctx.currentTime + 0.05;
      if (beat % 4 === 0 || beat % 4 === 2) playKick(t);
      playHat(t + beatSeconds * 0.5, beat % 2 === 1);
      beat++;
      timers.push(setTimeout(scheduleBeat, beatSeconds * 1000));
    }
    timers.push(setTimeout(scheduleBeat, beatSeconds * 1000));
  }

  // ── Melody: sparse arpeggio notes that wander over the current chord ──
  function buildMelody(progression, beatSeconds) {
    const melodyBus = ctx.createGain();
    melodyBus.gain.value = 0;
    melodyBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
    melodyBus.connect(masterGain);
    nodes.push(melodyBus);

    function playNote(freq, time, dur) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.05, time + dur * 0.3);
      gain.gain.linearRampToValueAtTime(0, time + dur);
      osc.connect(gain);
      gain.connect(melodyBus);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }

    // Every 2 bars, maybe play a short 2-3 note phrase; otherwise rest.
    // The randomness + rests is what creates a "rise and fall" feel
    // instead of a constant tone.
    function scheduleMelody() {
      if (!ctx) return;
      const barSeconds = beatSeconds * 4;
      if (Math.random() < 0.55) {
        const notes = progression.melody;
        const phraseLen = 1 + Math.floor(Math.random() * 3); // 1-3 notes
        let t = ctx.currentTime + 0.1;
        for (let i = 0; i < phraseLen; i++) {
          const freq = notes[Math.floor(Math.random() * notes.length)];
          playNote(freq, t, beatSeconds * 0.9);
          t += beatSeconds;
        }
      }
      timers.push(setTimeout(scheduleMelody, barSeconds * 2 * 1000));
    }
    timers.push(setTimeout(scheduleMelody, beatSeconds * 4 * 1000));
  }

  // Soft, deeply filtered rain wash — used for "nature" track only.
  function buildRainWash() {
    const bufSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(masterGain);
    src.start();

    nodes.push(src, lp, gain);
  }

  function start(track, volume) {
    if (playing) stop({ immediate: true });

    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2.5);
    masterGain.connect(ctx.destination);

    currentTrack = track;
    const progression = PROGRESSIONS[track] || PROGRESSIONS.lofi;
    const { beatSeconds } = buildPad(progression);
    buildRhythm(beatSeconds);
    buildMelody(progression, beatSeconds);
    if (track === 'nature') buildRainWash();

    playing = true;
    attachVisibilityResume();
  }

  // Some browsers (notably Chrome) suspend AudioContext when a tab is
  // backgrounded for a while, which silently stops the music — and the
  // setTimeout-based chord/rhythm/melody scheduling can also drift.
  // Resume the context the moment the tab becomes visible again.
  let visibilityHandler = null;
  function attachVisibilityResume() {
    if (visibilityHandler || typeof document === 'undefined') return;
    visibilityHandler = () => {
      if (document.visibilityState === 'visible' && ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }
  function detachVisibilityResume() {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  function stop({ immediate = false } = {}) {
    if (!ctx || !masterGain) { playing = false; detachVisibilityResume(); return; }
    playing = false;
    clearTimers();
    detachVisibilityResume();

    const fadeSeconds = immediate ? 0.05 : 1.5;
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSeconds);

    const closingCtx = ctx;
    const closingNodes = nodes;
    nodes = [];
    masterGain = null;
    ctx = null;

    setTimeout(() => {
      closingNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch {} });
      try { closingCtx.close(); } catch {}
    }, immediate ? 60 : 1600);
  }

  function setVolume(volume) {
    if (ctx && masterGain && playing) {
      masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.15);
    }
  }

  function changeTrack(track, volume) {
    if (!playing) { currentTrack = track; return; }
    stop();
    setTimeout(() => start(track, volume), 1600);
  }

  function isPlaying() {
    return playing;
  }

  function getTrack() {
    return currentTrack;
  }

  return { start, stop, setVolume, changeTrack, isPlaying, getTrack };
}