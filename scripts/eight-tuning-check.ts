import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { basSpawnGap, BAS_RUN_TICKS } from "@/lib/arcade/bastion";
import { parryScoreOf, parrySwipePos } from "@/lib/arcade/parry";
import { wavScoreOf } from "@/lib/arcade/wavefront";

let failures = 0;
const check = (label: string, ok: boolean) => {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
};

check("Parry cardinal and diagonal swipes quantize to all eight slots", new Set([
  parrySwipePos(0, -30), parrySwipePos(30, -30), parrySwipePos(30, 0), parrySwipePos(30, 30),
  parrySwipePos(0, 30), parrySwipePos(-30, 30), parrySwipePos(-30, 0), parrySwipePos(-30, -30),
]).size === 8);
check("Parry scores five per deflection minus ten per life", parryScoreOf(31, 1) === 145 && parryScoreOf(2, 2) === 0 && parryScoreOf(40, 0) === 150);
check("Wavefront scales raw points by 0.75", wavScoreOf(10, 2, 1) === 26 && wavScoreOf(200, 0, 0) === 150);

const beforeFinal = basSpawnGap(39 * TICKS_PER_SECOND);
const finalGap = basSpawnGap(40 * TICKS_PER_SECOND);
const scheduledFinal = 72 - Math.trunc(((72 - 30) * 40 * TICKS_PER_SECOND) / BAS_RUN_TICKS);
check("Bastion final spawn gap is the scheduled gap divided by 1.2", finalGap === Math.trunc((scheduledFinal * 5) / 6));
check("Bastion boost starts only in the final twenty seconds", beforeFinal > finalGap);

console.log(`Parry score examples 31/1=${parryScoreOf(31, 1)}, 2/2=${parryScoreOf(2, 2)}; Wavefront 10+2 saucers+1 wave=${wavScoreOf(10, 2, 1)}; Bastion final gap ${finalGap} ticks.`);
if (failures) process.exit(1);