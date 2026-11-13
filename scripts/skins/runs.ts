/**
 * The seven skinnable games' run plumbing for the skins replay check (wave 2, E1): each game's sim on a stamp, its
 * dealt seeds, its checkpoint, its encoder and the server's own replay (the scorer rooms and practice store), and the
 * live stage's draw in a look (the same calls the stage makes).
 */
import type { ArcadeGame, ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { inputAt, recordInput, type InputRange } from "../../src/lib/arcade/engine";
import type { GameLook } from "../../src/lib/arcade/skins/look";
import type { SkinGame } from "./frames";

export interface RunSpec {
  game: SkinGame;
  rev: number;
  sim: (seed: number) => ArcadeGame<any, ArcadeInputEvent | null>;
  seedFor: (n: number) => number;
  checkpoint: (s: any) => unknown;
  interval: number;
  rate: number;
  encode: (body: { seed: number; claimedScore: number; events: ArcadeInputEvent[]; endTick: number; checkpoints: any[] }) => string;
  replay: (seed: number, raw: string) => { score: number; state: unknown };
  /** The live stage's frame of a state in a look, in world px, on a w × h canvas. */
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, s: any, look: GameLook) => void;
}

export async function runSpecs(): Promise<RunSpec[]> {
  const Pool = await import("../../src/lib/arcade/pool");
  const PoolR = await import("../../src/lib/arcade/pool.renderer");
  const PoolD = await import("../../src/lib/duel/pool");
  const { POOL_BANK } = await import("../../src/lib/duel/poolBank.server");
  const { POOL_BANK_V3 } = await import("../../src/lib/duel/poolBankV3.server");
  const Mg = await import("../../src/lib/arcade/minigolf");
  const MgR = await import("../../src/lib/arcade/minigolf.renderer");
  const MgD = await import("../../src/lib/duel/minigolf");
  const { MINIGOLF_BANK } = await import("../../src/lib/duel/minigolfBank.server");
  const { MINIGOLF_BANK_V2 } = await import("../../src/lib/duel/minigolfBankV2.server");
  const Cu = await import("../../src/lib/arcade/curling");
  const CuR = await import("../../src/lib/arcade/curling.renderer");
  const CuD = await import("../../src/lib/duel/curling");
  const { CURLING_BANK } = await import("../../src/lib/duel/curlingBank.server");
  const { CURLING_BANK_V4 } = await import("../../src/lib/duel/curlingBankV4.server");
  const Ra = await import("../../src/lib/arcade/racing");
  const RaR = await import("../../src/lib/arcade/racing.renderer");
  const RaD = await import("../../src/lib/duel/racing");
  const { RACING_DEAL } = await import("../../src/lib/duel/racingDeal.server");
  const { RACING_DEAL_V3 } = await import("../../src/lib/duel/racingDealV3.server");
  const Fk = await import("../../src/lib/arcade/freekick");
  const FkR = await import("../../src/lib/arcade/freekick.renderer");
  const FkD = await import("../../src/lib/duel/freekick");
  const { FREEKICK_DEAL } = await import("../../src/lib/duel/freekickDeal.server");
  const { FREEKICK_DEAL_V4 } = await import("../../src/lib/duel/freekickDealV4.server");
  const Fc = await import("../../src/lib/arcade/cards/freecell");
  const FcR = await import("../../src/lib/arcade/cards/freecell.renderer");
  const Ps = await import("../../src/lib/arcade/cards/pokerSquares");
  const PsR = await import("../../src/lib/arcade/cards/pokerSquares.renderer");
  const CardsR = await import("../../src/lib/arcade/cards/cards.renderer");
  const CardsD = await import("../../src/lib/duel/cards");
  const SPORTS = 300;

  const mgEntry = (rev: number, seed: number) => (rev >= 2 ? MINIGOLF_BANK_V2 : MINIGOLF_BANK).find((e) => e.seed === seed)!;
  const aim = { dx: 0.6, dy: -0.8, power: 0.4, spinX: 0, spinY: 0 };
  const specs: RunSpec[] = [];
  for (const rev of [1, Pool.POOL_REV]) {
    const bank = rev >= 3 ? POOL_BANK_V3 : POOL_BANK;
    specs.push({
      game: "pool", rev, sim: () => Pool.poolGameFor(rev), seedFor: (n) => bank[n % bank.length]!, checkpoint: Pool.poolCheckpoint, interval: SPORTS, rate: 40,
      encode: PoolD.encodePoolRun, replay: (seed, raw) => PoolD.replayPoolRun(seed, raw, rev),
      w: Pool.POOL_W, h: Pool.POOL_H, draw: (ctx, s, look) => PoolR.drawPool(ctx, s, s.phase === 0 ? aim : null, false, look),
    });
  }
  for (const rev of [Mg.MINIGOLF_REV_CLASSIC, Mg.MINIGOLF_REV]) {
    const bank = rev >= 2 ? MINIGOLF_BANK_V2 : MINIGOLF_BANK;
    specs.push({
      game: "minigolf", rev, sim: (seed) => Mg.minigolfGameFor(mgEntry(rev, seed).pars, rev), seedFor: (n) => bank[n % bank.length]!.seed, checkpoint: Mg.minigolfCheckpoint, interval: SPORTS, rate: 40,
      encode: MgD.encodeMinigolfRun, replay: (seed, raw) => MgD.replayMinigolfRun(seed, raw, mgEntry(rev, seed).pars, rev),
      w: Mg.MINIGOLF_W, h: MgR.MINIGOLF_VIEW_H,
      draw: (ctx, s, look) => MgR.drawMinigolfPlay(ctx, s, () => MgR.drawMinigolfCourse(ctx, s, null, look), MgR.MINIGOLF_VIEW_H, look),
    });
  }
  for (const rev of [1, Cu.CURLING_REV]) {
    const bank = rev >= 4 ? CURLING_BANK_V4 : CURLING_BANK;
    specs.push({
      game: "curling", rev, sim: () => Cu.curlingGameFor(rev), seedFor: (n) => bank[n % bank.length]!, checkpoint: Cu.curlingCheckpoint, interval: SPORTS, rate: 40,
      encode: CuD.encodeCurlingRun, replay: (seed, raw) => CuD.replayCurlingRun(seed, raw, rev),
      w: Cu.CURLING_W, h: CuR.curlViewFor(rev).h,
      draw: (ctx, s, look) => CuR.drawCurling(ctx, s, s.phase === 0 ? { broomX: 20, broomY: 0, turn: 1, startX: 0 } as never : null, look),
    });
  }
  for (const rev of [1, Ra.RACING_REV_DEALT]) {
    const deal = rev >= 3 ? RACING_DEAL_V3 : RACING_DEAL;
    specs.push({
      game: "racing", rev, sim: () => Ra.racingGameFor(rev), seedFor: (n) => deal[n % deal.length]!, checkpoint: Ra.racingCheckpoint, interval: Ra.RACING_CHECKPOINT_INTERVAL, rate: 120,
      encode: RaD.encodeRacingRun, replay: (seed, raw) => RaD.replayRacingRun(seed, raw, rev),
      w: Ra.RACING_WORLD_W, h: Ra.RACING_WORLD_H,
      draw: (ctx, s, look) => RaR.drawRacingPlay(ctx, s, { width: Ra.RACING_WORLD_W, height: Ra.RACING_WORLD_H }, look),
    });
  }
  for (const rev of [1, Fk.FREEKICK_REV_DEALT]) {
    const deal = rev >= 4 ? FREEKICK_DEAL_V4 : FREEKICK_DEAL;
    const art = FkR.freekickArtGameFor(rev);
    specs.push({
      game: "freekick", rev, sim: () => Fk.freekickGameFor(rev), seedFor: (n) => deal[n % deal.length]!, checkpoint: Fk.freekickCheckpoint, interval: Fk.FREEKICK_CHECKPOINT_INTERVAL, rate: 20,
      encode: FkD.encodeFreekickRun, replay: (seed, raw) => FkD.replayFreekickRun(seed, raw, rev),
      w: Fk.FREEKICK_WORLD_W, h: Fk.FREEKICK_WORLD_H,
      draw: (ctx, s, look) => FkR.withFreekickLook(look, () => art.draw(ctx, s, { width: Fk.FREEKICK_WORLD_W, height: Fk.FREEKICK_WORLD_H })),
    });
  }
  for (const rev of [1, Fc.FC_REV]) {
    const art = FcR.freecellArtGame(undefined, rev);
    specs.push({
      game: "freecell", rev, sim: () => Fc.freecellGameFor(rev), seedFor: (n) => (n * 37) % 300, checkpoint: Fc.fcCheckpoint, interval: Fc.FC_CHECKPOINT_INTERVAL, rate: 120,
      encode: CardsD.encodeFreecellRun, replay: (seed, raw) => CardsD.replayFreecellRun(seed, raw, rev),
      w: FcR.FC_WORLD_W, h: FcR.FC_WORLD_H,
      draw: (ctx, s, look) => CardsR.withCardsLook(look, () => art.draw(ctx, s, { width: FcR.FC_WORLD_W, height: FcR.FC_WORLD_H })),
    });
  }
  for (const rev of [1, Ps.PS_REV]) {
    const art = PsR.pokerSquaresArtGame(undefined, rev);
    specs.push({
      game: "pokersquares", rev, sim: () => Ps.pokerSquaresGameFor(rev), seedFor: (n) => 1000 + n * 7919, checkpoint: Ps.psCheckpoint, interval: Ps.PS_CHECKPOINT_INTERVAL, rate: 60,
      encode: CardsD.encodePokerSquaresRun, replay: (seed, raw) => CardsD.replayPokerSquaresRun(seed, raw, rev),
      w: PsR.PS_WORLD_W, h: PsR.PS_WORLD_H,
      draw: (ctx, s, look) => CardsR.withCardsLook(look, () => art.draw(ctx, s, { width: PsR.PS_WORLD_W, height: PsR.PS_WORLD_H })),
    });
  }
  // Changed with Joe's approval, 13 Nov 2026: 12 runs appended to scripts/fixtures/skins-replay-runs.json (the 28 earlier
  // runs byte-identical).
  // Summit, Thirteen and Five Hands (13 Nov 2026, Joe): the account's card back on their face-down cards. Appended after
  // the seven above, so the recorder's per-spec streams (prng by position) leave every earlier run as recorded.
  const Tp = await import("../../src/lib/arcade/cards/tripeaks");
  const TpR = await import("../../src/lib/arcade/cards/tripeaks.renderer");
  const Py = await import("../../src/lib/arcade/cards/pyramid");
  const PyR = await import("../../src/lib/arcade/cards/pyramid.renderer");
  const Fh = await import("../../src/lib/arcade/cards/fiveHands");
  const FhR = await import("../../src/lib/arcade/cards/fiveHands.renderer");
  for (const rev of [1, Tp.TP_REV]) {
    const art = TpR.tripeaksArtGame(undefined, rev);
    specs.push({
      game: "tripeaks", rev, sim: () => Tp.tripeaksGameFor(rev), seedFor: (n) => (n * 37) % 300, checkpoint: Tp.tpCheckpoint, interval: Tp.TP_CHECKPOINT_INTERVAL, rate: 120,
      encode: CardsD.encodeTripeaksRun, replay: (seed, raw) => CardsD.replayTripeaksRun(seed, raw, rev),
      w: TpR.TP_WORLD_W, h: TpR.TP_WORLD_H,
      draw: (ctx, s, look) => CardsR.withCardsLook(look, () => art.draw(ctx, s, { width: TpR.TP_WORLD_W, height: TpR.TP_WORLD_H })),
    });
  }
  for (const rev of [1, Py.PY_REV]) {
    const art = PyR.pyramidArtGame(undefined, rev);
    specs.push({
      game: "pyramid", rev, sim: () => Py.pyramidGameFor(rev), seedFor: (n) => 1000 + n * 7919, checkpoint: Py.pyCheckpoint, interval: Py.PY_CHECKPOINT_INTERVAL, rate: 120,
      encode: CardsD.encodePyramidRun, replay: (seed, raw) => CardsD.replayPyramidRun(seed, raw, rev),
      w: PyR.PY_WORLD_W, h: PyR.PY_WORLD_H,
      draw: (ctx, s, look) => CardsR.withCardsLook(look, () => art.draw(ctx, s, { width: PyR.PY_WORLD_W, height: PyR.PY_WORLD_H })),
    });
  }
  for (const rev of [1, Fh.FH_REV]) {
    const art = FhR.fiveHandsArtGame(undefined, rev);
    specs.push({
      game: "fivehands", rev, sim: () => Fh.fiveHandsGameFor(rev), seedFor: (n) => 1000 + n * 7919, checkpoint: Fh.fhCheckpoint, interval: Fh.FH_CHECKPOINT_INTERVAL, rate: 60,
      encode: CardsD.encodeFiveHandsRun, replay: (seed, raw) => CardsD.replayFiveHandsRun(seed, raw, rev),
      w: FhR.FH_WORLD_W, h: FhR.FH_WORLD_H,
      draw: (ctx, s, look) => CardsR.withCardsLook(look, () => art.draw(ctx, s, { width: FhR.FH_WORLD_W, height: FhR.FH_WORLD_H })),
    });
  }
  return specs;
}

/** A small seeded PRNG for the recorder (never the sims'). */
export function prng(seed: number): (n: number) => number {
  let x = seed >>> 0 || 1;
  return (n) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % n;
  };
}

/** Plays one run as the phone does (random inputs, many out of range, recorded on the tick they apply). */
export function playRun(spec: RunSpec, seed: number, rand: (n: number) => number) {
  const game = spec.sim(seed);
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  const ranges: readonly InputRange[] = game.inputRanges ?? [];
  const between = (a: number, b: number) => a + rand(b - a + 1);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (ranges.length && rand(1000) < spec.rate) {
      const range = ranges[rand(ranges.length)]!;
      const pick = (bound: readonly [number, number]) => {
        const span = bound[1] - bound[0];
        return between(bound[0] - Math.ceil(span / 4) - 2, bound[1] + Math.ceil(span / 4) + 2);
      };
      recordInput(events, { t, k: range.k, a: pick(range.a), b: pick(range.b), c: pick(range.c), d: pick(range.d) }, ranges);
    }
    state = game.step(state, inputAt(events, t));
    if (state.tick % spec.interval === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  return { raw: spec.encode({ seed, claimedScore: score, events, endTick: state.tick, checkpoints }), score };
}
