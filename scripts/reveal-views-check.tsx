/**
 * reveal-views-check (27 Nov 2026, A2's G6): a game's own views on the reveal template's control
 * (src/components/duel/revealContext.ts, RevealScreen's RevealViews), as the Attention reveals use them.
 *
 *  1. Outside a template (a check's bare render) the hook answers the view it opens on: `initial`, else the first.
 *  2. In a host (AnswerReveal's): the reveal opens on `initial`; each view's tone is drawn on its option
 *     (`data-view-tone`); a second control (`group`) is its own row, after the first; choosing a view in either row
 *     changes only that row's answer; the main row is the host's `views` / `current`.
 *  3. A game that drops its views leaves no row behind; a single view draws no control.
 *  4. The heading follows a game's Solution / Yours view (gameViewsHeading); any other view leaves it to the game.
 *  5. The real Attention reveals (Tally, Eagle Eye, Double Take) open on the first one wrong, mark each right or wrong,
 *     and Double Take's panel is a second row.
 *
 *   bun scripts/reveal-views-check.tsx
 */
import { Window } from "happy-dom";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else {
    failures.push(message);
    console.log(`  FAIL ${message}`);
  }
}

const win = new Window({ url: "https://joulz.uk/practice" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "localStorage", "sessionStorage", "location", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver", "CustomEvent", "ResizeObserver"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  if (value === undefined) continue;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: typeof value === "function" && !["HTMLElement", "Element", "Node", "Event", "MutationObserver", "CustomEvent", "ResizeObserver"].includes(key) ? (value as (...a: unknown[]) => unknown).bind(win) : value,
  });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { renderToStaticMarkup } = await import("react-dom/server");
const { MAIN_VIEW_GROUP, RevealGameViewsProvider, useGameViewsHost, useRevealViews } = await import("../src/components/duel/revealContext");
const { RevealViews } = await import("../src/components/duel/RevealScreen");
const { gameViewsHeading } = await import("../src/lib/duel/revealHeading");
type Label = import("../src/components/duel/revealContext").RevealViewLabel;

const TRAYS: Label[] = [
  { id: "0", label: "Tray 1", tone: "good" },
  { id: "1", label: "Tray 2", tone: "bad" },
  { id: "2", label: "Tray 3", tone: "good" },
];
const PANELS: Label[] = [
  { id: "top", label: "Top picture" },
  { id: "bottom", label: "Bottom picture" },
];

/* 1. Bare render */
{
  let seen = "";
  function Bare() {
    seen = useRevealViews(TRAYS, { initial: "1" });
    return null;
  }
  renderToStaticMarkup(React.createElement(Bare));
  check(seen === "1", "1: a bare render answers the view it opens on");
  function First() {
    seen = useRevealViews(TRAYS);
    return null;
  }
  renderToStaticMarkup(React.createElement(First));
  check(seen === "0", "1: with no initial, the first view");
  function Missing() {
    seen = useRevealViews(TRAYS, { initial: "9" });
    return null;
  }
  renderToStaticMarkup(React.createElement(Missing));
  check(seen === "0", "1: an initial that isn't a view falls back to the first");
}

/* 2–3. In a host */
const answers: { main: string; panel: string } = { main: "", panel: "" };
let hostState: ReturnType<typeof useGameViewsHost> | null = null;
let showPanels = true;
let trays: Label[] = TRAYS;
function Game() {
  answers.main = useRevealViews(trays, { initial: "1", label: "Trays" });
  answers.panel = useRevealViews(showPanels ? PANELS : [], { initial: "bottom", group: "panels", label: "Panels" });
  return null;
}
function Host() {
  const views = useGameViewsHost();
  hostState = views;
  return React.createElement(
    "div",
    null,
    views.groups.map((g) =>
      React.createElement(RevealViews, {
        key: g.group,
        group: g.group === MAIN_VIEW_GROUP ? undefined : g.group,
        views: g.views,
        value: g.current,
        label: g.label,
        onChange: (id: string) => views.setView(g.group, id),
      }),
    ),
    React.createElement(RevealGameViewsProvider, { value: views.host }, React.createElement(Game)),
  );
}
const host = document.createElement("div");
document.body.appendChild(host);
const root = createRoot(host as unknown as HTMLElement);
await act(async () => root.render(React.createElement(Host)));

