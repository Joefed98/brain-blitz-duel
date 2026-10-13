/**
 * Browser-side helper for the Pattern capture tool (served by the Vite dev
 * server, imported from Playwright). Writes stage-state values into a round's
 * bucket through the real `useStageState` hook, so a Stage mounted afterwards
 * starts from that position. Never imported by the app.
 */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { clearStageState, useStageState } from "@/lib/duel/stageState";

function Seeder({ stateKey, entries }: { stateKey: string; entries: [string, unknown][] }) {
  for (const [name, value] of entries) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed entry list per mount
    useStageState(stateKey, name, () => value);
  }
  return null;
}

export function seedStageState(stateKeys: string[], values: Record<string, unknown>) {
  const entries = Object.entries(values);
  for (const stateKey of stateKeys) {
    clearStageState(stateKey);
    const host = document.createElement("div");
    const root = createRoot(host);
    flushSync(() => root.render(<Seeder stateKey={stateKey} entries={entries} />));
    root.unmount();
  }
}
