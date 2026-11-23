import { IPConfig } from './config.js';
import { IPState } from './state.js';
import { getProjectionHelpers } from './coordinates.js';

let requestRender = () => {};
export function setCameraRenderCallback(callback) {
  requestRender = typeof callback === 'function' ? callback : () => {};
}

/*
 * IsoPlayground — camera controls
 *
 * Mengatur follow camera, titik anchor zoom, reset, zoom/pan, dan batas offset.
 * ES Module ini mengimpor konfigurasi, state, dan proyeksi secara eksplisit.
 * Sinkronisasi kontrol HTML berada di editorUI.js sebagai adapter DOM terpisah.
 */

export function applyFollowObjectCamera() {
  if (!IPState.camera.followObjectEnabled || IPState.editor.activeObjectId === null) return;
  const activeCube = IPState.world.cubes.find(cb => cb.id === IPState.editor.activeObjectId);
  if (!activeCube) return;

  const sz = IPConfig.s * IPState.camera.zoom;
  const targetScreenX = IPState.camera.viewWidth / 2 + IPState.camera.panPx + (activeCube.u - IPState.world.offsetU - (activeCube.v - IPState.world.offsetV)) * sz * IPConfig.cos;
  const targetScreenY = IPState.camera.viewHeight / 2 + IPState.camera.panPy + (activeCube.u - IPState.world.offsetU + (activeCube.v - IPState.world.offsetV)) * sz * IPConfig.sin - (activeCube.h ?? 0) * sz;

  IPState.camera.panPx += (IPState.camera.viewWidth / 2) - targetScreenX;
  IPState.camera.panPy += (IPState.camera.viewHeight / 2) - targetScreenY;
}


export function getSandboxZoomAnchorScreenPoint() {
  const { p3d } = getProjectionHelpers();
  if (IPState.camera.followObjectEnabled && IPState.editor.activeObjectId !== null) {
    const activeCube = IPState.world.cubes.find(cb => cb.id === IPState.editor.activeObjectId);
    if (activeCube) {
      return p3d(activeCube.u, activeCube.v, (activeCube.h ?? 0));
    }
  }
  return p3d(0, 0, 0);
}
export function getZoomAnchorScreenPoint(pointerEvent) {
  if (IPState.sandbox.active) {
    return getSandboxZoomAnchorScreenPoint();
  }
  if (pointerEvent && typeof pointerEvent.clientX === 'number' && typeof pointerEvent.clientY === 'number') {
    return { x: pointerEvent.clientX, y: pointerEvent.clientY };
  }
  return getSandboxZoomAnchorScreenPoint();
}
export function setCameraZoomFromSlider(val) {
  const pct = Math.max(20, Math.min(300, parseFloat(val) || 100));
  const targetZ = pct / 100;
  if (targetZ === IPState.camera.zoom) return;
  const anchor = getSandboxZoomAnchorScreenPoint();
  applyZoomAtScreenPoint(targetZ / IPState.camera.zoom, anchor.x, anchor.y);
}

export function resetCamera() {
  IPState.world.offsetU = 0;
  IPState.world.offsetV = 0;
  IPState.camera.zoom = 1;
  IPState.camera.panPx = 0;
  IPState.camera.panPy = 0;
  if (IPState.camera.followObjectEnabled && IPState.editor.activeObjectId !== null) {
    applyFollowObjectCamera();
  }
  requestRender();
}

export function zoomStep(factor) {
  const anchor = getSandboxZoomAnchorScreenPoint();
  applyZoomAtScreenPoint(factor, anchor.x, anchor.y);
}

/* Logika Zoom yang Mempertahankan Posisi Anchor di Layar */
export function applyZoomAtScreenPoint(factor, anchorX, anchorY) {
  const oz = IPState.camera.zoom;
  const nz = Math.max(0.2, Math.min(10, oz * factor));
  if (nz === oz) return;

  const originX = IPState.camera.viewWidth / 2 + IPState.camera.panPx - (IPState.world.offsetU - IPState.world.offsetV) * (IPConfig.s * oz) * IPConfig.cos;
  const originY = IPState.camera.viewHeight / 2 + IPState.camera.panPy - (IPState.world.offsetU + IPState.world.offsetV) * (IPConfig.s * oz) * IPConfig.sin;

  const newOriginX = anchorX - (anchorX - originX) * (nz / oz);
  const newOriginY = anchorY - (anchorY - originY) * (nz / oz);

  IPState.camera.zoom = nz;
  IPState.camera.panPx = newOriginX - IPState.camera.viewWidth / 2 + (IPState.world.offsetU - IPState.world.offsetV) * (IPConfig.s * IPState.camera.zoom) * IPConfig.cos;
  IPState.camera.panPy = newOriginY - IPState.camera.viewHeight / 2 + (IPState.world.offsetU + IPState.world.offsetV) * (IPConfig.s * IPState.camera.zoom) * IPConfig.sin;
  if (IPState.camera.followObjectEnabled && IPState.editor.activeObjectId !== null) {
    applyFollowObjectCamera();
  }
  requestRender();
}

export function clampWorldOffset() {
  const limit = Math.max(2, IPState.world.size);
  IPState.world.offsetU = Math.max(-limit, Math.min(limit, IPState.world.offsetU));
  IPState.world.offsetV = Math.max(-limit, Math.min(limit, IPState.world.offsetV));
}

export function moveGridByCell(du, dv) {
  IPState.world.offsetU += du;
  IPState.world.offsetV += dv;
  clampWorldOffset();
  requestRender();
}

