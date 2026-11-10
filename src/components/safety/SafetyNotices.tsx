/**
 * The safety notices a player sees on open (safety, 10 Nov 2026; docs/moderation.md): a warning from Joulz (once), a
 * ban (with the support address; Practice still works), and a forced rename (pick a new name; the temporary energy
 * name until then). Mounted by the root; renders nothing unless there is something to show.
 */

import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button, Input } from "@/design/components";
import { currentUserId, setStoredName } from "@/lib/duel/session";
import { noticesWanted } from "@/lib/safety/notices";
import type { SafetyNotices as Notices } from "@/lib/safety/notices";

type Shown = { kind: "warning"; text: string } | { kind: "banned"; text: string } | { kind: "rename"; account: boolean; temp: string | null };

function queueOf(n: Notices): Shown[] {
  const out: Shown[] = [];
  if (n.banned && n.bannedMessage) out.push({ kind: "banned", text: n.bannedMessage });
  if (n.warning) out.push({ kind: "warning", text: n.warning });
  if (n.rename) out.push({ kind: "rename", account: n.rename.kind === "account", temp: n.rename.tempName });
  return out;
}

export function SafetyNotices() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const asked = useRef(false);
  const [queue, setQueue] = useState<Shown[]>([]);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (asked.current || typeof window === "undefined") return;
    const env = {
      webdriver: navigator.webdriver === true,
      allow: (window as { __DUELZ_ALLOW_SAFETY__?: boolean }).__DUELZ_ALLOW_SAFETY__ === true,
      online: navigator.onLine !== false,
    };
    if (!noticesWanted(pathname, env)) return;
    asked.current = true;
    void (async () => {
      try {
        if (!(await currentUserId())) return;
        const { safetyStatusFn } = await import("@/lib/safety/safety.functions");
        const result = await safetyStatusFn();
        if (!result.ok) return;
        if (result.rename?.kind === "guest" && result.rename.tempName) setStoredName(result.rename.tempName);
        setQueue(queueOf(result));
      } catch {
        /* notices wait for the next open */
      }
    })();
  }, [pathname]);

  const current = queue[0];
  if (!current) return null;
  const next = () => {
    setQueue((q) => q.slice(1));
    setName("");
    setProblem(null);
  };

  const body =
    current.kind === "rename" ? (
      <>
        <p className="text-lg font-extrabold">Pick a new name</p>
        <p className="text-sm text-muted-foreground">
          {current.account ? "Your username was changed after a report." : "Your name was changed after a report."}
          {current.temp ? ` For now you’re ${current.temp}.` : ""} This change doesn’t count towards your name changes.
        </p>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="New name"
          placeholder={current.account ? "New username" : "New name"}
          maxLength={16}
        />
        {problem ? (
          <p role="status" className="text-sm text-warn">
            {problem}
          </p>
        ) : null}
        <Button
          variant="secondary"
          block
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const { pickForcedNameFn } = await import("@/lib/safety/safety.functions");
              const result = await pickForcedNameFn({ data: { name } });
              if (result.ok && "name" in result) {
                if (result.kind === "guest") setStoredName(result.name);
                next();
              } else {
                const list = ("suggestions" in result ? (result.suggestions as string[] | undefined) : undefined) ?? [];
                const suggestions = list.length ? ` Try ${list.join(", ")}.` : "";
                setProblem(`${result.message}${suggestions}`);
              }
            } catch {
              setProblem("That didn’t save. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save name
        </Button>
      </>
    ) : (
      <>
        <p className="text-lg font-extrabold">{current.kind === "banned" ? "Rooms and chat are off" : "A note from Joulz"}</p>
        <p className="text-sm text-muted-foreground">{current.text}</p>
        <Button
          variant="secondary"
          block
          onClick={() => {
            if (current.kind === "warning")
              void import("@/lib/safety/safety.functions").then(({ ackWarningFn }) => ackWarningFn()).catch(() => {});
            next();
          }}
        >
          OK
        </Button>
      </>
    );

  return (
    <div
      role="alertdialog"
      aria-label={current.kind === "rename" ? "Pick a new name" : current.kind === "banned" ? "Rooms and chat are off" : "A note from Joulz"}
      data-skin="room"
      data-safety-notice={current.kind}
      className="th-scrim fixed inset-0 flex items-center justify-center bg-background/90 p-6"
      style={{ zIndex: 70 }}
    >
      <div className="th-sheet w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 text-center">{body}</div>
    </div>
  );
}
