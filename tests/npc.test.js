const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadCollisionModule(context) {
  const source = fs.readFileSync(path.join(root, 'js', 'collision.js'), 'utf8')
    .replace(/^import \{ IPState \} from ['"]\.\/legacyBridge\.js['"];\s*/m, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(source, context, { filename: 'collision.js (module body)' });
}

function createNpcContext() {
  const context = {
    innerWidth: 1280,
    innerHeight: 800,
    performance: { now: () => 1000 }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['config.js', 'state.js']) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  loadCollisionModule(context);
  for (const file of ['roles.js', 'npc.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('NPC grid conversion maps world coordinates to bounded cell indices', () => {
  const context = createNpcContext();
  vm.runInContext('worldSize = 8', context);
  assert.equal(vm.runInContext('npcGridCoord(0)', context), -3.5);
  assert.equal(vm.runInContext('npcGridCoord(7)', context), 3.5);
  assert.equal(vm.runInContext('npcGridIndex(-99)', context), 0);
  assert.equal(vm.runInContext('npcGridIndex(99)', context), 7);
  assert.equal(vm.runInContext('npcGridIndex(0.5)', context), 4);
});

test('eight-way direction chooses the closest configured movement vector', () => {
  const context = createNpcContext();
  const result = vm.runInContext('nearestEightWayVector(10, 0)', context);
  assert.deepEqual(Array.from(result), [1, 0]);
  const diagonal = vm.runInContext('nearestEightWayVector(2, 2)', context);
  assert.deepEqual(Array.from(diagonal), [1, 1]);
});

test('A* returns a sequence of grid waypoints that approaches the player', () => {
  const context = createNpcContext();
  vm.runInContext(`
    worldSize = 8;
    cubes = [
      { id: 1, role: 'NPC', u: -2.5, v: -0.5, h: 0, collision: true },
      { id: 2, role: 'Player', u: 2.5, v: -0.5, h: 0, collision: true }
    ];
    npc = cubes[0]; player = cubes[1];
  `, context);
  const pathPoints = vm.runInContext('npcFindPath(npc, player, 1)', context);

  assert.ok(Array.isArray(pathPoints));
  assert.ok(pathPoints.length > 0);
  const last = pathPoints[pathPoints.length - 1];
  assert.ok(Math.hypot(last.u - 2.5, last.v + 0.5) <= 1.5 + 1e-9);
  for (const point of pathPoints) {
    assert.ok(Math.hypot(point.u - 2.5, point.v + 0.5) > 0, 'waypoints should stop before entering the Player cell');
  }
});

test('NPC attack stand point remains within attack range and outside overlapping collider', () => {
  const context = createNpcContext();
  vm.runInContext(`
    npc = { u: -1.5, v: 0.5, h: 0, collision: true };
    player = { u: 0.5, v: 0.5, h: 0, collision: true };
  `, context);
  const point = vm.runInContext('npcAttackStandPoint(npc, player, 2)', context);
  assert.ok(Math.hypot(point.u - 0.5, point.v - 0.5) <= 2);
  assert.ok(Math.abs(point.u - 0.5) >= 1.02 || Math.abs(point.v - 0.5) >= 1.02);
});

test('NPC direct movement advances toward an unobstructed attack point', () => {
  const context = createNpcContext();
  vm.runInContext(`
    worldSize = 8;
    cubes = [
      { id: 1, role: 'NPC', u: -2.5, v: 0.5, h: 0, collision: true, pathWaypoints: [] },
      { id: 2, role: 'Player', u: 2.5, v: 0.5, h: 0, collision: true }
    ];
    npc = cubes[0]; player = cubes[1]; npcPlansThisFrame = 0;
  `, context);
  const moved = vm.runInContext('moveNpcAlongPath(npc, player, 2, 1, 0.1)', context);
  assert.equal(moved, true);
  assert.ok(context.npc.u > -2.5);
  assert.ok(context.npc.vx > 0);
});
