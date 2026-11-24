/*
 * IsoPlayground — command parser and command execution.
 *
 * Menyediakan perintah /player, /object, /enemy, dan cycle. Tampilan command
 * console serta pembacaan sprite cycle ditangani modul khusus.
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

export function spawnEnemyNpcs(count) {
  const half = IPState.world.size / 2;
  const min = -half + 0.5, max = half - 0.5;
  let spawned = 0, attempts = 0;
  // Di Sandbox, enemy baru tidak merebut kontrol dari objek yang sedang dimainkan.
  const keepControl = isSandboxMode() && IPState.editor.activeObjectId !== null;
  while (spawned < count && attempts < count * 100) {
    attempts++;
    const u = Math.floor(Math.random() * IPState.world.size) - half + 0.5;
    const v = Math.floor(Math.random() * IPState.world.size) - half + 0.5;
    if (u < min || u > max || v < min || v > max) continue;
    const occupied = IPState.world.cubes.some(object =>
      object.h === 0 && Math.abs(object.u - u) < 0.95 && Math.abs(object.v - v) < 0.95
    );
    if (occupied) continue;
    const id = IPState.world.nextObjectId++;
    let name = 'Enemy ' + id;
    while (!isNameUnique(name, -1)) name = 'Enemy ' + (IPState.world.nextObjectId++);
    const npc = { id, name, role: 'NPC', collision: true, u, v, h: 0, vx: 0, vz: 0, changeTimer: 0 };
    applyRoleDefaults(npc, 'NPC');
    npc.enemy = true;
    npcDefaults(npc);
    initNpcMotion(npc);
    IPState.world.cubes.push(npc);
    if (!keepControl) IPState.editor.activeObjectId = id;
    spawned++;
  }
  updateLabels();
  if (IPState.editor.activeObjectId !== null) syncObjectPanel();
  d();
  return spawned;
}

export function executeCommandLine(raw) {
  const command = String(raw || '').trim();
  if (!command || command === '/') return;
  const parts = command.split(/\s+/);
if (parts[0].toLowerCase() === '/battle') {
  if (parts.length > 1) {
    setCommandOutput('Gunakan /battle tanpa argumen.');
    return;
  }

  setCommandOutput('Command /battle dikenali. Fungsi battle belum tersedia.');
  return;
}
  if (parts[0].toLowerCase() === '/enemy') {
    if (parts.length > 2 || (parts[1] && !/^[1-9]$/.test(parts[1]))) {
      setCommandOutput('Gunakan /enemy atau /enemy [1-9].');
      return;
    }
    const count = parts[1] ? Number(parts[1]) : 1;
    const spawned = spawnEnemyNpcs(count);
    setCommandOutput(spawned === count
      ? spawned + ' enemy berhasil dibuat di koordinat acak.'
      : spawned + ' dari ' + count + ' enemy dibuat. Area mungkin penuh.');
    return;
  }

  const spawnName = parts[0].toLowerCase();
  if (spawnName === '/player' || spawnName === '/object') {
    if (parts.length > 1) { setCommandOutput('Gunakan ' + spawnName + ' tanpa argumen.'); return; }
    const spawnRole = spawnName === '/player' ? 'Player' : 'default';
    if (spawnRole === 'Player') {
      const existingPlayer = IPState.world.cubes.find(object => object.role === 'Player');
      if (existingPlayer) {
        setCommandOutput('Player sudah ada: "' + existingPlayer.name + '". Hanya satu Player yang diizinkan.');
        return;
      }
    }
    const cell = findSpawnCell();
    if (!cell) { setCommandOutput('Tidak ada petak kosong di plane.'); return; }
    const keepControl = isSandboxMode() && IPState.editor.activeObjectId !== null;
    const created = createObjectAtCell(cell.cellU, cell.cellV, spawnRole, !keepControl);
    setCommandOutput((spawnRole === 'Player' ? 'Player' : 'Object') + ' "' + created.name + '" dibuat di (' +
      formatCoord(created.u) + ', ' + formatCoord(created.v) + ').' +
      (spawnRole === 'Player' && IPState.editor.activeObjectId === created.id
        ? ' Tekan Esc, lalu gerakkan dengan WASD.' : ''));
    return;
  }

  const cycleMatch = command.replace(/^\/+/, '').match(/^cycle\s+-(idle|run|attack)$/i);
  if (cycleMatch) {
    const targetObject = IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId);
    if (!targetObject) { setCommandOutput('Pilih objek terlebih dahulu.'); return; }
    const stateKey = cycleMatch[1].toLowerCase();
    IPState.editor.pendingCycleState = stateKey === 'idle' ? 'Idle' : stateKey === 'run' ? 'Run' : 'Attack';
    const picker = document.getElementById('cycle-files-input');
    if (picker) { picker.value = ''; picker.click(); }
    setCommandOutput('Pilih file ' + stateKey + ' dengan format direction-number.ext.');
    return;
  }
  setCommandOutput('Perintah tidak dikenal. Gunakan /player, /object, /enemy, /enemy [1-9], cycle -idle, cycle -run, atau cycle -attack.');
}

export function installCommandHandlers() {
  installCommandConsoleButton();
  installSpriteCycleImporter();
}

