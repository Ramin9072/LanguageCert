"use client";

import { DragEvent, useMemo, useRef, useState } from "react";
import {
  formatWordList,
  Issue,
  MAX_FILE_BYTES,
  parseWordList,
} from "@/lib/parse";
import { SAMPLE_TEXT } from "@/lib/sample";
import type { Tab } from "@/lib/types";
import { useApp } from "./AppProvider";
import { Chip, ErrorBox, Fa } from "./ui";

// Converts github.com/user/repo/blob/branch/file.txt
// to raw.githubusercontent.com/user/repo/branch/file.txt
function toDirectUrl(u: URL): URL {
  if (u.hostname === "github.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 5 && parts[2] === "blob") {
      const [user, repo, , branch, ...rest] = parts;
      return new URL(
        `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${rest.join("/")}`
      );
    }
  }
  return u;
}

export default function ImportView({ goTo }: { goTo: (t: Tab) => void }) {
  const {
    data,
    hydrated,
    addWords,
    removeSource,
    clearWords,
    storageFull,
  } = useApp();

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dragging, setDragging] = useState(false);

  const [fileUrl, setFileUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  function load(name: string, text: string) {
    const { words, issues } = parseWordList(
      text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
    );

    setIssues(issues);

    if (words.length === 0) {
      setError(
        "No valid words were found in this file. Check the format below and the problems listed."
      );
      return;
    }

    setError("");

    const r = addWords(name, words);

    const parts = [
      `${r.added} new ${r.added === 1 ? "word" : "words"} added from ${name}.`,
    ];

    if (r.replaced > 0) {
      parts.push(
        `The earlier import of this file (${r.replaced} words) was replaced.`
      );
    }

    if (r.skipped > 0) {
      parts.push(
        `${r.skipped} already in your list from another file, so skipped.`
      );
    }

    setNotice(parts.join(" "));
  }

  async function accept(files: FileList | File[] | null) {
    setError("");
    setNotice("");
    setIssues([]);

    const list = Array.from(files ?? []);

    if (list.length === 0) return;

    if (list.length > 1) {
      return setError("Please upload exactly one .txt file.");
    }

    const f = list[0];

    if (!/\.txt$/i.test(f.name)) {
      return setError("Only .txt files are supported.");
    }

    if (f.size === 0) {
      return setError("This file is empty.");
    }

    if (f.size > MAX_FILE_BYTES) {
      return setError(
        `This file is ${Math.round(f.size / 1024)} KB. The maximum is ${Math.round(
          MAX_FILE_BYTES / 1024
        )} KB.`
      );
    }

    let text: string;

    try {
      text = await f.text();
    } catch {
      return setError("The file could not be read.");
    }

    if (text.includes("\uFFFD") || text.includes("\u0000")) {
      return setError(
        "The file is not saved as UTF-8, so Persian letters are broken. Save it again with encoding UTF-8 and upload it again."
      );
    }

    load(f.name, text);
  }

  async function loadFromUrl() {
    setError("");
    setNotice("");
    setIssues([]);

    const value = fileUrl.trim();

    if (!value) {
      setError("Please enter a file URL.");
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(value);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error();
      }
    } catch {
      setError("Please enter a valid HTTP or HTTPS URL.");
      return;
    }

    parsedUrl = toDirectUrl(parsedUrl);

    if (!/\.txt$/i.test(parsedUrl.pathname)) {
      setError("The URL must point to a .txt file.");
      return;
    }

    setUrlLoading(true);

    try {
      // The download goes through our own server, so CORS does not apply
      const response = await fetch(
        `/api/fetch-txt?url=${encodeURIComponent(parsedUrl.href)}`
      );

      if (!response.ok) {
        let msg = `Download failed: HTTP ${response.status}`;
        try {
          const j = await response.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      if (!response.body) {
        throw new Error("The server did not return a readable file.");
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      try {
        while (true) {
          const { done, value: chunk } = await reader.read();

          if (done) break;

          totalSize += chunk.byteLength;

          if (totalSize > MAX_FILE_BYTES) {
            await reader.cancel();
            throw new Error(
              "The remote file exceeds the maximum allowed size."
            );
          }

          chunks.push(chunk);
        }
      } finally {
        reader.releaseLock();
      }

      if (totalSize === 0) {
        throw new Error("The remote file is empty.");
      }

      const totalBuffer = new Uint8Array(totalSize);
      let offset = 0;

      for (const chunk of chunks) {
        totalBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      let text: string;

      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(totalBuffer);
      } catch {
        throw new Error("The file must use UTF-8 encoding");
      }

      if (text.includes("\uFFFD") || text.includes("\u0000")) {
        throw new Error("The file must use UTF-8 encoding");
      }

      let filename = "imported.txt";

      try {
        filename = decodeURIComponent(
          parsedUrl.pathname.split("/").pop() || "imported.txt"
        );
      } catch {
        filename = parsedUrl.pathname.split("/").pop() || "imported.txt";
      }

      load(filename, text);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. Check that the URL is a public, direct link to a UTF-8 .txt file.`
          : "Could not download the remote file."
      );
    } finally {
      setUrlLoading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files);
  }

  function downloadSample() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + SAMPLE_TEXT], {
        type: "text/plain;charset=utf-8",
      })
    );

    const a = document.createElement("a");
    a.href = url;
    a.download = "wordwise-sample.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + formatWordList(data.words)], {
        type: "text/plain;charset=utf-8",
      })
    );

    const a = document.createElement("a");
    a.href = url;
    a.download = "wordwise-my-words.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const sources = useMemo(() => {
    const m = new Map<string, number>();

    for (const w of data.words) {
      m.set(
        w.source || "Earlier import",
        (m.get(w.source || "Earlier import") ?? 0) + 1
      );
    }

    return Array.from(m, ([name, count]) => ({ name, count }));
  }, [data.words]);

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const withBlank = data.words.filter((w) => w.blank).length;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-4xl sm:text-5xl">
          Build your word list
        </h1>

        <p className="mt-2 max-w-xl text-muted">
          Upload a .txt file with your words, Persian meanings and example
          sentences. Every file you add is saved in this browser and added to
          your list, so you can practice all your words together.
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
          <p className="text-lg font-medium">
            {data.words.length
              ? "Drop another .txt file to add more words"
              : "Drop your .txt file here"}
          </p>

          <p className="mt-1 text-sm text-muted">
            One UTF-8 text file, up to{" "}
            {Math.round(MAX_FILE_BYTES / 1024)} KB.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              className="btn-primary"
              onClick={() => inputRef.current?.click()}
            >
              {data.words.length ? "Add another file" : "Choose a file"}
            </button>

            <button
              className="btn-secondary"
              onClick={() => load("sample.txt", SAMPLE_TEXT)}
            >
              Add the sample words
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

        {/* Import from URL */}
        <div className="mt-6 border-t border-line pt-5">
          <h2 className="font-medium">Import from an internet URL</h2>

          <p className="mt-1 text-sm text-muted">
            Paste a direct link to a UTF-8 .txt file. GitHub file links are
            converted automatically.
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !urlLoading) {
                  loadFromUrl();
                }
              }}
              placeholder="https://example.com/words.txt"
              className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-accent"
              disabled={urlLoading}
            />

            <button
              className="btn-primary"
              onClick={loadFromUrl}
              disabled={urlLoading || !fileUrl.trim()}
            >
              {urlLoading ? "Downloading..." : "Fetch words"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBox message={error} onClose={() => setError("")} />
          </div>
        )}
      </section>

      {storageFull && (
        <ErrorBox message="Your browser storage is full, so your word list and progress may not be saved." />
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-good/20 bg-good-soft px-4 py-3 text-sm text-good"
        >
          {notice}
        </div>
      )}

      {hydrated && data.words.length > 0 && (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h2 className="font-medium">Your word list</h2>

              <p className="text-sm text-muted">
                {data.words.length} words from {sources.length}{" "}
                {sources.length === 1 ? "file" : "files"} · {withBlank} with a
                usable example sentence
              </p>
            </div>

            <button className="btn-primary" onClick={() => goTo("practice")}>
              Start practice
            </button>

            <button className="btn-secondary" onClick={() => goTo("words")}>
              View words
            </button>
          </div>

          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {sources.map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {s.name}
                </span>

                <span className="text-sm tabular-nums text-muted">
                  {s.count} words
                </span>

                <button
                  className="btn-ghost !py-1 !px-2"
                  onClick={() =>
                    confirm(
                      `Remove the ${s.count} words that came from ${s.name}? Your progress is kept.`
                    ) && removeSource(s.name)
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-secondary !py-1.5" onClick={downloadAll}>
              Download all words as .txt
            </button>

            <button
              className="btn-ghost !py-1.5"
              onClick={() =>
                confirm(
                  "Remove ALL words from your list? Your progress is kept."
                ) && clearWords()
              }
            >
              Remove all words
            </button>
          </div>

          {issues.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-2 flex gap-2">
                {errors.length > 0 && (
                  <Chip tone="bad">{errors.length} lines skipped</Chip>
                )}

                {warnings.length > 0 && (
                  <Chip tone="warn">
                    {warnings.length} warnings in the last file
                  </Chip>
                )}
              </div>

              <ul className="max-h-56 space-y-1 overflow-auto text-sm">
                {issues.slice(0, 50).map((i, k) => (
                  <li
                    key={k}
                    className={i.level === "error" ? "text-bad" : "text-warn"}
                  >
                    <span className="tabular-nums">Line {i.line}:</span>{" "}
                    {i.message}
                  </li>
                ))}
              </ul>

              {issues.length > 50 && (
                <p className="mt-1 text-xs text-muted">
                  And {issues.length - 50} more.
                </p>
              )}
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
          هر کلمه در یک خط جداگانه نوشته می‌شود و بخش‌ها با علامت{" "}
          <span dir="ltr">|</span> از هم جدا می‌شوند: کلمه انگلیسی، معنی
          فارسی، جمله مثال. جمله مثال اختیاری است، ولی فقط کلمه‌هایی که جمله
          دارند در تمرین جای‌خالی می‌آیند. جمله باید خود کلمه (یا شکل
          صرف‌شده‌اش) را داشته باشد. برای پذیرفتن دو املا از{" "}
          <span dir="ltr">/</span> استفاده کنید. خط‌هایی که با{" "}
          <span dir="ltr">#</span> شروع شوند نادیده گرفته می‌شوند. فایل را
          حتماً با encoding برابر UTF-8 ذخیره کنید.
        </Fa>

        <pre
          dir="ltr"
          className="mt-4 overflow-x-auto rounded-xl bg-paper p-4 text-sm leading-7"
        >
{`# word | Persian meaning | example sentence
accomplish | انجام دادن | She worked hard to accomplish her goals.
colour/color | رنگ | The colour of the sky changed at sunset.
look forward to | مشتاقانه منتظر بودن | I look forward to meeting you.`}
        </pre>
      </section>
    </div>
  );
}