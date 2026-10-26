/**
 * Records Bonk (whack) and Pull! (clayshoot) runs on every stored revision before the depth-to-200 revisions
 * (whackRev 3, clayRev 9): kit plays at four levels and the spam strategies, graded by the server, with the final
 * replay state's digest. Run on unmodified main; depth-bonk-check / depth-pull-check replay them.
 *
 *   bun scripts/depth-engine-legacy-record.ts <out.json.gz>
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { replayWhackRun } from "../src/lib/duel/whack";
import { replayClayRun } from "../src/lib/duel/clayShoot";
import type { PuzzleData } from "../src/lib/duel/types";

const out: unknown[] = [];
const digest = (s: unknown) => createHash("sha256").update(JSON.stringify(s)).digest("hex").slice(0, 16);
const games = [
  { type: "whack", field: "whackRev", revs: [undefined, 1, 2] },
  { type: "clayshoot", field: "clayRev", revs: [undefined, 2, 3, 4, 5, 6, 7, 8] },
] as const;
for (const g of games) {
  for (const rev of g.revs) {
    for (let k = 0; k < 3; k++) {
      const seed = 0x5a5a00 + k * 7919 + (rev ?? 0) * 101;
      const puzzle = { type: g.type, seed, ...(rev !== undefined ? { [g.field]: rev } : {}) } as unknown as PuzzleData;
      const kit = KITS[g.type]!;
      const runs: { label: string; answer: string }[] = [];
      for (const level of LEVELS) {
        const play = kit.play(puzzle, makeRng(hashText(`${g.type}:play:${seed}:${level}`)), SKILLS[level], 60_000);
        runs.push({ label: level, answer: play.steps.at(-1)!.answer });
      }
      if (k === 0) for (const s of kit.spam(puzzle, makeRng(hashText(`${g.type}:spam:${seed}`)), 60_000)) runs.push({ label: `spam:${s.label}`, answer: s.answer });
      for (const r of runs) {
        const graded = gradeAnswer(puzzle, r.answer, 0);
        const state = g.type === "whack" ? replayWhackRun(seed, r.answer, rev).state : replayClayRun(seed, r.answer, rev).state;
        out.push({ type: g.type, rev: rev ?? null, seed, label: r.label, answer: r.answer, score: graded.score, extra: digest({ ...(graded.extra ?? {}), diag: undefined }), state: digest(state) });
      }
    }
    console.error(`${g.type} rev ${rev ?? "none"}: done`);
  }
}
writeFileSync(process.argv[2]!, gzipSync(JSON.stringify(out)));
console.error(`${out.length} runs`);
