/* Lightweight orbital defence visuals, independent from combat logic.
 * Model geometries and beam meshes are shared/reused; all owned resources are disposed.
 */
(function(root) {
  'use strict';
  function createRenderer(THREE,scene,options={}) {
    if(!THREE || !scene) throw new TypeError('Defence renderer requires Three.js scene');
    const maxUnits=options.maxUnits||6;
    const maxBeams=options.maxBeams||12;
    const satelliteRoot=new THREE.Group();
    satelliteRoot.name='Planetary defence satellites';
    scene.add(satelliteRoot);

    const bodyGeometry=new THREE.CylinderGeometry(0.20,0.22,0.68,10);
    const panelGeometry=new THREE.BoxGeometry(0.96,0.035,0.42);
    const finGeometry=new THREE.BoxGeometry(0.12,0.12,0.58);
    const hubMaterial=new THREE.MeshStandardMaterial({color:0x8898aa,metalness:0.78,roughness:0.28});
    const panelMaterial=new THREE.MeshStandardMaterial({
      color:0x124e78,metalness:0.45,roughness:0.27,
      emissive:0x12517b,emissiveIntensity:0.18
    });
    const finMaterial=new THREE.MeshStandardMaterial({color:0x475569,metalness:0.6,roughness:0.32});
    const models=[];
    for(let i=0;i<maxUnits;i++){
      const model=new THREE.Group();
      model.name='Laser satellite '+(i+1);
      const hub=new THREE.Mesh(bodyGeometry,hubMaterial);
      model.add(hub);
      for(const sign of [-1,1]){
        const panel=new THREE.Mesh(panelGeometry,panelMaterial);
        panel.position.x=sign*0.71;
        model.add(panel);
        const mount=new THREE.Mesh(finGeometry,finMaterial);
        mount.rotation.y=Math.PI/2;
        mount.position.x=sign*0.32;
        model.add(mount);
      }
      model.scale.setScalar(0.86);
      satelliteRoot.add(model);
      models.push(model);
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
      mesh.name='Satellite defence laser beam';
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
      bodyGeometry.dispose();
      panelGeometry.dispose();
      finGeometry.dispose();
      beamGeometry.dispose();
      hubMaterial.dispose();
      panelMaterial.dispose();
      finMaterial.dispose();
      beams.forEach(b=>{scene.remove(b.mesh);b.mesh.material.dispose();});
      models.length=0;beams.length=0;
    }
    return Object.freeze({sync,fire,update,clear,dispose,getBeamCount:()=>beams.filter(b=>b.remaining>0).length});
  }

  const api=Object.freeze({createRenderer});
  root.GodSmashOrbitalDefenseRenderer=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
