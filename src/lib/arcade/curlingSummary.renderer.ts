/**
 * Curl Champ's run summary on the answer reveal (the Sports overhaul, 15 Nov 2026; display only): the house from
 * above, drawn large, with every stone left on the sheet at the end (yours numbered by throw, the reds), a gold ring on
 * each of your stones that counted and a grey ring on a near miss, and the run's key numbers. Built by replaying this
 * player's own stored log through the sim (replayCurlingRun, the one place a score is worked out); nothing is stored.
 */
import { curlShortBy, NEAR_MISS_CM } from "./curlingFx";
import { replayCurlingRun } from "@/lib/duel/curling";
import {
  BUTTON_R,
  CU,
  EIGHT_FOOT_R,
  FOUR_FOOT_R,
  HOUSE_R,
  IN_HOUSE,
  STONE_R,
  TEAM_MINE,
  curlDist,
  type CurlingState,
} from "./curling";

/**
 * A near miss on the reveal: the same rule as in play (stage 2, curlingFx.ts `curlShortBy`): one of yours in play that
 * scored nothing but would have, NEAR_MISS_CM nearer the button (judged on the sheet as it ended).
 */
export const CURL_NEAR_MISS_CM = NEAR_MISS_CM;
/** The summary's view: this many cm from the button to each edge. */
export const CURL_SUMMARY_R = 250;

export interface CurlSummaryStone {
  /** Sheet cm from the button (x across, y along: negative is beyond the button). */
  x: number;
  y: number;
  mine: boolean;
  /** Your throw's number (1–8), or null for a red. */
  throw: number | null;
  /** Yours and counted (scored closeness points when it came to rest). */
  counting: boolean;
  nearMiss: boolean;
  /** Centre distance from the button (cm). */
  dist: number;
}

export interface CurlSummary {
  rev: number;
  stones: CurlSummaryStone[];
  thrown: number;
  /** Stones that counted (the sim's own count: closeness points when they came to rest). */
  counting: number;
  takeouts: number;
  opponents: number;
  /** Your closest stone at the end (centre to the button, cm), or null with none on the sheet. */
  closestCm: number | null;
}

/** The summary for a stored run (seed, the stored answer, the stored curlRev and level). */
export function curlingSummary(seed: number, answer: string, rev: number | null | undefined, level?: unknown): CurlSummary {
  const r = replayCurlingRun(seed, answer, rev, level);
  return curlingSummaryOf(r.state, r.takeouts, r.opponents);
}

export function curlingSummaryOf(s: CurlingState, takeouts: number, opponents: number): CurlSummary {
  const stones: CurlSummaryStone[] = [];
  for (let i = 0; i < s.x.length; i++) {
    if (!s.live[i]) continue;
    const mine = s.team[i] === TEAM_MINE;
    const n = mine ? i - s.theirs : -1;
    const counting = mine && (s.pts[n] ?? 0) > 0;
    const dist = curlDist(s.x[i]!, s.y[i]!) / CU;
    stones.push({
      x: s.x[i]! / CU,
      y: s.y[i]! / CU,
      mine,
      throw: mine ? n + 1 : null,
      counting,
      nearMiss: mine && !counting && curlShortBy(s, i) <= CURL_NEAR_MISS_CM,
      dist,
    });
  }
  const mineDists = stones.filter((st) => st.mine).map((st) => st.dist);
  return {
    rev: s.rev,
    stones,
    thrown: s.thrown,
    counting: s.pts.filter((p) => p > 0).length,
    takeouts,
    opponents,
    closestCm: mineDists.length ? Math.round(Math.min(...mineDists)) : null,
  };
}

const RING_BLUE = "#1D5BB5";
const RING_RED = "#C8202E";
const ICE = "#F1F6FA";
const GOLD = "#E8B53A";
const GOLD_HI = "#FFE29A";
const RED = "#C42A2E";
const GREY = "#8E97A6";

/** Where a summary stone sits on the board, as a share of its size (0…1 from the top left): the reveal's overlays. */
export function curlSummaryAt(st: Pick<CurlSummaryStone, "x" | "y">): { x: number; y: number } {
  return { x: 0.5 + st.x / (2 * CURL_SUMMARY_R), y: 0.5 + st.y / (2 * CURL_SUMMARY_R) };
}

/** The gold counting ring's radius as a share of the board's size (the reveal's overlay draws it there). */
export const CURL_SUMMARY_RING = (STONE_R * 1.42) / (2 * CURL_SUMMARY_R);

/**
 * Paints the summary's house (size × size device px) from above, the far end up. `domRings`: the gold counting rings are
 * the reveal's own lit overlays (CurlingSummary), so the board leaves them out.
 */
export function paintCurlingSummary(ctx: CanvasRenderingContext2D, size: number, sum: CurlSummary, domRings = false): void {
  const k = size / 2 / CURL_SUMMARY_R;
  const c = size / 2;
  const P = (x: number, y: number) => ({ x: c + x * k, y: c + y * k });
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.04);
  ctx.clip();
  ctx.fillStyle = ICE;
  ctx.fillRect(0, 0, size, size);
  for (const [r, fill] of [
    [HOUSE_R, RING_BLUE],
    [EIGHT_FOOT_R, ICE],
    [FOUR_FOOT_R, RING_RED],
    [BUTTON_R, ICE],
  ] as const) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(c, c, r * k, 0, Math.PI * 2);
    ctx.fill();
  }
  // The tee line and the centre line.
  ctx.strokeStyle = "#2B2B3366";
  ctx.lineWidth = Math.max(1, size / 360);
  ctx.beginPath();
  ctx.moveTo(0, c);
  ctx.lineTo(size, c);
  ctx.moveTo(c, 0);
  ctx.lineTo(c, size);
  ctx.stroke();
  const sr = STONE_R * k;
  // Reds first, then yours (the nearest drawn last, on top).
  const order = [...sum.stones].sort((a, b) => Number(a.mine) - Number(b.mine) || b.dist - a.dist);
  for (const st of order) {
    const p = P(st.x, st.y);
    if ((st.counting && !domRings) || st.nearMiss) {
      ctx.strokeStyle = st.counting ? GOLD : GREY;
      ctx.lineWidth = Math.max(2, sr * 0.28);
      ctx.beginPath();
      ctx.arc(p.x, p.y, sr * 1.42, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The granite body, then the handle colour as the stone's top.
    ctx.fillStyle = "#5D626C";
    ctx.beginPath();
    ctx.arc(p.x, p.y, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1B1E24";
    ctx.lineWidth = Math.max(1, sr * 0.1);
    ctx.stroke();
    ctx.fillStyle = st.mine ? GOLD : RED;
    ctx.beginPath();
    ctx.arc(p.x, p.y, sr * 0.68, 0, Math.PI * 2);
    ctx.fill();
    if (st.mine && st.throw !== null) {
      ctx.fillStyle = "#14100A";
      ctx.font = `800 ${Math.round(sr * 0.95)}px Archivo, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(st.throw), p.x, p.y + sr * 0.05);
    } else if (!st.mine) {
      ctx.fillStyle = "#FF8A80";
      ctx.fillRect(p.x - sr * 0.4, p.y - sr * 0.1, sr * 0.8, sr * 0.2);
    }
  }
  ctx.restore();
  // A thin rim so the board reads on any gradient.
  ctx.strokeStyle = GOLD_HI;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1, size / 300);
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, size - 1, size - 1, size * 0.04);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
