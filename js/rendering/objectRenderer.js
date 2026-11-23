/*
 * IsoPlayground — world entity renderer.
 *
 * Menggambar representasi utama setiap objek: sprite jika tersedia, atau cube
 * isometrik sebagai fallback. Radius, label, HP bar, dan efek combat berada di
 * gameplayOverlays.js agar visual entity tidak tercampur dengan indikator UI.
 */
import { IPState } from '../core/state.js';
import { getSpriteForObject } from './sprites.js';
import { getCubeFaces, getSpriteScreenRect, drawPolygon } from './renderGeometry.js';

function getDrawableForSprite(sprite, width, height) {
  const image = sprite.img;
  const naturalWidth = image.naturalWidth || 0;
  const naturalHeight = image.naturalHeight || 0;
  if (!naturalWidth || !naturalHeight) return image;
  const targetWidth = Math.max(32, Math.ceil((width * IPState.camera.canvasDpr) / 32) * 32);
  if (targetWidth >= naturalWidth * 0.7) return image;
  const cached = sprite._scaled;
  if (cached && cached.tw === targetWidth) return cached.canvas;
  const targetHeight = Math.max(1, Math.round(targetWidth * naturalHeight / naturalWidth));
  const canvas = (cached && cached.canvas) || document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  sprite._scaled = { tw: targetWidth, canvas };
  return canvas;
}

function drawSolidCube1m(x, p3d, object) {
  const spriteRect = getSpriteScreenRect(p3d, object, getSpriteForObject(object));
  const now = performance.now();
  const isFlashing = now < (object.flashUntil || 0) &&
    Math.floor((now - ((object.flashUntil || 0) - 300)) / 55) % 2 === 0;

  if (spriteRect) {
    const sprite = getSpriteForObject(object);
    x.save();
    x.drawImage(getDrawableForSprite(sprite, spriteRect.w, spriteRect.h), spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h);
    if (isFlashing) {
      x.globalAlpha = 0.45;
      x.fillStyle = '#ff2020';
      x.fillRect(spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h);
    }
    x.restore();
    return;
  }

  const faces = getCubeFaces(p3d, object);
  x.fillStyle = '#6c6c6c';
  drawPolygon(x, faces.leftFace);
  x.fillStyle = '#848484';
  drawPolygon(x, faces.rightFace);
  x.fillStyle = '#9e9e9e';
  drawPolygon(x, faces.topFace);
  if (isFlashing) {
    x.save();
    x.globalAlpha = 0.55;
    x.fillStyle = '#ff2020';
    drawPolygon(x, faces.leftFace);
    drawPolygon(x, faces.rightFace);
    drawPolygon(x, faces.topFace);
    x.restore();
  }
}

/** Draw all objects in the original painter order, back to front. */
export function drawWorldObjects(context, p3d) {
  const sortedObjects = [...IPState.world.cubes].sort((a, b) =>
    (a.u + a.v + (a.h ?? 0) * 0.01) - (b.u + b.v + (b.h ?? 0) * 0.01)
  );
  for (const object of sortedObjects) drawSolidCube1m(context, p3d, object);
}
