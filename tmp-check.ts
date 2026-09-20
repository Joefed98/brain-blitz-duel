import { generateNonogram, nonoUsablePictograms } from "./src/lib/duel/nonogram.server";
import { generateFlood } from "./src/lib/duel/flood.server";
import { generatePairMatch } from "./src/lib/duel/pairmatch.server";
console.log("usable pictograms", nonoUsablePictograms().length);
console.time("nono"); for(let i=0;i<20;i++) generateNonogram(); console.timeEnd("nono");
console.time("flood");
for(let i=0;i<5;i++){ const f=generateFlood(); console.log("par",f.par, f.solution?.length); }
console.timeEnd("flood");
console.log(generatePairMatch().cards.length);
