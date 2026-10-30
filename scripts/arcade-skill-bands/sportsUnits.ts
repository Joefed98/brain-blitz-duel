/** Achievement units for the Sports group's Speed Pool and Curling: each core's measure, the features from their parts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdBandParts } from "../../src/lib/arcade/arcadeStandard";
import type { BandParts } from "../../src/lib/arcade/scoreBands";
import { poolPenalty, poolStdParts, POOL_STD_SPEC } from "../../src/lib/arcade/pool";

const pts = (parts: { key: string; points: number }[] | null, k: string) => parts?.find((p) => p.key === k)?.points ?? 0;

export const STD_SPORTS: Record<string, (s: any) => BandParts> = {
  pool: (s: any) => {
    const parts = poolStdParts(s);
    return stdBandParts(POOL_STD_SPEC, { core: pts(parts, "core"), features: { black: pts(parts, "black"), streak: pts(parts, "streak"), speed: pts(parts, "speed") }, penalty: poolPenalty(s) }, s.spotsDown, `${s.spotsDown} spots`, s.black === 1);
  },
};
