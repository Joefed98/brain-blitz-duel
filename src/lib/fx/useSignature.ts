import { useEffect, useRef, type RefObject } from "react";

import {
  perfectBurst,
  recentSignatureSubmit,
  scheduleSignature,
  signatureTierForVerdict,
  type SignatureVerdict,
} from "./signature";

/**
 * Rooms and practice: once per round (`key`), when this player's verdict lands,
 * schedule the signature beat it earns, timed from the noted submit moment. A
 * verdict with no recent submit on this phone (a reload mid-reveal) gets none.
 * The beat is not cancelled when the screen changes: it may finish over the reveal.
 */
export function useSignatureVerdict(key: string | null, verdict: SignatureVerdict | null): void {
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!key || !verdict || fired.current === key) return;
    fired.current = key;
    const tier = signatureTierForVerdict(verdict);
    const solvedAt = recentSignatureSubmit(verdict.type);
    if (tier && solvedAt !== null) scheduleSignature(tier, solvedAt);
  }, [key, verdict]);
}

/** The reveal: a stored 150 gets one short gold burst on the score element. */
export function usePerfectBurst(ref: RefObject<HTMLElement | null>, score: number | null): void {
  const burst = useRef(false);
  useEffect(() => {
    if (score !== 150 || burst.current || !ref.current) return;
    burst.current = true;
    perfectBurst(ref.current);
  }, [ref, score]);
}
