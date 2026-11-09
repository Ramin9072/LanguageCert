export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const hasPersian = (t: string) => /[\u0600-\u06FF]/.test(t);

/** Prefix used to recognise inflected forms (plural, -ed, -ing...) of a word. */
function stemOf(word: string): string {
  const w = word.toLowerCase().trim();
  if (/\s/.test(w) || w.length <= 4) return w;
  return w.slice(0, Math.max(4, w.length - 3));
}

/** The word as a whole word (case-insensitive). */
export function exactRegex(word: string): RegExp {
  return new RegExp(`\\b${esc(word.trim()).replace(/\s+/g, "\\s+")}\\b`, "i");
}

/** The word or a regular inflected form of it. Always a fresh regex. */
export function formRegex(word: string): RegExp {
  const w = word.toLowerCase().trim();
  if (/\s/.test(w)) return new RegExp(esc(w).replace(/\s+/g, "\\s+"), "i");
  return new RegExp(`\\b${esc(stemOf(w))}[a-z'’-]*`, "i");
}

export interface Range {
  start: number;
  end: number;
  cls: string;
}

export function toSegments(text: string, ranges: Range[]): { text: string; cls?: string }[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || b.end - a.end);
  const segs: { text: string; cls?: string }[] = [];
  let pos = 0;
  for (const r of sorted) {
    if (r.start < pos) continue;
    if (r.start > pos) segs.push({ text: text.slice(pos, r.start) });
    segs.push({ text: text.slice(r.start, r.end), cls: r.cls });
    pos = r.end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}
