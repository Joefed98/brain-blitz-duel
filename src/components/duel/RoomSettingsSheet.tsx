import { useState } from "react";

import { Slider } from "@/components/ui/slider";
import {
  MAX_ROUNDS,
  MIN_ROUNDS,
  QUICK_ROUNDS,
  ROOM_PICKS,
  ROOM_PRESETS,
  clampRounds,
  eligibleCount,
  estimateRoomMinutes,
  isArcadePick,
  orderPicks,
  pickLabel,
  presetOf,
  roundCap,
  type PresetId,
  type RoomPick,
  type RoomSettings,
} from "@/lib/duel/roomSettings";
import { Button, Chip, Segmented, Sheet } from "@/design/components";

/**
 * The host's room settings (31 Oct 2026; rules in src/lib/duel/roomSettings.ts): three presets over a grid of
 * eleven colour chips (the six puzzle categories, then the five arcade groups; at least one stays on), the round
 * count as quick buttons 3 / 6 / 9 / 12 over a 3–12 slider (linked both ways, capped at the picks' games with a
 * note), and the room's estimated length, live. Save stores them on the server (setRoomSettingsFn); the ✕ or a
 * tap outside closes without saving.
 */
export function RoomSettingsSheet({
  initial,
  onSave,
  onClose,
}: {
  initial: RoomSettings;
  onSave: (settings: RoomSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<RoomPick[]>(() => orderPicks(initial.picks));
  const [rounds, setRounds] = useState(() => clampRounds(initial.rounds, initial.picks));
  /** The preset last tapped; editing a chip clears it. Opens on the preset the picks match. */
  const [preset, setPreset] = useState<PresetId | null>(() => presetOf(initial.picks));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cap = roundCap(picks);
  const games = eligibleCount(picks);

  const choosePicks = (next: RoomPick[], fromPreset: PresetId | null) => {
    const ordered = orderPicks(next);
    setPicks(ordered);
    setPreset(fromPreset);
    // The count follows a smaller cap down (never up on its own).
    setRounds((n) => Math.min(n, roundCap(ordered)));
    setError(null);
  };
  const toggle = (pick: RoomPick) => {
    const on = picks.includes(pick);
    if (on && picks.length === 1) return;
    choosePicks(on ? picks.filter((p) => p !== pick) : [...picks, pick], null);
  };
  const chooseRounds = (n: number) => {
    setRounds(Math.max(Math.min(MIN_ROUNDS, cap), Math.min(cap, Math.round(n))));
    setError(null);
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ picks, rounds });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the settings. Try again.");
    } finally {
      setSaving(false);
    }
  };
  const minutes = estimateRoomMinutes({ picks, rounds });

  return (
    <Sheet
      title="Room settings"
      closeLabel="Close room settings"
      skin="room"
      onClose={onClose}
      data={{ "data-room-settings-sheet": "" }}
      className="rss-sheet"
      footer={
        <div className="rss-footer shrink-0 px-4 pt-2">
          <Button
            variant="secondary"
            size={48}
            block
            data-room-settings-save
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      }
    >
        <div
          data-scrollable
          className="rss-body flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-2 pt-1"
        >
          <section aria-label="Categories" className="flex flex-col gap-2.5">
            <Segmented
              label="Presets"
              value={preset}
              onChange={(id) => {
                const p = ROOM_PRESETS.find((x) => x.id === id);
                if (p) choosePicks([...p.picks], p.id);
              }}
              options={ROOM_PRESETS.map((p) => ({ value: p.id, label: p.label, data: { "data-room-preset": p.id } }))}
            />
            <div className="rss-picks" role="group" aria-label="Categories">
              {ROOM_PICKS.map((pick) => {
                const on = picks.includes(pick);
                return (
                  <Chip
                    key={pick}
                    cat={pick}
                    tint
                    data-room-pick={pick}
                    data-arcade-pick={isArcadePick(pick) ? "" : undefined}
                    selected={on}
                    aria-disabled={on && picks.length === 1 ? true : undefined}
                    onClick={() => toggle(pick)}
                  >
                    {pickLabel(pick)}
                  </Chip>
                );
              })}
            </div>
            <p className="rss-note">Keep at least one category.</p>
          </section>

          <section aria-label="Rounds" className="flex flex-col gap-2.5">
            <div className="rs-head">
              <h3 className="ap-group-title">Rounds</h3>
              <span data-room-rounds-value className="rs-meta">
                {rounds} rounds, about {minutes} min
              </span>
            </div>
            <Segmented
              label="Rounds"
              value={rounds}
              onChange={chooseRounds}
              options={QUICK_ROUNDS.map((n) => ({ value: n, label: n, disabled: n > cap, data: { "data-room-rounds": n } }))}
            />
            <Slider
              data-rounds-slider
              aria-label="Rounds"
              min={MIN_ROUNDS}
              max={MAX_ROUNDS}
              step={1}
              value={[rounds]}
              onValueChange={([value]) => chooseRounds(value ?? rounds)}
              className="rss-slider"
              style={{
                ["--rss-cap" as string]: `${((MAX_ROUNDS - cap) / (MAX_ROUNDS - MIN_ROUNDS)) * 100}%`,
              }}
            />
            <p
              data-room-cap-note={cap < MAX_ROUNDS ? "" : undefined}
              className="rss-note"
              aria-live="polite"
            >
              {cap < MAX_ROUNDS
                ? `Only ${games} games in your picks, so up to ${cap} rounds.`
                : "3 to 12 rounds, every one a different game."}
            </p>
          </section>
          {error ? (
            <p role="alert" className="text-[13px] text-warn">
              {error}
            </p>
          ) : null}
        </div>
    </Sheet>
  );
}
