// import type { Accent } from "./types";

// export const speechSupported = () =>
//   typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

// const langOf = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();

// /** Picks the best installed voice for the accent, or null if the device has none. */
// export function pickVoice(voices: SpeechSynthesisVoice[], accent: Accent): SpeechSynthesisVoice | null {
//   const list = voices.filter((v) => langOf(v) === accent.toLowerCase());
//   if (list.length === 0) return null;
//   const score = (v: SpeechSynthesisVoice) =>
//     (/natural|neural|online/i.test(v.name) ? 3 : 0) + (/google|microsoft|samantha|daniel|serena|karen/i.test(v.name) ? 1 : 0);
//   return [...list].sort((a, b) => score(b) - score(a))[0];
// }

// export function speak(text: string, accent: Accent, voices: SpeechSynthesisVoice[], slow = false): void {
//   if (!speechSupported()) return;
//   const synth = window.speechSynthesis;
//   synth.cancel();
//   const u = new SpeechSynthesisUtterance(text);
//   const voice = pickVoice(voices, accent);
//   if (voice) u.voice = voice;
//   u.lang = accent;
//   u.rate = slow ? 0.6 : 0.95;
//   synth.speak(u);
// }



import type { Accent } from "./types";

export const speechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

const langOf = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();

/** Preferred voice names per accent, best first. */
const PREFERRED: Record<string, RegExp[]> = {
  "en-gb": [
    /sonia.*natural/i,
    /ryan.*natural/i,
    /libby.*natural/i,
    /maisie.*natural/i,
    /thomas.*natural/i,
    /google uk english female/i,
    /google uk english male/i,
    /serena/i,
    /kate/i,
    /daniel/i,
    /oliver/i,
    /stephanie/i,
  ],
  "en-us": [
    /aria.*natural/i,
    /jenny.*natural/i,
    /guy.*natural/i,
    /google us english/i,
    /samantha/i,
    /ava/i,
    /allison/i,
    /nicky/i,
    /karen/i,
  ],
};

/** Robotic / novelty voices that should only be used if nothing else exists. */
const BAD =
  /espeak|compact|albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|organ|trinoids|whisper|zarvox|fred|junior|ralph|superstar/i;

function score(v: SpeechSynthesisVoice, accent: string): number {
  if (BAD.test(v.name)) return -100;
  let s = 0;
  if (/natural|neural|online/i.test(v.name)) s += 60; // Edge neural voices
  if (/premium|enhanced/i.test(v.name)) s += 40; // Apple high-quality voices
  if (/google/i.test(v.name)) s += 30; // Chrome's Google voices
  const idx = (PREFERRED[accent] ?? []).findIndex((r) => r.test(v.name));
  if (idx >= 0) s += 50 - idx * 3;
  return s;
}

/** Picks the best installed voice for the accent, or null if the device has none. */
export function pickVoice(voices: SpeechSynthesisVoice[], accent: Accent): SpeechSynthesisVoice | null {
  const a = accent.toLowerCase();
  const list = voices.filter((v) => langOf(v) === a);
  if (list.length === 0) return null;
  return [...list].sort((x, y) => score(y, a) - score(x, a))[0];
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