import { createFileRoute, useRouter } from "@tanstack/react-router";

import { TournamentRulesScreen } from "@/components/tournaments/TournamentRules";
import { APP_NAME } from "@/lib/brand";
import { TOURNAMENT_KINDS_ON } from "@/config/tournamentConfig";

/** The rules of a tournament format (wave 4, W4b): /tournament-rules?kind=arena | score_attack. A draft for now. */
export const Route = createFileRoute("/tournament-rules")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { kind: "arena" | "score_attack" | "category_cup" | "championship" } => {
    const k = search["kind"];
    // W4c's two kinds only while switched on.
    if ((k === "category_cup" || k === "championship") && TOURNAMENT_KINDS_ON[k]) return { kind: k };
    return { kind: k === "score_attack" ? "score_attack" : "arena" };
  },
  head: () => ({ meta: [{ title: `${APP_NAME} tournament rules` }, { name: "robots", content: "noindex" }] }),
  component: RulesPage,
});

function RulesPage() {
  const router = useRouter();
  const { kind } = Route.useSearch();
  return <TournamentRulesScreen kind={kind} onBack={() => router.history.back()} />;
}
