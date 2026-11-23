/*
 * IsoPlayground — selected object inspector UI.
 *
 * Menampilkan dan menyinkronkan nama, role, collision, statistik Player/NPC,
 * koordinat, serta kontrol NPC. Preview sprite didelegasikan ke
 * spriteInspector.js dan nilai default NPC dimiliki roles.js.
 */
import { IPState } from '../core/state.js';
import { npcDefaults, normalizeSpeed } from '../world/roles.js';
import { syncSpritePanel } from './spriteInspector.js';
import { d } from '../rendering/renderer.js';

export function getRoleDisplay(role) {
  if (role === 'Player') return { label: 'Player', cls: 'role-player' };
  if (role === 'NPC') return { label: 'NPC', cls: 'role-npc' };
  return { label: 'object', cls: 'role-default' };
}

export function formatCoord(value) {
  return value.toFixed(1).replace(/\.0$/, '');
}

/** Synchronize the active object's world position in the footer. */
export function syncFooterActiveCoord() {
  const activeObject = IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId);
  const coordinateElement = document.getElementById('footer-active-coord');
  if (!activeObject) {
    coordinateElement.textContent = '';
    return;
  }
  coordinateElement.textContent = '| ' + activeObject.name + ': (' +
    formatCoord(activeObject.u) + ', ' + formatCoord(activeObject.v) + ')';
}

/** Toggle Enemy/Roaming on the currently selected NPC. */
export function toggleNpcSetting(setting) {
  const object = IPState.world.cubes.find(item => item.id === IPState.editor.activeObjectId);
  if (!object || object.role !== 'NPC' || !['enemy', 'roaming'].includes(setting)) return;
  npcDefaults(object);
  object[setting] = !object[setting];
  syncObjectPanel();
  d();
}

/** Update visibility and active state of the NPC-specific control group. */
export function syncNpcControls(object) {
  const panel = document.getElementById('npc-controls');
  panel.style.display = object && object.role === 'NPC' ? 'flex' : 'none';
  if (!object || object.role !== 'NPC') return;

  npcDefaults(object);
  for (const [key, id] of [['enemy', 'npc-enemy-toggle'], ['roaming', 'npc-roaming-toggle']]) {
    const element = document.getElementById(id);
    element.classList.toggle('active', !!object[key]);
    element.setAttribute('aria-pressed', String(!!object[key]));
  }
}

/**
 * Refreshes every field in the selected-object inspector. This function is a
 * presentation adapter: it normalizes legacy/default values, then reflects
 * the current model into the DOM controls without owning the model rules.
 */
