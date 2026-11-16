/**
 * Settings as its own page (the Settings, account and onboarding session, phase 2 step 3, 14 Nov 2026; replaces the
 * settings sheet). Grouped list rows in the style guide's look (docs/design/style-guide/phone/list.png, more.png,
 * desktop/list.png), one clean group a job, in this order:
 *
 *   Account        an account's username, email, country, leaderboards, sign out and delete (AccountSection, the
 *                  same rules as /account); a guest's one "Sign in or create an account" row
 *   Appearance     Dark (default), Light, Match my device (lib/appearance.ts)
 *   Sound          the effects and music switches and their volumes (lib/sound.ts, VolumeSliders)
 *   Game controls  direction controls (GridDrag's own key), haptics (lib/haptics.ts), battery saver (lib/battery.ts)
 *   Notifications  NotificationSettings (renders nothing where notifications are off for this player)
 *   Offline        the offline practice row
 *   Help           How it works (the first-time intro), Support (where set), Send feedback (where today), Beta terms
 *   About          the build marker
 *
 * Every setting keeps its storage and behaviour; only the page is new. A section or row that doesn't apply leaves no
 * gap (each group is drawn only with something in it). On a computer the groups sit in two columns.
 */
import { useEffect, useState, type ReactNode } from "react";

import { AccountSection } from "@/components/account/AccountSettings";
import { FeedbackLink } from "@/components/beta/FeedbackLink";
import { OfflineSettingsRow } from "@/components/offline/OfflineSettingsRow";
import { NotificationSettings } from "@/components/push/NotificationSettings";
import { VolumeSliders } from "@/components/app/VolumeSliders";
import { Button, Icon, Panel, Row, Segmented, SwitchKnob } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { APP_BUILD_ID, buildLabel } from "@/lib/appVersion";
import { APPEARANCE_OPTIONS, setAppearance, useAppearance } from "@/lib/appearance";
import { GAME_TIMERS, GAME_TIMER_LABEL } from "@/config/gameFrameConfig";
import { setGameTimer, useGameTimer } from "@/lib/gameFrame/headerStyle";
import { setBatterySaver, useBatterySaver } from "@/lib/battery";
import { setFissionThumb, useFissionThumb } from "@/lib/arcade/fissionThumb";
import { useDesktop } from "@/lib/desktop";
import { setPreferredScheme, usePreferredScheme } from "@/lib/gameControls";
import { betaValue } from "@/lib/beta/betaValues";
import { feedbackBase, feedbackUrl } from "@/lib/beta/feedback";
import { setHapticsOn, useHapticsOn, useHapticsSupported } from "@/lib/haptics";
import { isMuted, isMusicMuted, onSoundSettingsChange, setMusicMuted, setMuted } from "@/lib/sound";

/** The direction-controls choice GridDrag keeps on the device (arrows or joystick). */
const ARROW_KEY = "duelz-arrow-control";

function readArrows(): "arrows" | "joystick" {
  try {
    return window.localStorage.getItem(ARROW_KEY) === "joystick" ? "joystick" : "arrows";
  } catch {
    return "arrows";
  }
}

export interface SettingsActions {
  /** Back to the page before (More, Profile, wherever Settings was opened from). */
  onBack?: () => void;
  /** Opens the first-time intro (How it works). */
  onHowItWorks: () => void;
  /** Opens the beta terms (/terms). */
  onTerms?: () => void;
  /** Opens the sign-in and sign-up flow (/account) for a guest. */
  onSignIn?: () => void;
  /** After Sign out. */
  onSignedOut?: () => void;
  /** Once a deletion is requested: the purge date (the page shows the message). */
  onDeleted?: (purgeAt: string) => void;
}

/** The page's header: Back and the title (the style guide's Title role). */
export function SettingsHead({ title = "Settings", onBack }: { title?: string; onBack?: (() => void) | undefined }) {
  return (
    <header className="st-head" data-settings-head>
      {onBack ? (
        <Button variant="icon" aria-label="Back" data-settings-back onClick={onBack} className="-ml-2.5">
          <Icon name="back" size={22} />
        </Button>
      ) : null}
      <h1 className="st-title" data-ellipsis>
        {title}
      </h1>
    </header>
  );
}

