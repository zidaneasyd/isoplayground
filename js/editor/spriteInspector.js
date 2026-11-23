/*
 * IsoPlayground — sprite inspector UI.
 *
 * Mengelola kontrol state animasi, daftar frame, dan Canvas preview kecil.
 * Struktur frame/runtime animation berada di rendering/sprites.js; proses
 * pembacaan file gambar berada di spriteFileAdapter.js.
 */
import { IPState } from '../core/state.js';
import { SPRITE_ANIM_STATES, SPRITE_DIRECTION_SET } from '../core/config.js';
import {
  clampSpriteFps,
  getPanelAnimationState,
  getPanelPreviewDirection,
  getPanelPreviewFrames,
  getPanelPreviewSpriteForObject,
  getFramesForStateDir,
  getObjectStateFps
} from '../rendering/sprites.js';
import { d } from '../rendering/renderer.js';
import { escapeHtml } from '../core/textUtils.js';

function getActiveObject() {
  return IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId) || null;
}

/** Update FPS for the animation state currently selected in the inspector. */
export function setPanelFps(value) {
  const object = getActiveObject();
  if (!object) return;

  const state = getPanelAnimationState(object);
  if (!object.stateFps || typeof object.stateFps !== 'object') object.stateFps = {};
  object.stateFps[state] = clampSpriteFps(value);

  const valueElement = document.getElementById('sprite-fps-val');
  if (valueElement) valueElement.textContent = object.stateFps[state] + ' fps';
  d();
}

/** Change the previewed animation state without modifying runtime movement state. */
export function setPanelAnimationState(stateValue) {
  const object = getActiveObject();
  if (!object) return;
  object.panelAnimState = SPRITE_ANIM_STATES.includes(stateValue) ? stateValue : 'Idle';
  IPState.sprites.previewStartTime = performance.now();
  syncSpritePanel();
}

/** Change the preview direction, falling back to front for unsupported keys. */
export function setPanelPreviewDirection(directionKey) {
  const object = getActiveObject();
  if (!object) return;
  object.panelPreviewDir = SPRITE_DIRECTION_SET.has(directionKey) ? directionKey : 'front';
  IPState.sprites.previewStartTime = performance.now();
  syncSpritePanel();
}

/** Start or pause the inspector-only sprite preview. */
export function toggleSpritePreviewPlay() {
  const object = getActiveObject();
  if (!object || !getPanelPreviewFrames(object).length) return;

  IPState.sprites.previewPlaying = !IPState.sprites.previewPlaying;
  if (IPState.sprites.previewPlaying) {
    IPState.sprites.previewStartTime = performance.now();
  }
  syncSpritePanel();
}

/** Render thumbnails for the selected state and direction. */
export function renderSpriteFrameList(object) {
  const listElement = document.getElementById('sprite-frame-list');
  if (!listElement) return;

  if (!object) {
    listElement.innerHTML = '<div class="sprite-frame-item is-empty"><span class="sprite-frame-label">Daftar kosong</span><div class="sprite-frame-thumb" aria-hidden="true"></div></div>';
    return;
  }

  const state = getPanelAnimationState(object);
  const direction = getPanelPreviewDirection(object);
  const frames = getFramesForStateDir(object, state, direction);
  if (!frames.length) {
    listElement.innerHTML = '<div class="sprite-frame-item is-empty"><span class="sprite-frame-label">Daftar kosong</span><div class="sprite-frame-thumb" aria-hidden="true"></div></div>';
    return;
  }

  listElement.innerHTML = frames.map((record, index) => {
    const label = record.name
      ? `${index + 1}. ${record.name}`
      : `${state} ${direction} frame ${index + 1}`;
    return `<div class="sprite-frame-item">
      <span class="sprite-frame-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <div class="sprite-frame-thumb"><img src="${escapeHtml(record.src)}" alt="${escapeHtml(label)}"></div>
    </div>`;
  }).join('');
}

