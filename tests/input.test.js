const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createInputContext() {
  const listeners = {};
  const context = {
    innerWidth: 800,
    innerHeight: 600,
    performance: { now: () => 1000 },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    removeEventListener() {},
    document: { addEventListener: (type, handler) => { listeners['document:' + type] = handler; } }
  };
  context.window = context;
  context.listeners = listeners;
  vm.createContext(context);
  for (const file of ['config.js', 'state.js', 'input.js']) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  return context;
}

test('WASD and arrow keys update the shared direction state', () => {
  const context = createInputContext();
  assert.equal(vm.runInContext("updateKeyState('ArrowUp', true)", context), true);
  assert.equal(vm.runInContext("updateKeyState('d', true)", context), true);
  assert.equal(vm.runInContext('pressedKeys.up && pressedKeys.right', context), true);
  assert.equal(vm.runInContext("updateKeyState('ArrowUp', false)", context), true);
  assert.equal(vm.runInContext('pressedKeys.up', context), false);
});

test('direction key helper maps single and diagonal key combinations', () => {
  const context = createInputContext();
  vm.runInContext("updateKeyState('w', true);", context);
  assert.equal(vm.runInContext('getInputDirectionKey()', context), 'back');
  vm.runInContext("updateKeyState('w', false); updateKeyState('d', true);", context);
  assert.equal(vm.runInContext('getInputDirectionKey()', context), 'right');
  vm.runInContext("updateKeyState('s', true);", context);
  assert.equal(vm.runInContext('getInputDirectionKey()', context), 'frontright');
});

test('Player movement vector is normalized and follows configured diagonal mapping', () => {
  const context = createInputContext();
  vm.runInContext("updateKeyState('w', true); updateKeyState('d', true);", context);
  const vector = vm.runInContext('getPlayerEightWayVector()', context);
  assert.equal(vector.du, 0);
  assert.equal(vector.dv, -1);
  assert.equal(Math.hypot(vector.du, vector.dv), 1);
  vm.runInContext("updateKeyState('w', false); updateKeyState('d', false);", context);
  const idle = vm.runInContext('getPlayerEightWayVector()', context);
  assert.equal(idle.du, 0);
  assert.equal(idle.dv, 0);
});

test('vector-to-sprite direction selects the closest configured direction', () => {
  const context = createInputContext();
  assert.equal(vm.runInContext('getDirectionKeyFromVector(1, 0)', context), 'frontright');
  assert.equal(vm.runInContext('getDirectionKeyFromVector(-1, -1)', context), 'back');
  assert.equal(vm.runInContext('getDirectionKeyFromVector(0, 0)', context), null);
});
