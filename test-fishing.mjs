// 낚시 시험: 확률표·뽑기, 가짜 시계로 입질·당기기 판정, 서버 통합(거리 검사·입질·성공/늦음/빠름·이동 취소·도감 저장과 재접속)
import assert from 'node:assert/strict';
// 판매 값: 물고기 500~5000 칩, 희귀할수록 비쌈(희귀도 단계가 오르면 값도 오름), 쓰레기는 0(못 팖), 한 번 낚을 때 평균(쓰레기 포함)
import { FISH as FISH_PRICES } from './public/fishdata.js';
{
  const fish = FISH_PRICES.filter((f) => f.star > 0), junk = FISH_PRICES.filter((f) => f.star === 0);
  assert.ok(fish.every((f) => Number.isInteger(f.price) && f.price >= 500 && f.price <= 5000), '물고기 값 500~5000');
  assert.ok(junk.every((f) => f.price === 0), '쓰레기는 못 팖');
  for (const a of fish) for (const b of fish) if (b.star > a.star) assert.ok(b.price >= a.price, `${b.name}(${b.star}) 이 ${a.name}(${a.star}) 보다 싸면 안 됨`);
  const ev = FISH_PRICES.reduce((t, f) => t + (f.p / 100) * f.price, 0);
  assert.ok(ev > 900 && ev < 1200, '한 번 낚을 때 평균 약 1,050칩: ' + ev.toFixed(0));
  console.log(`ok 물고기 값: ${fish.map((f) => f.name + ' ' + f.price).join(' · ')} (한 번 낚을 때 평균 ${ev.toFixed(0)}칩)`);
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FISH } from './public/fishdata.js';
import { POND } from './public/world.js';
import { pickFish, fishSize, createFishing } from './fishing.js';

// ── 확률표
assert.equal(FISH.reduce((s, f) => s + f.p, 0), 100, '확률 합 100');
assert.equal(new Set(FISH.map((f) => f.k)).size, FISH.length, '키가 겹치지 않음');
assert.equal(pickFish(0).k, FISH[0].k); assert.equal(pickFish(0.999999).k, FISH.at(-1).k);
const N = 50000, cnt = {};
for (let i = 0; i < N; i++) { const f = pickFish(Math.random()); cnt[f.k] = (cnt[f.k] || 0) + 1; }
for (const f of FISH) { const got = (cnt[f.k] || 0) / N * 100; assert.ok(Math.abs(got - f.p) < Math.max(0.6, f.p * 0.12), `${f.name} ${got.toFixed(2)}% (기대 ${f.p}%)`); }
for (const f of FISH) for (const r of [0, 0.5, 0.9999]) { const cm = fishSize(f, r); assert.ok(f.max ? cm >= f.min && cm <= f.max : cm === 0, `${f.name} 크기 ${cm}`); }

// ── 가짜 시계로 규칙만
{
  let t = 1000, rr = 0.5;
  const out = [], saved = [];
  const F = createFishing({ now: () => t, rand: () => rr, send: (p, o) => out.push(o), bcast: (o) => out.push(o), info: () => {}, save: (p) => saved.push(p.dex), opts: { bite: [2500, 7000] } });
  const P = (o) => ({ id: 1, s: 'working', auto: true, seat: -1, fl: 0, game: null, transit: null, x: POND.x, z: POND.z - POND.r - 1, dex: {}, fish: null, ...o });
  const last = (a) => out.filter((m) => m.a === a).at(-1);
  const p = P();
  F.act(p, { a: 'cast' });
  assert.equal(p.s, 'fish'); assert.ok(Math.hypot(last('cast').bx - POND.x, last('cast').bz - POND.z) < POND.r - 0.5, '찌는 연못 안');
  assert.equal(p.fish.biteAt, 1000 + 2500 + 0.5 * 4500, '입질 시각은 서버가 2.5~7초 사이로 정함');
  F.act(p, { a: 'cast' }); assert.equal(out.filter((m) => m.a === 'cast').length, 1, '낚시 중 또 던지기는 무시');
  t = p.fish.biteAt - 1; F.tick(); assert.equal(p.fish.st, 'wait');
  t += 1; F.tick(); assert.equal(p.fish.st, 'bite'); assert.ok(last('bite'));
  t += 30; F.act(p, { a: 'reel' }); assert.ok(p.fish, '사람이 못 누를 만큼 빠른 당기기는 무시');
  t += 500; F.act(p, { a: 'reel' });
  const c = last('catch');
  assert.ok(c && c.first && !p.fish && p.s === 'working' && p.auto === true, '잡고 나면 원래 상태로');
  assert.deepEqual(saved.at(-1), { [c.k]: { n: 1, best: c.cm } }, '도감 저장');
  // 늦으면 놓침
  t += 900; F.act(p, { a: 'cast' }); t = p.fish.biteAt; F.tick(); t += 1400 + 301; F.tick();
  assert.equal(last('end').r, 'miss'); assert.equal(p.fish, null);
  // 너무 자주 던지면 무시 (0.8초)
  F.act(p, { a: 'cast' }); assert.equal(p.fish, null, '쿨다운');
  // 입질 전에 당기면 실패
  t += 900; F.act(p, { a: 'cast' }); t += 100; F.act(p, { a: 'reel' }); assert.equal(last('end').r, 'early');
  // 같은 물고기 또 잡으면 수가 늘고 더 크면 기록 갱신
  rr = 0.5; t += 900; F.act(p, { a: 'cast' }); t = p.fish.biteAt; F.tick(); rr = 0.99; t += 200;
  const before = p.dex[c.k]?.best; F.act(p, { a: 'reel' });
  const c2 = last('catch');
  if (c2.k === c.k) { assert.equal(p.dex[c.k].n, 2); assert.equal(c2.record, c2.cm > before); }
  // 거리·상태 검사
  const far = P({ id: 2, z: POND.z - POND.r - 5 }); F.act(far, { a: 'cast' }); assert.equal(last('no').error, '연못 가까이 가서 던져 주세요'); assert.equal(far.fish, null);
  const sit = P({ id: 3, seat: 4 }); F.act(sit, { a: 'cast' }); assert.equal(sit.fish, null, '앉아 있으면 못 함');
  const up = P({ id: 4, fl: 1 }); F.act(up, { a: 'cast' }); assert.equal(up.fish, null, '다른 층이면 못 함');
  const gm = P({ id: 5, game: 'tag' }); F.act(gm, { a: 'cast' }); assert.equal(gm.fish, null, '게임 중이면 못 함');
  const q = P({ id: 6 }); t += 900; F.act(q, { a: 'cast' }); F.act(q, { a: 'stop' }); assert.equal(last('end').r, 'cancel'); assert.equal(q.s, 'working');
}

