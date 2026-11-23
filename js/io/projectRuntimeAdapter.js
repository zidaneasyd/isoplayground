/*
 * IsoPlayground — commit a parsed project into live runtime state.
 *
 * projectIO.js memvalidasi dan menormalkan data tanpa side effect. Modul ini
 * menjadi batas commit: menerapkan snapshot ke IPState, menyelaraskan kontrol
 * HTML, lalu meminta editor dan renderer memperbarui tampilannya.
 */
import { IPState } from '../core/state.js';
import { parseProjectJSON } from './projectIO.js';
import { clampObjectsToWorld } from '../world/collision.js';
import { applyFollowObjectCamera } from '../core/camera.js';
import { updateLabels } from '../editor/objectEditor.js';
import { d } from '../rendering/renderer.js';
import { createSpriteRecord } from '../rendering/spriteAssets.js';

/** Convert parser asset descriptors into browser Image-backed sprite records. */
function hydrateProjectSpriteAssets(project, makeSpriteRecord) {
  if (!project || !Array.isArray(project.cubes)) return;
  for (const object of project.cubes) {
    const states = object.stateFrames;
    if (!states || typeof states !== 'object') continue;
    for (const stateFrames of Object.values(states)) {
      if (!stateFrames || typeof stateFrames !== 'object') continue;
      for (const [direction, records] of Object.entries(stateFrames)) {
        if (!Array.isArray(records)) continue;
        stateFrames[direction] = records
          .filter(record => record && typeof record.src === 'string' && record.src.length > 0)
          .map(record => makeSpriteRecord(
            record.src, record.width, record.height, record.name || ''
          ));
      }
    }
  }
}

export function applyImportedJSON(rawText, options = {}) {
  const project = parseProjectJSON(rawText, {
    sandboxSession: options && options.sandboxSession === true
  });
  hydrateProjectSpriteAssets(project, options.createSpriteRecord || createSpriteRecord);

  // Commit baru dilakukan setelah parser menghasilkan snapshot lengkap dan
  // seluruh deskriptor sprite sudah diubah menjadi asset runtime browser.
  IPState.world.size = project.worldSize;
  IPState.editor.showGrid = project.showGrid;
  IPState.editor.showAxis = project.showAxis;
  IPState.camera.followObjectEnabled = project.followObjectEnabled;
  IPState.world.cubes = project.cubes;
  IPState.world.nextObjectId = project.nextObjectId;
  IPState.editor.activeObjectId = project.activeObjectId;

  if (project.camera) {
    IPState.camera.zoom = project.camera.z;
    IPState.camera.panPx = project.camera.panPx;
    IPState.camera.panPy = project.camera.panPy;
    IPState.world.offsetU = project.camera.worldOffsetU;
    IPState.world.offsetV = project.camera.worldOffsetV;
  }

  const worldSizeSlider = document.getElementById('world-size-slider');
  const gridToggle = document.getElementById('grid-toggle');
  const axisToggle = document.getElementById('axis-toggle');
  const followObjectToggle = document.getElementById('follow-object-toggle');
  if (worldSizeSlider) worldSizeSlider.value = String(IPState.world.size);
  if (gridToggle) {
    gridToggle.classList.toggle('active', IPState.editor.showGrid);
    gridToggle.setAttribute('aria-pressed', String(IPState.editor.showGrid));
  }
  if (axisToggle) {
    axisToggle.classList.toggle('active', IPState.editor.showAxis);
    axisToggle.setAttribute('aria-pressed', String(IPState.editor.showAxis));
  }
  if (followObjectToggle) {
    followObjectToggle.classList.toggle('active', IPState.camera.followObjectEnabled);
    followObjectToggle.setAttribute('aria-pressed', String(IPState.camera.followObjectEnabled));
  }

  clampObjectsToWorld();
  updateLabels();
  if (IPState.camera.followObjectEnabled && IPState.editor.activeObjectId !== null) {
    applyFollowObjectCamera();
  }
  d();
}
