/**
 * Carry what the page watcher saw across to the extension.
 *
 * A page script and an extension cannot speak to each other directly, so this
 * sits in between: it listens only for its own messages, only from this page,
 * and passes nothing else on.
 */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const message = event.data;
  if (message?.source !== 'supermarket-tesco') return;
  chrome.runtime
    .sendMessage({ type: 'tesco-headers-seen', host: message.host, headers: message.headers || {} })
    .catch(() => {});
});
