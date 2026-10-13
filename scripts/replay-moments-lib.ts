/**
 * Moment checks for scripts/replay-check.ts: the weight table matches the
 * success events each game fires today, and detection and picking are
 * deterministic and come from sim state alone (no renderer runs here).
 */

import type { PuzzleData } from "../src/lib/duel/types";
import {
  ARCADE_FX_SPECS,
  ENGINE_FX_SPECS,
  ORBIT3_FX,
} from "../src/lib/arcade/arcadeFxGames.renderer";
import { momentsOf } from "../src/lib/replay/analyse";
import { MOMENT_TABLE, momentRows, pickMoments, rankMoments } from "../src/lib/replay/moments";
import { REPLAY_TYPES } from "../src/lib/replay/steppers";
import { planHighlight } from "../src/lib/replay/pick";

export function runMomentChecks(cases: { label: string; puzzle: PuzzleData; answer: string }[]): {
  checks: number;
  failures: string[];
  summary: string;
} {
  const failures: string[] = [];
  let checks = 0;
  const ok = (cond: boolean, label: string) => {
    checks++;
    if (!cond) failures.push(label);
  };

  // Table rows match today's success events, row for row.
  const specs = { ...ARCADE_FX_SPECS, ...ENGINE_FX_SPECS } as Record<
    string,
    { events: readonly { kind: string }[] }
  >;
  for (const [game, spec] of Object.entries(specs)) {
    const rows = momentRows(game).filter((r) => r.fx && !r.fx.spec);
    ok(
      rows.length === spec.events.length,
      `${game}: ${spec.events.length} success events today, ${rows.length} moment rows`,
    );
    spec.events.forEach((event, i) => {
      const row = rows.find((r) => r.fx!.index === i);
      ok(
        row !== undefined && row.fx!.kind === event.kind,
        `${game}: event ${i} (${event.kind}) has no matching moment row`,
      );
    });
  }
  const orbit3 = momentRows("orbit").filter((r) => r.fx?.spec === "orbit3");
  ok(
    orbit3.length === ORBIT3_FX.events.length,
    `orbit rev 3+: ${ORBIT3_FX.events.length} events, ${orbit3.length} rows`,
  );
  ORBIT3_FX.events.forEach((event, i) =>
    ok(
      orbit3.some((r) => r.fx!.index === i && r.fx!.kind === event.kind),
      `orbit rev 3+: event ${i} has no row`,
    ),
  );
  for (const type of REPLAY_TYPES)
    ok(
      momentRows(type).some((r) => r.weight > 0),
      `${type}: no weighted moment`,
    );
  const ids = new Set<string>();
  for (const row of MOMENT_TABLE) {
    const key = `${row.game}:${row.id}:${row.fx?.spec ?? ""}`;
    ok(!ids.has(key), `duplicate moment row ${key}`);
    ids.add(key);
    ok(
      Number.isInteger(row.weight) && row.weight >= 0 && row.weight <= 100,
      `${key}: weight ${row.weight} outside 0–100`,
    );
  }
  // Rarer, harder moments rank higher across games.
  const w = (game: string, id: string) =>
    MOMENT_TABLE.find((r) => r.game === game && r.id === id)!.weight;
  ok(
    w("wavefront", "boss-down") > w("matchup", "line-of-five") &&
      w("matchup", "line-of-five") > w("beat", "combo"),
    "a boss kill must outrank a 5-in-a-line, which must outrank a streak banner",
  );

  // Deterministic detection and picking.
  let found = 0;
  let gamesWithMoments = 0;
  for (const c of cases) {
    const a = momentsOf(c.puzzle, c.answer);
    const b = momentsOf(c.puzzle, c.answer);
    ok(a !== null && b !== null, `${c.label}: no moments analysis`);
    if (!a || !b) continue;
    ok(
      JSON.stringify(a.moments) === JSON.stringify(b.moments),
      `${c.label}: moment detection differs between two passes`,
    );
    ok(
      JSON.stringify(pickMoments(a.moments)) === JSON.stringify(pickMoments(b.moments)),
      `${c.label}: picking differs between two passes`,
    );
    const shuffled = [...a.moments].reverse();
    ok(
      JSON.stringify(rankMoments(shuffled)) === JSON.stringify(rankMoments(a.moments)),
      `${c.label}: ranking depends on input order`,
    );
    for (const m of a.moments)
      ok(
        m.tick >= 1 && m.tick <= a.endTick && m.weight > 0,
        `${c.label}: moment ${m.id} at ${m.tick} outside the run`,
      );
    const plan = planHighlight(pickMoments(a.moments), a.endTick);
    for (const clip of plan)
      ok(
        clip.start >= 0 &&
          clip.end <= a.endTick &&
          clip.start < clip.moment.tick &&
          clip.moment.tick <= clip.end,
        `${c.label}: clip ${clip.start}–${clip.end} does not hold its moment`,
      );
    const seconds = plan.reduce((s, clip) => s + clip.seconds, 0);
    ok(
      plan.length === 0 || (seconds >= 2.5 && seconds <= 12.5),
      `${c.label}: highlight runs ${seconds.toFixed(1)} s`,
    );
    found += a.moments.length;
    if (a.moments.length) gamesWithMoments++;
  }
  ok(
    gamesWithMoments >= Math.floor(cases.length * 0.7),
    `only ${gamesWithMoments} of ${cases.length} fixture runs have moments`,
  );
  return {
    checks,
    failures,
    summary: `${MOMENT_TABLE.length} moment rows match today's success events; ${found} moments in ${gamesWithMoments} runs, detection and picking deterministic`,
  };
}
