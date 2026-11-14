// Writes ../tokens.proposed.css from kit2.mjs. From the repo root: node docs/design/style-guide/source/tokens-css.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as k from './kit2.mjs';
const name = (n) => n.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()).replace(/(\D)(\d)$/, '$1-$2');
let o = '/* Joulz tokens, round 2 proposal (docs/design/style-guide). Not imported by the app: approval first. */\n';
for (const t of ['dark', 'light']) {
  o += (t === 'dark' ? ':root' : ':root[data-theme="light"]') + ' {\n';
  for (const [n, v] of Object.entries(k.THEMES[t])) o += `  --jz-${name(n)}: ${v};\n`;
  o += '}\n';
}
o += `:root {\n  --jz-gold-metal: ${k.GOLD_METAL};\n`;
for (const [n, s, l, w] of k.TYPE) o += `  --jz-type-${n}: ${w} ${s}px/${l}px Archivo, sans-serif;\n`;
for (const s of k.SPACE) o += `  --jz-space-${s}: ${s}px;\n`;
for (const [n, r] of Object.entries(k.RADIUS)) o += `  --jz-radius-${n}: ${r}px;\n`;
o += `  --jz-ledge: 4px;
  --jz-elev-1: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 4px 0 var(--jz-ledge-2);
  --jz-elev-2: 0 -8px 32px rgb(0 0 0 / 0.5), 0 16px 48px rgb(0 0 0 / 0.6);
  --jz-dur-press: 70ms;
  --jz-dur-release: 160ms;
  --jz-dur-select: 120ms;
  --jz-dur-sheet-in: 280ms;
  --jz-dur-sheet-out: 200ms;
  --jz-dur-page: 220ms;
  --jz-dur-reward: 420ms;
  --jz-dur-count: 600ms;
  --jz-dur-win: 900ms;
  --jz-ease-out: cubic-bezier(.2, .9, .25, 1);
}
`;
fs.writeFileSync(path.join(k.REPO, 'docs/design/style-guide/tokens.proposed.css'), o);
