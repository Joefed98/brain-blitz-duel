/**
 * Checks only (never imported by the app): pins games' round maximums inside a screen harness page, so a
 * check comparing a screen with markup recorded while those games were 150 still compares like with like
 * after an expansion raises one (docs/scoring-200.md). The check sets `window.__DUELZ_PIN_ROUND_MAX__`
 * ({ type: max }) in an init script; this module is the harness's first import, so the pin is in place
 * before any app module reads a maximum. Without the global it does nothing.
 */
import { ROUND_MAX } from "../src/lib/duel/roundMax";

const pin = (globalThis as unknown as { __DUELZ_PIN_ROUND_MAX__?: Record<string, number> }).__DUELZ_PIN_ROUND_MAX__;
if (pin) Object.assign(ROUND_MAX as Record<string, number>, pin);
