/**
 * Records scripts/fixtures/deal-identity.json.gz (scripts/deal-identity-lib.ts): every game's deal across seeds, under
 * no pin and each check pin, and whole rooms. Recorded on main 318fd42 before the deal moved into one place (B4);
 * deal-identity-check proves today's tree deals the same. Re-record only for a deliberate deal change. Changed with
 * Joe's approval, 13 Nov 2026: the 16 whole rooms re-recorded (--rooms) after nine games retired and Minefield and
 * Tenfall moved; every deal is still main's (dealDigest pins minesPreLogic).
 *
 *   bun scripts/deal-identity-record.ts           (everything, ~6 min)
 *   bun scripts/deal-identity-record.ts --rooms   (the whole rooms only)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { FIXTURE, SEEDS, dealIdentity, roomDigests, type DealIdentity } from "./deal-identity-lib";

// --rooms re-records only the whole rooms, keeping the deals already recorded.
const result: DealIdentity = process.argv.includes("--rooms")
  ? { deals: (JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as DealIdentity).deals, rooms: roomDigests(SEEDS.roomSeeds) }
  : dealIdentity({ ...SEEDS, log: (s) => console.log(s) });
writeFileSync(FIXTURE, gzipSync(JSON.stringify(result)));
console.log(`wrote ${FIXTURE}: ${Object.keys(result.deals).length} deals, ${Object.keys(result.rooms).length} rooms`);
