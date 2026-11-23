/*
 * IsoPlayground — project payload serializer.
 *
 * Mengubah state proyek aktif menjadi struktur JSON yang stabil. Serializer
 * tidak membuka dialog file dan tidak mengubah state runtime.
 */
import { IPConfig } from '../core/config.js';
import { IPState } from '../core/state.js';
import { ensureObjectStateFrames } from '../rendering/sprites.js';
import { clampSpriteFps } from '../core/spriteData.js';
import { getRoleCombatDefaults, normalizeSpeed } from '../world/roles.js';

export function buildProjectPayload() {
  // Persist only stable object identity, coordinates, and attributes.
  // Mechanics and runtime state (including old key-based knockback data) are intentionally omitted.
  return {
    app: 'Iso Playground',
    version: 2,
    worldSize: IPState.world.size,
    showGrid: IPState.editor.showGrid,
    showAxis: IPState.editor.showAxis,
    followObjectEnabled: IPState.camera.followObjectEnabled,
    camera: {
      z: IPState.camera.zoom,
      panPx: IPState.camera.panPx,
      panPy: IPState.camera.panPy,
      worldOffsetU: IPState.world.offsetU,
      worldOffsetV: IPState.world.offsetV
    },
    activeObjectId: IPState.editor.activeObjectId,
    nextObjectId: IPState.world.nextObjectId,
    cubes: IPState.world.cubes.map(cb => {
      const defaults = getRoleCombatDefaults(cb.role);
      const maxHp = cb.maxHp ?? defaults.maxHp;
      const attackArea = Math.max(1, Math.min(10, cb.attackArea ?? 1.5));
      return {
        id: cb.id,
        name: cb.name,
        role: cb.role,
        collision: cb.collision !== false || !!cb.autoCollisionOff,
        u: cb.u,
        v: cb.v,
        h: cb.h,
        ...(() => {
          const sf = ensureObjectStateFrames(cb);
          const serializedStates = {};
          let hasAny = false;
          for (const st of IPConfig.SPRITE_ANIM_STATES) {
            serializedStates[st] = {};
            for (const dirKey of IPConfig.SPRITE_DIRECTIONS) {
              const arr = sf[st][dirKey] || [];
              if (arr.length) {
                hasAny = true;
                serializedStates[st][dirKey] = arr.map(rec => ({
                  src: rec.src,
                  name: rec.name || '',
                  width: rec.width,
                  height: rec.height
                }));
              }
            }
          }
          return hasAny ? { stateFrames: serializedStates } : {};
        })(),
        ...(() => {
          const fpsOut = {};
          for (const st of IPConfig.SPRITE_ANIM_STATES) {
            if (cb.stateFps && cb.stateFps[st] != null) fpsOut[st] = clampSpriteFps(cb.stateFps[st]);
          }
          return Object.keys(fpsOut).length ? { stateFps: fpsOut } : {};
        })(),
        ...(cb.role !== 'default' ? {
          speed: normalizeSpeed(cb.speed),
          runSpeed: normalizeSpeed(cb.runSpeed || 6),
          ...(cb.role === 'NPC' ? { enemy: !!cb.enemy, roaming: cb.roaming !== false } : {}),
          hitArea: Math.max(0.25, Math.min(attackArea, cb.hitArea ?? 1.5)),
          attackArea,
          detectionArea: Math.max(attackArea, Math.min(10, cb.detectionArea ?? 3)),
          maxHp: Math.max(100, Math.min(10000, maxHp)),
          hp: Math.max(0, Math.min(maxHp, cb.hp ?? maxHp)),
          damage: Math.max(10, Math.min(1000, cb.damage ?? defaults.damage)),
          attackInterval: Math.max(0.2, Math.min(1, cb.attackInterval ?? defaults.attackInterval))
        } : {})
      };
    })
  };
}

