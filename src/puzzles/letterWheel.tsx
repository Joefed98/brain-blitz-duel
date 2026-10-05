import { useEffect, useRef, useState } from "react";

import { lwDecode, lwGrade, lwSlotCells, scoreLetterWheel } from "@/lib/duel/letterWheel";
import { useStageState } from "@/lib/duel/stageState";
import { LETTERWHEEL_TIME_MS, type LetterWheelPuzzleData, type LetterWheelSlot } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";
import { Button } from "@/components/ui/button";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Crossword: only the slot cells are drawn; letters appear once a slot is filled. */
function Crossword({
  cols,
  rows,
  slots,
  letters,
  missed,
  cellPx,
}: {
  cols: number;
  rows: number;
  slots: readonly LetterWheelSlot[];
  /** cell → letter shown (gold). */
  letters: ReadonlyMap<number, string>;
  /** Reveal: cell → letter for unfilled slots. */
  missed?: ReadonlyMap<number, string>;
  cellPx?: number;
}) {
  const used = new Set(slots.flatMap((s) => lwSlotCells(s, cols)));
  return (
    <div
      className="grid h-full w-full"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gap: 2 }}
    >
      {Array.from({ length: cols * rows }, (_, cell) => {
        if (!used.has(cell)) return <div key={cell} />;
        const ch = letters.get(cell);
        const miss = missed?.get(cell);
        return (
          <div
            key={cell}
            className={`flex items-center justify-center rounded-sm font-mono font-bold ${
              ch ? "bg-primary text-primary-foreground" : miss ? "bg-card text-muted-foreground ring-1 ring-inset ring-destructive" : "bg-card"
            }`}
            style={{ fontSize: cellPx ? cellPx * 0.6 : "clamp(12px, 8cqmin, 24px)" }}
          >
            {ch ?? miss ?? ""}
          </div>
        );
      })}
    </div>
  );
}

function letterMap(cols: number, slots: readonly LetterWheelSlot[], words: readonly (string | undefined)[]) {
  const map = new Map<number, string>();
  slots.forEach((s, i) => {
    const w = words[i];
    if (w) lwSlotCells(s, cols).forEach((c, j) => map.set(c, w[j]!));
  });
  return map;
}

function wheelPos(i: number, n: number): [number, number] {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return [50 + 36 * Math.cos(a), 50 + 36 * Math.sin(a)];
}

