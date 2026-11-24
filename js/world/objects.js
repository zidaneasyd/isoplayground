/*
 * IsoPlayground — object record model operations.
 *
 * Operasi ini menerima koleksi objek dan mengembalikan perubahan data tanpa
 * akses DOM, alert/prompt, renderer, atau state global aplikasi.
 */
/*
 * Object model operations (Stage 6 — continuation)
 *
 * Operasi berikut hanya mengelola data objek di dalam array yang diberikan.
 * Tidak ada akses DOM, alert/prompt, atau pemanggilan renderer di sini.
 * Engine tetap menjadi lapisan UI yang memutuskan kapan panel dan Canvas
 * perlu diperbarui.
 */
export function canAssignObjectRole(objects, targetId, role) {
  const target = objects.find(item => item.id === targetId) || null;
  if (!target) return { allowed: false, reason: 'not-found', target: null, existingPlayer: null };
  if (role === 'Player') {
    const existingPlayer = objects.find(item => item.role === 'Player' && item.id !== targetId) || null;
    if (existingPlayer) {
      return { allowed: false, reason: 'player-exists', target, existingPlayer };
    }
  }
  return { allowed: true, reason: null, target, existingPlayer: null };
}

export function createObjectRecordAtCell(objects, currentNextId, cellU, cellV, role) {
  const prefix = role === 'Player' ? 'player-' : 'object-';
  let nextId = currentNextId;
  let name = prefix + nextId;
  const nameTaken = candidate => objects.some(item =>
    String(item.name || '').toLowerCase() === candidate.toLowerCase()
  );
  while (nameTaken(name)) {
    nextId++;
    name = prefix + nextId;
  }

  const object = {
    id: nextId,
    name,
    role: 'default',
    collision: true,
    u: cellU + 0.5,
    v: cellV + 0.5,
    h: 0,
    scale: 1,
    vx: 0,
    vz: 0,
    changeTimer: 0
  };
  return { object, nextObjectId: nextId + 1 };
}

export function renameObjectRecord(objects, objectId, requestedName) {
  const target = objects.find(item => item.id === objectId) || null;
  if (!target) return { ok: false, reason: 'not-found', target: null, name: '' };
  const name = String(requestedName).trim();
  if (!name) return { ok: false, reason: 'empty-name', target, name };
  const duplicate = objects.some(item => item.id !== objectId &&
    String(item.name || '').toLowerCase() === name.toLowerCase());
  if (duplicate) return { ok: false, reason: 'duplicate-name', target, name };
  target.name = name;
  return { ok: true, reason: null, target, name };
}

export function createUniqueDuplicateName(objects, sourceName) {
  let name = String(sourceName) + ' copy';
  let suffix = 2;
  const taken = candidate => objects.some(item =>
    String(item.name || '').toLowerCase() === candidate.toLowerCase()
  );
  while (taken(name)) name = String(sourceName) + ' copy ' + suffix++;
  return name;
}

export function duplicateObjectRecord(source, options) {
  if (!source || !options || !options.position) return null;
  const {
    id, name, createEmptyStateFramesMap, ensureObjectStateFrames,
    animationStates, directions
  } = options;
  if (typeof createEmptyStateFramesMap !== 'function' || typeof ensureObjectStateFrames !== 'function') {
    throw new TypeError('duplicateObjectRecord requires sprite-frame helper functions.');
  }

  const cloneStateFrames = createEmptyStateFramesMap();
  const sourceStateFrames = ensureObjectStateFrames(source);
  for (const state of animationStates) {
    for (const direction of directions) {
      cloneStateFrames[state][direction] = [...(sourceStateFrames[state][direction] || [])];
    }
  }

  const clone = {
    ...source,
    id,
    name,
    u: options.position.u,
    v: options.position.v,
    h: source.h,
    stateFrames: cloneStateFrames,
    stateFps: { ...(source.stateFps || {}) },
    vx: 0,
    vz: 0,
    changeTimer: 0,
    attackCooldown: 0
  };

  // Runtime transients must not leak into the duplicated object's new life.
  for (const key of [
    'pathWaypoints', 'pathRetryTimer', 'pathPlayerCellX', 'pathPlayerCellY',
    'pathSide', 'pathTimer', 'attackStopTime', 'flashUntil', 'damagePopups',
    'knockback', 'lastControlDu', 'lastControlDv', 'lastMoveDu', 'lastMoveDv',
    'lastWorldMove', 'attackAnimUntil', 'runHoldUntil', 'isMovingNow',
    'attackMoveStopTime', '_prevAnimState', 'pathFailCount'
  ]) delete clone[key];

  return clone;
}

export function removeObjectRecord(objects, objectId, activeId) {
  const index = objects.findIndex(item => item.id === objectId);
  if (index === -1) return { removed: null, activeObjectId: activeId };
  const [removed] = objects.splice(index, 1);
  const nextActiveId = activeId === removed.id
    ? (objects.length > 0 ? objects[objects.length - 1].id : null)
    : activeId;
  return { removed, activeObjectId: nextActiveId };
}


