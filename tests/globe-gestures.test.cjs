'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('../src/ui/globe-gestures.js');

function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name,fn){listeners.set(name,fn);},
    removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},
    dispatch(name,x,y,id=1,extra={}) {
      const evt={pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0,target:this,
        preventDefault(){this.defaultPrevented=true}, ...extra};
      listeners.get(name)?.(evt);
      return evt;
    }
  };
}
function harness(){
  const canvas=target(),window=target();
  let time=0;
  const taps=[],drags=[],pinches=[];
  const tracker=mount({target:canvas,moveTarget:window,
    now:()=>time,onDrag:(x,y)=>drags.push([x,y]),
    onPinch:scale=>pinches.push(scale),onTap:(x,y)=>taps.push([x,y])});
  return {canvas,window,tracker,taps,drags,pinches,tick:n=>{time+=n}};
}

test('a quick tap fires once, drag is not mistaken for shooting',()=>{
  const h=harness();
  h.canvas.dispatch('pointerdown',100,200);
  h.tick(50);
  h.window.dispatch('pointerup',100,200,1,{target:h.canvas});
  assert.deepEqual(h.taps,[[100,200]]);
  h.canvas.dispatch('pointerdown',100,200);
  h.window.dispatch('pointermove',135,200);
  h.window.dispatch('pointerup',135,200,1,{target:h.canvas});
  assert.deepEqual(h.taps,[[100,200]]);
  assert.deepEqual(h.drags,[[35,0]]);
  h.tracker.destroy();
  assert.equal(h.canvas.listeners.size,0);
  assert.equal(h.window.listeners.size,0);
});

test('two pointers pinch zoom without firing or accidental post-pinch drag',()=>{
  const h=harness();
  h.canvas.dispatch('pointerdown',100,150,1);
  h.canvas.dispatch('pointerdown',200,150,2);
  h.window.dispatch('pointermove',220,150,2);
  assert.equal(h.pinches.length,1);
  assert.ok(h.pinches[0]>1);
  h.window.dispatch('pointerup',220,150,2,{target:h.canvas});
  h.window.dispatch('pointermove',110,151,1);
  h.window.dispatch('pointerup',110,151,1,{target:h.canvas});
  assert.deepEqual(h.taps,[]);
  assert.deepEqual(h.drags,[]);
  assert.equal(h.tracker.activePointers(),0);
});

test('cancelled, long or non-primary mouse interactions never shoot',()=>{
  const h=harness();
  h.canvas.dispatch('pointerdown',50,50,1);
  h.window.dispatch('pointercancel',50,50,1,{target:h.canvas});
  h.canvas.dispatch('pointerdown',50,50,2);
  h.tick(900);
  h.window.dispatch('pointerup',50,50,2,{target:h.canvas});
  h.canvas.dispatch('pointerdown',50,50,3,{pointerType:'mouse',button:2});
  h.window.dispatch('pointerup',50,50,3,{target:h.canvas});
  assert.deepEqual(h.taps,[]);
  assert.equal(h.tracker.activePointers(),0);
});

test('pointer move or pointerup without corresponding down is ignored',()=>{
  const h=harness();
  h.window.dispatch('pointermove',1,1);
  h.window.dispatch('pointerup',1,1,1,{target:h.canvas});
  assert.deepEqual(h.taps,[]);
  assert.deepEqual(h.drags,[]);
  assert.deepEqual(h.pinches,[]);
});

test('game entry loads gestures before inline simulation and preserves firing controls',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html, /src\/ui\/globe-gestures\.js/);
  assert.match(html,/GodSmashGlobeGestures\.mount/);
  assert.match(html,/onPinch: scale =>/);
  assert.match(html,/btnFireCenter\.addEventListener\('click'/);
});
