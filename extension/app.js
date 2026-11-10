import { isExtension, getSession, saveSession, api, escape as e } from './client.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
let session = await getSession();
let room = null;
let preview = false;
let connectionError = '';
let toastTimer;
let inFlight = false;
const defaultBase = isExtension ? 'http://localhost:8787' : location.origin;
const track = (n = 7) => `<div class="preview-track">${Array.from({ length: 16 }, (_, i) => `<i class="${i < n ? 'filled' : ''}"></i>`).join('')}</div>`;
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4200); }
function modal(content, eyebrow = 'LET’S MAKE SOME ROOM') { document.querySelector('#dialog-eyebrow').textContent = eyebrow; document.querySelector('#dialog-content').innerHTML = content; if (!dialog.open) dialog.showModal(); }
document.querySelector('#close-dialog').onclick = () => dialog.close();
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
function showHelp(fine = false) {
  modal(fine ? `<h2>A few honest details.</h2><ul class="rules-list"><li>Everyone installs the extension and connects to the same room server.</li><li>Only blocked domains and your request reason are shared. Your full browsing history stays with you.</li><li>Approvals require every other member present when the request was made. Offline members still need to vote.</li><li>A pass lasts five minutes. Requests expire after ten minutes. Leaving cancels affected pending requests.</li><li>This is friendly accountability. You can leave the room or disable the extension at any time.</li><li>The included server keeps rooms in memory. Restarting it resets rooms. Use HTTPS when hosting for friends.</li></ul>` : `<h2>Good habits. Great company.</h2><ul class="rules-list"><li><b>01 · Find your people.</b><br>Create a room and share the six-character code with your friends.</li><li><b>02 · Leave distractions at the door.</b><br>Anyone can add a website to your shared blocklist. The room creator can remove one.</li><li><b>03 · Ask for a little detour.</b><br>Try a blocked website and ask the room for a five-minute pass. Everyone else must say yes.</li></ul><p>Friends get an extension notification and can vote there or in the room. Enable Chrome notifications in your system settings.</p>`, fine ? 'THE FINE PRINT' : 'THE GROUP PROJECT YOU’LL ACTUALLY LIKE');
}
document.querySelector('#how-button').onclick = () => showHelp();
document.querySelector('#footer-help').onclick = () => showHelp(true);

function welcome() {
  app.innerHTML = `<div class="welcome-top"><div class="breadcrumb"><span>YOUR DAILY DOSE OF FOCUS</span><span> / </span><span>WITH FRIENDS</span></div><span class="status-pill"><span class="dot"></span> Better, together</span></div>
    <section class="welcome-hero"><div class="hero-copy"><span class="eyebrow"><span class="orange-line"></span>A LITTLE COLLECTIVE ACCOUNTABILITY</span><h1>Big plans.<br>Fewer tabs.<br><em>Better together.</em></h1><p class="intro-copy">Your focus deserves some good company.<br>A shared study room, a few blocked distractions,<br>and friends who keep you on track.</p><div class="hero-buttons"><button class="button primary" data-action="create">Create a room <span>↗</span></button><button class="button" data-action="join">Join a room <span>+</span></button></div><p class="hero-note">FREE TO FOCUS. BEST WITH FRIENDS.</p><div class="onboarding-preview">Just looking? <button class="text-button" data-action="preview">Take a peek inside ↗</button></div></div>
    <div class="preview-wrap" aria-label="An illustrative study room preview"><div class="scribble-label">a room for your good intentions <span>⤵</span></div><div class="preview-card"><div class="preview-header"><p class="preview-title">The study club<span style="color:var(--orange)">.</span></p><span class="panel-label">A LITTLE PREVIEW</span></div><div class="preview-content"><div class="preview-members"><span class="avatar you">Y<span class="dot"></span></span><span class="avatar peach">J<span class="dot"></span></span><span class="avatar yellow">M<span class="dot"></span></span><span class="avatar">A<span class="dot"></span></span><span>4 minds. One mission.</span></div><div class="preview-timer"><span class="eyebrow">IN OUR FOCUS ERA</span><strong>24:38</strong><p>MINUTES WELL SPENT</p>${track()}</div><div class="sample-request"><span class="request-icon">↗</span><div><p><b>Jamie</b> wants to visit <b>youtube.com</b></p><small>A quick detour? Only if everyone says yes.</small></div></div></div></div><div class="preview-stamp">Friends don’t let friends doomscroll.</div><span class="flower" aria-hidden="true">✳</span></div></section>
    <div class="divider"></div><section><div class="section-heading"><h2>Less willpower. More people power.</h2><span class="aside">Three steps. A little less temptation.</span></div><div class="steps"><article class="step"><span class="step-number">01</span><div><h3>Make yourself a little room.</h3><p>Create a room, send your friends the code, and settle in. Your study club is in session.</p></div></article><article class="step"><span class="step-number">02</span><div><h3>Put distractions on the list.</h3><p>Choose the websites that can wait. One shared blocklist keeps everyone on the same page.</p></div></article><article class="step"><span class="step-number">03</span><div><h3>A detour takes a group yes.</h3><p>Need a blocked site? Ask your friends. Everyone approves, and you get five minutes.</p></div></article></div></section>`;
}

