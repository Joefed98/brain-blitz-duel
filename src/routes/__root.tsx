import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

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
import { ErrorState } from "../components/app/ErrorState";
import { AppWordmark } from "../components/brand/AppWordmark";
import { CelebrationLayer } from "../components/fx/CelebrationLayer";
import { celebrationsOn } from "../lib/fx/celebrations";
import { GOOGLE_FONTS_CSS } from "../lib/offline/assets";
import { installOfflinePractice } from "../lib/offline/install";
import { OFFLINE_BOOT } from "../lib/offline/online";

/** The 404 page: the shared error layout (ErrorState, Polish batch R) on the room screens' shell. */
function NotFoundComponent() {
  const navigate = useNavigate();
  return (
    // PhoneShell's page frame, drawn light (the root route never loads the game registry PhoneShell needs).
    <div data-skin="room" className="relative min-h-[100dvh] w-full bg-background">
      <div aria-hidden="true" className="screen-background" />
      <div data-shell-column="page" className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col pad-safe">
        <header className="ap-header">
          <AppWordmark />
        </header>
        <ErrorState
          title="Page not found"
          body={`This page isn’t part of ${APP_NAME}, or it has moved. Head back to Play, or start a room.`}
          action={{ label: "Create a room", onClick: () => void navigate({ to: "/" }) }}
        />
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    reportCrash(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn’t load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
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

  // The first tap anywhere unlocks audio (iOS only counts touchend/click).
  useEffect(() => installSoundUnlock(), []);
  // Battery saver (lib/battery.ts): marks <html data-battery-saver> from the device's setting.
  useEffect(() => void batterySaverOn(), []);
  // Named cues (docs/sound-cues) play their manifest file once one is set.
  useEffect(() => installSoundCueBridge(), []);

  // A stale copy of the app updates itself, never mid-round (lib/appUpdate).
  const router = useRouter();
  useEffect(
    () => installAppUpdater((path) => router.history.replace(path, router.history.location.state)),
    [router],
  );

  // Offline practice (lib/offline): the service worker, the queued runs' grading and the practice packs.
  useEffect(() => installOfflinePractice(), []);

  // Celebrations' shared overlay (lib/fx/celebrations.ts), only while FX_CELEBRATIONS is on.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => setCelebrate(celebrationsOn()), []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AppUpdateOverlay />
      {celebrate ? <CelebrationLayer /> : null}
    </QueryClientProvider>
  );
}
