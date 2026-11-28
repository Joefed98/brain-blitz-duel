import { useMemo } from "react";

import { Button, SectionHeader } from "@/design/components";
import { NEW_GAME_SOUNDS } from "@/config/soundConfig";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { PuzzleType } from "@/lib/duel/types";
import { NEW_GAME_SOUND_RECORDINGS } from "@/lib/fx/newGameSounds";
import { previewSoundFile } from "@/lib/sound";

/**
 * /dev-design's Sounds (development only): every new game sound from the November reviews
 * (scripts/sound-review-nov-2026/make.py, docs/sound-cues/review-nov-2026.md), grouped by game, each played straight
 * from its file whatever NEW_GAME_SOUNDS says (src/config/soundConfig.ts), so Joe can hear them before switching them on.
 */
interface SoundLine {
  slot: string;
  file: string;
  what: string;
  ms: number;
}

function byGame(): { game: string; lines: SoundLine[] }[] {
  const groups = new Map<string, SoundLine[]>();
  for (const r of NEW_GAME_SOUND_RECORDINGS) {
    for (const slot of r.slots) {
      const type = slot.slice(0, slot.indexOf(".")) as PuzzleType;
      const game = gameDisplayName(type);
      const list = groups.get(game) ?? [];
      list.push({ slot, file: r.file, what: r.what, ms: r.ms });
      groups.set(game, list);
    }
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([game, lines]) => ({ game, lines }));
}

export function SoundsGallery() {
  const games = useMemo(byGame, []);
  return (
    <section className="flex flex-col gap-3" data-dev-sounds>
      <SectionHeader
        title="Sounds"
        right={<span>{NEW_GAME_SOUNDS ? "In the games (NEW_GAME_SOUNDS on)" : "Not in the games yet (NEW_GAME_SOUNDS off)"}</span>}
      />
      {games.map(({ game, lines }) => (
        <div key={game} className="flex flex-col gap-2" data-dev-sound-game={game}>
          <span className="jz-heading">{game}</span>
          {lines.map((line) => (
            <div key={line.slot} className="flex items-center gap-3">
              <Button
                variant="secondary"
                size={44}
                onClick={() => void previewSoundFile(`/sounds/${line.file}`)}
                data-dev-sound={line.slot}
                aria-label={`Play ${line.slot}`}
              >
                <span aria-hidden>▶</span> {line.slot.slice(line.slot.indexOf(".") + 1)}
              </Button>
              <span className="jz-gallery-label">
                {line.what} · {line.ms} ms · {line.file}
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
