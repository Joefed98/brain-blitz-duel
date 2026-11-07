import { useEffect, useState } from "react";

import { FeedbackLink } from "@/components/beta/FeedbackLink";
import { OfflineSettingsRow } from "@/components/offline/OfflineSettingsRow";
import { Slider } from "@/components/ui/slider";
import { Icon, Panel, Row, Segmented, Sheet, SwitchKnob } from "@/design/components";
import { APP_BUILD_ID, buildLabel } from "@/lib/appVersion";
import { setBatterySaver, useBatterySaver } from "@/lib/battery";
import { setHapticsOn, useHapticsOn, useHapticsSupported } from "@/lib/haptics";
import {
  effectsVolume,
  isMuted,
  isMusicMuted,
  musicVolume,
  onSoundSettingsChange,
  setEffectsVolume,
  setMusicMuted,
  setMusicVolume,
  setMuted,
} from "@/lib/sound";

/** The direction-controls choice GridDrag keeps on the device (arrows or joystick). */
const ARROW_KEY = "duelz-arrow-control";

function readArrows(): "arrows" | "joystick" {
  try {
    return window.localStorage.getItem(ARROW_KEY) === "joystick" ? "joystick" : "arrows";
  } catch {
    return "arrows";
  }
}

/**
 * Profile's settings (the gear): the existing device settings in one sheet, nothing new. Sound: a
 * switch each for effects and music and one volume row (both channels; the same settings as every
 * screen's header MuteToggle); the battery saver (lib/battery.ts); haptics (lib/haptics.ts); direction controls are the arrows/joystick choice the grid games offer in play
 * (GridDrag's own key); "How it works" reopens the first-time intro.
 */
