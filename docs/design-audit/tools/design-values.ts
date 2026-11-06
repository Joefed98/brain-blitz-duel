/**
 * Design audit: counts every design value written in the app's source (6 Nov 2026; read-only).
 * Scans src/**\/*.css and src/**\/*.{ts,tsx} (games' sim/renderer art under src/lib/arcade is reported
 * separately, since it is canvas art, not UI). Writes docs/design-audit/design-values.json and
 * docs/design-audit/design-values.md.
 *
 *   bun docs/design-audit/tools/design-values.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(css|tsx?|)$/.test(f) && !f.endsWith(".data.ts")) files.push(p);
  }
};
walk(join(ROOT, "src"));

type Bucket = Map<string, { count: number; files: Map<string, number> }>;
const buckets: Record<string, Bucket> = {};
const add = (kind: string, value: string, file: string) => {
  const b = (buckets[kind] ??= new Map());
  const v = value.trim().replace(/\s+/g, " ");
  const e = b.get(v) ?? { count: 0, files: new Map() };
  e.count++;
  e.files.set(file, (e.files.get(file) ?? 0) + 1);
  b.set(v, e);
};

// UI = everything but the arcade sims/renderers and the puzzle game boards' canvas art.
const zone = (rel: string) =>
  /^src\/lib\/arcade\//.test(rel) || /renderer\.ts$/.test(rel)
    ? "game-art"
    : /^src\/puzzles\//.test(rel) || /^src\/polish-(?!layout)/.test(rel) || /^src\/components\/puzzles\//.test(rel)
      ? "puzzle-ui"
      : "ui";

for (const file of files) {
  const rel = relative(ROOT, file);
  const z = zone(rel);
  const text = readFileSync(file, "utf8");
  const k = (kind: string) => `${z}:${kind}`;
  // Colours
  for (const m of text.matchAll(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b/g)) {
    // Skip "#123" inside urls or ids by requiring a non-word char before.
    const i = m.index!;
    if (/[\w&]/.test(text[i - 1] ?? "")) continue;
    add(k("hex"), m[0].toUpperCase(), rel);
  }
  for (const m of text.matchAll(/\b(?:rgba?|hsla?|oklch|oklab|color-mix)\([^)]*\)/g)) add(k("colour-fn"), m[0], rel);
  if (rel.endsWith(".css")) {
    for (const m of text.matchAll(/font-family:\s*([^;}{]+)/g)) add(k("font-family"), m[1]!, rel);
    for (const m of text.matchAll(/font-size:\s*([^;}{]+)/g)) add(k("font-size"), m[1]!, rel);
    for (const m of text.matchAll(/font-weight:\s*([^;}{]+)/g)) add(k("font-weight"), m[1]!, rel);
    for (const m of text.matchAll(/letter-spacing:\s*([^;}{]+)/g)) add(k("letter-spacing"), m[1]!, rel);
    for (const m of text.matchAll(/line-height:\s*([^;}{]+)/g)) add(k("line-height"), m[1]!, rel);
    for (const m of text.matchAll(/border-radius:\s*([^;}{]+)/g)) add(k("radius"), m[1]!, rel);
    for (const m of text.matchAll(/box-shadow:\s*([^;}{]+)/g)) add(k("shadow"), m[1]!, rel);
    for (const m of text.matchAll(/text-shadow:\s*([^;}{]+)/g)) add(k("text-shadow"), m[1]!, rel);
    for (const m of text.matchAll(/(?:linear|radial|conic)-gradient\(/g)) {
      // capture the balanced gradient
      let depth = 0;
      let j = m.index!;
      for (; j < text.length; j++) {
        if (text[j] === "(") depth++;
        else if (text[j] === ")" && --depth === 0) break;
      }
      add(k("gradient"), text.slice(m.index!, j + 1), rel);
    }
    for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) add(k("css-var-defined"), m[1]!, rel);
  } else {
    // Tailwind classes in TSX
    for (const m of text.matchAll(/(?<![\w-])(text-(?:xs|sm|base|lg|[2-9]?xl)|font-(?:thin|light|normal|medium|semibold|bold|extrabold|black)|rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?|shadow(?:-(?:sm|md|lg|xl|2xl|inner|none))?|font-(?:sans|mono|display|serif))(?![\w-])/g))
      add(k("tailwind-scale"), m[1]!, rel);
    for (const m of text.matchAll(/(?<![\w-])((?:[a-z]+:)*[a-z][\w-]*-\[[^\]\s"'`]+\])/g)) add(k("tailwind-arbitrary"), m[1]!, rel);
    for (const m of text.matchAll(/fontSize:\s*([^,}\n]+)/g)) add(k("inline-font-size"), m[1]!, rel);
    for (const m of text.matchAll(/borderRadius:\s*([^,}\n]+)/g)) add(k("inline-radius"), m[1]!, rel);
    for (const m of text.matchAll(/\bfont\s*=\s*[`"']([^`"']*px[^`"']*)[`"']|\.font\s*=\s*[`"']([^`"']+)[`"']/g)) add(k("canvas-font"), (m[1] ?? m[2])!, rel);
  }
}

const out: Record<string, { value: string; count: number; files: Record<string, number> }[]> = {};
for (const [kind, b] of Object.entries(buckets))
  out[kind] = [...b.entries()]
    .map(([value, e]) => ({ value, count: e.count, files: Object.fromEntries(e.files) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
writeFileSync("docs/design-audit/design-values.json", JSON.stringify(out, null, 1) + "\n");

const esc = (s: string) => s.replace(/\|/g, "\\|").slice(0, 160);
const topFiles = (f: Record<string, number>) =>
  Object.entries(f)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([p, n]) => `${p.replace(/^src\//, "")}${n > 1 ? ` ×${n}` : ""}`)
    .join(", ");
const TITLES: Record<string, string> = {
  hex: "Hard-coded hex colours",
  "colour-fn": "rgb()/hsl()/oklch()/color-mix() colours",
  "font-family": "font-family declarations",
  "font-size": "font-size declarations (CSS)",
  "font-weight": "font-weight declarations (CSS)",
  "letter-spacing": "letter-spacing (CSS)",
  "line-height": "line-height (CSS)",
  radius: "border-radius (CSS)",
  shadow: "box-shadow (CSS)",
  "text-shadow": "text-shadow (CSS)",
  gradient: "Gradients (CSS)",
  "css-var-defined": "CSS custom properties defined",
  "tailwind-scale": "Tailwind scale classes (text/font/rounded/shadow)",
  "tailwind-arbitrary": "Tailwind arbitrary values (`x-[…]`)",
  "inline-font-size": "Inline style fontSize",
  "inline-radius": "Inline style borderRadius",
  "canvas-font": "Canvas fonts (ctx.font)",
};
let md = `# Design values in use (generated)\n\nGenerated by \`bun docs/design-audit/tools/design-values.ts\` from \`src/\` on 6 Nov 2026. Counts are occurrences in source (one declaration = one count), not rendered instances. **ui** = app screens and shared components; **puzzle-ui** = the puzzle games' own boards and widgets (\`src/puzzles\`, \`src/components/puzzles\`, \`src/polish-*\` except \`polish-layout\`); **game-art** = arcade sims/renderers (canvas art drawn inside a game world). "One-off" = used exactly once. Full data, with every file, in \`design-values.json\`.\n\n`;
md += `## Summary\n\n| Kind | Zone | Distinct values | Occurrences | One-offs |\n|---|---|---:|---:|---:|\n`;
for (const [kind, rows] of Object.entries(out).sort())
  md += `| ${TITLES[kind.split(":")[1]!] ?? kind} | ${kind.split(":")[0]} | ${rows.length} | ${rows.reduce((s, r) => s + r.count, 0)} | ${rows.filter((r) => r.count === 1).length} |\n`;
const LIMIT: Record<string, number> = { "css-var-defined": 80, "tailwind-arbitrary": 150, hex: 150, "colour-fn": 80, gradient: 60, shadow: 80 };
for (const [kind, rows] of Object.entries(out).sort()) {
  const [z, k] = kind.split(":") as [string, string];
  if (z === "game-art" && !["hex", "canvas-font"].includes(k)) continue;
  const lim = z === "game-art" ? 40 : (LIMIT[k] ?? 100);
  md += `\n## ${TITLES[k] ?? k} — ${z}\n\n${rows.length} distinct, ${rows.filter((r) => r.count === 1).length} one-offs${rows.length > lim ? `; top ${lim} shown, the rest in design-values.json` : ""}.\n\n| Value | Count | Where (top files) | Flag |\n|---|---:|---|---|\n`;
  for (const r of rows.slice(0, lim))
    md += `| \`${esc(r.value)}\` | ${r.count} | ${esc(topFiles(r.files))} | ${r.count === 1 ? "one-off" : ""} |\n`;
}
writeFileSync("docs/design-audit/design-values.md", md);
console.log(Object.entries(out).map(([k, r]) => `${k}: ${r.length}`).join("\n"));
