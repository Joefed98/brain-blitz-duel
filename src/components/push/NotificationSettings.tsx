/**
 * Settings → Notifications (wave 2 train B, session B2): every notification switch in one place. "On this phone" turns
 * this device on or off (the browser's permission and its subscription); "All notifications" is the master switch; then
 * one switch per event. Accounts in the audience only (pushConfig.ts: the testers while PUSH_FOR_EVERYONE is false);
 * nothing renders while the switch (PUSH_PUBLIC_KEY) is off, for a guest or for anyone outside it. On an
 * iPhone in Safari the panel says how to add Joulz to the Home Screen instead.
 */
import { useEffect, useState } from "react";

import { pushForPlayer, pushPublicKey } from "@/config/pushConfig";
import { Row, SwitchKnob } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { DEFAULT_PUSH_SETTINGS, PUSH_EVENTS, PUSH_EVENT_LABELS, type PushEvent, type PushSettings } from "@/lib/push/rules";

export function NotificationSettings() {
  const account = useAccount();
  if (!pushPublicKey() || account.kind !== "account" || !pushForPlayer(account.playerNumber)) return null;
  return <NotificationSettingsPanel />;
}

type Device = "loading" | "on" | "off" | "home-screen" | "unsupported" | "blocked";

function NotificationSettingsPanel() {
  const [device, setDevice] = useState<Device>("loading");
  const [settings, setSettings] = useState<PushSettings>(DEFAULT_PUSH_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const push = await import("@/lib/push/pushClient");
      let next: Device;
      if (push.needsHomeScreen()) next = "home-screen";
      else if (!push.pushSupported()) next = "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else next = (await push.deviceSubscribed()) ? "on" : "off";
      if (live) setDevice(next);
      try {
        const { pushSettingsFn } = await import("@/lib/push/push.functions");
        const answer = (await pushSettingsFn()) as { ok: boolean; settings?: PushSettings };
        if (live && answer?.ok && answer.settings) setSettings(answer.settings);
      } catch {
        /* the defaults stay shown */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const change = (patch: Partial<PushSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void (async () => {
      try {
        const { setPushSettingsFn } = await import("@/lib/push/push.functions");
        const answer = (await setPushSettingsFn({ data: patch as Record<string, boolean> })) as { ok: boolean; settings?: PushSettings };
        if (answer?.ok && answer.settings) setSettings(answer.settings);
      } catch {
        /* kept on screen; saved next time */
      }
    })();
  };

  const toggleDevice = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const push = await import("@/lib/push/pushClient");
      if (device === "on") {
        await push.unsubscribeDevice();
        setDevice("off");
      } else {
        const outcome = await push.enableNotifications("settings");
        setDevice(outcome === "subscribed" ? "on" : outcome === "denied" ? "blocked" : "off");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" data-push-settings>
      <span className="ap-group-title">Notifications</span>
      <div className="jz-panel">
        {device === "home-screen" ? (
          <div className="jz-row" data-push-howto>
            <span className="jz-row-text items-start text-left">
              <span className="jz-row-title">Add Joulz to your Home Screen</span>
              <span className="jz-row-sub">
                On iPhone, notifications work in the Home Screen app: tap Share, then Add to Home Screen, and open Joulz
                from there.
              </span>
            </span>
          </div>
        ) : device === "unsupported" ? (
          <div className="jz-row">
            <span className="jz-row-text items-start text-left">
              <span className="jz-row-title">On this phone</span>
              <span className="jz-row-sub">This browser can’t show notifications</span>
            </span>
          </div>
        ) : device === "blocked" ? (
          <div className="jz-row" data-push-blocked>
            <span className="jz-row-text items-start text-left">
              <span className="jz-row-title">On this phone</span>
              <span className="jz-row-sub">Blocked in your phone’s settings for this site</span>
            </span>
          </div>
        ) : (
          <SwitchRow label="On this phone" on={device === "on"} onChange={() => void toggleDevice()} data="device" />
        )}
        <SwitchRow label="All notifications" on={settings.enabled} onChange={(on) => change({ enabled: on })} data="enabled" />
        {PUSH_EVENTS.map((event: PushEvent) => (
          <SwitchRow
            key={event}
            label={PUSH_EVENT_LABELS[event].title}
            note={PUSH_EVENT_LABELS[event].sub}
            on={settings.enabled && settings[event]}
            onChange={(on) => change(on && !settings.enabled ? { enabled: true, [event]: true } : { [event]: on })}
            data={event}
          />
        ))}
      </div>
      <span className="jz-row-sub pl-1">Three a day at most (room invites apart), and none from 10 pm to 8 am.</span>
    </div>
  );
}

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
  note?: string;
  data: string;
}) {
  return (
    <Row as="button" role="switch" aria-checked={on} aria-label={label} data-push-setting={data} onClick={() => onChange(!on)}>
      {note ? (
        <span className="jz-row-text items-start text-left">
          <span className="jz-row-title">{label}</span>
          <span className="jz-row-sub">{note}</span>
        </span>
      ) : (
        <span className="jz-row-title flex-1">{label}</span>
      )}
      <SwitchKnob on={on} />
    </Row>
  );
}
