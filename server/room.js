import { randomBytes, randomInt } from 'node:crypto';

export const rooms = new Map();
const credentials = new WeakMap();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function domain(value) {
  try {
    const input = String(value || '').trim();
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) fail('Enter a website domain, like youtube.com.');
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) fail('Enter a valid website domain.');
    return host;
  } catch { fail('Enter a valid website domain, like youtube.com.'); }
}
const token = () => randomBytes(24).toString('hex');
function member(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 32) fail('Your name should be 1–32 characters.');
  return { id: token(), name: name.trim(), joinedAt: Date.now() };
}
export function createRoom({ name, roomName }) {
  const person = member(name);
  const title = String(roomName || 'The study club').trim();
  if (!title || title.length > 60) fail('Room names should be 1–60 characters.');
  let code;
  do { code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join(''); } while (rooms.has(code));
  const room = { code, name: title, owner: person.id, members: [person], blocked: ['youtube.com', 'instagram.com', 'tiktok.com', 'reddit.com'], requests: [], activity: [], startedAt: Date.now() };
  rooms.set(code, room);
  const secret = token();
  credentials.set(room, new Map([[secret, person.id]]));
  log(room, `${person.name} started the room.`, 'join');
  return { token: secret, room: snapshot(room, person.id) };
}
export function joinRoom({ code, name }) {
  const room = rooms.get(String(code).trim().toUpperCase());
  if (!room) fail('No room with that code. Check it and try again.', 404);
  if (room.members.length >= 12) fail('This room is full (12 people max).');
  const person = member(name);
  room.members.push(person);
  const secret = token();
  credentials.get(room).set(secret, person.id);
  log(room, `${person.name} joined the room.`, 'join');
  return { token: secret, room: snapshot(room, person.id) };
}
function log(room, text, kind = 'focus') { room.activity.unshift({ id: token(), text, kind, at: Date.now() }); room.activity = room.activity.slice(0, 40); }
export function authenticate(code, credential) {
  const room = rooms.get(code);
  if (!room) fail('Room no longer exists. Create or join another room.', 404);
  const id = credentials.get(room)?.get(credential);
  const person = room.members.find(m => m.id === id);
  if (!person) fail('Please rejoin this room.', 401);
  return { room, person };
}
function expire(room) {
  for (const r of room.requests) {
    if (r.status === 'pending' && r.createdAt + 10 * 60_000 < Date.now()) r.status = 'expired';
  }
}
export function snapshot(room, viewer) {
  expire(room);
  return { ...room, owner: undefined, members: room.members.map(m => ({ ...m, isYou: m.id === viewer, isOwner: m.id === room.owner })), requests: room.requests.map(r => ({ ...r })), you: viewer, isOwner: viewer === room.owner };
}
export function act(room, person, action, data) {
  expire(room);
  if (action === 'block') {
    const host = domain(data.domain);
    if (room.blocked.length >= 100) fail('This room has reached its 100 website limit.');
    if (!room.blocked.includes(host)) { room.blocked.push(host); log(room, `${person.name} added ${host} to the blocklist.`, 'block'); }
  } else if (action === 'unblock') {
    if (person.id !== room.owner) fail('Only the room creator can remove websites.', 403);
    room.blocked = room.blocked.filter(d => d !== data.domain);
    log(room, `${person.name} removed ${data.domain} from the blocklist.`, 'block');
  } else if (action === 'request') {
    const host = domain(data.domain);
    if (!room.blocked.some(d => host === d || host.endsWith(`.${d}`))) fail('That website is not blocked.');
    if (room.members.length < 2) fail('Invite a friend first. Access needs someone else’s approval.');
    if (room.requests.some(r => r.requester === person.id && r.domain === host && (r.status === 'pending' || (r.status === 'approved' && r.until > Date.now())))) return snapshot(room, person.id);
    const r = { id: token(), requester: person.id, name: person.name, domain: host, reason: String(data.reason || 'A quick study break').slice(0, 160), voters: room.members.filter(m => m.id !== person.id).map(m => m.id), votes: {}, status: 'pending', createdAt: Date.now() };
    room.requests.unshift(r);
    room.requests = room.requests.slice(0, 100);
    log(room, `${person.name} asked to open ${host}.`, 'request');
  } else if (action === 'vote') {
    const r = room.requests.find(r => r.id === data.id);
    if (!r || r.status !== 'pending') fail('This request has already been resolved.');
    if (!r.voters.includes(person.id)) fail('You cannot vote on this request.', 403);
    if (Object.hasOwn(r.votes, person.id)) fail('You already voted.');
    if (typeof data.allow !== 'boolean') fail('Choose allow or keep blocked.');
    r.votes[person.id] = data.allow;
    if (!data.allow) { r.status = 'denied'; log(room, `The room kept ${r.domain} blocked for ${r.name}.`, 'block'); }
    else if (r.voters.every(id => r.votes[id] === true)) {
      r.status = 'approved'; r.until = Date.now() + 5 * 60_000;
      log(room, `Everyone approved ${r.domain} for ${r.name}. Five minutes, starting now.`, 'request');
    }
  } else if (action === 'leave') {
    room.members = room.members.filter(m => m.id !== person.id);
    // Leaving never silently grants a pending request.
    for (const r of room.requests) if (r.status === 'pending' && (r.requester === person.id || r.voters.includes(person.id))) r.status = 'cancelled';
    if (room.owner === person.id) room.owner = room.members[0]?.id;
    log(room, `${person.name} left the room.`, 'join');
    if (!room.members.length) rooms.delete(room.code);
  } else fail('Unknown action.', 404);
  return snapshot(room, person.id);
}
