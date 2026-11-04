import { useEffect, useState } from "react";

/**
 * The Solution / Yours switch (3 Nov 2026, Joe's audit; display only). Twelve reveals drew the solution and the
 * player's board side by side at half size; they now show one board at full size and a switch between the two. The
 * games' own Reveal components are unchanged: the switch finds their two labelled columns (the "Solution" / "Yours"
 * labels each Reveal draws) and shows one at a time, its label hidden (the switch says which), and the reveal's fit
 * (AnswerReveal useRevealFit) then grows the board to the space.
 */
export const SOLUTION_SWITCH_TYPES: ReadonlySet<string> = new Set([
  "pipes",
  "laser",
  "flow",
  "blockparty",
  "nonogram",
  "tents",
  "shikaku",
  "lightup",
  "fillomino",
  "fences",
  "bridges",
  "tilegrid",
  // Gridlock (3 Nov 2026, puzzle polish): the shortest solution playing back, and a solved player's own board.
  "unblock",
]);

const SOLUTION_LABEL = /^(solution|solved|one solution|the solution|answer)$/i;
const YOURS_LABEL = /^(yours|your board|your grid|you)$/i;

type View = "solution" | "yours";

function findPair(root: HTMLElement): { solution: HTMLElement; yours: HTMLElement; labels: HTMLElement[] } | null {
  const leaves = Array.from(root.querySelectorAll<HTMLElement>("span, p, div")).filter(
    (el) => el.children.length === 0 && !el.closest("[data-solution-switch]"),
  );
  const sol = leaves.find((el) => SOLUTION_LABEL.test(el.textContent?.trim() ?? ""));
  const mine = leaves.find((el) => YOURS_LABEL.test(el.textContent?.trim() ?? ""));
  if (!sol || !mine) return null;
  // The lowest element holding both labels; the columns are its children on each label's path.
  let common: HTMLElement | null = sol.parentElement;
  while (common && !common.contains(mine)) common = common.parentElement;
  if (!common || !root.contains(common)) return null;
  const columnOf = (el: HTMLElement) => {
    let c: HTMLElement = el;
    while (c.parentElement && c.parentElement !== common) c = c.parentElement;
    return c;
  };
  const solution = columnOf(sol);
  const yours = columnOf(mine);
  if (solution === yours) return null;
  return { solution, yours, labels: [sol, mine] };
}

export function SolutionSwitch({ type, root }: { type: string; root: { current: HTMLElement | null } }) {
  const [view, setView] = useState<View>("solution");
  const [found, setFound] = useState(false);
  const on = SOLUTION_SWITCH_TYPES.has(type);
  useEffect(() => {
    const node = root.current;
    if (!on || !node) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const pair = findPair(node);
      setFound(!!pair);
      if (!pair) return;
      for (const label of pair.labels) label.style.display = "none";
      const show = view === "solution" ? pair.solution : pair.yours;
      const hide = view === "solution" ? pair.yours : pair.solution;
      hide.style.display = "none";
      show.style.display = "";
      show.style.flex = "1 1 100%";
      show.style.maxWidth = "100%";
      show.dataset["solutionView"] = view;
    };
    apply();
    const watch = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(apply);
    });
    watch.observe(node, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
    };
  }, [on, root, view]);
  if (!on) return null;
  return (
    <div data-solution-switch={view} role="tablist" aria-label="Board shown" className="solution-switch" hidden={!found}>
      {(["solution", "yours"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          data-active={view === v ? "" : undefined}
          onClick={() => setView(v)}
          className="press solution-switch-btn"
        >
          {v === "solution" ? "Solution" : "Yours"}
        </button>
      ))}
    </div>
  );
}
