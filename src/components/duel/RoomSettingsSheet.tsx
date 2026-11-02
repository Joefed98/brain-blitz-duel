import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

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
      setError(e instanceof Error ? e.message : "Couldn't save the settings. Try again.");
    } finally {
      setSaving(false);
    }
  };
  const minutes = estimateRoomMinutes({ picks, rounds });

  return createPortal(
    <div
      data-skin="room"
      className="th-scrim fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Room settings"
        data-room-settings-sheet
        onClick={(e) => e.stopPropagation()}
        className="th-sheet rss-sheet flex w-full max-w-[430px] flex-col rounded-t-3xl border border-b-0 border-border"
      >
        <div className="flex shrink-0 items-center justify-between px-4 pl-5 pt-3">
          <h2 className="ap-section-title text-[20px]">Room settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close room settings"
            className="press tap-target -mr-1 flex w-11 items-center justify-center text-muted-foreground"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div
          data-scrollable
          className="rss-body flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-2 pt-1"
        >
          <section aria-label="Categories" className="flex flex-col gap-2.5">
            <div className="rs-seg" role="group" aria-label="Presets">
              {ROOM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-room-preset={p.id}
                  aria-pressed={preset === p.id}
                  onClick={() => choosePicks([...p.picks], p.id)}
                  className="press"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="rss-picks" role="group" aria-label="Categories">
              {ROOM_PICKS.map((pick) => {
                const on = picks.includes(pick);
                return (
                  <button
                    key={pick}
                    type="button"
                    data-room-pick={pick}
                    data-cat={pick}
                    data-arcade-pick={isArcadePick(pick) ? "" : undefined}
                    aria-pressed={on}
                    aria-disabled={on && picks.length === 1 ? true : undefined}
                    onClick={() => toggle(pick)}
                    className="rs-cat press"
                  >
                    <span aria-hidden="true" className="rs-cat-dot" />
                    {pickLabel(pick)}
                  </button>
                );
              })}
            </div>
            <p className="rss-note">Keep at least one category.</p>
          </section>

          <section aria-label="Rounds" className="flex flex-col gap-2.5">
            <div className="rs-head">
              <h3 className="ap-group-title">Rounds</h3>
              <span data-room-rounds-value className="rs-meta">
                {rounds} rounds · about {minutes} min
              </span>
            </div>
            <div className="rs-seg" role="group" aria-label="Rounds">
              {QUICK_ROUNDS.map((n) => (
                <button
                  key={n}
                  type="button"
                  data-room-rounds={n}
                  aria-pressed={rounds === n}
                  disabled={n > cap}
                  onClick={() => chooseRounds(n)}
                  className="press"
                >
                  {n}
                </button>
              ))}
            </div>
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

        <div className="rss-footer shrink-0 px-4 pt-2">
          <button
            type="button"
            data-room-settings-save
            onClick={() => void save()}
            disabled={saving}
            className="rs-btn rss-save press tap-target w-full"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
