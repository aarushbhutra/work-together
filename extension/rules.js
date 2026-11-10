// Rules are enforced by Chrome even when the extension worker is asleep.
export function buildRules(room, getURL, now = Date.now()) {
  if (!room) return [];
  const rules = room.blocked.map((host, index) => ({
    id: index + 1, priority: 1,
    action: { type: 'redirect', redirect: { url: getURL('blocked.html') + '?domain=' + encodeURIComponent(host) } },
    condition: { requestDomains: [host], resourceTypes: ['main_frame'] }
  }));
  room.requests.filter(r => r.requester === room.you && r.status === 'approved' && r.until > now && room.blocked.some(d => r.domain === d || r.domain.endsWith('.' + d))).forEach((r, index) => {
    rules.push({ id: 1001 + index, priority: 2, action: { type: 'allow' }, condition: { requestDomains: [r.domain], resourceTypes: ['main_frame'] } });
  });
  return rules;
}
