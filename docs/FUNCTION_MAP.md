# IsoPlayground — Function Map (Baseline + Current Ownership)

Dokumen ini memiliki dua fungsi: inventaris fungsi dari versi monolitik (referensi historis), dan peta lokasi implementasi setelah refactor. Untuk kode aktif, gunakan bagian **0. Kepemilikan modul saat ini**.

> Tabel historis di bawah dipertahankan untuk membantu mengenali nama fungsi lama saat membaca riwayat engine. Lokasi implementasi tidak lagi mengikuti file monolitik. Tidak semua nama lama harus dipakai sebagai API publik.

## 0. Kepemilikan modul saat ini

| Modul | Fungsi/tanggung jawab utama |
|---|---|
| `core/config.js`, `core/state.js`, `core/spriteData.js`, `core/textUtils.js` | Konfigurasi, state runtime, normalisasi data sprite, dan utilitas teks murni |
| `core/coordinates.js`, `core/directions.js`, `core/camera.js` | Proyeksi isometrik datar, screen-to-grid, arah gerak, follow/zoom/pan kamera |
| `world/worldConfig.js` | Normalisasi ukuran dunia |
| `world/objects.js`, `world/objectQueries.js` | CRUD record objek, validasi role tunggal Player, nama, occupancy, duplicate/spawn location |
| `world/collision.js`, `world/roles.js` | Batas/collision/movement dan default/inisialisasi role |
| `gameplay/combat.js` | HP, damage, cooldown, knockback, Player attack |
| `gameplay/npcPathfinding.js`, `npcMovement.js`, `npc.js` | Pemetaan grid, A*, arah gerak, attack stand point, dan waypoint movement; `npc.js` menjadi public barrel |
| `gameplay/playerSimulation.js`, `npcSimulation.js`, `animationSimulation.js` | Update fase per actor dan animasi |
| `gameplay/runtimeMonitor.js`, `simulation.js` | Monitor performa/perubahan Sandbox dan orkestrasi satu frame simulasi |
| `rendering/spriteAssets.js`, `sprites.js` | Load record gambar, struktur frame, resolver animasi, cache |
| `rendering/renderGeometry.js`, `hitTesting.js` | Geometri isometrik, sprite bounds, pengujian pointer |
| `rendering/worldLayer.js`, `objectRenderer.js`, `gameplayOverlays.js`, `renderer.js` | Background/grid/axis, entity drawing, overlay gameplay, dan Canvas frame orchestration |
| `editor/eventBridge.js`, `input.js`, `canvasHost.js` | Event HTML delegated, keyboard, mouse/pointer, dan Canvas host |
| `editor/objectEditor.js`, `editor/editorMenus.js` | Daftar/selection objek, create/delete/reset, menu dan context actions |
| `editor/objectIdentity.js`, `objectStats.js`, `inspector.js` | Kontrol nama/role/collision/statistik dan sinkronisasi inspector |
| `editor/spriteInspector.js`, `spriteFileAdapter.js`, `spriteCycleImporter.js` | Preview, frame list, upload sprite, batch import direction/frame |
| `editor/commandConsole.js`, `commands.js`, `editorUI.js`, `engine.js` | Console, command parser, panel shell, adapter coordinator |
| `io/projectSerializer.js`, `projectParser.js`, `projectIO.js` | Build payload, parse/normalize JSON, public API I/O |
| `io/projectRuntimeAdapter.js`, `projectFileAdapter.js`, `imageExport.js` | Commit state, file browser adapter, PNG export |
| `sandbox/sandbox.js`, `sandboxStorage.js` | Payload dan transfer/pemulihan sesi Sandbox |
| `main.js` | Composition root, lifecycle browser, instalasi callback, loop start |

`engine.js` bukan lagi engine monolitik; file tersebut adalah coordinator tipis untuk memasang editor UI dan Canvas host. `index.html` memuat satu ES Module entry point (`main.js`). Tidak ada classic-script compatibility bridge yang diperlukan oleh source aktif. Pengujian menyeluruh belum dijalankan setelah rangkaian pemisahan terakhir dan ditunda sampai refactor/fitur siap.

