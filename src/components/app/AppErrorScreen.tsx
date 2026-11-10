import { useEffect, type ReactNode } from "react";

import { AppWordmark } from "@/components/brand/AppWordmark";
import { APP_NAME } from "@/lib/brand";
import { EmptyState } from "@/design/components";

import { ErrorState } from "./ErrorState";

/**
 * The root route's two screens (wave 1, first impressions, 10 Nov 2026; docs/mockups/wave-1/X2 and X3):
 * the general not-found page and the error boundary's "That one’s on us". Drawn on a light page frame of
 * their own, since the root route never loads the game registry PhoneShell needs.
 */

/** PhoneShell's page frame, drawn light: the wordmark header and a centred column. */
export function RootPageFrame({ children }: { children: ReactNode }) {
  return (
    <div data-skin="room" className="jz-root-page">
      <div aria-hidden="true" className="screen-background" />
      <div data-shell-column="page" className="jz-root-column pad-safe">
        <header className="ap-header">
          <AppWordmark />
        </header>
        {children}
      </div>
    </div>
  );
}

/** The 404 page (X2). */
export function NotFoundPage() {
  return (
    <RootPageFrame>
      <ErrorState title="Nothing here" body={`That page doesn’t exist in ${APP_NAME}, or it’s moved.`} />
    </RootPageFrame>
  );
}

/**
 * The short code an error screen records (lib/analytics `error_shown`): never the error's text, stack or
 * anything personal. `chunk_load` when a newer build removed a file this page still asks for (a refresh
 * fixes it), else `page_error`.
 */
export function errorCodeFor(error: unknown): "chunk_load" | "page_error" {
  const message = error instanceof Error ? `${error.name} ${error.message}` : "";
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message)
    ? "chunk_load"
    : "page_error";
}

/**
 * The error boundary's screen (X3): Refresh (the route again, as the old Try again did) or Back home (a
 * full page load of Play, so nothing broken carries over). Records `error_shown` with its short code once.
 */
export function RouteErrorScreen({ error, onRefresh }: { error: unknown; onRefresh: () => void }) {
  useEffect(() => {
    const code = errorCodeFor(error);
    void import("@/lib/analytics/clientEvents").then(({ trackClientEvent }) => trackClientEvent("error_shown", { props: { code } }));
  }, [error]);
  return (
    <RootPageFrame>
      <EmptyState
        data-error-boundary
        heading={1}
        pose="ready"
        tone="alert"
        title="That one’s on us"
        body="Something broke on our side. Refresh, or head back home."
        action={{ label: "Refresh", onClick: onRefresh, data: { "data-error-refresh": "" } }}
        secondary={{ label: "Back home", href: "/", data: { "data-error-home": "" } }}
      />
    </RootPageFrame>
  );
}
