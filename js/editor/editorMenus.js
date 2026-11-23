/*
 * IsoPlayground — editor menus and context actions.
 *
 * Semua operasi yang berhubungan dengan posisi/visibilitas menu berada di sini.
 * Menu memanggil objectEditor dan domain modules untuk mengubah data; aturan
 * model objek tidak didefinisikan ulang di modul UI ini.
 */
import { IPState } from '../core/state.js';
import { SPRITE_ANIM_STATES, SPRITE_DIRECTIONS } from '../core/config.js';
import {
  findDuplicatePosition, isCellOccupiedOrPassedByAnyObject
} from '../world/objectQueries.js';
import {
  canAssignObjectRole, renameObjectRecord, createUniqueDuplicateName, duplicateObjectRecord
} from '../world/objects.js';
import { setObjectRoleDefault, applyRoleDefaults, npcDefaults, initNpcMotion } from '../world/roles.js';
import { ensureObjectStateFrames, createEmptyStateFramesMap } from '../rendering/sprites.js';
import { ensureCombatDefaults } from '../gameplay/combat.js';
import { applyFollowObjectCamera } from '../core/camera.js';
import { d } from '../rendering/renderer.js';
import { releaseControlFocus } from './domUtils.js';
import { syncObjectPanel, syncFooterActiveCoord } from './inspector.js';
import {
  renderObjectList, updateLabels, createObjectAtCell, deleteObjectById
} from './objectEditor.js';

/** Toggle one collapsible panel section. */
export function toggleSection(headerEl) {
  const box = headerEl.closest('.section-box');
  if (box) box.classList.toggle('folded');
  releaseControlFocus();
}

/** Open a header dropdown while closing competing context menus. */
export function toggleMenu(e, btn) {
  e.stopPropagation();
  closeContextMenus();
  const parent = btn.parentElement;
  const wasActive = parent.classList.contains('active');
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  if (!wasActive) parent.classList.add('active');
}

export function closeContextMenus() {
  document.getElementById('context-menu').classList.remove('open');
  document.getElementById('object-context-menu').classList.remove('open');
  document.getElementById('role-dropdown').classList.remove('open');
}

export function closeAllMenus() {
  closeIdentityRoleDropdown();
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  closeContextMenus();
}

/** Select the context target and position its context menu near the pointer. */
export function openObjectContextMenuAt(clientX, clientY, objId) {
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  document.getElementById('context-menu').classList.remove('open');
  document.getElementById('role-dropdown').classList.remove('open');

  IPState.editor.targetContextObjectId = objId;
  IPState.editor.activeObjectId = objId;
  renderObjectList();
  syncObjectPanel();
  syncFooterActiveCoord();
  d();

  const menuW = 142;
  const menuH = 132;
  const posX = Math.min(clientX, window.innerWidth - menuW);
  const posY = Math.min(clientY, window.innerHeight - menuH);
  document.getElementById('object-context-menu').style.left = Math.max(4, posX) + 'px';
  document.getElementById('object-context-menu').style.top = Math.max(4, posY) + 'px';
  document.getElementById('object-context-menu').classList.add('open');
}

export function onObjectItemContextMenu(e, objId) {
  e.preventDefault();
  e.stopPropagation();
  openObjectContextMenuAt(e.clientX, e.clientY, objId);
}

export function openIdentityRoleDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('identity-role-dropdown');
  const btn = document.getElementById('obj-role-button');
  const rect = btn.getBoundingClientRect();
  const width = 112;
  dropdown.style.left = Math.max(4, Math.min(window.innerWidth - width - 4, rect.right - width)) + 'px';
  dropdown.style.top = Math.min(window.innerHeight - 90, rect.bottom + 3) + 'px';
  dropdown.classList.add('open');
}

export function closeIdentityRoleDropdown() {
  document.getElementById('identity-role-dropdown').classList.remove('open');
}

export function openRoleDropdown(e) {
  e.stopPropagation();
  const rect = document.getElementById('give-role-btn').getBoundingClientRect();
  const dropW = 112;
  const dropH = 84;
  let leftPos = rect.right + 4;
  if (leftPos + dropW > window.innerWidth - 4) leftPos = Math.max(4, rect.left - dropW - 4);
  const topPos = Math.min(window.innerHeight - dropH - 4, Math.max(4, rect.top));
  const dropdown = document.getElementById('role-dropdown');
  dropdown.style.left = leftPos + 'px';
  dropdown.style.top = topPos + 'px';
  dropdown.classList.add('open');
}

