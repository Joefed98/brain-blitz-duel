/**
 * The identity screens' analytics events (wave 2, session A2; docs/analytics.md): profile_viewed, customise_opened
 * and equip_refused, recorded by the server through recordIdentityEventFn (identityEvents.functions.ts). The input
 * rules are here so a check can prove them: these three events only, fixed-word props only (never a name, a free
 * text, a score or an id of a person).
 *
 * - profile_viewed: props.who "account" | "guest";
 * - customise_opened: no props;
 * - equip_refused: props.slot (a loadout slot or "avatar") and props.reason (A1's refusal type, a short snake_case word).
 */
import { LOADOUT_SLOTS } from "./backend";

export const IDENTITY_EVENTS = ["profile_viewed", "customise_opened", "equip_refused"] as const;
export type IdentityEventName = (typeof IDENTITY_EVENTS)[number];

export const EQUIP_SLOTS: readonly string[] = [...LOADOUT_SLOTS, "avatar"];
const REASON = /^[a-z][a-z0-9_]{0,39}$/;

export interface IdentityEvent {
  event: IdentityEventName;
  props: Record<string, string> | null;
}

export function acceptIdentityEvent(input: unknown): IdentityEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  for (const k of Object.keys(o)) if (k !== "event" && k !== "who" && k !== "slot" && k !== "reason") return null;
  const event = o["event"];
  if (typeof event !== "string" || !(IDENTITY_EVENTS as readonly string[]).includes(event)) return null;
  if (event === "profile_viewed") {
    if (o["slot"] !== undefined || o["reason"] !== undefined) return null;
    if (o["who"] !== "account" && o["who"] !== "guest") return null;
    return { event, props: { who: o["who"] } };
  }
  if (event === "customise_opened") {
    if (o["who"] !== undefined || o["slot"] !== undefined || o["reason"] !== undefined) return null;
    return { event, props: null };
  }
  if (o["who"] !== undefined) return null;
  const slot = o["slot"];
  const reason = o["reason"];
  if (typeof slot !== "string" || !EQUIP_SLOTS.includes(slot)) return null;
  if (typeof reason !== "string" || !REASON.test(reason)) return null;
  return { event: "equip_refused", props: { slot, reason } };
}

/** Records one in the background (never under automation unless a check allows it); nothing waits for it. */
export function recordIdentityEvent(input: { event: "profile_viewed"; who: "account" | "guest" } | { event: "customise_opened" } | { event: "equip_refused"; slot: string; reason: string }): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __DUELZ_ALLOW_ANALYTICS__?: boolean; __DUELZ_IDENTITY_EVENTS__?: unknown[] };
  // Checks read what would be sent.
  if (Array.isArray(w.__DUELZ_IDENTITY_EVENTS__)) w.__DUELZ_IDENTITY_EVENTS__.push(input);
  if (typeof navigator !== "undefined" && navigator.webdriver && !w.__DUELZ_ALLOW_ANALYTICS__) return;
  if (w.__DUELZ_IDENTITY_EVENTS__) return;
  void (async () => {
    try {
      const { recordIdentityEventFn } = await import("./identityEvents.functions");
      await recordIdentityEventFn({ data: input as never });
    } catch {
      /* fire and forget */
    }
  })();
}
