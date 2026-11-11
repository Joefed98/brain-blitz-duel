/**
 * The rated screens' analytics events (wave 3, session W3c; docs/analytics.md), recorded by the server through
 * recordRatedEventFn (ratedEvents.functions.ts) and src/lib/data/events.server.ts. The input rules are here so a check
 * can prove them: these five events only, fixed-word props only (never a name, a rating, a score or an id).
 *
 * - play_card_tapped: props.pick (a pick: mixed, puzzles, arcade or one category / group id) and props.placement;
 * - vs_shown: props.source "live" | "recorded";
 * - result_viewed: props.outcome "won" | "lost" and props.placement;
 * - next_match_tapped: no props;
 * - tier_ladder_viewed: props.from "home" | "result" | "reveal" | "profile".
 */
export const RATED_EVENTS = ["play_card_tapped", "vs_shown", "result_viewed", "next_match_tapped", "tier_ladder_viewed"] as const;
export type RatedEventName = (typeof RATED_EVENTS)[number];

export const LADDER_FROM = ["home", "result", "reveal", "profile"] as const;
export type LadderFrom = (typeof LADDER_FROM)[number];

const PICK = /^(mixed|puzzles|arcade|[a-z]{3,12})$/;

export type RatedEventInput =
  | { event: "play_card_tapped"; pick: string; placement: boolean }
  | { event: "vs_shown"; source: "live" | "recorded" }
  | { event: "result_viewed"; outcome: "won" | "lost"; placement: boolean }
  | { event: "next_match_tapped" }
  | { event: "tier_ladder_viewed"; from: LadderFrom };

export interface RatedEvent {
  event: RatedEventName;
  props: Record<string, string | boolean> | null;
}

const ALLOWED: Record<RatedEventName, readonly string[]> = {
  play_card_tapped: ["pick", "placement"],
  vs_shown: ["source"],
  result_viewed: ["outcome", "placement"],
  next_match_tapped: [],
  tier_ladder_viewed: ["from"],
};

export function acceptRatedEvent(input: unknown): RatedEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const event = o["event"];
  if (typeof event !== "string" || !(RATED_EVENTS as readonly string[]).includes(event)) return null;
  const name = event as RatedEventName;
  for (const k of Object.keys(o)) if (k !== "event" && !ALLOWED[name].includes(k)) return null;
  switch (name) {
    case "play_card_tapped": {
      const pick = o["pick"];
      if (typeof pick !== "string" || !PICK.test(pick) || typeof o["placement"] !== "boolean") return null;
      return { event: name, props: { pick, placement: o["placement"] } };
    }
    case "vs_shown":
      if (o["source"] !== "live" && o["source"] !== "recorded") return null;
      return { event: name, props: { source: o["source"] } };
    case "result_viewed":
      if ((o["outcome"] !== "won" && o["outcome"] !== "lost") || typeof o["placement"] !== "boolean") return null;
      return { event: name, props: { outcome: o["outcome"], placement: o["placement"] } };
    case "next_match_tapped":
      return { event: name, props: null };
    case "tier_ladder_viewed":
      if (typeof o["from"] !== "string" || !(LADDER_FROM as readonly string[]).includes(o["from"])) return null;
      return { event: name, props: { from: o["from"] } };
  }
}

/** The event's `pick` prop from a pick ("cat:word" → "word"). */
export function pickProp(pick: string): string {
  return pick.startsWith("cat:") ? pick.slice(4) : pick;
}

/** Records one in the background (never under automation unless a check allows it); nothing waits for it. */
export function recordRatedEvent(input: RatedEventInput): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __DUELZ_ALLOW_ANALYTICS__?: boolean; __DUELZ_RATED_EVENTS__?: unknown[] };
  // Checks read what would be sent.
  if (Array.isArray(w.__DUELZ_RATED_EVENTS__)) {
    w.__DUELZ_RATED_EVENTS__.push(input);
    return;
  }
  if (typeof navigator !== "undefined" && navigator.webdriver && !w.__DUELZ_ALLOW_ANALYTICS__) return;
  void (async () => {
    try {
      const { recordRatedEventFn } = await import("./ratedEvents.functions");
      await recordRatedEventFn({ data: input as never });
    } catch {
      /* fire and forget */
    }
  })();
}
