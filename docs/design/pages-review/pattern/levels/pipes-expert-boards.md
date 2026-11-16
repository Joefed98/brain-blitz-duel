# Pipeline Expert boards

Dealt at room seeds 1–12 exactly as a room deals Expert (`bun scripts/pipes-expert-boards.ts`): 8 across × 11 down,
at least 95 % of the tiles turned, no spills shown during play, a 120 s clock, full speed points by 90 s. Practice deals
a fresh Expert board each time (Games → Pipeline → Expert); these are the boards a room on that seed would deal. The
source is marked `*`. Each board has exactly one solution (the searching solver finds 1 layout, stopping at 2).

Person-like player: `scripts/pipes-human.ts` at the near-perfect pace (reasons from the tiles alone: matching sides,
no loops, no sealed-off group, no guessing; 1.6 s × 0.5 a tile fixed, 3.2 s × 0.5 a loop or seal step, 250 ms a
turn), its finish played through the real grader.

## Room seed 1

Par 101 turns. Layouts: 1. Person-like player: finished in 115.3 s (136 tile steps, 1 loop / seal steps), 166 points.

Dealt | Solved

```
╻ ┏ ╸ ╻ ┃ ┻ ┃ ╹    ╺ ┓ ╻ ╺ ━ ┳ ━ ╸ 
┓ ┣ ╋ ╹ ╹ ┣ ┓ ╺    ┏ ┻ ╋ ╸ ╺ ┫ ┏ ╸ 
╻ ╻ ┫ ┃ ┏ ┻ ┫ ╹    ╹ ╺ ┻ ━ ┓ ┣ ┻ ╸ 
╻ ┃ ┣ ┃ ┫ ┳ ╸ ╸    ╺ ━ ┳ ━ ┻ ┫ ╻ ╻ 
╹ ┣ ┓ ┓ ┃ ╋ ┣ ┣    ╺ ┳ ┛ ┏ ━ ╋ ┻ ┫ 
┛ ┗ ╹ ┗ ┗ ┓ ┛ ┳    ┏ ┛ ╺ ┛ ┏ ┛ ┏ ┫ 
╺ ╸ ┃ ┃ ╋ ╹ ━ ━*   ╹ ╺ ━ ━ ╋ ╸ ┃ ┃*
╻ ┃ ┃ ┫ ┳ ╸ ┻ ━    ╺ ━ ━ ┳ ┫ ╺ ┫ ┃ 
╺ ╻ ┣ ┣ ╻ ┗ ┣ ━    ╻ ╺ ┳ ┫ ╹ ┏ ┫ ┃ 
━ ╹ ┓ ┳ ╹ ━ ━ ╺    ┃ ╺ ┛ ┣ ╸ ┃ ┃ ╹ 
┏ ┃ ┃ ┳ ╺ ╻ ┓ ╹    ┗ ━ ━ ┻ ╸ ╹ ┗ ╸ 
```

## Room seed 2

Par 108 turns. Layouts: 1. Person-like player: finished in 106.2 s (113 tile steps, 0 loop / seal steps), 178 points.

Dealt | Solved

```
╸ ┛ ┓ ┃ ┏ ┓ ╹ ╸    ╺ ┓ ┏ ━ ┓ ┏ ╸ ╻ 
╺ ┓ ┣ ╸ ┓ ┳ ┃ ┏    ╻ ┗ ┫ ╻ ┗ ┻ ━ ┛ 
━ ╻ ┫ ╋ ┃ ╻ ╸ ┏    ┃ ╺ ┻ ╋ ━ ╸ ╺ ┓ 
━ ╸ ┓ ┻ ┗ ╺ ╺ ━    ┃ ╻ ┏ ┫ ┏ ╸ ╻ ┃ 
┻ ┓ ╻ ┻ ┳ ┃ ╋ ┏    ┣ ┛ ╹ ┣ ┻ ━ ╋ ┛ 
┳ ┃ ┃ ┳ ┗ ╹ ╻ ╹    ┣ ━ ━ ┫ ┏ ╸ ╹ ╻ 
┳ ┣ ╻ ┛ ┳ ┃ ┫ ┗    ┣ ┳ ╸ ┗ ┻ ━ ┳ ┛ 
━*┓ ┃ ┃ ╻ ┓ ╋ ╻    ┃*┗ ━ ━ ╸ ┏ ╋ ╸ 
┏ ┻ ┫ ┃ ┛ ╻ ┳ ┏    ┗ ┳ ┳ ━ ┓ ╹ ┣ ┓ 
┗ ┏ ┻ ┛ ╺ ┓ ┏ ╺    ┏ ┛ ┣ ┓ ╹ ┏ ┛ ╹ 
┓ ╻ ╺ ╻ ╸ ┣ ┃ ╺    ┗ ╸ ╹ ╹ ╺ ┻ ━ ╸ 
```