/** Paint one loaded sprite into the fixed-size preview Canvas. */
export function paintSpritePreview(record) {
  const canvas = document.getElementById('sprite-preview-img');
  if (!canvas) return;

  if (!record) {
    if (canvas._uid != null) {
      canvas._uid = null;
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }
  if (!record.loaded || !record.img) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas._uid === record.uid && canvas.width === width && canvas.height === height) return;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';

  const naturalWidth = record.img.naturalWidth || 1;
  const naturalHeight = record.img.naturalHeight || 1;
  const scale = Math.min(width / naturalWidth, height / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  context.drawImage(
    record.img,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  canvas._uid = record.uid;
}

/** Update the inspector preview while it is visible; this is not game simulation. */
export function updateActiveSpritePreview(now) {
  if (IPState.editor.activeObjectId === null) return;
  const previewBox = document.getElementById('sprite-preview-box');
  if (!previewBox || (!IPState.sprites.previewPlaying && !previewBox.classList.contains('has-sprite'))) return;

  const object = getActiveObject();
  const frameRecord = getPanelPreviewSpriteForObject(object, now);
  if (frameRecord && frameRecord.src) {
    previewBox.classList.add('has-sprite');
    paintSpritePreview(frameRecord);
  }
}

/** Synchronize all sprite-inspector controls with the active object's sprite data. */
export function syncSpritePanel() {
  const object = getActiveObject();
  const nameElement = document.getElementById('sprite-active-obj-name');
  const stateSelect = document.getElementById('sprite-state-select');
  const directionSelect = document.getElementById('sprite-dir-select');
  const addButton = document.getElementById('add-sprite-btn');
  const playButton = document.getElementById('sprite-play-btn');
  const previewBox = document.getElementById('sprite-preview-box');
  const previewCanvas = document.getElementById('sprite-preview-img');
  const feedbackElement = document.getElementById('sprite-upload-feedback');

  if (!nameElement || !addButton || !previewBox || !previewCanvas) return;

  if (!object) {
    IPState.sprites.previewPlaying = false;
    nameElement.textContent = '';
    if (stateSelect) {
      stateSelect.value = 'Idle';
      stateSelect.disabled = true;
    }
    if (directionSelect) {
      directionSelect.value = 'front';
      directionSelect.disabled = true;
    }
    addButton.disabled = true;
    if (playButton) {
      playButton.classList.remove('visible', 'playing');
      playButton.disabled = true;
    }
    previewBox.classList.remove('has-sprite');
    paintSpritePreview(null);
    if (feedbackElement) feedbackElement.textContent = '';
    renderSpriteFrameList(null);
    return;
  }

  nameElement.textContent = object.name;
  nameElement.title = object.name;
  const animationState = getPanelAnimationState(object);
  if (stateSelect) {
    stateSelect.disabled = false;
    stateSelect.value = animationState;
  }

  const previewDirection = getPanelPreviewDirection(object);
  if (directionSelect) {
    directionSelect.disabled = false;
    directionSelect.value = previewDirection;
  }
  addButton.disabled = false;

  const fpsSlider = document.getElementById('sprite-fps-slider');
  const fpsValue = document.getElementById('sprite-fps-val');
  const fps = getObjectStateFps(object, animationState);
  if (fpsSlider) fpsSlider.value = fps;
  if (fpsValue) fpsValue.textContent = fps + ' fps';

  const frames = getPanelPreviewFrames(object);
  if (!frames.length) IPState.sprites.previewPlaying = false;
  if (playButton) {
    const canPlay = frames.length > 0;
    playButton.classList.toggle('visible', canPlay);
    playButton.disabled = !canPlay;
    playButton.classList.toggle('playing', canPlay && IPState.sprites.previewPlaying);
    const label = playButton.querySelector('span');
    if (label) label.textContent = canPlay && IPState.sprites.previewPlaying ? 'Pause' : 'Play';
  }

  const previewSprite = getPanelPreviewSpriteForObject(object);
  if (previewSprite && previewSprite.src) {
    previewBox.classList.add('has-sprite');
    paintSpritePreview(previewSprite);
  } else {
    previewBox.classList.remove('has-sprite');
    paintSpritePreview(null);
  }
  renderSpriteFrameList(object);
}

// Action map dipakai oleh delegated event bridge dan command/editor adapters.
export const spriteInspectorActions = Object.freeze({
  setPanelFps,
  setPanelAnimationState,
  setPanelPreviewDirection,
  toggleSpritePreviewPlay,
  renderSpriteFrameList,
  paintSpritePreview,
  updateActiveSpritePreview,
  syncSpritePanel
});
