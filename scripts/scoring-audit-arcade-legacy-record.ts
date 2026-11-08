/**
 * Records scoring-audit-arcade-check's legacy fixture (scripts/fixtures/scoring-audit-arcade-legacy.json.gz) from a
 * checkout of main before the scoring audit's arcade fixes (Nov 2026): skill-band bot runs at every level on the stamps
 * main dealt (Spacewalk crossRev 11, Wavefront wavRev 12, Fission burstRev 10, High Rise skylineRev 9, Slice sliceRev 12
 * and 11) and Fission's fire-spam runs, each with the score, final checksum and tick main's server replay gives. The
 * check replays every one on today's tree and fails on any difference.
 *
 *   git worktree add ../main-audit origin/main && ln -s "$PWD/node_modules" ../main-audit/node_modules
 *   bun scripts/scoring-audit-arcade-legacy-record.ts ../main-audit
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { execSync } from "node:child_process";
import { auditLegacyRuns } from "./scoring-audit-arcade-lib";

const root = resolve(process.argv[2] ?? ".");
console.error = () => {};
const runs = await auditLegacyRuns(root);
const commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
writeFileSync("scripts/fixtures/scoring-audit-arcade-legacy.json.gz", gzipSync(JSON.stringify({ commit, runs })));
console.log(`wrote ${runs.length} runs recorded on ${commit}`);
