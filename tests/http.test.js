import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { handleRequest } from '../server/index.js';

test('HTTP room workflow and authentication', async () => {
  const call = async (path, body, token) => {
    const request = Readable.from(body ? [JSON.stringify(body)] : []);
    Object.assign(request, { url: path, method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + (token || '') }, socket: { remoteAddress: 'test' } });
    let result;
    const response = { statusCode: 200, setHeader() {}, writeHead(status) { this.statusCode = status; }, end(text) { result = { status: this.statusCode, text: text?.toString() }; } };
    await handleRequest(request, response);
    return { ...result, data: path.startsWith('/api/') ? JSON.parse(result.text) : result.text };
  };
    const a = await call('/api/create', { name: 'Ada' });
    assert.equal(a.status, 200);
    const path = '/api/rooms/' + a.data.room.code;
    const b = await call('/api/join', { name: 'Ben', code: a.data.room.code });
    assert.equal(b.status, 200);
    assert.equal((await call(path)).status, 401);
    assert.equal((await call(path, undefined, b.data.room.you)).status, 401);
    const request = await call(path + '/request', { domain: 'youtube.com' }, a.data.token);
    const id = request.data.requests[0].id;
    const vote = await call(path + '/vote', { id, allow: true }, b.data.token);
    assert.equal(vote.data.requests[0].status, 'approved');
    const page = await call('/');
    assert.equal(page.status, 200);
    assert.match(page.data, /Study Together/);
});
