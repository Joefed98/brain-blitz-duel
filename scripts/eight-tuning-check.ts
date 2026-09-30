import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { basSpawnGap, BAS_RUN_TICKS } from "@/lib/arcade/bastion";
import { parryScoreOf, parrySwipePos } from "@/lib/arcade/parry";
import { PARRY_INPUT_SWIPE, PARRY_WINDOW, parryGame } from "@/lib/arcade/parry";
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
const parryInitial = parryGame.init(71);
const firstArrow = parryInitial.arrows[0];
if (firstArrow) {
  const unguarded = (firstArrow.side + 2) % 4;
  const unguardedSlot = [6, 2, 0, 4][unguarded] ?? 0;
  let late = { ...parryInitial, pos: unguardedSlot, fromPos: unguardedSlot };
  while (late.tick < firstArrow.impact) late = parryGame.step(late, null);
  check("Parry miss at ring does not cost a life", late.hits === 0 && late.status[0] === 0);
  const lateSlot = [6, 2, 0, 4][firstArrow.side] ?? 0;
  late = parryGame.step(late, { t: late.tick + 1, k: PARRY_INPUT_SWIPE, a: lateSlot, b: 0, c: 0, d: 0 });
  for (let i = 0; i < 4; i++) late = parryGame.step(late, null);
  check("Parry late swing catches inside ring", late.status[0] === 1 && late.hits === 0);
  let core = { ...parryGame.init(71), pos: unguardedSlot, fromPos: unguardedSlot };
  while (core.tick < firstArrow.impact + PARRY_WINDOW) core = parryGame.step(core, null);
  check("Parry life is lost at core", core.status[0] === 2 && core.hits === 1);
}
check("Wavefront scales raw points by 0.75", wavScoreOf(10, 2, 1) === 26 && wavScoreOf(200, 0, 0) === 150);

const beforeFinal = basSpawnGap(39 * TICKS_PER_SECOND);
const finalGap = basSpawnGap(40 * TICKS_PER_SECOND);
const scheduledFinal = 72 - Math.trunc(((72 - 30) * 40 * TICKS_PER_SECOND) / BAS_RUN_TICKS);
check("Bastion final spawn gap is the scheduled gap divided by 1.2", finalGap === Math.trunc((scheduledFinal * 5) / 6));
check("Bastion boost starts only in the final twenty seconds", beforeFinal > finalGap);

console.log(`Parry score examples 31/1=${parryScoreOf(31, 1)}, 2/2=${parryScoreOf(2, 2)}; Wavefront 10+2 saucers+1 wave=${wavScoreOf(10, 2, 1)}; Bastion final gap ${finalGap} ticks.`);
if (failures) process.exit(1);