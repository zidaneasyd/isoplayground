const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createCombatContext(sandboxMode = true) {
  let redrawCount = 0;
  const context = {
    innerWidth: 800,
    innerHeight: 600,
    performance: { now: () => 1000 },
    document: { body: { classList: { contains: name => name === 'sandbox' && sandboxMode } } }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['config.js', 'state.js', 'combat.js']) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  context.setRedrawCount = () => redrawCount;
  context.resetRedrawCount = () => { redrawCount = 0; };
  context.IPState.sandbox.active = sandboxMode;
  context.sandboxMode = value => { context.IPState.sandbox.active = value; };
  context.d = () => { redrawCount++; };
  context.getDirectionKeyFromVector = () => 'right';
  return context;
}

test('combat defaults clamp invalid health, damage, interval, and cooldown values', () => {
  const context = createCombatContext();
  vm.runInContext(`object = {
    role: 'Player', maxHp: 20, hp: 900, damage: 5000,
    attackInterval: 4, attackCooldown: -2
  }`, context);
  vm.runInContext('ensureCombatDefaults(object)', context);

  assert.equal(vm.runInContext('object.maxHp', context), 100);
  assert.equal(vm.runInContext('object.hp', context), 100);
  assert.equal(vm.runInContext('object.damage', context), 1000);
  assert.equal(vm.runInContext('object.attackInterval', context), 1);
  assert.equal(vm.runInContext('object.attackCooldown', context), 0);
});

test('knockback direction prefers the Player last real world movement', () => {
  const context = createCombatContext();
  vm.runInContext(`
    attacker = { role: 'Player', u: 0, v: 0, lastWorldMove: { fromU: 0, fromV: 0, toU: 3, toV: 4 } };
    target = { role: 'NPC', u: -5, v: 0 };
  `, context);
  const direction = vm.runInContext('getAttackKnockbackDirection(attacker, target)', context);
  assert.ok(Math.abs(direction.du - 0.6) < 1e-9);
  assert.ok(Math.abs(direction.dv - 0.8) < 1e-9);
});

test('NPC knockback stops movement and clears stale path runtime', () => {
  const context = createCombatContext();
  vm.runInContext(`
    attacker = { role: 'Player', u: 0, v: 0 };
    target = {
      role: 'NPC', u: 2, v: 0, vx: 4, vz: 3,
      pathWaypoints: [1], pathRetryTimer: 1,
      pathPlayerCellX: 2, pathPlayerCellY: 3
    };
  `, context);
  vm.runInContext('applyKnockback(target, attacker)', context);

  assert.equal(vm.runInContext('target.vx', context), 0);
  assert.equal(vm.runInContext('target.vz', context), 0);
  assert.equal(vm.runInContext('target.knockback.remaining', context), 0.18);
  assert.equal(vm.runInContext('target.knockback.speed', context), 3.6);
  assert.deepEqual(Array.from(vm.runInContext('target.pathWaypoints', context)), []);
  assert.equal(vm.runInContext("'pathPlayerCellX' in target", context), false);
});

test('damage reduces HP in Sandbox and records visual feedback', () => {
  const context = createCombatContext(true);
  vm.runInContext(`
    target = { role: 'NPC', maxHp: 100, hp: 80, damage: 10, attackInterval: 1, u: 1, v: 0, vx: 1, vz: 0 };
    attacker = { role: 'Player', u: 0, v: 0, attackInterval: 0.5 };
  `, context);
  vm.runInContext('dealDamage(target, 20, attacker)', context);

  assert.equal(vm.runInContext('target.hp', context), 60);
  assert.equal(vm.runInContext('target.damagePopups.length', context), 1);
  assert.equal(vm.runInContext('target.damagePopups[0].value', context), 20);
  assert.equal(vm.runInContext('target.flashUntil', context), 1300);
  assert.equal(vm.runInContext('attacker.attackCooldown', context), 0.5);
  assert.equal(context.setRedrawCount(), 1);
});

test('editor damage shows hit feedback without reducing HP', () => {
  const context = createCombatContext(false);
  vm.runInContext(`target = { role: 'NPC', maxHp: 100, hp: 80, damage: 10, attackInterval: 1, u: 0, v: 0 }`, context);
  vm.runInContext('dealDamage(target, 30, null)', context);
  assert.equal(vm.runInContext('target.hp', context), 80);
  assert.equal(vm.runInContext('target.damagePopups.length', context), 1);
  assert.equal(context.setRedrawCount(), 1);
});

test('Player attacks the nearest NPC in range and starts cooldown', () => {
  const context = createCombatContext(true);
  vm.runInContext(`cubes = [
    { id: 1, role: 'Player', u: 0, v: 0, attackArea: 1.5, hitArea: 1.5, detectionArea: 3, maxHp: 300, hp: 300, damage: 20, attackInterval: 0.5, attackCooldown: 0 },
    { id: 2, role: 'NPC', u: 1, v: 0, hitArea: 1.5, maxHp: 100, hp: 100, damage: 10, attackInterval: 1, vx: 0, vz: 0 },
    { id: 3, role: 'NPC', u: 1.4, v: 0, hitArea: 1.5, maxHp: 100, hp: 100, damage: 10, attackInterval: 1, vx: 0, vz: 0 }
  ]`, context);
  vm.runInContext('playerAttack()', context);

  assert.equal(vm.runInContext('cubes[1].hp', context), 80);
  assert.equal(vm.runInContext('cubes[2].hp', context), 100);
  assert.equal(vm.runInContext('cubes[0].attackCooldown', context), 0.5);
  assert.equal(vm.runInContext('cubes[0].activeSpriteDir', context), 'right');
  assert.equal(context.setRedrawCount(), 1);
});
