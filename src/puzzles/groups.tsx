import { useEffect, useMemo, useRef, useState } from "react";
import { shuffled } from "@/lib/duel/random";
import { GROUPS_TIME_MS, type GroupsPuzzleData } from "@/lib/duel/types";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const BAND_CLASSES = ["border-primary/60 bg-primary/15", "border-opponent/60 bg-opponent/15"];

function GroupBand({ theme, words, index = 0 }: { theme: string; words: string[]; index?: number }) {
  return <div className={`w-full rounded-lg border px-2 py-2 text-center ${BAND_CLASSES[index % 2]}`}>
    <p className="font-mono text-[10px] font-bold uppercase tracking-widest">{theme}</p>
    <p className="mt-1 truncate font-display text-xs font-semibold">{words.join(" · ")}</p>
  </div>;
}

function IntroExample() {
  const remaining = ["Ruby", "Coral", "Amber", "Jade"];
  return <div className="flex w-full flex-col items-center gap-3">
    <p className="text-center text-sm text-muted-foreground">Sort the eight words into two groups of four.</p>
    <GroupBand theme="Fruit" words={["Apple", "Cherry", "Banana", "Grape"]} />
    <div className="grid w-full grid-cols-4 gap-1.5">
      {remaining.map((word) => <span key={word} className="flex h-11 min-w-0 items-center justify-center rounded-lg border border-border bg-card px-1 text-center font-display text-[11px] font-bold">{word}</span>)}
    </div>
    <p className="text-center text-xs text-muted-foreground">Find both groups. Some words fit more than one — choose carefully. You have 60 seconds.</p>
  </div>;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, checkGroup }: PuzzleStageProps) {
  const data = puzzle.type === "groups" ? puzzle : null;
  const key = data?.words.join("|") ?? "";
  const [order, setOrder] = useState<number[]>(() => data?.words.map((_, index) => index) ?? []);
  const [selected, setSelected] = useState<number[]>([]);
  const [found, setFound] = useState<{ groupIndex: number; theme: string; indices: number[]; words: string[] }[]>([]);
  const [shaking, setShaking] = useState(false);
  const [checking, setChecking] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    setOrder(data?.words.map((_, index) => index) ?? []);
    setSelected([]); setFound([]); setShaking(false); setChecking(false); submitted.current = false;
  }, [key]);

  const submitFinal = (groups: typeof found) => {
    if (submitted.current) return;
    submitted.current = true;
    onSubmit(groups.map((group) => group.indices.join(",")).join(";"));
  };

  if (!data) return null;
  const foundIndices = new Set(found.flatMap((group) => group.indices));
  const remaining = order.filter((index) => !foundIndices.has(index));

  const tryGroup = async () => {
    if (selected.length !== 4 || checking || !checkGroup) return;
    setChecking(true);
    const verdict = await checkGroup(selected);
    setChecking(false);
    if (!verdict.valid || verdict.groupIndex === undefined || !verdict.theme) {
      setShaking(true); window.setTimeout(() => setShaking(false), 360); return;
    }
    const next = [...found, { groupIndex: verdict.groupIndex, theme: verdict.theme, indices: [...selected], words: selected.map((index) => data.words[index] ?? "") }];
    setFound(next); setSelected([]);
    onDraftAnswer?.(next.map((group) => group.indices.join(",")).join(";"));
    if (next.length === 2) submitFinal(next);
  };

  return <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
    <div className="flex min-h-[112px] flex-col gap-2">
      {found.map((group, index) => <GroupBand key={group.groupIndex} theme={group.theme} words={group.words} index={index} />)}
    </div>
    <div className={`grid grid-cols-4 gap-1.5 ${shaking ? "animate-shake" : ""}`}>
      {remaining.map((index) => {
        const word = data.words[index] ?? "";
        const active = selected.includes(index);
        return <button key={index} type="button" disabled={locked || checking} onClick={() => setSelected((current) => active ? current.filter((value) => value !== index) : current.length < 4 ? [...current, index] : current)} className={`flex h-16 min-w-0 items-center justify-center rounded-lg border px-0.5 text-center font-display text-[clamp(10px,3vw,13px)] font-bold leading-tight ${active ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-foreground"}`}>{word}</button>;
      })}
    </div>
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button type="button" disabled={selected.length !== 4 || checking || locked} onClick={() => void tryGroup()} className="tap-target rounded-xl bg-primary px-4 font-display text-sm font-bold uppercase text-primary-foreground disabled:opacity-35">{checking ? "Checking…" : "Submit"}</button>
      <button type="button" disabled={locked || checking || remaining.length < 2} onClick={() => setOrder((current) => { const movable = shuffled(current.filter((index) => !foundIndices.has(index))); let cursor = 0; return current.map((index) => foundIndices.has(index) ? index : (movable[cursor++] ?? index)); })} className="tap-target rounded-xl border border-border bg-card px-4 font-display text-xs font-bold uppercase text-muted-foreground">Shuffle</button>
    </div>
  </div>;
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "groups" || !puzzle.groups) return null;
  const foundCount = Math.min(2, (myAnswer ?? "").split(";").filter((part) => part.split(",").filter(Boolean).length === 4).length);
  const label = foundCount === 2 ? "Both groups" : foundCount === 1 ? "One group" : "No groups";
  const elapsed = ((GROUPS_TIME_MS - Math.max(0, myMsRemaining ?? 0)) / 1000).toFixed(1);
  return <div className="flex w-full flex-col items-center gap-2">
    {puzzle.groups.map((group, index) => <GroupBand key={group.theme} theme={group.theme} words={group.words} index={index} />)}
    <div className="mt-1 rounded-lg bg-card px-4 py-2 text-center">
      <p className={`font-display text-lg font-bold ${myCorrect ? "text-primary" : "text-warn"}`}>{myCorrect ? "✓" : "✗"} {label}</p>
      <p className="font-mono text-xs text-muted-foreground">{elapsed}s</p>
    </div>
  </div>;
}

export const groupsPuzzle: PuzzleDefinition = {
  key: "groups", name: "Groups", category: "word", timeLimitMs: GROUPS_TIME_MS, revealMs: 8_000,
  generate: () => ({ type: "groups", words: [] }) satisfies GroupsPuzzleData,
  check: () => false, revealHeading: "The groups were", IntroExample, Stage, Reveal,
};
