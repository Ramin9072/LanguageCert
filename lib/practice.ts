import { norm } from "./check";
import type { ExerciseType, Word, WordStat } from "./types";

export type ExerciseChoice = ExerciseType | "mixed";
export type Scope = "all" | "selected" | "missed";

export interface Settings {
  type: ExerciseChoice;
  count: 5 | 10 | 20 | "all";
  scope: Scope;
  selected: string[];
  autoPlay: boolean;
}

export interface Question {
  id: string;
  type: ExerciseType;
  wordId: string;
  options?: string[]; // Persian meanings (en-to-fa) or spellings (mistakes)
}

export interface Result {
  wordId: string;
  type: ExerciseType;
  correct: boolean;
}

export const EXERCISES: { type: ExerciseType; title: string; blurb: string }[] = [
  { type: "en-to-fa", title: "English to Persian", blurb: "See a word, choose its Persian meaning." },
  { type: "fa-to-en", title: "Persian to English", blurb: "See the meaning, type the English word." },
  { type: "fill-blank", title: "Fill in the blank", blurb: "Complete your own example sentence." },
  { type: "listening", title: "Listening", blurb: "Hear the word, type how it is spelled." },
  { type: "mistakes", title: "My mistakes", blurb: "Pick the right spelling among ones you wrote wrong before." },
];

export const exerciseTitle = (t: ExerciseType) => EXERCISES.find((e) => e.type === t)!.title;

/** Wrong spellings you typed before, without any that are really accepted spellings. */
export const ownMistakes = (w: Word, stat?: WordStat): string[] =>
  (stat?.mistakes ?? []).filter((m) => !w.variants.some((v) => norm(v) === norm(m)));

export const isMissed = (stat?: WordStat): boolean => !!stat && (stat.incorrect > 0 || (stat.mistakes?.length ?? 0) > 0);

export function poolFor(all: Word[], s: Pick<Settings, "scope" | "selected">, stats: Record<string, WordStat>): Word[] {
  if (s.scope === "selected") return all.filter((w) => s.selected.includes(w.id));
  if (s.scope === "missed") return all.filter((w) => isMissed(stats[w.id]));
  return all;
}

export function eligibleWords(
  type: ExerciseType,
  pool: Word[],
  all: Word[],
  speechOk: boolean,
  stats: Record<string, WordStat>
): Word[] {
  switch (type) {
    case "en-to-fa":
      return new Set(all.map((w) => w.meaning)).size >= 2 ? pool : [];
    case "fa-to-en":
      return pool;
    case "fill-blank":
      return pool.filter((w) => w.blank);
    case "listening":
      return speechOk ? pool : [];
    case "mistakes":
      return pool.filter((w) => ownMistakes(w, stats[w.id]).length > 0);
  }
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Typical misspellings of a word (swapped, missing, doubled or wrong letters), used to fill out the spelling choices. */
export function nearMisses(word: string): string[] {
  const out = new Set<string>();
  const isL = (c: string) => /[a-z]/i.test(c);
  for (let i = 0; i < word.length - 1; i++) {
    if (isL(word[i]) && isL(word[i + 1]) && word[i] !== word[i + 1]) {
      out.add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
    }
  }
  for (let i = 1; i < word.length; i++) {
    if (!isL(word[i])) continue;
    out.add(word.slice(0, i) + word.slice(i + 1)); // missing letter
    if (word[i] !== word[i - 1]) out.add(word.slice(0, i) + word[i] + word.slice(i)); // doubled letter
  }
  const vowels: Record<string, string> = { a: "e", e: "a", i: "e", o: "u", u: "o" };
  for (let i = 1; i < word.length; i++) {
    const r = vowels[word[i]];
    if (r) out.add(word.slice(0, i) + r + word.slice(i + 1));
  }
  out.delete(word);
  return Array.from(out);
}

// words you got wrong come back more often; words you have never practiced get a small boost
function weight(stat?: WordStat): number {
  if (!stat || stat.attempts === 0) return 1.5;
  return 1 + 2 * (stat.incorrect / stat.attempts);
}

function weightedSample(pool: Word[], n: number, stats: Record<string, WordStat>): Word[] {
  const left = [...pool];
  const out: Word[] = [];
  while (out.length < n && left.length) {
    const ws = left.map((w) => weight(stats[w.id]));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    let idx = 0;
    for (; idx < ws.length - 1; idx++) {
      r -= ws[idx];
      if (r <= 0) break;
    }
    out.push(left.splice(idx, 1)[0]);
  }
  return out;
}

export function buildQuestions(
  all: Word[],
  s: Settings,
  stats: Record<string, WordStat>,
  speechOk: boolean
): Question[] {
  const pool = poolFor(all, s, stats);
  const types: ExerciseType[] = s.type === "mixed" ? EXERCISES.map((e) => e.type) : [s.type];
  const eligible = new Map(types.map((t) => [t, new Set(eligibleWords(t, pool, all, speechOk, stats).map((w) => w.id))]));
  const usable = pool.filter((w) => types.some((t) => eligible.get(t)!.has(w.id)));
  if (usable.length === 0) return [];

  const n = s.count === "all" ? Math.min(usable.length, 100) : s.count;
  // a round never repeats a word; if you ask for more questions than words, another round starts
  const chosen: Word[] = [];
  while (chosen.length < n) chosen.push(...weightedSample(usable, n - chosen.length, stats));

  const used = new Map<ExerciseType, number>(types.map((t) => [t, 0]));
  return chosen.map((w, i) => {
    const options = shuffle(types.filter((t) => eligible.get(t)!.has(w.id)));
    // Mixed mode: take the exercise type used least so far, so the session stays varied
    const type = options.sort((a, b) => used.get(a)! - used.get(b)!)[0];
    used.set(type, used.get(type)! + 1);
    const q: Question = { id: `q${i}`, type, wordId: w.id };
    if (type === "en-to-fa") {
      const others = Array.from(new Set(all.map((x) => x.meaning).filter((m) => m !== w.meaning)));
      q.options = shuffle([w.meaning, ...shuffle(others).slice(0, 3)]);
    }
    if (type === "mistakes") {
      // your own earlier wrong spellings first; typical misspellings fill the remaining places
      const own = shuffle(ownMistakes(w, stats[w.id])).slice(0, 3);
      const extra = shuffle(nearMisses(w.word))
        .filter((x) => !own.includes(x.toLowerCase()) && !w.variants.some((v) => norm(v) === norm(x)))
        .slice(0, 3 - own.length);
      q.options = shuffle([w.word, ...own, ...extra]);
    }
    return q;
  });
}

