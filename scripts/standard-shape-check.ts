/**
 * The scoring standard's shared pieces (docs/scoring-standard.md): the shape's arithmetic (speed, par, clean, early,
 * finish and unfinished caps) and the draft timeline (edits round-trip, the fold at the entry cap, rejection of a
 * timeline that does not rebuild its answer, part times that ignore parts taken back).
 *
 *   bun scripts/standard-shape-check.ts
 */
import { cleanPoints, earlyPoints, parPoints, speedPoints, standardFinish, standardUnfinished } from "../src/lib/duel/standard/shape";
import { TIMELINE_MARK, TIMELINE_MAX_ENTRIES, TimelineRecorder, decodeTimeline, partTimes, splitTimeline } from "../src/lib/duel/standard/timeline";

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fail++;
    console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
};
const near = (name: string, got: number, want: number) => eq(name, Math.round(got * 1000) / 1000, Math.round(want * 1000) / 1000);

// Speed: full by the "full by" time, even to 0 at the buzzer (100 s clock, full by 40 s: 60 s of shrink).
near("speed at 0 s", speedPoints(20, 100_000, 100_000, 40_000), 20);
near("speed at the full-by time", speedPoints(20, 60_000, 100_000, 40_000), 20);
near("speed halfway down", speedPoints(20, 30_000, 100_000, 40_000), 10);
near("speed at the buzzer", speedPoints(20, 0, 100_000, 40_000), 0);
// Par: full at par, even to 0 at twice par (or the game's zero point).
near("par at par", parPoints(15, 8, 8), 15);
near("par under par", parPoints(15, 6, 8), 15);
near("par 1.5×", parPoints(15, 12, 8), 7.5);
near("par 2×", parPoints(15, 16, 8), 0);
near("flood par + 3 of 10", parPoints(40, 13, 10, 20), 28);
near("flood at the limit", parPoints(40, 20, 10, 20), 0);
// Clean: the amount less the amount per mistake, never below 0.
near("clean none", cleanPoints(10, 2.5, 0), 10);
near("clean two", cleanPoints(10, 2.5, 2), 5);
near("clean many", cleanPoints(10, 2.5, 9), 0);
// Early: full at 0 s, nothing at the buzzer, nothing unknown.
near("early", earlyPoints(2, [0, 50_000, 100_000, null], 100_000), 3);
// Finish and unfinished.
eq("finish", standardFinish({ speed: 19.6, bonus: 12.4, measure: "par" }), { score: 182, parts: { kind: "finish", base: 150, efficiency: 12, measure: "par", speed: 20 } });
eq("finish capped", standardFinish({ speed: 40, bonus: 30, measure: "bonus" }).score, 200);
eq("unfinished cap", standardUnfinished(141).score, 130);
eq("unfinished floor", standardUnfinished(-4).score, 0);

// Timeline: record, attach, split, decode.
const rec = new TimelineRecorder();
const drafts = ["", "a", "ab", "ab,cd", "ab", "ab,ce", "ab,ce,f"];
drafts.forEach((d, i) => rec.note(d, 1000 * (i + 1)));
const sent = rec.attach("ab,ce,f");
const { body, timeline } = splitTimeline(sent);
eq("body", body, "ab,ce,f");
eq("mark", sent.includes(TIMELINE_MARK), true);
const decoded = decodeTimeline(timeline, body, 100_000);
eq("drafts rebuilt", decoded?.map((d) => d.draft), drafts);
eq("times kept", decoded?.map((d) => d.t), [1000, 2000, 3000, 4000, 5000, 6000, 7000]);
eq("wrong body rejected", decodeTimeline(timeline, "ab,ce,g", 100_000), null);
eq("garbage rejected", decodeTimeline("[[1,2", body, 100_000), null);
eq("late times held", decodeTimeline(timeline, body, 4500)?.map((d) => d.t), [1000, 2000, 3000, 4000, 4500, 4500, 4500]);
eq("empty answer stays empty", rec.attach(""), "");
// The cap folds later changes into the last entry, so the final draft is exact.
const big = new TimelineRecorder();
for (let i = 0; i < TIMELINE_MAX_ENTRIES + 50; i++) big.note("x".repeat(i + 1), i * 10);
const bigSent = big.attach("x".repeat(TIMELINE_MAX_ENTRIES + 50));
const bigSplit = splitTimeline(bigSent);
eq("capped entries", decodeTimeline(bigSplit.timeline, bigSplit.body, 1e9)?.length, TIMELINE_MAX_ENTRIES);
// Part times: the moment after which the count never fell below k.
eq("part times", partTimes([{ t: 1, parts: 1 }, { t: 2, parts: 2 }, { t: 3, parts: 1 }, { t: 4, parts: 2 }, { t: 5, parts: 3 }], 3), [1, 4, 5]);
eq("unseen parts", partTimes([{ t: 1, parts: 1 }], 2), [1, null]);

if (fail > 0) {
  console.log(`FAIL standard-shape-check (${fail})`);
  process.exit(1);
}
console.log("PASS standard-shape-check");
