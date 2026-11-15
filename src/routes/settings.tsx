import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AccountDeleted } from "@/components/account/AccountSettings";
import { Onboarding } from "@/components/duel/Onboarding";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { SettingsBody, SettingsHead } from "@/components/settings/SettingsPage";
import { APP_NAME } from "@/lib/brand";
import { useHomeBed } from "@/lib/useScreenMusic";

/**
 * /settings (the Settings, account and onboarding session, phase 2 step 3, 14 Nov 2026): every setting on one page,
 * in place of the settings sheet. Opened from More → Settings, Profile's gear and the computer rail's gear. How it
 * works opens the first-time intro over the page; Back returns to wherever Settings was opened from (More when it was
 * opened directly).
 */
/** `?section=notifications` (Home's bell): Settings opens scrolled to that group. */
const SECTIONS = { notifications: "[data-push-settings]" } as const;

export const Route = createFileRoute("/settings")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { section?: keyof typeof SECTIONS } =>
    search["section"] === "notifications" ? { section: "notifications" } : {},
  head: () => ({
    meta: [
      { title: `${APP_NAME} settings` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsRoute,
});

/** Back from Settings: the page before, or More when Settings was opened directly. */
export function backFromSettings(router: { history?: { back(): void }; navigate(opts: never): unknown }): void {
  if (typeof window !== "undefined" && window.history.length > 1 && router.history) router.history.back();
  else void router.navigate({ to: "/more", replace: true } as never);
}

function SettingsRoute() {
  useHomeBed();
  const router = useRouter();
  const [intro, setIntro] = useState(false);
  const [deleted, setDeleted] = useState<string | null>(null);
  const back = () => backFromSettings(router as never);
  const section = Route.useSearch().section;
  useEffect(() => {
    if (!section) return;
    const frame = requestAnimationFrame(() => document.querySelector(SECTIONS[section])?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [section]);
  if (intro) return <Onboarding onDone={() => setIntro(false)} />;
  if (deleted) return <AccountDeleted purgeAt={deleted} onBack={() => void router.navigate({ to: "/" })} />;
  return <SettingsScreen onBack={back} onHowItWorks={() => setIntro(true)} router={router} onDeleted={setDeleted} />;
}

export function SettingsScreen({
  onBack,
  onHowItWorks,
  onDeleted,
  router,
}: {
  onBack: () => void;
  onHowItWorks: () => void;
  onDeleted: (purgeAt: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <PhoneShell skin="profile" bare>
      <div className="st-page" data-settings-page>
        <SettingsHead onBack={onBack} />
        <SettingsBody
          onHowItWorks={onHowItWorks}
          onTerms={() => void router.navigate({ to: "/terms", state: { fromPlayTab: true } as never })}
          onSignIn={() => void router.navigate({ to: "/account", search: { from: "/settings" } })}
          onSignedOut={() => undefined}
          onDeleted={onDeleted}
        />
      </div>
    </PhoneShell>
  );
}
