/*
 * IsoPlayground — Player and knockback simulation phase.
 *
 * Menangani knockback, kontrol gerak Player, dan penguncian objek yang sedang
 * terkena knockback. Pengatur frame memanggil modul ini dan menerima ringkasan
 * perubahan posisi serta himpunan ID yang sementara tidak boleh bergerak.
 */
import { IPState, isSandboxMode } from '../core/state.js';
import { tryMoveCubeTo } from '../world/collision.js';
import { getRuntimeAnimationStateForObject } from '../rendering/sprites.js';
import { normalizeSpeed } from '../world/roles.js';
import { getPlayerEightWayVector, getInputDirectionKey, getDirectionKeyFromVector } from '../core/directions.js';

export function updatePlayerAndKnockback(dt) {
  // Simpan state animasi awal frame dan reset flag gerak sebelum setiap fase berjalan.
  for (const object of IPState.world.cubes) {
    object._prevAnimState = getRuntimeAnimationStateForObject(object);
    object.isMovingNow = false;
  }

  const knockbackLockedIds = new Set();
  let anyMoved = false;
  for (const target of IPState.world.cubes) {
    if (!target.knockback || target.role === 'default') continue;
    knockbackLockedIds.add(target.id);
    const kb = target.knockback;
    const moveTime = Math.min(dt, Math.max(0, kb.remaining));
    if (moveTime > 0) {
      const result = tryMoveCubeTo(target, target.u + kb.du * kb.speed * moveTime, target.v + kb.dv * kb.speed * moveTime);
      if (result.moved) anyMoved = true;
      if (!result.moved) kb.remaining = 0;
      else kb.remaining = Math.max(0, kb.remaining - moveTime);
    } else kb.remaining = 0;
    target.vx = 0; target.vz = 0;
    if (kb.remaining <= 1e-4) delete target.knockback;
  }

  const activeCube = IPState.world.cubes.find(cb => cb.id === IPState.editor.activeObjectId);
  if (activeCube && activeCube.role === 'Player') {
    activeCube.attackMoveStopTime = Math.max(0, (activeCube.attackMoveStopTime || 0) - dt);
  }
  if (activeCube && activeCube.role === 'Player' && (!isSandboxMode()||activeCube.hp!==0) && !knockbackLockedIds.has(activeCube.id) && (activeCube.attackMoveStopTime || 0) <= 0) {
    const { du, dv } = getPlayerEightWayVector();
    const inputDir = getInputDirectionKey();
    if (inputDir && activeCube.activeSpriteDir !== inputDir) {
      activeCube.activeSpriteDir = inputDir;
      anyMoved = true;
    }
    if (du !== 0 || dv !== 0) {
      activeCube.vx = du; activeCube.vz = dv;
      const playerSpeed = IPState.input.pressedKeys.shift ? normalizeSpeed(activeCube.runSpeed || 6) : normalizeSpeed(activeCube.speed);
      const previousU = activeCube.u;
      const previousV = activeCube.v;
      const res = tryMoveCubeTo(
        activeCube,
        previousU + du * playerSpeed * dt,
        previousV + dv * playerSpeed * dt
      );
      const movedDu = activeCube.u - previousU;
      const movedDv = activeCube.v - previousV;
      const movedLength = Math.hypot(movedDu, movedDv);
      if (res.moved) {
        anyMoved = true;
        activeCube.isMovingNow = true;
        const moveDir = getDirectionKeyFromVector(movedDu, movedDv);
        if (moveDir) activeCube.activeSpriteDir = moveDir;
        // Simpan arah perpindahan aktual pada sumbu koordinat dunia (u/v),
        // bukan identitas tombol keyboard yang ditekan.
        if (movedLength > 1e-6) {
          activeCube.lastWorldMove = {
            fromU: previousU, fromV: previousV,
            toU: activeCube.u, toV: activeCube.v
          };
        }
      }
    }
  }

  return { moved: anyMoved, lockedIds: knockbackLockedIds };
 }
