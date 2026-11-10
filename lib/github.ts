export type Resolved = { ok: true; url: string; name: string } | { ok: false; error: string };

export const ALLOWED_HOSTS = ["raw.githubusercontent.com", "gist.githubusercontent.com"];

const lastSegment = (parts: string[]) => {
  try {
    return decodeURIComponent(parts[parts.length - 1] ?? "");
  } catch {
    return parts[parts.length - 1] ?? "";
  }
};

/**
 * Accepts the link to a text file on GitHub in any common form (the normal page link, the Raw link,
 * a gist) and returns the direct download link and a file name.
 */
export function resolveGithubUrl(input: string): Resolved {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return { ok: false, error: "This is not a valid link. Paste the full address that starts with https://" };
  }
  if (u.protocol !== "https:") return { ok: false, error: "The link must start with https://" };

  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  const needTxt = (name: string): Resolved | null =>
    /\.txt$/i.test(name) ? null : { ok: false, error: "The link must point to a .txt file." };

  if (host === "raw.githubusercontent.com") {
    if (parts.length < 4) return { ok: false, error: "Paste the link to the .txt file itself, not to a folder or repository." };
    const name = lastSegment(parts);
    return needTxt(name) ?? { ok: true, url: `https://raw.githubusercontent.com/${parts.join("/")}${u.search}`, name };
  }

  if (host === "github.com") {
    // https://github.com/user/repo/blob/branch/path/file.txt (or /raw/)
    if (parts.length >= 5 && (parts[2] === "blob" || parts[2] === "raw")) {
      const [user, repo, , ref, ...path] = parts;
      const name = lastSegment(path);
      return (
        needTxt(name) ?? {
          ok: true,
          url: `https://raw.githubusercontent.com/${user}/${repo}/${ref}/${path.join("/")}`,
          name,
        }
      );
    }
    return { ok: false, error: "Open the .txt file on GitHub and paste the address of that page, not the repository or a folder." };
  }

  if (host === "gist.github.com" && parts.length >= 2) {
    const [user, id] = parts;
    return { ok: true, url: `https://gist.githubusercontent.com/${user}/${id}/raw`, name: `gist-${id.slice(0, 8)}.txt` };
  }
  if (host === "gist.githubusercontent.com" && parts.length >= 2) {
    const name = /\.txt$/i.test(lastSegment(parts)) ? lastSegment(parts) : `gist-${parts[1].slice(0, 8)}.txt`;
    return { ok: true, url: `https://gist.githubusercontent.com/${parts.join("/")}`, name };
  }

  return { ok: false, error: "Only links to files on GitHub (github.com, raw.githubusercontent.com or gist) are supported." };
}