export function syncObjectPanel() {
  const object = IPState.world.cubes.find(item => item.id === IPState.editor.activeObjectId);
  const nameInput = document.getElementById('obj-name-input');
  const roleButton = document.getElementById('obj-role-button');
  const roleText = document.getElementById('obj-role-text');
  const roleBadge = document.getElementById('obj-role-badge');
  const collisionToggle = document.getElementById('obj-collision-toggle');
  const speedSlider = document.getElementById('obj-speed-slider');
  const runSpeedSlider = document.getElementById('obj-run-speed-slider');
  const hitSlider = document.getElementById('obj-hit-slider');
  const attackSlider = document.getElementById('obj-attack-slider');
  const detectionSlider = document.getElementById('obj-detection-slider');
  const hpSlider = document.getElementById('obj-hp-slider');
  const damageSlider = document.getElementById('obj-damage-slider');
  const intervalSlider = document.getElementById('obj-interval-slider');

  if (!object) {
    syncSpritePanel();
    document.getElementById('attribute-section').style.display = '';
    document.getElementById('mechanic-section').style.display = '';
    syncNpcControls(null);
    nameInput.value = '';
    nameInput.disabled = true;
    roleButton.disabled = true;
    roleText.textContent = 'Default object';
    roleBadge.textContent = '';
    document.getElementById('obj-speed-val').textContent = '-';
    speedSlider.disabled = true;
    speedSlider.value = 2;
    runSpeedSlider.disabled = true;
    document.getElementById('obj-run-speed-val').textContent = '-';
    collisionToggle.disabled = true;
    collisionToggle.classList.remove('active');
    collisionToggle.setAttribute('aria-pressed', 'false');
    [hitSlider, attackSlider, detectionSlider, hpSlider, damageSlider, intervalSlider]
      .forEach(element => { element.disabled = true; });
    for (const id of [
      'obj-hit-val', 'obj-attack-val', 'obj-detection-val',
      'obj-hp-val', 'obj-damage-val', 'obj-interval-val'
    ]) document.getElementById(id).textContent = '-';
    return;
  }

  object.collision = object.collision !== false;
  nameInput.disabled = false;
  if (document.activeElement !== nameInput) nameInput.value = object.name;
  roleButton.disabled = false;
  roleText.textContent = object.role === 'Player' || object.role === 'NPC'
    ? object.role
    : 'Default object';
  roleBadge.textContent = object.name;
  roleBadge.title = object.role === 'Player' ? 'Player' : object.role === 'NPC' ? 'NPC' : 'Default Object';
  syncNpcControls(object);

  const hasRole = object.role === 'Player' || object.role === 'NPC';
  document.getElementById('attribute-section').style.display = hasRole ? '' : 'none';
  document.getElementById('mechanic-section').style.display = hasRole ? '' : 'none';
  collisionToggle.disabled = false;
  collisionToggle.classList.toggle('active', object.collision);
  collisionToggle.setAttribute('aria-pressed', String(object.collision));
  speedSlider.disabled = !hasRole;
  runSpeedSlider.disabled = !hasRole;

  if (!hasRole) {
    document.getElementById('obj-speed-val').textContent = '—';
    document.getElementById('obj-run-speed-val').textContent = '—';
    speedSlider.value = 2;
    runSpeedSlider.value = 6;
    [hitSlider, attackSlider, detectionSlider, hpSlider, damageSlider, intervalSlider]
      .forEach(element => {
        element.disabled = true;
        element.value = element.min;
      });
    for (const id of [
      'obj-hit-val', 'obj-attack-val', 'obj-detection-val',
      'obj-hp-val', 'obj-damage-val', 'obj-interval-val'
    ]) document.getElementById(id).textContent = '—';
    return;
  }

  object.speed = normalizeSpeed(object.speed);
  object.runSpeed = normalizeSpeed(object.runSpeed || 6);
  object.attackArea = Math.max(1, Math.min(10, Number(object.attackArea) || 1.5));
  object.hitArea = Math.min(object.attackArea, Math.max(0.25, Math.min(10, Number(object.hitArea) || 1.5)));
  object.detectionArea = Math.max(object.attackArea, Math.min(10, Number(object.detectionArea) || 3));

  speedSlider.value = object.speed;
  document.getElementById('obj-speed-val').textContent = object.speed + ' m/s';
  runSpeedSlider.value = object.runSpeed;
  document.getElementById('obj-run-speed-val').textContent = object.runSpeed + ' m/s';
  [hitSlider, attackSlider, detectionSlider, hpSlider, damageSlider, intervalSlider]
    .forEach(element => { element.disabled = false; });

  hitSlider.min = 0.25;
  attackSlider.min = 1;
  hpSlider.value = object.maxHp || 100;
  damageSlider.value = object.damage || 10;
  intervalSlider.value = object.attackInterval || 0.2;
  document.getElementById('obj-hp-val').textContent =
    (object.hp ?? object.maxHp ?? 100) + ' / ' + (object.maxHp || 100);
  document.getElementById('obj-damage-val').textContent = object.damage || 10;
  document.getElementById('obj-interval-val').textContent = (object.attackInterval || 0.2).toFixed(1) + ' s';
  hitSlider.max = object.attackArea;
  hitSlider.value = object.hitArea;
  attackSlider.value = object.attackArea;
  detectionSlider.min = object.attackArea;
  detectionSlider.value = object.detectionArea;
  document.getElementById('obj-hit-val').textContent = object.hitArea + ' m';
  document.getElementById('obj-attack-val').textContent = object.attackArea + ' m';
  document.getElementById('obj-detection-val').textContent = object.detectionArea + ' m';
  syncSpritePanel();
}

export const inspectorActions = Object.freeze({
  getRoleDisplay,
  formatCoord,
  syncFooterActiveCoord,
  toggleNpcSetting,
  syncNpcControls,
  syncObjectPanel
});
