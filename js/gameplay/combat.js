/*
 * IsoPlayground combat rules.
 *
 * Menangani default combat, validasi HP/damage, knockback, penerapan damage,
 * dan serangan Player. Operasi gameplay membaca state secara eksplisit.
 */
import { IPState, isSandboxMode } from '../core/state.js';
import { getDirectionKeyFromVector } from '../core/directions.js';
import { getRoleCombatDefaults } from '../world/roles.js';

let requestCombatRender = () => {};
export function setCombatRenderCallback(callback) {
  requestCombatRender = typeof callback === 'function' ? callback : () => {};
}

export function ensureCombatDefaults(object) {
  const defaults = getRoleCombatDefaults(object.role);
  object.maxHp = Math.max(100, Math.min(10000, object.maxHp == null ? defaults.maxHp : object.maxHp));
  object.hp = Math.max(0, Math.min(object.maxHp, object.hp == null ? object.maxHp : object.hp));
  object.damage = Math.max(10, Math.min(1000, object.damage == null ? defaults.damage : object.damage));
  object.attackInterval = Math.max(0.2, Math.min(1, object.attackInterval == null ? defaults.attackInterval : object.attackInterval));
  object.attackCooldown = Math.max(0, object.attackCooldown || 0);
}

export function getAttackKnockbackDirection(attacker, target) {
  // Knockback follows the direction from attacker to target.
  const du = target.u - attacker.u;
  const dv = target.v - attacker.v;

  const length = Math.hypot(du, dv) || 1;

  return {
    du: du / length,
    dv: dv / length
  };
}

export function applyKnockback(target, attacker) {
  if (!target || target.role === 'default') return;
  const direction = getAttackKnockbackDirection(attacker, target);
  target.knockback = { du: direction.du, dv: direction.dv, remaining: 0.18, speed: 3.6 };
  target.vx = 0;
  target.vz = 0;
  if (target.role === 'NPC') {
    target.attackStopTime = 0;
    target.pathWaypoints = [];
    target.pathRetryTimer = 0;
    delete target.pathPlayerCellX;
    delete target.pathPlayerCellY;
  }
}

export function dealDamage(target, amount, attacker) {
  if (!target || target.role === 'default') return;
  const sandboxMode = isSandboxMode();
  ensureCombatDefaults(target);
  if (sandboxMode && target.hp <= 0) return;
  // Editor hanya menampilkan efek hit; HP benar-benar turun di Sandbox.
  if (sandboxMode) target.hp = Math.max(0, target.hp - amount);
  target.flashUntil = performance.now() + 300;
  target.damagePopups = target.damagePopups || [];
  target.damagePopups.push({ value: amount, created: performance.now() });
  applyKnockback(target, attacker);
  if (attacker) attacker.attackCooldown = attacker.attackInterval || 0.2;
  requestCombatRender();
}

export function playerAttack() {
  const cubes = IPState.world.cubes;
  const player = cubes.find(object => object.role === 'Player');
  const sandboxMode = isSandboxMode();
  if (!player || (sandboxMode && player.hp <= 0)) return;
  ensureCombatDefaults(player);
  if (player.attackCooldown > 0) return;

  const candidates = cubes
    .filter(object => object.role === 'NPC' && (!sandboxMode || object.hp > 0) &&
      Math.hypot(object.u - player.u, object.v - player.v) <= player.attackArea + Math.max(0.25, object.hitArea ?? 1.5))
    .sort((a, b) =>
      Math.hypot(a.u - player.u, a.v - player.v) - Math.hypot(b.u - player.u, b.v - player.v)
    );

  if (!candidates.length) return;
  const attackDirection = getDirectionKeyFromVector(
    candidates[0].u - player.u,
    candidates[0].v - player.v
  );
  if (attackDirection) player.activeSpriteDir = attackDirection;
  player.attackAnimUntil = performance.now() + Math.max(250, Math.round((player.attackInterval || 0.35) * 500));
  player.attackMoveStopTime = Math.max(player.attackMoveStopTime || 0, 0.18);
  dealDamage(candidates[0], player.damage, player);
}

