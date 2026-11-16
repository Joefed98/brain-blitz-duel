/**
 * The Logic overhaul's moves (session 1, stage 2, 15 Nov 2026; docs/design/game-fx/README.md): the game-specific
 * motion the effects kit (src/lib/fx/kit.ts) has no single kind for, built to its rules. Transform and opacity only
 * through the Web Animations API; the piece's own element moves, never a control, the arena or the stage; nothing waits
 * on an animation (the game's state has already changed, and the next tap is taken at once); the kit's variant decides
 * the flourish (reduced: no travel, a short crossfade; lite: shorter; calm and full: as designed). Display only.
 */
import { gameFxVariant } from "@/lib/fx/kit";

/** The style guide's pour timing (docs/design/style-guide): lift, tilt, pour (by amount), settle, return. */
export const POUR_MS = { lift: 120, tilt: 160, settle: 220, back: 180 } as const;
export function pourMsFor(layers: number): number {
  return Math.max(300, Math.min(500, 260 + layers * 80));
}

function motionOff(): boolean {
  return (
    typeof window === "undefined" ||
    typeof Element === "undefined" ||
    typeof Element.prototype.animate !== "function" ||
    gameFxVariant("pour") === "reduced"
  );
}

/**
 * Polypotions' pour: the source flask lifts, flies over the target and tilts, a stream of the poured colour falls into
 * the target's mouth while its layers rise (the stage's fill), then it rights itself and flies home. `board` is the
 * flasks' shared parent (the stream is drawn in it, under nothing the player taps). Returns the total length (ms).
 */
export function animatePour(board: HTMLElement | null, from: number, to: number, colour: string, layers: number): number {
  if (!board || motionOff()) return 0;
  const src = board.querySelector<HTMLElement>(`[data-flask="${from}"]`);
  const dst = board.querySelector<HTMLElement>(`[data-flask="${to}"]`);
  if (!src || !dst) return 0;
  const lite = gameFxVariant("pour") === "lite";
  const pour = lite ? 260 : pourMsFor(layers);
  const total = POUR_MS.lift + POUR_MS.tilt + pour + POUR_MS.settle + POUR_MS.back;
  const a = src.getBoundingClientRect();
  const b = dst.getBoundingClientRect();
  const dir = b.left + b.width / 2 >= a.left + a.width / 2 ? 1 : -1;
  // Over the target: the source's lip just above and beside the target's mouth.
  const dx = b.left + b.width / 2 - (a.left + a.width / 2) - dir * a.width * 0.45;
  const dy = b.top - a.top - a.height * 0.28;
  const tilt = dir * 68;
  const t = (ms: number) => ms / total;
  const up = "translate(0px, -16px)";
  const over = `translate(${dx}px, ${dy}px)`;
  src.style.zIndex = "30";
  const anim = src.animate(
    [
      { transform: "none", offset: 0 },
      { transform: up, offset: t(POUR_MS.lift), easing: "ease-out" },
      { transform: `${over} rotate(${tilt}deg)`, offset: t(POUR_MS.lift + POUR_MS.tilt), easing: "ease-in-out" },
      { transform: `${over} rotate(${tilt}deg)`, offset: t(POUR_MS.lift + POUR_MS.tilt + pour) },
      { transform: `${over} rotate(0deg)`, offset: t(POUR_MS.lift + POUR_MS.tilt + pour + POUR_MS.settle), easing: "ease-out" },
      { transform: "none", offset: 1, easing: "ease-in" },
    ],
    { duration: total, easing: "linear" },
  );
  anim.finished.then(() => (src.style.zIndex = ""), () => (src.style.zIndex = ""));
  // The stream: from the tilted lip into the target's mouth.
  const root = board.getBoundingClientRect();
  const stream = document.createElement("span");
  stream.className = "logic-pour-stream";
  stream.setAttribute("aria-hidden", "true");
  const lipY = b.top - root.top - a.height * 0.06;
  const mouthX = b.left - root.left + b.width / 2 - 2.5;
  const fallTo = b.top - root.top + b.height * 0.92;
  Object.assign(stream.style, {
    left: `${mouthX}px`,
    top: `${lipY}px`,
    height: `${Math.max(12, fallTo - lipY)}px`,
    background: `linear-gradient(90deg, ${colour}, color-mix(in srgb, ${colour} 70%, white) 45%, ${colour})`,
  });
  board.appendChild(stream);
  const start = POUR_MS.lift + POUR_MS.tilt - 40;
  const s = stream.animate(
    [
      { transform: "scaleY(0)", opacity: 1, offset: 0 },
      { transform: "scaleY(1)", opacity: 1, offset: 0.25 },
      { transform: "scaleY(1)", opacity: 1, offset: 0.8 },
      { transform: "scaleY(1) translateY(30%)", opacity: 0, offset: 1 },
    ],
    { duration: pour + 80, delay: start, fill: "both", easing: "ease-in-out" },
  );
  const drop = () => stream.remove();
  s.finished.then(drop, drop);
  return total;
}

/** A refused flask tips toward where it was told to pour, nothing comes out, and it rights itself. */
export function animateRefusedPour(board: HTMLElement | null, from: number, to: number): void {
  if (!board || motionOff()) return;
  const src = board.querySelector<HTMLElement>(`[data-flask="${from}"]`);
  const dst = board.querySelector<HTMLElement>(`[data-flask="${to}"]`);
  if (!src || !dst) return;
  const dir = dst.getBoundingClientRect().left >= src.getBoundingClientRect().left ? 1 : -1;
  src.animate(
    [
      { transform: "translate(0, -16px) rotate(0deg)" },
      { transform: `translate(0, -18px) rotate(${dir * 22}deg)`, offset: 0.35 },
      { transform: `translate(0, -16px) rotate(${-dir * 6}deg)`, offset: 0.7 },
      { transform: "translate(0, -16px) rotate(0deg)" },
    ],
    { duration: 420, easing: "ease-in-out" },
  );
}

/**
 * Hanoi's drop: the ring travels from where it hovered in a short arc over the posts and lands (FLIP: the ring is
 * already in its new place; `from` is its old screen box).
 */
export function animateArc(el: HTMLElement | null, from: DOMRect | null): void {
  if (!el || !from || motionOff()) return;
  const to = el.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top - to.top;
  const peak = Math.min(dy, 0) - 26;
  const lite = gameFxVariant("drop") === "lite";
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: `translate(${dx * 0.5}px, ${peak}px)`, offset: 0.45, easing: "ease-in" },
      { transform: "translate(0px, 0px) scaleY(0.86)", offset: 0.85 },
      { transform: "none" },
    ],
    { duration: lite ? 220 : 340, easing: "ease-out" },
  );
}

/** Lights a group of cells in order (a completed line): each gets `data-lit` for one pass, `stepMs` apart. */
export function lightCells(cells: readonly (HTMLElement | null | undefined)[], stepMs = 40): void {
  if (motionOff()) return;
  cells.forEach((cell, i) => {
    if (!cell) return;
    cell.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.06)", offset: 0.4 }, { transform: "scale(1)" }],
      { duration: 260, delay: i * stepMs, easing: "ease-out" },
    );
    const glow = document.createElement("span");
    glow.className = "logic-line-glow";
    glow.setAttribute("aria-hidden", "true");
    cell.appendChild(glow);
    const g = glow.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], {
      duration: 420,
      delay: i * stepMs,
      fill: "both",
    });
    const drop = () => glow.remove();
    g.finished.then(drop, drop);
  });
}
