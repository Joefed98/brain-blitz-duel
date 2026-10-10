/** Visual order only: every displayed slot keeps its original tile identity. */
export function shuffleLetterOrder(order: readonly number[], fixed?: number): number[] {
  const movable = order.filter((index) => index !== fixed);
  for (let i = movable.length - 1; i > 0; i--) {
    // Derived only from the current display order: recorded Shuffle taps replay identically.
    const j =
      (movable.reduce((sum, tile, index) => sum + (tile + 1) * (index + 3), 0) + i * 7) % (i + 1);
    const a = movable[i],
      b = movable[j];
    if (a !== undefined && b !== undefined) {
      movable[i] = b;
      movable[j] = a;
    }
  }
  // Ensure the visible arrangement changes, without changing any seeded data.
  if (
    movable.length > 1 &&
    movable.every((n, i) => n === order.filter((index) => index !== fixed)[i])
  ) {
    const first = movable.shift();
    if (first !== undefined) movable.push(first);
  }
  let cursor = 0;
  return order.map((index) => (index === fixed ? index : (movable[cursor++] ?? index)));
}
