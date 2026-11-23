/*
 * IsoPlayground — browser Canvas host.
 *
 * Mengurus ukuran/resolusi Canvas dan event mouse yang mengontrol kamera,
 * drag-pan, serta pemilihan objek. Perhitungan gambar berada di renderer.js;
 * proyeksi/kamera berada di coordinates.js dan camera.js.
 */
import { IPState, isSandboxMode } from '../core/state.js';
import { applyFollowObjectCamera, getZoomAnchorScreenPoint, applyZoomAtScreenPoint, setCameraRenderCallback } from '../core/camera.js';
import { setRendererContext, d } from '../rendering/renderer.js';
import { hitTestCube } from '../rendering/hitTesting.js';
import { releaseControlFocus } from './domUtils.js';
import { closeContextMenus } from './editorMenus.js';
import { renderObjectList } from './objectEditor.js';
import { syncObjectPanel, syncFooterActiveCoord } from './inspector.js';
import { setCombatRenderCallback } from '../gameplay/combat.js';
import { setSpriteAssetRenderCallback } from '../rendering/spriteAssets.js';
import { setRuntimeCanvasResizeCallback, setRuntimeRenderCallback } from '../gameplay/runtimeMonitor.js';

let hostInstalled = false;
let canvasElement = null;

export function resizeCanvas() {
  const canvas = canvasElement || document.getElementById('c');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser tidak menyediakan CanvasRenderingContext2D.');

  IPState.camera.viewWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
  IPState.camera.viewHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
  const dprCap = Math.max(1, Number(IPState.perf.dprCap) || 2);
  const nextDpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const pixelWidth = Math.max(1, Math.round(IPState.camera.viewWidth * nextDpr));
  const pixelHeight = Math.max(1, Math.round(IPState.camera.viewHeight * nextDpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight || IPState.camera.canvasDpr !== nextDpr) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    IPState.camera.canvasDpr = nextDpr;
  }

  context.setTransform(IPState.camera.canvasDpr, 0, 0, IPState.camera.canvasDpr, 0, 0);
  context.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
  d();
}

function onCanvasMouseDown(event) {
  if (event.button !== 0) return;
  if (isSandboxMode()) {
    IPState.input.drag = 0;
    IPState.input.movedDuringDrag = false;
    return;
  }
  closeContextMenus();
  releaseControlFocus();
  IPState.input.drag = 1;
  IPState.input.movedDuringDrag = false;
  IPState.input.lastX = event.clientX;
  IPState.input.lastY = event.clientY;
}

function onWindowMouseUp(event) {
  const input = IPState.input;
  const editor = IPState.editor;

  if (isSandboxMode()) {
    if (event.shiftKey && event.target === canvasElement) {
      const hit = hitTestCube(event.clientX, event.clientY);
      if (hit && hit.role === 'Player') {
        editor.activeObjectId = hit.id;
        if (IPState.camera.followObjectEnabled) applyFollowObjectCamera();
        d();
      }
    }
    input.drag = 0;
    return;
  }

  if (!input.drag) return;
  const wasClick = !input.movedDuringDrag;
  input.drag = 0;
  if (!wasClick || event.target !== canvasElement) return;

  const hit = hitTestCube(event.clientX, event.clientY);
  editor.activeObjectId = hit ? hit.id : null;
  renderObjectList();
  syncObjectPanel();
  syncFooterActiveCoord();
  if (IPState.camera.followObjectEnabled && editor.activeObjectId !== null) {
    applyFollowObjectCamera();
  }
  d();
}

function onWindowMouseMove(event) {
  if (isSandboxMode()) return;
  const input = IPState.input;
  if (!input.drag) return;

  const dx = event.clientX - input.lastX;
  const dy = event.clientY - input.lastY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) input.movedDuringDrag = true;
  IPState.camera.panPx += dx;
  IPState.camera.panPy += dy;
  input.lastX = event.clientX;
  input.lastY = event.clientY;
  d();
}

function onCanvasWheel(event) {
  event.preventDefault();
  releaseControlFocus();
  const factor = event.deltaY < 0 ? 1.1 : 0.9;
  const anchor = getZoomAnchorScreenPoint(event);
  applyZoomAtScreenPoint(factor, anchor.x, anchor.y);
}

/** Menghubungkan Canvas API dengan renderer dan memasang input host browser. */
export function installCanvasHost() {
  if (hostInstalled) return canvasElement;
  canvasElement = document.getElementById('c');
  if (!canvasElement) throw new Error('Canvas utama (#c) tidak ditemukan.');
  const context = canvasElement.getContext('2d');
  if (!context) throw new Error('Canvas 2D context tidak dapat dibuat.');
  setRendererContext(context);
  setCameraRenderCallback(d);
  setCombatRenderCallback(d);
  setSpriteAssetRenderCallback(d);
  setRuntimeCanvasResizeCallback(resizeCanvas);
  setRuntimeRenderCallback(d);

  canvasElement.addEventListener('mousedown', onCanvasMouseDown);
  canvasElement.addEventListener('wheel', onCanvasWheel, { passive: false });
  window.addEventListener('mouseup', onWindowMouseUp);
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('resize', resizeCanvas, { passive: true });

  hostInstalled = true;
  resizeCanvas();
  return canvasElement;
}

