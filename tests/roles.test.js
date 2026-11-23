const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createRoleContext() {
  const context = {
    innerWidth: 800,
    innerHeight: 600,
    performance: { now: () => 1000 }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['config.js', 'state.js', 'roles.js']) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  vm.runInContext('Math.random = () => 0', context);
  return context;
}

test('Player role applies the existing default combat and movement values', () => {
  const context = createRoleContext();
  vm.runInContext(`target = { id: 1, u: 2.5, v: -1.5, h: 0, role: 'default', vx: 0, vz: 0 }`, context);
  vm.runInContext("applyRoleDefaults(target, 'Player')", context);

  assert.equal(vm.runInContext('target.role', context), 'Player');
  assert.equal(vm.runInContext('target.maxHp', context), 300);
  assert.equal(vm.runInContext('target.hp', context), 300);
  assert.equal(vm.runInContext('target.damage', context), 20);
  assert.equal(vm.runInContext('target.attackInterval', context), 0.5);
  assert.equal(vm.runInContext('target.speed', context), 2);
  assert.equal(vm.runInContext('target.runSpeed', context), 6);
  assert.equal(vm.runInContext('target.homeU', context), 2.5);
  assert.equal(vm.runInContext('target.homeV', context), -1.5);
});

test('NPC role initializes defaults and roaming velocity', () => {
  const context = createRoleContext();
  vm.runInContext(`target = { id: 2, u: 0.5, v: 1.5, h: 0, role: 'default' }`, context);
  vm.runInContext("applyRoleDefaults(target, 'NPC')", context);

  assert.equal(vm.runInContext('target.role', context), 'NPC');
  assert.equal(vm.runInContext('target.maxHp', context), 100);
  assert.equal(vm.runInContext('target.damage', context), 10);
  assert.equal(vm.runInContext('target.attackInterval', context), 1);
  assert.equal(vm.runInContext('target.enemy', context), false);
  assert.equal(vm.runInContext('target.roaming', context), true);
  assert.ok(Math.abs(vm.runInContext('Math.hypot(target.vx, target.vz)', context) - 2) < 1e-9);
  assert.equal(vm.runInContext('target.changeTimer', context), 0.7);
});

test('default role clears combat and NPC runtime fields', () => {
  const context = createRoleContext();
  vm.runInContext(`target = {
    id: 3, u: 0, v: 0, h: 0, role: 'NPC', vx: 5, vz: 5,
    speed: 3, runSpeed: 6, maxHp: 100, hp: 20, damage: 10,
    attackInterval: 1, enemy: true, roaming: true, homeU: 1, homeV: 1,
    pathWaypoints: [1], pathRetryTimer: 2, attackStopTime: 3, knockback: { x: 1 }
  }`, context);
  vm.runInContext("applyRoleDefaults(target, 'default')", context);

  assert.equal(vm.runInContext('target.role', context), 'default');
  assert.equal(vm.runInContext('target.vx', context), 0);
  assert.equal(vm.runInContext('target.vz', context), 0);
  for (const key of ['speed', 'runSpeed', 'maxHp', 'hp', 'damage', 'attackInterval', 'enemy', 'roaming', 'homeU', 'homeV', 'pathWaypoints', 'pathRetryTimer', 'attackStopTime', 'knockback']) {
    assert.equal(vm.runInContext(`Object.prototype.hasOwnProperty.call(target, ${JSON.stringify(key)})`, context), false, `${key} should be cleared`);
  }
});

test('non-roaming NPC remains stationary after motion initialization', () => {
  const context = createRoleContext();
  vm.runInContext(`npc = { u: 0, v: 0, speed: 4, roaming: false, vx: 2, vz: 3 }`, context);
  vm.runInContext('initNpcMotion(npc)', context);

  assert.equal(vm.runInContext('npc.vx', context), 0);
  assert.equal(vm.runInContext('npc.vz', context), 0);
  assert.equal(vm.runInContext('npc.changeTimer', context), 999);
});
