/**
 * Design audit: exports user-facing strings to docs/design-audit/strings.csv (6 Nov 2026; read-only).
 * Parses src/**\/*.tsx with the TypeScript compiler and takes JSX text, text-bearing attributes
 * (aria-label, placeholder, title, alt, label, …) and string literals inside JSX; plus string literals
 * from the copy modules listed in COPY_MODULES (help text, names, share lines, awards, reveal words…).
 * A literal that looks like a class list, id, key, URL or code is skipped. Columns: screen, key, text,
 * kind. "key" is file:line (there is no string catalogue in the app; copy lives in the components).
 *
 *   bun docs/design-audit/tools/strings.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const tsx: string[] = [];
const walk = (d: string, re: RegExp, out: string[]) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, re, out);
    else if (re.test(f)) out.push(p);
  }
};
walk(join(ROOT, "src"), /\.tsx$/, tsx);
const COPY_MODULES = [
  "src/lib/duel/gameNames.ts",
  "src/lib/duel/instructions.ts",
  "src/lib/duel/roomShare.ts",
  "src/lib/duel/dailyShare.ts",
  "src/lib/duel/podiumAwards.ts",
  "src/lib/duel/nearMiss.ts",
  "src/lib/duel/revealBreakdown.ts",
  "src/lib/duel/tieDisplay.ts",
  "src/lib/duel/roomSettings.ts",
  "src/lib/duel/chatNotice.ts",
  "src/lib/duel/finishedPings.ts",
  "src/lib/duel/introScore.ts",
  "src/lib/duel/puzzleBandsText.ts",
  "src/lib/duel/scoreList.ts",
  "src/lib/duel/types.ts",
  "src/lib/beta/terms.ts",
  "src/lib/onboarding.ts",
  "src/lib/brand.ts",
  "src/lib/desktopKeys.ts",
  "src/lib/publicSchedule.ts",
  "src/config/banners.ts",
  "src/config/publicGames.ts",
  "src/lib/fx/celebrations.ts",
].filter((p) => {
  try {
    return statSync(join(ROOT, p)).isFile();
  } catch {
    return false;
  }
});

const TEXT_ATTRS = new Set(["aria-label", "placeholder", "title", "alt", "label", "description", "aria-description", "heading", "subtitle", "hint", "text", "message", "cta", "emptyText", "name"]);

/** Screen name from the file path. */
function screenOf(rel: string): string {
  const r = rel.replace(/^src\//, "");
  const m: [RegExp, string][] = [
    [/^routes\/index/, "Play tab"],
    [/^routes\/practice/, "Practice tab"],
    [/^routes\/tournaments/, "Tournaments tab"],
    [/^routes\/profile/, "Profile tab"],
    [/^routes\/daily/, "Daily"],
    [/^routes\/challenge/, "Challenge"],
    [/^routes\/terms|beta\/terms|TermsScreen/, "Beta terms"],
    [/^routes\/duel/, "Room"],
    [/^routes\/__root/, "App root (404, errors, head)"],
    [/^routes\//, "Dev route"],
    [/RoomLobby|RoomSettings|JoinFromLink|RoomMenu|RoomFooter/, "Room: lobby"],
    [/RoundIntro|PuzzleInstructions|IntroStage|IntroDemo|introScore|instructions|puzzleBandsText|scoreList/, "Game intro and help"],
    [/AnswerReveal|ArcadeReveal|RevealBreakdown|revealBreakdown|ArcadeScoreChart|SolutionSwitch|NewBest/, "Answer reveal"],
    [/RoundResult|Standings|tieDisplay|ProgressStrip/, "Round results and standings"],
    [/Podium|FinalResult|WinnerReveal|podiumAwards|DuelOverall|roomShare/, "Podium and final"],
    [/RoomChat|chatNotice/, "Room: chat"],
    [/DuelStart|RoundTitle|PrepareLightning/, "Room: Prepare to Duel / round title"],
    [/GameFrame|TimerBar|MuteToggle|FinishedPings|finishedPings|ScoreStrip|RoundLabel|DropoutBanner/, "Game frame"],
    [/Onboarding|onboarding|IntroCard/, "First-time intro"],
    [/components\/daily|dailyShare|Daily/, "Daily"],
    [/components\/async|challenge|Challenge/i, "Challenge / async rooms"],
    [/components\/offline/, "Offline"],
    [/components\/app\/(AppTabBar|AppRail|AppHeader)/, "App shell: tab bar / header"],
    [/components\/app\/Play|Play[A-Z]|ShareWelcome|HomeScreenHint|PublicGame/, "Play tab"],
    [/components\/app\/Profile|Profile|Settings|LookPicker/, "Profile / settings"],
    [/components\/app\/Practice|Practice/, "Practice tab"],
    [/components\/app\/Tournament|Tournament/, "Tournaments tab"],
    [/components\/share|share\//, "Share"],
    [/components\/app\//, "App shell"],
    [/components\/ui\//, "UI kit (shadcn)"],
    [/^puzzles\//, "In-game (puzzle / arcade stage)"],
    [/components\/puzzles\//, "In-game (shared puzzle widgets)"],
    [/gameNames/, "Game names"],
    [/brand|banners|publicGames|publicSchedule/, "Brand / config"],
    [/celebrations/, "Celebrations"],
    [/desktopKeys/, "Desktop controls"],
  ];
  for (const [re, name] of m) if (re.test(r)) return name;
  return "Other";
}

const looksLikeCode = (s: string) =>
  !/[A-Za-z]/.test(s) ||
  /^[a-z0-9_:./[\]#%()!-]+(\s+[a-z0-9_:./[\]#%()!&>*+=-]+)*$/.test(s) || // class lists / keys (all lower)
  /^(https?:|\/|data:|#|\.|@|--)/.test(s) ||
  /^[A-Z_][A-Z0-9_]*$/.test(s) && s.length > 1 && s.includes("_") ||
  /^[a-z][a-zA-Z0-9]*$/.test(s) || // camelCase ids
  /[{};]|=>|\$\{/.test(s);

const rows: { screen: string; key: string; text: string; kind: string }[] = [];
const seen = new Set<string>();
const push = (rel: string, sf: ts.SourceFile, node: ts.Node, text: string, kind: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length < 2 || looksLikeCode(t)) return;
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const key = `${rel.replace(/^src\//, "")}:${line}`;
  const id = `${key}|${t}`;
  if (seen.has(id)) return;
  seen.add(id);
  rows.push({ screen: screenOf(rel), key, text: t, kind });
};

const litText = (n: ts.Node): string | null => {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => `{…}${s.literal.text}`).join("");
  return null;
};

function scanTsx(file: string) {
  const rel = relative(ROOT, file);
  if (/dev-crash|replay-lab|GameLayoutDevOverlay|SaveDemoButton/.test(rel)) return;
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inJsx = (n: ts.Node) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p)) return p;
      if (ts.isJsxElement(p) || ts.isJsxFragment(p) || ts.isJsxSelfClosingElement(p)) return p;
      if (ts.isFunctionLike(p) || ts.isSourceFile(p)) return null;
    }
    return null;
  };
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) push(rel, sf, n, n.text, "jsx-text");
    else if (ts.isJsxAttribute(n) && n.initializer) {
      const name = n.name.getText(sf);
      const init = n.initializer;
      const val = ts.isStringLiteral(init) ? init.text : ts.isJsxExpression(init) && init.expression ? litText(init.expression) : null;
      if (val !== null && (TEXT_ATTRS.has(name) || /label|title|text|placeholder/i.test(name))) push(rel, sf, n, val, `attr:${name}`);
    } else {
      const t = litText(n);
      if (t !== null) {
        const owner = inJsx(n);
        if (owner && !ts.isJsxAttribute(owner) && / |[A-Z]/.test(t)) push(rel, sf, n, t, "jsx-expr");
        else if (!owner && /\s/.test(t) && /^[A-Z0-9"“‘'(…+−-]/.test(t) && !looksLikeCode(t)) {
          // Module/function-level sentence-like literal (toasts, labels built in code).
          const parent = n.parent;
          const isImport = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
          const isProp = ts.isPropertyAssignment(parent) && /^(className|class|style|id|key|type|role|href|src|data)/.test(parent.name.getText(sf));
          const isCall = ts.isCallExpression(parent) && /querySelector|addEventListener|getItem|setItem|matchMedia|console|Error|cn|clsx|test/.test(parent.expression.getText(sf));
          if (!isImport && !isProp && !isCall) push(rel, sf, n, t, "code");
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

function scanCopy(rel: string) {
  const file = join(ROOT, rel);
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const visit = (n: ts.Node) => {
    const t = litText(n);
    if (t !== null && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent) && !ts.isLiteralTypeNode(n.parent)) {
      const parent = n.parent;
      const isKey = ts.isPropertyAssignment(parent) && parent.name === n;
      const isCase = ts.isCaseClause(parent) || ts.isBinaryExpression(parent) && /===|!==/.test(parent.operatorToken.getText(sf));
      if (!isKey && !isCase && (/[A-Z]/.test(t) || /\s/.test(t))) push(rel, sf, n, t, "copy-module");
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

for (const f of tsx) scanTsx(f);
for (const f of COPY_MODULES) scanCopy(f);
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
rows.sort((a, b) => a.screen.localeCompare(b.screen) || a.key.localeCompare(b.key, undefined, { numeric: true }));
writeFileSync("docs/design-audit/strings.csv", "screen,key,text,kind\n" + rows.map((r) => [r.screen, r.key, r.text, r.kind].map(q).join(",")).join("\n") + "\n");
const by = new Map<string, number>();
for (const r of rows) by.set(r.screen, (by.get(r.screen) ?? 0) + 1);
console.log(rows.length, [...by.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}: ${n}`).join("; "));
