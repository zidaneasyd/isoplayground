import { IPConfig } from './config.js';
import { IPState } from './state.js';

/*
 * IsoPlayground — coordinate transforms.
 *
 * Mengubah posisi world (u, v, h) ke koordinat layar dan pointer layar ke sel
 * grid datar. Elevasi petak bukan bagian dari sistem koordinat dasar; tinggi
 * vertikal hanya berasal dari properti h milik objek.
 */
export function getProjectionHelpers() {
  const sz = IPConfig.s * IPState.camera.zoom;
  const originX = IPState.camera.viewWidth / 2 + IPState.camera.panPx
    - (IPState.world.offsetU - IPState.world.offsetV) * sz * IPConfig.cos;
  const originY = IPState.camera.viewHeight / 2 + IPState.camera.panPy
    - (IPState.world.offsetU + IPState.world.offsetV) * sz * IPConfig.sin;

  const p3d = (u, v, h = 0) => ({
    x: originX + (u - v) * sz * IPConfig.cos,
    y: originY + (u + v) * sz * IPConfig.sin - h * sz
  });
  return { cx: originX, cy: originY, sz, p3d };
}

export function screenToGridCell(clientX, clientY) {
  const half = IPState.world.size / 2;
  const minCell = -half;
  const maxCell = half - 1;
  const { cx, cy, sz } = getProjectionHelpers();
  const dx = clientX - cx;
  const dy = clientY - cy;
  const diffUV = dx / (sz * IPConfig.cos);
  const sumUV = dy / (sz * IPConfig.sin);
  const exactU = (sumUV + diffUV) / 2;
  const exactV = (sumUV - diffUV) / 2;
  const idxU = Math.floor(exactU + half);
  const idxV = Math.floor(exactV + half);

  if (idxU >= 0 && idxU < IPState.world.size && idxV >= 0 && idxV < IPState.world.size) {
    const cellU = -half + idxU;
    const cellV = -half + idxV;
    if (cellU >= minCell && cellU <= maxCell && cellV >= minCell && cellV <= maxCell) {
      return { cellU, cellV, centerU: cellU + 0.5, centerV: cellV + 0.5 };
    }
  }
  return null;
}
