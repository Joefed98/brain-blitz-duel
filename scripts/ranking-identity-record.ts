/**
 * Records scripts/fixtures/ranking-identity.json.gz (scripts/ranking-identity-lib.ts). Recorded on main 318fd42, before
 * ranking moved into ranking.ts (B3); ranking-identity-check proves today's tree ranks the same.
 *
 *   bun scripts/ranking-identity-record.ts
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { COUNTS, FIXTURE, rankingIdentity } from "./ranking-identity-lib";

const out = rankingIdentity(COUNTS.rooms, COUNTS.boards);
writeFileSync(FIXTURE, gzipSync(JSON.stringify(out)));
console.log(`wrote ${FIXTURE}: ${Object.keys(out).length} digests`);
