/*
 * IsoPlayground — NPC navigation public API.
 *
 * Barrel module mempertahankan satu pintu impor untuk sistem NPC. Implementasi
 * pencarian jalur dan gerak waypoint dipisahkan agar masing-masing mudah
 * dikembangkan tanpa menggandakan aturan navigasi.
 */
export { npcGridCoord, npcGridIndex, npcFindPath } from './npcPathfinding.js';
export { nearestEightWayVector, npcAttackStandPoint, moveNpcAlongPath } from './npcMovement.js';
