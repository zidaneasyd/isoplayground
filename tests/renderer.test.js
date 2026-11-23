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

function createRendererContext() {
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
  for (const file of ['roles.js', 'sprites.js', 'renderer.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
  }
  context.IPConfig = context.window.IPConfig;
  const coordinatesSource = fs.readFileSync(path.join(root, 'js', 'coordinates.js'), 'utf8')
    .replace(/^import \{[\s\S]*?\} from ['"]\.\/legacyBridge\.js['"];\s*/m, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(coordinatesSource, context, { filename: 'coordinates.js (module body)' });
  loadCameraModule(context);
  loadObjectsModule(context);
  return context;
}

test('point-in-polygon includes interior points and excludes exterior points', () => {
  const context = createRendererContext();
  vm.runInContext(`polygon = [
    { x: 0, y: 0 }, { x: 10, y: 0 },
    { x: 10, y: 10 }, { x: 0, y: 10 }
  ]`, context);
  assert.equal(vm.runInContext('pointInPolygon({ x: 5, y: 5 }, polygon)', context), true);
  assert.equal(vm.runInContext('pointInPolygon({ x: 15, y: 5 }, polygon)', context), false);
});

test('cube face geometry returns four vertices for each visible face', () => {
  const context = createRendererContext();
  vm.runInContext('viewWidth = 800; viewHeight = 600; z = 1; panPx = 0; panPy = 0', context);
  const faces = vm.runInContext(`getCubeFaces(getProjectionHelpers().p3d, { u: 0, v: 0, h: 0 })`, context);
  assert.equal(faces.topFace.length, 4);
  assert.equal(faces.leftFace.length, 4);
  assert.equal(faces.rightFace.length, 4);
  assert.ok(Number.isFinite(faces.topCenter.x));
  assert.ok(Number.isFinite(faces.topCenter.y));
});

test('hit test selects the object under its projected top face', () => {
  const context = createRendererContext();
  vm.runInContext(`
    viewWidth = 800; viewHeight = 600; z = 1; panPx = 0; panPy = 0;
    cubes = [{ id: 7, name: 'Target', role: 'default', u: 0, v: 0, h: 0, collision: true }];
    const faces = getCubeFaces(getProjectionHelpers().p3d, cubes[0]);
    testPoint = faces.topCenter;
  `, context);
  assert.equal(vm.runInContext('hitTestCube(testPoint.x, testPoint.y).id', context), 7);
  assert.equal(vm.runInContext('hitTestCube(5, 5)', context), null);
});
