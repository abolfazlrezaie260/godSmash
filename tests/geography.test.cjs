const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const geo = require('../src/simulation/geography.js');
const continentUI = require('../src/ui/continent-mode.js');

test('all six continents offer distinct selectable countries, including Iran to Iraq', () => {
  const continents = geo.listContinents();
  assert.deepEqual(continents.map(c => c.id), [
    'asia','europe','africa','north-america','south-america','oceania'
  ]);
  for (const continent of continents) {
    assert.ok(continent.countries.length >= 8);
    assert.equal(new Set(continent.countries.map(c => c.id)).size,continent.countries.length);
    for (const country of continent.countries) {
      assert.ok(country.nameFa);
      assert.ok(country.lat >= -90 && country.lat <= 90);
      assert.ok(country.lon >= -180 && country.lon <= 180);
    }
  }
  assert.equal(geo.getCountry('asia','ir').nameFa,'ایران');
  assert.equal(geo.getCountry('asia','iq').nameFa,'عراق');
  assert.equal(geo.getCountry('europe','ir'),null);
  assert.equal(geo.getContinent('invalid'),null);
});

test('geographic coordinates align with the texture-mapped globe sphere', () => {
  const west = geo.toCartesian(0,0,10);
  assert.ok(Math.abs(west.x-10)<1e-10);
  assert.ok(Math.abs(west.y)<1e-10);
  assert.ok(Math.abs(west.z)<1e-10);
  const north = geo.toCartesian(90,0,10);
  assert.ok(Math.abs(north.y-10)<1e-10);
  const east = geo.toCartesian(0,90,10);
  assert.ok(Math.abs(east.z-10)<1e-10);
  assert.throws(()=>geo.toCartesian(91,0,10),TypeError);
  assert.throws(()=>geo.toCartesian(10,0,-1),TypeError);
});

test('country routes have two distinct endpoints and stay above the Earth sphere', () => {
  let checked = 0;
  for (const continent of geo.listContinents()) {
    for (const from of continent.countries) {
      for (const to of continent.countries) {
        if (from.id === to.id) continue;
        const route = geo.createRoute(continent.id,from.id,to.id);
        assert.equal(route.source.id,from.id);
        assert.equal(route.destination.id,to.id);
        assert.ok(route.angle > 0);
        assert.ok(Math.abs(Math.hypot(...Object.values(route.start))-10)<1e-8);
        for (const t of [0.05,0.1,0.25,0.5,0.75,0.9,0.95]) {
          const inv=1-t;
          const p={};
          for (const axis of ['x','y','z']) {
            p[axis]=inv*inv*route.start[axis]+
              2*inv*t*route.control[axis]+t*t*route.target[axis];
          }
          assert.ok(Math.hypot(p.x,p.y,p.z)>=9.99,
            continent.id+': '+from.id+' -> '+to.id+' dips through globe');
        }
        checked++;
      }
    }
  }
  assert.ok(checked>2000);
  assert.throws(()=>geo.createRoute('asia','ir','ir'),TypeError);
  assert.throws(()=>geo.createRoute('asia','ir','de'),TypeError);
});

const physics = require('../src/simulation/missile-physics.js');
const boundaries = JSON.parse(fs.readFileSync(
  path.join(__dirname,'../assets/data/countries-110m.json'),'utf8'
));

class FakeElement {
  constructor(tag,doc) {
    this.tagName=tag.toUpperCase();this.ownerDocument=doc;
    this.children=[];this.listeners={};this.attributes={};this.dataset={};
    this.hidden=false;this.textContent='';this.disabled=false;
    const styles=new Set();
    this.classList={
      toggle(name,on){if(on)styles.add(name);else styles.delete(name);},
      contains(name){return styles.has(name);}
    };
  }
  append(...children){for(const child of children)this.appendChild(child);}
  appendChild(child){child.parent=this;this.children.push(child);return child;}
  replaceChildren(...items){this.children=[];this.append(...items);}
  insertBefore(child,before){
    child.parent=this;
    const i=this.children.indexOf(before);
    if(i<0)this.children.push(child);else this.children.splice(i,0,child);
  }
  get firstChild(){return this.children[0]||null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name];}
  addEventListener(event,callback){(this.listeners[event]??=[]).push(callback);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  getBoundingClientRect(){return {width:1280,height:720,left:0,top:0};}
  fire(event,extras={}){
    const e={target:this,key:undefined,clientX:0,clientY:0,deltaY:0,
      preventDefault(){},stopPropagation(){},...extras};
    for(const cb of this.listeners[event]||[])cb(e);
  }
}
function fixture() {
  const doc={createElement(tag){return new FakeElement(tag,doc);},
    createElementNS(ns,tag){return new FakeElement(tag,doc);}};
  const make=tag=>new FakeElement(tag,doc);
  const buttons=make('div'),panel=make('section'),mapShell=make('div'),svg=make('svg');
  const name=make('p'),summary=make('p'),launch=make('button');
  const changeSource=make('button'),world=make('button'),fit=make('button');
  const chosen=[],impacts=[],sounds=[];
  const ui=continentUI.mount({
    geography:geo,continentContainer:buttons,panel,mapShell,svg,
    continentLabel:name,routeSummary:summary,launchButton:launch,
    changeSourceButton:changeSource,worldButton:world,fitButton:fit,
    onChoose:id=>chosen.push(id),
    onImpact:(country,weapon)=>impacts.push([country.id,weapon.id]),
    onSound:()=>sounds.push(1),
    getWeapon:()=>({kind:'missile',id:'icbm',nameFa:'موشک',
      speed:.95,flightPace:.27,launchSpeed:.18,acceleration:1.05,
      maxSpeed:1.55,fuelDuration:.72,drag:.035}),
    getSalvoMode:()=>false
  });
  return {ui,buttons,panel,mapShell,svg,name,summary,launch,changeSource,world,
    fit,chosen,impacts,sounds};
}

