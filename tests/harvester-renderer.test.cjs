const test=require('node:test');
const assert=require('node:assert/strict');
const {createRenderer}=require('../src/render/harvester-renderer.js');
const {createFleet}=require('../src/simulation/harvesters.js');

function mockThree(){
  const counters={geo:[],materials:[],instances:[],beams:[]};
  class BufferGeometry{
    constructor(){this.attributes={};this.disposals=0;counters.geo.push(this);}
    setAttribute(key,value){this.attributes[key]=value;}
    computeVertexNormals(){}
    dispose(){this.disposals++;}
  }
  class IcosahedronGeometry extends BufferGeometry {}
  class CylinderGeometry extends BufferGeometry {}
  class Float32BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}}
  class Material {
    constructor(props){Object.assign(this,props);this.disposals=0;counters.materials.push(this);}
    dispose(){this.disposals++;}
  }
  class Mesh{
    constructor(geo,mat){
      this.geometry=geo;this.material=mat;this.visible=true;
      this.position={set(){}};
      this.quaternion={setFromUnitVectors(){}};
      this.scale={set(){}};
      counters.beams.push(this);
    }
  }
  class InstancedMesh extends Mesh{
    constructor(geo,mat,count){
      super(geo,mat);this.count=count;this.matrices=[];
      this.instanceMatrix={needsUpdate:false,setUsage(usage){this.usage=usage;}};
      counters.instances.push(this);
    }
    setMatrixAt(index,m){this.matrices[index]={...m};}
  }
  class Object3D{
    constructor(){
      this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
      this.quaternion={setFromUnitVectors(){}};
      this.scale={value:1,setScalar(n){this.value=n;}};
      this.matrix={};
    }
    updateMatrix(){this.matrix={x:this.position.x,y:this.position.y,z:this.position.z,
      scale:this.scale.value};}
  }
  class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
  const THREE={BufferGeometry,IcosahedronGeometry,CylinderGeometry,
    Float32BufferAttribute,MeshStandardMaterial:Material,MeshBasicMaterial:Material,
    InstancedMesh,Mesh,Object3D,Vector3,
    DoubleSide:2,AdditiveBlending:1,DynamicDrawUsage:'dynamic'};
  return {THREE,counters};
}
function makeParent(){
  return {children:[],add(o){this.children.push(o);},
    remove(o){this.children=this.children.filter(x=>x!==o);}};
}
test('UFO hulls and rising crust shards share two draw calls and bounded beams',()=>{
  for(const count of [6,9]){
    const {THREE,counters}=mockThree(),group=makeParent();
    const renderer=createRenderer(THREE,group,{count,radius:10});
    const fleet=createFleet({count,radius:10});
    assert.equal(counters.instances.length,2);
    assert.equal(counters.geo.length,3);
    assert.equal(counters.materials.length,3);
    assert.equal(renderer.ships.count,count);
    assert.equal(renderer.debris.count,count*4);
    assert.equal(renderer.beams.length,count);
    assert.equal(group.children.length,count+2);
    renderer.sync(fleet.getShips());
    assert.equal(renderer.getStats().drawCalls,2);
    assert.equal(renderer.getStats().activeBeams,0);
    assert.ok(renderer.ships.instanceMatrix.needsUpdate);
    assert.ok(renderer.ships.matrices.every(m=>m.scale>.1));
    assert.ok(renderer.debris.matrices.every(m=>m.scale<.01));
    fleet.pointAt({x:0,y:0,z:1});
    for(let i=0;i<50;i++)fleet.step(.05);
    renderer.sync(fleet.getShips());
    assert.ok(renderer.getStats().activeBeams>=1);
    assert.ok(renderer.getStats().activeShards>0);
    assert.equal(renderer.getStats().drawCalls,2+renderer.getStats().activeBeams);
    fleet.dispose();renderer.dispose();renderer.dispose();
    assert.equal(group.children.length,0);
    assert.ok(counters.geo.every(g=>g.disposals===1));
    assert.ok(counters.materials.every(m=>m.disposals===1));
    assert.equal(renderer.getStats().drawCalls,0);
  }
});
test('renderer refuses invalid arguments and mismatching instance sizes',()=>{
  const {THREE}=mockThree(),scene=makeParent();
  assert.throws(()=>createRenderer({},scene),TypeError);
  assert.throws(()=>createRenderer(THREE,scene,{count:13}),TypeError);
  const r=createRenderer(THREE,scene,{count:6});
  assert.throws(()=>r.sync([]),RangeError);
  r.dispose();
});
