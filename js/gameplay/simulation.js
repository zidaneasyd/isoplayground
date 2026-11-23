/*
 * IsoPlayground — frame simulation orchestrator.
 *
 * Menjalankan fase gameplay dengan urutan tetap: Player/knockback, NPC/combat,
 * animasi, dan pemeriksaan perubahan visual. Penjadwalan browser dilakukan main.js.
 */
import { IPState } from '../core/state.js';
import { updateAccidentalOverlapCollision } from '../world/collision.js';
import { updatePlayerAndKnockback } from './playerSimulation.js';
import { updateNpcSimulation } from './npcSimulation.js';
import { updateAnimationSimulation } from './animationSimulation.js';
import { trackFramePerformance, sandboxStateChanged } from './runtimeMonitor.js';

// Host memasang efek samping rendering/kamera/UI. Orkestrator gameplay hanya
// menentukan kapan efek itu perlu dipanggil, bukan mengimpor modul tampilannya.
let syncActiveCoordinate = () => {};
let requestRender = () => {};
let computeVisualSignature = () => IPState.runtime.lastDrawnVisualSig;
let applyFollowCamera = () => {};

export function setSimulationCallbacks(callbacks = {}) {
  syncActiveCoordinate = typeof callbacks.syncActiveCoordinate === 'function'
    ? callbacks.syncActiveCoordinate
    : () => {};
  requestRender = typeof callbacks.render === 'function' ? callbacks.render : () => {};
  computeVisualSignature = typeof callbacks.computeVisualSignature === 'function'
    ? callbacks.computeVisualSignature
    : () => IPState.runtime.lastDrawnVisualSig;
  applyFollowCamera = typeof callbacks.applyFollowCamera === 'function'
    ? callbacks.applyFollowCamera
    : () => {};
}

export function stepSimulation(now) {
  const rawFrameMs = now - IPState.simulation.lastFrameTime;
  const dt = Math.min(0.05, Math.max(0, rawFrameMs / 1000));
  IPState.simulation.lastFrameTime = now;
  IPState.simulation.npcPlansThisFrame = 0;
  updateAccidentalOverlapCollision();
  trackFramePerformance(rawFrameMs);

  const playerPhase = updatePlayerAndKnockback(dt);
  const npcMoved = updateNpcSimulation(dt, playerPhase.lockedIds);
  const anyAnimFramePlaying = updateAnimationSimulation(now);

  const combatVisualActive = IPState.world.cubes.some(object =>
    (object.damagePopups && object.damagePopups.length) ||
    now < (object.flashUntil || 0) || object.knockback ||
    now < (object.attackAnimUntil || 0)
  );
  const spriteChanged = computeVisualSignature() !== IPState.runtime.lastDrawnVisualSig;
  if (playerPhase.moved || npcMoved || anyAnimFramePlaying || combatVisualActive || spriteChanged || sandboxStateChanged()) {
    syncActiveCoordinate();
    if (IPState.camera.followObjectEnabled) applyFollowCamera();
    requestRender();
  }

}
