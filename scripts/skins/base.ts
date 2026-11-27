/**
 * The skins checks' live comparison with main (Joe, 11 Nov 2026): the default frames are drawn by main's own
 * renderers and by this branch's in the same run on the same machine, so the canvas library's CPU-dependent rounding
 * (Skia picks its raster path by CPU) is the same on both sides.
 *
 * "Main" is the exact commit this branch is based on, the merge base of the branch head and main, never whatever main
 * is when the check runs:
 *   - the branch head is the PR's head commit on a pull_request run (GITHUB_EVENT_PATH's pull_request.head.sha: the
 *     checkout there is GitHub's synthetic merge commit), else HEAD;
 *   - CI's checkout is shallow (depth 1), so the check fetches what it needs itself: the head and main at depth 64,
 *     deepened (×4, up to 4,096) until git can name their merge base; no tags, nothing else, the full history never
 *     (the repository is 1.2 GB). The fetch only adds objects and the remote-tracking ref refs/remotes/origin/main;
 *     the working tree and HEAD are untouched;
 *   - each fetch is tried up to 3 times (2 s, then 4 s apart); if all three fail the check FAILS, naming the fetch,
 *     and never passes or falls back to the stored digests;
 *   - on a run whose head is main itself (a push or a manual run on main), the merge base is that head, so main is
 *     compared with itself (nothing to differ) and only the stored digests, where this machine draws them, still bite;
 *   - SKINS_BASE=<sha> names the commit by hand.
 *
 * The base's src/, tsconfig.json and package.json are extracted (git archive, ~25 MB) into a temp folder with this
 * checkout's node_modules linked in, the branch's frame scripts copied beside them, and the base's digests drawn there
 * in child processes (cwd = that folder, so every `@/` import resolves to the base's src). The digests are cached in
 * that folder, so skins-default-check and skins-check draw main once between them.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs"; // Changed with Joe's approval, 27 Nov 2026: mkdtempSync
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const git = (args: string[]) => {
  const out = spawnSync("git", args, { encoding: "utf8", maxBuffer: 1 << 30 });
  return { ok: out.status === 0, out: (out.stdout ?? "").trim(), err: (out.stderr ?? "").trim() };
};

/** The pull_request event's head and base commits (the base: main's tip GitHub built the merge commit on), if any. */
function prEvent(): { head?: string; base?: string } {
  const path = process.env["GITHUB_EVENT_PATH"];
  if (process.env["GITHUB_EVENT_NAME"] !== "pull_request" || !path || !existsSync(path)) return {};
  const pr = (JSON.parse(readFileSync(path, "utf8")) as { pull_request?: { head?: { sha?: string }; base?: { sha?: string } } }).pull_request;
  return { head: pr?.head?.sha, base: pr?.base?.sha };
}

function headCommit(): string {
  return prEvent().head ?? git(["rev-parse", "HEAD"]).out;
}

/** How many times a fetch is tried (runner network faults happen) and the waits between tries, in ms. */
export const FETCH_ATTEMPTS = 3;
const FETCH_WAITS = [2000, 4000];

/**
 * One fetch, tried up to FETCH_ATTEMPTS times. If every try fails it throws, naming the fetch and git's last error:
 * the checks then FAIL (never pass, never fall back to the stored digests).
 */