const rows = () => [...host.querySelectorAll("[data-reveal-views]")] as unknown as HTMLElement[];
const checked = (row: HTMLElement) => row.querySelector('[aria-checked="true"]')?.textContent ?? "";
check(rows().length === 2, `2: two rows above the stage (${rows().length})`);
check(rows()[0]?.getAttribute("data-reveal-views") === "" && rows()[1]?.getAttribute("data-reveal-views") === "panels", "2: the main row first, the panels row second");
check(answers.main === "1" && checked(rows()[0]!).startsWith("Tray 2"), "2: the reveal opens on its initial view");
check(answers.panel === "bottom" && checked(rows()[1]!).startsWith("Bottom picture"), "2: the second row opens on its own initial view");
const options = [...rows()[0]!.querySelectorAll('[role="radio"]')] as unknown as HTMLElement[];
check(options.map((o) => o.getAttribute("data-view-tone")).join(",") === "good,bad,good", "2: each view's tone is on its option");
check(![...rows()[1]!.querySelectorAll('[role="radio"]')].some((o) => (o as unknown as HTMLElement).hasAttribute("data-view-tone")), "2: views with no tone carry none");
check(rows()[0]!.querySelector('[role="radiogroup"]')?.getAttribute("aria-label") === "Trays" && rows()[1]!.querySelector('[role="radiogroup"]')?.getAttribute("aria-label") === "Panels", "2: each row is named by its label");
check(hostState!.views?.length === 3 && hostState!.current === "1", "2: the main row is the host's views and current");

await act(async () => (rows()[1]!.querySelectorAll('[role="radio"]')[0] as unknown as HTMLElement).click());
check(answers.panel === "top" && answers.main === "1", "2: choosing in the second row changes only that row");
await act(async () => (rows()[0]!.querySelectorAll('[role="radio"]')[2] as unknown as HTMLElement).click());
check(answers.main === "2" && answers.panel === "top" && hostState!.current === "2", "2: choosing in the main row changes only that row");

// A re-render with the same views keeps the choice (it isn't reset to the initial view).
trays = TRAYS.map((t) => ({ ...t }));
await act(async () => root.render(React.createElement(Host)));
check(answers.main === "2", "2: the choice survives a re-render with the same views");

showPanels = false;
await act(async () => root.render(React.createElement(Host)));
check(rows().length === 1 && answers.panel === "", "3: a game that drops a row's views leaves no row behind");
trays = [TRAYS[0]!];
await act(async () => root.render(React.createElement(Host)));
check(rows().length === 0 && hostState!.groups.length === 0 && hostState!.views === null, "3: a single view draws no control");
await act(async () => root.unmount());

/* 4. The heading */
check(gameViewsHeading("solution")?.view === "solution" && gameViewsHeading("solution")?.found === true, "4: Solution sets the heading to the solution");
check(gameViewsHeading("yours")?.view === "yours", "4: Yours sets the heading to your answer");
check(gameViewsHeading("1") === null && gameViewsHeading(null) === null && gameViewsHeading(undefined) === null, "4: any other view leaves the heading to the game");

