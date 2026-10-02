import { inputAt, recordInput, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { snipGame, snipTestLevel } from "@/lib/arcade/snip";
const cutFor = (s: any, i: number): ArcadeInputEvent => { const r=s.ropes[i]; const x=(r.x[0]+r.x[1])/512, y=(r.y[0]+r.y[1])/512; const dx=(r.y[1]-r.y[0])/256, dy=(r.x[0]-r.x[1])/256; const L=Math.max(1,Math.hypot(dx,dy)); return {t:s.tick+1,k:12,a:Math.round(x-dx/L*15),b:Math.round(y-dy/L*15),c:Math.round(x+dx/L*15),d:Math.round(y+dy/L*15)}; };
const t = Number(process.argv[2]); const yLine = Number(process.argv[3]);
const pts: string[] = [];
for (let at = 1; at <= 240; at += 8) {
  let s = snipTestLevel(t, 0); const log: ArcadeInputEvent[] = []; let path = "";
  for (let k = 0; k < 600; k++) {
    if (s.levelTick + 1 === at) for (let i=0;i<s.ropes.length;i++) if (i===Number(process.argv[4]??0)) recordInput(log, cutFor(s, i), snipGame.inputRanges);
    const lv = s.level; const prevY = s.sy;
    s = snipGame.step(s, inputAt(log, s.tick + 1));
    if (s.level !== lv) { path += " end"; break; }
    if (k % 20 === 0) path += ` (${s.sx>>8},${s.sy>>8})`;
    if (prevY < yLine*256 && s.sy >= yLine*256) { path = `cross y${yLine} at x=${s.sx>>8}` ; break; }
  }
  pts.push(`cut@${at}: ${path.slice(0,160)}`);
}
console.log(pts.join("\n"));
