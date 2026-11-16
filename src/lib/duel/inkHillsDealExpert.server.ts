/**
 * Rainbow Bridge's expert deal (inkRev 15 at level "expert", the Strategy overhaul's stage 3; built by
 * `bun scripts/ink-big-deal.ts --rev=15 --level=expert`, do not edit): 60 level seeds, each proved under the
 * level's rules (INK_LEVEL_SETS.expert): every level drawable within its ink, its bonus line proved, two clovers, every ink
 * par at least its proved line's ink, and the perfect run (scripts/ink-x200-oracle.ts) exactly 200 through the server
 * replay of the level (witnesses in scripts/fixtures/ink-hills-expert-deal-witness.json.gz). 0 candidates of the
 * first 60 dropped (60 kept).
 */
export const INK_HILLS_DEAL_EXPERT: readonly number[] = [1655421732,1670336335,1095647772,1911792321,735923524,1129528896,1578747724,1552316070,1858517429,447953438,1339482591,830227958,338530355,1311416855,896107523,250938337,665894406,653466421,1451433002,947034052,2038732633,2077453507,1027579941,412755262,249580665,972240923,1475048007,475350064,937853863,829263304,1196305575,1356004784,1845943777,1674776138,1686305672,1813846309,559328926,755447890,149381116,1202838213,1298144276,1747416350,287557056,1156860600,373096847,2103296316,1353619061,1424662321,694179083,1506414675,1368185365,8749910,1271383878,1146662231,1190842225,680363773,2102836415,2028398620,861759827,1658461067];

/** The level seed a room seed deals on inkRev 15 at level "expert". */
export function inkHillsExpertDealSeed(roomSeed: number): number {
  const n = INK_HILLS_DEAL_EXPERT.length;
  return INK_HILLS_DEAL_EXPERT[((Math.trunc(roomSeed) % n) + n) % n]!;
}
