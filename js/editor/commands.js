
/*
 * IsoPlayground — command parser and command execution.
 *
 * Menyediakan perintah /player, /object, /enemy, /battle, dan cycle.
 * Tampilan command console serta pembacaan sprite cycle ditangani modul khusus.
 */

import { IPState, isSandboxMode } from '../core/state.js';
import { applyRoleDefaults, npcDefaults, initNpcMotion } from '../world/roles.js';
import { isNameUnique, findSpawnCell } from '../world/objectQueries.js';
import { createObjectAtCell, updateLabels } from './objectEditor.js';
import { formatCoord, syncObjectPanel } from './inspector.js';
import { d } from '../rendering/renderer.js';
import { setCommandOutput, toggleCommandConsole, installCommandConsoleButton } from './commandConsole.js';
import { handleCycleFilesSelected, installSpriteCycleImporter } from './spriteCycleImporter.js';

export { setCommandOutput, toggleCommandConsole, handleCycleFilesSelected };


/**
 * Membuat NPC enemy pada posisi acak di plane.
 * Posisi yang sudah ditempati objek lain akan dilewati.
 */
export function spawnEnemyNpcs(count) {
  const half = IPState.world.size / 2;
  const min = -half + 0.5;
  const max = half - 0.5;

  let spawned = 0;
  let attempts = 0;

  // Di Sandbox, enemy baru tidak merebut kontrol objek yang sedang dimainkan.
  const keepControl =
    isSandboxMode() && IPState.editor.activeObjectId !== null;

  while (spawned < count && attempts < count * 100) {
    attempts++;

    const u =
      Math.floor(Math.random() * IPState.world.size) - half + 0.5;

    const v =
      Math.floor(Math.random() * IPState.world.size) - half + 0.5;

    // Pastikan koordinat berada di dalam plane.
    if (u < min || u > max || v < min || v > max) continue;

    // Cek apakah petak sudah ditempati objek lain.
    const occupied = IPState.world.cubes.some(object =>
      object.h === 0 &&
      Math.abs(object.u - u) < 0.95 &&
      Math.abs(object.v - v) < 0.95
    );

    if (occupied) continue;

    // Buat ID dan nama enemy.
    const id = IPState.world.nextObjectId++;

    let name = 'Enemy ' + id;

    while (!isNameUnique(name, -1)) {
      name = 'Enemy ' + IPState.world.nextObjectId++;
    }

    // Buat objek NPC.
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

    // Terapkan statistik dan perilaku NPC.
    applyRoleDefaults(npc, 'NPC');
    npc.enemy = true;
    npcDefaults(npc);
    initNpcMotion(npc);

    // Masukkan enemy ke world.
    IPState.world.cubes.push(npc);

    if (!keepControl) {
      IPState.editor.activeObjectId = id;
    }

    spawned++;
  }

  updateLabels();

  if (IPState.editor.activeObjectId !== null) {
    syncObjectPanel();
  }

  d();

  return spawned;
}


/**
 * Memulai battle:
 * Spawn satu Player dan satu Enemy secara acak.
 *
 * Kedua spawn menggunakan daftar petak kosong yang sama,
 * sehingga posisi Player dan Enemy dijamin berbeda.
 */


