/**
 * Hover's room proof for arcade-room-schedule-check (hoverRev 9, the 200 expansion): every seeded item a
 * course shows (barriers and their gaps, slides and gold stars, tight gates and their centre lines, star
 * chains, shield bubbles) comes from the stored seed alone, whatever a player does, and every course offers
 * the same counts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hoverCentreY, hoverGameFor, type HoverState } from "../../src/lib/arcade/hover";
import { generateHover } from "../../src/lib/duel/hover.server";
import { roomSeed } from "../arcade-skill-bands/games";
import { Human } from "../arcade-skill-bands/human";
import { bot, randomBot } from "../arcade-skill-bands/bots/hover";
import type { RoomDeal, RoomStyle, X200Room } from "./room";

export const x200Room: X200Room = {
  type: "hover",
  rev: generateHover().hoverRev!,
  deal(n: number): RoomDeal {
    // The server's own deal (its stamp), on a fixed seed so the proof reproduces.
    const puzzle = { ...generateHover(), seed: roomSeed(20_000 + n) };
    return { seed: puzzle.seed, game: hoverGameFor(puzzle.hoverRev) };
  },
  play(deal: RoomDeal, style: RoomStyle) {
    if (style === "idle") return { taps: [] };
    const human = new Human("hover", deal.seed, style === "random" ? "weak" : style);
    const out = (style === "random" ? randomBot : bot)({ game: deal.game, seed: deal.seed, rev: x200Room.rev, human });
    return { taps: out.taps ?? [] };
  },
  schedule(state: HoverState): Record<string, unknown> {
    const items: Record<string, unknown> = {};
    state.pillars.forEach((p, i) => {
      items[`barrier:${i}`] = { x0: p.x0, gapTop: p.gapTop, gapH: p.gapH, gap2Top: p.gap2Top ?? null, gap2H: p.gap2H ?? null, slide: p.movePhase ?? null, starDy: p.starDy ?? null };
      if (p.tightTop !== undefined) {
        items[`tight:${i}`] = { top: p.tightTop, h: p.tightH };
        items[`centre:${i}`] = { y: hoverCentreY(p), from: p.x0, to: p.x0 + 10_240 };
      }
    });
    (state.chains ?? []).forEach((c, k) => {
      items[`chain:${k}`] = { after: c.after, stars: c.stars.map((s) => [s.x0, s.y]) };
    });
    (state.pickups ?? []).forEach((p, k) => {
      items[`shield:${k}`] = { after: p.after, x0: p.x0, y: p.y };
    });
    items.course = { totalGates: state.totalGates, totalStars: state.totalStars ?? 0, worldH: state.worldH ?? null };
    return items;
  },
  opportunities(state: HoverState): Record<string, number> {
    return {
      barriers: state.totalGates,
      goldStars: state.totalStars ?? 0,
      tightGates: state.pillars.filter((p) => p.tightTop !== undefined).length,
      centreLines: state.pillars.filter((p) => p.tightTop !== undefined).length,
      chains: state.chains?.length ?? 0,
      chainStars: (state.chains ?? []).reduce((n, c) => n + c.stars.length, 0),
      shields: state.pickups?.length ?? 0,
    };
  },
};
