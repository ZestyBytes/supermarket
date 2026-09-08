// Managed Chrome is blocked by Tesco. Never silently relaunch it on API failure.
export async function refreshBrowserSession() { return false; }
