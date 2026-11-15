import { useState } from "react";

import { Button, Sheet } from "@/design/components";
import type { RatedPick, RatedStatus } from "@/lib/rated/backend";
import type { RatedFormat } from "@/lib/rated/matchmaking";
import { pickLabel, shownPicks } from "@/lib/rated/rules";

import { HomeArt } from "./HomeArt";

/** A rated format as the Play page names it: "1 v 1" over "Best of 3", "4 players" over "Free for all". */
export function formatWords(format: RatedFormat): { title: string; note: string } {
  if (format === "ffa4") return { title: "4 players", note: "Placings" };
  if (format === "ffa8") return { title: "8 players", note: "Placings" };
  return { title: "1 v 1", note: `Best of ${format.slice(2)}` };
}

/** "Rated · Best of 3 · Mixed", the selector's one line. */
export function choiceLine(format: RatedFormat, pick: RatedPick): string {
  const f = format.startsWith("bo") ? `Best of ${format.slice(2)}` : formatWords(format).title;
  return `Rated · ${f} · ${pickLabel(pick)}`;
}

const PICK_NOTES: Partial<Record<RatedPick, string>> = { mixed: "All kinds", puzzles: "Puzzle games", arcade: "Arcade games" };

/**
 * Choose a match (mockup phone/sheet.png): the rated formats and game picks switched on today (W3b's switches through
 * rated status), nothing else. A choice is kept on this device for next time.
 */
export function MatchSheet({
  status,
  format,
  pick,
  onChoose,
  onClose,
}: {
  status: RatedStatus;
  format: RatedFormat;
  pick: RatedPick;
  onChoose: (format: RatedFormat, pick: RatedPick) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<RatedFormat>(format);
  const [p, setP] = useState<RatedPick>(pick);
  const formats = status.options.formats;
  const picks = shownPicks(status.options);
  const option = (key: string, on: boolean, title: string, note: string, choose: () => void, data: Record<string, string>) => (
    <button key={key} type="button" role="radio" aria-checked={on} onClick={choose} className="hp-option press" {...data}>
      <span className="hp-option-title">{title}</span>
      <span className="hp-option-note">{note}</span>
    </button>
  );
  return (
    <Sheet
      title="Choose a match"
      closeLabel="Close"
      onClose={onClose}
      data={{ "data-match-sheet": "" }}
      footer={
        <Button variant="gold" size={58} block onClick={() => onChoose(f, p)} data-match-sheet-done>
          Done
        </Button>
      }
    >
      <div className="hp-sheet">
        {formats.length > 1 ? (
          <section aria-labelledby="hp-sheet-format" className="hp-sheet-group">
            <h3 id="hp-sheet-format" className="hp-sheet-head">
              <HomeArt name="rated" width={24} />
              Format
            </h3>
            <div role="radiogroup" aria-labelledby="hp-sheet-format" className="hp-options">
              {formats.map((x) => {
                const w = formatWords(x);
                return option(x, f === x, w.title, w.note, () => setF(x), { "data-format-option": x });
              })}
            </div>
          </section>
        ) : null}
        {picks.length > 1 ? (
          <section aria-labelledby="hp-sheet-games" className="hp-sheet-group">
            <h3 id="hp-sheet-games" className="hp-sheet-head">
              <HomeArt name="puzzles" width={24} />
              Games
            </h3>
            <div role="radiogroup" aria-labelledby="hp-sheet-games" className="hp-options">
              {picks.map((x) => option(x, p === x, pickLabel(x), PICK_NOTES[x] ?? "One kind", () => setP(x), { "data-pick-option": x }))}
            </div>
          </section>
        ) : null}
        <p className="hp-sheet-note">Your choice is saved for next time.</p>
      </div>
    </Sheet>
  );
}
