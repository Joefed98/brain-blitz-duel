import type { ArrowDir, SpotShapeKind } from '@/lib/duel/types';

export const EAGLE_ANGLES: Record<ArrowDir, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
export const SWEET_NAMES: Record<SpotShapeKind, string> = { circle: 'lollipop', square: 'wrapped sweet', triangle: 'ice cream cone', star: 'cupcake', hexagon: 'doughnut', arrow: 'candy cane' };

/**
 * A north-facing eagle seen from above in a glide (redrawn 3 Nov 2026 with Eagle Eye's art, eagleEyeArt.tsx): a round
 * head with a hooked gold beak at the front, broad wings arched forward with spread fingers, and a fanned tail.
 */
export function EagleIcon({ dir, size = 28 }: { dir: ArrowDir; size?: number }) {
  return <svg width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
    <g transform={`rotate(${EAGLE_ANGLES[dir]} 16 16)`}>
      <path fill="currentColor" d="M16 1.6C17.7 1.6 18.7 3 18.6 4.8 18.5 6.4 17.8 7.4 18 8.4 18.2 9.4 19 10 20.2 9.6 22 8.4 23.6 7.4 25.4 7.4 27.8 7.6 30.2 9.4 31.6 12.6L31.9 14.4 30.3 14.2 31.4 15.9 30.9 16.7 29.4 16 30.3 17.8 29.6 18.5 28.3 17.4 28.7 19.4 27.8 19.8 26.7 18.2C24.8 17.7 22.6 17.6 20.8 17.8 19.4 18 18.7 19 18.6 20.8L22 27.2 21.2 28.8 19.6 28.6 18.4 29.9 16 29.2 13.6 29.9 12.4 28.6 10.8 28.8 10 27.2 13.4 20.8C13.3 19 12.6 18 11.2 17.8 9.4 17.6 7.2 17.7 5.3 18.2L4.2 19.8 3.3 19.4 3.7 17.4 2.4 18.5 1.7 17.8 2.6 16 1.1 16.7.6 15.9 1.7 14.2.1 14.4.4 12.6C1.8 9.4 4.2 7.6 6.6 7.4 8.4 7.4 10 8.4 11.8 9.6 13 10 13.8 9.4 14 8.4 14.2 7.4 13.5 6.4 13.4 4.8 13.3 3 14.3 1.6 16 1.6Z" />
      <path d="M14.8 2.9C15 .3 17 .3 17.2 2.9 16.8 2.4 16.4 3.1 16 4 15.6 3.1 15.2 2.4 14.8 2.9Z" fill="var(--eagle-eye)" stroke="var(--eagle-beak)" strokeWidth=".45" strokeLinejoin="round" />
    </g>
  </svg>;
}

/** Bold, simplified sweets that fill the 40-unit box; at most one detail stroke each. */
export function SweetIcon({ kind, fill }: { kind: SpotShapeKind; fill: string }) {
  const detail = 'var(--sweet-detail)';
  switch (kind) {
    case 'circle': return <g fill={fill}><rect x="18" y="24" width="4" height="15" rx="1.5"/><circle cx="20" cy="14" r="13"/><path d="M14 9c6-5 13 4 6 7" fill="none" stroke={detail} strokeWidth="2.6" strokeLinecap="round"/></g>;
    case 'square': return <g fill={fill}><path d="M1 9l10 7v8L1 31zM39 9l-10 7v8l10 7z"/><rect x="9" y="8" width="22" height="24" rx="7"/></g>;
    // Cone points down under a round scoop; the cherry sits off-centre so flips stay visible.
    case 'triangle': return <g fill={fill}><path d="M8 19h24L20 39z"/><circle cx="20" cy="15" r="12"/><circle cx="29" cy="5" r="4"/><path d="M12 23l7 7" stroke={detail} strokeWidth="2.6" fill="none" strokeLinecap="round"/></g>;
    case 'star': return <g fill={fill}><path d="M6 20h28l-4 18H10z"/><path d="M4 21c-2-7 4-11 8-10-1-8 15-11 17-3 7 0 10 7 7 13z"/><path d="M20 24v11" stroke={detail} strokeWidth="2.6" fill="none" strokeLinecap="round"/></g>;
    case 'hexagon': return <path fill={fill} fillRule="evenodd" d="M20 1a19 19 0 1 0 0 38 19 19 0 0 0 0-38Zm0 12a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z"/>;
    // Long shaft leads right into the hook; the open hook clearly changes under a mirror.
    case 'arrow': return <g fill={fill}><path d="M1 17h23c3 0 5-2 5-5s-2-5-4-5c-3 0-4 2-4 4h-7c0-7 5-10 11-10 7 0 12 5 12 11 0 7-5 12-13 12H1z"/></g>;
  }
}

/** Movable kettlebells are gold; fixed ones are dark iron with a small lock. */
export function Kettlebell({ value, fixed = false, size = 44 }: { value: number; fixed?: boolean; size?: number }) {
  return <svg width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 44 44" role="img" aria-label={`${value}${fixed ? ' fixed' : ''}`} className="balance-weight">
    <path d="M15 17V10c0-7 14-7 14 0v7" fill="none" stroke={fixed ? 'var(--balance-iron-edge)' : 'var(--balance-handle)'} strokeWidth="4"/>
    <path d="M13 15h18l5 10c4 9 0 15-14 15S4 34 8 25Z" fill={fixed ? 'var(--balance-iron)' : 'var(--primary)'} stroke={fixed ? 'var(--balance-iron-edge)' : 'var(--balance-weight-edge)'} strokeWidth="1"/>
    <path d="M11 26c0-4 2-7 4-8" fill="none" stroke="var(--balance-highlight)" strokeOpacity={fixed ? 0.45 : 1} strokeWidth="2" strokeLinecap="round"/>
    <text x="22" y="33" textAnchor="middle" fill={fixed ? 'var(--balance-highlight)' : 'var(--primary-foreground)'} fontFamily="var(--font-mono)" fontSize="16" fontWeight="700">{value}</text>
    {fixed && <g transform="translate(31 4)">
      <path d="M2.5 5V3.5a3 3 0 0 1 6 0V5" fill="none" stroke="var(--balance-highlight)" strokeWidth="1.6"/>
      <rect x="1" y="5" width="9" height="7" rx="1.5" fill="var(--balance-highlight)"/>
    </g>}
  </svg>;
}
