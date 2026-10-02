/** "5 crossings · 3 clean · 1 life lost" — shared by the reveal and the round summary. */
export function crossLine(r: { crossings: number; clean: number; livesLost: number }): string {
  return `${r.crossings} crossing${r.crossings === 1 ? "" : "s"} · ${r.clean} clean · ${r.livesLost} ${r.livesLost === 1 ? "life" : "lives"} lost`;
}