## Cara membaca peta ini

- **Fungsi**: blok kode yang bisa dipanggil untuk melakukan pekerjaan.
- **Kelompok**: sistem/folder tempat fungsi aktif berada.
- **Efek**: apakah fungsi mengubah state, UI, data, atau hanya menghitung hasil.
- **Target file** pada tabel historis: tujuan awal pemisahan, bukan selalu nama file aktif sekarang.

## 1. Referensi historis dari kode monolitik

Bagian di bawah ini merekam organisasi sebelum refactor. Referensi DOM, konfigurasi proyeksi, dan state pada versi monolitik pernah disimpan sebagai variabel global. Pada struktur aktif, gunakan `editor/` untuk adapter DOM, `core/config.js` untuk konfigurasi, dan `core/state.js` untuk `IPState`.

### Referensi DOM dan state utama

| Nama | Peran |
|---|---|
| `c`, `x` | Canvas dan konteks gambar 2D |
| `worldSize` | Ukuran grid/world |
| `cubes` | Array seluruh objek di world |
| `nextObjectId` | ID berikutnya untuk objek baru |
| `activeObjectId` | ID objek yang sedang dipilih |
| `pendingCell` | Sel yang sedang menunggu aksi penempatan |
| `targetContextObjectId` | Objek target menu konteks |
| `showGrid`, `showAxis` | Visibilitas grid dan axis |
| `showAllObjectRadii` | Apakah area/radius objek ditampilkan semua |
| `followObjectEnabled` | Apakah kamera mengikuti objek |
| `worldOffsetU`, `worldOffsetV` | Offset world/grid |
| `z`, `panPx`, `panPy` | Zoom dan pan kamera |
| `pressedKeys` | Status tombol gerak yang sedang ditekan |
| `viewWidth`, `viewHeight`, `canvasDpr` | Ukuran tampilan dan faktor HiDPI |
| `lastDrawnVisualSig` | Signature visual terakhir untuk mendeteksi perubahan tampilan |
| `spriteUidCounter` | Counter untuk identitas sprite |

**Konsep:** state adalah data yang menggambarkan keadaan aplikasi saat ini. Di refactor, state ini rencananya dikumpulkan di `core/state.js`, tapi pemindahan perlu mempertimbangkan kompatibilitas dan dependensi.

## 2. Utilitas, world bounds, dan collision

**Target:** `world/collision.js`, `world/world.js`, atau `core/utils.js`.

| Fungsi | Peran |
|---|---|
| `releaseControlFocus` | Melepas fokus dari elemen input agar kontrol keyboard kembali ke aplikasi |
| `normalizeEvenSize` | Memvalidasi ukuran world dan membuat nilainya genap dalam rentang yang diizinkan |
| `normalizeSpeed` | Memvalidasi dan membatasi nilai kecepatan |
| `getCellBounds` | Menghitung batas koordinat sel berdasarkan ukuran world |
| `getCubeHalfExtent` | Mengembalikan setengah ukuran footprint cube |
| `isPointClearOfOtherCubes` | Memeriksa apakah titik/posisi bebas dari objek lain yang solid |
| `isPathClearOfOtherCubes` | Memeriksa apakah lintasan antara posisi awal dan akhir terhalang |
| `tryMoveCubeTo` | Mencoba memindahkan objek, dengan validasi collision/batas |
| `clampObjectsToWorld` | Memastikan objek berada dalam batas world |
| `clampCell` | Membatasi koordinat sel ke batas valid |
| `lim` | Helper lokal untuk membatasi nilai ke rentang |
| `findNearestFreeCell` | Mencari sel terdekat yang tidak terhalang |
| `blocked` | Helper lokal untuk mengecek sel terhalang pada pencarian sel bebas |