// ── 서버 통합
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-fish-'));
process.env.FISH_BITE = '150,250';
const { WebSocket } = await import('ws');
const { listen, players, store } = await import('./server.js');
const PORT = 3396, BASE = `http://localhost:${PORT}`;
const srv = await listen(PORT);
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
const api = async (name, body) => (await fetch(`${BASE}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
async function connect(token) {
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', token }));
  const c = { ws, inbox, token, send: (o) => ws.send(JSON.stringify(o)), fish: (a) => inbox.filter((m) => m.t === 'fish' && (!a || m.a === a)) };
  c.welcome = await until(() => inbox.find((m) => m.t === 'welcome')); c.id = c.welcome.id; c.p = () => players.get(c.id);
  return c;
}
async function open(nick) {
  const s = await api('signup', { nick, pw: 'secret1' });
  await api('avatar', { token: s.token, avatar: { g: 'm' } });
  return Object.assign(await connect(s.token), { nick });
}
const moveTo = async (c, x, z) => { c.send({ t: 'm', x, z, ry: 0, w: 0, y: 0 }); await wait(60); };
const EDGE = [POND.x - 4.4, POND.z - 4.4]; // 연못 남서쪽 가장자리(중심에서 6.2m)

const a = await open('낚시왕'), b = await open('구경꾼');
assert.deepEqual(a.welcome.fish, {}, '처음엔 도감이 비어 있음');
// 연못에서 먼 곳은 거부
await moveTo(a, POND.x, POND.z - 12);
a.send({ t: 'fish', a: 'cast' });
assert.match((await until(() => a.fish('no')[0])).error, /연못/);
assert.equal(a.p().fish, null);
// 던지기 → 입질 → 제때 당기면 잡음 (다른 사람도 찌·상태·결과를 봄)
await moveTo(a, ...EDGE);
a.send({ t: 'fish', a: 'cast' });
const cast = await until(() => b.fish('cast').find((m) => m.id === a.id));
assert.ok(Math.hypot(cast.bx - POND.x, cast.bz - POND.z) < POND.r, '찌는 연못 안');
await until(() => b.inbox.some((m) => m.t === 'info' && m.id === a.id && m.s === 'fish'));
await until(() => a.fish('bite').length === 1);
await wait(150);
a.send({ t: 'fish', a: 'reel' });
const got = await until(() => a.fish('catch')[0]);
assert.ok(got.k && got.first, '첫 물고기');
const endB = await until(() => b.fish('end').find((m) => m.id === a.id));
assert.equal(endB.r, 'catch'); assert.equal(endB.k, got.k); assert.equal(endB.s, 'free', '끝나면 원래 상태로');
assert.equal(a.p().s, 'free');
// 늦으면 놓침
await wait(850);
a.send({ t: 'fish', a: 'cast' });
await until(() => a.fish('bite').length === 2);
assert.equal((await until(() => a.fish('end').filter((m) => m.r === 'miss')[0], 3000)).id, a.id, '1.4초 안에 안 당기면 놓침');
// 너무 일찍 당기면 실패
await wait(850);
a.send({ t: 'fish', a: 'cast' }); await until(() => a.fish('cast').length === 3);
a.send({ t: 'fish', a: 'reel' });
await until(() => a.fish('end').some((m) => m.r === 'early'));
// 움직이면 취소
await wait(850);
a.send({ t: 'fish', a: 'cast' }); await until(() => a.fish('cast').length === 4);
await moveTo(a, EDGE[0] - 2, EDGE[1] - 2);
await until(() => a.fish('end').some((m) => m.r === 'cancel'));
assert.equal(a.p().fish, null);
// 낚시 중에 들어온 사람도 찌를 봄 / 접속이 끊기면 정리
await moveTo(a, ...EDGE); await wait(850);
a.send({ t: 'fish', a: 'cast' }); await until(() => a.fish('cast').length === 5);
const c = await open('늦게옴');
assert.ok(c.welcome.fishers.some((f) => f.id === a.id), 'welcome 에 낚시 중인 사람');
// 도감 저장 → 재접속하면 welcome 으로 옴
await wait(100);
const saved = (await store.get('user:낚시왕')).fish;
assert.deepEqual(saved[got.k], { n: 1, best: got.cm }, '계정에 도감 저장');
a.ws.close(); await until(() => !players.has(a.id));
const a2 = await connect(a.token);
assert.deepEqual(a2.welcome.fish, saved, '재접속하면 도감이 옴');
assert.ok(!a2.welcome.fishers.some((f) => f.id === a.id), '끊긴 사람의 낚시는 정리됨');

console.log('낚시 시험 통과');
for (const x of [a2, b, c]) x.ws.close();
srv.close(); store.flush(); process.exit(0);
