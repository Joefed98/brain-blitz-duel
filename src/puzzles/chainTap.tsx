import { gameDisplayName } from "@/lib/duel/gameNames";
import { useCallback, useEffect, useRef, useState } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { fireChainFinish } from "@/components/puzzles/chainFx";
import { hapticTick, pointerElementIndex } from "@/components/puzzles/GridDrag";
import { registerFxPreview } from "@/components/puzzles/speedFx";
import {
  chainBoardIndex,
  chainRules,
  chainCycleAt,
  chainCycleIndex,
  chainLongCycles,
  chainRequiredAt,
  chainReversedAt,
  chainTapVerdict,
  chainWindowMs,
  decodeChainAnswer,
  encodeChainAnswer,
  replayChain,
  type ChainTap,
} from "@/lib/duel/chain";
import { useStageState } from "@/lib/duel/stageState";
import {
  CHAIN_BLOCK,
  CHAIN_REVERSE_AT,
  CHAIN_REVERSE_WARN_AT,
  CHAIN_TIME_MS,
  CHAIN_WARN_MS,
  type ChainBreak,
  type ChainNode,
  type ChainPuzzleData,
  type ChainRuleItem,
  type ChainShape,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCueSlot, playTick, playTone } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const NODE = 34;
/** Delay between a break and the submit, so the snap can be seen. */
const BREAK_HOLD_MS = 1_000;
const CYCLE_HIGHLIGHT_MS = 650;

/**
 * Shared gradients for the charms and links (Polish, 13 Oct 2026; display only). Rendered
 * once per screen; every charm and link references them by id.
 */
function ChainDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="pointer-events-none absolute">
      <defs>
        <radialGradient id="chainz-enamel" cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.78" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
        <linearGradient id="chainz-bezel" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#FBFCFD" />
          <stop offset="0.45" stopColor="#9AA2AC" />
          <stop offset="0.7" stopColor="#5E6670" />
          <stop offset="1" stopColor="#D9DEE4" />
        </linearGradient>
        <linearGradient id="chainz-link-metal" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="12">
          <stop offset="0" stopColor="#FFF1C2" />
          <stop offset="0.35" stopColor="var(--chain-link)" />
          <stop offset="0.72" stopColor="var(--chain-link-dark)" />
          <stop offset="1" stopColor="#FFD978" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Enamel charm in a silver bezel: same shape, colour and footprint as before, with
 * depth shading (needs <ChainDefs /> on the screen; without it only the shading drops).
 */
function NodeGlyph({ shape, size, colour }: { shape: ChainShape; size: number; colour?: string }) {
  const inner = Math.round(size * 0.74);
  const bezel = { fill: "none", stroke: "url(#chainz-bezel)", strokeWidth: 1.3, strokeLinejoin: "round" as const };
  return (
    <svg width={inner} height={inner} viewBox="0 0 24 24" aria-hidden="true" className="chain-charm" style={colour ? { color: colour } : undefined}>
      {shape === "circle" && <circle cx="12" cy="12" r="10" fill="currentColor" />}
      {shape === "square" && <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" />}
      {shape === "triangle" && <path d="M12 2 22.4 20.6a1 1 0 0 1-.9 1.4H2.5a1 1 0 0 1-.9-1.4Z" fill="currentColor" />}
      {shape === "circle" && <circle cx="12" cy="12" r="10" fill="url(#chainz-enamel)" />}
      {shape === "square" && <rect x="2" y="2" width="20" height="20" rx="4" fill="url(#chainz-enamel)" />}
      {shape === "triangle" && <path d="M12 2 22.4 20.6a1 1 0 0 1-.9 1.4H2.5a1 1 0 0 1-.9-1.4Z" fill="url(#chainz-enamel)" />}
      {shape === "circle" && <circle cx="12" cy="12" r="10" {...bezel} />}
      {shape === "square" && <rect x="2" y="2" width="20" height="20" rx="4" {...bezel} />}
      {shape === "triangle" && <path d="M12 2 22.4 20.6a1 1 0 0 1-.9 1.4H2.5a1 1 0 0 1-.9-1.4Z" {...bezel} />}
      {shape === "circle" && <ellipse cx="9" cy="8" rx="4.2" ry="2.6" fill="var(--charm-shine)" transform="rotate(-25 9 8)" />}
      {shape === "square" && <rect x="5" y="4.5" width="9" height="4" rx="2" fill="var(--charm-shine)" />}
      {shape === "triangle" && <ellipse cx="10.5" cy="12" rx="2" ry="3.4" fill="var(--charm-shine)" transform="rotate(28 10.5 12)" />}
    </svg>
  );
}

/** The chain grows one link per correct tap; a break makes it strain red. */
function ChainLinks({ links, total, broken }: { links: number; total: number; broken: boolean }) {
  const w = 10;
  return (
    <svg key={broken ? "broken" : "ok"} data-chain-links="" className={`chain-links h-3.5 w-full shrink-0 ${broken ? "chain-strain" : ""}`} viewBox={`0 0 ${total * w + 4} 14`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const made = i < links;
        const x = 2 + i * w;
        const stroke = broken && made ? "var(--color-warn)" : made ? "url(#chainz-link-metal)" : "var(--color-border)";
        return i % 2 === 0
          ? <rect key={i} x={x} y={3} width={w + 3} height={8} rx={4} fill="none" stroke={stroke} strokeWidth={made ? 2 : 1.2} />
          : <line key={i} x1={x + 1} y1={7} x2={x + w + 2} y2={7} stroke={stroke} strokeWidth={made ? 2.4 : 1.2} strokeLinecap="round" />;
      })}
    </svg>
  );
}