**Catatan collision:** kode memiliki aturan collision antarobjek; komentar di source menyebut collision bersifat mutual—dua objek harus sama-sama mengaktifkan collision agar saling solid.

## 3. Koordinat isometric dan kamera

**Target:** `world/coordinates.js` dan `rendering/camera.js`.

| Fungsi | Peran |
|---|---|
| `getProjectionHelpers` | Membuat helper proyeksi yang memakai ukuran/zoom/offset kamera |
| `p3d` | Mengubah koordinat world `(u,v,h)` menjadi posisi layar |
| `applyFollowObjectCamera` | Mengatur kamera agar mengikuti objek tertentu |
| `syncCameraUI` | Memperbarui UI yang menampilkan pengaturan kamera |
| `getSandboxZoomAnchorScreenPoint` | Menghitung titik anchor zoom pada Sandbox |
| `getZoomAnchorScreenPoint` | Menghitung titik anchor zoom pada mode editor |
| `setCameraZoomFromSlider` | Mengubah zoom berdasarkan slider |
| `resetCamera` | Mengembalikan kamera ke pengaturan awal |
| `toggleGridVisibility` | Mengubah visibilitas grid |
| `toggleAxisVisibility` | Mengubah visibilitas axis |
| `toggleFollowObject` | Mengaktifkan/menonaktifkan camera follow |

**Konsep:** proyeksi mengubah koordinat dunia menjadi koordinat layar. Kamera memengaruhi apa yang terlihat, bukan posisi objek sebenarnya di world.

## 4. Role, koordinat tampilan, dan panel objek

**Target:** `objects/roles.js`, `editor/inspector.js`, `ui/panels.js`.

| Fungsi | Peran |
|---|---|
| `getRoleDisplay` | Menghasilkan label tampilan role |
| `formatCoord` | Memformat koordinat untuk ditampilkan |
| `syncFooterActiveCoord` | Memperbarui koordinat objek aktif di footer |
| `nearestEightWayVector` | Menentukan arah 8-way terdekat dari sebuah vektor |
| `npcDefaults` | Menyediakan default pengaturan NPC |
| `clearNpcRuntimeState` | Membersihkan state runtime/AI NPC |
| `toggleNpcSetting` | Mengubah opsi NPC |
| `syncNpcControls` | Menyelaraskan kontrol UI NPC dengan state objek |
| `syncObjectPanel` | Memperbarui panel properti objek |
| `setActiveObjectNameLive` | Memperbarui nama objek saat input berlangsung |
| `commitActiveObjectName` | Menyelesaikan/commit perubahan nama |
| `setActiveObjectName` | Mengatur nama objek aktif |
| `applyRoleDefaults` | Menerapkan pengaturan default sesuai role |
| `setActiveObjectRole` | Mengubah role objek aktif |
| `setActiveObjectArea` | Mengatur area/radius properti objek |
| `setActiveObjectSpeed` | Mengatur kecepatan objek aktif |
| `setActiveObjectRunSpeed` | Mengatur kecepatan berlari objek aktif |
| `setActiveObjectStat` | Mengatur stat objek aktif |
| `toggleActiveObjectCollision` | Mengubah status collision objek aktif |
| `setActiveObjectAttackArea` | Mengatur area serangan objek aktif |

## 5. Sprite dan animasi

**Target:** `rendering/sprites.js`; UI preview/upload nantinya dapat dipisah ke `ui/spritePanel.js`.

