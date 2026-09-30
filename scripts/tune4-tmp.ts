import { hotfloorCourseRerolls, hotfloorCourseSurvivable } from "@/lib/arcade/hotFloor";
import { flipGame } from "@/lib/arcade/flip";
import { swingGame } from "@/lib/arcade/swing";
let rr = 0, mx = 0, ok = 0; const N = 100;
for (let i = 1; i <= N; i++) { const r = hotfloorCourseRerolls(i * 7919); rr += r; mx = Math.max(mx, r); if (hotfloorCourseSurvivable(i * 7919)) ok++; }
console.log(`hotfloor rerolls avg ${(rr / N).toFixed(2)} max ${mx}; guaranteed ${ok}/${N}`);
let a = 0, b = 0; const S = 30;
for (let i = 1; i <= S; i++) { const st: any = flipGame.init(i * 131); const segs = st.segs ?? st.course?.segs ?? st.obstacles; if (i === 1) console.log("flip keys", Object.keys(st)); if (!segs) continue;
  const X = st.xAt ?? null; }
const sw: any = swingGame.init(5); console.log("swing anchors", sw.anchors.length);
