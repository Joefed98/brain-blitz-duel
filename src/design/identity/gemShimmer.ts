/**
 * The gem avatars' live shimmer (S5 step 2, Joe, 28 Nov 2026): a soft band of light sweeping the disc every few
 * seconds over the gem's baked glow (rim light, halo and sparkles in its render). CSS only, presentation only.
 *
 * - It is part of the avatar's own svg (gemShimmerMarkup), clipped to the disc, so it never leaves the avatar's box
 *   and changes no box, tap area or layout.
 * - It runs only on an avatar marked `data-gem-on`: one IntersectionObserver (started once, the first time a gem
 *   avatar is drawn) marks an avatar while it is on screen and drawn wider than SHIMMER_MIN_PX. Off screen, and at
 *   28 px and below (rows, chips, the nameplate strip's small avatars), there is no shimmer: the still glow stays.
 * - Reduced motion and Battery saver (`<html data-battery-saver>`) stop it; the still glow stays.
 */

/** At this width and below the shimmer is off (a moving band on a 28 px avatar is noise, not a glow). */
export const SHIMMER_MIN_PX = 28;

const STYLE_ID = "jz-gem-shimmer-css";
const CSS = `svg[data-gem] .jz-gem-shimmer{opacity:0}
svg[data-gem][data-gem-on] .jz-gem-shimmer{opacity:1;animation:jz-gem-sweep 5.2s cubic-bezier(.4,0,.2,1) infinite}
@keyframes jz-gem-sweep{0%{transform:translateX(-70px)}40%,100%{transform:translateX(150px)}}
@media (prefers-reduced-motion: reduce){svg[data-gem] .jz-gem-shimmer{animation:none;opacity:0}}
html[data-battery-saver] svg[data-gem] .jz-gem-shimmer{animation:none;opacity:0}`;

/** The shimmer's markup inside a gem avatar's svg (ids prefixed): a slanted white band, clipped to the disc. */
export function gemShimmerMarkup(prefix: string): string {
  const light = "#FFFFFF"; // design-lint-ignore: game avatar art, not page chrome
  return (
    `<defs><clipPath id="${prefix}gc"><circle cx="50" cy="50" r="48"></circle></clipPath>` +
    `<linearGradient id="${prefix}gs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${light}" stop-opacity="0"></stop>` +
    `<stop offset="0.5" stop-color="${light}" stop-opacity="0.32"></stop><stop offset="1" stop-color="${light}" stop-opacity="0"></stop></linearGradient></defs>` +
    `<g clip-path="url(#${prefix}gc)" style="pointer-events: none"><rect class="jz-gem-shimmer" x="0" y="-20" width="24" height="140" fill="url(#${prefix}gs)" transform="skewX(-18)"></rect></g>`
  );
}

let started = false;

/** Adds the shimmer's style and starts the one observer (once; nothing on the server or in a non-DOM test). */
export function ensureGemShimmer(): void {
  if (started || typeof document === "undefined" || typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined")
    return;
  started = true;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  const seen = new WeakSet<Element>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const on = e.isIntersecting && e.boundingClientRect.width > SHIMMER_MIN_PX;
      if (on) e.target.setAttribute("data-gem-on", "");
      else e.target.removeAttribute("data-gem-on");
    }
  });
  const watch = (root: ParentNode) => {
    const own = root instanceof Element && root.matches("svg[data-gem]") ? [root] : [];
    for (const svg of [...own, ...Array.from(root.querySelectorAll("svg[data-gem]"))]) {
      if (seen.has(svg)) continue;
      seen.add(svg);
      io.observe(svg);
    }
  };
  watch(document);
  new MutationObserver((records) => {
    for (const r of records)
      for (const n of Array.from(r.addedNodes)) if (n.nodeType === 1) watch(n as Element);
  }).observe(document.body, { childList: true, subtree: true });
}