/** Everything under the header (drawn on its own by checks that need no router). */
export function SettingsBody({ onHowItWorks, onTerms, onSignIn, onSignedOut, onDeleted }: SettingsActions) {
  const desktop = useDesktop();
  const preferred = usePreferredScheme();
  const account = useAccount();
  const [arrows, setArrows] = useState<"arrows" | "joystick">("arrows");
  const fissionThumb = useFissionThumb();
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
  const appearance = useAppearance();
  const gameTimer = useGameTimer();
  const saver = useBatterySaver();
  const haptics = useHapticsOn();
  const hapticsSupported = useHapticsSupported();
  const server = useServerBuild();
  const contact = betaValue("CONTACT_EMAIL");
  const feedback = feedbackUrl(feedbackBase(), null);
  // Support as More has it: the support address, else the feedback form; no row while neither is set.
  const support = contact ? `mailto:${contact}` : feedback;

  return (
    <div className="st-columns" data-settings-body>
      <div className="st-col">
        {account.kind === "unknown" ? null : (
          <Group title="Account" data="account">
            {account.kind === "account" ? (
              <AccountSection account={account} onSignedOut={onSignedOut ?? (() => undefined)} onDeleted={onDeleted ?? (() => undefined)} />
            ) : (
              <Panel>
                <Row as="button" data-open-account title="Sign in or create an account" sub="Keep your progress on every phone" onClick={onSignIn}>
                  <Icon name="chevron-right" size={20} className="st-chevron" />
                </Row>
              </Panel>
            )}
          </Group>
        )}

        {/* Appearance (2b, Joe 14 Nov 2026): Dark (the default), Light, Match my device; kept on this device. */}
        <Group title="Appearance" data="appearance">
          <div data-appearance-setting={appearance}>
            <Segmented
              label="Appearance"
              radio
              value={appearance}
              onChange={setAppearance}
              options={APPEARANCE_OPTIONS.map(({ value, label }) => ({ value, label, data: { "data-appearance-option": value } }))}
            />
          </div>
          {/* Game timer (Joe, 15 Nov 2026): Bar (the default), Ring or Chip, in every game's header and the computer's side
              panel; kept on this device like the appearance (lib/gameFrame/headerStyle.ts). */}
          <div data-game-timer-setting={gameTimer} className="st-timer">
            <span className="st-timer-label">Game timer</span>
            <Segmented
              label="Game timer"
              radio
              value={gameTimer}
              onChange={setGameTimer}
              options={GAME_TIMERS.map((value) => ({ value, label: GAME_TIMER_LABEL[value], data: { "data-game-timer-option": value } }))}
            />
          </div>
        </Group>

        {/* The two sound switches, then a volume slider for each (the same settings as each game's menu). */}
        <Group title="Sound" data="sound">
          <Panel data-sound-controls="settings">
            <SwitchRow label="Sound effects" on={!sound.muted} onChange={(on) => setMuted(!on)} />
            <SwitchRow label="Music" on={!sound.musicMuted} onChange={(on) => setMusicMuted(!on)} />
            <VolumeSliders />
          </Panel>
        </Group>
      </div>

      <div className="st-col">
        <Group title="Game controls" data="controls">
          <Panel>
            <div className="jz-row st-seg-row" data-setting="direction">
              <span className="jz-row-text">
                <span className="jz-row-title">Direction controls</span>
                <span className="jz-row-sub" data-ellipsis>For games played with arrows</span>
              </span>
              <Segmented
                label="Direction controls"
                radio
                value={arrows}
                onChange={choose}
                className="st-seg"
                options={[
                  { value: "arrows", label: "Arrows" },
                  { value: "joystick", label: "Joystick" },
                ]}
              />
            </div>
            {/* Haptics (on by default): main moments only. Drawn only where the device can vibrate (Joe, 15 Nov 2026). */}
            {hapticsSupported ? <SwitchRow label="Haptics" on={haptics} onChange={setHapticsOn} data="haptics" /> : null}
            {/* Battery saver (off by default): fewer particles and glows, puzzles at 30 fps. */}
            <SwitchRow label="Battery saver" on={saver} onChange={setBatterySaver} data="battery" />
          </Panel>
          {/* Fission one thumb (the Retro overhaul, stage 3, lib/arcade/fissionThumb.ts): its own panel, input mapping only. */}
          <Panel className="mt-3">
            <SwitchRow label="Fission: one thumb" note="Drag to move, touch to fire" on={fissionThumb} onChange={setFissionThumb} data="fission-thumb" />
          </Panel>
          {/* On a computer (phase 2 step 4 pass 2, lib/gameControls.ts): its own panel under the device's controls. */}
          {desktop ? (
            <Panel className="mt-3">
              <div className="jz-row st-seg-row" data-setting="computer-controls">
                <span className="jz-row-text">
                  <span className="jz-row-title">On a computer</span>
                  <span className="jz-row-sub" data-ellipsis>Each game’s menu can change its own</span>
                </span>
                <Segmented
                  label="On a computer"
                  radio
                  value={preferred ?? "own"}
                  onChange={(v) => setPreferredScheme(v === "own" ? null : v)}
                  className="st-seg"
                  options={[
                    { value: "own", label: "Default" },
                    { value: "keys", label: "Keyboard" },
                    { value: "mouse", label: "Mouse" },
                  ]}
                />
              </div>
            </Panel>
          ) : null}
        </Group>

        {/* Phone notifications (B2): its own heading and panel; nothing while the switch is off or for a guest. */}
        <div className="st-notify">
          <NotificationSettings />
        </div>

        <Group title="Offline" data="offline">
          <Panel>
            <OfflineSettingsRow />
          </Panel>
        </Group>

        <Group title="Help" data="help">
          <Panel>
            <Row as="button" data-open-intro title="How it works" onClick={onHowItWorks}>
              <Icon name="chevron-right" size={20} className="st-chevron" />
            </Row>
            {support ? (
              <Row
                as="a"
                href={support}
                data-open-support
                title="Support"
                {...(contact ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              >
                <Icon name={contact ? "chevron-right" : "external"} size={20} className="st-chevron" />
              </Row>
            ) : null}
            {/* Send feedback where it is today: only when it isn't already the Support row. */}
            {contact ? <FeedbackLink row /> : null}
            {onTerms ? (
              <Row as="button" data-open-terms title="Beta terms" onClick={onTerms}>
                <Icon name="chevron-right" size={20} className="st-chevron" />
              </Row>
            ) : null}
          </Panel>
        </Group>

        {/* About: which code is live (the build id baked in at build time, appVersion.ts); the server's own id
            only when it differs, since the server is what deals and grades. */}
        <Group title="About" data="about">
          <Panel>
            <div data-build-marker className="jz-row">
              <span className="jz-row-title flex-1">Build</span>
              <span className="st-value tabular-nums">{buildLabel(APP_BUILD_ID)}</span>
            </div>
            {server && server !== APP_BUILD_ID ? (
              <div data-server-build-marker className="jz-row">
                <span className="jz-row-title flex-1">Server</span>
                <span className="st-value tabular-nums">{buildLabel(server)}</span>
              </div>
            ) : null}
          </Panel>
        </Group>
      </div>
    </div>
  );
}

function Group({ title, data, children }: { title: string; data: string; children: ReactNode }) {
  const id = `settings-${data}`;
  return (
    <section aria-labelledby={id} className="st-group" data-settings-group={data}>
      <h2 id={id} className="st-group-title">
        {title}
      </h2>
      {children}
    </section>
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
          <span data-setting-note className="jz-row-sub" data-ellipsis>
            {note}
          </span>
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
  const [settings, setSettings] = useState({ muted: false, musicMuted: false });
  useEffect(() => {
    const read = () => setSettings({ muted: isMuted(), musicMuted: isMusicMuted() });
    read();
    return onSoundSettingsChange(read);
  }, []);
  return settings;
}
