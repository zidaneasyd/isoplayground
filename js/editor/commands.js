/*
 * IsoPlayground — command parser and command execution.
 *
 * Menyediakan perintah:
 * /player
 * /object
 * /enemy
 * /enemy [1-9]
 * /battle
 * cycle -idle
 * cycle -run
 * cycle -attack
 *
 * Command console dan sprite cycle importer tetap ditangani
 * oleh modul masing-masing.
 */

import { IPState, isSandboxMode } from '../core/state.js';
import {
  applyRoleDefaults,
  npcDefaults,
  initNpcMotion
} from '../world/roles.js';

import {
  isNameUnique,
  findSpawnCell
} from '../world/objectQueries.js';

import {
  createObjectAtCell,
  updateLabels
} from './objectEditor.js';

import {
  formatCoord,
  syncObjectPanel
} from './inspector.js';

import { d } from '../rendering/renderer.js';

import {
  setCommandOutput,
  toggleCommandConsole,
  installCommandConsoleButton
} from './commandConsole.js';

import {
  handleCycleFilesSelected,
  installSpriteCycleImporter
} from './spriteCycleImporter.js';


// ============================================================
// EXPORT COMMAND CONSOLE
// ============================================================

export {
  setCommandOutput,
  toggleCommandConsole,
  handleCycleFilesSelected
};


// ============================================================
// HELPER: SPAWN ENEMY NPC
// ============================================================

/**
 * Membuat NPC Enemy pada posisi acak di plane.
 *
 * @param {number} count Jumlah NPC yang akan dibuat.
 * @returns {number} Jumlah NPC yang berhasil dibuat.
 */
export function spawnEnemyNpcs(count = 1) {

  const half = IPState.world.size / 2;

  const min = -half + 0.5;
  const max = half - 0.5;

  let spawned = 0;
  let attempts = 0;

  // Sandbox tidak boleh mengambil alih kontrol
  // objek yang sedang digunakan.
  const keepControl =
    isSandboxMode() &&
    IPState.editor.activeObjectId !== null;

  while (spawned < count && attempts < count * 100) {

    attempts++;

    // Posisi acak di dalam plane.
    const u =
      Math.floor(Math.random() * IPState.world.size)
      - half
      + 0.5;

    const v =
      Math.floor(Math.random() * IPState.world.size)
      - half
      + 0.5;

    // Pastikan koordinat masih berada di dalam plane.
    if (
      u < min ||
      u > max ||
      v < min ||
      v > max
    ) {
      continue;
    }

    // Periksa apakah petak sudah ditempati.
    const occupied = IPState.world.cubes.some(object => {

      return (
        Number(object.h ?? 0) === 0 &&
        Math.abs(object.u - u) < 0.95 &&
        Math.abs(object.v - v) < 0.95
      );

    });

    if (occupied) continue;


    // --------------------------------------------------------
    // ID OBJECT
    // --------------------------------------------------------

    const id = IPState.world.nextObjectId++;


    // --------------------------------------------------------
    // NAMA OBJECT
    // --------------------------------------------------------

    let name = 'Enemy ' + id;

    while (!isNameUnique(name, -1)) {

      name = 'Enemy ' + IPState.world.nextObjectId++;

    }


    // --------------------------------------------------------
    // DATA NPC
    // --------------------------------------------------------

    const npc = {

      id,

      name,

      role: 'NPC',

      collision: true,

      u,
      v,

      h: 0,

      vx: 0,
      vz: 0,

      changeTimer: 0

    };


    // --------------------------------------------------------
    // DEFAULT NPC
    // --------------------------------------------------------

    applyRoleDefaults(npc, 'NPC');

    npc.enemy = true;

    npcDefaults(npc);

    initNpcMotion(npc);


    // --------------------------------------------------------
    // MASUKKAN NPC KE WORLD
    // --------------------------------------------------------

    IPState.world.cubes.push(npc);


    // --------------------------------------------------------
    // SELECTION
    // --------------------------------------------------------

    if (!keepControl) {

      IPState.editor.activeObjectId = id;

    }


    spawned++;

  }


  // ----------------------------------------------------------
  // REFRESH UI
  // ----------------------------------------------------------

  updateLabels();

  if (IPState.editor.activeObjectId !== null) {

    syncObjectPanel();

  }

  d();


  return spawned;

}



