/**
 * no-side-effect-imports-check (29 Oct 2026): app code never relies on a bare `import "./x"` for anything to happen.
 *
 * package.json declares "sideEffects": false, so the production build (Vite/Rollup, Lovable's Cloudflare build) may drop
 * a module that is only imported for its side effects. That is how the scoring standard's graders vanished from the
 * live app (they registered themselves on import; see docs/scoring-standard.md, "Fix: the graders were missing"). Every
 * table, grader and registry must be imported by name. This check fails on any bare import of a script module under
 * src/ (stylesheets are fine), except the ones listed below with the reason they survive the build.
 *
 *   bun scripts/no-side-effect-imports-check.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Bare imports known to survive the production build, with why. */
const ALLOWED: Record<string, string> = {
  // Lovable's SSR error wrapper: the module patches console and the global error handlers at load, and the built
  // server keeps it (its listener is in the built server chunk, seen 29 Oct 2026).
  'src/server.ts: import "./lib/error-capture";': "Lovable's error capture (the server entry)",
};

const BARE = /^\s*import\s+["']([^"']+)["'];?\s*$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

const failures: string[] = [];
let files = 0;
for (const file of walk("src")) {
  files++;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const m = line.match(BARE);
      if (!m) return;
      if (/\.(css|scss|sass|less)(\?.*)?$/.test(m[1]!)) return;
      const key = `${relative(".", file)}: ${line.trim()}`;
      if (ALLOWED[key]) return;
      failures.push(`${relative(".", file)}:${i + 1}: ${line.trim()} (import it by name: "sideEffects": false lets the production build drop it)`);
    });
}

if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`FAIL no-side-effect-imports-check: ${failures.length} bare side-effect import(s) in src/`);
  process.exit(1);
}
console.log(`PASS no-side-effect-imports-check: no bare side-effect imports in ${files} files under src/ (stylesheets aside; ${Object.keys(ALLOWED).length} known exception)`);
