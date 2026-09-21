import type { ReactNode } from "react";

import { MuteToggle } from "./MuteToggle";
import { Wordmark } from "./Wordmark";

interface PhoneShellProps {
  children: ReactNode;
  /** Hide the slim top bar (the home screen carries its own big wordmark). */
  bare?: boolean;
  /** Lock active puzzle and reveal layouts to the device viewport. */
  constrained?: boolean;
}

/** Mobile-first column, centred on larger screens, with a little depth behind. */
export function PhoneShell({ children, bare = false, constrained = false }: PhoneShellProps) {
  return (
    <div
      className={`relative w-full bg-background ${
        constrained ? "no-overscroll h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
      }`}
    >
      {/* Depth: one soft warm glow top-centre, one cool glow bottom, faint grid. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% -5%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%), radial-gradient(50% 35% at 50% 105%, color-mix(in oklab, var(--opponent) 10%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        className={`relative mx-auto flex min-h-0 w-full max-w-[430px] flex-col pad-safe ${
          constrained ? "no-overscroll h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
        }`}
      >
        {!bare && (
          <div className="mb-2 flex items-center justify-between">
            <Wordmark />
            <MuteToggle />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
