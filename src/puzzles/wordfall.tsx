import { useEffect, useRef, useState } from "react";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";
import { ENGINE_ARENA_FILL } from "@/lib/arcade/arenaFill.renderer";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import {
  unpackWfLog,
  wordfallCheckpoint,
  WF_CHECKPOINT_INTERVAL,
  WF_ENTER_V2,
  WF_H_V2,
  wfWorldHFor,
  WF_INPUT_ENTER,
  WF_INPUT_TAP,
  WF_PAR,
  WF_W,
  WORDFALL_REV,
  type WordfallState,
} from "@/lib/arcade/wordfall";
import { loadWordfallDict, wordfallDictReady } from "@/lib/arcade/wordfallDict";
import { wordfallArtGameFor, wordfallEarnsShimmer, wordfallShimmerDev, wordfallStartShimmer } from "@/lib/arcade/wordfall.renderer";
import { wordCue } from "@/components/puzzles/wordFinish";
import { TOY_BRASS, TOY_INK, TOY_TABLE } from "@/lib/arcade/toybox.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { WORDFALL_TIME_MS, type WordfallPuzzleData } from "@/lib/duel/types";
import { encodeWordfallRun, replayWordfallRun } from "@/lib/duel/wordfall";
import { playCorrect, playTick, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/**
 * Loads Letterfall's dictionary chunk (only when Letterfall is on screen) and
 * reports when the shared word test is ready. Retries a failed download.
 */
function useWordfallDict(): { ready: boolean; failed: boolean } {
  const [ready, setReady] = useState(wordfallDictReady());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (ready) return;
    let live = true;
    loadWordfallDict().then(
      () => live && setReady(true),
      () => {
        if (!live) return;
        setFailed(true);
        window.setTimeout(() => live && setAttempt((n) => n + 1), 1500);
      },
    );
    return () => {
      live = false;
    };
  }, [ready, attempt]);
  return { ready, failed: failed && !ready };
}

/** Fixed intro: C → A → R → E traced through touching tiles, then the word clears. */
const GRID = ["CAT", "ORE", "PSN"];
const PATH: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 2]];
function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step > PATH.length + 1) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 900 : 650);
    return () => window.clearTimeout(id);
  }, [step]);
  const picked = PATH.slice(0, Math.min(step, PATH.length));
  const cleared = step > PATH.length;
  const at = (r: number, c: number) => ({ x: 8 + c * 40, y: 44 + r * 40 });
  const word = picked.map(([r, c]) => GRID[r]![c]).join("");
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 136 172" width={136} height={172} aria-hidden="true" style={{ background: TOY_TABLE, borderRadius: 10 }}>
        <rect x={8} y={6} width={120} height={30} rx={8} fill="#3E2716" />
        <text x={68} y={27} textAnchor="middle" fontFamily="Fredoka, Nunito, sans-serif" fontWeight={700} fontSize={18} fill={cleared ? "#F7CF63" : "#FFF4DE"}>
          {cleared ? "CARE!" : word || "TAP"}
        </text>
        <rect x={6} y={42} width={124} height={124} rx={6} fill="#C99A62" />
        {GRID.flatMap((row, r) =>
          [...row].map((letter, c) => {
            const p = at(r, c);
            const inPath = PATH.slice(0, picked.length).some(([pr, pc]) => pr === r && pc === c);
            if (cleared && PATH.some(([pr, pc]) => pr === r && pc === c)) return null;
            return (
              <g key={`${r}${c}`}>
                <rect x={p.x + 1} y={p.y + 1} width={38} height={38} rx={7} fill={inPath ? "#F7CF63" : "#F4E4C3"} stroke={inPath ? "#8A6420" : "#B48A55"} strokeWidth={1.5} />
                <text x={p.x + 20} y={p.y + 27} textAnchor="middle" fontFamily="Fredoka, Nunito, sans-serif" fontWeight={700} fontSize={20} fill={TOY_INK}>
                  {letter}
                </text>
              </g>
            );
          }),
        )}
        {!cleared && picked.length > 1 ? (
          <polyline
            points={picked.map(([r, c]) => `${at(r, c).x + 20},${at(r, c).y + 20}`).join(" ")}
            fill="none"
            stroke={TOY_BRASS}
            strokeOpacity={0.6}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
      <p className="text-center text-xs text-muted-foreground">Touching tiles in any direction. Tap the last one again to submit.</p>
    </div>
  );
}

const LOG_NAMES: Record<number, string> = { 1: "pick", 2: "miss", 3: "word", 4: "bad", 5: "drop", 6: "full" };

