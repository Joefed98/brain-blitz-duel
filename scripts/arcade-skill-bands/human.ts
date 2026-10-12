/**
 * Simulated human players for the arcade skill bands (scripts/arcade-skill-bands.ts).
 *
 * Four levels, the same in every game. Each bot plays through the real sim and
 * may look at the state the way a player looks at the screen, but every action
 * goes through a Human: it reacts late (reaction time with spread and the odd
 * lapse), times anticipated moments with jitter, aims with pixel and power
 * error, thinks for a while before planning moves, and sometimes slips or
 * misjudges which option is best. All randomness is seeded per (game, seed,
 * level), so a run reproduces exactly. Script-only: floats and Math functions
 * are fine here because the result is an input log the sim replays.
 */

export const LEVELS = ["average", "good", "great", "near"] as const;
export type SkillLevel = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  average: "Average",
  good: "Good",
  great: "Great",
  near: "Near-perfect",
};

export interface SkillProfile {
  /** Reaction to an event the player did not know was coming, ms (mean, sd); floor 120 ms. */
  reactionMs: readonly [number, number];
  /** Chance per reaction of a lapse (looked away, hesitated) adding 150–450 ms. */
  lapse: number;
  /** Timing error on an anticipated moment (a beat, a release point), ms sd. */
  timingSdMs: number;
  /** Pointing error in phone pixels (a 390-px-wide screen), sd. */
  aimSdPx: number;
  /** Relative error on a strength (drag length, flick power), sd. */
  powerSd: number;
  /** Chance per decision of a plain slip: the wrong lane, a mis-tap, a bad pick. */
  mistake: number;
  /** Planning speed: base think times are multiplied by this. */
  thinkScale: number;
  /** Misjudgement: each option's value is blurred by this fraction of the value range before picking. */
  judgement: number;
  /** Finger-tracking lag for continuous control (paddles, steering), ms. */
  trackLagMs: number;
}

/**
 * Reaction means follow the brief (300 / 230 / 190 / 160 ms). Other figures are
 * typical touch-screen values: timing sd 45→12 ms, aim sd 9→2.5 px, power sd 7→1.5 %.
 */
export const PROFILES: Record<SkillLevel, SkillProfile> = {
  average: { reactionMs: [300, 55], lapse: 0.08, timingSdMs: 45, aimSdPx: 9, powerSd: 0.07, mistake: 0.1, thinkScale: 1, judgement: 0.35, trackLagMs: 140 },
  good: { reactionMs: [230, 40], lapse: 0.04, timingSdMs: 30, aimSdPx: 6, powerSd: 0.045, mistake: 0.05, thinkScale: 0.75, judgement: 0.2, trackLagMs: 100 },
  great: { reactionMs: [190, 30], lapse: 0.02, timingSdMs: 20, aimSdPx: 4, powerSd: 0.03, mistake: 0.025, thinkScale: 0.55, judgement: 0.1, trackLagMs: 75 },
  near: { reactionMs: [160, 20], lapse: 0.005, timingSdMs: 12, aimSdPx: 2.5, powerSd: 0.015, mistake: 0.008, thinkScale: 0.4, judgement: 0.04, trackLagMs: 55 },
};

const TICK_MS = 1000 / 60;

/** mulberry32 over a 32-bit state; a stable stream per (game, seed, level). */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Human {
  readonly level: SkillLevel;
  readonly p: SkillProfile;
  private rand: () => number;
  private spare: number | null = null;

  constructor(game: string, seed: number, level: SkillLevel) {
    this.level = level;
    this.p = PROFILES[level];
    this.rand = mulberry(hash(`${game}:${seed}:${level}`));
  }

  /** Uniform in [0, 1). */
  u(): number {
    return this.rand();
  }

  /** Integer in [lo, hi]. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.rand() * (hi - lo + 1));
  }

  /** Standard normal (Box–Muller). */
  normal(): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    let u = 0;
    while (u <= 1e-12) u = this.rand();
    const v = this.rand();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  chance(p: number): boolean {
    return this.rand() < p;
  }

  /** Reaction time in ms to an unexpected event, lapses included. */
  reactionMs(): number {
    const [mean, sd] = this.p.reactionMs;
    let ms = Math.max(120, mean + sd * this.normal());
    if (this.chance(this.p.lapse)) ms += 150 + 300 * this.rand();
    return ms;
  }

  /** Reaction in whole sim ticks (at least 7). */
  reactTicks(): number {
    return Math.max(7, Math.round(this.reactionMs() / TICK_MS));
  }

  /** Error on an anticipated moment, in ticks (signed). `scale` widens it for harder reads. */
  timingTicks(scale = 1): number {
    return Math.round((this.p.timingSdMs * scale * this.normal()) / TICK_MS);
  }

  /** Same, unrounded, in ms. */
  timingMs(scale = 1): number {
    return this.p.timingSdMs * scale * this.normal();
  }

  /** Pointing error in world units, given world units per phone pixel. */
  aim(worldPerPx = 1, scale = 1): number {
    return this.p.aimSdPx * worldPerPx * scale * this.normal();
  }

  /** Multiplier for a strength (1 ± power error). */
  power(scale = 1): number {
    return 1 + this.p.powerSd * scale * this.normal();
  }

  /** A plain slip on this decision. */
  slip(scale = 1): boolean {
    return this.chance(this.p.mistake * scale);
  }

  /** Thinking time for a plan whose base (average-player) time is `baseMs`; log-normal spread. */
  thinkTicks(baseMs: number, spread = 0.35): number {
    const ms = baseMs * this.p.thinkScale * Math.exp(spread * this.normal());
    return Math.max(1, Math.round(ms / TICK_MS));
  }

  /** Finger-tracking lag in ticks for continuous control. */
  lagTicks(): number {
    return Math.max(1, Math.round((this.p.trackLagMs * (1 + 0.25 * this.normal())) / TICK_MS));
  }

  /**
   * Picks among options by a blurred value: each value gets noise of
   * `judgement × (max − min)` sd, and a slip picks a random option. Returns the
   * index into `values`, or -1 when empty.
   */
  pick(values: readonly number[], judgementScale = 1): number {
    if (values.length === 0) return -1;
    if (values.length > 1 && this.slip()) return this.int(0, values.length - 1);
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of values) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const blur = this.p.judgement * judgementScale * Math.max(1e-9, hi - lo);
    let best = 0;
    let bestV = -Infinity;
    values.forEach((v, i) => {
      const seen = v + blur * this.normal();
      if (seen > bestV) {
        bestV = seen;
        best = i;
      }
    });
    return best;
  }
}

export const msToTicks = (ms: number) => Math.round(ms / TICK_MS);
