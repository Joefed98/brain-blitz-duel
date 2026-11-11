import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { MatchResult, PlacementReveal, Searching, VsScreen } from "@/components/rated/RatedMatchScreens";
import { Button, EmptyState } from "@/design/components";
import { APP_NAME } from "@/lib/brand";
import type { BestOf, RatedBackend, RatedMatch, RatedPick, RatedResult, SearchProgress } from "@/lib/rated/backend";
import { backendNow, refreshRated, useRatedStatus } from "@/lib/rated/ratedApi";
import { recordRatedEvent } from "@/lib/rated/ratedEvents";
import { bestOfLabel, pickLabel, shownBestOf, shownPicks } from "@/lib/rated/rules";
import { rankLabel } from "@/lib/rated/tiers";
import { shareResult } from "@/lib/share/shareResult";
import { APP_URL } from "@/config/appUrl";

/**
 * A rated match, tap to result (wave 3, session W3c; mockups 03–07 and 12–13 in docs/mockups/wave-3/): searching, VS
 * (3 s), the games (the round runner the ratings work binds, `backend.renderGame`), then the result, and after the 5th
 * placement match the reveal. Every figure is the server's (src/lib/rated/backend.ts).
 *
 * Testers only while rated play is testers only: anyone rated play isn't open to is sent to Play, and a pick or length
 * that isn't switched on is refused here as well as never shown.
 */
type Search = { pick?: string | undefined; bestOf?: number | undefined };

export const Route = createFileRoute("/rated")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    pick: typeof s["pick"] === "string" ? s["pick"] : undefined,
    bestOf: typeof s["bestOf"] === "number" ? s["bestOf"] : Number(s["bestOf"]) || undefined,
  }),
  head: () => ({
    meta: [{ title: `${APP_NAME} rated match` }, { name: "robots", content: "noindex" }],
  }),
  component: RatedScreen,
});

/** How long VS holds before the first game (mockup 04's moment). */
export const VS_HOLD_MS = 3000;

type Phase =
  | { kind: "waiting" }
  | { kind: "searching"; progress: SearchProgress | null }
  | { kind: "vs"; match: RatedMatch }
  | { kind: "game"; match: RatedMatch }
  | { kind: "result"; result: RatedResult }
  | { kind: "reveal"; result: RatedResult }
  | { kind: "error"; message: string };

function RatedScreen() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const status = useRatedStatus();
  const [phase, setPhase] = useState<Phase>({ kind: "waiting" });
  const [now, setNow] = useState(() => Date.now());
  const backendRef = useRef<RatedBackend | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [waited, setWaited] = useState(false);

  const pick = status ? (shownPicks(status.options).find((p) => p === search.pick) ?? null) : null;
  const bestOf = status ? (shownBestOf(status.options).find((n) => n === search.bestOf) ?? null) : null;

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (waited && (!status || !pick || !bestOf)) void navigate({ to: "/", replace: true });
  }, [waited, status, pick, bestOf, navigate]);

  // A second clock for the search, the recorded run's age and the rematch countdown.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const startSearch = useCallback(
    async (p: RatedPick, n: BestOf) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setPhase({ kind: "searching", progress: null });
      const backend = backendRef.current ?? (await backendNow());
      backendRef.current = backend;
      if (!backend) return setPhase({ kind: "error", message: "Rated play isn’t open right now." });
      try {
        const found = await backend.search(p, n, (progress) => !ctrl.signal.aborted && setPhase({ kind: "searching", progress }), ctrl.signal);
        if (ctrl.signal.aborted || found === null) return;
        if ("ok" in found) return setPhase({ kind: "error", message: found.message });
        setPhase({ kind: "vs", match: found });
      } catch {
        if (!ctrl.signal.aborted) setPhase({ kind: "error", message: "Couldn’t find a match. Try again." });
      }
    },
    [],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current || !pick || !bestOf) return;
    started.current = true;
    void startSearch(pick, bestOf);
    return undefined;
  }, [pick, bestOf, startSearch]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // VS holds, then the games.
  useEffect(() => {
    if (phase.kind !== "vs") return;
    const t = window.setTimeout(() => setPhase({ kind: "game", match: phase.match }), VS_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const finish = useCallback(async (match: RatedMatch) => {
    const backend = backendRef.current;
    const result = backend ? await backend.result(match.id).catch(() => null) : null;
    void refreshRated();
    if (!result) return setPhase({ kind: "error", message: "Your result is on its way. Check back on Play." });
    setPhase({ kind: "result", result });
  }, []);

  const me = status && (phase.kind === "searching" || phase.kind === "waiting") ? status : null;
  const meCard = phase.kind === "vs" || phase.kind === "game" ? phase.match.me : null;

  let body;
  if (phase.kind === "searching" || phase.kind === "waiting") {
    body = me ? (
      <Searching
        me={me.me}
        pickText={pick && bestOf ? `${pickLabel(pick)}, ${bestOfLabel(bestOf).toLowerCase()}` : ""}
        progress={phase.kind === "searching" ? phase.progress : null}
        onCancel={() => {
          abortRef.current?.abort();
          router.history.back();
        }}
      />
    ) : null;
  } else if (phase.kind === "vs") {
    body = <VsScreen match={phase.match} nowMs={now} />;
  } else if (phase.kind === "game") {
    const match = phase.match;
    body = backendRef.current?.renderGame(match, () => void finish(match)) ?? null;
  } else if (phase.kind === "result") {
    const result = phase.result;
    body = (
      <MatchResult
        result={result}
        nowMs={now}
        onNext={() => void startSearch(result.match.pick, result.match.bestOf)}
        onRematch={async () => {
          const b = backendRef.current;
          const again = b ? await b.rematch(result.match.id).catch(() => null) : null;
          if (again && !("ok" in again)) setPhase({ kind: "vs", match: again });
        }}
        onTiers={() => {
          recordRatedEvent({ event: "tier_ladder_viewed", from: "result" });
          void navigate({ to: "/tiers" as never });
        }}
        onChallenge={async () => {
          const b = backendRef.current;
          if (!b) return { ok: false, message: "That didn’t work. Try again." };
          return b.challenge(result.match.id);
        }}
        onReveal={() => setPhase({ kind: "reveal", result })}
      />
    );
  } else if (phase.kind === "reveal" && phase.result.reveal) {
    const reveal = phase.result.reveal;
    const result = phase.result;
    body = (
      <PlacementReveal
        reveal={reveal}
        onNext={() => void startSearch(result.match.pick, result.match.bestOf)}
        onTiers={() => {
          recordRatedEvent({ event: "tier_ladder_viewed", from: "reveal" });
          void navigate({ to: "/tiers" as never });
        }}
        share={
          <Button
            variant="secondary"
            size={52}
            block
            data-reveal-share
            onClick={() =>
              void shareResult({ title: APP_NAME, lines: [`I placed ${rankLabel(reveal.rank)} on ${APP_NAME}.`], link: APP_URL })
            }
          >
            Share
          </Button>
        }
      />
    );
  } else if (phase.kind === "error") {
    body = (
      <EmptyState
        layout="page"
        tone="alert"
        pose="ready"
        title="No match this time"
        heading={1}
        body={phase.message}
        action={{ label: "Back to Play", onClick: () => void navigate({ to: "/" }) }}
        data-rated-screen="error"
      />
    );
  }

  return (
    <PhoneShell skin="profile" bare>
      <div className="rt-page" data-rated-phase={phase.kind} data-me={meCard ? "match" : undefined}>
        {body}
      </div>
    </PhoneShell>
  );
}
