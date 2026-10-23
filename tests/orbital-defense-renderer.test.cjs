const test=require('node:test');
const assert=require('node:assert/strict');
const renderer=require('../src/defense/orbital-defense-renderer.js');

const allocated={geometries:[],materials:[]};
class Geometry {
 constructor(){this.disposals=0;allocated.geometries.push(this);}
 dispose(){this.disposals++;}
}
class Material {
 constructor(props={}){Object.assign(this,props);this.disposals=0;allocated.materials.push(this);}
 dispose(){this.disposals++;}
}
class Vector3 {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 copy(v){return this.set(v.x,v.y,v.z);}
 add(v){return this.set(this.x+v.x,this.y+v.y,this.z+v.z);}
 multiplyScalar(k){return this.set(this.x*k,this.y*k,this.z*k);}
 subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z);}
 length(){return Math.hypot(this.x,this.y,this.z);}
}
class Node {
 constructor(){this.children=[];this.position=new Vector3();this.visible=true;
   this.rotation={x:0,y:0,z:0};this.quaternion={setFromUnitVectors(){}};
   this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z;},
     setScalar(k){this.x=k;this.y=k;this.z=k;}};
 }
 add(x){this.children.push(x);}
 remove(x){this.children=this.children.filter(y=>y!==x);}
 lookAt(){}
}
class Mesh extends Node {
 constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
const THREE={
 Group:Node,Mesh,Vector3,
 CylinderGeometry:Geometry,BoxGeometry:Geometry,
 MeshStandardMaterial:Material,MeshBasicMaterial:Material,
 AdditiveBlending:2
};

test('satellite and beam visuals share geometry and dispose owned resources exactly once',()=>{
 allocated.geometries.length=0;allocated.materials.length=0;
 const scene=new Node();
 const system=renderer.createRenderer(THREE,scene,{maxUnits:6,maxBeams:4});
 assert.equal(scene.children.length,5,'satellite root plus four pooled beams');
 const count=allocated.geometries.length;
 const mats=allocated.materials.length;
 assert.equal(count,9,'eight armoured defensive structures plus one shared beam geometry');
 assert.equal(mats,11,'seven armoured-satellite materials and four independent beam materials');

 const units=[
  {id:'d0',position:{x:13,y:0,z:0}},
  {id:'d1',position:{x:-13,y:0,z:0}}
 ];
 system.sync(units);
 const group=scene.children[0];
 assert.equal(group.children.filter(x=>x.visible).length,2);
 for(let i=0;i<40;i++){
   system.fire({x:13,y:0,z:0},{x:17,y:1,z:2});
 }
 assert.equal(system.getBeamCount(),4,'rendered shots are capped by pool');
 assert.equal(allocated.geometries.length,count,'no new geometry on additional shots');
 assert.equal(allocated.materials.length,mats,'no new materials on additional shots');
 system.update(1);
 assert.equal(system.getBeamCount(),0,'beam lifetime is bounded');
 system.clear();
 system.dispose();
 system.dispose();
 assert.equal(scene.children.length,0,'all scene objects detached');
 assert.ok(allocated.geometries.every(x=>x.disposals===1));
 assert.ok(allocated.materials.every(x=>x.disposals===1));
});
