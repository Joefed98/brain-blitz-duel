/**
 * Curling curlRev 1's bank: 60 seeds whose opponent stones the oracle (scripts/curling-oracle.ts) played out
 * of the house with every one of eight stones coming to rest on the button, scoring 200 through the server's replay
 * (of 90 candidates). Built by `bun scripts/curling-bank.ts`; `--check` and curling-check replay the
 * proofs (scripts/fixtures/curling-witness.json). Server-only.
 */
export const CURLING_BANK: readonly number[] = [291005263,2014399686,1583049006,582076058,1852014459,1501270001,184392086,638308239,1013219936,1733390373,708015085,1065007826,657288358,2098028836,1668979796,1315925082,1512584765,1724429715,1153387088,736020618,1128294945,583898984,477084638,1236791359,1716251025,1197473427,231797883,1719686143,1265396467,697382421,1893021695,1183340151,2048639558,1021628209,1567163881,1118253229,1429214115,679721931,762074398,563517936,1029645870,1301310243,1385709509,1816846147,163316270,1472041236,860288843,1445606470,755882182,211451192,1073318182,1445033835,795943427,1523253018,1642819834,216063442,766415223,1934075620,164875581,171535316];

/**
 * The skill-band tool's seed index n → a bank seed: the tuning seeds (0–29) are the bank's first 30; the fresh seeds
 * (10000 on) start at its 31st, so the two sets never share a seed.
 */
export function curlingBankSeedFor(n: number): number {
  const len = CURLING_BANK.length;
  return n < 10000 ? CURLING_BANK[n % len]! : CURLING_BANK[30 + ((n - 10000) % (len - 30))]!;
}
