/* Single-draw-call low-poly attack-drone visual for Three.js r128.
 * Every drone shares one BufferGeometry and one material via InstancedMesh.
 * Device quality controls instance count; no per-drone Mesh or GPU material.
 */
(function(root){
  'use strict';
  function createRenderer(THREE,scene,options={}){
    if(!THREE?.InstancedMesh||!THREE?.BufferGeometry||!scene)
      throw new TypeError('Three.js InstancedMesh renderer is required');
    const count=options.count||240;
    if(!Number.isInteger(count)||count<1||count>360)throw new RangeError('Invalid instance count');
    const geo=new THREE.BufferGeometry();
    const v=[];
    const tri=(a,b,c)=>v.push(...a,...b,...c);
    // Nose points down -Z (Object3D.lookAt faces -Z).
    const nose=[0,0,-.34],upper=[0,.085,.10],lower=[0,-.075,.12];
    const left=[-.13,-.015,.14],right=[.13,-.015,.14];
    const wingL=[-.30,-.025,.20],wingR=[.30,-.025,.20];
    const tail=[0,.105,.29],rear=[0,-.05,.31];
    tri(nose,left,upper);tri(nose,upper,right);
    tri(nose,lower,left);tri(nose,right,lower);
    tri(left,wingL,upper);tri(upper,wingR,right);
    tri(lower,rear,left);tri(lower,right,rear);
    tri(left,rear,tail);tri(tail,rear,right);
    geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
    geo.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({
      color:0x77879b,metalness:.66,roughness:.38,
      emissive:0x122638,emissiveIntensity:.24,side:THREE.DoubleSide
    });
    const mesh=new THREE.InstancedMesh(geo,material,count);
    mesh.name='GodSmash instanced kamikaze drones';
    mesh.frustumCulled=false;
    if(mesh.instanceMatrix?.setUsage && THREE.DynamicDrawUsage)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    const dummy=new THREE.Object3D();
    const aim=new THREE.Vector3();
    let disposed=false;
    function sync(drones){
      if(disposed)return;
      if(!Array.isArray(drones)||drones.length!==count)
        throw new RangeError('Instance count must match simulation');
      let visible=0;
      for(let i=0;i<count;i++){
        const d=drones[i];
        dummy.position.set(d.position.x,d.position.y,d.position.z);
        if(d.visible){
          dummy.lookAt(aim.set(d.position.x+d.direction.x,
            d.position.y+d.direction.y,d.position.z+d.direction.z));
          dummy.scale.setScalar(.68);
          visible++;
        }else{
          dummy.scale.setScalar(0.000001);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i,dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
      mesh.visible=visible>0;
    }
    function dispose(){
      if(disposed)return;
      disposed=true;
      scene.remove(mesh);
      geo.dispose();material.dispose();
    }
    return Object.freeze({sync,dispose,mesh,getDrawCallCount:()=>disposed?0:1});
  }
  const api=Object.freeze({createRenderer});
  root.GodSmashDroneSwarmRenderer=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
