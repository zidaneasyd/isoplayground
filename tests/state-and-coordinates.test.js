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

function loadCameraModule(context) {
  const source = fs.readFileSync(path.join(root, 'js', 'camera.js'), 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(source, context, { filename: 'camera.js (module body)' });
}

function createIsoContext() {
  // Meniru lingkungan classic script di browser: window === globalThis.
  const context = {
    innerWidth: 1280,
    innerHeight: 800,
    performance: { now: () => 1000 },
    d: () => {}
  };
  context.window = context;
  vm.createContext(context);

  for (const file of ['config.js', 'state.js']) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  loadCollisionModule(context);
  context.IPConfig = context.window.IPConfig;
  const moduleSource = fs.readFileSync(path.join(root, 'js', 'coordinates.js'), 'utf8')
    .replace(/^import \{[\s\S]*?\} from ['"]\.\/legacyBridge\.js['"];\s*/m, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(moduleSource, context, { filename: 'coordinates.js (module body)' });
  loadObjectsModule(context);
  loadCameraModule(context);

  return context;
}

test('legacy state names stay synchronized with IPState', () => {
  const context = createIsoContext();

  assert.equal(Object.keys(context.IPStateBindings).length, 34);
  vm.runInContext(`
    worldSize = 20;
    cubes.push({ id: 7 });
    activeObjectId = 7;
    z = 1.5;
    pressedKeys.up = true;
    spritePreviewPlaying = true;
    lastFrameTime = 2500;
    _sbVals.push(42);
  `, context);

  assert.equal(context.IPState.world.size, 20);
  assert.equal(context.IPState.world.cubes[0].id, 7);
  assert.equal(context.IPState.editor.activeObjectId, 7);
  assert.equal(context.IPState.camera.zoom, 1.5);
  assert.equal(context.IPState.input.pressedKeys.up, true);
  assert.equal(context.IPState.sprites.previewPlaying, true);
  assert.equal(context.IPState.simulation.lastFrameTime, 2500);
  assert.equal(context.IPState.sandbox.comparisonValues[0], 42);
});

test('projection maps world origin to viewport center', () => {
  const context = createIsoContext();
  const projection = vm.runInContext('getProjectionHelpers()', context);

  assert.equal(projection.cx, 640);
  assert.equal(projection.cy, 400);
  assert.equal(projection.sz, 48);

  const origin = projection.p3d(0, 0, 0);
  assert.equal(origin.x, 640);
  assert.equal(origin.y, 400);
});

test('isometric projection separates U, V, and object height', () => {
  const context = createIsoContext();
  const projection = vm.runInContext('getProjectionHelpers()', context);
  const origin = projection.p3d(0, 0, 0);
  const u = projection.p3d(1, 0, 0);
  const v = projection.p3d(0, 1, 0);
  const elevated = projection.p3d(0, 0, 1);

  assert.ok(u.x > origin.x);
  assert.ok(u.y > origin.y);
  assert.ok(v.x < origin.x);
  assert.ok(v.y > origin.y);
  assert.equal(elevated.x, origin.x);
  assert.ok(elevated.y < origin.y);
});

test('screenToGridCell reverses projection at a cell center', () => {
  const context = createIsoContext();
  const projection = vm.runInContext('getProjectionHelpers()', context);
  const center = projection.p3d(0.5, 0.5, 0);
  const cell = vm.runInContext(
    `screenToGridCell(${center.x}, ${center.y})`,
    context
  );

  assert.equal(cell.cellU, 0);
  assert.equal(cell.cellV, 0);
  assert.equal(cell.centerU, 0.5);
  assert.equal(cell.centerV, 0.5);
});


test('follow camera centers the selected object', () => {
  const context = createIsoContext();
  vm.runInContext(`
    cubes = [{ id: 1, u: 2, v: -1, h: 0.5 }];
    activeObjectId = 1;
    followObjectEnabled = true;
    applyFollowObjectCamera();
  `, context);
  const centered = vm.runInContext('getProjectionHelpers().p3d(2, -1, 0.5)', context);

  assert.ok(Math.abs(centered.x - 640) < 1e-9);
  assert.ok(Math.abs(centered.y - 400) < 1e-9);
});

test('zoom keeps the selected world point at its screen anchor', () => {
  const context = createIsoContext();
  const anchor = vm.runInContext('getProjectionHelpers().p3d(1.25, -0.75, 0)', context);
  context.anchorX = anchor.x;
  context.anchorY = anchor.y;
  vm.runInContext('applyZoomAtScreenPoint(1.4, anchorX, anchorY)', context);
  const after = vm.runInContext('getProjectionHelpers().p3d(1.25, -0.75, 0)', context);

  assert.ok(Math.abs(after.x - anchor.x) < 1e-9);
  assert.ok(Math.abs(after.y - anchor.y) < 1e-9);
});

test('camera world offset is clamped to the world-size limit', () => {
  const context = createIsoContext();
  vm.runInContext('worldOffsetU = 50; worldOffsetV = -50; clampWorldOffset()', context);

  assert.equal(context.IPState.world.offsetU, 12);
  assert.equal(context.IPState.world.offsetV, -12);
});


test('Sandbox mode is read from shared state, not the document CSS class', () => {
  const context = createIsoContext();
  assert.equal(vm.runInContext('isSandboxMode()', context), false);
  vm.runInContext('IPState.sandbox.active = true', context);
  assert.equal(vm.runInContext('isSandboxMode()', context), true);
  vm.runInContext('IPState.sandbox.active = false', context);
  assert.equal(vm.runInContext('isSandboxMode()', context), false);
});
