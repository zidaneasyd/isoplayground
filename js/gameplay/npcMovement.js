/*
 * IsoPlayground — NPC movement controller.
 *
 * Menghitung arah gerak, titik berdiri untuk menyerang, dan menjalankan
 * waypoint yang disediakan pathfinder. Modul ini tidak memiliki implementasi
 * A* sendiri sehingga algoritma pencarian jalur dapat dirawat terpisah.
 */
import { IPConfig } from '../core/config.js';
import { IPState } from '../core/state.js';
import { isPathClearOfOtherCubes, tryMoveCubeTo } from '../world/collision.js';
import { npcFindPath, npcGridIndex } from './npcPathfinding.js';

/** Return the closest of the eight supported movement vectors. */
export function nearestEightWayVector(du, dv) {
  const length = Math.hypot(du, dv);
  if (length < 1e-8) return IPConfig.EIGHT_WAY_VECTORS[0];

  const directionU = du / length;
  const directionV = dv / length;
  let bestVector = IPConfig.EIGHT_WAY_VECTORS[0];
  let bestScore = -Infinity;

  for (const vector of IPConfig.EIGHT_WAY_VECTORS) {
    const magnitude = Math.hypot(vector[0], vector[1]);
    const score = directionU * vector[0] / magnitude + directionV * vector[1] / magnitude;
    if (score > bestScore) {
      bestScore = score;
      bestVector = vector;
    }
  }
  return bestVector;
}

/** Calculate a point on the Player's perimeter that leaves room for collision. */
export function npcAttackStandPoint(npc, player, attackRange) {
  const radius = Math.max(0.05, attackRange - 0.04);
  const relativeU = npc.u - player.u;
  const relativeV = npc.v - player.v;
  const distance = Math.hypot(relativeU, relativeV);
  const normalU = distance > 1e-6 ? relativeU / distance : 1;
  const normalV = distance > 1e-6 ? relativeV / distance : 0;
  let offsetU = normalU * radius;
  let offsetV = normalV * radius;

  const bothSolid = npc.collision !== false && player.collision !== false && npc.h === player.h;
  const boxExtent = 1.02;
  if (bothSolid && radius >= boxExtent && Math.max(Math.abs(offsetU), Math.abs(offsetV)) < boxExtent) {
    const maxOtherAxis = Math.sqrt(radius * radius - boxExtent * boxExtent);
    const clampOtherAxis = value => Math.max(-maxOtherAxis, Math.min(maxOtherAxis, value));
    const candidateU = {
      u: (relativeU >= 0 ? 1 : -1) * boxExtent,
      v: clampOtherAxis(relativeV)
    };
    const candidateV = {
      u: clampOtherAxis(relativeU),
      v: (relativeV >= 0 ? 1 : -1) * boxExtent
    };
    const candidate = Math.hypot(candidateU.u - relativeU, candidateU.v - relativeV) <=
      Math.hypot(candidateV.u - relativeU, candidateV.v - relativeV)
      ? candidateU
      : candidateV;
    offsetU = candidate.u;
    offsetV = candidate.v;
  }

  return { u: player.u + offsetU, v: player.v + offsetV };
}

