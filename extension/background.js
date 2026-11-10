import { api } from './client.js';
import { buildRules } from './rules.js';

let running;
let appliedRules = '';
async function updateRules(room) {
  const rules = buildRules(room, path => chrome.runtime.getURL(path));
  if (room) {
    room.requests.filter(r => r.requester === room.you && r.status === 'approved' && r.until > Date.now()).forEach(r => {
      chrome.alarms.create('expiry-' + r.id, { when: r.until });
    });
  }
  const signature = JSON.stringify(rules);
  if (signature === appliedRules) return;
  const previous = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: previous.map(r => r.id), addRules: rules });
  appliedRules = signature;
}
export function sync() {
  if (!running) running = performSync().finally(() => { running = null; });
  return running;
}
async function performSync() {
    const { session, notified = [] } = await chrome.storage.local.get(['session', 'notified']);
    if (!session) {
      await updateRules(null);
      await chrome.storage.local.remove(['room', 'notified', 'connectionError']);
      for (const id of Object.keys(await chrome.notifications.getAll())) await chrome.notifications.clear(id);
      await chrome.action.setBadgeText({ text: '' });
      return;
    }
    let room;
    try {
      room = await api(session.base, `rooms/${session.code}`, undefined, session.token);
      const current = (await chrome.storage.local.get('session')).session;
      if (JSON.stringify(current) !== JSON.stringify(session)) return performSync();
      await chrome.storage.local.set({ room, connectionError: '' });
    } catch (error) {
      // Cached block rules stay active offline; expired allowances are removed locally.
      const cached = await chrome.storage.local.get('room');
      const current = (await chrome.storage.local.get('session')).session;
      if (JSON.stringify(current) !== JSON.stringify(session)) return performSync();
      if (cached.room?.code === session.code) await updateRules(cached.room);
      await chrome.storage.local.set({ connectionError: error.message });
      await chrome.action.setBadgeText({ text: '!' });
      return;
    }
    await updateRules(room);
    const pending = room.requests.filter(r => r.status === 'pending' && r.voters.includes(room.you) && !Object.hasOwn(r.votes, room.you));
    await chrome.action.setBadgeText({ text: pending.length ? String(pending.length) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#f48360' });
    for (const id of Object.keys(await chrome.notifications.getAll())) {
      if (!pending.some(r => r.id === id)) await chrome.notifications.clear(id);
    }
    for (const r of pending) {
      if (notified.includes(r.id)) continue;
      await chrome.notifications.create(r.id, { type: 'basic', iconUrl: 'icon.png', title: `${r.name} wants a little detour`, message: `${r.domain}\n${r.reason}\nEveryone must approve a 5-minute pass.`, buttons: [{ title: 'Allow 5 minutes' }, { title: 'Keep blocked' }], requireInteraction: true });
      notified.push(r.id);
    }
    await chrome.storage.local.set({ notified: notified.slice(-100) });
}
chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('index.html') + '*' });
  if (tabs[0]) { await chrome.tabs.update(tabs[0].id, { active: true }); await chrome.windows.update(tabs[0].windowId, { focused: true }); }
  else await chrome.tabs.create({ url: 'index.html' });
});
chrome.notifications.onButtonClicked.addListener(async (id, index) => {
  try {
    const { session } = await chrome.storage.local.get('session');
    if (!session) return;
    await api(session.base, `rooms/${session.code}/vote`, { id, allow: index === 0 }, session.token);
    await chrome.notifications.clear(id);
    await sync();
  } catch { await chrome.tabs.create({ url: 'index.html' }); }
});
chrome.notifications.onClicked.addListener(() => chrome.windows.create({ url: 'index.html', type: 'popup', width: 980, height: 760 }));
chrome.alarms.onAlarm.addListener(() => { sync().catch(console.error); });
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('sync', { periodInMinutes: 0.5 }); sync().catch(console.error); });
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create('sync', { periodInMinutes: 0.5 }); sync().catch(console.error); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.type !== 'sync') return;
  sync().then(() => respond({ ok: true })).catch(e => respond({ error: e.message }));
  return true;
});
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.session) sync().catch(console.error); });
setInterval(() => sync().catch(console.error), 5000);
sync().catch(console.error);
