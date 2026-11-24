export const OBJECT_SCALE_MIN = 0.2;
export const OBJECT_SCALE_STEP = 0.2;

export function normalizeObjectScale(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) {
    return 1;
  }

  const steps = Math.max(
    1,
    Math.round(Number(value) / OBJECT_SCALE_STEP)
  );

  return Number((steps * OBJECT_SCALE_STEP).toFixed(1));
}

export function stepObjectScale(value, direction) {
  const current = normalizeObjectScale(value);

  const steps = Math.max(
    1,
    Math.round(current / OBJECT_SCALE_STEP) + Math.sign(direction)
  );

  return Number((steps * OBJECT_SCALE_STEP).toFixed(1));
}