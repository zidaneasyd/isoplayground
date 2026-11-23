/*
 * IsoPlayground — performance and Sandbox change monitoring.
 *
 * Menyimpan penghitung performa frame dan snapshot ringan untuk mengetahui
 * apakah state Sandbox berubah, terpisah dari pengatur simulasi utama.
 */
import { IPState, isSandboxMode } from '../core/state.js';
// Browser host memasang callback, sehingga modul gameplay tidak perlu
// mengimpor Canvas renderer atau adapter DOM secara langsung.
let requestCanvasResize = () => {};
let requestRender = () => {};

export function setRuntimeCanvasResizeCallback(callback) {
  requestCanvasResize = typeof callback === 'function' ? callback : () => {};
}

export function setRuntimeRenderCallback(callback) {
  requestRender = typeof callback === 'function' ? callback : () => {};
}

export function trackFramePerformance(ms) {
  if (!IPState.runtime.pageVisible || ms > 250) { IPState.perf.slowFrames = 0; return; }
  IPState.perf.slowFrames = ms > 26 ? IPState.perf.slowFrames + 1 : Math.max(0, IPState.perf.slowFrames - 2);
  if (IPState.perf.slowFrames >= 40 && IPState.perf.dprCap > 1) {
    IPState.perf.dprCap = IPState.perf.dprCap > 1.5 ? 1.5 : 1;
    IPState.perf.slowFrames = 0;
    requestCanvasResize();
    requestRender();
  }
}


// Snapshot numerik ini hanya dipakai simulation loop untuk mendeteksi perubahan
// Sandbox tanpa membangun string per objek pada setiap frame.
export function sandboxStateChanged() {
  if (!isSandboxMode()) return false;
  let changed = false, k = 0;
  const put = (val) => { if (IPState.sandbox.comparisonValues[k] !== val) { IPState.sandbox.comparisonValues[k] = val; changed = true; } k++; };
  for (const o of IPState.world.cubes) {
    put(Math.round(o.u * 1000)); put(Math.round(o.v * 1000)); put(o.h);
    put(o.hp === undefined || o.hp === null ? -1 : o.hp); put(o.activeSpriteDir || '');
  }
  put(IPState.camera.zoom); put(IPState.camera.panPx); put(IPState.camera.panPy); put(IPState.world.offsetU); put(IPState.world.offsetV); put(IPState.camera.viewWidth); put(IPState.camera.viewHeight);
  if (IPState.sandbox.comparisonValues.length !== k) { IPState.sandbox.comparisonValues.length = k; changed = true; }
  return changed;
}