function fetchOrThrow(args: string[], fetched: string[]): void {
  let last = "";
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    fetched.push(`git ${args.join(" ")}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
    const out = git(args);
    if (out.ok) return;
    last = out.err.split("\n").filter(Boolean).pop() ?? "no error text";
    console.log(`  NOTE git fetch failed (attempt ${attempt} of ${FETCH_ATTEMPTS}): ${last}`);
    if (attempt < FETCH_ATTEMPTS) Bun.sleepSync(FETCH_WAITS[attempt - 1]!);
  }
  throw new Error(`git fetch failed after ${FETCH_ATTEMPTS} attempts (git ${args.join(" ")}): ${last}. Main's renderers could not be drawn, so the default frames were not compared; this is a network fault, not a drawing difference`);
}

/** Thrown when git can't name the merge base (as opposed to a fetch that failed): the checks then compare no frame. */
export class NoMergeBase extends Error {
  override name = "NoMergeBase";
}

export interface BaseInfo {
  sha: string;
  head: string;
  /** What the check fetched, as run (empty when everything was already here). */
  fetched: string[];
}

/**
 * Changed with Joe's approval, 27 Nov 2026: the merge base worked out in a separate, commits-only clone (a bare repository in a temp folder, one
 * `--filter=tree:0` fetch of main and the head: every commit, no trees or files, ~3 MB, about a second), so the answer
 * never depends on this checkout's shallow history. Returns the commit, or "" with the reason. A fetch that fails three
 * times throws, as every fetch here does.
 */
export function commitsOnlyBase(head: string, fetched: string[]): { sha: string; why: string } {
  const bare = mkdtempSync(join(tmpdir(), "skins-mb-"));
  try {
    const url = git(["remote", "get-url", "origin"]).out;
    if (!git(["init", "-q", "--bare", bare]).ok) return { sha: "", why: "git init of the commits-only clone failed" };
    fetchOrThrow(["-C", bare, "fetch", "-q", "--filter=tree:0", "--no-tags", url, head, "+refs/heads/main:refs/heads/main"], fetched);
    const mb = git(["-C", bare, "merge-base", head, "refs/heads/main"]);
    return mb.ok && mb.out ? { sha: mb.out, why: "" } : { sha: "", why: mb.err || "no common commit in the full history" };
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
}

/** The merge base of the branch head and main, fetching shallowly until git can name it. */
export function baseCommit(): BaseInfo {
  const fetched: string[] = [];
  const pinned = process.env["SKINS_BASE"];
  const head = headCommit();
  if (pinned) {
    if (!git(["cat-file", "-e", `${pinned}^{commit}`]).ok) fetchOrThrow(["fetch", "--no-tags", "--depth=1", "origin", pinned], fetched);
    return { sha: git(["rev-parse", pinned]).out, head, fetched };
  }
  // 26 Nov 2026 (Joe): a pull_request run also fetches the event's base commit by name (main's tip the merge commit was
  // built on), and git's own reason is kept whenever merge-base names nothing (it also fails, rather than answering
  // "none", on a shallow history it can't read), for the message below.
  const prBase = prEvent().base;
  let why = "";
  const tryBase = () => {
    if (!git(["cat-file", "-e", `${head}^{commit}`]).ok) {
      why = `the head commit ${head.slice(0, 8)} isn't in the checkout`;
      return "";
    }
    const mb = git(["merge-base", head, "refs/remotes/origin/main"]);
    if (mb.ok && mb.out) return mb.out;
    why = mb.err ? `git merge-base: ${mb.err.split("\n").filter(Boolean).pop()}` : "git merge-base found no common commit";
    return "";
  };
  const wants = [head, ...(prBase && prBase !== head ? [prBase] : []), "+refs/heads/main:refs/remotes/origin/main"];
  // First the commits-only clone (#486: on git 2.56.1 the shallow fetches below reached a year of history and merge-base
  // still found no common commit), then this checkout's own history as before. // Changed with Joe's approval, 27 Nov 2026
  let sha = ""; // Changed with Joe's approval, 27 Nov 2026
  try { // Changed with Joe's approval, 27 Nov 2026
    const found = commitsOnlyBase(head, fetched); // Changed with Joe's approval, 27 Nov 2026
    if (found.sha) { // Changed with Joe's approval, 27 Nov 2026
      if (!git(["cat-file", "-e", `${found.sha}^{commit}`]).ok) fetchOrThrow(["fetch", "--no-tags", "--depth=1", "origin", found.sha], fetched); // Changed with Joe's approval, 27 Nov 2026: for git archive below
      sha = found.sha; // Changed with Joe's approval, 27 Nov 2026
    } else why = `commits-only clone: ${found.why}`; // Changed with Joe's approval, 27 Nov 2026
  } catch (e) { // Changed with Joe's approval, 27 Nov 2026
    why = `commits-only clone: ${e instanceof Error ? e.message.split(". ")[0] : String(e)}`; // Changed with Joe's approval, 27 Nov 2026
  } // Changed with Joe's approval, 27 Nov 2026
  if (!sha) sha = tryBase(); // Changed with Joe's approval, 27 Nov 2026: was `let sha = tryBase();`
  for (let depth = 64; !sha && depth <= 4096; depth *= 4) {
    fetchOrThrow(["fetch", "--no-tags", `--depth=${depth}`, "origin", ...wants], fetched);
    sha = tryBase();
  }
  // Still none: once more by date instead of by count (every commit since a year before the head's own date), so a
  // deep or oddly shaped history can't hide the base from the depth-limited fetches.
  if (!sha) {
    const at = Number(git(["log", "-1", "--format=%ct", head]).out) || Math.floor(Date.now() / 1000);
    const since = new Date((at - 365 * 86_400) * 1000).toISOString().slice(0, 10);
    fetchOrThrow(["fetch", "--no-tags", `--shallow-since=${since}`, "origin", ...wants], fetched);
    sha = tryBase();
  }
  if (!sha) {
    const shallow = existsSync(".git/shallow") ? readFileSync(".git/shallow", "utf8").split("\n").filter(Boolean).length : 0;
    throw new NoMergeBase(
      `no merge base between ${head.slice(0, 8)} and main (${git(["rev-parse", "--short", "refs/remotes/origin/main"]).out || "not fetched"}) ` +
        `in a commits-only clone, after fetching 4,096 commits and a year by date (${why || "no reason given"}; ${shallow} shallow boundaries; ${git(["--version"]).out})`, // Changed with Joe's approval, 27 Nov 2026
    );
  }
  return { sha, head, fetched };
}

export interface BaseDigests {
  info: BaseInfo;
  /** game → frame name → digest (scripts/skins/frames.ts, no look argument, main's renderers). */
  frames: Record<string, Record<string, string>>;
  /** Full House's deck frames (scripts/skins/deck-frames.ts, no look argument). */
  deck: Record<string, string>;
  /** Milliseconds spent: fetching and extracting, drawing (0 when cached). */
  ms: { prepare: number; draw: number };
  cached: boolean;
}

const SCRIPTS = ["frames.ts", "deck-frames.ts", "dump-base.ts"];

/** Main's default frames drawn on this machine (cached per base commit in the temp folder). */
export function baseDigests(): BaseDigests {
  const t0 = performance.now();
  const info = baseCommit();
  const root = join(tmpdir(), `skins-base-${info.sha.slice(0, 12)}`);
  const cache = join(root, ".skins-base.json");
  if (existsSync(cache)) {
    const c = JSON.parse(readFileSync(cache, "utf8")) as Pick<BaseDigests, "frames" | "deck">;
    return { info, ...c, ms: { prepare: performance.now() - t0, draw: 0 }, cached: true };
  }
  const tmp = `${root}.${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const tar = join(tmp, "base.tar");
  const arch = spawnSync("git", ["archive", "--format=tar", "-o", tar, info.sha, "src", "tsconfig.json", "package.json"], { encoding: "utf8" });
  if (arch.status !== 0) throw new Error(`git archive ${info.sha}: ${arch.stderr}`);
  const untar = spawnSync("tar", ["-xf", tar, "-C", tmp], { encoding: "utf8" });
  if (untar.status !== 0) throw new Error(`tar: ${untar.stderr}`);
  rmSync(tar);
  symlinkSync(resolve("node_modules"), join(tmp, "node_modules"));
  mkdirSync(join(tmp, "scripts", "skins"), { recursive: true });
  for (const f of SCRIPTS) copyFileSync(join("scripts", "skins", f), join(tmp, "scripts", "skins", f));
  const t1 = performance.now();
  const frames: Record<string, Record<string, string>> = {};
  let deck: Record<string, string> = {};
  // Changed with Joe's approval, 13 Nov 2026: Summit, Thirteen and Five Hands drawn on main too (their card backs).
  for (const part of ["pool", "minigolf", "curling", "racing", "freekick", "freecell", "pokersquares", "tripeaks", "pyramid", "fivehands", "deck"]) {
    const child = spawnSync("bun", [join("scripts", "skins", "dump-base.ts"), `--part=${part}`], { cwd: tmp, encoding: "utf8", maxBuffer: 1 << 26 });
    const line = (child.stdout ?? "").split("\n").find((l) => l.startsWith("JSON "));
    if (child.status !== 0 || !line) throw new Error(`main's ${part} frames did not draw: ${(child.stderr ?? "").split("\n").slice(-3).join(" | ")}`);
    const got = JSON.parse(line.slice(5)) as Record<string, string>;
    if (part === "deck") deck = got;
    else frames[part] = got;
  }
  const draw = performance.now() - t1;
  writeFileSync(join(tmp, ".skins-base.json"), JSON.stringify({ frames, deck }));
  rmSync(root, { recursive: true, force: true });
  renameSync(tmp, root);
  return { info, frames, deck, ms: { prepare: t1 - t0, draw }, cached: false };
}

/** One line for a check's output: what was compared and how long it took. */
export function baseLine(b: BaseDigests): string {
  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  return `main = ${b.info.sha.slice(0, 10)} (merge base of ${b.info.head.slice(0, 10)} and main)${b.info.fetched.length ? `, fetched: ${b.info.fetched.join("; ")}` : ""}; ${b.cached ? `cached digests (${s(b.ms.prepare)})` : `prepared in ${s(b.ms.prepare)}, drawn in ${s(b.ms.draw)}`}`;
}
