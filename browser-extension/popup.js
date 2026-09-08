const status = document.querySelector('#status');
async function refresh() { status.textContent = (await chrome.storage.session.get('status')).status || 'Ready.'; }
document.querySelector('#connect').onclick = async () => { await chrome.runtime.sendMessage({ type: 'connect' }); await refresh(); };
chrome.storage.onChanged.addListener(refresh);
refresh();
