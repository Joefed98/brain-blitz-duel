/**
 * Roofbound's room proof for the arcade rule (flipRev 8, docs/expansions/x200-flip.md; rooms deal flipRev 9 since
 * 27 Oct 2026, flipRev 8's play on lifted curves, docs/arcade-phone-notes-oct-2026.md, and flipRev 10 since 29 Oct 2026, the same play on
 * the arcade scoring standard, docs/arcade-standard/flip.md): the n-th room deal through
 * the server's own generator (generateFlip: its stamp; the seed is the skill-band runner's n-th room seed, since the
 * generator draws it at random), the five input styles from the skill-band bot, every seeded item a state shows (the
 * course: hazards and their slides, cave heights, speed zones, checkpoints, gold stars, star trails and sweet spots;
 * never whether one was taken) and the course's guaranteed counts (flipV8Opportunities).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { flipGameFor, flipV8Opportunities, FLIP_REV_DEAL, FLIP_V8_CHECKPOINTS, type FlipState } from "../../src/lib/arcade/flip";
import { generateFlip } from "../../src/lib/duel/arcade.server";
import { flipDealSeed } from "../../src/lib/duel/flipDeal.server";
import { bot, randomBot } from "../arcade-skill-bands/bots/flip";
import { roomSeed } from "../arcade-skill-bands/games";
import { Human } from "../arcade-skill-bands/human";
import type { X200Room } from "./room";

export const x200Room: X200Room = {
  type: "flip",
  // flipRev 11 since 3 Nov 2026 (no star pickups, the flow streak; docs/arcade-standard/flip.md); flipRev 12 since the
  // Action polish (flipRev 11's game, dealt only on the proved courses of flipDeal.server.ts).
  rev: FLIP_REV_DEAL,
  deals: 6,
  deal(n) {
    const puzzle = generateFlip();
    if (puzzle.flipRev !== FLIP_REV_DEAL) throw new Error(`rooms deal flipRev ${puzzle.flipRev}, not ${FLIP_REV_DEAL}`);
    // The generator draws its room seed at random; the n-th room seed through the same deal map (a proved course).
    const seed = flipDealSeed(roomSeed(n));
    return { seed, game: flipGameFor(puzzle.flipRev) };
  },
  play(deal, style) {
    if (style === "idle") return { events: [] };
    const human = new Human("flip", deal.seed, style === "random" ? "weak" : style);
    const out = (style === "random" ? randomBot : bot)({ game: deal.game, seed: deal.seed, rev: FLIP_REV_DEAL, human });
    return { events: out.events ?? [] };
  },
  schedule(state: FlipState) {
    const out: Record<string, unknown> = {};
    state.segs.forEach((seg, i) => (out[`hazard:${i}`] = [seg.x0, seg.x1, seg.side, seg.kind, seg.group, seg.decision, seg.amp ?? 0, seg.per ?? 0, seg.ph ?? 0]));
    (state.stars ?? []).forEach((star, i) => (out[`star:${i}`] = [star.x, star.side]));
    const c = state.v8;
    if (c) {
      out.heights = c.hts;
      out.zones = c.zones;
      out.xs = [c.xs.length, c.xs[600], c.xs[1800], c.xs[3600]];
      c.trails.forEach((trail, i) => (out[`trail:${i}`] = trail));
      c.sweets.forEach((sweet, i) => (out[`sweet:${i}`] = [sweet.x0, sweet.x1, sweet.side]));
    }
    out.checkpoints = FLIP_V8_CHECKPOINTS;
    out.warp = [state.warpPeriod, state.warpFloor, state.warpCeil];
    return out;
  },
  opportunities: (state: FlipState) => flipV8Opportunities(state),
};
