import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AsyncRun } from "@/components/async/AsyncRun";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { TournamentEventScreen } from "@/components/tournaments/TournamentEvent";
import { Button } from "@/design/components";
import { APP_NAME } from "@/lib/brand";
import { useHomeBed } from "@/lib/useScreenMusic";
import { parseEventId } from "@/lib/tournaments/rules";

/** One tournament (wave 4, W4b): /tournament?id=arena:2026-11-20:1300. Accounts see entry; play opens from here. */
export const Route = createFileRoute("/tournament")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { id?: string } => {
    const id = typeof search["id"] === "string" && parseEventId(search["id"]) ? (search["id"] as string) : undefined;
    return id ? { id } : {};
  },
  head: () => ({ meta: [{ title: `${APP_NAME} tournament` }, { name: "robots", content: "noindex" }] }),
  component: TournamentPage,
});

function TournamentPage() {
  useHomeBed();
  const router = useRouter();
  const { id } = Route.useSearch();
  const [run, setRun] = useState<{ roomId: string; title: string } | null>(null);
  const back = () => void router.navigate({ to: "/tournaments" });
  if (run)
    return (
      <AsyncRun
        roomId={run.roomId}
        title={run.title}
        onDone={() => setRun(null)}
        leave={
          <Button variant="secondary" size={46} onClick={() => setRun(null)}>
            Back to the Score Attack
          </Button>
        }
      />
    );
  return (
    <OnlineOnly tabs="tournaments" live body="Tournaments need a connection.">
      <TournamentEventScreen
        eventId={id ?? ""}
        onBack={back}
        onRules={(kind) => void router.navigate({ to: "/tournament-rules", search: { kind: kind === "score_attack" || kind === "category_cup" || kind === "championship" ? kind : "arena" } })}
        onPlayScoreAttack={(roomId, title) => setRun({ roomId, title })}
      />
    </OnlineOnly>
  );
}
