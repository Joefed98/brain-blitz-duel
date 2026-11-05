/**
 * The arcade standard's part rows for the games whose stored reveal lines are band lines (4 Nov 2026, Joe's review of
 * every reveal; display only, never a regrade).
 *
 * Fourteen games moved onto the arcade scoring standard (scripts/arcade-standard/<type>.ts) still store their reveal as
 * band lines (scoreBands.ts bandLines): "<what the run did> → <core points>", "<the features, one phrase each> +<their
 * sum>", "<the mistakes> −<their cost>", "Total → <score>". The reveal used to split those at their dots ("centre line 5
 * +52"). This reads them as stored and writes them as the standard's own part lines (arcadeStandard.ts stdLines: "Label:
 * detail → points of max", the total "Total → N of 200"), so the breakdown shows one row a part with its maximum and a
 * bar, the penalties as their own row, then the total, exactly as the spec games (Pinball, Blockzone, the Sports group).
 * The maximums are the sims' own constants for the stamp the puzzle was dealt on; a stamp not listed here (an older,
 * band-era revision) keeps its stored lines as they were.
 */
import { BT_REV_STD, BT_STD } from "@/lib/arcade/ballTrack";
import { BRK_REV_STD, BRK_V11_CLEAR_POINTS, BRK_V11_CORE_MAX, BRK_V11_GOLD_MAX, BRK_V11_SPEED_MAX } from "@/lib/arcade/breaker";
import { BURST_REV_STD, BURST_V10_PARTS } from "@/lib/arcade/burst";
import { CROSS_FLOW_STD, CROSS_REV_FLOW, CROSS_REV_STD, CROSS_STD } from "@/lib/arcade/cross";
import { FLIP_REV_FLOW, FLIP_REV_STD, FLIP_STD, FLIP_V11 } from "@/lib/arcade/flip";
import { HOVER_REV_STANDARD, HOVER_STD_CENTRE, HOVER_STD_CHAINS, HOVER_STD_CORE, HOVER_STD_GOLD, HOVER_STD_TIGHT } from "@/lib/arcade/hover";
import { INK_REV_STD, inkStdSpecFor } from "@/lib/arcade/inkBridge";
import {
  MATCHUP_REV_SIX,
  MATCHUP_V12_BIG_MAX,
  MATCHUP_V12_CORE_MAX,
  MATCHUP_V12_GOALS_MAX,
  MATCHUP_V12_ICE_MAX,
  MATCHUP_V12_TREASURE_MAX,
} from "@/lib/arcade/matchup";
import { ORBIT_REV_STD } from "@/lib/arcade/orbit";
import { ORBIT_STD } from "@/lib/arcade/orbitRev3";
import { SLICE_REV_STANDARD, SLICE_V11_COMBO_CAP, SLICE_V11_CORE, SLICE_V11_DODGE_CAP, SLICE_V11_GOLD_CAP, SLICE_V11_TICKET_CAP } from "@/lib/arcade/slice";
import { SNAKE_REV_STD, SNAKE_STD_CAPS, SNAKE_STD_CORE_MAX } from "@/lib/arcade/snake";
import { SWING_REV_SLIDE, SWING_V17_CORE, SWING_V17_GATE_POINTS, SWING_V17_GATES, SWING_V17_PAR_POINTS, SWING_V17_STREAK_MAX } from "@/lib/arcade/swing";
import { TILT_P_CLEAN_POINTS, TILT_P_CORE_MAX, TILT_P_PAR_MAX, TILT_P_SPEED_POINTS, TILT_REV_PAR } from "@/lib/arcade/tilt";
import { WAV_REV_STD, WAVEFRONT_STD } from "@/lib/arcade/wavefront";
import type { StdSpec } from "@/lib/arcade/arcadeStandard";
import { ARCADE_STANDARD } from "@/lib/arcade/standard";

/** One part as the reveal names it: its label, maximum and the words that find it in the stored features line. */
interface BandStdPart {
  label: string;
  max: number;
  /** Finds this part's phrase in the stored features line (the label itself when absent). */
  find?: RegExp;
}

interface BandStdGame {
  /** The puzzle field that carries the stamp. */
  field: string;
  /** The parts (core first) for the stamp the puzzle was dealt on; null for a stamp not on the standard. */
  parts: (rev: number) => readonly BandStdPart[] | null;
  /** The core's stored words made plain (a game's own jargon taken out). */
  coreDetail?: (text: string) => string;
}

