/*
 * IsoPlayground application entry point.
 *
 * Entry point ini hanya menghubungkan lifecycle browser dengan modul sistem.
 * Setiap subsistem memiliki implementasi sendiri; main.js mengatur urutan
 * pemasangan adapter dan memulai game loop.
 */
import { installHtmlEventBridge } from './editor/eventBridge.js';
import { stepSimulation, setSimulationCallbacks } from './gameplay/simulation.js';
import { initSandboxMode } from './sandbox/sandbox.js';
import { installInputHandlers } from './editor/input.js';
import { installCommandHandlers } from './editor/commands.js';
import { installEngineAdapters } from './editor/engine.js';
import { IPState } from './core/state.js';
import { updateLabels } from './editor/objectEditor.js';
import { syncFooterActiveCoord } from './editor/inspector.js';
import { updateActiveSpritePreview } from './editor/spriteInspector.js';
import { setAnimationPreviewCallback } from './gameplay/animationSimulation.js';
import { d, computeVisualSignature } from './rendering/renderer.js';
import { applyFollowObjectCamera } from './core/camera.js';

export function startIsoPlayground() {
  installHtmlEventBridge();
  installEngineAdapters();
  installInputHandlers();
  installCommandHandlers();
  setSimulationCallbacks({
    syncActiveCoordinate: syncFooterActiveCoord,
    render: d,
    computeVisualSignature,
    applyFollowCamera: applyFollowObjectCamera
  });
  setAnimationPreviewCallback(updateActiveSpritePreview);

  IPState.runtime.pageVisible = !document.hidden;
  document.addEventListener('visibilitychange', () => {
    IPState.runtime.pageVisible = !document.hidden;
  });

  updateLabels();
  IPState.simulation.lastFrameTime = performance.now();

  // main.js memiliki lifecycle browser; simulation.js hanya memperbarui satu frame.
  const runFrame = now => {
    stepSimulation(now);
    requestAnimationFrame(runFrame);
  };
  requestAnimationFrame(runFrame);
  window.addEventListener('load', initSandboxMode, { once: true });
}

startIsoPlayground();
