/*
 * IsoPlayground — browser/editor adapter coordinator.
 *
 * File ini sengaja tipis: ia hanya memasang dua adapter host. Perilaku editor
 * berada di editorUI.js, sedangkan Canvas dan event pointer berada di
 * canvasHost.js. Gameplay, renderer, dan aturan world tidak diletakkan di sini.
 */
import { installEditorUIHandlers } from './editorUI.js';
import { installCanvasHost } from './canvasHost.js';

let adaptersInstalled = false;

export function installEngineAdapters() {
  if (adaptersInstalled) return;
  installEditorUIHandlers();
  installCanvasHost();
  adaptersInstalled = true;
}

