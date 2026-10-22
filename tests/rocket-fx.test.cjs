const test = require('node:test');
const assert = require('node:assert/strict');
const rocketFx = require('../src/render/rocket-fx.js');

class Vector3 {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
  addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
  multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
}
class Node {
  constructor(material=null){
    this.material=material;this.children=[];this.position=new Vector3();
    this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
  }
  add(item){this.children.push(item);return this;}
  remove(item){this.children=this.children.filter(x=>x!==item);return this;}
}
class Texture {constructor(canvas){this.image=canvas;this.disposals=0;}dispose(){this.disposals++;}}
class Material {
  constructor(options={}){Object.assign(this,options);this.disposals=0;}
  dispose(){this.disposals++;}
}
function mockThree(){
  return {
    Vector3, Sprite:Node, SpriteMaterial:Material, CanvasTexture:Texture,
    NormalBlending:1, AdditiveBlending:2
  };
}
function fakeDocument(){
  return {
    createElement(){
      const ctx={
        clearRect(){},fillRect(){},beginPath(){},ellipse(){},fill(){},
        createRadialGradient(){return {addColorStop(){}}}
      };
      return {width:0,height:0,getContext(){return ctx;}};
    }
  };
}

test('rocket trails and impact bursts use capped soft sprites and clean up',()=>{
  const originalDocument=global.document;
  global.document=fakeDocument();
  try {
    const THREE=mockThree(), scene=new Node();
    const system=rocketFx.createSystem(THREE,{scene,lowQuality:false,maxParticles:28});
    const direction=new Vector3(1,0,0);
    system.trail(new Vector3(2,0,0),direction,'strategic');
    assert.equal(system.getParticleCount(),1,'first trail emission is smoke');
    system.trail(new Vector3(3,0,0),direction,'strategic');
    assert.equal(system.getParticleCount(),3,'second trail also emits a hot fragment');
    system.burst(new Vector3(0,0,0),new Vector3(0,1,0),18,0xff6633);
    assert.equal(system.getParticleCount(),21);
    assert.equal(scene.children.length,21);
    assert.ok(scene.children.some(p=>p.material.blending===THREE.AdditiveBlending));
    assert.ok(scene.children.some(p=>p.material.blending===THREE.NormalBlending));
    system.update(0.08);
    assert.ok(system.getParticleCount() <= system.getMaxParticles());
    system.clear();
    assert.equal(system.getParticleCount(),0);
    assert.equal(scene.children.length,0);
    system.dispose();
    system.dispose();
  } finally { global.document=originalDocument; }
});

test('particle count never exceeds configured budget',()=>{
  const originalDocument=global.document;
  global.document=fakeDocument();
  try {
    const scene=new Node();
    const system=rocketFx.createSystem(mockThree(),{scene,lowQuality:true,maxParticles:24});
    for(let i=0;i<80;i++)system.trail(new Vector3(i,0,0),new Vector3(1,0,0),'strategic');
    system.burst(new Vector3(0,0,0),new Vector3(0,0,1),100);
    assert.equal(system.getParticleCount(),24);
    assert.equal(scene.children.length,24);
    system.dispose();
    assert.equal(scene.children.length,0);
  } finally { global.document=originalDocument; }
});
