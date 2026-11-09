export const norm = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export interface Verdict {
  kind: "correct" | "almost" | "wrong";
  target: string; // the accepted answer that was matched or is closest
  note?: string;
}

/** Rule-based check of a typed answer. `baseForms` are spellings that are the right word in the wrong form. */
export function checkTyped(answer: string, accepted: string[], baseForms: string[] = []): Verdict {
  const a = norm(answer);
  const exact = accepted.find((t) => norm(t) === a);
  if (exact) return { kind: "correct", target: exact };

  if (baseForms.some((b) => norm(b) === a)) {
    return {
      kind: "almost",
      target: accepted[0],
      note: `That is the right word, but the sentence needs the form “${accepted[0]}”.`,
    };
  }

  let best = accepted[0];
  let bestD = Infinity;
  for (const t of accepted) {
    const d = levenshtein(a, norm(t));
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  const len = norm(best).length;
  const allowed = len >= 8 ? 2 : len >= 4 ? 1 : 0;
  if (bestD > 0 && bestD <= allowed) {
    return { kind: "almost", target: best, note: "Very close. Check the spelling." };
  }
  return { kind: "wrong", target: best };
}

export interface Part {
  ch: string;
  ok: boolean;
}

/** Marks the letters that differ between what was typed and the right answer (longest common subsequence). */
export function diffChars(typed: string, target: string): { typed: Part[]; target: Part[] } {
  const x = typed.toLowerCase();
  const y = target.toLowerCase();
  const m = x.length;
  const n = y.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const t: Part[] = typed.split("").map((ch) => ({ ch, ok: false }));
  const g: Part[] = target.split("").map((ch) => ({ ch, ok: false }));
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (x[i] === y[j]) {
      t[i].ok = true;
      g[j].ok = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { typed: t, target: g };
}
