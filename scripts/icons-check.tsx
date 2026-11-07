/**
 * icons-check (icon swap, 7 Nov 2026; presentation only; ~1 s, no browser). Proves:
 *  1. src/design/icons/icons.data.ts is exactly what docs/icons/svg/ gives (scripts/icons-build.ts).
 *  2. Every label in docs/icons/names.json has its file, every file has a label, and the four tabs have
 *     their filled `-on` versions.
 *  3. Every icon is drawn on the 24 grid in currentColor only (no colour of its own, no link to fetch).
 *  4. Icon renders decorative by default (aria-hidden, no role), named only when given a label, at the
 *     size it is asked for (set inline), with its tone as data-tone.
 *  5. The stock (lucide-react) icons the Joulz set replaced are not imported anywhere in app chrome again
 *     (game boards under src/puzzles and src/components/puzzles keep theirs: game art is untouched).
 *
 *   bun scripts/icons-check.tsx
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { Icon } from "../src/design/components/Icon";
import { ICON_BODIES, ICON_LABELS } from "../src/design/icons/icons.data";
import { buildIconData, ICON_DATA_FILE, ICON_NAMES_FILE, ICON_SVG_DIR, iconFiles } from "./icons-build";

let failures = 0;
function check(ok: boolean, message: string) {
  if (!ok) {
    failures++;
    console.log(`FAIL ${message}`);
  }
}

// 1. The data file.
check(readFileSync(ICON_DATA_FILE, "utf8") === buildIconData(), `${ICON_DATA_FILE} is out of date: run bun scripts/icons-build.ts`);

// 2. Names and files.
const labels = JSON.parse(readFileSync(ICON_NAMES_FILE, "utf8")) as Record<string, string>;
const files = iconFiles().map((f) => f.replace(/\.svg$/, ""));
for (const name of Object.keys(labels)) check(files.includes(name), `${name} is in names.json but has no ${name}.svg`);
for (const name of files) {
  const base = name.replace(/-on$/, "");
  check(base in labels, `${name}.svg has no label in names.json`);
  check(name in ICON_LABELS, `${name} has no label in the data file`);
}
for (const tab of ["play", "practice", "tournaments", "profile"]) check(files.includes(`${tab}-on`), `the ${tab} tab has no ${tab}-on.svg`);
check(Object.keys(ICON_BODIES).length === files.length, "the data file and the svg folder hold different icons");

// 3. The drawings.
for (const name of files) {
  const source = readFileSync(join(ICON_SVG_DIR, `${name}.svg`), "utf8");
  check(/viewBox=['"]0 0 24 24['"]/.test(source), `${name}.svg is not on the 24 grid`);
  check(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(source), `${name}.svg names a colour of its own`);
  const colours = [...source.matchAll(/(?:fill|stroke)=['"]([^'"]+)['"]/g)].map((m) => m[1]);
  check(colours.every((c) => c === "currentColor" || c === "none"), `${name}.svg uses a fill or stroke other than currentColor`);
  check(!/href|url\(|<image|<script/i.test(source), `${name}.svg links to something`);
}

// 4. The component.
const plain = renderToStaticMarkup(<Icon name="close" />);
check(/aria-hidden="true"/.test(plain) && !/role=/.test(plain), "Icon is not decorative by default");
check(/width:24px;height:24px/.test(plain) && /width="24"/.test(plain), "Icon's default size is not 24 px");
const named = renderToStaticMarkup(<Icon name="share" size={18} label="Share" tone="cyan" />);
check(/role="img"/.test(named) && /aria-label="Share"/.test(named) && !/aria-hidden/.test(named), "a labelled Icon is not named");
check(/width:18px;height:18px/.test(named), "Icon size 18 is not set inline");
check(/data-tone="cyan"/.test(named), "Icon's tone is not marked");
check(named.includes(ICON_BODIES.share), "Icon does not draw the approved markup");
check(!/data-tone/.test(plain), "an inherit-tone Icon carries a tone");

// 5. No replaced stock icon back in app chrome.
const REPLACED = new Set([
  "X", "Search", "Settings", "Share", "Lock", "Check", "ChevronLeft", "ChevronDown", "Volume2", "Music2",
  "MessageSquare", "MessageCircle", "EllipsisVertical", "CalendarPlus", "Clock", "Users", "Zap", "Target",
  "Trophy", "UserRound",
]);
const GAME_ART = [/^src\/puzzles\//, /^src\/components\/puzzles\//];
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}
for (const file of walk("src")) {
  if (GAME_ART.some((re) => re.test(file))) continue;
  const m = /import \{([^}]*)\} from "lucide-react"/.exec(readFileSync(file, "utf8"));
  if (!m) continue;
  for (const name of m[1]!.split(",").map((n) => n.replace(/^type\s+/, "").trim()).filter(Boolean))
    check(!REPLACED.has(name), `${file} imports lucide's ${name}: use Icon (docs/icons) instead`);
}

if (failures) {
  console.log(`FAIL icons-check: ${failures} failure${failures === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`PASS icons-check: ${files.length} icons, data file current, Icon decorative by default, no replaced stock icon in app chrome`);
