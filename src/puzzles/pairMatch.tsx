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
import { playCorrect, playWrong } from "@/lib/sound";

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
}: {
  cards: PairCard[];
  faceUp: Set<number>;
  matched: Set<number>;
  cols?: number;
  glyph?: number;
  onCard?: ((index: number, card?: Element | null) => void) | undefined;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid w-full ${compact ? "gap-1" : "gap-2"}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cards.map((card, index) => {
        const open = faceUp.has(index) || matched.has(index);
        return (
          <button
            key={index}
            type="button"
            data-pair-card=""
            aria-label={open ? `${card.colour} ${card.shape}` : "Face-down card"}
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
                className={`pairmatch-face pairmatch-face-front flex items-center justify-center rounded-lg border-2 ${
                  matched.has(index) ? "is-matched border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                {open ? <CardFace card={card} size={glyph} /> : null}
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
  const submitted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => registerFxPreview("pairmatch", () => firePairWave(boardRef.current, 6)), []);

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
    if (sameCard(data.cards[first], data.cards[second])) {
      playCorrect();
      rightMoveFlash(card);
      setOpen([]);
      if (replayPairs(data.cards, nextFlips).solved) {
        submitted.current = true;
        // Finish effect fires synchronously, then the flips are submitted exactly as before.
        firePairWave(boardRef.current, 6);
        onSubmit(encodePairFlips(nextFlips));
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
          onCard={open.length >= 2 ? undefined : tap}
        />
      </div>
      <p data-game-controls="status" className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {framed ? `${replay.flips} flips` : `pairs ${replay.pairs} / ${PAIR_PAIRS} · flips ${replay.flips}`}
      </p>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "pairmatch") return null;
  const replay = replayPairs(puzzle.cards, decodePairFlips(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;
  const everything = new Set(Array.from({ length: PAIR_CARDS }, (_, index) => index));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="w-full max-w-[288px] shrink-0">
        <Board cards={puzzle.cards} faceUp={everything} matched={new Set()} glyph={22} compact />
      </div>
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
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
