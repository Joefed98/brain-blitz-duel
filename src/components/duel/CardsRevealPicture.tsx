/**
 * The Cards & Board overhaul's answer reveal picture (15 Nov 2026, Joe's brief; display only): for Free Cell, Mahjong
 * Solitaire, Summit, Five Hands and Thirteen, the reveal shows the run's final table large (the game's own art, cropped
 * to the play area: no HUD row, no buttons), a row of key numbers that explain the score in short plain labels, and
 * one visual summary of the run (Summit's best run as a ladder, Mahjong's pairs as a bar, Thirteen's pairs as pips,
 * Five Hands' score sum, Free Cell's moves against par). Everything comes from the server-side replay of the stored
 * run (the same replay that scored it), never from the phone's own state.
 */
import { useEffect, useMemo, useRef } from "react";

import { canvasRatio } from "@/lib/battery";
import { FxCountUp } from "@/components/fx/GameFx";
import { replayFiveHandsRun, replayFreecellRun, replayPyramidRun, replayTripeaksRun } from "@/lib/duel/cards";
import { replayMahjongRun } from "@/lib/duel/mahjong";
import type { PuzzleData } from "@/lib/duel/types";
import { drawFreecell, fcColStep, FC_BTN_ROW_Y, FC_COL_H, FC_COL_Y, FC_WORLD_W } from "@/lib/arcade/cards/freecell.renderer";
import { fcCardsOf } from "@/lib/arcade/cards/freecell";
import { levelOfPuzzle } from "@/lib/levels/levels";
import { drawTripeaks, TP_PILE_H, TP_PILE_Y, TP_WORLD_W } from "@/lib/arcade/cards/tripeaks.renderer";
import { drawPyramid, PY_PILE_H, PY_PILE_Y, PY_WORLD_W } from "@/lib/arcade/cards/pyramid.renderer";
import { PY_CARDS, PY_PAIR_FULL } from "@/lib/arcade/cards/pyramid";
import { drawFiveHands, FH_DISCARD_H, FH_DISCARD_Y, FH_WORLD_W, fhPointsShown } from "@/lib/arcade/cards/fiveHands.renderer";
import { fhLevelRulesOf, fhMultText, fhPickedHand, fhTotals } from "@/lib/arcade/cards/fiveHands";
import { drawMahjong } from "@/lib/arcade/mahjong.renderer";
import { MAHJONG_HUD_H, MAHJONG_PAIRS, MAHJONG_WORLD_H, MAHJONG_WORLD_W } from "@/lib/arcade/mahjong";

/** The games this picture serves. */
export const CARDS_REVEAL_TYPES: ReadonlySet<string> = new Set(["freecell", "mahjong", "tripeaks", "fivehands", "pyramid"]);

interface Fact {
  label: string;
  value: string;
  /** Lit: the part reached its best. */
  best?: boolean;
}

interface Picture {
  worldW: number;
  top: number;
  bottom: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
  facts: Fact[];
  /** The visual summary: a labelled row of filled / empty marks, or a sum. */
  marks?: { label: string; filled: number; of: number };
  sum?: string | undefined;
  /** The number the sum lands on (counted up by the effects kit). */
  sumTo?: number | undefined;
}

const seedOf = (p: PuzzleData): number => ("seed" in p ? Number(p.seed) : 1);
const secs = (s: number) => `${s.toFixed(1)} s`;