const fromSpec = (spec: StdSpec): BandStdPart[] => spec.parts.map((p) => ({ label: p.label, max: p.max }));
const at = (from: number, parts: readonly BandStdPart[]) => (rev: number) => (rev >= from ? parts : null);

export const BAND_STD_GAMES: Readonly<Record<string, BandStdGame>> = {
  hover: {
    field: "hoverRev",
    parts: at(HOVER_REV_STANDARD, [
      { label: "Barriers passed", max: HOVER_STD_CORE },
      { label: "Star chains", max: HOVER_STD_CHAINS, find: /star chains?/i },
      { label: "Gold stars", max: HOVER_STD_GOLD, find: /gold stars?/i },
      { label: "Tight gates", max: HOVER_STD_TIGHT, find: /tight gates?/i },
      { label: "Centre line", max: HOVER_STD_CENTRE, find: /centre line/i },
    ]),
  },
  snake: {
    field: "snakeRev",
    parts: at(SNAKE_REV_STD, [
      { label: "Stars eaten", max: SNAKE_STD_CORE_MAX },
      { label: "Gold stars", max: SNAKE_STD_CAPS.gold, find: /^gold\b/i },
      { label: "Combos", max: SNAKE_STD_CAPS.combo, find: /^combos?\b/i },
      { label: "Lane rides", max: SNAKE_STD_CAPS.lane, find: /^lanes?\b/i },
      { label: "Warp stars", max: SNAKE_STD_CAPS.warp, find: /^warps?\b/i },
    ]),
    // "3 stars + 1 gold ×2 (120 at 28)": the curve's own figures are jargon on the reveal.
    coreDetail: (text) => text.replace(/\s*\(\d+ at \d+\)\s*$/, "").replace(/ gold ×2$/, " gold counting 2"),
  },
  cross: {
    field: "crossRev",
    parts: (rev) =>
      rev >= CROSS_REV_FLOW
        ? withFinds(fromSpec(CROSS_FLOW_STD), { "No-stop streak": /no-stop streak/i, "Close calls": /close calls?/i })
        : rev >= CROSS_REV_STD
          ? withFinds(fromSpec(CROSS_STD), { Coins: /coins?\b/i, Streak: /^streak\b/i, "Close calls": /close calls?/i })
          : null,
  },
  wavefront: { field: "wavRev", parts: at(WAV_REV_STD, fromSpec(WAVEFRONT_STD)) },
  burst: {
    field: "burstRev",
    parts: at(BURST_REV_STD, [
      { label: "Atoms popped", max: BURST_V10_PARTS.core },
      { label: "Wave clears", max: BURST_V10_PARTS.clear, find: /wave clears?/i },
      { label: "Golden atoms", max: BURST_V10_PARTS.gold, find: /golden atoms?/i },
    ]),
  },
  slice: {
    field: "sliceRev",
    parts: at(SLICE_REV_STANDARD, [
      { label: "Food sliced", max: SLICE_V11_CORE },
      { label: "Combo", max: SLICE_V11_COMBO_CAP, find: /^combo\b/i },
      { label: "Golden fruit", max: SLICE_V11_GOLD_CAP, find: /^golden\b/i },
      { label: "Bread tickets", max: SLICE_V11_TICKET_CAP, find: /^tickets?\b/i },
      { label: "Dodges", max: SLICE_V11_DODGE_CAP, find: /^dodges?\b/i },
    ]),
  },
  flip: {
    field: "flipRev",
    parts: (rev) => (rev >= FLIP_REV_FLOW ? fromSpec(FLIP_V11) : rev >= FLIP_REV_STD ? fromSpec(FLIP_STD) : null),
  },
  swing: {
    field: "swingRev",
    parts: at(SWING_REV_SLIDE, [
      { label: "Course", max: SWING_V17_CORE },
      { label: "Pars", max: SWING_V17_PAR_POINTS, find: /^pars?\b/i },
      { label: "Gates", max: SWING_V17_GATE_POINTS * SWING_V17_GATES, find: /^gates?\b/i },
      { label: "Clean-swing streak", max: SWING_V17_STREAK_MAX, find: /^streak\b/i },
    ]),
  },
  matchup: {
    field: "matchupRev",
    parts: at(MATCHUP_REV_SIX, [
      { label: "Gems cleared", max: MATCHUP_V12_CORE_MAX },
      { label: "Treasure", max: MATCHUP_V12_TREASURE_MAX, find: /^treasures?\b/i },
      { label: "Colour goals", max: MATCHUP_V12_GOALS_MAX, find: /^goals?\b/i },
      { label: "Ice broken", max: MATCHUP_V12_ICE_MAX, find: /^ice\b/i },
      { label: "Big lines", max: MATCHUP_V12_BIG_MAX, find: /^big lines?\b/i },
    ]),
  },
  inkbridge: { field: "inkRev", parts: (rev) => (rev >= INK_REV_STD ? fromSpec(inkStdSpecFor(rev)) : null) },
  tilt: {
    field: "tiltRev",
    parts: at(TILT_REV_PAR, [
      { label: "Mazes", max: TILT_P_CORE_MAX },
      { label: "Par", max: TILT_P_PAR_MAX, find: /^par\b/i },
      { label: "Clean run", max: TILT_P_CLEAN_POINTS, find: /^clean\b/i },
      { label: "Speed", max: TILT_P_SPEED_POINTS, find: /^speed\b/i },
    ]),
    // "2 / 4 mazes × 35 + 5 for progress in maze 3": the maze's points are the row's, not its words.
    coreDetail: (text) => text.replace(/ × \d+/, "").replace(/ \+ 0 for progress in maze \d+$/, "").replace(/ \+ (\d+) for progress in maze (\d+)$/, ", maze $2 part done"),
  },
  balltrack: { field: "btRev", parts: at(BT_REV_STD, fromSpec(BT_STD)) },
  // The planets alone: the stardust, slingshots, fields and perfect orbits are their own rows.
  orbit: { field: "orbitRev", parts: at(ORBIT_REV_STD, fromSpec(ORBIT_STD)), coreDetail: (text) => text.split(/ · | \| /)[0]! },
  breaker: {
    field: "brkRev",
    parts: at(BRK_REV_STD, [
      { label: "Bricks destroyed", max: BRK_V11_CORE_MAX },
      { label: "Wall cleared", max: BRK_V11_CLEAR_POINTS, find: /wall cleared/i },
      { label: "Speed", max: BRK_V11_SPEED_MAX, find: /^speed\b/i },
      { label: "Gold bricks", max: BRK_V11_GOLD_MAX, find: /^gold\b/i },
    ]),
  },
};

