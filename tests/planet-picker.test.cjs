const test=require('node:test');
const assert=require('node:assert/strict');
const picker=require('../src/ui/planet-picker.js');
const catalog=require('../src/content/catalog.js');

class Element {
  constructor(tagName,doc){
    this.tagName=tagName.toUpperCase();
    this.ownerDocument=doc;this.children=[];this.parent=null;
    this.attributes={};this.listeners={};this.dataset={};this.style={};
    this.hidden=false;
    const selected=new Set();
    this.classList={
      toggle(name,yes){if(yes) selected.add(name);else selected.delete(name);},
      contains(name){return selected.has(name);}
    };
  }
  append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
  appendChild(child){this.append(child);}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name];}
  addEventListener(type,cb){(this.listeners[type]??=[]).push(cb);}
  fire(type,props={}){
    const event={target:props.target??this,key:props.key,shiftKey:!!props.shiftKey,
      prevented:false,preventDefault(){this.prevented=true;}};
    for(const cb of this.listeners[type]||[])cb(event);
    return event;
  }
  focus(){this.ownerDocument.activeElement=this;}
}
function setup() {
  const doc={activeElement:null,createElement(tag){return new Element(tag,doc);}};
  const modal=new Element('div',doc);
  modal.hidden=true;
  const trigger=new Element('button',doc);
  const closeButton=new Element('button',doc);
  const container=new Element('div',doc);
  const selected=[];
  doc.activeElement=trigger;
  const controller=picker.mount({
    modal,container,trigger,closeButton,
    planets:catalog.listPlanets(),selectedId:'earth',
    onSelect:id=>selected.push(id)
  });
  return {doc,modal,trigger,closeButton,container,selected,controller};
}
test('renders all planets with actual Earth image and spherical previews',()=>{
  const p=setup();
  assert.equal(p.container.children.length,4);
  const cards=p.container.children;
  assert.equal(cards[0].dataset.planetId,'earth');
  assert.match(cards[0].children[0].style.backgroundImage,/earth_atmos_4096\.jpg/);
  assert.match(cards[1].children[0].style.backgroundImage,/linear-gradient/);
  assert.equal(cards[0].getAttribute('aria-pressed'),'true');
  assert.equal(cards[1].getAttribute('aria-pressed'),'false');
  assert.equal(cards[1].children[1].children[0].textContent,'مریخ');
  assert.equal(cards[1].children[1].children[2].textContent,'سطح سنگی سرخ و جو رقیق');
});
test('open, switch planet, close and sync active planet from gameplay',()=>{
  const p=setup();
  p.trigger.fire('click');
  assert.equal(p.modal.hidden,false);
  assert.equal(p.trigger.getAttribute('aria-expanded'),'true');
  assert.equal(p.doc.activeElement,p.container.children[0]);
  p.container.children[2].fire('click');
  assert.deepEqual(p.selected,['venus']);
  assert.equal(p.controller.getSelected(),'venus');
  assert.equal(p.modal.hidden,true);
  assert.equal(p.trigger.getAttribute('aria-expanded'),'false');
  assert.equal(p.doc.activeElement,p.trigger);
  assert.equal(p.controller.setSelected('invalid'),false);
  assert.equal(p.controller.setSelected('moon'),true);
  assert.equal(p.container.children[3].getAttribute('aria-pressed'),'true');
  assert.equal(p.trigger.getAttribute('aria-label'),'انتخاب سیاره، ماه');
});
test('Escape, backdrop and focus trapping make the sheet accessible',()=>{
  const p=setup();
  p.controller.open();
  assert.equal(p.modal.fire('keydown',{key:'Escape'}).prevented,true);
  assert.equal(p.modal.hidden,true);
  p.controller.open();
  p.doc.activeElement=p.container.children.at(-1);
  assert.equal(p.modal.fire('keydown',{key:'Tab'}).prevented,true);
  assert.equal(p.doc.activeElement,p.closeButton);
  p.controller.close();
  p.controller.open();
  p.modal.fire('click',{target:p.modal});
  assert.equal(p.modal.hidden,true);
  assert.throws(()=>picker.mount({}),TypeError);
});
