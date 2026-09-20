import { useEffect, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick } from "@/components/puzzles/GridDrag";
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
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function CardFace({ card, size }: { card: PairCard; size: number }) {
  const fill = GLYPH_COLOURS[card.colour];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {card.shape === "circle" && <circle cx="12" cy="12" r="9.5" fill={fill} />}
      {card.shape === "square" && (
        <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill={fill} />
      )}
      {card.shape === "triangle" && <polygon points="12,2.5 22,21 2,21" fill={fill} />}
      {card.shape === "star" && (
        <polygon
          points="12,2 14.9,8.9 22.4,9.5 16.7,14.4 18.5,21.7 12,17.8 5.5,21.7 7.3,14.4 1.6,9.5 9.1,8.9"
          fill={fill}
        />
      )}
    </svg>
  );
}

/** A 4×4 board (or a small example board) of face-down cards. */
function Board({
  cards,
  faceUp,
  matched,
  cols = 4,
  glyph = 34,
  onCard,
  compact = false,
}: {
  cards: PairCard[];
  faceUp: Set<number>;
  matched: Set<number>;
  cols?: number;
  glyph?: number;
  onCard?: ((index: number) => void) | undefined;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid w-full ${compact ? "gap-1" : "gap-1.5"}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cards.map((card, index) => {
        const open = faceUp.has(index) || matched.has(index);
        return (
          <button
            key={index}
            type="button"
            aria-label={open ? `${card.colour} ${card.shape}` : "Face-down card"}
            onPointerDown={onCard ? () => onCard(index) : undefined}
            className={`flex aspect-square items-center justify-center rounded-lg border-2 transition-transform ${
              matched.has(index)
                ? "border-primary bg-primary/10"
                : open
                  ? "border-border bg-card"
                  : "border-border bg-muted"
            }`}
            style={{ transitionDuration: `${PAIR_FLIP_MS}ms` }}
          >
            {open ? (
              <CardFace card={card} size={glyph} />
            ) : (
              <span className="font-mono text-xs text-muted-foreground/50">◇</span>
            )}
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
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        The two red circles match, so they stay up.
      </p>
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
  const submitted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replay = data ? replayPairs(data.cards, flips) : null;
  const matched = new Set(replay?.matched ?? []);

  useEffect(() => {
    onDraftAnswer?.(encodePairFlips(flips));
  }, [flips, onDraftAnswer]);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + PAIR_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodePairFlips(flips));
  }, [now, phaseStartedAt, locked, data, flips, onSubmit]);

  if (!data || !replay) return null;

  const tap = (index: number) => {
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
    if (sameCard(data.cards[first], data.cards[second])) {
      playCorrect();
      setOpen([]);
      if (replayPairs(data.cards, nextFlips).solved) {
        submitted.current = true;
        onSubmit(encodePairFlips(nextFlips));
      }
      return;
    }
    buzz(20);
    playWrong();
    timer.current = setTimeout(() => setOpen([]), PAIR_FLIP_BACK_MS);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      <div className="w-full max-w-[300px]">
        <Board
          cards={data.cards}
          faceUp={new Set(open)}
          matched={matched}
          onCard={open.length >= 2 ? undefined : tap}
        />
      </div>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        pairs {replay.pairs} / {PAIR_PAIRS} · flips {replay.flips}
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "pairmatch") return null;
  const replay = replayPairs(puzzle.cards, decodePairFlips(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((PAIR_TIME_MS - myMsRemaining) / 100) / 10;
  const everything = new Set(Array.from({ length: PAIR_CARDS }, (_, index) => index));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="w-full max-w-[240px] shrink-0">
        <Board cards={puzzle.cards} faceUp={everything} matched={new Set()} glyph={22} compact />
      </div>
      <p
        className={`shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {replay.pairs} / {PAIR_PAIRS} · {replay.flips} flips
        {elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
      </p>
    </div>
  );
}

/** The board is dealt once on the server; the flip list is replayed there too. */
export const pairMatchPuzzle: PuzzleDefinition = {
  key: "pairmatch",
  name: "Pair Match",
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
