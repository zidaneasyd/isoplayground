/*
 * IsoPlayground — pointer hit testing for isometric objects.
 *
 * Mencari objek terdepan yang terkena pointer. Geometri dasarnya disediakan
 * renderGeometry.js agar perhitungan bentuk dapat dipakai ulang oleh renderer.
 */
import { IPState } from '../core/state.js';
import { getProjectionHelpers } from '../core/coordinates.js';
import { getCubeFaces, getSpriteScreenRect, pointInPolygon } from './renderGeometry.js';
import { getSpriteForObject } from './sprites.js';

export function hitTestCube(clientX, clientY) {
  const { p3d } = getProjectionHelpers();
  const point = { x: clientX, y: clientY };
  const sortedFrontToBack = [...IPState.world.cubes].sort(
    (a, b) => (b.u + b.v + (b.h ?? 0) * 0.01) -
      (a.u + a.v + (a.h ?? 0) * 0.01)
  );
  for (const object of sortedFrontToBack) {
    const spriteRect = getSpriteScreenRect(p3d, object, getSpriteForObject(object));
    if (spriteRect) {
      if (
        point.x >= spriteRect.x && point.x <= spriteRect.x + spriteRect.w &&
        point.y >= spriteRect.y && point.y <= spriteRect.y + spriteRect.h
      ) return object;
      continue;
    }
    const faces = getCubeFaces(p3d, object);
    if (
      pointInPolygon(point, faces.topFace) ||
      pointInPolygon(point, faces.leftFace) ||
      pointInPolygon(point, faces.rightFace)
    ) return object;
  }
  return null;
}
