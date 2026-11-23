/*
 * IsoPlayground — world background and coordinate guides.
 *
 * Menggambar bidang dasar, grid, dan sumbu koordinat dunia isometrik.
 */
import { IPState } from '../core/state.js';

export function drawWorldPlane(context, p3d) {
  const half = IPState.world.size / 2;
  const corners = [
    p3d(-half, -half, 0),
    p3d(half, -half, 0),
    p3d(half, half, 0),
    p3d(-half, half, 0)
  ];
  context.fillStyle = '#383838';
  context.beginPath();
  context.moveTo(corners[0].x, corners[0].y);
  for (let index = 1; index < corners.length; index += 1) {
    context.lineTo(corners[index].x, corners[index].y);
  }
  context.closePath();
  context.fill();
}

export function drawWorldGuides(context, p3d) {
  const half = IPState.world.size / 2;

  if (IPState.editor.showGrid) {
    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 0.6;
    for (let index = 0; index <= IPState.world.size; index += 1) {
      const position = -half + index;
      const a1 = p3d(position, -half, 0);
      const a2 = p3d(position, half, 0);
      const b1 = p3d(-half, position, 0);
      const b2 = p3d(half, position, 0);
      context.beginPath();
      context.moveTo(a1.x, a1.y);
      context.lineTo(a2.x, a2.y);
      context.moveTo(b1.x, b1.y);
      context.lineTo(b2.x, b2.y);
      context.stroke();
    }
  }

  if (!IPState.editor.showAxis) return;
  const negativeU = p3d(-half, 0, 0);
  const positiveU = p3d(half, 0, 0);
  const negativeV = p3d(0, -half, 0);
  const positiveV = p3d(0, half, 0);

  context.save();
  context.lineWidth = 1.4;
  context.strokeStyle = 'rgba(255, 77, 77, 0.45)';
  context.beginPath();
  context.moveTo(negativeU.x, negativeU.y);
  context.lineTo(positiveU.x, positiveU.y);
  context.stroke();

  context.strokeStyle = 'rgba(77, 166, 255, 0.45)';
  context.beginPath();
  context.moveTo(negativeV.x, negativeV.y);
  context.lineTo(positiveV.x, positiveV.y);
  context.stroke();

  context.font = '600 11px system-ui, -apple-system, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = 'rgba(126, 192, 255, 0.72)';
  context.fillText('-z', negativeV.x, negativeV.y - 11);
  context.fillText('+z', positiveV.x, positiveV.y + 12);
  context.fillStyle = 'rgba(255, 133, 133, 0.72)';
  context.fillText('-x', negativeU.x - 13, negativeU.y + 2);
  context.fillText('+x', positiveU.x + 13, positiveU.y + 2);
  context.restore();
}
