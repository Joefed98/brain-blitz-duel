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
 *   - SKINS_BASE=<sha> names the commit by hand.
 *
 * The base's src/, tsconfig.json and package.json are extracted (git archive, ~25 MB) into a temp folder with this
 * checkout's node_modules linked in, the branch's frame scripts copied beside them, and the base's digests drawn there
 * in child processes (cwd = that folder, so every `@/` import resolves to the base's src). The digests are cached in
 * that folder, so skins-default-check and skins-check draw main once between them.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const git = (args: string[]) => {
  const out = spawnSync("git", args, { encoding: "utf8", maxBuffer: 1 << 30 });
  return { ok: out.status === 0, out: (out.stdout ?? "").trim(), err: (out.stderr ?? "").trim() };
};

function headCommit(): string {
  const path = process.env["GITHUB_EVENT_PATH"];
  if (process.env["GITHUB_EVENT_NAME"] === "pull_request" && path && existsSync(path)) {
    const sha = (JSON.parse(readFileSync(path, "utf8")) as { pull_request?: { head?: { sha?: string } } }).pull_request?.head?.sha;
    if (sha) return sha;
  }
  return git(["rev-parse", "HEAD"]).out;
}

export interface BaseInfo {
  sha: string;
  head: string;
  /** What the check fetched, as run (empty when everything was already here). */
  fetched: string[];
}

/** The merge base of the branch head and main, fetching shallowly until git can name it. */
export function baseCommit(): BaseInfo {
  const fetched: string[] = [];
  const pinned = process.env["SKINS_BASE"];
  const head = headCommit();
  if (pinned) {
    if (!git(["cat-file", "-e", `${pinned}^{commit}`]).ok) {
      const args = ["fetch", "--no-tags", "--depth=1", "origin", pinned];
      fetched.push(`git ${args.join(" ")}`);
      git(args);
    }
    return { sha: git(["rev-parse", pinned]).out, head, fetched };
  }
  const tryBase = () => {
    if (!git(["cat-file", "-e", `${head}^{commit}`]).ok) return "";
    const mb = git(["merge-base", head, "refs/remotes/origin/main"]);
    return mb.ok ? mb.out : "";
  };
  let sha = tryBase();
  for (let depth = 64; !sha && depth <= 4096; depth *= 4) {
    const args = ["fetch", "--no-tags", `--depth=${depth}`, "origin", head, "+refs/heads/main:refs/remotes/origin/main"];
    fetched.push(`git ${args.join(" ")}`);
    const out = git(args);
    if (!out.ok) throw new Error(`could not fetch the branch and main: ${out.err.split("\n").pop()}`);
    sha = tryBase();
  }
  if (!sha) throw new Error(`no merge base between ${head.slice(0, 8)} and main within 4,096 commits`);
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
  for (const part of ["pool", "minigolf", "curling", "racing", "freekick", "freecell", "pokersquares", "deck"]) {
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
