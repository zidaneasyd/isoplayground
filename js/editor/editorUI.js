/*
 * IsoPlayground — editor shell UI adapters.
 *
 * Modul ini menghubungkan state editor dengan kontrol DOM: kamera, grid/axis,
 * menu konteks, radius objek, dan panel. Aturan world/gameplay tetap berada
 * pada modul masing-masing; file ini hanya mengatur tampilan dan interaksi UI.
 */
import { IPState, isSandboxMode } from '../core/state.js';
import { applyFollowObjectCamera } from '../core/camera.js';
import { screenToGridCell } from '../core/coordinates.js';
import { d, setRendererAfterRenderCallback } from '../rendering/renderer.js';
import { hitTestCube } from '../rendering/hitTesting.js';
import { closeContextMenus, openObjectContextMenuAt } from './editorMenus.js';
import { releaseControlFocus } from './domUtils.js';

const byId = (id) => document.getElementById(id);

export function syncCameraUI() {
  const percentage = Math.round(IPState.camera.zoom * 100);
  const info = byId('info-zoom');
  const value = byId('cam-zoom-val');
  const slider = byId('cam-zoom-slider');
  if (info) info.textContent = `Zoom: ${percentage}%`;
  if (value) value.textContent = `${percentage}%`;
  if (slider) slider.value = String(Math.max(20, Math.min(300, percentage)));
}

export function toggleGridVisibility() {
  IPState.editor.showGrid = !IPState.editor.showGrid;
  const button = byId('grid-toggle');
  if (button) {
    button.classList.toggle('active', IPState.editor.showGrid);
    button.setAttribute('aria-pressed', String(IPState.editor.showGrid));
  }
  releaseControlFocus(button);
  d();
}

export function toggleAxisVisibility() {
  IPState.editor.showAxis = !IPState.editor.showAxis;
  const button = byId('axis-toggle');
  if (button) {
    button.classList.toggle('active', IPState.editor.showAxis);
    button.setAttribute('aria-pressed', String(IPState.editor.showAxis));
  }
  releaseControlFocus(button);
  d();
}

export function toggleFollowObject() {
  IPState.camera.followObjectEnabled = !IPState.camera.followObjectEnabled;
  const button = byId('follow-object-toggle');
  if (button) {
    button.classList.toggle('active', IPState.camera.followObjectEnabled);
    button.setAttribute('aria-pressed', String(IPState.camera.followObjectEnabled));
  }
  releaseControlFocus(button);
  if (IPState.camera.followObjectEnabled) applyFollowObjectCamera();
  d();
}

export function toggleAllObjectRadii() {
  IPState.editor.showAllObjectRadii = !IPState.editor.showAllObjectRadii;
  const button = byId('all-object-radius-toggle');
  if (button) {
    button.classList.toggle('active', IPState.editor.showAllObjectRadii);
    button.setAttribute('aria-pressed', String(IPState.editor.showAllObjectRadii));
  }
  d();
}

export function toggleLeftPanel() {
  const panel = byId('left-panel');
  const footer = byId('footer-bar');
  if (!panel || !footer) return;
  panel.classList.toggle('collapsed');
  footer.classList.toggle('left-closed', panel.classList.contains('collapsed'));
  releaseControlFocus();
}

export function toggleRightPanelExpand() {
  const panel = byId('right-panel');
  const button = byId('right-expand-btn');
  if (!panel || !button) return;
  const expanded = panel.classList.toggle('expanded');
  button.classList.toggle('is-expanded', expanded);
  document.body.classList.toggle('right-wide', expanded);
  button.title = expanded ? 'Perkecil panel' : 'Perluas panel ke kiri';
  button.setAttribute('aria-label', expanded ? 'Perkecil panel' : 'Perluas panel ke kiri');
  releaseControlFocus();
}

export function toggleLowerPanelExpand() {
  const panel = byId('right-lower-panel');
  const button = byId('lower-expand-btn');
  if (!panel || !button) return;
  const expanded = panel.classList.toggle('expanded');
  button.classList.toggle('is-expanded', expanded);
  document.body.classList.toggle('right-lower-wide', expanded);
  button.title = expanded ? 'Perkecil panel' : 'Perluas panel ke kiri';
  button.setAttribute('aria-label', expanded ? 'Perkecil panel' : 'Perluas panel ke kiri');
  releaseControlFocus();
}

let editorUIInstalled = false;

/** Memasang event global UI satu kali setelah DOM siap. */
export function installEditorUIHandlers() {
  if (editorUIInstalled) return;
  editorUIInstalled = true;
  setRendererAfterRenderCallback(syncCameraUI);

  window.addEventListener('click', (event) => {
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    const contextMenu = byId('context-menu');
    const objectMenu = byId('object-context-menu');
    const roleDropdown = byId('role-dropdown');
    if (
      contextMenu && !contextMenu.contains(event.target) &&
      objectMenu && !objectMenu.contains(event.target) &&
      roleDropdown && !roleDropdown.contains(event.target)
    ) {
      closeContextMenus();
    }
  });

  window.addEventListener('contextmenu', (event) => {
    if (isSandboxMode()) {
      event.preventDefault();
      closeContextMenus();
      return;
    }
    if (event.target.closest('.object-item')) return;
    if (event.target.closest('#left-panel, #right-panel, header, footer, .panel-toggle, .ctx-menu, .role-dropdown')) {
      event.preventDefault();
      closeContextMenus();
      return;
    }

    event.preventDefault();
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    byId('object-context-menu')?.classList.remove('open');
    byId('role-dropdown')?.classList.remove('open');

    const hitObject = hitTestCube(event.clientX, event.clientY);
    if (hitObject) {
      openObjectContextMenuAt(event.clientX, event.clientY, hitObject.id);
      return;
    }

    IPState.editor.pendingCell = screenToGridCell(event.clientX, event.clientY);
    const menu = byId('context-menu');
    if (!menu) return;
    const menuWidth = 135;
    const menuHeight = 34;
    const left = Math.min(event.clientX, window.innerWidth - menuWidth);
    const top = Math.min(event.clientY, window.innerHeight - menuHeight);
    menu.style.left = `${Math.max(4, left)}px`;
    menu.style.top = `${Math.max(4, top)}px`;
    menu.classList.add('open');
  });
}

