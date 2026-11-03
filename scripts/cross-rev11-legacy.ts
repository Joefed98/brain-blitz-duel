/**
 * Old-round records for Jaywalk crossRev 11 (3 Nov 2026, docs/arcade-standard/cross.md "crossRev 11"): skill-band bot
 * runs on every revision rooms ever stamped for Jaywalk (unstamped and crossRev 2–7, 9 and 10; crossRev 10 the one rooms
 * dealt before the change), played through the server encode + replay path of the code at <root>, recorded as score,
 * flag, a SHA-256 of the replayed final state and of its checkpoints, with the encoded log. cross-rev11-check replays
 * every log on today's code and must reach the same score, flag, state and checkpoints.
 *
 *   bun scripts/cross-rev11-legacy.ts <root> | gzip > scripts/fixtures/cross-rev11-legacy.json.gz   (root = main before the change)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

/** Every revision before crossRev 11 (null = unstamped; 8 was never dealt); crossRev 10 is the one rooms dealt. */
export const REV11_BEFORE: readonly (number | null)[] = [null, 2, 3, 4, 5, 6, 7, 9, 10];
const LEVELS = ["weak", "good", "great", "elite"] as const;

export interface CrossLegacyRecord {
  rev: number | null;
  level: string;
  seed: number;
  score: number;
  flagged: boolean;
  digest: string;
  checkpoints: string;
  /** The encoded run, gzip + base64. */
  raw: string;
}

export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
/** The replayed final state's digest, without its courses (rebuilt from the seed, and slow to hash). */
export const stateDigest = (state: any) => digest({ ...state, courses: undefined });

if (import.meta.main) {
  const root = process.argv[2] ?? ".";
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/cross.ts`);
  const spec = GAME_BY_TYPE.get("cross");
  const out: CrossLegacyRecord[] = [];
  REV11_BEFORE.forEach((rev, index) => {
    // crossRev 10 (dealt until now): three runs a level; older stamps one.
    const perLevel = rev === 10 ? 3 : 1;
    for (const level of LEVELS)
      for (let n = 0; n < perLevel; n++) {
        const seed = spec.seedFor(n + index * 7 + 200);
        const game = spec.gameFor(rev, seed);
        const human = new Human("cross", seed, level);
        const res = bot({ game, seed, rev, human, fixes: true });
        let state = game.init(seed);
        const checkpoints: unknown[] = [];
        const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
        while (!game.isOver(state) && state.tick < game.runTicks) {
          state = game.step(state, byTick.get(state.tick + 1) ?? null);
          if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
        }
        const claimed = game.score(state);
        const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
        const result = spec.replay(seed, raw, rev);
        out.push({
          rev, level, seed, score: result.score, flagged: Boolean(result.flagged), digest: stateDigest(result.state), checkpoints: digest(result.checkpoints),
          raw: gzipSync(raw).toString("base64"),
        });
      }
  });
  console.log(JSON.stringify({ recorded: `unmodified main ${process.env.LEGACY_COMMIT ?? ""} before crossRev 11`.trim(), runs: out }));
}
