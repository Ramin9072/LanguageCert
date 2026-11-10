"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pushHash, readHash, replaceHash } from "@/lib/nav";
import {
  buildQuestions,
  eligibleWords,
  EXERCISES,
  exerciseTitle,
  isMissed,
  poolFor,
  Question,
  Result,
  Scope,
  Settings,
} from "@/lib/practice";
import { computeStats } from "@/lib/stats";
import type { Tab } from "@/lib/types";
import { useApp } from "./AppProvider";
import PracticeSession from "./PracticeSession";
import { Chip, EmptyState, ErrorBox, Stat } from "./ui";

type Phase = "setup" | "running" | "summary";

export default function Practice({ goTo, onFocusChange }: { goTo: (t: Tab) => void; onFocusChange: (f: boolean) => void }) {
  const { data, hydrated, record, addMistake, resetProgress, speechOk, hasVoice } = useApp();
  const { words, stats: wordStats } = data;
  const stats = useMemo(() => computeStats(words, wordStats), [words, wordStats]);
  const wordMap = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const missedCount = useMemo(() => words.filter((w) => isMissed(wordStats[w.id])).length, [words, wordStats]);

  const [settings, setSettings] = useState<Settings>({ type: "mixed", count: 10, scope: "all", selected: [], autoPlay: true });
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [filter, setFilter] = useState("");
  const [session, setSession] = useState(0);

  const phaseRef = useRef<Phase>("setup");
  phaseRef.current = phase;

  useEffect(() => onFocusChange(phase === "running"), [phase, onFocusChange]);
  useEffect(() => {
    setSettings((s) => ({ ...s, selected: s.selected.filter((id) => wordMap.has(id)) }));
  }, [wordMap]);

  // The browser Back button leaves a running session or the results screen and returns to the setup screen.
  useEffect(() => {
    const onHash = () => {
      const { sub } = readHash();
      if (phaseRef.current === "running" && sub !== "run") setPhase("setup");
      if (phaseRef.current === "summary" && sub !== "done") setPhase("setup");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const backToSetup = useCallback(() => {
    const { sub } = readHash();
    if (sub === "run" || sub === "done") window.history.back();
    setPhase("setup");
  }, []);

  function start(s: Settings = settings) {
    setError("");
    const qs = buildQuestions(words, s, wordStats, speechOk);
    if (qs.length === 0) {
      const pool = poolFor(words, s, wordStats);
      setError(
        s.scope === "selected" && s.selected.length === 0
          ? "Select at least one word to practice."
          : s.scope === "missed" && pool.length === 0
            ? "You have not missed any words yet."
            : s.type === "mistakes"
              ? "No misspelled words yet. This exercise appears after you mistype a word in a typing exercise."
              : s.type === "fill-blank"
                ? "None of these words has an example sentence that contains the word. Add examples to your file."
                : s.type === "listening"
                  ? "Your browser does not support speech, so listening exercises are not available."
                  : s.type === "en-to-fa"
                    ? "This exercise needs at least two words with different meanings."
                    : "No exercises could be built from these words."
      );
      return;
    }
    if (phaseRef.current === "summary") replaceHash("practice/run");
    else pushHash("practice/run");
    setQuestions(qs);
    setResults([]);
    setSession((n) => n + 1);
    setPhase("running");
  }

  if (!hydrated) return null;
  if (words.length === 0) {
    return (
      <EmptyState
        title="Nothing to practice yet"
        text="Practice uses the words from your own list. Upload a word list first."
        action={
          <button className="btn-primary" onClick={() => goTo("import")}>
            Go to import
          </button>
        }
      />
    );
  }

  if (phase === "running") {
    return (
      <PracticeSession
        key={session}
        questions={questions}
        words={wordMap}
        autoPlay={settings.autoPlay}
        onRecord={record}
        onMistake={addMistake}
        onFinish={(r) => {
          setResults(r);
          replaceHash("practice/done");
          setPhase("summary");
        }}
        onExit={backToSetup}
      />
    );
  }

  if (phase === "summary") {
    const correct = results.filter((r) => r.correct).length;
    const missed = Array.from(new Set(results.filter((r) => !r.correct).map((r) => r.wordId)));
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="card p-8 text-center">
          <p className="text-muted">Session complete</p>
          <div className="mt-1 font-display text-7xl">
            {correct}/{results.length}
          </div>
          <p className="mt-1 text-muted">correct on the first try</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn-primary" onClick={() => start()}>
              Practice again
            </button>
            {missed.length > 0 && (
              <button
                className="btn-secondary"
                onClick={() => {
                  const s: Settings = { ...settings, scope: "selected", selected: missed };
                  setSettings(s);
                  start(s);
                }}
              >
                Practice missed words
              </button>
            )}
            <button className="btn-ghost" onClick={backToSetup}>
              ← Back to practice
            </button>
          </div>
        </div>
        {error && <ErrorBox message={error} onClose={() => setError("")} />}
        <div className="card divide-y divide-line">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className={`h-2.5 w-2.5 rounded-full ${r.correct ? "bg-good" : "bg-bad"}`} />
              <span className="font-medium">{wordMap.get(r.wordId)?.word}</span>
              <span className="ml-auto text-sm text-muted">{exerciseTitle(r.type)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- dashboard and settings
  const pool = poolFor(words, settings, wordStats);
  const visible = words.filter((w) => !filter || w.variants.some((v) => v.toLowerCase().includes(filter.toLowerCase())));
  const toggle = (id: string) =>
    setSettings((s) => ({ ...s, selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] }));
  const setScope = (scope: Scope) =>
    setSettings((s) => ({ ...s, scope, selected: scope === "selected" && s.selected.length === 0 ? words.map((x) => x.id) : s.selected }));

  const SCOPES: { id: Scope; label: string; disabled?: boolean }[] = [
    { id: "all", label: `All words (${words.length})` },
    { id: "missed", label: `Words I missed (${missedCount})`, disabled: missedCount === 0 },
    { id: "selected", label: "Only selected words" },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-4xl sm:text-5xl">Practice</h1>
        <p className="mt-1 text-muted">Every exercise is built from your own words, meanings and sentences.</p>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center">
          <h2 className="font-medium">Your progress</h2>
          {stats.completed > 0 && (
            <button
              className="btn-ghost ml-auto !py-1 !px-2"
              onClick={() => confirm("Reset all practice progress, including remembered misspellings, in this browser?") && resetProgress()}
            >
              Reset progress
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Words in your list" value={stats.total} />
          <Stat label="Words practiced" value={stats.practiced} />
          <Stat label="Exercises completed" value={stats.completed} />
          <Stat label="Correct answers" value={stats.correct} />
          <Stat label="Incorrect answers" value={stats.incorrect} />
          <Stat label="Accuracy" value={stats.accuracy === null ? "–" : `${stats.accuracy}%`} />
        </div>
        {stats.needsPractice.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-medium text-muted">Words that need more practice</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.needsPractice.map(({ word, stat }) => (
                <Chip key={word.id} tone="bad">
                  {word.word} · {stat.incorrect} of {stat.attempts} missed
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">These words come up more often in new sessions.</p>
          </div>
        )}
      </section>

      <section className="card space-y-7 p-5 sm:p-6">
        <div>
          <h2 className="mb-3 font-medium">Exercise type</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{ type: "mixed" as const, title: "Mixed", blurb: "A bit of everything, in random order." }, ...EXERCISES].map((e) => {
              const disabled = e.type !== "mixed" && eligibleWords(e.type, pool, words, speechOk, wordStats).length === 0;
              return (
                <button
                  key={e.type}
                  disabled={disabled}
                  onClick={() => setSettings((s) => ({ ...s, type: e.type }))}
                  aria-pressed={settings.type === e.type}
                  className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    settings.type === e.type ? "border-accent bg-accent-soft" : "border-line hover:bg-paper"
                  }`}
                >
                  <div className="font-medium">{e.title}</div>
                  <div className="text-sm text-muted">
                    {disabled
                      ? e.type === "listening"
                        ? "Not available: this browser has no speech support."
                        : e.type === "fill-blank"
                          ? "Not available: no example sentence contains its word."
                          : e.type === "mistakes"
                            ? "Not available yet: it unlocks when you misspell a word while typing."
                            : "Not available for these words."
                      : e.blurb}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-7 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 font-medium">Number of questions</h2>
            <div className="flex gap-2">
              {([5, 10, 20, "all"] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setSettings((s) => ({ ...s, count: n }))}
                  aria-pressed={settings.count === n}
                  className={`flex-1 rounded-xl border py-2.5 font-medium transition-colors ${
                    settings.count === n ? "border-accent bg-accent-soft" : "border-line hover:bg-paper"
                  }`}
                >
                  {n === "all" ? "All" : n}
                </button>
              ))}
            </div>
            {typeof settings.count === "number" && pool.length > 0 && pool.length < settings.count && (
              <p className="mt-2 text-xs text-muted">You have fewer words than questions, so some words will repeat.</p>
            )}
          </div>
          <div>
            <h2 className="mb-3 font-medium">Pronunciation</h2>
            {speechOk ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.autoPlay}
                    onChange={(e) => setSettings((s) => ({ ...s, autoPlay: e.target.checked }))}
                  />
                  Play the word automatically in English to Persian questions
                </label>
                {!hasVoice && (
                  <p className="mt-2 text-xs text-warn">
                    This device has no {data.accent === "en-GB" ? "British" : "American"} English voice installed, so the default English voice is used. You can add voices in your system settings.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">This browser cannot read text aloud. Try Chrome, Edge or Safari.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-medium">Words</h2>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((o) => (
              <button
                key={o.id}
                disabled={o.disabled}
                aria-pressed={settings.scope === o.id}
                onClick={() => setScope(o.id)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  settings.scope === o.id ? "border-accent bg-accent-soft" : "border-line hover:bg-paper"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {settings.scope === "selected" && (
            <div className="mt-3 rounded-xl border border-line p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input className="input !w-auto !py-1.5 !text-sm" placeholder="Filter words" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <span className="text-sm text-muted">{settings.selected.length} selected</span>
                <button className="btn-ghost ml-auto !py-1 !px-2" onClick={() => setSettings((s) => ({ ...s, selected: words.map((w) => w.id) }))}>
                  Select all
                </button>
                <button className="btn-ghost !py-1 !px-2" onClick={() => setSettings((s) => ({ ...s, selected: [] }))}>
                  Clear
                </button>
              </div>
              <div className="flex max-h-56 flex-wrap gap-2 overflow-auto">
                {visible.map((w) => {
                  const on = settings.selected.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      aria-pressed={on}
                      onClick={() => toggle(w.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        on ? "border-accent bg-accent text-white" : "border-line hover:bg-paper"
                      }`}
                    >
                      {w.word}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {error && <ErrorBox message={error} onClose={() => setError("")} />}

        <button className="btn-primary w-full !py-3 text-base sm:w-auto sm:px-10" onClick={() => start()} disabled={pool.length === 0}>
          Start practice
        </button>
      </section>
    </div>
  );
}
