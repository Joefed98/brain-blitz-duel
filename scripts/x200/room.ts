/**
 * The arcade rule's room proof (26 Oct 2026, the 200-point expansions of Hover, Grappler, Roofbound and
 * Scrumper; Hover, Grappler and Roofbound shipped): every player in a room plays the identical run, so everything a run offers (spawns, pickups,
 * shield points, gates, par times, wind, schedules) must come from the stored puzzle alone, never from how a
 * player has played. Each game's module in this folder (`scripts/x200/<type>.ts`) exports `x200Room`;
 * arcade-room-schedule-check plays every room deal it gives with several input styles and fails unless every
 * scheduled item any two runs both saw is identical, and the run's guaranteed opportunity counts match.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ArcadeGame, ArcadeInputEvent } from "../../src/lib/arcade/engine";

/** The input styles a room proof plays: nothing, random input, and the skill-band bots at the ends of the range. */
export const ROOM_STYLES = ["idle", "random", "weak", "good", "elite"] as const;
export type RoomStyle = (typeof ROOM_STYLES)[number];

export interface RoomDeal {
  /** The stored puzzle's seed. */
  seed: number;
  /** The game for the stored puzzle (the server generator's deal, through the same gameFor the phone uses). */
  game: ArcadeGame<any, any>;
}

export interface X200Room {
  type: string;
  /** The version stamp under test (the expansion's new revision). */
  rev: number;
  /** The n-th room deal through the server's own generator (arcade.server.ts). */
  deal(n: number): RoomDeal;
  /** The input log one style plays on a deal: events, or taps for a tap game. */
  play(deal: RoomDeal, style: RoomStyle): { events?: ArcadeInputEvent[]; taps?: number[] };
  /**
   * Everything seeded that a state shows: id → descriptor (place, time, kind, value, par…). Items not yet
   * generated are simply absent; an item, once present, must read the same in every run of the deal.
   * Never anything the player changed (whether it was taken, the player's position).
   */
  schedule(state: any): Record<string, unknown>;
  /** The opportunity counts the deal guarantees (stars, gates, shields, par levels…): equal for every style. */
  opportunities(state: any): Record<string, number>;
  /** Number of deals the check plays (default 8). */
  deals?: number;
}
