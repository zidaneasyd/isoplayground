const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Collision, Coordinate, Object, Camera, and Project I/O modules run through real ESM loading', () => {
  const probe = String.raw`
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import vm from 'node:vm';
    import path from 'node:path';
    globalThis.window = globalThis;
    globalThis.innerWidth = 800;
    globalThis.innerHeight = 600;
    const root = ${JSON.stringify(root)};
    for (const file of ['config.js', 'state.js', 'roles.js', 'sprites.js', 'combat.js']) {
      vm.runInThisContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), { filename: file });
    }
    globalThis.createSpriteRecord = (src, width, height, name) => ({ src, width, height, name, loaded: false, img: null });
    const collision = await import('file://' + path.join(root, 'js', 'collision.js') + '?test=' + Date.now());
    assert.equal(typeof collision.tryMoveCubeTo, 'function');
    globalThis.IPState.world.size = 10;
    globalThis.IPState.world.cubes = [
      { id: 1, u: 0.5, v: 0.5, h: 0, collision: true },
      { id: 2, u: 1.5, v: 0.5, h: 0, collision: true }
    ];
    assert.equal(collision.isPointClearOfOtherCubes(1.5, 0.5, 0, 1), false);
    const coords = await import('file://' + path.join(root, 'js', 'coordinates.js') + '?test=' + Date.now());
    globalThis.IPState.camera.viewWidth = 1280;
    globalThis.IPState.camera.viewHeight = 800;
    const projected = coords.getProjectionHelpers().p3d(0, 0, 0);
    assert.equal(projected.x, 640);
    assert.equal(projected.y, 400);
    const centerCell = coords.screenToGridCell(640, 400);
    assert.equal(centerCell.cellU, 0);
    assert.equal(centerCell.cellV, 0);
    globalThis.d = () => {};
    const objects = await import('file://' + path.join(root, 'js', 'objects.js') + '?test=' + Date.now());
    const camera = await import('file://' + path.join(root, 'js', 'camera.js') + '?test=' + Date.now());
    globalThis.IPState.camera.zoom = 1;
    camera.applyZoomAtScreenPoint(1.4, 640, 400);
    assert.equal(globalThis.IPState.camera.zoom, 1.4);
    const created = objects.createObjectRecordAtCell([], 4, -1, 2, 'NPC');
    assert.equal(created.object.id, 4);
    assert.equal(created.object.u, -0.5);
    assert.ok(objects.findSpawnCell(), 'object model should resolve world bounds through the lazy bridge');
    const io = await import('file://' + path.join(root, 'js', 'projectIO.js') + '?test=' + Date.now());
    assert.equal(io.normalizeEvenSize(13), 12);
    globalThis.IPState.world.size = 14;
    globalThis.IPState.world.cubes = [{ id: 1, name: 'Hero', role: 'Player', collision: true, u: 1, v: 2, h: 0 }];
    const payload = io.buildProjectPayload();
    assert.equal(payload.worldSize, 14);
    const restored = io.parseProjectJSON(JSON.stringify(payload), {
      createSpriteRecord: globalThis.createSpriteRecord,
      setObjectRoleDefault: globalThis.setObjectRoleDefault
    });
    assert.equal(restored.cubes[0].name, 'Hero');
    assert.equal(globalThis.buildProjectPayload, io.buildProjectPayload);
    process.stdout.write('ESM collision, coordinate, object, camera and Project I/O modules passed');
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.match(output, /ESM collision, coordinate, object, camera and Project I\/O modules passed/);
});
