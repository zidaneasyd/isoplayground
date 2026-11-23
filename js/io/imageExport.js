/*
 * IsoPlayground — current Canvas image export.
 *
 * Mengunduh hasil render Canvas sebagai PNG. Tidak terlibat dengan format
 * project JSON atau proses import state.
 */
import { IPState } from '../core/state.js';

export function exportPNG() {
  const canvas = document.getElementById('c');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'iso-playground-' + IPState.world.size + 'x' + IPState.world.size + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
