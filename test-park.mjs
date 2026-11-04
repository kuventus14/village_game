// 포근 놀이공원 기초 공사 시험 (docs/PARK.md): 설계 숫자 · 기구 자리 겹침 없음·길에 닿음(4m 띄움)·선로 간격 · 마을 → 서쪽 대문 → 길 → 정문 → 대로 → 기구·동물원 길 끝까지 걸어 닿음
// · 갇히는 빈 땅 없음 · 부지·길 밖은 보이지 않는 벽 · 동물 공간(ENCLOSURES)엔 못 들어감 · 장소 이름 · 벤치 자리 · 봇 길 찾기 · 서버 껍데기 연결
import assert from 'node:assert/strict';
import * as W from './public/world.js';
import { labels, worldBounds } from './public/minimap.js';
import { grid, findPath } from './bots.js';
import { createRidesServer } from './rides.js';

const { PARK, PARK_GATE, VILLAGE_GATE_W, PROMENADE, ENTRY_PLAZA, ZOO_ZONE, RIDES_ZONE, RIDE_SLOTS, PARK_PATHS, TRAIN_PATH, TRAIN_STATIONS, ZOO_PENS, PARK_SHOPS, slotRect, parkPathNear, parkRoadNear, trainAt, inPark } = W;
const overlap = (a, b, m = 0) => a[0] < b[2] + m && a[2] > b[0] - m && a[1] < b[3] + m && a[3] > b[1] - m;
const rectD = (r, x, z) => Math.hypot(Math.max(0, r[0] - x, x - r[2]), Math.max(0, r[1] - z, z - r[3]));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// ── 1. 설계 숫자 (PARK.md 그대로)
assert.deepEqual(PARK, { x0: -532, x1: -232, z0: -144, z1: 96 }); n++;
assert.deepEqual(VILLAGE_GATE_W, { x: -W.BX, z: -34, hw: 4.5 }); n++;
assert.deepEqual(PARK_GATE, { x: -232, z: -34, hw: 15 }); n++;
ok(PROMENADE.z === -34 && PROMENADE.hw === 9 && PROMENADE.x0 === -500 && PROMENADE.x1 === -268, '대로 축 z=-34, 반쪽 폭 9, x -268..-500');
ok(ENTRY_PLAZA.x0 === -268 && ENTRY_PLAZA.x1 === -232 && ENTRY_PLAZA.z0 === -74 && ENTRY_PLAZA.z1 === 6, '입구 광장');
assert.deepEqual(ZOO_ZONE, { x0: -520, x1: -250, z0: -142, z1: -68 }); assert.deepEqual(RIDES_ZONE, { x0: -520, x1: -250, z0: -22, z1: 94 }); n += 2;
ok(W.PARK_ROAD.len > 105 && W.PARK_ROAD.len < 130, `대문~정문 길 약 120m (${W.PARK_ROAD.len.toFixed(1)})`);
ok(Math.hypot(...W.PARK_ROAD.pts[0].map((v, i) => v - [VILLAGE_GATE_W.x, VILLAGE_GATE_W.z][i])) < 0.01 && Math.hypot(...W.PARK_ROAD.pts.at(-1).map((v, i) => v - [PARK_GATE.x, PARK_GATE.z][i])) < 0.01, '길은 마을 대문에서 정문까지');
ok(W.PARK_ROAD.hw[0] - 0.5 <= VILLAGE_GATE_W.hw + 1e-9 && W.PARK_ROAD.hw.at(-1) - 0.5 <= PARK_GATE.hw - 1, '길 폭이 대문·정문 안');

