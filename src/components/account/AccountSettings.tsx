/**
 * Settings → Account (wave 1 sign-up screens): the username (change it, and when the next change is allowed), the
 * email, the country (a picker; set quietly from the phone's region at sign-up), sign out, and delete account (a
 * two-step confirm: the account and its data are removed after 30 days; signing back in within 30 days cancels).
 * Every rule is the server's (account.functions.ts); the country goes through the phone's RLS write
 * (profileReads.ts updateOwnProfileSettings).
 */
import { useMemo, useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { BoardVisibilitySetting } from "@/components/leaderboards/LeaderboardScreens";
import { Captain } from "@/design/art";
import { Button, Icon, Input, Panel, Row } from "@/design/components";
import type { AccountView } from "@/lib/account/account.server";
import { setAccount, signOutAccount } from "@/lib/account/accountApi";
import { COUNTRY_CODES } from "@/lib/account/country";
import { renameWaitMessage, type RenameAllowance } from "@/lib/account/usernameRules";
import { USERNAME_MAX } from "@/lib/names/username";

import { AccountHead, FOUNDING_BADGE_URL, NameSuggestions, playerNumberText, UsernameState, useUsernameCheck } from "./AccountParts";
import { dayText } from "./SignUpFlow";

function renameLine(rename: RenameAllowance): string {
  if ("nextAt" in rename) return renameWaitMessage(rename.nextAt);
  if (rename.kind === "free") return "You can change it once for free in your first week.";
  return "You can change it now. After that, once every 90 days.";
}

/** Every assigned country, named in British English, A to Z. */
function countryOptions(): [string, string][] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["en-GB"], { type: "region" });
  } catch {
    names = null;
  }
  return [...COUNTRY_CODES]
    .map((code): [string, string] => [code, names?.of(code) ?? code])
    .sort((a, b) => a[1].localeCompare(b[1], "en-GB"));
}

/**
 * The account's own settings as rows (the Settings session, phase 2 step 3, 14 Nov 2026): the player line, the
 * username (with Change and when the next change is allowed), the email, the country, "Show me on leaderboards",
 * then Sign out and Delete account (the two-step confirm). Drawn as Settings' Account section (/settings) and on
 * /account for a signed-in player; every rule is the server's, as before. `onDeleted` takes the purge date once the
 * deletion is requested (the player is signed out at once, so the caller shows the message).
 */
