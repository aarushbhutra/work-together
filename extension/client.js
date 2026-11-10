export const isExtension = !!globalThis.chrome?.runtime?.id;
export async function getSession() {
  return isExtension ? (await chrome.storage.local.get('session')).session : JSON.parse(sessionStorage.getItem('study-session') || 'null');
}
export async function saveSession(session) {
  if (isExtension) await chrome.storage.local.set({ session });
  else sessionStorage.setItem('study-session', JSON.stringify(session));
}
export async function api(base, path, data, token) {
  const response = await fetch(base.replace(/\/$/, '') + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(8000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not connect to your room.');
  return result;
}
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
