import type { ArrowDir, SpotShapeKind } from '@/lib/duel/types';

export const EAGLE_ANGLES: Record<ArrowDir, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
export const SWEET_NAMES: Record<SpotShapeKind, string> = { circle: 'lollipop', square: 'wrapped sweet', triangle: 'ice cream cone', star: 'cupcake', hexagon: 'doughnut', arrow: 'candy cane' };

/**
 * A north-facing eagle seen from above in a glide: pointed hooked head with a gold eye at the
 * front, wings swept back into a chevron, and a narrow tail. The front reads like an arrow tip.
 */
export function EagleIcon({ dir, size = 28 }: { dir: ArrowDir; size?: number }) {
  return <svg width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
    <g transform={`rotate(${EAGLE_ANGLES[dir]} 16 16)`}>
      <path fill="currentColor" d="M16 1 18.6 4.2 18.4 8.4 21.2 9.6 26.4 10 30.8 11.6 31.4 13.8 29.6 13.6 30.4 15.6 28.4 15.2 29 17.2 26.8 16.6 25.2 18.2 19.6 15.6 18.2 21.2 20.4 26.6 19.4 27.4 18.8 28.8 17.4 28.2 16.9 29.6 16 29 15.1 29.6 14.6 28.2 13.2 28.8 12.6 27.4 11.6 26.6 13.8 21.2 12.4 15.6 6.8 18.2 5.2 16.6 3 17.2 3.6 15.2 1.6 15.6 2.4 13.6 0.6 13.8 1.2 11.6 5.6 10 10.8 9.6 13.6 8.4 13.4 4.2Z" />
      <path d="M16 1 17.4 3.2 16 4" fill="none" stroke="var(--eagle-beak)" strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx="16" cy="5.4" r="1.3" fill="var(--eagle-eye)" />
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
