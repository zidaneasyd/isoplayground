const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('HTML event bridge runs as an ES Module with explicit, whitelisted actions', () => {
  const probe = String.raw`
    import assert from 'node:assert/strict';
    import path from 'node:path';
    globalThis.IPState = {};
    globalThis.IPConfig = {};
    globalThis.getRoleCombatDefaults = () => ({});
    globalThis.ensureObjectStateFrames = () => ({});
    globalThis.clampSpriteFps = value => value;
    globalThis.normalizeSpeed = value => value;
    globalThis.createEmptyStateFramesMap = () => ({});
    globalThis.setObjectRoleDefault = () => {};
    globalThis.createSpriteRecord = () => ({});
    globalThis.allowedAction = (...args) => { globalThis.lastActionArgs = args; };

    const root = ${JSON.stringify(root)};
    const bridge = await import('file://' + path.join(root, 'js', 'eventBridge.js') + '?test=' + Date.now());
    const event = { type: 'click' };
    const element = {
      value: 'Hero',
      dataset: {},
      getAttribute: () => "allowedAction(event, this, this.value, 1.25, 'two\\nlines')"
    };
    bridge.dispatchLegacyEvent(element, event, element.getAttribute(), {
      allowedAction: globalThis.allowedAction
    });
    assert.equal(globalThis.lastActionArgs[0], event);
    assert.equal(globalThis.lastActionArgs[1], element);
    assert.equal(globalThis.lastActionArgs[2], 'Hero');
    assert.equal(globalThis.lastActionArgs[3], 1.25);
    assert.equal(globalThis.lastActionArgs[4], 'two\nlines');

    assert.throws(() => bridge.dispatchLegacyEvent(element, event, 'notAllowed()', {}), /tidak terdaftar/);
    bridge.dispatchLegacyEvent(element, event, 'this.dataset.previousName=this.value', {});
    assert.equal(element.dataset.previousName, 'Hero');

    const handlers = {};
    const fakeRoot = {
      addEventListener(type, listener, capture) { handlers[type] = { listener, capture }; },
      removeEventListener() {}
    };
    let clickCount = 0;
    bridge.setupHtmlEventBridge({ root: fakeRoot, actions: { allowedAction: () => clickCount++ } });
    const clicked = {
      closest: selector => selector === '[data-ip-event-click]' ? element : null
    };
    handlers.click.listener({ target: clicked });
    assert.equal(clickCount, 1);
    assert.equal(handlers.focus.capture, true);
    assert.equal(handlers.mouseenter.capture, true);

    // Smoke-test the real install path: every whitelisted legacy action must
    // exist before main.js can bootstrap the application.
    for (const name of bridge.LEGACY_EVENT_ACTION_NAMES) {
      globalThis[name] = (...args) => { globalThis.lastRegisteredAction = { name, args }; };
    }
    const installedHandlers = {};
    globalThis.document = {
      addEventListener(type, listener, capture) { installedHandlers[type] = { listener, capture }; },
      removeEventListener() {}
    };
    bridge.installLegacyEventBridge();
    const gridElement = {
      closest(selector) { return selector === '[data-ip-event-click]' ? this : null; },
      getAttribute: () => 'toggleGridVisibility()'
    };
    installedHandlers.click.listener({ target: gridElement });
    assert.equal(globalThis.lastRegisteredAction.name, 'toggleGridVisibility');

    process.stdout.write('ESM event bridge whitelist and delegation passed');
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.match(output, /ESM event bridge whitelist and delegation passed/);
});
