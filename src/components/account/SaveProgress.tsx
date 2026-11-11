/**
 * "Save your progress" (wave 1 sign-up screens; docs/mockups/wave-1/ S1 and its README). The rules are
 * saveProgress.ts: the sheet after the first finished game, a small pop-up once more after the third if the sheet was
 * answered "Not now", never before the first game, never for an account. A result screen only counts the game
 * (FinishedGameCounter); the prompt shows on the next tab page (SaveProgressPrompt through PhoneShell's
 * SaveProgressSlot). The list is only what's real today (games, bests, stars and challenges on every phone); ratings,
 * placement and coins join it as waves 2 and 3 land.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button, Icon, Sheet } from "@/design/components";
import { APPLE_SIGN_IN_ENABLED, GOOGLE_SIGN_IN_ENABLED } from "@/config/accountConfig";
import { pushPublicKey } from "@/config/pushConfig";
import { recordSaveProgress, useAccount } from "@/lib/account/accountApi";
import { answerPrompt, noteFinishedGame, takePendingPrompt, type SaveProgressFrom, type SaveProgressMethod, type SaveProgressPrompt } from "@/lib/account/saveProgress";

const PERKS = [
  { icon: "practice", text: "Your games and results, on every phone" },
  { icon: "star", text: "Your stars and practice bests" },
  { icon: "challenge", text: "Your challenges and Daily streak" },
] as const;

/** Where the sign-up should come back to: the screen the player is on. */
function here(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Mounted on a finished game's result screen: counts the game once the account's kind is known and marks a prompt as
 * due on the next tab page (saveProgress.ts). It draws nothing: no prompt ever opens over a result, podium,
 * standings, reveal or share screen.
 */
export function FinishedGameCounter({ gameKey, from }: { gameKey: string; from: SaveProgressFrom }) {
  const account = useAccount();
  useEffect(() => {
    if (account.kind === "unknown" || !gameKey) return;
    noteFinishedGame(gameKey, { signedIn: account.kind === "account", from });
    // Phone notifications (B2): a finished Daily is a useful moment to ask an account (the streak reminder); the ask
    // shows on the next tab page, never here. Nothing while the switch is off.
    if (from === "daily" && account.kind === "account" && pushPublicKey())
      void import("@/lib/push/pushClient").then((m) => m.notePushMoment("daily_finished", true)).catch(() => {});
    // Counted once per game: the account's kind settles once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.kind === "unknown", gameKey]);
  return null;
}

/**
 * Mounted by the tab pages' shell (SaveProgressSlot) when a prompt is due: takes it once and shows the sheet or the
 * pop-up there, on Play, Practice, Tournaments or Profile, never anywhere else.
 */
export function SaveProgressPrompt() {
  const account = useAccount();
  const navigate = useNavigate();
  const [due, setDue] = useState<{ prompt: SaveProgressPrompt; from: SaveProgressFrom | null } | null>(null);

  useEffect(() => {
    if (account.kind === "unknown") return;
    const taken = takePendingPrompt({ signedIn: account.kind === "account" });
    if (!taken) return;
    setDue(taken);
    recordSaveProgress("save_progress_shown", { prompt: taken.prompt, ...(taken.from ? { from: taken.from } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.kind === "unknown"]);

  if (!due) return null;
  const { prompt } = due;
  const from = due.from ?? undefined;

  const dismiss = () => {
    answerPrompt(prompt, "dismissed");
    recordSaveProgress("save_progress_dismissed", { prompt, ...(from ? { from } : {}) });
    setDue(null);
  };
  const tap = (method: SaveProgressMethod) => {
    answerPrompt(prompt, "tapped");
    recordSaveProgress("save_progress_tapped", { prompt, method, ...(from ? { from } : {}) });
    setDue(null);
    void navigate({ to: "/account", search: { from: here(), start: method === "email" ? "email" : "signin" } });
  };

  if (prompt === "popup")
    return (
      <div role="dialog" aria-label="Save your progress" className="acct-popup" data-save-progress="popup">
        <p className="jz-card-title">Save your progress?</p>
        <p className="acct-lede">Make an account and keep your games, bests and stars on every phone.</p>
        <div className="acct-popup-row">
          <Button variant="secondary" size={46} onClick={dismiss} data-save-progress-dismiss>
            Not now
          </Button>
          <Button variant="gold" size={46} onClick={() => tap("email")} data-save-progress-tap>
            Save progress
          </Button>
        </div>
      </div>
    );

  return <SaveProgressSheet onDismiss={dismiss} onTap={tap} />;
}

/** The sheet itself (S1): the prompt above, and anywhere a guest asks for something an account keeps. */
function SaveProgressSheet({ onDismiss, onTap }: { onDismiss: () => void; onTap: (method: SaveProgressMethod) => void }) {
  const tap = onTap;
  return (
    <Sheet open onClose={onDismiss} title="Save your progress" closeLabel="Not now" data={{ "data-save-progress": "sheet" }}>
      <div className="acct-sheet-body">
        <p className="acct-sheet-lede">Make an account to keep what you’ve played.</p>
        <ul className="acct-perks">
          {PERKS.map((p) => (
            <li key={p.text} className="acct-perk">
              <span>
                <Icon name={p.icon} size={20} tone="gold" />
              </span>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
        <div className="acct-actions">
          {APPLE_SIGN_IN_ENABLED ? (
            <Button variant="secondary" size={52} block onClick={() => tap("apple")}>
              Continue with Apple
            </Button>
          ) : null}
          {GOOGLE_SIGN_IN_ENABLED ? (
            <Button variant="secondary" size={52} block onClick={() => tap("google")}>
              Continue with Google
            </Button>
          ) : null}
          <Button variant="gold" size={52} block onClick={() => tap("email")} data-save-progress-tap>
            <Icon name="send" size={20} /> Continue with email
          </Button>
          <Button variant="quiet" size={48} block onClick={onDismiss} data-save-progress-dismiss>
            Not now
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * The same sheet, opened by a guest's own tap (Profile's Customise, wave 2): it touches no prompt record and sends
 * none of the prompt's events (it isn't the after-the-game prompt). Shown on a tab page only, never over a result.
 */
export function SaveProgressOffer({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <SaveProgressSheet
      onDismiss={onClose}
      onTap={(method) => {
        onClose();
        void navigate({ to: "/account", search: { from: here(), start: method === "email" ? "email" : "signin" } });
      }}
    />
  );
}
