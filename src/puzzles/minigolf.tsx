import { useMemo, useRef } from "react";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  minigolfCheckpoint,
  minigolfGameFor,
  minigolfStdParts,
  MG_AIM,
  MG_INPUT_PUTT,
  MG_POWER_MAX,

  MINIGOLF_HOLES,
  MINIGOLF_REV,
  MINIGOLF_RUN_TICKS,
  MINIGOLF_W,
  type MinigolfState,
} from "@/lib/arcade/minigolf";
import { drawMinigolfCourse, drawMinigolfPlay, minigolfScene, MINIGOLF_BG, MINIGOLF_VIEW_H, type MinigolfAim } from "@/lib/arcade/minigolf.renderer";
import { SPORTS_CHECKPOINT_INTERVAL } from "@/lib/arcade/sportsKit";
import { withArcadeFx } from "@/lib/arcade/arcadeFx.renderer";
import { MINIGOLF_FX } from "@/lib/arcade/sportsFx.renderer";
import { encodeMinigolfRun, replayMinigolfRun } from "@/lib/duel/minigolf";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { MinigolfPuzzleData } from "@/lib/duel/types";
import { minigolfSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** A pull this long (world px) is full power; a shorter one than MIN_PULL is let go without a putt. */
const FULL_PULL = 150;
const MIN_PULL = 12;

/** Fixed intro still: a hole's turf and rails, the ball, the dotted aim and the cup with its flag. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 195 110" width={195} height={110} aria-hidden="true" style={{ background: "#1A1714", borderRadius: 10 }}>
        <rect x="20" y="10" width="155" height="90" rx="10" fill="#2F7A3A" stroke="#6B4426" strokeWidth="5" />
        <rect x="22" y="28" width="151" height="16" fill="#2A6F35" />
        <rect x="22" y="62" width="151" height="16" fill="#2A6F35" />
        <circle cx="140" cy="36" r="5" fill="#111" stroke="#E9EDE6" strokeWidth="1.4" />
        <line x1="140" y1="36" x2="142" y2="18" stroke="#E8E2D2" strokeWidth="1.4" />
        <path d="M142 18 L154 21 L142 25 Z" fill="#C8283A" />
        {/* A windmill's doorway: brick walls either side and the four sails on their hub. */}
        <rect x="22" y="52" width="66" height="7" rx="3.5" fill="#9E4A30" />
        <rect x="118" y="52" width="55" height="7" rx="3.5" fill="#9E4A30" />
        <g transform="rotate(20 103 55.5)">
          <rect x="101.5" y="40" width="3" height="31" rx="1.5" fill="#EFE6D2" stroke="#6B4426" strokeWidth="0.8" />
          <rect x="88" y="54" width="31" height="3" rx="1.5" fill="#EFE6D2" stroke="#6B4426" strokeWidth="0.8" />
        </g>
        <circle cx="103" cy="55.5" r="3.2" fill="#D8B25A" />
        <circle cx="52" cy="78" r="4" fill="#F4F6F8" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={60 + i * 9} cy={74 - i * 4.4} r="1.4" fill="#FFFFFF" opacity={0.9 - i * 0.12} />
        ))}
        <line x1="47" y1="81" x2="32" y2="89" stroke="#F2C75C" strokeWidth="1.6" opacity="0.7" />
      </svg>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: MinigolfPuzzleData | null = puzzle.type === "minigolf" ? puzzle : null;
  const aim = useRef<MinigolfAim | null>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const pars = data?.pars;
  // The game the stage runs: the stored pars' sim, drawn with the aim the finger is holding (presentation only).
  const game = useMemo<ArcadeGame<MinigolfState, ArcadeInputEvent | null>>(() => {
    const base = minigolfGameFor(pars ?? undefined, data?.golfRev);
    // The live view (3 Nov 2026, display only): the hole under its fixed camera with its effects, the HUD unzoomed.
    const world = withArcadeFx(MINIGOLF_FX, (ctx, s) => drawMinigolfCourse(ctx, s, aim.current));
    return { ...base, draw: (ctx, s, size) => drawMinigolfPlay(ctx, s, () => world(ctx, s, size)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pars?.join(","), data?.golfRev]);

  /** The pull from the touch-down point to the finger: the putt goes the other way. */
  const pullOf = (x: number, y: number) => {
    const a = anchor.current;
    if (!a) return null;
    const dx = a.x - x;
    const dy = a.y - y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_PULL) return null;
    return { dx: dx / len, dy: dy / len, power: Math.min(1, len / FULL_PULL) };
  };

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    if (kind === "down") {
      anchor.current = { x, y };
      aim.current = null;
      return null;
    }
    const pull = pullOf(x, y);
    if (kind === "move") {
      aim.current = pull;
      return null;
    }
    anchor.current = null;
    aim.current = null;
    if (!pull) return null;
    return {
      k: MG_INPUT_PUTT,
      a: Math.round(pull.dx * 4000),
      b: Math.round(pull.dy * 4000),
      c: Math.max(1, Math.round(pull.power * MG_POWER_MAX)),
    };
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col">
      <ArcadeCanvasStage
        diagKey="minigolf"
        label={gameDisplayName("minigolf")}
        background={MINIGOLF_BG}
        fitWorld
        scene={minigolfScene}
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={MINIGOLF_W}
        worldH={MINIGOLF_VIEW_H}
        game={game}
        sounds={minigolfSounds}
        checkpoint={minigolfCheckpoint}
        interval={SPORTS_CHECKPOINT_INTERVAL}
        encodeRun={encodeMinigolfRun}
        discrete
        inputKind={MG_INPUT_PUTT}
        pointer={(kind, x, y) => pointer(kind, x, y)}
        keys={(kind, key, send, state) => {
          // Desktop: arrows turn the aim (Shift for finer), W/S the power, Space putts.
          if (state.phase !== MG_AIM) return false;
          const cur = aim.current ?? { dx: 0, dy: -1, power: 0.4 };
          if (kind !== "down") return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key);
          const turn = (deg: number) => {
            const r = (deg * Math.PI) / 180;
            aim.current = { dx: cur.dx * Math.cos(r) - cur.dy * Math.sin(r), dy: cur.dx * Math.sin(r) + cur.dy * Math.cos(r), power: cur.power };
          };
          if (key === "ArrowLeft") turn(-3);
          else if (key === "ArrowRight") turn(3);
          else if (key === "ArrowUp") aim.current = { ...cur, power: Math.min(1, cur.power + 0.04) };
          else if (key === "ArrowDown") aim.current = { ...cur, power: Math.max(0.02, cur.power - 0.04) };
          else if (key === " " && aim.current) {
            const a = aim.current;
            aim.current = null;
            send({ k: MG_INPUT_PUTT, a: Math.round(a.dx * 4000), b: Math.round(a.dy * 4000), c: Math.max(1, Math.round(a.power * MG_POWER_MAX)) });
          } else return false;
          return true;
        }}
        onSubmit={onSubmit}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "minigolf") return null;
  const result = replayMinigolfRun(puzzle.seed, myAnswer ?? "", puzzle.pars, puzzle.golfRev);
  const s = result.state;
  const parts = minigolfStdParts(s);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <div className="flex shrink-0 justify-center gap-2 font-mono text-sm">
        {Array.from({ length: MINIGOLF_HOLES }, (_, i) => {
          const holed = s.holed[i] === 1;
          const strokes = s.taken[i] ?? 0;
          const par = s.pars[i] ?? 3;
          const colour = !holed ? "#8A8F96" : strokes < par ? "#F2C75C" : strokes === par ? "#7FD58A" : "#EDEBE4";
          return (
            <span key={i} className="flex flex-col items-center rounded-md border border-white/10 px-2 py-1" style={{ color: colour }}>
              <span className="text-[11px] text-muted-foreground">H{i + 1} · P{par}</span>
              <span className="text-base font-bold">{holed ? strokes : strokes > 0 ? "–" : "·"}</span>
            </span>
          );
        })}
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.holed} of {result.holes} holed · {result.strokes} strokes
      </p>
      {parts ? (
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          {parts.map((part) => `${part.label}: ${part.detail}`).map((line) => (
            <p key={line} className="text-center font-mono text-sm text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">Same five holes for everyone</p>
    </div>
  );
}

/** The course is dealt on the server (a proven bank course and its pars); every run is replayed there for scoring. */
export const minigolfPuzzle: PuzzleDefinition = {
  key: "minigolf",
  name: gameDisplayName("minigolf"),
  category: "arcade",
  timeLimitMs: (MINIGOLF_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "minigolf", seed: 1, golfRev: MINIGOLF_REV, pars: [2, 3, 3, 3, 3] }) satisfies MinigolfPuzzleData,
  check: () => false,
  revealHeading: "Your round",
  IntroExample,
  Stage,
  Reveal,
};
