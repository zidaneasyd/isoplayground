/*
 * IsoPlayground — object spatial/name queries.
 *
 * Menyediakan pencarian nama, posisi duplikat, keterisian sel, dan spawn cell.
 * Query membaca world state tetapi tidak mengubah objek yang ditemukan.
 */
import { IPState } from '../core/state.js';
import { getCellBounds } from './collision.js';
import { screenToGridCell } from '../core/coordinates.js';

export function isNameUnique(candidate, excludeId) {
  const trimmed = String(candidate ?? '').trim();
  if (!trimmed) return false;
  return !IPState.world.cubes.some(object =>
    object.id !== excludeId && object.name.toLowerCase() === trimmed.toLowerCase()
  );
}

/** Find the nearest cell suitable for a duplicate of the supplied object. */
export function findDuplicatePosition(source) {
  const half = IPState.world.size / 2;
  const minPosition = -half + 0.5;
  const maxPosition = half - 0.5;
  const offsets = [];

  // Susun sel dalam ring yang membesar dari posisi asal.
  for (let ring = 1; ring < IPState.world.size; ring++) {
    for (let du = -ring; du <= ring; du++) {
      offsets.push([du, -ring], [du, ring]);
    }
    for (let dv = -ring + 1; dv < ring; dv++) {
      offsets.push([-ring, dv], [ring, dv]);
    }
  }
  offsets.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));

  for (const [du, dv] of offsets) {
    const u = source.u + du;
    const v = source.v + dv;
    if (u < minPosition || u > maxPosition || v < minPosition || v > maxPosition) continue;

    const blocked = IPState.world.cubes.some(other => {
      if (other.id === source.id || other.h !== source.h) return false;
      if (source.collision === false || other.collision === false) return false;
      return Math.abs(u - other.u) < 0.9999 && Math.abs(v - other.v) < 0.9999;
    });
    if (!blocked) return { u, v };
  }
  return null;
}

/** Check whether any object's footprint overlaps the requested grid cell. */
export function isCellOccupiedOrPassedByAnyObject(cellU, cellV, h = 0) {
  const minU = cellU;
  const maxU = cellU + 1;
  const minV = cellV;
  const maxV = cellV + 1;
  const pad = 1e-4;

  for (const object of IPState.world.cubes) {
    if (object.h !== h) continue;
    const objectMinU = object.u - 0.5;
    const objectMaxU = object.u + 0.5;
    const objectMinV = object.v - 0.5;
    const objectMaxV = object.v + 0.5;
    const overlapsU = objectMaxU > minU + pad && objectMinU < maxU - pad;
    const overlapsV = objectMaxV > minV + pad && objectMinV < maxV - pad;
    if (overlapsU && overlapsV) return true;
  }
  return false;
}

/** Choose the unoccupied spawn cell closest to the viewport's projected center. */
export function findSpawnCell() {
  const { minCell, maxCell } = getCellBounds();
  const anchor = screenToGridCell(IPState.camera.viewWidth / 2, IPState.camera.viewHeight / 2);
  const anchorU = anchor ? anchor.cellU : Math.max(minCell, Math.min(maxCell, 0));
  const anchorV = anchor ? anchor.cellV : Math.max(minCell, Math.min(maxCell, 0));
  const candidates = [];

  for (let cellU = minCell; cellU <= maxCell; cellU++) {
    for (let cellV = minCell; cellV <= maxCell; cellV++) {
      candidates.push({
        cellU,
        cellV,
        distance: Math.hypot(cellU - anchorU, cellV - anchorV)
      });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);

  for (const cell of candidates) {
    if (!isCellOccupiedOrPassedByAnyObject(cell.cellU, cell.cellV, 0)) return cell;
  }
  return null;
}