// ── 2. 기구 자리: 10종, 겹침 없음, 구역 안, 길에서 4m 이상 떨어지되 입구는 길에 닿음, 선로·동물원 칸·건물과 안 겹침
const ids = ['ferris', 'carousel', 'coaster', 'viking', 'bumper', 'teacups', 'swing', 'drop', 'flume', 'train'];
assert.deepEqual(Object.keys(RIDE_SLOTS).sort(), [...ids].sort()); n++;
ok(['ferris', 'carousel', 'train'].every((k) => RIDE_SLOTS[k].stage === 1) && ids.filter((k) => RIDE_SLOTS[k].stage === 2).length === 7, '1단계 3종 · 2단계 7종');
const SIZE = { ferris: [24, 64], carousel: [40, 40], coaster: [100, 52], viking: [32, 32], bumper: [44, 32], teacups: [40, 40], swing: [36, 36], drop: [22, 22], flume: [80, 52] };
for (const [k, [w, d]] of Object.entries(SIZE)) ok(RIDE_SLOTS[k].w === w && RIDE_SLOTS[k].d === d, `${k} 발자국 ${w}×${d}`);
ok(RIDE_SLOTS.ferris.x === -496 && RIDE_SLOTS.ferris.z === -34 && RIDE_SLOTS.ferris.wheel.r === 28 && RIDE_SLOTS.ferris.wheel.hub === 31, '대관람차 (-496,-34), 반지름 28, 축 31');
const slots = Object.values(RIDE_SLOTS), rects = slots.map(slotRect);
for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) ok(!overlap(rects[i], rects[j]), `${slots[i].id} ↔ ${slots[j].id} 안 겹침`);
const others = [...ZOO_PENS.map((p) => [p.id, [p.x0, p.z0, p.x1, p.z1]]), ...PARK_SHOPS.map((b, i) => [`${b.name}${i}`, [b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2]]), ...TRAIN_STATIONS.map((s) => [s.name, s.rect])];
for (let i = 0; i < slots.length; i++) for (const [id, r] of others) if (!(slots[i].id === 'train' && id === '정문역')) ok(!overlap(rects[i], r), `${slots[i].id} ↔ ${id} 안 겹침`);
const segPts = (p, step = 0.5) => { const L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]), out = []; for (let s = 0; s <= L; s += step) out.push([p.a[0] + (p.b[0] - p.a[0]) * s / L, p.a[1] + (p.b[1] - p.a[1]) * s / L]); return out; };
for (const s of slots) {
  if (s.id === 'train') continue;
  const r = slotRect(s);
  if (s.id !== 'ferris') {
    ok(r[0] >= RIDES_ZONE.x0 && r[2] <= RIDES_ZONE.x1 && r[1] >= RIDES_ZONE.z0 && r[3] <= RIDES_ZONE.z1, `${s.id} 기구 구역 안`);
    for (const p of PARK_PATHS) { const g = Math.min(...segPts(p).map(([x, z]) => rectD(r, x, z))) - p.hw; ok(g >= 4 - 1e-6, `${s.id} ↔ 길 ${p.id} 4m 이상 (${g.toFixed(2)})`); }
    const e = parkPathNear(...s.entry); ok(rectD(r, ...s.entry) < 0.01 && e.d >= 3.99 && e.d <= 8, `${s.id} 입구가 길(${e.p.id})에 닿음 (${e.d.toFixed(1)}m)`);
  } else ok(parkPathNear(...s.entry, ['promenade']).d <= 0, '대관람차 입구 = 대로 끝 승강장');
  let tr = Infinity; for (let k = 0; k < TRAIN_PATH.len; k += 0.5) { const [x, z] = trainAt(k); tr = Math.min(tr, rectD(r, x, z)); }
  ok(tr >= 3.5, `${s.id} 선로와 ${tr.toFixed(1)}m`);
}
// ── 3. 꼬마기차 선로: 닫힘, 부지 안, 동물원 칸·건물과 떨어짐, 역 3곳은 선로 위
{
  const P = TRAIN_PATH.pts;
  ok(TRAIN_PATH.closed && Math.abs(TRAIN_PATH.s.at(-1) - TRAIN_PATH.len) < 1e-9 && TRAIN_PATH.len > 800, `닫힌 선로 ${TRAIN_PATH.len.toFixed(0)}m`);
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; ok(Math.hypot(b[0] - a[0], b[1] - a[1]) < 9 && inPark(a[0], a[1], 4), `선로 점 ${i} 부지 안·촘촘`); }
  for (const [id, r] of [...ZOO_PENS.map((p) => [p.id, [p.x0, p.z0, p.x1, p.z1]]), ...PARK_SHOPS.map((b) => [b.name, [b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2]])]) { let d = Infinity; for (let k = 0; k < TRAIN_PATH.len; k += 0.5) d = Math.min(d, rectD(r, ...trainAt(k))); ok(d >= 3, `선로 ↔ ${id} ${d.toFixed(1)}m`); }
  ok(TRAIN_STATIONS.length === 3 && TRAIN_STATIONS.every((s) => W.trainNear(s.x, s.z).d < 1e-6), '역 3곳 (정문역·동물원역·기구역) 선로 위');
  const [x0, z0] = trainAt(0), [x1, z1] = trainAt(TRAIN_PATH.len - 1e-6); ok(Math.hypot(x1 - x0, z1 - z0) < 0.01, 'trainAt 한 바퀴 이어짐');
}
// ── 4. 동물원 칸: 8종, 동물원 구역 안, 서로 안 겹침
ok(ZOO_PENS.length === 8 && new Set(ZOO_PENS.map((p) => p.id)).size === 8, '동물원 칸 8종');
for (const p of ZOO_PENS) ok(p.x0 >= ZOO_ZONE.x0 && p.x1 <= ZOO_ZONE.x1 && p.z0 >= ZOO_ZONE.z0 && p.z1 <= ZOO_ZONE.z1, `${p.name} 칸이 동물원 구역 안`);
for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const a = ZOO_PENS[i], b = ZOO_PENS[j]; ok(!overlap([a.x0, a.z0, a.x1, a.z1], [b.x0, b.z0, b.x1, b.z1], 7.9), `${a.name}·${b.name} 사이 길 8m 이상`); }

