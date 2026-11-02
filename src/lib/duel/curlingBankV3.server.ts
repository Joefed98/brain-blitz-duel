/**
 * Curling curlRev 3's bank: 66 seeds whose opponent stones the oracle (scripts/curling-oracle.ts, on curlRev 3's
 * gentler weight line, sliding the stone along the near hog line where the centre line was not enough) played out of
 * the house with every one of eight stones coming to rest on the button, scoring 200 through the server's replay on
 * curlRev 3 (of 85 candidates). Built by `bun scripts/curling-bank.ts --rev=3`; `--check` and curling-check
 * replay the proofs (scripts/fixtures/curling-witness-v3.json). Server-only.
 */
export const CURLING_BANK_V3: readonly number[] = [291005263,2014399686,1583049006,582076058,1852014459,1501270001,184392086,638308239,1013219936,1607094698,1733390373,708015085,1065007826,657288358,2098028836,1668979796,1315925082,1512584765,1724429715,1153387088,736020618,1128294945,583898984,477084638,1236791359,1716251025,1197473427,231797883,1719686143,1265396467,697382421,1893021695,1183340151,2048639558,1021628209,940077682,1190475946,1567163881,1118253229,1429214115,679721931,411241225,762074398,563517936,1029645870,1301310243,1385709509,1816846147,163316270,1472041236,860288843,1445606470,928818715,755882182,211451192,1073318182,1445033835,795943427,1234267549,1523253018,1642819834,216063442,766415223,1934075620,164875581,171535316];

/**
 * The skill-band tool's seed index n → a curlRev 3 bank seed: the tuning seeds (0–29) are the bank's first 30; the
 * fresh seeds (10000 on) start at its 31st, so the two sets never share a seed.
 */
export function curlingBankV3SeedFor(n: number): number {
  const len = CURLING_BANK_V3.length;
  return n < 10000 ? CURLING_BANK_V3[n % len]! : CURLING_BANK_V3[30 + ((n - 10000) % (len - 30))]!;
}
