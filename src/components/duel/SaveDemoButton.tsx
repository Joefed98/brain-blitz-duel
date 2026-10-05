import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { checkDemoKeyFn, saveIntroDemoFn, savePuzzleDemoFn } from "@/lib/duel/practice.functions";
import type { PuzzleDemoLog } from "@/lib/duel/puzzleDemo";
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

export type DemoKeyStatus = "none" | "checking" | "accepted" | "refused" | "failed";

/**
 * Practice-page hook: the verified intro-demo key, or null, plus the check's
 * status. Depends only on ?dev=1 and the key — never on screen size or input
 * type. Re-checks when the page is restored from the back-forward cache.
 */
export function useDemoKey(): { key: string | null; status: DemoKeyStatus } {
  const [key, setKey] = useState<string | null>(null);
  const [status, setStatus] = useState<DemoKeyStatus>("none");
  const check = useServerFn(checkDemoKeyFn);
  useEffect(() => {
    const run = () => {
      const k = readDevKey();
      if (!k) {
        setKey(null);
        setStatus(new URLSearchParams(window.location.search).get("dev") === "1" ? "refused" : "none");
        return;
      }
      setStatus("checking");
      check({ data: { key: k } })
        .then((r) => {
          setKey(r.ok ? k : null);
          setStatus(r.ok ? "accepted" : "refused");
        })
        .catch((error) => {
          console.error("[intro demo] key check failed", error);
          setStatus("failed");
        });
    };
    run();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) run();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [check]);
  return { key, status };
}

/** One-line dev status, shown whenever ?dev=1 is on the address. */
export function DevKeyStatus({ status }: { status: DemoKeyStatus }) {
  if (status === "none") return null;
  const text =
    status === "checking" ? "Dev: checking key…" : status === "accepted" ? "Dev: key accepted" : status === "refused" ? "Dev: key refused" : "Dev: check failed";
  return <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{text}</p>;
}

/** Dev-only (?dev=1&key=… practice): saves this run as the game's intro demo. */
export function SaveDemoButton({
  demoKey,
  puzzle,
  sealed,
  answer,
  recording = null,
}: {
  demoKey: string | null;
  puzzle: PuzzleData;
  sealed: string;
  answer: string | null | undefined;
  /** Puzzle games: the touches recorded on the fixed intro example. */
  recording?: PuzzleDemoLog | null;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const save = useServerFn(saveIntroDemoFn);
  const savePuzzle = useServerFn(savePuzzleDemoFn);
  const queryClient = useQueryClient();
  const engine = hasIntroDemo(puzzle.type);
  if (!demoKey) return null;
  if (engine ? !answer : !recording?.actions.length) return null;
  return (
    <button
      type="button"
      disabled={state === "saving" || state === "saved"}
      onClick={async () => {
        setState("saving");
        try {
          if (engine) await save({ data: { puzzle, sealed, answer: answer ?? "", dev: true, key: demoKey } });
          else await savePuzzle({ data: { puzzle, sealed, log: recording, dev: true, key: demoKey } });
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