/** Works the picture out from the stored run (null for another game or an empty run). */
export function cardsRevealPicture(puzzle: PuzzleData, answer: string): Picture | null {
  if (!answer) return null;
  const seed = seedOf(puzzle);
  switch (puzzle.type) {
    case "freecell": {
      const r = replayFreecellRun(seed, answer, puzzle.freecellRev, levelOfPuzzle(puzzle));
      const s = r.state;
      const all = fcCardsOf(s);
      const longest = Math.max(1, ...s.cols.map((c) => c.length));
      const bottom = Math.min(FC_BTN_ROW_Y - 4, FC_COL_Y + (longest - 1) * fcColStep(longest) + FC_COL_H + 10);
      return {
        worldW: FC_WORLD_W,
        top: 38,
        bottom,
        draw: (ctx) => drawFreecell(ctx, s, { width: FC_WORLD_W, height: 772 }),
        facts: [
          { label: "Home", value: `${r.home}/${all}`, best: r.finished },
          { label: "Moves", value: `${r.moves} (par ${r.par})`, best: r.finished && r.moves <= r.par },
          r.finished ? { label: "Time", value: secs(r.finishSeconds) } : { label: "Sorted", value: `${r.sorted}` },
        ],
        marks: { label: "Cards home", filled: r.home, of: all },
      };
    }
    case "tripeaks": {
      const r = replayTripeaksRun(seed, answer, puzzle.tripeaksRev, levelOfPuzzle(puzzle));
      const s = r.state;
      return {
        worldW: TP_WORLD_W,
        top: 38,
        bottom: TP_PILE_Y + TP_PILE_H + 40,
        draw: (ctx) => drawTripeaks(ctx, s, { width: TP_WORLD_W, height: 772 }),
        facts: [
          { label: "Cleared", value: `${r.cleared}/28`, best: r.finished },
          { label: "Peaks", value: `${r.peaks}/3`, best: r.peaks === 3 },
          (puzzle.tripeaksRev ?? 1) >= 2 ? { label: "Stock", value: `${r.stockTurns} (par ${r.stockPar})`, best: r.finished && r.stockTurns <= r.stockPar } : { label: "Time", value: r.finished ? secs(r.finishSeconds) : "–" },
        ],
        marks: { label: `Best run ${r.bestRun}`, filled: Math.min(10, r.bestRun), of: 10 },
      };
    }
    case "pyramid": {
      const r = replayPyramidRun(seed, answer, puzzle.pyramidRev, levelOfPuzzle(puzzle));
      const s = r.state;
      return {
        worldW: PY_WORLD_W,
        top: 38,
        bottom: PY_PILE_Y + PY_PILE_H + 10,
        draw: (ctx) => drawPyramid(ctx, s, { width: PY_WORLD_W, height: 772 }),
        facts: [
          { label: "Removed", value: `${r.removed}/${PY_CARDS}`, best: r.finished },
          { label: "Kings", value: `${r.kings}` },
          r.finished ? { label: "Time", value: secs(r.finishSeconds) } : { label: "Undos", value: `${r.undos}` },
        ],
        marks: { label: "Pyramid pairs", filled: Math.min(PY_PAIR_FULL, r.ppPairs), of: PY_PAIR_FULL },
      };
    }
    case "fivehands": {
      const r = replayFiveHandsRun(seed, answer, puzzle.fiveHandsRev, levelOfPuzzle(puzzle));
      const s = r.state;
      const rows = fhTotals(s.rows, s.rev);
      const picked = fhPickedHand(s);
      const v3 = (s.rev ?? 1) >= 3;
      return {
        worldW: FH_WORLD_W,
        top: 38,
        bottom: FH_DISCARD_Y + FH_DISCARD_H + 6,
        draw: (ctx) => drawFiveHands(ctx, s, { width: FH_WORLD_W, height: 772 }),
        facts: [
          { label: "Hands", value: `${rows.made}/5`, best: rows.made === 5 },
          { label: "Rows", value: `${rows.total}` },
          v3 ? { label: "Column", value: picked.column >= 0 ? `+${picked.points}` : "not picked" } : { label: "Points", value: `${rows.total}` },
        ],
        sum: v3 ? `(${rows.total}${picked.column >= 0 ? ` + ${picked.points}` : ""}) × ${fhMultText(s)}${(s.hints ?? 0) && fhLevelRulesOf(s)?.hintCost ? ` − ${(s.hints ?? 0) * fhLevelRulesOf(s)!.hintCost}` : ""} = ${fhPointsShown(s)}` : undefined,
        sumTo: v3 ? fhPointsShown(s) : undefined,
      };
    }
    case "mahjong": {
      const r = replayMahjongRun(seed, answer, puzzle.mahjongRev, levelOfPuzzle(puzzle));
      return {
        worldW: MAHJONG_WORLD_W,
        top: MAHJONG_HUD_H,
        bottom: MAHJONG_WORLD_H,
        draw: (ctx) => drawMahjong(ctx, r.state, { width: MAHJONG_WORLD_W, height: MAHJONG_WORLD_H }),
        facts: [
          { label: "Pairs", value: `${r.pairs}/${r.state.face.length / 2}`, best: r.cleared },
          { label: "Shuffles", value: `${r.shuffles}`, best: r.cleared && r.shuffles === 0 },
          r.cleared ? { label: "Time", value: secs(r.clearedSeconds) } : { label: "Tiles left", value: `${r.state.face.length - r.pairs * 2}` },
        ],
        marks: { label: "Pairs taken", filled: r.pairs, of: r.state.face.length / 2 },
      };
    }
    default:
      return null;
  }
}

