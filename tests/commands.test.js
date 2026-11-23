const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createCommandContext() {
  const context = {
    innerWidth: 800,
    innerHeight: 600,
    performance: { now: () => 1000 },
    addEventListener() {},
    document: {
      addEventListener() {},
      getElementById() { return { addEventListener() {} }; }
    },
    localStorage: { removeItem() {} }
  };
  context.window = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(root, 'js', 'commands.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'commands.js' });
  return context;
}

test('cycle filename parser accepts direction-number image names', () => {
  const context = createCommandContext();
  assert.deepEqual(
    JSON.parse(JSON.stringify(vm.runInContext("parseCycleFilename('right-02.png')", context))),
    { direction: 'right', frame: 2 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(vm.runInContext("parseCycleFilename('LEFTFRONT-12.webp')", context))),
    { direction: 'leftfront', frame: 12 }
  );
  assert.equal(vm.runInContext("parseCycleFilename('walk-01.png')", context), null);
  assert.equal(vm.runInContext("parseCycleFilename('right-x.png')", context), null);
});
