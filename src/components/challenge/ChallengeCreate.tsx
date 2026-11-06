import { useMemo } from "react";

import { CATEGORY_ORDER, PUZZLE_CATEGORIES, STANDARD_CATEGORIES } from "@/lib/duel/categories";
import { challengeRoundChoices } from "@/lib/duel/challenge";
import { typesInCategory } from "@/lib/duel/registry";
import type { PuzzleCategory } from "@/lib/duel/types";
import { Dots } from "@/components/duel/Dots";
import { Button, Chip, Input, Segmented } from "@/design/components";

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
            <Input
              id="challenge-name"
              value={name}
              maxLength={14}
              placeholder="Your name"
              autoComplete="nickname"
              onChange={(e) => onName(e.target.value)}
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
            <Chip key={label} selected={same(categories, values)} onClick={() => onCategories([...values])}>
              {label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((category) => (
            <Chip
              key={category}
              cat={category}
              tint
              selected={categories.includes(category)}
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
              className="capitalize"
            >
              {category}
            </Chip>
          ))}
        </div>

        <p className="th-kicker text-foreground">Rounds</p>
        <Segmented
          label="Rounds"
          value={rounds}
          onChange={onRounds}
          options={choices.map((count) => ({
            value: count,
            label: `${count} rounds`,
            data: { "data-challenge-rounds": count },
          }))}
        />
        <p className="text-xs text-muted-foreground">
          About {rounds * 2} min. You play first; then send the link.
        </p>

        <Button
          variant="gold"
          size={58}
          block
          data-challenge-make
          disabled={busy}
          onClick={onCreate}
        >
          {busy ? <Dots className="bg-primary-foreground" /> : "Create and play"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
