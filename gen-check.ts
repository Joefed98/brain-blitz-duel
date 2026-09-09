import { buildDuelPuzzles } from "./src/lib/duel/puzzles";
import { puzzleDef } from "./src/lib/duel/registry";
import { SEVEN_LETTER_WORDS, buildMissingLetters } from "./src/puzzles/missingLetters";
import { buildEquation, evaluateLeftToRight, OPERATORS } from "./src/puzzles/equation";
import { buildStroop } from "./src/puzzles/stroop";

console.log("bank size", SEVEN_LETTER_WORDS.length);

let bad = 0;
for (let i=0;i<400;i++){
  const p = buildMissingLetters();
  const matches = SEVEN_LETTER_WORDS.filter(c=>c.split("").every((l,j)=>p.blanks.includes(j)||l===p.word[j]!.toLowerCase()));
  const s=[...p.blanks].sort((a,b)=>a-b);
  const adj = s[1]===s[0]!+1 && s[2]===s[1]!+1;
  const firstTwo = s.filter(x=>x<2).length;
  if (matches.length!==1 || adj || firstTwo>1 || p.blanks.length!==3) { bad++; console.log("BAD", p, matches); }
}
console.log("missing bad:", bad);

let ebad=0;
for (let i=0;i<400;i++){
  const e = buildEquation();
  let sols=0;
  for (const a of OPERATORS) for (const b of OPERATORS) if (evaluateLeftToRight(e.numbers,[a,b])===e.target) sols++;
  const ok = sols===1 && e.target>=0 && e.target<=144 && e.numbers.every(n=>n>=1&&n<=12)
    && evaluateLeftToRight(e.numbers, e.operators)===e.target;
  if(!ok){ebad++;console.log("BAD EQ",e,sols);}
}
console.log("equation bad:", ebad);

let sbad=0;
for (let i=0;i<200;i++){
  const s = buildStroop();
  if (s.items.length!==10 || s.items.some(it=>it.word===it.ink)) {sbad++;}
}
console.log("stroop bad:", sbad);

const cats=new Set<string>(); const seen=new Set<string>();
for(let i=0;i<500;i++){
  const {roundOrder}=buildDuelPuzzles();
  const c=roundOrder.map(t=>puzzleDef(t).category);
  if(new Set(c).size!==3||new Set(roundOrder).size!==3) console.log("BAD ROUNDS",roundOrder);
  c.forEach(x=>cats.add(x)); roundOrder.forEach(t=>seen.add(t));
}
console.log("categories seen", [...cats], "types seen", [...seen].length);
