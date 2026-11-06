/**
 * reduced-motion-end-check (7 Nov 2026, from the design audit): with prefers-reduced-motion on, every
 * animated element ends in its visible final state.
 *
 * The global rule (src/styles.css, "Reduced motion: keep the information, drop the movement") cuts every
 * animation and transition to 0.01 ms with one iteration and zero delay, and keeps its fill mode, on every
 * element but the calm sequences in EXCLUDED, which keep their own reduced-motion timing (6 Nov 2026, the
 * design foundation; Joe chose this rule over the 7 Nov "hold still" fix). So an animation whose last keyframe
 * is hidden (opacity 0, or scaled to 0), filled forwards or both, ends on that hidden frame at once. Likewise
 * an element whose own style is opacity 0 and that only shows while its animation fills it ends hidden if the
 * fill doesn't hold. The check proves: the global rule zeroes delays; EXCLUDED is exactly its excluded list
 * and each has its own reduced-motion rule; the arcade results headline's and practice's "New best" calm fades
 * end in the same state at the same time as their full versions; every other animation ends visible.
 *
 * Read statically from every CSS file under src/ (and Tailwind @utility blocks) and every inline `animation`
 * in src/**\/*.tsx. Each such use must either be resolved under reduced motion — a rule in a
 * prefers-reduced-motion block for the same selector that sets `animation: none` (or another animation that
 * ends visible), or a reduced-motion `!important` animation on a shared selector the use sits under — or be
 * listed in EFFECTS below: decorative effects (a flash, a ring, a spark, a glow, a piece leaving the board)
 * whose rest state is "gone", each with the reason. A new animation that ends hidden fails until it is one
 * or the other, and an EFFECTS entry that no longer exists fails too.
 *
 *   bun scripts/reduced-motion-end-check.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The calm sequences the global reduced-motion rule leaves out (its `:not(…)` list, exactly), each with its own
 * reduced-motion rule: the room moments' calm fades, practice's "New best" and the arcade results' headline
 * fades, Logic's solve glow.
 */
const EXCLUDED = [".room-fx [data-part]", ".practice-new-best", ".arcade-celebration-headline", ".logic-calm-glow"];
/** Of those, the ones with a full-motion version the calm fade must match: same end state, at the same time. */
const MATCHES_FULL = [".practice-new-best", ".arcade-celebration-headline"];

/** Keyframes whose hidden end (or hidden start) is their rest state: purely decorative, never content. */
const EFFECTS: Record<string, string> = {
  // Room moments (src/lib/fx/roomMoments.ts): timed overlays removed with their phase; under reduced motion
  // every part runs rfx-calm (`!important`, full length) and movement-only parts are hidden.
  "rfx-calm": "room moment overlay's calm fade, the whole moment's length (!important duration), then the overlay leaves",
  "rfx-corner": "room moment overlay part (rfx-calm under reduced motion)",
  "rfx-dial": "room moment overlay part (rfx-calm under reduced motion)",
  "rfx-edge": "room moment overlay part (rfx-calm under reduced motion)",
  "rfx-flash": "room moment flash (rfx-calm under reduced motion)",
  "rfx-hairline": "room moment overlay part (rfx-calm under reduced motion)",
  "rfx-halo": "room moment overlay part (rfx-calm under reduced motion)",
  "rfx-prepare-glow": "Prepare to Duel glow (rfx-calm under reduced motion)",
  "rfx-rail": "room moment overlay part (rfx-calm under reduced motion)",
  "rfx-ring-out": "Prepare to Duel ring (rfx-calm under reduced motion)",
  "rfx-settle": "room moment overlay part (rfx-calm under reduced motion)",
  "rfx-sheen": "round title sheen (rfx-calm under reduced motion)",
  "rfx-streak-in": "Prepare to Duel streaks (rfx-calm under reduced motion)",
  // Shared feedback effects.
  "ink-reject": "Rainbow Bridge's red reject flash (only drawn with motion: inkBridge.tsx checks reduced motion)",
  "lock-collapse": "a locked piece collapsing away (no current user)",
  "reaction-tap-ripple": "the reaction button's tap ripple",
  "reaction-tap-fade": "the reaction button's tap ripple, reduced-motion version",
  sparkle: "Polypotions' and Hanoi's solve sparkles",
  "potion-rise": "Polypotions' rising bubbles",
  "arcade-reveal-pulse": "the arcade reveal's pulsing marker ring (the marker itself stays)",
  // Pattern puzzles (src/polish-pattern).
  "bp-peg-ring": "Block Party peg ring flash",
  "bp-shine": "Block Party solve shine (bp-shine-still under reduced motion)",
  "bp-shine-still": "Block Party solve shine, reduced-motion version",
  "bp-snap-ring": "Block Party snap ring",
  "flow-board-glow": "Pipeline/Flow solve glow",
  "flow-pulse": "Flow endpoint pulse",
  "grav-lock-ring": "Topsy-Turvy socket lock ring",
  "ice-fade-out": "Skid: a ball falling through a hole / the solve frost, reduced-motion version (the piece has left the board)",
  "ice-fall": "Skid: a ball falling through a hole (the piece has left the board)",
  "ice-frost-over": "Skid solve frost sweep",
  "ice-shatter-glint": "Skid ice shatter glint",
  "ice-solve-ring": "Skid solve ring",
  "ice-twinkle": "Skid ice twinkle",
  "laser-burst": "Lightbender gem burst",
  "laser-flare": "Lightbender solve flare",
  "pipe-surge-fade": "Pipeline solve surge",
  "push-dim": "Heave solve dimming wash",
  "push-dust": "Heave push dust",
  "push-light": "Heave light pool flash",
  "rings-rim": "Turntable solve rim",
  "rings-turn-flash": "Turntable turn flash",
  "tiles-ramp-light": "Gradient solve light",
  "tiles-ramp-sheen": "Gradient solve sheen",
  "topsy-star-pop": "Topsy-Turvy star taken (the star has gone)",
  "unblock-burst": "Gridlock exit burst",
  "unblock-streak": "Gridlock exit speed streaks",
  "maze-star-pop": "Labyrinth star taken (the star has gone; hidden outright under reduced motion)",
  // Logic puzzles (src/polish-logic; the stage clamps every animation to 1 ms under reduced motion).
  "logic-bulb-solve": "Lamplighter solve glow",
  "logic-calm-glow": "Logic solve glow, reduced-motion version",
  "logic-fuse": "Bomb Defusal fuse spark",
  "logic-fuse-die": "Bomb Defusal fuse spark dying",
  "logic-hanoi-rise": "Hanoi solve sparkles",
  "logic-lantern": "Tents lantern glow",
  "logic-light-in": "Lamplighter light spreading",
  "logic-nono-colour": "Mosaic solve colour wave",
  "logic-sudoku-light": "Box Six solve light",
  "logic-wire-spark": "Bomb Defusal wire spark",
};

