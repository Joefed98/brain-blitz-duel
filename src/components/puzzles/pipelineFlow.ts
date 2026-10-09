import { PIPE_N, PIPE_E, PIPE_S, PIPE_W, tileOpenings } from '@/lib/duel/logic';
import type { PipeTile } from '@/lib/duel/types';
/** Presentation-only BFS distances. Never used to accept or grade an answer. */
export function pipelineDepths(tiles:PipeTile[],source:number,cols:number):Map<number,number>{
 const depths=new Map<number,number>();if(!tiles[source])return depths;
 const queue=[source];depths.set(source,0);
 for(let head=0;head<queue.length;head++){const cell=queue[head];if(cell===undefined)continue;const mask=tileOpenings(tiles[cell] ?? {sides:0});
  for(const [bit,opposite,dx,dy] of [[PIPE_N,PIPE_S,0,-1],[PIPE_E,PIPE_W,1,0],[PIPE_S,PIPE_N,0,1],[PIPE_W,PIPE_E,-1,0]]){
   if(bit===undefined||opposite===undefined||dx===undefined||dy===undefined)continue;
   const x=cell%cols+dx,y=Math.floor(cell/cols)+dy,next=y*cols+x;
   if(x<0||x>=cols||y<0||!tiles[next]||depths.has(next)||!(mask&bit)||!(tileOpenings(tiles[next])&opposite))continue;
   depths.set(next,(depths.get(cell)??0)+1);queue.push(next);
  }
 }return depths;
}