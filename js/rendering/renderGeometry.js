/*
 * IsoPlayground — reusable geometry for Canvas rendering and hit testing.
 *
 * Berisi bentuk kubus, kotak batas sprite, dan uji titik-poligon.
 * Scale hanya memengaruhi tinggi objek (sumbu Y vertikal layar).
 * Lebar dan kedalaman objek selalu menggunakan ukuran standar.
 */
import { normalizeObjectScale } from '../world/objectScale.js';

export function getCubeFaces(p3d, object) {
  const scale = normalizeObjectScale(object.scale);

  // Lebar dan kedalaman selalu tetap 1 unit.
  const halfCube = 0.5;

  const uMin = object.u - halfCube;
  const uMax = object.u + halfCube;
  const vMin = object.v - halfCube;
  const vMax = object.v + halfCube;

  const baseHeight = object.h ?? 0;

  // Bagian bawah objek tidak berubah.
  const b00 = p3d(uMin, vMin, baseHeight);
  const b10 = p3d(uMax, vMin, baseHeight);
  const b11 = p3d(uMax, vMax, baseHeight);
  const b01 = p3d(uMin, vMax, baseHeight);

  // Hanya bagian atas yang berubah mengikuti scale.
  const topHeight = baseHeight + scale;

  const t00 = p3d(uMin, vMin, topHeight);
  const t10 = p3d(uMax, vMin, topHeight);
  const t11 = p3d(uMax, vMax, topHeight);
  const t01 = p3d(uMin, vMax, topHeight);

  return {
    b00,
    b10,
    b11,
    b01,

    t00,
    t10,
    t11,
    t01,

    leftFace: [
      b01,
      b11,
      t11,
      t01
    ],

    rightFace: [
      b11,
      b10,
      t10,
      t11
    ],

    topFace: [
      t00,
      t10,
      t11,
      t01
    ],

    topCenter: {
      x: (t00.x + t10.x + t11.x + t01.x) / 4,
      y: (t00.y + t10.y + t11.y + t01.y) / 4
    }
  };
}

export function pointInPolygon(point, polygon) {
  let inside = false;

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;

    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      ((yi > point.y) !== (yj > point.y)) &&
      (
        point.x <
        (xj - xi) * (point.y - yi) /
        ((yj - yi) || 1e-9) + xi
      );

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function getSpriteScreenRect(p3d, object, sprite) {
  if (!object || !sprite || !sprite.loaded || !sprite.img) {
    return null;
  }

  const naturalWidth =
    sprite.img.naturalWidth || sprite.width || 1;

  const naturalHeight =
    sprite.img.naturalHeight || sprite.height || 1;

  const ratio = naturalWidth / Math.max(1, naturalHeight);

  const baseHeight = object.h ?? 0;

  // Titik kaki objek menjadi titik tetap.
  const foot = p3d(
    object.u,
    object.v,
    baseHeight
  );

  const scale = normalizeObjectScale(object.scale);

  // Tinggi standar sprite saat scale = 1.
  const defaultTop = p3d(
    object.u,
    object.v,
    baseHeight + 2
  );

  const defaultDrawHeight = Math.max(
    1,
    Math.abs(foot.y - defaultTop.y)
  );

  // Tinggi sprite berubah mengikuti scale.
  const top = p3d(
    object.u,
    object.v,
    baseHeight + (2 * scale)
  );

  const drawHeight = Math.max(
    1,
    Math.abs(foot.y - top.y)
  );

  // Lebar sprite tidak ikut berubah.
  const drawWidth = defaultDrawHeight * ratio;

  return {
    x: foot.x - drawWidth / 2,
    y: foot.y - drawHeight,
    w: drawWidth,
    h: drawHeight,
    centerX: foot.x,
    topY: foot.y - drawHeight
  };
}

export function drawPolygon(context, points) {
  context.beginPath();

  context.moveTo(
    points[0].x,
    points[0].y
  );

  for (let i = 1; i < points.length; i++) {
    context.lineTo(
      points[i].x,
      points[i].y
    );
  }

  context.closePath();
  context.fill();
}