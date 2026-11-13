/**
 * The rules page per format (wave 4, W4b): plain words, marked as a draft until the legal adviser's note on coin
 * tournaments is in (the build plan's wave 4 decisions). The numbers come from src/config/tournamentConfig.ts, so
 * the page always says what the server does.
 */
import { AccountHead } from "@/components/account/AccountParts";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { Panel, SectionHeader } from "@/design/components";
import {
  ARENA_MIN_ENTRANTS,
  ARENA_TIMES_UK,
  ARENA_WINDOW_MIN,
  SCORE_ATTACK_COINS,
  SCORE_ATTACK_ROUNDS,
} from "@/config/tournamentConfig";
import { KIND_LABEL, placeLabel, prizeLines, type TournamentKind } from "@/lib/tournaments/rules";

const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export function rulesFor(kind: TournamentKind): { title: string; lines: string[] }[] {
  const prizes = prizeLines(kind)
    .map((p) => `${placeLabel(p.from, p.to)}: ${p.coins.toLocaleString("en-GB")} coins${p.trophy ? ` and a ${p.trophy} trophy` : ""}, paid with ${p.minEntrants} or more entrants.`);
  const common = [
    { title: "Prizes", lines: [...prizes, "Prizes and trophies are fixed by Joulz. Entry fees are never pooled into prizes.", "Prizes are paid once, to your account, when the event finishes."] },
    {
      title: "Fair play",
      lines: [
        "Accounts only, one entry per person.",
        "Every score is the server’s own: the same games and the same deals for everyone.",
        "Tournaments never change your rating.",
        "Chat follows the rules for players who don’t know each other: under-18s and guests pick quick phrases.",
      ],
    },
  ];
  if (kind === "arena")
    return [
      {
        title: "How it works",
        lines: [
          `Every day at ${ARENA_TIMES_UK.map(time12).join(" and ")} UK time. Free to enter.`,
          `For ${ARENA_WINDOW_MIN} minutes you can start back-to-back best-of-3 duels against other entrants near your level. A duel started in time is played to its end.`,
          "Win 2 points a duel. After two wins in a row, each win counts double until the streak breaks. A loss or a draw scores nothing and ends the streak.",
          "Most points wins. Level on points: more duel wins, then the higher total score, then whoever got there first.",
          `It starts only with ${ARENA_MIN_ENTRANTS} or more entrants; otherwise it’s called off and we tell you when the next one is.`,
        ],
      },
      ...common,
    ];
  return [
    {
      title: "How it works",
      lines: [
        "One a day, open for 24 hours from midnight UK time.",
        `Enter for ${SCORE_ATTACK_COINS} coins or a Score Attack ticket (a Category Cup ticket works too while the Category Cup is off).`,
        `Everyone plays the same ${SCORE_ATTACK_ROUNDS} games from the day’s featured category, once each.`,
        "Highest total wins; a faster total time breaks a tie. Any number of players.",
        "If it doesn’t run, every entry is refunded in full.",
      ],
    },
    ...common,
  ];
}

export function TournamentRulesScreen({ kind, onBack }: { kind: TournamentKind; onBack: () => void }) {
  return (
    <PhoneShell bare skin="tournaments">
      <div className="tn-page" data-tournament-rules-page={kind}>
        <AccountHead title={`${KIND_LABEL[kind]} rules`} onBack={onBack} />
        <h1 className="tn-title">{`${KIND_LABEL[kind]} rules`}</h1>
        <p className="tn-draft" data-rules-draft>
          Draft: these rules may change before tournaments open to everyone.
        </p>
        {rulesFor(kind).map((s) => (
          <section key={s.title} aria-label={s.title} className="ap-section">
            <SectionHeader title={s.title} />
            <Panel pad>
              <ul className="tn-how">
                {s.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Panel>
          </section>
        ))}
      </div>
    </PhoneShell>
  );
}
