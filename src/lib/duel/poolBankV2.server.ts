/**
 * Cue Ball poolRev 2's bank (what rooms deal): 60 layouts (of 60 candidates) the shot search
 * (scripts/pool-oracle.ts, on poolRev 2's continuous spin) cleared without a miss or a foul (seven spots, then the
 * black). Every layout's witness run (scripts/fixtures/pool-witness-v2.json, poolRev 2's input: power in c, the spin
 * dot in d) scores exactly 200 through the server's replay on poolRev 2 (pool-check). Built by
 * `bun scripts/pool-bank.ts --rev=2`. Server-only.
 */
export const POOL_BANK_V2: readonly number[] = [291005263,2014399686,825568924,855957879,375698285,1583049006,928676175,582076058,1852014459,1501270001,184392086,638308239,1013219936,1607094698,1733390373,708015085,1065007826,657288358,1956676680,2098028836,635750602,1668979796,1313370934,1315925082,212107984,1512584765,1044955457,1724429715,1153387088,736020618,1128294945,583898984,477084638,153059479,1236791359,1716251025,1197473427,231797883,1719686143,1265396467,1066963397,1552559434,697382421,1893021695,1183340151,2048639558,1021628209,314419657,940077682,1190475946,1567163881,1118253229,1429214115,679721931,2137136729,1148916645,411241225,762074398,144852543,563517936];

/** The skill-band tool's seed index n → a poolRev 2 bank seed (fresh seeds from 10000 start past the first 30). */
export function poolBankV2SeedFor(n: number): number {
  const len = POOL_BANK_V2.length;
  return n < 10000 ? POOL_BANK_V2[n % len]! : POOL_BANK_V2[30 + ((n - 10000) % (len - 30))]!;
}
