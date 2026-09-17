import { describe, expect, test } from "bun:test";

import type { Standing } from "./scoring";
import { formatElapsed, positionChange, previousStandingOrder, roundResultOrder } from "./resultPresentation";

function standing(slot: number, roundScore: number, position: number, previousPosition: number | null): Standing {
  return {
    slot,
    name: `Player ${slot}`,
    status: "active",
    total: 100,
    roundScore,
    roundCorrect: true,
    answerMs: 1_000,
    position,
    previousPosition,
    summary: "Solved",
    detail: [],
  };
}

describe("result presentation", () => {
  test("orders a round by points, then time, then slot", () => {
    const rows = [standing(3, 80, 1, 3), standing(2, 100, 2, 1), standing(1, 100, 3, 2)];
    const times = new Map([[1, 2_000], [2, 3_000], [3, 500]]);
    expect(roundResultOrder(rows, times).map((row) => row.slot)).toEqual([1, 2, 3]);
  });

  test("formats elapsed time and missing submissions", () => {
    expect(formatElapsed(23_440)).toBe("23.4s");
    expect(formatElapsed(null)).toBe("—");
  });

  test("formats position changes", () => {
    expect(positionChange(standing(1, 0, 1, 3))).toBe("▲2");
    expect(positionChange(standing(1, 0, 3, 1))).toBe("▼2");
    expect(positionChange(standing(1, 0, 2, 2))).toBe("–");
  });

  test("provides the previous order for the opening animation", () => {
    const rows = [standing(1, 0, 1, 3), standing(2, 0, 2, 1), standing(3, 0, 3, 2)];
    expect(previousStandingOrder(rows).map((row) => row.slot)).toEqual([2, 3, 1]);
  });
});