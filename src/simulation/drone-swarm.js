/* Cinematic reusable drone strike squadrons.
 * No worldwide idle orbit and no kamikaze disappearance on impact.
 * Drones deploy only after target selection, approach in compact waves,
 * make a low-altitude attack pass, and visibly return to their launch corridor.
 * Pure, deterministic game-time simulation independent from Three.js.
 */
(function(root){
  'use strict';
  const TAU=Math.PI*2, GOLDEN=2.399963229728653;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const normalize=p=>{
    if(!p||![p.x,p.y,p.z].every(Number.isFinite))throw new TypeError('Invalid target');
    const n=Math.hypot(p.x,p.y,p.z);
    if(n<1e-8)throw new RangeError('Target normal cannot be zero');
    return {x:p.x/n,y:p.y/n,z:p.z/n};
  };
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const mul=(p,s)=>({x:p.x*s,y:p.y*s,z:p.z*s});
  const length=p=>Math.hypot(p.x,p.y,p.z);
  function curve(a,c,b,t){
    const v=1-t;
    return add(add(mul(a,v*v),mul(c,2*v*t)),mul(b,t*t));
  }
  function tangent(a,c,b,t){
    return add(mul(sub(c,a),2*(1-t)),mul(sub(b,c),2*t));
  }
  function createSwarm(options={}){
    const count=options.count===undefined?36:options.count;
    const radius=options.planetRadius||10;
    const batchSize=options.batchSize||6;
    if(!Number.isInteger(count)||count<1||count>360||
      !(Number.isFinite(radius)&&radius>0)||
      !Number.isInteger(batchSize)||batchSize<1||batchSize>count)
      throw new RangeError('Invalid bounded swarm configuration');
    let elapsed=0,flightTime=0,mode='ready',impacts=0,completed=0,sorties=0,disposed=false;
    let targetNormal=null;
    const drones=Array.from({length:count},(_,id)=>({
      id,visible:false,done:false,struck:false,
      position:{x:0,y:0,z:0},direction:{x:0,y:0,z:1},
      start:{x:0,y:0,z:0},strike:{x:0,y:0,z:0},exit:{x:0,y:0,z:0},
      controlIn:{x:0,y:0,z:0},controlOut:{x:0,y:0,z:0},
      delay:0,duration:2.5,returnDuration:2.5
    }));
    function attack(surfaceNormal){
      if(disposed)return false;
      const n=normalize(surfaceNormal);
      const reference=Math.abs(n.y)>.9?{x:1,y:0,z:0}:{x:0,y:1,z:0};
      const side=normalize({x:reference.y*n.z-reference.z*n.y,
        y:reference.z*n.x-reference.x*n.z,z:reference.x*n.y-reference.y*n.x});
      const up=normalize({x:n.y*side.z-n.z*side.y,
        y:n.z*side.x-n.x*side.z,z:n.x*side.y-n.y*side.x});
      targetNormal=n;mode='attack';flightTime=0;completed=0;sorties++;
      for(let i=0;i<count;i++){
        const d=drones[i];
        const wave=Math.floor(i/batchSize),lane=i%batchSize;
        const angle=GOLDEN*i;
        const near=0.009+0.028*Math.sqrt((i%31)/31);
        const aim=normalize(add(n,
          add(mul(side,near*Math.cos(angle)),mul(up,near*Math.sin(angle)))));
        d.strike=mul(aim,radius*1.027); // fly over the surface, never crash into it
        // Every wave enters from one compact, local flight corridor instead of
        // placing hundreds of tiny triangles around the planet.
        const spread=(lane-(batchSize-1)/2)*radius*0.019;
        const stagger=((i*17)%7-3)*radius*0.006;
        const staging=add(
          add(mul(n,radius*(1.33+(lane%3)*0.011)),
              mul(side,radius*(-0.46+wave*0.013))),
          mul(up,spread+stagger));
        // Nearby retargets preserve continuity; targets across the globe
        // launch a new sortie near the new destination, not through the planet.
        const continuous=d.visible && length(d.position)>radius*1.02 &&
          (d.position.x*n.x+d.position.y*n.y+d.position.z*n.z)/length(d.position)>0.55;
        d.start=continuous?{...d.position}:staging;
        d.exit=staging;
        const midway=mul(add(d.start,d.strike),0.5);
        d.controlIn=add(midway,mul(n,radius*0.19));
        const retreatMid=mul(add(d.strike,d.exit),0.5);
        d.controlOut=add(retreatMid,add(mul(n,radius*0.24),mul(up,radius*0.045)));
        d.delay=wave*0.47+lane*0.035;
        d.duration=2.25+(i%5)*0.085;
        d.returnDuration=2.2+(i%4)*0.10;
        d.struck=false;d.done=false;
        d.visible=false;
        d.position={...d.start};
        d.direction=normalize(sub(d.controlIn,d.start));
      }
      return true;
    }
    function step(dt,onImpact){
      if(!Number.isFinite(dt)||dt<0)throw new TypeError('Invalid swarm delta');
      if(disposed||mode!=='attack'||dt===0)return [];
      const delta=Math.min(dt,0.12);
      elapsed+=delta;flightTime+=delta;
      const events=[];
      let returned=0;
      const hitsByWave=new Map();
      for(const d of drones){
        if(d.done){returned++;continue;}
        const local=flightTime-d.delay;
        if(local<0){d.visible=false;continue;}
        d.visible=true;
        if(local<d.duration){
          const t=clamp(local/d.duration,0,1);
          d.position=curve(d.start,d.controlIn,d.strike,t);
          d.direction=normalize(tangent(d.start,d.controlIn,d.strike,t));
          continue;
        }
        if(!d.struck){
          d.struck=true;
          const wave=Math.floor(d.id/batchSize);
          hitsByWave.set(wave,(hitsByWave.get(wave)||0)+1);
        }
        // A brief, visible low-level strike before the drones climb home.
        const homeTime=Math.max(0,local-d.duration-0.12);
        if(homeTime<d.returnDuration){
          const t=clamp(homeTime/d.returnDuration,0,1);
          d.position=curve(d.strike,d.controlOut,d.exit,t);
          d.direction=normalize(tangent(d.strike,d.controlOut,d.exit,t));
        }else{
          d.position={...d.exit};d.visible=false;d.done=true;
          returned++;
        }
      }
      // Apply damage in coordinated squad waves (one impact event per group).
      // A frame may cross multiple arrivals when the simulation runs at 2x.
      for(const [wave] of hitsByWave){
        const first=wave*batchSize;
        const end=Math.min(count,first+batchSize);
        if(!drones.slice(first,end).every(d=>d.struck))continue;
        // Exactly one event per wave, regardless of return travel.
        const leader=drones[first];
        if(leader.waveRegistered)continue;
        leader.waveRegistered=true;
        const normal=normalize(leader.strike);
        const event={normal,count:end-first,position:mul(normal,radius),
          impactIndex:++impacts,sortie:sorties};
        events.push(event);
      }
      // All waves have departed: no drone remains on screen or in orbit.
      completed=returned;
      if(returned===count)mode='ready';
      if(typeof onImpact==='function')for(const event of events){
        onImpact(event);
        if(disposed)break;
      }
      return events;
    }
    function dispose(){
      if(disposed)return;
      disposed=true;mode='spent';drones.length=0;completed=0;
    }
    return Object.freeze({
      attack,step,dispose,getDrones:()=>drones,
      getState:()=>Object.freeze({
        mode,count,alive:count-completed,active:drones.filter(d=>d.visible).length,
        impacts,sorties,target:targetNormal?{...targetNormal}:null,elapsed:flightTime
      }),
      getCount:()=>count
    });
  }
  const api=Object.freeze({createSwarm});
  root.GodSmashDroneSwarm=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
