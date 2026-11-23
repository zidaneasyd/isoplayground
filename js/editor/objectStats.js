/*
 * IsoPlayground — selected object gameplay statistics.
 *
 * Mengatur speed/run speed, radius interaksi, HP, damage, dan interval serangan
 * melalui kontrol inspector. Nilai dinormalisasi memakai role service.
 */
import { IPState } from '../core/state.js';
import { normalizeSpeed } from '../world/roles.js';
import { syncObjectPanel } from './inspector.js';
import { d } from '../rendering/renderer.js';

function getActiveObject() {
  return IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId) || null;
}

export function setActiveObjectArea(which, value) {
  const object = getActiveObject();
  if (!object || object.role === 'default') return;
  const rounded = Math.round(Number(value) * 4) / 4;
  if (which === 'hitArea') {
    const area = Math.max(0.25, Math.min(10, rounded));
    object.hitArea = Math.min(area, object.attackArea);
  }
  if (which === 'attackArea') {
    const area = Math.max(1, Math.min(10, rounded));
    object.attackArea = area;
    object.hitArea = Math.min(Math.max(0.25, object.hitArea || 1.5), object.attackArea);
    object.detectionArea = Math.max(object.attackArea, object.detectionArea || 3);
  }
  if (which === 'detectionArea') {
    object.detectionArea = Math.max(object.attackArea, Math.min(10, rounded));
  }
  syncObjectPanel();
  d();
}

export function setActiveObjectSpeed(value) {
  const object = getActiveObject();
  if (!object || (object.role !== 'Player' && object.role !== 'NPC')) return;
  const speed = normalizeSpeed(value);
  object.speed = speed;
  if (object.role === 'NPC') {
    // Pertahankan arah gerak saat ini; NPC yang sedang diam tetap diam.
    const vx = object.vx || 0, vz = object.vz || 0;
    const length = Math.hypot(vx, vz);
    if (length > 1e-9) {
      object.vx = vx / length * speed;
      object.vz = vz / length * speed;
    }
  }
  syncObjectPanel();
}

export function setActiveObjectRunSpeed(value) {
  const object = getActiveObject();
  if (!object || object.role === 'default') return;
  object.runSpeed = normalizeSpeed(value);
  syncObjectPanel();
}

export function setActiveObjectStat(key, value) {
  const object = getActiveObject();
  if (!object || object.role === 'default') return;
  if (key === 'maxHp') {
    object.maxHp = Math.max(100, Math.min(10000, Math.round(Number(value) / 100) * 100));
    object.hp = object.maxHp;
  }
  if (key === 'damage') object.damage = Math.max(10, Math.min(1000, Math.round(Number(value) / 10) * 10));
  if (key === 'attackInterval') object.attackInterval = Math.max(0.2, Math.min(1, Math.round(Number(value) * 10) / 10));
  syncObjectPanel();
}

export function setActiveObjectAttackArea(value) {
  const object = getActiveObject();
  if (!object || object.role === 'default') return;
  object.attackArea = Math.max(1, Math.min(10, Number(value) || 1));
  object.hitArea = Math.min(Math.max(0.25, object.hitArea || 1.5), object.attackArea);
  object.detectionArea = Math.max(object.attackArea, object.detectionArea || 3);
  syncObjectPanel();
  d();
}

export const objectStatsActions = Object.freeze({
  setActiveObjectArea, setActiveObjectSpeed, setActiveObjectRunSpeed,
  setActiveObjectStat, setActiveObjectAttackArea
});
