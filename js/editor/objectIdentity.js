/*
 * IsoPlayground — selected object identity and role controls.
 *
 * Menangani nama, role, dan toggle collision dari inspector. Perubahan role
 * tetap menggunakan rules service di roles.js/objects.js.
 */
import { IPState } from '../core/state.js';
import { isNameUnique } from '../world/objectQueries.js';
import { canAssignObjectRole } from '../world/objects.js';
import { applyRoleDefaults } from '../world/roles.js';
import { renderObjectList } from './objectEditor.js';
import { closeIdentityRoleDropdown } from './editorMenus.js';
import { syncObjectPanel } from './inspector.js';
import { syncSpritePanel } from './spriteInspector.js';
import { d } from '../rendering/renderer.js';

function getActiveObject() {
  return IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId) || null;
}

export function setActiveObjectNameLive(value) {
  const object = getActiveObject();
  if (!object) return;
  const name = String(value);
  if (name && !isNameUnique(name, object.id)) return;
  object.name = name;
  const badge = document.getElementById('obj-role-badge');
  if (badge) {
    badge.textContent = object.name;
    badge.title = object.role === 'Player' ? 'Player' : object.role === 'NPC' ? 'NPC' : 'Default Object';
  }
  syncSpritePanel();
  renderObjectList();
  d();
}

export function commitActiveObjectName(value) {
  const object = getActiveObject();
  if (!object) return;
  const input = document.getElementById('obj-name-input');
  const name = String(value).trim();
  if (!name) {
    object.name = 'Object ' + object.id;
    input.value = object.name;
  } else if (!isNameUnique(name, object.id)) {
    alert('Nama objek sudah digunakan.');
    object.name = input.dataset.previousName || object.name;
    input.value = object.name;
  } else {
    object.name = name;
    input.value = name;
  }
  input.dataset.previousName = object.name;
  const badge = document.getElementById('obj-role-badge');
  if (badge) badge.textContent = object.name;
  renderObjectList();
  d();
}

export function setActiveObjectName(value) {
  setActiveObjectNameLive(value);
  commitActiveObjectName(value);
}

export function setActiveObjectRole(role) {
  const result = canAssignObjectRole(IPState.world.cubes, IPState.editor.activeObjectId, role);
  if (!result.allowed) {
    if (result.reason === 'player-exists') {
      alert('Sudah ada Player: "' + result.existingPlayer.name + '". Hanya boleh ada satu Player.');
    }
    return;
  }
  applyRoleDefaults(result.target, role);
  closeIdentityRoleDropdown();
  syncObjectPanel();
  renderObjectList();
  d();
}

export function toggleActiveObjectCollision() {
  const object = getActiveObject();
  if (!object) return;
  object.collision = object.collision === false;
  delete object.autoCollisionOff;
  syncObjectPanel();
  d();
}

export const objectIdentityActions = Object.freeze({
  setActiveObjectNameLive, commitActiveObjectName, setActiveObjectName,
  setActiveObjectRole, toggleActiveObjectCollision
});
