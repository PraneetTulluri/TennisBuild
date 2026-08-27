// Tiny WebAudio-synthesized sound effects - no audio files to source,
// host, or license, just a couple of short oscillator blips. Every call
// site is inside a click/interaction handler, which counts as the user
// gesture browsers require before an AudioContext is allowed to actually
// produce sound, so there's no autoplay-policy issue to work around.

let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

/** A short, quiet blip: `frequency` in Hz, `durationMs` how long it rings out, `volume` 0-1. */
function playTone({ frequency, durationMs, volume, type = "sine" }) {
  const ctx = getAudioContext();
  if (!ctx) return; // WebAudio unavailable (very old browser) - fail silent, no crash

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;

  const now = ctx.currentTime;
  const seconds = durationMs / 1000;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + seconds);
}

/** A short, percussive tick - the wheel spinning, a decision landing. */
export function playTick() {
  playTone({ frequency: 1100, durationMs: 45, volume: 0.05, type: "square" });
}

/** A slightly warmer confirmation blip - picking an attribute, choosing a decision. */
export function playClick() {
  playTone({ frequency: 620, durationMs: 90, volume: 0.06, type: "sine" });
}

/** A brighter, higher chime - a title/trophy moment. */
export function playChime() {
  playTone({ frequency: 1400, durationMs: 220, volume: 0.05, type: "triangle" });
}
