const status = document.querySelector('#status');
const keep = document.querySelector('#keep');

async function refresh() {
  status.textContent = (await chrome.storage.session.get('status')).status || 'Ready.';
  keep.checked = (await chrome.storage.local.get('keepConnected')).keepConnected === true;
}

document.querySelector('#connect').onclick = async () => {
  status.textContent = 'Connecting…';
  await chrome.runtime.sendMessage({ type: 'connect' });
  await refresh();
};

keep.onchange = async () => {
  await chrome.runtime.sendMessage({ type: 'keep', on: keep.checked });
  await refresh();
};

chrome.storage.onChanged.addListener(refresh);
refresh();
