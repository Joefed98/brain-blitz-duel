/**
 * The Pass screen's stand-in for the screen harness (theme-check and no-wrap-check through PASS_SCREENS in
 * theme-screens.ts; Joules rework, 13 Nov 2026): a tester's pass at level 12 drawn by the app's own PassScreen inside
 * the Shop tab's shell, from the real reward tables (rewards.ts) and this week's three at their live Joules
 * (WEEKLY_JOULES). The weekly challenges are each tier's longest text, so a line that would wrap or be cut shows.
 */
import { readFileSync } from "node:fs";

import * as rw from "../src/lib/pass/rewards";
import { WEEKLY_JOULES } from "../src/lib/pass/joules";
import { WEEKLY_POOL } from "../src/lib/pass/weekly";
import type { PassCell, PassView, PassWeekly } from "../src/lib/pass/types";

export interface HarnessPass {
  account: Record<string, unknown>;
  view: PassView;
}

export function passFixture(opts: { level?: number; premium?: boolean } = {}): HarnessPass {
  const level = opts.level ?? 12;
  const premium = opts.premium ?? false;
  // The catalogue's names, games, kinds and rarities, as the server's pass view carries them (pass.server.ts).
  const items = new Map(
    (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: { id: string; kind: string; name: string; game: string | null; rarity: string | null }[] }).items.map((i) => [i.id, i]),
  );
  const cell = (track: "free" | "premium", l: number): PassCell | null => {
    const r = rw.rewardAt(track, l);
    if (!r) return null;
    const item = r.kind === "item" ? items.get(r.item) : undefined;
    const label = rw.rewardLabel(r, item?.name);
    return {
      track,
      level: l,
      kind: r.kind,
      title: label.title,
      detail: item ? `${item.game ? `${item.game} · ` : ""}${item.kind.replaceAll("-", " ")}` : label.detail,
      rarity: item?.rarity?.toLowerCase() ?? null,
      itemId: item?.id ?? null,
      itemKind: item?.kind ?? null,
      state: track === "free" && l === 2 ? "claimed" : rw.reached(track, l, level, premium) ? "claimable" : "locked",
      needsPremium: track === "premium" && !premium,
    };
  };
  const levels = Array.from({ length: 60 }, (_, i) => ({ level: i + 1, free: cell("free", i + 1), premium: cell("premium", i + 1) }));
  const longest = (tier: "easy" | "medium" | "hard") =>
    WEEKLY_POOL.filter((c) => c.tier === tier).reduce((a, b) => (b.text.length > a.text.length ? b : a));
  const weekly: PassWeekly[] = (["easy", "medium", "hard"] as const).map((tier, i) => {
    const c = longest(tier);
    return { id: c.id, tier, text: c.text, joules: WEEKLY_JOULES[tier], done: i, need: 3, completed: i === 1 };
  });
  return {
    account: {
      kind: "account",
      userId: "u-pass",
      username: "TheInventor_2026",
      colour: 4,
      playerNumber: 1,
      founding: true,
      country: null,
      createdAt: "2026-11-10T12:00:00.000Z",
      status: "active",
      isUnder18: false,
      deletion: null,
    },
    view: {
      open: true,
      season: { id: "s1", name: "Neon Circuit", test: false, endsAt: null, daysLeft: 34, ended: false },
      joules: level * 1000 + 430,
      level,
      into: 430,
      of: 1000,
      premium: premium ? { source: "test" } : null,
      tester: true,
      levels,
      claimable: levels.reduce((n, l) => n + (l.free?.state === "claimable" ? 1 : 0) + (l.premium?.state === "claimable" ? 1 : 0), 0),
      weekly: { weekStart: "2026-11-16", challenges: weekly },
      levelNotice: null,
    },
  };
}
