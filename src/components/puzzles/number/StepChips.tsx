import type { ReactNode } from "react";

import "@/polish-layout/polish-nov3-number.css";

/**
 * Puzzle polish (3 Nov 2026, Joe's audit; display only): a solution's moves as numbered chips that wrap onto
 * separate lines ("1 Fill 5" "2 5→3" …), never one dense line joined by "·". Used by Brimful's and Checkout's
 * answer reveals only.
 */
export function StepChips({ label, steps, testId }: { label?: ReactNode; steps: ReadonlyArray<ReactNode>; testId?: string }) {
  return (
    <div className="nv3-steps" data-step-chips={testId ?? ""}>
      {label !== undefined ? <span className="nv3-steps-label">{label}</span> : null}
      <ol className="nv3-steps-list">
        {steps.map((step, i) => (
          <li key={i} className="nv3-step">
            <span className="nv3-step-n" aria-hidden="true">{i + 1}</span>
            <span className="nv3-step-text">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
