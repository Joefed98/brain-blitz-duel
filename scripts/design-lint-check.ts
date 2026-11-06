/**
 * design-lint as a routine check (DESIGN.md section 12, design foundation F1): runs scripts/design-lint.ts
 * in the fast Checks workflow (no browser). Fails on new violations in a change's added lines under src/;
 * existing ones are printed as warnings with counts. Also unit-tests the lint's rules on small samples.
 *
 *   bun scripts/design-lint-check.ts [--base=<ref>] [--verbose]
 */
import { lintSource, runDesignLint, scopeOf, type Rule } from "./design-lint";

const problems: string[] = [];
const rules = (file: string, src: string) => lintSource(file, src).map((v) => v.rule).sort();
const expect = (what: string, got: Rule[], want: Rule[]) => {
  if (got.join() !== [...want].sort().join()) problems.push(`${what}: got [${got.join(", ")}], want [${want.join(", ")}]`);
};

// Colours.
expect("a hex colour in CSS", rules("a.css", ".x { color: #12ABEF; }"), ["colour"]);
expect("rgb() in CSS", rules("a.css", ".x { color: rgb(1 2 3); }"), ["colour"]);
expect("a token", rules("a.css", ".x { color: var(--jz-text); }"), []);
expect("an #id selector", rules("a.css", "#root .x\n{ color: var(--jz-text); }"), []);
expect("a colour in a comment", rules("a.css", "/* was #0D0D0F */ .x { color: var(--jz-bg); }"), []);
expect("a hex in TSX", rules("a.tsx", `const s = { color: "#FFF" };`), ["colour"]);
expect("a hex in a TS comment", rules("a.ts", `// #FFFFFF\nconst url = "https://x.y/#a";`), []);
expect("an ignored line", rules("a.css", ".x { color: #FFF; } /* design-lint-ignore */"), []);
// Tailwind arbitrary values.
expect("text-[13px]", rules("a.tsx", `<p className="text-[13px] font-bold" />`), ["arbitrary"]);
expect("bg-[#123456]", rules("a.tsx", `<p className="bg-[#123456]" />`), ["arbitrary", "colour"]);
expect("a data-[] variant", rules("a.tsx", `<p className="data-[state=open]:opacity-100" />`), []);
expect("an arbitrary variant", rules("a.tsx", `<p className="[&>svg]:size-4" />`), []);
expect("rounded-[14px] in @apply", rules("a.css", ".x { @apply rounded-[14px]; }"), ["arbitrary"]);
// Fonts.
expect("Saira", rules("a.css", `.x { font-family: "Saira", sans-serif; }`), ["font"]);
expect("Archivo", rules("a.css", `.x { font-family: "Archivo", system-ui, sans-serif; }`), []);
expect("a font var", rules("a.css", ".x { font-family: var(--jz-font); }"), []);
expect("fontFamily in TSX", rules("a.tsx", `const s = { fontFamily: "Inter, sans-serif" };`), ["font"]);
// Keyframes.
expect("keyframes ending hidden", rules("a.css", "@keyframes fade { from { opacity: 1; } to { opacity: 0; } }"), ["keyframes"]);
expect(
  "keyframes ending hidden, handled under reduced motion",
  rules("a.css", "@keyframes fade { to { opacity: 0; } }\n.x { animation: fade 1s both; }\n@media (prefers-reduced-motion: reduce) { .x { animation: none; } }"),
  [],
);
expect(
  "keyframes ending hidden, another class handled",
  rules("a.css", "@keyframes fade { to { opacity: 0; } }\n.x { animation: fade 1s both; }\n@media (prefers-reduced-motion: reduce) { .y { animation: none; } }"),
  ["keyframes"],
);
expect("keyframes ending visible", rules("a.css", "@keyframes pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }"), []);
// Tokens.
expect("a --jz token outside tokens.css", rules("a.css", ":root { --jz-new: 1px; }"), ["token"]);
// Scope.
if (scopeOf("src/design/tokens.css", "") !== "skip") problems.push("tokens.css is linted");
if (scopeOf("src/lib/arcade/x.renderer.ts", "") !== "skip") problems.push("arcade art is linted");
if (scopeOf("src/lib/x.ts", "const c = canvas.getContext('2d');") !== "skip") problems.push("canvas code is linted");
if (scopeOf("src/puzzles/x.tsx", "") !== "report") problems.push("puzzle boards are enforced");
if (scopeOf("src/polish-layout/x.css", "") !== "enforce") problems.push("polish-layout is not enforced");
if (scopeOf("src/components/app/X.tsx", "") !== "enforce") problems.push("app components are not enforced");

for (const p of problems) console.log(`  ${p}`);
console.log(`${problems.length ? "FAIL" : "PASS"} design-lint rules: ${problems.length ? `${problems.length} problem(s)` : "every sample flagged as expected"}`);

const code = runDesignLint();
process.exit(problems.length || code ? 1 : 0);
