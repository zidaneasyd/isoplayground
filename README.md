# IsoPlayground

IsoPlayground adalah engine/editor game isometrik berbasis web. Proyek ini menyediakan world grid, objek, role Player/NPC, collision, pergerakan, sprite animation, AI NPC/pathfinding, combat, editor, Sandbox, dan penyimpanan proyek JSON.

Tujuan refactor adalah membuat engine mudah dipelajari dan dikembangkan tanpa mengganti perilaku game sekaligus. Perubahan dipisahkan berdasarkan tanggung jawab, lalu pengujian menyeluruh dilakukan setelah modularisasi siap.

## 1. Teknologi dan cara aplikasi berjalan

| Teknologi | Peran |
|---|---|
| HTML | Struktur panel, tombol, menu, input, dan Canvas |
| CSS | Layout, warna, ukuran, dan tampilan editor |
| JavaScript ES Modules | Logika aplikasi yang dibagi ke modul-modul dengan `import` / `export` |
| Browser DOM API | Mengambil dan memperbarui elemen UI serta menerima event |
| Canvas 2D API | Menggambar grid, world, cube, sprite, dan indikator gameplay |
| `requestAnimationFrame` | Menjalankan simulasi dan render per frame |
| JSON | Format simpan/muat proyek |
| IndexedDB | Transfer snapshot sesi Sandbox antar-tab; `sessionStorage` menjadi fallback |

Aplikasi menggunakan Vanilla JavaScript. Tidak memakai React, TypeScript, bundler, Unity, Unreal, atau engine game eksternal.

## 2. Menjalankan aplikasi

1. Buka folder proyek di VS Code.
2. Jalankan `index.html` menggunakan Live Server atau server HTTP lokal lain.
3. Buka alamat lokal yang diberikan server pada browser.

Karena proyek menggunakan ES Modules, jalankan melalui server HTTP lokal. Membuka file dengan `file://` dapat membuat browser memblokir import module.

## 3. Struktur proyek saat ini

```text
IsoPlayground/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── camera.js
│   │   ├── config.js
│   │   ├── coordinates.js
│   │   ├── directions.js
│   │   ├── spriteData.js
│   │   ├── state.js
│   │   └── textUtils.js
│   ├── world/
│   │   ├── collision.js
│   │   ├── objectQueries.js
│   │   ├── objects.js
│   │   ├── roles.js
│   │   └── worldConfig.js
│   ├── gameplay/
│   │   ├── animationSimulation.js
│   │   ├── combat.js
│   │   ├── npc.js
│   │   ├── npcMovement.js
│   │   ├── npcPathfinding.js
│   │   ├── npcSimulation.js
│   │   ├── playerSimulation.js
│   │   ├── runtimeMonitor.js
│   │   └── simulation.js
│   ├── rendering/
│   │   ├── gameplayOverlays.js
│   │   ├── hitTesting.js
│   │   ├── objectRenderer.js
│   │   ├── renderGeometry.js
│   │   ├── renderer.js
│   │   ├── spriteAssets.js
│   │   ├── sprites.js
│   │   └── worldLayer.js
│   ├── editor/
│   │   ├── canvasHost.js
│   │   ├── commandConsole.js
│   │   ├── commands.js
│   │   ├── domUtils.js
│   │   ├── editorMenus.js
│   │   ├── editorUI.js
│   │   ├── engine.js
│   │   ├── eventBridge.js
│   │   ├── input.js
│   │   ├── inspector.js
│   │   ├── objectEditor.js
│   │   ├── objectIdentity.js
│   │   ├── objectStats.js
│   │   ├── spriteCycleImporter.js
│   │   ├── spriteFileAdapter.js
│   │   └── spriteInspector.js
│   ├── io/
│   │   ├── imageExport.js
│   │   ├── projectFileAdapter.js
│   │   ├── projectIO.js
│   │   ├── projectParser.js
│   │   ├── projectRuntimeAdapter.js
│   │   └── projectSerializer.js
│   └── sandbox/
│       ├── sandbox.js
│       └── sandboxStorage.js
├── docs/
│   ├── DEPENDENCY_MAP.md
│   ├── FUNCTION_MAP.md
│   ├── REFACTOR_PROGRESS.md
│   └── STATE_MAP.md
└── tests/
    └── *.test.js
```

`index.html` hanya memuat `js/main.js` sebagai module entry point. Module lain dimuat melalui rantai import sehingga urutan dependensi berada pada kode modul, bukan daftar script manual yang panjang.

## 4. Cara data mengalir

```text
Pengguna
   │
   ├── Keyboard / pointer ──> editor/input + canvasHost
   │
   └── Tombol / slider ─────> eventBridge
                                  │
                                  ▼
                          Editor / command API
                                  │
                                  ▼
                         IPState + world model
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
             simulation.js                 renderer.js
          Player / NPC / combat       world layer / objects / sprites
                   │                             │
                   └──────────────┬──────────────┘
                                  ▼
                              Canvas
```

`IPState` menjadi sumber data runtime bersama. Modul model dan gameplay mengubah data melalui API masing-masing; adapter editor menghubungkan aksi pengguna ke modul tersebut; renderer membaca state dan menggambar hasilnya. Properti `h` pada objek adalah offset vertikal objek itu sendiri.

## 5. Aturan pemisahan modul

- `core` berisi konfigurasi dan layanan umum, bukan aturan UI tertentu.
- `world` mengatur data objek, batas ruang, collision, dan role.
- `gameplay` mengatur perilaku saat game berjalan, tidak mengatur panel DOM.
- `rendering` menggambar state; geometri dan hit testing tidak menjadi bagian dari editor.
- `editor` menghubungkan kontrol pengguna dengan API model/gameplay.
- `io` menangani format proyek dan batas file browser.
- `sandbox` menangani transfer/pemulihan sesi permainan.
- Ketergantungan antarmodul menggunakan import/export eksplisit. Hindari menambahkan fungsi global baru.

## 6. Konsep JavaScript yang muncul di proyek

- **State:** data yang menggambarkan keadaan aplikasi saat ini, disimpan di `core/state.js`.
- **Configuration:** nilai default yang relatif tetap, didefinisikan di `core/config.js`.
- **Module:** file JavaScript dengan API `export` dan `import`.
- **Adapter:** lapisan yang menghubungkan sistem berbeda, misalnya DOM dengan model objek.
- **Callback:** fungsi yang diberikan ke modul lain untuk dipanggil ketika diperlukan.
- **Serialization:** mengubah data runtime menjadi JSON agar bisa disimpan.
- **Event delegation:** listener ditempatkan di root, lalu menangani event dari elemen yang cocok dengan atribut `data-ip-event-*`.
- **Delta time (`dt`):** selang waktu antar-frame agar pergerakan tidak bergantung pada FPS.

Istilah dijelaskan lagi saat bagian terkait disentuh dalam pengembangan.

## 7. Pengujian akhir

Pengujian menyeluruh sengaja ditunda sampai pemisahan modul selesai. Setelah struktur final siap, jalankan pemeriksaan sintaks, unit test, audit import graph, serta regression browser untuk editor, input, Canvas, sprite upload, NPC, combat, Sandbox, dan project import/export. Jangan menganggap perubahan yang belum diuji sebagai perubahan yang sudah lulus.