// ── 5. 걸어 닿음: 마을 서쪽(대문 안)에서 0.5m 격자로 채움 (x -545..-100)
const S = 0.5, X0 = -545, X1 = -100, Z0 = -152, Z1 = 104, NX = Math.round((X1 - X0) / S) + 1, NZ = Math.round((Z1 - Z0) / S) + 1;
const idx = (x, z) => { const i = Math.round((x - X0) / S), j = Math.round((z - Z0) / S); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : i + j * NX; };
const st = new Uint8Array(NX * NZ); // 0 모름 1 빈 땅 2 막힘
const free = (k) => { if (!st[k]) { const x = X0 + (k % NX) * S, z = Z0 + Math.floor(k / NX) * S, [a, b] = W.resolve(x, z, 0.4, 0); st[k] = Math.hypot(a - x, b - z) < 0.01 ? 1 : 2; } return st[k] === 1; };
const reach = new Uint8Array(NX * NZ), q = [idx(-105, -34)];
const t0 = performance.now();
ok(free(q[0]), '출발점(마을 서쪽 대문 안)이 빈 땅');
reach[q[0]] = 1;
while (q.length) { const k = q.pop(), i = k % NX, j = (k / NX) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue; const m = ni + nj * NX; if (!reach[m] && free(m)) { reach[m] = 1; q.push(m); } } }
const can = (x, z, r = 1) => { for (let dx = -r; dx <= r; dx += S) for (let dz = -r; dz <= r; dz += S) { const k = idx(x + dx, z + dz); if (k >= 0 && reach[k] && Math.hypot(dx, dz) <= r) return true; } return false; };
ok(can(VILLAGE_GATE_W.x - 2, VILLAGE_GATE_W.z), '서쪽 대문 밖');
for (const s of [10, 40, 70, 100]) { const [x, z] = W.parkRoadAt(s); ok(can(x, z, 0.5), `길 ${s}m 지점`); }
ok(can(PARK_GATE.x + 3, PARK_GATE.z) && can(PARK_GATE.x - 3, PARK_GATE.z) && can(PARK_GATE.x - 1, PARK_GATE.z + 12) && can(PARK_GATE.x - 1, PARK_GATE.z - 12), '정문 앞·안 (가운데와 양옆)');
ok(can(W.PLAZA_FOUNTAIN.x, W.PLAZA_FOUNTAIN.z + 9) && can(W.PLAZA_FOUNTAIN.x, W.PLAZA_FOUNTAIN.z - 9), '광장 분수 둘레');
for (const p of PARK_PATHS) for (const [x, z] of segPts(p, 4)) ok(can(x, z, 1), `길 ${p.id} (${x.toFixed(0)},${z.toFixed(0)})`);
for (const s of slots) ok(can(...s.entry, 1), `${s.id} 입구`);
for (const s of TRAIN_STATIONS) ok(can(s.x + s.nx * 3, s.z + s.nz * 3, 1.5), `${s.name} 승강장 앞`);
for (const st2 of W.SEATS.filter((s) => s.kind === 'park' && inPark(s.x, s.z))) { const [x, z] = W.standPos(st2); ok(can(x, z, 1), `놀이공원 벤치 ${st2.id} 앞`); }
// 갇히는 빈 땅 없음: 부지 안 빈 땅은 전부 닿음 (동물 공간 ENCLOSURES 는 빼고). 닿은 칸은 전부 마을·길·부지 안
const inEnc = (x, z) => W.ENCLOSURES.some((e) => x > e.x0 && x < e.x1 && z > e.z0 && z < e.z1);
let trapped = [], leak = [], encIn = [];
for (let k = 0; k < NX * NZ; k++) {
  const x = X0 + (k % NX) * S, z = Z0 + Math.floor(k / NX) * S;
  if (reach[k]) { const r = parkRoadNear(x, z); if (!inPark(x, z) && r.d > r.hw && !W.inTown(x, z)) leak.push([x, z]); if (W.ENCLOSURES.some((e) => x > e.x0 + 0.5 && x < e.x1 - 0.5 && z > e.z0 + 0.5 && z < e.z1 - 0.5)) encIn.push([x, z]); continue; }
  if (inPark(x, z, 1) && !inEnc(x, z) && free(k) && W.resolve(x + 0.013, z + 0.007)[0] === x + 0.013) trapped.push([x, z]); // 원 한가운데 점은 밀 방향이 없어 '빈 땅'처럼 보임 → 살짝 비켜 다시 봄
}
assert.deepEqual(trapped.slice(0, 5), [], `갇힌 빈 땅 ${trapped.length}칸`); n++;
assert.deepEqual(leak.slice(0, 5), [], `부지·길 밖으로 새어 나감 ${leak.length}칸`); n++;
assert.deepEqual(encIn.slice(0, 5), [], `동물 공간 안으로 들어감 ${encIn.length}칸`); n++;
// 부지 울타리·길 밖은 보이지 않는 벽 (정문 말고는 못 나감), 마을 서쪽 울타리는 대문 자리만 열림
for (const [x, z] of [[PARK.x0 - 3, 0], [PARK.x1 + 3, 60], [PARK.x1 + 3, -120], [-400, PARK.z0 - 3], [-400, PARK.z1 + 3], [-180, 0], [-180, -60]]) { const [a, b] = W.resolve(x, z); const r = parkRoadNear(a, b); ok(inPark(a, b, 0.5) || r.d <= r.hw - 0.45 || W.inTown(a, b), `밖 (${x},${z}) → 안 (${a.toFixed(1)},${b.toFixed(1)})`); }
ok(!can(-W.BX - 2, VILLAGE_GATE_W.z + VILLAGE_GATE_W.hw + 3, 0.2) && !can(-W.BX - 2, 0, 0.2), '마을 서쪽 울타리 대문 옆으로는 못 나감');
ok(!can(PARK_GATE.x + 2, PARK_GATE.z + 20, 0.2), '정문 탑 자리는 막힘');
console.log(`  걸어 닿는 칸 ${reach.reduce((a, v) => a + v, 0)} (0.5m 격자, ${((performance.now() - t0) / 1000).toFixed(1)}초)`);

