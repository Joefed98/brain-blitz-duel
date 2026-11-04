import { useContext, useEffect, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { useGameKeys } from "@/lib/desktop";
import { GoalLineContext } from "@/components/duel/GameFrame";
import { HudPills } from "@/components/puzzles/HudPills";
import { FitLine, useFitOneLine } from "@/components/puzzles/useFitOneLine";
import { wrongMoveFlash } from "@/lib/fx/gameToolkit";
import { StageProgress } from "@/components/puzzles/StageProgress";
import { StageCorrect, useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import { useStageState } from "@/lib/duel/stageState";
import { equationTryLimit, joinCountSuffix, limitText, splitCountSuffix } from "@/lib/duel/moveLimits";
import { joinStages, splitStages } from "@/lib/duel/stagedRounds";
import { gapSlots, gapStageCorrect, gapStageFull, joinGapSegment, splitGapSegment, type GapSlot } from "@/lib/duel/operatorGaps";
import type { EquationPuzzleData, EquationStage, Operator } from "@/lib/duel/types";
import type { PuzzleRevealProps, PuzzleStageProps } from "./types";
import "@/polish-layout/operator-gaps.css";

/**
 * Operator's gaps (puzzle polish, 3 Nov 2026; rules in src/lib/duel/operatorGaps.ts): equation 1 takes signs, 2 takes
 * numbers from a tray, 3 and 4 mix both. Sign gaps are gold circles, number gaps teal squares, everywhere (play, intro,
 * reveal). A sign key fills the leftmost empty sign gap, a tray number the leftmost empty number gap; tapping a filled
 * gap empties it (its number goes back to the tray). Every full fill is a try (as before).
 */

const SIGN_KEYS: readonly Operator[] = ["+", "-", "×", "÷"];
const EQ_PX = 32;
const EQ_FRAME_PX = 44;
const EQ_MIN_PX = 13;

export function signText(op: string): string {
  return op === "-" ? "−" : op;
}

/** Which tray chips the fills use (by index; a value fills the first unused chip holding it). */
function usedChips(tray: readonly number[], slots: readonly GapSlot[], fills: readonly (string | null)[]): boolean[] {
  const used = tray.map(() => false);
  slots.forEach((s, k) => {
    const f = fills[k];
    if (s.kind !== "number" || !f) return;
    const at = tray.findIndex((v, i) => !used[i] && String(v) === f);
    if (at >= 0) used[at] = true;
  });
  return used;
}

/** One equation drawn left to right: given numbers and signs as text, gaps as their marked shapes. */
function GapLine({ stage, fills, onGap, nextGap, fresh, mark }: {
  stage: EquationStage;
  fills: readonly (string | null)[];
  onGap?: ((k: number) => void) | undefined;
  nextGap?: number;
  fresh?: number | null;
  /** Reveal: colour the filled gaps as right ("ok") or wrong ("bad"). */
  mark?: "ok" | "bad";
}) {
  const slots = gapSlots(stage);
  const at = (kind: GapSlot["kind"], index: number) => slots.findIndex((s) => s.kind === kind && s.index === index);
  const gap = (k: number) => {
    const slot = slots[k]!;
    const value = fills[k] ?? null;
    return (
      <button
        key={`g${k}`}
        type="button"
        className="opg-gap"
        data-kind={slot.kind}
        data-filled={value ? "true" : undefined}
        data-next={nextGap === k ? "true" : undefined}
        data-mark={mark}
        disabled={!onGap}
        onClick={onGap ? () => onGap(k) : undefined}
        aria-label={value ? `${slot.kind === "sign" ? "Sign" : "Number"} ${signText(value)}, tap to clear` : slot.kind === "sign" ? "Empty sign gap" : "Empty number gap"}
      >
        {value ? <span className="opg-fill" data-drop={fresh === k ? "true" : undefined}>{signText(value)}</span> : <span className="opg-hint" aria-hidden="true">{slot.kind === "sign" ? "±" : "#"}</span>}
      </button>
    );
  };
  return (
    <>
      {stage.numbers.map((n, i) => {
        const nk = at("number", i);
        const sk = at("sign", i);
        return (
          <span key={i} className="opg-term">
            {nk >= 0 ? gap(nk) : <span className="opg-num">{n}</span>}
            {i < stage.numbers.length - 1 ? (sk >= 0 ? gap(sk) : <span className="opg-sign">{signText(stage.signs?.[i] ?? "")}</span>) : null}
          </span>
        );
      })}
      <span className="opg-goal">= {stage.target}</span>
    </>
  );
}

export function GapsStage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "equation" }: PuzzleStageProps) {
  const column = useGameColumnLayout();
  const inFrame = useContext(GoalLineContext) !== null;
  const data = puzzle.type === "equation" ? (puzzle as EquationPuzzleData) : null;
  const total = data?.stages.length ?? 4;
  const [stage, setStage] = useStageState<number>(stateKey, "gapStage", () => 0);
  const [answers, setAnswers] = useStageState<string[]>(stateKey, "gapAnswers", () => Array.from({ length: total }, () => ""));
  const [fills, setFills] = useStageState<(string | null)[]>(stateKey, "gapFills", () => Array(data?.stages[0] ? gapSlots(data.stages[0]).length : 0).fill(null));
  const tryLimit = data ? equationTryLimit(data) : null;
  const [tries, setTries] = useStageState<number[]>(stateKey, "gapTries", () => Array.from({ length: total }, () => 0));
  const done = useRef(false);
  const [fresh, setFresh] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);
  const [finale, setFinale] = useState<string[] | null>(null);
  const finaleOn = useSolveFx(finale !== null, "equation.solve", 1200);

  const current = data?.stages[Math.min(stage, total - 1)];
  const slots = current ? gapSlots(current) : [];
  const segment = joinGapSegment(fills);
  const liveAnswers = answers.map((a, i) => (i === stage ? segment : a));
  const draft = tryLimit !== null ? joinCountSuffix(joinStages(liveAnswers, total), tries) : joinStages(liveAnswers, total);
  const complete = !!current && gapStageCorrect(current, segment);
  const triesUsed = tries[stage] ?? 0;
  const outOfTries = tryLimit !== null && !complete && triesUsed >= tryLimit;
  const holding = useStageCorrectHold({
    complete,
    finalStage: stage >= total - 1,
    locked: locked || done.current,
    stateKey,
    onAdvance: () => advance(segment),
  });
  useEffect(() => {
    onDraftAnswer?.(draft);
  }, [draft, onDraftAnswer]);
  useEffect(() => {
    if (holding) soundCue("equation.correct");
  }, [holding]);

  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  useFitOneLine(box, line, inFrame ? EQ_FRAME_PX : EQ_PX, EQ_MIN_PX, `${stage}:${current?.numbers.join(",")}=${current?.target}`);

  // Desktop: + − × ÷ (also - * x /) fill the next sign gap; digits type a tray number (it goes in as soon as no other
  // tray number starts with what was typed, or after a short pause); Backspace empties the last filled gap; Enter = Next.
  const typed = useRef<{ text: string; timer: ReturnType<typeof setTimeout> | null }>({ text: "", timer: null });
  useEffect(() => () => {
    if (typed.current.timer) clearTimeout(typed.current.timer);
  }, []);

  const frozen = locked || done.current || holding;
  const keysFrozen = frozen || outOfTries;
  const tray = current?.tray ?? [];
  const used = usedChips(tray, slots, fills);
  const emptySign = slots.findIndex((s, k) => s.kind === "sign" && !fills[k]);
  const emptyNumber = slots.findIndex((s, k) => s.kind === "number" && !fills[k]);
  const hasSigns = slots.some((s) => s.kind === "sign");
  const hasNumbers = slots.some((s) => s.kind === "number");
  const nextGap = keysFrozen ? -1 : fills.findIndex((f) => !f);

  const place = (k: number, value: string) => {
    if (keysFrozen || k < 0 || !current) return;
    const next = [...fills];
    next[k] = value;
    setFills(next);
    setFresh(k);
    soundCue("equation.drop");
    const seg = joinGapSegment(next);
    if (tryLimit !== null && gapStageFull(current, seg)) {
      setTries(tries.map((n, i) => (i === stage ? n + 1 : n)));
      if (!gapStageCorrect(current, seg)) wrongMoveFlash(box.current);
    }
  };
  const tapSign = (op: Operator) => place(emptySign, op);
  const tapChip = (t: number) => {
    if (used[t]) return;
    place(emptyNumber, String(tray[t]));
  };
  const clearGap = (k: number) => {
    if (keysFrozen || !fills[k]) return;
    const next = [...fills];
    next[k] = null;
    setFills(next);
    setFresh(null);
  };

  const advance = (seg: string) => {
    if (!data) return;
    const next = [...answers];
    next[stage] = seg;
    setAnswers(next);
    if (stage >= total - 1) {
      done.current = true;
      onSubmit(tryLimit !== null ? joinCountSuffix(joinStages(next, total), tries) : joinStages(next, total));
      if (data.stages.every((st, i) => gapStageCorrect(st, next[i] ?? ""))) setFinale(next);
      return;
    }
    const nextStage = stage + 1;
    setStage(nextStage);
    setEntered(true);
    setFresh(null);
    soundCue("equation.advance");
    const st = data.stages[nextStage];
    if (st) setFills(Array(gapSlots(st).length).fill(null));
  };

  useGameKeys((kind, key, event) => {
    if (!data || !current) return false;
    const op: Operator | null = key === "+" ? "+" : key === "-" ? "-" : key === "*" || key === "x" || key === "×" ? "×" : key === "/" || key === "÷" ? "÷" : null;
    const digit = /^[0-9]$/.test(key);
    const used = op !== null || digit || key === "Backspace" || key === "Enter";
    if (!used || kind !== "down") return used;
    if (op) {
      if (!event.repeat) tapSign(op);
    } else if (digit) {
      const t = typed.current;
      if (t.timer) clearTimeout(t.timer);
      t.text += key;
      const free = tray.map((v, i) => ({ v: String(v), i })).filter((c) => !used_(c.i));
      const exact = free.find((c) => c.v === t.text);
      const longer = free.some((c) => c.v !== t.text && c.v.startsWith(t.text));
      const commit = () => {
        const hit = tray.map((v, i) => ({ v: String(v), i })).find((c) => c.v === typed.current.text && !used_(c.i));
        if (hit) tapChip(hit.i);
        typed.current = { text: "", timer: null };
      };
      if (exact && !longer) commit();
      else if (!exact && !longer) typed.current = { text: "", timer: null };
      else t.timer = setTimeout(commit, 700);
    } else if (key === "Backspace") {
      let k = fills.length - 1;
      while (k >= 0 && !fills[k]) k--;
      if (k >= 0) clearGap(k);
    } else if (!event.repeat && !frozen) advance(segment);
    return true;
  });
  // The key handler reads the latest chip use through this (it is rebuilt each render).
  function used_(i: number): boolean {
    return used[i] ?? false;
  }

  if (!data || !current) return null;
  const last = stage >= total - 1;
  const rightSoFar = data.stages.filter((st, i) => i < stage && gapStageCorrect(st, answers[i] ?? "")).length + (complete ? 1 : 0);
  const caption = hasSigns && hasNumbers ? "Signs in the circles, numbers in the squares" : hasNumbers ? "Fill the squares from the numbers below" : "Fill the circles with signs";

  return (
    <div data-polish="equation" data-operator-gaps="" data-stage-column="3" className={`flex min-h-0 flex-1 flex-col gap-3 ${column ? "" : "justify-between"}`}>
      <div data-game-arena="fixed" className="op-board opg-board">
        <StageProgress stage={stage} total={total} />
        <p className="opg-caption">{caption} · left to right</p>
        <div
          key={stage}
          ref={box}
          data-enter={entered ? "true" : undefined}
          data-correct={holding || finale ? "true" : undefined}
          className="opg-equation"
        >
          <span ref={line} className="opg-line">
            <GapLine stage={current} fills={fills} onGap={keysFrozen ? undefined : clearGap} nextGap={nextGap} fresh={fresh} />
          </span>
        </div>
        <HudPills
          testId="equation"
          items={[
            tryLimit !== null
              ? outOfTries
                ? { id: "tries", value: "No tries left", tone: "warn", limit: tryLimit }
                : { id: "tries", label: "Tries", value: limitText(triesUsed, tryLimit), limit: tryLimit }
              : null,
            { id: "gaps", label: "Gaps", value: `${fills.filter(Boolean).length}/${slots.length}` },
            { id: "right", label: "Right", value: `${rightSoFar}/${total}`, tone: rightSoFar > 0 ? "good" : undefined },
          ]}
        />
        <StageCorrect visible={holding} />
        {finaleOn && finale && (
          <div className="op-finale" aria-hidden="true">
            {data.stages.map((st, i) => (
              <div key={i} className="op-finale-row" style={{ "--i": i } as CSSProperties}>
                <span className="opg-finale-line"><GapLine stage={st} fills={splitGapSegment(finale[i] ?? "", gapSlots(st).length)} /></span>
                <span className="op-tick">✓</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div data-game-controls="operators" data-equation-pad className="opg-pad">
        <div className="opg-row" data-row="signs" data-absent={hasSigns ? undefined : "true"}>
          {hasSigns ? (
            SIGN_KEYS.map((op) => (
              <Button key={op} variant="ghost" type="button" disabled={keysFrozen || emptySign < 0} onClick={() => tapSign(op)} aria-label={`Sign ${signText(op)}`} className="press opg-key" data-kind="sign">
                {signText(op)}
              </Button>
            ))
          ) : (
            <p className="opg-absent">The signs are given</p>
          )}
        </div>
        <div className="opg-row" data-row="tray" data-absent={hasNumbers ? undefined : "true"} style={{ "--chips": Math.max(1, tray.length) } as CSSProperties}>
          {hasNumbers ? (
            tray.map((v, t) => (
              <Button key={t} variant="ghost" type="button" disabled={keysFrozen || used[t] || emptyNumber < 0} data-used={used[t] ? "true" : undefined} onClick={() => tapChip(t)} aria-label={`Number ${v}`} className="press opg-key" data-kind="number">
                {v}
              </Button>
            ))
          ) : (
            <p className="opg-absent">No number gaps</p>
          )}
        </div>
      </div>

      <Button
        data-game-controls="submit"
        variant="ghost"
        type="button"
        onClick={() => !frozen && advance(segment)}
        disabled={frozen}
        className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
      >
        {last ? "Submit" : "Next"}
      </Button>
    </div>
  );
}

/** The gaps intro example: a mixed equation with one sign gap and one number gap filled in. */
export function GapsIntroExample() {
  const stage: EquationStage = { numbers: [7, 0, 2], target: 20, signs: [null, "×"], tray: [3, 5] };
  return (
    <div className="flex flex-col items-center gap-3" data-operator-gaps="">
      <div className="opg-equation opg-intro">
        <span className="opg-line"><GapLine stage={stage} fills={[null, null]} /></span>
      </div>
      <p className="opg-intro-key">
        <span className="opg-chipkey" data-kind="sign">±</span> a sign <span className="opg-chipkey" data-kind="number">#</span> a number
      </p>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">7 + 3 × 2 = 20</span>
      </p>
    </div>
  );
}

const GAPS_REVEAL_CSS = `
.op-reveal { display: flex; min-height: 0; width: 100%; flex: 1 1 auto; flex-direction: column; justify-content: center; gap: 8px; }
.op-reveal-row { position: relative; display: flex; width: 100%; flex-direction: column; align-items: center; gap: 4px; padding: 8px 10px 9px; border-radius: 14px;
  background: linear-gradient(180deg, #1c1c25, #15151c); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07), inset 0 -3px 0 rgba(0,0,0,.25); }
.op-reveal-row[data-ok="true"] { box-shadow: inset 3px 0 0 #3DDC84, inset 0 0 0 1px rgba(61,220,132,.22), inset 0 -3px 0 rgba(0,0,0,.25); }
.op-reveal-row[data-ok="false"] { box-shadow: inset 3px 0 0 #ff7a70, inset 0 0 0 1px rgba(255,122,112,.22), inset 0 -3px 0 rgba(0,0,0,.25); }
.op-reveal-label { font-size: 14px; color: #b4b4be; }
.op-reveal-label .ok { color: #5fe69c; font-weight: 700; }
.op-reveal-label .bad { color: #ff7a70; font-weight: 700; }
.opg-reveal-line { align-self: stretch; display: flex; justify-content: center; white-space: nowrap; font-size: var(--fit-fs, var(--fit-base)) !important; }
.op-fit-line { display: inline-flex; align-items: center; white-space: nowrap; }
`;

export function GapsReveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "equation") return null;
  const tryLimit = equationTryLimit(puzzle);
  const { body, counts: tries } = tryLimit !== null ? splitCountSuffix(myAnswer) : { body: myAnswer ?? "", counts: [] as number[] };
  const parts = splitStages(body, puzzle.stages.length);
  return (
    <div className="op-reveal" data-operator-gaps="">
      <PolishStyle id="equation-gaps-reveal" css={GAPS_REVEAL_CSS} />
      {puzzle.stages.map((stage, i) => {
        const n = gapSlots(stage).length;
        const mine = splitGapSegment(parts[i] ?? "", n);
        const ok = gapStageCorrect(stage, parts[i] ?? "") && (tryLimit === null || (tries[i] ?? 0) <= tryLimit);
        const full = mine.every(Boolean);
        const kind = stage.tray && stage.signs?.some((s) => s === null) ? "Mixed" : stage.tray ? "Numbers" : "Signs";
        // Right: the player's own true fill. Otherwise one true fill (any true fill counts), then theirs if complete.
        const shown = ok ? mine : splitGapSegment(puzzle.gapAnswers?.[i] ?? "", n);
        return (
          <div key={i} className="op-reveal-row" data-ok={ok ? "true" : "false"}>
            <p className="op-reveal-label">
              Equation {i + 1} · {kind} · <span className={ok ? "ok" : "bad"}>{ok ? "✓" : full ? "✗" : mine.some(Boolean) ? "Incomplete ✗" : "Skipped ✗"}</span>
            </p>
            <FitLine className="opg-reveal-line opg-equation" basePx={20} fitKey={`${i}:${shown.join(",")}`}>
              <GapLine stage={stage} fills={shown} mark="ok" />
            </FitLine>
            {!ok && full ? (
              <FitLine className="opg-reveal-line opg-equation" basePx={17} fitKey={`${i}:m:${mine.join(",")}`}>
                <GapLine stage={stage} fills={mine} mark="bad" />
              </FitLine>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
