/**
 * Minigolf golfRev 2's bank (crazy golf, 31 Oct 2026): 60 courses (of 60 candidates) whose five holes the putt
 * search (scripts/minigolf-oracle.ts) holed on the sim's clock (windmills, tunnels, sand, hills and banked curves all
 * in the roll), each with its pars (the best route found + 1, so a birdie is always possible). Every course's witness
 * run (scripts/fixtures/minigolf-witness-v2.json; putts after waits where a windmill's sails are in the way) scores
 * exactly 200 through the server's replay (minigolf-check). Built by `bun scripts/minigolf-bank.ts --rev=2`. Server-only.
 */
import type { MinigolfBankEntry } from "./minigolfBank.server";

export const MINIGOLF_BANK_V2: readonly MinigolfBankEntry[] = [
  { seed: 1615068734, pars: [3, 4, 4, 3, 5] },
  { seed: 222701708, pars: [3, 4, 4, 4, 5] },
  { seed: 2127204308, pars: [3, 4, 4, 4, 5] },
  { seed: 1938284486, pars: [3, 4, 4, 3, 5] },
  { seed: 1041078602, pars: [3, 4, 4, 3, 5] },
  { seed: 1036217956, pars: [3, 4, 4, 4, 5] },
  { seed: 1379934492, pars: [3, 4, 4, 4, 5] },
  { seed: 338152316, pars: [3, 4, 4, 3, 5] },
  { seed: 225482398, pars: [3, 4, 4, 3, 5] },
  { seed: 283069829, pars: [3, 4, 4, 4, 5] },
  { seed: 1627070266, pars: [3, 4, 4, 4, 5] },
  { seed: 1408404728, pars: [3, 4, 4, 3, 5] },
  { seed: 1517326372, pars: [3, 4, 4, 3, 5] },
  { seed: 1791204476, pars: [3, 4, 4, 3, 5] },
  { seed: 1847009540, pars: [3, 4, 4, 3, 5] },
  { seed: 177836366, pars: [3, 4, 4, 3, 5] },
  { seed: 1558959460, pars: [3, 4, 4, 3, 5] },
  { seed: 1664362077, pars: [3, 4, 4, 3, 5] },
  { seed: 1495948892, pars: [3, 4, 4, 3, 5] },
  { seed: 1134470069, pars: [3, 4, 4, 3, 5] },
  { seed: 1318269280, pars: [3, 4, 4, 3, 5] },
  { seed: 1029936637, pars: [3, 4, 4, 3, 5] },
  { seed: 1167674710, pars: [3, 4, 4, 3, 5] },
  { seed: 170278734, pars: [3, 4, 4, 3, 5] },
  { seed: 1842109216, pars: [3, 4, 4, 3, 5] },
  { seed: 1423319548, pars: [3, 4, 4, 3, 5] },
  { seed: 1712726937, pars: [3, 4, 4, 3, 5] },
  { seed: 637982043, pars: [3, 4, 4, 3, 5] },
  { seed: 1529745595, pars: [3, 4, 4, 3, 5] },
  { seed: 1480018152, pars: [3, 4, 4, 4, 5] },
  { seed: 1723152251, pars: [3, 4, 4, 3, 5] },
  { seed: 358737207, pars: [3, 4, 4, 3, 5] },
  { seed: 1132835319, pars: [3, 4, 4, 3, 5] },
  { seed: 97349270, pars: [3, 4, 4, 4, 5] },
  { seed: 1703154089, pars: [3, 4, 4, 4, 5] },
  { seed: 2135085270, pars: [3, 4, 4, 4, 5] },
  { seed: 1695140726, pars: [3, 4, 4, 3, 5] },
  { seed: 1166689477, pars: [3, 4, 4, 4, 5] },
  { seed: 1632857235, pars: [3, 4, 4, 3, 5] },
  { seed: 295586184, pars: [3, 4, 4, 4, 5] },
  { seed: 518843252, pars: [3, 4, 4, 3, 5] },
  { seed: 1926786346, pars: [3, 3, 4, 3, 5] },
  { seed: 1735067269, pars: [3, 4, 4, 3, 5] },
  { seed: 1062433160, pars: [3, 4, 4, 3, 5] },
  { seed: 475380648, pars: [3, 4, 4, 3, 5] },
  { seed: 1062737219, pars: [3, 4, 4, 3, 5] },
  { seed: 1513897628, pars: [3, 4, 4, 3, 5] },
  { seed: 1007163738, pars: [3, 4, 4, 4, 5] },
  { seed: 214775396, pars: [3, 4, 4, 4, 5] },
  { seed: 1287000073, pars: [3, 4, 4, 4, 5] },
  { seed: 1628833544, pars: [3, 4, 4, 3, 5] },
  { seed: 71084682, pars: [3, 4, 4, 4, 5] },
  { seed: 155954226, pars: [3, 4, 4, 4, 5] },
  { seed: 850615759, pars: [3, 4, 4, 4, 5] },
  { seed: 271842921, pars: [3, 4, 4, 3, 5] },
  { seed: 263107229, pars: [3, 4, 4, 3, 5] },
  { seed: 303722513, pars: [3, 4, 4, 3, 5] },
  { seed: 2055453993, pars: [3, 4, 4, 3, 5] },
  { seed: 1725932719, pars: [3, 4, 4, 3, 5] },
  { seed: 1067782959, pars: [3, 4, 4, 3, 5] },
];

/** The skill-band tool's seed index n → a golfRev 2 bank course (fresh seeds from 10000 start past the tuning set). */
export function minigolfBankV2EntryFor(n: number): MinigolfBankEntry {
  const len = MINIGOLF_BANK_V2.length;
  const half = Math.floor(len / 2);
  return n < 10000 ? MINIGOLF_BANK_V2[n % half]! : MINIGOLF_BANK_V2[half + ((n - 10000) % (len - half))]!;
}
