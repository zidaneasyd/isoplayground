/*
 * IsoPlayground — NPC grid pathfinding.
 *
 * Modul ini bertanggung jawab atas pemetaan indeks/koordinat grid dan pencarian
 * jalur A* menuju posisi yang cukup dekat dengan Player. Gerak fisik NPC berada
 * di npcMovement.js, sedangkan aturan tabrakan tetap berada di world/collision.js.
 */
import { IPConfig } from '../core/config.js';
import { IPState } from '../core/state.js';
import { isPointClearOfOtherCubes, isPathClearOfOtherCubes } from '../world/collision.js';

const GRID_NEIGHBORS = Object.freeze([
  [1, 0], [0, 1], [-1, 0], [0, -1],
  [1, 1], [-1, 1], [-1, -1], [1, -1]
]);

/** Convert a zero-based grid index to the center coordinate of that cell. */
export function npcGridCoord(index) {
  return -IPState.world.size / 2 + 0.5 + index;
}

/** Convert a world coordinate to the nearest valid grid index. */
export function npcGridIndex(value) {
  const firstCellCenter = -IPState.world.size / 2 + 0.5;
  return Math.max(0, Math.min(IPState.world.size - 1, Math.round(value - firstCellCenter)));
}

// Binary min-heap used by A*: lowest estimated total path cost is popped first.
function createOpenSet() {
  const heap = [];

  function comesAfter(a, b) {
    return a.f > b.f || (a.f === b.f && a.order > b.order);
  }

  return {
    get size() {
      return heap.length;
    },
    push(entry) {
      heap.push(entry);
      let index = heap.length - 1;
      while (index > 0) {
        const parentIndex = (index - 1) >> 1;
        const parent = heap[parentIndex];
        if (!comesAfter(parent, entry)) break;
        heap[index] = parent;
        index = parentIndex;
      }
      heap[index] = entry;
    },
    pop() {
      if (!heap.length) return null;
      const root = heap[0];
      const last = heap.pop();
      if (heap.length) {
        let index = 0;
        while (true) {
          const leftIndex = index * 2 + 1;
          const rightIndex = leftIndex + 1;
          if (leftIndex >= heap.length) break;

          let childIndex = leftIndex;
          if (rightIndex < heap.length && comesAfter(heap[leftIndex], heap[rightIndex])) {
            childIndex = rightIndex;
          }
          if (!comesAfter(last, heap[childIndex])) break;
          heap[index] = heap[childIndex];
          index = childIndex;
        }
        heap[index] = last;
      }
      return root;
    }
  };
}

/**
 * Find a grid route from an NPC to a cell near the Player using A*.
 * The path budget protects a frame from spending too long on a difficult map.
 */
export function npcFindPath(npc, player, attackRange) {
  const planStart = performance.now();
  let expandedNodes = 0;
  const size = IPState.world.size;
  const totalCells = size * size;
  const startX = npcGridIndex(npc.u);
  const startY = npcGridIndex(npc.v);
  const startId = startY * size + startX;

  // Cache occupancy during this one path plan; the world may change next frame.
  const passableCache = new Int8Array(totalCells);
  passableCache.fill(-1);
  const isPassable = (gridX, gridY) => {
    if (gridX < 0 || gridY < 0 || gridX >= size || gridY >= size) return false;
    const cellId = gridY * size + gridX;
    if (passableCache[cellId] === 0) return false;
    if (passableCache[cellId] === 1) return true;

    const clear = isPointClearOfOtherCubes(
      npcGridCoord(gridX), npcGridCoord(gridY), npc.h, npc.id
    );
    passableCache[cellId] = clear ? 1 : 0;
    return clear;
  };

  if (!isPassable(startX, startY)) return null;

  const gScore = new Float64Array(totalCells);
  gScore.fill(Infinity);
  gScore[startId] = 0;
  const cameFrom = new Int32Array(totalCells);
  cameFrom.fill(-1);
  const closed = new Uint8Array(totalCells);
  const openSet = createOpenSet();
  let insertionOrder = 0;

  const heuristic = (gridX, gridY) => Math.max(
    0,
    Math.hypot(npcGridCoord(gridX) - player.u, npcGridCoord(gridY) - player.v) - attackRange
  );

  openSet.push({ id: startId, f: heuristic(startX, startY), order: insertionOrder++ });
  let goalId = -1;

  while (openSet.size) {
    const current = openSet.pop();
    const currentId = current.id;
    if (closed[currentId]) continue;
    closed[currentId] = 1;

    expandedNodes++;
    if ((expandedNodes & 63) === 0 && performance.now() - planStart > IPConfig.NPC_PATH_BUDGET_MS) {
      return null;
    }

    const currentX = currentId % size;
    const currentY = Math.floor(currentId / size);
    const currentU = npcGridCoord(currentX);
    const currentV = npcGridCoord(currentY);
    const distanceToPlayer = Math.hypot(currentU - player.u, currentV - player.v);

    // A* ends once a non-start cell is close enough to attack from.
    if (currentId !== startId && distanceToPlayer <= attackRange + 0.5) {
      goalId = currentId;
      break;
    }

    for (const [deltaX, deltaY] of GRID_NEIGHBORS) {
      const nextX = currentX + deltaX;
      const nextY = currentY + deltaY;
      if (!isPassable(nextX, nextY)) continue;

      // A diagonal move is blocked when either orthogonal neighbor is blocked.
      if (deltaX !== 0 && deltaY !== 0) {
        if (!isPassable(currentX + deltaX, currentY) || !isPassable(currentX, currentY + deltaY)) {
          continue;
        }
      }

      const nextU = npcGridCoord(nextX);
      const nextV = npcGridCoord(nextY);
      if (!isPathClearOfOtherCubes(currentU, currentV, nextU, nextV, npc.h, npc.id)) continue;

      const nextId = nextY * size + nextX;
      if (closed[nextId]) continue;
      const moveCost = deltaX !== 0 && deltaY !== 0 ? Math.SQRT2 : 1;
      const tentativeScore = gScore[currentId] + moveCost;

      if (tentativeScore + 1e-8 < gScore[nextId]) {
        gScore[nextId] = tentativeScore;
        cameFrom[nextId] = currentId;
        openSet.push({
          id: nextId,
          f: tentativeScore + heuristic(nextX, nextY),
          order: insertionOrder++
        });
      }
    }
  }

  if (goalId < 0) return null;

  const pathIds = [];
  for (let currentId = goalId; currentId !== -1; currentId = cameFrom[currentId]) {
    pathIds.push(currentId);
    if (currentId === startId) break;
  }
  pathIds.reverse();

  const points = pathIds.map(cellId => ({
    u: npcGridCoord(cellId % size),
    v: npcGridCoord(Math.floor(cellId / size))
  }));
  if (points.length && Math.hypot(points[0].u - npc.u, points[0].v - npc.v) < 0.02) {
    points.shift();
  }
  return points;
}

