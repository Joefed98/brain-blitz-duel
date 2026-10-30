/**
 * arcade-standard-check's case for `pinball` (see ./case.ts): pinRev 6, the 90 s table on the standard. Table points
 * (no multiplier) on a straight line to 130, J-O-U-L-Z 10 a set (up to 2), multiball started 20, jackpots 5 each (up to
 * 3), ramp combos 5 each (up to 3). States are built from pinRev 6's own init; pinball-standard-check proves the play.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StdCase } from "./case";
import {
  pinball6Game,
  pinballGameForAny,
  pinballStdParts,
  PIN_V6_FULL_AT,
  type Pin4State,
} from "../../src/lib/arcade/pinball4";
import { PIN_REV_LONG } from "../../src/lib/arcade/pinball";

const base = (): Pin4State => ({ ...pinball6Game.init(7), acted: 1 });
const at = (fields: Partial<Pin4State>): Pin4State => ({ ...base(), ...fields });
const part = (s: Pin4State, key: string) => pinballStdParts(s)!.find((p) => p.key === key)!.points;

export const stdCase: StdCase = {
  game: pinball6Game,
  fullAt: PIN_V6_FULL_AT,
  perfect: () => at({ points: PIN_V6_FULL_AT, laneSets: 2, multiballs: 1, jackpots: 3, combos: 3 }),
  idle: () => at({}),
  core: (value) => at({ points: value }),
  older: () => pinballGameForAny(PIN_REV_LONG).init(7),
  extra(ok) {
    // J-O-U-L-Z: 10 a completed set, up to 2.
    for (const [n, want] of [[0, 0], [1, 10], [2, 20], [3, 20], [5, 20]] as const) ok(part(at({ laneSets: n }), "joulz") === want, `pinball: ${n} J-O-U-L-Z sets pay ${want}`);
    // Multiball: 20 once started, however many.
    for (const [n, want] of [[0, 0], [1, 20], [2, 20], [4, 20]] as const) ok(part(at({ multiballs: n }), "multiball") === want, `pinball: ${n} multiballs pay ${want}`);
    // Jackpots and ramp combos: 5 each, up to 3.
    for (const [n, want] of [[0, 0], [1, 5], [2, 10], [3, 15], [4, 15], [9, 15]] as const) {
      ok(part(at({ jackpots: n }), "jackpots") === want, `pinball: ${n} jackpots pay ${want}`);
      ok(part(at({ combos: n }), "combos") === want, `pinball: ${n} ramp combos pay ${want}`);
    }
    // The features add to the core, never take from it (each feature's table points stay in the core).
    const core = at({ points: 40_000 });
    const all = at({ points: 40_000, laneSets: 1, multiballs: 1, jackpots: 2, combos: 1 });
    ok(part(all, "core") === part(core, "core"), "pinball: earning features leaves the core as it was");
    ok(pinball6Game.score(all) === pinball6Game.score(core) + 10 + 20 + 10 + 5, `pinball: features add their fixed amounts (${pinball6Game.score(all)})`);
    // The score is held to 200; a negative or missing count never scores.
    ok(pinball6Game.score(at({ points: PIN_V6_FULL_AT * 3, laneSets: 9, multiballs: 9, jackpots: 9, combos: 9 })) === 200, "pinball: never above 200");
    ok(part(at({ points: -50 }), "core") === 0, "pinball: negative table points give no core");
    // A new state carries the standard's fields; no multiplier above x1 on it (pinball-standard-check plays it).
    const fresh = pinball6Game.init(3) as any;
    ok(fresh.rev6 === 1 && fresh.combos === 0 && fresh.rev5 === 1 && fresh.mult === 1, "pinball: pinRev 6 states carry rev6, combos and the 90 s flag");
  },
};
