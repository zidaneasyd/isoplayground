/*
 * IsoPlayground sprite data and runtime animation.
 *
 * Modul ini mengelola frame, state/direction, FPS, cache per frame, dan
 * pemilihan animasi runtime. Upload file dan preview DOM tetap milik inspector.
 */
import {
  SPRITE_ANIM_STATES, SPRITE_DIRECTIONS, SPRITE_DIRECTION_SET
} from '../core/config.js';
import { IPState } from '../core/state.js';
import { clampSpriteFps, createEmptyStateFramesMap } from '../core/spriteData.js';

export { clampSpriteFps, createEmptyStateFramesMap } from '../core/spriteData.js';

export function getObjectStateFps(object, state) {
  return object && object.stateFps && object.stateFps[state] != null
    ? clampSpriteFps(object.stateFps[state])
    : SPRITE_FPS_DEFAULT;
}

export function ensureObjectStateFrames(object) {
  if (!object) return createEmptyStateFramesMap();
  if (!object.stateFrames || typeof object.stateFrames !== 'object') {
    object.stateFrames = createEmptyStateFramesMap();
  }
  for (const state of SPRITE_ANIM_STATES) {
    if (!object.stateFrames[state] || typeof object.stateFrames[state] !== 'object') {
      object.stateFrames[state] = {};
    }
    for (const direction of SPRITE_DIRECTIONS) {
      if (!Array.isArray(object.stateFrames[state][direction])) {
        object.stateFrames[state][direction] = [];
      }
    }
  }
  return object.stateFrames;
}

export function getFramesForStateDir(object, stateName, directionKey) {
  if (!object) return [];
  const stateFrames = ensureObjectStateFrames(object);
  const state = SPRITE_ANIM_STATES.includes(stateName) ? stateName : 'Idle';
  const direction = SPRITE_DIRECTION_SET.has(directionKey) ? directionKey : 'front';
  return stateFrames[state][direction] || [];
}

export function getActiveDirectionForObject(object) {
  if (!object) return 'front';
  return object.activeSpriteDir && SPRITE_DIRECTION_SET.has(object.activeSpriteDir)
    ? object.activeSpriteDir
    : 'front';
}

export function getRuntimeAnimationStateForObject(object, now = performance.now()) {
  if (!object) return 'Idle';
  if (now < (object.attackAnimUntil || 0)) return 'Attack';
  if (object.isMovingNow || now < (object.runHoldUntil || 0)) return 'Run';
  return 'Idle';
}

// Cache direset sekali per frame agar semua pemanggil memperoleh record yang sama.
export function beginSpriteFrame() {
  IPState.sprites.cache.clear();
  IPState.sprites.clock = performance.now();
}

export function resolveSpriteForObject(object, now) {
  const state = getRuntimeAnimationStateForObject(object, now);
  const direction = getActiveDirectionForObject(object);
  const frames = getFramesForStateDir(object, state, direction);
  if (!frames.length) return null;
  if (frames.length === 1) return frames[0];
  const elapsedSeconds = Math.max(0, (now - (object.animStateStartTime || 0)) / 1000);
  const index = Math.floor(elapsedSeconds * getObjectStateFps(object, state)) % frames.length;
  return frames[index] || frames[0];
}

export function getSpriteForObject(object, now) {
  if (!object) return null;
  if (now !== undefined) return resolveSpriteForObject(object, now);
  const cache = IPState.sprites.cache;
  const cached = cache.get(object.id);
  if (cached && cached.object === object) return cached.record;
  const record = resolveSpriteForObject(object, IPState.sprites.clock);
  cache.set(object.id, { object, record });
  return record;
}

export function getPanelAnimationState(object) {
  return object && object.panelAnimState && SPRITE_ANIM_STATES.includes(object.panelAnimState)
    ? object.panelAnimState
    : 'Idle';
}

export function getPanelPreviewDirection(object) {
  return object && object.panelPreviewDir && SPRITE_DIRECTION_SET.has(object.panelPreviewDir)
    ? object.panelPreviewDir
    : 'front';
}

export function getPanelPreviewFrames(object) {
  if (!object) return [];
  return getFramesForStateDir(object, getPanelAnimationState(object), getPanelPreviewDirection(object));
}

export function getPanelPreviewSpriteForObject(object, now = performance.now()) {
  const frames = getPanelPreviewFrames(object);
  if (!frames.length) return null;
  if (!IPState.sprites.previewPlaying || frames.length === 1) return frames[0];
  const elapsedSeconds = Math.max(0, (now - IPState.sprites.previewStartTime) / 1000);
  const index = Math.floor(elapsedSeconds * getObjectStateFps(object, getPanelAnimationState(object))) % frames.length;
  return frames[index] || frames[0];
}

export function hasAnySpriteUploaded(object) {
  if (!object) return false;
  const stateFrames = ensureObjectStateFrames(object);
  for (const state of SPRITE_ANIM_STATES) {
    for (const direction of SPRITE_DIRECTIONS) {
      if (stateFrames[state][direction].length > 0) return true;
    }
  }
  return false;
}

export function compareFilenamesAscending(aName, bName) {
  return String(aName).localeCompare(String(bName), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

