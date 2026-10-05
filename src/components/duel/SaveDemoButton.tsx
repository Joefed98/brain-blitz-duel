import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { checkDemoKeyFn, saveIntroDemoFn } from "@/lib/duel/practice.functions";
import type { PuzzleData } from "@/lib/duel/types";

import { hasIntroDemo } from "./IntroDemo";

const STORE = "duelz-dev-demo-key";

/** Reads ?dev=1&key=… once, remembers it for this tab, and keeps it on the address. */
function readDevKey(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  let key = params.get("dev") === "1" ? params.get("key") : null;
  try {
    if (key) sessionStorage.setItem(STORE, key);
    else if (params.get("dev") === "1" || !params.has("dev")) key = sessionStorage.getItem(STORE);
  } catch {
    /* storage unavailable */
  }
  if (key && (params.get("dev") !== "1" || params.get("key") !== key)) {
    params.set("dev", "1");
    params.set("key", key);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params}`);
  }
  return key;
}

/** Practice-page hook: the verified intro-demo key, or null. Checked once per page. */
export function useDemoKey(): string | null {
  const [key, setKey] = useState<string | null>(null);
  const check = useServerFn(checkDemoKeyFn);
  useEffect(() => {
    const k = readDevKey();
    if (!k) return;
    check({ data: { key: k } })
      .then((r) => {
        if (r.ok) setKey(k);
        else console.warn("[intro demo] key rejected");
      })
      .catch((error) => console.error("[intro demo] key check failed", error));
  }, [check]);
  return key;
}

/** Dev-only (?dev=1&key=… practice): saves this run as the game's intro demo. */
export function SaveDemoButton({
  demoKey,
  puzzle,
  sealed,
  answer,
}: {
  demoKey: string | null;
  puzzle: PuzzleData;
  sealed: string;
  answer: string | null | undefined;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const save = useServerFn(saveIntroDemoFn);
  const queryClient = useQueryClient();
  if (!demoKey || !answer || !hasIntroDemo(puzzle.type)) return null;
  return (
    <button
      type="button"
      disabled={state === "saving" || state === "saved"}
      onClick={async () => {
        setState("saving");
        try {
          await save({ data: { puzzle, sealed, answer, dev: true, key: demoKey } });
          await queryClient.invalidateQueries({ queryKey: ["intro-demo", puzzle.type] });
          setState("saved");
        } catch (error) {
          console.error("[intro demo] save failed", error);
          setState("failed");
        }
      }}
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      className="press fixed right-3 z-[100] rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-foreground"
    >
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : state === "failed" ? "Save failed" : "Save as intro demo"}
    </button>
  );
}