## Room seed 3

Par 104 turns. Layouts: 1. Person-like player: finished in 106.4 s (115 tile steps, 0 loop / seal steps), 178 points.

Dealt | Solved

```
┗ ┃ ┃ ┣ ┃ ┛ ┛ ╻    ┏ ━ ━ ┳ ━ ┓ ┏ ╸ 
╻ ┛ ╹ ╻ ╸ ╋ ┣ ┏    ╹ ┏ ╸ ╹ ╺ ╋ ┻ ┓ 
╻ ┳ ╻ ┃ ┏ ╺ ╺ ━    ╺ ┫ ╺ ━ ┓ ╹ ╻ ┃ 
╻ ┫ ┗ ╻ ┣ ┛ ━ ━    ╺ ┻ ┓ ╺ ┻ ┓ ┃ ┃ 
╺ ╺ ┛ ┃ ┃ ┣ ┣ ━    ╻ ╻ ┗ ━ ━ ┻ ┫ ┃ 
━ ┛ ┛ ╹ ┃ ┏ ━ ━    ┃ ┗ ┓ ╺ ━ ┓ ┃ ┃ 
━ ┛ ┣ ╻ ┏ ━ ┓ ┳    ┃ ┏ ┫ ╺ ┓ ┃ ┗ ┫ 
┫ ┏ ┫ ┃ ╋ ┣ ┫ ┻*   ┣ ┛ ┣ ━ ╋ ┻ ┳ ┫*
┳ ╻ ┻ ╻ ╻ ┓ ┏ ━    ┣ ╸ ┣ ╸ ╹ ┏ ┛ ┃ 
┳ ╹ ━ ┓ ┫ ┣ ╸ ┣    ┣ ╸ ┃ ┏ ┳ ┫ ╺ ┫ 
╸ ╹ ┓ ╺ ╺ ╺ ╻ ┓    ╹ ╺ ┛ ╹ ╹ ╹ ╺ ┛ 
```

## Room seed 4

Par 103 turns. Layouts: 1. Person-like player: finished in 108.2 s (120 tile steps, 0 loop / seal steps), 176 points.

Dealt | Solved

```
┗*┫ ┃ ┣ ┃ ┣ ┃ ╺    ┏*┳ ━ ┳ ━ ┳ ━ ╸ 
━ ━ ╺ ━ ┓ ┻ ╸ ╸    ┃ ┃ ╻ ┃ ┏ ┫ ╻ ╻ 
━ ┫ ┻ ╸ ━ ┻ ┣ ┏    ┃ ┣ ┫ ╹ ┃ ┣ ┻ ┛ 
╻ ━ ╻ ╸ ╺ ╻ ╸ ╺    ╹ ┃ ╹ ╻ ╹ ╹ ╻ ╻ 
┓ ┻ ╸ ┻ ┃ ╻ ┳ ┏    ┏ ┫ ╻ ┣ ━ ╸ ┣ ┛ 
╸ ┳ ┳ ╋ ┃ ┃ ╋ ╻    ╹ ┣ ┻ ╋ ━ ━ ╋ ╸ 
╺ ┏ ┛ ┳ ┃ ╹ ┓ ┛    ╻ ┗ ┓ ┣ ━ ╸ ┗ ┓ 
┓ ┃ ┓ ┳ ┏ ╸ ╹ ╻    ┗ ━ ┛ ┣ ┓ ╻ ╻ ╹ 
┓ ╺ ╻ ┏ ┫ ┣ ┓ ╸    ┏ ╸ ╺ ┛ ┣ ┻ ┛ ╻ 
┏ ┻ ┃ ┫ ┗ ┗ ┃ ┏    ┗ ┳ ━ ┳ ┛ ┏ ━ ┛ 
╹ ┓ ╹ ┫ ┃ ┣ ┃ ╻    ╺ ┛ ╺ ┻ ━ ┻ ━ ╸ 
```

