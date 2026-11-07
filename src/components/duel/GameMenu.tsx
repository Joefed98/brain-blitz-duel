import { ChevronRight, EllipsisVertical } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Panel, Row, Sheet, SwitchKnob } from "@/design/components";
import type { PuzzleType } from "@/lib/duel/types";
import { isMuted, isMusicMuted, onSoundSettingsChange, setMusicMuted, setMuted } from "@/lib/sound";

import { PuzzleHelp } from "./PuzzleInstructions";

/**
 * The game menu (6 Nov 2026, presentation only): one ⋮ button in the game frame's header (a live round's GameLayout
 * and the round intro) in place of the separate "?" and sound buttons. It opens a small sheet (drag to dismiss) with
 * Sound effects and Music switches (the same settings and stores as the settings sheet; nothing new is saved) and How
 * to play, which opens the game's existing help. The button is 36 px wide in the header, where the sound button was,
 * with a 44 × 44 hit area.
 *
 * `onHelp` opens the caller's own help (a live round's PuzzleHelp over the game region); without it (the intro) the
 * menu shows the game's PuzzleHelp itself, over the whole screen.
 */
export const GameMenu = memo(function GameMenu({ type, onHelp }: { type?: PuzzleType | undefined; onHelp?: (() => void) | undefined }) {
  const [open, setOpen] = useState(false);
  const [ownHelp, setOwnHelp] = useState(false);
  const sound = useSoundSwitches();
  const showHelp = onHelp ?? (type ? () => setOwnHelp(true) : undefined);
  return (
    <div data-game-menu data-sound-controls="menu" className="game-frame-sound">
      <button
        type="button"
        data-game-menu-button
        className="press game-frame-icon-button game-menu-button"
        aria-label="Game menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Game menu"
        onClick={() => setOpen(true)}
      >
        <EllipsisVertical aria-hidden="true" className="h-5 w-5" />
      </button>
      {open ? (
        <Sheet
          title="Game menu"
          closeLabel="Close game menu"
          skin="room"
          onClose={() => setOpen(false)}
          data={{ "data-game-menu-sheet": "" }}
          className="gap-3"
          style={{ paddingBottom: "max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))" }}
        >
          <div className="px-4">
            <Panel>
              <SwitchRow label="Sound effects" on={!sound.muted} onChange={(on) => setMuted(!on)} />
              <SwitchRow label="Music" on={!sound.musicMuted} onChange={(on) => setMusicMuted(!on)} />
              {showHelp ? (
                <Row
                  as="button"
                  data-game-menu-help
                  onClick={() => {
                    setOpen(false);
                    showHelp();
                  }}
                >
                  <span className="jz-row-title flex-1">How to play</span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 opacity-60" />
                </Row>
              ) : null}
            </Panel>
          </div>
        </Sheet>
      ) : null}
      {!onHelp && type && ownHelp && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-40">
              <PuzzleHelp type={type} open onClose={() => setOwnHelp(false)} />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
});

/** One switch row (role="switch"), as the settings sheet's: the label left, the switch right; the whole row toggles. */
function SwitchRow({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Row as="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className="jz-row-title flex-1">{label}</span>
      <SwitchKnob on={on} />
    </Row>
  );
}

/** The two mute switches, kept current from the sound settings (lib/sound.ts). */
function useSoundSwitches() {
  const [state, setState] = useState({ muted: false, musicMuted: false });
  useEffect(() => {
    const read = () => setState({ muted: isMuted(), musicMuted: isMusicMuted() });
    read();
    return onSoundSettingsChange(read);
  }, []);
  return state;
}
