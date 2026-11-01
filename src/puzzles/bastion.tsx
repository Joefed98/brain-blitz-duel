import { heldHorizontal } from "@/lib/desktop";
import {
  basCheckpoint,
  bastionGame,
  BAS_BG,
  BAS_CHECKPOINT_INTERVAL,
  BAS_COLOURS,
  BAS_GOLD,
  BAS_HEALTH,
  BAS_WORLD_H,
  BAS_WORLD_W,
} from "@/lib/arcade/bastion";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { BAS_TURRET_X, BAS_TURRET_Y, BAS_STEP_DEG_X256, type BasState } from "@/lib/arcade/bastion";
import { encodeBastionRun, encodeBastionTankRun, isBastionTank, replayBastionRun, replayBastionTankRun } from "@/lib/duel/bastion";
import {
  bastionTankCheckpoint,
  BASTION_REV_DEALT,
  BT2_BASE,
  BT2_CHECKPOINT_INTERVAL,
  BT2_INPUT_AIM,
  BT2_INPUT_FIRE,
  BT2_INPUT_RELOAD,
  BT2_INPUT_TAP,
  BT2_TANKS,
  BT2_WORLD_H,
  BT2_WORLD_W,
  type BastionTankState,
} from "@/lib/arcade/bastionTank";
import { bastionScene, bastionTankArtGame, BT2_ART_BG } from "@/lib/arcade/bastionTank.renderer";
import { bastionTankSounds } from "@/lib/fx/gameSounds";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { BASTION_TIME_MS, type BastionPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The original Bastion's intro still (unstamped rounds): the turret, a circle, a square and the base bar. */
export function LegacyIntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 130"
        width={168}
        height={130}
        aria-hidden="true"
        style={{ background: BAS_BG, borderRadius: 10 }}
      >
        <circle cx={50} cy={34} r={10} fill={BAS_COLOURS[0]} />
        <rect x={104} y={46} width={22} height={22} fill={BAS_COLOURS[1]} />
        <line x1={84} y1={104} x2={98} y2={88} stroke={BAS_GOLD} strokeWidth={6} strokeLinecap="round" />
        <path d="M68 108 A16 16 0 0 1 100 108 Z" fill={BAS_GOLD} />
        <circle cx={108} cy={77} r={2.5} fill={BAS_GOLD} />
        <rect x={8} y={97} width={152} height={1.5} fill={BAS_GOLD} />
        {Array.from({ length: BAS_HEALTH }, (_, i) => (
          <rect key={i} x={60 + i * 10} y={116} width={8} height={5} fill={BAS_GOLD} />
        ))}
      </svg>
      <p className="text-center text-xs text-muted-foreground">Touch where you want to aim - it always fires.</p>
    </div>
  );
}

const ARROWS_KEY = "duelz-bastion-arrows";
export const ARROW_DEG_PER_TICK = 3;
const AIM_RADIUS = 180;

/** Aim point on a circle round the turret; 0° = left, 90° = up, 180° = right. */
function aimPoint(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    a: Math.round(BAS_TURRET_X - Math.cos(rad) * AIM_RADIUS),
    b: Math.round(BAS_TURRET_Y - Math.sin(rad) * AIM_RADIUS),
    c: 1,
  };
}