test('public-domain country polygons include Iran, Iraq and all six regions',()=>{
  assert.ok(boundaries.features.length>=170);
  for(const continent of geo.listContinents()) {
    assert.ok(boundaries.features.filter(c=>c.continent===continent.id).length>=5);
  }
  const iran=boundaries.features.find(c=>c.id==='ir');
  const iraq=boundaries.features.find(c=>c.id==='iq');
  assert.equal(iran.fa,'ایران');
  assert.equal(iraq.fa,'عراق');
  assert.ok(continentUI.polygonPath(iran).startsWith('M'));
  assert.match(continentUI.polygonPath(iran),/L/);
  assert.deepEqual(continentUI.xy(32,53),{x:233,y:58});
  const p=continentUI.routePoints({lat:32,lon:53},{lat:33,lon:44});
  assert.ok(p.start.x>p.end.x);
  assert.ok(continentUI.pointAt(p,.5).y<p.start.y);
});

test('country selection is entirely map-based; selected source is retained',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>boundaries});
  try {
    const f=fixture();
    assert.equal(f.buttons.children.length,6);
    f.buttons.children[0].fire('click');
    assert.deepEqual(f.chosen,['asia']);
    assert.equal(await f.ui.setContinent('asia'),true);
    assert.equal(f.panel.hidden,false);
    assert.equal(f.mapShell.hidden,false);
    assert.equal(f.ui.getSelected().source,null);
    assert.equal(f.launch.disabled,true);
    const countryPath=id=>f.svg.children
      .flatMap(child=>child.children||[])
      .find(child=>child.attributes['data-country-id']===id);
    countryPath('ir').fire('click');
    assert.equal(f.ui.getSelected().source.id,'ir');
    assert.equal(f.ui.getSelected().target,null);
    countryPath('iq').fire('click');
    assert.equal(f.ui.getSelected().target.id,'iq');
    assert.match(f.summary.textContent,/ایران/);
    assert.match(f.summary.textContent,/عراق/);
    assert.equal(f.launch.disabled,false);
    assert.equal(f.ui.fire(),true);
    assert.equal(f.sounds.length,1);
    // The selected source stays Iran when choosing another destination.
    countryPath('tr').fire('click');
    assert.equal(f.ui.getSelected().source.id,'ir');
    assert.equal(f.ui.getSelected().target.id,'tr');
    f.world.fire('click');
    assert.equal(f.ui.getView().w,360);
    f.ui.choose('us');
    assert.equal(f.ui.getSelected().target.id,'us');
    f.fit.fire('click');
    assert.ok(f.ui.getView().w<360);
    f.changeSource.fire('click');
    assert.equal(f.ui.getSelected().source,null);
    countryPath('iq').fire('click');
    assert.equal(f.ui.getSelected().source.id,'iq');
    f.ui.clear();
    assert.equal(f.panel.hidden,true);
    assert.equal(f.mapShell.hidden,true);
    assert.equal(f.ui.isActive(),false);
  } finally {globalThis.fetch=previous;}
});

test('missiles animate in the flat map and impact on the chosen country',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>boundaries});
  try {
    const f=fixture();
    await f.ui.setContinent('asia');
    f.ui.choose('ir');f.ui.choose('iq');
    assert.equal(f.ui.fire(),true);
    for(let i=0;i<600;i++)f.ui.update(.05);
    assert.deepEqual(f.impacts,[['iq','icbm']]);
    f.ui.resetEffects();
  }finally{globalThis.fetch=previous;}
});

test('HTML integrates flat regional map without dropdown selectors',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const id of ['continent-options','geo-route-panel','geo-map-shell',
    'geo-map-svg','geo-launch','geo-change-source','geo-world','geo-exit']) {
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.doesNotMatch(html,/id="geo-from"/);
  assert.doesNotMatch(html,/id="geo-to"/);
  assert.match(html,/GodSmashContinentMode\.mount/);
  assert.match(html,/continentMode\.setContinent\(id\)/);
  assert.match(html,/onImpact: fireCountryImpact/);
  assert.match(html,/if\(continentMode\?\.isActive\(\)\)continentMode\.update\(dt\)/);
  assert.match(html,/gameShell\.classList\.add\('is-continent-mode'\)/);
  assert.match(html,/if \(continentMode\) continentMode\.clear\(\)/);
});
