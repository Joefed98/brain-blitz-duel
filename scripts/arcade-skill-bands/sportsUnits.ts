/** Achievement units for the Sports group's Speed Pool and Curling: each core's measure, the features from their parts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdBandParts } from "../../src/lib/arcade/arcadeStandard";
import type { BandParts } from "../../src/lib/arcade/scoreBands";
import { poolPenalty, poolStdParts, POOL_STD_SPEC } from "../../src/lib/arcade/pool";
import { curlingStdParts, CURLING_STD_SPEC, CURL_STONE_PTS } from "../../src/lib/arcade/curling";

const pts = (parts: { key: string; points: number }[] | null, k: string) => parts?.find((p) => p.key === k)?.points ?? 0;

export const STD_SPORTS: Record<string, (s: any) => BandParts> = {
  curling: (s: any) => {
    const parts = curlingStdParts(s);
    const button = (s.pts as number[]).filter((p) => p === CURL_STONE_PTS).length;
    return stdBandParts(CURLING_STD_SPEC, { core: pts(parts, "core"), features: { takeouts: pts(parts, "takeouts"), redring: pts(parts, "redring"), hold: pts(parts, "hold") }, penalty: 0 }, button, `${button} on the button`, s.thrown >= 8);
  },
  pool: (s: any) => {
    const parts = poolStdParts(s);
    return stdBandParts(POOL_STD_SPEC, { core: pts(parts, "core"), features: { black: pts(parts, "black"), streak: pts(parts, "streak"), speed: pts(parts, "speed") }, penalty: poolPenalty(s) }, s.spotsDown, `${s.spotsDown} spots`, s.black === 1);
  },
};
