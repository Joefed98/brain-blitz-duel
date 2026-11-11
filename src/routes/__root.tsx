import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { installGameLookSource } from "@/lib/identity/gameLooks";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ensureSession } from "../lib/duel/session";
import { noteShareArrival } from "../lib/share/shareRef";
import { PLAY_CARDS_BOOT } from "../lib/playCards";
import { installSoundCueBridge, installSoundUnlock } from "../lib/sound";
import { batterySaverOn } from "../lib/battery";
import { BRAND_INK } from "../components/brand/logoGeometry";
import { APP_DESCRIPTION, APP_ICONS, APP_NAME, APP_SPLASHES, APP_TITLE, canonicalUrl, LINK_PREVIEW } from "../lib/brand";
import { installAppUpdater } from "../lib/appUpdate";
import { reportCrash, startCrashReporting } from "../lib/crashReporting";
import { THEME_FONTS } from "../lib/theme";
import { AppUpdateOverlay } from "../components/app/AppUpdateOverlay";
import { NotFoundPage, RouteErrorScreen } from "../components/app/AppErrorScreen";
import { CelebrationLayer } from "../components/fx/CelebrationLayer";
import { SafetyNotices } from "../components/safety/SafetyNotices";
import { FriendsPresence } from "../components/friends/FriendsPresence";
import { celebrationsOn } from "../lib/fx/celebrations";
import { GOOGLE_FONTS_CSS } from "../lib/offline/assets";
import { installOfflinePractice } from "../lib/offline/install";
import { pushPublicKey } from "../config/pushConfig";
import { OFFLINE_BOOT } from "../lib/offline/online";
import { decideFirstOpen } from "../lib/firstOpen";

/** The first-open onboarding (lib/firstOpen.ts), loaded only on the open that shows it. */
const FirstOpen = lazy(() => import("../components/app/FirstOpen"));

/** The 404 page (wave 1, X2): AppErrorScreen.tsx's NotFoundPage on its own light page frame. */
function NotFoundComponent() {
  return <NotFoundPage />;
}

