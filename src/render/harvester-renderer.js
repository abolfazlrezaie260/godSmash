/* GPU-friendly UFO fleet: one instanced saucer hull, one instanced layer of
 * harvested rock, and capped shared-geometry translucent tractor beams.
 * Planet-local coordinates follow planet rotation without per-frame transforms.
 */
(function(root){
  'use strict';
  function createRenderer(THREE,parent,options={}){
    const count=options.count??6, radius=options.radius??10;
    if(!THREE?.InstancedMesh||!THREE?.Mesh||!parent||
      !Number.isInteger(count)||count<1||count>12)
      throw new TypeError('A bounded Three.js instanced UFO renderer is required');
    const positions=[],colors=[];
    const layers=[
      {r:0,y:.23,c:[.35,.56,.72]},
      {r:.29,y:.17,c:[.47,.61,.68]},
      {r:.54,y:.045,c:[.27,.37,.47]},
      {r:.68,y:-.015,c:[.17,.58,.68]},
      {r:.47,y:-.13,c:[.24,.3,.37]},
      {r:.15,y:-.21,c:[.28,.33,.38]},
      {r:0,y:-.22,c:[.2,.28,.31]}
    ];
    const segments=16;
    const vertex=(p,c)=>{positions.push(...p);colors.push(...c);};
    for(let layer=0;layer<layers.length-1;layer++){
      const a=layers[layer],b=layers[layer+1];
      for(let j=0;j<segments;j++){
        const t=j*Math.PI*2/segments,n=(j+1)*Math.PI*2/segments;
        const a0=[a.r*Math.cos(t),a.y,a.r*Math.sin(t)];
        const a1=[a.r*Math.cos(n),a.y,a.r*Math.sin(n)];
        const b0=[b.r*Math.cos(t),b.y,b.r*Math.sin(t)];
        const b1=[b.r*Math.cos(n),b.y,b.r*Math.sin(n)];
        vertex(a0,a.c);vertex(b0,b.c);vertex(a1,a.c);
        vertex(a1,a.c);vertex(b0,b.c);vertex(b1,b.c);
      }
    }
    const hullGeo=new THREE.BufferGeometry();
    hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    hullGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    hullGeo.computeVertexNormals();
    const hullMat=new THREE.MeshStandardMaterial({
      vertexColors:true,metalness:.61,roughness:.38,side:THREE.DoubleSide
    });
    const ships=new THREE.InstancedMesh(hullGeo,hullMat,count);
    ships.name='Instanced planetary harvester UFOs';
    ships.frustumCulled=false;
    const fragmentsPerShip=4;
    const fragmentsGeo=new THREE.IcosahedronGeometry(.15,0);
    const fragmentsMat=new THREE.MeshStandardMaterial({
      color:0x878f8e,roughness:.93,metalness:0,flatShading:true
    });
    const debris=new THREE.InstancedMesh(fragmentsGeo,fragmentsMat,count*fragmentsPerShip);
    debris.name='Ascending extracted crust shards';
    debris.frustumCulled=false;
    const beamGeo=new THREE.CylinderGeometry(.09,.91,1,12,1,true);
    const beamMat=new THREE.MeshBasicMaterial({
      color:0x76e2ea,transparent:true,opacity:.18,depthWrite:false,
      blending:THREE.AdditiveBlending,side:THREE.DoubleSide
    });
    const beams=Array.from({length:count},()=>new THREE.Mesh(beamGeo,beamMat));
    for(const beam of beams){beam.name='Translucent tractor beam';beam.visible=false;parent.add(beam);}
    parent.add(ships);
    parent.add(debris);
    if(THREE.DynamicDrawUsage){
      ships.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    const dummy=new THREE.Object3D();
    const up=new THREE.Vector3(0,1,0);
    const normal=new THREE.Vector3();
    let disposed=false,activeBeams=0,activeShards=0;
    function sync(units){
      if(disposed)return;
      if(!Array.isArray(units)||units.length!==count)
        throw new RangeError('UFO count must match renderer instances');
      activeBeams=0;activeShards=0;
      for(let i=0;i<count;i++){
        const u=units[i],beam=beams[i],visible=!u.done;
        const n=u.normal;
        normal.set(n.x,n.y,n.z);
        dummy.position.set(u.position.x,u.position.y,u.position.z);
        dummy.quaternion.setFromUnitVectors(up,normal);
        dummy.scale.setScalar(visible?.72:0.000001);
        dummy.updateMatrix();
        ships.setMatrixAt(i,dummy.matrix);
        beam.visible=visible&&u.beamActive;
        if(beam.visible){
          activeBeams++;
          const a=radius+.05,dist=Math.max(.1,Math.hypot(u.position.x,u.position.y,u.position.z)-a);
          beam.position.set(n.x*(a+dist*.5),n.y*(a+dist*.5),n.z*(a+dist*.5));
          beam.quaternion.setFromUnitVectors(up,normal);
          beam.scale.set(.75,dist,.75);
        }
        for(let j=0;j<fragmentsPerShip;j++){
          const slot=i*fragmentsPerShip+j;
          const show=beam.visible&&u.harvestElapsed>j*.1;
          if(show){
            activeShards++;
            const p=(u.harvestElapsed*.32+j*.25)%1;
            const height=radius+.16+(Math.hypot(u.position.x,u.position.y,u.position.z)-radius-.28)*p;
            const angle=i*2.39+j*1.57;
            dummy.position.set(n.x*height+.17*Math.cos(angle)*(1-p),
              n.y*height+.1*Math.sin(angle)*(1-p),
              n.z*height+.17*Math.sin(angle)*(1-p));
            dummy.scale.setScalar(.6*(1-p)+.17);
          }else{
            dummy.position.set(0,0,0);
            dummy.scale.setScalar(.000001);
          }
          dummy.updateMatrix();
          debris.setMatrixAt(slot,dummy.matrix);
        }
      }
      ships.instanceMatrix.needsUpdate=true;
      debris.instanceMatrix.needsUpdate=true;
      debris.visible=activeShards>0;
      ships.visible=units.some(u=>!u.done);
    }
    function dispose(){
      if(disposed)return;disposed=true;
      parent.remove(ships);parent.remove(debris);
      for(const beam of beams)parent.remove(beam);
      for(const geometry of [hullGeo,fragmentsGeo,beamGeo])geometry.dispose();
      for(const material of [hullMat,fragmentsMat,beamMat])material.dispose();
    }
    return Object.freeze({sync,dispose,ships,debris,beams,
      getStats:()=>({drawCalls:disposed?0:2+activeBeams,
        activeBeams:disposed?0:activeBeams,
        activeShards:disposed?0:activeShards})
    });
  }
  const api=Object.freeze({createRenderer});
  root.GodSmashHarvesterRenderer=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
