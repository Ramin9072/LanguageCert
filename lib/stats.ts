import type { Word, WordStat } from "./types";

export interface Stats {
  total: number;
  practiced: number;
  completed: number;
  correct: number;
  incorrect: number;
  accuracy: number | null;
  needsPractice: { word: Word; stat: WordStat }[];
}

/** Dashboard numbers are derived from the per-word stats of the words in the current list. */
export function computeStats(words: Word[], stats: Record<string, WordStat>): Stats {
  let practiced = 0,
    completed = 0,
    correct = 0,
    incorrect = 0;
  const weak: { word: Word; stat: WordStat }[] = [];
  for (const w of words) {
    const s = stats[w.id];
    if (!s || s.attempts === 0) continue;
    practiced++;
    completed += s.attempts;
    correct += s.correct;
    incorrect += s.incorrect;
    if (s.incorrect > 0) weak.push({ word: w, stat: s });
  }
  weak.sort(
    (a, b) =>
      b.stat.incorrect / b.stat.attempts - a.stat.incorrect / a.stat.attempts || b.stat.incorrect - a.stat.incorrect
  );
  return {
    total: words.length,
    practiced,
    completed,
    correct,
    incorrect,
    accuracy: completed ? Math.round((correct / completed) * 100) : null,
    needsPractice: weak.slice(0, 8),
  };
}
