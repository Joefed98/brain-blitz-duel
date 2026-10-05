import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { checkDemoKeyFn, saveIntroDemoFn } from "@/lib/duel/practice.functions";
import type { PuzzleData } from "@/lib/duel/types";

import { hasIntroDemo } from "./IntroDemo";

/** Dev-only (?dev=1 practice): saves this run as the game's intro demo. */
export function SaveDemoButton({
  puzzle,
  sealed,
  answer,
}: {
  puzzle: PuzzleData;
  sealed: string;
  answer: string | null | undefined;
}) {
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const save = useServerFn(saveIntroDemoFn);
  const check = useServerFn(checkDemoKeyFn);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!devDiagnosticsOn()) return;
    const k = new URLSearchParams(window.location.search).get("key");
    if (!k) return;
    check({ data: { key: k } })
      .then((r) => r.ok && setKey(k))
      .catch(() => {});
  }, [check]);
  if (!key || !answer || !hasIntroDemo(puzzle.type)) return null;
  return (
    <button
      type="button"
      disabled={state === "saving"}
      onClick={async () => {
        setState("saving");
        try {
          await save({ data: { puzzle, sealed, answer, dev: true, key } });
          await queryClient.invalidateQueries({ queryKey: ["intro-demo", puzzle.type] });
          setState("saved");
        } catch (error) {
          console.error("[intro demo] save failed", error);
          setState("failed");
        }
      }}
      className="press absolute bottom-2 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-foreground"
    >
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : state === "failed" ? "Save failed" : "Save as intro demo"}
    </button>
  );
}
