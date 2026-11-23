/*
 * IsoPlayground — selection and gameplay overlays.
 *
 * Layer ini hanya menggambar informasi tambahan di atas objek: radius interaksi,
 * damage popup, nama, HP bar Sandbox, serta tanda awareness NPC.
 */
import { IPConfig } from '../core/config.js';
import { IPState, isSandboxMode } from '../core/state.js';
import { getSpriteForObject } from './sprites.js';
import { getRoleCombatDefaults } from '../world/roles.js';
import { getCubeFaces, getSpriteScreenRect } from './renderGeometry.js';

function drawActiveObjectLabel(x, p3d, object) {
  const spriteRect = getSpriteScreenRect(p3d, object, getSpriteForObject(object));
  const faces = spriteRect ? null : getCubeFaces(p3d, object);
  const labelX = spriteRect ? spriteRect.centerX : faces.topCenter.x;
  const labelY = (spriteRect ? spriteRect.topY : Math.min(faces.t00.y, faces.t10.y, faces.t11.y, faces.t01.y)) - 10;

  x.font = '600 11px system-ui, -apple-system, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'bottom';
  x.fillStyle = '#ffffff';
  x.fillText(object.name, labelX, labelY);
  if (isSandboxMode() && (object.role === 'Player' || object.role === 'NPC')) {
    const defaults = getRoleCombatDefaults(object.role);
    const maxHp = Math.max(100, Math.min(10000, Number(object.maxHp) || defaults.maxHp));
    const hp = Math.max(0, Math.min(maxHp, Number.isFinite(Number(object.hp)) ? Number(object.hp) : maxHp));
    const barWidth = 38, barHeight = 4, top = labelY - 16;
    x.fillStyle = 'rgba(0,0,0,.65)';
    x.fillRect(labelX - barWidth / 2, top, barWidth, barHeight);
    x.fillStyle = hp > maxHp * 0.3 ? '#45d36a' : '#ff4545';
    x.fillRect(labelX - barWidth / 2, top, barWidth * (hp / maxHp), barHeight);
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.strokeRect(labelX - barWidth / 2, top, barWidth, barHeight);
    if (performance.now() < (object.flashUntil || 0)) {
      x.fillStyle = 'rgba(255,0,0,.45)';
      x.fillRect(labelX - barWidth / 2, top - 5, barWidth, barHeight + 20);
    }
  }
}



/** Draw selection/gameplay radii, transient combat feedback, and entity labels. */
export function drawGameplayOverlays(context, p3d) {
  const x = context;
  for (const object of IPState.world.cubes) {
    if (!IPState.editor.showAllObjectRadii && object.id !== IPState.editor.activeObjectId) continue;
    const center = p3d(object.u, object.v, (object.h ?? 0));
    const drawIsoArea = (radius, color) => {
      const rx = radius * IPConfig.s * IPState.camera.zoom * Math.sqrt(2) * IPConfig.cos;
      const ry = radius * IPConfig.s * IPState.camera.zoom * Math.sqrt(2) * IPConfig.sin;
      x.save();
      x.strokeStyle = color;
      x.lineWidth = 1;
      x.setLineDash([]);
      x.beginPath();
      x.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
      x.stroke();
      x.restore();
    };
    drawIsoArea(Math.max(0.25, object.hitArea ?? 1.5), 'rgba(255,255,255,.62)');
    drawIsoArea(Math.max(1, object.attackArea ?? 1.5), 'rgba(255,65,65,.72)');
    drawIsoArea(Math.max(object.attackArea ?? 1.5, object.detectionArea ?? 3), 'rgba(255,220,45,.72)');
  }

  for (const object of IPState.world.cubes) {
    if (!object.damagePopups) continue;
    object.damagePopups = object.damagePopups.filter(popup => performance.now() - popup.created < 850);
    for (const popup of object.damagePopups) {
      const activeSprite = getSpriteForObject(object);
      const position = p3d(object.u, object.v, (object.h ?? 0) + (activeSprite && activeSprite.loaded ? 2.2 : 1.5));
      const elapsed = performance.now() - popup.created;
      x.save();
      x.font = 'bold 15px system-ui';
      x.textAlign = 'center';
      x.fillStyle = '#ff6666';
      x.strokeStyle = 'rgba(0,0,0,.85)';
      x.lineWidth = 3;
      x.strokeText('-' + popup.value, position.x, position.y - 18 - elapsed * 0.035);
      x.fillText('-' + popup.value, position.x, position.y - 18 - elapsed * 0.035);
      x.restore();
    }
  }

  const activeObject = IPState.world.cubes.find(object => object.id === IPState.editor.activeObjectId);
  if (activeObject) drawActiveObjectLabel(x, p3d, activeObject);
  if (isSandboxMode()) {
    for (const combatant of IPState.world.cubes) {
      if ((combatant.role === 'Player' || combatant.role === 'NPC') && combatant.id !== IPState.editor.activeObjectId) {
        drawActiveObjectLabel(x, p3d, combatant);
      }
    }
  }

  // Tanda ! menunjukkan jarak ke area hit Player; ? menunjukkan detection area.
  const player = IPState.world.cubes.find(object => object.role === 'Player');
  if (player) {
    for (const npc of IPState.world.cubes) {
      if (npc.role !== 'NPC' || !npc.enemy) continue;
      const distance = Math.hypot(player.u - npc.u, player.v - npc.v);
      const npcDetect = Math.max(1, Number(npc.detectionArea) || 3);
      const playerDetect = Math.max(1, Number(player.detectionArea) || 3);
      const playerHit = Math.max(0.25, Number(player.hitArea) || 1.5);
      const alert = distance <= npcDetect + playerHit ? '!' :
        (distance <= npcDetect + playerDetect ? '?' : '');
      if (!alert) continue;
      const position = p3d(npc.u, npc.v, (npc.h ?? 0) + 1.15);
      x.save();
      x.font = 'bold 19px system-ui, -apple-system, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineWidth = 3;
      x.strokeStyle = 'rgba(20,20,20,.9)';
      x.strokeText(alert, position.x, position.y - 8);
      x.fillStyle = alert === '!' ? '#ff5252' : '#ffd54f';
      x.fillText(alert, position.x, position.y - 8);
      x.restore();
    }
  }
}
