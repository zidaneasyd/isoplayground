/*
 * IsoPlayground — JSON project file adapter.
 *
 * projectIO.js menangani serialisasi dan parsing; projectRuntimeAdapter.js
 * menerapkan hasil parsing ke runtime. Modul ini hanya mengurus dialog file,
 * download JSON, dan FileReader.
 */
import { IPState } from '../core/state.js';
import { buildProjectPayload } from './projectIO.js';
import { applyImportedJSON } from './projectRuntimeAdapter.js';

export async function exportProjectJSON() {
  const payload = buildProjectPayload();
  const activeObject = IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId);
  const defaultBaseName = (activeObject && activeObject.name ? activeObject.name : 'Iso-Playground')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-') || 'Iso-Playground';
  const suggestedFilename = defaultBaseName + '.json';

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedFilename,
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
      });
      const chosenName = (handle.name || suggestedFilename).replace(/\.json$/i, '');
      payload.projectName = chosenName;
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }

  payload.projectName = defaultBaseName;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = suggestedFilename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importProjectJSON() {
  const input = document.getElementById('json-file-input');
  if (!input) return;
  input.value = '';
  input.click();
}

export function handleJSONFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyImportedJSON(String(reader.result || ''));
    } catch (error) {
      alert('File JSON tidak valid: ' + (error && error.message ? error.message : error));
    }
  };
  reader.onerror = reader.onabort = () => alert('Gagal membaca file JSON. Coba pilih ulang file-nya.');
  reader.readAsText(file);
}
