import { IPState } from '../core/state.js';

/*
 * IsoPlayground — world bounds and collision (Stage 6)
 *
 * Responsibility: spatial boundaries, occupancy checks, collision-aware
 * movement, and keeping objects inside the playable world.
 * Modul ES ini menjadi pemilik aturan ruang dan pergerakan tabrakan.
 * Semua pemanggil menggunakan API ES Module melalui import eksplisit.
 */

export function getCellBounds() {
  const half = IPState.world.size / 2;
  const minCell = -half;
  const maxCell = half - 1;
  return { minCell, maxCell };
}

export function getCubeHalfExtent(cb) {
  return 0.5;
}

export function isPointClearOfOtherCubes(u, v, h, selfId) {
  const halfExtent = 0.5;
  const minSep = halfExtent * 2 - 1e-4;
  // Collision is mutual only when BOTH objects have collision enabled.
  // A disabled object is non-solid to every other object as well.
  // Pencarian `self` dilakukan SEKALI di luar loop (sebelumnya O(n^2)).
  const self = IPState.world.cubes.find(o => o.id === selfId);
  if (self && self.collision === false) return true;
  for (const other of IPState.world.cubes) {
    if (other.id === selfId) continue;
    if (other.collision === false) continue;
    if (other.h !== h) continue;
    if (Math.abs(u - other.u) < minSep && Math.abs(v - other.v) < minSep) {
      return false;
    }
  }
  return true;
}

export function isPathClearOfOtherCubes(u0, v0, u1, v1, h, selfId) {
  const minSep = 1 - 1e-4;
  const self = IPState.world.cubes.find(o => o.id === selfId);
  if (self && self.collision === false) return true;
  // Saring dulu objek yang mungkin tersentuh jalur ini (satu kali lewat daftar),
  // lalu cek tiap langkah hanya terhadap kandidat dekat. Hasilnya identik dengan cek penuh.
  const loU = Math.min(u0, u1) - minSep, hiU = Math.max(u0, u1) + minSep;
  const loV = Math.min(v0, v1) - minSep, hiV = Math.max(v0, v1) + minSep;
  let near = null;
  for (const o of IPState.world.cubes) {
    if (o.id === selfId || o.collision === false || o.h !== h) continue;
    if (o.u > loU && o.u < hiU && o.v > loV && o.v < hiV) (near || (near = [])).push(o);
  }
  if (!near) return true;
  const dist = Math.hypot(u1 - u0, v1 - v0);
  const steps = Math.max(1, Math.ceil(dist / 0.15));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const su = u0 + (u1 - u0) * t;
    const sv = v0 + (v1 - v0) * t;
    for (const o of near) {
      if (Math.abs(su - o.u) < minSep && Math.abs(sv - o.v) < minSep) return false;
    }
  }
  return true;
}

export function tryMoveCubeTo(cb, targetU, targetV) {
  const half = IPState.world.size / 2;
  const minPos = -half + 0.5;
  const maxPos = half - 0.5;

  const clampedU = Math.max(minPos, Math.min(maxPos, targetU));
  const clampedV = Math.max(minPos, Math.min(maxPos, targetV));

  let moved = false;
  if (cb.collision === false) { moved = clampedU!==cb.u || clampedV!==cb.v; cb.u=clampedU; cb.v=clampedV; return {moved,hitU:false,hitV:false}; }

  if (isPathClearOfOtherCubes(cb.u, cb.v, clampedU, clampedV, cb.h, cb.id)) {
    moved = (clampedU !== cb.u || clampedV !== cb.v);
    cb.u = clampedU;
    cb.v = clampedV;
    return { moved, hitU: false, hitV: false };
  }

  let hitU = false;
  let hitV = false;

  if (isPathClearOfOtherCubes(cb.u, cb.v, clampedU, cb.v, cb.h, cb.id)) {
    if (clampedU !== cb.u) moved = true;
    cb.u = clampedU;
    hitV = true;
  } else {
    hitU = true;
  }

  if (isPathClearOfOtherCubes(cb.u, cb.v, cb.u, clampedV, cb.h, cb.id)) {
    if (clampedV !== cb.v) moved = true;
    cb.v = clampedV;
    hitU = true;
  } else {
    hitV = true;
  }

  return { moved, hitU, hitV };
}

