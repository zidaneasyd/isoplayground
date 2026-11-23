const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createSandboxContext() {
  const context = { innerWidth: 800, innerHeight: 600, performance: { now: () => 1000 } };
  context.window = context;
  vm.createContext(context);
  for (const file of ['config.js', 'state.js', 'sandbox.js']) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  return context;
}

test('Sandbox payload carries the live NPC enemy flag without changing the base payload', () => {
  const context = createSandboxContext();
  vm.runInContext(`
    cubes = [
      { id: 1, role: 'NPC', enemy: true },
      { id: 2, role: 'NPC', enemy: false },
      { id: 3, role: 'Player', enemy: true }
    ];
    buildProjectPayload = () => ({ cubes: [
      { id: 1, role: 'NPC' }, { id: 2, role: 'NPC' }, { id: 3, role: 'Player' }
    ] });
  `, context);
  const result = vm.runInContext('buildSandboxSessionPayload()', context);
  assert.equal(result.cubes[0].sandboxEnemy, true);
  assert.equal(result.cubes[1].sandboxEnemy, false);
  assert.equal('sandboxEnemy' in result.cubes[2], false);
  assert.equal('sandboxEnemy' in context.buildProjectPayload().cubes[0], false);
});

test('Sandbox IndexedDB helper reports unavailable storage as a rejected promise', async () => {
  const context = createSandboxContext();
  await assert.rejects(vm.runInContext('sandboxDbOpen()', context), /IndexedDB tidak tersedia/);
});
