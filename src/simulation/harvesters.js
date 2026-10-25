/* Fictional, mobile-bounded UFO crust-harvesting simulation.
 * Positions are in the planet's local frame; all durations are game seconds.
 * Graphics-independent so mobile timing and extraction can be regression-tested.
 */
(function(root){
  'use strict';
  const TAU=Math.PI*2;
  const GOLDEN=2.399963229728653;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
  const scale=(v,s)=>({x:v.x*s,y:v.y*s,z:v.z*s});
  const plus=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
  function unit(v){
    if(!v||![v.x,v.y,v.z].every(Number.isFinite))throw new TypeError('Finite target required');
    const length=Math.hypot(v.x,v.y,v.z);
    if(length<1e-8)throw new RangeError('Target direction cannot be zero');
    return scale(v,1/length);
  }
  function createFleet(options={}){
    const count=options.count??6;
    const radius=options.radius??10;
    if(!Number.isInteger(count)||count<1||count>12||
      !Number.isFinite(radius)||radius<=0)
      throw new RangeError('Invalid harvester fleet dimensions');
    let gameTime=0,missionTime=0,mode='hover',extractions=0;
    const ships=Array.from({length:count},(_,id)=>({
      id,phase:'hover',position:{x:0,y:0,z:0},
      normal:{x:0,y:1,z:0},target:{x:0,y:1,z:0},
      start:{x:0,y:0,z:0},hover:{x:0,y:0,z:0},
      beamActive:false,harvestElapsed:0,done:false,extracted:0
    }));
    function updateIdle(u,time){
      const i=u.id;
      const yaw=GOLDEN*i+time*(.13+.01*(i%3));
      const lat=.62*Math.sin(i*1.4+time*.08);
      const ring=Math.sqrt(1-lat*lat);
      const direction={x:ring*Math.cos(yaw),y:lat,z:ring*Math.sin(yaw)};
      u.normal=direction;
      const alt=radius+3.0+.32*Math.sin(time*1.4+i);
      u.position=scale(direction,alt);
    }
    ships.forEach(u=>updateIdle(u,0));
    function pointAt(surfaceNormal){
      if(mode==='spent')return false;
      const center=unit(surfaceNormal);
      let reference=Math.abs(center.y)>.93?{x:1,y:0,z:0}:{x:0,y:1,z:0};
      const tangent=unit({
        x:reference.y*center.z-reference.z*center.y,
        y:reference.z*center.x-reference.x*center.z,
        z:reference.x*center.y-reference.y*center.x
      });
      const bitangent={
        x:center.y*tangent.z-center.z*tangent.y,
        y:center.z*tangent.x-center.x*tangent.z,
        z:center.x*tangent.y-center.y*tangent.x
      };
      let any=false;
      for(const u of ships){
        if(u.done)continue;
        any=true;
        const theta=GOLDEN*u.id;
        const spread=.028+.072*Math.sqrt((u.id+.5)/count);
        u.target=unit(plus(center,plus(scale(tangent,spread*Math.cos(theta)),
          scale(bitangent,spread*Math.sin(theta)))));
        u.start={...u.position};
        u.hover=scale(u.target,radius+3.15+.28*(u.id%3));
        u.phase='approach';
        u.beamActive=false;
        u.harvestElapsed=0;
        u.missionDelay=u.id*.24;
        u.extracted=0;
      }
      if(any){missionTime=0;mode='mission';}
      return any;
    }
    function step(delta,onExtract){
      if(!Number.isFinite(delta)||delta<0)throw new TypeError('Invalid harvester delta');
      const dt=Math.min(delta,.12);
      if(!dt||mode==='spent')return [];
      gameTime+=dt;
      if(mode==='hover'){
        ships.forEach(u=>updateIdle(u,gameTime));
        return [];
      }
      missionTime+=dt;
      const results=[];
      for(const u of ships){
        if(u.done)continue;
        const clock=missionTime-u.missionDelay;
        if(clock<=0){updateIdle(u,gameTime);continue;}
        const approachDuration=1.8;
        const extractDuration=3.4;
        const exitDuration=2.4;
        if(clock<approachDuration){
          u.phase='approach';
          const t=clamp(clock/approachDuration,0,1);
          const smooth=t*t*(3-2*t);
          u.position=mix(u.start,u.hover,smooth);
          u.normal=unit(u.position);
          u.beamActive=false;u.harvestElapsed=0;
        }else if(clock<approachDuration+extractDuration){
          u.phase='extract';
          u.harvestElapsed=clock-approachDuration;
          const bob=.08*Math.sin(u.harvestElapsed*5.2+u.id);
          u.position=scale(u.target,radius+3.15+.28*(u.id%3)+bob);
          u.normal=u.target;
          u.beamActive=true;
          const thresholds=[.65,2.2];
          while(u.extracted<thresholds.length && u.harvestElapsed>=thresholds[u.extracted]){
            u.extracted++;
            extractions++;
            const event={
              id:u.id,cycle:u.extracted,normal:{...u.target},
              position:scale(u.target,radius),
              radius:.62,depth:.49,extractionIndex:extractions
            };
            results.push(event);
            if(typeof onExtract==='function')onExtract(event);
          }
        }else if(clock<approachDuration+extractDuration+exitDuration){
          u.phase='exit';u.beamActive=false;
          const t=(clock-approachDuration-extractDuration)/exitDuration;
          u.position=plus(scale(u.target,radius+3.4+15*t*t),
            {x:t*u.id*.16,y:t*.5,z:-t*u.id*.09});
          u.normal=unit(u.position);
        }else{
          u.phase='gone';u.beamActive=false;u.done=true;
          u.position=scale(u.target,radius+24);
        }
      }
      if(ships.every(u=>u.done))mode='spent';
      return results;
    }
    function dispose(){mode='spent';ships.length=0;}
    return Object.freeze({
      pointAt,step,dispose,
      getShips:()=>ships,
      getState:()=>Object.freeze({mode,count,extractions,
        active:ships.filter(u=>!u.done).length,missionTime}),
    });
  }
  const api=Object.freeze({createFleet});
  root.GodSmashHarvesters=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
