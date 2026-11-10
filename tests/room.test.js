import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rooms, createRoom, joinRoom, authenticate, act, snapshot, domain } from '../server/room.js';

beforeEach(() => rooms.clear());
function group() {
  const a = createRoom({ name: 'Ada', roomName: 'Exam club' });
  const b = joinRoom({ code: a.room.code, name: 'Ben' });
  const c = joinRoom({ code: a.room.code, name: 'Cam' });
  return [a, b, c].map(s => ({ ...s, ...authenticate(s.room.code, s.token) }));
}
test('credentials are private; public member IDs cannot impersonate voters', () => {
  const [a] = group();
  assert.notEqual(a.token, a.person.id);
  assert.throws(() => authenticate(a.room.code, a.person.id), /rejoin/);
  assert.ok(!JSON.stringify(snapshot(a.room, a.person.id)).includes(a.token));
});
test('every other member must approve and the requester cannot self-vote', () => {
  const [a, b, c] = group();
  act(a.room, a.person, 'request', { domain: 'youtube.com', reason: 'Maths tutorial' });
  const request = a.room.requests[0];
  assert.throws(() => act(a.room, a.person, 'vote', { id: request.id, allow: true }), /cannot vote/);
  act(a.room, b.person, 'vote', { id: request.id, allow: true });
  assert.equal(request.status, 'pending');
  assert.throws(() => act(a.room, b.person, 'vote', { id: request.id, allow: true }), /already voted/);
  act(a.room, c.person, 'vote', { id: request.id, allow: true });
  assert.equal(request.status, 'approved');
  assert.ok(Math.abs(request.until - Date.now() - 300_000) < 1000);
});
test('one no blocks the request', () => {
  const [a, b, c] = group();
  act(a.room, a.person, 'request', { domain: 'youtube.com' });
  const request = a.room.requests[0];
  act(a.room, b.person, 'vote', { id: request.id, allow: false });
  assert.equal(request.status, 'denied');
  assert.throws(() => act(a.room, c.person, 'vote', { id: request.id, allow: true }), /resolved/);
});
test('leaving cancels affected requests instead of silently approving', () => {
  const [a, b] = group();
  act(a.room, a.person, 'request', { domain: 'youtube.com' });
  act(a.room, b.person, 'leave', {});
  assert.equal(a.room.requests[0].status, 'cancelled');
  assert.throws(() => authenticate(a.room.code, b.token), /rejoin/);
});
test('owner transfers on leave; last member deletes room', () => {
  const a = createRoom({ name: 'Ada' });
  const b = joinRoom({ code: a.room.code, name: 'Ben' });
  const { room, person } = authenticate(a.room.code, a.token);
  const ben = authenticate(a.room.code, b.token).person;
  act(room, person, 'leave', {});
  assert.equal(room.owner, ben.id);
  act(room, ben, 'leave', {});
  assert.equal(rooms.size, 0);
});
test('expired requests cannot be approved', () => {
  const [a, b] = group();
  act(a.room, a.person, 'request', { domain: 'youtube.com' });
  const request = a.room.requests[0]; request.createdAt -= 601_000;
  assert.throws(() => act(a.room, b.person, 'vote', { id: request.id, allow: true }), /resolved/);
  assert.equal(request.status, 'expired');
});
test('blocklist normalizes domains, allows additions by all, restricts removals', () => {
  const [a, b] = group();
  act(a.room, b.person, 'block', { domain: 'https://www.EXAMPLE.com/a' });
  assert.ok(a.room.blocked.includes('example.com'));
  assert.throws(() => act(a.room, b.person, 'unblock', { domain: 'example.com' }), /creator/);
  act(a.room, a.person, 'unblock', { domain: 'example.com' });
  assert.ok(!a.room.blocked.includes('example.com'));
  for (const invalid of ['javascript:alert(1)', 'localhost', '<script>', 'https://me:secret@example.com', 'https://example.com:42', 'a..com']) assert.throws(() => domain(invalid));
});
test('no solo approvals and no duplicate pending requests', () => {
  const a = createRoom({ name: 'Ada' });
  const { room, person } = authenticate(a.room.code, a.token);
  assert.throws(() => act(room, person, 'request', { domain: 'youtube.com' }), /Invite a friend/);
  joinRoom({ code: room.code, name: 'Ben' });
  act(room, person, 'request', { domain: 'youtube.com' });
  act(room, person, 'request', { domain: 'youtube.com' });
  assert.equal(room.requests.length, 1);
});
test('new members do not change an existing vote quorum', () => {
  const a = createRoom({ name: 'Ada' });
  const b = joinRoom({ code: a.room.code, name: 'Ben' });
  const { room, person } = authenticate(a.room.code, a.token);
  act(room, person, 'request', { domain: 'youtube.com' });
  const c = joinRoom({ code: room.code, name: 'Cam' });
  const r = room.requests[0];
  assert.throws(() => act(room, authenticate(room.code, c.token).person, 'vote', { id: r.id, allow: true }), /cannot vote/);
  act(room, authenticate(room.code, b.token).person, 'vote', { id: r.id, allow: true });
  assert.equal(r.status, 'approved');
});
