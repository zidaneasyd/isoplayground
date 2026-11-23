/* Browser-only UI helpers. Keep DOM operations outside core/world/gameplay. */
export function releaseControlFocus(element) {
  const target = element || document.activeElement;
  if (target && target !== document.body && typeof target.blur === 'function') target.blur();
}
