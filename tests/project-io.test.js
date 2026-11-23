const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createProjectIOContext() {
  const context = {
    innerWidth: 800,
    innerHeight: 600,
    performance: { now: () => 1000 }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of [
    'config.js', 'state.js', 'roles.js', 'sprites.js', 'combat.js'
  ]) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  // Unit-test the same Project I/O implementation after removing only its ESM
  // import/export syntax; imported services are provided by the classic test realm.
  context.IPConfig = context.IPConfig || context.window.IPConfig;
  const moduleSource = fs.readFileSync(path.join(root, 'js', 'projectIO.js'), 'utf8')
    .replace(/^import \{[\s\S]*?\} from ['"]\.\/legacyBridge\.js['"];\s*/m, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(moduleSource, context, { filename: 'projectIO.js (module body)' });
  return context;
}

function spriteFactory(src, width, height, name) {
  return { src, width: Number(width) || 0, height: Number(height) || 0, name, loaded: false, img: null };
}

function parse(context, data, options = {}) {
  context.rawProject = JSON.stringify(data);
  context.parseOptions = { createSpriteRecord: spriteFactory, ...options };
  return vm.runInContext('parseProjectJSON(rawProject, parseOptions)', context);
}

test('world size normalization clamps values and makes them even', () => {
  const context = createProjectIOContext();
  assert.equal(vm.runInContext('normalizeEvenSize(13)', context), 12);
  assert.equal(vm.runInContext('normalizeEvenSize(7)', context), 8);
  assert.equal(vm.runInContext('normalizeEvenSize(99)', context), 48);
  assert.equal(vm.runInContext("normalizeEvenSize('invalid')", context), 12);
});

test('parser rejects invalid project roots and malformed object records', () => {
  const context = createProjectIOContext();
  assert.throws(() => parse(context, { worldSize: 12, cubes: null }), /Format JSON tidak valid/);
  assert.throws(() => parse(context, { cubes: [null] }), /objek ke-1 rusak/);
});

test('parser normalizes world options, object names, IDs, role stats, and camera', () => {
  const context = createProjectIOContext();
  const project = parse(context, {
    worldSize: 13,
    showGrid: false,
    showAxis: true,
    followObjectEnabled: true,
    nextObjectId: 2,
    activeObjectId: 9,
    camera: { z: 20, panPx: 12, panPy: -5, worldOffsetU: 2 },
    cubes: [
      { id: 1, name: 'Hero', role: 'Player', u: 1, v: 2, speed: 40, hp: 99999 },
      { id: 1, name: ' hero ', role: 'NPC', enemy: true, roaming: false, damage: 5000, u: 3, v: 4 }
    ]
  });

  assert.equal(project.worldSize, 12);
  assert.equal(project.showGrid, false);
  assert.equal(project.showAxis, true);
  assert.equal(project.followObjectEnabled, true);
  assert.equal(project.cubes[0].id, 1);
  assert.equal(project.cubes[1].id, 2);
  assert.equal(project.cubes[0].name, 'Hero');
  assert.equal(project.cubes[1].name, 'hero 2');
  assert.equal(project.cubes[0].speed, 10);
  assert.equal(project.cubes[0].hp, 300);
  assert.equal(project.cubes[1].damage, 1000);
  assert.equal(project.cubes[1].enemy, true);
  assert.equal(project.cubes[1].roaming, false);
  assert.equal(project.nextObjectId, 3);
  assert.equal(project.activeObjectId, 1);
  assert.equal(project.camera.z, 10);
  assert.equal(project.camera.panPy, -5);
  assert.equal(project.camera.worldOffsetV, 0);
});

test('legacy sandboxEnemy is only restored for Sandbox session imports', () => {
  const context = createProjectIOContext();
  const data = { cubes: [{ id: 1, name: 'Enemy', role: 'NPC', sandboxEnemy: true }] };
  const regular = parse(context, data);
  const sandbox = parse(context, data, { sandboxSession: true });
  assert.equal(regular.cubes[0].enemy, false);
  assert.equal(sandbox.cubes[0].enemy, true);
});

test('sprite records are rebuilt through the injected adapter factory', () => {
  const context = createProjectIOContext();
  const project = parse(context, {
    cubes: [{
      id: 1, name: 'Sprite', role: 'default',
      stateFrames: { Idle: { front: [{ src: 'data:image/png;base64,AA', width: 10, height: 20, name: 'idle.png' }] } },
      stateFps: { Idle: 60 }
    }]
  });
  const frame = project.cubes[0].stateFrames.Idle.front[0];
  assert.equal(frame.src, 'data:image/png;base64,AA');
  assert.equal(frame.width, 10);
  assert.equal(frame.height, 20);
  assert.equal(frame.name, 'idle.png');
  assert.equal(project.cubes[0].stateFps.Idle, 30);
});

test('project serializer stores stable fields and excludes transient runtime state', () => {
  const context = createProjectIOContext();
  vm.runInContext(`
    worldSize = 14;
    cubes = [{
      id: 4, name: 'Guard', role: 'NPC', collision: true, u: 1.5, v: 2.5, h: 0,
      enemy: true, roaming: false, speed: 4, runSpeed: 7,
      hp: 70, maxHp: 100, damage: 10, attackInterval: 1,
      pathWaypoints: [{ u: 2, v: 2 }], knockback: { remaining: 1 },
      stateFrames: { Idle: { front: [{ src: 'sprite.png', name: 'front.png', width: 16, height: 24 }] } },
      stateFps: { Idle: 10 }
    }];
    activeObjectId = 4;
    nextObjectId = 5;
  `, context);
  const payload = vm.runInContext('buildProjectPayload()', context);
  const object = payload.cubes[0];
  assert.equal(payload.worldSize, 14);
  assert.equal(object.enemy, true);
  assert.equal(object.roaming, false);
  assert.deepEqual(JSON.parse(JSON.stringify(object.stateFps)), { Idle: 10 });
  assert.equal(object.stateFrames.Idle.front[0].src, 'sprite.png');
  assert.equal('pathWaypoints' in object, false);
  assert.equal('knockback' in object, false);
  assert.equal('sandboxEnemy' in object, false);
});