// ============================================================
// COMMAND: /BATTLE
// ============================================================

/**
 * Membuat satu Player dan satu NPC Enemy.
 *
 * Ketentuan:
 * - Player hanya dibuat jika belum ada.
 * - Enemy hanya dibuat jika belum ada NPC Enemy.
 * - Posisi spawn tidak boleh sama.
 * - Posisi berada di dalam plane.
 * - Enemy diprioritaskan dekat Player.
 * - Player menjadi objek aktif setelah battle dibuat.
 */
export function spawnBattle() {

  let stage = 'persiapan';

  try {

    const cubes = IPState.world.cubes;

    const half = IPState.world.size / 2;


    // ========================================================
    // 1. CARI PLAYER DAN ENEMY YANG SUDAH ADA
    // ========================================================

    const existingPlayer = cubes.find(object => {

      return object.role === 'Player';

    }) || null;


    const existingEnemy = cubes.find(object => {

      return (
        object.role === 'NPC' &&
        object.enemy === true
      );

    }) || null;


    // ========================================================
    // 2. KUMPULKAN PETAK KOSONG
    // ========================================================

    stage = 'mencari posisi';

    const availableCells = [];


    for (
      let cellU = -half;
      cellU < half;
      cellU++
    ) {

      for (
        let cellV = -half;
        cellV < half;
        cellV++
      ) {

        const u = cellU + 0.5;
        const v = cellV + 0.5;


        // Petak dianggap occupied jika ada objek
        // pada ketinggian ground.
        const occupied = cubes.some(object => {

          return (
            Number(object.h ?? 0) === 0 &&
            Math.abs(object.u - u) < 0.9999 &&
            Math.abs(object.v - v) < 0.9999
          );

        });


        if (!occupied) {

          availableCells.push({
            cellU,
            cellV
          });

        }

      }

    }


    // ========================================================
    // 3. PILIH POSISI PLAYER
    // ========================================================

    let playerCell = null;


    if (!existingPlayer) {

      if (availableCells.length === 0) {

        throw new Error(
          'Tidak tersedia petak untuk Player.'
        );

      }


      const index = Math.floor(
        Math.random() * availableCells.length
      );


      // Ambil dan hapus petak dari daftar.
      // Agar tidak dapat dipakai Enemy.
      playerCell = availableCells.splice(index, 1)[0];

    }



    // ========================================================
    // 4. PILIH POSISI ENEMY
    // ========================================================

    let enemyCell = null;


    if (!existingEnemy) {

      if (availableCells.length === 0) {

        throw new Error(
          'Tidak tersedia petak untuk NPC Enemy.'
        );

      }


      // Tentukan titik referensi Player.
      const anchor = existingPlayer

        ? {
            u: existingPlayer.u,
            v: existingPlayer.v
          }

        : {
            u: playerCell.cellU + 0.5,
            v: playerCell.cellV + 0.5
          };


      // Cari petak kosong yang dekat dengan Player.
      const nearbyCells = availableCells.filter(cell => {

        const u = cell.cellU + 0.5;
        const v = cell.cellV + 0.5;


        const distance = Math.hypot(
          u - anchor.u,
          v - anchor.v
        );


        return distance <= 3;

      });


      // Kalau tidak ada petak dekat,
      // gunakan semua petak yang tersedia.
      const pool = nearbyCells.length > 0

        ? nearbyCells

        : availableCells;


      const index = Math.floor(
        Math.random() * pool.length
      );


      enemyCell = pool[index];

    }



    // ========================================================
    // 5. SIAPKAN ID OBJECT
    // ========================================================

    stage = 'menyiapkan ID objek';


    const usedIds = new Set(

      cubes.map(object => String(object.id))

    );


    let nextId = Number(
      IPState.world.nextObjectId
    );


    if (
      !Number.isSafeInteger(nextId) ||
      nextId < 1
    ) {

      nextId = 1;

    }


    /**
     * Membuat ID yang belum digunakan.
     */
    function allocateId() {

      while (usedIds.has(String(nextId))) {

        nextId++;

      }


      const id = nextId++;

      usedIds.add(String(id));


      return id;

    }



    // ========================================================
    // 6. SIAPKAN NAMA OBJECT
    // ========================================================

    const usedNames = new Set(

      cubes.map(object => {

        return String(object.name ?? '')
          .trim()
          .toLowerCase();

      })

    );


    /**
     * Membuat nama unik.
     */
    function uniqueName(base) {

      let name = base;

      let suffix = 2;


      while (
        usedNames.has(name.toLowerCase())
      ) {

        name = base + ' (' + suffix + ')';

        suffix++;

      }


      usedNames.add(name.toLowerCase());


      return name;

    }



    // ========================================================
    // 7. HELPER MEMBUAT COMBATANT
    // ========================================================

    /**
     * Membuat data dasar Player atau NPC Enemy.
     *
     * Data role dan combat diatur menggunakan
     * applyRoleDefaults().
     */
    function makeCombatant(role, u, v) {

      const isPlayer = role === 'Player';

      const id = allocateId();


      const object = {

        id,

        name: uniqueName(
          isPlayer
            ? 'Player ' + id
            : 'Enemy ' + id
        ),

        role,

        collision: true,

        u,
        v,

        h: 0,

        vx: 0,
        vz: 0,

        changeTimer: 0

      };


      // ------------------------------------------------------
      // ROLE DEFAULTS
      // ------------------------------------------------------

      applyRoleDefaults(object, role);


      // ------------------------------------------------------
      // PLAYER
      // ------------------------------------------------------

      if (isPlayer) {

        object.enemy = false;

      }


      // ------------------------------------------------------
      // NPC ENEMY
      // ------------------------------------------------------

      if (!isPlayer) {

        object.enemy = true;

        object.roaming = true;

        object.homeU = u;
        object.homeV = v;

        npcDefaults(object);

        initNpcMotion(object);

      }


      return object;

    }



    // ========================================================
    // 8. BUAT OBJECT
    // ========================================================

    stage = 'membuat objek';


    const newObjects = [];


    let player = existingPlayer;

    let enemy = existingEnemy;



    // --------------------------------------------------------
    // PLAYER
    // --------------------------------------------------------

    if (!player) {

      player = makeCombatant(

        'Player',

        playerCell.cellU + 0.5,

        playerCell.cellV + 0.5

      );


      newObjects.push(player);

    }



    // --------------------------------------------------------
    // ENEMY
    // --------------------------------------------------------

    if (!enemy) {

      enemy = makeCombatant(

        'NPC',

        enemyCell.cellU + 0.5,

        enemyCell.cellV + 0.5

      );


      newObjects.push(enemy);

    }



    // ========================================================
    // 9. MASUKKAN OBJECT KE WORLD
    // ========================================================

    stage = 'memasukkan objek ke World';


    if (newObjects.length > 0) {

      // Masukkan sekaligus.
      cubes.push(...newObjects);


      // Simpan ID berikutnya.
      IPState.world.nextObjectId = nextId;

    }



    // ========================================================
    // 10. AKTIFKAN PLAYER
    // ========================================================

    IPState.editor.activeObjectId = player.id;



    // ========================================================
    // 11. VERIFIKASI HASIL
    // ========================================================

    const verifiedPlayer = cubes.some(object => {

      return object.role === 'Player';

    });


    const verifiedEnemy = cubes.some(object => {

      return (
        object.role === 'NPC' &&
        object.enemy === true
      );

    });


    if (
      !verifiedPlayer ||
      !verifiedEnemy
    ) {

      throw new Error(

        'Verifikasi gagal: ' +

        'Player=' + verifiedPlayer +

        ', Enemy=' + verifiedEnemy

      );

    }



    // ========================================================
    // 12. REFRESH UI
    // ========================================================

    stage = 'memperbarui daftar objek';


    updateLabels();

    syncObjectPanel();



    // ========================================================
    // 13. RENDER CANVAS
    // ========================================================

    stage = 'menggambar Canvas';


    d();



    // ========================================================
    // 14. OUTPUT
    // ========================================================

    const playerCount = cubes.filter(object => {

      return object.role === 'Player';

    }).length;


    const enemyCount = cubes.filter(object => {

      return (
        object.role === 'NPC' &&
        object.enemy === true
      );

    }).length;


    setCommandOutput(

      'Battle siap! ' +

      'Player: ' + playerCount +

      ' | Enemy NPC: ' + enemyCount +

      ' | Total objek: ' + cubes.length

    );


  } catch (error) {

    console.error(
      '[IsoPlayground Battle Error]',
      error
    );


    setCommandOutput(

      'Battle gagal pada tahap "' +

      stage +

      '": ' +

      (error.message || error)

    );

  }

}



