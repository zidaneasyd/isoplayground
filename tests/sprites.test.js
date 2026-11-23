const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createSpriteContext() {
  let now = 1000;
  const context = {
    innerWidth: 800,
    innerHeight: 600,
    performance: { now: () => now }
  };
  context.setNow = value => { now = value; };
  context.window = context;
  vm.createContext(context);
  for (const file of ['config.js', 'state.js', 'sprites.js']) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  return context;
}

test('empty sprite frame map contains every state and direction', () => {
  const context = createSpriteContext();
  const map = vm.runInContext('createEmptyStateFramesMap()', context);
  for (const state of ['Idle', 'Run', 'Attack']) {
    for (const direction of ['front', 'frontright', 'right', 'rightback', 'back', 'backleft', 'left', 'leftfront']) {
      assert.deepEqual(Array.from(map[state][direction]), []);
    }
  }
});

test('sprite frame normalization repairs incomplete object data', () => {
  const context = createSpriteContext();
  vm.runInContext(`object = { stateFrames: { Idle: { front: ['sprite-a'], right: null } } }`, context);
  const frames = vm.runInContext('ensureObjectStateFrames(object)', context);
  assert.deepEqual(Array.from(frames.Idle.front), ['sprite-a']);
  assert.deepEqual(Array.from(frames.Idle.right), []);
  assert.deepEqual(Array.from(frames.Run.front), []);
  assert.deepEqual(Array.from(frames.Attack.back), []);
});

test('sprite FPS values are clamped to configured bounds', () => {
  const context = createSpriteContext();
  assert.equal(vm.runInContext('clampSpriteFps(1)', context), 6);
  assert.equal(vm.runInContext('clampSpriteFps(100)', context), 30);
  assert.equal(vm.runInContext('clampSpriteFps(NaN)', context), 8);
  assert.equal(vm.runInContext('getObjectStateFps({}, \'Idle\')', context), 8);
});

test('runtime animation state prioritizes attack, then movement, then idle', () => {
  const context = createSpriteContext();
  vm.runInContext(`object = { attackAnimUntil: 1200, isMovingNow: true, runHoldUntil: 0 }`, context);
  assert.equal(vm.runInContext("getRuntimeAnimationStateForObject(object, 1100)", context), 'Attack');
  assert.equal(vm.runInContext("getRuntimeAnimationStateForObject(object, 1300)", context), 'Run');
  vm.runInContext('object.isMovingNow = false', context);
  assert.equal(vm.runInContext("getRuntimeAnimationStateForObject(object, 1300)", context), 'Idle');
});

test('runtime sprite resolver selects the correct frame based on elapsed time and FPS', () => {
  const context = createSpriteContext();
  vm.runInContext(`object = {
    id: 1, activeSpriteDir: 'front', animStateStartTime: 0,
    stateFps: { Idle: 8 }, isMovingNow: false,
    stateFrames: { Idle: { front: ['frame-1', 'frame-2', 'frame-3'] } }
  }`, context);
  assert.equal(vm.runInContext('resolveSpriteForObject(object, 260)', context), 'frame-3');
  vm.runInContext("object.activeSpriteDir = 'invalid'", context);
  assert.equal(vm.runInContext('getActiveDirectionForObject(object)', context), 'front');
});

test('sprite cache is reset at the beginning of each render frame', () => {
  const context = createSpriteContext();
  vm.runInContext(`object = {
    id: 1, activeSpriteDir: 'front', animStateStartTime: 0,
    stateFrames: { Idle: { front: ['frame'] } }
  }`, context);
  vm.runInContext('beginSpriteFrame()', context);
  assert.equal(vm.runInContext('getSpriteForObject(object)', context), 'frame');
  assert.equal(vm.runInContext('spriteCache.size', context), 1);
  vm.runInContext('beginSpriteFrame()', context);
  assert.equal(vm.runInContext('spriteCache.size', context), 0);
});

test('panel preview and filename sorting preserve expected behavior', () => {
  const context = createSpriteContext();
  vm.runInContext(`object = {
    panelAnimState: 'Idle', panelPreviewDir: 'front', stateFps: { Idle: 8 },
    stateFrames: { Idle: { front: ['frame-1', 'frame-2', 'frame-3'] } }
  }`, context);
  assert.equal(vm.runInContext('getPanelPreviewSpriteForObject(object, 1500)', context), 'frame-1');
  vm.runInContext('spritePreviewPlaying = true; spritePreviewStartTime = 1000', context);
  assert.equal(vm.runInContext('getPanelPreviewSpriteForObject(object, 1260)', context), 'frame-3');
  assert.equal(vm.runInContext("compareFilenamesAscending('frame2.png', 'frame10.png') < 0", context), true);
  assert.equal(vm.runInContext('hasAnySpriteUploaded(object)', context), true);
});
