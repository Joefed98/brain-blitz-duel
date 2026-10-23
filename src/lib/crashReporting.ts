/**
 * Crash reporting for the beta (22 Oct 2026; presentation and diagnostics only). Reports go to Sentry
 * when SENTRY_DSN (src/config/betaConfig.ts) is set; while it is empty nothing here starts: no
 * listener, no request, nothing on screen.
 *
 * A small first-party client for Sentry's envelope API (the same events the Sentry SDK sends), so the
 * app needs no new package and bun.lock stays as Lovable builds it. What it sends:
 *
 *  - uncaught errors (window "error"), unhandled promise rejections, and errors React's boundaries
 *    catch (the root error page, the replay boundary): type, message and stack frames;
 *  - tags: device type, screen size, viewport, home-screen app or browser, route (as a pattern, e.g.
 *    /duel/$code, never a query), game id and round number while one is on screen;
 *  - the release (the build's commit) and environment.
 *
 * Never: a user id, display names, chat, answers, puzzles, request bodies, cookies, breadcrumbs.
 * Performance sampling is 0 (no transactions are ever sent).
 *
 * Errors from a game round must still let the round finish: this only observes. It never prevents an
 * error's default handling, never rethrows, never waits, and every step is wrapped so a failure here
 * (a blocked request, a bad DSN) is swallowed. At most MAX_EVENTS reports per page load, each distinct
 * error once.
 */
import { betaValue } from "@/lib/beta/betaValues";
import { APP_BUILD_ID } from "@/lib/appVersion";

/** Reports per page load, at most. */
export const MAX_EVENTS = 20;
/** The longest message or frame list kept. */
const MAX_MESSAGE = 500;
const MAX_FRAMES = 50;

export interface CrashContext {
  /** The game on screen (a PuzzleType id), or null. */
  gameId: string | null;
  /** The round number in a room, daily or challenge (null in practice or off a round). */
  round: number | null;
}

export interface SentryDsn {
  /** The envelope endpoint, with the public key in the query (no headers, so no CORS preflight). */
  endpoint: string;
  publicKey: string;
  projectId: string;
}

