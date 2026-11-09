"use client";

import { ReactNode } from "react";
import type { Part } from "@/lib/check";
import { findMatch } from "@/lib/parse";
import { Range, toSegments } from "@/lib/text";
import type { Word } from "@/lib/types";
import { useApp } from "./AppProvider";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Persian text: always right-to-left, with the Persian font. */
export function Fa({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div dir="rtl" lang="fa" className={`font-fa leading-8 ${className}`}>
      {children}
    </div>
  );
}

const TONES = {
  neutral: "bg-black/5 text-muted",
  accent: "bg-accent-soft text-accent-dark",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
} as const;

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function ErrorBox({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="font-medium underline underline-offset-2">
          Dismiss
        </button>
      )}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card px-6 py-14 text-center">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** The example sentence with the target word highlighted. */
export function Example({ word }: { word: Word }) {
  const m = findMatch(word.example, word.variants);
  const ranges: Range[] = m ? [{ ...m, cls: "mk-hl" }] : [];
  return (
    <>
      {toSegments(word.example, ranges).map((s, i) =>
        s.cls ? (
          <mark key={i} className={s.cls}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}

/** Letters that differ from the right answer are marked. */
export function Diff({ parts, cls }: { parts: Part[]; cls: string }) {
  return (
    <>
      {parts.map((p, i) =>
        p.ok ? (
          <span key={i}>{p.ch}</span>
        ) : (
          <mark key={i} className={cls}>
            {p.ch}
          </mark>
        )
      )}
    </>
  );
}

export function SpeakButton({ text, slow = false, label }: { text: string; slow?: boolean; label?: string }) {
  const { speak, speechOk } = useApp();
  if (!speechOk) return null;
  return (
    <button
      type="button"
      onClick={() => speak(text, slow)}
      aria-label={`${slow ? "Play slowly" : "Play"}: ${text}`}
      className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1.5 text-sm font-medium text-accent-dark transition-colors hover:bg-accent/20"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        {!slow && <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
      {label ?? (slow ? "Slow" : "")}
    </button>
  );
}
