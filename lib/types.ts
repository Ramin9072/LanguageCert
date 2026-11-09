export type ExerciseType = "en-to-fa" | "fa-to-en" | "fill-blank" | "listening";
export type Tab = "import" | "words" | "practice";
export type Accent = "en-US" | "en-GB";

export interface Blank {
  sentence: string; // example sentence with ____ in place of the word
  answer: string; // the exact text that fills the blank (may be an inflected form)
}

export interface Word {
  id: string;
  word: string; // main spelling
  variants: string[]; // accepted spellings, main spelling first (for example colour/color)
  meaning: string; // Persian meaning, written by the user
  example: string; // example sentence written by the user (may be empty)
  blank: Blank | null;
  source?: string; // name of the file the word was imported from
}

export interface WordStat {
  attempts: number;
  correct: number;
  incorrect: number;
  last: number;
}