// ============================================================
// COMMAND DISPATCHER
// ============================================================

/**
 * Menjalankan perintah dari command console.
 *
 * Semua command diproses melalui fungsi ini.
 *
 * @param {string} command
 */
export function executeCommandLine(command) {

  // ==========================================================
  // 1. NORMALISASI INPUT
  // ==========================================================

  if (
    typeof command !== 'string' ||
    !command.trim()
  ) {

    setCommandOutput(
      'Masukkan perintah terlebih dahulu.'
    );

    return;

  }


  const normalizedCommand = command.trim();


  // Pecah input menjadi beberapa bagian.
  const parts = normalizedCommand.split(/\s+/);


  // Nama command selalu lowercase.
  const commandName = parts[0].toLowerCase();



  // ==========================================================
  // COMMAND: /BATTLE
  // ==========================================================

  if (commandName === '/battle') {

    if (parts.length > 1) {

      setCommandOutput(
        'Gunakan /battle tanpa argumen.'
      );

      return;

    }


    spawnBattle();


    return;

  }



  // ==========================================================
  // COMMAND: /ENEMY
  // ==========================================================

  if (commandName === '/enemy') {

    // Validasi jumlah enemy.
    if (

      parts.length > 2 ||

      (
        parts[1] &&
        !/^[1-9]$/.test(parts[1])
      )

    ) {

      setCommandOutput(
        'Gunakan /enemy atau /enemy [1-9].'
      );

      return;

    }


    const count = parts[1]

      ? Number(parts[1])

      : 1;


    // Spawn enemy.
    const spawned = spawnEnemyNpcs(count);


    // Output.
    setCommandOutput(

      spawned === count

        ? spawned +
          ' enemy berhasil dibuat di koordinat acak.'

        : spawned +
          ' dari ' +
          count +
          ' enemy dibuat. Area mungkin penuh.'

    );


    return;

  }



  // ==========================================================
  // COMMAND: /PLAYER DAN /OBJECT
  // ==========================================================

  if (

    commandName === '/player' ||

    commandName === '/object'

  ) {


    // --------------------------------------------------------
    // VALIDASI ARGUMEN
    // --------------------------------------------------------

    if (parts.length > 1) {

      setCommandOutput(

        'Gunakan ' +

        commandName +

        ' tanpa argumen.'

      );

      return;

    }



    // --------------------------------------------------------
    // TENTUKAN ROLE
    // --------------------------------------------------------

    const spawnRole =

      commandName === '/player'

        ? 'Player'

        : 'default';



    // --------------------------------------------------------
    // CEK PLAYER EXISTING
    // --------------------------------------------------------

    if (spawnRole === 'Player') {

      const existingPlayer =
        IPState.world.cubes.find(object => {

          return object.role === 'Player';

        });


      if (existingPlayer) {

        setCommandOutput(

          'Player sudah ada: "' +

          existingPlayer.name +

          '". Hanya satu Player yang diizinkan.'

        );

        return;

      }

    }



    // --------------------------------------------------------
    // CARI PETAK KOSONG
    // --------------------------------------------------------

    const cell = findSpawnCell();


    if (!cell) {

      setCommandOutput(
        'Tidak ada petak kosong di plane.'
      );

      return;

    }



    // --------------------------------------------------------
    // SANDBOX CONTROL
    // --------------------------------------------------------

    const keepControl =

      isSandboxMode() &&

      IPState.editor.activeObjectId !== null;



    // --------------------------------------------------------
    // BUAT OBJECT
    // --------------------------------------------------------

    const created = createObjectAtCell(

      cell.cellU,

      cell.cellV,

      spawnRole,

      !keepControl

    );



    // --------------------------------------------------------
    // OUTPUT
    // --------------------------------------------------------

    setCommandOutput(

      (

        spawnRole === 'Player'

          ? 'Player'

          : 'Object'

      ) +

      ' "' +

      created.name +

      '" dibuat di (' +

      formatCoord(created.u) +

      ', ' +

      formatCoord(created.v) +

      ').' +

      (

        spawnRole === 'Player' &&

        IPState.editor.activeObjectId === created.id

          ? ' Tekan Esc, lalu gerakkan dengan WASD.'

          : ''

      )

    );


    return;

  }



  // ==========================================================
  // COMMAND: CYCLE -IDLE / -RUN / -ATTACK
  // ==========================================================

  // Mendukung:
  // cycle -idle
  // /cycle -idle
  // cycle -run
  // /cycle -run
  // cycle -attack
  // /cycle -attack

  const cycleMatch = normalizedCommand

    .replace(/^\/+/, '')

    .match(
      /^cycle\s+-(idle|run|attack)$/i
    );


  if (cycleMatch) {


    // --------------------------------------------------------
    // CARI OBJECT AKTIF
    // --------------------------------------------------------

    const targetObject =
      IPState.world.cubes.find(object => {

        return (
          object.id ===
          IPState.editor.activeObjectId
        );

      });


    if (!targetObject) {

      setCommandOutput(
        'Pilih objek terlebih dahulu.'
      );

      return;

    }



    // --------------------------------------------------------
    // SIMPAN STATE YANG DIPILIH
    // --------------------------------------------------------

    const stateKey =
      cycleMatch[1].toLowerCase();


    IPState.editor.pendingCycleState =

      stateKey === 'idle'

        ? 'Idle'

        : stateKey === 'run'

          ? 'Run'

          : 'Attack';



    // --------------------------------------------------------
    // BUKA FILE PICKER
    // --------------------------------------------------------

    const picker = document.getElementById(
      'cycle-files-input'
    );


    if (picker) {

      picker.value = '';

      picker.click();

    }



    // --------------------------------------------------------
    // OUTPUT
    // --------------------------------------------------------

    setCommandOutput(

      'Pilih file ' +

      stateKey +

      ' dengan format direction-number.ext.'

    );


    return;

  }



  // ==========================================================
  // COMMAND TIDAK DIKENALI
  // ==========================================================

  setCommandOutput(

    'Perintah tidak dikenal. Gunakan ' +

    '/player, /object, /enemy, /enemy [1-9], ' +

    '/battle, cycle -idle, cycle -run, ' +

    'atau cycle -attack.'

  );

}



// ============================================================
// INSTALL COMMAND HANDLERS
// ============================================================

/**
 * Memasang handler command console
 * dan sprite cycle importer.
 */
export function installCommandHandlers() {

  installCommandConsoleButton();

  installSpriteCycleImporter();

}
