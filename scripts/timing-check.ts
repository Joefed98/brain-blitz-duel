/**
 * Checks the rule that decides which elapsed time is recorded: a player's own
 * measurement is kept, and only an impossible claim is pulled back to what the
 * server itself could have seen.
 */
import { TIME_CLAIM_TOLERANCE_MS, trustedMsRemaining } from "../src/lib/duel/grade";

const LIMIT = 30_000;
const cases: { name: string; claim: number; server: number; want: number; clamped: boolean }[] = [
  { name: "fast link, honest claim", claim: 24_300, server: 24_250, want: 24_300, clamped: false },
  { name: "slow link, 1.2s behind", claim: 24_300, server: 23_100, want: 24_300, clamped: false },
  { name: "exactly at tolerance", claim: 20_000, server: 20_000 - TIME_CLAIM_TOLERANCE_MS, want: 20_000, clamped: false },
  { name: "impossible claim", claim: 29_000, server: 12_000, want: 12_000, clamped: true },
  { name: "over the limit", claim: 45_000, server: 29_500, want: 30_000, clamped: false },
  { name: "negative claim", claim: -500, server: 100, want: 0, clamped: false },
  { name: "nonsense claim", claim: Number.NaN, server: 5_000, want: 0, clamped: false },
  { name: "timed out", claim: 0, server: 0, want: 0, clamped: false },
];

for (const c of cases) {
  const got = trustedMsRemaining(c.claim, c.server, LIMIT);
  if (got.ms !== c.want || got.clamped !== c.clamped) {
    throw new Error(`${c.name}: got ${got.ms}ms clamped=${got.clamped}, wanted ${c.want}ms clamped=${c.clamped}`);
  }
}

// The earlier tap always keeps the higher remaining time, so it wins the round.
const early = trustedMsRemaining(21_400, 21_000, LIMIT).ms;
const late = trustedMsRemaining(20_900, 20_100, LIMIT).ms;
if (!(early > late)) throw new Error("the earlier tap did not order ahead");

console.log(`${cases.length} timing cases OK · earlier tap ordered first (${early}ms > ${late}ms)`);
