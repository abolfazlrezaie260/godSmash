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

class FakeElement {
  constructor(tag,doc) {
    this.tagName=tag.toUpperCase();
    this.ownerDocument=doc;
    this.children=[];this.listeners={};this.attributes={};this.dataset={};
    this.value='';this.hidden=false;
    const classes=new Set();
    this.classList={
      toggle(name,yes){if(yes)classes.add(name);else classes.delete(name);},
      remove(name){classes.delete(name);},
      contains(name){return classes.has(name);}
    };
  }
  appendChild(child){this.children.push(child);}
  replaceChildren(...children){this.children=children;this.value=children[0]?.value||'';}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(event,handler){(this.listeners[event]??=[]).push(handler);}
  fire(event){for(const cb of this.listeners[event]||[])cb({target:this});}
}
test('continent UI chooses Iran/Iraq, updates route, and exits cleanly', () => {
  const doc={createElement(tag){return new FakeElement(tag,doc);}};
  function el(tag){return new FakeElement(tag,doc);}
  const container=el('div'),panel=el('section'),from=el('select'),to=el('select');
  const name=el('div'),summary=el('p'),launch=el('button');
  const selected=[],routes=[],launched=[];
  const ui=continentUI.mount({
    geography:geo,continentContainer:container,panel,fromSelect:from,toSelect:to,
    continentLabel:name,routeSummary:summary,launchButton:launch,
    onChoose:id=>selected.push(id),
    onRoute:route=>routes.push(route),
    onLaunch:route=>launched.push(route)
  });
  assert.equal(container.children.length,6);
  container.children[0].fire('click');
  assert.deepEqual(selected,['asia']);
  assert.equal(ui.setContinent('asia'),true);
  assert.equal(panel.hidden,false);
  assert.equal(ui.getRoute().source.id,'ir');
  assert.equal(ui.getRoute().destination.id,'iq');
  assert.match(summary.textContent,/ایران/);
  launch.fire('click');
  assert.equal(launched[0].destination.id,'iq');
  from.value='iq';
  from.fire('change');
  assert.equal(ui.getRoute().source.id,'iq');
  assert.notEqual(ui.getRoute().destination.id,'iq');
  assert.equal(ui.setContinent('bad'),false);
  ui.clear();
  assert.equal(panel.hidden,true);
  assert.equal(ui.getRoute(),null);
  assert.equal(routes.at(-1),null);
  launch.fire('click');
  assert.equal(launched.length,1);
});

test('HTML wires continent selection to real missile models, HUD and reset', () => {
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html,/src\/simulation\/geography\.js/);
  assert.match(html,/src\/ui\/continent-mode\.js/);
  for(const id of ['continent-options','geo-route-panel','geo-from','geo-to','geo-launch','geo-exit']) {
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(html,/GodSmashContinentMode\.mount/);
  assert.match(html,/continentMode\.setContinent\(id\)/);
  assert.match(html,/onLaunch: fireCountryRoute/);
  assert.match(html,/launchMissileAtWorldPoint\(destinationWorld, i\*170, weapon, route\)/);
  assert.match(html,/geographicRoute\.start/);
  assert.match(html,/geographicRoute\.target/);
  assert.match(html,/planetPicker\.close\(\)/);
  assert.match(html,/if \(continentMode\) continentMode\.clear\(\)/);
});
