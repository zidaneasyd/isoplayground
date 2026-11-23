/*
 * IsoPlayground — sprite file selection and upload adapter.
 *
 * Mengurus pemilihan beberapa gambar, pembacaan FileReader, serta pemasangan
 * frame ke state/arah animasi yang sedang dipilih pada inspector.
 */
import { IPState } from '../core/state.js';
import { getPanelAnimationState, getPanelPreviewDirection, ensureObjectStateFrames, compareFilenamesAscending } from '../rendering/sprites.js';
import { createSpriteRecord } from '../rendering/spriteAssets.js';
import { syncSpritePanel } from './spriteInspector.js';
import { d } from '../rendering/renderer.js';

export function triggerAddSprite() {
  const object = IPState.world.cubes.find(item => item.id === IPState.editor.activeObjectId);
  if (!object) return;
  const input = document.getElementById('sprite-file-input');
  if (!input) return;
  input.value = '';
  input.click();
}

/** Read selected images and replace the active animation state's direction frames. */
export function handleSpriteFileSelected(event) {
  const files = Array.from((event.target && event.target.files) || []);
  if (!files.length) return;
  const targetObject = IPState.world.cubes.find(item => item.id === IPState.editor.activeObjectId);
  if (!targetObject) return;
  const feedbackElement = document.getElementById('sprite-upload-feedback');

  const imageFiles = files
    .filter(file => file && (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)))
    .sort((a, b) => compareFilenamesAscending(a.name, b.name));

  if (!imageFiles.length) {
    if (feedbackElement) feedbackElement.textContent = 'Pilih file gambar yang valid.';
    return;
  }
  if (feedbackElement) feedbackElement.textContent = '';

  const targetState = getPanelAnimationState(targetObject);
  const targetDirection = getPanelPreviewDirection(targetObject);
  const stateFrames = ensureObjectStateFrames(targetObject);
  const loadedRecords = new Array(imageFiles.length);
  const failedNames = [];
  let remaining = imageFiles.length;

  const finishOne = () => {
    if (--remaining !== 0) return;
    const loaded = loadedRecords.filter(Boolean);
    if (loaded.length) {
      stateFrames[targetState][targetDirection] = loaded;
      IPState.sprites.previewStartTime = performance.now();
      syncSpritePanel();
      d();
    }
    if (feedbackElement) {
      feedbackElement.textContent = failedNames.length
        ? (loaded.length ? 'Sebagian file gagal dibaca: ' : 'Gagal membaca file: ') + failedNames.join(', ') + '.'
        : '';
    }
  };

  imageFiles.forEach((file, index) => {
    const reader = new FileReader();
    let settled = false;
    const settle = callback => {
      if (settled) return;
      settled = true;
      callback();
      finishOne();
    };
    reader.onload = () => settle(() => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) loadedRecords[index] = createSpriteRecord(dataUrl, 0, 0, file.name);
      else failedNames.push(file.name);
    });
    reader.onerror = reader.onabort = () => settle(() => { failedNames.push(file.name); });
    reader.readAsDataURL(file);
  });
}

export const spriteFileActions = Object.freeze({ triggerAddSprite, handleSpriteFileSelected });
