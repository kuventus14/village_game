// 포근 동물원 시험: 종마다 마릿수 · 10분 동안 모든 동물이 자기 울타리 안 + 장애물과 안 겹침 · animalPose 결정성·연속성(점프 없음)
// · 울타리 안은 resolve 로 못 들어감 · 길·관람 자리(난간 앞)는 동물원 입구에서 걸어 닿음
import assert from 'node:assert/strict';
import * as W from './public/world.js';

const { ZOO_ANIMALS, ZOO_SPECIES, ENCLOSURES, ZOO_RECTS, ZOO_PENS, ZOO_ARCH, animalPose, resolve } = W;
let n = 0;
const ok = (c, msg) => { assert.ok(c, msg); n++; };

// ── 1. 마릿수·칸
const WANT = { giraffe: 4, lion: 5, tiger: 4, redpanda: 5, zebra: 5, hippo: 4, ostrich: 5, panda: 4 };
ok(ENCLOSURES.length === 8 && ZOO_RECTS.length >= 8, '울타리 8칸');
for (const [sp, want] of Object.entries(WANT)) {
  const adults = ZOO_ANIMALS.filter((a) => a.species === sp && !a.baby);
  ok(adults.length >= want && adults.length >= 4, `${ZOO_SPECIES[sp].name} 어른 ${adults.length}마리 (≥${want})`);
  ok(ZOO_ANIMALS.filter((a) => a.species === sp).every((a) => a.pen === sp), `${sp} 은 자기 칸`);
}
ok(ZOO_ANIMALS.some((a) => a.model === 'lionM'), '갈기 수사자');
ok(new Set(ZOO_ANIMALS.map((a) => a.id)).size === ZOO_ANIMALS.length, '동물 id 겹침 없음');
ok(W.ANIMALS === ZOO_ANIMALS, 'ANIMALS = ZOO_ANIMALS');
for (const e of ENCLOSURES) { const p = ZOO_PENS.find((q) => q.id === e.id); ok(p && e.x0 === p.x0 && e.z1 === p.z1, `${e.name} 칸 = ZOO_PENS`); }

// ── 2. 10분 동안 울타리 안 + 장애물 피함 (10초 간격, 시계 두 가지: 0 과 실제 시각 근처)
const enc = Object.fromEntries(ENCLOSURES.map((e) => [e.id, e]));
let checks = 0;
for (const base of [0, 1.762e12]) for (const a of ZOO_ANIMALS) {
  const E = enc[a.pen], r = ZOO_SPECIES[a.species].r * a.scale;
  for (let t = 0; t <= 600; t += 10) {
    const p = animalPose(a, base + t * 1000);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.ry), `${a.id} 숫자`);
    assert.ok(p.x - r >= E.x0 && p.x + r <= E.x1 && p.z - r >= E.z0 && p.z + r <= E.z1, `${a.id} ${t}s (${p.x.toFixed(1)},${p.z.toFixed(1)}) 울타리 밖`);
    for (const o of E.obstacles) if (!(a.species === 'hippo' && o.k === 'pond')) assert.ok(Math.hypot(p.x - o.x, p.z - o.z) >= o.r + r, `${a.id} ${t}s ${o.k} 와 겹침`);
    checks++;
  }
}
n++; console.log(`  위치 ${checks}번 확인 (${ZOO_ANIMALS.length}마리 × 10분 × 2 시계)`);

