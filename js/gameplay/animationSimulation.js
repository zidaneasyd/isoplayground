/*
 * IsoPlayground — sprite animation phase.
 *
 * Memperbarui state animasi objek dan preview sprite inspector. Rendering frame
 * tetap dilakukan oleh renderer; modul ini hanya memutuskan apakah animasi
 * multi-frame sedang berjalan dan perlu mempertahankan loop visual.
 */
import { IPState } from '../core/state.js';
import { IPConfig } from '../core/config.js';
import {
  getRuntimeAnimationStateForObject, getFramesForStateDir, getActiveDirectionForObject
} from '../rendering/sprites.js';

// Preview inspector dipasang dari main.js; fase gameplay tidak mengimpor DOM editor.
let updateInspectorPreview = () => {};

export function setAnimationPreviewCallback(callback) {
  updateInspectorPreview = typeof callback === 'function' ? callback : () => {};
}

export function updateAnimationSimulation(now) {
  let anyAnimFramePlaying = false;
  for (const obj of IPState.world.cubes) {
    if (obj.role === 'NPC' && obj.isMovingNow) obj.runHoldUntil = now + IPConfig.NPC_RUN_HOLD_MS;
    const nextAnimState = getRuntimeAnimationStateForObject(obj, now);
    if (obj._prevAnimState !== nextAnimState) {
      obj.animStateStartTime = now;
    }
    const activeFrames = getFramesForStateDir(obj, nextAnimState, getActiveDirectionForObject(obj));
    if (activeFrames.length > 1) {
      anyAnimFramePlaying = true;
    }
  }

  updateInspectorPreview(now);
  return anyAnimFramePlaying;
 }