export function spawnBattle() {
  let stage = 'persiapan';

  try {
    const cubes = IPState.world.cubes;
    const half = IPState.world.size / 2;

    // Cari Player dan Enemy yang sudah ada.
    const existingPlayer = cubes.find(
      object => object.role === 'Player'
    ) || null;

    const existingEnemy = cubes.find(
      object => object.role === 'NPC' && object.enemy === true
    ) || null;

    // Kumpulkan petak kosong.
    stage = 'mencari posisi';

    const availableCells = [];

    for (let cellU = -half; cellU < half; cellU++) {
      for (let cellV = -half; cellV < half; cellV++) {
        const u = cellU + 0.5;
        const v = cellV + 0.5;

        const occupied = cubes.some(object =>
          Number(object.h ?? 0) === 0 &&
          Math.abs(object.u - u) < 0.9999 &&
          Math.abs(object.v - v) < 0.9999
        );

        if (!occupied) {
          availableCells.push({ cellU, cellV });
        }
      }
    }

    // Pilih posisi Player jika belum ada.
    let playerCell = null;

    if (!existingPlayer) {
      if (availableCells.length === 0) {
        throw new Error('Tidak tersedia petak untuk Player.');
      }

      const index = Math.floor(
        Math.random() * availableCells.length
      );

      playerCell = availableCells.splice(index, 1)[0];
    }

    // Pilih posisi Enemy jika belum ada.
    let enemyCell = null;

    if (!existingEnemy) {
      if (availableCells.length === 0) {
        throw new Error('Tidak tersedia petak untuk NPC Enemy.');
      }

      const anchor = existingPlayer
        ? { u: existingPlayer.u, v: existingPlayer.v }
        : {
            u: playerCell.cellU + 0.5,
            v: playerCell.cellV + 0.5
          };

      // Prioritaskan posisi yang dekat dengan Player.
      const nearbyCells = availableCells.filter(cell => {
        const u = cell.cellU + 0.5;
        const v = cell.cellV + 0.5;

        return Math.hypot(u - anchor.u, v - anchor.v) <= 3;
      });

      const pool = nearbyCells.length > 0
        ? nearbyCells
        : availableCells;

      const index = Math.floor(Math.random() * pool.length);
      enemyCell = pool[index];
    }

    // Siapkan ID unik.
    stage = 'menyiapkan ID objek';

    const usedIds = new Set(
      cubes.map(object => String(object.id))
    );

    let nextId = Number(IPState.world.nextObjectId);

    if (!Number.isSafeInteger(nextId) || nextId < 1) {
      nextId = 1;
    }

    function allocateId() {
      while (usedIds.has(String(nextId))) {
        nextId++;
      }

      const id = nextId++;
      usedIds.add(String(id));

      return id;
    }

    // Siapkan nama unik.
    const usedNames = new Set(
      cubes.map(object =>
        String(object.name ?? '').trim().toLowerCase()
      )
    );

    function uniqueName(base) {
      let name = base;
      let suffix = 2;

      while (usedNames.has(name.toLowerCase())) {
        name = base + ' (' + suffix + ')';
        suffix++;
      }

      usedNames.add(name.toLowerCase());
      return name;
    }

    // Buat data combatant tanpa efek samping editor.
    function makeCombatant(role, u, v) {
      const isPlayer = role === 'Player';
      const id = allocateId();

      return {
        id,
        name: uniqueName(
          isPlayer ? 'Player ' + id : 'Enemy ' + id
        ),

        role,
        collision: true,

        u,
        v,
        h: 0,

        vx: 0,
        vz: 0,
        changeTimer: 0,

        speed: 2,
        runSpeed: 6,

        hitArea: 1.5,
        attackArea: 1.5,
        detectionArea: 3,

        maxHp: isPlayer ? 300 : 100,
        hp: isPlayer ? 300 : 100,

        damage: isPlayer ? 20 : 10,
        attackInterval: isPlayer ? 0.5 : 1,
        attackCooldown: 0,

        enemy: !isPlayer,
        roaming: true,

        homeU: u,
        homeV: v
      };
    }

    // Siapkan semua objek sebelum memasukkannya ke World.
    stage = 'membuat objek';

    const newObjects = [];

    let player = existingPlayer;
    let enemy = existingEnemy;

    if (!player) {
      player = makeCombatant(
        'Player',
        playerCell.cellU + 0.5,
        playerCell.cellV + 0.5
      );

      newObjects.push(player);
    }

    if (!enemy) {
      enemy = makeCombatant(
        'NPC',
        enemyCell.cellU + 0.5,
        enemyCell.cellV + 0.5
      );

      newObjects.push(enemy);
    }

    // Masukkan objek sekaligus.
    stage = 'memasukkan objek ke World';

    if (newObjects.length > 0) {
      cubes.push(...newObjects);
      IPState.world.nextObjectId = nextId;
    }

    // Pastikan Player menjadi objek aktif.
    IPState.editor.activeObjectId = player.id;

    // Verifikasi hasil spawn dari World State.
    const verifiedPlayer = cubes.some(
      object => object.role === 'Player'
    );

    const verifiedEnemy = cubes.some(
      object => object.role === 'NPC' && object.enemy === true
    );

    if (!verifiedPlayer || !verifiedEnemy) {
      throw new Error(
        'Verifikasi gagal: Player=' + verifiedPlayer +
        ', Enemy=' + verifiedEnemy
      );
    }

    // Perbarui tampilan.
    stage = 'memperbarui daftar objek';

    updateLabels();
    syncObjectPanel();

    stage = 'menggambar Canvas';

    d();

    const playerCount = cubes.filter(
      object => object.role === 'Player'
    ).length;

    const enemyCount = cubes.filter(
      object => object.role === 'NPC' && object.enemy === true
    ).length;

    setCommandOutput(
      'Battle siap! Player: ' + playerCount +
      ' | Enemy NPC: ' + enemyCount +
      ' | Total objek: ' + cubes.length
    );

  } catch (error) {
    console.error('[IsoPlayground Battle Error]', error);

    setCommandOutput(
      'Battle gagal pada tahap "' + stage +
      '": ' + (error.message || error)
    );
  }
}



  // ==========================================
  // COMMAND: /enemy atau /enemy [1-9]
  // ==========================================
  if (commandName === '/enemy') {
    if (
      parts.length > 2 ||
      (parts[1] && !/^[1-9]$/.test(parts[1]))
    ) {
      setCommandOutput('Gunakan /enemy atau /enemy [1-9].');
      return;
    }

    const count = parts[1] ? Number(parts[1]) : 1;

    const spawned = spawnEnemyNpcs(count);

    setCommandOutput(
      spawned === count
        ? spawned + ' enemy berhasil dibuat di koordinat acak.'
        : spawned + ' dari ' + count +
          ' enemy dibuat. Area mungkin penuh.'
    );

    return;
  }


  // ==========================================
  // COMMAND: /player dan /object
  // ==========================================
  const spawnName = commandName;

  if (spawnName === '/player' || spawnName === '/object') {
    if (parts.length > 1) {
      setCommandOutput(
        'Gunakan ' + spawnName + ' tanpa argumen.'
      );
      return;
    }

    const spawnRole =
      spawnName === '/player' ? 'Player' : 'default';

    // Pastikan hanya ada satu Player.
    if (spawnRole === 'Player') {
      const existingPlayer = IPState.world.cubes.find(
        object => object.role === 'Player'
      );

      if (existingPlayer) {
        setCommandOutput(
          'Player sudah ada: "' +
          existingPlayer.name +
          '". Hanya satu Player yang diizinkan.'
        );
        return;
      }
    }

    // Cari petak kosong.
    const cell = findSpawnCell();

    if (!cell) {
      setCommandOutput('Tidak ada petak kosong di plane.');
      return;
    }

    // Di Sandbox, jangan mengambil kontrol objek yang sedang aktif.
    const keepControl =
      isSandboxMode() &&
      IPState.editor.activeObjectId !== null;

    // Buat objek.
    const created = createObjectAtCell(
      cell.cellU,
      cell.cellV,
      spawnRole,
      !keepControl
    );

    setCommandOutput(
      (spawnRole === 'Player' ? 'Player' : 'Object') +
      ' "' + created.name + '" dibuat di (' +
      formatCoord(created.u) + ', ' +
      formatCoord(created.v) + ').' +
      (
        spawnRole === 'Player' &&
        IPState.editor.activeObjectId === created.id
          ? ' Tekan Esc, lalu gerakkan dengan WASD.'
          : ''
      )
    );

    return;
  }


  // ==========================================
  // COMMAND: cycle -idle / -run / -attack
  // ==========================================
  const cycleMatch = command
    .replace(/^\/+/, '')
    .match(/^cycle\s+-(idle|run|attack)$/i);

  if (cycleMatch) {
    const targetObject = IPState.world.cubes.find(
      object => object.id === IPState.editor.activeObjectId
    );

    if (!targetObject) {
      setCommandOutput('Pilih objek terlebih dahulu.');
      return;
    }

    const stateKey = cycleMatch[1].toLowerCase();

    IPState.editor.pendingCycleState =
      stateKey === 'idle'
        ? 'Idle'
        : stateKey === 'run'
          ? 'Run'
          : 'Attack';

    const picker = document.getElementById(
      'cycle-files-input'
    );

    if (picker) {
      picker.value = '';
      picker.click();
    }

    setCommandOutput(
      'Pilih file ' +
      stateKey +
      ' dengan format direction-number.ext.'
    );

    return;
  }


  // ==========================================
  // COMMAND TIDAK DIKENALI
  // ==========================================
  setCommandOutput(
    'Perintah tidak dikenal. Gunakan /player, /object, ' +
    '/enemy, /enemy [1-9], /battle, cycle -idle, ' +
    'cycle -run, atau cycle -attack.'
  );
}


/**
 * Memasang handler command console dan sprite cycle.
 */
export function installCommandHandlers() {
  installCommandConsoleButton();
  installSpriteCycleImporter();
}
