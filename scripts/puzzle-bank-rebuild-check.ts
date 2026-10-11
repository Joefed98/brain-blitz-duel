/**
 * Deep (optional) check: every precomputed puzzle bank rebuilds byte for byte
 * from its build script. Runs `bun scripts/<game>-bank.ts --check` for the six
 * banks one after another; about 20 minutes on four cores.
 *
 *   bun scripts/puzzle-bank-rebuild-check.ts
 *   bun scripts/run-checks.ts --include-optional puzzle-bank-rebuild
 */
import { spawnSync } from "node:child_process";

import { BANKED_TYPES } from "../src/lib/duel/puzzleBank.server";
import { BANK_FILES } from "./puzzle-bank-lib";

let failures = 0;
for (const type of BANKED_TYPES) {
  const t0 = Date.now();
  const run = spawnSync(process.execPath, [`scripts/${BANK_FILES[type].script}`, "--check"], { encoding: "utf8" });
  const out = `${run.stdout ?? ""}`;
  const ok = run.status === 0 && out.includes(`PASS ${type}: rebuild matches`);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${type}: full rebuild is byte-identical to ${BANK_FILES[type].file} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (!ok) console.log(out.trim(), run.stderr?.trim().split("\n").slice(-5).join("\n"));
}
console.log(failures === 0 ? "ALL BANK REBUILDS IDENTICAL" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