/* ------------------------------------------------------------------ parsing */

const walk = (dir: string, re: RegExp): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, re) : re.test(f) ? [p] : [];
  });

interface Rule {
  file: string;
  selectors: string[];
  decls: Map<string, { value: string; important: boolean }>;
  reduced: boolean;
}
interface Keyframes {
  name: string;
  file: string;
  firstHidden: boolean;
  lastHidden: boolean;
}

const rules: Rule[] = [];
const keyframes = new Map<string, Keyframes[]>();
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const HIDDEN = (d: string) => /(^|[;\s{])opacity:\s*0(\.0+)?\s*(;|$|!|\s)/.test(d) || /scale[XY3d]*\(\s*0(\.0+)?\s*[,)]/.test(d) || /(^|[;\s])scale:\s*0(\.0+)?\s*(;|$)/.test(d);

function block(s: string, open: number): [string, number] {
  let depth = 0;
  for (let j = open; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return [s.slice(open + 1, j), j + 1];
  }
  return [s.slice(open + 1), s.length];
}

function decls(body: string): Map<string, { value: string; important: boolean }> {
  const out = new Map<string, { value: string; important: boolean }>();
  for (const part of body.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    let value = part.slice(i + 1).trim();
    const important = /!important\s*$/.test(value);
    value = value.replace(/!important\s*$/, "").trim();
    if (prop) out.set(prop, { value, important });
  }
  return out;
}

function parse(s: string, file: string, reduced: boolean): void {
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf("{", i);
    if (open < 0) return;
    const head = norm(s.slice(i, open).replace(/^[\s;}]+/, ""));
    const [body, next] = block(s, open);
    i = next;
    if (head.startsWith("@keyframes")) {
      const name = head.slice("@keyframes".length).trim();
      const frames = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), decl: m[2]! }));
      const at = (re: RegExp) => frames.filter((f) => f.sel.split(",").some((x) => re.test(x.trim()))).map((f) => f.decl).join(";");
      const k = { name, file, firstHidden: HIDDEN(at(/^(0%|from)$/)), lastHidden: HIDDEN(at(/^(100%|to)$/)) };
      keyframes.set(name, [...(keyframes.get(name) ?? []), k]);
    } else if (head.startsWith("@media")) {
      parse(body, file, reduced || /prefers-reduced-motion:\s*reduce/.test(head));
    } else if (head.startsWith("@utility")) {
      rules.push({ file, selectors: [`.${head.slice("@utility".length).trim()}`], decls: decls(body), reduced });
    } else if (head.startsWith("@")) {
      parse(body, file, reduced); // @layer, @supports, @container
    } else if (body.includes("{")) {
      parse(body, file, reduced); // nested rules
      rules.push({ file, selectors: head.split(",").map(norm), decls: decls(body.replace(/[^;{}]*\{[^{}]*\}/g, "")), reduced });
    } else {
      rules.push({ file, selectors: head.split(",").map(norm), decls: decls(body), reduced });
    }
  }
}

