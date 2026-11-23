/*
 * IsoPlayground — keyboard/input adapter.
 *
 * Memiliki lifecycle keydown/keyup/blur dan gerak objek default melalui
 * keyboard. Input state, collision, kamera, arah, dan combat diimpor; perintah
 * editor/console tetap dipanggil melalui adapter UI selama tahap modularisasi.
 */
import { IPState, isSandboxMode } from '../core/state.js';
import { playerAttack } from '../gameplay/combat.js';
import { closeAllMenus, closeContextMenus } from './editorMenus.js';
import { deleteObjectById } from './objectEditor.js';
import { toggleCommandConsole } from './commandConsole.js';
import { executeCommandLine } from './commands.js';
import { exportProjectJSON, importProjectJSON } from '../io/projectFileAdapter.js';
import { d } from '../rendering/renderer.js';
import { moveDefaultObjectByCell } from './objectEditor.js';

function updateKeyState(key, isDown) {
  const pressed = IPState.input.pressedKeys;
  if (key === 'w' || key === 'W' || key === 'ArrowUp') {
    pressed.up = isDown;
    return true;
  }
  if (key === 's' || key === 'S' || key === 'ArrowDown') {
    pressed.down = isDown;
    return true;
  }
  if (key === 'a' || key === 'A' || key === 'ArrowLeft') {
    pressed.left = isDown;
    return true;
  }
  if (key === 'd' || key === 'D' || key === 'ArrowRight') {
    pressed.right = isDown;
    return true;
  }
  return false;
}

export function installInputHandlers(targetWindow = window, targetDocument = document) {
  const onKeyDown = event => {
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      event.stopPropagation();
      toggleCommandConsole();
      return;
    }
    if (event.key === 'Escape' && targetDocument.getElementById('command-console').classList.contains('open')) {
      event.preventDefault();
      toggleCommandConsole(false);
      return;
    }
    if (event.key === 'Enter' && event.target && event.target.id === 'command-console-input') {
      event.preventDefault();
      executeCommandLine(event.target.value);
      event.target.value = '/';
      event.target.setSelectionRange(1, 1);
      return;
    }

    const target = event.target;
    const isEditingControl = target && (
      target.isContentEditable ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      (target.tagName === 'INPUT' && target.type !== 'button' && target.type !== 'checkbox')
    );
    if (isEditingControl) return;

    const pressed = IPState.input.pressedKeys;
    if (event.key === 'Shift') { pressed.shift = true; return; }
    if ((event.key === 'x' || event.key === 'X') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      playerAttack();
      return;
    }

    const sandboxMode = isSandboxMode();
    if (sandboxMode && (event.ctrlKey || event.metaKey || event.key === 'Delete')) return;
    if (event.target && event.target.tagName === 'TEXTAREA') return;

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const lowerKey = event.key.toLowerCase();
      if (lowerKey === 'e') {
        event.preventDefault();
        closeAllMenus();
        exportProjectJSON();
        return;
      }
      if (lowerKey === 'i') {
        event.preventDefault();
        closeAllMenus();
        importProjectJSON();
        return;
      }
    }

    if (event.key === 'Delete') {
      if (event.target && event.target.tagName === 'INPUT') event.target.blur();
      if (IPState.editor.activeObjectId !== null) {
        event.preventDefault();
        closeContextMenus();
        deleteObjectById(IPState.editor.activeObjectId);
      }
      return;
    }

    const handledDirection = updateKeyState(event.key, true);
    if (!handledDirection) return;
    if (event.target && event.target.tagName === 'INPUT') event.target.blur();
    event.preventDefault();

    const activeObject = IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId);
    if (!activeObject || activeObject.role === 'NPC' || activeObject.role === 'Player') return;

    if (!event.repeat) {
      if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') {
        moveDefaultObjectByCell(activeObject, 0, -1);
      } else if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown') {
        moveDefaultObjectByCell(activeObject, 0, 1);
      } else if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') {
        moveDefaultObjectByCell(activeObject, -1, 0);
      } else if (event.key === 'd' || event.key === 'D' || event.key === 'ArrowRight') {
        moveDefaultObjectByCell(activeObject, 1, 0);
      }
    }
  };

  const onKeyUp = event => {
    if (event.key === 'Shift') {
      IPState.input.pressedKeys.shift = false;
      return;
    }
    if (updateKeyState(event.key, false)) d();
  };

  const onBlur = () => {
    const pressed = IPState.input.pressedKeys;
    pressed.up = false;
    pressed.down = false;
    pressed.left = false;
    pressed.right = false;
    pressed.shift = false;
    d();
  };

  const onContextMenu = event => {
    if (isSandboxMode()) event.preventDefault();
  };

  targetWindow.addEventListener('keydown', onKeyDown);
  targetWindow.addEventListener('keyup', onKeyUp);
  targetWindow.addEventListener('blur', onBlur);
  targetDocument.addEventListener('contextmenu', onContextMenu);

  // Cleanup tersedia untuk pengujian integrasi dan hot-reload di masa depan.
  return () => {
    targetWindow.removeEventListener('keydown', onKeyDown);
    targetWindow.removeEventListener('keyup', onKeyUp);
    targetWindow.removeEventListener('blur', onBlur);
    targetDocument.removeEventListener('contextmenu', onContextMenu);
  };
}

