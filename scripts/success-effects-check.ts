import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
let reduced=false;(globalThis as any).window={matchMedia:()=>({get matches(){return reduced}})};
const {successFrame,successHud,SUCCESS_TICKS,SUCCESS_PARTICLES}=await import('../src/lib/arcade/success.renderer');
assert.equal(SUCCESS_TICKS,30);assert.equal(SUCCESS_PARTICLES,16);
function frame(c:any,tick:number,count:number,extra:any={}){return successFrame(c,{id:'test',tick,count,colour:'#FFD84A',width:360,height:572,point:{x:180,y:200,shape:'pixel'},...extra})}
const canvas=createCanvas(360,572),c=canvas.getContext('2d');
assert.equal(frame(c,0,0).age,Infinity);assert.equal(frame(c,1,5).chain,5);assert.equal(frame(c,7,5).milestoneAge,6);
let texts=0;const fill=c.fillText.bind(c);c.fillText=(...a:any[])=>{texts++;fill(...a)};successHud(c,'test',7,10,10,()=>c.fillText('5',10,10));assert.equal(texts,1,'one real counter, no duplicate');
assert.equal(frame(c,31,5).age,Infinity);assert.equal(frame(c,32,6,{misses:1}).chain,1);
frame(c,0,0);assert.equal(frame(c,1,5).chain,5,'replay rewind reset');
const fresh=createCanvas(360,572).getContext('2d');assert.equal(frame(fresh,108,1,{eventTick:101}).age,7,'stamped success in fresh replay');assert.equal(frame(fresh,132,1,{eventTick:101}).age,Infinity,'old stamped event expires');
reduced=true;const rc=createCanvas(360,572).getContext('2d');let borders=0;rc.strokeRect=()=>{borders++};frame(rc,0,0);frame(rc,1,5);assert.equal(borders,0,'no reduced-motion edge pulse');assert.equal(frame(rc,11,5).age,Infinity,'reduced burst expires after 10 ticks');
console.log('Success checks passed: 30/10-tick expiry, 16-particle budget, one counter, misses reset, replay rewind, fresh stamped replay, reduced-motion edge suppression.');
