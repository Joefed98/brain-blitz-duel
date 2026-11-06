/**
 * Design lint (DESIGN.md section 12; design foundation F1, 6 Nov 2026).
 *
 * Fails on NEW violations in the lines a change adds under src/, and reports the violations already
 * in the tree as warnings with a count per rule (they go down PR by PR):
 *
 *   colour     a hex, rgb()/rgba() or hsl()/hsla() colour outside src/design/tokens.css
 *   arbitrary  a Tailwind arbitrary value (text-[13px], rounded-[14px], h-[52px], bg-[#…]);
 *              variants such as data-[state=open]: are not values and are allowed
 *   font       a font-family / fontFamily naming a family other than Archivo (var() and the
 *              generic families are fine)
 *   keyframes  a new @keyframes whose last frame leaves the element hidden (opacity 0, scale 0,
 *              visibility hidden) with no prefers-reduced-motion rule in the same file naming it
 *              (hard rule 8: every animation ends visible)
 *   token      a --jz-* custom property defined outside tokens.css
 *
 * And always (not just changed lines): the 32 --jz-player-N tokens match PLAYER_COLOURS in
 * src/lib/duel/playerLook.ts index for index (the server and canvases read that list).
 *
 * Scope: every .css, .ts and .tsx file under src/. Excluded as game art (DESIGN.md: "Game art
 * folders (src/lib/arcade/*renderer*, canvas code) are excluded"): src/lib/arcade/**, any file that
 * draws on a canvas (CanvasRenderingContext2D, getContext("2d"), OffscreenCanvas), and data files
 * (*.data.ts, src/integrations/**, playerLook.ts's wheel, checked above). The puzzle boards' own art
 * (src/puzzles, src/components/puzzles, src/polish-* but polish-layout) is reported, never failed:
 * game art inside the play area is untouched by the design rules (section 9).
 *
 * "New" means on a line the change adds, unless the same file loses an identical line (a moved or
 * re-indented line is not new). A line holding `design-lint-ignore` (in a comment) is skipped.
 *
 * The base to diff against: --base=<ref>; in a GitHub pull request run, the PR's base branch (fetched,
 * then diffed against the merge commit Actions checks out); otherwise the merge base with origin/main,
 * the working tree and untracked files included. With no base to be found, everything is a warning.
 *
 *   bun scripts/design-lint.ts [--base=<ref>] [--verbose]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export type Rule = "colour" | "arbitrary" | "font" | "keyframes" | "token";
export type Violation = { file: string; line: number; rule: Rule; text: string };

const RULES: Rule[] = ["colour", "arbitrary", "font", "keyframes", "token"];
const TOKENS_FILE = "src/design/tokens.css";
const IGNORE = "design-lint-ignore";

/* ------------------------------------------------------------------ scope */

