const test=require('node:test');
const assert=require('node:assert/strict');
const {createRenderer}=require('../src/render/drone-swarm-renderer.js');
const {createSwarm}=require('../src/simulation/drone-swarm.js');

function mockThree(){
  const created={geometries:[],materials:[],instances:[]};
  class BufferGeometry{
    constructor(){this.disposed=0;this.attributes={};created.geometries.push(this);}
    setAttribute(name,v){this.attributes[name]=v;return this;}
    computeVertexNormals(){this.normals=true;}
    dispose(){this.disposed++;}
  }
  class Float32BufferAttribute{constructor(values,size){this.array=values;this.itemSize=size;}}
  class MeshStandardMaterial{
    constructor(options){Object.assign(this,options);this.disposed=0;created.materials.push(this);}
    dispose(){this.disposed++;}
  }
  class InstancedMesh{
    constructor(geometry,material,count){
      this.geometry=geometry;this.material=material;this.count=count;this.matrices=[];
      this.instanceMatrix={needsUpdate:false,setUsage(usage){this.usage=usage;}};
      this.visible=true;created.instances.push(this);
    }
    setMatrixAt(i,matrix){this.matrices[i]={...matrix};}
  }
  class Object3D{
    constructor(){
      const vec=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}});
      this.position=vec();
      this.scale={value:1,setScalar(v){this.value=v;}};
      this.matrix={};
    }
    lookAt(v){this.aim={x:v.x,y:v.y,z:v.z};}
    updateMatrix(){this.matrix={x:this.position.x,y:this.position.y,
      z:this.position.z,scale:this.scale.value};}
  }
  class Vector3{set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
  return {THREE:{BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,
    InstancedMesh,Object3D,Vector3,DoubleSide:'both',DynamicDrawUsage:'dynamic'},created};
}
function makeScene(){
  return {children:[],add(obj){this.children.push(obj);},
    remove(obj){this.children=this.children.filter(x=>x!==obj);}};
}

test('hundreds of drones use exactly one InstancedMesh, geometry and material',()=>{
  for(const count of [192,312]){
    const {THREE,created}=mockThree(),scene=makeScene();
    const renderer=createRenderer(THREE,scene,{count});
    const sim=createSwarm({count});
    assert.equal(created.instances.length,1);
    assert.equal(created.geometries.length,1);
    assert.equal(created.materials.length,1);
    assert.equal(scene.children.length,1);
    assert.equal(renderer.mesh.count,count);
    renderer.sync(sim.getDrones());
    assert.equal(renderer.mesh.matrices.length,count);
    assert.ok(renderer.mesh.instanceMatrix.needsUpdate);
    assert.equal(renderer.mesh.instanceMatrix.usage,'dynamic');
    assert.equal(renderer.getDrawCallCount(),1);
    assert.ok(created.geometries[0].attributes.position.array.length>=80);
    sim.attack({x:1,y:0,z:0});
    for(let i=0;i<200;i++)sim.step(.05);
    renderer.sync(sim.getDrones());
    assert.ok(renderer.mesh.matrices.some(m=>m.scale<.01),
      'impacted drones disappear without mesh creation');
    renderer.dispose();renderer.dispose();
    assert.equal(scene.children.length,0);
    assert.equal(created.geometries[0].disposed,1);
    assert.equal(created.materials[0].disposed,1);
    assert.equal(renderer.getDrawCallCount(),0);
  }
});

test('invalid renderer instance count and missing instancing support are rejected',()=>{
  const {THREE}=mockThree();
  assert.throws(()=>createRenderer(THREE,makeScene(),{count:400}),RangeError);
  assert.throws(()=>createRenderer({},makeScene(),{count:192}),TypeError);
  assert.throws(()=>createRenderer(THREE,null,{count:192}),TypeError);
});
