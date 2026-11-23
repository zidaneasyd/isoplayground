/*
 * IsoPlayground — world configuration normalization.
 *
 * Aturan ukuran bidang dunia dipakai oleh editor dan parser project. Diletakkan
 * di domain world agar UI tidak perlu mengimpor modul penyimpanan project.
 */
export function normalizeEvenSize(value) {
  let size = parseInt(value, 10);
  if (!Number.isFinite(size)) size = 12;
  size = Math.max(8, Math.min(48, size));
  if (size % 2 !== 0) size = Math.max(8, size - 1);
  return size;
}
