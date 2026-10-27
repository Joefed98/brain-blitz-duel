import { rightMoveFlash, wrongMoveFlash } from "@/lib/fx/gameToolkit";
import { useGoalProgress } from "@/components/duel/GameFrame";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick } from "@/components/puzzles/GridDrag";
import { firePairWave } from "@/components/puzzles/pairMatchFx";
import { registerFxPreview } from "@/components/puzzles/speedFx";
import { decodePairFlips, encodePairFlips, replayPairs, sameCard } from "@/lib/duel/pairmatch";
import { useStageState } from "@/lib/duel/stageState";
import {
  PAIR_CARDS,
  PAIR_FLIP_BACK_MS,
  PAIR_FLIP_MS,
  PAIR_PAIRS,
  PAIR_TIME_MS,
  type PairCard,
  type PairPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playCueSlot, playTone, playWrong } from "@/lib/sound";
import { PAIR_GOLD_WINDOW_MS, isGoldCard, joinPairGoldTime, pairDepthReplay, pairGoldTimed, pairUsesDepth, splitPairGoldTime } from "@/lib/duel/depth/matchmaker";
import { serverNow } from "@/lib/duel/clock";
import { pairGoldPoints, pairStandard } from "@/lib/duel/standard/attention";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

export function CardFace({ card, size }: { card: PairCard; size: number }) {
  const fill = GLYPH_COLOURS[card.colour];
  const stroke = "var(--card-foreground, #0a0a0f)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {card.shape === "circle" && (
        <circle cx="12" cy="12" r="10.2" fill={fill} stroke={stroke} strokeWidth={0.9} />
      )}
      {card.shape === "square" && (
        <rect x="2" y="2" width="20" height="20" rx="2.5" fill={fill} stroke={stroke} strokeWidth={0.9} />
      )}
      {card.shape === "triangle" && (
        <polygon points="12,1.6 22.8,21.5 1.2,21.5" fill={fill} stroke={stroke} strokeWidth={0.9} strokeLinejoin="round" />
      )}
      {card.shape === "star" && (
        <polygon
          points="12,1.2 15.2,8.7 23.4,9.4 17.1,14.9 19.1,23 12,18.6 4.9,23 6.9,14.9 0.6,9.4 8.8,8.7"
          fill={fill}
          stroke={stroke}
          strokeWidth={0.9}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** A 6×5 board (or a small example board) of face-down cards. */
function Board({
  cards,
  faceUp,
  matched,
  cols = 6,
  glyph = 34,
  onCard,
  compact = false,
  gold,
}: {
  cards: PairCard[];
  faceUp: Set<number>;
  matched: Set<number>;
  cols?: number;
  glyph?: number;
  onCard?: ((index: number, card?: Element | null) => void) | undefined;
  compact?: boolean;
  /** pairRev 1: the gold pair's face; its cards show gold foil once turned over. */
  gold?: PairCard | undefined;
}) {
  return (
    <div
      className={`grid w-full ${compact ? "gap-1" : "gap-2"}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cards.map((card, index) => {
        const open = faceUp.has(index) || matched.has(index);
        const golden = !!gold && sameCard(gold, card);
        return (
          <button
            key={index}
            type="button"
            data-pair-card=""
            aria-label={open ? `${golden ? "gold " : ""}${card.colour} ${card.shape}` : "Face-down card"}
            onPointerDown={onCard ? (event) => onCard(index, event.currentTarget) : undefined}
            className="pairmatch-card relative aspect-square rounded-lg border-0 bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
          >
            {/* Two-sided card turned in 3D over the same PAIR_FLIP_MS as before (display only). */}
            <span
              className={`pairmatch-flipper ${open ? "is-open" : ""}`}
              style={{ transitionDuration: `${PAIR_FLIP_MS}ms` }}
              aria-hidden="true"
            >
              <span className="pairmatch-face pairmatch-card-back rounded-lg border-2 border-border" />
              <span
                data-pair-gold={golden && open ? "" : undefined}
                className={`pairmatch-face pairmatch-face-front flex items-center justify-center rounded-lg border-2 ${
                  matched.has(index) ? "is-matched border-primary bg-primary/10" : "border-border bg-card"
                }${golden && open ? " is-gold" : ""}`}
              >
                {open ? <CardFace card={card} size={glyph} /> : null}
                {golden && open ? <span className="pairmatch-gold-tag" aria-hidden="true">★</span> : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const EXAMPLE_CARDS: PairCard[] = [
  { shape: "circle", colour: "RED" },
  { shape: "square", colour: "BLUE" },
  { shape: "circle", colour: "RED" },
  { shape: "triangle", colour: "GREEN" },
];

/** Fixed intro example — a 2×2 with one pair already matched. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div style={{ width: 132 }}>
        <Board
          cards={EXAMPLE_CARDS}
          faceUp={new Set()}
          matched={new Set([0, 2])}
          cols={2}
          glyph={26}
          compact
          gold={EXAMPLE_CARDS[0]}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">Match all fifteen pairs.</p>
    </div>
  );
}

function Stage({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "pairmatch",
}: PuzzleStageProps) {
  const data: PairPuzzleData | null = puzzle.type === "pairmatch" ? puzzle : null;
  const [flips, setFlips] = useStageState<number[]>(stateKey, "pairFlips", () => []);
  const [open, setOpen] = useStageState<number[]>(stateKey, "pairOpen", () => []);
  // pairRev 2: the round-clock ms the gold pair was matched (sent with the flips; the server holds it to receipt).
  const [goldMs, setGoldMs] = useStageState<number | null>(stateKey, "pairGoldMs", () => null);
  const submitted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => registerFxPreview("pairmatch", () => firePairWave(boardRef.current, 6)), []);

  const replay = data ? replayPairs(data.cards, flips) : null;
  const matched = new Set(replay?.matched ?? []);
  // pairRev 1 (Depth to 200): the streak multiplier and the gold pair, walked from the same flips as the server.
  const depth = data && pairUsesDepth(data) ? pairDepthReplay(data, flips, goldMs) : null;
  const timedGold = pairGoldTimed(data);
  // The scoring standard (pairRev 3): the streak is the run of matches (no multiplier) and the gold pair is worth 15.
  const standard = pairStandard(data);
  const encode = (list: number[], gold: number | null) => (timedGold ? joinPairGoldTime(encodePairFlips(list), gold) : encodePairFlips(list));

  useEffect(() => {
    onDraftAnswer?.(timedGold ? joinPairGoldTime(encodePairFlips(flips), goldMs) : encodePairFlips(flips));
  }, [flips, goldMs, timedGold, onDraftAnswer]);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + PAIR_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(timedGold ? joinPairGoldTime(encodePairFlips(flips), goldMs) : encodePairFlips(flips));
  }, [now, phaseStartedAt, locked, data, flips, goldMs, timedGold, onSubmit]);

  // Polish batch S: the pairs count goes to the frame's goal line on a live round; the line above the
  // dock keeps the flips (display only).
  const framed = useGoalProgress({ done: replay?.pairs ?? 0, total: PAIR_PAIRS, text: `${replay?.pairs ?? 0} of ${PAIR_PAIRS} pairs` });

  if (!data || !replay) return null;

  const tap = (index: number, card?: Element | null) => {
    if (locked || submitted.current) return;
    if (matched.has(index) || open.includes(index)) return;
    if (open.length >= 2) return;
    hapticTick();
    const nextFlips = [...flips, index];
    const nextOpen = [...open, index];
    setFlips(nextFlips);
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;

    const [first, second] = nextOpen as [number, number];
    let nextGoldMs = goldMs;
    if (sameCard(data.cards[first], data.cards[second])) {
      playCorrect();
      rightMoveFlash(card);
      if (timedGold && nextGoldMs === null && isGoldCard(data, data.cards[second])) {
        nextGoldMs = Math.max(0, Math.round(serverNow() - phaseStartedAt));
        setGoldMs(nextGoldMs);
      }
      if (pairUsesDepth(data)) {
        const after = pairDepthReplay(data, nextFlips, nextGoldMs);
        // The streak's pip climbs with the multiplier; the gold pair plays the board's own wave.
        if (after.streak >= 2) playTone(523 * Math.pow(2, (2 * (Math.min(after.streak, 5) - 2)) / 12), 90, "triangle", 0.16);
        if (isGoldCard(data, data.cards[second])) playCueSlot("pairmatch.cardWave", 0.6);
      }
      setOpen([]);
      if (replayPairs(data.cards, nextFlips).solved) {
        submitted.current = true;
        // Finish effect fires synchronously, then the flips are submitted exactly as before.
        firePairWave(boardRef.current, 6);
        onSubmit(encode(nextFlips, nextGoldMs));
      }
      return;
    }
    buzz(20);
    playWrong();
    // The shared wrong-move shake and red outline (and its reject cue, as before), on the card just turned.
    wrongMoveFlash(card ?? null);
    timer.current = setTimeout(() => setOpen([]), PAIR_FLIP_BACK_MS);
  };

  return (
    <div data-polish="pairmatch" data-stage-column="3" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      <div ref={boardRef} data-game-arena="fixed" className="w-full max-w-[340px]">
        <Board
          cards={data.cards}
          faceUp={new Set(open)}
          matched={matched}
          glyph={30}
          compact
          gold={depth ? data.gold : undefined}
          onCard={open.length >= 2 ? undefined : tap}
        />
      </div>
      <p data-game-controls="status" className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {framed ? `${replay.flips} flips` : `pairs ${replay.pairs} / ${PAIR_PAIRS} · flips ${replay.flips}`}
        {depth ? (
          <>
            {" · "}
            <span key={depth.multiplier} data-pair-streak={depth.multiplier} className={`pairmatch-streak ${depth.multiplier >= 2 ? "is-live animate-scale-in" : ""}`}>
              {standard ? `streak ${depth.streak}` : `streak ×${depth.multiplier}`}
            </span>
            {depth.goldTry !== null ? (
              <>
                {" · "}
                <span data-pair-gold-found="" className="pairmatch-gold-found">gold +{standard ? pairGoldPoints(depth.goldTry, depth.goldMs) : depth.goldBonus}</span>
              </>
            ) : timedGold && now - phaseStartedAt < PAIR_GOLD_WINDOW_MS ? (
              <>
                {" · "}
                {/* pairRev 2: the gold pair's window, counting down (display only). */}
                <span data-pair-gold-window="">gold {Math.max(0, Math.ceil((PAIR_GOLD_WINDOW_MS - (now - phaseStartedAt)) / 1000))}s</span>
              </>
            ) : null}
          </>
        ) : null}
      </p>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "pairmatch") return null;
  const replay = replayPairs(puzzle.cards, decodePairFlips(myAnswer ?? ""));
  const depth = pairUsesDepth(puzzle) ? pairDepthReplay(puzzle, decodePairFlips(myAnswer ?? ""), splitPairGoldTime(myAnswer).goldMs) : null;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;
  // The scoring standard (pairRev 3): the streak and gold points as the server stored them (none shown before they arrive).
  const stored = (key: string) => (typeof myExtra?.[key] === "number" ? `, +${myExtra[key] as number}` : "");
  const everything = new Set(Array.from({ length: PAIR_CARDS }, (_, index) => index));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="w-full max-w-[288px] shrink-0">
        <Board cards={puzzle.cards} faceUp={everything} matched={new Set()} glyph={22} compact gold={depth ? puzzle.gold : undefined} />
      </div>
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {replay.pairs} / {PAIR_PAIRS} · {replay.flips} flips
        {elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
      </p>
      {depth ? (
        <p data-pair-reveal-bonus="" className="text-center font-mono text-xs text-muted-foreground">
          {pairStandard(puzzle)
            ? `Best streak ${depth.bestStreak}${stored("streakPoints")} · gold ${depth.goldTry !== null && depth.goldMs !== null ? `${(depth.goldMs / 1000).toFixed(1)}s${stored("goldPoints")}` : "not found"}`
            : `Best streak ${depth.bestStreak} · streak +${depth.streakBonus} · gold ${depth.goldTry !== null ? (depth.goldMs !== null ? `${(depth.goldMs / 1000).toFixed(1)}s, +${depth.goldBonus}` : `try ${depth.goldTry}, +${depth.goldBonus}`) : "not found"}`}
        </p>
      ) : null}
    </div>
  );
}

/** The board is dealt once on the server; the flip list is replayed there too. */
export const pairMatchPuzzle: PuzzleDefinition = {
  key: "pairmatch",
  name: gameDisplayName("pairmatch"),
  category: "attention",
  timeLimitMs: PAIR_TIME_MS,
  revealMs: 5_000,
  generate: () => ({ type: "pairmatch", cards: [] }) satisfies PairPuzzleData,
  check: () => false,
  revealHeading: "The board",
  IntroExample,
  Stage,
  Reveal,
};
