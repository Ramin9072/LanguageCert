"use client";

import { useMemo, useState } from "react";
import type { Tab } from "@/lib/types";
import { ownMistakes } from "@/lib/practice";
import { useApp } from "./AppProvider";
import { Chip, EmptyState, Example, Fa, SpeakButton } from "./ui";

export default function WordsView({ goTo }: { goTo: (t: Tab) => void }) {
  const { data, hydrated } = useApp();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"file" | "az" | "weak">("file");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = data.words.filter((w) => !needle || w.variants.some((v) => v.toLowerCase().includes(needle)) || w.meaning.includes(needle));
    if (sort === "az") out = [...out].sort((a, b) => a.word.localeCompare(b.word));
    if (sort === "weak") {
      const rate = (id: string) => {
        const s = data.stats[id];
        return s && s.attempts ? s.incorrect / s.attempts : -1;
      };
      out = [...out].sort((a, b) => rate(b.id) - rate(a.id));
    }
    return out;
  }, [data.words, data.stats, q, sort]);

  if (!hydrated) return null;
  if (data.words.length === 0) {
    return (
      <EmptyState
        title="No words yet"
        text="Upload your word list first. Your words will appear here, and you can listen to each one."
        action={
          <button className="btn-primary" onClick={() => goTo("import")}>
            Go to import
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="font-display text-4xl sm:text-5xl">Words</h1>
          <p className="mt-1 text-muted">{data.words.length} words from your list</p>
        </div>
        <button className="btn-primary" onClick={() => goTo("practice")}>
          Practice these words
        </button>
      </section>

      <section className="flex flex-wrap gap-3">
        <input
          className="input !w-auto min-w-[14rem] flex-1"
          placeholder="Search English or Persian"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          dir="auto"
        />
        <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="file">Order in file</option>
          <option value="az">A to Z</option>
          <option value="weak">Needs practice first</option>
        </select>
      </section>

      {list.length === 0 ? (
        <p className="py-10 text-center text-muted">No words match your search.</p>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {list.map((w) => {
            const s = data.stats[w.id];
            return (
              <article key={w.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-3xl leading-none" dir="ltr">
                    {w.variants.join(" / ")}
                  </h2>
                  <SpeakButton text={w.word} />
                  <SpeakButton text={w.word} slow />
                  {s && s.attempts > 0 && (
                    <span className="ml-auto">
                      <Chip tone={s.incorrect > s.correct ? "bad" : "good"}>
                        {s.correct}/{s.attempts} correct
                      </Chip>
                    </span>
                  )}
                </div>
                <Fa className="mt-3 text-xl font-medium">{w.meaning}</Fa>
                {ownMistakes(w, s).length > 0 && (
                  <p dir="ltr" className="mt-2 text-sm text-bad">
                    You wrote: {ownMistakes(w, s).join(", ")}
                  </p>
                )}
                {w.example && (
                  <div className="mt-3 flex items-start gap-2 border-l-2 border-line pl-3">
                    <p dir="ltr" className="flex-1 text-[15px] italic text-ink/80">
                      <Example word={w} />
                    </p>
                    <SpeakButton text={w.example} />
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
