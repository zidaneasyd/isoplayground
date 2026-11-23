/*
 * IsoPlayground — batch sprite cycle importer.
 *
 * Memvalidasi nama file arah-frame, membaca gambar menjadi data URL, lalu
 * menempatkan record ke animasi objek aktif. Parser command console tidak
 * dicampur dengan proses pembacaan file asynchronous ini.
 */
import { IPState } from '../core/state.js';
import { ensureObjectStateFrames, compareFilenamesAscending } from '../rendering/sprites.js';
import { createSpriteRecord } from '../rendering/spriteAssets.js';
import { syncSpritePanel } from './spriteInspector.js';
import { d } from '../rendering/renderer.js';
import { setCommandOutput } from './commandConsole.js';

export function parseCycleFilename(filename) {
  const match = String(filename).match(/^(front|frontright|right|rightback|back|backleft|left|leftfront)-(\d+)\.(png|jpe?g|gif|webp|svg)$/i);
  if (!match) return null;
  return { direction: match[1].toLowerCase(), frame: Number(match[2]) };
}

export function handleCycleFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  const targetObject = IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId);
  if (!targetObject) {
    setCommandOutput('Pilih objek terlebih dahulu sebelum menjalankan cycle.');
    return;
  }

  const state = IPState.editor.pendingCycleState || 'Idle';
  IPState.editor.pendingCycleState = null;
  const grouped = new Map(), rejected = [];
  for (const file of files) {
    const parsed = parseCycleFilename(file.name);
    if (!parsed) { rejected.push(file.name); continue; }
    if (!grouped.has(parsed.direction)) grouped.set(parsed.direction, []);
    grouped.get(parsed.direction).push({ file, parsed });
  }
  if (!grouped.size) {
    setCommandOutput('Tidak ada file valid. Gunakan format right-01.png (direction-number.ext).');
    return;
  }
  for (const entries of grouped.values()) {
    entries.sort((a, b) => a.parsed.frame - b.parsed.frame || compareFilenamesAscending(a.file.name, b.file.name));
  }

  const recordsByDirection = new Map();
  const jobs = [];
  for (const [direction, entries] of grouped) {
    recordsByDirection.set(direction, new Array(entries.length));
    entries.forEach((entry, index) => jobs.push({ file: entry.file, direction, index }));
  }
  let remaining = jobs.length, loaded = 0;
  const failed = [];
  const finishJob = () => {
    if (--remaining !== 0) return;
    const objectFrames = ensureObjectStateFrames(targetObject);
    const appliedCounts = [];
    for (const [direction, records] of recordsByDirection) {
      const clean = records.filter(Boolean);
      if (!clean.length) continue;
      objectFrames[state][direction] = clean;
      appliedCounts.push([direction, clean.length]);
    }
    const notes = (rejected.length ? '\nFile dilewati: ' + rejected.join(', ') : '') +
      (failed.length ? '\nGagal dibaca: ' + failed.join(', ') : '');
    if (loaded > 0) {
      targetObject.panelAnimState = state;
      targetObject.panelPreviewDir = appliedCounts[0][0];
      IPState.sprites.previewStartTime = performance.now();
      syncSpritePanel();
      d();
      const summary = appliedCounts.map(([direction, amount]) => direction + ': ' + amount).join(', ');
      setCommandOutput(loaded + ' frame diterapkan ke ' + targetObject.name + '. ' + summary + notes);
    } else {
      setCommandOutput('Gagal membaca semua file. Periksa file gambar yang dipilih.' + notes);
    }
  };

  jobs.forEach(job => {
    const reader = new FileReader();
    let settled = false;
    const settle = callback => {
      if (settled) return;
      settled = true;
      callback();
      finishJob();
    };
    reader.onload = () => settle(() => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) {
        recordsByDirection.get(job.direction)[job.index] = createSpriteRecord(dataUrl, 0, 0, job.file.name);
        loaded++;
      } else failed.push(job.file.name);
    });
    reader.onerror = reader.onabort = () => settle(() => { failed.push(job.file.name); });
    reader.readAsDataURL(job.file);
  });
}

export function installSpriteCycleImporter() {
  document.getElementById('cycle-files-input')?.addEventListener('change', handleCycleFilesSelected);
}
