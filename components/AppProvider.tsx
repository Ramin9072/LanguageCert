"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { pickVoice, speak as speakText, speechSupported } from "@/lib/speech";
import type { Accent, Word, WordStat } from "@/lib/types";

const KEY = "wordwise:v2";

interface Stored {
  words: Word[];
  stats: Record<string, WordStat>;
  accent: Accent;
}

const EMPTY: Stored = { words: [], stats: {}, accent: "en-US" };

interface Ctx {
  data: Stored;
  hydrated: boolean;
  addWords: (source: string, words: Word[]) => { added: number; skipped: number; replaced: number };
  removeSource: (source: string) => void;
  clearWords: () => void;
  record: (wordId: string, correct: boolean) => void;
  addMistake: (wordId: string, text: string) => void;
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
        const p = JSON.parse(raw) as Partial<Stored> & { fileName?: string };
        // lists saved by an earlier version have no source name on their words
        const legacy = (typeof p.fileName === "string" && p.fileName) || "Earlier import";
        setData({
          words: Array.isArray(p.words) ? p.words.filter(validWord).map((w) => ({ ...w, source: w.source || legacy })) : [],
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

  // New words are appended to the list. Importing a file with the same name again replaces that file's words,
  // so you can fix a mistake and upload it again. A word that already exists from another file is not added twice.
  const addWords = useCallback(
    (source: string, incoming: Word[]) => {
      const kept = data.words.filter((w) => w.source !== source);
      const have = new Set(kept.map((w) => w.id));
      const fresh = incoming.filter((w) => !have.has(w.id)).map((w) => ({ ...w, source }));
      setData((d) => ({ ...d, words: [...d.words.filter((w) => w.source !== source), ...fresh] }));
      return { added: fresh.length, skipped: incoming.length - fresh.length, replaced: data.words.length - kept.length };
    },
    [data.words]
  );
  const removeSource = useCallback((source: string) => setData((d) => ({ ...d, words: d.words.filter((w) => w.source !== source) })), []);
  const clearWords = useCallback(() => setData((d) => ({ ...d, words: [] })), []);
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
            ...s,
            attempts: s.attempts + 1,
            correct: s.correct + (correct ? 1 : 0),
            incorrect: s.incorrect + (correct ? 0 : 1),
            last: Date.now(),
          },
        },
      };
    });
  }, []);

  // remembers a wrong spelling so it can come back in the "My mistakes" exercise
  const addMistake = useCallback((wordId: string, text: string) => {
    setData((d) => {
      const s = d.stats[wordId] ?? { attempts: 0, correct: 0, incorrect: 0, last: 0 };
      const list = [text, ...(s.mistakes ?? []).filter((m) => m !== text)].slice(0, 6);
      return { ...d, stats: { ...d.stats, [wordId]: { ...s, mistakes: list } } };
    });
  }, []);

  const speak = useCallback((text: string, slow = false) => speakText(text, data.accent, voices, slow), [data.accent, voices]);
  const hasVoice = useMemo(() => !!pickVoice(voices, data.accent), [voices, data.accent]);

  const value = useMemo(
    () => ({ data, hydrated, addWords, removeSource, clearWords, record, addMistake, resetProgress, setAccent, speak, speechOk, hasVoice, storageFull }),
    [data, hydrated, addWords, removeSource, clearWords, record, addMistake, resetProgress, setAccent, speak, speechOk, hasVoice, storageFull]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
