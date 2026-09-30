import { inkReferenceCheck } from "@/lib/arcade/inkBridge";
let total = 0, all = 0; const t0 = performance.now(); const bl: number[][] = [];
for (let s = 1; s <= 40; s++) { const r = inkReferenceCheck(s * 7919); total += r.ok; if (r.ok === 10) all++; if (s <= 3) bl.push(r.blocks, r.ink); }
console.log(`levels ok ${total}/400, full seeds ${all}/40, ${((performance.now() - t0) / 40).toFixed(0)} ms/seed`); console.log(bl.map(String).join("\n"));