| Fungsi | Peran |
|---|---|
| `clampSpriteFps` | Memvalidasi/membatasi FPS sprite |
| `getObjectStateFps` | Mendapatkan FPS animasi untuk state objek |
| `setPanelFps` | Mengubah FPS dari panel sprite |
| `createEmptyStateFramesMap` | Membuat struktur awal frame sprite per state/direction |
| `ensureObjectStateFrames` | Memastikan struktur frame sprite tersedia pada objek |
| `getFramesForStateDir` | Mengambil daftar frame berdasarkan state dan arah |
| `getActiveDirectionForObject` | Menentukan arah sprite objek saat ini |
| `getRuntimeAnimationStateForObject` | Menentukan state animasi runtime (mis. idle/run/attack) |
| `beginSpriteFrame` | Memulai/reset pencatatan cache frame sprite untuk satu frame render |
| `getSpriteForObject` | Mendapatkan sprite yang cocok untuk objek/state/direction/frame |
| `resolveSpriteForObject` | Menentukan sprite yang akan digunakan saat render |
| `getPanelAnimationState` | Mendapatkan state animasi yang dipilih di panel preview |
| `setPanelAnimationState` | Mengubah state preview panel |
| `getPanelPreviewDirection` | Mendapatkan arah preview panel |
| `setPanelPreviewDirection` | Mengubah arah preview panel |
| `getPanelPreviewFrames` | Mendapatkan frame untuk preview panel |
| `getPanelPreviewSpriteForObject` | Menentukan sprite yang ditampilkan di preview panel |
| `toggleSpritePreviewPlay` | Memutar atau menghentikan preview animasi |
| `hasAnySpriteUploaded` | Memeriksa apakah objek memiliki sprite |
| `renderSpriteFrameList` | Membuat/merender daftar frame sprite di UI |
| `paintSpritePreview` | Menggambar preview sprite |
| `syncSpritePanel` | Memperbarui panel sprite berdasarkan objek aktif |
| `createSpriteRecord` | Membuat record/data sprite dari file |
| `triggerAddSprite` | Memulai proses pemilihan/upload sprite |
| `compareFilenamesAscending` | Membandingkan nama file untuk pengurutan |
| `handleSpriteFileSelected` | Memproses file sprite yang dipilih pengguna |
| `parseCycleFilename` | Membaca pola nama file untuk animasi cycle |
| `handleCycleFilesSelected` | Memproses kumpulan file cycle yang dipilih |
| `finishOne`, `settle` | Helper lokal untuk menuntaskan proses async dan status pekerjaan upload |

**Konsep:** sprite adalah gambar; animation state menentukan kumpulan gambar yang dipakai; frame adalah gambar individual; FPS menentukan seberapa cepat frame berganti.

## 6. Sandbox dan transfer session

**Target:** `sandbox/sandbox.js`, `sandbox/session.js`, `sandbox/storage.js`.

| Fungsi | Peran |
|---|---|
| `buildSandboxSessionPayload` | Mengumpulkan data project/runtime yang diperlukan untuk memulai Sandbox |
| `sandboxDbOpen` | Membuka database IndexedDB Sandbox |
| `sandboxStorePut` | Menyimpan payload session ke IndexedDB |
| `sandboxStoreTake` | Mengambil payload session dan mengelola transfernya |
| `openSandbox` | Menyiapkan dan membuka Sandbox dari editor |
| `initSandboxMode` | Menginisialisasi mode Sandbox setelah data diterima |
| `sandboxStateChanged` | Menandai/mengelola perubahan state Sandbox |
| `put` | Helper lokal penyimpanan payload |

## 7. UI editor, object list, selection, menu

**Target:** `editor/selection.js`, `editor/contextMenu.js`, `ui/panels.js`, `ui/menus.js`.

| Fungsi | Peran |
|---|---|
| `renderObjectList` | Menggambar/memperbarui daftar objek di panel |
| `escapeHtml` | Mengamankan teks sebelum dimasukkan sebagai HTML |
| `selectObject` | Memilih objek dan memperbarui state/UI selection |
| `updateLabels` | Memperbarui label objek atau UI terkait |
| `toggleSection` | Membuka/menutup bagian panel |
| `toggleMenu` | Membuka/menutup menu |
| `closeContextMenus` | Menutup menu konteks |
| `closeAllMenus` | Menutup seluruh menu/dropdown |
| `openObjectContextMenuAt` | Membuka menu konteks pada posisi tertentu |
| `onObjectItemContextMenu` | Menangani klik kanan pada item objek |
| `openIdentityRoleDropdown` | Membuka dropdown identitas/role |
| `closeIdentityRoleDropdown` | Menutup dropdown identitas/role |
| `openRoleDropdown` | Membuka dropdown role |
| `resetTargetToDefaultObject` | Mengatur target operasi ke objek default |
| `setObjectRoleDefault` | Mengubah role default objek/target |
| `assignRoleToTarget` | Menetapkan role ke target objek |
| `toggleAllObjectRadii` | Mengubah tampilan radius seluruh objek |
| `toggleLeftPanel` | Membuka/menutup panel kiri |
| `toggleRightPanelExpand` | Mengubah ukuran/keadaan panel kanan |
| `toggleLowerPanelExpand` | Mengubah ukuran/keadaan panel bawah |

