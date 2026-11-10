import { getSession, api, isExtension, escape as e } from './client.js';
const host = new URLSearchParams(location.search).get('domain') || '';
const content = document.querySelector('#blocked-content');
document.querySelector('#domain').textContent = host;
let session = await getSession();
let room;
let lastStatus = '';
let fetching = false;
let attempted = false;
let timer;
function form() {
  content.innerHTML = `<form id="ask-form"><label for="reason">What’s the occasion?</label><input id="reason" name="reason" required maxlength="160" placeholder="e.g. A tutorial for this tricky problem"><p id="error" class="form-error" role="alert"></p><button class="button primary" type="submit">Ask the room <span>↗</span></button></form>`;
  document.querySelector('#ask-form').onsubmit = async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try { room = await api(session.base, `rooms/${session.code}/request`, { domain: host, reason: new FormData(event.currentTarget).get('reason') }, session.token); lastStatus = ''; show(); }
    catch (err) { document.querySelector('#error').textContent = err.message; button.disabled = false; }
  };
}
function show() {
  const request = room.requests.find(r => r.requester === room.you && r.domain === host);
  const status = request?.status === 'approved' && request.until <= Date.now() ? 'expired-pass' : request?.status || 'none';
  if (status === 'pending') {
    lastStatus = status;
    const count = request.voters.filter(id => request.votes[id] === true).length;
    content.innerHTML = `<div class="waiting"><span class="eyebrow">THE ROOM IS THINKING</span><p>${count} of ${request.voters.length} friends approved.<br>Your website stays blocked until everyone says yes.</p></div>`;
  } else if (status === 'approved' && request.until > Date.now()) {
    lastStatus = status;
    content.innerHTML = `<div class="waiting"><span class="eyebrow">A UNANIMOUS YES</span><p>Everyone approved. Your five-minute pass ends at ${e(new Date(request.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}.</p><button class="button primary" id="open-website">Open ${e(host)} <span>↗</span></button><p id="open-error" class="form-error" role="alert"></p></div>`;
    document.querySelector('#open-website').onclick = async event => {
      event.currentTarget.disabled = true;
      try {
        const url = new URL('https://' + host);
        if (url.hostname !== host || !room.blocked.some(d => host === d || host.endsWith('.' + d))) throw new Error('Invalid blocked website.');
        if (isExtension) {
          const sync = await chrome.runtime.sendMessage({ type: 'sync' });
          if (sync?.error) throw new Error(sync.error);
          // Navigation is rechecked by Chrome; only the server-approved rule permits access.
        }
        location.href = url.href;
      } catch (err) { document.querySelector('#open-error').textContent = err.message; event.target.disabled = false; }
    };
  } else if (lastStatus !== status || !content.children.length) {
    lastStatus = status;
    form();
    if (request) {
      const note = document.createElement('p');
      note.textContent = status === 'denied' ? 'The room kept it blocked. Back to focus, or ask again if your plans changed.' : status === 'cancelled' ? 'Room membership changed. Ask the room again.' : 'Your previous request or pass expired. Ask again if you still need access.';
      content.prepend(note);
    }
  }
}
async function refresh() {
  if (fetching) return;
  fetching = true;
  try {
    session = await getSession();
    if (!session) { content.innerHTML = '<p>You’re no longer in a room. Open Study Together to get started.</p>'; clearInterval(timer); return; }
    if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/.test(host)) { content.innerHTML = '<p>Open a blocked website to request a pass.</p>'; clearInterval(timer); return; }
    room = await api(session.base, `rooms/${session.code}`, undefined, session.token);
    if (!room.blocked.some(d => host === d || host.endsWith('.' + d))) {
      content.innerHTML = `<p>This website was removed from the room’s list.</p><a class="button primary" href="https://${e(host)}">Open website ↗</a>`; return;
    }
    if (!attempted) {
      attempted = true;
      const active = room.requests.some(r => r.requester === room.you && r.domain === host && (r.status === 'pending' || (r.status === 'approved' && r.until > Date.now())));
      if (!active) {
        try {
          room = await api(session.base, `rooms/${session.code}/request`, { domain: host, reason: 'Tried to open a blocked website.' }, session.token);
        } catch (err) {
          form();
          document.querySelector('#error').textContent = err.message;
          return;
        }
      }
    }
    show();
  } catch { if (!content.children.length) content.innerHTML = '<p>Could not reach the room server. The website stays blocked. We’ll keep trying.</p>'; }
  finally { fetching = false; }
}
timer = setInterval(refresh, 3000);
await refresh();
