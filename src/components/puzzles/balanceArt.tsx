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
 * A cast-iron kettlebell in a 44 × 52 box. `fixed` weights are bolted on (steel plate,
 * iron handle, lock); yours carry a brass handle and a gold plate.
 */
export function IronKettlebell({ value, fixed, width, height }: { value: number; fixed: boolean; width: number; height: number }) {
  return (
    <svg width={width} height={height} style={{ width, height }} viewBox="0 0 44 52" role="img" aria-label={`${value}${fixed ? " fixed" : ""}`} className="bal-bell">
      <path d="M13.5 21V12.5C13.5 3 30.5 3 30.5 12.5V21" fill="none" stroke={fixed ? "#0E1114" : "#5A3A0C"} strokeWidth="6.5" strokeLinecap="round" />
      <path d="M13.5 21V12.5C13.5 3 30.5 3 30.5 12.5V21" fill="none" stroke={fixed ? "#4A535C" : "url(#bal-brass-h)"} strokeWidth="4" strokeLinecap="round" />
      <path d="M15.4 13c.6-4.6 3.4-6.8 6.6-6.8" fill="none" stroke="#FFFFFF" strokeOpacity={fixed ? 0.28 : 0.6} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 18.5h22l4.2 8.6C42 37.5 37 50.5 22 50.5S2 37.5 6.8 27.1Z" fill="url(#bal-iron)" stroke="#07090B" strokeWidth="1.2" />
      <path d="M9.5 28.5c.6-3.8 2.6-6.6 5.4-8" fill="none" stroke="#FFFFFF" strokeOpacity="0.38" strokeWidth="2" strokeLinecap="round" />
      <path d="M33 45.5c3-2.4 4.6-5.6 4.8-9.4" fill="none" stroke="#9AA6B2" strokeOpacity="0.3" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="22" cy="35" r="11" fill={fixed ? "url(#bal-plate)" : "url(#bal-plate-mine)"} stroke={fixed ? "#5D6670" : "#7A4F14"} strokeWidth="1.2" />
      <circle cx="22" cy="35" r="9" fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="0.8" />
      <text x="22" y="40.6" textAnchor="middle" fill="#14171A" fontFamily="var(--font-mono)" fontSize={value >= 10 ? 13 : 16} fontWeight="800">{value}</text>
      {fixed && (
        <g transform="translate(31.5 2)">
          <path d="M2.5 5V3.5a3 3 0 0 1 6 0V5" fill="none" stroke="#C9D1D8" strokeWidth="1.6" />
          <rect x="1" y="5" width="9" height="7" rx="1.5" fill="#C9D1D8" stroke="#0E1114" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  );
}

/** Three small level beams that settle in a row: the "all three balanced" moment. */
export function TripleLevelFx({ reduced }: { reduced: boolean }) {
  return (
    <div className={`bal-solve-fx${reduced ? " bal-reduced" : ""}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <svg key={i} className="bal-mini" style={{ ["--i" as string]: i, ["--from" as string]: `${i === 1 ? -9 : 9}deg` }} width="72" height="34" viewBox="0 0 72 34">
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
`;