## 8. Object management, spawn, duplicate, delete

**Target:** `objects/objectFactory.js`, `objects/objectManager.js`, `editor/placement.js`.

| Fungsi | Peran |
|---|---|
| `initNpcMotion` | Menginisialisasi data/state pergerakan NPC |
| `isNameUnique` | Memeriksa apakah nama objek unik |
| `handleRenameObject` | Menangani proses rename dari UI |
| `findDuplicatePosition` | Mencari posisi aman untuk hasil duplicate |
| `handleDuplicateObject` | Menangani duplicate objek |
| `deleteObjectById` | Menghapus objek berdasarkan ID |
| `handleDeleteObject` | Menangani perintah delete dari UI |
| `screenToGridCell` | Mengubah koordinat mouse layar menjadi sel grid |
| `isCellOccupiedOrPassedByAnyObject` | Memeriksa apakah sel ditempati/terlintasi objek |
| `handleAddObject` | Menangani aksi penambahan objek dari UI |
| `createObjectAtCell` | Membuat objek pada sel tertentu |
| `findSpawnCell` | Mencari lokasi spawn yang aman/valid |
| `undoCube` | Membatalkan penambahan objek terakhir sesuai mekanisme yang tersedia |
| `clearCubes` | Menghapus objek dari world |
| `resetProject` | Mereset project ke keadaan awal |

## 9. World settings dan project serialization

**Target:** `world/world.js`, `io/projectFormat.js`, `io/import.js`, `io/export.js`.

| Fungsi | Peran |
|---|---|
| `setWorldSize` | Mengubah ukuran world dan menyesuaikan objek/world |
| `buildProjectPayload` | Mengumpulkan data project ke struktur payload |
| `exportProjectJSON` | Mengunduh/export project ke JSON |
| `importProjectJSON` | Memulai proses import project JSON |
| `applyImportedJSON` | Memvalidasi/menormalkan dan menerapkan data import ke state |
| `num` | Helper lokal konversi/validasi angka |
| `handleJSONFileSelected` | Menangani file JSON yang dipilih pengguna |
| `exportPNG` | Mengekspor gambar Canvas ke PNG |

**Konsep:** serialization berarti mengubah data runtime menjadi format penyimpanan. Import harus memvalidasi data sebelum mengubah state agar project rusak tidak merusak sesi yang sedang berjalan.

## 10. Camera controls, keyboard, console, commands

**Target:** `core/events.js`, `editor/input.js`, `ui/console.js`, `rendering/camera.js`.

| Fungsi | Peran |
|---|---|
| `zoomStep` | Mengubah zoom dalam langkah tertentu |
| `applyZoomAtScreenPoint` | Zoom dengan menjaga titik anchor layar |
| `clampWorldOffset` | Membatasi offset world |
| `moveGridByCell` | Menggeser grid/world berdasarkan langkah sel |
| `moveDefaultObjectByCell` | Menggerakkan objek default per sel |
| `getInputDirectionKey` | Memetakan input ke arah gerak |
| `getDirectionKeyFromVector` | Mengubah vektor menjadi key arah |
| `getPlayerEightWayVector` | Mendapatkan vektor arah 8-way Player |
| `updateKeyState` | Memperbarui status tombol yang ditekan |
| `setCommandOutput` | Mengatur teks hasil console |
| `toggleCommandConsole` | Membuka/menutup command console |
| `executeCommandLine` | Membaca dan menjalankan perintah console |
| `finishJob`, `settle` | Helper lokal untuk mengakhiri pekerjaan asynchronous command |