export function AccountSection({
  account,
  onSignedOut,
  onDeleted,
}: {
  account: AccountView & { email: string | null };
  onSignedOut: () => void;
  onDeleted: (purgeAt: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account.username);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [country, setCountry] = useState(account.country ?? "");
  const [countrySaved, setCountrySaved] = useState(false);
  const [confirm, setConfirm] = useState<0 | 1 | 2>(0);
  const check = useUsernameCheck(draft, account.username);
  const countries = useMemo(countryOptions, []);

  const saveName = async () => {
    setBusy(true);
    setError(null);
    try {
      const { changeUsernameFn } = await import("@/lib/account/account.functions");
      const res = (await changeUsernameFn({ data: { username: draft.trim() } })) as
        | AccountView
        | { ok: false; message: string; suggestions?: string[] };
      if ("ok" in res) {
        setError(res.message);
        setSuggestions(res.suggestions ?? []);
        return;
      }
      setAccount(res, account.email);
      setEditing(false);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveCountry = async (code: string) => {
    setCountry(code);
    setCountrySaved(false);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { updateOwnProfileSettings } = await import("@/lib/data/profileReads");
      const { error: e } = await updateOwnProfileSettings(supabase, account.userId, { country: code || null });
      if (e) setError("Couldn’t save your country. Try again.");
      else {
        setAccount({ ...account, country: code || null }, account.email);
        setCountrySaved(true);
      }
    } catch {
      setError("Couldn’t save your country. Try again.");
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      const { requestAccountDeletionFn } = await import("@/lib/account/account.functions");
      const res = (await requestAccountDeletionFn()) as { ok: true; purgeAt: string } | { ok: false; message: string };
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await signOutAccount();
      onDeleted(res.purgeAt);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-stack" data-account-section>
      <Panel>
        <Row
          data-account-row="player"
          leading={account.founding ? <img src={FOUNDING_BADGE_URL} alt="" aria-hidden="true" width={40} height={40} className="acct-founder" /> : <Icon name="profile" size={24} tone="gold" />}
          title={account.founding ? "Founding Player" : "Player"}
        >
          <span className="acct-number">{playerNumberText(account.playerNumber)}</span>
        </Row>
        {editing ? (
          <div className="jz-row st-edit" data-account-rename>
            <div className="acct-field w-full">
              <label htmlFor="account-rename" className="acct-label">
                <span>New username</span>
                <span />
              </label>
              <div className="acct-input-wrap">
                <Input
                  id="account-rename"
                  aria-label="New username"
                  value={draft}
                  maxLength={USERNAME_MAX}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => {
                    setError(null);
                    setSuggestions([]);
                    setDraft(e.target.value.replace(/\s/g, ""));
                  }}
                />
                <UsernameState check={draft === account.username ? { state: "idle" } : check} />
              </div>
              {check.state === "refused" ? <p className="acct-error">{check.message}</p> : error ? <p className="acct-error">{error}</p> : null}
              <NameSuggestions names={check.state === "refused" ? check.suggestions : suggestions} onPick={setDraft} />
              <div className="acct-popup-row">
                <Button variant="secondary" size={48} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button variant="gold" size={48} disabled={busy || check.state !== "ok" || draft === account.username} onClick={() => void saveName()}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Row data-account-row="username">
            <span className="jz-row-text">
              <span className="jz-row-title acct-row-value">{account.username}</span>
              <span className="jz-row-sub st-sub-wrap" data-wrap-ok>
                {renameLine(account.rename)}
              </span>
            </span>
            {account.rename.kind !== "wait" ? (
              <Button variant="secondary" size={44} data-account-change-name onClick={() => setEditing(true)}>
                Change
              </Button>
            ) : null}
          </Row>
        )}
        <Row data-account-row="email" title="Email">
          <span className="st-value" data-ellipsis>{account.email ?? "Not set"}</span>
        </Row>
        <label htmlFor="account-country" className="jz-row st-select-row" data-account-row="country">
          <span className="jz-row-text">
            <span className="jz-row-title">Country</span>
            <span className="jz-row-sub" data-ellipsis>{countrySaved ? "Saved. Only you see it." : "Only you see it."}</span>
          </span>
          <select id="account-country" className="st-select" value={country} onChange={(e) => void saveCountry(e.target.value)}>
            <option value="">Not set</option>
            {countries.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </Panel>

      {/* Wave 4 W4a (docs/leaderboards.md): adults shown by default, under-18s hidden by default. */}
      <div data-account-boards>
        <BoardVisibilitySetting />
      </div>

      {error && !editing ? <p className="acct-error" role="alert">{error}</p> : null}

      <Panel>
        <Row
          as="button"
          data-account-signout
          title="Sign out"
          onClick={async () => {
            await signOutAccount();
            onSignedOut();
          }}
        />
        {confirm === 0 ? (
          <Row as="button" data-account-delete className="st-danger" title="Delete account" onClick={() => setConfirm(1)} />
        ) : (
          <div className="jz-row st-edit" data-account-delete-confirm={confirm}>
            <div className="acct-field w-full">
              <p className="jz-row-title">{confirm === 1 ? "Delete your account?" : "Are you sure?"}</p>
              <p className="jz-row-sub" data-wrap-ok>
                {confirm === 1
                  ? "Your account and its data are removed after 30 days. Sign back in within 30 days to cancel."
                  : `${account.username}, your games and your player number go for good after 30 days.`}
              </p>
              <div className="acct-popup-row">
                <Button variant="secondary" size={48} onClick={() => setConfirm(0)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size={48}
                  className="acct-danger"
                  disabled={busy}
                  data-account-delete-next
                  onClick={() => (confirm === 1 ? setConfirm(2) : void deleteAccount())}
                >
                  {confirm === 1 ? "Continue" : "Delete account"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** "Your account will be deleted": shown once the deletion is requested (the player is a guest again). */
export function AccountDeleted({ purgeAt, onBack }: { purgeAt: string; onBack: () => void }) {
  return (
    <PhoneShell bare skin="profile">
      <div className="acct-page" data-account-screen="deleted">
        <AccountHead onBack={onBack} />
        <div className="acct-grow" />
        <div className="acct-centre">
          <Captain pose="ready" size={96} />
          <h1 className="acct-h1" data-wrap-ok>Your account will be deleted</h1>
          <p className="acct-lede">{`It’s removed on ${dayText(purgeAt)}. Sign back in before then to keep it. You’re playing as a guest now.`}</p>
        </div>
        <div className="acct-grow" />
        <Button variant="gold" size={58} block onClick={onBack}>
          Back to playing
        </Button>
      </div>
    </PhoneShell>
  );
}

/** /account for a signed-in player: the Account section on its own page (Settings draws the same section). */
export function AccountSettings({ account, onBack }: { account: AccountView & { email: string | null }; onBack: () => void }) {
  const [deleted, setDeleted] = useState<string | null>(null);
  if (deleted) return <AccountDeleted purgeAt={deleted} onBack={onBack} />;
  return (
    <PhoneShell bare skin="profile">
      <div className="acct-page" data-account-screen="settings">
        <AccountHead title="Account" onBack={onBack} />
        <AccountSection account={account} onSignedOut={onBack} onDeleted={setDeleted} />
      </div>
    </PhoneShell>
  );
}
