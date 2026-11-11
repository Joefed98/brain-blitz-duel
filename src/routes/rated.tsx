import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { FinishedGameCounter } from "@/components/account/SaveProgress";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { MatchResult, PlacementReveal, Searching, VsScreen } from "@/components/rated/RatedMatchScreens";
import { Button, EmptyState, SkeletonPage } from "@/design/components";
import { APP_URL } from "@/config/appUrl";
import { APP_NAME } from "@/lib/brand";
import type { BestOf, RatedMatch, RatedPick, RatedResult, SearchProgress } from "@/lib/rated/backend";
import { backendNow, refreshRated, useRatedStatus } from "@/lib/rated/ratedApi";
import { recordRatedEvent } from "@/lib/rated/ratedEvents";
import { noteRatedRoom } from "@/lib/rated/ratedRoom";
import { bestOfLabel, pickLabel, shownBestOf, shownPicks } from "@/lib/rated/rules";
import { shareResult } from "@/lib/share/shareResult";

/**
 * A rated match, tap to result (wave 3, session W3c; mockups 03–07 and 12–13 in docs/mockups/wave-3/), on W3b's match
 * flow and W3a's ratings:
 *
 * - `?pick=…&bestOf=…`: searching (W3b's queue, polled about once a second), then VS for VS_HOLD_MS, then the games in
 *   W3b's room on the existing room route (`/duel/<code>`, its header carrying RatedRoomScore with the hidden finish).
 * - `?match=…`: the result, once W3b has settled the match through W3a (the room route hands its finished rated room
 *   here after W3b's winner reveal), and after the 5th placement match the reveal.
 *
 * Testers only while rated play is testers only, everyone (guests included) once RATED_PLAY_FOR_EVERYONE is on: anyone
 * it isn't open to is sent to Play, and a pick or length that isn't switched on is refused here as well as never shown.
 * A guest's finished rated match counts for the save-your-progress prompt ("Save your rating and stars"), shown on the
 * next tab page, never over this result.
 */
type Search = { pick?: string | undefined; bestOf?: number | undefined; match?: string | undefined };

export const Route = createFileRoute("/rated")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    pick: typeof s["pick"] === "string" ? s["pick"] : undefined,
    bestOf: typeof s["bestOf"] === "number" ? s["bestOf"] : Number(s["bestOf"]) || undefined,
    match: typeof s["match"] === "string" ? s["match"] : undefined,
  }),
  head: () => ({
    meta: [{ title: `${APP_NAME} rated match` }, { name: "robots", content: "noindex" }],
  }),
  component: RatedScreen,
});

/** How long VS holds before the first game (mockup 04's moment). */
export const VS_HOLD_MS = 3000;
/** How long the result waits for W3b's settlement before saying it's on its way. */
const RESULT_WAIT_MS = 60_000;

type Phase =
  | { kind: "waiting" }
  | { kind: "searching"; progress: SearchProgress | null }
  | { kind: "vs"; match: RatedMatch }
  | { kind: "settling" }
  | { kind: "result"; result: RatedResult }
  | { kind: "reveal"; result: RatedResult }
  | { kind: "error"; message: string };

