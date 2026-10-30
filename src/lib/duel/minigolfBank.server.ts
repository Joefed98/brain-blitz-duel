/**
 * Minigolf golfRev 1's bank: 60 courses (of 60 candidates) whose five holes the putt search
 * (scripts/minigolf-oracle.ts) holed, each with its pars (the best route found + 1, so a birdie is always possible).
 * Every course's witness run (scripts/fixtures/minigolf-witness.json) scores exactly 200 through the server's replay
 * (minigolf-check). Built by `bun scripts/minigolf-bank.ts`. Server-only.
 */
export interface MinigolfBankEntry {
  seed: number;
  pars: readonly number[];
}

export const MINIGOLF_BANK: readonly MinigolfBankEntry[] = [
  { seed: 1834104593, pars: [2, 3, 3, 3, 3] },
  { seed: 741658096, pars: [2, 3, 3, 3, 3] },
  { seed: 593034903, pars: [2, 3, 3, 3, 3] },
  { seed: 1142142836, pars: [2, 3, 3, 3, 3] },
  { seed: 1557653253, pars: [2, 3, 3, 3, 3] },
  { seed: 94287276, pars: [2, 3, 3, 3, 3] },
  { seed: 1431726240, pars: [2, 3, 3, 3, 3] },
  { seed: 137916898, pars: [2, 3, 3, 3, 3] },
  { seed: 1869974568, pars: [2, 3, 3, 3, 3] },
  { seed: 1896279866, pars: [2, 3, 3, 3, 3] },
  { seed: 158245631, pars: [2, 3, 3, 3, 3] },
  { seed: 841733507, pars: [2, 3, 3, 3, 3] },
  { seed: 1867779700, pars: [2, 3, 3, 3, 3] },
  { seed: 715968833, pars: [2, 3, 3, 3, 3] },
  { seed: 1909116820, pars: [2, 3, 3, 3, 3] },
  { seed: 1240646970, pars: [2, 3, 3, 3, 3] },
  { seed: 1300961734, pars: [2, 3, 3, 3, 3] },
  { seed: 1234557694, pars: [2, 3, 3, 3, 3] },
  { seed: 73020315, pars: [2, 3, 3, 3, 3] },
  { seed: 84428219, pars: [2, 3, 3, 3, 3] },
  { seed: 1091214458, pars: [2, 3, 3, 3, 3] },
  { seed: 1476846668, pars: [2, 3, 3, 3, 3] },
  { seed: 1645040393, pars: [2, 3, 3, 3, 3] },
  { seed: 11699647, pars: [2, 3, 3, 3, 3] },
  { seed: 828524019, pars: [2, 3, 3, 3, 3] },
  { seed: 733997558, pars: [2, 3, 3, 3, 3] },
  { seed: 1383080477, pars: [2, 3, 3, 3, 3] },
  { seed: 558462801, pars: [2, 3, 3, 3, 3] },
  { seed: 473492209, pars: [2, 3, 3, 3, 3] },
  { seed: 816466973, pars: [2, 3, 3, 3, 3] },
  { seed: 1346283874, pars: [2, 3, 3, 3, 3] },
  { seed: 1655784963, pars: [2, 3, 3, 3, 3] },
  { seed: 666908039, pars: [2, 3, 3, 3, 3] },
  { seed: 630708, pars: [2, 3, 3, 3, 3] },
  { seed: 1317163706, pars: [2, 3, 3, 3, 3] },
  { seed: 1707216963, pars: [2, 3, 3, 3, 3] },
  { seed: 1226130240, pars: [2, 3, 3, 3, 3] },
  { seed: 1963347125, pars: [2, 3, 3, 3, 3] },
  { seed: 181503920, pars: [2, 3, 3, 3, 3] },
  { seed: 1943533677, pars: [2, 3, 3, 3, 3] },
  { seed: 249284447, pars: [2, 3, 3, 3, 3] },
  { seed: 1390255051, pars: [2, 3, 3, 3, 3] },
  { seed: 16190363, pars: [2, 3, 3, 3, 3] },
  { seed: 1842905728, pars: [2, 3, 3, 3, 3] },
  { seed: 803174884, pars: [2, 3, 3, 3, 3] },
  { seed: 1423485031, pars: [2, 3, 3, 3, 3] },
  { seed: 17653373, pars: [2, 3, 3, 3, 3] },
  { seed: 967856391, pars: [2, 3, 3, 3, 3] },
  { seed: 1458392780, pars: [2, 3, 3, 3, 3] },
  { seed: 300230390, pars: [2, 3, 3, 3, 3] },
  { seed: 808723543, pars: [2, 3, 3, 3, 3] },
  { seed: 687997470, pars: [2, 3, 3, 3, 3] },
  { seed: 629518023, pars: [2, 3, 3, 3, 3] },
  { seed: 1093353849, pars: [2, 3, 3, 3, 3] },
  { seed: 505768401, pars: [2, 3, 3, 3, 3] },
  { seed: 262677405, pars: [2, 3, 3, 3, 3] },
  { seed: 986379985, pars: [2, 3, 3, 3, 3] },
  { seed: 848524250, pars: [2, 3, 3, 3, 3] },
  { seed: 1636709063, pars: [2, 3, 3, 3, 3] },
  { seed: 656461337, pars: [2, 3, 3, 3, 3] },
];

/** The skill-band tool's seed index n → a bank course (fresh seeds from 10000 start past the tuning set). */
export function minigolfBankEntryFor(n: number): MinigolfBankEntry {
  const len = MINIGOLF_BANK.length;
  const half = Math.floor(len / 2);
  return n < 10000 ? MINIGOLF_BANK[n % half]! : MINIGOLF_BANK[half + ((n - 10000) % (len - half))]!;
}

export const MINIGOLF_HOLE_COUNT = 5;
