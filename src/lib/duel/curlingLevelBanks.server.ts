/**
 * Curl Champ's level banks (the Sports overhaul, 15 Nov 2026; curlRev 4): for Easy (30 of 170 candidates),
 * Hard (30 of 80) and Expert (30 of 90), the seeds whose level's red stones
 * (CURL_LEVEL_REDS, curlingOpponentsAt) the oracle (scripts/curling-oracle.ts) played out of the house with every one of
 * eight stones coming to rest on the button and counting, scoring 200 through the server's replay on curlRev 4 at that
 * level. Normal deals from curlingBankV4.server.ts, as before. Built by `bun scripts/curling-bank.ts --level=<level>`;
 * `--check` and curling-levels-check replay the proofs (scripts/fixtures/curling-witness-levels.json).
 * Server-only.
 */
export const CURLING_LEVEL_BANKS: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
  easy: [884939642,1452316523,430645375,669530339,1167573130,365889297,1549499489,939816632,1407573438,1379059285,1965298269,391643822,2051658594,389638394,149037603,632363611,386126155,857747373,1674927401,1561276199,88042972,1993443046,1776292581,52154058,1440131196,380588089,1012515124,68300605,1133963013,601172041],
  hard: [1544752305,136840374,613643393,64808774,1735393135,456314253,756921319,882877463,1826577348,1924994268,1707089234,456344664,1560559695,1068375808,130099508,1076834799,196055188,1878262862,1223037669,552966190,301748177,274942324,272087111,402368320,1909413702,1744017562,1050035523,998119587,1893555752,1510519082],
  expert: [1148992429,1770118687,2093762309,1053699480,1132660777,1471813589,1211401299,1368518666,2123852630,156865439,1067324615,258891060,366791506,1036369028,281860683,1726034549,532481230,769108876,1464708652,1722804189,1844069983,2061069105,1395106421,280906664,1267086067,985435351,476333723,668983263,1797073985,150602263],
};

/** The skill-band tool's seed index n → a level's bank seed (as curlingBankV4SeedFor: tuning 0–29 from the start, fresh from the 31st). */
export function curlingLevelSeedFor(level: "easy" | "hard" | "expert", n: number): number {
  const bank = CURLING_LEVEL_BANKS[level];
  const len = bank.length;
  return n < 10000 ? bank[n % len]! : bank[Math.min(30, len - 1) + ((n - 10000) % Math.max(1, len - Math.min(30, len - 1)))]!;
}
