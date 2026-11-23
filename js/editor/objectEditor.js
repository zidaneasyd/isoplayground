/*
 * IsoPlayground — object editor operations.
 *
 * Modul ini menghubungkan model objek dengan daftar dan selection di editor.
 * Aturan data objek tetap dimiliki objects/roles/collision; modul ini hanya
 * menjalankan perintah editor lalu menyegarkan tampilan yang terkait.
 */
import { IPState, isSandboxMode } from '../core/state.js';
import { normalizeEvenSize } from '../world/worldConfig.js';
import { createObjectRecordAtCell, removeObjectRecord } from '../world/objects.js';
import { getCellBounds, isPathClearOfOtherCubes, clampObjectsToWorld, updateAccidentalOverlapCollision } from '../world/collision.js';
import { getDirectionKeyFromVector } from '../core/directions.js';
import { applyRoleDefaults } from '../world/roles.js';
import { applyFollowObjectCamera } from '../core/camera.js';
import { d } from '../rendering/renderer.js';
import { escapeHtml } from '../core/textUtils.js';
import { getRoleDisplay, syncObjectPanel, syncFooterActiveCoord } from './inspector.js';

/** Render daftar objek dan tandai item yang sedang dipilih. */
export function renderObjectList() {
  document.getElementById('right-count-badge').textContent = String(IPState.world.cubes.length);
  if (IPState.world.cubes.length === 0) {
    document.getElementById('object-list').innerHTML = '<div class="object-empty">Belum ada objek</div>';
    return;
  }
  document.getElementById('object-list').innerHTML = IPState.world.cubes.map(cb => {
    const isActive = cb.id === IPState.editor.activeObjectId;
    const roleInfo = getRoleDisplay(cb.role);
    return `<div class="object-item${isActive ? ' active' : ''}" data-obj-id="${cb.id}" data-ip-event-click="selectObject(${cb.id})" data-ip-event-contextmenu="onObjectItemContextMenu(event, ${cb.id})">
      <div class="object-name-wrap">
        <span>${escapeHtml(cb.name)}</span>
        <span class="object-role-tag ${roleInfo.cls}">${roleInfo.label}</span>
      </div>
    </div>`;
  }).join('');
}


/** Move a selected default object by one full grid cell. */
export function moveDefaultObjectByCell(object, du, dv) {
  const { minCell, maxCell } = getCellBounds();
  const nextCellU = Math.max(minCell, Math.min(maxCell, Math.floor(object.u) + du));
  const nextCellV = Math.max(minCell, Math.min(maxCell, Math.floor(object.v) + dv));
  const nextU = nextCellU + 0.5;
  const nextV = nextCellV + 0.5;

  if (!isPathClearOfOtherCubes(object.u, object.v, nextU, nextV, object.h, object.id)) return;

  const stepDirection = getDirectionKeyFromVector(nextU - object.u, nextV - object.v);
  if (stepDirection) object.activeSpriteDir = stepDirection;
  object.u = nextU;
  object.v = nextV;
  syncFooterActiveCoord();
  if (IPState.camera.followObjectEnabled) applyFollowObjectCamera();
  d();
}

/** Select/unselect object from the list and refresh the inspector. */
export function selectObject(id) {
  if (isSandboxMode()) return;
  IPState.editor.activeObjectId = (IPState.editor.activeObjectId === id) ? null : id;
  renderObjectList();
  syncObjectPanel();
  syncFooterActiveCoord();
  if (IPState.camera.followObjectEnabled && IPState.editor.activeObjectId !== null) {
    applyFollowObjectCamera();
  }
  d();
}

/** Refresh shared world labels and all object-dependent editor panels. */
export function updateLabels() {
  document.getElementById('world-size-val').textContent = IPState.world.size + ' × ' + IPState.world.size + ' m²';
  document.getElementById('header-grid-info').textContent = 'Plane ' + IPState.world.size + ' × ' + IPState.world.size + ' m²';
  document.getElementById('footer-grid-info').textContent = '1 petak = 1 m² | Plane: ' + IPState.world.size + ' × ' + IPState.world.size + ' m² | Player: 8 arah | NPC: Acak bebas';
  renderObjectList();
  syncObjectPanel();
  syncFooterActiveCoord();
}

/** Change world width/depth while keeping existing objects within its bounds. */
export function setWorldSize(val) {
  const nextSize = normalizeEvenSize(val);
  IPState.world.size = nextSize;
  document.getElementById('world-size-slider').value = IPState.world.size;
  clampObjectsToWorld();
  updateAccidentalOverlapCollision();
  updateLabels();
  d();
}

/** Delete one object and keep selection valid. */
export function deleteObjectById(objId) {
  const result = removeObjectRecord(IPState.world.cubes, objId, IPState.editor.activeObjectId);
  if (!result.removed) return;
  IPState.editor.activeObjectId = result.activeObjectId;
  updateLabels();
  d();
}

/** Create an object at a grid cell; used by both editor UI and command console. */
export function createObjectAtCell(cellU, cellV, role, makeActive = true) {
  const creation = createObjectRecordAtCell(IPState.world.cubes, IPState.world.nextObjectId, cellU, cellV, role);
  const newCube = creation.object;
  IPState.world.nextObjectId = creation.nextObjectId;
  IPState.world.cubes.push(newCube);
  if (role === 'Player') applyRoleDefaults(newCube, 'Player');
  if (makeActive) IPState.editor.activeObjectId = newCube.id;
  updateLabels();
  if (makeActive && IPState.camera.followObjectEnabled) applyFollowObjectCamera();
  d();
  return newCube;
}

/** Remove the most recently added object. */
export function undoCube() {
  if (IPState.world.cubes.length > 0) {
    const removed = IPState.world.cubes.pop();
    if (IPState.editor.activeObjectId === removed.id) {
      IPState.editor.activeObjectId = IPState.world.cubes.length > 0
        ? IPState.world.cubes[IPState.world.cubes.length - 1].id
        : null;
    }
    updateLabels();
    d();
  }
}

/** Clear objects but retain current world/camera configuration. */
export function clearCubes() {
  IPState.world.cubes = [];
  IPState.world.nextObjectId = 1;
  IPState.editor.activeObjectId = null;
  updateLabels();
  d();
}

/** Restore a fresh empty project with the default camera and world offsets. */
export function resetProject() {
  IPState.world.cubes = [];
  IPState.world.nextObjectId = 1;
  IPState.editor.activeObjectId = null;
  IPState.world.offsetU = 0;
  IPState.world.offsetV = 0;
  IPState.camera.zoom = 1;
  IPState.camera.panPx = 0;
  IPState.camera.panPy = 0;
  updateLabels();
  d();
}

export const objectEditorActions = Object.freeze({
  renderObjectList,
  moveDefaultObjectByCell,
  selectObject,
  updateLabels,
  setWorldSize,
  deleteObjectById,
  createObjectAtCell,
  undoCube,
  clearCubes,
  resetProject
});
