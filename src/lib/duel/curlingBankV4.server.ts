/**
 * Curling curlRev 4's bank: 66 seeds whose three red stones the oracle (scripts/curling-oracle.ts, on curlRev 3's
 * weight line, sliding the stone along the near hog line where the centre line was not enough) played out of the house
 * with every one of eight stones coming to rest on the button and counting (nearer than every red in the house),
 * scoring 200 through the server's replay on curlRev 4 (of 140 candidates). Built by
 * `bun scripts/curling-bank.ts --rev=4`; `--check` and curling-check replay the proofs
 * (scripts/fixtures/curling-witness-v4.json). Server-only.
 */
export const CURLING_BANK_V4: readonly number[] = [375698285,1583049006,1852014459,1501270001,1013219936,1607094698,1733390373,1065007826,657288358,1512584765,736020618,1128294945,477084638,153059479,1236791359,1197473427,231797883,1066963397,1183340151,2048639558,1021628209,314419657,940077682,1567163881,679721931,2137136729,411241225,144852543,563517936,1301310243,1385709509,163316270,1472041236,860288843,2046189696,506170091,1073318182,1746072369,795943427,1523253018,171535316,546380159,834923409,109004070,165286061,1002484393,1787895559,398693691,1400093510,272530291,1355872214,1310919481,112297194,140064461,986844115,1263156706,1327100967,1979534937,1781012725,1795042705,1302311481,1515321726,515071045,1908099746,1915636160,1348107385];

/**
 * The skill-band tool's seed index n → a curlRev 4 bank seed: the tuning seeds (0–29) are the bank's first 30; the
 * fresh seeds (10000 on) start at its 31st, so the two sets never share a seed.
 */
export function curlingBankV4SeedFor(n: number): number {
  const len = CURLING_BANK_V4.length;
  return n < 10000 ? CURLING_BANK_V4[n % len]! : CURLING_BANK_V4[30 + ((n - 10000) % (len - 30))]!;
}