function LegacyStage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BastionPuzzleData | null = puzzle.type === "bastion" ? puzzle : null;
  const [arrows, setArrows] = useState(false);
  const arrowsRef = useRef(false);
  arrowsRef.current = arrows;
  const holding = useRef<-1 | 0 | 1>(0);
  const deg = useRef<number | null>(null);
  const keyHold = useRef(heldHorizontal());

  useEffect(() => {
    setArrows(window.localStorage.getItem(ARROWS_KEY) === "1");
  }, []);

  const toggle = () => {
    const next = !arrows;
    setArrows(next);
    holding.current = 0;
    deg.current = null;
    window.localStorage.setItem(ARROWS_KEY, next ? "1" : "0");
  };

  const tickInput = (state: BasState) => {
    // Desktop keys: ←/→ (A/D) are the two rotate buttons, in either mode.
    const keyDir = keyHold.current.dir();
    const dir = arrowsRef.current && holding.current !== 0 ? holding.current : keyDir;
    if (dir === 0) {
      if (!arrowsRef.current) deg.current = null;
      return null;
    }
    const current = deg.current ?? (state.angleFp * BAS_STEP_DEG_X256) / 65536;
    const next = Math.min(180, Math.max(0, current + dir * ARROW_DEG_PER_TICK));
    deg.current = next;
    return aimPoint(next);
  };

  const startHold = (dir: -1 | 1) => (_event: PointerEvent<HTMLButtonElement>) => { holding.current = dir; };
  const stopHold = () => { holding.current = 0; };

  const arrowBtn =
    "absolute bottom-3 flex h-[72px] w-[72px] select-none items-center justify-center rounded-2xl border-2 border-primary/70 bg-background/40 text-3xl text-primary active:bg-primary/30";

  return (
    <ArcadeCanvasStage
      diagKey="bastion"
      label="Bastion"
      background={BAS_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={BAS_WORLD_W}
      worldH={BAS_WORLD_H}
      game={bastionGame}
      checkpoint={basCheckpoint}
      interval={BAS_CHECKPOINT_INTERVAL}
      encodeRun={encodeBastionRun}
      tickInput={tickInput}
      keys={(kind, key) => keyHold.current.key(kind, key)}
      pointer={(kind, x, y) => (arrowsRef.current ? null : { a: x, b: y, c: kind === "up" ? 0 : 1 })}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
      overlay={
        <>
          <button
            type="button"
            onClick={toggle}
            className={`absolute right-2 top-12 rounded-full border px-3 py-1 text-xs font-semibold ${arrows ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-background/50 text-primary"}`}
            aria-pressed={arrows}
          >
            Arrows
          </button>
          {arrows && (
            <>
               <ArcadeControlButton type="button" aria-label="Rotate left" className={`${arrowBtn} left-3 before:content-['◀']`} onPressStart={startHold(-1)} onPressEnd={stopHold} />
               <ArcadeControlButton type="button" aria-label="Rotate right" className={`${arrowBtn} right-3 before:content-['▶']`} onPressStart={startHold(1)} onPressEnd={stopHold} />
            </>
          )}
        </>
      }
    />
  );
}

export function bastionLine(r: {
  destroyed: number;
  health: number;
  survived: boolean;
  endedSeconds: number;
}): string {
  const head = `${r.destroyed} destroyed · base ${r.health} / ${BAS_HEALTH}`;
  return r.survived ? `${head} · survived` : `${head} · base fell at ${r.endedSeconds.toFixed(1)}s`;
}

function LegacyReveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "bastion") return null;
  const result = replayBastionRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {bastionLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same waves for everyone
      </p>
    </div>
  );
}

/* ============================== bastionRev 2 ============================== */

