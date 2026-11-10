import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AccountSettings } from "@/components/account/AccountSettings";
import { SignUpFlow, type FlowStep } from "@/components/account/SignUpFlow";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { SkeletonPage } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { APP_NAME } from "@/lib/brand";

/** Where the flow may open, from a link: `?start=email` (the save-progress sheet's email button). */
const STARTS: readonly FlowStep[] = ["signin", "email"];

/** Only paths inside the app (never another site) are allowed as the way back. */
function safeFrom(raw: unknown): string {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw.slice(0, 200) : "/";
}

export const Route = createFileRoute("/account")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { from?: string; start?: string } => ({
    ...(typeof search["from"] === "string" ? { from: search["from"] } : {}),
    ...(typeof search["start"] === "string" ? { start: search["start"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: `${APP_NAME} account` },
      { name: "description", content: `Sign in to ${APP_NAME}, or manage your account.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

/**
 * /account (wave 1 sign-up screens): a guest's sign-in and sign-up (S2–S6), or a signed-in player's Settings →
 * Account. Reached from the save-your-progress sheet and pop-up, Profile → settings → Account, and the "needs an
 * account" gate.
 */
function AccountPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const account = useAccount();
  // Once the flow has started it stays up (its welcome screen comes after the account exists).
  const [flow, setFlow] = useState<boolean | null>(null);
  const from = safeFrom(search.from);
  const done = () => void router.navigate({ to: from });

  if (account.kind === "unknown")
    return (
      <PhoneShell bare>
        <SkeletonPage label="Loading your account" />
      </PhoneShell>
    );
  const inFlow = flow ?? account.kind !== "account";
  if (flow === null && inFlow) setFlow(true);
  if (!inFlow && account.kind === "account") return <AccountSettings account={account} onBack={done} />;
  const start = STARTS.includes(search.start as FlowStep) ? (search.start as FlowStep) : "signin";
  return <SignUpFlow start={start} account={account} onDone={done} />;
}
