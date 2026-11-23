const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const expectedScripts = [
  'js/config.js',
  'js/state.js',
  'js/roles.js',
  'js/npc.js',
  'js/sprites.js',
  'js/combat.js',
  'js/renderer.js',
  'js/simulation.js',
  'js/editor.js',
  'js/inspector.js',
  'js/input.js',
  'js/commands.js',
  'js/sandbox.js',
  'js/engine.js',
  'js/legacyBridge.js',
  'js/collision.js',
  'js/coordinates.js',
  'js/objects.js',
  'js/camera.js',
  'js/projectIO.js',
  'js/eventBridge.js',
  'js/main.js'
];

test('HTML loads all local scripts in the required dependency order', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scriptTags = [...html.matchAll(/<script\b([^>]*)><\/script>/g)];
  const scripts = scriptTags.map(match => ({
    src: (match[1].match(/\bsrc="([^"]+)"/) || [])[1],
    type: (match[1].match(/\btype="([^"]+)"/) || [])[1] || 'classic'
  }));
  assert.deepEqual(scripts.map(item => item.src), expectedScripts);
  assert.deepEqual(scripts.map(item => item.type), [...expectedScripts.slice(0, -8).map(() => 'classic'), 'module', 'module', 'module', 'module', 'module', 'module', 'module', 'module']);
  for (const script of scripts) {
    assert.equal(fs.existsSync(path.join(root, script.src)), true, `${script.src} must exist`);
  }
});

test('HTML has no inline event attributes left', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(/\son[a-z]+\s*=/i.test(html), false);
  assert.ok((html.match(/data-ip-event-/g) || []).length > 0);
});

