/**
 * The Season pass as theme-check and no-wrap-check draw it (13 Nov 2026, docs/cosmetics-review): a tester at level 30
 * with the premium track, the levels as the server builds them, with the review's withdrawn items as gaps ("Being
 * redrawn", no item named), so the gap rows are measured at every size. Data only (no server).
 */
import { readFileSync } from "node:fs";

import { rewardAt, rewardLabel, reached } from "../src/lib/pass/rewards";
import type { PassCell, PassView } from "../src/lib/pass/types";

const CATALOGUE = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: { id: string; kind: string; name: string; rarity: string | null }[] }).items;
const VERDICTS = JSON.parse(readFileSync("docs/cosmetics-review/verdicts.json", "utf8")) as Record<string, string>;

export const PASS_FIXTURE_ACCOUNT = { kind: "account", userId: "u-pass", username: "SkyRacer", colour: 4, playerNumber: 42, founding: false, country: null, createdAt: "2026-11-10T12:00:00.000Z", status: "active", isUnder18: false, deletion: null };

export function passFixture(level = 30, premium = true): PassView {
  const cell = (track: "free" | "premium", l: number): PassCell | null => {
    const r = rewardAt(track, l);
    if (!r) return null;
    const item = r.kind === "item" ? CATALOGUE.find((i) => i.id === r.item) : undefined;
    const claimed = l <= 4;
    if (item && VERDICTS[item.id] !== "Keep" && !claimed)
      return { track, level: l, kind: "item", title: "Being redrawn", detail: "This reward returns once it’s redrawn", rarity: null, itemId: null, itemKind: null, state: "withdrawn", needsPremium: track === "premium" && !premium };
    const label = rewardLabel(r, item?.name);
    return {
      track,
      level: l,
      kind: r.kind,
      title: label.title,
      detail: label.detail,
      rarity: item?.rarity ? item.rarity.toLowerCase() : null,
      itemId: item?.id ?? null,
      itemKind: item?.kind ?? null,
      state: claimed ? "claimed" : reached(track, l, level, premium) ? "claimable" : "locked",
      needsPremium: track === "premium" && !premium,
    };
  };
  const levels = Array.from({ length: 60 }, (_, i) => ({ level: i + 1, free: cell("free", i + 1), premium: cell("premium", i + 1) }));
  return {
    open: true,
    season: { id: "test", name: "Neon Circuit", test: true, endsAt: null, daysLeft: null, ended: false },
    joules: level * 1000 + 430,
    level,
    into: 430,
    of: 1000,
    premium: premium ? { source: "test" } : null,
    tester: true,
    levels,
    claimable: levels.reduce((n, l) => n + (l.free?.state === "claimable" ? 1 : 0) + (l.premium?.state === "claimable" ? 1 : 0), 0),
    weekly: {
      weekStart: "2026-11-16",
      challenges: [
        { id: "e1", tier: "easy", text: "Play the Daily Puzzle on 3 different days", joules: 500, done: 2, need: 3, completed: false },
        { id: "m2", tier: "medium", text: "Earn a star in any game", joules: 750, done: 1, need: 1, completed: true },
        { id: "h1", tier: "hard", text: "Score 180+ in 3 different Logic games", joules: 1250, done: 0, need: 3, completed: false },
      ],
    },
    levelNotice: null,
  };
}