for (const file of walk("src", /\.css$/)) parse(readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""), file, false);

/** The animations a declaration list applies: name, fill and whether it loops. */
function animations(d: Map<string, { value: string; important: boolean }>): { name: string; fill: string; infinite: boolean; important: boolean }[] {
  const out: { name: string; fill: string; infinite: boolean; important: boolean }[] = [];
  const short = d.get("animation");
  const nameLong = d.get("animation-name");
  const fillLong = d.get("animation-fill-mode")?.value;
  const iterLong = d.get("animation-iteration-count")?.value;
  if (short) {
    for (const part of short.value.split(/,(?![^(]*\))/)) {
      const tokens = part.trim().split(/\s+(?![^(]*\))/);
      const name = tokens.find((t) => keyframes.has(t)) ?? (tokens.includes("none") ? "none" : null);
      if (!name) continue;
      const fill = tokens.find((t) => ["none", "forwards", "backwards", "both"].includes(t) && t !== name) ?? fillLong ?? "none";
      out.push({ name, fill, infinite: tokens.includes("infinite") || iterLong === "infinite", important: short.important });
    }
  } else if (nameLong) {
    for (const name of nameLong.value.split(",").map((s) => s.trim()))
      // A longhand's fill often comes from a shared rule: treat an unknown fill as holding.
      out.push({ name, fill: fillLong ?? "both", infinite: iterLong === "infinite", important: nameLong.important });
  }
  return out;
}

const endsHidden = (name: string) => (keyframes.get(name) ?? []).some((k) => k.lastHidden);
const startsHidden = (name: string) => (keyframes.get(name) ?? []).some((k) => k.firstHidden);
const holds = (fill: string) => fill === "forwards" || fill === "both";

/**
 * Whether the reduced-motion rules leave this selector visible at the end, read as the cascade does: the
 * rule that wins is the last one, `!important` ones first; a shared `!important` override (e.g.
 * `.room-fx [data-part]`) counts for the selectors under it. Hidden outright (display: none) counts too.
 */
function resolved(selector: string): boolean {
  let winner: { important: boolean; visible: boolean } | null = null;
  for (const r of rules) {
    if (!r.reduced) continue;
    const mine = r.selectors.includes(selector);
    const shared = !mine && r.selectors.some((s) => selector.startsWith(`${s} `));
    if (!mine && !shared) continue;
    if (mine && (r.decls.get("display")?.value === "none" || r.decls.get("visibility")?.value === "hidden")) return true;
    for (const a of animations(r.decls)) {
      if (shared && !a.important) continue;
      const visible = a.name === "none" || !(endsHidden(a.name) && holds(a.fill));
      if (!winner || a.important || !winner.important) winner = { important: a.important, visible };
    }
  }
  return winner?.visible ?? false;
}

/* ---------------------------------------------------------------- the check */

const failures: string[] = [];
let checked = 0;
const used = new Set<string>();

for (const r of rules) {
  if (r.reduced) continue;
  for (const a of animations(r.decls)) {
    if (a.name === "none") continue;
    used.add(a.name);
    const baseHidden = r.decls.get("opacity")?.value === "0";
    // Hidden at the end: the last frame hidden and held, or the element hidden itself and not held visible.
    const problem =
      (endsHidden(a.name) && holds(a.fill)) || (baseHidden && !endsHidden(a.name) && !holds(a.fill) && !a.infinite)
        ? endsHidden(a.name)
          ? "ends on a hidden last frame (opacity 0 or scale 0)"
          : "is opacity 0 itself and its animation doesn't hold the visible end"
        : null;
    if (!problem) continue;
    checked++;
    for (const sel of r.selectors) {
      // The excluded calm sequences keep their own timing; MATCHES_FULL below proves how they end.
      if (EXCLUDED.includes(sel)) continue;
      if (EFFECTS[a.name] || resolved(sel)) continue;
      failures.push(`${r.file}: \`${sel}\` (${a.name}) ${problem} under reduced motion; hold it visible there (animation: none) or, if it is a pure effect, list ${a.name} in EFFECTS`);
    }
  }
}