// ── 3. 결정성: 같은 입력 = 같은 출력 (id 로 불러도 같음)
for (const a of ZOO_ANIMALS) for (const t of [0, 12345, 9.87e11]) assert.deepEqual(animalPose(a, t), animalPose(a.id, t), `${a.id} 결정성`);
n++;
// ── 4. 연속성: 0.1초 간격으로 10분 — 한 번에 0.5m·0.5rad 넘게 안 움직임, 동작 세기도 부드러움
const angD = (a, b) => Math.abs(((b - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
let maxStep = 0, maxTurn = 0, maxK = 0;
for (const a of ZOO_ANIMALS) {
  let q = animalPose(a, 0);
  for (let t = 100; t <= 600000; t += 100) {
    const p = animalPose(a, t), d = Math.hypot(p.x - q.x, p.z - q.z), da = angD(q.ry, p.ry);
    maxStep = Math.max(maxStep, d); maxTurn = Math.max(maxTurn, da);
    if (p.act === q.act) maxK = Math.max(maxK, Math.abs(p.k - q.k));
    assert.ok(d < 0.5 && da < 0.5, `${a.id} ${t / 1000}s 점프 ${d.toFixed(2)}m ${da.toFixed(2)}rad`);
    assert.ok(Math.abs(p.sink - q.sink) < 0.2, `${a.id} ${t / 1000}s 잠김 점프`);
    q = p;
  }
}
ok(maxK < 0.3, `동작 세기 부드러움 (최대 ${maxK.toFixed(2)})`);
console.log(`  0.1초마다 최대 이동 ${maxStep.toFixed(2)}m · 최대 회전 ${maxTurn.toFixed(2)}rad`);
// 쉬는 동작이 실제로 나옴 (종마다) + 하마는 물에 잠기는 때가 있음
for (const sp of Object.keys(WANT)) { const acts = new Set(); for (const a of ZOO_ANIMALS.filter((x) => x.species === sp)) for (let t = 0; t < 600000; t += 2000) acts.add(animalPose(a, t).act); ok(acts.has('walk') && acts.size >= 3, `${sp} 동작 ${[...acts].join('·')}`); }
ok(ZOO_ANIMALS.filter((a) => a.species === 'hippo').every((a) => { for (let t = 0; t < 600000; t += 2000) if (animalPose(a, t).sink > 0.5) return true; return false; }), '하마는 모두 물에 잠기는 때가 있음');

// ── 5. 사람: 울타리 안으로 못 들어감 (칸 안 어디에서 시작해도 밖으로 밀려남)
for (const e of ENCLOSURES) for (let x = e.x0 + 0.3; x < e.x1; x += 2.1) for (let z = e.z0 + 0.3; z < e.z1; z += 1.7) {
  const [a, b] = resolve(x, z, 0.4, 0);
  assert.ok(!(a > e.x0 && a < e.x1 && b > e.z0 && b < e.z1), `${e.name} 안 (${x.toFixed(1)},${z.toFixed(1)}) 이 밀려나지 않음`);
}
n++;
// ── 6. 걸어 닿음: 동물원 입구 아치 앞에서 0.5m 격자로 채워 길·관람 자리(난간 앞 0.8m)에 닿음
const Z = W.ZOO_ZONE, S = 0.5, X0 = Z.x0 - 14, X1 = Z.x1 + 6, Z0 = W.PARK.z0, Z1 = -30, NX = Math.round((X1 - X0) / S) + 1, NZ = Math.round((Z1 - Z0) / S) + 1;
const st = new Uint8Array(NX * NZ), reach = new Uint8Array(NX * NZ);
const free = (k) => { if (!st[k]) { const x = X0 + (k % NX) * S, z = Z0 + Math.floor(k / NX) * S, [a, b] = resolve(x, z, 0.4, 0); st[k] = Math.hypot(a - x, b - z) < 0.01 ? 1 : 2; } return st[k] === 1; };
const idx = (x, z) => { const i = Math.round((x - X0) / S), j = Math.round((z - Z0) / S); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : i + j * NX; };
const start = idx(ZOO_ARCH.x, ZOO_ARCH.z + 4); ok(free(start), '아치 앞 빈 땅'); reach[start] = 1;
for (const q = [start]; q.length;) { const k = q.pop(), i = k % NX, j = (k / NX) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue; const m = ni + nj * NX; if (!reach[m] && free(m)) { reach[m] = 1; q.push(m); } } }
const can = (x, z, r = 0.8) => { for (let dx = -r; dx <= r; dx += S) for (let dz = -r; dz <= r; dz += S) { const k = idx(x + dx, z + dz); if (k >= 0 && reach[k]) return true; } return false; };
for (const p of W.PARK_PATHS.filter((q) => q.kind === 'zoo')) for (let t = 0; t <= 1; t += 0.1) { const x = p.a[0] + (p.b[0] - p.a[0]) * t, z = p.a[1] + (p.b[1] - p.a[1]) * t; ok(can(x, z), `동물원 길 ${p.id} (${x.toFixed(0)},${z.toFixed(0)})`); }
for (const e of ENCLOSURES) { // 관람 자리: 줄 사이 길 쪽 난간 앞 (윗줄은 남쪽, 아랫줄은 북쪽·남쪽) 세 곳씩
  const sides = e.z1 < W.ZOO_ROW_Z ? [e.z1 + 0.8] : [e.z0 - 0.8, e.z1 + 0.8];
  for (const z of sides) for (const f of [0.2, 0.5, 0.8]) ok(can(e.x0 + (e.x1 - e.x0) * f, z, 0.3), `${e.name} 난간 앞 (${f}, ${z})`);
  ok(!can(e.cx, e.cz, 3), `${e.name} 칸 가운데는 못 감`);
}
console.log(`동물원 시험 통과 ✓ (${n}개 확인, ${ZOO_ANIMALS.length}마리, ${ZOO_ANIMALS.filter((a) => a.baby).length}마리 새끼)`);
process.exit(0);
