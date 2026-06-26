// Small Web Audio helper for notification chimes (no audio files needed).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Browsers suspend audio until a user gesture — call this on first interaction.
export function primeAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}

function tone(
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = "sine"
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(c.destination);
  const t = c.currentTime + startAt;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration);
}

// New message: two quick rising tones.
export function playMessageSound() {
  primeAudio();
  tone(660, 0, 0.15);
  tone(880, 0.12, 0.18);
}

// New / bulk student: a different, lower two-tone marimba-like chime.
export function playStudentSound() {
  primeAudio();
  tone(523.25, 0, 0.14, "triangle");
  tone(392, 0.11, 0.22, "triangle");
}