/**
 * The error boundary (wave 1, X3): reports the error as before, and shows "That one’s on us" (RouteErrorScreen,
 * which records `error_shown` with a short code, never the error's text or stack).
 */
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    reportCrash(error);
  }, [error]);
  return (
    <RouteErrorScreen
      error={error}
      onRefresh={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_TITLE },
      {
        name: "description",
        content: APP_DESCRIPTION,
      },
      // The link preview (LINK_PREVIEW, src/lib/brand.ts): absolute URLs on the published site.
      { property: "og:title", content: LINK_PREVIEW.title },
      { property: "og:description", content: LINK_PREVIEW.description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:url", content: LINK_PREVIEW.url },
      { property: "og:image", content: LINK_PREVIEW.image },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: String(LINK_PREVIEW.imageWidth) },
      { property: "og:image:height", content: String(LINK_PREVIEW.imageHeight) },
      { property: "og:image:alt", content: LINK_PREVIEW.imageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: LINK_PREVIEW.title },
      { name: "twitter:description", content: LINK_PREVIEW.description },
      { name: "twitter:image", content: LINK_PREVIEW.image },
      { name: "twitter:image:alt", content: LINK_PREVIEW.imageAlt },
      { name: "theme-color", content: BRAND_INK },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // The page skin's self-hosted fonts (polish-layout/theme.css), fetched with the stylesheet.
      ...THEME_FONTS.map((href) => ({
        rel: "preload",
        href,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      })),
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: GOOGLE_FONTS_CSS,
      },
      // The app's icons (Prompt R; F4): the black logo mark on the ring-gold metal (scripts/brand-icons.ts).
      ...APP_ICONS.filter((icon) => icon.use === "favicon").map((icon) => ({
        rel: "icon",
        href: icon.href,
        type: "image/png",
        sizes: `${icon.size}x${icon.size}`,
      })),
      { rel: "apple-touch-icon", href: APP_ICONS.find((icon) => icon.use === "apple-touch-icon")!.href, sizes: "180x180" },
      // The home-screen app's launch screens (F4): the gold bolt on --jz-bg, one per iPhone screen.
      ...APP_SPLASHES.map((splash) => ({ rel: "apple-touch-startup-image", href: splash.href, media: splash.media })),
      { rel: "manifest", href: "/manifest.webmanifest" },
      // The canonical address: this page's path on APP_URL (src/config/appUrl.ts), never a query
      // string, so the redirecting domains and preview hosts all point search engines at joulz.uk.
      { rel: "canonical", href: canonicalUrl(matches[matches.length - 1]?.pathname ?? "/") },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Before the first paint: which late Play tab cards to reserve (lib/playCards.ts). */}
        <script dangerouslySetInnerHTML={{ __html: PLAY_CARDS_BOOT }} />
        {/* Before the first paint: the offline banner and Practice's install card (lib/offline/online.ts). */}
        <script dangerouslySetInnerHTML={{ __html: OFFLINE_BOOT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** A home-screen app (iOS's navigator.standalone or display-mode standalone), for the app_opened event only. */
function isStandaloneApp(): boolean {
  try {
    return (
      (navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches === true
    );
  } catch {
    return false;
  }
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Crash reporting (lib/crashReporting.ts): only when SENTRY_DSN is set in src/config/betaConfig.ts.
  useEffect(() => {
    startCrashReporting();
  }, []);

  // Every device signs in anonymously so it has a real identity of its own.
  useEffect(() => {
    void ensureSession().catch(() => {
      /* retried on the next action that needs it */
    });
  }, []);

  // Beta count: an arrival from a shared link (?ref=share), once per device (lib/share/shareRef).
  useEffect(() => {
    noteShareArrival(window.location);
  }, []);

  // Analytics (lib/analytics/clientEvents.ts): one app_opened a page load, sent in the background; also sends
  // anything queued while offline.
  useEffect(() => {
    void import("../lib/analytics/clientEvents").then(({ trackClientEvent }) =>
      trackClientEvent("app_opened", { props: { standalone: isStandaloneApp() } }),
    );
  }, []);

  // The first tap anywhere unlocks audio (iOS only counts touchend/click).
  useEffect(() => installSoundUnlock(), []);
  // Battery saver (lib/battery.ts): marks <html data-battery-saver> from the device's setting.
  useEffect(() => void batterySaverOn(), []);
  // Named cues (docs/sound-cues) play their manifest file once one is set.
  useEffect(() => installSoundCueBridge(), []);
  // Game skins and world themes (wave 2): the live stages read the player's own equipped ones through A1's loadout.
  useEffect(() => installGameLookSource(), []);

  // A stale copy of the app updates itself, never mid-round (lib/appUpdate).
  const router = useRouter();
  useEffect(
    () => installAppUpdater((path) => router.history.replace(path, router.history.location.state)),
    [router],
  );

  // Offline practice (lib/offline): the service worker, the queued runs' grading and the practice packs.
  useEffect(() => installOfflinePractice(), []);

  // Phone notifications (lib/push, B2): nothing at all while the switch is off; else, for an account, the device's
  // subscription kept fresh and a tap that opened the app recorded.
  useEffect(() => {
    if (!pushPublicKey()) return;
    void (async () => {
      const { syncPushOnOpen } = await import("../lib/push/pushClient");
      const { refreshAccount } = await import("../lib/account/accountApi");
      const account = await refreshAccount();
      await syncPushOnOpen(account.kind === "account");
    })().catch(() => {});
  }, []);

  // Celebrations' shared overlay (lib/fx/celebrations.ts), only while FX_CELEBRATIONS is on.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => setCelebrate(celebrationsOn()), []);

  // The first-open onboarding (lib/firstOpen.ts; off until wave 3): decided on the first render in the
  // browser, before any page marks the first-time intro seen, then shown after hydration.
  const firstOpenWanted = useRef<boolean | null>(null);
  if (firstOpenWanted.current === null && typeof window !== "undefined")
    firstOpenWanted.current = decideFirstOpen(window.location);
  const [firstOpen, setFirstOpen] = useState(false);
  useEffect(() => {
    if (firstOpenWanted.current) setFirstOpen(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AppUpdateOverlay />
      {celebrate ? <CelebrationLayer /> : null}
      {/* Safety (10 Nov 2026, docs/moderation.md): a warning, ban or forced rename on open; nothing otherwise. */}
      <SafetyNotices />
      <FriendsPresence />
      {firstOpen ? (
        <Suspense fallback={null}>
          <FirstOpen
            onDone={() => setFirstOpen(false)}
            onPlay={() => {
              // Until the rated match exists (wave 3): the first warm-up game in Practice.
              void import("../lib/duel/practiceRecent").then(({ warmUpTypes }) => {
                const first = warmUpTypes([])[0];
                void router.navigate({ to: "/practice", search: (first ? { game: first } : {}) as never });
              });
            }}
            onFriends={() => void router.navigate({ to: "/" })}
          />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  );
}
