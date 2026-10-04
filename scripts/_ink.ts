import { inkReferenceCheck } from "@/lib/arcade/inkBridge";
let bad = 0, notMore = 0, minAmp = 99, maxAmp = 0;
const N = Number(process.argv[2] ?? 60);
for (let i = 1; i <= N; i++) {
  const r = inkReferenceCheck(i * 104729);
  if (r.ok !== 10) bad++;
  if (r.blocks[9]! <= r.blocks[8]!) notMore++;
  for (const a of r.slides.slice(8)) { minAmp = Math.min(minAmp, a); maxAmp = Math.max(maxAmp, a); }
  if (r.slides.slice(0, 8).some((a) => a !== 0)) bad += 1000;
}
console.log({ N, bad, notMore, minAmp, maxAmp });