/** The wheel: drag through letters or tap them in sequence. */
function Wheel({
  letters,
  path,
  onPath,
  onRelease,
  onTap,
  disabled,
  shake,
}: {
  letters: string;
  path: readonly number[];
  onPath?: (path: number[]) => void;
  onRelease?: () => void;
  onTap?: (index: number) => void;
  disabled?: boolean;
  shake?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const live = useRef<number[]>([]);
  const down = useRef(false);
  const startPoint = useRef<[number, number] | null>(null);
  const startIndex = useRef<number | null>(null);
  const dragging = useRef(false);
  const n = letters.length;

  const hit = (x: number, y: number): number | null => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return null;
    const px = ((x - box.left) / box.width) * 100;
    const py = ((y - box.top) / box.height) * 100;
    for (let i = 0; i < n; i++) {
      const [cx, cy] = wheelPos(i, n);
      if ((px - cx) ** 2 + (py - cy) ** 2 < 12 ** 2) return i;
    }
    return null;
  };
  const visit = (i: number | null) => {
    if (i === null) return;
    const p = live.current;
    if (p.at(-1) === i) return;
    if (p.at(-2) === i) live.current = p.slice(0, -1);
    else if (!p.includes(i)) live.current = [...p, i];
    else return;
    onPath?.(live.current);
  };
  const end = () => {
    if (!down.current) return;
    down.current = false;
    if (dragging.current) onRelease?.();
    else if (startIndex.current !== null) onTap?.(startIndex.current);
    live.current = [];
    startPoint.current = null;
    startIndex.current = null;
    dragging.current = false;
  };

  return (
    <div
      ref={ref}
      data-play-area
      className={`relative aspect-square h-full max-h-full select-none rounded-full bg-card ${shake ? "animate-shake" : ""}`}
      style={{ touchAction: "none", overscrollBehavior: "none", WebkitUserSelect: "none" }}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        down.current = true;
        startPoint.current = [e.clientX, e.clientY];
        startIndex.current = hit(e.clientX, e.clientY);
        dragging.current = false;
        live.current = startIndex.current === null ? [] : [startIndex.current];
      }}
      onPointerMove={(e) => {
        if (!down.current) return;
        const start = startPoint.current;
        if (!dragging.current && start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) >= 8) {
          dragging.current = true;
          onPath?.([...live.current]);
        }
        if (dragging.current) visit(hit(e.clientX, e.clientY));
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
        {path.length > 1 && (
          <polyline
            points={path.map((i) => wheelPos(i, n).join(",")).join(" ")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.6}
          />
        )}
      </svg>
      {[...letters].map((ch, i) => {
        const [x, y] = wheelPos(i, n);
        const on = path.includes(i);
        return (
          <div
            key={i}
            className={`pointer-events-none absolute flex items-center justify-center rounded-full font-display font-bold ${
              on ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
            style={{ left: `${x - 12}%`, top: `${y - 12}%`, width: "24%", height: "24%", fontSize: "clamp(18px, 10cqmin, 32px)" }}
          >
            {ch}
          </div>
        );
      })}
    </div>
  );
}

/** Fixed example: wheel T E A R, with TEA selected down through RATE. */
const EX_SLOTS: LetterWheelSlot[] = [
  { row: 0, col: 0, across: true, len: 4 },
  { row: 0, col: 2, across: false, len: 3 },
];
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: 96, height: 72 }}>
        <Crossword cols={4} rows={3} slots={EX_SLOTS} letters={letterMap(4, EX_SLOTS, [undefined, "TEA"])} cellPx={22} />
      </div>
      <p className="font-mono text-sm font-bold tracking-widest text-primary">TEA</p>
      <div style={{ width: 110, height: 110, containerType: "size" }}>
        <Wheel letters="TEAR" path={[0, 1, 2]} disabled />
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        T → E → A spells TEA, which fills its slot. RATE would fill the other.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, checkWord, stateKey }: PuzzleStageProps) {
  const data: LetterWheelPuzzleData | null = puzzle.type === "letterwheel" ? puzzle : null;
  const key = stateKey ?? "letterwheel";
  const [filled, setFilled] = useStageState<(string | undefined)[]>(key, "lwFilled", () => []);
  const [path, setPath] = useState<number[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const submitted = useRef(false);

  const wheel = data?.letters ?? "";
  const slotCount = data?.slots.length ?? 0;
  const filledCount = filled.filter(Boolean).length;
  const words = filled.filter((w): w is string => !!w);
  const encoded = words.join(",");

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (submitted.current || locked || !slotCount || filledCount < slotCount) return;
    submitted.current = true;
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledCount, locked]);

  if (!data) return null;
  const done = locked || filledCount >= slotCount;
  const current = path.map((i) => wheel[i]).join("");

  const tapLetter = (i: number) => {
    if (done) return;
    setPath((p) => {
      if (p.at(-1) === i) return p;
      if (p.at(-2) === i) return p.slice(0, -1);
      if (p.includes(i)) return p;
      return [...p, i];
    });
  };

  const release = () => {
    const word = path.map((i) => wheel[i]).join("");
    setPath([]);
    if (word.length < 3 || !checkWord) {
      if (word.length > 0 && word.length < 3) {
        setShake(true);
        setTimeout(() => setShake(false), 350);
      }
      return;
    }
    void checkWord(word, words).then((v) => {
      if (v.valid && v.reason?.startsWith("slot:")) {
        const i = Number(v.reason.slice(5));
        buzz(12);
        playCorrect();
        setFilled((f) => {
          const next = [...f];
          next[i] = v.word;
          return next;
        });
      } else if (v.reason === "Not in this puzzle") {
        setFlash("Not in this puzzle");
        setTimeout(() => setFlash(null), 900);
      } else {
        playWrong();
        setShake(true);
        setTimeout(() => setShake(false), 350);
      }
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-1 py-1">
      <div className="flex min-h-0 w-full flex-[6] items-center justify-center" style={{ containerType: "size" }}>
        <div
          style={{
            width: `min(334px, 100cqw, calc(100cqh * ${data.cols / data.rows}))`,
            aspectRatio: `${data.cols} / ${data.rows}`,
            containerType: "size",
          }}
        >
          <Crossword cols={data.cols} rows={data.rows} slots={data.slots} letters={letterMap(data.cols, data.slots, filled)} />
        </div>
      </div>
      <p className="flex h-7 shrink-0 items-center justify-center px-2 font-mono text-lg font-bold tracking-widest text-primary" aria-live="polite">
        {current || flash || ""}
      </p>
      <div className="flex min-h-[142px] w-full flex-[4] -translate-y-1 items-center justify-center" style={{ containerType: "size" }}>
        <Wheel letters={wheel} path={path} onPath={setPath} onRelease={release} onTap={tapLetter} disabled={done} shake={shake} />
      </div>
      <div className="grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-2 pt-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="text-primary">{filledCount}</span> / {slotCount} words
        </span>
        <Button
          type="button"
          onClick={release}
          disabled={done || current.length < 3}
          className="h-11 min-w-28 px-6 font-mono text-base uppercase tracking-widest"
        >
          Submit
        </Button>
        <span aria-hidden="true" />
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "letterwheel") return null;
  const words = puzzle.words ?? [];
  const v = lwGrade(words, puzzle.slots, puzzle.cols, lwDecode(myAnswer ?? ""));
  const got = new Set(v.slots);
  const mine = letterMap(puzzle.cols, puzzle.slots, words.map((w, i) => (got.has(i) ? w : undefined)));
  const all = letterMap(puzzle.cols, puzzle.slots, words);
  const missed = new Map([...all].filter(([c]) => !mine.has(c)));
  const complete = v.totalCells > 0 && v.cells >= v.totalCells;
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  const score = scoreLetterWheel(v.slots.length, puzzle.slots.length, myMsRemaining ?? 0, timeLimitMs);
  const px = Math.floor(200 / Math.max(puzzle.cols, puzzle.rows));
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div style={{ width: px * puzzle.cols, height: px * puzzle.rows }}>
        <Crossword cols={puzzle.cols} rows={puzzle.rows} slots={puzzle.slots} letters={mine} missed={missed} cellPx={px} />
      </div>
      <p className="font-mono text-base text-primary">
        {complete
          ? `${words.length} / ${words.length} · ${(elapsed / 1000).toFixed(1)}s`
          : `${v.slots.length} / ${words.length} words`}
      </p>
    </div>
  );
}

export const letterWheelPuzzle: PuzzleDefinition = {
  key: "letterwheel",
  name: "Letter Wheel",
  category: "word",
  timeLimitMs: LETTERWHEEL_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "letterwheel",
      cols: 4,
      rows: 3,
      letters: "TEAR",
      slots: EX_SLOTS,
    }) satisfies LetterWheelPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "letterwheel") return false;
    const v = lwGrade(puzzle.words ?? [], puzzle.slots, puzzle.cols, lwDecode(answer));
    return v.totalCells > 0 && v.cells >= v.totalCells;
  },
  revealHeading: "The crossword",
  IntroExample,
  Stage,
  Reveal,
};
