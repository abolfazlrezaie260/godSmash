const test=require('node:test');
const assert=require('node:assert/strict');
const landscape=require('../src/ui/landscape.js');

function harness({width=390,height=844,touch=true,lock=true}={}) {
  const classes=new Set();
  const listeners=new Map();
  const orientationEvents=new Map();
  const calls=[];
  const shell={
    classList:{
      toggle(name,on){if(on)classes.add(name);else classes.delete(name);},
      contains(name){return classes.has(name);}
    },
    setAttribute(name,value){this[name]=value;},
    get clientWidth(){return classes.has('is-rotated') ? Math.max(width,height):width;},
    get clientHeight(){return classes.has('is-rotated') ? Math.min(width,height):height;}
  };
  const view={
    innerWidth:width,innerHeight:height,navigator:{maxTouchPoints:touch?5:0},
    screen:{orientation:{
      lock:lock ? async mode=>{calls.push(mode);throw new Error('Fullscreen required');} : undefined,
      addEventListener(name,callback){orientationEvents.set(name,callback);},
      removeEventListener(name){orientationEvents.delete(name);}
    }},
    addEventListener(name,callback){listeners.set(name,callback);},
    removeEventListener(name){listeners.delete(name);}
  };
  const sizes=[];
  const controller=landscape.mount({
    view,document:{},shell,
    onResize:size=>sizes.push({...size})
  });
  return {
    view,shell,classes,controller,sizes,calls,listeners,orientationEvents,
    resize(w,h){width=w;height=h;view.innerWidth=w;view.innerHeight=h;
      listeners.get('resize')();},
    rotate(){orientationEvents.get('change')?.();}
  };
}

test('portrait phone uses full logical landscape viewport from the first frame',()=>{
  const h=harness();
  assert.equal(h.controller.isRotated(),true);
  assert.equal(h.classes.has('is-rotated'),true);
  assert.deepEqual(h.controller.getViewport(),{width:844,height:390});
  assert.deepEqual(h.sizes[0],{width:844,height:390});
  assert.equal(h.shell['data-landscape-mode'],'css-rotated');
});

test('rotation automatically follows physical device orientation and reverses safely',()=>{
  const h=harness();
  h.resize(844,390);
  assert.equal(h.controller.isRotated(),false);
  assert.deepEqual(h.controller.getViewport(),{width:844,height:390});
  assert.equal(h.shell['data-landscape-mode'],'native');
  h.resize(390,844);
  assert.equal(h.controller.isRotated(),true);
  assert.deepEqual(h.sizes.at(-1),{width:844,height:390});
  h.rotate();
  assert.equal(h.controller.isRotated(),true);
  h.controller.dispose();
  assert.equal(h.listeners.has('resize'),false);
  assert.equal(h.orientationEvents.size,0);
});

test('desktop narrow windows do not unexpectedly rotate',()=>{
  const h=harness({width:680,height:900,touch:false});
  assert.equal(h.controller.isRotated(),false);
  assert.deepEqual(h.controller.getViewport(),{width:680,height:900});
  h.resize(900,680);
  assert.equal(h.controller.isRotated(),false);
});

test('touch targeting coordinates map correctly after clockwise CSS rotation',()=>{
  const rect={left:0,top:0,right:390,bottom:844,width:390,height:844};
  const p=landscape.toLocalPoint(390,0,rect,true);
  assert.deepEqual(p,{x:0,y:0});
  assert.deepEqual(landscape.toLocalPoint(0,844,rect,true),{x:1,y:1});
  assert.deepEqual(landscape.toLocalPoint(195,422,rect,true),{x:.5,y:.5});
  assert.deepEqual(landscape.toLocalDelta(20,10,true),{x:10,y:-20});
  assert.deepEqual(landscape.toLocalDelta(20,10,false),{x:20,y:10});
  assert.deepEqual(landscape.toLocalPoint(42,90,{left:0,top:0,width:100,height:200,right:100},false),{x:.42,y:.45});
});

test('native landscape lock is best effort and does not prevent fallback',async()=>{
  const h=harness();
  h.listeners.get('pointerdown')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(h.calls,['landscape']);
  h.controller.tryNativeLock();
  assert.equal(h.calls.length,1);
  assert.equal(h.controller.isRotated(),true);
  const unsupported=harness({lock:false});
  assert.doesNotThrow(()=>unsupported.controller.tryNativeLock());
  assert.equal(unsupported.controller.isRotated(),true);
});

test('rotation utility validates input and unrotated landscape dimensions',()=>{
  assert.equal(landscape.wantsRotation(390,844,true),true);
  assert.equal(landscape.wantsRotation(844,390,true),false);
  assert.equal(landscape.wantsRotation(390,844,false),false);
  assert.equal(landscape.wantsRotation(0,0,true),false);
  assert.throws(()=>landscape.mount({}),TypeError);
});

test('upside-down portrait updates CSS direction and preserves touch coordinates',()=>{
  const h=harness();
  h.view.screen.orientation.type='portrait-secondary';
  h.rotate();
  assert.equal(h.classes.has('is-counterclockwise'),true);
  assert.equal(h.controller.isRotated(),true);
  const rect={left:0,top:0,right:390,bottom:844,width:390,height:844};
  assert.deepEqual(h.controller.point(0,844,rect),{x:0,y:0});
  assert.deepEqual(h.controller.point(390,0,rect),{x:1,y:1});
  assert.deepEqual(h.controller.delta(20,10),{x:-10,y:20});
  h.view.screen.orientation.type='portrait-primary';
  h.rotate();
  assert.equal(h.classes.has('is-counterclockwise'),false);
});

test('native orientation lock can enter fullscreen after user interaction',async()=>{
  const h=harness();
  h.controller.dispose();
  const calls=[];
  const document={fullscreenElement:null,documentElement:{
    requestFullscreen(){
      calls.push('fullscreen');
      document.fullscreenElement=this;
      return Promise.resolve();
    }
  }};
  h.view.screen.orientation.lock=async mode=>{calls.push(mode);};
  const controller=landscape.mount({
    view:h.view,document,shell:h.shell,onResize:()=>{}
  });
  h.listeners.get('pointerdown')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['fullscreen','landscape']);
  controller.dispose();
});