/**
 * The link preview. Three-symbol cycles repeat (↺); chainCycleRev 1 shows all five
 * charms of the board, and on the reversed board the arrows point back (←) and the
 * highlight walks from the last charm to the first. `active` is the cycle index the
 * next tap needs.
 */
function RuleStrip({ cycle, active, compact, highlight = false, reversed = false }: { cycle: ChainRuleItem[]; active: number; compact?: boolean; highlight?: boolean; reversed?: boolean }) {
  const long = cycle.length > 3;
  const size = compact ? 24 : long ? 28 : 32;
  const arrow = reversed ? "←" : "→";
  return (
    <div data-chain-preview={long ? "five" : "three"} data-chain-reversed={reversed ? "" : undefined} className={`flex shrink-0 items-center justify-center ${long ? "gap-1" : "gap-1.5"} rounded-md transition-colors duration-150 motion-reduce:transition-none ${highlight ? "bg-primary/20 ring-2 ring-primary" : reversed ? "bg-warn/15 ring-2 ring-warn" : "bg-transparent"}`} aria-label={long ? (reversed ? "Link preview, reversed" : "Link preview") : "Repeating rule"}>
      {cycle.map((item, index) => (
        <span key={`${item.shape}-${item.colour}`} className={`flex items-center ${long ? "gap-1" : "gap-1.5"}`}>
          {reversed && index > 0 && <span className="font-mono text-xs text-warn">{arrow}</span>}
          <span
            className={`flex items-center justify-center rounded-md border-2 transition-transform ${
              index === active ? `scale-110 ${reversed ? "border-warn" : "border-primary"}` : "border-transparent opacity-60"
            }`}
            style={{ width: size + 6, height: size + 6 }}
          >
            <NodeGlyph shape={item.shape} colour={GLYPH_COLOURS[item.colour]} size={size} />
          </span>
          {!reversed && (!long || index < cycle.length - 1) && <span className="font-mono text-xs text-muted-foreground">{arrow}</span>}
        </span>
      ))}
      {!long && <span className="font-mono text-xs text-muted-foreground">↺</span>}
    </div>
  );
}

/** Gold ring that drains clockwise; `left` is the remaining share 0–1. */
function MomentumRing({ left, size, warn }: { left: number; size: number; warn?: boolean }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="pointer-events-none absolute -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={warn ? "var(--color-warn)" : GLYPH_COLOURS.GOLD}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, left)))}
      />
    </svg>
  );
}

const EXAMPLE_CYCLE: ChainRuleItem[] = [
  { shape: "circle", colour: "RED" },
  { shape: "square", colour: "BLUE" },
  { shape: "triangle", colour: "GREEN" },
  { shape: "circle", colour: "YELLOW" },
  { shape: "square", colour: "RED" },
];

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <ChainDefs />
      <RuleStrip cycle={EXAMPLE_CYCLE} active={2} compact />
      <div className="relative h-20 w-full max-w-[240px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="15" y1="60" x2="45" y2="35" stroke={GLYPH_COLOURS.GOLD} strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="absolute flex size-10 items-center justify-center" style={{ left: "calc(15% - 20px)", top: "calc(60% - 20px)" }}>
          <NodeGlyph shape="circle" colour={GLYPH_COLOURS.RED} size={32} />
        </span>
        <span className="absolute flex size-12 items-center justify-center" style={{ left: "calc(45% - 24px)", top: "calc(35% - 24px)" }}>
          <MomentumRing left={0.6} size={48} />
          <NodeGlyph shape="square" colour={GLYPH_COLOURS.BLUE} size={32} />
        </span>
        <span className="absolute flex size-10 items-center justify-center" style={{ left: "calc(75% - 20px)", top: "calc(62% - 20px)" }}>
          <NodeGlyph shape="triangle" colour={GLYPH_COLOURS.GREEN} size={32} />
        </span>
        <span className="absolute flex size-10 items-center justify-center opacity-80" style={{ left: "calc(90% - 20px)", top: "calc(22% - 20px)" }}>
          <NodeGlyph shape="triangle" colour={GLYPH_COLOURS.YELLOW} size={32} />
        </span>
      </div>
      <p className="text-center font-mono text-[11px] text-muted-foreground">
        Tap the green triangle charm before the ring empties - not the yellow one. Each right tap adds a link.
      </p>
    </div>
  );
}