const GAME_ART_DIRS = [/^src\/lib\/arcade\//, /^src\/integrations\//];
const PUZZLE_ART = [/^src\/puzzles\//, /^src\/components\/puzzles\//, /^src\/polish-(?!layout\/)[^/]+\//];
const CANVAS = /CanvasRenderingContext2D|OffscreenCanvas|getContext\(\s*["'`]2d["'`]/;

export function scopeOf(file: string, source: string): "skip" | "report" | "enforce" {
  if (file === TOKENS_FILE) return "skip";
  if (!/^src\/.*\.(css|ts|tsx)$/.test(file)) return "skip";
  if (/\.data\.ts$/.test(file) || /\.d\.ts$/.test(file)) return "skip";
  if (file === "src/lib/duel/playerLook.ts") return "skip";
  if (GAME_ART_DIRS.some((re) => re.test(file))) return "skip";
  if (CANVAS.test(source)) return "skip";
  if (PUZZLE_ART.some((re) => re.test(file))) return "report";
  return "enforce";
}

/* ------------------------------------------------------------------ the rules */

/** The source with comments blanked out (newlines kept, so line numbers hold). Strings are left alone. */
export function stripComments(source: string, css: boolean): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const c = source[i]!;
    const next = source[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    // A // comment in script (never in CSS, where it would be part of a url()).
    if (!css && c === "/" && next === "/" && source[i - 1] !== ":") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || (!css && c === "`")) quote = c;
    out += c;
    i++;
  }
  return out;
}

const HEX = /(?<![\w&#$-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const FUNC_COLOUR = /\b(?:rgba?|hsla?)\(/g;
// A Tailwind utility with an arbitrary value: `name-[value]` not followed by ":" (that is a variant).
const ARBITRARY = /(?<![\w[-])(?:-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*)-\[[^\]\s"'`]+\](?![:\w-])/g;
const GENERIC_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif",
  "ui-monospace", "ui-rounded", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "emoji",
  "math", "fangsong", "inherit", "initial", "unset", "revert", "revert-layer",
]);

/** The families a font-family value names, var() references dropped. */
function familiesOf(value: string): string[] {
  return value
    .replace(/var\([^)]*\)?/g, "")
    .split(",")
    .map((f) => f.trim().replace(/^["'`]|["'`]$/g, "").trim())
    .filter((f) => f && !/^[\s;{}!)]*$/.test(f) && !/^important$/i.test(f));
}

function lineAt(source: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < source.length; i++) if (source.charCodeAt(i) === 10) n++;
  return n;
}

/** Every violation in one file's source (comments ignored, `design-lint-ignore` lines skipped). */
export function lintSource(file: string, source: string): Violation[] {
  const css = file.endsWith(".css");
  const code = stripComments(source, css);
  const rawLines = source.split("\n");
  const lines = code.split("\n");
  const found: Violation[] = [];
  const add = (line: number, rule: Rule, text: string) => {
    if (rawLines[line - 1]?.includes(IGNORE)) return;
    found.push({ file, line, rule, text });
  };
  lines.forEach((text, i) => {
    const n = i + 1;
    for (const m of text.matchAll(HEX)) {
      // An #id in a CSS selector or a URL fragment is not a colour.
      if (css && !text.includes(":")) continue;
      add(n, "colour", m[0]);
    }
    for (const m of text.matchAll(FUNC_COLOUR)) add(n, "colour", m[0]);
    if (!css || /@apply/.test(text)) for (const m of text.matchAll(ARBITRARY)) add(n, "arbitrary", m[0]);
    if (/(?:^|[\s;{])--jz-[\w-]+\s*:/.test(text)) add(n, "token", text.trim().slice(0, 60));
    const fonts = css
      ? [...text.matchAll(/(?:^|[\s;{])font-family\s*:\s*([^;}]*)/g)].map((m) => m[1]!)
      : [...text.matchAll(/fontFamily\s*:\s*(["'`][^"'`]*["'`])/g)].map((m) => m[1]!);
    for (const value of fonts) {
      const other = familiesOf(value).filter((f) => f !== "Archivo" && !GENERIC_FAMILIES.has(f.toLowerCase()));
      if (other.length) add(n, "font", other.join(", "));
    }
  });
  // @keyframes whose end leaves the element hidden, with no reduced-motion rule naming them.
  const reduced = [...code.matchAll(/@media[^{]*prefers-reduced-motion[^{]*\{/g)]
    .map((m) => blockAt(code, m.index! + m[0].length))
    .join("\n");
  for (const m of code.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    const body = blockAt(code, m.index! + m[0].length);
    const frames = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const last = frames.filter((f) => /(^|,)\s*(to|100%)\s*(,|$)/.test(f[1]!.trim())).at(-1)?.[2] ?? "";
    const hidden =
      /(^|[;\s])opacity\s*:\s*0(\.0*)?\s*(;|$)/.test(last) ||
      /visibility\s*:\s*hidden/.test(last) ||
      /scale\(\s*0(\.0*)?\s*\)|(^|[;\s])scale\s*:\s*0(\.0*)?\s*(;|$)/.test(last);
    if (!hidden) continue;
    // Handled when a reduced-motion rule names the keyframes or one of the classes animated with them.
    const name = m[1]!;
    const nameRe = new RegExp(`(^|[^\\w-])${name.replace(/-/g, "\\-")}(?![\\w-])`);
    const users = new Set<string>();
    for (const rule of code.matchAll(/([^{};]+)\{([^{}]*)\}/g))
      if (/animation(-name)?\s*:/.test(rule[2]!) && nameRe.test(rule[2]!))
        for (const cls of rule[1]!.matchAll(/\.([\w-]+)/g)) users.add(cls[1]!);
    const handled = nameRe.test(reduced) || [...users].some((cls) => new RegExp(`\\.${cls.replace(/-/g, "\\-")}(?![\\w-])`).test(reduced));
    if (!handled) add(lineAt(code, m.index!), "keyframes", name);
  }
  return found;
}

/** The text of the block that opens just before `start` (balanced braces). */
function blockAt(code: string, start: number): string {
  let depth = 1;
  let i = start;
  while (depth && i < code.length) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") depth--;
    i++;
  }
  return code.slice(start, i - 1);
}

/* ------------------------------------------------------------------ player colours */

export function playerColourMismatches(): string[] {
  const problems: string[] = [];
  const tokens = readFileSync(TOKENS_FILE, "utf8");
  const look = readFileSync("src/lib/duel/playerLook.ts", "utf8");
  const wheel = /export const PLAYER_COLOURS = \[([\s\S]*?)\] as const;/.exec(look)?.[1] ?? "";
  const hexes = [...wheel.matchAll(/hex:\s*"(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!.toUpperCase());
  const css = new Map([...tokens.matchAll(/--jz-player-(\d+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [Number(m[1]), m[2]!.toUpperCase()]));
  if (hexes.length !== 32) problems.push(`PLAYER_COLOURS has ${hexes.length} colours, expected 32`);
  if (css.size !== hexes.length) problems.push(`tokens.css has ${css.size} --jz-player-N tokens, PLAYER_COLOURS ${hexes.length}`);
  hexes.forEach((hex, i) => {
    if (css.get(i) !== hex) problems.push(`--jz-player-${i} is ${css.get(i) ?? "missing"}, PLAYER_COLOURS[${i}] is ${hex}`);
  });
  return problems;
}

/* ------------------------------------------------------------------ the change */

const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
const tryGit = (args: string[]) => {
  try {
    return git(args).trim();
  } catch {
    return null;
  }
};

/** The commit to diff against, and whether to include the working tree; null with no base. */
function findBase(explicit?: string): { base: string; worktree: boolean; label: string } | null {
  if (explicit) {
    const sha = tryGit(["rev-parse", "--verify", `${explicit}^{commit}`]);
    return sha ? { base: sha, worktree: true, label: explicit } : null;
  }
  const prBase = process.env.GITHUB_BASE_REF;
  if (prBase) {
    // Actions checks out the PR merged into its base: the diff from the base's tip is exactly the PR.
    if (tryGit(["fetch", "--no-tags", "--depth=1", "origin", prBase]) !== null) {
      const sha = tryGit(["rev-parse", "FETCH_HEAD"]);
      if (sha) return { base: sha, worktree: false, label: `origin/${prBase}` };
    }
    return null;
  }
  const main = tryGit(["rev-parse", "--verify", "origin/main^{commit}"]);
  const mergeBase = main ? tryGit(["merge-base", "HEAD", main]) : null;
  return mergeBase ? { base: mergeBase, worktree: true, label: "the merge base with origin/main" } : null;
}

/** For each changed file: the added line numbers, and the removed lines' text (trimmed). */
function changedLines(base: { base: string; worktree: boolean }): Map<string, { added: Set<number>; removed: Map<string, number> }> {
  const out = new Map<string, { added: Set<number>; removed: Map<string, number> }>();
  const diff = git(["diff", "-U0", "--no-color", "--no-ext-diff", base.base, ...(base.worktree ? [] : ["HEAD"]), "--", "src"]);
  let file: string | null = null;
  let line = 0;
  for (const text of diff.split("\n")) {
    if (text.startsWith("+++ ")) {
      file = text === "+++ /dev/null" ? null : text.slice(6);
      if (file && !out.has(file)) out.set(file, { added: new Set(), removed: new Map() });
      continue;
    }
    if (text.startsWith("--- ")) continue;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    const entry = out.get(file)!;
    if (text.startsWith("+")) entry.added.add(line++);
    else if (text.startsWith("-")) {
      const key = text.slice(1).trim();
      entry.removed.set(key, (entry.removed.get(key) ?? 0) + 1);
    }
  }
  if (base.worktree)
    for (const file of (tryGit(["ls-files", "--others", "--exclude-standard", "--", "src"]) ?? "").split("\n").filter(Boolean)) {
      const count = readFileSync(file, "utf8").split("\n").length;
      out.set(file, { added: new Set(Array.from({ length: count }, (_, i) => i + 1)), removed: new Map() });
    }
  return out;
}

/* ------------------------------------------------------------------ run */

export function runDesignLint(argv = process.argv.slice(2)): number {
  const verbose = argv.includes("--verbose");
  const explicit = argv.find((a) => a.startsWith("--base="))?.slice(7);
  const files = (tryGit(["ls-files", "--cached", "--others", "--exclude-standard", "--", "src"]) ?? "")
    .split("\n")
    .filter((f) => f && existsSync(f));

  const base = findBase(explicit);
  const changes = base ? changedLines(base) : new Map();

  const failures: Violation[] = [];
  const reportedNew: Violation[] = [];
  const existing = new Map<Rule, number>(RULES.map((r) => [r, 0]));
  const existingFiles = new Map<Rule, Map<string, number>>(RULES.map((r) => [r, new Map()]));

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const scope = scopeOf(file, source);
    if (scope === "skip") continue;
    const change = changes.get(file);
    const rawLines = source.split("\n");
    const usedRemoved = new Map<string, number>();
    const isNew = (line: number) => {
      if (!change?.added.has(line)) return false;
      const key = rawLines[line - 1]!.trim();
      const removed = change.removed.get(key) ?? 0;
      const used = usedRemoved.get(key) ?? 0;
      if (used < removed) {
        usedRemoved.set(key, used + 1);
        return false;
      }
      return true;
    };
    const newLines = new Map<number, boolean>();
    for (const v of lintSource(file, source)) {
      if (!newLines.has(v.line)) newLines.set(v.line, isNew(v.line));
      if (newLines.get(v.line)) (scope === "enforce" ? failures : reportedNew).push(v);
      else {
        existing.set(v.rule, existing.get(v.rule)! + 1);
        const perFile = existingFiles.get(v.rule)!;
        perFile.set(file, (perFile.get(file) ?? 0) + 1);
      }
    }
  }
  const players = playerColourMismatches();

  console.log(
    base
      ? `design-lint: new lines measured against ${base.label}`
      : "design-lint: no base to diff against (no origin/main, no PR base): every violation is reported as a warning",
  );
  const total = [...existing.values()].reduce((a, b) => a + b, 0);
  console.log(`WARN existing violations (not failures; they go down PR by PR): ${total} in all`);
  for (const rule of RULES) {
    const perFile = [...existingFiles.get(rule)!.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`  ${rule}: ${existing.get(rule)} in ${perFile.length} files${perFile.length ? `; most in ${perFile.slice(0, verbose ? 20 : 3).map(([f, n]) => `${f} (${n})`).join(", ")}` : ""}`);
  }
  if (reportedNew.length) {
    console.log(`WARN ${reportedNew.length} new violation(s) in puzzle boards' own art (reported, not failed):`);
    for (const v of reportedNew.slice(0, verbose ? 200 : 10)) console.log(`  ${v.file}:${v.line} ${v.rule}: ${v.text}`);
  }
  for (const p of players) console.log(`  ${p}`);
  if (failures.length) {
    console.log(`FAIL design-lint: ${failures.length} new violation(s) in changed lines (DESIGN.md section 12):`);
    for (const v of failures.slice(0, 200)) console.log(`  ${v.file}:${v.line} ${v.rule}: ${v.text}`);
    console.log("  Use a token from src/design/tokens.css (or a component); see DESIGN.md. A deliberate exception takes a `design-lint-ignore` comment on the line.");
  }
  if (players.length) console.log(`FAIL design-lint: the --jz-player-N tokens and PLAYER_COLOURS differ (${players.length})`);
  if (failures.length || players.length) return 1;
  console.log(`PASS design-lint: no new violations in changed lines; the 32 player colour tokens match PLAYER_COLOURS`);
  return 0;
}

if (import.meta.main) process.exit(runDesignLint());
