import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
let hood:ArtCanvas|null=null;
/** Cached original hood and two-tail headband, confined to the body footprint. */
export function drawGrapplerHood(c:CanvasRenderingContext2D,x:number,y:number):void{
 if(!hood){const surface=artCanvas(24,24),ctx=surface?artContext(surface):null;if(surface&&ctx){ctx.scale(2,2);ctx.translate(8,10);
 ctx.fillStyle='#253541';ctx.beginPath();ctx.arc(0,-6.5,3.4,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#D2EEF0';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-6.5,3.1,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#D2EEF0';ctx.fillRect(-2.5,-7,5,1.5);ctx.fillStyle='#EB6BB3';ctx.fillRect(-3,-9,6,1.2);
 ctx.strokeStyle='#EB6BB3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-2.5,-8);ctx.lineTo(-7,-5);ctx.moveTo(-2.5,-8);ctx.lineTo(-5.5,-2);ctx.stroke();hood=surface;}}
 if(hood)c.drawImage(hood,x-8,y-10,12,12);
}