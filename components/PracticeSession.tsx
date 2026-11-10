"use client";

import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { checkTyped, diffChars, norm, plausibleSlip, Verdict } from "@/lib/check";
import { exerciseTitle, Question, Result } from "@/lib/practice";
import type { Word } from "@/lib/types";
import { useApp } from "./AppProvider";
import { Chip, Diff, Example, Fa, SpeakButton } from "./ui";

interface Props {
  questions: Question[];
  words: Map<string, Word>;
  autoPlay: boolean;
  onRecord: (wordId: string, correct: boolean) => void;
  onMistake: (wordId: string, text: string) => void;
  onFinish: (results: Result[]) => void;
  onExit: () => void;
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-muted">{label}</div>
      <div dir="ltr" className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-4 py-3 text-[17px] leading-8">
        {children}
      </div>
    </div>
  );
}

const BANNER = {
  correct: { label: "Correct", cls: "bg-good-soft text-good" },
  almost: { label: "Almost", cls: "bg-warn-soft text-warn" },
  wrong: { label: "Not quite", cls: "bg-bad-soft text-bad" },
} as const;

const OPTION = {
  idle: "border-line hover:bg-paper",
  right: "border-good bg-good-soft",
  wrong: "border-bad bg-bad-soft",
  dim: "border-line opacity-60",
} as const;

