import type { Tab } from "./types";

export const TAB_IDS: Tab[] = ["import", "words", "practice"];

/** The address looks like #practice or #practice/run. Using the hash makes the browser Back button work. */
export function readHash(): { tab: Tab | null; sub: string } {
  if (typeof window === "undefined") return { tab: null, sub: "" };
  const [t = "", sub = ""] = window.location.hash.replace(/^#/, "").split("/");
  return { tab: (TAB_IDS as string[]).includes(t) ? (t as Tab) : null, sub };
}

export function pushHash(h: string) {
  if (window.location.hash !== "#" + h) window.location.hash = h;
}

export function replaceHash(h: string) {
  window.history.replaceState(null, "", "#" + h);
}
