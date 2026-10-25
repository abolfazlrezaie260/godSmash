const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../src/content/catalog.js');
const {mount} = require('../src/ui/weapon-dock.js');

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.parent = null;
    this.tabIndex = -1;
    this.focused = false;
    const selected = new Set();
    this.classList = {
      toggle(name, active) {
        if (active) selected.add(name);
        else selected.delete(name);
      },
      contains(name) { return selected.has(name); }
    };
  }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, fn) { this.listeners[type] ||= []; this.listeners[type].push(fn); }
  dispatch(type, options = {}) {
    const event = {
      key: options.key,
      prevented: false,
      preventDefault() { this.prevented = true; }
    };
    for (const listener of this.listeners[type] || []) listener(event);
    return event;
  }
  focus() { this.focused = true; }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
  }
}
function build() {
  const doc = { createElement(tag) {return new FakeElement(tag, doc);} };
  return new FakeElement('div', doc);
}

test('renders a unique visible button per catalog weapon, with readable labels', () => {
  const container = build();
  const weapons = catalog.listWeapons();
  const choices = [];
  const dock = mount({
    container, weapons, selectedId: 'icbm', onChange: id => choices.push(id)
  });
  assert.equal(container.children.length, weapons.length);
  assert.equal(container.children.length, 9);
  for (const [i, item] of weapons.entries()) {
    const button = container.children[i];
    assert.equal(button.dataset.weaponId, item.id);
    assert.equal(button.tagName, 'BUTTON');
    assert.match(button.getAttribute('aria-label'), new RegExp(item.nameFa));
    assert.equal(button.children[2].textContent, item.shortLabel);
  }
  assert.equal(container.children[0].getAttribute('aria-pressed'), 'true');
  assert.equal(container.children[0].tabIndex, 0);
  assert.deepEqual(choices, [], 'initial mount should not trigger a selection callback');
  assert.equal(dock.getSelected(), 'icbm');
});

test('click, numeric shortcut and arrow keys share the selected weapon', () => {
  const container = build(), received = [];
  const weapons = catalog.listWeapons();
  const dock = mount({
    container, weapons, selectedId: 'icbm', onChange: id => received.push(id)
  });
  container.children[2].dispatch('click');
  assert.equal(dock.getSelected(), 'winged');
  assert.equal(container.children[2].getAttribute('aria-pressed'), 'true');
  assert.equal(container.children[0].getAttribute('aria-pressed'), 'false');

  assert.equal(dock.selectAt(4), true);
  assert.equal(dock.getSelected(), 'laser');
  assert.equal(dock.selectAt(7), true);
  assert.equal(dock.getSelected(), 'nova');
  assert.equal(dock.selectAt(9), false);
  assert.equal(dock.getSelected(), 'nova');

  const arrow = container.children[7].dispatch('keydown', {key: 'ArrowDown'});
  assert.equal(arrow.prevented, true);
  assert.equal(dock.getSelected(), 'drone-swarm', 'navigation advances to the ninth weapon');
  assert.equal(container.children[8].focused, true);
  container.children[8].dispatch('keydown',{key:'ArrowDown'});
  assert.equal(dock.getSelected(),'icbm','keyboard navigation wraps after final weapon');
  container.children[0].dispatch('keydown', {key: 'End'});
  assert.equal(dock.getSelected(), 'drone-swarm');
  assert.deepEqual(received, ['winged', 'laser', 'nova', 'drone-swarm', 'icbm', 'drone-swarm']);

  dock.destroy();
  assert.equal(container.children.length, 0);
});

test('registry selection can be synchronized and invalid options are ignored', () => {
  const container = build();
  const dock = mount({
    container, weapons: catalog.listWeapons(), selectedId: 'missing', onChange() {}
  });
  assert.equal(dock.getSelected(), 'icbm');
  assert.equal(dock.setSelected('asteroid'), true);
  assert.equal(dock.setSelected('not-a-weapon'), false);
  assert.equal(dock.getSelected(), 'asteroid');
  assert.throws(() => mount({container: null, weapons: [], onChange() {}}), TypeError);
});
