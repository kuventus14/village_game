// 집 자동 배정 시험: 로그인 계정만·계정당 한 채·입구에서 가까운 빈 집부터·동시에 접속해도 안 겹침·80% 차면 다음 큰길 자동 열림·지붕 색 바꾸기·저장 후 다시 불러오기, 서버(포트 3399)에서 가입→접속→집 배정→다시 접속해도 같은 집
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHouse, defaultRoof } from './house.js';
import { PLOTS, ENTRY, ROOFS, HOUSING, setOpenAvenues, openAvenues, isOpen, NAME_MAX } from './public/housedata.js';

// ── 1. 규칙(가짜 저장소·가짜 접속자)
const mem = new Map(), store = { get: async (k) => mem.get(k), set: async (k, v) => { mem.set(k, JSON.parse(JSON.stringify(v))); } };
const sent = [], bc = [], saved = [], opened = [];
const mk = (id, o = {}) => ({ id, uid: 'u' + id, nick: '주민' + id, house: null, ...o });
const house = createHouse({ store, send: (p, o) => sent.push([p.id, o]), bcast: (o) => bc.push(o), save: (p) => saved.push([p.uid, p.house]), onOpen: (n) => opened.push(n) });
setOpenAvenues(1); await house.load(); assert.equal(HOUSING.open, 1); const last = () => sent.at(-1)[1];
const a = mk(1); const h1 = house.assign(a);
assert.ok(h1 && isOpen(PLOTS[h1.plot - 1], 1), '열린 큰길의 집'); assert.equal(h1.name, '주민1의 집'); assert.equal(h1.roof, defaultRoof(h1.plot)); assert.ok(h1.roof < ROOFS.length - 1, '회색(주인 없음)이 아님');
assert.deepEqual(saved.at(-1), ['u1', a.house]); assert.deepEqual(bc.at(-1), { t: 'house', a: 'owner', plot: h1.plot, o: '주민1', r: h1.roof, n: '주민1의 집', l: 0 }); assert.equal(mem.get('housing')[h1.plot].uid, 'u1');
const dist = (id) => { const g = PLOTS[id - 1].gate; return Math.hypot(g.x - ENTRY.x, g.z - ENTRY.z); };
assert.equal(house.assign(a).plot, h1.plot, '이미 있으면 그대로'); assert.equal(saved.length, 1);
assert.equal(house.assign(mk(2, { uid: null })), null, '손님은 집 없음');
const b = mk(2); house.assign(b); assert.notEqual(b.house.plot, h1.plot, '둘째는 다른 집'); assert.ok(dist(b.house.plot) >= dist(h1.plot), '입구에서 가까운 순');
// 같은 순간에 여러 명이 들어와도 겹치지 않음 + 한 사람이 두 채를 못 받음
const crowd = Array.from({ length: 10 }, (_, i) => mk(20 + i)); crowd.forEach((p) => house.assign(p)); crowd.forEach((p) => house.assign(p));
const plots = [a, b, ...crowd].map((p) => p.house.plot); assert.equal(new Set(plots).size, plots.length, '집 번호가 모두 다름'); assert.equal(saved.length, plots.length);
const long = mk(40, { nick: '아주아주아주긴닉네임이에요' }); house.assign(long); assert.ok(long.house.name.length <= NAME_MAX);
console.log('ok 자동 배정: 손님 제외, 계정당 한 채, 입구에서 가까운 빈 집부터, 겹치지 않음, 문패 길이 제한, 저장소·계정에 저장');
// ── 2. 지붕 색 바꾸기
house.act(a, { a: 'roof', roof: 5 }); assert.equal(a.house.roof, 5); assert.equal(last().a, 'mine'); assert.equal(bc.at(-1).r, 5); assert.equal(mem.get('housing')[a.house.plot].roof, 5); assert.deepEqual(saved.at(-1), ['u1', a.house]);
const n0 = saved.length; for (const roof of [-1, 99, ROOFS.length - 1, '3', 1.5]) house.act(a, { a: 'roof', roof }); assert.equal(a.house.roof, 5); assert.equal(saved.length, n0, '이상한 색은 무시');
const nobody = mk(50); house.act(nobody, { a: 'roof', roof: 2 }); assert.match(last().error, /내 집이 없/);
house.act(a, { a: 'open' }); assert.equal(last().a, 'state'); assert.deepEqual(last().mine, a.house); assert.equal(last().plots[a.house.plot].r, 5);
console.log('ok 지붕 색: 주인만 바꿈(기본 색 목록 안에서), 방송·저장');
// ── 3. 80% 차면 다음 큰길
for (let id = 100; id < 200 && !opened.length; id++) house.assign(mk(id));
assert.deepEqual(opened, [2], '16채가 차면 큰길 B 가 열림'); assert.equal(HOUSING.open, 2); assert.deepEqual(bc.at(-1), { t: 'house', a: 'open', n: 2 }); assert.equal(Object.keys(mem.get('housing')).length, 16);
const pB = mk(300); for (let i = 0; i < 4; i++) house.assign(mk(310 + i)); house.assign(pB); assert.ok(pB.house, '20채가 다 차도 B 의 집을 받음'); assert.ok(Object.keys(mem.get('housing')).length >= 21);
console.log('ok 자동 열림: 16채가 차는 순간 큰길 B 가 열리고 방송됨, 이어서 B 집이 배정됨');
// ── 4. 저장 후 다시 불러오기
setOpenAvenues(1); const house2 = createHouse({ store, send: () => {}, bcast: () => {}, save: () => {} }); const o2 = await house2.load();
assert.equal(o2, openAvenues(Object.keys(mem.get('housing')).length)); assert.equal(HOUSING.open, o2); assert.ok(house2.owned(h1.plot)); assert.equal(house2.snapshot(null).plots[h1.plot].o, '주민1'); assert.equal(house2.snapshot(null).plots[h1.plot].r, 5);
console.log('ok 저장·불러오기: 주인 목록과 열린 큰길 수가 그대로');
// ── 5. 서버 통합(포트 3399)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-house-')); process.env.DATA_DIR = dir; setOpenAvenues(1);
const { WebSocket } = await import('ws'); const S = await import('./server.js');
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms)); const until = async (fn, ms = 5000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
await S.house.load(); const srv = await S.listen(3399);
const api = async (name, body) => (await fetch(`http://localhost:3399/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const su = await api('signup', { id: 'house01', nick: '집주인', pw: 'secret1' }); await api('avatar', { token: su.token, avatar: { g: 'f' } });
const join = async () => { const ws = new WebSocket('ws://localhost:3399'), inbox = []; ws.on('message', (d) => inbox.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', token: su.token })); const w = await until(() => inbox.find((m) => m.t === 'welcome')); return { ws, inbox, w }; };
let cl = await join(); const mine = cl.w.house.mine; assert.ok(mine && mine.plot >= 1 && mine.plot <= 20, '가입 직후 접속하면 welcome 에 내 집'); assert.equal(mine.name, '집주인의 집'); assert.equal(cl.w.house.plots[mine.plot].o, '집주인');
cl.ws.send(JSON.stringify({ t: 'house', a: 'roof', roof: 3 })); const m2 = await until(() => cl.inbox.find((m) => m.t === 'house' && m.a === 'mine')); assert.equal(m2.roof, 3);
cl.ws.close(); await wait(900); cl = await join(); assert.equal(cl.w.house.mine.plot, mine.plot, '다시 접속해도 같은 집'); assert.equal(cl.w.house.mine.roof, 3); assert.equal(Object.keys(cl.w.house.plots).length, 1);
const g = new WebSocket('ws://localhost:3399'), gin = []; g.on('message', (d) => gin.push(JSON.parse(d))); await new Promise((r) => g.on('open', r)); g.send(JSON.stringify({ t: 'join', guest: { g: 'm' } })); const gw = await until(() => gin.find((m) => m.t === 'welcome')); assert.equal(gw.house.mine, null, '손님은 집 없음'); assert.equal(Object.keys(gw.house.plots).length, 1);
g.close(); cl.ws.close(); await wait(300); srv.close();
console.log('ok 서버(3399): 가입 → 접속하면 집 자동 배정 → 지붕 색 → 다시 접속해도 같은 집, 손님은 없음');
console.log('집 자동 배정 시험 통과 ✓');
process.exit(0);
