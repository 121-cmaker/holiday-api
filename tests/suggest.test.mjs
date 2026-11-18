import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSuggest } from '../api/suggest.js';
const req = (q = 'year=2026&month=10') => new Request(`https://local/api/suggest?${q}`);
const good = () => Response.json({ choices: [{ message: { content: '1. 가까운 공원 산책하기\n2. 친구와 한국어 공부하기\n3. 박물관 관람 계획 세우기' } }], usage: { total_tokens: 100 } });
const make = (opts = {}) => createSuggest({ holidayFetch: async () => Response.json({ items: [{ date: '2026-10-09', name: '한글날' }] }), fetchAI: async () => good(), ...opts });
async function keyed(fn) {
  const old = process.env.HASA_API_KEY; process.env.HASA_API_KEY = 'test-placeholder';
  try { await fn(); } finally { if (old === undefined) delete process.env.HASA_API_KEY; else process.env.HASA_API_KEY = old; }
}
test('normal: endpoint, model, separate messages, tokens, safe response', () => keyed(async () => {
  const h = make({ fetchAI: async (url, init) => {
    assert.equal(url, 'https://open.hasa.re.kr/v1/chat/completions');
    const b = JSON.parse(init.body); assert.equal(b.model, 'gemma-4-31b'); assert.equal(b.max_tokens, 300);
    assert.deepEqual(b.messages.map(m => m.role), ['system', 'user']);
    assert.deepEqual(JSON.parse(b.messages[1].content), { year: 2026, month: 10, holidays: [{ date: '2026-10-09', name: '한글날' }] });
    assert.ok(init.signal instanceof AbortSignal); return good();
  } });
  const res = await h.fetch(req()); assert.equal(res.status, 200); const text = await res.text();
  assert.equal(JSON.parse(text).suggestions.length, 3); assert.ok(!text.includes(process.env.HASA_API_KEY));
}));
test('invalid input: 400 before external calls', async () => {
  const h = make({ holidayFetch: () => { throw Error('must not call'); } });
  for (const q of ['year=2026&month=13', 'year=abc&month=1', 'year=1999&month=1', 'year=2026&month=1x', 'year=2026&month=']) assert.equal((await h.fetch(req(q))).status, 400);
});
test('missing key: 500', async () => {
  const old = process.env.HASA_API_KEY; delete process.env.HASA_API_KEY;
  try { assert.equal((await make().fetch(req())).status, 500); } finally { if (old !== undefined) process.env.HASA_API_KEY = old; }
});
test('rate limit: 429, daily guidance, no upstream leak', () => keyed(async () => {
  const r = await make({ fetchAI: async () => new Response('private', { status: 429 }) }).fetch(req());
  assert.equal(r.status, 429); const t = await r.text(); assert.match(t, /500/); assert.doesNotMatch(t, /private/);
}));
test('timeout aborts pending fetch: 504', () => keyed(async () => {
  let aborted = false;
  const h = make({ timeoutMs: 10, fetchAI: async (u, { signal }) => new Promise((ok, fail) => signal.addEventListener('abort', () => { aborted = true; fail(new DOMException('timeout', 'AbortError')); }, { once: true })) });
  assert.equal((await h.fetch(req())).status, 504); assert.equal(aborted, true);
}));
test('invalid answer filtered: 200 with retry', () => keyed(async () => {
  for (const content of ['one line', '1. <script>alert(1)</script>\n2. test\n3. test', `1. ${'가'.repeat(41)}\n2. test\n3. test`, '1. sk-secret\n2. test\n3. test']) {
    const r = await make({ fetchAI: async () => Response.json({ choices: [{ message: { content } }] }) }).fetch(req());
    assert.equal(r.status, 200); const d = await r.json(); assert.equal(d.needsRetry, true); assert.deepEqual(d.suggestions, []);
  }
}));
test('no holidays: explicit empty list', () => keyed(async () => {
  const h = make({ holidayFetch: async () => Response.json({ items: [] }), fetchAI: async (u, i) => { assert.deepEqual(JSON.parse(JSON.parse(i.body).messages[1].content).holidays, []); return good(); } });
  assert.equal((await (await h.fetch(req('year=2026&month=11'))).json()).holidayCount, 0);
}));
test('holiday failure prevents AI call', () => keyed(async () => {
  const h = make({ holidayFetch: async () => new Response('', { status: 502 }), fetchAI: () => { throw Error('must not call'); } });
  assert.equal((await h.fetch(req())).status, 502);
}));
test('cache, expiry, parallel duplicate coalescing', () => keyed(async () => {
  let calls = 0, time = 0;
  const h = make({ now: () => time, fetchAI: async () => { calls++; await new Promise(r => setTimeout(r, 5)); return good(); } });
  const responses = await Promise.all([h.fetch(req()), h.fetch(req())]); assert.equal(calls, 1);
  for (const r of responses) assert.equal((await r.json()).suggestions.length, 3);
  assert.equal((await (await h.fetch(req())).json()).cached, true); assert.equal(calls, 1);
  time = 300001; await h.fetch(req()); assert.equal(calls, 2);
}));
test('network, malformed JSON, upstream errors: 502', () => keyed(async () => {
  for (const fetchAI of [async () => { throw Error('private'); }, async () => new Response('broken'), async () => new Response('private', { status: 500 })]) {
    const r = await make({ fetchAI }).fetch(req()); assert.equal(r.status, 502); assert.doesNotMatch(await r.text(), /private/);
  }
}));
test('POST: 405', async () => assert.equal((await make().fetch(new Request('https://local/api/suggest', { method: 'POST' }))).status, 405));