function ChainLine({ nodes, path, broken }: { nodes: ChainNode[]; path: number[]; broken: boolean }) {
  const points = path
    .map((id) => nodes[id])
    .filter((node): node is ChainNode => Boolean(node));
  if (points.length < 2) return null;
  const colour = broken ? "var(--color-warn)" : GLYPH_COLOURS.GOLD;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full transition-all duration-700 ease-in"
      style={broken ? { transform: "translateY(60%) rotate(6deg)", opacity: 0, transitionDelay: "250ms" } : undefined}
      aria-hidden="true"
    >
      <g style={{ filter: `drop-shadow(0 0 4px ${colour})` }}>
        {points.slice(1).map((to, index) => {
          const from = points[index]!;
          const line = { x1: `${from.x}%`, y1: `${from.y}%`, x2: `${to.x}%`, y2: `${to.y}%`, strokeLinecap: "round" as const };
          return (
            <g key={index}>
              <line {...line} stroke={broken ? colour : "var(--chain-link-dark)"} strokeWidth={6} style={{ transition: "stroke 120ms" }} />
              <line {...line} stroke={colour} strokeWidth={4} strokeDasharray="7 4" style={{ transition: "stroke 120ms" }} />
              {!broken && <line {...line} stroke="#FFF1C2" strokeOpacity={0.75} strokeWidth={1.2} strokeDasharray="5 6" strokeDashoffset={-1} />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, phaseStartedAt, stateKey = "chain" }: PuzzleStageProps) {
  const data: ChainPuzzleData | null = puzzle.type === "chain" ? puzzle : null;
  const [taps, setTaps] = useStageState<ChainTap[]>(stateKey, "chainTaps2", () => []);
  const [ended, setEnded] = useStageState<ChainBreak | null>(stateKey, "chainEnded", () => null);
  const [clock, setClock] = useState(() => Date.now() - phaseStartedAt);
  const [pulse, setPulse] = useState<number | null>(null);
  const [faster, setFaster] = useState(false);
  const [reverseFlash, setReverseFlash] = useState(false);
  const submitted = useRef(false);
  const warned = useRef("");
  const rootRef = useRef<HTMLDivElement>(null);
  /** Latest board path (arena %) and length, for the dev effect preview only. */
  const previewRef = useRef<{ path: { x: number; y: number }[]; length: number }>({ path: [], length: 0 });
  useEffect(() => registerFxPreview("chain", () => fireChainFinish(rootRef.current, previewRef.current.path, previewRef.current.length)), []);

  const replay = data ? replayChain(data, { taps, reason: ended ?? "timer" }) : null;
  const encoded = encodeChainAnswer({ taps, reason: ended ?? "timer" });

  useEffect(() => onDraftAnswer?.(encoded), [encoded, onDraftAnswer]);

  const finish = useCallback(
    (reason: ChainBreak, nextTaps: ChainTap[]) => {
      if (submitted.current) return;
      submitted.current = true;
      setEnded(reason);
      const answer = encodeChainAnswer({ taps: nextTaps, reason });
      onDraftAnswer?.(answer);
      if (reason === "complete") onSubmit(answer);
      else {
        buzz([40, 30, 60]);
        // A recorded file on chain.breakTone replaces the placeholder tone.
        if (!playCueSlot("chain.breakTone")) playTone(220, 380, "sawtooth", 0.3, 70);
        setTimeout(() => onSubmit(answer), BREAK_HOLD_MS);
      }
    },
    [onDraftAnswer, onSubmit, setEnded],
  );

  // Clock, momentum drain and the warning tick.
  useEffect(() => {
    if (!replay || ended || locked) return;
    let frame = 0;
    const loop = () => {
      const t = Date.now() - phaseStartedAt;
      setClock(t);
      if (replay.lastT !== null) {
        const windowMs = chainWindowMs(replay.links + 1, data ?? undefined);
        const left = windowMs - (t - replay.lastT);
        if (left <= 0) {
          finish("momentum", taps);
          return;
        }
        const key = left <= CHAIN_WARN_MS / 2 ? `${replay.links}b` : left <= CHAIN_WARN_MS ? `${replay.links}a` : "";
        if (key && warned.current !== key) {
          warned.current = key;
          playTick(0.35);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [replay?.lastT, replay?.links, ended, locked, phaseStartedAt, finish, taps]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !replay) return null;
  const links = replay.links;
  const rules = chainRules(data);
  const boardIndex = chainBoardIndex(links, data);
  const board = data.boards[boardIndex] ?? [];
  const used = new Set(replay.used[boardIndex] ?? []);
  const path = replay.used[boardIndex] ?? [];
  const broken = ended === "wrong" || ended === "momentum";
  const over = Boolean(ended) || locked;
  // The ring sits on the last linked node; after a reshuffle it follows that slot.
  const lastSlot = replay.used[chainBoardIndex(Math.max(0, links - 1), data)]?.at(-1) ?? null;
  const windowMs = chainWindowMs(links + 1, data);
  const left = replay.lastT === null ? 1 : (windowMs - (clock - replay.lastT)) / windowMs;
  const tier = links >= (rules.fasterAt[1] ?? Infinity) ? 2 : links >= (rules.fasterAt[0] ?? Infinity) ? 1 : 0;
  previewRef.current = {
    path: (path.length >= 2 ? path.map((id) => board[id]) : board.slice(0, CHAIN_BLOCK)).filter((n): n is ChainNode => Boolean(n)),
    length: rules.length,
  };

  const tap = (nodeId: number) => {
    if (over) return;
    const t = Math.max(0, Math.round(Date.now() - phaseStartedAt));
    const next = { node: nodeId, t };
    const verdict = chainTapVerdict(data, replay, next);
    const nextTaps = [...taps, next];
    setTaps(nextTaps);
    if (verdict !== "ok") {
      finish(verdict, nextTaps);
      return;
    }
    hapticTick();
    // Pitch climbs a semitone per link (a recorded chain.linkTone climbs the same way).
    const climb = Math.pow(2, links / 12);
    if (!playCueSlot("chain.linkTone", 1, climb)) playTone(440 * climb, 110, "triangle", 0.22);
    setPulse(nodeId);
    setTimeout(() => setPulse((current) => (current === nodeId ? null : current)), 180);
    const made = links + 1;
    if (rules.fasterAt.includes(made)) {
      setFaster(true);
      setTimeout(() => setFaster(false), 900);
    }
    if (chainLongCycles(data ?? undefined) && made === CHAIN_REVERSE_AT) {
      setReverseFlash(true);
      setTimeout(() => setReverseFlash(false), 1_100);
    }
    if (made >= rules.length) {
      // Finish effect fires synchronously, then the chain is submitted exactly as before.
      const finalPath = [...path, nodeId].map((id) => board[id]).filter((n): n is ChainNode => Boolean(n));
      fireChainFinish(rootRef.current, finalPath, rules.length);
      finish("complete", nextTaps);
    }
  };

   const cycle = chainCycleAt(data, links);
   const need = chainRequiredAt(data, links);
   const reversed = chainReversedAt(data, links) && !over;
   // chainCycleRev 1: the warning banner before the reversed board, then a reverse flash as it starts.
   const reverseSoon = chainLongCycles(data) && !over && links >= CHAIN_REVERSE_WARN_AT && links < CHAIN_REVERSE_AT;
   const changedAt = taps[boardIndex * CHAIN_BLOCK - 1]?.t;
   const cycleHighlight = boardIndex > 0 && changedAt !== undefined && clock - changedAt < CYCLE_HIGHLIGHT_MS && !over;

  return (
    <div
      ref={rootRef}
      data-polish="chain"
      data-stage-column="1.5" className={`relative flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl pt-3 transition-colors duration-500 ${
        tier === 2 ? "bg-warn/10" : tier === 1 ? "bg-primary/10" : ""
      }`}
    >
      <ChainDefs />
      <RuleStrip cycle={cycle} active={chainCycleIndex(data, links)} highlight={cycleHighlight && !reversed} reversed={reversed} />
      {(reverseSoon || reversed) && (
        <p data-chain-reverse-banner={reversed ? "on" : "soon"} role="status" className={`chain-reverse-banner mx-auto shrink-0 rounded-full px-3 py-0.5 text-center font-display text-sm font-black uppercase tracking-widest ${reversed ? "bg-warn text-background" : "bg-warn/20 text-warn"}`}>
          {reversed ? "← Reversed: last to first" : `Reverse after link ${CHAIN_REVERSE_AT}!`}
        </p>
      )}
      <p className="shrink-0 text-center font-mono text-3xl font-bold leading-none tabular-nums">
        <span key={links} className={`inline-block ${links > 0 ? "animate-scale-in" : ""} text-primary`}>
          {links}
        </span>
        <span className="text-muted-foreground"> / {rules.length}</span>
      </p>
      <ChainLinks links={links} total={rules.length} broken={broken} />
      <div data-play-area data-game-arena="tall" className={`relative min-h-0 w-full flex-1 ${broken ? "animate-shake" : ""}`}>
        <ChainLine nodes={board} path={path} broken={broken} />
        {board.map((node, index) => {
          const isUsed = used.has(index);
          const ringed = index === lastSlot && !over && replay.lastT !== null;
          return (
            <button
              key={index}
              type="button"
              disabled={over || isUsed}
              aria-label={`${node.colour.toLowerCase()} ${node.shape}`}
              data-pointer-index={index}
              onPointerDown={(event) => {
                event.preventDefault();
                const hit = pointerElementIndex(event.currentTarget);
                if (hit !== null) tap(hit);
              }}
              className={`absolute flex items-center justify-center rounded-full border-0 bg-transparent p-0 [-webkit-tap-highlight-color:transparent] ${
                isUsed && !ringed ? "opacity-35" : ""
              } ${pulse === index ? "scale-125" : "scale-100"}`}
              style={{
                width: NODE + 10,
                height: NODE + 10,
                left: `calc(${node.x}% - ${(NODE + 10) / 2}px)`,
                top: `calc(${node.y}% - ${(NODE + 10) / 2}px)`,
                transition: "left 150ms ease-out, top 150ms ease-out, transform 150ms ease-out, opacity 150ms",
              }}
            >
              {ringed && <MomentumRing left={left} size={NODE + 10} warn={left * windowMs <= CHAIN_WARN_MS} />}
              <NodeGlyph shape={node.shape} colour={GLYPH_COLOURS[node.colour]} size={NODE} />
            </button>
          );
        })}
        {reverseFlash && !over && (
          <div data-chain-reverse-flash="" className="pointer-events-none absolute inset-x-0 top-1/3 z-10 text-center font-display text-4xl font-black tracking-widest text-warn animate-scale-in">
            ← REVERSE
          </div>
        )}
        {faster && !over && !reverseFlash && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-4xl font-black tracking-widest text-primary animate-scale-in">
            FASTER
          </div>
        )}
        {broken && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border-2 border-warn bg-background/90 px-4 py-3 text-center animate-scale-in">
              <p className="font-display text-2xl font-black uppercase tracking-wider text-warn">Chain broken</p>
              <p className="font-mono text-sm text-foreground">
                at link {links + 1} · {ended === "momentum" ? "too slow" : "wrong tap"}
              </p>
            </div>
          </div>
        )}
      </div>
      {need && !over && (
        <span className="sr-only">
          Next: {need.colour.toLowerCase()} {need.shape}
        </span>
      )}
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "chain") return null;
  const answer = decodeChainAnswer(myAnswer ?? "");
  const replay = replayChain(puzzle, answer);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;
  const ending =
    replay.reason === "complete"
      ? "Full chain"
      : replay.reason === "wrong"
        ? `Broken at link ${replay.links + 1} - wrong tap`
        : replay.reason === "momentum"
          ? `Broken at link ${replay.links + 1} - too slow`
          : "Time ran out";
  return (
    <div data-polish-reveal="chain" className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2">
      <ChainDefs />
      <p className="font-mono text-3xl font-bold">
        {replay.links} / {chainRules(puzzle).length}
      </p>
      <div className="w-full max-w-[320px]">
        <ChainLinks links={replay.links} total={chainRules(puzzle).length} broken={replay.reason === "wrong" || replay.reason === "momentum"} />
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-sm">
        {ending}
        {elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
      </p>
    </div>
  );
}

export const chainTapPuzzle: PuzzleDefinition = {
  key: "chain",
  name: gameDisplayName("chain"),
  category: "speed",
  timeLimitMs: CHAIN_TIME_MS,
  revealMs: 5_000,
  generate: () => ({ type: "chain", cycle: [], boards: [] }) satisfies ChainPuzzleData,
  check: () => false,
  revealHeading: "Your chain",
  IntroExample,
  Stage,
  Reveal,
};
