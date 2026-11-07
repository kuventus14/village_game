// 옷 가게 시험: 값·소유 규칙(예전 계정 보호)·서버 규칙(거리·로그인·칩·중복·저장)·안 산 옷 입기 거절·실제 서버(포트 3398)에서 사고 입기까지
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLOSET, PRICE, CLOSET_STALL, BUY_RANGE, NEAR_RANGE, itemsOf, ownedWith, wearable, lockFix, priceOfItem } from './public/closet.js';
import { defaultAvatar, randomAvatar, OPT, CIRCLES, resolve } from './public/world.js';
import { FISH_STALL } from './public/shopdata.js';
import { createCloset } from './closet.js';

// ── 1. 값과 소유 규칙
assert.equal(CLOSET.length, 8); assert.ok(CLOSET.every(([k, i, p]) => (k === 'os' || k === 'ac') && i < OPT[k].length && p >= 1500 && p <= 3000));
assert.equal(new Set(CLOSET.map(([k, i]) => k + i)).size, CLOSET.length, '겹치는 옷 없음');
for (const g of ['m', 'f']) assert.deepEqual(itemsOf(defaultAvatar(g)), [], `기본 ${g} 아바타는 전부 무료(가입하자마자 입을 수 있음)`);
assert.equal(priceOfItem('os0'), 0); assert.equal(priceOfItem('os2'), 0, '원피스(기본)·티셔츠는 무료'); assert.equal(priceOfItem('os3'), 3000); assert.equal(priceOfItem('ac5'), 3000);
const a = { ...defaultAvatar('m'), os: 3, ac: 2 };
assert.deepEqual(itemsOf(a).sort(), ['ac2', 'os3']); assert.deepEqual(ownedWith(undefined, a).sort(), ['ac2', 'os3'], '지금 입고 있는 유료 옷은 가진 것으로 침(예전 계정 보호)');
assert.deepEqual(ownedWith(['ac4', 'zzz', 'os0'], defaultAvatar('m')), ['ac4'], '모르는 번호·무료 번호는 걸러냄');
assert.equal(wearable(a, ['os3']), false); assert.equal(wearable(a, ['os3', 'ac2']), true); assert.equal(wearable(defaultAvatar('f'), []), true);
const fixed = lockFix({ ...defaultAvatar('f'), os: 4, ac: 5, hs: 3 }, ['ac5'], defaultAvatar('f')); assert.equal(fixed.os, defaultAvatar('f').os, '안 산 옷은 기본으로'); assert.equal(fixed.ac, 5, '산 건 유지'); assert.equal(fixed.hs, 3);
for (let i = 0; i < 400; i++) { const r = lockFix(randomAvatar(i % 2 ? 'f' : 'm'), [], defaultAvatar(i % 2 ? 'f' : 'm')); assert.deepEqual(itemsOf(r), [], '랜덤 뒤 잠금 정리하면 유료 옷 없음'); }
console.log(`ok 값·소유 규칙: 유료 ${CLOSET.length}종(옷 3·꾸미기 5, ${Math.min(...Object.values(PRICE))}~${Math.max(...Object.values(PRICE))}칩), 기본 아바타 무료, 입고 있던 옷은 가진 것으로`);