/** "https://<key>@<host>/<project>" → the envelope endpoint; null for anything else. */
export function parseDsn(dsn: string): SentryDsn | null {
  try {
    const url = new URL(dsn.trim());
    const projectId = url.pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    const prefix = url.pathname.replace(/\/+$/, "").split("/").slice(0, -1).join("/");
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.username || !/^\d+$/.test(projectId)) return null;
    const publicKey = decodeURIComponent(url.username);
    return {
      endpoint: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/?sentry_key=${encodeURIComponent(publicKey)}&sentry_version=7&sentry_client=${SDK_NAME}%2F${SDK_VERSION}`,
      publicKey,
      projectId,
    };
  } catch {
    return null;
  }
}

const SDK_NAME = "joulz.crash";
const SDK_VERSION = "1.0.0";

/** The release: the build's commit (vite.config.ts's id is "<commit>-<time>"; "dev" outside a build). */
export function releaseName(buildId: string = APP_BUILD_ID): string {
  return `joulz@${buildId.split("-")[0] || buildId}`;
}

/** A route as a pattern: no room or challenge code, no query, no hash. */
export function routePattern(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || "/";
  if (/^\/duel\/[^/]+/.test(path)) return "/duel/$code";
  return path.length > 60 ? path.slice(0, 60) : path;
}

/** iPhone / iPad / Android phone / Android tablet / desktop / other, from the user agent. */
export function deviceType(ua: string, touchPoints = 0): string {
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "ipad";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "android-phone" : "android-tablet";
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return "desktop";
  return "other";
}

export interface StackFrame {
  function?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
}

/** V8 ("at fn (url:1:2)") and JavaScriptCore / SpiderMonkey ("fn@url:1:2") stacks, oldest call first. */
export function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split("\n").slice(0, MAX_FRAMES + 1)) {
    const v8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    const jsc = v8 ? null : /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/.exec(line);
    const m = v8 ?? jsc;
    if (!m) continue;
    const filename = m[2]!.replace(/[?#].*$/, "");
    frames.push({
      function: m[1] || "?",
      filename,
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !/\/node_modules\/|\/deps\//.test(filename),
    });
  }
  return frames.reverse();
}

export interface EventInput {
  error: unknown;
  mechanism: "onerror" | "onunhandledrejection" | "react_error_boundary";
  context: CrashContext;
  device: {
    ua: string;
    touchPoints: number;
    screen: string;
    viewport: string;
    standalone: boolean;
  };
  route: string;
  release: string;
  environment: string;
  eventId: string;
  now: number;
}

/** The Sentry event for one error: only the fields listed at the top of this file. */
export function buildEvent(input: EventInput): Record<string, unknown> {
  const { error } = input;
  const isError = error instanceof Error;
  const type = isError
    ? error.name || "Error"
    : input.mechanism === "onunhandledrejection"
      ? "UnhandledRejection"
      : "Error";
  const raw = isError ? error.message : typeof error === "string" ? error : "Non-Error thrown";
  const value = raw.length > MAX_MESSAGE ? `${raw.slice(0, MAX_MESSAGE)}…` : raw;
  const frames = parseStack(isError ? error.stack : undefined);
  const tags: Record<string, string> = {
    device: deviceType(input.device.ua, input.device.touchPoints),
    screen: input.device.screen,
    viewport: input.device.viewport,
    display: input.device.standalone ? "home-screen-app" : "browser",
    route: input.route,
  };
  if (input.context.gameId) tags["game"] = input.context.gameId;
  if (input.context.round !== null) tags["round"] = String(input.context.round);
  return {
    event_id: input.eventId,
    timestamp: input.now / 1000,
    platform: "javascript",
    level: "error",
    logger: "javascript",
    release: input.release,
    environment: input.environment,
    exception: {
      values: [
        {
          type,
          value,
          ...(frames.length ? { stacktrace: { frames } } : {}),
          mechanism: { type: input.mechanism, handled: input.mechanism === "react_error_boundary" },
        },
      ],
    },
    tags,
    request: { url: input.route },
    sdk: { name: SDK_NAME, version: SDK_VERSION },
  };
}

/** The envelope body: header, item header, event. */
export function envelope(event: Record<string, unknown>, dsn: string, now: number): string {
  return [
    JSON.stringify({
      event_id: event["event_id"],
      sent_at: new Date(now).toISOString(),
      dsn,
      sdk: { name: SDK_NAME, version: SDK_VERSION },
    }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

/* ------------------------------------------------------------------ the running reporter */

let context: CrashContext = { gameId: null, round: null };
let active: {
  dsn: string;
  parsed: SentryDsn;
  sent: number;
  seen: Set<string>;
  stop: () => void;
} | null = null;
/** What the reporter sent (beta-extras-check reads it through window.__duelzCrashLog in dev only). */
const sentLog: Record<string, unknown>[] = [];

/** The game and round on screen (room, practice, daily, challenge); null fields when off a round. */
export function setCrashContext(next: Partial<CrashContext>): void {
  context = { ...context, ...next };
}

export function crashContext(): CrashContext {
  return context;
}

function eventId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    let id = "";
    for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
    return id;
  }
}

function environment(): string {
  try {
    return import.meta.env?.DEV ? "development" : "production";
  } catch {
    return "production";
  }
}

/** Sends one error, if reporting is on; never throws. */
export function reportCrash(
  error: unknown,
  mechanism: EventInput["mechanism"] = "react_error_boundary",
): void {
  try {
    if (!active || active.sent >= MAX_EVENTS) return;
    const key =
      `${error instanceof Error ? `${error.name}:${error.message}:${error.stack ?? ""}` : String(error)}`.slice(
        0,
        2000,
      );
    if (active.seen.has(key)) return;
    active.seen.add(key);
    active.sent++;
    const now = Date.now();
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const event = buildEvent({
      error,
      mechanism,
      context,
      device: {
        ua: nav.userAgent,
        touchPoints: nav.maxTouchPoints ?? 0,
        screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        standalone:
          nav.standalone === true ||
          (window.matchMedia?.("(display-mode: standalone)").matches ?? false),
      },
      route: routePattern(window.location.pathname),
      release: releaseName(),
      environment: environment(),
      eventId: eventId(),
      now,
    });
    sentLog.push(event);
    const body = envelope(event, active.dsn, now);
    void fetch(active.parsed.endpoint, {
      method: "POST",
      body,
      keepalive: body.length < 60_000,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      credentials: "omit",
      referrerPolicy: "origin",
    }).catch(() => undefined);
  } catch {
    /* reporting never gets in the way */
  }
}

/**
 * Starts reporting when SENTRY_DSN is set (once per page load); returns whether it is on. With the DSN
 * empty or malformed it does nothing at all.
 */
export function startCrashReporting(): boolean {
  if (typeof window === "undefined") return false;
  if (active) return true;
  const dsn = betaValue("SENTRY_DSN");
  if (!dsn) return false;
  const parsed = parseDsn(dsn);
  if (!parsed) return false;
  const onError = (event: ErrorEvent) => reportCrash(event.error ?? event.message, "onerror");
  const onRejection = (event: PromiseRejectionEvent) =>
    reportCrash(event.reason, "onunhandledrejection");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  active = {
    dsn,
    parsed,
    sent: 0,
    seen: new Set(),
    stop: () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    },
  };
  if (environment() === "development")
    (window as unknown as { __duelzCrashLog?: unknown }).__duelzCrashLog = sentLog;
  return true;
}

export function crashReportingOn(): boolean {
  return active !== null;
}

/** Test hook: stop and forget. */
export function stopCrashReporting(): void {
  active?.stop();
  active = null;
  sentLog.length = 0;
  context = { gameId: null, round: null };
}
