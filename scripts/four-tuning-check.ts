import { hotFloorGame, hotfloorCourseSurvivable } from "@/lib/arcade/hotFloor";
import { orbitGame } from "@/lib/arcade/orbit";
import { swingGame } from "@/lib/arcade/swing";
import { tiltGame } from "@/lib/arcade/tilt";

let ok = 0;
for (let seed = 1; seed <= 200; seed++) if (hotfloorCourseSurvivable(seed * 7919)) ok++;
console.log(`hotfloor perfect-play survivable: ${ok}/200`);
const hf = hotFloorGame.init(5);
for (const t of [0, 2304, 3600]) console.log(`hotfloor score at ${t / 60}s:`, hotFloorGame.score({ ...hf, tick: t }));
const sw = swingGame.init(5);
console.log("swing score 30s/60s:", swingGame.score({ ...sw, tick: 1800 }), swingGame.score({ ...sw, tick: 3600 }));
const ti = tiltGame.init(5);
console.log("tilt runTicks", tiltGame.runTicks, "score 3/5/7 mazes:", [3, 5, 7].map((m) => tiltGame.score({ ...ti, mazes: m, ended: 1 })));
const o = orbitGame.init(9);
console.log("orbit planets", o.planets.length - 1, "rings px:", [1, 11, 21, 31, 41, 51, 60].map((i) => o.planets[i]!.ring / 256));
console.log("orbit hazards on:", o.planets.map((p, i) => (p.hazard >= 0 ? i : -1)).filter((i) => i >= 0).join(","));
console.log("orbit score 47 passed:", orbitGame.score({ ...o, cur: 47 }), "finished 51.6s:", orbitGame.score({ ...o, cur: 60, finished: 1, tick: 3096 }));
