import { useGameKeys } from "@/lib/desktop";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { LW_FREE_MISSES, LW_JAR_DROPS, lwDecode, lwDecodeLog, lwEncodeLog, lwGrade, lwJarDrops, lwJarKept, lwSlotCells, lwUsesJar, lwUsesLog, LW_MAX_TRACES } from "@/lib/duel/letterWheel";
import { useStageState } from "@/lib/duel/stageState";
import { LETTERWHEEL_TIME_MS, type LetterWheelPuzzleData, type LetterWheelSlot } from "@/lib/duel/types";
import { buzz, prefersReducedMotion } from "@/lib/motion";
import { playTick } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Shuffle, X } from "lucide-react";
import { shuffleLetterOrder } from "@/components/puzzles/letterShuffle";
import { FoundWordMoment, type AcceptedWordMoment } from "@/components/puzzles/FoundWordMoment";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { goldPulse, playFinish, useWordFinish, wordCue, type FinishStep } from "@/components/puzzles/wordFinish";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import "@/polish-layout/batch-w-letterwheel.css";

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
            data-lw-cell={cell}
            className={`word-letter-tile flex items-center justify-center rounded-sm font-mono font-bold ${
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
  onCancel,
  onTap,
  disabled,
  shake,
  order,
}: {
  letters: string;
  path: readonly number[];
  onPath?: (path: number[]) => void;
  onRelease?: () => void;
  /** A drag lifted outside the wheel: the trace is dropped, not submitted. */
  onCancel?: () => void;
  onTap?: (index: number) => void;
  disabled?: boolean;
  shake?: boolean;
  order?: readonly number[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const live = useRef<number[]>([]);
  const down = useRef(false);
  const startPoint = useRef<[number, number] | null>(null);
  const startIndex = useRef<number | null>(null);
  const dragging = useRef(false);
  const n = letters.length;
  const displayed = order ?? Array.from({ length: n }, (_, i) => i);
  const position = (index: number) => wheelPos(displayed.indexOf(index), n);

  /** Letter under a point: the whole tile (radius 12 %) for a press, a slightly smaller core while dragging so a chord past a neighbour does not pick it up. */
  const hit = (x: number, y: number, radius = 12): number | null => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return null;
    const px = ((x - box.left) / box.width) * 100;
    const py = ((y - box.top) / box.height) * 100;
    for (let i = 0; i < n; i++) {
      const [cx, cy] = position(i);
      if ((px - cx) ** 2 + (py - cy) ** 2 < radius ** 2) return i;
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
  /** Outside the wheel's round face (a little slack at the rim). */
  const outside = (x: number, y: number): boolean => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !box.width) return false;
    const dx = (x - box.left) / box.width - 0.5;
    const dy = (y - box.top) / box.height - 0.5;
    return dx * dx + dy * dy > 0.54 * 0.54;
  };
  const end = (e?: { clientX: number; clientY: number; type?: string }) => {
    if (!down.current) return;
    down.current = false;
    if (dragging.current && (e?.type === "pointercancel" || (e && outside(e.clientX, e.clientY)))) onCancel?.();
    else if (dragging.current) onRelease?.();
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
      data-lw-wheel=""
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
        if (dragging.current) visit(hit(e.clientX, e.clientY, 10));
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
        {path.length > 1 && (
          <polyline
            points={path.map((i) => position(i).join(",")).join(" ")}
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
        const [x, y] = position(i);
        const on = path.includes(i);
        return (
          <div
            key={i}
            className={`word-letter-tile letter-shuffle-tile pointer-events-none absolute flex items-center justify-center rounded-full font-display font-bold ${
              on ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
            style={{ left: `${x - 12}%`, top: `${y - 12}%`, width: "24%", height: "24%", fontSize: "clamp(28px, 12cqmin, 32px)" }}
          >
            {ch}
          </div>
        );
      })}
    </div>
  );
}

/** wheelRev 2: a short glow on the jar as a word drops in (none under reduced motion or reduced effects). */
function jarPulse(el: HTMLElement | null): void {
  if (!el || typeof el.animate !== "function" || prefersReducedMotion()) return;
  if (typeof document !== "undefined" && document.documentElement.dataset["reducedEffects"]) return;
  el.animate(
    [
      { transform: "scale(1)", filter: "none" },
      { transform: "scale(1.12)", filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--primary) 80%, transparent))", offset: 0.4 },
      { transform: "scale(1)", filter: "none" },
    ],
    { duration: 360, easing: "ease-out" },
  );
}

/**
 * wheelRev 2's bonus jar: a glass jar filling gold by drops (3 letters 1, 4 → 2, 5 → 3, 6+ → 4) and the count of
 * bonus words. Drawn from the first paint at its fixed size in the trace row's right end, so nothing moves.
 */
