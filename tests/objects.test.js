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

function loadObjectsModule(context) {
  const source = fs.readFileSync(path.join(root, 'js', 'objects.js'), 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(source, context, { filename: 'objects.js (module body)' });
}

function createObjectQueryContext() {
  const context = {
    innerWidth: 800,
    innerHeight: 600,
    performance: { now: () => 1000 }
  };
  context.window = context;
  vm.createContext(context);

  for (const file of ['config.js', 'state.js']) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  loadCollisionModule(context);
  context.IPConfig = context.window.IPConfig;
  const coordinatesSource = fs.readFileSync(path.join(root, 'js', 'coordinates.js'), 'utf8')
    .replace(/^import \{[\s\S]*?\} from ['"]\.\/legacyBridge\.js['"];\s*/m, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(coordinatesSource, context, { filename: 'coordinates.js (module body)' });
  loadObjectsModule(context);
  return context;
}

test('object names are unique regardless of letter case', () => {
  const context = createObjectQueryContext();
  vm.runInContext(`cubes = [{ id: 1, name: 'Guard' }, { id: 2, name: 'Merchant' }]`, context);

  assert.equal(vm.runInContext("isNameUnique('Archer', -1)", context), true);
  assert.equal(vm.runInContext("isNameUnique('gUArD', -1)", context), false);
  assert.equal(vm.runInContext("isNameUnique('Guard', 1)", context), true);
  assert.equal(vm.runInContext("isNameUnique('   ', -1)", context), false);
});

test('duplicate placement finds an in-bounds unoccupied position', () => {
  const context = createObjectQueryContext();
  vm.runInContext(`
    worldSize = 8;
    source = { id: 1, u: 0.5, v: 0.5, h: 0, collision: true };
    cubes = [
      source,
      { id: 2, u: 1.5, v: 0.5, h: 0, collision: true }
    ];
  `, context);
  const spot = vm.runInContext('findDuplicatePosition(source)', context);
  context.testSpot = spot;

  assert.ok(spot);
  assert.ok(spot.u >= -3.5 && spot.u <= 3.5);
  assert.ok(spot.v >= -3.5 && spot.v <= 3.5);
  assert.equal(vm.runInContext('Math.abs(testSpot.u - 1.5) < 0.9999 && Math.abs(testSpot.v - 0.5) < 0.9999', context), false);
});

test('cell occupancy only blocks objects at the requested vertical offset', () => {
  const context = createObjectQueryContext();
  vm.runInContext(`cubes = [{ id: 1, u: 0.5, v: 0.5, h: 0, collision: false }]`, context);

  assert.equal(vm.runInContext('isCellOccupiedOrPassedByAnyObject(0, 0, 0)', context), true);
  assert.equal(vm.runInContext('isCellOccupiedOrPassedByAnyObject(0, 0, 1)', context), false);
});

test('spawn search skips occupied center cell', () => {
  const context = createObjectQueryContext();
  vm.runInContext(`
    worldSize = 8;
    cubes = [{ id: 1, u: 0.5, v: 0.5, h: 0, collision: true }];
  `, context);
  const spawn = vm.runInContext('findSpawnCell()', context);
  context.testSpawn = spawn;

  assert.ok(spawn);
  assert.equal(spawn.cellU === 0 && spawn.cellV === 0, false);
  assert.equal(vm.runInContext('isCellOccupiedOrPassedByAnyObject(testSpawn.cellU, testSpawn.cellV, 0)', context), false);
});

test('role validation prevents assigning a second Player', () => {
  const context = createObjectQueryContext();
  vm.runInContext(`cubes = [{ id: 1, name: 'Hero', role: 'Player' }, { id: 2, name: 'Guard', role: 'NPC' }]`, context);

  const rejected = vm.runInContext("canAssignObjectRole(cubes, 2, 'Player')", context);
  const accepted = vm.runInContext("canAssignObjectRole(cubes, 2, 'NPC')", context);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.reason, 'player-exists');
  assert.equal(rejected.existingPlayer.id, 1);
  assert.equal(accepted.allowed, true);
});

test('object creation chooses a unique id and returns the next id', () => {
  const context = createObjectQueryContext();
  vm.runInContext(`cubes = [{ id: 4, name: 'object-4' }]`, context);

  const result = vm.runInContext('createObjectRecordAtCell(cubes, 4, -2, 3, \'default\')', context);
  assert.equal(result.object.id, 5);
  assert.equal(result.object.name, 'object-5');
  assert.equal(result.object.u, -1.5);
  assert.equal(result.object.v, 3.5);
  assert.equal(result.nextObjectId, 6);
});

test('rename operation validates names before mutating the record', () => {
  const context = createObjectQueryContext();
  vm.runInContext(`cubes = [{ id: 1, name: 'Hero' }, { id: 2, name: 'Guard' }]`, context);

  const duplicate = vm.runInContext("renameObjectRecord(cubes, 2, ' hero ')", context);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, 'duplicate-name');
  assert.equal(vm.runInContext('cubes[1].name', context), 'Guard');

  const renamed = vm.runInContext("renameObjectRecord(cubes, 2, ' Archer ')", context);
  assert.equal(renamed.ok, true);
  assert.equal(vm.runInContext('cubes[1].name', context), 'Archer');
});

test('duplicate record copies sprite configuration without sharing frame arrays', () => {
  const context = createObjectQueryContext();
  const source = {
    id: 1, name: 'Guard', role: 'NPC', u: 0.5, v: 0.5, h: 0,
    stateFps: { Idle: 8 },
    stateFrames: { Idle: { front: ['frame-a'] } },
    pathWaypoints: [{ u: 3, v: 3 }],
    damagePopups: [{ value: 10 }]
  };
  context.source = source;
  const clone = vm.runInContext(`duplicateObjectRecord(source, {
    id: 2, name: 'Guard copy', position: { u: 1.5, v: 0.5 },
    createEmptyStateFramesMap: () => ({ Idle: { front: [] } }),
    ensureObjectStateFrames: obj => obj.stateFrames,
    animationStates: ['Idle'], directions: ['front']
  })`, context);
  context.clone = clone;

  assert.equal(clone.id, 2);
  assert.equal(clone.name, 'Guard copy');
  assert.equal(clone.u, 1.5);
  assert.deepEqual(Array.from(clone.stateFrames.Idle.front), ['frame-a']);
  assert.notEqual(clone.stateFrames.Idle.front, source.stateFrames.Idle.front);
  assert.equal(clone.pathWaypoints, undefined);
  assert.equal(clone.damagePopups, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(clone.stateFps)), { Idle: 8 });
});

test('remove operation returns removed record and updates active selection', () => {
  const context = createObjectQueryContext();
  vm.runInContext(`cubes = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]`, context);

  const removedActive = vm.runInContext('removeObjectRecord(cubes, 2, 2)', context);
  assert.equal(removedActive.removed.id, 2);
  assert.equal(removedActive.activeObjectId, 3);
  assert.equal(vm.runInContext('cubes.length', context), 2);

  const removedOther = vm.runInContext('removeObjectRecord(cubes, 1, 3)', context);
  assert.equal(removedOther.activeObjectId, 3);
  const missing = vm.runInContext('removeObjectRecord(cubes, 99, 3)', context);
  assert.equal(missing.removed, null);
  assert.equal(missing.activeObjectId, 3);
});