export function clampObjectsToWorld() {
  const half = IPState.world.size / 2;
  const { minCell, maxCell } = getCellBounds();
  const clampCell = c => Math.max(minCell, Math.min(maxCell, c));
  const lim = (val) => Math.max(-half + 0.5, Math.min(half - 0.5, val));
  const placed = [];
  // 1) Player/NPC: posisi bebas, ikut dijepit ke dunia. Titik home NPC juga dijepit
  //    supaya NPC tidak terus mengejar titik di luar dunia dan terpental dinding.
  for (const cb of IPState.world.cubes) {
    if (cb.role !== 'Player' && cb.role !== 'NPC') continue;
    cb.u = lim(cb.u);
    cb.v = lim(cb.v);
    if (typeof cb.homeU === 'number') cb.homeU = lim(cb.homeU);
    if (typeof cb.homeV === 'number') cb.homeV = lim(cb.homeV);
    placed.push(cb);
  }
  // 2) Objek default menempel ke sel. Yang sudah di dalam dunia tetap di selnya;
  //    yang keluar batas dipindah ke sel kosong terdekat, bukan ditumpuk.
  const moved = [];
  for (const cb of IPState.world.cubes) {
    if (cb.role === 'Player' || cb.role === 'NPC') continue;
    const origU = Math.floor(cb.u), origV = Math.floor(cb.v);
    const cellU = clampCell(origU), cellV = clampCell(origV);
    cb.u = cellU + 0.5;
    cb.v = cellV + 0.5;
    if (cellU !== origU || cellV !== origV) moved.push(cb); else placed.push(cb);
  }
  for (const cb of moved) {
    const spot = findNearestFreeCell(cb, placed);
    if (spot) { cb.u = spot.u; cb.v = spot.v; }
    placed.push(cb);
  }
}
// Sel kosong terdekat (cincin Chebyshev membesar) dari posisi cb saat ini; null jika dunia penuh.
export function findNearestFreeCell(cb, placed) {
  const { minCell, maxCell } = getCellBounds();
  const blocked = (u, v) => placed.some(o => o.h === cb.h && o.collision !== false &&
    Math.abs(u - o.u) < 1 - 1e-4 && Math.abs(v - o.v) < 1 - 1e-4);
  if (cb.collision === false || !blocked(cb.u, cb.v)) return { u: cb.u, v: cb.v };
  const tu = Math.floor(cb.u), tv = Math.floor(cb.v);
  for (let r = 1; r <= maxCell - minCell; r++) {
    let best = null, bestDist = Infinity;
    for (let cu = tu - r; cu <= tu + r; cu++) {
      for (let cv = tv - r; cv <= tv + r; cv++) {
        if (Math.max(Math.abs(cu - tu), Math.abs(cv - tv)) !== r) continue;
        if (cu < minCell || cu > maxCell || cv < minCell || cv > maxCell) continue;
        if (blocked(cu + 0.5, cv + 0.5)) continue;
        const dist = (cu - tu) * (cu - tu) + (cv - tv) * (cv - tv);
        if (dist < bestDist) { bestDist = dist; best = { u: cu + 0.5, v: cv + 0.5 }; }
      }
    }
    if (best) return best;
  }
  return null;
}


// Jika objek bertumpuk akibat dunia diperkecil, collision dimatikan sementara
// agar objek dapat bergerak keluar. Collision manual (tanpa flag auto) tidak diubah.
export function updateAccidentalOverlapCollision() {
  const sep = 1 - 1e-4;
  const managed = IPState.world.cubes.filter(o => o.collision !== false || o.autoCollisionOff);
  const hit = new Array(managed.length).fill(false);
  for (let i = 0; i < managed.length; i++) {
    for (let j = i + 1; j < managed.length; j++) {
      const a = managed[i], b = managed[j];
      if (a.h !== b.h) continue;
      if (Math.abs(a.u - b.u) < sep && Math.abs(a.v - b.v) < sep) { hit[i] = true; hit[j] = true; }
    }
  }
  managed.forEach((o, i) => {
    if (hit[i]) { o.collision = false; o.autoCollisionOff = true; }
    else if (o.autoCollisionOff) { o.collision = true; delete o.autoCollisionOff; }
  });
}

