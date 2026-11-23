/*
 * IsoPlayground — project JSON parser and normalizer.
 *
 * Mengurai input JSON menjadi snapshot ter-normalisasi dan memvalidasi struktur
 * dasarnya. Parser tidak mengubah IPState; commit dilakukan projectRuntimeAdapter.
 */
import { IPConfig } from '../core/config.js';
import { clampSpriteFps, createEmptyStateFramesMap } from '../core/spriteData.js';
import { normalizeSpeed, setObjectRoleDefault } from '../world/roles.js';

import { normalizeEvenSize } from '../world/worldConfig.js';

export { normalizeEvenSize } from '../world/worldConfig.js';

export function parseProjectJSON(rawText, options = {}) {
  // Parser hanya menghasilkan deskriptor asset. Objek Image dibuat kemudian
  // oleh projectRuntimeAdapter agar parser tetap murni dan mudah dipindahkan.
  const resetDefaultRole = options.setObjectRoleDefault || setObjectRoleDefault;
  const data = JSON.parse(rawText);
  const restoreSandboxBehavior = options && options.sandboxSession === true;
  if (!data || !Array.isArray(data.cubes)) {
    throw new Error('Format JSON tidak valid.');
  }

  // TAHAP 1: parse dan normalisasi ke variabel lokal. Belum ada state global yang disentuh,
  // jadi error di tengah impor tidak meninggalkan state setengah berubah.
  const newWorldSize = normalizeEvenSize(data.worldSize);
  const newShowGrid = typeof data.showGrid === 'boolean' ? data.showGrid : true;
  const newShowAxis = typeof data.showAxis === 'boolean' ? data.showAxis : true;
  const newFollow = Boolean(data.followObjectEnabled);

  const newCubes = data.cubes.map((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Format JSON tidak valid: objek ke-' + (idx + 1) + ' rusak.');
    }
    const id = Number.isInteger(item.id) && item.id > 0 ? item.id : (idx + 1);
    const role = (item.role === 'Player' || item.role === 'NPC') ? item.role : 'default';
    const importedU = typeof item.u === 'number' && !isNaN(item.u) ? item.u : 0.5;
    const importedV = typeof item.v === 'number' && !isNaN(item.v) ? item.v : 0.5;
    const importedAttackArea = Math.max(1, Math.min(10, item.attackArea ?? 1.5));
    const importedHitArea = Math.max(0.25, Math.min(importedAttackArea, item.hitArea ?? 1.5));
    const roleDefaults = role === 'Player'
      ? { maxHp: 300, damage: 20, attackInterval: 0.5 }
      : { maxHp: 100, damage: 10, attackInterval: 1 };
    const importedMaxHp = Math.max(100, Math.min(10000, item.maxHp ?? roleDefaults.maxHp));
    return {
      id,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : ('object-' + id),
      role,
      // Speed, run speed, Enemy, dan Roaming ikut tersimpan. File lama tanpa field ini memakai default (2, 6, off, on).
      speed: normalizeSpeed(item.speed == null ? 2 : item.speed),
      runSpeed: normalizeSpeed(item.runSpeed == null ? 6 : item.runSpeed),
      collision: item.collision !== false,
      hitArea: role === 'default' ? undefined : importedHitArea,
      attackArea: role === 'default' ? undefined : importedAttackArea,
      detectionArea: role === 'default' ? undefined : Math.max(importedAttackArea, Math.min(10, item.detectionArea ?? 3)),
      maxHp: role === 'default' ? undefined : importedMaxHp,
      hp: role === 'default' ? undefined : Math.max(0, Math.min(importedMaxHp, item.hp ?? importedMaxHp)),
      damage: role === 'default' ? undefined : Math.max(10, Math.min(1000, item.damage ?? roleDefaults.damage)),
      attackInterval: role === 'default' ? undefined : Math.max(0.2, Math.min(1, item.attackInterval ?? roleDefaults.attackInterval)),
      // sandboxEnemy dipertahankan untuk snapshot sesi Sandbox lama.
      enemy: role === 'NPC' && (item.enemy === true || (restoreSandboxBehavior && item.sandboxEnemy === true)),
      roaming: role === 'NPC' ? item.roaming !== false : true,
      homeU: importedU, homeV: importedV,
      u: importedU, v: importedV,
      h: typeof item.h === 'number' && !isNaN(item.h) ? item.h : 0,
      ...(() => {
        const loadedStateFrames = createEmptyStateFramesMap();
        if (item.stateFrames && typeof item.stateFrames === 'object') {
          for (const st of IPConfig.SPRITE_ANIM_STATES) {
            const stObj = item.stateFrames[st];
            if (!stObj || typeof stObj !== 'object') continue;
            for (const dirKey of IPConfig.SPRITE_DIRECTIONS) {
              const arr = stObj[dirKey];
              if (Array.isArray(arr)) {
                loadedStateFrames[st][dirKey] = arr
                  .filter(entry => entry && typeof entry.src === 'string')
                  .map(entry => ({
                    src: entry.src,
                    name: typeof entry.name === 'string' ? entry.name : '',
                    width: Number.isFinite(Number(entry.width)) ? Math.max(0, Number(entry.width)) : 0,
                    height: Number.isFinite(Number(entry.height)) ? Math.max(0, Number(entry.height)) : 0
                  }));
              }
            }
          }
        }
        return { stateFrames: loadedStateFrames };
      })(),
      ...(() => {
        const fpsIn = {};
        if (item.stateFps && typeof item.stateFps === 'object') {
          for (const st of IPConfig.SPRITE_ANIM_STATES) {
            if (item.stateFps[st] != null && Number.isFinite(Number(item.stateFps[st]))) fpsIn[st] = clampSpriteFps(item.stateFps[st]);
          }
        }
        return { stateFps: fpsIn };
      })(),
      vx: 0, vz: 0,
      changeTimer: 0.7 + Math.random() * 1.6
    };
  });

  // ID dan nama harus unik: duplikat diberi ID baru / akhiran angka.
  const usedIds = new Set();
  let maxId = 0;
  for (const cb of newCubes) if (cb.id > maxId) maxId = cb.id;
  let nextFreeId = maxId + 1;
  for (const cb of newCubes) {
    if (usedIds.has(cb.id)) cb.id = nextFreeId++;
    usedIds.add(cb.id);
  }
  maxId = nextFreeId - 1;
  const usedNames = new Set();
  for (const cb of newCubes) {
    let candidate = cb.name, n = 2;
    while (usedNames.has(candidate.toLowerCase())) candidate = cb.name + ' ' + n++;
    cb.name = candidate;
    usedNames.add(candidate.toLowerCase());
  }
  for (const obj of newCubes) if (obj.role === 'default') resetDefaultRole(obj);

  const newNextId = Math.max(maxId + 1, Number.isInteger(data.nextObjectId) ? data.nextObjectId : (maxId + 1));
  const newActive = newCubes.some(cb => cb.id === data.activeObjectId)
    ? data.activeObjectId
    : (newCubes.length > 0 ? newCubes[0].id : null);
  let newCamera = null;
  if (data.camera && typeof data.camera === 'object') {
    const num = (val, fallback) => (typeof val === 'number' && !isNaN(val) ? val : fallback);
    newCamera = {
      z: typeof data.camera.z === 'number' && !isNaN(data.camera.z) ? Math.max(0.2, Math.min(10, data.camera.z)) : 1,
      panPx: num(data.camera.panPx, 0), panPy: num(data.camera.panPy, 0),
      worldOffsetU: num(data.camera.worldOffsetU, 0), worldOffsetV: num(data.camera.worldOffsetV, 0)
    };
  }

  // Return a complete normalized snapshot. The caller decides when to commit it.
  return {
    worldSize: newWorldSize,
    showGrid: newShowGrid,
    showAxis: newShowAxis,
    followObjectEnabled: newFollow,
    cubes: newCubes,
    nextObjectId: newNextId,
    activeObjectId: newActive,
    camera: newCamera
  };
}
