/**
 * D3's new level drawings for two Attention games (22 Nov 2026), kept apart from each game's own art so the art session
 * (A2, the polish plan) can redraw them without touching a stage: plain placeholder shapes in the games' own colour
 * tokens. Display only: nothing here reads or writes an answer.
 *
 *  - MazeKeysLayer: Labyrinth's gold keys (levelRev 2's Hard and Expert; mazeKeys.ts), drawn in the maze board's own SVG
 *    units (a cell is 1 wide and `k` tall), and a padlock over the exit while a key is still to fetch.
 *  - SpotMirrorNote: Double Take's Expert note on the divider, "Mirror image", so the mirrored lower panel is announced.
 */

/** Labyrinth's keys in the board's SVG: a key at each cell (faint once taken) and a lock on the exit until all are taken. */
export function MazeKeysLayer({ keys, taken, exit, cols, k = 1 }: { keys: readonly number[]; taken: readonly number[]; exit: number; cols: number; k?: number }) {
  const cx = (cell: number) => (cell % cols) + 0.5;
  const cy = (cell: number) => (Math.floor(cell / cols) + 0.5) * k;
  const locked = keys.some((c) => !taken.includes(c));
  return (
    <g data-maze-keys="" data-maze-keys-left={keys.filter((c) => !taken.includes(c)).length}>
      {keys.map((cell) => {
        const got = taken.includes(cell);
        const x = cx(cell);
        const y = cy(cell);
        return (
          <g key={cell} data-maze-key={got ? "taken" : "open"} opacity={got ? 0.3 : 1}>
            <circle cx={x - 0.13} cy={y} r={0.14} fill="none" stroke="var(--primary)" strokeWidth={0.07} />
            <rect x={x} y={y - 0.035} width={0.3} height={0.07} fill="var(--primary)" />
            <rect x={x + 0.2} y={y} width={0.06} height={0.12} fill="var(--primary)" />
          </g>
        );
      })}
      {locked ? (
        <g data-maze-lock="">
          <rect x={cx(exit) - 0.17} y={cy(exit) - 0.04} width={0.34} height={0.26} rx={0.04} fill="var(--primary)" />
          <path d={`M ${cx(exit) - 0.1} ${cy(exit) - 0.04} v -0.08 a 0.1 0.1 0 0 1 0.2 0 v 0.08`} fill="none" stroke="var(--primary)" strokeWidth={0.06} />
        </g>
      ) : null}
    </g>
  );
}

/** Double Take's Expert note on the divider between a picture's panels. */
export function SpotMirrorNote() {
  return (
    <div data-dt-mirror-note="" className="w-full shrink-0 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Mirror image
    </div>
  );
}
