import { devWarp } from "@/lib/arcade/devWarp";
import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  homerunCheckpoint,
  homerunGameFor,
  HOMERUN_BG,
  HOMERUN_CHECKPOINT_INTERVAL,
  HOMERUN_INPUT_MODE,
  HOMERUN_INPUT_SWING,
  HOMERUN_MODE_CONTACT,
  HOMERUN_MODE_POWER,
  HOMERUN_REV_3,
  HOMERUN_REV_4,
  HOMERUN_REV_DEALT,
  HOMERUN_INPUT_SPOT,
  HOMERUN_INPUT_TAP,
  HOMERUN_V4_TAP_EARLY,
  homerunV4SpotOk,
  homerunSwingStartPx,
  homerunCurrent,
  homerunViewHFor,
  type HomerunState,
  HOMERUN_WORLD_H,
  HOMERUN_WORLD_W,
} from "@/lib/arcade/homerun";
import { drawHomerunArt, homerunScene } from "@/lib/arcade/homerun.renderer";
import { encodeHomerunRun, replayHomerunRun } from "@/lib/duel/homerun";
import { HOMERUN_TIME_MS, type HomerunPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";
import { homerunSounds } from "@/lib/fx/homerunSounds";
import { useMemo, useRef, useState } from "react";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the night park from behind the plate, the batter in his stance, a pitch on its way. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 200 150" width={200} height={150} aria-hidden="true" style={{ background: HOMERUN_BG, borderRadius: 10 }}>
        <defs>
          <linearGradient id="hr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#03050C" />
            <stop offset="1" stopColor="#111A33" />
          </linearGradient>
          <radialGradient id="hr-bloom">
            <stop offset="0" stopColor="#FFF6DC" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FFE6B4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="60" fill="url(#hr-sky)" />
        <circle cx="40" cy="14" r="18" fill="url(#hr-bloom)" />
        <circle cx="160" cy="14" r="18" fill="url(#hr-bloom)" />
        <rect x="30" y="10" width="20" height="7" fill="#FFF8E6" />
        <rect x="150" y="10" width="20" height="7" fill="#FFF8E6" />
        <rect y="30" width="200" height="28" fill="#141A2A" />
        <rect y="40" width="200" height="2" fill="#2B6CD8" />
        <rect x="70" y="47" width="26" height="7" fill="#1A160C" stroke="#F2C75C" strokeWidth="0.8" />
        <rect y="57" width="200" height="7" fill="#1F4A33" />
        <rect y="57" width="200" height="1" fill="#E8C547" />
        <rect x="8" y="34" width="1.6" height="30" fill="#FFE15A" />
        <rect x="190" y="34" width="1.6" height="30" fill="#FFE15A" />
        <rect y="64" width="200" height="86" fill="#245C33" />
        <ellipse cx="104" cy="74" rx="34" ry="4" fill="#7A5638" />
        <path d="M103 72 l-2 -11 l3 -2 l3 2 l-2 11 Z" fill="#8C2C36" />
        <circle cx="104" cy="57" r="2.2" fill="#C69C7A" />
        <path d="M0 110 Q100 92 200 110 L200 150 L0 150 Z" fill="#7A5638" />
        <rect x="112" y="96" width="30" height="32" fill="none" stroke="#fff" strokeOpacity="0.35" strokeDasharray="3 3" />
        <circle cx="126" cy="106" r="2.6" fill="#F4F3EE" />
        <path d="M120 140 L134 140 L137 146 L127 150 L117 146 Z" fill="#F5F6F2" />
        <path d="M48 148 L56 120 L52 104 L66 104 L70 120 L74 148 L66 148 L62 124 L58 148 Z" fill="#E7E9EF" />
        <path d="M50 104 L48 82 Q60 76 72 82 L70 104 Z" fill="#17244A" />
        <circle cx="61" cy="74" r="7" fill="#2C4282" />
        <ellipse cx="68" cy="74" rx="4" ry="1.2" fill="#0C1430" />
        <circle cx="70" cy="84" r="2.6" fill="#F2C75C" />
        <path d="M70 84 L84 44 L87 45 L73 85 Z" fill="#C08A52" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Tap a spot on the field before the pitch, then tap as the ring closes on the ball: perfect timing sends it to your spot.
      </p>
    </div>
  );
}

/**
 * The sound observer, also handing each drawn frame's swing choice to the Contact / Power buttons (homerunRev 3) and
 * the drawn state to the tap handler (homerunRev 4: a tap is a spot before the pitch, a swing once it is coming).
 */