export function SettingsSheet({
  onClose,
  onHowItWorks,
  onTerms,
}: {
  onClose: () => void;
  onHowItWorks: () => void;
  /** Opens the beta terms (/terms). */
  onTerms?: () => void;
}) {
  const [arrows, setArrows] = useState<"arrows" | "joystick">("arrows");
  useEffect(() => setArrows(readArrows()), []);
  const choose = (value: "arrows" | "joystick") => {
    setArrows(value);
    try {
      window.localStorage.setItem(ARROW_KEY, value);
    } catch {
      /* storage is a nicety */
    }
  };
  const sound = useSoundSettings();
  const saver = useBatterySaver();
  const haptics = useHapticsOn();
  const hapticsSupported = useHapticsSupported();
  const server = useServerBuild();
  return (
    <Sheet
      title="Settings"
      closeLabel="Close settings"
      skin="profile"
      onClose={onClose}
      data={{ "data-settings-sheet": "" }}
      className="gap-3"
      style={{ paddingBottom: "max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))" }}
    >
        <div data-scrollable className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4">
        {/* Tab-page panels of divided rows (Polish batch R): the two sound switches and one volume row. */}
        <Panel data-sound-controls="settings">
          <SwitchRow label="Sound effects" on={!sound.muted} onChange={(on) => setMuted(!on)} />
          <SwitchRow label="Music" on={!sound.musicMuted} onChange={(on) => setMusicMuted(!on)} />
          <div className="jz-row">
            <span className="jz-row-title w-19 shrink-0">Volume</span>
            <Slider
              aria-label="Volume"
              min={0}
              max={100}
              step={5}
              value={[Math.round(Math.max(sound.effects, sound.music) * 100)]}
              onValueChange={([value]) => {
                const v = (value ?? 0) / 100;
                setEffectsVolume(v);
                setMusicVolume(v);
              }}
              className="min-w-0 flex-1"
            />
            <span className="ap-meta w-10 text-right tabular-nums">{Math.round(Math.max(sound.effects, sound.music) * 100)}%</span>
          </div>
        </Panel>
        <div className="flex flex-col gap-2">
          <span className="ap-group-title">Direction controls</span>
          <Segmented
            label="Direction controls"
            radio
            value={arrows}
            onChange={choose}
            options={[
              { value: "arrows", label: "Arrows" },
              { value: "joystick", label: "Joystick" },
            ]}
          />
          <span className="jz-row-sub pl-1">For games played with arrows</span>
        </div>
        {/* Offline practice (31 Oct 2026): storage used and the pack downloads switch. */}
        <div className="jz-panel">
          <OfflineSettingsRow />
        </div>
        <div className="jz-panel">
          {/* Battery saver (lib/battery.ts, off by default): fewer particles and glows, puzzles at 30 fps. */}
          <SwitchRow label="Battery saver" on={saver} onChange={setBatterySaver} />
          {/* Haptics (lib/haptics.ts, on by default): main moments only. Shown where the device has none, with a note. */}
          <SwitchRow
            label="Haptics"
            on={haptics}
            onChange={setHapticsOn}
            note={hapticsSupported ? undefined : "Not supported on this device"}
            data="haptics"
          />
          <Row as="button" onClick={onHowItWorks}>
            <span className="jz-row-title flex-1">How it works</span>
            <Icon name="chevron-right" size={20} className="ap-chevron" />
          </Row>
          {onTerms ? (
            <Row as="button" data-open-terms onClick={onTerms}>
              <span className="jz-row-title flex-1">Beta terms</span>
              <Icon name="chevron-right" size={20} className="ap-chevron" />
            </Row>
          ) : null}
          <FeedbackLink row />
        </div>
        {/* About: which code is live (the build id baked in at build time, appVersion.ts); the server's own id
            only when it differs, since the server is what deals and grades. */}
        <div className="flex flex-col gap-2">
          <span className="ap-group-title">About</span>
          <div className="jz-panel">
            <div data-build-marker className="jz-row">
              <span className="jz-row-title flex-1">Build</span>
              <span className="ap-meta tabular-nums">{buildLabel(APP_BUILD_ID)}</span>
            </div>
            {server && server !== APP_BUILD_ID ? (
              <div data-server-build-marker className="jz-row">
                <span className="jz-row-title flex-1">Server</span>
                <span className="ap-meta tabular-nums">{buildLabel(server)}</span>
              </div>
            ) : null}
          </div>
        </div>
        </div>
    </Sheet>
  );
}

/** The deployed server's build id (appVersionFn), or null until it answers or when it can't be reached. */
function useServerBuild(): string | null {
  const [server, setServer] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { appVersionFn } = await import("@/lib/appVersion.functions");
        const answer = await appVersionFn();
        if (live && typeof answer?.version === "string") setServer(answer.version);
      } catch {
        /* the marker is a nicety */
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return server;
}

/** One switch row (role="switch"): the label left (a short note under it), the switch right; the whole row toggles. */
function SwitchRow({
  label,
  on,
  onChange,
  note,
  data,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  note?: string | undefined;
  /** A data-setting marker for checks. */
  data?: string;
}) {
  return (
    <Row as="button" role="switch" aria-checked={on} aria-label={label} data-setting={data} onClick={() => onChange(!on)}>
      {note ? (
        <span className="jz-row-text items-start text-left">
          <span className="jz-row-title">{label}</span>
          <span data-setting-note className="jz-row-sub">{note}</span>
        </span>
      ) : (
        <span className="jz-row-title flex-1">{label}</span>
      )}
      <SwitchKnob on={on} />
    </Row>
  );
}

/** The sound settings, kept current (the same source as the header's MuteToggle). */
function useSoundSettings() {
  const [settings, setSettings] = useState({ effects: 1, music: 1, muted: false, musicMuted: false });
  useEffect(() => {
    const read = () =>
      setSettings({ effects: effectsVolume(), music: musicVolume(), muted: isMuted(), musicMuted: isMusicMuted() });
    read();
    return onSoundSettingsChange(read);
  }, []);
  return settings;
}
