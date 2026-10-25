/* Lightweight simulation of a fictional orbital kamikaze-drone swarm.
 * Independent from Three.js, frame-rate stable and controlled by game time.
 * Drones begin as a visible moving flock, then follow staggered curved runs.
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
  const mul=(p,s)=>({x:p.x*s,y:p.y*s,z:p.z*s});
  function createSwarm(options={}){
    const count=options.count===undefined?240:options.count;
    const radius=options.planetRadius||10;
    const batchSize=options.batchSize||12;
    if(!Number.isInteger(count)||count<1||count>360||
      !(Number.isFinite(radius)&&radius>0)||
      !Number.isInteger(batchSize)||batchSize<1||batchSize>count)
      throw new RangeError('Invalid bounded swarm configuration');
    let elapsed=0,flightTime=0,mode='orbit',pending=0,impacts=0,used=0;
    let targetNormal=null;
    const drones=Array.from({length:count},(_,id)=>({
      id,visible:true,done:false,
      position:{x:0,y:0,z:0},direction:{x:0,y:0,z:1},
      start:{x:0,y:0,z:0},end:{x:0,y:0,z:0},
      control:{x:0,y:0,z:0},delay:0,duration:3.5
    }));
    function orbitPosition(drone,atTime){
      const i=drone.id;
      const theta=GOLDEN*i+atTime*(0.13+0.012*(i%6));
      const y=.63*Math.sin(i*1.641+atTime*.085);
      const r=radius*(1.29+(i%11)*.021);
      const ring=Math.sqrt(Math.max(0,1-y*y));
      const pos={x:r*ring*Math.cos(theta),y:r*y,z:r*ring*Math.sin(theta)};
      drone.position=pos;
      const tang={x:-Math.sin(theta),y:.085*Math.cos(i*1.641+atTime*.085),
        z:Math.cos(theta)};
      drone.direction=normalize(tang);
    }
    for(const drone of drones)orbitPosition(drone,0);
    function attack(surfaceNormal){
      const n=normalize(surfaceNormal);
      targetNormal=n;
      mode='attack';flightTime=0;
      const reference=Math.abs(n.y)>.9?{x:1,y:0,z:0}:{x:0,y:1,z:0};
      const tangent=normalize({
        x:reference.y*n.z-reference.z*n.y,
        y:reference.z*n.x-reference.x*n.z,
        z:reference.x*n.y-reference.y*n.x
      });
      const bitangent={
        x:n.y*tangent.z-n.z*tangent.y,
        y:n.z*tangent.x-n.x*tangent.z,
        z:n.x*tangent.y-n.y*tangent.x
      };
      const alive=drones.filter(d=>!d.done);
      if(!alive.length){mode='spent';return false;}
      alive.forEach((d,index)=>{
        d.start={...d.position};
        // Small irregular crater field: approximately 0.65 world units across.
        const angle=GOLDEN*d.id;
        const radial=radius*(.014+.054*Math.sqrt((d.id%43)/43));
        const aim=normalize(add(n,add(mul(tangent,radial*Math.cos(angle)),
          mul(bitangent,radial*Math.sin(angle)))));
        d.end=mul(aim,radius);
        const mid=mul(add(d.start,d.end),.5);
        d.control=mul(normalize(mid),Math.max(radius*1.22,Math.hypot(mid.x,mid.y,mid.z)+radius*.26));
        d.delay=(index/alive.length)*4.8;
        d.duration=3.35+(d.id%7)*.095;
      });
      return true;
    }
    function step(dt,onImpact){
      if(!Number.isFinite(dt)||dt<0)throw new TypeError('Invalid swarm delta');
      const delta=Math.min(dt,.12);
      if(delta===0||mode==='spent')return [];
      elapsed+=delta;
      const events=[];
      if(mode==='orbit'){
        for(const d of drones)if(!d.done)orbitPosition(d,elapsed);
        return events;
      }
      flightTime+=delta;
      for(const d of drones){
        if(d.done)continue;
        const t=clamp((flightTime-d.delay)/d.duration,0,1);
        if(t<=0)continue;
        if(t>=1){
          d.position={...d.end};
          d.done=true;d.visible=false;used++;pending++;
          if(pending>=batchSize || used===count){
            impacts++;
            const event={normal:normalize(d.end),count:pending,
              position:{...d.end},impactIndex:impacts};
            events.push(event);
            pending=0;
            if(typeof onImpact==='function')onImpact(event);
          }
          continue;
        }
        const e=1-t;
        const x=e*e*d.start.x+2*e*t*d.control.x+t*t*d.end.x;
        const y=e*e*d.start.y+2*e*t*d.control.y+t*t*d.end.y;
        const z=e*e*d.start.z+2*e*t*d.control.z+t*t*d.end.z;
        const tangent={
          x:2*e*(d.control.x-d.start.x)+2*t*(d.end.x-d.control.x),
          y:2*e*(d.control.y-d.start.y)+2*t*(d.end.y-d.control.y),
          z:2*e*(d.control.z-d.start.z)+2*t*(d.end.z-d.control.z)
        };
        d.position={x,y,z};
        d.direction=normalize(tangent);
      }
      if(used===count)mode='spent';
      return events;
    }
    function dispose(){mode='spent';drones.length=0;pending=0;}
    return Object.freeze({
      attack,step,dispose,
      getDrones:()=>drones,
      getState:()=>Object.freeze({mode,count,alive:count-used,impacts,
        target:targetNormal?{...targetNormal}:null,elapsed:flightTime}),
      getCount:()=>count
    });
  }
  const api=Object.freeze({createSwarm});
  root.GodSmashDroneSwarm=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
