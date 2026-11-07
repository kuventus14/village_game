// 물고기 가게 시험: 가방 담기(쓰레기 제외)·팔기(값·한도·거리·거절)·하루 한도와 날짜 바뀜·계정 저장 호출, 가게 자리 충돌, 서버(포트 3397)에서 실제로 팔고 칩이 오름
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createShop } from './shop.js';
import { FISH, FISH_BY } from './public/fishdata.js';
import { FISH_STALL, SELL_RANGE, NEAR_RANGE, DAILY_CAP, dayIndex, priceOf, sellable } from './public/shopdata.js';
import { CIRCLES, resolve, POND, placeOf } from './public/world.js';
import { KST } from './public/daycycle.js';

// ── 1. 규칙(가짜 시계·가짜 지갑)
let clock = Date.UTC(2026, 10, 7, 3, 0, 0); const sent = [], saves = [];
const p = { id: 1, x: FISH_STALL.x - 2, z: FISH_STALL.z, fl: 0, seat: -1, chips: 1000 };
const wallet = { add: (q, d) => { if (!Number.isInteger(d) || q.chips + d < 0) return false; q.chips += d; return true; } };
const shop = createShop({ now: () => clock, send: (q, o) => sent.push(o), wallet, save: (q) => saves.push(JSON.stringify({ bag: q.bag, day: q.soldDay, sold: q.sold })) });
const last = () => sent.at(-1);
assert.equal(shop.add(p, 'boot'), false, '쓰레기는 가방에 안 담김'); assert.equal(shop.add(p, 'can'), false); assert.deepEqual(p.bag ?? {}, {});
for (const k of ['carp', 'carp', 'crucian', 'goldcarp']) assert.ok(shop.add(p, k));
assert.deepEqual(p.bag, { carp: 2, crucian: 1, goldcarp: 1 }); assert.equal(last().a, 'state'); assert.equal(saves.length, 4, '담을 때마다 저장');
shop.act(p, { a: 'sell', k: 'carp' }); assert.equal(last().a, 'sold'); assert.equal(p.chips, 1000 + 1200); assert.equal(p.bag.carp, 1); assert.deepEqual(last().items, [['carp', 1, 1200]]); assert.equal(last().sold, 1);
shop.act(p, { a: 'sell', k: 'carp', n: 5 }); assert.equal(p.bag.carp, undefined, '있는 만큼만 팔림'); assert.equal(p.chips, 1000 + 2400);
shop.act(p, { a: 'sell', k: 'carp' }); assert.equal(last().a, 'no'); assert.match(last().error, /팔 물고기가 없어요/);
shop.act(p, { a: 'sellall' }); assert.equal(p.chips, 1000 + 2400 + 5000 + 500, '전부 팔면 비싼 것부터 값만큼'); assert.deepEqual(p.bag, {}); assert.equal(p.sold, 4);
shop.act(p, { a: 'sell', k: 'nope' }); assert.equal(p.chips, 1000 + 2400 + 5500, '모르는 물고기는 무시'); shop.act(p, { a: 'sell', k: 'boot' }); assert.equal(last().a, 'no', '쓰레기는 못 팖');
// 거리·상태 거절
shop.add(p, 'goldcarp'); const c0 = p.chips; Object.assign(p, { x: FISH_STALL.x + SELL_RANGE + 1 }); shop.act(p, { a: 'sell', k: 'goldcarp' }); assert.equal(last().a, 'no'); assert.match(last().error, /가까이/); assert.equal(p.chips, c0);
Object.assign(p, { x: FISH_STALL.x, fl: 1 }); shop.act(p, { a: 'sellall' }); assert.equal(last().a, 'no'); p.fl = 0; p.seat = 3; shop.act(p, { a: 'sellall' }); assert.equal(last().a, 'no'); p.seat = -1; p.fish = {}; shop.act(p, { a: 'sellall' }); assert.equal(last().a, 'no'); p.fish = null;
shop.act(p, { a: 'open' }); assert.equal(last().a, 'state', '가방 보기는 어디서나'); assert.equal(last().bag.goldcarp, 1);
console.log('ok 가방·판매: 쓰레기 안 담김, 값만큼 칩, 있는 만큼만, 비싼 것부터 전부, 거리·상태 거절, 담을 때·팔 때 저장');
// ── 2. 하루 한도 · 날짜 바뀜
const q = { id: 2, x: FISH_STALL.x, z: FISH_STALL.z, fl: 0, seat: -1, chips: 0 }; const cap = createShop({ now: () => clock, send: (a, o) => sent.push(o), wallet, save: () => {} });
for (let i = 0; i < DAILY_CAP + 10; i++) cap.add(q, 'crucian'); cap.act(q, { a: 'sellall' });
assert.equal(q.sold, DAILY_CAP); assert.equal(q.chips, DAILY_CAP * 500, `하루 ${DAILY_CAP}마리까지`); assert.equal(q.bag.crucian, 10, '못 판 건 가방에 남음');
cap.act(q, { a: 'sellall' }); assert.equal(last().a, 'no'); assert.match(last().error, /오늘은 더 팔 수 없어요/); assert.equal(q.chips, DAILY_CAP * 500);
clock += 24 * 3.6e6; cap.act(q, { a: 'sellall' }); assert.equal(last().a, 'sold', '다음 날엔 다시 팔 수 있음'); assert.equal(q.sold, 10); assert.equal(q.chips, (DAILY_CAP + 10) * 500);
assert.notEqual(dayIndex(Date.UTC(2026, 10, 7, 14, 59)), dayIndex(Date.UTC(2026, 10, 7, 15, 1)), '한국 0시(= 15:00 UTC)에 날짜가 바뀜');
assert.equal(dayIndex(Date.UTC(2026, 10, 7, 14, 59)) * 864e5 - KST > 0, true);
console.log(`ok 하루 한도 ${DAILY_CAP}마리: 넘는 건 가방에 남고, 한국 0시에 풀림`);
// ── 3. 값 기대치와 가게 자리
const ev = FISH.reduce((t, f) => t + (f.p / 100) * f.price, 0); assert.ok(DAILY_CAP * ev < 60000, `하루 최대 수입(평균 기준) ${Math.round(DAILY_CAP * ev)}칩`);
assert.ok(sellable('carp') && !sellable('boot') && priceOf('goldcarp') === 5000);
assert.ok(CIRCLES.some((c) => c.x === FISH_STALL.x && c.z === FISH_STALL.z), '가게 충돌 원이 있음');
const [rx, rz] = resolve(FISH_STALL.x, FISH_STALL.z + 0.3); assert.ok(Math.hypot(rx - FISH_STALL.x, rz - FISH_STALL.z) > FISH_STALL.r, '가게 안으로는 못 들어감');
for (const [dx, dz] of [[SELL_RANGE - 1, 0], [-SELL_RANGE + 1, 0], [0, -SELL_RANGE + 1], [0, SELL_RANGE - 1], [3.5, -3.5], [-3.5, 3.5]]) { const [x, z] = resolve(FISH_STALL.x + dx, FISH_STALL.z + dz); assert.ok(Math.hypot(x - (FISH_STALL.x + dx), z - (FISH_STALL.z + dz)) < 0.01, `가게 둘레 ${dx},${dz} 은 걸어갈 수 있음`); }
assert.equal(placeOf(FISH_STALL.x, FISH_STALL.z), 'town'); assert.ok(Math.hypot(FISH_STALL.x - POND.x, FISH_STALL.z - POND.z) > POND.r + 2.5 + NEAR_RANGE, '낚시 안내 자리(연못 중심에서 5.5~7.5m)와 가게 안내 거리가 겹치지 않음');
console.log(`ok 가게 자리: 연못에서 ${Math.hypot(FISH_STALL.x - POND.x, FISH_STALL.z - POND.z).toFixed(1)}m, 충돌 원, 둘레로 걸어갈 수 있음, 하루 최대 수입(평균) 약 ${Math.round(DAILY_CAP * ev)}칩`);
// ── 4. 서버 통합(포트 3397): 손님이 가방에 든 물고기를 팔아 칩이 오름
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-shop-')); process.env.DATA_DIR = dir;
const { WebSocket } = await import('ws');
const S = await import('./server.js');
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 5000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
const srv = await S.listen(3397);
const ws = new WebSocket('ws://localhost:3397'), inbox = []; ws.on('message', (d) => inbox.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r));
ws.send(JSON.stringify({ t: 'join', guest: { g: 'm' } })); const welcome = await until(() => inbox.find((m) => m.t === 'welcome'));
assert.deepEqual(welcome.shop, { bag: {}, sold: 0, cap: DAILY_CAP }, 'welcome 에 가방');
const me = S.players.get(welcome.id); Object.assign(me, { x: FISH_STALL.x - 3, z: FISH_STALL.z + 1, bag: { carp: 2, eel: 1 } });
ws.send(JSON.stringify({ t: 'shop', a: 'sellall' })); const sold = await until(() => inbox.find((m) => m.t === 'shop' && m.a === 'sold'));
assert.equal(sold.gain, 1200 * 2 + 3500); assert.deepEqual(sold.bag, {}); assert.equal(sold.sold, 3);
const wal = await until(() => inbox.filter((m) => m.t === 'wallet').at(-1)); assert.equal(wal.chips, 1000 + 5900, '칩이 올라감(카지노와 같은 돈)');
Object.assign(me, { x: FISH_STALL.x + 20 }); me.bag = { crucian: 1 }; inbox.length = 0; ws.send(JSON.stringify({ t: 'shop', a: 'sellall' })); const far = await until(() => inbox.find((m) => m.t === 'shop' && m.a === 'no')); assert.match(far.error, /가까이/);
ws.close(); await wait(300); srv.close();
console.log('ok 서버(3397): welcome 에 가방 · 팔면 칩이 오름 · 멀면 거절');
console.log('물고기 가게 시험 통과 ✓');
process.exit(0);
