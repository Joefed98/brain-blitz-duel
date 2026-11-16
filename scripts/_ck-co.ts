import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import { searchCheckout, checkoutGreedySolves, checkoutBustFreeOrder, checkoutBustIndex, checkoutValid, CHECKOUT_STANDARD } from "../src/lib/duel/checkout";
import { checkoutPersonFinds } from "../src/lib/duel/checkout.server";
import { seededRng } from "../src/lib/duel/seededRng";
const boards = (GAME_LEVELS.checkout!.levels.expert!.settings as any).boards;
const rng = seededRng(5);
function unevenValues() { return rng.shuffle(Array.from({ length: 56 }, (_, i) => i + 5)).slice(0, 20); }
boards.forEach((plan: any, bi: number) => {
  let ok = 0, route = 0, greedy = 0, person = 0, tries: number[] = [];
  for (let a = 0; a < 300; a++) {
    const w = plan.wedges === "uneven" ? unevenValues() : rng.shuffle(Array.from({ length: 20 }, (_, i) => i + 1));
    if (plan.negatives) { const f = rng.below(20); let s = rng.below(20); while (Math.abs(s-f)<=1||Math.abs(s-f)>=19) s = rng.below(20); w[f] = -w[f]; w[s] = -w[s]; }
    const stage: any = { wedges: w, target: rng.int(plan.target[0], plan.target[1]), maxDarts: plan.maxDarts, ...(plan.exact?{exactDarts:true}:{}), finish: plan.finish, ...(plan.quad?{quad:true}:{}), bigFinish: true };
    const f = searchCheckout(stage); if (f.minDarts === null) continue; route++;
    if (checkoutGreedySolves(stage)) continue; greedy++;
    const r = checkoutBustFreeOrder(stage, f.route!); if (checkoutBustIndex(stage, r.slice(0,-1))>=0) continue; ok++;
    const p = checkoutPersonFinds(stage); if (p.found) { person++; tries.push(p.tries); }
  }
  tries.sort((a,b)=>a-b);
  console.log(bi, "route", route, "notgreedy", greedy, "bustfree", ok, "person", person, "median tries", tries[tries.length>>1]);
});
