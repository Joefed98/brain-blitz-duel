import { useId } from 'react';
import { BONK_BODY, BONK_HAT, BONK_SPIKES } from '@/lib/arcade/bonkShapes.renderer';
/** Intro-still Bonk target: the same silhouettes and shading as the board's cached sprites. */
export function BonkIcon({ red = false, hedgehog = false }: { red?: boolean; hedgehog?: boolean }) {
  const id = useId().replace(/:/g, '');
  const shade = `bonk-shade-${id}`, hat = `bonk-hat-${id}`;
  return <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
    <defs>
      <radialGradient id={shade} cx="0.38" cy="0.4" r="0.62">
        <stop offset="0" stopColor="#FFF0DC" stopOpacity="0.22"/>
        <stop offset="0.6" stopColor="#000" stopOpacity="0"/>
        <stop offset="1" stopColor="#1E120C" stopOpacity="0.38"/>
      </radialGradient>
      <linearGradient id={hat} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF" stopOpacity="0.18"/>
        <stop offset="0.6" stopColor="#000" stopOpacity="0"/>
        <stop offset="1" stopColor="#000" stopOpacity="0.28"/>
      </linearGradient>
    </defs>
    {hedgehog ? <><path d={BONK_SPIKES} fill="var(--bonk-spines)"/><circle cx="50" cy="54" r="32" fill="var(--bonk-fur)"/><circle cx="50" cy="54" r="32" fill={`url(#${shade})`}/><path d="M30 64q14-23 35 0" fill="var(--bonk-muzzle)"/><circle cx="45" cy="57" r="3" fill="var(--bonk-ink)"/><circle cx="57" cy="57" r="3" fill="var(--bonk-ink)"/></> : <>
      <path d={BONK_BODY} fill="var(--bonk-fur)"/>
      <path d={BONK_BODY} fill={`url(#${shade})`}/>
      <ellipse cx="51" cy="75" rx="22" ry="17" fill="var(--bonk-muzzle)"/>
      <path d="M35 58h8m18 0h8" stroke="var(--bonk-ink)" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="51" cy="68" r="5" fill="var(--bonk-ink)"/>
      <path d="M43 79q8 9 16 0" fill="none" stroke="var(--bonk-ink)" strokeWidth="3" strokeLinecap="round"/>
      <path d="M47.6 82.6h3v4h-3zm3.8 0h3v4h-3z" fill="#FFFBF0"/>
      <path d={BONK_HAT} fill={red ? 'var(--bonk-red)' : 'var(--bonk-gold)'}/>
      <path d={BONK_HAT} fill={`url(#${hat})`}/>
      <path d="M2 44h96v9H2z" fill="#000" fillOpacity="0.22"/>
      <path d="M25 38q1-19 18-23" stroke="var(--bonk-hat-shine)" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </>}
  </svg>;
}
