/*
 * IsoPlayground configuration.
 *
 * Nilai default yang relatif tetap dikumpulkan di sini: proyeksi isometrik,
 * arah gerak, animasi sprite, timing AI, dan identitas penyimpanan Sandbox.
 * IPConfig dan named exports menjadi API konfigurasi untuk seluruh modul.
 */

export const a = Math.PI / 6;       // sudut isometrik (30 derajat)
export const cos = Math.cos(a);     // komponen horizontal proyeksi
export const sin = Math.sin(a);     // komponen vertikal proyeksi
export const s = 48;                // ukuran dasar grid dalam pixel

export const EIGHT_WAY_VECTORS = Object.freeze([
  [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]
]);

export const SPRITE_ANIM_STATES = Object.freeze(['Idle', 'Run', 'Attack']);
export const SPRITE_FPS_DEFAULT = 8;
export const SPRITE_FPS_MIN = 6;
export const SPRITE_FPS_MAX = 30;
export const SPRITE_DIRECTIONS = Object.freeze([
  'front', 'frontright', 'right', 'rightback',
  'back', 'backleft', 'left', 'leftfront'
]);
export const SPRITE_DIRECTION_SET = new Set(SPRITE_DIRECTIONS);

export const NPC_RUN_HOLD_MS = 180;
export const NPC_PATH_BUDGET_MS = 10;
export const NPC_MAX_PLANS_PER_FRAME = 1;
export const NPC_RETRY_BASE = 0.15;
export const NPC_RETRY_MAX = 2;

export const SANDBOX_DB = 'iso-playground-sandbox';
export const SANDBOX_STORE = 'sessions';
export const SANDBOX_MAX_AGE_MS = 24 * 3600 * 1000;

export const IPConfig = Object.freeze({
  a, cos, sin, s,
  EIGHT_WAY_VECTORS,
  SPRITE_ANIM_STATES, SPRITE_FPS_DEFAULT, SPRITE_FPS_MIN, SPRITE_FPS_MAX,
  SPRITE_DIRECTIONS, SPRITE_DIRECTION_SET,
  NPC_RUN_HOLD_MS, NPC_PATH_BUDGET_MS, NPC_MAX_PLANS_PER_FRAME, NPC_RETRY_BASE, NPC_RETRY_MAX,
  SANDBOX_DB, SANDBOX_STORE, SANDBOX_MAX_AGE_MS
});