## Room seed 5

Par 114 turns. Layouts: 1. Person-like player: out of time (144 tile steps, 3 loop / seal steps), 113 points.

Dealt | Solved

```
╹ ┻ ╺ ╹ ┗ ╹ ┗ ┛    ╺ ┳ ╸ ╻ ┏ ╸ ┏ ┓ 
╸ ━ ╸ ┫ ┗ ╹ ━ ╸    ╻ ┃ ╻ ┣ ┛ ╻ ┃ ╹ 
━ ┓ ┣ ━ ╹ ┳ ┓ ┏    ┃ ┗ ┫ ┃ ╺ ┫ ┗ ┓ 
┛ ┃ ┣ ━ ┛ ┓ ╺ ━    ┗ ━ ┫ ┃ ┏ ┛ ╻ ┃ 
╺ ╹ ┣ ┫ ┓ ┛ ╋ ┣    ╻ ╺ ┫ ┣ ┛ ┏ ╋ ┫ 
┓ ┃ ┣ ┫ ╺ ━ ╸ ╻    ┗ ━ ┫ ┣ ╸ ┃ ╹ ╹ 
╸ ╺ ┳*┳ ┃ ┫ ┃ ┛    ╻ ╻ ┣*┻ ━ ┻ ━ ┓ 
━ ┓ ╋ ┻ ┃ ┃ ╻ ╸    ┃ ┗ ╋ ┳ ━ ━ ╸ ╹ 
┫ ┃ ┳ ┻ ┻ ┃ ┻ ┏    ┣ ━ ┫ ┣ ┳ ━ ┳ ┓ 
╸ ╹ ┳ ━ ┻ ┗ ━ ━    ╹ ╺ ┫ ┃ ┣ ┓ ┃ ┃ 
╸ ┃ ┓ ╻ ╺ ╺ ╺ ╸    ╺ ━ ┛ ╹ ╹ ╹ ╹ ╹ 
```

## Room seed 6

Par 99 turns. Layouts: 1. Person-like player: finished in 100.0 s (103 tile steps, 0 loop / seal steps), 187 points.

Dealt | Solved

```
┗ ╹ ╹ ╹ ┫ ╻ ╸ ╹    ┏ ╸ ╻ ╺ ┳ ╸ ╻ ╻ 
┻ ╹ ┻ ┗ ┫ ┫ ┣ ┳    ┣ ╸ ┣ ┓ ┣ ┳ ┻ ┫ 
┳ ╹ ╺ ━ ╺ ┳ ╹ ╺    ┣ ╸ ╹ ┃ ╹ ┣ ╸ ╹ 
━ ┗ ╻ ┳ ┃ ┗ ┓ ╻    ┃ ┏ ╸ ┣ ━ ┛ ┏ ╸ 
━*━ ╸ ╋ ┃ ╻ ┫ ╻    ┃*┃ ╺ ╋ ━ ╸ ┣ ╸ 
┫ ┫ ╺ ┫ ┃ ┃ ┣ ╹    ┣ ┻ ╸ ┣ ━ ━ ┻ ╸ 
┏ ┣ ┃ ╋ ┃ ┃ ┃ ╻    ┗ ┳ ━ ╋ ━ ━ ━ ╸ 
╹ ┫ ╹ ┛ ┫ ┃ ╹ ╺    ╻ ┣ ╸ ┗ ┳ ━ ╸ ╻ 
┻ ┣ ┣ ╹ ┫ ╻ ┛ ┏    ┣ ┻ ┳ ╸ ┣ ╸ ┏ ┛ 
╺ ╻ ╋ ┏ ┏ ┃ ┗ ╺    ╹ ╺ ╋ ┓ ┗ ━ ┛ ╻ 
╹ ┃ ┓ ┏ ┃ ┃ ┃ ┗    ╺ ━ ┛ ┗ ━ ━ ━ ┛ 
```

