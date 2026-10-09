import { BONK_BODY, BONK_HAT, BONK_SPIKES } from '@/lib/arcade/bonkShapes.renderer';
export function BonkIcon({ red = false, hedgehog = false }: { red?: boolean; hedgehog?: boolean }) {
  return <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
    {hedgehog ? <><path d={BONK_SPIKES} fill="var(--bonk-spines)"/><circle cx="50" cy="54" r="32" fill="var(--bonk-fur)"/><path d="M30 64q14-23 35 0" fill="var(--bonk-muzzle)"/><circle cx="45" cy="57" r="3" fill="var(--bonk-ink)"/><circle cx="57" cy="57" r="3" fill="var(--bonk-ink)"/></> : <>
      <path d={BONK_BODY} fill="var(--bonk-fur)"/>
      <ellipse cx="51" cy="75" rx="22" ry="17" fill="var(--bonk-muzzle)"/>
      <path d="M35 58h8m18 0h8" stroke="var(--bonk-ink)" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="51" cy="68" r="5" fill="var(--bonk-ink)"/>
      <path d="M43 79q8 9 16 0" fill="none" stroke="var(--bonk-ink)" strokeWidth="3" strokeLinecap="round"/>
      <path d={BONK_HAT} fill={red ? 'var(--bonk-red)' : 'var(--bonk-gold)'}/>
      <path d="M25 38q1-19 18-23" stroke="var(--bonk-hat-shine)" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </>}
  </svg>;
}