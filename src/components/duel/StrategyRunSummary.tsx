/**
 * The Strategy games' redesigned answer reveals (the Strategy overhaul, stage 2, 15 Nov 2026; Joe: "large, clear,
 * legible on a phone, a visual summary of the run, plain labels, no dense text lists"). One picture of the run, drawn
 * inside #422's shared reveal layout (ArcadeReveal: the score, the payoff, the breakdown), under the score:
 *
 * - Tilt: the four discs, each ticked with its time, gold where it beat its par.
 * - Gemstone: the six colour goals ticked off, the treasure chests found, the gems cleared.
 * - Coral Pop: the reef meter and the bubbles popped and dropped.
 * - Rainbow Bridge: the ten level coins, filled for each level potted.
 * - Ball Tracker: every marble, home in its colour, a wrong cup or lost.
 *
 * Display only: drawn from the stored reveal (the server replay's axis and tiles) and, for Tilt's times and Gemstone's
 * goals, the player's own run replayed on the phone with the game's own replay (the same one the server scores with);
 * the score shown is always the stored one. The pieces are the games' rendered materials (public/strategy/).
 */
import { useEffect, useState } from "react";

import { Icon } from "@/design/components";
import { strategyArtUrl, type StrategyArtName } from "@/lib/arcade/strategyArt";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import type { PuzzleData } from "@/lib/duel/types";

export const STRATEGY_SUMMARY_TYPES = new Set(["tilt", "matchup", "bubble", "inkbridge", "balltrack"]);

/** "3 / 6" → [3, 6]; anything else → null. */
function frac(value: string | undefined): [number, number] | null {
  const m = value?.match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
function tile(reveal: ArcadeRevealData, label: string): string | undefined {
  return reveal.tiles.find((t) => t.label === label)?.value;
}
const num = (v: string | undefined): number => (v && /^\d+$/.test(v) ? Number(v) : 0);

function Piece({ name, size, dim = false }: { name: StrategyArtName; size: number; dim?: boolean }) {
  return <img src={strategyArtUrl(name)} alt="" width={size} height={size} draggable={false} className="srs-piece" data-dim={dim ? "" : undefined} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="srs-stat">
      <span className="srs-stat-value">{value}</span>
      <span className="srs-stat-label">{label}</span>
    </span>
  );
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="srs-meter" role="img" aria-label={`${label}: ${value} of ${max}`}>
      <span className="srs-meter-fill" style={{ transform: `scaleX(${share})` }} />
    </div>
  );
}

