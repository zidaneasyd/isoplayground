import { objectEditorActions } from './objectEditor.js';
import { editorMenuActions } from './editorMenus.js';
import { inspectorActions } from './inspector.js';
import { spriteInspectorActions } from './spriteInspector.js';
import { spriteFileActions } from './spriteFileAdapter.js';
import {
  commitActiveObjectName, setActiveObjectNameLive,
  setActiveObjectRole, toggleActiveObjectCollision
} from './objectIdentity.js';
import { objectStatsActions } from './objectStats.js';
import { exportProjectJSON, handleJSONFileSelected, importProjectJSON } from '../io/projectFileAdapter.js';
import { exportPNG } from '../io/imageExport.js';
import { openSandbox } from '../sandbox/sandbox.js';
import { resetCamera, setCameraZoomFromSlider, zoomStep } from '../core/camera.js';
import {
  toggleAllObjectRadii, toggleAxisVisibility, toggleFollowObject,
  toggleGridVisibility, toggleLeftPanel, toggleLowerPanelExpand,
  toggleRightPanelExpand
} from './editorUI.js';

/*
 * IsoPlayground — delegated HTML event bridge.
 *
 * HTML deklaratif hanya menyebut nama aksi; daftar eksekusi dipetakan secara
 * eksplisit dari API modul. Tidak ada eval, new Function, atau pencarian fungsi
 * pada global object ketika event dijalankan.
 */
const EVENT_TYPES = Object.freeze([
  'click', 'input', 'change', 'focus', 'mouseenter', 'contextmenu'
]);

export const HTML_EVENT_ACTIONS = Object.freeze({
  ...objectEditorActions,
  ...editorMenuActions,
  ...inspectorActions,
  ...spriteInspectorActions,
  ...spriteFileActions,
  ...objectStatsActions,
  commitActiveObjectName, setActiveObjectNameLive,
  setActiveObjectRole, toggleActiveObjectCollision,
  exportPNG, exportProjectJSON, handleJSONFileSelected, importProjectJSON,
  openSandbox, resetCamera, setCameraZoomFromSlider, zoomStep,
  toggleAllObjectRadii, toggleAxisVisibility, toggleFollowObject,
  toggleGridVisibility, toggleLeftPanel, toggleLowerPanelExpand,
  toggleRightPanelExpand,
  alert: (...args) => window.alert?.(...args)
});

export const HTML_EVENT_ACTION_NAMES = Object.freeze(Object.keys(HTML_EVENT_ACTIONS));

// Event markup hanya dapat memanggil API yang dipetakan secara eksplisit di sini.
// Tidak ada pencarian nama fungsi dari globalThis saat event terjadi.

function splitArguments(source) {
  const args = [];
  let part = '';
  let quote = '';
  let depth = 0;
  let escaped = false;

  for (const character of source) {
    if (escaped) {
      part += character;
      escaped = false;
      continue;
    }
    if (quote && character === '\\') {
      part += character;
      escaped = true;
      continue;
    }
    if (character === quote) {
      quote = '';
      part += character;
      continue;
    }
    if (!quote && (character === '"' || character === "'")) {
      quote = character;
      part += character;
      continue;
    }
    if (!quote && character === '(') depth += 1;
    if (!quote && character === ')') depth -= 1;
    if (!quote && character === ',' && depth === 0) {
      args.push(part.trim());
      part = '';
      continue;
    }
    part += character;
  }
  if (part.trim()) args.push(part.trim());
  return args;
}

function readArgument(token, element, event) {
  if (token === 'event') return event;
  if (token === 'this') return element;
  if (token === 'this.value') return element.value;
  if (/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(token)) return Number(token);
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (token === 'null') return null;
  if (token[0] === '"' && token[token.length - 1] === '"') return JSON.parse(token);
  if (token[0] === "'" && token[token.length - 1] === "'") {
    return token.slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");
  }
  throw new Error(`Argumen event tidak didukung: ${token}`);
}

export function dispatchHtmlEvent(element, event, expression, actions) {
  if (expression === 'this.dataset.previousName=this.value') {
    element.dataset.previousName = element.value;
    return;
  }

  const match = expression.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
  if (!match) throw new Error(`Handler tidak dikenal: ${expression}`);

  const action = actions[match[1]];
  if (typeof action !== 'function') {
    throw new Error(`Aksi UI tidak terdaftar: ${match[1]}`);
  }
  const args = match[2].trim()
    ? splitArguments(match[2]).map(token => readArgument(token, element, event))
    : [];
  return action(...args);
}

export function setupHtmlEventBridge({ root = document, actions } = {}) {
  if (!root || typeof root.addEventListener !== 'function') {
    throw new TypeError('Root event bridge harus mendukung addEventListener().');
  }
  const registeredActions = actions || HTML_EVENT_ACTIONS;
  const listeners = [];

  for (const type of EVENT_TYPES) {
    const listener = event => {
      const element = event.target?.closest?.(`[data-ip-event-${type}]`);
      if (!element) return;
      const expression = element.getAttribute(`data-ip-event-${type}`);
      try {
        dispatchHtmlEvent(element, event, expression, registeredActions);
      } catch (error) {
        console.error('[IsoPlayground event]', error);
      }
    };
    const capture = type === 'focus' || type === 'mouseenter';
    root.addEventListener(type, listener, capture);
    listeners.push([type, listener, capture]);
  }

  // Return cleanup function so the bridge can be safely re-mounted in tests.
  return () => {
    for (const [type, listener, capture] of listeners) {
      root.removeEventListener?.(type, listener, capture);
    }
  };
}

export function installHtmlEventBridge() {
  return setupHtmlEventBridge({ actions: HTML_EVENT_ACTIONS });
}
