import { exactRegex, formRegex, hasPersian } from "./text";
import type { Blank, Word } from "./types";

export const MAX_FILE_BYTES = 200_000;
export const MAX_WORDS = 500;

export interface Issue {
  line: number;
  level: "error" | "warning";
  message: string;
}

/** Finds the word (or an inflected form) in the example sentence. */
export function findMatch(example: string, variants: string[]): { start: number; end: number } | null {
  const trim = (m: RegExpExecArray) => {
    const text = m[0].replace(/['’-]+$/, "");
    return { start: m.index, end: m.index + text.length };
  };
  for (const v of variants) {
    const m = exactRegex(v).exec(example);
    if (m) return trim(m);
  }
  for (const v of variants) {
    const m = formRegex(v).exec(example);
    if (m && m[0]) return trim(m);
  }
  return null;
}

function toBlank(example: string, variants: string[]): Blank | null {
  const m = findMatch(example, variants);
  if (!m) return null;
  return {
    sentence: example.slice(0, m.start) + "____" + example.slice(m.end),
    answer: example.slice(m.start, m.end),
  };
}

const WORD_OK = /^[A-Za-z][A-Za-z'’.\- ]*$/;

/**
 * Format, one word per line:  word | Persian meaning | example sentence
 * The example is optional. Use word1/word2 for accepted spellings. Lines starting with # are ignored.
 */
export function parseWordList(text: string): { words: Word[]; issues: Issue[] } {
  const words: Word[] = [];
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const add = (line: number, level: Issue["level"], message: string) => issues.push({ line, level, message });

  const lines = text.split("\n");
  for (let idx = 0; idx < lines.length; idx++) {
    const n = idx + 1;
    const line = lines[idx].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    if (words.length >= MAX_WORDS) {
      add(n, "error", `The list is limited to ${MAX_WORDS} words. The rest of the file was ignored.`);
      break;
    }

    const parts = line.split(/\s*\|\s*|\t+/).map((p) => p.trim());
    if (parts.length < 2 || !parts[1]) {
      add(n, "error", "Expected: word | Persian meaning | example sentence");
      continue;
    }
    if (hasPersian(parts[0]) && /^[A-Za-z]/.test(parts[1])) {
      add(n, "error", "Write the English word first, then the Persian meaning.");
      continue;
    }

    const variants = parts[0].split("/").map((v) => v.trim()).filter(Boolean);
    const badVariant = variants.find((v) => !WORD_OK.test(v) || v.length > 40 || v.split(/\s+/).length > 4);
    if (variants.length === 0 || badVariant !== undefined) {
      add(n, "error", `“${parts[0].slice(0, 30)}” is not a valid English word or phrase (letters, spaces, hyphen and apostrophe only; up to 4 words).`);
      continue;
    }

    const word = variants[0];
    const id = word.toLowerCase().replace(/\s+/g, "-");
    if (seen.has(id)) {
      add(n, "warning", `“${word}” appears more than once. Only the first one is used.`);
      continue;
    }
    seen.add(id);

    const meaning = parts[1];
    if (!hasPersian(meaning)) add(n, "warning", `The meaning of “${word}” is not written in Persian.`);

    const example = parts.slice(2).join(" | ").trim();
    let blank: Blank | null = null;
    if (!example) {
      add(n, "warning", `“${word}” has no example sentence, so it will not appear in fill-in-the-blank questions.`);
    } else {
      blank = toBlank(example, variants);
      if (!blank) add(n, "warning", `The example for “${word}” does not contain the word, so it will not appear in fill-in-the-blank questions.`);
    }

    words.push({ id, word, variants, meaning, example, blank });
  }
  return { words, issues };
}