function withFinds(parts: BandStdPart[], finds: Record<string, RegExp>): BandStdPart[] {
  return parts.map((p) => {
    const find = finds[p.label];
    return find ? { ...p, find } : p;
  });
}

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The standard's maximum (arcadeStandard.ts STD_MAX). */
const STD_TOTAL_MAX = 200;

/** One stored phrase's points and the words left once the label and the points are taken off. */
function readPhrase(phrase: string, part: BandStdPart): { points: number | null; detail: string } {
  let text = phrase.trim();
  let points: number | null = null;
  const plus = /\s*\+(\d+)\s*(\([^)]*\))?\s*$/.exec(text) ?? /\s*\+(\d+)\b/.exec(text);
  if (plus) {
    points = Number(plus[1]);
    text = `${text.slice(0, plus.index)} ${plus[2] ?? ""} ${text.slice(plus.index + plus[0].length)}`.replace(/\s{2,}/g, " ").trim();
  } else {
    const ratio = /(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
    if (ratio && Number(ratio[2]) === part.max) {
      // "Gold 12/40": this part's points of its maximum.
      points = Number(ratio[1]);
      text = text.slice(0, ratio.index).trim();
    } else {
      const tail = /(?:^|\s)(\d+)\s*$/.exec(text);
      if (tail) {
        points = Number(tail[1]);
        text = text.slice(0, tail.index).trim();
      }
    }
  }
  return { points, detail: detailOf(text, part.find ?? new RegExp(escapeRe(part.label), "i")) };
}

/** What a phrase says the run did once its label's words go: "16 close calls" stays whole, "Gold 2 / 5" is "2 / 5". */
function detailOf(text: string, find: RegExp): string {
  const bare = text.replace(find, "").replace(/[()]/g, "").replace(/\s{2,}/g, " ").trim();
  if (!bare || !/\d/.test(bare)) return "";
  // The label first ("Par 2 / 4 mazes", "Combo (40 foods)"): what follows it. A count first ("16 close calls"): the phrase.
  const lead = text.search(find);
  if (lead <= 0) return bare;
  return text.replace(/[()]/g, "").trim();
}

