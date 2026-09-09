const status = document.querySelector('#status');
const keep = document.querySelector('#keep');
let saving = false;
let revision = 0;

async function refresh() {
  const current = ++revision;
  try {
    const [session, local] = await Promise.all([chrome.storage.session.get('status'), chrome.storage.local.get('keepConnected')]);
    if (saving || current !== revision) return;
    status.textContent = session.status || 'Ready.';
    keep.checked = local.keepConnected === true;
  } catch {
    status.textContent = 'Reload Supermarket Tesco Connect at chrome://extensions, then reopen this popup.';
  }
}

document.querySelector('#connect').onclick = async () => {
  status.textContent = 'Connecting…';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'connect' });
    if (!result) throw new Error('No response');
    await refresh();
  } catch {
    status.textContent = 'Connection helper did not respond. Reload this extension at chrome://extensions and try again.';
  }
};

keep.onchange = async () => {
  saving = true;
  revision++;
  keep.disabled = true;
  const on = keep.checked;
  let saved = false;
  try {
    await chrome.storage.local.set({ keepConnected: on });
    saved = true;
    const result = await chrome.runtime.sendMessage({ type: 'keep', on });
    if (!result?.ok) throw new Error('No acknowledgement');
    saving = false;
    await refresh();
  } catch {
    status.textContent = saved
      ? 'Setting saved, but the background helper could not update. Reload this extension at chrome://extensions.'
      : 'Could not save the setting. Reload this extension at chrome://extensions.';
  } finally { saving = false; keep.disabled = false; }
};

chrome.storage.onChanged.addListener(() => { if (!saving) void refresh(); });
refresh();
