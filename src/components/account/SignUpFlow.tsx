/**
 * Turning a guest into a signed-in player (wave 1 sign-up screens, 10 Nov 2026; docs/mockups/wave-1/ S2–S6 and their
 * README; docs/accounts/README.md for the server's order). Every rule is the backend's: this only calls it.
 *
 *   S2 Sign in ─ email ─▶ S3 email ─ Send ─▶ requestSignInEmailFn (never creates a user)
 *      ├ an account exists: the guest-progress warning when this phone has some (Cancel / Continue) ─▶ S3b inbox
 *      └ no account: a new player ─▶ S4 username and colour ─▶ S5 birthday ─▶ startSignUpFn (the age gate: under 13
 *        refused with nothing stored, remembered on the phone) ─▶ requestSignUpEmailFn (links the email to this guest)
 *        ─▶ S3b inbox (link or 6-digit code) ─▶ completeSignUpFn ─▶ S6 welcome
 *
 * A phone holding a refusal (ageGate.ts) sees the kind message again instead of the username step. A device signed
 * in but not signed up (an email confirmed, no profile) starts at S4. Signing in to an account waiting for deletion
 * shows the backend's cancel offer. Google and Apple show only while their switches are on.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { Captain } from "@/design/art";
import { Button, Icon, Input, Panel, Row } from "@/design/components";
import { APPLE_SIGN_IN_ENABLED, GOOGLE_SIGN_IN_ENABLED } from "@/config/accountConfig";
import { refreshAccount, setAccount, type PhoneAccount } from "@/lib/account/accountApi";
import type { AccountView } from "@/lib/account/account.server";
import { parseDateOfBirth, UNDER_13_MESSAGE } from "@/lib/account/age";
import { ageRefusalActive, rememberAgeRefusal } from "@/lib/account/ageGate";
import { regionCountry } from "@/lib/account/country";
import { APP_NAME } from "@/lib/brand";
import { PLAYER_COLOURS } from "@/lib/duel/playerLook";
import { rememberedLook } from "@/lib/duel/playerLook";
import { USERNAME_MAX } from "@/lib/names/username";

import {
  AccountHead,
  FOUNDING_BADGE_URL,
  NameSuggestions,
  PlayerCard,
  playerNumberText,
  StepBar,
  UsernameState,
  useUsernameCheck,
} from "./AccountParts";

export type FlowStep =
  | "signin"
  | "email"
  | "warn"
  | "inbox"
  | "username"
  | "birthday"
  | "under13"
  | "welcome"
  | "deleting";

type Mode = "sign-up" | "sign-in";

interface GuestProgressView {
  rooms: number;
  dailies: number;
  challenges: number;
  practice: number;
}

const RESEND_AFTER_S = 60;

type SendOutcome = { ok: true } | { ok: false; reason: string; message: string };

/**
 * The account emails go through the server (account.functions.ts), which holds them to the per-network and
 * per-address limits before Supabase Auth sends anything; the phone never calls Auth's send endpoints itself.
 */