/** Move an NPC toward its attack stand point, recalculating a path when required. */
export function moveNpcAlongPath(npc, player, speed, attackRange, dt) {
  const standPoint = npcAttackStandPoint(npc, player, attackRange);
  const relativeU = npc.u - player.u;
  const relativeV = npc.v - player.v;
  const playerDistance = Math.hypot(relativeU, relativeV);

  if (playerDistance > attackRange && playerDistance > 1e-6) {
    // Prefer direct chase when the straight segment is not blocked.
    if (isPathClearOfOtherCubes(npc.u, npc.v, standPoint.u, standPoint.v, npc.h, npc.id)) {
      npc.pathWaypoints = [];
      npc.pathRetryTimer = 0;
      delete npc.pathPlayerCellX;
      delete npc.pathPlayerCellY;

      const deltaU = standPoint.u - npc.u;
      const deltaV = standPoint.v - npc.v;
      const distance = Math.hypot(deltaU, deltaV);
      const step = Math.min(distance, speed * dt);
      if (distance > 1e-6) {
        const directionU = deltaU / distance;
        const directionV = deltaV / distance;
        const nextU = npc.u + directionU * step;
        const nextV = npc.v + directionV * step;
        npc.vx = directionU * speed;
        npc.vz = directionV * speed;
        if (tryMoveCubeTo(npc, nextU, nextV).moved) return true;
      }
      npc.vx = 0;
      npc.vz = 0;
      return false;
    }
  }

  const targetCellX = npcGridIndex(player.u);
  const targetCellY = npcGridIndex(player.v);
  const hasPath = Array.isArray(npc.pathWaypoints) && npc.pathWaypoints.length > 0;
  const targetShifted = npc.pathPlayerCellX == null || npc.pathPlayerCellY == null ||
    Math.abs(npc.pathPlayerCellX - targetCellX) + Math.abs(npc.pathPlayerCellY - targetCellY) >= 3;
  const endpoint = hasPath ? npc.pathWaypoints[npc.pathWaypoints.length - 1] : null;
  const endpointOutOfRange = Boolean(
    hasPath && endpoint && Math.hypot(endpoint.u - player.u, endpoint.v - player.v) > attackRange + 0.75
  );
  const targetChanged = targetShifted || endpointOutOfRange;

  npc.pathRetryTimer = Math.max(0, (npc.pathRetryTimer || 0) - dt);
  if (!Array.isArray(npc.pathWaypoints)) npc.pathWaypoints = [];
  const shouldPlan = targetChanged || (!npc.pathWaypoints.length && npc.pathRetryTimer <= 0);
  if (shouldPlan && IPState.simulation.npcPlansThisFrame < IPConfig.NPC_MAX_PLANS_PER_FRAME) {
    IPState.simulation.npcPlansThisFrame++;
    const foundPath = npcFindPath(npc, player, attackRange);
    npc.pathWaypoints = foundPath || [];
    npc.pathPlayerCellX = targetCellX;
    npc.pathPlayerCellY = targetCellY;

    if (foundPath) {
      npc.pathFailCount = 0;
      npc.pathRetryTimer = IPConfig.NPC_RETRY_BASE;
    } else {
      npc.pathFailCount = Math.min(8, (npc.pathFailCount || 0) + 1);
      npc.pathRetryTimer = Math.min(
        IPConfig.NPC_RETRY_MAX,
        IPConfig.NPC_RETRY_BASE * Math.pow(2, npc.pathFailCount)
      );
    }
  }

  // Snap tiny remaining errors to waypoint centers to prevent corner jitter.
  while (npc.pathWaypoints.length) {
    const waypoint = npc.pathWaypoints[0];
    if (Math.hypot(waypoint.u - npc.u, waypoint.v - npc.v) >= 0.02) break;
    npc.u = waypoint.u;
    npc.v = waypoint.v;
    npc.pathWaypoints.shift();
  }

  if (!npc.pathWaypoints.length) {
    const deltaU = standPoint.u - npc.u;
    const deltaV = standPoint.v - npc.v;
    const distance = Math.hypot(deltaU, deltaV);
    if (distance > 1e-6) {
      const step = Math.min(distance, speed * dt);
      const directionU = deltaU / distance;
      const directionV = deltaV / distance;
      const result = tryMoveCubeTo(
        npc,
        npc.u + directionU * step,
        npc.v + directionV * step
      );
      npc.vx = directionU * speed;
      npc.vz = directionV * speed;
      if (result.moved) return true;
    }
    npc.vx = 0;
    npc.vz = 0;
    return false;
  }

  const waypoint = npc.pathWaypoints[0];
  const deltaU = waypoint.u - npc.u;
  const deltaV = waypoint.v - npc.v;
  const distance = Math.hypot(deltaU, deltaV);
  const step = Math.min(distance, speed * dt);
  const directionU = deltaU / distance;
  const directionV = deltaV / distance;
  const nextU = npc.u + directionU * step;
  const nextV = npc.v + directionV * step;

  // Stop and replan if the route became blocked after it was generated.
  if (!isPathClearOfOtherCubes(npc.u, npc.v, nextU, nextV, npc.h, npc.id)) {
    npc.pathWaypoints = [];
    npc.pathRetryTimer = 0;
    npc.vx = 0;
    npc.vz = 0;
    return false;
  }

  npc.vx = directionU * speed;
  npc.vz = directionV * speed;
  const result = tryMoveCubeTo(npc, nextU, nextV);
  if (!result.moved) {
    npc.pathWaypoints = [];
    npc.pathRetryTimer = 0;
    npc.vx = 0;
    npc.vz = 0;
    return false;
  }

  if (Math.hypot(waypoint.u - npc.u, waypoint.v - npc.v) < 0.02) {
    npc.u = waypoint.u;
    npc.v = waypoint.v;
    npc.pathWaypoints.shift();
  }
  return true;
}
