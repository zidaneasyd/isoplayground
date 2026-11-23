/* Browser Image factory for imported/uploaded sprite assets. */
import { IPState } from '../core/state.js';

// Callback dipasang oleh browser host agar layer asset tidak bergantung pada renderer.
let requestRender = () => {};

export function setSpriteAssetRenderCallback(callback) {
  requestRender = typeof callback === 'function' ? callback : () => {};
}

export function createSpriteRecord(src, width = 0, height = 0, name = '') {
  const record = {
    uid: ++IPState.runtime.spriteUidCounter,
    src,
    name,
    width: Number(width) || 0,
    height: Number(height) || 0,
    img: null,
    loaded: false
  };
  const image = new Image();
  image.onload = () => {
    record.width = image.naturalWidth || record.width || 1;
    record.height = image.naturalHeight || record.height || 1;
    record.loaded = true;
    requestRender();
  };
  image.src = src;
  record.img = image;
  return record;
}