// ── 6. 장소 이름·지도
ok(W.placeOf(-250, -20) === 'park' && W.placeOf(-170, -34) === 'park' && W.placeOf(-400, -103) === 'zoo' && W.placeOf(-300, 30) === 'park' && W.placeOf(0, 8) === 'town', 'placeOf: 놀이공원·가는 길·동물원·마을');
assert.deepEqual(W.PLACE.park, ['🎡', '놀이공원']); assert.deepEqual(W.PLACE.zoo, ['🦒', '동물원']); n += 2;
{ const L = labels(), B = worldBounds(); ok(L.some((l) => l.text === '놀이공원') && L.some((l) => l.text === '동물원') && L.some((l) => l.text === '정문'), '지도 이름표'); ok(B[0] <= PARK.x0 && B[1] <= PARK.z0 && B[3] >= PARK.z1, '지도 범위에 부지 전체'); }
// ── 7. 봇: 격자가 서쪽 대문으로 이어져 놀이공원·동물원 칸이 있고 길이 찾아짐
{ const g = grid(); ok(g.cells.park?.length > 1000 && g.cells.zoo?.length > 200, `봇 격자 놀이공원 ${g.cells.park?.length}칸 · 동물원 ${g.cells.zoo?.length}칸`);
  for (const [x, z] of [[-250, -20], [-480, -34], [-398, -120], [-300, 27]]) { const p = findPath(0, 9, x, z); ok(p && Math.hypot(p.at(-1)[0] - x, p.at(-1)[1] - z) < 3, `봇 길: 광장 → (${x},${z})`); } }
// ── 8. 서버 놀이기구 껍데기: 약속한 이름이 다 있음
{ const r = createRidesServer({ now: () => 0, rand: Math.random, players: new Map(), send() {}, bcast() {}, info() {}, stand() {} }); ok(['act', 'tick', 'snapshot', 'leave', 'frozen'].every((k) => typeof r[k] === 'function'), 'createRidesServer 약속'); }
ok(typeof W.RIDES === 'object' && Array.isArray(W.RIDE_RECTS) && Array.isArray(W.RIDE_CIRCLES) && Array.isArray(W.ZOO_RECTS) && Array.isArray(W.ZOO_CIRCLES) && Array.isArray(W.ENCLOSURES), 'zoodata·ridesdata 이름 (world.js 가 다시 내보냄)');
console.log(`놀이공원 기초 시험 통과 ✓ (${n}개 확인, 길 ${W.PARK_ROAD.len.toFixed(0)}m, 선로 ${TRAIN_PATH.len.toFixed(0)}m)`);
process.exit(0);
