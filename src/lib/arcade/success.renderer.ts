/** Presentation only: existing counters/stamped events, no sim/audio/input writes. */
import { reducedMotion } from './art.renderer';
export const SUCCESS_TICKS = 30;
export const SUCCESS_PARTICLES = 16;
export const SUCCESS_ACCENTS = {gold:'#FFD84A',orange:'#FF8A3C',white:'#F4FFF8',green:'#3DDC84',cyan:'#3DFFE0',pink:'#FF4DFF'} as const;
export type SuccessShape='spark'|'pixel'|'ring'|'fish'|'bubble'|'splat'|'tick'|'line';
export interface SuccessPoint{x:number;y:number;shape?:SuccessShape;label?:string|undefined;radius?:number}
interface Reward extends SuccessPoint{at:number;milestone:boolean}
interface Memory{tick:number;count:number;misses:number;chain:number;edge:number;rewards:Reward[];event:number}
const memories=new WeakMap<CanvasRenderingContext2D,Map<string,Memory>>();
export interface SuccessOptions{id:string;tick:number;count:number;misses?:number;every?:number;colour:string;width:number;height:number;point:SuccessPoint;eventTick?:number|undefined;enabled?:boolean;hud?:{x:number;y:number;text:string}}
export function successFrame(c:CanvasRenderingContext2D,o:SuccessOptions):{chain:number;age:number;milestoneAge:number}{
 let map=memories.get(c);if(!map){map=new Map();memories.set(c,map)}
 let m=map.get(o.id);const misses=o.misses??0;
 if(!m||o.tick<m.tick||o.count<m.count){m={tick:o.tick,count:o.count,misses,chain:0,edge:-Infinity,rewards:[],event:-Infinity};map.set(o.id,m)}
 const gained=o.tick!==m.tick&&o.count>m.count,delta=Math.max(0,o.count-m.count);
 if(misses>m.misses)m.chain=0;if(gained)m.chain+=delta;
 const stamped=o.eventTick!==undefined&&o.eventTick>0&&o.eventTick!==m.event&&o.tick>=o.eventTick&&o.tick-o.eventTick<SUCCESS_TICKS;
 if((gained||stamped)&&o.enabled!==false){const at=stamped?(o.eventTick??o.tick):o.tick,every=o.every??5;const milestone=gained&&Math.floor(m.chain/every)>Math.floor(Math.max(0,m.chain-delta)/every)&&at-m.edge>=20;
 if(milestone)m.edge=at;m.rewards.push({...o.point,at,milestone});if(m.rewards.length>4)m.rewards.shift()}
 m.tick=o.tick;m.count=o.count;m.misses=misses;m.event=o.eventTick??m.event;
 const still=reducedMotion(),duration=still?10:SUCCESS_TICKS;m.rewards=m.rewards.filter(r=>o.tick-r.at>=0&&o.tick-r.at<duration);
 c.save();c.beginPath();c.rect(0,0,o.width,o.height);c.clip();c.shadowBlur=0;let budget=SUCCESS_PARTICLES;
 for(const r of m.rewards){const count=Math.min(budget,still?2:r.milestone?8:4);budget-=count;paint(c,r,(o.tick-r.at)/duration,o.colour,count,still)}
 const milestoneAge=o.tick-m.edge;
 if(!still&&milestoneAge>=0&&milestoneAge<SUCCESS_TICKS){const p=milestoneAge/SUCCESS_TICKS;c.strokeStyle=o.colour;for(let i=0;i<3;i++){c.globalAlpha=Math.sin(Math.PI*p)*.13*(1-i/3);c.lineWidth=2+i*3;c.strokeRect(5,5,o.width-10,o.height-10)}
}

 c.restore();return{chain:m.chain,age:m.rewards.length?o.tick-(m.rewards.at(-1)?.at??o.tick):Infinity,milestoneAge};
}
function paint(c:CanvasRenderingContext2D,r:Reward,p:number,colour:string,count:number,still:boolean){
 c.save();c.globalAlpha=Math.min(.8,1-p);c.fillStyle=colour;c.strokeStyle=colour;c.lineWidth=1.5;const move=still?0:p,rad=r.radius??12,shape=r.shape??'spark';
 if(shape==='ring'){c.beginPath();c.arc(r.x,r.y,rad+move*20,0,Math.PI*2);c.stroke()}
 else if(shape==='line'){c.beginPath();c.moveTo(r.x-rad,r.y);c.lineTo(r.x+rad,r.y);c.stroke()}
 else if(shape==='tick'){c.beginPath();c.moveTo(r.x-6,r.y);c.lineTo(r.x-1,r.y+5);c.lineTo(r.x+8,r.y-7);c.stroke()}
 else for(let k=0;k<count;k++){const a=k*2.39996+.4,d=5+move*(r.milestone?24:16),x=r.x+Math.cos(a)*d,y=r.y+Math.sin(a)*d-move*5;
 if(shape==='fish'){c.beginPath();c.ellipse(x,y,3,1.6,a,0,Math.PI*2);c.fill();c.fillRect(x+3,y-2,2,4)}
 else if(shape==='bubble'){c.beginPath();c.arc(x,y-move*14,1.5+k%3,0,Math.PI*2);c.stroke()}
 else if(shape==='splat'){c.globalAlpha=(1-p)*.28;c.beginPath();c.ellipse(x,y,3+k%3,2,a,0,Math.PI*2);c.fill()}
 else if(shape==='pixel')c.fillRect(Math.round(x),Math.round(y),3,2);
 else{c.beginPath();c.moveTo(x-2,y);c.lineTo(x+2,y);c.moveTo(x,y-2);c.lineTo(x,y+2);c.stroke()}}
 if(r.label){c.globalAlpha=1-p;c.font="700 16px 'JetBrains Mono', monospace";c.textAlign='center';c.textBaseline='bottom';c.fillText(r.label,r.x,r.y-rad-4-move*6)}c.restore();
}

/** Pop the real readout in its existing slot; never paint duplicate counter text. */
export function successHud(c:CanvasRenderingContext2D,id:string,tick:number,x:number,y:number,draw:()=>void):void {
 const m=memories.get(c)?.get(id),age=m?tick-m.edge:Infinity;
 const scale=!reducedMotion()&&age>=0&&age<SUCCESS_TICKS?1+.09*Math.sin(Math.PI*age/SUCCESS_TICKS):1;
 c.save();c.translate(x,y);c.scale(scale,scale);c.translate(-x,-y);draw();c.restore();
}