/** Sounds plus the ?dev=1 line (points, par, checkpoints), read from the sim after each frame. */
function observer(setDev: (line: string | null) => void) {
  return () => {
    const dev = devDiagnosticsOn();
    let seen: { tick: number; words: number; invalid: number; chain: number; over: number } | null = null;
    let lastDev = -1;
    let shimmered = false;
    return {
      frame: (s: WordfallState, running: boolean) => {
        // The renderer starts the end-of-run shimmer on this same frame.
        if (!shimmered && wordfallEarnsShimmer(s)) {
          shimmered = true;
          wordfallStartShimmer(s);
          wordCue("wordfall.finish");
        }
        if (seen && s.tick >= seen.tick && running) {
          if (s.words > seen.words) playCorrect();
          else if (s.invalid > seen.invalid || (s.over && !seen.over)) playWrong();
          else if (s.chain.length > seen.chain) playTick(0.6);
        }
        seen = { tick: s.tick, words: s.words, invalid: s.invalid, chain: s.chain.length, over: s.over };
        if (!dev || s.tick === lastDev || s.tick % 6 !== 0) return;
        lastDev = s.tick;
        const log = s.log.slice(-5).map((e) => {
          const u = unpackWfLog(e);
          return `${u.tick}:${LOG_NAMES[u.code] ?? u.code}${u.extra}`;
        }).join(" ");
        const now = wordfallCheckpoint(s);
        setDev(
          `tick ${s.tick} · points ${s.points} / par ${WF_PAR} · words ${s.words} · bad ${s.invalid} · drops ${s.drops}\n` +
            `checkpoints ${Math.floor(s.tick / WF_CHECKPOINT_INTERVAL)} (every ${WF_CHECKPOINT_INTERVAL} ticks) · now #${now.checksum.toString(16)} · ${log}`,
        );
      },
      stop: () => {},
    };
  };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: WordfallPuzzleData | null = puzzle.type === "wordfall" ? puzzle : null;
  const rev = data?.wordfallRev;
  const dict = useWordfallDict();
  const [dev, setDev] = useState<string | null>(null);
  const [sounds] = useState(() => observer(setDev));
  // The stage's input sender (handed to footer each render), so the rev-2 Enter button can use it.
  const sendRef = useRef<((payload: PointerPayload) => void) | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onDev = () => {
      wordfallShimmerDev();
      wordCue("wordfall.finish");
    };
    window.addEventListener("duelz-dev-word-finish", onDev);
    return () => window.removeEventListener("duelz-dev-word-finish", onDev);
  }, []);
  return (
    <ArcadeCanvasStage
      diagKey="wordfall"
      label={`${gameDisplayName("wordfall")} well`}
      background="transparent"
      arenaBackground={ENGINE_ARENA_FILL.wordfall}
      fitWorld
      seed={data?.seed ?? 1}
      enabled={data !== null && dict.ready}
      locked={locked}
      worldW={WF_W}
      worldH={wfWorldHFor(rev)}
      game={wordfallArtGameFor(rev)}
      sounds={sounds}
      checkpoint={wordfallCheckpoint}
      interval={WF_CHECKPOINT_INTERVAL}
      encodeRun={(run) => encodeWordfallRun(run, rev)}
      discrete
      inputKind={WF_INPUT_TAP}
      overlay={
        <>
          {rev === 2 ? (
            // wordfallRev 2: a real button over the drawn Enter box for keyboards and screen readers. It takes no
            // touches (pointer-events none: a finger still taps the canvas exactly as before) and, when activated,
            // sends the same tap a finger on the box's centre sends, so the input log and replays are unchanged.
            <button
              type="button"
              aria-label="Enter word"
              data-wordfall-enter=""
              disabled={locked || !dict.ready}
              className="pointer-events-none absolute rounded-xl bg-transparent outline-none focus-visible:ring-4 focus-visible:ring-ring"
              style={{
                left: `${(WF_ENTER_V2.x / WF_W) * 100}%`,
                top: `${(WF_ENTER_V2.y / WF_H_V2) * 100}%`,
                width: `${(WF_ENTER_V2.w / WF_W) * 100}%`,
                height: `${(WF_ENTER_V2.h / WF_H_V2) * 100}%`,
              }}
              onClick={() => sendRef.current?.({ k: WF_INPUT_TAP, a: WF_ENTER_V2.x + WF_ENTER_V2.w / 2, b: WF_ENTER_V2.y + WF_ENTER_V2.h / 2, c: 0 })}
            />
          ) : null}
          {dict.ready ? null : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-lg bg-background/80 px-3 py-2 font-mono text-sm text-foreground">
                {dict.failed ? "Couldn't load the words - retrying…" : "Loading words…"}
              </p>
            </div>
          )}
        </>
      }
      footer={(send) => {
        sendRef.current = send;
        return rev === 2 ? (
        // wordfallRev 2: Enter is the box drawn in the world under the well (the sim's tap box).
        dev ? <p className="shrink-0 whitespace-pre-wrap break-all pt-1 text-center font-mono text-[10px] text-muted-foreground">{dev}</p> : null
      ) : (
        <div data-game-controls="enter" className="flex shrink-0 flex-col items-center gap-1 pt-1">
          <ArcadeControlButton
            type="button"
            aria-label="Enter word"
            disabled={locked || !dict.ready}
            className="h-12 w-full max-w-[260px] text-lg font-bold uppercase tracking-widest before:content-['Enter']"
            onPressStart={() => send({ k: WF_INPUT_ENTER, a: 0, b: 0, c: 0 })}
          />
          {dev ? <p className="whitespace-pre-wrap break-all text-center font-mono text-[10px] text-muted-foreground">{dev}</p> : null}
        </div>
        );
      }}
      pointer={(kind, x, y) => (kind === "down" ? { k: WF_INPUT_TAP, a: x, b: y, c: 0 } : null)}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const dict = useWordfallDict();
  if (puzzle.type !== "wordfall") return null;
  if (!dict.ready) return <p className="text-center font-mono text-base text-muted-foreground">Loading words…</p>;
  const result = replayWordfallRun(puzzle.seed, myAnswer ?? "", puzzle.wordfallRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.words} word{result.words === 1 ? "" : "s"} · {result.points} / {result.par} points
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.best.length ? `Best: ${result.best.join(", ")}` : "No words found"}
      </p>
    </div>
  );
}

/** The letter queue comes from the round's seed; the run is replayed on the server. */
export const wordfallPuzzle: PuzzleDefinition = {
  key: "wordfall",
  name: gameDisplayName("wordfall"),
  category: "word",
  arcadeRun: true,
  timeLimitMs: WORDFALL_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "wordfall", seed: 1, wordfallRev: WORDFALL_REV, speedPar: 1 }) satisfies WordfallPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