test('non-UI subsystem scripts can be loaded together without global declaration conflicts', () => {
  const context = {
    innerWidth: 800,
    innerHeight: 600,
    performance: { now: () => 1000 },
    addEventListener() {},
    document: { addEventListener() {}, getElementById() { return { addEventListener() {} }; } },
    localStorage: { removeItem() {} }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of expectedScripts.slice(0, -9)) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  const collisionModuleBody = fs.readFileSync(path.join(root, 'js/collision.js'), 'utf8')
    .replace(/^import \{ IPState \} from ['"]\.\/legacyBridge\.js['"];\s*/m, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(collisionModuleBody, context, { filename: 'collision.js (module body)' });
  const coordinatesModuleBody = fs.readFileSync(path.join(root, 'js/coordinates.js'), 'utf8')
    .replace(/^import \{[\s\S]*?\} from ['\"]\.\/legacyBridge\.js['\"];\s*/m, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(coordinatesModuleBody, context, { filename: 'coordinates.js (module body)' });
  const objectsModuleBody = fs.readFileSync(path.join(root, 'js/objects.js'), 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(objectsModuleBody, context, { filename: 'objects.js (module body)' });
  const cameraModuleBody = fs.readFileSync(path.join(root, 'js/camera.js'), 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/\bexport (?=function )/g, '');
  vm.runInContext(cameraModuleBody, context, { filename: 'camera.js (module body)' });

  for (const symbol of [
    'IPState', 'applyFollowObjectCamera', 'tryMoveCubeTo', 'createObjectRecordAtCell',
    'duplicateObjectRecord', 'applyRoleDefaults', 'initNpcMotion',
    'resolveSpriteForObject', 'getPanelPreviewFrames',
    'getRoleCombatDefaults', 'ensureCombatDefaults', 'dealDamage', 'updateAccidentalOverlapCollision',
    'getCubeFaces', 'pointInPolygon', 'hitTestCube', 'd', 'stepSimulation', 'trackFramePerformance', 'renderObjectList', 'syncObjectPanel', 'createSpriteRecord', 'updateKeyState', 'getPlayerEightWayVector', 'executeCommandLine', 'parseCycleFilename', 'buildSandboxSessionPayload', 'sandboxStorePut', 'initSandboxMode'
  ]) {
    assert.notEqual(typeof context[symbol], 'undefined', `${symbol} should be available`);
  }
});


test('per-frame simulation is extracted from the UI engine adapter', () => {
  const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const simulation = fs.readFileSync(path.join(root, 'js/simulation.js'), 'utf8');
  assert.match(simulation, /function stepSimulation\(now\)/);
  assert.match(simulation, /function sandboxStateChanged\(\)/);
  const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  assert.match(main, /requestAnimationFrame\(globalThis\.stepSimulation\)/);
  assert.doesNotMatch(engine, /function stepSimulation\(/);
  assert.doesNotMatch(engine, /function sandboxStateChanged\(/);
});


test('editor object and menu adapters are extracted from engine.js', () => {
  const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const editor = fs.readFileSync(path.join(root, 'js/editor.js'), 'utf8');
  assert.match(editor, /function renderObjectList\(\)/);
  assert.match(editor, /function handleAddObject\(\)/);
  assert.match(editor, /function resetProject\(\)/);
  assert.doesNotMatch(engine, /function renderObjectList\(/);
  assert.doesNotMatch(engine, /function handleAddObject\(/);
  assert.doesNotMatch(engine, /function resetProject\(/);
});


test('object inspector and sprite panel adapters are extracted from engine.js', () => {
  const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const inspector = fs.readFileSync(path.join(root, 'js/inspector.js'), 'utf8');
  assert.match(inspector, /function syncObjectPanel\(\)/);
  assert.match(inspector, /function syncSpritePanel\(\)/);
  assert.match(inspector, /function createSpriteRecord\(/);
  assert.doesNotMatch(engine, /function syncObjectPanel\(/);
  assert.doesNotMatch(engine, /function syncSpritePanel\(/);
  assert.doesNotMatch(engine, /function createSpriteRecord\(/);
});


test('keyboard input ownership is moved from engine.js to input.js', () => {
  const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const input = fs.readFileSync(path.join(root, 'js/input.js'), 'utf8');
  assert.match(input, /window\.addEventListener\('keydown'/);
  assert.match(input, /window\.addEventListener\('keyup'/);
  assert.match(input, /function getPlayerEightWayVector\(\)/);
  assert.doesNotMatch(engine, /window\.addEventListener\('keydown'/);
  assert.doesNotMatch(engine, /function getPlayerEightWayVector\(\)/);
});


test('command console and batch sprite-cycle handlers are extracted from engine.js', () => {
  const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const commands = fs.readFileSync(path.join(root, 'js/commands.js'), 'utf8');
  assert.match(commands, /function executeCommandLine\(raw\)/);
  assert.match(commands, /function handleCycleFilesSelected\(e\)/);
  assert.doesNotMatch(engine, /function executeCommandLine\(/);
  assert.doesNotMatch(engine, /function handleCycleFilesSelected\(/);
});


test('simulation does not access DOM; animated sprite preview belongs to inspector adapter', () => {
  const simulation = fs.readFileSync(path.join(root, 'js/simulation.js'), 'utf8');
  const inspector = fs.readFileSync(path.join(root, 'js/inspector.js'), 'utf8');
  assert.doesNotMatch(simulation, /\bdocument\./);
  assert.match(simulation, /updateActiveSpritePreview\(now\)/);
  assert.match(inspector, /function updateActiveSpritePreview\(now\)/);
});

test('browser visibility is translated into shared runtime state by the application host', () => {
  const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  const simulation = fs.readFileSync(path.join(root, 'js/simulation.js'), 'utf8');
  assert.match(main, /document\.addEventListener\('visibilitychange'/);
  assert.match(simulation, /!IPState\.runtime\.pageVisible/);
  assert.doesNotMatch(simulation, /document\.hidden/);
});


test('application startup is owned by main.js rather than engine.js', () => {
  const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  assert.match(main, /export function startIsoPlayground\(\)/);
  assert.match(main, /globalThis\.resizeCanvas\(\)/);
  assert.match(main, /globalThis\.updateLabels\(\)/);
  assert.match(main, /globalThis\.initSandboxMode/);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="js\/main\.js"><\/script>/);
  assert.match(main, /globalThis\.requestAnimationFrame\(globalThis\.stepSimulation\)/);
  assert.doesNotMatch(engine, /function startIsoPlayground\(/);
});


test('ES Module entry point uses explicit global bridge while legacy adapters remain classic scripts', () => {
  const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  assert.match(main, /^export function startIsoPlayground/m);
  assert.match(main, /globalThis\.IPState/);
  assert.doesNotMatch(main, /(?<!globalThis\.)\bIPState\.runtime/);
  assert.doesNotMatch(main, /(?<!globalThis\.)\bresizeCanvas\(/);
});


test('Project I/O is an ES Module with explicit legacy service imports', () => {
  const projectIO = fs.readFileSync(path.join(root, 'js/projectIO.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'js/legacyBridge.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(projectIO, /import \{[\s\S]*?IPConfig, IPState[\s\S]*?\} from '\.\/legacyBridge\.js'/);
  assert.match(projectIO, /export function buildProjectPayload/);
  assert.match(projectIO, /export function parseProjectJSON/);
  assert.match(projectIO, /globalThis\.buildProjectPayload = buildProjectPayload/);
  assert.match(bridge, /export const IPState = legacyGlobal\.IPState/);
  assert.match(bridge, /export const IPConfig = legacyGlobal\.IPConfig/);
  assert.match(html, /<script type="module" src="js\/legacyBridge\.js"><\/script>[\s\S]*?<script type="module" src="js\/projectIO\.js"><\/script>/);
});

test('coordinate transforms are an ES Module with explicit state/config imports', () => {
  const coordinates = fs.readFileSync(path.join(root, 'js/coordinates.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(coordinates, /import \{ IPConfig, IPState, getCellBounds \} from '\.\/legacyBridge\.js'/);
  assert.match(coordinates, /IPState\.camera\.zoom/);
  assert.match(coordinates, /IPState\.world\.size/);
  assert.match(coordinates, /export function getProjectionHelpers/);
  assert.match(coordinates, /export function screenToGridCell/);
  assert.match(html, /<script type="module" src="js\/legacyBridge\.js"><\/script>[\s\S]*?<script type="module" src="js\/collision\.js"><\/script>[\s\S]*?<script type="module" src="js\/coordinates\.js"><\/script>[\s\S]*?<script type="module" src="js\/objects\.js"><\/script>/);
});


test('collision rules are an ES Module and consume shared state explicitly', () => {
  const collision = fs.readFileSync(path.join(root, 'js/collision.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'js/legacyBridge.js'), 'utf8');
  assert.match(collision, /^import \{ IPState \} from '\.\/legacyBridge\.js'/m);
  assert.match(collision, /IPState\.world\.cubes/);
  assert.match(collision, /export function tryMoveCubeTo/);
  assert.match(collision, /globalThis, \{/);
  assert.match(bridge, /export function getCellBounds\(\.\.\.args\)/);
});

test('object model is an ES Module with explicit state and coordinate imports', () => {
  const objects = fs.readFileSync(path.join(root, 'js/objects.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(objects, /import \{ IPState, getCellBounds \} from '\.\/legacyBridge\.js'/);
  assert.match(objects, /import \{ screenToGridCell \} from '\.\/coordinates\.js'/);
  assert.match(objects, /export function createObjectRecordAtCell/);
  assert.match(objects, /IPState\.world\.cubes/);
  assert.match(html, /<script type="module" src="js\/coordinates\.js"><\/script>[\s\S]*?<script type="module" src="js\/objects\.js"><\/script>/);
});

test('camera calculations are an ES Module and DOM synchronization stays in engine adapter', () => {
  const camera = fs.readFileSync(path.join(root, 'js/camera.js'), 'utf8');
  const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(camera, /import \{ IPConfig, IPState \} from '\.\/legacyBridge\.js'/);
  assert.match(camera, /import \{ getProjectionHelpers \} from '\.\/coordinates\.js'/);
  assert.match(camera, /export function applyZoomAtScreenPoint/);
  assert.doesNotMatch(camera, /document\.|infoZoom|camZoomSlider/);
  assert.match(engine, /function syncCameraUI\(\)/);
  assert.match(html, /<script type="module" src="js\/objects\.js"><\/script>[\s\S]*?<script type="module" src="js\/camera\.js"><\/script>/);
});

test('HTML event dispatch is an ES Module and invokes only registered legacy actions', () => {
  const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const eventBridge = fs.readFileSync(path.join(root, 'js/eventBridge.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'js/legacyBridge.js'), 'utf8');
  assert.doesNotMatch(engine, /setupHtmlEventBridge|function dispatch\(/);
  assert.match(eventBridge, /export const LEGACY_EVENT_ACTION_NAMES/);
  assert.match(eventBridge, /createLegacyActionRegistry\(LEGACY_EVENT_ACTION_NAMES\)/);
  assert.match(eventBridge, /const action = actions\[match\[1\]\]/);
  assert.doesNotMatch(eventBridge, /window\[match\[1\]\]|globalThis\[match\[1\]\]/);
  assert.match(bridge, /export function createLegacyActionRegistry\(names\)/);
  assert.match(main, /installLegacyEventBridge\(\)/);
});

test('all HTML and generated object-list event actions are present in the explicit whitelist', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const editor = fs.readFileSync(path.join(root, 'js/editor.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'js/eventBridge.js'), 'utf8');
  const allJavaScript = fs.readdirSync(path.join(root, 'js'))
    .filter(file => file.endsWith('.js'))
    .map(file => fs.readFileSync(path.join(root, 'js', file), 'utf8'))
    .join('\n');
  const expressions = [...html.matchAll(/data-ip-event-[a-z]+="([^"]*)"/g),
    ...editor.matchAll(/data-ip-event-[a-z]+="([^"]*)"/g)];
  const referenced = new Set(expressions
    .map(match => (match[1].match(/^([A-Za-z_$][\w$]*)\(/) || [])[1])
    .filter(Boolean));
  const whitelistBody = (bridge.match(/LEGACY_EVENT_ACTION_NAMES = Object\.freeze\(\[([\s\S]*?)\]\)/) || [])[1] || '';
  const allowed = new Set([...whitelistBody.matchAll(/'([^']+)'/g)].map(match => match[1]));
  for (const name of referenced) {
    assert.ok(allowed.has(name), `${name} must be in the event action whitelist`);
  }
  for (const name of allowed) {
    if (name === 'alert') continue;
    assert.match(allJavaScript, new RegExp(`(?:function|export function)\\s+${name}\\s*\\(`), `${name} must have an implementation`);
  }
  assert.ok(allowed.has('alert'), 'native alert is an explicitly allowed browser action');
});