/** The final table, cropped to the play area, filling the column's width. */
function TableCanvas({ picture }: { picture: Picture }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const h = picture.bottom - picture.top;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const paint = () => {
      const w = canvas.clientWidth || 340;
      const k = w / picture.worldW;
      const ratio = canvasRatio();
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * k * ratio);
      ctx.setTransform(ratio * k, 0, 0, ratio * k, 0, -picture.top * ratio * k);
      picture.draw(ctx);
    };
    paint();
    // The real card art may still be loading: paint again once it has had a moment.
    const again = window.setTimeout(paint, 700);
    return () => window.clearTimeout(again);
  }, [picture, h]);
  return <canvas ref={ref} aria-hidden="true" data-cards-reveal-table="" className="w-full rounded-xl" style={{ aspectRatio: `${picture.worldW} / ${h}` }} />;
}

export function CardsRevealPicture({ puzzle, answer }: { puzzle: PuzzleData; answer: string | null }) {
  const picture = useMemo(() => (answer ? cardsRevealPicture(puzzle, answer) : null), [puzzle, answer]);
  if (!picture) return null;
  return (
    <div data-cards-reveal={puzzle.type} className="flex w-full max-w-[380px] shrink-0 flex-col items-stretch gap-2 self-center">
      <div data-cards-reveal-facts="" className="flex w-full items-stretch justify-center gap-2">
        {picture.facts.map((f) => (
          <div key={f.label} data-fact={f.label} className={`flex min-w-0 flex-1 flex-col items-center rounded-xl px-2 py-1.5 ${f.best ? "bg-[var(--jz-gold)] text-[var(--jz-on-gold)]" : "bg-black/35 text-foreground"}`}>
            <span className="text-[12px] font-semibold opacity-80">{f.label}</span>
            <span className="whitespace-nowrap text-[17px] font-extrabold tabular-nums">{f.value}</span>
          </div>
        ))}
      </div>
      <TableCanvas picture={picture} />
      {picture.marks ? (
        <div data-cards-reveal-marks="" aria-label={`${picture.marks.label}: ${picture.marks.filled} of ${picture.marks.of}`} className="flex w-full flex-col gap-1">
          <span className="text-[13px] font-semibold text-foreground">{picture.marks.label}</span>
          <div className="flex w-full gap-[2px]">
            {Array.from({ length: picture.marks.of }, (_, i) => (
              <span key={i} className={`h-2.5 flex-1 rounded-sm ${i < picture.marks!.filled ? "bg-[var(--jz-gold)]" : "bg-white/15"}`} />
            ))}
          </div>
        </div>
      ) : null}
      {picture.sum ? (
        <p data-cards-reveal-sum="" className="text-center text-[17px] font-extrabold tabular-nums text-foreground">
          {/* The sum counts up to the score (the effects kit's count-up, silent: the reveal's score has its own). */}
          {picture.sumTo !== undefined ? (
            <>
              {picture.sum.slice(0, picture.sum.lastIndexOf("=") + 2)}
              <FxCountUp value={picture.sumTo} silent />
            </>
          ) : (
            picture.sum
          )}
        </p>
      ) : null}
    </div>
  );
}
