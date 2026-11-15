import { useMemo, useRef, useState } from "react";

import { Segmented } from "@/design/components";
import { playTone } from "@/lib/sound";

import { useGameLookRef } from "@/lib/skins/equipped";
import { lookKey } from "@/lib/arcade/skins/look";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  minigolfCheckpoint,
  minigolfGameFor,
  minigolfStdParts,
  MG_AIM,
  MG_INPUT_CHIP,
  MG_INPUT_PUTT,
  MG_POWER_MAX,

  MINIGOLF_HOLES,
  MINIGOLF_REV,
  MINIGOLF_RUN_TICKS,
  MINIGOLF_W,
  type MinigolfState,
} from "@/lib/arcade/minigolf";
import { drawMinigolfCourse, drawMinigolfPlay, minigolfCamera, minigolfSceneFor, MINIGOLF_BG, MINIGOLF_VIEW_H, type MinigolfAim } from "@/lib/arcade/minigolf.renderer";
import { courseArtKey } from "@/lib/arcade/skins/minigolfCourse";
import { SPORTS_CHECKPOINT_INTERVAL } from "@/lib/arcade/sportsKit";
import { withArcadeFx } from "@/lib/arcade/arcadeFx.renderer";
import { MINIGOLF_FX } from "@/lib/arcade/sportsFx.renderer";
import { encodeMinigolfRun, minigolfCourseOf, replayMinigolfPuzzle } from "@/lib/duel/minigolf";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { MinigolfPuzzleData } from "@/lib/duel/types";
import { minigolfSounds } from "@/lib/fx/gameSounds";

import { MinigolfReveal } from "./minigolfReveal";
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
  // golfRev 3 (the Crazy Golf overhaul): a putt or a lofted chip, chosen on the switch under the course.
  const v3 = (data?.golfRev ?? 1) >= 3 && (data?.holes?.length ?? 0) === MINIGOLF_HOLES;
  const [shotKind, setShotKind] = useState<"putt" | "chip">("putt");
  const chipRef = useRef(false);
  chipRef.current = v3 && shotKind === "chip";
  const toneStep = useRef(-1);
  // The player's own equipped skin and world theme (wave 2; display only, src/lib/skins/equipped.ts).
  const [look, lookRef] = useGameLookRef("minigolf");
  const scene = useMemo(() => minigolfSceneFor(look), [look]);
  // The game the stage runs: the stored pars' sim, drawn with the aim the finger is holding (presentation only).
  const game = useMemo<ArcadeGame<MinigolfState, ArcadeInputEvent | null>>(() => {
    const base = minigolfGameFor(pars ?? undefined, data?.golfRev, minigolfCourseOf(data));
    // The live view (3 Nov 2026, display only): the hole under its fixed camera with its effects, the HUD unzoomed.
    // golfRev 3's rubber band reaches the finger: its point (view px) is carried into the hole's own world px here.
    const aimIn = (s: MinigolfState): MinigolfAim | null => {
      const a = aim.current;
      if (!a || a.hx === undefined || a.hy === undefined) return a;
      const cam = minigolfCamera(s);
      return { ...a, hx: (a.hx - cam.x) / cam.k, hy: (a.hy - cam.y) / cam.k };
    };
    const world = withArcadeFx(MINIGOLF_FX, (ctx, s) => drawMinigolfCourse(ctx, s, aimIn(s), lookRef.current));
    return { ...base, draw: (ctx, s, size) => drawMinigolfPlay(ctx, s, () => world(ctx, s, size), MINIGOLF_VIEW_H, lookRef.current) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pars?.join(","), data?.golfRev, data?.holes?.join(","), data?.level]);

  /** The pull from the touch-down point to the finger: the putt goes the other way. */
  const pullOf = (x: number, y: number) => {
    const a = anchor.current;
    if (!a) return null;
    const dx = a.x - x;
    const dy = a.y - y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_PULL) return null;
    return { dx: dx / len, dy: dy / len, power: Math.min(1, len / FULL_PULL), chip: chipRef.current, hx: x, hy: y };
  };

  /** golfRev 3: a soft tone rising with the pull's power, sounded at each twelfth of the way (presentation only). */
  const toneFor = (power: number | null) => {
    if (!v3 || power === null) {
      toneStep.current = -1;
      return;
    }
    const step = Math.round(power * 12);
    if (step === toneStep.current) return;
    toneStep.current = step;
    playTone(240 + power * 620, 45, "sine", 0.05);
  };
  const shotPayload = (a: { dx: number; dy: number; power: number }): PointerPayload => ({
    k: chipRef.current ? MG_INPUT_CHIP : MG_INPUT_PUTT,
    a: Math.round(a.dx * 4000),
    b: Math.round(a.dy * 4000),
    c: Math.max(1, Math.round(a.power * MG_POWER_MAX)),
  });

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    if (kind === "down") {
      anchor.current = { x, y };
      aim.current = null;
      return null;
    }
    const pull = pullOf(x, y);
    if (kind === "move") {
      aim.current = pull;
      toneFor(pull?.power ?? null);
      return null;
    }
    anchor.current = null;
    aim.current = null;
    toneFor(null);
    if (!pull) return null;
    return shotPayload(pull);
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col">
      <ArcadeCanvasStage
        diagKey="minigolf"
        label={gameDisplayName("minigolf")}
        background={MINIGOLF_BG}
        fitWorld
        scene={scene}
        sceneKey={() => lookKey(lookRef.current) + courseArtKey()}
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
          // Desktop: Left / Right turn the aim, Up / Down set the power, Space plays the shot; golfRev 3: C switches putt / chip.
          if (state.phase !== MG_AIM) return false;
          const cur = aim.current ?? { dx: 0, dy: -1, power: 0.4, chip: chipRef.current };
          if (kind !== "down") return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", ...(v3 ? ["c", "C"] : [])].includes(key);
          if (v3 && (key === "c" || key === "C")) {
            const next = shotKind === "chip" ? "putt" : "chip";
            setShotKind(next);
            chipRef.current = next === "chip";
            aim.current = { ...cur, chip: next === "chip" };
            return true;
          }
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
            send(shotPayload(a));
          } else return false;
          return true;
        }}
        footer={
          v3
            ? () => (
                // golfRev 3: putt or chip, one tap, under the course (never over the tee, the ball or the aim).
                <div data-game-controls="shot" className="flex shrink-0 justify-center px-3 pt-2">
                  <Segmented
                    label="Shot"
                    radio
                    value={shotKind}
                    onChange={(v) => {
                      setShotKind(v);
                      chipRef.current = v === "chip";
                    }}
                    options={[
                      { value: "putt", label: "Putt", data: { "data-shot": "putt" } },
                      { value: "chip", label: "Chip", data: { "data-shot": "chip" } },
                    ]}
                  />
                </div>
              )
            : undefined
        }
        onSubmit={onSubmit}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "minigolf") return null;
  return <MinigolfReveal puzzle={puzzle} answer={myAnswer ?? ""} />;
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
