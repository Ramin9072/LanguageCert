"use client";

import { DragEvent, useRef, useState } from "react";
import { Issue, MAX_FILE_BYTES, parseWordList } from "@/lib/parse";
import { SAMPLE_TEXT } from "@/lib/sample";
import type { Tab } from "@/lib/types";
import { useApp } from "./AppProvider";
import { Chip, ErrorBox, Fa } from "./ui";

export default function ImportView({ goTo }: { goTo: (t: Tab) => void }) {
  const { data, hydrated, saveWords, clearWords, storageFull } = useApp();
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function load(name: string, text: string) {
    const { words, issues } = parseWordList(text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"));
    setIssues(issues);
    if (words.length === 0) {
      setError("No valid words were found in this file. Check the format below and the problems listed.");
      return;
    }
    setError("");
    saveWords(name, words);
  }

  async function accept(files: FileList | File[] | null) {
    setError("");
    setIssues([]);
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    if (list.length > 1) return setError("Please upload exactly one .txt file.");
    const f = list[0];
    if (!/\.txt$/i.test(f.name)) return setError("Only .txt files are supported.");
    if (f.size === 0) return setError("This file is empty.");
    if (f.size > MAX_FILE_BYTES) {
      return setError(`This file is ${Math.round(f.size / 1024)} KB. The maximum is ${Math.round(MAX_FILE_BYTES / 1024)} KB.`);
    }
    let text: string;
    try {
      text = await f.text();
    } catch {
      return setError("The file could not be read.");
    }
    if (text.includes("\uFFFD") || text.includes("\u0000")) {
      return setError("The file is not saved as UTF-8, so Persian letters are broken. Save it again with encoding UTF-8 and upload it again.");
    }
    load(f.name, text);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files);
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + SAMPLE_TEXT], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "wordwise-sample.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const withBlank = data.words.filter((w) => w.blank).length;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-4xl sm:text-5xl">Turn your word list into quizzes</h1>
        <p className="mt-2 max-w-xl text-muted">
          Upload a .txt file with your words, their Persian meanings and example sentences. WordWise builds the exercises and reads the words aloud in an English accent.
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? "border-accent bg-accent-soft" : "border-line"
          }`}
        >
          <p className="text-lg font-medium">Drop your .txt file here</p>
          <p className="mt-1 text-sm text-muted">One UTF-8 text file, up to {Math.round(MAX_FILE_BYTES / 1024)} KB.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button className="btn-primary" onClick={() => inputRef.current?.click()}>
              {data.words.length ? "Replace file" : "Choose a file"}
            </button>
            <button className="btn-secondary" onClick={() => load("sample.txt", SAMPLE_TEXT)}>
              Try the sample words
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            accept(e.target.files);
            e.target.value = "";
          }}
        />
        {error && (
          <div className="mt-4">
            <ErrorBox message={error} onClose={() => setError("")} />
          </div>
        )}
      </section>

      {storageFull && <ErrorBox message="Your browser storage is full, so your word list and progress may not be saved." />}

      {hydrated && data.words.length > 0 && (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h2 className="font-medium">{data.fileName || "Your word list"}</h2>
              <p className="text-sm text-muted">
                {data.words.length} words ready · {withBlank} with a usable example sentence
              </p>
            </div>
            <button className="btn-primary" onClick={() => goTo("practice")}>
              Start practice
            </button>
            <button className="btn-secondary" onClick={() => goTo("words")}>
              View words
            </button>
            <button className="btn-ghost" onClick={() => confirm("Remove this word list? Your progress for these words is kept.") && clearWords()}>
              Remove list
            </button>
          </div>
          {issues.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-2 flex gap-2">
                {errors.length > 0 && <Chip tone="bad">{errors.length} lines skipped</Chip>}
                {warnings.length > 0 && <Chip tone="warn">{warnings.length} warnings</Chip>}
              </div>
              <ul className="max-h-56 space-y-1 overflow-auto text-sm">
                {issues.slice(0, 50).map((i, k) => (
                  <li key={k} className={i.level === "error" ? "text-bad" : "text-warn"}>
                    <span className="tabular-nums">Line {i.line}:</span> {i.message}
                  </li>
                ))}
              </ul>
              {issues.length > 50 && <p className="mt-1 text-xs text-muted">And {issues.length - 50} more.</p>}
            </div>
          )}
        </section>
      )}

      <section className="card p-5 sm:p-6">
        <div className="mb-3 flex items-center">
          <h2 className="mr-auto font-medium">File format</h2>
          <button className="btn-secondary !py-1.5" onClick={downloadSample}>
            Download sample file
          </button>
        </div>
        <Fa className="text-[15px] text-ink/80">
          هر کلمه در یک خط جداگانه نوشته می‌شود و بخش‌ها با علامت <span dir="ltr">|</span> از هم جدا می‌شوند: کلمه انگلیسی، معنی فارسی، جمله مثال.
          جمله مثال اختیاری است، ولی فقط کلمه‌هایی که جمله دارند در تمرین جای‌خالی می‌آیند. جمله باید خود کلمه (یا شکل صرف‌شده‌اش) را داشته باشد.
          برای پذیرفتن دو املا از <span dir="ltr">/</span> استفاده کنید. خط‌هایی که با <span dir="ltr">#</span> شروع شوند نادیده گرفته می‌شوند.
          فایل را حتماً با encoding برابر UTF-8 ذخیره کنید.
        </Fa>
        <pre dir="ltr" className="mt-4 overflow-x-auto rounded-xl bg-paper p-4 text-sm leading-7">
{`# word | Persian meaning | example sentence
accomplish | انجام دادن | She worked hard to accomplish her goals.
colour/color | رنگ | The colour of the sky changed at sunset.
look forward to | مشتاقانه منتظر بودن | I look forward to meeting you.`}
        </pre>
      </section>
    </div>
  );
}
