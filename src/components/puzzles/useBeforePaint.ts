import { useEffect, useLayoutEffect } from "react";

/**
 * A layout effect in the browser (it runs, and any state it sets renders, before the first
 * paint), a plain effect on the server. Boards that size themselves from their container
 * measure through it, so their first painted frame is already their final size and place
 * (16 Oct 2026, display only; scripts/first-paint-check.ts proves it).
 */
export const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;
