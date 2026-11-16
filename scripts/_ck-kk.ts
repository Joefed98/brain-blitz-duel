import { generateKakuroLevel, kakuroPersonSolve, type KakuroLevelSettings } from "../src/lib/duel/kakuro.server";
const L: Record<string, KakuroLevelSettings> = {
  easy: { size: 5, whiteMin: 12, whiteMax: 14, gradeMin: 0, gradeMax: 0, maxBlocks: 9, person: true },
  normal: { size: 6, whiteMin: 16, whiteMax: 19, gradeMin: 0, gradeMax: 4, maxBlocks: 7, person: true },
  expert: { size: 7, whiteMin: 26, whiteMax: 30, gradeMin: 4, gradeMax: 12, maxBlocks: 12, person: true },
};
for (const [k, st] of Object.entries(L)) {
  const t = performance.now(); const grades: number[] = []; const ws: number[] = [];
  const N = Number(process.argv[2] ?? 10);
  let maxMs = 0;
  for (let i = 0; i < N; i++) { const t0 = performance.now(); const p = generateKakuroLevel(i * 7919 + 1, st, 3); maxMs = Math.max(maxMs, performance.now() - t0); grades.push(p.grade!); ws.push(p.white.length); }
  console.log(k, "avg ms", ((performance.now() - t) / N).toFixed(0), "max", maxMs.toFixed(0), "grades", grades.join(","), "white", ws.join(","));
}