// Inline animations in components (style={{ animation: "…" }}).
for (const file of walk("src", /\.tsx$/)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/animation(?:Name)?:\s*[`"']([^`"']+)[`"']/g)) {
    const name = m[1]!.trim().split(/\s+/)[0]!;
    if (!keyframes.has(name)) continue;
    used.add(name);
    if (endsHidden(name) && !EFFECTS[name]) failures.push(`${file}: an inline ${name} animation ends hidden; give it a class with a reduced-motion rule, or list it in EFFECTS`);
  }
}

// The "New best" pill (NewBestPill draws nothing under reduced motion) stays held visible should it be drawn.
if (!resolved(".new-best-moment")) failures.push(".new-best-moment is not held visible under reduced motion");

// The global rule this check reasons about: every animation and transition cut to 0.01 ms with zero delay, on
// everything but EXCLUDED.
const styles = readFileSync("src/styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const globalRule = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:not\(([^)]*)\),\s*::before,\s*::after\s*\{([^}]*)\}/.exec(styles);
if (!globalRule) failures.push("src/styles.css's global reduced-motion rule (`:not(…), ::before, ::after`) not found: re-read this check's reasoning");
else {
  const body = decls(globalRule[2]!);
  const want: [string, string][] = [
    ["animation-duration", "0.01ms"],
    ["animation-iteration-count", "1"],
    ["animation-delay", "0s"],
    ["transition-duration", "0.01ms"],
    ["transition-delay", "0s"],
  ];
  for (const [prop, value] of want)
    if (body.get(prop)?.value !== value || !body.get(prop)?.important) failures.push(`the global reduced-motion rule must set \`${prop}: ${value} !important\``);
  const listed = globalRule[1]!.split(",").map(norm);
  if (listed.length !== EXCLUDED.length || EXCLUDED.some((e) => !listed.includes(e)))
    failures.push(`the global reduced-motion rule leaves out [${listed.join(", ")}]; this check expects exactly [${EXCLUDED.join(", ")}]`);
}
// Each excluded sequence has its own reduced-motion rule.
for (const sel of EXCLUDED) {
  const own = rules.some((r) => r.reduced && r.selectors.some((x) => x === sel || x.endsWith(` ${sel}`) || x.endsWith(`> ${sel}`) || x.includes(`${sel}`)) && (r.decls.has("animation") || r.decls.has("animation-name") || r.decls.has("animation-duration")));
  if (!own) failures.push(`${sel} is left out of the global reduced-motion rule but has no reduced-motion rule of its own`);
}
// The calm fade ends in the same state, at the same time, as the full version.
const animOf = (sel: string, reduced: boolean): { name: string; ms: number } | null => {
  let found: { name: string; ms: number } | null = null;
  for (const r of rules) {
    if (r.reduced !== reduced || !r.selectors.includes(sel)) continue;
    const short = r.decls.get("animation")?.value;
    if (!short) continue;
    const tokens = short.split(/\s+/);
    const name = tokens.find((t) => keyframes.has(t));
    const dur = tokens.find((t) => /^\d+(\.\d+)?m?s$/.test(t));
    if (name && dur) found = { name, ms: dur.endsWith("ms") ? Number(dur.slice(0, -2)) : Number(dur.slice(0, -1)) * 1000 };
  }
  return found;
};
for (const sel of MATCHES_FULL) {
  const full = animOf(sel, false);
  const calm = animOf(sel, true);
  if (!full || !calm) failures.push(`${sel}: needs a full-motion and a reduced-motion animation (found ${full?.name ?? "none"} / ${calm?.name ?? "none"})`);
  else if (calm.ms !== full.ms || endsHidden(calm.name) !== endsHidden(full.name))
    failures.push(`${sel}: the calm fade (${calm.name}, ${calm.ms} ms, ends ${endsHidden(calm.name) ? "hidden" : "visible"}) must end as the full version does (${full.name}, ${full.ms} ms, ends ${endsHidden(full.name) ? "hidden" : "visible"})`);
}

// Every EFFECTS entry still names a keyframe that ends (or starts) hidden.
for (const name of Object.keys(EFFECTS))
  if (!keyframes.has(name)) failures.push(`EFFECTS lists ${name}, which no longer exists`);
  else if (!endsHidden(name) && !startsHidden(name)) failures.push(`EFFECTS lists ${name}, which no longer starts or ends hidden`);

const hiddenEnd = [...keyframes.keys()].filter(endsHidden).length;
if (failures.length) {
  console.log(`reduced-motion-end-check: FAIL (${failures.length})`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`reduced-motion-end-check: ${keyframes.size} keyframes, ${hiddenEnd} end hidden; ${checked} uses hold a hidden end, every one held visible under reduced motion or a listed effect (${Object.keys(EFFECTS).length})`);
