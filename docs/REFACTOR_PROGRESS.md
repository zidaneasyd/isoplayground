# IsoPlayground — Refactor Progress

## Aturan pengerjaan
- Utamakan menyiapkan struktur dan kode modul terlebih dahulu.
- Jangan menjalankan tes kecil berulang setelah setiap pemindahan fungsi.
- Jalankan pengujian lengkap setelah pemisahan dan fitur yang direncanakan siap; lanjutkan perbaikan sampai hasil akhir stabil.
- Perubahan harus bertahap dan menjaga perilaku lama sejauh mungkin.
- Output ZIP/file diberikan hanya ketika pengguna meminta hasil akhir.
- Jangan sertakan HTML original monolitik pada paket final.

## Tahap dan posisi terkini

| Tahap | Fokus | Status |
|---|---|---|
| 1 | Pemisahan HTML, CSS, dan JavaScript | Selesai |
| 2 | Function Map baseline | Selesai |
| 3 | Dependency Map baseline | Selesai; diperbarui mengikuti struktur aktif |
| 4 | Migrasi atribut event ke `data-ip-event-*` | Selesai |
| 5 | Pemisahan konfigurasi dan state runtime | Selesai |
| 6 | Modularisasi world, rendering, gameplay, editor, I/O, Sandbox, dan entry point | Selesai secara struktural |
| 7 | Migrasi ES Modules dan perapian batas antarlayer | Selesai secara struktural; menunggu pengujian akhir |
| 8 | Pengujian lengkap unit, integrasi, dan browser | Ditunda sampai pemisahan selesai |

## Hasil struktur aktif

- `index.html` memuat hanya `js/main.js` sebagai ES Module entry point.
- `js/core/` menyimpan konfigurasi, state, koordinat, arah, kamera, dan utilitas bersama.
- `js/world/` menyimpan world config, model objek, query, collision, dan role.
- `js/gameplay/` menyimpan combat, AI/navigation NPC, update Player/NPC/animasi, runtime monitor, dan loop simulasi.
- `js/rendering/` menyimpan asset sprite, resolver animasi, geometri, hit testing, world layer, entity renderer, gameplay overlay, dan Canvas renderer.
- `js/editor/` menyimpan event bridge, keyboard/pointer host, object editor/menu, inspector, sprite import, command console, dan adapter UI.
- `js/io/` memisahkan serializer, parser, runtime commit, file adapter, dan PNG export.
- `js/sandbox/` menyimpan transfer dan pemulihan session Sandbox.
- `main.js` menjadi composition root untuk menyambungkan callback antar-layer.

## Pemisahan tambahan terbaru

- `renderGeometry.js` tidak lagi mengimpor resolver sprite; sprite record diberikan oleh pemanggil. Geometri jadi tidak bergantung pada sistem animasi.
- `spriteAssets.js` tidak lagi mengimpor renderer. Browser host memasang callback redraw ketika image selesai dimuat.
- `runtimeMonitor.js` tidak lagi mengimpor editor Canvas host. Fungsi resize disuntikkan melalui callback yang dipasang browser host.
- `simulation.js` tidak lagi mengimpor inspector DOM. Sinkronisasi koordinat footer dipasang sebagai callback dari `main.js`.
- Callback setelah render dinamai `setRendererAfterRenderCallback()` agar renderer tidak terikat pada satu kontrol UI tertentu.
- `animationSimulation.js` tidak lagi mengimpor sprite inspector; preview animasi inspector dipasang sebagai callback dari `main.js`.
- `core/state.js` tidak lagi membaca `window` atau `performance` untuk nilai awal. Ukuran viewport dan timestamp runtime diinisialisasi browser host/entry point.
- `simulation.js` sekarang hanya memperbarui satu frame; loop `requestAnimationFrame` dikelola `main.js`.
- Helper DOM dipindahkan ke `editor/domUtils.js`; helper escape HTML yang murni berada di `core/textUtils.js`.
- Overlay (radius, label, HP, damage popup, NPC alert) dipisahkan dari penggambaran entity ke `rendering/gameplayOverlays.js`.
- Normalisasi ukuran dunia dipindahkan ke `world/worldConfig.js`, sehingga editor tidak bergantung pada parser Project I/O.

## Hal yang belum dikerjakan

1. Jalankan pengujian sintaks, unit tests, audit import graph, dan regression browser setelah seluruh pemisahan kode selesai; perbaiki semua masalah yang ditemukan.

## Batas validasi

Sesuai alur kerja yang dipilih, pengujian menyeluruh belum dijalankan setelah rangkaian pemisahan terbaru. Struktur source sudah dibagi menjadi modul ES yang memiliki tanggung jawab khusus, tetapi belum boleh dianggap lulus integrasi sampai tahap pengujian akhir.


## Batas pekerjaan saat ini

Fokus proyek adalah modularisasi dan pemisahan tanggung jawab kode tanpa menambah mekanik gameplay baru. Tinggi objek tetap memakai properti `h` seperti mekanik awal. Pengujian menyeluruh dijalankan setelah pemisahan modul selesai.
