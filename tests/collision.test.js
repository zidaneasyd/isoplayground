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

function createCollisionContext() {
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
  return context;
}

test('world bounds follow the configured world size', () => {
  const context = createCollisionContext();
  vm.runInContext('worldSize = 10', context);
  const bounds = vm.runInContext('getCellBounds()', context);

  assert.equal(bounds.minCell, -5);
  assert.equal(bounds.maxCell, 4);
});

test('point collision blocks objects at the same vertical offset', () => {
  const context = createCollisionContext();
  vm.runInContext(`
    cubes = [
      { id: 1, u: 0.5, v: 0.5, h: 0, collision: true },
      { id: 2, u: 1.5, v: 0.5, h: 0, collision: true }
    ];
  `, context);

  assert.equal(vm.runInContext('isPointClearOfOtherCubes(1.5, 0.5, 0, 1)', context), false);
  assert.equal(vm.runInContext('isPointClearOfOtherCubes(1.5, 0.5, 1, 1)', context), true);
});

test('collision-disabled objects do not block a point', () => {
  const context = createCollisionContext();
  vm.runInContext(`
    cubes = [
      { id: 1, u: 0.5, v: 0.5, h: 0, collision: true },
      { id: 2, u: 1.5, v: 0.5, h: 0, collision: false }
    ];
  `, context);

  assert.equal(vm.runInContext('isPointClearOfOtherCubes(1.5, 0.5, 0, 1)', context), true);
});

test('path collision detects an obstacle between the endpoints', () => {
  const context = createCollisionContext();
  vm.runInContext(`
    cubes = [
      { id: 1, u: 0.5, v: 0.5, h: 0, collision: true },
      { id: 2, u: 2.5, v: 0.5, h: 0, collision: true }
    ];
  `, context);

  assert.equal(vm.runInContext('isPathClearOfOtherCubes(0.5, 0.5, 3.5, 0.5, 0, 1)', context), false);
  assert.equal(vm.runInContext('isPathClearOfOtherCubes(0.5, 0.5, 3.5, 0.5, 1, 1)', context), true);
});

test('movement slides along the free axis when the diagonal path is blocked', () => {
  const context = createCollisionContext();
  vm.runInContext(`
    cubes = [
      { id: 1, u: 0.5, v: 0.5, h: 0, collision: true },
      { id: 2, u: 1.5, v: 0.5, h: 0, collision: true }
    ];
    mover = cubes[0];
  `, context);
  const result = vm.runInContext('tryMoveCubeTo(mover, 1.5, 1.5)', context);

  assert.equal(result.moved, true);
  assert.equal(result.hitU, true);
  assert.equal(result.hitV, false);
  assert.equal(context.mover.u, 0.5);
  assert.equal(context.mover.v, 1.5);
});

test('non-solid object can pass through another object but stays in world bounds', () => {
  const context = createCollisionContext();
  vm.runInContext(`
    worldSize = 4;
    cubes = [
      { id: 1, u: 0.5, v: 0.5, h: 0, collision: false },
      { id: 2, u: 1.5, v: 0.5, h: 0, collision: true }
    ];
    mover = cubes[0];
  `, context);
  const result = vm.runInContext('tryMoveCubeTo(mover, 99, -99)', context);

  assert.equal(result.moved, true);
  assert.equal(context.mover.u, 1.5);
  assert.equal(context.mover.v, -1.5);
});

test('clampObjectsToWorld clamps free-moving roles and relocates out-of-bounds objects', () => {
  const context = createCollisionContext();
  vm.runInContext(`
    worldSize = 4;
    cubes = [
      { id: 1, role: 'Player', u: 99, v: -99, h: 0, collision: true },
      { id: 2, role: 'default', u: 5.2, v: 0.2, h: 0, collision: true }
    ];
    clampObjectsToWorld();
  `, context);

  assert.equal(context.cubes[0].u, 1.5);
  assert.equal(context.cubes[0].v, -1.5);
  assert.equal(context.cubes[1].u, 1.5);
  assert.equal(context.cubes[1].v, 0.5);
});

test('accidental overlap temporarily disables collision and restores it after separation', () => {
  const context = createCollisionContext();
  vm.runInContext(`
    cubes = [
      { id: 1, u: 0.5, v: 0.5, h: 0, collision: true },
      { id: 2, u: 0.6, v: 0.5, h: 0, collision: true }
    ];
    updateAccidentalOverlapCollision();
  `, context);
  assert.equal(context.cubes[0].collision, false);
  assert.equal(context.cubes[1].collision, false);
  assert.equal(context.cubes[0].autoCollisionOff, true);

  vm.runInContext('cubes[1].u = 2; updateAccidentalOverlapCollision()', context);
  assert.equal(context.cubes[0].collision, true);
  assert.equal(context.cubes[1].collision, true);
  assert.equal('autoCollisionOff' in context.cubes[0], false);
});

test('accidental overlap manager does not override manually disabled collision', () => {
  const context = createCollisionContext();
  vm.runInContext(`
    cubes = [
      { id: 1, u: 0.5, v: 0.5, h: 0, collision: false },
      { id: 2, u: 0.6, v: 0.5, h: 0, collision: true }
    ];
    updateAccidentalOverlapCollision();
  `, context);
  assert.equal(context.cubes[0].collision, false);
  assert.equal('autoCollisionOff' in context.cubes[0], false);
  assert.equal(context.cubes[1].collision, true);
});
