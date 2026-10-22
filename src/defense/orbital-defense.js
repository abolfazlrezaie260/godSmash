/* Pure, graphics-free orbital defence simulation.
 * Unit positions and shots are gameplay abstractions, not satellite dynamics.
 */
(function(root) {
  'use strict';
  const TAU = Math.PI * 2;
  const lengthSquared = p => p.x*p.x + p.y*p.y + p.z*p.z;
  const distanceSquared = (a,b) => (a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2;
  const clamp = (x,min,max) => Math.max(min,Math.min(max,x));

  function visibleLine(from,to,planetRadius) {
    // Segment closest approach to planet origin; avoid shooting through the globe.
    const dx=to.x-from.x, dy=to.y-from.y, dz=to.z-from.z;
    const segmentSq=dx*dx+dy*dy+dz*dz;
    if (segmentSq < 1e-8) return true;
    const t=clamp(-(from.x*dx+from.y*dy+from.z*dz)/segmentSq,0,1);
    const qx=from.x+t*dx,qy=from.y+t*dy,qz=from.z+t*dz;
    return qx*qx+qy*qy+qz*qz >= planetRadius*planetRadius;
  }

  function createSystem(options) {
    const type = options && options.type;
    const radius = options && options.planetRadius || 10;
    if (!type || !(type.orbitRadius > radius) || !(type.range > 0) ||
        !(type.cooldown > 0) || !(type.damage > 0)) {
      throw new TypeError('Orbital defence requires a supported type and planet radius');
    }
    const maxCount = Math.max(...type.allowedCounts);
    let enabled = options.enabled !== false;
    let count = type.allowedCounts.includes(options.count) ? options.count : type.defaultCount;
    let elapsed=0, totalShots=0, interceptions=0;
    const units=Array.from({length:maxCount}, (_,i)=>({
      id:'defence-'+i, phase:0, cooldown:0, position:{x:0,y:0,z:0},
      active:false, shots:0
    }));
    function reposition() {
      for (let i=0;i<units.length;i++){
        const u=units[i];
        u.active=i<count;
        const phase=u.phase;
        // Two inclined orbital families, rather than one flat ring.
        const tilt = i%2===0 ? 0.33 : -0.53;
        const lane = Math.floor(i/2);
        const angle = phase + (lane/Math.ceil(maxCount/2))*TAU + (i%2)*Math.PI;
        u.position.x=type.orbitRadius*Math.cos(angle);
        u.position.y=type.orbitRadius*Math.sin(angle)*Math.sin(tilt);
        u.position.z=type.orbitRadius*Math.sin(angle)*Math.cos(tilt);
      }
    }
    function configure(next) {
      if (next && typeof next.enabled === 'boolean') enabled=next.enabled;
      if (next && next.count !== undefined) {
        if (!type.allowedCounts.includes(next.count)) throw new RangeError('Unsupported satellite count');
        count=next.count;
      }
      reposition();
    }
    function reset() {
      elapsed=0;totalShots=0;interceptions=0;
      units.forEach((u,i)=>{u.phase=0;u.cooldown=0;u.shots=0;});
      reposition();
    }

    function step(dt, targets, onShot) {
      if (!Number.isFinite(dt)||dt<0) throw new TypeError('Invalid simulation delta');
      const stepTime=Math.min(dt,0.2);
      elapsed+=stepTime;
      const events=[];
      units.forEach((u,i)=> {
        u.phase += type.angularSpeed*stepTime*(i%2 ? -1 : 1);
        u.cooldown=Math.max(0,u.cooldown-stepTime);
      });
      reposition();
      if (!enabled||count===0||!Array.isArray(targets)||!targets.length) return events;

      const shotsCap=Math.min(type.maxShotsPerStep||maxCount,maxCount);
      const rangeSq=type.range*type.range;
      // One target cannot be shot after being marked destroyed in the same frame.
      for(const unit of units){
        if(!unit.active || unit.cooldown>0 || events.length>=shotsCap)continue;
        let candidate=null, priority=Infinity;
        for(const target of targets){
          if(!target || target.destroyed || !(target.health>0) ||
             !target.position || target.progress>=1 || target.incoming===false)continue;
          if (lengthSquared(target.position)<=radius*radius)continue;
          const separation=distanceSquared(unit.position,target.position);
          if(separation>rangeSq || !visibleLine(unit.position,target.position,radius*1.02))continue;
          // The closest threat to the planet takes priority.
          const threat=lengthSquared(target.position)+separation*0.08;
          if (threat<priority){priority=threat;candidate=target;}
        }
        if(!candidate)continue;
        candidate.health=Math.max(0,candidate.health-type.damage);
        if(candidate.health===0){candidate.destroyed=true;interceptions++;}
        u.cooldown=type.cooldown;
        u.shots++;totalShots++;
        const evt={
          unitId:unit.id, targetId:candidate.id,
          from:{...unit.position}, to:{...candidate.position},
          destroyed:candidate.destroyed, remainingHealth:candidate.health
        };
        events.push(evt);
        if(typeof onShot==='function')onShot(evt);
      }
      return events;
    }

    reposition();
    return Object.freeze({
      step,reset,configure,visibleLine,
      getUnits:()=>units.filter(u=>u.active).map(u=>({id:u.id,position:{...u.position}})),
      getState:()=>Object.freeze({
        typeId:type.id, enabled, count, totalShots, interceptions,
        maxCount, elapsed
      })
    });
  }

  const api=Object.freeze({createSystem,visibleLine});
  root.GodSmashOrbitalDefense=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
