import { createFileRoute } from "@tanstack/react-router";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { EventScreen } from "@/components/tournaments/BigEvents";
import { APP_NAME } from "@/lib/brand";
import { useHomeBed } from "@/lib/useScreenMusic";

/**
 * The Joulz Championship's page (wave 4, W4c; docs/tournaments/events.md): entry, the live round, the
 * bracket, prizes and the rules. Behind its switch (src/config/tournamentEventsConfig.ts): while off it says
 * the event isn't running and calls nothing.
 */
export const Route = createFileRoute("/championship")({
  ssr: false,
  head: () => ({
    meta: [{ title: `Joulz Championship · ${APP_NAME}` }, { name: "robots", content: "noindex" }],
  }),
  component: Screen,
});

function Screen() {
  useHomeBed();
  return (
    <OnlineOnly tabs="tournaments" live body="Tournaments need a connection. Practice games are saved on this phone, so they still work.">
      <PhoneShell tabs="tournaments">
        <EventScreen kind="championship" />
      </PhoneShell>
    </OnlineOnly>
  );
}
