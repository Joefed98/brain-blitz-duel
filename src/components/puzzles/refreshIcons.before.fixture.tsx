import type { ArrowDir, SpotShapeKind } from '@/lib/duel/types';

export const EAGLE_ANGLES: Record<ArrowDir, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
export const SWEET_NAMES: Record<SpotShapeKind, string> = { circle: 'lollipop', square: 'wrapped sweet', triangle: 'ice cream cone', star: 'cupcake', hexagon: 'doughnut', arrow: 'candy cane' };

/** A single north-facing silhouette; its beak, wings and split tail establish direction. */
export function EagleIcon({ dir, size = 28 }: { dir: ArrowDir; size?: number }) {
  return <svg width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
    <path transform={`rotate(${EAGLE_ANGLES[dir]} 16 16)`} fill="currentColor" d="M16 2 19 7 18 11 22 12 29 8 27 15 22 19 19 19 18 24 20 29 16 27 12 29 14 24 13 19 10 19 5 15 3 8 10 12 14 11 13 7Z" />
  </svg>;
}

/** All six icons share a flat fill and a restrained two-unit detail stroke. */
export function SweetIcon({ kind, fill }: { kind: SpotShapeKind; fill: string }) {
  const detail = 'var(--sweet-detail)';
  switch (kind) {
    case 'circle': return <g fill={fill}><path d="M18 21h4v16h-4z"/><circle cx="20" cy="14" r="11"/><path d="M15 10c8-6 14 7 5 8-5 1-6-5-2-5" fill="none" stroke={detail} strokeWidth="2" strokeLinecap="round"/></g>;
    case 'square': return <g fill={fill}><path d="m3 10 9 5v10l-9 5 3-10zM37 10l-9 5v10l9 5-3-10z"/><rect x="10" y="10" width="20" height="20" rx="6"/><path d="M15 14v12M25 14v12" fill="none" stroke={detail} strokeWidth="2" strokeLinecap="round"/></g>;
    // The point remains north, just like the old triangle. The side scoop makes mirrors visible.
    case 'triangle': return <g fill={fill}><path d="m20 3 12 22H8z"/><path d="M7 26c0-5 5-7 9-5 1-7 13-7 15 0 5 1 7 8 2 12H8c-4-1-5-5-1-7Z"/><path d="m17 14 6 7M15 20l4 5" stroke={detail} strokeWidth="2" fill="none" strokeLinecap="round"/></g>;
    case 'star': return <g fill={fill}><path d="m9 23 3 14h16l3-14zM7 22c-2-5 2-9 6-9-2-7 10-10 13-3 6-1 10 5 7 12Z"/><path d="M16 27v6M24 27v6M11 18h18" stroke={detail} strokeWidth="2" fill="none" strokeLinecap="round"/></g>;
    case 'hexagon': return <g><path fill={fill} fillRule="evenodd" d="M20 3a17 17 0 1 0 0 34 17 17 0 0 0 0-34Zm0 11a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/><path d="m11 11 3 1m13-1-1 3m-17 9 3 1m13 7 3-1" stroke={detail} strokeWidth="2" strokeLinecap="round"/></g>;
    // Long shaft leads right into the hook; the open hook clearly changes under a mirror.
    case 'arrow': return <g fill={fill}><path d="M4 17h20c3 0 4-2 4-4s-1-4-3-4c-2 0-3 1-3 3h-6c0-6 4-9 9-9 6 0 10 5 10 10 0 6-4 10-11 10H4z"/><path d="m10 18-2 4m9-4-2 4m10-5 3 3" stroke={detail} strokeWidth="2" fill="none" strokeLinecap="round"/></g>;
  }
}

export function Kettlebell({ value, fixed = false, size = 44 }: { value: number; fixed?: boolean; size?: number }) {
  return <svg width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 44 44" role="img" aria-label={`${value}${fixed ? ' fixed' : ''}`} className="balance-weight">
    <path d="M15 17V10c0-7 14-7 14 0v7" fill="none" stroke="var(--balance-handle)" strokeWidth="4"/>
    <path d="M13 15h18l5 10c4 9 0 15-14 15S4 34 8 25Z" fill="var(--primary)" stroke="var(--balance-weight-edge)" strokeWidth="1"/>
    <path d="M11 26c0-4 2-7 4-8" fill="none" stroke="var(--balance-highlight)" strokeWidth="2" strokeLinecap="round"/>
    <text x="22" y="32" textAnchor="middle" fill="var(--primary-foreground)" fontFamily="var(--font-mono)" fontSize="17" fontWeight="700">{value}</text>
    {fixed && <circle cx="22" cy="37" r="1.5" fill="var(--balance-weight-edge)"/>}
  </svg>;
}