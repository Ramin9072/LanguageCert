"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { pickVoice, speak as speakText, speechSupported } from "@/lib/speech";
import type { Accent, Word, WordStat } from "@/lib/types";

const KEY = "wordwise:v2";

interface Stored {
  fileName: string;
  words: Word[];
  stats: Record<string, WordStat>;
  accent: Accent;
}

const EMPTY: Stored = { fileName: "", words: [], stats: {}, accent: "en-US" };

interface Ctx {
  data: Stored;
  hydrated: boolean;
  saveWords: (fileName: string, words: Word[]) => void;
  clearWords: () => void;
  record: (wordId: string, correct: boolean) => void;
  resetProgress: () => void;
  setAccent: (a: Accent) => void;
  speak: (text: string, slow?: boolean) => void;
  speechOk: boolean;
  hasVoice: boolean;
  storageFull: boolean;
}

const AppContext = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

const validWord = (w: unknown): w is Word => {
  const o = w as Partial<Word> | null;
  return (
    !!o &&
    typeof o.id === "string" &&
    typeof o.word === "string" &&
    typeof o.meaning === "string" &&
    typeof o.example === "string" &&
    Array.isArray(o.variants)
  );
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Stored>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [storageFull, setStorageFull] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechOk, setSpeechOk] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Stored>;
        setData({
          fileName: typeof p.fileName === "string" ? p.fileName : "",
          words: Array.isArray(p.words) ? p.words.filter(validWord) : [],
          stats: p.stats && typeof p.stats === "object" ? p.stats : {},
          accent: p.accent === "en-GB" ? "en-GB" : "en-US",
        });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      setStorageFull(false);
    } catch {
      setStorageFull(true);
    }
  }, [data, hydrated]);

  // browsers load their voice list asynchronously
  useEffect(() => {
    if (!speechSupported()) return;
    setSpeechOk(true);
    const synth = window.speechSynthesis;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.addEventListener("voiceschanged", update);
    return () => synth.removeEventListener("voiceschanged", update);
  }, []);

  const saveWords = useCallback((fileName: string, words: Word[]) => setData((d) => ({ ...d, fileName, words })), []);
  const clearWords = useCallback(() => setData((d) => ({ ...d, fileName: "", words: [] })), []);
  const setAccent = useCallback((accent: Accent) => setData((d) => ({ ...d, accent })), []);
  const resetProgress = useCallback(() => setData((d) => ({ ...d, stats: {} })), []);

  const record = useCallback((wordId: string, correct: boolean) => {
    setData((d) => {
      const s = d.stats[wordId] ?? { attempts: 0, correct: 0, incorrect: 0, last: 0 };
      return {
        ...d,
        stats: {
          ...d.stats,
          [wordId]: {
            attempts: s.attempts + 1,
            correct: s.correct + (correct ? 1 : 0),
            incorrect: s.incorrect + (correct ? 0 : 1),
            last: Date.now(),
          },
        },
      };
    });
  }, []);

  const speak = useCallback((text: string, slow = false) => speakText(text, data.accent, voices, slow), [data.accent, voices]);
  const hasVoice = useMemo(() => !!pickVoice(voices, data.accent), [voices, data.accent]);

  const value = useMemo(
    () => ({ data, hydrated, saveWords, clearWords, record, resetProgress, setAccent, speak, speechOk, hasVoice, storageFull }),
    [data, hydrated, saveWords, clearWords, record, resetProgress, setAccent, speak, speechOk, hasVoice, storageFull]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
