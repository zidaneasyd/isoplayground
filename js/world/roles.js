/*
 * IsoPlayground role rules.
 *
 * Modul ini mengatur default data Player/NPC/default object, normalisasi speed,
 * dan inisialisasi gerak awal NPC. Tidak ada akses DOM di sini.
 */
import { EIGHT_WAY_VECTORS } from '../core/config.js';


const ROLE_COMBAT_DEFAULTS = Object.freeze({
  Player: Object.freeze({ maxHp: 300, damage: 20, attackInterval: 0.5 }),
  NPC: Object.freeze({ maxHp: 100, damage: 10, attackInterval: 1 })
});

/** Read-only combat defaults shared by role setup, gameplay, and project I/O. */
export function getRoleCombatDefaults(role) {
  return role === 'Player' ? ROLE_COMBAT_DEFAULTS.Player : ROLE_COMBAT_DEFAULTS.NPC;
}

export function normalizeSpeed(value) {
  let number = parseFloat(value);
  if (Number.isNaN(number)) number = 2;
  return Math.max(2, Math.min(10, Math.round(number * 2) / 2));
}

export function npcDefaults(cb) {
  cb.enemy = !!cb.enemy;
  cb.roaming = cb.roaming !== false;
  if (typeof cb.homeU !== 'number') cb.homeU = cb.u;
  if (typeof cb.homeV !== 'number') cb.homeV = cb.v;
}

export function clearNpcRuntimeState(obj) {
  delete obj.pathWaypoints;
  delete obj.pathRetryTimer;
  delete obj.pathPlayerCellX;
  delete obj.pathPlayerCellY;
  delete obj.pathSide;
  delete obj.pathTimer;
  delete obj.attackStopTime;
  delete obj.pathFailCount;
}

export function setObjectRoleDefault(target) {
  if (!target) return;
  target.role = 'default';
  clearNpcRuntimeState(target);
  target.vx = 0;
  target.vz = 0;
  target.changeTimer = 0;
  for (const key of [
    'speed', 'runSpeed', 'hitArea', 'attackArea', 'detectionArea', 'enemy',
    'roaming', 'homeU', 'homeV', 'maxHp', 'hp', 'damage', 'attackInterval',
    'attackCooldown', 'flashUntil', 'damagePopups', 'attackStopTime',
    'knockback', 'lastControlDu', 'lastControlDv', 'lastMoveDu', 'lastMoveDv',
    'lastWorldMove'
  ]) delete target[key];
}

export function applyRoleDefaults(target, role) {
  if (!target) return;
  target.role = (role === 'Player' || role === 'NPC') ? role : 'default';
  clearNpcRuntimeState(target);
  if (target.role === 'default') {
    setObjectRoleDefault(target);
    return;
  }

  const isPlayer = target.role === 'Player';
  const combatDefaults = getRoleCombatDefaults(target.role);
  target.speed = 2;
  target.runSpeed = 6;
  target.hitArea = 1.5;
  target.attackArea = 1.5;
  target.detectionArea = 3;
  target.maxHp = combatDefaults.maxHp;
  target.hp = target.maxHp;
  target.damage = combatDefaults.damage;
  target.attackInterval = combatDefaults.attackInterval;
  target.attackCooldown = 0;
  target.enemy = false;
  target.roaming = true;
  target.homeU = target.u;
  target.homeV = target.v;
  target.vx = 0;
  target.vz = 0;
  target.changeTimer = 0;
  delete target.lastWorldMove;
  delete target.lastMoveDu;
  delete target.lastMoveDv;

  if (target.role === 'NPC') {
    npcDefaults(target);
    initNpcMotion(target);
  }
}

export function initNpcMotion(npc) {
  npcDefaults(npc);
  if (!npc.roaming) {
    npc.vx = 0;
    npc.vz = 0;
    npc.changeTimer = 999;
    return;
  }
  const speed = normalizeSpeed(npc.speed);
  npc.speed = speed;
  const [du, dv] = EIGHT_WAY_VECTORS[Math.floor(Math.random() * EIGHT_WAY_VECTORS.length)];
  const magnitude = Math.hypot(du, dv) || 1;
  npc.vx = (du / magnitude) * speed;
  npc.vz = (dv / magnitude) * speed;
  npc.changeTimer = 0.7 + Math.random() * 1.6;
}

