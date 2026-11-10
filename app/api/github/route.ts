import { NextResponse } from "next/server";
import { ALLOWED_HOSTS } from "@/lib/github";
import { MAX_FILE_BYTES } from "@/lib/parse";

export const runtime = "nodejs";
export const maxDuration = 15;
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Fallback for browsers that cannot reach GitHub directly (for example when raw.githubusercontent.com is blocked
 * on your network). The server downloads the file for you. It only ever contacts GitHub's file hosts.
 */
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return fail("Invalid link.", 400);
  }

  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) {
      return fail("Only files on GitHub can be downloaded.", 400);
    }
    try {
      res = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } catch {
      return fail("Could not reach GitHub. Please try again.", 502);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      res = null;
      continue;
    }
    break;
  }
  if (!res) return fail("Too many redirects.", 502);
  if (res.status === 404) return fail("File not found. Check the link. Private repositories are not supported.", 404);
  if (!res.ok) return fail(`GitHub returned an error (${res.status}).`, 502);

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES) return fail("This file is too large.", 413);

  const reader = res.body?.getReader();
  if (!reader) return fail("The file is empty.", 422);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FILE_BYTES) {
      await reader.cancel();
      return fail("This file is too large.", 413);
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks);
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
