/**
 * Browser-side helper for scripts/shots/demo-taps.ts (served by the Vite dev server,
 * imported from Playwright). Mounts the real intro-demo player (PuzzleIntroDemo) for a
 * given puzzle and demo log in a fixed box over the page, exactly as RoundIntro shows
 * a saved demo. Never imported by the app.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";

import { PuzzleIntroDemo } from "@/components/duel/PuzzleDemo";
import type { PuzzleDemoLog } from "@/lib/duel/puzzleDemo";
import type { PuzzleData } from "@/lib/duel/types";

let root: Root | null = null;

export function mountDemo(puzzle: PuzzleData, log: PuzzleDemoLog, boxWidth: number): void {
  root?.unmount();
  document.getElementById("demo-taps-host")?.remove();
  const host = document.createElement("div");
  host.id = "demo-taps-host";
  host.style.cssText = `position:fixed;left:8px;top:8px;width:${boxWidth}px;z-index:99999;background:#0b0b0f`;
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    <QueryClientProvider client={new QueryClient()}>
      <PuzzleIntroDemo demo={{ puzzle, log }} />
    </QueryClientProvider>,
  );
}