## Room seed 7

Par 103 turns. Layouts: 1. Person-like player: finished in 105.0 s (114 tile steps, 0 loop / seal steps), 180 points.

Dealt | Solved

```
╺ ╸*┛ ╸ ╸ ┓ ┃ ╻    ╻ ╺*┓ ╻ ╻ ┏ ━ ╸ 
┫ ┃ ╋ ┳ ┣ ┛ ┏ ╸    ┣ ━ ╋ ┻ ┫ ┗ ┓ ╻ 
╸ ┛ ╋ ┏ ┓ ┃ ┣ ┓    ╹ ┏ ╋ ┓ ┗ ━ ┻ ┛ 
╹ ━ ━ ┫ ┃ ┣ ┣ ┏    ╻ ┃ ┃ ┣ ━ ┳ ┳ ┓ 
┫ ┓ ━ ┻ ┏ ━ ╺ ╻    ┣ ┛ ┃ ┣ ┓ ┃ ╹ ╹ 
┻ ┏ ━ ━ ━ ┫ ┃ ┛    ┣ ┓ ┃ ┃ ┃ ┣ ━ ┓ 
━ ━ ━ ━ ╺ ┳ ╹ ━    ┃ ┃ ┃ ┃ ╹ ┣ ╸ ┃ 
━ ╺ ╺ ━ ╸ ┳ ╹ ━    ┃ ╹ ╹ ┃ ╺ ┫ ╻ ┃ 
┛ ╻ ╺ ━ ╺ ┫ ┏ ━    ┗ ╸ ╻ ┃ ╻ ┣ ┛ ┃ 
╸ ┣ ╋ ╋ ┻ ━ ╹ ┓    ╺ ┳ ╋ ╋ ┫ ┃ ╺ ┛ 
╹ ┏ ╻ ╸ ╺ ┓ ┃ ╻    ╺ ┛ ╹ ╹ ╹ ┗ ━ ╸ 
```

## Room seed 8

Par 102 turns. Layouts: 1. Person-like player: finished in 109.5 s (122 tile steps, 1 loop / seal steps), 174 points.

Dealt | Solved

```
╹ ┣ ╻ ╸ ╹ ┫ ╻ ╹    ╺ ┳ ╸ ╻ ╺ ┳ ╸ ╻ 
╻ ┣ ┃ ╋ ┗ ┻ ┃ ┓    ╺ ┻ ━ ╋ ┓ ┣ ━ ┛ 
┛ ┻ ┏ ╻ ┳*┗ ┛ ╺    ┏ ┳ ┓ ╹ ┣*┛ ┏ ╸ 
━ ╸ ┳ ┣ ┳ ┣ ┣ ╹    ┃ ╹ ┣ ┳ ┻ ┳ ┻ ╸ 
━ ╻ ┻ ━ ╹ ┣ ┏ ╸    ┃ ╺ ┫ ┃ ╺ ┻ ┓ ╻ 
╺ ┛ ┏ ╻ ╸ ┓ ┫ ┓    ╹ ┏ ┛ ╹ ╻ ┏ ┻ ┛ 
╻ ┓ ┗ ┃ ╋ ╋ ┣ ╹    ╺ ┛ ┏ ━ ╋ ╋ ┳ ╸ 
╹ ╹ ┓ ╻ ┳ ━ ┏ ┏    ╻ ╺ ┛ ╺ ┫ ┃ ┗ ┓ 
┻ ┃ ┃ ┃ ┳ ┏ ┏ ━    ┣ ━ ━ ━ ┫ ┗ ┓ ┃ 
┻ ┗ ┛ ┃ ╋ ┗ ━ ━    ┣ ┓ ┏ ━ ╋ ┓ ┃ ┃ 
╺ ╺ ┛ ╹ ╻ ╻ ╻ ╸    ╹ ╹ ┗ ╸ ╹ ╹ ╹ ╹ 
```