/** A stored detail on one row: no dots between phrases (commas instead). */
const oneRow = (text: string) => text.replace(/\s*[·|]\s*/g, ", ").replace(/\s{2,}/g, " ").trim();

/**
 * The standard's part lines for a band-lined run, or null when the game or the dealt stamp is not one of these or the
 * stored lines are not band lines (the run's own lines then show as stored).
 */
export function bandStdLines(puzzle: { type: string } & Record<string, unknown>, lines: readonly string[], score: number | null): string[] | null {
  const game = BAND_STD_GAMES[puzzle.type];
  if (!game || !lines.length) return null;
  const rev = puzzle[game.field];
  const parts = typeof rev === "number" ? game.parts(rev) : null;
  if (!parts || !parts.length) return null;
  // Already the standard's lines (a run stored after a server change): nothing to do.
  if (lines.some((l) => /^[^:→]+: .* → -?\d+ of \d+$/.test(l))) return null;
  const first = lines[0]!;
  const noInput = / · no input → 0$/.test(first);
  const core = noInput ? null : /^(.*) → (\d+)$/.exec(first);
  if (!noInput && !core) return null;
  const [corePart, ...features] = parts;
  const coreText = noInput ? first.replace(/ · no input → 0$/, "") : core![1]!;
  const coreDetail = oneRow(game.coreDetail ? game.coreDetail(coreText) : coreText);
  const got = new Map<BandStdPart, { points: number; detail: string }>();
  let penalty: { text: string; points: number } | null = null;
  for (const line of lines.slice(1)) {
    if (/^Total → /.test(line) || /^At least 1 for playing/.test(line)) continue;
    const minus = /^(.*) −(\d+)$/.exec(line);
    if (minus) {
      penalty = { text: minus[1]!, points: Number(minus[2]) };
      continue;
    }
    const bonus = /^(.*) \+(\d+)$/.exec(line);
    if (!bonus) continue;
    const phrases = bonus[1]!.split(/\s*·\s*|,\s+(?=[a-z])/i).filter(Boolean);
    const matched = phrases.map((phrase) => ({ phrase, part: features.find((f) => (f.find ?? new RegExp(escapeRe(f.label), "i")).test(phrase)) }));
    const known = matched.filter((m) => m.part);
    for (const { phrase, part } of known) {
      const find = part!.find ?? new RegExp(escapeRe(part!.label), "i");
      if (phrases.length === 1 && !/\+\d/.test(phrase)) {
        // One phrase with no figure of its own: the line's sum is its points ("Gold 2 / 5 +20", "no-stop streak 30 +30").
        const sum = Number(bonus[2]);
        const text = phrase.replace(new RegExp(`\\s+${sum}$`), "").trim();
        got.set(part!, { points: sum, detail: detailOf(text, find) });
        continue;
      }
      const read = readPhrase(phrase, part!);
      got.set(part!, { points: read.points ?? 0, detail: read.detail });
    }
  }
  const out: string[] = [];
  out.push(`${corePart!.label}: ${plainDetail(coreDetail)} → ${noInput ? 0 : Number(core![2])} of ${corePart!.max}`);
  for (const f of features) {
    const g = got.get(f);
    out.push(`${f.label}: ${plainDetail(g?.detail ?? "")} → ${Math.min(f.max, g?.points ?? 0)} of ${f.max}`);
  }
  if (penalty && penalty.points > 0) out.push(`Penalty: ${penalty.text} → −${penalty.points}`);
  if (score !== null) out.push(`Total → ${score} of ${STD_TOTAL_MAX}`);
  return out;
}

const plainDetail = (text: string) => oneRow(text).replace(/(\d)\s*\/\s*(\d)/g, "$1 of $2");

/** The part names of the stamp a puzzle was dealt on, from the standard's specs or the table above (else none). */
export function standardPartLabels(puzzle: { type: string } & Record<string, unknown>): string[] {
  const game = BAND_STD_GAMES[puzzle.type];
  if (game) {
    const rev = puzzle[game.field];
    const parts = typeof rev === "number" ? game.parts(rev) : null;
    if (parts) return parts.map((p) => p.label);
  }
  const spec = ARCADE_STANDARD[puzzle.type]?.spec;
  if (!spec) return [];
  const rev = puzzle[spec.field];
  return typeof rev === "number" && rev >= spec.rev ? spec.parts.map((p) => p.label) : [];
}