/** Fixed intro still: three lanes at dusk, a medium and a heavy rolling in, the weak spot glowing, the crosshair on it. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 200 150" width={200} height={150} aria-hidden="true" style={{ background: BT2_ART_BG, borderRadius: 10 }}>
        <defs>
          <linearGradient id="bt2-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#140F2A" />
            <stop offset="0.5" stopColor="#3B1F4A" />
            <stop offset="0.85" stopColor="#B4485A" />
            <stop offset="1" stopColor="#F49A4C" />
          </linearGradient>
          <linearGradient id="bt2-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5A3A3A" />
            <stop offset="1" stopColor="#1E1A16" />
          </linearGradient>
        </defs>
        <rect width="200" height="52" fill="url(#bt2-sky)" />
        <path d="M128 52 A9 9 0 0 1 146 52 Z" fill="#FFE7B8" />
        <path d="M0 52 L0 44 Q30 38 60 45 Q100 36 140 44 Q170 38 200 45 L200 52 Z" fill="#2E1830" />
        <rect y="52" width="200" height="72" fill="url(#bt2-field)" />
        <path d="M97 52 L103 52 L170 124 L110 124 Z M97 52 L103 52 L90 124 L30 124 Z" fill="#78584022" />
        <path d="M100 52 L36 124 M100 52 L164 124 M100 52 L94 124 M100 52 L106 124" stroke="#FFBE7833" strokeWidth="0.8" />
        {/* A medium, far, in the left lane. */}
        <rect x="58" y="70" width="22" height="9" fill="#5E6B3E" />
        <rect x="64" y="65" width="10" height="5" fill="#6E7C48" />
        <rect x="61" y="73" width="5" height="3" fill="#FFB43A" />
        {/* A heavy, near, in the centre lane: its weak spot under the crosshair. */}
        <rect x="76" y="98" width="48" height="22" fill="#4A5058" />
        <rect x="76" y="112" width="48" height="8" fill="#15171B" />
        <rect x="88" y="87" width="24" height="11" fill="#5A6170" />
        <circle cx="100" cy="93" r="2.6" fill="#0B0A0C" />
        <rect x="102" y="96" width="9" height="5" fill="#FFB43A" />
        <circle cx="106.5" cy="98.5" r="7" fill="none" stroke="#fff" strokeWidth="1.2" />
        <path d="M106.5 88 v4 M106.5 105 v4 M96 98.5 h4 M113 98.5 h4" stroke="#fff" strokeWidth="1.2" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={89 + i * 6} y={81} width={5} height={2.4} fill={i < 3 ? "#7CF29A" : "#ffffff22"} />
        ))}
        <rect y="124" width="200" height="26" fill="#3A302C" />
        <rect y="124" width="200" height="2" fill="#C9875A" />
        <path d="M100 160 L104 132 L110 132 L114 160 Z" fill="#4A4A52" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={10 + i * 8} y={136} width={5} height={9} rx={2} fill={i < 4 ? "#E8B84A" : "#ffffff22"} />
        ))}
        <rect x="140" y="138" width="50" height="5" fill="#ffffff14" />
        <rect x="157" y="138" width="9" height="5" fill="#7CF29A88" />
        <rect x="160" y="135" width="1.6" height="11" fill="#fff" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Drag to aim (the crosshair floats above your thumb) and lift to fire. Lead moving tanks and hit the glowing weak spot for double damage.
      </p>
    </div>
  );
}

/** The crosshair floats this far above the finger (world px) so the thumb never hides the target. */
const FINGER_LIFT = 60;
/** A swipe down this far (world px), mostly vertical and quick, reloads instead of firing. */
const SWIPE_DOWN_PX = 70;
const SWIPE_MS = 420;
/** A tap: a short press that barely moves (the fast-reload tap while reloading). */
const TAP_MS = 320;
const TAP_PX = 18;

interface Gesture {
  x0: number;
  y0: number;
  t0: number;
  lastX: number;
  lastY: number;
  lastT: number;
  /** The crosshair before this press (a reload swipe puts it back). */
  aimX: number;
  aimY: number;
}