## Room seed 9

Par 102 turns. Layouts: 1. Person-like player: finished in 113.5 s (134 tile steps, 0 loop / seal steps), 169 points.

Dealt | Solved

```
┗ ┃ ┗ ╺ ╹ ╸ ┓ ╹    ┏ ━ ┓ ╻ ╻ ╻ ┏ ╸ 
━ ╺ ┓ ╋ ┏ ┫ ┓ ╸    ┃ ╻ ┗ ╋ ┛ ┣ ┛ ╻ 
╺ ┛ ┣ ┻ ╺ ┳ ╺ ━    ╹ ┗ ┳ ┫ ╻ ┣ ╸ ┃ 
╹ ╸ ╸ ━ ━ ┻ ┃ ┻    ╻ ╻ ╹ ┃ ┃ ┣ ━ ┫ 
┏ ┫ ┣ ┫ ┻ ━ ╹ ━    ┗ ┻ ┳ ┻ ┫ ┃ ╻ ┃ 
╺ ╹ ┫*┛ ┻ ┫ ┳ ╺    ╻ ╺ ┻*┓ ┣ ┻ ┫ ╹ 
┳ ┃ ┃ ┳ ┏ ┏ ┏ ╺    ┣ ━ ━ ┫ ┗ ┓ ┗ ╸ 
━ ╹ ┫ ┫ ╺ ┫ ┃ ┏    ┃ ╺ ┳ ┻ ╸ ┣ ━ ┓ 
━ ┗ ┫ ┏ ╸ ━ ╻ ┻    ┃ ┏ ┻ ┓ ╻ ┃ ╺ ┫ 
━ ━ ┓ ╋ ┳ ╻ ┛ ┳    ┃ ┃ ┏ ╋ ┫ ╹ ┏ ┫ 
╸ ╸ ╻ ╸ ┓ ╹ ╺ ╻    ╹ ╹ ╹ ╹ ┗ ╸ ╹ ╹ 
```

## Room seed 10

Par 109 turns. Layouts: 1. Person-like player: finished in 114.5 s (132 tile steps, 0 loop / seal steps), 167 points.

Dealt | Solved

```
╺ ╻ ┛ ╻ ┏ ╺ ╹ ╹    ╻ ╺ ┓ ╺ ┓ ╻ ╻ ╻ 
┛ ┏ ━ ╹ ┻ ┳ ━ ━    ┗ ┓ ┃ ╻ ┣ ┫ ┃ ┃ 
╹ ━ ┻ ┫ ┓ ╸ ━ ━    ╻ ┃ ┣ ┻ ┛ ╹ ┃ ┃ 
┏ ┫ ┳ ╹ ╹ ╺ ┓ ┳    ┗ ┻ ┫ ╻ ╻ ╻ ┗ ┫ 
┛ ┻ ┫ ╋ ┻ ━ ╹ ┣    ┏ ┳ ┻ ╋ ┫ ┃ ╺ ┫ 
╺ ━ ┗ ┣ ┳*┳ ┛ ┣    ╹ ┃ ┏ ┫ ┣*┫ ┏ ┫ 
╻ ┗ ╸ ╸ ━ ┻ ┳ ╸    ╺ ┛ ╹ ╹ ┃ ┣ ┫ ╹ 
╸ ┃ ┃ ┫ ┻ ━ ┻ ┗    ╺ ━ ━ ┳ ┫ ┃ ┣ ┓ 
┗ ┃ ┃ ┣ ╺ ━ ╸ ╺    ┏ ━ ━ ┫ ╹ ┃ ╹ ╹ 
╻ ┗ ┃ ┻ ╻ ╋ ╺ ╹    ╹ ┏ ━ ┫ ╺ ╋ ╸ ╻ 
╻ ┗ ╸ ┳ ╻ ┓ ┃ ┏    ╺ ┛ ╺ ┻ ╸ ┗ ━ ┛ 
```