function roomForm(join = false) {
  modal(`<h2>${join ? 'Your people are waiting.' : 'Make room for focus.'}</h2><p>${join ? 'A code, a name, and you’re in good company.' : 'Start a little study club. Invite some good company.'}</p><form id="room-form"><label for="your-name">Your name</label><input id="your-name" name="name" placeholder="What should we call you?" maxlength="32" required autocomplete="given-name"><label for="room-input">${join ? 'Room code' : 'Room name'}</label><input id="room-input" name="${join ? 'code' : 'roomName'}" placeholder="${join ? 'e.g. FOCUS7' : 'e.g. The study club'}" ${join ? 'pattern="[A-Za-z2-9]{6}" minlength="6" maxlength="6"' : 'maxlength="60"'} required ${join ? 'style="text-transform:uppercase;letter-spacing:3px"' : ''}><details><summary>Room server settings</summary><label for="server-url">Server URL</label><input id="server-url" name="base" type="url" value="${e(session?.base || defaultBase)}" required><p>Everyone needs the same server address. For local testing, run <code>npm start</code>. For friends on other networks, host the included server with HTTPS.</p></details><p class="form-error" id="form-error" role="alert"></p><button class="button primary" type="submit">${join ? 'Join the room' : 'Create my room'} <span>↗</span></button></form>`, join ? 'PULL UP A CHAIR' : 'LET’S MAKE SOME ROOM');
  document.querySelector('#room-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const url = new URL(values.base);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Enter a server origin, like https://study.example.com.');
      const result = await api(url.origin, join ? 'join' : 'create', values);
      session = { base: url.origin, code: result.room.code, token: result.token };
      await saveSession(session);
      room = result.room; preview = false; connectionError = '';
      if (isExtension) await chrome.runtime.sendMessage({ type: 'sync' });
      dialog.close(); render();
      toast(join ? 'You’re in. Let’s make some room for focus.' : 'Room created. Invite a friend to get started.');
    } catch (err) { document.querySelector('#form-error').textContent = err.message === 'Failed to fetch' ? 'Could not reach the server. Start npm start, or check the server URL.' : err.message; }
    finally { button.disabled = false; }
  };
}
function makePreview() {
  preview = true;
  room = { code: 'FOCUS7', name: 'The study club', you: 'you', isOwner: true, startedAt: Date.now() - 24 * 60_000 - 38_000, blocked: ['youtube.com', 'instagram.com', 'tiktok.com', 'reddit.com'], members: [{ id: 'you', name: 'You', isYou: true, isOwner: true }, { id: 'jamie', name: 'Jamie' }, { id: 'milo', name: 'Milo' }, { id: 'alex', name: 'Alex' }], requests: [{ id: 'sample', requester: 'jamie', name: 'Jamie', domain: 'youtube.com', reason: 'Need a walkthrough for this calculus problem.', voters: ['you', 'milo', 'alex'], votes: { milo: true, alex: true }, status: 'pending', createdAt: Date.now() }], activity: [{ id: 'a1', text: 'Jamie asked to open youtube.com.', kind: 'request', at: Date.now() - 25_000 }, { id: 'a2', text: 'Alex added reddit.com to the blocklist.', kind: 'block', at: Date.now() - 180_000 }, { id: 'a3', text: 'Milo joined the room.', kind: 'join', at: Date.now() - 300_000 }] };
  render();
}
const initials = name => e(name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2));
const avatar = (member, index = 0) => `<span class="avatar ${member.isYou ? 'you' : index % 3 === 1 ? 'peach' : index % 3 === 2 ? 'yellow' : ''}">${initials(member.name)}</span>`;
function age(at) { const minutes = Math.floor((Date.now() - at) / 60_000); return minutes < 1 ? 'JUST NOW' : `${minutes} MIN AGO`; }
function requestCard(r) {
  const votes = r.voters.filter(id => r.votes[id] === true).length;
  const canVote = r.status === 'pending' && r.voters.includes(room.you) && !Object.hasOwn(r.votes, room.you);
  const status = r.status === 'pending' ? (r.requester === room.you ? 'Waiting for your friends. Good things take a little patience.' : 'Your vote is in. Waiting for the rest of the room.') : ({ approved: r.until > Date.now() ? 'A unanimous yes! Five-minute pass is active.' : 'Five-minute pass finished. Back to focus.', denied: 'The room said no. Let’s keep the focus going.', expired: 'This request expired. Ask again if you still need it.', cancelled: 'Room membership changed. Please ask again.' })[r.status];
  return `<article class="request-card"><div class="request-heading"><span class="request-icon">↗</span><div><p><b>${e(r.requester === room.you ? 'You' : r.name)}</b> ${r.requester === room.you ? 'want' : 'wants'} a little detour</p><small>${e(r.domain)} · 5-minute pass</small></div></div><p class="request-reason">“${e(r.reason)}”</p><div class="vote-progress"><span>${votes} of ${r.voters.length} friends approved</span><div class="vote-dots">${r.voters.map(id => `<i class="${r.votes[id] === true ? 'yes' : ''}"></i>`).join('')}</div></div>${canVote ? `<div class="request-buttons"><button class="button small" data-action="vote-no" data-id="${e(r.id)}">Keep blocked</button><button class="button small primary" data-action="vote-yes" data-id="${e(r.id)}">Allow 5 minutes <span>✓</span></button></div>` : `<div class="request-status">${e(status)}</div>`}</article>`;
}
function render() {
  if (!room) { welcome(); return; }
  const pending = room.requests.filter(r => r.status === 'pending');
  const requests = [...pending, ...room.requests.filter(r => r.status !== 'pending').slice(0, 2)];
  app.innerHTML = `${preview ? `<div class="preview-banner"><span>A LITTLE PREVIEW · These are sample people and requests. Website blocking is off.</span><button class="text-button" data-action="create">Make it yours ↗</button></div>` : ''}${connectionError ? `<div class="connection-banner" role="alert">Connection paused: ${e(connectionError)}. Existing blocks stay active in the extension. <button class="text-button" data-action="retry">Retry ↗</button></div>` : ''}${!isExtension && !preview ? `<div class="connection-banner">Browser room view · Install the Chrome extension to block websites and receive notifications.</div>` : ''}<div class="welcome-top room-dashboard-top"><div class="breadcrumb"><button class="text-button" data-action="home">YOUR STUDY SPACE</button><span>/</span><span>THE COMMON ROOM</span></div><span class="status-pill"><span class="dot"></span>${preview ? 'Sample room' : connectionError ? 'Reconnecting' : 'Room connected'}</span></div><section class="room-heading"><div><span class="eyebrow"><span class="orange-line"></span>GOOD COMPANY. BETTER FOCUS.</span><h1>${e(room.name)}<span style="color:var(--orange)">.</span></h1><p>${room.members.length === 1 ? 'One good intention. Now invite some good company.' : `${room.members.length} minds. One shared commitment to getting things done.`}</p></div><div class="room-actions"><button class="button" data-action="invite"><span class="room-code">${e(room.code)}</span><span>Copy invite ↗</span></button><button class="button" data-action="leave">${preview ? 'Exit preview' : 'Leave room'}</button></div></section><div class="dashboard"><div class="left-stack"><section class="panel"><div class="panel-head"><h2>The distraction list <span class="count">${room.blocked.length}</span></h2><span class="panel-label">A SHARED PROMISE</span></div><div class="panel-body"><p class="block-intro">A few things that can wait. Blocked for everyone in the room.</p><div id="site-list">${room.blocked.length ? room.blocked.map(host => `<div class="site-row"><span class="site-icon">${e(host[0].toUpperCase())}</span><div class="site-meta"><strong>${e(host)}</strong><small>Including subdomains</small></div><span class="blocked-label">blocked</span>${room.isOwner ? `<button class="remove-site" data-action="remove" data-domain="${e(host)}" aria-label="Remove ${e(host)} from blocklist">×</button>` : ''}</div>`).join('') : '<p class="block-intro">A fresh page. Add your first distraction below.</p>'}</div><form class="block-form" id="block-form"><input name="domain" aria-label="Website to block" placeholder="Add a website, e.g. x.com" required maxlength="253"><button class="button small dark" type="submit">Add to list <span>+</span></button></form></div></section><section class="panel"><div class="panel-head"><h2>A little detour? <span class="count">${pending.length}</span></h2><button class="text-button" data-action="ask">Ask the room ↗</button></div><div id="requests">${requests.length ? requests.map(requestCard).join('') : `<div class="empty-state"><span class="empty-symbol">✳</span><h3>All quiet. All focused.</h3><p>When someone tries a blocked website, their request lands here. A little detour takes everyone’s yes.</p></div>`}</div></section><div class="house-note"><span>✳</span><div>A little peer pressure.<br>The good kind.</div><span class="eyebrow" style="font-style:normal;font-size:9px;margin-left:auto;max-width:185px;line-height:1.8">EVERYONE SAYS YES, OR THE TAB STAYS CLOSED.</span></div></div><aside class="right-stack"><section class="panel timer-panel"><div class="timer-top"><span class="panel-label">IN OUR FOCUS ERA</span><span class="live-label"><span class="dot"></span>Elapsed</span></div><div class="timer-main"><strong id="elapsed">00:00</strong><span class="timer-flower" aria-hidden="true">✳</span></div><p class="timer-note">Since the room opened. Every minute counts.</p>${track()}</section><section class="panel"><div class="panel-head"><h2>Your good company</h2><span class="count">${room.members.length}</span></div><div class="panel-body">${room.members.map((m, i) => `<div class="member-row">${avatar(m, i)}<div class="member-text">${e(m.name)}${m.isYou ? '<span class="you-label">(you)</span>' : ''}<small>${m.isOwner ? 'Room creator' : 'In the study club'}</small></div><span style="font-size:9px;color:var(--muted)">Joined</span></div>`).join('')}<div class="invite-note">There’s room for a little more company.<br><button class="text-button" data-action="invite">Invite a friend <span>↗</span></button></div></div></section><section class="panel"><div class="panel-head"><h2>The room, lately</h2><span class="panel-label">↙</span></div><div class="panel-body">${room.activity.slice(0, 5).map(a => `<div class="activity-item"><span class="activity-dot">${a.kind === 'join' ? '+' : a.kind === 'request' ? '↗' : '⊘'}</span><div><p>${e(a.text)}</p><small>${age(a.at)}</small></div></div>`).join('')}</div></section></aside></div>`;
  tick();
  document.querySelector('#block-form').onsubmit = async event => { event.preventDefault(); const form = event.currentTarget; const domain = new FormData(form).get('domain'); const button = form.querySelector('button'); button.disabled = true; try { await action('block', { domain }); toast('One less distraction. Added to the shared list.'); } catch (err) { toast(err.message); button.disabled = false; } };
}
function tick() {
  const el = document.querySelector('#elapsed');
  if (!el || !room) return;
  const seconds = Math.max(0, Math.floor((Date.now() - room.startedAt) / 1000));
  el.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
async function action(type, data) {
  if (preview) {
    if (type === 'block') {
      let host;
      try { host = new URL(String(data.domain).includes('://') ? data.domain : 'https://' + data.domain).hostname.replace(/^www\./, ''); } catch { throw new Error('Enter a valid website.'); }
      if (!host.includes('.')) throw new Error('Enter a website domain, like youtube.com.');
      if (!room.blocked.includes(host)) room.blocked.push(host);
    } else if (type === 'unblock') room.blocked = room.blocked.filter(d => d !== data.domain);
    else if (type === 'vote') { const r = room.requests.find(r => r.id === data.id); r.votes.you = data.allow; r.status = data.allow ? 'approved' : 'denied'; if (data.allow) r.until = Date.now() + 300_000; }
    else if (type === 'request') { room.requests.unshift({ id: 'preview-' + Date.now(), requester: 'you', name: 'You', domain: data.domain, reason: data.reason || 'A quick study break', voters: ['jamie', 'milo', 'alex'], votes: {}, status: 'pending', createdAt: Date.now() }); }
    render(); return;
  }
  room = await api(session.base, `rooms/${session.code}/${type}`, data, session.token);
  if (isExtension) await chrome.runtime.sendMessage({ type: 'sync' });
  render();
}
function requestForm() {
  if (!room.blocked.length) { toast('Add a blocked website first.'); return; }
  modal(`<h2>A little detour?</h2><p>Ask everyone else for a five-minute pass. A single no keeps the website blocked.</p><form id="request-form"><label for="request-domain">The website</label><select id="request-domain" name="domain">${room.blocked.map(d => `<option value="${e(d)}">${e(d)}</option>`).join('')}</select><label for="request-reason">What’s the occasion?</label><input id="request-reason" name="reason" placeholder="e.g. A tutorial for this tricky problem" required maxlength="160"><p class="form-error" id="form-error" role="alert"></p><button class="button primary">Ask the room <span>↗</span></button></form>`, 'A GROUP YES, OR BACK TO FOCUS');
  document.querySelector('#request-form').onsubmit = async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; try { await action('request', Object.fromEntries(new FormData(form))); dialog.close(); toast('Request sent. Let’s see what the room thinks.'); } catch (err) { document.querySelector('#form-error').textContent = err.message; button.disabled = false; } };
}
app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const type = button.dataset.action;
  try {
    if (type === 'create') roomForm();
    else if (type === 'join') roomForm(true);
    else if (type === 'preview') makePreview();
    else if (type === 'home') { if (!preview) toast('You’re in your study space. Looking good.'); else { preview = false; room = null; welcome(); } }
    else if (type === 'ask') requestForm();
    else if (type === 'retry') await refresh(true);
    else if (type === 'remove') {
      modal(`<h2>Take it off the list?</h2><p>Remove <b>${e(button.dataset.domain)}</b> for everyone in the room. New visits to this website will be allowed.</p><button class="button primary" id="confirm-remove">Remove website <span>↗</span></button>`, 'A CHANGE TO THE SHARED PROMISE');
      document.querySelector('#confirm-remove').onclick = async () => { try { await action('unblock', { domain: button.dataset.domain }); dialog.close(); toast('Website removed from the shared list.'); } catch (err) { toast(err.message); } };
    } else if (type.startsWith('vote-')) { button.disabled = true; await action('vote', { id: button.dataset.id, allow: type === 'vote-yes' }); toast(type === 'vote-yes' ? 'Your yes is in. Every friend gets a say.' : 'Kept blocked. Back to the good stuff.'); }
    else if (type === 'invite') {
      if (preview) { toast('This is a sample code. Create a room to invite friends.'); return; }
      const text = `Study Together · ${room.name}\nRoom code: ${room.code}\nRoom server: ${session.base}\nOpen Study Together, choose Join a room, and enter this code and server URL.`;
      try { await navigator.clipboard.writeText(text); toast('Invite copied. Send it to your study people.'); } catch { modal(`<h2>Pull up another chair.</h2><p>Share these details with your friends.</p><label>Room code</label><input readonly value="${e(room.code)}"><label>Room server</label><input readonly value="${e(session.base)}">`, 'INVITE SOME GOOD COMPANY'); }
    } else if (type === 'leave') {
      if (preview) { preview = false; room = null; welcome(); return; }
      modal('<h2>Calling it a session?</h2><p>Leaving removes website blocks on your browser. Any pending requests involving you will be cancelled. Your friends can keep studying.</p><p class="form-error" id="leave-error" role="alert"></p><button class="button primary" id="confirm-leave">Leave the room <span>↗</span></button>', 'EVERY GOOD SESSION HAS AN END');
      document.querySelector('#confirm-leave').onclick = async event => {
        const confirm = event.currentTarget; confirm.disabled = true;
        try {
          await api(session.base, `rooms/${session.code}/leave`, {}, session.token);
          await saveSession(null); session = null; room = null;
          if (isExtension) await chrome.runtime.sendMessage({ type: 'sync' });
          dialog.close(); welcome(); toast('Session complete. See you in the next one.');
        } catch (err) { document.querySelector('#leave-error').textContent = 'Could not leave the room: ' + err.message + ' Reconnect and try again.'; confirm.disabled = false; }
      };
    }
  } catch (err) { toast(err.message); button.disabled = false; }
});
async function refresh(force = false) {
  if (!session || preview || inFlight) return;
  inFlight = true;
  try {
    const next = await api(session.base, `rooms/${session.code}`, undefined, session.token);
    const changed = JSON.stringify(next) !== JSON.stringify(room) || connectionError;
    connectionError = ''; room = next;
    // Preserve partially entered forms when the shared state has not changed.
    if (changed || force) render();
  } catch (err) {
    connectionError = err.message === 'Failed to fetch' ? 'Could not reach the room server' : err.message;
    if (room) render();
    else {
      welcome();
      const banner = document.createElement('div'); banner.className = 'connection-banner';
      const text = document.createElement('span'); text.textContent = 'Could not restore your room: ' + connectionError + '. ';
      const retry = document.createElement('button'); retry.className = 'text-button'; retry.textContent = 'Try again ↗'; retry.dataset.action = 'retry';
      const reset = document.createElement('button'); reset.className = 'text-button'; reset.textContent = 'Forget room'; reset.style.marginLeft = '16px';
      reset.onclick = async () => { await saveSession(null); session = null; room = null; if (isExtension) await chrome.runtime.sendMessage({ type: 'sync' }); welcome(); };
      banner.append(text, retry, reset); app.prepend(banner);
    }
  } finally { inFlight = false; }
}
welcome();
if (session) await refresh();
setInterval(tick, 1000);
setInterval(() => { if (!dialog.open && !document.activeElement?.matches('input,select')) refresh(); }, 3000);
