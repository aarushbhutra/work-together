import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRules } from '../extension/rules.js';

const getURL = p => 'chrome-extension://test/' + p;
test('website navigations redirect before the destination loads', () => {
  const rules = buildRules({ blocked: ['youtube.com'], requests: [], you: 'a' }, getURL, 1000);
  assert.equal(rules[0].action.redirect.url, 'chrome-extension://test/blocked.html?domain=youtube.com');
  assert.deepEqual(rules[0].condition, { requestDomains: ['youtube.com'], resourceTypes: ['main_frame'] });
  assert.deepEqual(buildRules(null, getURL), []);
});
test('only an active approved pass for this person produces an allow rule', () => {
  const request = { domain: 'youtube.com', requester: 'a', status: 'approved', until: 2000 };
  const room = { blocked: ['youtube.com'], requests: [request], you: 'a' };
  assert.equal(buildRules(room, getURL, 1000)[1].action.type, 'allow');
  assert.ok(buildRules(room, getURL, 1000)[1].priority > buildRules(room, getURL, 1000)[0].priority);
  assert.equal(buildRules(room, getURL, 2000).length, 1);
  assert.equal(buildRules({ ...room, you: 'b' }, getURL, 1000).length, 1);
  request.status = 'pending'; assert.equal(buildRules(room, getURL, 1000).length, 1);
  request.status = 'denied'; assert.equal(buildRules(room, getURL, 1000).length, 1);
});
