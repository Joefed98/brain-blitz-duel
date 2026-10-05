/** Shared by the reveal and round summary; clean crossings no longer earn points. */
export function crossLine(r: { crossings: number; livesLost: number }): string {
  return `${r.crossings} crossing${r.crossings === 1 ? "" : "s"} · ${r.livesLost} ${r.livesLost === 1 ? "life" : "lives"} lost`;
}
