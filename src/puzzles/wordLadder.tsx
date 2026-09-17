import { playCorrect, playWrong } from "@/lib/sound";
import { useEffect, useRef, useState } from "react";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useStageState } from "@/lib/duel/stageState";
import { WORD_LADDER_TIME_MS } from "@/lib/duel/types";

function Rung({ word, target = false }: { word: string; target?: boolean }) {
  return (
    <div
      className={`grid w-44 grid-cols-4 gap-1 rounded-lg border px-2 py-1.5 ${target ? "border-primary bg-primary/10" : "border-border bg-card"}`}
    >
      {word.split("").map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={`flex h-8 items-center justify-center font-mono text-xl font-bold ${target ? "text-primary" : "text-foreground"}`}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-sm text-foreground">
        Turn the top word into the bottom one, changing one letter at a time. Every step must be a
        real word.
      </p>
      <div className="flex items-center gap-1 font-mono text-xs font-bold text-primary">
        <span>COLD</span>
        <span>→</span>
        <span>CORD</span>
        <span>→</span>
        <span>CARD</span>
        <span>→</span>
        <span>WARD</span>
        <span>→</span>
        <span>WARM</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Fewer steps earns a bonus. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  checkWord,
  stateKey = "ladder",
}: PuzzleStageProps) {
  // Kept outside the tree, keyed by room and round, so room updates never wipe it.
  const [rungs, setRungs] = useStageState<string[]>(stateKey, "rungs", () => []);
  const [value, setValue] = useStageState<string>(stateKey, "value", () => "");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!locked) inputRef.current?.focus();
  }, [locked, puzzle.type]);

  if (puzzle.type !== "ladder") return null;

  const submit = async () => {
    if (locked || busy || value.length !== 4 || !checkWord) return;
    setBusy(true);
    const verdict = await checkWord(value, [puzzle.startWord, ...rungs]);
    setBusy(false);
    if (!verdict.valid) {
      playWrong();
      setBad(true);
      window.setTimeout(() => setBad(false), 420);
      return;
    }
    playCorrect();
    const next = [...rungs, verdict.word];
    setRungs(next);
    setValue("");
    onDraftAnswer?.(next.join(","));
    if (verdict.word === puzzle.targetWord) onSubmit(next.join(","));
    else inputRef.current?.focus();
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-[2] flex-col items-center overflow-y-auto rounded-xl border border-border bg-card/40 py-2">
        <Rung word={puzzle.startWord} />
        {rungs.map((word, index) => (
          <div key={`${word}-${index}`} className="flex flex-col items-center">
            <span className="h-2 border-l border-border" />
            <Rung word={word} />
          </div>
        ))}
        {!locked && rungs.at(-1) !== puzzle.targetWord && (
          <>
            <span className="h-2 border-l border-border" />
            <div className={bad ? "animate-shake" : ""}>
              <div
                className={`grid w-44 grid-cols-4 gap-1 rounded-lg border px-2 py-1.5 ${bad ? "border-warn" : "border-primary/60"}`}
              >
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className="flex h-8 items-center justify-center border-b border-border font-mono text-xl font-bold text-foreground"
                  >
                    {value[index] ?? ""}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        <span className="h-2 border-l border-border" />
        <Rung word={puzzle.targetWord} target />
      </div>
      <input
        ref={inputRef}
        value={value}
        aria-label="Next rung"
        autoCapitalize="characters"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={4}
        onChange={(e) => setValue(e.target.value.replace(/[^a-z]/gi, "").toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        className="h-11 w-full rounded-lg border border-border bg-card px-3 text-center font-mono text-xl uppercase tracking-[0.25em] focus:border-primary focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!rungs.length || locked}
          onClick={() => {
            const next = rungs.slice(0, -1);
            setRungs(next);
            onDraftAnswer?.(next.join(","));
          }}
          className="h-11 px-3 text-xs font-semibold uppercase text-muted-foreground disabled:opacity-30"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={value.length !== 4 || busy || locked}
          onClick={() => void submit()}
          className="h-11 flex-1 rounded-lg bg-primary font-display text-sm font-bold uppercase text-primary-foreground disabled:opacity-40"
        >
          Submit rung
        </button>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "ladder") return null;
  const rungs = (myAnswer ?? "").split(",").filter(Boolean);
  const player = [puzzle.startWord, ...rungs];
  return (
    <div className="flex w-full flex-col gap-3 text-center">
      <p className="break-words font-mono text-sm font-bold text-foreground">
        {player.join(" → ")} {myCorrect ? "✓" : "✗"} · {player.length} rungs, shortest{" "}
        {puzzle.shortestLength ?? "—"}
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        {(puzzle.shortestPath ?? []).join(" → ")}
      </p>
    </div>
  );
}

export const wordLadderPuzzle: PuzzleDefinition = {
  key: "ladder",
  name: "Word Ladder",
  category: "word",
  timeLimitMs: WORD_LADDER_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "ladder", startWord: "COLD", targetWord: "WARM" }),
  check: () => false,
  revealHeading: "Your ladder",
  IntroExample,
  Stage,
  Reveal,
};