/* 5. The real Attention reveals */
{
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { countUpStageTruth } = await import("../src/lib/duel/attentionRev");
  const deal = (type: string, seed: number) => withSeededRandom(seed, () => generatePuzzle(type as never, { unblockRow: null }));
  const { countUpPuzzle } = await import("../src/puzzles/countUp");
  const { symbolScanPuzzle } = await import("../src/puzzles/symbolScan");
  const { spotDifferencePuzzle } = await import("../src/puzzles/spotTheDifference");

  const tp = deal("countup", 21) as unknown as import("../src/lib/duel/types").CountUpPuzzleData;
  const truths = tp.stages.map((s) => countUpStageTruth(s));
  // Right on the first tray, off on the second: the reveal opens on Tray 2, Tray 1 marked right.
  const answer = truths.map((t, i) => String(i === 1 ? t + 3 : t)).join("|");
  const runs: { name: string; el: React.ReactElement; expect: (r: HTMLElement[]) => string | null }[] = [
    {
      name: "Tally",
      el: React.createElement(countUpPuzzle.Reveal, { puzzle: tp, myAnswer: answer, myCorrect: false, timeLimitMs: 60_000 } as never),
      expect: (r) => {
        if (r.length !== 1) return `${r.length} rows`;
        const opts = [...r[0]!.querySelectorAll('[role="radio"]')] as unknown as HTMLElement[];
        if (opts.length !== tp.stages.length) return `${opts.length} tabs`;
        if (!checked(r[0]!).startsWith("Tray 2")) return `opens on ${checked(r[0]!)}`;
        if (opts[0]!.getAttribute("data-view-tone") !== "good" || opts[1]!.getAttribute("data-view-tone") !== "bad") return "tones";
        return null;
      },
    },
  ];
  const sp = deal("symscan", 7) as unknown as import("../src/lib/duel/types").SymbolScanPuzzleData;
  runs.push({
    name: "Eagle Eye",
    el: React.createElement(symbolScanPuzzle.Reveal, { puzzle: sp, myAnswer: "", myCorrect: false, timeLimitMs: 60_000 } as never),
    expect: (r) => {
      if (r.length !== 1) return `${r.length} rows`;
      const opts = [...r[0]!.querySelectorAll('[role="radio"]')] as unknown as HTMLElement[];
      if (opts.length !== sp.stages.length) return `${opts.length} tabs`;
      if (!checked(r[0]!).startsWith("Grid 1")) return `opens on ${checked(r[0]!)}`;
      if (!opts.every((o) => o.getAttribute("data-view-tone") === "bad")) return "an empty answer isn't wrong on every grid";
      return null;
    },
  });
  const dp = deal("spotdiff", 3) as unknown as import("../src/lib/duel/types").SpotPuzzleData;
  const { spotScenes } = await import("../src/lib/duel/attentionRev");
  const two = spotScenes(dp).length > 1;
  runs.push({
    name: "Double Take",
    el: React.createElement(spotDifferencePuzzle.Reveal, { puzzle: dp, myAnswer: "", myCorrect: false, timeLimitMs: 60_000 } as never),
    expect: (r) => {
      if (r.length !== (two ? 2 : 1)) return `${r.length} rows`;
      const panels = r[r.length - 1]!;
      if (panels.getAttribute("data-reveal-views") !== "panels") return "the panel row isn't its own row";
      if (!checked(panels).startsWith("Bottom picture")) return `the panel opens on ${checked(panels)}`;
      if (two && !checked(r[0]!).startsWith("Sweet shop")) return `opens on ${checked(r[0]!)}`;
      return null;
    },
  });
  for (const run of runs) {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const r2 = createRoot(el as unknown as HTMLElement);
    function RealHost({ children }: { children: React.ReactNode }) {
      const views = useGameViewsHost();
      return React.createElement(
        "div",
        null,
        views.groups.map((g) =>
          React.createElement(RevealViews, {
            key: g.group,
            group: g.group === MAIN_VIEW_GROUP ? undefined : g.group,
            views: g.views,
            value: g.current,
            label: g.label,
            onChange: (id: string) => views.setView(g.group, id),
          }),
        ),
        React.createElement(RevealGameViewsProvider, { value: views.host }, children),
      );
    }
    await act(async () => r2.render(React.createElement(RealHost, null, run.el)));
    const problem = run.expect([...el.querySelectorAll("[data-reveal-views]")] as unknown as HTMLElement[]);
    check(problem === null, `5: ${run.name}: ${problem ?? "ok"}`);
    check(!el.querySelector(".attn-rv-tabs"), `5: ${run.name} draws no tabs of its own`);
    await act(async () => r2.unmount());
  }
}

if (failures.length) {
  console.log(`FAIL: reveal-views-check, ${failures.length} of ${failures.length + passes}`);
  process.exit(1);
}
console.log(`PASS: reveal-views-check, ${passes} checks: a game's views open where it says, carry their tones, a second control is its own row, the heading follows Solution / Yours, and the Attention reveals use them`);
process.exit(0);
