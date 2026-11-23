/*
 * IsoPlayground — command console presentation adapter.
 *
 * Menangani panel console dan output pesannya. Parsing command dan eksekusi
 * perintah tidak berada di modul ini.
 */
export function setCommandOutput(message) {
  const element = document.getElementById('command-console-output');
  if (element) element.textContent = message;
}

export function toggleCommandConsole(force) {
  const panel = document.getElementById('command-console');
  const input = document.getElementById('command-console-input');
  if (!panel) return;
  const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  if (open) {
    input.value = '/';
    setTimeout(() => { input.focus(); input.setSelectionRange(1, 1); }, 0);
  } else if (input) {
    input.blur();
  }
}

export function installCommandConsoleButton() {
  document.getElementById('command-open-btn')?.addEventListener('click', () => toggleCommandConsole());
}
