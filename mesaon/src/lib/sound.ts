"use client";

/** Alerta sonoro curto gerado via Web Audio (sem arquivo externo). */
let ctx: AudioContext | null = null;

export async function unlockAudio(): Promise<boolean> {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

export function playChime() {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  [880, 1174.66].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

const KEY = "mesaon:sound-enabled";

export function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSoundPreference(enabled: boolean) {
  try {
    localStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {
    // preferência apenas local; ignora navegação privada
  }
}
