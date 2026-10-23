/* Armoured orbital interceptor visuals, independent from defence combat logic.
 * Compact faceted hull, sensor turret and paired forward laser emitters.
 * No solar panels: this is a purpose-built fictional defensive drone.
 * Shared geometry/materials and pooled beams bound GPU allocations on phones.
 */
(function(root) {
  'use strict';
  function createRenderer(THREE,scene,options={}) {
    if(!THREE || !scene) throw new TypeError('Defence renderer requires Three.js scene');
    const maxUnits=options.maxUnits||6;
    const maxBeams=options.maxBeams||12;
    const satelliteRoot=new THREE.Group();
    satelliteRoot.name='Planetary defence interceptors';
    scene.add(satelliteRoot);

    const hullGeo=new THREE.CylinderGeometry(0.27,0.32,0.80,8);
    const armourGeo=new THREE.CylinderGeometry(0.35,0.31,0.43,6);
    const turretGeo=new THREE.CylinderGeometry(0.19,0.24,0.24,8);
    const barrelGeo=new THREE.CylinderGeometry(0.073,0.095,0.49,8);
    const muzzleGeo=new THREE.CylinderGeometry(0.089,0.089,0.055,10);
    const podGeo=new THREE.BoxGeometry(0.21,0.35,0.46);
    const braceGeo=new THREE.BoxGeometry(0.54,0.10,0.13);
    const sensorGeo=new THREE.BoxGeometry(0.19,0.14,0.19);
    const geometries=[hullGeo,armourGeo,turretGeo,barrelGeo,muzzleGeo,podGeo,braceGeo,sensorGeo];

    const hullMat=new THREE.MeshStandardMaterial({color:0x475569,metalness:0.75,roughness:0.32});
    const armourMat=new THREE.MeshStandardMaterial({color:0x1f2937,metalness:0.62,roughness:0.43,flatShading:true});
    const turretMat=new THREE.MeshStandardMaterial({color:0x64748b,metalness:0.76,roughness:0.28});
    const gunMat=new THREE.MeshStandardMaterial({color:0x111827,metalness:0.88,roughness:0.24});
    const lensMat=new THREE.MeshStandardMaterial({
      color:0x67e8f9,emissive:0x0891b2,emissiveIntensity:1.2,
      metalness:0.38,roughness:0.18
    });
    const sensorMat=new THREE.MeshStandardMaterial({
      color:0xf59e0b,emissive:0x92400e,emissiveIntensity:0.45,roughness:0.3
    });
    const detailMat=new THREE.MeshStandardMaterial({color:0x0c4a6e,metalness:0.74,roughness:0.35});
    const materials=[hullMat,armourMat,turretMat,gunMat,lensMat,sensorMat,detailMat];
    const models=[];
    for(let i=0;i<maxUnits;i++){
      const drone=new THREE.Group();
      drone.name='Armoured defence interceptor '+(i+1);
      const hull=new THREE.Mesh(hullGeo,hullMat);
      hull.name='Armoured central hull';
      drone.add(hull);
      const shell=new THREE.Mesh(armourGeo,armourMat);
      shell.name='Faceted protective plating';
      shell.position.y=0.04;
      drone.add(shell);

      const turret=new THREE.Mesh(turretGeo,turretMat);
      turret.name='Target tracking turret';
      turret.position.y=0.50;
      drone.add(turret);

      // Short compact protection pods instead of civilian solar arrays.
      for(const sign of [-1,1]){
        const brace=new THREE.Mesh(braceGeo,detailMat);
        brace.position.set(sign*0.30,0.10,0);
        drone.add(brace);
        const pod=new THREE.Mesh(podGeo,armourMat);
        pod.name='Armoured defensive pod';
        pod.position.set(sign*0.48,0.04,0.12);
        pod.rotation.z=sign*0.17;
        drone.add(pod);
        const gun=new THREE.Mesh(barrelGeo,gunMat);
        gun.name='Forward laser cannon';
        gun.rotation.x=Math.PI/2;
        gun.position.set(sign*0.48,0.07,0.46);
        drone.add(gun);
        const lens=new THREE.Mesh(muzzleGeo,lensMat);
        lens.name='Cyan laser emitter';
        lens.rotation.x=Math.PI/2;
        lens.position.set(sign*0.48,0.07,0.73);
        drone.add(lens);
      }
      const sensor=new THREE.Mesh(sensorGeo,sensorMat);
      sensor.name='Threat detection sensor';
      sensor.position.set(0,0.67,-0.08);
      drone.add(sensor);
      drone.scale.setScalar(1.12);
      drone.visible=false; // Deployed only by the player.
      satelliteRoot.add(drone);
      models.push(drone);
    }

    const beamGeometry=new THREE.CylinderGeometry(0.024,0.024,1,6,1,true);
    const laserColor=options.color||'#38e8ff';
    const beams=[];
    for(let i=0;i<maxBeams;i++){
      const material=new THREE.MeshBasicMaterial({
        color:laserColor,transparent:true,opacity:0,depthWrite:false,
        blending:THREE.AdditiveBlending
      });
      const mesh=new THREE.Mesh(beamGeometry,material);
      mesh.name='Orbital interceptor laser';
      mesh.visible=false;
      scene.add(mesh);
      beams.push({mesh,remaining:0,life:0.19});
    }
    const direction=new THREE.Vector3();
    const start=new THREE.Vector3();
    const finish=new THREE.Vector3();
    const midpoint=new THREE.Vector3();
    const axis=new THREE.Vector3(0,1,0);
    let cursor=0,disposed=false;

    function sync(units) {
      if(disposed)return;
      for(let i=0;i<models.length;i++){
        const unit=units[i];
        const m=models[i];
        m.visible=!!unit;
        if(!unit)continue;
        m.position.set(unit.position.x,unit.position.y,unit.position.z);
        m.lookAt(0,0,0);
      }
    }
    function fire(from,to) {
      if(disposed)return;
      const slot=beams[cursor];
      cursor=(cursor+1)%beams.length;
      start.set(from.x,from.y,from.z);
      finish.set(to.x,to.y,to.z);
      direction.subVectors(finish,start);
      const len=direction.length();
      if(len<1e-4)return;
      slot.mesh.position.copy(midpoint.copy(start).add(finish).multiplyScalar(0.5));
      slot.mesh.quaternion.setFromUnitVectors(axis,direction.multiplyScalar(1/len));
      slot.mesh.scale.set(1,len,1);
      slot.mesh.material.opacity=0.94;
      slot.remaining=slot.life;
      slot.mesh.visible=true;
    }
    function update(dt) {
      if(disposed)return;
      for(const beam of beams){
        if(beam.remaining<=0)continue;
        beam.remaining=Math.max(0,beam.remaining-Math.max(0,dt));
        beam.mesh.material.opacity=0.94*beam.remaining/beam.life;
        if(beam.remaining===0)beam.mesh.visible=false;
      }
    }
    function clear() {
      for(const b of beams){b.remaining=0;b.mesh.visible=false;}
    }
    function dispose() {
      if(disposed)return;
      disposed=true;
      clear();
      scene.remove(satelliteRoot);
      geometries.forEach(g=>g.dispose());
      materials.forEach(m=>m.dispose());
      beamGeometry.dispose();
      beams.forEach(b=>{scene.remove(b.mesh);b.mesh.material.dispose();});
      models.length=0;beams.length=0;
    }
    return Object.freeze({
      sync,fire,update,clear,dispose,
      getBeamCount:()=>beams.filter(b=>b.remaining>0).length
    });
  }

  const api=Object.freeze({createRenderer});
  root.GodSmashOrbitalDefenseRenderer=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
