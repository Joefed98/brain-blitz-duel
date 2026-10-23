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
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ensureSession } from "../lib/duel/session";
import { noteShareArrival } from "../lib/share/shareRef";
import { PLAY_CARDS_BOOT } from "../lib/playCards";
import { installSoundCueBridge, installSoundUnlock } from "../lib/sound";
import { APP_DESCRIPTION, APP_ICONS, APP_NAME, APP_TITLE } from "../lib/brand";
import { installAppUpdater } from "../lib/appUpdate";
import { THEME_FONTS } from "../lib/theme";
import { AppUpdateOverlay } from "../components/app/AppUpdateOverlay";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_TITLE },
      {
        name: "description",
        content: APP_DESCRIPTION,
      },
      { property: "og:title", content: APP_TITLE },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#0B0B0F" },
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
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;700&family=Press+Start+2P&display=swap",
      },
      // The app's icons (Prompt R): the inverted logo mark on the gold shine (scripts/brand-icons.ts).
      ...APP_ICONS.filter((icon) => icon.use === "favicon").map((icon) => ({
        rel: "icon",
        href: icon.href,
        type: "image/png",
        sizes: `${icon.size}x${icon.size}`,
      })),
      { rel: "apple-touch-icon", href: APP_ICONS.find((icon) => icon.use === "apple-touch-icon")!.href, sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
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
  // Named cues (docs/sound-cues) play their manifest file once one is set.
  useEffect(() => installSoundCueBridge(), []);

  // A stale copy of the app updates itself, never mid-round (lib/appUpdate).
  const router = useRouter();
  useEffect(
    () => installAppUpdater((path) => router.history.replace(path, router.history.location.state)),
    [router],
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AppUpdateOverlay />
    </QueryClientProvider>
  );
}
