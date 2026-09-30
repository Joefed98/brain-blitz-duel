import { burstScoreOf } from "@/lib/arcade/burst";

let failures = 0;
const check = (label: string, ok: boolean) => {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
};

// Burst: 2 per ball, −9 per life, min 0, cap 150, top-up unchanged.
check("Burst 40 popped no lives = 80", burstScoreOf(40, 0, 0, false) === 80);
check("Burst 100 popped no lives caps 150", burstScoreOf(100, 0, 0, false) === 150);
check("Burst 40 popped one life = 71", burstScoreOf(40, 1, 0, false) === 71);
check("Burst 4 popped three lives floors 0", burstScoreOf(4, 3, 0, false) === 0);
check("Burst finished four waves no lives tops up 150", burstScoreOf(30, 0, 4, true) === 150);
check("Burst finished four waves with a life does not top up", burstScoreOf(30, 1, 4, true) === 51);

console.log(`Burst examples 40/0=${burstScoreOf(40, 0, 0, false)}, 100/0=${burstScoreOf(100, 0, 0, false)}, 30/1 top-up=${burstScoreOf(30, 1, 4, true)}.`);
if (failures) process.exit(1);