export function BonusJar({ drops, size, words }: { drops: number; size: number; words: number }) {
  const share = Math.max(0, Math.min(1, drops / Math.max(1, size)));
  const full = share >= 1;
  // The jar's inside runs from y 9 to y 30 (21 units).
  const h = 21 * share;
  return (
    <div
      data-lw-jar={drops}
      data-lw-jar-size={size}
      role="img"
      aria-label={`Bonus jar: ${words} word${words === 1 ? "" : "s"}, ${Math.min(drops, size)} of ${size}`}
      className="flex h-8 items-center gap-1 font-mono text-xs font-bold tabular-nums"
    >
      <svg viewBox="0 0 24 32" width={22} height={30} aria-hidden="true">
        <defs>
          <clipPath id="lw-jar-inside">
            <path d="M5 9 h14 a2 2 0 0 1 2 2 v17 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 v-17 a2 2 0 0 1 2 -2z" />
          </clipPath>
          <linearGradient id="lw-jar-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor="#d99a1e" />
          </linearGradient>
        </defs>
        <path d="M5 9 h14 a2 2 0 0 1 2 2 v17 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 v-17 a2 2 0 0 1 2 -2z" fill="rgba(255,255,255,0.07)" />
        <rect x="3" y={30 - h} width="18" height={h + 1} fill="url(#lw-jar-fill)" clipPath="url(#lw-jar-inside)" style={{ transition: "y 300ms ease-out, height 300ms ease-out" }} />
        <path d="M5 9 h14 a2 2 0 0 1 2 2 v17 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 v-17 a2 2 0 0 1 2 -2z" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
        <rect x="6" y="4" width="12" height="4" rx="1.2" fill={full ? "#f2c75c" : "#5a5a66"} stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
        <path d="M8 12 v14" stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className={full ? "text-primary" : "text-muted-foreground"}>{words}</span>
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
  // wheelRev 1: every submitted trace, in order (the answer), and the phone's own count of "Not a word" verdicts.
  const [log, setLog] = useStageState<string[]>(key, "lwLog", () => []);
  const [misses, setMisses] = useStageState<number>(key, "lwMisses", () => 0);
  // wheelRev 2: the bonus words in the jar, as the server's live check told them (the server scores the log itself).
  const [bonus, setBonus] = useStageState<string[]>(key, "lwBonus", () => []);
  const jarRef = useRef<HTMLDivElement | null>(null);
  const [path, setPath] = useState<number[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedWordMoment | null>(null);
  const [order, setOrder] = useState(() => Array.from({ length: data?.letters.length ?? 0 }, (_, i) => i));
  const submitted = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const wheel = data?.letters ?? "";
  const slotCount = data?.slots.length ?? 0;
  const filledCount = filled.filter(Boolean).length;
  const words = filled.filter((w): w is string => !!w);
  const usesLog = lwUsesLog(data);
  const usesJar = lwUsesJar(data);
  const jarSize = data?.jarSize ?? LW_JAR_DROPS;
  // Each miss after the free ones spills a drop (as the server counts it from the log).
  const jarDrops = lwJarKept(bonus.reduce((sum, w) => sum + lwJarDrops(w), 0), misses);
  const encoded = usesLog ? lwEncodeLog(log) : words.join(",");

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (submitted.current || locked || !slotCount || filledCount < slotCount) return;
    submitted.current = true;
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledCount, locked]);

  // Crossword complete: the wheel spins once, then the crossword lights corner to corner (display only).
  useWordFinish(slotCount > 0 && filledCount >= slotCount, () => {
    wordCue("letterwheel.finish");
    const root = stageRef.current;
    const cols = data?.cols ?? 1;
    const rows = data?.rows ?? 1;
    const spin = [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }];
    const counter = [{ transform: "rotate(0deg)" }, { transform: "rotate(-360deg)" }];
    const steps: FinishStep[] = [{ el: root?.querySelector("[data-lw-wheel]"), keyframes: spin, delay: 0, duration: 700, easing: "cubic-bezier(.45,0,.25,1)" }];
    root?.querySelectorAll("[data-lw-wheel] .letter-shuffle-tile").forEach((el) =>
      steps.push({ el, keyframes: counter, delay: 0, duration: 700, easing: "cubic-bezier(.45,0,.25,1)" }),
    );
    const step = 420 / Math.max(1, rows + cols - 2);
    root?.querySelectorAll<HTMLElement>("[data-lw-cell]").forEach((el) => {
      const cell = Number(el.dataset["lwCell"]);
      steps.push({ el, keyframes: goldPulse(1.08), delay: 420 + Math.round((Math.floor(cell / cols) + (cell % cols)) * step), duration: 340 });
    });
    return playFinish(steps);
  });

  // Desktop keys: typing a letter taps the first unused wheel letter with it, Backspace steps back one
  // letter (as tracing back does), Esc clears, Enter lets go (checks the word), Space shuffles.
  useGameKeys((kind, key, event) => {
    if (!data) return false;
    const used = /^[a-z]$/.test(key) || key === "Backspace" || key === "Escape" || key === "Enter" || key === " ";
    if (!used || kind !== "down" || done) return used;
    if (key === "Enter") {
      if (!event.repeat && path.length > 0) release();
    } else if (key === "Escape") clear();
    else if (key === " ") {
      if (!event.repeat) setOrder((previous) => shuffleLetterOrder(previous));
    } else if (key === "Backspace") {
      const back = path.at(-2);
      if (back !== undefined) tapLetter(back);
      else clear();
    } else {
      const letter = key.toUpperCase();
      const i = [...wheel].findIndex((l, at) => l.toUpperCase() === letter && !path.includes(at));
      if (i >= 0) tapLetter(i);
    }
    return true;
  });

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

  const clear = () => setPath([]);

  const release = () => {
    const word = path.map((i) => wheel[i]).join("");
    setPath([]);
    if (word.length >= 3 && checkWord && usesLog && log.length < LW_MAX_TRACES) setLog((l) => [...l, word]);
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
        setAccepted(previous => ({ word: v.word, points: data.slots.length === 8 ? 15 : 13, serial: (previous?.serial ?? 0) + 1 }));
        buzz(12);
        setFilled((f) => {
          const next = [...f];
          next[i] = v.word;
          return next;
        });
        // Batch W: the toolkit's right-move glow on the slot's cells as the word lands (display only).
        const slot = data.slots[i];
        if (slot) for (const cell of lwSlotCells(slot, data.cols)) rightMoveFlash(stageRef.current?.querySelector(`[data-lw-cell="${cell}"]`));
      } else if (v.reason === "Not in this puzzle" && usesJar && !bonus.includes(v.word.toUpperCase())) {
        // wheelRev 2: a real word not in the crossword drops into the bonus jar.
        const word = v.word.toUpperCase();
        setBonus((b) => (b.includes(word) ? b : [...b, word]));
        playTick();
        buzz(8);
        setFlash(`Bonus · ${word}`);
        setTimeout(() => setFlash(null), 900);
        jarPulse(jarRef.current);
      } else if (v.reason === "Not in this puzzle") {
        puzzleReject();
        setFlash(usesJar ? "Already in the jar" : "Not in this puzzle");
        setTimeout(() => setFlash(null), 900);
      } else {
        if (usesLog && v.reason === "Not a word") setMisses((m) => m + 1);
        setShake(true);
        setTimeout(() => setShake(false), 350);
      }
    });
  };

  return (
    <div
      ref={stageRef}
      data-polish="letterwheel"
      data-word-polish="letterwheel"
      data-stage-column="1"
      className="flex min-h-0 flex-1 flex-col items-center gap-1 py-1"
      // The bigger crosswords (up to 11 × 9) take height from the wheel: 180–240 px instead of 200–240 px.
      // Batch W (display only): past that the wheel grows into the height left empty, up to 340 px and 24 px
      // inside the stage's width, by 100cqh - 376 px (the crossword's 260 px plus 108 px of trace row, gaps and the 52 px
      // dock buttons, plus 8 px), so the crossword keeps its height (styles.css: min(260px, 100cqh - wheel - 80px)).
      // The wheel hit-tests in its own percentages, so taps and traces follow the bigger tiles.
      style={{ "--lw-wheel": "max(clamp(180px, calc(100cqh - 330px), 240px), min(340px, calc(100cqw - 24px), calc(100cqh - 376px)))" } as CSSProperties}
    >
      <div data-arena-part="letterwheel-board" data-word-first="" className="flex min-h-0 w-full flex-[7] items-center justify-center" style={{ containerType: "size" }}>
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
      <div data-arena-part="letterwheel-word" className="relative flex h-8 w-full shrink-0 items-center justify-center px-2 font-mono text-lg font-bold tracking-widest text-primary" aria-live="polite">
        <span>{current || flash || ""}</span>
        {usesJar ? (
          <div ref={jarRef} className="absolute inset-y-0 right-2 flex items-center">
            <BonusJar drops={jarDrops} size={jarSize} words={bonus.length} />
          </div>
        ) : null}
        {/* The found-word chip shares the trace row (the trace is already cleared when a word lands). */}
        <div className="pointer-events-none absolute inset-0">
          <FoundWordMoment value={accepted} />
        </div>
      </div>
      <div data-game-arena="letterwheel-wheel" className="flex min-h-[142px] w-full flex-[4] -translate-y-1 items-center justify-center" style={{ containerType: "size" }}>
        <Wheel letters={wheel} order={order} path={path} onPath={setPath} onRelease={release} onCancel={clear} onTap={tapLetter} disabled={done} shake={shake} />
      </div>
      {/* Raised inside the Stage (pb-3) so the buttons sit clear of the screen's bottom edge. */}
      <div data-game-controls="actions" data-word-controls-first="" className="grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-2 pb-3 pt-2">
        <span className="flex h-11 flex-col justify-center font-mono text-xs uppercase leading-4 tracking-widest text-muted-foreground">
          <span>
            <span className="text-primary">{filledCount}</span> / {slotCount} words
          </span>
          {usesLog && misses > 0 ? (
            <span
              data-lw-misses={misses}
              title={`${LW_FREE_MISSES} misses are free`}
              className={`whitespace-nowrap normal-case tracking-normal ${misses > LW_FREE_MISSES ? "text-destructive" : ""}`}
            >
              {misses} miss{misses === 1 ? "" : "es"}
            </span>
          ) : null}
        </span>
        <Button
          type="button"
          onClick={release}
          disabled={done || current.length < 3}
          className="h-11 min-w-28 px-6 font-mono text-base uppercase tracking-widest"
        >
          Submit
        </Button>
        <div className="flex items-center gap-2 justify-self-end">
          <Button type="button" variant="outline" className="h-11 w-11 p-0" title="Clear letters" aria-label="Clear letters" data-lw-clear="" disabled={done || path.length === 0} onClick={clear}><X className="h-5 w-5" /></Button>
          <Button type="button" variant="outline" className="h-11 w-11 p-0" title="Shuffle letters" aria-label="Shuffle letters" disabled={done} onClick={() => setOrder(previous => shuffleLetterOrder(previous))}><Shuffle className="h-5 w-5" /></Button>
        </div>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myMsRemaining, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "letterwheel") return null;
  const words = puzzle.words ?? [];
  // wheelRev 1: the answer is the attempt log; its slot words are the ones the server counted.
  const logged = lwUsesLog(puzzle);
  const v = lwGrade(words, puzzle.slots, puzzle.cols, logged ? lwDecodeLog(myAnswer ?? "").filter((t) => words.includes(t)) : lwDecode(myAnswer ?? ""));
  const storedMisses = logged ? Number(myExtra?.["misses"] ?? 0) : 0;
  const got = new Set(v.slots);
  const mine = letterMap(puzzle.cols, puzzle.slots, words.map((w, i) => (got.has(i) ? w : undefined)));
  const all = letterMap(puzzle.cols, puzzle.slots, words);
  const missed = new Map([...all].filter(([c]) => !mine.has(c)));
  const complete = v.totalCells > 0 && v.cells >= v.totalCells;
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  // As large as one 375×667 screen allows: up to 300px wide, 250px tall, 34px cells.
  const px = Math.floor(Math.min(300 / puzzle.cols, 250 / puzzle.rows, 34));
  return (
    <div data-word-reveal="letterwheel" className="flex w-full flex-col items-center gap-2">
      <div style={{ width: px * puzzle.cols, height: px * puzzle.rows }}>
        <Crossword cols={puzzle.cols} rows={puzzle.rows} slots={puzzle.slots} letters={mine} missed={missed} cellPx={px} />
      </div>
      <p className="font-mono text-base text-primary">
        {complete
          ? `${words.length} / ${words.length} · ${(elapsed / 1000).toFixed(1)}s`
          : `${v.slots.length} / ${words.length} words`}
      </p>
      {storedMisses > 0 ? (
        <p data-lw-reveal-misses={storedMisses} className="font-mono text-xs text-muted-foreground">
          {storedMisses} miss{storedMisses === 1 ? "" : "es"} · {LW_FREE_MISSES} free
        </p>
      ) : null}
      {lwUsesJar(puzzle) && myExtra?.["jarSize"] !== undefined ? (
        <p data-lw-reveal-jar={Number(myExtra["bonusWords"] ?? 0)} className="font-mono text-xs text-muted-foreground">
          Bonus jar · {Number(myExtra["bonusWords"] ?? 0)} word{Number(myExtra["bonusWords"] ?? 0) === 1 ? "" : "s"} · {Math.min(Number(myExtra["jarDrops"] ?? 0), Number(myExtra["jarSize"]))} / {Number(myExtra["jarSize"])}
        </p>
      ) : null}
    </div>
  );
}

export const letterWheelPuzzle: PuzzleDefinition = {
  key: "letterwheel",
  name: gameDisplayName("letterwheel"),
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
