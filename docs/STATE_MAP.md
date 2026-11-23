# State Map — IsoPlayground

Dokumen ini menjelaskan state runtime yang dikelola oleh `js/core/state.js` dan membedakannya dari konfigurasi pada `js/core/config.js`.

## 1. Pengertian state

**State** adalah data yang menggambarkan kondisi aplikasi saat ini dan berubah ketika aplikasi berjalan. Contohnya ukuran world, objek yang dipilih, zoom kamera, atau tombol yang sedang ditekan.

**Configuration** berisi nilai dasar yang relatif tetap. Karena itu sudut proyeksi dan ukuran petak berada di `config.js`, sedangkan zoom kamera berada di state.

## 2. Kelompok state

| Kelompok | Properti utama | Tanggung jawab |
|---|---|---|
| `IPState.world` | `size`, `cubes`, `nextObjectId`, `offsetU`, `offsetV` | Ukuran dunia, daftar objek, dan offset koordinat |
| `IPState.editor` | `showGrid`, `showAxis`, `showAllObjectRadii`, `activeObjectId`, `pendingCell`, `pendingCycleState`, `targetContextObjectId` | Tampilan editor, selection, placement, dan menu konteks |
| `IPState.camera` | `followObjectEnabled`, `zoom`, `panPx`, `panPy`, `viewWidth`, `viewHeight`, `canvasDpr` | Follow camera, zoom, pan, ukuran viewport, dan resolusi Canvas |
| `IPState.input` | `drag`, `movedDuringDrag`, `lastX`, `lastY`, `pressedKeys` | Status pointer drag dan tombol keyboard |
| `IPState.runtime` | `lastDrawnVisualSig`, `spriteUidCounter`, `pageVisible` | Penanda redraw, identitas sprite, dan visibilitas halaman |
| `IPState.sprites` | `previewPlaying`, `previewStartTime`, `clock`, `cache` | Preview sprite, waktu animasi, dan cache runtime |
| `IPState.simulation` | `lastFrameTime`, `npcPlansThisFrame` | Timestamp frame dan batas perencanaan path NPC |
| `IPState.perf` | `dprCap`, `slowFrames` | Penyesuaian resolusi ketika browser mengalami frame lambat |
| `IPState.sandbox` | `active`, `comparisonValues` | Mode Sandbox dan snapshot untuk mendeteksi perubahan state |

`pressedKeys` menyimpan flag `up`, `down`, `left`, `right`, dan `shift`. Flag `shift` ditambahkan sebagai bagian dari interaksi keyboard saat runtime.

## 3. Koordinat objek

Setiap objek menyimpan posisi planar melalui `u` dan `v`. Properti `h` adalah offset vertikal milik objek tersebut; proyeksi, renderer, hit-testing, dan kamera membaca nilai yang sama. Tidak ada data ketinggian per petak di state world.

## 4. Satu sumber kebenaran Sandbox

`IPState.sandbox.active` menjadi sumber kebenaran untuk mode Sandbox. Fungsi `isSandboxMode()` di `core/state.js` menyediakan pembacaan konsisten.

Class CSS `body.sandbox` hanya mengatur penampilan halaman. Gameplay, collision, dan input tidak boleh menyimpulkan mode permainan dari class CSS.

## 5. Konfigurasi

`core/config.js` menyimpan nilai yang relatif tetap, antara lain:

- Proyeksi isometrik: `a`, `cos`, `sin`, `s`.
- Delapan arah gerak dan delapan arah sprite.
- State animasi dan batas FPS sprite.
- Batas waktu, retry, dan budget pathfinding NPC.
- Nama database/store dan masa berlaku sesi Sandbox.

## 6. Akses state dari modul

Semua kode aktif menggunakan `import { IPState } from '../core/state.js'` (jalur relatif menyesuaikan folder). Tidak ada getter/setter global lama seperti `worldSize`, `cubes`, atau `activeObjectId`; gunakan properti eksplisit, misalnya `IPState.world.size` atau `IPState.editor.activeObjectId`.

Contoh:

```js
import { IPState } from '../core/state.js';

IPState.world.size = 16;
IPState.editor.activeObjectId = null;
```

Hindari membuat state duplikat di modul lain. Jika sebuah nilai dibutuhkan banyak subsistem, tentukan dahulu apakah nilai itu benar-benar shared state atau cukup menjadi variabel lokal.

## 7. Entry point dan lifecycle

`index.html` memuat satu file module: `js/main.js`. Entry point menghubungkan event bridge, host Canvas/editor, input keyboard, command handler, loop simulasi, dan pemulihan Sandbox.

Tidak ada daftar classic-script dan ES-Module yang perlu dipelihara terpisah. Hubungan dependency diatur melalui import/export setiap file.

## 8. Catatan pengembangan

- Tambahkan properti state hanya jika nilainya memang perlu dibagi antar-sistem atau bertahan antar-frame.
- Nilai yang hanya dipakai saat satu fungsi berjalan harus tetap lokal.
- Modul UI boleh membaca/memperbarui DOM, sedangkan modul model/gameplay sebaiknya tidak.
- Ketika menambah properti world, pertimbangkan juga serialization, collision, rendering, dan Sandbox snapshot.
- Pengujian integrasi menyeluruh dijalankan setelah pemisahan modul selesai sesuai workflow proyek.
