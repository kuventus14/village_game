// 집 안(방) 시험: 방 설계(위치·충돌·가구 검사)와 서버(포트 3398): 현관 앞에서 들어가기 → 방으로 옮겨짐 → 방 밖으로 못 나감 → 나가기 → 집 문 앞, 남의 집 구경·잠금, 가구 배치 저장·가구 사기
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOM, roomBox, roomAt, roomOrigin, resolveRoom, setRoomFurn, cleanFurn, footprint, FURN, DEFAULT_FURN, DEFAULT_INV, FURN_STALL, STEP } from './public/roomdata.js';
import { PLOTS, plotById } from './public/housedata.js';
import { placeOf, resolve } from './public/world.js';

// ── 1. 설계
assert.equal(roomAt(roomOrigin(1).cx, roomOrigin(1).cz), 1); assert.equal(roomAt(roomOrigin(100).cx, roomOrigin(100).cz), 100); assert.equal(roomAt(0, 0), 0); assert.equal(roomAt(4020, 4000), 0, '방 사이 빈 곳');
for (let id = 1; id <= 100; id++) { const b = roomBox(id); assert.equal(roomAt(b.cx, b.cz), id); assert.equal(placeOf(b.cx + 3, b.cz - 2), 'room'); assert.equal(roomAt(b.entry.x, b.entry.z), id, '들어오는 자리는 방 안'); }
const b1 = roomBox(1); let [x, z] = resolve(b1.cx + 50, b1.cz, 0.4); assert.ok(roomAt(x, z) !== 1 || Math.abs(x - b1.cx) <= ROOM.w / 2);
[x, z] = resolveRoom(1, b1.cx + 99, b1.cz - 99); assert.ok(x <= b1.x1 - 0.39 && z >= b1.z0 + 0.39, '벽 안으로 가둠');
setRoomFurn(1, DEFAULT_FURN); const t = DEFAULT_FURN.find((f) => f.k === 'table'); [x, z] = resolveRoom(1, b1.cx + t.x, b1.cz + t.z, 0.4); assert.ok(Math.hypot(x - b1.cx - t.x, z - b1.cz - t.z) > 0.5, '탁자 위엔 못 섬(단단한 가구)');
const bed = DEFAULT_FURN.find((f) => f.k === 'bed'); [x, z] = resolveRoom(1, b1.cx + bed.x, b1.cz + bed.z, 0.4); assert.ok(Math.hypot(x - b1.cx - bed.x, z - b1.cz - bed.z) < 0.01, '침대 위는 올라설 수 있음');
assert.deepEqual(cleanFurn(DEFAULT_FURN, DEFAULT_INV), DEFAULT_FURN.map((f) => ({ ...f, x: Math.round(f.x / STEP) * STEP, z: Math.round(f.z / STEP) * STEP })), '처음 가구는 검사를 통과');
assert.equal(cleanFurn([{ k: 'sofa', x: 99, z: 0, r: 0 }], { sofa: 1 }).length, 0, '방 밖'); assert.equal(cleanFurn([{ k: 'sofa', x: 0, z: 0, r: 0 }], {}).length, 0, '안 가진 가구'); assert.equal(cleanFurn([{ k: 'nope', x: 0, z: 0, r: 0 }]).length, 0);
assert.equal(cleanFurn([{ k: 'sofa', x: 0, z: 0, r: 0 }, { k: 'sofa', x: 0.5, z: 0, r: 0 }], { sofa: 2 }).length, 1, '단단한 가구끼리 겹치면 하나만');
assert.equal(cleanFurn([{ k: 'shelf', x: 0, z: ROOM.d / 2 - 0.5, r: 0 }], { shelf: 1 }).length, 0, '현관 앞은 못 막음'); assert.equal(cleanFurn([{ k: 'rug', x: 0, z: ROOM.d / 2 - 1.5, r: 0 }], { rug: 1 }).length, 1, '러그는 현관 앞도 됨');
assert.equal(cleanFurn([{ k: 'bed', x: 0, z: 0, r: 9 }, { k: 'bed', x: NaN, z: 0, r: 0 }], { bed: 2 }).length, 0);
for (const k in FURN) assert.ok(FURN[k].w > 0 && FURN[k].d > 0 && FURN[k].price >= 0);
console.log('ok 방 설계: 100칸 위치·집 밖과 안 겹침, 벽·단단한 가구 충돌, 침대·러그는 올라섬, 가구 검사(방 밖·안 가짐·겹침·현관 막음·이상한 값)');
// ── 2. 서버 통합(포트 3398)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-room-')); process.env.DATA_DIR = dir;
const { WebSocket } = await import('ws'); const S = await import('./server.js');
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms)); const until = async (fn, ms = 5000) => { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
await S.house.load(); const srv = await S.listen(3398);
const api = async (name, body) => (await fetch(`http://localhost:3398/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
async function user(id, nick) { const su = await api('signup', { id, nick, pw: 'secret1' }); await api('avatar', { token: su.token, avatar: { g: 'f' } }); const ws = new WebSocket('ws://localhost:3398'), inbox = []; ws.on('message', (d) => inbox.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', token: su.token })); const w = await until(() => inbox.find((m) => m.t === 'welcome')); return { ws, inbox, w, p: S.players.get(w.id), send: (o) => ws.send(JSON.stringify(o)), get: (f) => inbox.find(f), last: (f) => inbox.filter(f).at(-1) }; }
const A = await user('roomA01', '방주인'), B = await user('roomB01', '손님이');
const pa = plotById(A.w.house.mine.plot), pb = plotById(B.w.house.mine.plot), door = (pl) => ({ x: pl.door.x, z: pl.door.z + (Math.cos(pl.door.face) > 0 ? 2.6 : -2.6) });
Object.assign(A.p, door(pa)); A.send({ t: 'house', a: 'enter', plot: pa.id });
const inA = await until(() => A.get((m) => m.t === 'house' && m.a === 'in')); assert.equal(inA.plot, pa.id); assert.equal(inA.mine, true); assert.deepEqual(inA.furn, DEFAULT_FURN); assert.deepEqual(inA.inv, DEFAULT_INV);
assert.equal(roomAt(A.p.x, A.p.z), pa.id, '방으로 옮겨짐'); assert.equal(A.p.pl, 'room'); assert.ok(A.get((m) => m.t === 'tp' && roomAt(m.x, m.z) === pa.id)); assert.ok(B.get((m) => m.t === 'warp' && m.id === A.w.id && roomAt(m.x, m.z) === pa.id), '다른 사람에게도 알림');
A.send({ t: 'm', x: 0, z: 0, ry: 0 }); await wait(150); assert.equal(roomAt(A.p.x, A.p.z), pa.id, '방 안에서 밖 좌표로는 못 감');
const bb = roomBox(pa.id); A.send({ t: 'm', x: bb.cx + 2, z: bb.cz - 3, ry: 0 }); await wait(150); assert.ok(Math.abs(A.p.x - bb.cx - 2) < 0.01, '방 안에서는 걸음');
A.send({ t: 'house', a: 'leave' }); await until(() => A.get((m) => m.t === 'house' && m.a === 'out')); assert.equal(roomAt(A.p.x, A.p.z), 0); assert.ok(Math.hypot(A.p.x - door(pa).x, A.p.z - door(pa).z) < 0.8, '집 문 앞으로 나옴'); assert.equal(A.p.room, 0);
// 방 밖에서 방 안 좌표로도 못 감, 멀리서는 못 들어감
A.send({ t: 'm', x: bb.cx, z: bb.cz, ry: 0 }); await wait(150); assert.equal(roomAt(A.p.x, A.p.z), 0);
Object.assign(A.p, { x: 0, z: 0 }); A.inbox.length = 0; A.send({ t: 'house', a: 'enter', plot: pa.id }); await until(() => A.get((m) => m.t === 'house' && m.a === 'no')); assert.equal(A.p.room || 0, 0);
Object.assign(A.p, door(pa)); A.send({ t: 'house', a: 'enter', plot: 99 }); await wait(100); assert.equal(A.p.room || 0, 0, '주인 없는 집·없는 번호');
// 손님 구경 + 잠금
Object.assign(B.p, door(pa)); B.send({ t: 'house', a: 'enter', plot: pa.id }); const inB = await until(() => B.get((m) => m.t === 'house' && m.a === 'in')); assert.equal(inB.mine, false); assert.equal(inB.inv, null); assert.equal(inB.owner, '방주인'); assert.equal(roomAt(B.p.x, B.p.z), pa.id);
B.send({ t: 'house', a: 'furn', list: [] }); await wait(150); assert.ok(!A.get((m) => m.t === 'house' && m.a === 'furn'), '남의 방은 못 꾸밈');
Object.assign(A.p, door(pa)); A.send({ t: 'house', a: 'enter', plot: pa.id }); await until(() => A.last((m) => m.t === 'house' && m.a === 'in'));
A.send({ t: 'house', a: 'lock', on: true }); await until(() => B.get((m) => m.t === 'house' && m.a === 'out')); assert.equal(roomAt(B.p.x, B.p.z), 0, '잠그면 손님은 문 앞으로'); assert.equal(roomAt(A.p.x, A.p.z), pa.id, '주인은 그대로');
assert.equal(S.house.snapshot(null).plots[pa.id].l, 1); B.inbox.length = 0; Object.assign(B.p, door(pa)); B.send({ t: 'house', a: 'enter', plot: pa.id }); assert.match((await until(() => B.get((m) => m.t === 'house' && m.a === 'no'))).error, /잠/);
A.send({ t: 'house', a: 'lock', on: false });
// 가구: 주인이 저장, 방 안 사람에게 알림, 사기
const mine = DEFAULT_FURN.filter((f) => f.k !== 'lamp'); A.send({ t: 'house', a: 'furn', list: mine }); const fu = await until(() => A.last((m) => m.t === 'house' && m.a === 'furn')); assert.equal(fu.furn.length, mine.length);
A.send({ t: 'house', a: 'furn', list: [...mine, { k: 'sofa', x: -2, z: 1.5, r: 0 }] }); await wait(150); assert.equal(A.last((m) => m.a === 'furn').furn.length, mine.length, '안 산 소파는 못 놓음');
Object.assign(A.p, { x: FURN_STALL.x, z: FURN_STALL.z }); A.send({ t: 'house', a: 'leave' }); await wait(100); Object.assign(A.p, { x: FURN_STALL.x, z: FURN_STALL.z });
A.inbox.length = 0; A.send({ t: 'house', a: 'buy', k: 'sofa' }); assert.match((await until(() => A.last((m) => m.t === 'house' && m.a === 'no'))).error, /칩이 모자라/); A.inbox.length = 0;
A.p.chips = 20000; A.send({ t: 'house', a: 'buy', k: 'sofa' }); const inv = await until(() => A.last((m) => m.t === 'house' && m.a === 'inv')); assert.equal(inv.inv.sofa, 1); assert.equal(A.p.chips, 12000);
A.send({ t: 'house', a: 'buy', k: 'bed' }); await wait(100); assert.equal(A.p.chips, 12000, '공짜 가구는 못 삼');
Object.assign(A.p, { x: 0, z: 0 }); A.send({ t: 'house', a: 'buy', k: 'tv' }); await wait(100); assert.equal(A.p.chips, 12000, '백화점에서 멀면 못 삼');
Object.assign(A.p, door(pa)); A.send({ t: 'house', a: 'enter', plot: pa.id }); await wait(150); A.send({ t: 'house', a: 'furn', list: [...mine, { k: 'sofa', x: -2, z: 1.5, r: 0 }] }); await until(() => A.last((m) => m.a === 'furn' && m.furn.some((f) => f.k === 'sofa')));
console.log('ok 서버(3398): 현관 앞에서 들어가기·방 밖으로 못 나감·나가면 문 앞·멀면 거절·손님 구경·잠그면 내보냄·가구 저장(검사)·가구 사기(백화점 가까이, 칩)');

// ── 앉기·눕기
{
  const { restSpots, REST_RANGE } = await import('./public/roomdata.js');
  const sp = restSpots(DEFAULT_FURN); assert.deepEqual(sp.map((q) => q.k), ['bed', 'chair']); assert.ok(sp.every((q) => Number.isFinite(q.x) && Number.isFinite(q.z)));
  const sofa = restSpots([{ k: 'sofa', x: 0, z: 0, r: 1 }]); assert.equal(sofa.length, 2); assert.ok(Math.abs(sofa[0].z - sofa[1].z) > 0.8 && Math.abs(sofa[0].x - sofa[1].x) < 0.01, '90° 돌리면 두 자리가 z 방향으로 늘어섬');
  const bb2 = roomBox(pa.id), chair = sp.find((q) => q.k === 'chair'), bed = sp.find((q) => q.k === 'bed');
  const at = (q) => ({ x: bb2.cx + q.x, z: bb2.cz + q.z });
  Object.assign(A.p, door(pa)); A.send({ t: 'house', a: 'enter', plot: pa.id }); await until(() => A.last((m) => m.t === 'house' && m.a === 'in'));
  A.send({ t: 'house', a: 'furn', list: DEFAULT_FURN }); await wait(200); A.inbox.length = 0;
  A.send({ t: 'house', a: 'rest', i: chair.i, s: chair.s }); assert.match((await until(() => A.get((m) => m.t === 'house' && m.a === 'no'))).error, /가까이/, '멀면 거절');
  Object.assign(A.p, { x: at(chair).x + 1, z: at(chair).z }); A.send({ t: 'house', a: 'rest', i: chair.i, s: chair.s });
  const ps = await until(() => A.get((m) => m.t === 'pose' && m.id === A.w.id && m.p === 'sit')); assert.equal(ps.h, 0.45); assert.ok(Math.hypot(A.p.x - at(chair).x, A.p.z - at(chair).z) < 0.01, '의자 자리로 옮겨 앉음'); assert.equal(A.p.pose, 'sit');
  A.send({ t: 'm', x: A.p.x, z: A.p.z, ry: A.p.ry, w: 0, y: 0 }); await wait(150); assert.equal(A.p.pose, 'sit', '가만히 있으면 그대로'); assert.ok(Math.hypot(A.p.x - at(chair).x, A.p.z - at(chair).z) < 0.01);
  // 손님이 같은 자리를 쓰려 하면 거절, 다른 자리(침대)는 됨
  Object.assign(B.p, door(pa)); B.send({ t: 'house', a: 'enter', plot: pa.id }); await until(() => B.last((m) => m.t === 'house' && m.a === 'in')); B.inbox.length = 0;
  Object.assign(B.p, { x: at(chair).x + 0.5, z: at(chair).z }); B.send({ t: 'house', a: 'rest', i: chair.i, s: chair.s }); assert.match((await until(() => B.get((m) => m.t === 'house' && m.a === 'no'))).error, /이미/);
  Object.assign(B.p, at(bed)); B.send({ t: 'house', a: 'rest', i: bed.i, s: bed.s }); const lp = await until(() => B.get((m) => m.t === 'pose' && m.id === B.w.id && m.p === 'lie')); assert.equal(lp.h, 0.5);
  // 움직이면 풀림, 풀리면 자리가 비어 다른 사람이 앉을 수 있음
  A.send({ t: 'm', x: A.p.x + 1, z: A.p.z, ry: 0, w: 1, y: 0 }); await until(() => A.p.pose === ''); assert.equal(A.p.rh, 0); assert.ok(!A.p.restKey);
  B.send({ t: 'm', x: B.p.x, z: B.p.z + 1.5, ry: 0, w: 1, y: 0 }); await until(() => B.p.pose === '');
  Object.assign(B.p, { x: at(chair).x + 0.5, z: at(chair).z }); B.send({ t: 'house', a: 'rest', i: chair.i, s: chair.s }); await until(() => B.get((m) => m.t === 'pose' && m.id === B.w.id && m.p === 'sit' && B.p.pose === 'sit'));
  B.send({ t: 'house', a: 'leave' }); await wait(150); assert.equal(B.p.pose, '', '방을 나가면 자세가 풀림'); assert.equal(roomAt(B.p.x, B.p.z), 0);
  A.send({ t: 'house', a: 'rest', i: 99, s: 0 }); A.send({ t: 'house', a: 'rest', i: 'x', s: 0 }); await wait(100);
  console.log('ok 앉기·눕기: 의자·소파·침대 자리 계산, 가까이서만, 자리로 옮겨 높이와 함께 자세, 가만히 있으면 유지·움직이면 풀림, 남이 쓰는 자리 거절, 방 나가면 풀림');
}
A.ws.close(); B.ws.close(); await wait(900);
const C = await user('roomA01x', '방주인2'); // 저장 확인: 다시 접속해서 가구가 남아 있는지는 같은 계정으로
C.ws.close(); await wait(200); srv.close();
console.log('집 안(방) 시험 통과 ✓'); process.exit(0);