function RatedScreen() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const status = useRatedStatus();
  const [phase, setPhase] = useState<Phase>(search.match ? { kind: "settling" } : { kind: "waiting" });
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const [waited, setWaited] = useState(false);

  const pick = status ? (shownPicks(status.options).find((p) => p === search.pick) ?? null) : null;
  const bestOf = status ? (shownBestOf(status.options).find((n) => n === search.bestOf) ?? null) : null;

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 2500);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!waited || search.match) return;
    if (!status || !pick || !bestOf) void navigate({ to: "/", replace: true });
  }, [waited, status, pick, bestOf, navigate, search.match]);

  // A second clock for the rematch countdown.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const startSearch = useCallback(async (p: RatedPick, n: BestOf) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase({ kind: "searching", progress: null });
    const backend = await backendNow();
    if (!backend) return setPhase({ kind: "error", message: "Rated play isn’t open right now." });
    try {
      const found = await backend.search(p, n, (progress) => !ctrl.signal.aborted && setPhase({ kind: "searching", progress }), ctrl.signal);
      if (ctrl.signal.aborted || found === null) return;
      if ("ok" in found) return setPhase({ kind: "error", message: found.message });
      setPhase({ kind: "vs", match: found });
    } catch {
      if (!ctrl.signal.aborted) setPhase({ kind: "error", message: "Couldn’t find a match. Try again." });
    }
  }, []);

  const started = useRef(false);
  useEffect(() => {
    if (started.current || search.match || !pick || !bestOf) return;
    started.current = true;
    void startSearch(pick, bestOf);
  }, [pick, bestOf, startSearch, search.match]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // VS holds, then the games: W3b's room on the room route.
  useEffect(() => {
    if (phase.kind !== "vs") return;
    const { match } = phase;
    const t = window.setTimeout(() => {
      if (!match.roomCode) return setPhase({ kind: "error", message: "That match’s room isn’t ready. Try again." });
      noteRatedRoom(match.roomCode, match.id);
      void navigate({ to: "/duel/$code" as never, params: { code: match.roomCode } as never, replace: true });
    }, VS_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase, navigate]);

  // The result: W3b's settlement (with W3a's answer), asked about every 1.5 s until it's in.
  useEffect(() => {
    if (!search.match) return;
    let on = true;
    const since = Date.now();
    void (async () => {
      const backend = await backendNow();
      while (on) {
        const r = backend ? await backend.result(search.match!).catch(() => null) : null;
        if (!on) return;
        if (r) {
          void refreshRated();
          return setPhase({ kind: "result", result: r });
        }
        if (Date.now() - since > RESULT_WAIT_MS) return setPhase({ kind: "error", message: "Your result is on its way. Check back on Play." });
        await new Promise((res) => setTimeout(res, 1500));
      }
    })();
    return () => {
      on = false;
    };
  }, [search.match]);

  const again = (p: RatedPick, n: BestOf) => void navigate({ to: "/rated" as never, search: { pick: p, bestOf: n } as never, replace: true }).then(() => void startSearch(p, n));

  let body;
  if (phase.kind === "searching" || phase.kind === "waiting") {
    body = status ? (
      <Searching
        me={status.me}
        pickText={pick && bestOf ? `${pickLabel(pick)}, ${bestOfLabel(bestOf).toLowerCase()}` : ""}
        progress={phase.kind === "searching" ? phase.progress : null}
        onCancel={() => {
          abortRef.current?.abort();
          router.history.back();
        }}
      />
    ) : (
      <SkeletonPage label="Finding an opponent" />
    );
  } else if (phase.kind === "vs") {
    body = <VsScreen match={phase.match} nowMs={now} />;
  } else if (phase.kind === "settling") {
    body = <SkeletonPage label="Your result" />;
  } else if (phase.kind === "result") {
    const result = phase.result;
    body = (
      <>
        {/* A guest's finished rated match counts for "Save your rating and stars" on the next tab page (never here). */}
        <FinishedGameCounter gameKey={`rated:${result.match.id}`} from="rated" />
        <MatchResult
          result={result}
          nowMs={now}
          onNext={() => again(result.match.pick, result.match.bestOf)}
          onRematch={async () => {
            const b = await backendNow();
            const until = Date.parse(result.rematchUntil ?? "");
            while (b && Date.now() < until + 2000) {
              const r = await b.rematch(result.match.id).catch(() => null);
              if (r?.state === "agreed") return setPhase({ kind: "vs", match: r.match });
              if (!r || r.state === "closed") return;
              await new Promise((res) => setTimeout(res, 1000));
            }
          }}
          onTiers={() => {
            recordRatedEvent({ event: "tier_ladder_viewed", from: "result" });
            void navigate({ to: "/tiers" as never });
          }}
          onChallenge={async () => {
            const b = await backendNow();
            if (!b) return { ok: false, message: "That didn’t work. Try again." };
            return b.challenge(result.match.id);
          }}
          onReveal={() => setPhase({ kind: "reveal", result })}
        />
      </>
    );
  } else if (phase.kind === "reveal" && phase.result.reveal) {
    const reveal = phase.result.reveal;
    const result = phase.result;
    body = (
      <PlacementReveal
        reveal={reveal}
        onNext={() => again(result.match.pick, result.match.bestOf)}
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
            onClick={() => void shareResult({ title: APP_NAME, lines: [`I placed ${reveal.rank.label} on ${APP_NAME}.`], link: APP_URL })}
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
        heading={1}
        title="No match this time"
        body={phase.message}
        action={{ label: "Back to Play", onClick: () => void navigate({ to: "/" }) }}
        data-rated-screen="error"
      />
    );
  }

  return (
    <PhoneShell skin="profile" bare>
      <div className="rt-page" data-rated-phase={phase.kind}>
        {body}
      </div>
    </PhoneShell>
  );
}
