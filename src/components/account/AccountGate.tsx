/**
 * The "needs an account" gate (wave 1 sign-up screens), for wave 2's friends and shop and wave 4's tournaments:
 * an account sees `children`; a guest (or a sign-up left half-way) sees a plain card asking them to sign in, which
 * opens /account and comes back here. Nothing in wave 1 needs an account yet.
 *
 *   <AccountGate what="add friends">…the friends screen…</AccountGate>
 */
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { EmptyState, Skeleton } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";

export function AccountGate({
  what,
  children,
  layout = "page",
}: {
  /** What the account is needed for, as a verb phrase: "add friends", "enter tournaments". */
  what: string;
  children: ReactNode;
  layout?: "page" | "card";
}) {
  const account = useAccount();
  const navigate = useNavigate();
  if (account.kind === "account") return <>{children}</>;
  if (account.kind === "unknown") return <Skeleton kind="card" />;
  const from = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
  return (
    <EmptyState
      data-account-gate=""
      layout={layout}
      heading={layout === "page" ? 1 : 2}
      title="Sign in first"
      body={`You need an account to ${what}. It’s free and keeps your progress on every phone.`}
      action={{ label: "Sign in", onClick: () => void navigate({ to: "/account", search: { from } }) }}
      gold
    />
  );
}
