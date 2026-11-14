import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button, Icon } from "@/design/components";

/**
 * Play's and Rooms' header (phase 2 step 3, 14 Nov 2026; mockups phone/play.png): Back on the left, the page's one
 * h1 centred. Back returns one screen when this page was pushed (from Home, Games or Play), else goes Home.
 */
export function SubPageHeader({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  const back = () => {
    const state = (router.history?.location?.state ?? {}) as { fromPlayTab?: boolean };
    if (state.fromPlayTab) router.history.back();
    else void router.navigate({ to: "/", replace: true });
  };
  return (
    <header className="hp-subhead" data-subpage-header>
      <Button variant="icon" aria-label="Back" onClick={back} className="hp-subhead-back">
        <Icon name="back" size={22} />
      </Button>
      <h1 data-page-title className="hp-subhead-title">
        {title}
      </h1>
      <span className="hp-subhead-right">{right ?? null}</span>
    </header>
  );
}

/** Opens one of Play's destinations, pushed so Back returns here. */
export function pushFrom(router: ReturnType<typeof useRouter>, to: string, search?: Record<string, string>): void {
  void router.navigate({ to: to as never, ...(search ? { search: search as never } : {}), state: { fromPlayTab: true } as never });
}
