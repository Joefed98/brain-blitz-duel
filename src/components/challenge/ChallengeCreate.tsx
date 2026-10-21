import { useMemo } from "react";

import { CATEGORY_ORDER, PUZZLE_CATEGORIES, STANDARD_CATEGORIES } from "@/lib/duel/categories";
import { challengeRoundChoices } from "@/lib/duel/challenge";
import { typesInCategory } from "@/lib/duel/registry";
import type { PuzzleCategory } from "@/lib/duel/types";
import { Dots } from "@/components/duel/Dots";

/** The lobby's presets (RoomLobby), each with its line. */
const PRESETS: { label: string; values: readonly PuzzleCategory[] }[] = [
  { label: "Standard", values: STANDARD_CATEGORIES },
  { label: "Arcade only", values: ["arcade"] },
  { label: "Puzzles only", values: PUZZLE_CATEGORIES },
];

const same = (a: readonly PuzzleCategory[], b: readonly PuzzleCategory[]) =>
  a.length === b.length && a.every((c) => b.includes(c));

/**
 * The "Challenge a friend" form (22 Oct 2026): the name on the board, the categories (the room
 * lobby's presets and chips, arcade allowed) and how many rounds, then Create and play. The
 * creator plays the rounds first, alone; the link to send comes at the end.
 */
export function ChallengeCreate({
  name,
  editingName,
  onName,
  onEditName,
  categories,
  onCategories,
  rounds,
  onRounds,
  busy,
  error,
  onCreate,
}: {
  name: string;
  editingName: boolean;
  onName: (name: string) => void;
  onEditName: () => void;
  categories: PuzzleCategory[];
  onCategories: (next: PuzzleCategory[]) => void;
  rounds: number;
  onRounds: (rounds: number) => void;
  busy: boolean;
  error: string | null;
  onCreate: () => void;
}) {
  const choices = useMemo(() => challengeRoundChoices(categories), [categories]);
  return (
    <div data-challenge-create className="flex flex-col gap-4">
      <section
        data-tint="gold"
        className="th-card flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-4"
      >
        {editingName ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="challenge-name" className="th-kicker text-muted-foreground">
              Your name on the board
            </label>
            <input
              id="challenge-name"
              value={name}
              maxLength={14}
              placeholder="Your name"
              autoComplete="nickname"
              onChange={(e) => onName(e.target.value)}
              className="th-input tap-target w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="min-w-0 truncate">
              Playing as <span className="th-name text-foreground">{name}</span>
            </span>
            <button
              type="button"
              onClick={onEditName}
              className="press tap-target shrink-0 px-2 font-display text-xs font-semibold uppercase tracking-widest text-primary"
            >
              Change name
            </button>
          </p>
        )}

        <p className="th-kicker text-foreground">Categories</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(({ label, values }) => (
            <button
              key={label}
              type="button"
              aria-pressed={same(categories, values)}
              onClick={() => onCategories([...values])}
              className="th-chip press min-h-11 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 font-display text-xs font-bold uppercase text-foreground aria-pressed:border-primary aria-pressed:text-primary"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              data-cat={category}
              aria-pressed={categories.includes(category)}
              disabled={
                (!typesInCategory(category).length && !categories.includes(category)) ||
                (categories.length === 1 && categories.includes(category))
              }
              onClick={() =>
                onCategories(
                  categories.includes(category)
                    ? categories.filter((item) => item !== category)
                    : CATEGORY_ORDER.filter(
                        (item) => categories.includes(item) || item === category,
                      ),
                )
              }
              className="th-chip press inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 font-display text-xs font-bold uppercase text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary disabled:opacity-70"
            >
              <span aria-hidden="true" className="th-chip-dot" />
              {category}
            </button>
          ))}
        </div>

        <p className="th-kicker text-foreground">Rounds</p>
        <div
          role="group"
          aria-label="Rounds"
          className="grid grid-flow-col gap-1.5"
          style={{ gridAutoColumns: "minmax(0, 1fr)" }}
        >
          {choices.map((count) => (
            <button
              key={count}
              type="button"
              data-challenge-rounds={count}
              aria-pressed={rounds === count}
              onClick={() => onRounds(count)}
              className={`th-chip th-hit press tap-target inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 font-display text-xs font-bold uppercase tracking-wide ${
                rounds === count ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {count} rounds
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          About {rounds * 2} min. You play first; then send the link.
        </p>

        <button
          type="button"
          data-challenge-make
          disabled={busy}
          onClick={onCreate}
          className="th-btn-gold press tap-target flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary py-4 font-display text-lg font-extrabold uppercase tracking-wide text-primary-foreground"
        >
          {busy ? <Dots className="bg-primary-foreground" /> : "Create and play"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
