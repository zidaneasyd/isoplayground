/* Shared mapping between world movement vectors and 8-way sprite directions. */
import { SPRITE_DIRECTIONS } from './config.js';
import { IPState } from './state.js';

const DIRECTION_VECTORS = Object.freeze([
  { key: 'front', u: 1, v: 1 },
  { key: 'frontright', u: 1, v: 0 },
  { key: 'right', u: 1, v: -1 },
  { key: 'rightback', u: 0, v: -1 },
  { key: 'back', u: -1, v: -1 },
  { key: 'backleft', u: -1, v: 0 },
  { key: 'left', u: -1, v: 1 },
  { key: 'leftfront', u: 0, v: 1 }
]);

export function getDirectionKeyFromVector(du, dv, prevKey) {
  if (Math.hypot(du, dv) < 1e-6) return null;
  const len = Math.hypot(du, dv);
  const nu = du / len;
  const nv = dv / len;
  let best = DIRECTION_VECTORS[0];
  let bestScore = -Infinity;
  for (const vector of DIRECTION_VECTORS) {
    const vectorLength = Math.hypot(vector.u, vector.v) || 1;
    const score = nu * (vector.u / vectorLength) + nv * (vector.v / vectorLength);
    if (score > bestScore) {
      bestScore = score;
      best = vector;
    }
  }
  if (prevKey && SPRITE_DIRECTIONS.includes(prevKey) && prevKey !== best.key) {
    const previous = DIRECTION_VECTORS.find(vector => vector.key === prevKey);
    if (previous) {
      const previousLength = Math.hypot(previous.u, previous.v) || 1;
      const previousScore = nu * (previous.u / previousLength) + nv * (previous.v / previousLength);
      if (bestScore - previousScore < 0.1) return prevKey;
    }
  }
  return best.key;
}


export function getInputDirectionKey() {
  const keys = IPState.input.pressedKeys;
  const w = keys.up, aKey = keys.left, sKey = keys.down, dKey = keys.right;
  if (sKey && dKey && !w && !aKey) return 'frontright';
  if (dKey && w && !sKey && !aKey) return 'rightback';
  if (w && aKey && !sKey && !dKey) return 'backleft';
  if (aKey && sKey && !w && !dKey) return 'leftfront';
  if (sKey && !w && !aKey && !dKey) return 'front';
  if (dKey && !w && !aKey && !sKey) return 'right';
  if (w && !sKey && !aKey && !dKey) return 'back';
  if (aKey && !w && !sKey && !dKey) return 'left';
  return null;
}

export function getPlayerEightWayVector() {
  const keys = IPState.input.pressedKeys;
  const w = keys.up, aKey = keys.left, sKey = keys.down, dKey = keys.right;
  let du = 0, dv = 0;
  if (w && aKey) { du = -1; dv = 0; }
  else if (aKey && sKey) { du = 0; dv = 1; }
  else if (sKey && dKey) { du = 1; dv = 0; }
  else if (dKey && w) { du = 0; dv = -1; }
  else {
    if (w) { du -= 1; dv -= 1; }
    if (aKey) { du -= 1; dv += 1; }
    if (sKey) { du += 1; dv += 1; }
    if (dKey) { du += 1; dv -= 1; }
  }
  const length = Math.hypot(du, dv);
  if (length === 0) return { du: 0, dv: 0 };
  return { du: du / length, dv: dv / length };
}

