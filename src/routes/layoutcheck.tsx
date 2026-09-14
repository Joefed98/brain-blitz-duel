import { createFileRoute } from "@tanstack/react-router";

import { PUZZLE_REGISTRY, PUZZLE_TYPES } from "@/lib/duel/registry";

/** Temporary layout harness: every intro example and stage at once. */
export const Route = createFileRoute("/layoutcheck")({
  component: LayoutCheck,
});

function LayoutCheck() {
  const now = Date.now();
  return (
    <div className="flex flex-col gap-8 bg-background p-4">
      {PUZZLE_TYPES.map((type) => {
        const def = PUZZLE_REGISTRY[type];
        const puzzle = def.generate();
        return (
          <div key={type} className="flex flex-col gap-3">
            <p data-name={type} className="font-display text-sm font-bold text-primary">
              {def.name}
            </p>
            <div className="flex flex-col gap-4 rounded-xl border border-border p-2">
              <def.IntroExample />
              <div className="flex min-h-[420px] flex-col">
                <def.Stage
                  puzzle={puzzle}
                  phaseStartedAt={now - 10_000}
                  now={now}
                  locked={false}
                  onSubmit={() => {}}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
