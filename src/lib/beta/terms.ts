/**
 * The beta terms (/terms, 22 Oct 2026): shown once on this device before its first room, daily or
 * challenge, with I AGREE. The agreement is kept on the device (the date it was given, and which
 * terms) and recorded once with the beta events (terms_events, recordTermsAgreedFn), fire-and-forget.
 *
 * Storage as the first-time intro (onboarding.ts): localStorage, then sessionStorage, then memory, so
 * blocked storage asks at most once a session and never stops anyone playing.
 */
export const TERMS_KEY = "duelz-terms:v1";
/** Raise when the terms change in a way players must agree to again. */
export const TERMS_VERSION = 1;

export interface TermsAgreement {
  version: number;
  /** When I AGREE was tapped (ISO). */
  agreedAt: string;
}

let memory: TermsAgreement | null = null;

function parse(raw: string | null): TermsAgreement | null {
  try {
    const value = JSON.parse(raw ?? "null") as TermsAgreement | null;
    return value && value.version === TERMS_VERSION && typeof value.agreedAt === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

function read(storage: () => Storage): TermsAgreement | null {
  try {
    return parse(storage().getItem(TERMS_KEY));
  } catch {
    return null;
  }
}

/** This device's agreement to the current terms, or null. */
export function termsAgreement(): TermsAgreement | null {
  if (typeof window === "undefined") return null;
  return memory ?? read(() => window.localStorage) ?? read(() => window.sessionStorage);
}

export function termsAgreed(): boolean {
  return termsAgreement() !== null;
}

/** I AGREE: kept on the device and recorded once with the beta events. */
export function agreeToTerms(
  record: (agreement: TermsAgreement) => void = sendTermsAgreed,
  now: Date = new Date(),
): TermsAgreement {
  const agreement: TermsAgreement = { version: TERMS_VERSION, agreedAt: now.toISOString() };
  memory = agreement;
  if (typeof window !== "undefined") {
    const text = JSON.stringify(agreement);
    const write = (storage: () => Storage) => {
      try {
        storage().setItem(TERMS_KEY, text);
        return storage().getItem(TERMS_KEY) === text;
      } catch {
        return false;
      }
    };
    if (!write(() => window.localStorage)) write(() => window.sessionStorage);
  }
  record(agreement);
  return agreement;
}

/** Sends the agreement to the beta events; never throws, never waits. */
export function sendTermsAgreed(agreement: TermsAgreement): void {
  void (async () => {
    try {
      const { ensureSession } = await import("@/lib/duel/session");
      await ensureSession();
      const { recordTermsAgreedFn } = await import("@/lib/beta/terms.functions");
      await recordTermsAgreedFn({ data: agreement });
    } catch {
      /* beta counts never get in the way */
    }
  })();
}

/** Test hook: forget the in-memory copy. */
export function resetTermsMemory(): void {
  memory = null;
}
