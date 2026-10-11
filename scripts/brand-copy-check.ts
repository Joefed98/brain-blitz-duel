// App name and pitch come from one constant (src/lib/brand.ts) and stay neutral on
// player and round counts (first-run audit, 11 Oct 2026). The static manifest must agree.
import { readFileSync } from "node:fs";
import { APP_DESCRIPTION, APP_NAME, APP_TITLE } from "../src/lib/brand";

const failures: string[] = [];
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
if (manifest.name !== APP_NAME) failures.push(`manifest name "${manifest.name}" is not APP_NAME "${APP_NAME}"`);
if (manifest.short_name !== APP_NAME) failures.push(`manifest short_name "${manifest.short_name}" is not APP_NAME "${APP_NAME}"`);
if (manifest.description !== APP_DESCRIPTION) failures.push("manifest description is not APP_DESCRIPTION");

const STALE = [/1v1/i, /Puzzle Duels/i, /Three puzzles/i, /Thirty seconds/i, /six timed/i, /head to head/i];
for (const [label, text] of [["APP_TITLE", APP_TITLE], ["APP_DESCRIPTION", APP_DESCRIPTION], ["manifest", JSON.stringify(manifest)]] as const) {
  for (const term of STALE) if (term.test(text)) failures.push(`${label} still says ${term}`);
}
for (const file of ["src/routes/__root.tsx", "src/routes/index.tsx", "src/routes/duel.$code.tsx", "src/routes/practice.tsx"]) {
  const head = /head: \(\) => \(\{[\s\S]*?\n  \}\),/.exec(readFileSync(file, "utf8"))?.[0] ?? "";
  if (!head) failures.push(`${file}: no head() block found`);
  if (/"[^"]*Duelz[^"]*"/.test(head)) failures.push(`${file}: page meta spells the name instead of using APP_NAME`);
  for (const term of STALE) if (term.test(head)) failures.push(`${file}: page meta still says ${term}`);
}
if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL: ${failures.length} brand copy problem(s)`);
  process.exit(1);
}
console.log(`Brand copy: manifest, root, home, room and practice meta use ${APP_NAME} and neutral copy`);
