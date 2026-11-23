/*
 * IsoPlayground — Sandbox session transfer.
 *
 * Modul ini menangani pengemasan snapshot gameplay, penyimpanan sementara di
 * IndexedDB/sessionStorage, pembukaan tab Sandbox, dan pemulihan sesi. DOM
 * hanya dipakai pada batas browser; data proyek berasal dari projectIO/state.
 */
import { IPState } from '../core/state.js';
import { storeSandboxPayload, takeSandboxPayload } from './sandboxStorage.js';
import { buildProjectPayload } from '../io/projectIO.js';
import { applyImportedJSON } from '../io/projectRuntimeAdapter.js';
import { resetCamera } from '../core/camera.js';
import { syncObjectPanel } from '../editor/inspector.js';
import { updateLabels } from '../editor/objectEditor.js';
import { d } from '../rendering/renderer.js';

export function buildSandboxSessionPayload() {
  const payload = buildProjectPayload();
  const liveObjects = new Map(IPState.world.cubes.map(obj => [obj.id, obj]));
  payload.cubes = payload.cubes.map(saved => {
    const live = liveObjects.get(saved.id);
    if (saved.role === 'NPC') saved.sandboxEnemy = !!(live && live.enemy);
    return saved;
  });
  return payload;
}

export async function openSandbox() {
  const payloadText = JSON.stringify(buildSandboxSessionPayload());
  const url = new URL(location.href);
  url.searchParams.set('sandbox', '1');
  url.searchParams.delete('sid');
  try {
    const sid = 'sb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await storeSandboxPayload(sid, payloadText);
    url.searchParams.set('sid', sid);
  } catch (error) {
    console.warn('Sandbox via IndexedDB gagal, memakai sessionStorage', error);
    try {
      sessionStorage.setItem('iso-sandbox-project', payloadText);
    } catch (storageError) {
      alert('Proyek terlalu besar untuk dibuka di Sandbox.');
      return;
    }
  }
  const openedWindow = window.open(url.href, '_blank');
  if (!openedWindow) {
    alert('Browser memblokir jendela Sandbox. Izinkan pop-up untuk halaman ini, lalu coba lagi.');
  }
}

export async function initSandboxMode() {
  const params = new URLSearchParams(location.search);
  if (params.get('sandbox') !== '1') return;
  // Mode diaktifkan sebelum pemulihan agar render pertama mengikuti aturan gameplay.
  IPState.sandbox.active = true;
  try {
    let payload = null;
    const sid = params.get('sid');
    if (sid) {
      try { payload = await takeSandboxPayload(sid); }
      catch (error) { console.warn('Sandbox IndexedDB read failed', error); }
    }
    if (!payload) {
      try { payload = sessionStorage.getItem('iso-sandbox-project'); }
      catch (error) { /* storage bisa tidak tersedia di mode privat */ }
    }
    if (payload) applyImportedJSON(payload, { sandboxSession: true });
  } catch (error) {
    console.warn('Sandbox project restore failed', error);
  }
  document.body.classList.add('sandbox');
  resetCamera();
  syncObjectPanel();
  updateLabels();
  d();
}

