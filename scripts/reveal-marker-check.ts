/** Drawing-only regression; no browser, simulation stepping or identity proof. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hoverGame } from '../src/lib/arcade/hover';
import { hoverArtGame, hoverRevealGame } from '../src/lib/arcade/hover.renderer';
import { crossGame } from '../src/lib/arcade/cross';
import { crossArtGame, crossRevealGame } from '../src/lib/arcade/cross.renderer';
import { junctionGame } from '../src/lib/arcade/junction';
import { junctionArtGame, junctionRevealGame } from '../src/lib/arcade/junction.renderer';
import { skylineGame } from '../src/lib/arcade/skyline';
import { skylineArtGame, skylineRevealGame } from '../src/lib/arcade/skyline.renderer';
import { rallyGame } from '../src/lib/arcade/rally';
import { rallyArtGame, rallyRevealGame } from '../src/lib/arcade/rally.renderer';
function context() {
  const colours = new Set<string>();
  const gradient = { addColorStop() {} };
  const base = { canvas: {}, getTransform: () => ({ a: 1, b: 0 }), createLinearGradient: () => gradient,
    createRadialGradient: () => gradient, createPattern: () => null, measureText: () => ({ width: 40 }) };
  const ctx = new Proxy(base as unknown as CanvasRenderingContext2D, {
    get(t, k) { return Reflect.get(t, k) ?? (() => {}); },
    set(t, k, v) { if (k === 'fillStyle') colours.add(String(v)); return Reflect.set(t, k, v); },
  });
  return { ctx, colours };
}
function check<S>(name: string, state: S, live: { draw(c: CanvasRenderingContext2D, s: S, size: {width:number;height:number}): void }, reveal: typeof live, forbidden: string[]) {
  for (const width of [382, 367]) {
    const before = JSON.stringify(state);
    const a = context(), b = context();
    live.draw(a.ctx, state, { width, height: 560 });
    reveal.draw(b.ctx, state, { width, height: 560 });
    for (const colour of forbidden) {
      assert(a.colours.has(colour), `${name} live crash artwork preserved: ${colour}`);
      assert(!b.colours.has(colour), `${name} reveal indicator omitted: ${colour}`);
    }
    assert.equal(JSON.stringify(state), before, `${name} drawing never mutates state`);
  }
}
const hover = hoverGame.init(17); hover.crashed = true;
check('Hover', hover, hoverArtGame, hoverRevealGame, ['rgba(255,59,92,0.2)']);
const cross = crossGame.init(17); cross.dead = true; cross.tick = 100; cross.hitTick = 100;
check('Cross', cross, crossArtGame, crossRevealGame, ['rgba(255,77,77,0.55)', 'rgba(255, 77, 77, 0.22)']);
const junction = junctionGame.init(17); junction.ended = 2;
check('Junction', junction, junctionArtGame, junctionRevealGame, ['#FF8A3D']);
const skyline = skylineGame.init(17); skyline.missed = true;
check('Skyline', skyline, skylineArtGame, skylineRevealGame, ['rgba(229, 72, 77, 0.18)']);
const rally = rallyGame.init(17); rally.dead = true;
check('Rally', rally, rallyArtGame, rallyRevealGame, ['rgba(255,59,92,0.2)']);
assert.match(readFileSync('src/components/duel/IntroDemo.tsx', 'utf8'), /renderer\.drawFinal\([^;]+"demo"\)/);
assert.match(readFileSync('src/components/duel/ArcadeReveal.tsx', 'utf8'), /outcome === "finish" \? "var\(--me\)" : null/);
console.log('PASS: five reveal variants at both widths omit crash indicators, preserve live art and state; demo routing and gold finish ring retained.');