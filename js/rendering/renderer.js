/*
 * IsoPlayground — Canvas frame orchestrator.
 *
 * Modul ini menyiapkan context dan mengurutkan layer dunia/objek. Geometri,
 * hit testing, dan detail gambar berada pada modul rendering terpisah.
 */
import { IPState } from '../core/state.js';
import { getProjectionHelpers } from '../core/coordinates.js';
import { getSpriteForObject, beginSpriteFrame } from './sprites.js';
import { drawWorldPlane, drawWorldGuides } from './worldLayer.js';
import { drawWorldObjects } from './objectRenderer.js';
import { drawGameplayOverlays } from './gameplayOverlays.js';
import { clampWorldOffset } from '../core/camera.js';

let x = null;
let afterRenderCallback = () => {};

export function setRendererAfterRenderCallback(callback) {
  afterRenderCallback = typeof callback === 'function' ? callback : () => {};
}

export function setRendererContext(context) {
  if (!context || typeof context.clearRect !== 'function') {
    throw new TypeError('Renderer memerlukan CanvasRenderingContext2D yang valid.');
  }
  x = context;
}

function requireRendererContext() {
  if (!x) throw new Error('Canvas renderer belum menerima context dari main.js.');
  return x;
}

export function computeVisualSignature() {
  let signature = '';
  for (const object of IPState.world.cubes) {
    const sprite = getSpriteForObject(object);
    signature += object.id + ':' + (sprite ? ((sprite.uid || 0) + (sprite.loaded ? 'L' : 'W')) : 'cube') + ';';
  }
  return signature;
}

export function d() {
  requireRendererContext();
  beginSpriteFrame();
  IPState.runtime.lastDrawnVisualSig = computeVisualSignature();
  x.clearRect(0, 0, IPState.camera.viewWidth, IPState.camera.viewHeight);
  clampWorldOffset();

  const { p3d } = getProjectionHelpers();
  drawWorldPlane(x, p3d);
  drawWorldGuides(x, p3d);

  drawWorldObjects(x, p3d);
  drawGameplayOverlays(x, p3d);

  afterRenderCallback();
}