export default function PracticeSession({ questions, words, autoPlay, onRecord, onMistake, onFinish, onExit }: Props) {
  const { speak, speechOk, data } = useApp();
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [submitted, setSubmitted] = useState("");
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState("");
  const results = useRef<Result[]>([]);

  const q = questions[i];
  const word = words.get(q.wordId)!;
  const last = i === questions.length - 1;
  const answered = verdict !== null;

  const choiceType = q.type === "en-to-fa" || q.type === "mistakes"; // multiple choice
  const typed = !choiceType;
  const correctOption = q.type === "mistakes" ? word.word : word.meaning;

  // read the word aloud when the question appears
  useEffect(() => {
    if (!speechOk) return;
    if (q.type === "listening" || (q.type === "en-to-fa" && autoPlay)) {
      const t = setTimeout(() => speak(word.word), 250);
      return () => clearTimeout(t);
    }
  }, [i, speechOk]); // eslint-disable-line react-hooks/exhaustive-deps

  function finish(v: Verdict, given: string) {
    setVerdict(v);
    setSubmitted(given);
    if (attempt === 1) {
      // only the first attempt counts toward your progress; retries are for learning
      const correct = v.kind === "correct";
      onRecord(word.id, correct);
      results.current.push({ wordId: word.id, type: q.type, correct });
    }
  }

  function pick(idx: number) {
    if (answered) return;
    const given = q.options![idx];
    setChoice(idx);
    finish({ kind: given === correctOption ? "correct" : "wrong", target: correctOption }, given);
  }

  function submit() {
    const a = answer.trim();
    if (!a) return setError("Type your answer first.");
    setError("");
    const fill = q.type === "fill-blank";
    const accepted = fill ? [word.blank!.answer] : word.variants;
    const v = checkTyped(a, accepted, fill ? word.variants : []);
    finish(v, a);
    // remember wrong spellings of the word itself, so they can be tested later in "My mistakes"
    const sameForm = !fill || word.variants.some((x) => norm(x) === norm(word.blank!.answer));
    if (v.kind !== "correct" && sameForm && plausibleSlip(a, v.target, word.variants)) onMistake(word.id, norm(a));
  }

  function reset() {
    setAnswer("");
    setChoice(null);
    setVerdict(null);
    setSubmitted("");
    setError("");
  }

  function retry() {
    reset();
    setAttempt((n) => n + 1);
  }

  function next() {
    if (last) return onFinish(results.current);
    reset();
    setI(i + 1);
    setAttempt(1);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !answered) {
      e.preventDefault();
      submit();
    }
  }

  let prompt: ReactNode;
  if (q.type === "en-to-fa") {
    prompt = (
      <>
        <div className="text-sm text-muted">Choose the Persian meaning of</div>
        <div dir="ltr" className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-display text-6xl leading-tight">{word.word}</span>
          <SpeakButton text={word.word} />
          <SpeakButton text={word.word} slow />
        </div>
      </>
    );
  } else if (q.type === "fa-to-en") {
    prompt = (
      <>
        <div className="text-sm text-muted">Type the English word for</div>
        <Fa className="mt-2 text-4xl font-medium">{word.meaning}</Fa>
      </>
    );
  } else if (q.type === "fill-blank") {
    const [a, b] = word.blank!.sentence.split("____");
    prompt = (
      <>
        <div className="text-sm text-muted">Type the missing word</div>
        <p dir="ltr" className="mt-2 text-2xl leading-10">
          {a}
          <span className="mx-1 inline-block w-28 border-b-2 border-accent align-baseline">&nbsp;</span>
          {b}
        </p>
        <Fa className="mt-2 text-lg text-muted">
          <span className="text-sm">راهنما: </span>
          {word.meaning}
        </Fa>
      </>
    );
  } else if (q.type === "mistakes") {
    prompt = (
      <>
        <div className="text-sm text-muted">Which spelling is correct?</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Fa className="text-3xl font-medium">{word.meaning}</Fa>
          <SpeakButton text={word.word} />
        </div>
      </>
    );
  } else {
    prompt = (
      <>
        <div className="text-sm text-muted">Listen and type the word you hear</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SpeakButton text={word.word} label="Listen" />
          <SpeakButton text={word.word} slow />
        </div>
        {word.example && (
          <div className="mt-4 rounded-xl bg-paper px-4 py-3 text-sm text-ink/80">
            <div className="mb-2">Tip: if the word is hard to understand, hear it inside a sentence.</div>
            <SpeakButton text={word.example} label="Play it in a sentence" />
          </div>
        )}
      </>
    );
  }

  const showDiff = verdict && (typed || q.type === "mistakes") && verdict.kind !== "correct";
  const diff = showDiff ? diffChars(submitted, verdict.target) : null;
  const banner = verdict ? BANNER[verdict.kind] : null;
  const wroteBefore =
    q.type === "mistakes" && verdict?.kind === "wrong" && (data.stats[word.id]?.mistakes ?? []).includes(norm(submitted));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button className="btn-ghost !px-2" onClick={() => confirm("Leave this session? Answers you already gave are saved.") && onExit()}>
          ← Back
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((i + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted">
          {i + 1} / {questions.length}
        </span>
      </div>

      <div className="card p-6 sm:p-8">
        <div className="mb-5">
          <Chip tone="accent">{exerciseTitle(q.type)}</Chip>
        </div>

        {prompt}

        {choiceType && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.options!.map((opt, idx) => {
              const s = !answered ? "idle" : opt === correctOption ? "right" : idx === choice ? "wrong" : "dim";
              return (
                <button
                  key={idx}
                  disabled={answered}
                  onClick={() => pick(idx)}
                  className={`rounded-xl border px-4 py-3 text-center text-lg transition-colors ${OPTION[s]}`}
                >
                  {q.type === "mistakes" ? (
                    <span dir="ltr" className="text-xl">
                      {opt}
                    </span>
                  ) : (
                    <Fa>{opt}</Fa>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {typed && !answered && (
          <div className="mt-6 space-y-4">
            <input
              key={`${q.id}-${attempt}`}
              dir="ltr"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type your answer"
              className="input text-xl"
            />
            {error && <p className="text-sm text-bad">{error}</p>}
            <button className="btn-primary" onClick={submit} disabled={!answer.trim()}>
              Submit answer
            </button>
          </div>
        )}

        {answered && verdict && banner && (
          <div className="mt-6 space-y-4 border-t border-line pt-6">
            <div className={`rounded-xl px-4 py-3 text-lg font-semibold ${banner.cls}`}>{banner.label}</div>

            {(typed || q.type === "mistakes") && verdict.kind !== "correct" && (
              <Block label={q.type === "mistakes" ? "You chose" : "Your answer"}>
                {diff ? <Diff parts={diff.typed} cls="mk-err" /> : submitted}
              </Block>
            )}
            {wroteBefore && <p className="text-sm text-warn">This is a spelling you wrote wrong before. Look at the marked letters.</p>}
            {(typed || q.type === "mistakes") && (
              <Block label="Correct answer">
                {q.type === "fill-blank" ? (
                  <span>
                    {word.blank!.sentence.split("____")[0]}
                    <mark className="mk-ok">{word.blank!.answer}</mark>
                    {word.blank!.sentence.split("____")[1]}
                  </span>
                ) : diff ? (
                  <Diff parts={diff.target} cls="mk-ok" />
                ) : (
                  <span className="font-medium">{verdict.target}</span>
                )}
                <SpeakButton text={q.type === "fill-blank" ? word.example : word.word} />
              </Block>
            )}
            {verdict.note && <p className="text-sm text-ink/80">{verdict.note}</p>}

            <div className="rounded-xl border border-line p-4">
              <div dir="ltr" className="flex flex-wrap items-center gap-2">
                <span className="font-display text-3xl leading-none">{word.variants.join(" / ")}</span>
                <SpeakButton text={word.word} />
                <SpeakButton text={word.word} slow />
              </div>
              <Fa className="mt-2 text-lg font-medium">{word.meaning}</Fa>
              {word.example && (
                <div className="mt-2 flex items-start gap-2">
                  <p dir="ltr" className="flex-1 text-[15px] italic text-ink/80">
                    <Example word={word} />
                  </p>
                  <SpeakButton text={word.example} />
                </div>
              )}
            </div>

            {attempt > 1 && <p className="text-xs text-muted">Retries are for learning and do not change your progress.</p>}
            <div className="flex flex-wrap gap-3">
              {verdict.kind !== "correct" && (
                <button className="btn-secondary" onClick={retry}>
                  Try again
                </button>
              )}
              <button className="btn-primary" onClick={next} autoFocus={verdict.kind === "correct"}>
                {last ? "See results" : "Next exercise"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
