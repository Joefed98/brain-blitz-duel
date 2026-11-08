/**
 * Timeouts and retries for the app's server calls (8 Nov 2026, item 6 of docs/audit-nov-2026/performance.md;
 * network timing only, no game's rules, scoring or stamps).
 *
 * Before this nothing in the app set a timeout: a request that stalled on a weak signal (no error, no reply)
 * stayed "sending" for good, so the room's answer sender (roomSend.ts), which retries only a send that
 * fails, never sent it again, and the room screen could wait forever on the clock's first measurement.
 *
 * Every call now has a time limit (`POLICIES`): past it the request is aborted and fails like a dropped
 * one. Only calls the server answers the same way however often they arrive are retried here (`read`);
 * an answer is retried by the room's sender, since the server keeps one row per player per round and
 * answers a duplicate "already stored" (server-functions-check proves it); writes that must never be
 * sent twice blindly (create, join, start, Play again) get the time limit only.
 *
 * A dev server compiles modules on a call's first use, so its limits are DEV_SCALE times longer.
 */

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`request timed out after ${ms} ms`);
    this.name = "RequestTimeoutError";
  }
}

export interface RequestPolicy {
  /** Abort a try after this long, ms (production; DEV_SCALE times this on a dev server). */
  timeoutMs: number;
  /** Tries in all (1: no retry). */
  attempts: number;
}

export const POLICIES = {
  /** A read, or a check the server answers the same way twice (room preview, reveal, word and move checks). */
  read: { timeoutMs: 8_000, attempts: 3 },
  /** The clock: one sample (clock.ts takes three, and drops slow ones). */
  clock: { timeoutMs: 3_000, attempts: 1 },
  /** An answer: retried by the room's sender (roomSend.ts), never here. */
  submit: { timeoutMs: 10_000, attempts: 1 },
  /** The 4 s presence beat: the next one follows. */
  heartbeat: { timeoutMs: 5_000, attempts: 1 },
  /** Phase steps, READY and Continue: each phone asks again on its own schedule. */
  step: { timeoutMs: 8_000, attempts: 1 },
  /**
   * Every other server call (createStart's default): a time limit, no retry. Generous, so a slow but working
   * call (a grade or a deal on a busy or cold server) is never cut off; it only ends a request that hangs.
   */
  standard: { timeoutMs: 60_000, attempts: 1 },
  /**
   * Background work nobody waits on (offline practice's pack deals: up to 10 deals for several games a call,
   * which a loaded server can take well over a minute to deal). A cut-off call stops the top-up until the next
   * sync, so its limit only catches a request that will never answer.
   */
  background: { timeoutMs: 180_000, attempts: 1 },
} as const satisfies Record<string, RequestPolicy>;

/** Waits before each retry, ms (the last repeats). */
export const RETRY_BACKOFF_MS = [300, 900] as const;
/** Gateway answers worth another try on a read (the request never reached the app, or timed out on the way). */
const RETRY_STATUS = new Set([408, 502, 503, 504]);
const DEV_SCALE = 6;

function isDev(): boolean {
  try {
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

/** The limit applied for a policy here (longer on a dev server). */
export function effectiveTimeoutMs(policy: RequestPolicy): number {
  return isDev() ? policy.timeoutMs * DEV_SCALE : policy.timeoutMs;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const backoffFor = (attempt: number) => RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length) - 1]!;

/**
 * An AbortSignal that fires after `ms` (and when `parent` fires). `clear` stops the timer once the work is done.
 * The timeout reason is a RequestTimeoutError, so a caller can tell it from its own abort.
 */
export function timeoutSignal(ms: number, parent?: AbortSignal | null): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new RequestTimeoutError(ms)), ms);
  const onParent = () => controller.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) controller.abort(parent.reason);
    else parent.addEventListener("abort", onParent, { once: true });
  }
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParent);
    },
  };
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * A fetch with the policy's time limit on each try, retried (after RETRY_BACKOFF_MS) when a try throws (no
 * signal, the limit passed) or a gateway answers 408/502/503/504, up to `attempts`. The time limit covers the
 * whole response, body included. The caller's own abort is never retried.
 */
export function policyFetch(policy: RequestPolicy, base: FetchLike = (input, init) => fetch(input, init)): typeof fetch {
  const limit = () => effectiveTimeoutMs(policy);
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= policy.attempts; attempt++) {
      const parent = init?.signal ?? null;
      if (parent?.aborted) throw parent.reason ?? new DOMException("Aborted", "AbortError");
      const ms = limit();
      const { signal, clear } = timeoutSignal(ms, parent);
      try {
        const response = await base(input, { ...init, signal });
        if (attempt < policy.attempts && RETRY_STATUS.has(response.status)) {
          clear();
          lastError = new Error(`HTTP ${response.status}`);
          await wait(backoffFor(attempt));
          continue;
        }
        // The limit stays on while the body is read (a body that stalls is aborted too); once it has been read,
        // the timer firing does nothing.
        return response;
      } catch (error) {
        clear();
        if (parent?.aborted) throw error;
        lastError = signal.aborted && signal.reason instanceof RequestTimeoutError ? signal.reason : error;
        if (attempt >= policy.attempts) throw lastError;
        await wait(backoffFor(attempt));
      }
    }
    throw lastError ?? new Error("request failed");
  }) as typeof fetch;
}

/** Fetches for each policy, made once. */
const FETCHES = new Map<RequestPolicy, typeof fetch>();
export function fetchFor(policy: RequestPolicy): typeof fetch {
  let f = FETCHES.get(policy);
  if (!f) {
    f = policyFetch(policy);
    FETCHES.set(policy, f);
  }
  return f;
}

/** A promise that rejects with RequestTimeoutError after `ms` (for work that isn't a fetch, like a check's stand-in). */
export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeoutError(ms)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * A Supabase read (PostgREST through supabase-js) with the read policy: each try under its own time limit
 * (`.abortSignal`), tried again when it failed on the way (supabase-js reports a dropped or aborted request as
 * an error with no code; an answer from the database, an RLS refusal included, has one and is returned as is).
 */
export async function supabaseRead<T extends { error: { code?: string; message: string } | null }>(
  run: (signal: AbortSignal) => PromiseLike<T>,
  policy: RequestPolicy = POLICIES.read,
): Promise<T> {
  let result: T | null = null;
  for (let attempt = 1; attempt <= policy.attempts; attempt++) {
    const ms = effectiveTimeoutMs(policy);
    const { signal, clear } = timeoutSignal(ms);
    try {
      // The abort ends the request itself; the deadline ends the wait even where a query can't be aborted.
      result = await withDeadline(Promise.resolve(run(signal)), ms + 250);
    } catch (error) {
      result = { data: null, error: { code: "", message: String(error) } } as unknown as T;
    } finally {
      clear();
    }
    const failedOnTheWay = !!result.error && !result.error.code;
    if (!failedOnTheWay || attempt >= policy.attempts) return result;
    await wait(backoffFor(attempt));
  }
  return result!;
}

/** A query builder with this signal attached where it takes one (supabase-js's `.abortSignal`). */
export function abortable<Q>(query: Q, signal: AbortSignal): Q {
  const q = query as Q & { abortSignal?: (signal: AbortSignal) => Q };
  return typeof q.abortSignal === "function" ? q.abortSignal(signal) : query;
}