async function sendSignInEmail(email: string): Promise<SendOutcome> {
  const { requestSignInEmailFn } = await import("@/lib/account/account.functions");
  // Safety (10 Nov 2026): with Turnstile on, the server passes this to Supabase Auth's captcha check on /otp.
  const { signInCaptchaToken } = await import("@/lib/account/auth");
  return (await requestSignInEmailFn({ data: { email, captchaToken: await signInCaptchaToken() } })) as SendOutcome;
}
async function sendSignUpEmail(email: string): Promise<SendOutcome> {
  const { requestSignUpEmailFn } = await import("@/lib/account/account.functions");
  return (await requestSignUpEmailFn({ data: { email } })) as SendOutcome;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "3 rooms, 2 Dailies and 14 practice games": what stays behind on this phone's guest. */
export function stayBehindLines(p: GuestProgressView): string[] {
  const lines: string[] = [];
  if (p.rooms) lines.push(plural(p.rooms, "room game", "room games"));
  if (p.dailies) lines.push(plural(p.dailies, "Daily", "Dailies"));
  if (p.challenges) lines.push(plural(p.challenges, "challenge", "challenges"));
  if (p.practice) lines.push(plural(p.practice, "practice game", "practice games"));
  return lines;
}

/**
 * A screen check's starting point (scripts/theme-screens.ts ACCOUNT_SCREENS, through
 * window.__DUELZ_ACCOUNT_FIXTURE__, as the beta values' stand-ins): which step, and what the player has typed so far.
 * Never set by the app.
 */
interface FlowFixture {
  step?: FlowStep;
  email?: string;
  username?: string;
  colour?: number;
  dob?: { d: string; m: string; y: string };
  progress?: GuestProgressView;
  done?: AccountView;
  welcomeBack?: boolean;
}
function flowFixture(): FlowFixture {
  if (typeof window === "undefined") return {};
  return (window as unknown as { __DUELZ_ACCOUNT_FIXTURE__?: FlowFixture }).__DUELZ_ACCOUNT_FIXTURE__ ?? {};
}

export function SignUpFlow({
  start,
  account,
  onDone,
}: {
  /** Where the flow opens (the save-progress sheet goes straight to the email step). */
  start: FlowStep;
  account: PhoneAccount;
  /** Back to playing (or wherever the player came from). */
  onDone: () => void;
}) {
  const incomplete = account.kind === "incomplete";
  const [fixture] = useState(flowFixture);
  const [step, setStep] = useState<FlowStep>(fixture.step ?? (incomplete ? (ageRefusalActive() ? "under13" : "username") : start));
  const [history, setHistory] = useState<FlowStep[]>([]);
  const [mode, setMode] = useState<Mode>(fixture.progress ? "sign-in" : "sign-up");
  const [email, setEmail] = useState(fixture.email ?? (account.kind === "incomplete" ? (account.email ?? "") : ""));
  const [username, setUsername] = useState(fixture.username ?? "");
  const [colour, setColour] = useState(() => fixture.colour ?? rememberedLook().colour ?? 0);
  const [dob, setDob] = useState(fixture.dob ?? { d: "", m: "", y: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [progress, setProgress] = useState<GuestProgressView | null>(fixture.progress ?? null);
  const [guestId, setGuestId] = useState<string | null>(account.kind === "guest" ? account.userId : null);
  const [done, setDone] = useState<AccountView | null>(fixture.done ?? null);
  const [deletion, setDeletion] = useState<{ purgeAt: string } | null>(null);
  const [welcomeBack, setWelcomeBack] = useState(fixture.welcomeBack ?? false);

  const go = (next: FlowStep) => {
    setError(null);
    setHistory((h) => [...h, step]);
    setStep(next);
  };
  const back = () => {
    setError(null);
    const prev = history[history.length - 1];
    if (!prev) return onDone();
    setHistory((h) => h.slice(0, -1));
    setStep(prev);
  };

  /* ---------------------------------------------------------------- email */

  const sendEmail = async () => {
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { ensureSession } = await import("@/lib/duel/session");
      await ensureSession();
      const sent = await sendSignInEmail(address);
      if (sent.ok) {
        // An account already has this email: signing in. Warn first when this phone's guest has progress.
        setMode("sign-in");
        const shown = await loadProgress();
        go(shown ? "warn" : "inbox");
        return;
      }
      if (sent.reason === "no-account") {
        // A new player: the name and the birthday first (the age gate comes before any email is sent).
        setMode("sign-up");
        go(ageRefusalActive() ? "under13" : "username");
        return;
      }
      setError(sent.message);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const loadProgress = async (): Promise<boolean> => {
    try {
      const { ensureSession } = await import("@/lib/duel/session");
      const id = await ensureSession();
      setGuestId(id);
      const { guestProgressFn } = await import("@/lib/account/account.functions");
      const res = (await guestProgressFn()) as { ok: true; progress: GuestProgressView; hasProgress: boolean } | { ok: false };
      if (res.ok && res.hasProgress) {
        setProgress(res.progress);
        return true;
      }
    } catch {
      /* no warning is better than no sign-in */
    }
    return false;
  };

  /* ---------------------------------------------------------------- the sign-up's own steps */

  const dateOfBirth = useMemo(() => {
    if (!dob.d || !dob.m || !dob.y) return null;
    const iso = `${dob.y}-${dob.m.padStart(2, "0")}-${dob.d.padStart(2, "0")}`;
    return parseDateOfBirth(iso, Date.now());
  }, [dob]);

  const submitBirthday = async () => {
    if (!dateOfBirth) {
      setError("Enter your birthday.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { ensureSession } = await import("@/lib/duel/session");
      await ensureSession();
      if (incomplete) {
        // The email is already confirmed on this device: the account is made now.
        await finishSignUp();
        return;
      }
      const { startSignUpFn } = await import("@/lib/account/account.functions");
      const started = (await startSignUpFn({ data: { method: "email", dateOfBirth, username: username.trim() } })) as
        | { ok: true }
        | { ok: false; reason: string; message: string; suggestions?: string[] };
      if (!started.ok) return refused(started);
      const sent = await sendSignUpEmail(email.trim());
      if (sent.ok) {
        setMode("sign-up");
        go("inbox");
        return;
      }
      if (sent.reason === "existing-account") {
        // Someone made an account with this email meanwhile: sign in to it instead.
        const again = await sendSignInEmail(email.trim());
        if (!again.ok) return setError(again.message);
        setMode("sign-in");
        const shown = await loadProgress();
        go(shown ? "warn" : "inbox");
        return;
      }
      setError(sent.message);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const refused = (r: { reason: string; message: string; suggestions?: string[] }) => {
    if (r.reason === "under13") {
      rememberAgeRefusal();
      go("under13");
      return;
    }
    if (r.suggestions?.length || ["taken", "held", "offensive", "reserved", "lookalike", "length", "characters", "empty"].includes(r.reason)) {
      setNameSuggestions(r.suggestions ?? []);
      setHistory((h) => h.filter((s) => s !== "username" && s !== "birthday"));
      setStep("username");
      setError(r.message);
      return;
    }
    setError(r.message);
  };

  const finishSignUp = async () => {
    const { completeSignUpFn } = await import("@/lib/account/account.functions");
    const { signUpTurnstileToken } = await import("@/lib/account/auth");
    const res = (await completeSignUpFn({
      data: {
        username: username.trim(),
        dateOfBirth: dateOfBirth ?? "",
        colour,
        country: regionCountry(),
        turnstileToken: await signUpTurnstileToken(),
      },
    })) as AccountView | { ok: false; reason: string; message: string; suggestions?: string[] };
    if ("ok" in res) return refused(res);
    setAccount(res, email.trim() || null);
    setDone(res);
    setWelcomeBack(false);
    setHistory([]);
    setStep("welcome");
    // C2: the rewards every new account is owed (the 1,000-coin sign-up reward; a Founding Player's badge, coins and
    // frame), paid by the server once under fixed keys (badges.server.ts settleAccountRewards).
    void import("@/lib/badges/badgesApi").then((m) => m.refreshBadges()).catch(() => {});
  };

  /* ---------------------------------------------------------------- the code */

  const verified = useRef(false);
  const afterVerified = async () => {
    if (verified.current) return;
    verified.current = true;
    try {
      if (mode === "sign-up") {
        await finishSignUp();
        return;
      }
      const { noteSignInFn } = await import("@/lib/account/account.functions");
      if (guestId && progress) {
        const { rememberLeftGuest } = await import("@/lib/account/auth");
        rememberLeftGuest(guestId);
      }
      void noteSignInFn({ data: { method: "email" } }).catch(() => undefined);
      const now = await refreshAccount();
      if (now.kind === "account") {
        if (now.deletion) {
          setDeletion({ purgeAt: now.deletion.purgeAt });
          setDone(now);
          setHistory([]);
          setStep("deleting");
          return;
        }
        setDone(now);
        setWelcomeBack(true);
        setHistory([]);
        setStep("welcome");
        return;
      }
      // Signed in to an email with no player yet: make it now.
      setMode("sign-up");
      setHistory([]);
      setStep(ageRefusalActive() ? "under13" : "username");
    } finally {
      verified.current = false;
    }
  };

  const submitCode = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const { verifyEmailCode } = await import("@/lib/account/auth");
      const res = await verifyEmailCode(email.trim(), code, mode);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await afterVerified();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // The link opened on this phone (another tab of the same browser): the session changes here too.
  useEffect(() => {
    if (step !== "inbox") return;
    let off = () => {};
    void (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user;
        if (!user || user.is_anonymous !== false) return;
        if (event !== "SIGNED_IN" && event !== "USER_UPDATED") return;
        if (mode === "sign-up" && user.email?.toLowerCase() !== email.trim().toLowerCase()) return;
        void afterVerified();
      });
      off = () => data.subscription.unsubscribe();
    })();
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, email]);

  /* ---------------------------------------------------------------- screens */

  const page = (body: React.ReactNode, opts: { striped?: boolean; screen: string }) => (
    <PhoneShell bare skin="profile">
      <div className="acct-page" data-account-screen={opts.screen} data-striped={opts.striped ? "" : undefined}>
        {body}
      </div>
    </PhoneShell>
  );

  if (step === "signin")
    return page(
      <>
        <AccountHead onBack={back} />
        <div className="acct-centre">
          <Captain pose="ready" size={96} />
          <h1 className="acct-h1" data-wrap-ok>Sign in to {APP_NAME}</h1>
          <p className="acct-lede">Keep your games, bests, stars and challenges on every phone.</p>
        </div>
        <div className="acct-grow" />
        <div className="acct-actions">
          {APPLE_SIGN_IN_ENABLED ? (
            <Button variant="secondary" size={52} block data-account-apple onClick={() => void oauth("apple")}>
              Continue with Apple
            </Button>
          ) : null}
          {GOOGLE_SIGN_IN_ENABLED ? (
            <Button variant="secondary" size={52} block data-account-google onClick={() => void oauth("google")}>
              Continue with Google
            </Button>
          ) : null}
          <Button variant="secondary" size={52} block data-account-email onClick={() => go("email")}>
            <Icon name="send" size={20} /> Continue with email
          </Button>
          {error ? <p className="acct-error" role="alert">{error}</p> : null}
          <p className="acct-small">
            By continuing you agree to the <a href="/terms" className="acct-inline-link">terms</a>. New or returning, the same
            buttons work.
          </p>
        </div>
      </>,
      { screen: "signin", striped: true },
    );

  async function oauth(provider: "google" | "apple") {
    setError(null);
    const auth = await import("@/lib/account/auth");
    const res = provider === "google" ? await auth.startGoogle("sign-up") : await auth.startApple("sign-up");
    if (!res.ok) setError(res.message);
  }

  if (step === "email")
    return page(
      <>
        <AccountHead title="Continue with email" onBack={back} />
        <h1 className="acct-h1" data-wrap-ok>What’s your email?</h1>
        <p className="acct-lede">We’ll send a link and a code to sign in. No password to remember.</p>
        <form
          className="acct-field"
          onSubmit={(e) => {
            e.preventDefault();
            void sendEmail();
          }}
        >
          <label htmlFor="account-email" className="acct-label">
            <span>Email</span>
          </label>
          <Input
            id="account-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            maxLength={254}
            placeholder="you@example.com"
            onChange={(e) => {
              setError(null);
              setEmail(e.target.value);
            }}
          />
          {error ? <p className="acct-error" role="alert">{error}</p> : null}
          <Button variant="gold" size={52} block type="submit" disabled={busy} data-account-send>
            {busy ? "Sending" : "Send link"}
          </Button>
        </form>
      </>,
      { screen: "email" },
    );

  if (step === "warn" && progress)
    return page(
      <>
        <AccountHead title="Sign in" onBack={back} />
        <h1 className="acct-h1" data-wrap-ok>This phone’s guest games stay here</h1>
        <p className="acct-lede">
          You’re signing in to an account you already have. What you played on this phone as a guest stays with the
          guest and won’t move to your account:
        </p>
        <Panel>
          {stayBehindLines(progress).map((line) => (
            <Row key={line} title={line} />
          ))}
        </Panel>
        <p className="acct-hint">Practice bests and stars on this phone stay on this phone whoever is signed in.</p>
        <div className="acct-grow" />
        <div className="acct-actions">
          <Button variant="gold" size={52} block data-account-warn-continue onClick={() => go("inbox")}>
            Continue
          </Button>
          <Button variant="quiet" size={48} block data-account-warn-cancel onClick={onDone}>
            Cancel
          </Button>
        </div>
      </>,
      { screen: "warn" },
    );

  if (step === "inbox")
    return page(
      <>
        <AccountHead title="Continue with email" onBack={back} />
        <InboxPanel
          email={email.trim()}
          busy={busy}
          error={error}
          onCode={(code) => void submitCode(code)}
          onResend={async () => {
            setError(null);
            const res = mode === "sign-up" ? await sendSignUpEmail(email.trim()) : await sendSignInEmail(email.trim());
            if (!res.ok) setError(res.message);
          }}
          onDifferent={() => {
            setHistory([]);
            setStep("email");
            setError(null);
          }}
        />
      </>,
      { screen: "inbox" },
    );

  if (step === "username")
    return (
      <UsernameStep
        page={page}
        username={username}
        colour={colour}
        error={error}
        suggestions={nameSuggestions}
        onBack={incomplete ? onDone : back}
        onUsername={(v) => {
          setError(null);
          setNameSuggestions([]);
          setUsername(v);
        }}
        onColour={setColour}
        onContinue={() => go("birthday")}
      />
    );

  if (step === "birthday")
    return page(
      <>
        <AccountHead title="Create your player" onBack={back} />
        <StepBar step={2} />
        <h1 className="acct-h1" data-wrap-ok>When’s your birthday?</h1>
        <p className="acct-lede">It’s never shown to other players.</p>
        <div className="acct-dob">
          <DobSelect id="dob-day" label="Day" value={dob.d} onChange={(d) => setDob((x) => ({ ...x, d }))} options={range(1, 31).map((n) => [String(n), String(n)])} />
          <DobSelect id="dob-month" label="Month" value={dob.m} onChange={(m) => setDob((x) => ({ ...x, m }))} options={MONTHS.map((name, i) => [String(i + 1), name.slice(0, 3)])} />
          <DobSelect
            id="dob-year"
            label="Year"
            value={dob.y}
            onChange={(y) => setDob((x) => ({ ...x, y }))}
            options={range(1900, new Date().getFullYear()).reverse().map((n) => [String(n), String(n)])}
          />
        </div>
        {error ? <p className="acct-error" role="alert">{error}</p> : null}
        <div className="acct-centre">
          <Captain pose="ready" size={64} />
        </div>
        <div className="acct-grow" />
        <Button variant="gold" size={58} block disabled={busy || !dateOfBirth} data-account-dob-continue onClick={() => void submitBirthday()}>
          {busy ? "Saving" : "Continue"}
        </Button>
      </>,
      { screen: "birthday" },
    );

  if (step === "under13")
    return page(
      <>
        <AccountHead onBack={onDone} backLabel="Back to playing" />
        <div className="acct-grow" />
        <div className="acct-centre" data-account-under13>
          <Captain pose="ready" size={110} />
          <h1 className="acct-h1" data-wrap-ok>Thanks for telling us</h1>
          <p className="acct-lede">{UNDER_13_MESSAGE}</p>
        </div>
        <div className="acct-grow" />
        <Button variant="gold" size={58} block onClick={onDone}>
          Keep playing
        </Button>
      </>,
      { screen: "under13" },
    );

  if (step === "deleting" && done)
    return page(
      <>
        <AccountHead onBack={onDone} />
        <div className="acct-grow" />
        <div className="acct-centre" data-account-deleting>
          <Captain pose="ready" size={96} />
          <h1 className="acct-h1" data-wrap-ok>Your account is set to be deleted</h1>
          <p className="acct-lede">
            {`${done.username} will be removed on ${dayText(deletion?.purgeAt ?? done.deletion?.purgeAt ?? "")}. Keep it, and nothing is removed.`}
          </p>
        </div>
        {error ? <p className="acct-error" role="alert">{error}</p> : null}
        <div className="acct-grow" />
        <div className="acct-actions">
          <Button
            variant="gold"
            size={58}
            block
            disabled={busy}
            data-account-cancel-deletion
            onClick={async () => {
              setBusy(true);
              try {
                const { cancelAccountDeletionFn } = await import("@/lib/account/account.functions");
                const res = (await cancelAccountDeletionFn()) as AccountView | { ok: false; message: string };
                if ("ok" in res) return setError(res.message);
                setAccount(res, email.trim() || null);
                setDone(res);
                setWelcomeBack(true);
                setStep("welcome");
              } finally {
                setBusy(false);
              }
            }}
          >
            Keep my account
          </Button>
          <Button
            variant="quiet"
            size={48}
            block
            onClick={async () => {
              const { signOutAccount } = await import("@/lib/account/accountApi");
              await signOutAccount();
              onDone();
            }}
          >
            Sign out
          </Button>
        </div>
      </>,
      { screen: "deleting" },
    );

  if (step === "welcome" && done)
    return page(
      <>
        {welcomeBack ? null : <StepBar step={3} />}
        <div className="acct-centre">
          <p className="acct-kicker">{welcomeBack ? "Signed in" : "You’re in"}</p>
          <h1 className="acct-h1" data-wrap-ok>
            {welcomeBack ? "Welcome back," : "Welcome,"}
            <br />
            {done.username}
          </h1>
        </div>
        <PlayerCard
          username={done.username}
          colour={done.colour}
          sub={done.founding ? "Founding Player" : "New player"}
        />
        <Panel>
          <Row
            data-account-number
            leading={done.founding ? <img src={FOUNDING_BADGE_URL} alt="" aria-hidden="true" width={40} height={40} className="acct-founder" /> : <Icon name="profile" size={24} tone="gold" />}
            title={done.founding ? "Founding Player" : "Player"}
          >
            <span className="acct-number">{playerNumberText(done.playerNumber)}</span>
          </Row>
        </Panel>
        <div className="acct-grow" />
        <Button variant="gold" size={58} block data-account-done onClick={onDone}>
          Back to playing
        </Button>
      </>,
      { screen: "welcome", striped: true },
    );

  return page(<AccountHead onBack={onDone} />, { screen: "loading" });
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export function dayText(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function DobSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="acct-field">
      <label htmlFor={id} className="acct-label">
        <span>{label}</span>
      </label>
      <select id={id} className="acct-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          {label === "Year" ? "YYYY" : label === "Day" ? "DD" : "MM"}
        </option>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function InboxPanel({
  email,
  busy,
  error,
  onCode,
  onResend,
  onDifferent,
}: {
  email: string;
  busy: boolean;
  error: string | null;
  onCode: (code: string) => void;
  onResend: () => Promise<void>;
  onDifferent: () => void;
}) {
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(RESEND_AFTER_S);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const digits = code.replace(/\D/g, "").slice(0, 6);
  return (
    <>
      <Panel pad className="acct-centre">
        <span className="acct-mail-disc">
          <Icon name="send" size={24} />
        </span>
        <h1 className="jz-screen-title">Check your inbox</h1>
        <p className="acct-lede">
          We sent a link and a code to <b className="acct-number">{email}</b>. Tap the link or type the code.
        </p>
      </Panel>
      <form
        className="acct-field"
        onSubmit={(e) => {
          e.preventDefault();
          if (digits.length === 6) onCode(digits);
        }}
      >
        <label htmlFor="account-code" className="acct-label">
          <span>6-digit code</span>
        </label>
        <Input
          id="account-code"
          className="acct-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={digits}
          placeholder="000000"
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            if (next.length === 6 && !busy) onCode(next);
          }}
        />
        {error ? <p className="acct-error" role="alert">{error}</p> : null}
        <Button variant="gold" size={52} block type="submit" disabled={busy || digits.length !== 6} data-account-verify>
          {busy ? "Checking" : "Continue"}
        </Button>
      </form>
      <div className="acct-linkrow">
        <Button
          variant="quiet"
          size={44}
          disabled={left > 0}
          data-account-resend
          onClick={() => {
            setLeft(RESEND_AFTER_S);
            void onResend();
          }}
        >
          {left > 0 ? `Resend in 0:${String(left).padStart(2, "0")}` : "Resend"}
        </Button>
        <Button variant="quiet" size={44} onClick={onDifferent} data-account-different>
          Use a different email
        </Button>
      </div>
    </>
  );
}

function UsernameStep({
  page,
  username,
  colour,
  error,
  suggestions,
  onBack,
  onUsername,
  onColour,
  onContinue,
}: {
  page: (body: React.ReactNode, opts: { striped?: boolean; screen: string }) => React.ReactNode;
  username: string;
  colour: number;
  error: string | null;
  suggestions: string[];
  onBack: () => void;
  onUsername: (v: string) => void;
  onColour: (c: number) => void;
  onContinue: () => void;
}) {
  const check = useUsernameCheck(username);
  const shown = check.state === "refused" ? check.suggestions : suggestions;
  const message = check.state === "refused" ? check.message : error;
  return (
    <>
      {page(
        <>
          <AccountHead title="Create your player" onBack={onBack} />
          <StepBar step={1} />
          <h1 className="acct-h1" data-wrap-ok>Choose a username</h1>
          <p className="acct-lede">Your name in rooms, Dailies and leaderboards.</p>
          <div className="acct-field">
            <label htmlFor="account-username" className="acct-label">
              <span>Username</span>
            </label>
            <div className="acct-input-wrap">
              <Input
                id="account-username"
                value={username}
                maxLength={USERNAME_MAX}
                autoCapitalize="none"
                autoComplete="username"
                spellCheck={false}
                placeholder="Username"
                onChange={(e) => onUsername(e.target.value.replace(/\s/g, ""))}
              />
              <UsernameState check={check} />
            </div>
            {message ? (
              <p className="acct-error" role="alert" data-username-message>
                {message}
              </p>
            ) : (
              <p className="acct-hint">3-16 letters, numbers or underscores</p>
            )}
            <NameSuggestions names={shown} onPick={onUsername} />
          </div>
          <div className="acct-field">
            <p className="acct-label">
              <span>Your colour</span>
              <span>Change it any time</span>
            </p>
            <div className="acct-colours" role="radiogroup" aria-label="Your colour" data-account-colours>
              {PLAYER_COLOURS.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={i === colour}
                  aria-label={c.name}
                  className="acct-colour"
                  style={{ background: `var(--jz-player-${i})` }}
                  onClick={() => onColour(i)}
                />
              ))}
            </div>
          </div>
          <PlayerCard username={username.trim()} colour={colour} sub="New player" />
          <div className="acct-grow" />
          <Button variant="gold" size={58} block disabled={check.state !== "ok"} data-account-username-continue onClick={onContinue}>
            Continue
          </Button>
        </>,
        { screen: "username" },
      )}
    </>
  );
}
