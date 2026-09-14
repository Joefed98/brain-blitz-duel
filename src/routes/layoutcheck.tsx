import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { puzzleDef } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";

export const Route = createFileRoute("/layoutcheck")({
  ssr: false,
  component: LayoutCheck,
  head: () => ({ meta: [{ title: "Layout check" }] }),
});

const TYPES: PuzzleType[] = [
  "wordmatch",
  "pctsprint",
  "numspan",
  "stopwatch",
  "countup",
  "mirmatch",
];

function LayoutCheck() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-8 p-4">
      {TYPES.map((type) => {
        const def = puzzleDef(type);
        const puzzle = def.generate();
        const Intro = def.IntroExample;
        const Stage = def.Stage;
        // Number Span's digits have already vanished by this point.
        const started = type === "numspan" ? now - 4_000 : now - 200;
        return (
          <div key={type} className="flex flex-col gap-3">
            <h2 data-name={type} className="font-display text-lg font-bold">
              {def.name}
            </h2>
            <div className="w-[390px] border border-border p-4" data-intro={type}>
              <Intro />
            </div>
            <div
              className="flex min-h-[520px] w-[390px] flex-col border border-border p-4"
              data-stage={type}
            >
              <Stage
                puzzle={puzzle}
                phaseStartedAt={started}
                now={now}
                locked={false}
                onSubmit={() => {}}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
