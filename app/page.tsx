"use client";

import { useEffect, useRef, useState } from "react";
import { AppProvider, useApp } from "@/components/AppProvider";
import ImportView from "@/components/ImportView";
import Practice from "@/components/Practice";
import WordsView from "@/components/WordsView";
import type { Accent, Tab } from "@/lib/types";

const TABS: { id: Tab; label: string }[] = [
  { id: "import", label: "Import" },
  { id: "words", label: "Words" },
  { id: "practice", label: "Practice" },
];

const ACCENTS: { id: Accent; label: string; title: string }[] = [
  { id: "en-US", label: "US", title: "American English voice" },
  { id: "en-GB", label: "UK", title: "British English voice" },
];

function Shell() {
  const [tab, setTab] = useState<Tab>("import");
  const [focus, setFocus] = useState(false);
  const { data, hydrated, setAccent, speechOk } = useApp();

  // returning users with a saved list start on Practice
  const started = useRef(false);
  useEffect(() => {
    if (hydrated && !started.current) {
      started.current = true;
      if (data.words.length > 0) setTab("practice");
    }
  }, [hydrated, data.words.length]);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink font-display text-2xl leading-none text-white">W</span>
            <span className="font-display text-3xl leading-none">WordWise</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {!focus && (
              <nav aria-label="Sections" className="flex gap-1 rounded-xl bg-black/5 p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => go(t.id)}
                    aria-current={tab === t.id ? "page" : undefined}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-5 ${
                      tab === t.id ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {t.label}
                    {t.id === "words" && data.words.length > 0 && <span className="ml-1.5 text-xs text-muted">{data.words.length}</span>}
                  </button>
                ))}
              </nav>
            )}
            {speechOk && (
              <div role="group" aria-label="Accent" className="flex gap-1 rounded-xl bg-black/5 p-1">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    title={a.title}
                    aria-pressed={data.accent === a.id}
                    onClick={() => setAccent(a.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      data.accent === a.id ? "bg-accent text-white" : "text-muted hover:text-ink"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {/* all sections stay mounted so a running practice session survives tab switches */}
        <div hidden={tab !== "import"}>
          <ImportView goTo={go} />
        </div>
        <div hidden={tab !== "words"}>
          <WordsView goTo={go} />
        </div>
        <div hidden={tab !== "practice"}>
          <Practice goTo={go} onFocusChange={setFocus} />
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
