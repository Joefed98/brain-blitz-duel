/**
 * Captain Joulz taking the kick in Top Bins (freekickRev 5, 15 Nov 2026; display only, never read by a sim): the hero
 * (hero.renderer.ts, the approved captain on retargeted joints) side-on to the left of the ball, facing it. Standing
 * while the shot is drawn; stepping in while the power bar is held; the strike (plant foot beside the ball, the kicking
 * leg swinging through the ball's place) on the kick's own tick; the follow-through and a settle after. He stays left of
 * the ball and below the goal, so he never covers the ball, the drawn line or the target.
 */
import { drawHero, heroPose, type HeroPose } from "./hero.renderer";

const pose: HeroPose = heroPose();

/**
 * Draws the kicker. `feetX, feetY`: where his plant foot ends beside the ball (screen px); `h`: his height (px);
 * `phase`: 0 set, 0…1 the run-up (the power bar held), 1…2 the strike and follow-through, 2…3 the settle.
 */
export function paintKicker(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, h: number, phase: number, still: boolean): void {
  const p = pose;
  // Where he stands: three strides back at rest, closing in over the run-up.
  const run = Math.max(0, Math.min(1, phase));
  const back = (1 - run) * 0.3 * h;
  const x = feetX - back;
  const strike = Math.max(0, Math.min(1, phase - 1));
  const settle = Math.max(0, Math.min(1, phase - 2));
  const step = still ? 0 : run > 0 && run < 1 ? Math.sin(run * Math.PI * 3) : 0;
  const lean = 0.04 * h * run - 0.06 * h * strike * (1 - settle);
  p.scale = 1;
  p.stick = Math.max(2, h * 0.03);
  // The polish plan's C4.5 (Joe, 20 Nov 2026: "no neck"): a slightly smaller helmet set higher above the collar and
  // the shoulders a touch lower, so a neck shows (were 0.085 h, 0.12 h above the neck joint and 0.04 h below it).
  p.headR = h * 0.078;
  p.neckX = x + lean;
  p.neckY = feetY - 0.78 * h;
  p.headX = p.neckX + 0.02 * h;
  p.headY = p.neckY - 0.17 * h;
  p.hipX = x;
  p.hipY = feetY - 0.46 * h;
  p.shoulderX = p.neckX;
  p.shoulderY = p.neckY + 0.06 * h;
  // Arms: down at rest, swinging with the stride, thrown out wide for balance at the strike.
  const out = strike * (1 - settle);
  p.handAX = x - 0.12 * h - 0.18 * h * out + 0.06 * h * step;
  p.handAY = feetY - 0.5 * h - 0.18 * h * out;
  p.handBX = x + 0.12 * h + 0.16 * h * out - 0.06 * h * step;
  p.handBY = feetY - 0.5 * h - 0.12 * h * out;
  // Legs: the plant foot (A) beside the ball; the kicking foot (B) back, then through the ball's place and up.
  p.footAX = x - 0.06 * h + 0.08 * h * step;
  p.footAY = feetY;
  const swing = strike < 0.35 ? strike / 0.35 : 1;
  const follow = strike > 0.35 ? (strike - 0.35) / 0.65 : 0;
  const bx0 = x - 0.3 * h;
  const by0 = feetY - 0.16 * h;
  const bx1 = x + 0.34 * h;
  const by1 = feetY - 0.05 * h;
  const bx2 = x + 0.42 * h;
  const by2 = feetY - 0.42 * h;
  if (strike > 0 && settle < 1) {
    const kx = swing < 1 ? bx0 + (bx1 - bx0) * swing : bx1 + (bx2 - bx1) * follow;
    const ky = swing < 1 ? by0 + (by1 - by0) * swing : by1 + (by2 - by1) * follow;
    p.footBX = kx + (x + 0.08 * h - kx) * settle;
    p.footBY = ky + (feetY - ky) * settle;
  } else {
    p.footBX = x + 0.08 * h - 0.08 * h * step;
    p.footBY = feetY;
  }
  p.moveX = strike > 0 && settle < 1 ? 1 : run > 0 && run < 1 ? 1 : 0;
  p.moveY = 0;
  p.speed = strike > 0 && settle < 1 ? 0.8 : run > 0 && run < 1 ? 0.5 : 0;
  p.face = 1;
  p.gentle = still;
  drawHero(ctx, p);
}
