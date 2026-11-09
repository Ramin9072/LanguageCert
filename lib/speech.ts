import type { Accent } from "./types";

export const speechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

const langOf = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();

/** Picks the best installed voice for the accent, or null if the device has none. */
export function pickVoice(voices: SpeechSynthesisVoice[], accent: Accent): SpeechSynthesisVoice | null {
  const list = voices.filter((v) => langOf(v) === accent.toLowerCase());
  if (list.length === 0) return null;
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 3 : 0) + (/google|microsoft|samantha|daniel|serena|karen/i.test(v.name) ? 1 : 0);
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

export function speak(text: string, accent: Accent, voices: SpeechSynthesisVoice[], slow = false): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(voices, accent);
  if (voice) u.voice = voice;
  u.lang = accent;
  u.rate = slow ? 0.6 : 0.95;
  synth.speak(u);
}
