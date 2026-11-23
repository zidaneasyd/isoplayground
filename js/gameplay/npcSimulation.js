/*
 * IsoPlayground — NPC and combat simulation phase.
 *
 * Mengurus cooldown, perilaku roaming/chase, fase serangan, dan gerak waypoint
 * NPC. Modul menerima dt serta objek yang terkunci knockback dari Player phase.
 */
import { IPState, isSandboxMode } from '../core/state.js';
import { tryMoveCubeTo } from '../world/collision.js';
import { normalizeSpeed, npcDefaults, initNpcMotion } from '../world/roles.js';
import { ensureCombatDefaults, dealDamage } from './combat.js';
import { getDirectionKeyFromVector } from '../core/directions.js';
import { nearestEightWayVector, moveNpcAlongPath } from './npc.js';

export function updateNpcSimulation(dt, knockbackLockedIds) {
  const half = IPState.world.size / 2;
  const minPosition = -half + 0.5;
  const maxPosition = half - 0.5;
  let anyMoved = false;

  // Semua Player/NPC mendapat pengurangan cooldown satu kali setiap frame.
  for (const object of IPState.world.cubes) {
    if (object.role !== 'Player' && object.role !== 'NPC') continue;
    ensureCombatDefaults(object);
    object.attackCooldown = Math.max(0, object.attackCooldown - dt);
  }

  for (const npc of IPState.world.cubes) {
    if (npc.role !== 'NPC') continue;

    npcDefaults(npc);
    ensureCombatDefaults(npc);
    const sandboxCombat = isSandboxMode();

    if (sandboxCombat && npc.hp <= 0) {
      npc.vx = 0;
      npc.vz = 0;
      npc.runHoldUntil = 0;
      continue;
    }
    if (knockbackLockedIds.has(npc.id)) {
      npc.attackStopTime = 0;
      npc.vx = 0;
      npc.vz = 0;
      npc.runHoldUntil = 0;
      continue;
    }

    const npcSpeed = normalizeSpeed(npc.speed);
    const player = IPState.world.cubes.find(object => object.role === 'Player');
    const distanceToPlayer = player
      ? Math.hypot(player.u - npc.u, player.v - npc.v)
      : Infinity;

    // Deteksi berbasis overlap area, bukan jarak titik pusat saja.
    const playerHitRadius = player ? Math.max(0.25, Number(player.hitArea) || 1.5) : 0;
    const npcDetectRadius = Math.max(npc.attackArea || 1, Number(npc.detectionArea) || 3);
    const canChase = Boolean(
      npc.enemy && player && (!sandboxCombat || player.hp > 0) &&
      distanceToPlayer <= npcDetectRadius + playerHitRadius
    );
    const attackRange = npc.attackArea + playerHitRadius;

    if (npc.enemy && player && (!sandboxCombat || player.hp > 0) && distanceToPlayer <= attackRange) {
      // NPC menghentikan pergerakan sebelum menjalankan animasi/damage serangan.
      npc.vx = 0;
      npc.vz = 0;
      npc.pathWaypoints = [];
      npc.pathRetryTimer = 0;
      npc.attackStopTime = (npc.attackStopTime || 0) + dt;

      if (npc.attackStopTime >= 0.08 && npc.attackCooldown <= 0) {
        const attackDirection = getDirectionKeyFromVector(player.u - npc.u, player.v - npc.v);
        if (attackDirection) npc.activeSpriteDir = attackDirection;
        npc.attackAnimUntil = performance.now() + Math.max(250, Math.round((npc.attackInterval || 0.4) * 500));
        dealDamage(player, npc.damage, npc);
      }
      continue;
    }

    npc.attackStopTime = 0;
    if (!npc.roaming && !canChase) {
      npc.vx = 0;
      npc.vz = 0;
      npc.pathWaypoints = [];
      continue;
    }

    if (canChase) {
      npc.changeTimer = 1;
      const previousU = npc.u;
      const previousV = npc.v;
      if (moveNpcAlongPath(npc, player, npcSpeed, attackRange, dt)) {
        anyMoved = true;
        npc.isMovingNow = true;
        const movedDirection = Math.hypot(npc.u - previousU, npc.v - previousV) > 0.004
          ? getDirectionKeyFromVector(npc.u - previousU, npc.v - previousV, npc.activeSpriteDir)
          : null;
        if (movedDirection) npc.activeSpriteDir = movedDirection;
      }
    } else {
      npc.pathWaypoints = [];
      npc.pathRetryTimer = 0;
      delete npc.pathPlayerCellX;
      delete npc.pathPlayerCellY;

      // Roaming dibatasi radius dari titik awal; enemy mengejar saat Player terdeteksi.
      const homeDistance = Math.hypot(npc.homeU - npc.u, npc.homeV - npc.v);
      if (npc.roaming) {
        if (homeDistance > 2.8) {
          const [du, dv] = nearestEightWayVector(npc.homeU - npc.u, npc.homeV - npc.v);
          npc.vx = du * npcSpeed;
          npc.vz = dv * npcSpeed;
          npc.changeTimer = 1;
        } else {
          if (typeof npc.vx !== 'number' || typeof npc.vz !== 'number' || (npc.vx === 0 && npc.vz === 0)) {
            initNpcMotion(npc);
          }
          npc.changeTimer = (npc.changeTimer || 0) - dt;
          if (npc.changeTimer <= 0) initNpcMotion(npc);
        }
      } else {
        npc.vx = 0;
        npc.vz = 0;
        continue;
      }
    }

    if (canChase) continue; // Path follower sudah menangani perpindahan pengejaran.

    let nextU = npc.u + npc.vx * dt;
    let nextV = npc.v + npc.vz * dt;
    if (nextU < minPosition) {
      nextU = minPosition;
      npc.vx = Math.abs(npc.vx);
    } else if (nextU > maxPosition) {
      nextU = maxPosition;
      npc.vx = -Math.abs(npc.vx);
    }
    if (nextV < minPosition) {
      nextV = minPosition;
      npc.vz = Math.abs(npc.vz);
    } else if (nextV > maxPosition) {
      nextV = maxPosition;
      npc.vz = -Math.abs(npc.vz);
    }

    const previousU = npc.u;
    const previousV = npc.v;
    const result = tryMoveCubeTo(npc, nextU, nextV);
    if (result.hitU) npc.vx = -npc.vx;
    if (result.hitV) npc.vz = -npc.vz;
    if (result.moved) {
      anyMoved = true;
      npc.isMovingNow = true;
      const movedDirection = Math.hypot(npc.u - previousU, npc.v - previousV) > 0.004
        ? getDirectionKeyFromVector(npc.u - previousU, npc.v - previousV, npc.activeSpriteDir)
        : null;
      if (movedDirection) npc.activeSpriteDir = movedDirection;
    }
  }

  return anyMoved;
}