// ── 2. 서버 규칙(가짜 지갑)
const sent = [], saves = []; const p = { id: 1, uid: 'u1', x: CLOSET_STALL.x + 2, z: CLOSET_STALL.z, fl: 0, seat: -1, chips: 5000, a: defaultAvatar('m') };
const wallet = { add: (q, d) => { if (q.chips + d < 0) return false; q.chips += d; return true; } };
const closet = createCloset({ send: (q, o) => sent.push(o), wallet, save: (q) => saves.push([...q.closet]) }); const last = () => sent.at(-1);
closet.act(p, { a: 'buy', i: 'ac2' }); assert.equal(last().a, 'bought'); assert.equal(p.chips, 3000); assert.deepEqual(p.closet, ['ac2']); assert.deepEqual(saves.at(-1), ['ac2']);
closet.act(p, { a: 'buy', i: 'ac2' }); assert.equal(last().a, 'no'); assert.match(last().error, /이미/); assert.equal(p.chips, 3000, '중복 구매는 칩 안 나감');
closet.act(p, { a: 'buy', i: 'os3' }); assert.equal(p.chips, 0); closet.act(p, { a: 'buy', i: 'ac5' }); assert.equal(last().a, 'no'); assert.match(last().error, /모자라/); assert.deepEqual(p.closet, ['ac2', 'os3']);
closet.act(p, { a: 'buy', i: 'os0' }); closet.act(p, { a: 'buy', i: 'nope' }); closet.act(p, { a: 'buy', i: 5 }); assert.equal(p.chips, 0, '무료·모르는 번호는 무시'); assert.equal(sent.length, 4);
p.chips = 9999; Object.assign(p, { x: CLOSET_STALL.x + BUY_RANGE + 1 }); closet.act(p, { a: 'buy', i: 'ac1' }); assert.match(last().error, /가까이/); Object.assign(p, { x: CLOSET_STALL.x, fl: 1 }); closet.act(p, { a: 'buy', i: 'ac1' }); assert.equal(last().a, 'no'); p.fl = 0;
const guest = { id: 2, uid: null, x: CLOSET_STALL.x, z: CLOSET_STALL.z, fl: 0, seat: -1, chips: 9999, a: defaultAvatar('f') }; closet.act(guest, { a: 'buy', i: 'ac1' }); assert.match(last().error, /로그인/); assert.equal(guest.chips, 9999, '손님은 못 삼');
closet.act(p, { a: 'open' }); assert.equal(last().a, 'state'); assert.deepEqual(last().owned, ['ac2', 'os3']);
const old = { id: 3, uid: 'u3', x: 0, z: 0, fl: 0, seat: -1, chips: 0, a: { ...defaultAvatar('m'), ac: 4 } }; assert.deepEqual(closet.snapshot(old).owned, ['ac4'], '입고 있던 옷은 처음 열 때 옷장에 들어옴');
console.log('ok 서버 규칙: 칩만큼 사고, 중복·모자람·멀리·손님·무료/모르는 번호 거절, 사면 저장, 입고 있던 옷은 옷장에');
// ── 3. 가게 자리
assert.ok(CIRCLES.some((c) => c.x === CLOSET_STALL.x && c.z === CLOSET_STALL.z), '충돌 원'); assert.ok(Math.hypot(CLOSET_STALL.x - FISH_STALL.x, CLOSET_STALL.z - FISH_STALL.z) > 2 * NEAR_RANGE + 4, '두 가게 안내가 겹치지 않음');
for (const [dx, dz] of [[BUY_RANGE - 1, 0], [-BUY_RANGE + 1, 0], [0, BUY_RANGE - 1], [0, -BUY_RANGE + 1]]) { const [x, z] = resolve(CLOSET_STALL.x + dx, CLOSET_STALL.z + dz); assert.ok(Math.hypot(x - CLOSET_STALL.x - dx, z - CLOSET_STALL.z - dz) < 0.9, `가게 둘레 ${dx},${dz} 접근`); }
console.log('ok 가게 자리: 충돌 원, 물고기 가게와 안내가 안 겹침');
// ── 4. 서버 통합(포트 3398): 가입 → 아바타(무료) → 접속 → 사기 → 입기, 안 산 옷은 거절, 다시 접속해도 남음
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-closet-')); process.env.DATA_DIR = dir;
const { WebSocket } = await import('ws'); const S = await import('./server.js');
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms)); const until = async (fn, ms = 5000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
const srv = await S.listen(3398);
const api = async (name, body) => (await fetch(`http://localhost:3398/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const su = await api('signup', { id: 'closet01', nick: '옷가게손님', pw: 'secret1' }); assert.ok(su.ok, JSON.stringify(su)); assert.deepEqual(su.closet, []);
let av = await api('avatar', { token: su.token, avatar: { ...defaultAvatar('f'), ac: 3 } }); assert.equal(av.ok, false); assert.match(av.error, /안 산 옷/, '안 산 옷은 입을 수 없음');
av = await api('avatar', { token: su.token, avatar: defaultAvatar('f') }); assert.ok(av.ok);
const join = async () => { const ws = new WebSocket('ws://localhost:3398'), inbox = []; ws.on('message', (d) => inbox.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', token: su.token })); const w = await until(() => inbox.find((m) => m.t === 'welcome')); return { ws, inbox, w }; };
let c = await join(); assert.deepEqual(c.w.closet, { owned: [] }); const me = S.players.get(c.w.id); Object.assign(me, { x: CLOSET_STALL.x + 2, z: CLOSET_STALL.z, chips: 4000 });
c.ws.send(JSON.stringify({ t: 'closet', a: 'buy', i: 'ac3' })); const got = await until(() => c.inbox.find((m) => m.t === 'closet' && m.a === 'bought')); assert.deepEqual(got.owned, ['ac3']); assert.equal(me.chips, 4000 - 2500);
c.ws.close(); await wait(900);
const li = await api('login', { id: 'closet01', pw: 'secret1' }); assert.deepEqual(li.closet, ['ac3'], '로그인 응답에 산 옷');
av = await api('avatar', { token: li.token, avatar: { ...defaultAvatar('f'), ac: 3 } }); assert.ok(av.ok, '산 옷은 입을 수 있음: ' + JSON.stringify(av)); assert.equal(av.avatar.ac, 3);
av = await api('avatar', { token: li.token, avatar: { ...defaultAvatar('f'), ac: 3, os: 4 } }); assert.equal(av.ok, false, '안 산 멜빵바지는 거절');
av = await api('avatar', { token: li.token, avatar: defaultAvatar('f') }); assert.ok(av.ok, '벗기도 가능'); av = await api('avatar', { token: li.token, avatar: { ...defaultAvatar('f'), ac: 3 } }); assert.ok(av.ok, '벗었다 다시 입어도 됨(계정에 남음)');
c = await join(); assert.deepEqual(c.w.closet, { owned: ['ac3'] }, '다시 접속해도 산 옷이 남음'); c.ws.close(); await wait(300); srv.close();
console.log('ok 서버(3398): 안 산 옷 입기 거절 · 사고 입기 · 벗었다 다시 입기 · 다시 접속해도 남음');
console.log('옷 가게 시험 통과 ✓');
process.exit(0);
