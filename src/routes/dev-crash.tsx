import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { crashReportingOn, setCrashContext } from "@/lib/crashReporting";
import { Button } from "@/design/components";

/**
 * Crash reporting test page (development only; lib/crashReporting.ts). Not linked anywhere; a
 * production build answers this address with the not-found page, as /replay-lab. Each button raises
 * one kind of error the reporter listens for; with SENTRY_DSN set they arrive in Sentry tagged with
 * the test game and round below.
 */
export const Route = createFileRoute("/dev-crash")({
  ssr: false,
  // A plain `import.meta.env.DEV` (no cast) so Vite folds it to false and drops the page.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: DevCrash,
});

function Thrower(): null {
  throw new Error("dev-crash: a render error (the root error page)");
}

function DevCrash() {
  const [render, setRender] = useState(false);
  const on = crashReportingOn();
  return (
    <PhoneShell skin="profile">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-bold">Crash test</h1>
        <p data-crash-status className="text-sm text-muted-foreground">
          {on
            ? "Crash reporting is on (SENTRY_DSN is set)."
            : "Crash reporting is off (SENTRY_DSN is empty): nothing is sent."}
        </p>
        <Button
          variant="secondary"
          block
          onClick={() => setCrashContext({ gameId: "sudoku", round: 3 })}
        >
          Tag as Box Six, round 3
        </Button>
        <Button
          variant="secondary"
          block
          data-crash="error"
          onClick={() => {
            setTimeout(() => {
              throw new Error("dev-crash: an uncaught error");
            }, 0);
          }}
        >
          Uncaught error
        </Button>
        <Button
          variant="secondary"
          block
          data-crash="rejection"
          onClick={() => void Promise.reject(new Error("dev-crash: an unhandled rejection"))}
        >
          Unhandled rejection
        </Button>
        <Button
          variant="secondary"
          block
          data-crash="render"
          onClick={() => setRender(true)}
        >
          Render error
        </Button>
        {render ? <Thrower /> : null}
      </div>
    </PhoneShell>
  );
}
