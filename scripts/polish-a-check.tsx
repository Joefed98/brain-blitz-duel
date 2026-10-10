import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { equationPuzzle } from '../src/puzzles/equation';
import { puzzlePresentation, puzzleInputDemoCompatible, POLISH_A_DEMOS } from '../src/components/puzzles/wordInput';
const css = readFileSync('src/styles.css', 'utf8');
assert.match(css, /\.game-column \[data-polish\].*justify-content: center/);
assert.match(css, /--lw-wheel: clamp\(200px/);
assert.match(css, /prefers-reduced-motion.*reaction-tap-fade/s);
for (const type of POLISH_A_DEMOS) {
 assert.equal(puzzleInputDemoCompatible(type, {}), false, `${type}: old demo must be rejected`);
 assert.equal(puzzleInputDemoCompatible(type, { presentation: puzzlePresentation(type) }), true);
}
const html = renderToStaticMarkup(<equationPuzzle.Stage puzzle={{type:'equation',stages:[{numbers:[12,3,7,2,5],target:55}],operators:[]}} phaseStartedAt={0} now={0} locked={false} onSubmit={()=>{}}/>);
assert.equal((html.match(/equation-slot/g) ?? []).length, 4);
assert.match(html, /polish-equation/);
assert.match(readFileSync('src/puzzles/numberHunt.tsx','utf8'), /wrong=\{flash === index\} size=\{44\}/);
assert.match(readFileSync('src/puzzles/stopWatch.tsx','utf8'), /stopwatch-history/);
assert.match(readFileSync('src/puzzles/wordSearch.tsx','utf8'), /found\.map\(\(entry\)/);
assert.doesNotMatch(readFileSync('src/puzzles/wordSearch.tsx','utf8').split('data-game-controls="words"')[1]?.split('</div>')[0] ?? '', /data\.words|placements|puzzle\.words/);
console.log('Polish A: scoped centring, wheel, reduced-motion ripple, 12 demo revisions, dense-grid no-spoilers, 44px discs and four equation slots passed.');
