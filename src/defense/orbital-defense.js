/* Graphics-free planetary defence simulation.
 * Player picks each orbit's starting position and unit type. Orbits, detection,
 * shield coverage and interception are bounded arcade approximations.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lenSq = p => p.x*p.x + p.y*p.y + p.z*p.z;
  const distSq = (a,b) => (a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
  const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
  const scale = (p,k) => ({x:p.x*k,y:p.y*k,z:p.z*k});
  function normalized(p) {
    if (!p || ![p.x,p.y,p.z].every(Number.isFinite)) throw new TypeError('Invalid orbit anchor');
    const mag = Math.sqrt(lenSq(p));
    if (mag<1e-6) throw new RangeError('Orbit anchor must not be zero');
    return {x:p.x/mag,y:p.y/mag,z:p.z/mag};
  }
  function visibleLine(from,to,planetRadius) {
    const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
    const d=dx*dx+dy*dy+dz*dz;
    if (d<1e-8) return true;
    const t=clamp(-(from.x*dx+from.y*dy+from.z*dz)/d,0,1);
    return (from.x+t*dx)**2+(from.y+t*dy)**2+(from.z+t*dz)**2 >= planetRadius*planetRadius;
  }
  const policies = Object.freeze(['nearest','fastest','strongest']);
  function createSystem(options={}) {
    const defaultType=options.type;
    const supplied=options.types || (defaultType ? [defaultType] : []);
    const types=new Map(supplied.map(t=>[t.id,t]));
    const radius=options.planetRadius||10;
    if (!types.size || !Number.isFinite(radius) || radius<=0 ||
      supplied.some(t=>!(t.orbitRadius>radius)||!(t.range>0)||!(t.cooldown>0)||!(t.damage>0))) {
      throw new TypeError('Orbital defence requires valid unit types and planet radius');
    }
    const initialType=defaultType&&types.has(defaultType.id)?defaultType:supplied[0];
    const maxCount=Math.min(6,Math.max(...supplied.flatMap(t=>t.allowedCounts||[6])));
    let enabled=options.enabled!==false, priority='nearest';
    let counter=0, shots=0, interceptions=0, elapsed=0;
    const units=[];

    function orbitalPosition(u) {
      const a=u.anchor;
      // Orbit's first point equals the exact surface direction picked by the player.
      const ref=Math.abs(a.y)>.9 ? {x:1,y:0,z:0} : {x:0,y:1,z:0};
      let tangent={x:ref.y*a.z-ref.z*a.y,y:ref.z*a.x-ref.x*a.z,z:ref.x*a.y-ref.y*a.x};
      tangent=normalized(tangent);
      const theta=u.phase;
      const r=u.type.orbitRadius;
      u.position.x=r*(a.x*Math.cos(theta)+tangent.x*Math.sin(theta));
      u.position.y=r*(a.y*Math.cos(theta)+tangent.y*Math.sin(theta));
      u.position.z=r*(a.z*Math.cos(theta)+tangent.z*Math.sin(theta));
    }
    function addSatellite(input={}) {
      if(units.length>=maxCount)return false;
      const typeId=input.typeId||initialType.id;
      const type=types.get(typeId);
      if(!type)throw new RangeError('Unknown defence type: '+typeId);
      const n=units.length;
      const fallback={x:Math.cos(n*TAU/maxCount),y:(n%2?-.28:.28),z:Math.sin(n*TAU/maxCount)};
      const anchor=normalized(input.anchor||fallback);
      const id='defence-'+(++counter);
      const unit={id,typeId,type,anchor,phase:0,cooldown:0,shots:0,
        position:{x:0,y:0,z:0}};
      orbitalPosition(unit);
      units.push(unit);
      return id;
    }
    function removeSatellite(id) {
      if(!units.length)return false;
      const index=id===undefined?units.length-1:units.findIndex(u=>u.id===id);
      if(index<0)return false;
      units.splice(index,1);
      return true;
    }
    function setPriority(next) {
      if(!policies.includes(next))throw new RangeError('Unknown target priority');
      priority=next;
    }
    function configure(next={}) {
      if(typeof next.enabled==='boolean')enabled=next.enabled;
      if(next.priority!==undefined)setPriority(next.priority);
      if(next.count!==undefined) {
        const count=next.count;
        if(!Number.isInteger(count)||count<0||count>maxCount)throw new RangeError('Unsupported satellite count');
        while(units.length>count)removeSatellite();
        while(units.length<count)addSatellite();
      }
    }
    if(options.count)configure({count:options.count});
    if(options.priority)setPriority(options.priority);
    function exportDeployment() {
      return units.map(u=>({typeId:u.typeId,anchor:{...u.anchor},phase:u.phase}));
    }
    function loadDeployment(items) {
      if(!Array.isArray(items)||items.length>maxCount)throw new RangeError('Invalid defence fleet');
      // Validate all entries before replacing an existing fleet.
      const checked=items.map(item=>{
        if(!item||!types.has(item.typeId))throw new RangeError('Unsupported fleet type');
        return {typeId:item.typeId,anchor:normalized(item.anchor),
          phase:Number.isFinite(item.phase)?item.phase:0};
      });
      units.length=0;
      for(const item of checked){
        addSatellite(item);
        const u=units[units.length-1];
        u.phase=item.phase;
        orbitalPosition(u);
      }
    }
    function reset() {
      elapsed=0;shots=0;interceptions=0;
      for(const u of units){u.cooldown=0;u.shots=0;orbitalPosition(u);}
    }
    const activeTarget=t => !!t&&!t.destroyed&&t.health>0&&t.position&&
      t.incoming!==false&&t.progress<1.001&&lenSq(t.position)>=radius*radius*.98;
    const speed=t=>Number.isFinite(t.flight?.velocity)?t.flight.velocity:
      Number.isFinite(t.weapon?.speed)?t.weapon.speed:0;
    const strength=t=>Number.isFinite(t.weapon?.damage)?t.weapon.damage:0;
    function score(t) {
      if(priority==='fastest')return -speed(t);
      if(priority==='strongest')return -strength(t);
      return lenSq(t.position);
    }
    function getRadar(targets=[]) {
      return targets.filter(activeTarget).sort((a,b)=>score(a)-score(b)||
        String(a.id).localeCompare(String(b.id))).slice(0,12).map(t=>({
        id:t.id,position:{x:t.position.x,y:t.position.y,z:t.position.z},
        label:t.weapon?.nameFa||'جسم مهاجم',progress:t.progress||0,
        distance:Math.max(0,Math.sqrt(lenSq(t.position))-radius),
        speed:speed(t),damage:strength(t),
        eta:Math.max(0,(1-(t.progress||0))/Math.max(0.001,speed(t)))
      }));
    }
    function step(dt,targets=[],onShot) {
      if(!Number.isFinite(dt)||dt<0)throw new TypeError('Invalid simulation delta');
      // Integration follows simulation time; capped to avoid giant background-tab leaps.
      const delta=Math.min(.2,dt);
      elapsed+=delta;
      for(const u of units){
        u.phase+=u.type.angularSpeed*delta;
        u.cooldown=Math.max(0,u.cooldown-delta);
        orbitalPosition(u);
      }
      const events=[];
      if(!enabled||!Array.isArray(targets)||!targets.length)return events;
      const ordered=targets.filter(activeTarget).sort((a,b)=>score(a)-score(b)||
        String(a.id).localeCompare(String(b.id)));
      for(const u of units) {
        if(u.cooldown>0||events.length>=maxCount)continue;
        const rangeSq=u.type.range*u.type.range;
        for(const target of ordered) {
          if(!activeTarget(target))continue;
          if(distSq(u.position,target.position)>rangeSq)continue;
          if(!visibleLine(u.position,target.position,radius*.975))continue;
          if(u.type.mode==='shield') {
            const radial=normalized(target.position);
            const emitter=normalized(u.position);
            const coverage=dot(radial,emitter);
            // Coverage is localized; only projectiles very close to the atmosphere qualify.
            if(coverage<.84||Math.sqrt(lenSq(target.position))>radius+2.4)continue;
          }
          target.health=Math.max(0,target.health-u.type.damage);
          if(target.health<=0){target.destroyed=true;interceptions++;}
          u.cooldown=u.type.cooldown;u.shots++;shots++;
          const event={unitId:u.id,typeId:u.typeId,mode:u.type.mode,
            color:u.type.beamColor,targetId:target.id,
            from:{...u.position},to:{...target.position},destroyed:!!target.destroyed,
            remainingHealth:target.health};
          events.push(event);
          if(typeof onShot==='function')onShot(event);
          break;
        }
      }
      return events;
    }
    return Object.freeze({
      step,reset,configure,addSatellite,removeSatellite,loadDeployment,
      exportDeployment,setPriority,getRadar,visibleLine,
      getUnits:()=>enabled?units.map(u=>({id:u.id,typeId:u.typeId,
        position:{...u.position},anchor:{...u.anchor}})):[],
      getState:()=>Object.freeze({typeId:initialType.id,enabled,count:units.length,
        maxCount,totalShots:shots,interceptions,elapsed,priority})
    });
  }
  const api=Object.freeze({createSystem,visibleLine,policies});
  root.GodSmashOrbitalDefense=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
