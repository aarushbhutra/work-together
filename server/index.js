import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRoom, joinRoom, authenticate, snapshot, act } from './room.js';

const root = fileURLToPath(new URL('../extension/', import.meta.url));
const rate = new Map();
export async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      let body = {};
      if (req.method === 'POST') {
        const key = req.socket.remoteAddress;
        const entry = rate.get(key) || { count: 0, until: Date.now() + 60_000 };
        if (entry.until < Date.now()) { entry.count = 0; entry.until = Date.now() + 60_000; }
        rate.set(key, entry);
        if (++entry.count > 120) throw Object.assign(new Error('Too many requests. Try again in a minute.'), { status: 429 });
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 8192) throw Object.assign(new Error('Request is too large.'), { status: 413 }); }
        try { body = JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
      }
      let result;
      if (req.method === 'POST' && url.pathname === '/api/create') result = createRoom(body);
      else if (req.method === 'POST' && url.pathname === '/api/join') result = joinRoom(body);
      else {
        const match = url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/([a-z]+))?$/);
        if (!match) throw Object.assign(new Error('Not found.'), { status: 404 });
        const { room, person } = authenticate(match[1], (req.headers.authorization || '').replace(/^Bearer /, ''));
        if (req.method === 'GET' && !match[2]) result = snapshot(room, person.id);
        else if (req.method === 'POST' && match[2]) result = act(room, person, match[2], body);
        else throw Object.assign(new Error('Method not allowed.'), { status: 405 });
      }
      return res.end(JSON.stringify(result));
    }
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..')) { res.writeHead(404); return res.end(); }
    const content = await readFile(root + path);
    const ext = path.split('.').pop();
    res.setHeader('Content-Type', ({ html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml', png: 'image/png', json: 'application/json' })[ext] || 'application/octet-stream');
    res.end(content);
  } catch (error) { res.writeHead(error.status || (error.code === 'ENOENT' ? 404 : 500), { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.status ? error.message : 'Something went wrong. Please try again.' })); }
}
export const server = http.createServer(handleRequest);
const cleaner = setInterval(() => { for (const [key, value] of rate) if (value.until < Date.now()) rate.delete(key); }, 60_000);
cleaner.unref();
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT || 8787), process.env.HOST || '0.0.0.0', () => console.log('Study Together is running at http://localhost:' + (process.env.PORT || 8787)));
