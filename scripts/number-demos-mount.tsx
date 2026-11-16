/**
 * Browser-side helper for scripts/number-demos-check.ts (served by a Vite dev server, imported from Playwright; never
 * imported by the app). Mounts the real intro demo (PuzzleIntroDemo, src/components/duel/PuzzleDemo.tsx) for a puzzle
 * and its saved log in a box the size of a phone's intro demo box, as RoundIntro shows it, and resolves with what the
 * demo's Stage submits (PuzzleIntroDemo's checks-only onDemoSubmit) and when, or null if it submits nothing first.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";

import { PuzzleIntroDemo } from "@/components/duel/PuzzleDemo";
import type { PuzzleDemoLog } from "@/lib/duel/puzzleDemo";
import type { PuzzleData } from "@/lib/duel/types";

let root: Root | null = null;

export function playIntroDemo(puzzle: PuzzleData, log: PuzzleDemoLog, boxWidth: number, timeoutMs: number): Promise<{ answer: string | null; ms: number }> {
  root?.unmount();
  document.getElementById("number-intro-host")?.remove();
  const host = document.createElement("div");
  host.id = "number-intro-host";
  host.style.cssText = `position:fixed;left:8px;top:8px;width:${boxWidth}px;z-index:99999;background:#0b0b0f`;
  document.body.appendChild(host);
  root = createRoot(host);
  return new Promise((resolve) => {
    let t0 = 0;
    let settled = false;
    const finish = (answer: string | null) => {
      if (settled) return;
      settled = true;
      resolve({ answer, ms: t0 ? Date.now() - t0 : -1 });
    };
    window.setTimeout(() => finish(null), timeoutMs);
    root!.render(
      <QueryClientProvider client={new QueryClient()}>
        <PuzzleIntroDemo
          demo={{ puzzle, log }}
          onReady={() => {
            t0 = Date.now();
          }}
          onDemoSubmit={finish}
        />
      </QueryClientProvider>,
    );
  });
}
