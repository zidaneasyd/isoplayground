/*
 * IsoPlayground — pure sprite data helpers.
 *
 * Modul ini berisi aturan data animasi yang dipakai project I/O maupun runtime
 * sprite. Tidak ada akses Image, Canvas, DOM, atau state browser di sini.
 */
import {
  SPRITE_ANIM_STATES,
  SPRITE_DIRECTIONS,
  SPRITE_FPS_DEFAULT,
  SPRITE_FPS_MIN,
  SPRITE_FPS_MAX
} from './config.js';

export function clampSpriteFps(value) {
  const fps = Math.round(Number(value));
  return Number.isFinite(fps)
    ? Math.max(SPRITE_FPS_MIN, Math.min(SPRITE_FPS_MAX, fps))
    : SPRITE_FPS_DEFAULT;
}

export function createEmptyStateFramesMap() {
  const result = {};
  for (const state of SPRITE_ANIM_STATES) {
    result[state] = {};
    for (const direction of SPRITE_DIRECTIONS) result[state][direction] = [];
  }
  return result;
}