## 11. NPC spawn, pathfinding, navigation, simulation

**Target:** `ai/behavior.js`, `ai/pathfinding.js`, `ai/navigation.js`, `gameplay/movement.js`, `core/loop.js`.

| Fungsi | Peran |
|---|---|
| `spawnEnemyNpcs` | Membuat/spawn NPC musuh |
| `npcGridCoord` | Mengubah posisi NPC menjadi koordinat grid untuk navigasi |
| `npcGridIndex` | Mengubah koordinat grid menjadi indeks internal |
| `npcFindPath` | Mencari jalur NPC (algoritma pencarian grid/A*-like) |
| `passable` | Memeriksa apakah node/sel dapat dilewati |
| `heuristic` | Menghitung estimasi jarak untuk pencarian path |
| `push`, `pop` | Helper lokal untuk struktur frontier/priority queue pencarian |
| `npcAttackStandPoint` | Menentukan posisi NPC yang ideal untuk berdiri saat menyerang |
| `clampM` | Membatasi nilai ke rentang |
| `moveNpcAlongPath` | Menggerakkan NPC mengikuti waypoint/path |
| `updateAccidentalOverlapCollision` | Menangani overlap tidak sengaja yang memengaruhi collision |
| `stepSimulation` | Update utama simulasi: input/movement, AI, cooldown, knockback, animation dan redraw bila perlu |

**Konsep:** pathfinding adalah algoritma untuk mencari jalur. Navigation adalah proses mengikuti jalur yang sudah ditemukan. Simulation update memperbarui dunia dari waktu ke waktu.

## 12. Canvas drawing, hit testing, rendering, combat

**Target:** `rendering/renderer.js`, `rendering/drawCube.js`, `rendering/sprites.js`, `gameplay/combat.js`, `gameplay/knockback.js`.

| Fungsi | Peran |
|---|---|
| `drawPolygon` | Menggambar polygon di Canvas |
| `getCubeFaces` | Menghasilkan sisi-sisi cube untuk digambar |
| `pointInPolygon` | Memeriksa apakah titik berada di dalam polygon |
| `getSpriteScreenRect` | Menghitung kotak sprite pada layar |
| `hitTestCube` | Menentukan objek yang terkena klik berdasarkan posisi layar |
| `getDrawableForSprite` | Mendapatkan informasi drawable untuk sprite |
| `drawSolidCube1m` | Menggambar cube atau sprite fallback |
| `trackFramePerformance` | Mengukur/mencatat performa frame |
| `resizeCanvas` | Mengatur ukuran Canvas/backing store |
| `drawActiveObjectLabel` | Menggambar label objek aktif |
| `getRoleCombatDefaults` | Mengambil default combat berdasarkan role |
| `ensureCombatDefaults` | Memastikan data combat objek memiliki nilai default |
| `getAttackKnockbackDirection` | Menghitung arah knockback serangan |
| `applyKnockback` | Memberikan efek knockback pada target |
| `dealDamage` | Mengurangi HP dan menangani dampak damage |
| `playerAttack` | Menjalankan serangan Player, target, cooldown dan damage |
| `computeVisualSignature` | Menghitung signature tampilan untuk mendeteksi perubahan visual |
| `d` | Fungsi renderer utama: membersihkan Canvas, menggambar world/grid/area/objek/UI game di Canvas |
| `drawIsoArea` | Menggambar area isometric seperti radius/area serangan atau deteksi |

## 13. Event handlers dan initialization

Bagian paling bawah source memasang listener mouse, keyboard, UI, resize, dan menjalankan initialization. Handler yang tidak bernama fungsi (anonymous callbacks) juga penting dalam peta dependensi. Saat Stage 3, kita inventarisasi listener secara terpisah karena ini adalah titik penghubung DOM ke sistem.

