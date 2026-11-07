'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {mount}=require('../src/ui/app-lifecycle.js');

function emitter(){
  const handlers=new Map();
  return {
    handlers,hidden:false,
    addEventListener(name,fn){handlers.set(name,fn);},
    removeEventListener(name,fn){if(handlers.get(name)===fn) handlers.delete(name);},
    emit(name,arg){handlers.get(name)?.(arg);}
  };
}
function setup(){
  const view=emitter(),document=emitter(),events=[],backs=[];
  const nativeHandlers=new Map(),removed=[];
  const app={addListener(name,fn){
    nativeHandlers.set(name,fn);
    return Promise.resolve({remove(){removed.push(name);nativeHandlers.delete(name);return Promise.resolve();}});
  }};
  const life=mount({view,document,app,onActive:active=>events.push(active),onBack:()=>backs.push(1)});
  return {view,document,app,events,backs,removed,nativeHandlers,life};
}

test('background/foreground events are coalesced without duplicate simulation callbacks',async()=>{
  const h=setup();await Promise.resolve();
  assert.equal(h.life.isActive(),true);
  h.view.emit('pagehide');
  h.document.hidden=true;h.document.emit('visibilitychange');
  h.nativeHandlers.get('appStateChange')({isActive:false});
  assert.deepEqual(h.events,[false]);
  assert.equal(h.life.isActive(),false);
  h.document.hidden=false;h.nativeHandlers.get('appStateChange')({isActive:true});
  h.view.emit('pageshow');
  assert.deepEqual(h.events,[false,true]);
  h.life.destroy();
});

test('Android Back dispatches once and native listener handles are removed',async()=>{
  const h=setup();await Promise.resolve();await Promise.resolve();
  h.nativeHandlers.get('backButton')({canGoBack:false});
  assert.equal(h.backs.length,1);
  h.life.destroy();
  assert.equal(h.view.handlers.size,0);
  assert.equal(h.document.handlers.size,0);
  assert.deepEqual(h.removed.sort(),['appStateChange','backButton']);
});

test('web-only fallback works without installed Capacitor plugin',()=>{
  const view=emitter(),document=emitter(),calls=[];
  const life=mount({view,document,app:null,onActive:v=>calls.push(v),onBack:()=>{}});
  document.hidden=true;document.emit('visibilitychange');
  document.hidden=false;document.emit('visibilitychange');
  assert.deepEqual(calls,[false,true]);
  life.destroy();
});

test('native page integrates pause/resume, audio shutdown and exit sheet',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/src\/ui\/app-lifecycle\.js/);
  assert.match(html,/GodSmashAppLifecycle\.mount/);
  assert.match(html,/id="app-exit-dialog"/);
  assert.match(html,/if \(!appActive \|\| document\.hidden \|\| webglContextUnavailable\) return;/);
  assert.match(html,/SoundEngine\.pause\(\)/);
  assert.match(html,/SoundEngine\.activate\(\)/);
  assert.match(html,/appPlugin\.exitApp\(\)/);
});
