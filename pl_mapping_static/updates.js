/* Independent of file/analysis state: update errors never reach the analysis error panel. */
function updateMessage(result) {
  if (result.status === 'unavailable') return result.error || 'Update check unavailable. Local work is unaffected.';
  if (!result.latest_version) return 'No releases in the selected channel yet.';
  if (result.update_available) return `New version ${result.latest_version}${result.prerelease ? ' (preview)' : ''} is available. Open the release page to choose your OS package.`;
  return `Installed: v${result.current_version}. Latest published: ${result.latest_version}. No newer version available.`;
}
if (typeof document !== 'undefined') {
  const check = document.getElementById('check-updates');
  const automatic = document.getElementById('auto-updates');
  const preview = document.getElementById('preview-updates');
  const status = document.getElementById('update-status');
  const link = document.getElementById('release-link');
  const storageKey = 'pl-update-preferences-v1';
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    automatic.checked = saved.automatic !== false;
    preview.checked = saved.preview !== false;
  } catch {}
  function savePreferences() {
    try { localStorage.setItem(storageKey, JSON.stringify({automatic:automatic.checked,preview:preview.checked})); } catch {}
  }
  let pending = false;
  async function checkUpdates(force=false) {
    if (pending) return;
    pending = true;
    check.disabled = true;
    status.textContent = 'Checking GitHub…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`/api/update-check?force=${force ? '1' : '0'}&preview=${preview.checked ? '1':'0'}`, {signal:controller.signal});
      if (!response.ok) throw new Error('Update lookup failed');
      const result = await response.json();
      status.textContent = updateMessage(result);
      status.classList.toggle('update-available', Boolean(result.update_available && result.status === 'ok'));
      const prefix = 'https://github.com/kirudin/Project-PL-mapping_opener/releases';
      if (result.release_url === prefix || result.release_url?.startsWith(prefix+'/tag/')) link.href = result.release_url;
      link.textContent = result.update_available ? `Open ${result.latest_version} release` : 'Open releases';
    } catch {
      status.textContent = 'Could not check GitHub. Local work is unaffected; try again later.';
      status.classList.remove('update-available');
    } finally {
      clearTimeout(timeout);
      pending = false;
      check.disabled = false;
    }
  }
  check.addEventListener('click', () => checkUpdates(true));
  automatic.addEventListener('change', () => {savePreferences(); if (automatic.checked) checkUpdates();});
  preview.addEventListener('change', () => {savePreferences(); checkUpdates();});
  if (automatic.checked) checkUpdates();
  setInterval(() => {if (automatic.checked && document.visibilityState === 'visible') checkUpdates();}, 86400000);
}
if (typeof module !== 'undefined') module.exports = {updateMessage};
