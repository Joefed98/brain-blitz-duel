import { numberArt } from "@/components/puzzles/number/overhaul";

/**
 * Counterweight art (Number polish, 13 Oct 2026): a brass beam with engraved notches,
 * dark iron kettlebells and a lamp-lit workbench. Presentation only: nothing here reads
 * or changes a placement, and every drawn weight is exactly the size of its button.
 */

/** Shared gradients, defined once per screen (identical copies are harmless). */
export const BALANCE_DEFS = (
  <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="bal-brass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FBE7A6" />
        <stop offset="0.3" stopColor="#E0B04C" />
        <stop offset="0.68" stopColor="#B07A22" />
        <stop offset="1" stopColor="#6E4610" />
      </linearGradient>
      <linearGradient id="bal-brass-h" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7A4F14" />
        <stop offset="0.35" stopColor="#F2D27F" />
        <stop offset="0.6" stopColor="#C8922F" />
        <stop offset="1" stopColor="#6E4610" />
      </linearGradient>
      <linearGradient id="bal-column" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#15181C" />
        <stop offset="0.38" stopColor="#4A525B" />
        <stop offset="0.55" stopColor="#2D333A" />
        <stop offset="1" stopColor="#111418" />
      </linearGradient>
      <linearGradient id="bal-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7A4E2C" />
        <stop offset="0.45" stopColor="#56351C" />
        <stop offset="1" stopColor="#2B190C" />
      </linearGradient>
      <radialGradient id="bal-iron" cx="0.36" cy="0.34" r="0.78">
        <stop offset="0" stopColor="#6B7580" />
        <stop offset="0.42" stopColor="#343B43" />
        <stop offset="1" stopColor="#101317" />
      </radialGradient>
      <radialGradient id="bal-plate" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#E9EDF0" />
        <stop offset="1" stopColor="#A7B0B8" />
      </radialGradient>
      <radialGradient id="bal-plate-mine" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#FFE9A8" />
        <stop offset="1" stopColor="#E3A92E" />
      </radialGradient>
      <linearGradient id="bal-shine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFF8DC" stopOpacity="0" />
        <stop offset="0.5" stopColor="#FFF8DC" stopOpacity="0.95" />
        <stop offset="1" stopColor="#FFF8DC" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * A cast-iron kettlebell in its box (the Number overhaul, 15 Nov 2026): the Blender-rendered bell
 * (docs/design/number-overhaul/source/balance.py) with its weight drawn over the face in Archivo. `fixed` weights
 * are bolted on (iron handle, steel face, a lock); yours carry a brass handle and a champagne face.
 */
export function IronKettlebell({ value, fixed, width, height, spill = 1 }: {
  value: number; fixed: boolean; width: number; height: number;
  /** How much wider than its box the art may draw (a live beam's bells spill a little past their notch). */
  spill?: number;
}) {
  // The art is 60 × 72; it is drawn as large as the box allows (times `spill` across), centred at the box's foot.
  const scale = Math.min((width * spill) / 60, height / 72);
  const w = Math.round(60 * scale), h = Math.round(72 * scale);
  return (
    <span role="img" aria-label={`${value}${fixed ? " fixed" : ""}`} className="bal-bell" data-fixed={fixed ? "" : undefined}
      style={{ width, height, ["--bell-w" as string]: `${w}px`, ["--bell-h" as string]: `${h}px` }}>
      <img src={numberArt("balance", fixed ? "bell-fixed" : "bell-mine")} alt="" draggable={false} className="bal-bell-art" />
      <span className="bal-bell-num" style={{ fontSize: Math.round(h * (value >= 10 ? 0.25 : 0.31)) }}>{value}</span>
      {fixed && (
        <svg className="bal-bell-lock" viewBox="0 0 11 13" aria-hidden="true">
          <path d="M2.5 5V3.5a3 3 0 0 1 6 0V5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="1" y="5" width="9" height="7" rx="1.5" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

/** One small level beam per scale, settling in a row: the "every scale balanced" moment (four on balanceRev 2, three on older rounds). */
export function ScalesLevelFx({ reduced, count = 3 }: { reduced: boolean; count?: number }) {
  return (
    <div className={`bal-solve-fx${reduced ? " bal-reduced" : ""}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} className="bal-mini" style={{ ["--i" as string]: i, ["--from" as string]: `${i % 2 === 1 ? -9 : 9}deg` }} width="72" height="34" viewBox="0 0 72 34">
          <path d="M33 14h6l4 16H29Z" fill="url(#bal-column)" stroke="#0B0D10" strokeWidth="0.8" />
          <rect x="22" y="29" width="28" height="4" rx="1.5" fill="url(#bal-wood)" />
          <g className="bal-mini-beam">
            <rect x="3" y="9" width="66" height="6" rx="2.5" fill="url(#bal-brass)" stroke="#5A3A0C" strokeWidth="0.8" />
            <rect className="bal-mini-shine" x="3" y="9" width="22" height="6" fill="url(#bal-shine)" />
          </g>
          <circle cx="36" cy="12" r="3.2" fill="url(#bal-brass-h)" stroke="#5A3A0C" strokeWidth="0.7" />
        </svg>
      ))}
    </div>
  );
}

export const BALANCE_CSS = `
.bal-panel {
  border-radius: 18px;
  border: 1px solid rgba(214, 170, 84, 0.22);
  background:
    radial-gradient(120% 70% at 50% -8%, rgba(255, 214, 140, 0.20), rgba(255, 214, 140, 0) 62%),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0 2px, rgba(0,0,0,0) 2px 46px),
    linear-gradient(180deg, #1D1812 0%, #15120E 70%, #120F0C 100%);
  box-shadow: inset 0 1px 0 rgba(255, 236, 190, 0.08), inset 0 -40px 60px rgba(0,0,0,0.35);
  overflow: hidden;
}
.bal-table {
  position: absolute; left: 0; right: 0; bottom: 0; height: 30px;
  background:
    linear-gradient(180deg, rgba(255,210,150,0.30) 0 1px, rgba(0,0,0,0) 1px),
    repeating-linear-gradient(176deg, rgba(0,0,0,0.10) 0 3px, rgba(255,255,255,0.025) 3px 7px),
    linear-gradient(180deg, #6A4426 0%, #4A2E18 55%, #2E1B0D 100%);
}
.bal-notch-label {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 24px; margin-top: 20px;
  font-size: 15px; font-weight: 800; line-height: 1; color: #F8E3A2;
  background: linear-gradient(180deg, #33230F 0%, #1E1408 100%);
  background-color: #281B0B;
  border: 1px solid #C99A3E; border-radius: 5px;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.7), 0 1px 0 rgba(255, 230, 160, 0.25);
  text-shadow: 0 -1px 0 rgba(0,0,0,0.8);
  transition: transform 160ms ease-out, background-color 160ms;
}
.bal-notch-active {
  color: #FFF4CF; border-color: var(--primary);
  background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 45%, #33230F) 0%, color-mix(in srgb, var(--primary) 22%, #1E1408) 100%);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent), inset 0 1px 2px rgba(0,0,0,0.5);
  animation: bal-notch-pulse 900ms ease-in-out infinite alternate;
}
@keyframes bal-notch-pulse { from { transform: translateY(0); } to { transform: translateY(-2px); } }
.bal-hook { display: block; }
.bal-bell { filter: drop-shadow(0 3px 2px rgba(0,0,0,0.55)); }
.bal-drop { animation: bal-drop 230ms cubic-bezier(.3,.8,.4,1) both; transform-origin: 50% 0; }
@keyframes bal-drop {
  0% { transform: translateY(-16px); opacity: 0.35; }
  62% { transform: translateY(2px) scaleY(0.96); opacity: 1; }
  100% { transform: translateY(0) scaleY(1); }
}
.bal-tray-cup {
  border-radius: 9999px !important;
  background: radial-gradient(circle closest-side at 50% 50%, #0B0907 0%, #1F1810 66%, #3A2A16 82%, #A57A32 89%, #2A1D0E 96%, rgba(0,0,0,0) 100%) !important;
  transition: transform 140ms ease-out, box-shadow 140ms;
}
.bal-tray-cup[data-selected="true"] { transform: translateY(-4px); box-shadow: 0 0 0 2px var(--primary), 0 6px 10px rgba(0,0,0,0.45); }
.bal-rack {
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(122, 78, 44, 0.20), rgba(43, 25, 12, 0.35));
  border: 1px solid rgba(214, 170, 84, 0.16);
}
.bal-beam-shine { opacity: 0; }
.bal-level .bal-beam-shine { animation: bal-sweep 640ms 120ms ease-out both; }
.bal-solving .bal-beam-shine { animation: bal-sweep 700ms 260ms ease-out both; }
@keyframes bal-sweep {
  0% { transform: translateX(var(--sweep-from)); opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateX(var(--sweep-to)); opacity: 0; }
}
.bal-solving .bal-beam-rect { filter: drop-shadow(0 0 5px rgba(255, 214, 120, 0.85)); }
.bal-boss-glow { opacity: 0; transition: opacity 200ms; }
.bal-level .bal-boss-glow, .bal-solving .bal-boss-glow { opacity: 1; }
.bal-solve-fx {
  position: absolute; left: 0; right: 0; top: 34px; display: flex; justify-content: center; gap: 10px;
  pointer-events: none; animation: bal-fx-life 1100ms linear both;
}
.bal-mini { overflow: visible; animation: bal-mini-in 260ms calc(var(--i) * 90ms) cubic-bezier(.2,.9,.3,1.2) both; }
.bal-mini-beam { transform-box: view-box; transform-origin: 36px 12px; animation: bal-mini-level 380ms calc(var(--i) * 90ms + 80ms) cubic-bezier(.3,1.6,.5,1) both; }
.bal-mini-shine { animation: bal-mini-sweep 420ms calc(var(--i) * 90ms + 420ms) ease-out both; }
@keyframes bal-mini-in { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes bal-mini-level { from { transform: rotate(var(--from)); } to { transform: rotate(0deg); } }
@keyframes bal-mini-sweep { 0% { transform: translateX(-24px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateX(66px); opacity: 0; } }
@keyframes bal-fx-life { 0%, 82% { opacity: 1; } 100% { opacity: 0; } }
.bal-reduced, .bal-reduced * { animation: none !important; }
.bal-reduced .bal-mini-shine { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .bal-drop, .bal-notch-active, .bal-mini, .bal-mini-beam, .bal-mini-shine, .bal-solve-fx { animation: none !important; }
  .bal-level .bal-beam-shine, .bal-solving .bal-beam-shine { animation: none !important; opacity: 0; }
  .bal-tilt { transition: none !important; }
}
.game-column [data-polish="balance"] { justify-content: flex-start; }
.game-column [data-polish="balance"] > [data-game-arena="balance"] { flex: 1 1 0; max-height: none; }

/* ---- The Number overhaul (15 Nov 2026): the Blender-rendered pieces (public/number/balance), bold Archivo numbers,
   champagne gold and navy, no glows. Display only: every notch, weight and button keeps its place and size. */
/* Spotlight (the polish plan, 21 Nov 2026; earlier E2.3 as changed): a light oak wall and bench, a champagne beam and
   coloured enamel kettlebells with ivory faces, so the numbers on the bells and tags are dark navy ink; no hairline. */
.bal-panel {
  border: 1px solid transparent;
  background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.16)), url("/number/balance/wall.webp") center / cover no-repeat, var(--jz-bg);
  box-shadow: inset 0 0 30px rgba(0,0,0,.22);
}
[data-polish="balance"] .bal-table {
  background: url("/number/balance/bench.webp") center top / 100% 100% no-repeat;
  box-shadow: 0 -8px 16px rgba(0,0,0,.4);
}
.bal-notch-label {
  font-family: var(--jz-font); font-weight: 800; font-size: 16px; color: var(--jz-navy); text-shadow: none;
  background: url("/number/balance/tag.webp") center / 100% 100% no-repeat; background-color: transparent;
  border: 0; box-shadow: 0 2px 3px rgba(0,0,0,.45);
}
[data-polish="balance"] .bal-big .bal-notch-label { height: 30px; margin-top: 17px; font-size: 20px; }
[data-polish="balance"] [data-balance-fill] .bal-notch-label { height: 34px; margin-top: 13px; font-size: 22px; }
[data-polish="balance"] [data-balance-fill] .bal-torque { font-size: 21px; line-height: 28px; padding: 4px 14px; }
/* Beam fill (a live round): the rod a staggered kettlebell hangs from, brass. */
[data-polish="balance"] .bal-rod { display: block; width: 3px; border-radius: 2px; background: linear-gradient(90deg, var(--jz-gold-ledge), var(--jz-gold), var(--jz-gold-ledge)); box-shadow: 0 1px 2px rgba(0,0,0,.45); }
[data-polish="balance"] .bal-notch-active {
  color: var(--jz-navy);
  background: url("/number/balance/tag.webp") center / 100% 100% no-repeat;
  box-shadow: 0 0 0 2px var(--jz-white), 0 3px 4px rgba(0,0,0,.5);
}
.bal-bell { position: relative; display: inline-block; flex: none; filter: drop-shadow(0 4px 3px rgba(0,0,0,.55)); }
.bal-bell-art { position: absolute; left: 50%; bottom: 0; width: var(--bell-w); height: var(--bell-h); max-width: none; translate: -50% 0; pointer-events: none; user-select: none; }
.bal-bell-num {
  position: absolute; left: 0; right: 0; bottom: calc(var(--bell-h) * 0.347); translate: 0 50%; text-align: center;
  font-family: var(--jz-font); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; color: var(--jz-navy); pointer-events: none;
}
.bal-bell-lock { position: absolute; right: 0; top: calc(100% - var(--bell-h)); width: 10px; height: 12px; color: var(--jz-silver); }
[data-polish="balance"] .bal-tray-cup { background: transparent !important; box-shadow: none !important; }
[data-polish="balance"] .bal-tray-cup[data-selected="true"] { transform: translateY(-6px); box-shadow: 0 0 0 2px var(--jz-gold) !important; }
[data-polish="balance"] .balance-instrument .ring-primary { --tw-ring-color: var(--jz-gold); border-radius: 12px; box-shadow: 0 0 0 2px var(--jz-gold) !important; }
[data-polish="balance"] .bal-rack {
  border: 0; background: url("/number/balance/tray.webp") center / 100% 100% no-repeat !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.45) !important;
}
[data-polish="balance"] .bal-torque {
  position: absolute; translate: -50% 0; display: flex; align-items: center; gap: 8px; padding: 3px 12px; border-radius: 10px; white-space: nowrap;
  font-family: var(--jz-font); font-weight: 800; font-size: 18px; line-height: 24px; font-variant-numeric: tabular-nums; color: var(--jz-white);
  background: var(--jz-surface-2); border: 1px solid color-mix(in srgb, var(--jz-gold) 55%, transparent); box-shadow: 0 3px 6px rgba(0,0,0,.5); pointer-events: none;
}
[data-polish="balance"] .bal-torque i { font-style: normal; color: var(--jz-gold); }
[data-polish="balance"] .bal-nudge {
  position: absolute; left: 50%; top: -14px; translate: -50% -100%; padding: 4px 12px; border-radius: 10px; white-space: nowrap; pointer-events: none;
  font-family: var(--jz-font); font-weight: 700; font-size: 14px; color: var(--jz-white); background: var(--jz-surface-2); border: 1px solid var(--jz-gold);
}
[data-polish="balance"] .bal-rack[data-nudge] { animation: bal-nudge 300ms ease-out both; }
@keyframes bal-nudge { 0%, 100% { translate: 0 0; } 25% { translate: -5px 0; } 60% { translate: 4px 0; } }
[data-polish="balance"] .bal-failing { filter: grayscale(1) brightness(.7); transition: filter 200ms; animation: nov-stage-leave 420ms cubic-bezier(.5,0,.75,0) 380ms both; }
[data-polish="balance"] .bal-solving .bal-beam-rect { filter: none; }
@media (prefers-reduced-motion: reduce) {
  [data-polish="balance"] .bal-rack[data-nudge], [data-polish="balance"] .bal-failing { animation: none; }
}
`;
