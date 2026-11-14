import type { ReactNode } from "react";

import { Button, Icon } from "@/design/components";

/**
 * The header of Profile's own pages (Badges, the player card; the Profile session, phase 2 step 3): Back, the title in
 * the style guide's Title role (24 / 30, 800) and an optional quiet item on the right.
 */
export function ProfilePageHead({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="pf-head" data-profile-page-head>
      <span className="pf-head-title">
        <Button variant="icon" aria-label="Back" onClick={onBack} className="-ml-2.5">
          <Icon name="back" size={22} />
        </Button>
        <h1 data-ellipsis>{title}</h1>
      </span>
      {right ?? null}
    </header>
  );
}

/** Back from one of Profile's pages: the page before, or Profile when it was opened directly. */
export function backToProfile(router: { history: { back(): void }; navigate(opts: never): unknown }): void {
  if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
  else void router.navigate({ to: "/profile", replace: true } as never);
}