## Room seed 11

Par 113 turns. Layouts: 1. Person-like player: finished in 113.0 s (128 tile steps, 0 loop / seal steps), 169 points.

Dealt | Solved

```
╻ ┗ ╻ ┃ ┏ ╸ ┃ ┛    ╺ ┓ ╺ ━ ┓ ╺ ━ ┓ 
╹ ┫ ╻ ╹ ┣ ╸ ┃ ┣    ╻ ┣ ╸ ╺ ┫ ╺ ━ ┫ 
━ ━ ╸ ┏ ┻ ╹ ┓ ┏    ┃ ┃ ╺ ┓ ┣ ╸ ┏ ┛ 
┛ ┳ ┃ ╋ ┏ ╹ ╋ ┗    ┗ ┻ ━ ╋ ┛ ╺ ╋ ┓ 
╻ ┃ ┃ ┣ ╸ ┃ ┳ ╺    ╺ ━ ━ ┫ ╺ ━ ┫ ╹ 
┓ ┃ ┗ ━ ╺ ┗*┫ ╹    ┏ ━ ┓ ┃ ╻ ┏*┻ ╸ 
━ ╹ ┳ ┫ ╋ ┳ ┛ ╹    ┃ ╺ ┻ ┻ ╋ ┻ ┓ ╻ 
┓ ╹ ╺ ┓ ┻ ╹ ╋ ┣    ┗ ╸ ╻ ┏ ┫ ╺ ╋ ┫ 
┗ ┣ ┫ ┓ ┳ ┛ ╻ ━    ┏ ┳ ┻ ┛ ┣ ┓ ╹ ┃ 
━ ╻ ┓ ┃ ┣ ╺ ╸ ┳    ┃ ╹ ┏ ━ ┫ ╹ ╺ ┫ 
╻ ╸ ┏ ╸ ┫ ┃ ╺ ╺    ╹ ╺ ┛ ╺ ┻ ━ ╸ ╹ 
```

## Room seed 12

Par 113 turns. Layouts: 1. Person-like player: finished in 115.0 s (125 tile steps, 2 loop / seal steps), 167 points.

Dealt | Solved

```
╻ ┻ ┛ ╻ ┃ ┛ ╹ ╸    ╺ ┳ ┓ ╺ ━ ┓ ╻ ╻ 
╸ ┻ ┓ ┃ ┃ ┣ ┻ ┏    ╺ ┫ ┗ ━ ━ ┫ ┣ ┛ 
╹ ┓ ╸ ┣ ┃ ┻ ┳ ╻    ╺ ┛ ╺ ┳ ━ ┫ ┣ ╸ 
╹ ┃ ┻ ┓ ╸ ┣ ━ ╹    ╺ ━ ┳ ┛ ╺ ┫ ┃ ╻ 
┛ ┛ ╸ ┛ ┃ ┣ ┏ ┣    ┏ ┓ ╹ ┏ ━ ┫ ┗ ┫ 
╺ ━ ╺ ╻ ╹ ┫ ┗ ━    ╹ ┃ ╻ ╹ ╺ ┻ ┓ ┃ 
╸ ┫ ╋ ┃ ┃ ┃ ╋ ┣*   ╺ ┻ ╋ ━ ━ ━ ╋ ┫*
╸ ┫ ┓ ╸ ┗ ┃ ┣ ━    ╺ ┳ ┛ ╻ ┏ ━ ┫ ┃ 
╻ ┏ ╻ ╋ ╋ ╹ ╺ ╻    ╺ ┛ ╺ ╋ ╋ ╸ ╹ ╹ 
╸ ┃ ┃ ┣ ┓ ┻ ┃ ╺    ╺ ━ ━ ┫ ┗ ┳ ━ ╸ 
╹ ┃ ┃ ┫ ╻ ┓ ┃ ╻    ╺ ━ ━ ┻ ╸ ┗ ━ ╸ 
```
