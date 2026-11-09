/**
 * The rules for events the phone sends (9 Nov 2026; docs/analytics.md), apart from the server function so the check
 * can prove them directly. Only CLIENT_EVENTS are accepted; any other event (the server-side ones included), any
 * field beyond `event`, `at`, `game` and `props` (a score, a result, a player id), a score-like prop, a game outside
 * the catalogue or a batch over CLIENT_BATCH_MAX is refused. Server only.
 */

import { PUZZLE_TYPES } from "@/lib/duel/catalogue";

import {
  CLIENT_BATCH_MAX,
  CLIENT_EVENT_MAX_AGE_MS,
  CLIENT_EVENTS,
  type ClientEventName,
} from "./events";

/** One accepted event, ready for recordEvents. */
export interface AcceptedClientEvent {
  event: ClientEventName;
  occurredAt: string;
  game: string | null;
  props: Record<string, string | number | boolean> | null;
}

const ALLOWED_KEYS = new Set(["event", "at", "game", "props"]);
const PROP_KEY = /^[a-z][a-z0-9_]{0,23}$/;
/** Props that would carry a result the server records itself. */
const RESULT_PROP = /score|point|total|result|correct|rank|place|duration|player|user|email|name|ip|agent/;
const MAX_PROPS = 8;
const ERROR_CODE = /^[a-z0-9][a-z0-9_.-]{0,39}$/;
/** A phone clock a little ahead is held to now; anything further out is the server's time. */
const FUTURE_SLACK_MS = 5 * 60 * 1000;

function cleanProps(value: unknown): Record<string, string | number | boolean> | null | "bad" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return "bad";
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PROPS) return "bad";
  const out: Record<string, string | number | boolean> = {};
  for (const [key, v] of entries) {
    if (!PROP_KEY.test(key) || RESULT_PROP.test(key)) return "bad";
    if (typeof v === "string") {
      if (v.length > 64) return "bad";
      out[key] = v;
    } else if (typeof v === "number") {
      if (!Number.isFinite(v)) return "bad";
      out[key] = v;
    } else if (typeof v === "boolean") out[key] = v;
    else return "bad";
  }
  return Object.keys(out).length ? out : null;
}

/** Checks one event; null when refused. */
export function acceptClientEvent(value: unknown, nowMs: number): AcceptedClientEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) return null;
  const event = input["event"];
  if (typeof event !== "string" || !(CLIENT_EVENTS as readonly string[]).includes(event)) return null;
  const props = cleanProps(input["props"]);
  if (props === "bad") return null;
  let game: string | null = null;
  if (input["game"] !== undefined && input["game"] !== null) {
    if (event !== "offline_game_played") return null;
    if (typeof input["game"] !== "string" || !(PUZZLE_TYPES as readonly string[]).includes(input["game"])) return null;
    game = input["game"];
  }
  if (event === "error_shown" && !(typeof props?.["code"] === "string" && ERROR_CODE.test(props["code"]))) return null;
  let at = nowMs;
  if (input["at"] !== undefined) {
    const claimed = input["at"];
    if (typeof claimed !== "number" || !Number.isFinite(claimed)) return null;
    if (claimed < nowMs - CLIENT_EVENT_MAX_AGE_MS) return null;
    if (claimed <= nowMs + FUTURE_SLACK_MS) at = Math.min(claimed, nowMs);
  }
  return { event: event as ClientEventName, occurredAt: new Date(at).toISOString(), game, props };
}

/** Checks a batch: the accepted events and how many were refused; a batch that isn't a short array is refused whole. */
export function acceptClientBatch(
  value: unknown,
  nowMs: number,
): { accepted: AcceptedClientEvent[]; rejected: number } | null {
  if (!Array.isArray(value) || value.length > CLIENT_BATCH_MAX) return null;
  const accepted: AcceptedClientEvent[] = [];
  for (const item of value) {
    const ok = acceptClientEvent(item, nowMs);
    if (ok) accepted.push(ok);
  }
  return { accepted, rejected: value.length - accepted.length };
}
