import { generateFlow } from "../src/lib/duel/flow.server";
const t = Date.now();
for (let i = 0; i < 20; i++) generateFlow();
console.log("20 boards in", Date.now() - t, "ms");