export function resetTargetToDefaultObject() {
  const target = IPState.world.cubes.find(item => item.id === IPState.editor.targetContextObjectId);
  closeAllMenus();
  if (!target) return;
  setObjectRoleDefault(target);
  updateLabels();
  d();
}

export function assignRoleToTarget(roleName) {
  const check = canAssignObjectRole(IPState.world.cubes, IPState.editor.targetContextObjectId, roleName);
  closeAllMenus();
  if (!check.allowed) {
    if (check.reason === 'player-exists') {
      alert('Sudah ada Player: "' + check.existingPlayer.name + '". Hanya boleh ada satu Player.');
    }
    return;
  }
  applyRoleDefaults(check.target, roleName);
  updateLabels();
  d();
}

export function handleRenameObject() {
  const target = IPState.world.cubes.find(item => item.id === IPState.editor.targetContextObjectId);
  closeContextMenus();
  if (!target) return;
  const nextName = prompt('Nama baru objek (harus unik):', target.name);
  if (nextName === null) return;
  const result = renameObjectRecord(IPState.world.cubes, target.id, nextName);
  if (!result.ok) {
    if (result.reason === 'empty-name') alert('Nama objek tidak boleh kosong.');
    else if (result.reason === 'duplicate-name') alert('Nama "' + result.name + '" sudah digunakan. Masukkan nama yang unik.');
    return;
  }
  updateLabels();
  d();
}

export function handleDuplicateObject() {
  const source = IPState.world.cubes.find(item => item.id === IPState.editor.targetContextObjectId);
  closeContextMenus();
  if (!source) return;
  // Hanya satu Player yang didukung oleh sistem kontrol, combat, dan kamera.
  if (source.role === 'Player') {
    alert('Hanya boleh ada satu Player. Player tidak bisa diduplikasi.');
    return;
  }
  const position = findDuplicatePosition(source);
  if (!position) {
    alert('Tidak ada ruang kosong untuk menduplikasi objek ini.');
    return;
  }

  const nextName = createUniqueDuplicateName(IPState.world.cubes, source.name);
  const clone = duplicateObjectRecord(source, {
    id: IPState.world.nextObjectId++,
    name: nextName,
    position,
    createEmptyStateFramesMap,
    ensureObjectStateFrames,
    animationStates: SPRITE_ANIM_STATES,
    directions: SPRITE_DIRECTIONS
  });

  if (clone.role === 'default') {
    setObjectRoleDefault(clone);
  } else {
    clone.homeU = clone.u;
    clone.homeV = clone.v;
    if (clone.role === 'NPC') {
      npcDefaults(clone);
      if (clone.roaming) initNpcMotion(clone);
      else { clone.vx = 0; clone.vz = 0; clone.changeTimer = 999; }
    }
    ensureCombatDefaults(clone);
  }

  IPState.world.cubes.push(clone);
  IPState.editor.activeObjectId = clone.id;
  IPState.editor.targetContextObjectId = clone.id;
  updateLabels();
  syncFooterActiveCoord();
  if (IPState.camera.followObjectEnabled) applyFollowObjectCamera();
  d();
}

export function handleDeleteObject() {
  const idToDelete = IPState.editor.targetContextObjectId;
  closeContextMenus();
  deleteObjectById(idToDelete);
}

export function handleAddObject() {
  if (IPState.editor.pendingCell) {
    const { cellU, cellV } = IPState.editor.pendingCell;
    if (isCellOccupiedOrPassedByAnyObject(cellU, cellV, 0)) {
      IPState.editor.pendingCell = null;
      closeContextMenus();
      return;
    }
    createObjectAtCell(cellU, cellV, 'default');
  }
  IPState.editor.pendingCell = null;
  closeContextMenus();
}

export const editorMenuActions = Object.freeze({
  toggleSection,
  toggleMenu,
  closeContextMenus,
  closeAllMenus,
  openObjectContextMenuAt,
  onObjectItemContextMenu,
  openIdentityRoleDropdown,
  closeIdentityRoleDropdown,
  openRoleDropdown,
  resetTargetToDefaultObject,
  assignRoleToTarget,
  handleRenameObject,
  handleDuplicateObject,
  handleDeleteObject,
  handleAddObject
});