## 14. Rencana pemindahan awal (riwayat)

Daftar ini merekam rencana awal sebelum implementasi. Sebagian besar sudah terlaksana dan status terbaru berada di `REFACTOR_PROGRESS.md`.


1. Buat test/checklist baseline dari perilaku versi Stage 1.
2. Inventarisasi inline `onclick` dan event listeners.
3. Keluarkan state/config dengan pola kompatibilitas yang jelas.
4. Pisahkan coordinate/projection helpers.
5. Pisahkan world bounds/collision.
6. Pisahkan object creation/management.
7. Pisahkan renderer dan sprite.
8. Pisahkan movement, combat, NPC/pathfinding.
9. Pisahkan editor/UI, Sandbox, Import/Export.
10. Event HTML memakai delegated event bridge ES Module dengan whitelist aksi eksplisit; seluruh aksi UI yang terdaftar diambil melalui import/export modul, bukan registry fungsi global.
11. Jalankan checklist regresi setiap tahap.

## 15. Checklist regresi manual

- [ ] App terbuka tanpa error Console
- [ ] Grid, axis, zoom, pan, follow-camera
- [ ] Add/select/rename/duplicate/delete object
- [ ] Role Player/NPC/default dan inspector
- [ ] Collision toggle dan world resize
- [ ] Movement keyboard, run, batas world
- [ ] Sprite upload, preview, animasi, cycle files
- [ ] NPC spawn, roaming/chase, pathfinding
- [ ] Attack, HP, damage, knockback
- [ ] Context menu dan command console
- [ ] Import/export JSON, reset/undo
- [ ] Export PNG
- [ ] Sandbox transfer, controls, camera, combat

---

## Catatan pembelajaran

Saat mempelajari fungsi, tanyakan:
1. Apa tugasnya?
2. Input apa yang diterima (parameter atau state yang dibaca)?
3. Apa yang diubah (side effect)?
4. Apa hasil yang dikembalikan (`return`), jika ada?
5. Fungsi/sistem mana yang memanggilnya?
6. File mana yang seharusnya memiliki tanggung jawab ini?


## Pemisahan implementasi aktif

Inventaris fungsi dari monolitik tetap menjadi referensi nama/konsep, tetapi kode aktif sekarang tersebar ke folder `core`, `world`, `gameplay`, `rendering`, `editor`, `io`, dan `sandbox`. Tanggung jawab dan aturan dependency terbaru dijelaskan di `DEPENDENCY_MAP.md`.

Ekstraksi penting yang telah dilakukan:

- Proyeksi, kamera, collision, model objek, object queries, konfigurasi world, dan role rules dipisah ke `core/` dan `world/`.
- Player movement, NPC simulation/pathfinding, combat, animation phase, runtime monitor, dan frame orchestration dipisah ke `gameplay/`.
- Sprite assets, frame resolver, render geometry, hit testing, world layer, entity renderer, gameplay overlay, dan Canvas orchestrator dipisah ke `rendering/`.
- Event bridge, Canvas host, keyboard input, object editor/menu, inspector, sprite upload, command console, dan panel UI dipisah ke `editor/`.
- Project parser/serializer, commit runtime, file picker, image export, dan Sandbox session dipisah ke `io/` dan `sandbox/`.
- `main.js` menjadi composition root. Callback antarlayer dipasang dari entry point atau browser host, bukan melalui pencarian fungsi global.

`simulation.js` memperbarui satu frame dan tidak lagi menjadwalkan `requestAnimationFrame`; lifecycle browser berada di `main.js`. Modul gameplay tidak mengimpor editor/DOM. Core state tidak membaca `window` untuk nilai awal. Suite pengujian lama perlu diselaraskan dengan lokasi modul terbaru; pengujian lengkap sengaja ditunda sampai pemisahan serta pemisahan modul siap.

