// Parry's part of this check went with the game on 14 Oct 2026.
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { basSpawnGap, BAS_RUN_TICKS } from "@/lib/arcade/bastion";
import { wavScoreOf } from "@/lib/arcade/wavefront";

let failures = 0;
const check = (label: string, ok: boolean) => {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
};

check("Wavefront scales raw points to par 248", wavScoreOf(10, 2, 1) === 21 && wavScoreOf(248, 0, 0) === 150);

const beforeFinal = basSpawnGap(39 * TICKS_PER_SECOND);
const finalGap = basSpawnGap(40 * TICKS_PER_SECOND);
const scheduledFinal = 72 - Math.trunc(((72 - 30) * 40 * TICKS_PER_SECOND) / BAS_RUN_TICKS);
check("Bastion final spawn gap is the scheduled gap divided by 1.2", finalGap === Math.trunc((scheduledFinal * 5) / 6));
check("Bastion boost starts only in the final twenty seconds", beforeFinal > finalGap);

console.log(`Wavefront 10+2 saucers+1 wave=${wavScoreOf(10, 2, 1)}; Bastion final gap ${finalGap} ticks.`);
if (failures) process.exit(1);