/** The player's own run replayed on the phone (the game's own replay, loaded on demand), or null until it is. */
function useReplayed<T>(puzzle: PuzzleData, answer: string | null, work: () => Promise<T | null>): T | null {
  const [out, setOut] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    setOut(null);
    work()
      .then((v) => {
        if (live) setOut(v);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [puzzle, answer]); // eslint-disable-line react-hooks/exhaustive-deps
  return out;
}

// ------------------------------------------------------------------ Tilt

function TiltSummary({ puzzle, answer, reveal }: { puzzle: PuzzleData; answer: string | null; reveal: ArcadeRevealData }) {
  const all = reveal.axis.max ?? 4;
  const mazes = reveal.axis.value;
  const times = useReplayed(puzzle, answer, async () => {
    if (puzzle.type !== "tilt" || !answer) return null;
    const { replayTiltRun } = await import("@/lib/duel/tilt");
    const st = replayTiltRun(puzzle.seed, answer, puzzle.tiltRev).state as unknown as { mazeTicks?: number[]; list?: { par?: number }[] };
    if (!st.mazeTicks) return null;
    return st.mazeTicks.map((ticks, i) => ({ s: ticks / 60, under: typeof st.list?.[i]?.par === "number" ? ticks <= st.list[i]!.par! : false }));
  });
  return (
    <div className="srs-row" data-strategy-summary="tilt">
      {Array.from({ length: all }, (_, i) => {
        const done = i < mazes;
        const t = times?.[i];
        return (
          <span key={i} className="srs-cell" data-done={done ? "" : undefined} data-under-par={t?.under ? "" : undefined}>
            <span className="srs-disc">
              <Piece name="tilt-disc" size={56} dim={!done} />
              {done ? (
                <span className="srs-tick">
                  <Icon name="check" size={18} />
                </span>
              ) : null}
            </span>
            <span className="srs-caption">{done ? (t ? `${t.s.toFixed(1)} s` : "Done") : `Maze ${i + 1}`}</span>
            {t?.under ? <span className="srs-sub">Under par</span> : null}
          </span>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Gemstone

const GEM_SHAPES: StrategyArtName[] = ["gem-circle", "gem-square", "gem-triangle", "gem-diamond", "gem-star", "gem-hexagon"];

function GemstoneSummary({ puzzle, answer, reveal }: { puzzle: PuzzleData; answer: string | null; reveal: ArcadeRevealData }) {
  const goals = useReplayed(puzzle, answer, async () => {
    if (puzzle.type !== "matchup" || !answer) return null;
    const [{ replayMatchupRun }, { matchupV12GoalNeed }] = await Promise.all([import("@/lib/duel/matchup"), import("@/lib/arcade/matchup")]);
    const st = replayMatchupRun(puzzle.seed, answer, puzzle.matchupRev).state as unknown as { six?: number; goalLeft?: number[] };
    if (!st.six || !st.goalLeft) return null;
    return matchupV12GoalNeed(puzzle.seed).map((n, colour) => ({ colour, need: n, left: st.goalLeft![colour] ?? n }));
  });
  const goalFrac = frac(tile(reveal, "Goals"));
  const treasure = frac(tile(reveal, "Treasure"));
  return (
    <div className="srs-stack" data-strategy-summary="matchup">
      <div className="srs-grid srs-grid-6">
        {(goals ?? Array.from({ length: goalFrac?.[1] ?? 6 }, (_, i) => ({ colour: i, need: 0, left: i < (goalFrac?.[0] ?? 0) ? 0 : 1 }))).map((g) => (
          <span key={g.colour} className="srs-cell" data-done={g.left === 0 ? "" : undefined}>
            <span className="srs-disc">
              <Piece name={GEM_SHAPES[g.colour % GEM_SHAPES.length]!} size={38} dim={g.left > 0} />
              {g.left === 0 ? (
                <span className="srs-tick">
                  <Icon name="check" size={18} />
                </span>
              ) : null}
            </span>
            <span className="srs-caption" aria-label={g.left === 0 ? "Goal met" : `${g.left} left`}>
              {g.left === 0 ? "Met" : g.need ? `${g.left} left` : "—"}
            </span>
          </span>
        ))}
      </div>
      {treasure ? (
        <div className="srs-row" aria-label={`${treasure[0]} of ${treasure[1]} treasure chests`}>
          {Array.from({ length: treasure[1] }, (_, i) => (
            <Piece key={i} name="matchup-chest" size={36} dim={i >= treasure[0]} />
          ))}
        </div>
      ) : null}
      <div className="srs-line">
        <Meter value={reveal.axis.value} max={reveal.axis.max ?? reveal.axis.value} label="Gems cleared" />
        <Stat label="gems cleared" value={reveal.axis.value.toLocaleString("en-GB")} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Coral Pop

function BubbleSummary({ reveal }: { reveal: ArcadeRevealData }) {
  const pct = reveal.axis.value;
  return (
    <div className="srs-stack" data-strategy-summary="bubble">
      <div className="srs-line">
        <Meter value={pct} max={100} label="Reef cleared" />
        <Stat label={pct >= 100 ? "reef cleared" : "of the reef"} value={`${pct}%`} />
      </div>
      <div className="srs-row">
        <span className="srs-cell" data-done="">
          <Piece name="bubble-red" size={40} />
          <Stat label="popped" value={String(num(tile(reveal, "Popped")))} />
        </span>
        <span className="srs-cell" data-done="">
          <Piece name="bubble-blue" size={40} />
          <Stat label="dropped" value={String(num(tile(reveal, "Dropped")))} />
        </span>
        <span className="srs-cell" data-done="">
          <Piece name="bubble-yellow" size={40} />
          <Stat label="shots" value={String(num(tile(reveal, "Shots")))} />
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Rainbow Bridge

function InkSummary({ reveal }: { reveal: ArcadeRevealData }) {
  const levels = reveal.axis.value;
  const all = reveal.axis.max ?? 10;
  const par = frac(tile(reveal, "Within ink par"));
  return (
    <div className="srs-stack" data-strategy-summary="inkbridge">
      <div className="srs-grid srs-grid-5" aria-label={`${levels} of ${all} levels`}>
        {Array.from({ length: all }, (_, i) => (
          <span key={i} className="srs-cell" data-done={i < levels ? "" : undefined}>
            <Piece name="inkbridge-coin" size={40} dim={i >= levels} />
            <span className="srs-caption">{i + 1}</span>
          </span>
        ))}
      </div>
      {par && levels > 0 ? <Stat label="levels within ink par" value={`${par[0]} of ${levels}`} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------ Ball Tracker

const BT_PIECES: StrategyArtName[] = ["bt-marble-red", "bt-marble-blue", "bt-marble-green", "bt-marble-yellow"];

function BallTrackSummary({ reveal }: { reveal: ArcadeRevealData }) {
  const all = reveal.axis.max ?? 36;
  const home = reveal.axis.value;
  const wrong = num(tile(reveal, "Wrong tray"));
  const lost = num(tile(reveal, "Lost"));
  return (
    <div className="srs-stack" data-strategy-summary="balltrack">
      <div className="srs-grid srs-grid-9" role="img" aria-label={`${home} of ${all} marbles home, ${wrong} in a wrong cup, ${lost} lost`}>
        {Array.from({ length: all }, (_, i) => {
          const kind = i < home ? "home" : i < home + wrong ? "wrong" : i < home + wrong + lost ? "lost" : "none";
          return (
            <span key={i} className="srs-marble" data-kind={kind}>
              {kind === "home" ? <Piece name={BT_PIECES[i % BT_PIECES.length]!} size={26} /> : null}
            </span>
          );
        })}
      </div>
      <div className="srs-row">
        <Stat label="home" value={String(home)} />
        <Stat label="wrong cup" value={String(wrong)} />
        <Stat label="lost" value={String(lost)} />
      </div>
    </div>
  );
}

export function StrategyRunSummary({ puzzle, myAnswer, reveal }: { puzzle: PuzzleData; myAnswer: string | null; reveal: ArcadeRevealData | null }) {
  if (!reveal || !STRATEGY_SUMMARY_TYPES.has(puzzle.type)) return null;
  return (
    <div className="srs animate-fade-in" data-strategy-reveal={puzzle.type}>
      {puzzle.type === "tilt" ? (
        <TiltSummary puzzle={puzzle} answer={myAnswer} reveal={reveal} />
      ) : puzzle.type === "matchup" ? (
        <GemstoneSummary puzzle={puzzle} answer={myAnswer} reveal={reveal} />
      ) : puzzle.type === "bubble" ? (
        <BubbleSummary reveal={reveal} />
      ) : puzzle.type === "inkbridge" ? (
        <InkSummary reveal={reveal} />
      ) : (
        <BallTrackSummary reveal={reveal} />
      )}
    </div>
  );
}
