/*
 * IsoPlayground — shared runtime state (Stage 5)
 *
 * File ini menyimpan data yang berubah saat aplikasi berjalan: world, editor,
 * camera, input, dan penanda runtime. Ini bukan konfigurasi default permanen
 * seperti sudut/ukuran proyeksi di config.js.
 */
export const IPState = {
  world: {
    size: 12,
    cubes: [],
    nextObjectId: 1,
    offsetU: 0,
    offsetV: 0
  },
  editor: {
    showGrid: true,
    showAxis: true,
    showAllObjectRadii: false,
    activeObjectId: null,
    pendingCell: null,
    pendingCycleState: null,
    targetContextObjectId: null
  },
  camera: {
    followObjectEnabled: false,
    zoom: 1,
    panPx: 0,
    panPy: 0,
    viewWidth: 1,
    viewHeight: 1,
    canvasDpr: 1
  },
  input: {
    drag: 0,
    movedDuringDrag: false,
    lastX: 0,
    lastY: 0,
    pressedKeys: {
      up: false,
      down: false,
      left: false,
      right: false
    }
  },
  runtime: {
    // Dipakai untuk mendeteksi perubahan visual sprite dan memicu redraw.
    lastDrawnVisualSig: '',
    spriteUidCounter: 0,
    pageVisible: true
  },
  sprites: {
    previewPlaying: false,
    previewStartTime: 0,
    clock: 0,
    cache: new Map()
  },
  simulation: {
    lastFrameTime: 0,
    npcPlansThisFrame: 0
  },
  perf: {
    dprCap: 2,
    slowFrames: 0
  },
  sandbox: {
    // Mode gameplay ditetapkan dari query/session, bukan dibaca ulang dari DOM.
    active: false,
    comparisonValues: []
  }
};

/*
 * Mode Sandbox menjadi satu sumber kebenaran. Tampilan body.sandbox hanya
 * mengatur CSS; aturan simulasi dan input membaca IPState.sandbox.active.
 */
export function isSandboxMode() {
  return Boolean(IPState.sandbox.active);
}