function homerunObserver(onMode: (mode: number) => void, onLive?: (live: boolean) => void, onState?: (state: HomerunState) => void) {
  return () => {
    const inner = homerunSounds();
    return {
      frame: (state: HomerunState, running: boolean) => {
        onState?.(state);
        onMode(state.mode);
        // The pitch is live from its release until it is decided (the sim moves on to the next pitch then).
        const cur = homerunCurrent(state);
        onLive?.(cur !== null && state.tick >= cur.release);
        inner.frame(state, running);
      },
      stop: () => inner.stop(),
    };
  };
}

const MODE_BUTTON =
  "h-[48px] flex-1 rounded-xl border-2 px-3 text-[15px] font-extrabold tracking-wide hover:bg-background/40";

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: HomerunPuzzleData | null = puzzle.type === "homerun" ? puzzle : null;
  // homerunRev 3: the Contact / Power choice under the field (the sim's own choice lights its button).
  const choose = (data?.homerunRev ?? 1) === HOMERUN_REV_3;
  const [mode, setMode] = useState(HOMERUN_MODE_CONTACT);
  const shown = useRef(HOMERUN_MODE_CONTACT);
  // The row hides (a quick fade) from the pitch's release until the hit or miss is decided: the choice is locked on
  // the release tick, so nothing is lost, and the plate and the batter are clear while the ball comes in.
  const [live, setLive] = useState(false);
  const liveShown = useRef(false);
  const drawn = useRef<HomerunState | null>(null);
  const sounds = useRef(
    homerunObserver(
      (m) => {
        if (m === shown.current) return;
        shown.current = m;
        setMode(m);
      },
      (l) => {
        if (l === liveShown.current) return;
        liveShown.current = l;
        setLive(l);
      },
      (st) => {
        drawn.current = st;
      },
    ),
  );
  const pick = (m: number): PointerPayload => ({ k: HOMERUN_INPUT_MODE, a: m, b: 0, c: 0 });
  // homerunRev 4: one tap does both jobs. Before the pitch is near it moves the spot (inside the field and stands);
  // from HOMERUN_V4_TAP_EARLY ticks before the release until the pitch is decided it swings, wherever it lands.
  const spotGame = (data?.homerunRev ?? 1) >= HOMERUN_REV_4;
  const tapKind = (x: number, y: number): PointerPayload | null => {
    const st = drawn.current;
    const cur = st ? homerunCurrent(st) : null;
    if (st && cur && st.tick >= cur.release - HOMERUN_V4_TAP_EARLY) return { k: HOMERUN_INPUT_TAP, a: 0, b: 0, c: 0 };
    const a = Math.round(x);
    const b = Math.round(y);
    return homerunV4SpotOk(a, b) ? { k: HOMERUN_INPUT_SPOT, a, b, c: 0 } : null;
  };
  // devWarp: development review shots only (scripts/shots/homerun-tuning-shots.ts); production returns the game as is.
  const game = useMemo(() => ({ ...devWarp("homerun", homerunGameFor(data?.homerunRev)), draw: drawHomerunArt }), [data?.homerunRev]);
  // The swipe: where the finger went down, and whether this swipe has already started the swing.
  const start = useRef<{ x: number; y: number; sent: boolean } | null>(null);
  // homerunRev 2 reads the swipe over a longer chord (18 px, rev 1 12 px) so its angle, the aim, is steadier.
  const startPx = homerunSwingStartPx(data?.homerunRev);
  return (
    <ArcadeCanvasStage
      diagKey="homerun"
      label={gameDisplayName("homerun")}
      background={HOMERUN_BG}
      fitWorld
      scene={homerunScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={HOMERUN_WORLD_W}
      worldH={homerunViewHFor(data?.homerunRev)}
      game={game}
      sounds={choose || spotGame ? sounds.current : homerunSounds}
      checkpoint={homerunCheckpoint}
      interval={HOMERUN_CHECKPOINT_INTERVAL}
      encodeRun={encodeHomerunRun}
      discrete
      inputKind={HOMERUN_INPUT_SWING}
      pointer={(kind, x, y) => {
        if (spotGame) return kind === "down" ? tapKind(x, y) : null;
        if (kind === "down") {
          // homerunRev 3's view runs below the world (display only): a touch there starts no swing.
          start.current = y <= HOMERUN_WORLD_H ? { x, y, sent: false } : null;
          return null;
        }
        y = Math.min(HOMERUN_WORLD_H, y);
        const s = start.current;
        if (kind === "up") {
          start.current = null;
          return null;
        }
        if (!s || s.sent) return null;
        const dx = x - s.x;
        const dy = y - s.y;
        if (dx * dx + dy * dy < startPx * startPx) return null;
        // The swing starts now: height from where the swipe began, angle from its direction (0 = level toward the
        // pitcher's side, + = upward = pulled to left field); a swipe the wrong way is a foul.
        s.sent = true;
        const angle = Math.round((Math.atan2(-dy, -dx) * 1800) / Math.PI);
        return { k: HOMERUN_INPUT_SWING, a: Math.round(s.y), b: Math.max(-900, Math.min(900, angle)), c: 0 };
      }}
      keys={(kind, key, send) => {
        // homerunRev 4: Space swings (a click does too; a click before the pitch moves the spot).
        if (spotGame) {
          if (key !== " " && key !== "Spacebar") return false;
          const st = drawn.current;
          const cur = st ? homerunCurrent(st) : null;
          if (kind === "down" && st && cur && st.tick >= cur.release - HOMERUN_V4_TAP_EARLY) send({ k: HOMERUN_INPUT_TAP, a: 0, b: 0, c: 0 });
          return true;
        }
        // homerunRev 3: C (or 1) Contact, P (or 2) Power; the swing itself is the mouse drag.
        if (!choose) return false;
        const k = key.toLowerCase();
        const m = k === "c" || k === "1" ? HOMERUN_MODE_CONTACT : k === "p" || k === "2" ? HOMERUN_MODE_POWER : -1;
        if (m < 0) return false;
        if (kind === "down") send(pick(m));
        return true;
      }}
      overlay={
        choose
          ? (send) => (
              // The swing choice for the next pitch, over the bottom of the field (below the plate); the lit one is the sim's.
              // Drawn in the arena so the world reaches the bottom, and lifted by the home bar: the row ends at least 12 px
              // above env(safe-area-inset-bottom) (the arena ends 16 px above the screen's bottom, so the lift is the inset
              // less 4 px). Only the buttons take a touch; a swipe beside them reaches the canvas.
              <div
                data-game-controls="swing"
                aria-hidden={live || undefined}
                className={`pointer-events-none absolute inset-x-1 flex h-[52px] items-center gap-2 transition-opacity duration-150 ${live ? "opacity-0" : "opacity-100"}`}
                style={{ bottom: "max(0px, calc(env(safe-area-inset-bottom, 0px) - 4px))" }}
              >
                {[
                  { m: HOMERUN_MODE_CONTACT, label: "Contact", hint: "easier timing" },
                  { m: HOMERUN_MODE_POWER, label: "Power", hint: "goes further" },
                ].map(({ m, label, hint }) => (
                  <ArcadeControlButton
                    key={m}
                    type="button"
                    aria-label={`${label} swing`}
                    aria-pressed={mode === m}
                    disabled={locked || live}
                    data-swing-mode={m === HOMERUN_MODE_POWER ? "power" : "contact"}
                    className={`${MODE_BUTTON} ${live ? "pointer-events-none" : "pointer-events-auto"} ${
                      mode === m
                        ? "border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(245,184,46,0.3)] hover:bg-primary/20 active:bg-primary/30"
                        : "border-foreground/25 bg-background/40 text-foreground/80 active:bg-foreground/15"
                    }`}
                    onPressStart={() => send(pick(m))}
                  >
                    <span className="flex flex-col items-center leading-tight">
                      <span>{label}</span>
                      <span className="text-[10px] font-semibold opacity-75">{hint}</span>
                    </span>
                  </ArcadeControlButton>
                ))}
              </div>
            )
          : undefined
      }
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "homerun") return null;
  const result = replayHomerunRun(puzzle.seed, myAnswer ?? "", puzzle.homerunRev);
  // What the run did, part by part (the points are the stored score's, shown by the arcade reveal above).
  const lines = result.parts.map((part) => `${part.label}: ${part.detail}`);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.homers} home run{result.homers === 1 ? "" : "s"} · longest {result.longest} ft
      </p>
      {lines.map((line) => (
        <p key={line} className="shrink-0 text-center font-mono text-sm text-foreground">
          {line}
        </p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">
        {(puzzle.homerunRev ?? 1) >= HOMERUN_REV_4 ? "Same ten pitches and fielders for everyone" : "Same ten pitches for everyone"}
      </p>
    </div>
  );
}

/** The seed is dealt on the server from the proved deal; every run is replayed there for scoring. */
export const homerunPuzzle: PuzzleDefinition = {
  key: "homerun",
  name: gameDisplayName("homerun"),
  category: "arcade",
  timeLimitMs: HOMERUN_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "homerun", seed: 1, homerunRev: HOMERUN_REV_DEALT }) satisfies HomerunPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
