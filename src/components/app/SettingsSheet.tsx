import { ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { FeedbackLink } from "@/components/beta/FeedbackLink";
import { Slider } from "@/components/ui/slider";
import { APP_BUILD_ID, buildLabel } from "@/lib/appVersion";
import { setBatterySaver, useBatterySaver } from "@/lib/battery";
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
 * screen's header MuteToggle); the battery saver (lib/battery.ts); direction controls are the arrows/joystick choice the grid games offer in play
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
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
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
  const server = useServerBuild();
  return createPortal(
    <div
      data-skin="profile"
      className="th-scrim fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-settings-sheet
        onClick={(e) => e.stopPropagation()}
        className="th-sheet flex w-full max-w-[430px] flex-col gap-4 rounded-t-3xl border border-b-0 border-border bg-card px-4 pt-3"
        style={{ paddingBottom: "max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))", background: "var(--ap-bg)" }}
      >
        <div className="flex items-center justify-between pl-1">
          <h2 className="ap-section-title text-[20px]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="press tap-target -mr-1 flex w-11 items-center justify-center text-muted-foreground"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {/* Tab-page panels of divided rows (Polish batch R): the two sound switches and one volume row. */}
        <div data-sound-controls="settings" className="ap-panel">
          <SwitchRow label="Sound effects" on={!sound.muted} onChange={(on) => setMuted(!on)} />
          <SwitchRow label="Music" on={!sound.musicMuted} onChange={(on) => setMusicMuted(!on)} />
          <div className="ap-row">
            <span className="ap-row-title w-[76px] shrink-0">Volume</span>
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
        </div>
        <div className="flex flex-col gap-2">
          <span className="ap-group-title">Direction controls</span>
          <div role="radiogroup" aria-label="Direction controls" className="rs-seg">
            {(["arrows", "joystick"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={arrows === value}
                onClick={() => choose(value)}
                className="press"
              >
                {value === "arrows" ? "Arrows" : "Joystick"}
              </button>
            ))}
          </div>
          <span className="ap-row-sub pl-1">For games played with arrows</span>
        </div>
        <div className="ap-panel">
          {/* Battery saver (lib/battery.ts, off by default): fewer particles and glows, puzzles at 30 fps. */}
          <SwitchRow label="Battery saver" on={saver} onChange={setBatterySaver} />
          <button type="button" onClick={onHowItWorks} className="ap-row press">
            <span className="ap-row-title flex-1">How it works</span>
            <ChevronRight aria-hidden="true" className="ap-chevron" />
          </button>
          {onTerms ? (
            <button type="button" data-open-terms onClick={onTerms} className="ap-row press">
              <span className="ap-row-title flex-1">Beta terms</span>
              <ChevronRight aria-hidden="true" className="ap-chevron" />
            </button>
          ) : null}
          <FeedbackLink row />
        </div>
        {/* About: which code is live (the build id baked in at build time, appVersion.ts); the server's own id
            only when it differs, since the server is what deals and grades. */}
        <div className="flex flex-col gap-2">
          <span className="ap-group-title">About</span>
          <div className="ap-panel">
            <div data-build-marker className="ap-row">
              <span className="ap-row-title flex-1">Build</span>
              <span className="ap-meta tabular-nums">{buildLabel(APP_BUILD_ID)}</span>
            </div>
            {server && server !== APP_BUILD_ID ? (
              <div data-server-build-marker className="ap-row">
                <span className="ap-row-title flex-1">Server</span>
                <span className="ap-meta tabular-nums">{buildLabel(server)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
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

/** One switch row (role="switch"): the label left, the switch right; the whole row toggles. */
function SwitchRow({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="ap-row press">
      <span className="ap-row-title flex-1">{label}</span>
      <span aria-hidden="true" className="rs-switch" data-on={on ? "" : undefined}>
        <span />
      </span>
    </button>
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