function TankStage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BastionPuzzleData | null = puzzle.type === "bastion" ? puzzle : null;
  const game = useMemo(() => bastionTankArtGame, []);
  const live = useRef<BastionTankState | null>(null);
  const aim = useRef({ x: 195, y: 470 });
  const actions = useRef<PointerPayload[]>([]);
  const gesture = useRef<Gesture | null>(null);
  const mouse = useRef(false);
  const seq = useRef(1);
  const clampAim = (x: number, y: number) => {
    aim.current = { x: Math.max(0, Math.min(BT2_WORLD_W, x)), y: Math.max(0, Math.min(BT2_WORLD_H, y)) };
  };
  const aimPayload = (down: boolean): PointerPayload => ({ k: BT2_INPUT_AIM, a: Math.round(aim.current.x), b: Math.round(aim.current.y), c: down ? 1 : 0 });
  // Every action gets its own `c` (clamped to 0 when recorded) so two alike in a row are both sent.
  const act = (k: number) => {
    if (actions.current.length < 4) actions.current.push({ k, a: Math.round(aim.current.x), b: Math.round(aim.current.y), c: k === BT2_INPUT_AIM ? 0 : seq.current++ });
  };
  return (
    <ArcadeCanvasStage
      diagKey="bastion"
      label={gameDisplayName("bastion")}
      background={BT2_ART_BG}
      fitWorld
      scene={bastionScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={BT2_WORLD_W}
      worldH={BT2_WORLD_H}
      game={game}
      sounds={bastionTankSounds}
      checkpoint={bastionTankCheckpoint}
      interval={BT2_CHECKPOINT_INTERVAL}
      encodeRun={encodeBastionTankRun}
      tickInput={(state) => {
        live.current = state;
        return actions.current.shift() ?? null;
      }}
      hover={(x, y) => {
        // A mouse: the crosshair sits on the pointer.
        mouse.current = true;
        clampAim(x, y);
        return aimPayload(false);
      }}
      keys={(kind, key) => {
        if (kind !== "down") return key === "r" || key === "R" || key === " ";
        if (key === "r" || key === "R") act(BT2_INPUT_RELOAD);
        else if (key === " ") act(BT2_INPUT_TAP);
        else return false;
        return true;
      }}
      pointer={(kind, x, y) => {
        const now = performance.now();
        if (kind === "down") {
          gesture.current = { x0: x, y0: y, t0: now, lastX: x, lastY: y, lastT: now, aimX: aim.current.x, aimY: aim.current.y };
          clampAim(x, mouse.current ? y : y - FINGER_LIFT);
          return aimPayload(true);
        }
        const g = gesture.current;
        if (!g) return null;
        if (kind === "move") {
          if (mouse.current) clampAim(x, y);
          else {
            // Small, slow movements move the crosshair less than the finger (fine aim); quick ones one to one.
            const dx = x - g.lastX;
            const dy = y - g.lastY;
            const speed = Math.hypot(dx, dy) / Math.max(1, now - g.lastT);
            const gain = Math.max(0.45, Math.min(1, 0.4 + speed * 0.9));
            clampAim(aim.current.x + dx * gain, aim.current.y + dy * gain);
          }
          g.lastX = x;
          g.lastY = y;
          g.lastT = now;
          return aimPayload(true);
        }
        gesture.current = null;
        const dx = x - g.x0;
        const dy = y - g.y0;
        const ms = now - g.t0;
        const state = live.current;
        const reloading = !!state && state.reloadAt >= 0;
        if (!mouse.current && dy > SWIPE_DOWN_PX && Math.abs(dx) < dy * 0.6 && ms < SWIPE_MS) {
          // A swipe down: reload early, and the crosshair goes back where it was.
          clampAim(g.aimX, g.aimY);
          act(BT2_INPUT_AIM);
          act(BT2_INPUT_RELOAD);
        } else if (reloading && !mouse.current) {
          if (ms < TAP_MS && Math.hypot(dx, dy) < TAP_PX) act(BT2_INPUT_TAP);
        } else act(BT2_INPUT_FIRE);
        return null;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

function Stage(props: PuzzleStageProps) {
  const rev = props.puzzle.type === "bastion" ? props.puzzle.bastionRev : undefined;
  return isBastionTank(rev) ? <TankStage {...props} /> : <LegacyStage {...props} />;
}

function Reveal(props: PuzzleRevealProps) {
  const { puzzle, myAnswer } = props;
  if (puzzle.type !== "bastion") return null;
  if (!isBastionTank(puzzle.bastionRev)) return <LegacyReveal {...props} />;
  const result = replayBastionTankRun(puzzle.seed, myAnswer ?? "");
  // What the run did, part by part (the points are the stored score's, shown by the arcade reveal above).
  const lines = result.parts.map((part) => `${part.label}: ${part.detail}`);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.kills} of {BT2_TANKS} tanks · {result.fell ? `base fell at ${result.endedSeconds.toFixed(1)}s` : `base ${result.base} / ${BT2_BASE}`}
      </p>
      {lines.map((line) => (
        <p key={line} className="shrink-0 text-center font-mono text-sm text-foreground">
          {line}
        </p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">Same five waves for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const bastionPuzzle: PuzzleDefinition = {
  key: "bastion",
  name: gameDisplayName("bastion"),
  category: "arcade",
  timeLimitMs: BASTION_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "bastion", seed: 1, bastionRev: BASTION_REV_DEALT }) satisfies BastionPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
