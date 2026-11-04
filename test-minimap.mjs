// 지도 계산 시험: 좌표 변환 왕복, 반경 70m 오려내기, 숲길 남은 거리, 이름표가 world.js 좌표에서 나오는지
import assert from 'node:assert/strict';
import * as W from './public/world.js';
import { VIEW_R, BAKE_S, worldBounds, view, fitView, miniView, toMap, fromMap, crop, labels, where } from './public/minimap.js';

const near = (a, b, e = 1e-6, m = '') => assert.ok(Math.abs(a - b) < e, `${m} ${a} ≈ ${b}`);

// 1) 월드 ↔ 지도 왕복, 북쪽(-z)이 위
for (const v of [miniView(12, -30, 190), view(200, -100, 1.7, 900, 520)]) for (const [x, z] of [[0, 0], [-120, 44], [346, -194], [v.cx, v.cz]]) {
  const [px, py] = toMap(v, x, z), [bx, bz] = fromMap(v, px, py);
  near(bx, x, 1e-9, '왕복 x'); near(bz, z, 1e-9, '왕복 z');
}
{ const v = miniView(0, 0, 190); assert.ok(toMap(v, 0, -10)[1] < toMap(v, 0, 10)[1], '북쪽(-z)이 위'); assert.deepEqual(toMap(v, 0, 0), [95, 95]); }

// 2) 미니맵은 내 위치 반경 70m: 지도 가장자리 = 중심 ±70m, 오려낸 밑그림 = 140m × BAKE_S px
const B = worldBounds();
{
  const v = miniView(10, -60, 190); // 밑그림 안쪽 (위아래로도 잘리지 않는 곳)
  near(fromMap(v, 0, 0)[0], 10 - VIEW_R); near(fromMap(v, 190, 190)[1], -60 + VIEW_R);
  const r = crop(v, B, BAKE_S);
  near(r.sw, 2 * VIEW_R * BAKE_S); near(r.sh, 2 * VIEW_R * BAKE_S); near(r.dx, 0); near(r.dy, 0); near(r.dw, 190); near(r.dh, 190);
  near(r.sx, (10 - VIEW_R - B[0]) * BAKE_S);
}
{ // 월드 가장자리(마을 서쪽 끝)에선 밑그림 밖을 잘라 내고 그 자리만큼 오른쪽에 붙임
  const v = miniView(B[0] + 20, 0, 140), r = crop(v, B, BAKE_S);
  near(r.sx, 0); near(r.dx, (VIEW_R - 20) * v.k); near(r.dw, (VIEW_R + 20) * v.k); near(r.sw, (VIEW_R + 20) * BAKE_S);
  assert.equal(crop(miniView(B[0] - 500, 0, 140), B, BAKE_S), null, '완전히 밖이면 null');
}
// 3) 전체 지도 범위에 마을·숲길·사찰 마당이 다 들어감, 맞춤 보기는 화면 안
{
  const Y = W.TEMPLE_YARD;
  assert.ok(B[0] <= -W.BX && B[2] >= W.BX && B[1] <= -W.BZ && B[3] >= W.BZ, '마을');
  assert.ok(W.TRAIL.pts.every(([x, z]) => x > B[0] && x < B[2] && z > B[1] && z < B[3]), '숲길');
  assert.ok(B[2] >= Y.cx + Y.w / 2 && B[1] <= Y.cz - Y.d / 2, '사찰 마당');
  const v = fitView(B, 900, 520, 14);
  for (const [x, z] of [[B[0], B[1]], [B[2], B[3]]]) { const [px, py] = toMap(v, x, z); assert.ok(px >= 13.9 && px <= 886.1 && py >= -0.1 && py <= 520.1, `맞춤 ${px},${py}`); }
}
// 4) 숲길 위: 사찰까지 + 대문까지 = TRAIL.len, 마을·사찰에선 안내 없음
{
  for (const i of [5, Math.floor(W.TRAIL.pts.length / 2), W.TRAIL.pts.length - 5]) {
    const [x, z] = W.TRAIL.pts[i], w = where(x, z);
    assert.equal(w.pl, 'trail', `숲길 점 ${i}`);
    near(w.toTemple, W.TRAIL.len - W.TRAIL.s[i], 1e-6, '남은 거리');
    assert.match(w.tip, /사찰까지 약 \d+m/);
  }
  const a = where(...W.TRAIL.pts[5]), b = where(...W.TRAIL.pts[W.TRAIL.pts.length - 5]);
  assert.ok(a.toTemple > b.toTemple, '사찰에 가까워질수록 줄어듦');
  assert.equal(where(0, 8).pl, 'town'); assert.equal(where(0, 8).tip, '');
  assert.equal(where(W.TEMPLE_YARD.cx, W.TEMPLE_YARD.cz).pl, 'temple');
}
// 5) 이름표는 world.js 좌표에서 (건물이 옮겨지면 따라감)
{
  const L = labels(), by = (t) => L.find((l) => l.text === t);
  for (const k of ['cafe', 'office', 'casino', 'cathedral', 'church', 'temple']) {
    const [icon, name] = W.PLACE[k], l = by(name);
    assert.ok(l, name); assert.equal(l.icon, icon); assert.equal(l.x, W.BUILDINGS[k].cx); assert.equal(l.z, W.BUILDINGS[k].cz);
  }
  assert.equal(by('광장').x, W.FOUNTAIN.x); assert.equal(by('연못').z, W.POND.z); assert.equal(by('대문').x, W.GATE.x);
  assert.equal(by(W.TAG.name).x, W.TAG.cx); assert.equal(by('피구').z, W.DODGE.cz);
  const old = W.BUILDINGS.cafe.cx; W.BUILDINGS.cafe.cx = old + 7; // export 된 객체를 바꾸면 이름표도 바뀜
  assert.equal(labels().find((l) => l.text === '카페').x, old + 7); W.BUILDINGS.cafe.cx = old;
  assert.equal(!!by('캠프'), Number.isFinite(W.CAMP?.x), '캠프는 있을 때만');
}
console.log('지도 시험 통과 ✓ (숲길 길이', Math.round(W.TRAIL.len), 'm, 지도 범위', B.map(Math.round).join(','), ')');
