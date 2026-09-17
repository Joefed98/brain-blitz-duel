/**
 * Tower rules. One replay function, used by the phone (to move discs live) and
 * by the server (to replay the move list a phone sends).
 */

/** Each peg holds disc sizes from bottom to top; a peg is always descending. */
export type TowerPegs = number[][];

export interface TowerMove {
  from: number;
  to: number;
}

export function towerStart(discs: number): TowerPegs {
  return [Array.from({ length: discs }, (_, index) => discs - index), [], []];
}

/** True when the top of `from` may sit on `to`. */
export function towerCanMove(pegs: TowerPegs, from: number, to: number): boolean {
  if (from === to) return false;
  const source = pegs[from];
  const destination = pegs[to];
  if (!source || !destination || !source.length) return false;
  const disc = source[source.length - 1]!;
  const onTop = destination[destination.length - 1];
  return onTop === undefined || disc < onTop;
}

export function towerApply(pegs: TowerPegs, from: number, to: number): TowerPegs {
  if (!towerCanMove(pegs, from, to)) return pegs;
  const next: TowerPegs = pegs.map((peg) => [...peg]);
  next[to]!.push(next[from]!.pop()!);
  return next;
}

/** "0>2,0>1" — one move per part. */
export function encodeTowerMoves(moves: TowerMove[]): string {
  return moves.map((move) => `${move.from}>${move.to}`).join(",");
}

export function decodeTowerMoves(raw: string): TowerMove[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => {
      const [from, to] = part.split(">");
      return { from: Number.parseInt(from ?? "", 10), to: Number.parseInt(to ?? "", 10) };
    })
    .filter(
      (move) =>
        Number.isInteger(move.from) &&
        Number.isInteger(move.to) &&
        move.from >= 0 &&
        move.from < 3 &&
        move.to >= 0 &&
        move.to < 3,
    )
    .slice(0, 400);
}

export interface TowerReplay {
  pegs: TowerPegs;
  /** Moves that were actually legal. */
  moves: number;
  solved: boolean;
  /** Discs stacked correctly from the bottom of the target peg. */
  correctFromBottom: number;
}

/** Discs in place counting up from the bottom of the target peg. */
export function towerCorrectFromBottom(pegs: TowerPegs, targetPeg: number, discs: number): number {
  const peg = pegs[targetPeg] ?? [];
  let count = 0;
  for (let index = 0; index < peg.length; index++) {
    if (peg[index] !== discs - index) break;
    count += 1;
  }
  return count;
}

export function replayTower(discs: number, targetPeg: number, moves: TowerMove[]): TowerReplay {
  let pegs = towerStart(discs);
  let count = 0;
  for (const move of moves) {
    if (!towerCanMove(pegs, move.from, move.to)) continue;
    pegs = towerApply(pegs, move.from, move.to);
    count += 1;
    if ((pegs[targetPeg] ?? []).length === discs) break;
  }
  return {
    pegs,
    moves: count,
    solved: (pegs[targetPeg] ?? []).length === discs,
    correctFromBottom: towerCorrectFromBottom(pegs, targetPeg, discs),
  };
}

/** The classic recursive optimum: 2^discs − 1 moves. */
export function towerOptimal(discs: number, from: number, to: number): TowerMove[] {
  if (discs <= 0) return [];
  const spare = 3 - from - to;
  return [
    ...towerOptimal(discs - 1, from, spare),
    { from, to },
    ...towerOptimal(discs - 1, spare, to),
  ];
}

export function towerMinMoves(discs: number): number {
  return 2 ** discs - 1;
}
