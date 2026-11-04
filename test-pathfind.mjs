// 자동 걸음 길 찾기 시험 (public/pathfind.js = 봇과 화면이 같이 쓰는 격자·A*): 마을 가운데 → 주요 목적지 길이 있음,
// 그 길을 화면처럼(같은 resolve, 한 프레임씩) 걸으면 실제로 도착함, 못 들어가는 곳은 가까운 걸을 수 있는 곳으로 보정, 계산 시간
import assert from 'node:assert/strict';
import * as W from './public/world.js';
import { grid, findPath, nearest, free } from './public/pathfind.js';

const t0 = performance.now();
grid();
const buildMs = performance.now() - t0;
// 화면 control() 과 같은 걸음: 다음 점(1.2m 안이면 그다음)으로 1/60초씩, 50m 넘게 남으면 달리기(1.6배), 같은 resolve
function walk(P, x, z) {
  let i = 1, t = 0, stall = 0, last = [x, z];
  for (; t < 400; t += 1 / 60) {
    while (i < P.length - 1 && Math.hypot(P[i][0] - x, P[i][1] - z) < 1.2) i++;
    const end = P.at(-1);
    if (Math.hypot(end[0] - x, end[1] - z) < 0.6) return { ok: true, t };
    let rest = Math.hypot(P[i][0] - x, P[i][1] - z); for (let k = i; k < P.length - 1; k++) rest += Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]);
    const dx = P[i][0] - x, dz = P[i][1] - z, d = Math.hypot(dx, dz) || 1, sp = 5 * (rest > 50 ? 1.6 : 1) / 60;
    [x, z] = W.resolve(x + (dx / d) * sp, z + (dz / d) * sp, 0.4, 0);
    if (Math.round(t * 60) % 90 === 0) { stall = Math.hypot(x - last[0], z - last[1]) < 1 ? stall + 1 : 0; last = [x, z]; if (stall >= 2) return { ok: Math.hypot(end[0] - x, end[1] - z) < 2.5, t, stuck: [x, z] }; } // 1.5초에 1m 도 못 가면 막힘 (목적지 바로 앞이면 도착으로 침, 화면과 같음)
  }
  return { ok: false, t };
}
const B = W.BUILDINGS, door = (k, d = 3) => { const [x, z] = W.doorPos(B[k]), [nx, nz] = W.sideNormal(B[k].door); return [x + nx * d, z + nz * d]; };
const DEST = {
  '사찰 앞': door('temple', 4),
  '불멍 캠프': [W.FIRE.x, W.FIRE.z + 6],
  '놀이공원 정문': [W.PARK_GATE.x - 6, W.PARK_GATE.z],
  '대관람차 승강장': [W.FERRIS.x + 4, W.FERRIS.z],
  '동물원 길': [W.ZOO_AVE_X, W.ZOO_ROW_Z],
  '범퍼카 입구': [W.bumperHome(4).x, 41.2],
  '카페 안': [B.cafe.cx, B.cafe.cz],
  '숲길 가운데': W.TRAIL.pts[Math.floor(W.TRAIL.pts.length / 2)],
};
let pmax = 0;
for (const [name, [x, z]] of Object.entries(DEST)) {
  const to = free(x, z) ? [x, z] : nearest(x, z);
  assert.ok(to && Math.hypot(to[0] - x, to[1] - z) < 6, `${name}: 걸을 수 있는 곳 (보정 ${to && Math.hypot(to[0] - x, to[1] - z).toFixed(1)}m)`);
  const s = performance.now(), P = findPath(0, 8, ...to), ms = performance.now() - s;
  pmax = Math.max(pmax, ms);
  assert.ok(P && P.length >= 2, `마을 가운데 → ${name} 길 있음`);
  for (let k = 1; k < P.length; k++) assert.ok(Number.isFinite(P[k][0]) && Number.isFinite(P[k][1]), '길 점은 숫자');
  const w = walk(P, 0, 8);
  assert.ok(w.ok, `${name}: 길을 따라 실제로(충돌 그대로) 걸어 도착 ${w.stuck ? `— 막힘 ${w.stuck.map((v) => v.toFixed(1))}` : ''}`);
  console.log(`  ${name}: ${P.length}점, 길 찾기 ${ms.toFixed(1)}ms, 걸어서 ${w.t.toFixed(0)}초`);
}
// 못 들어가는 곳: 분수 한가운데·연못 물 위·건물 벽 속·놀이터 패드 → 가장 가까운 걸을 수 있는 칸, 거기까지 길 있음
for (const [name, x, z] of [['분수 물 위', 0.6, 0.4], ['연못 물 위', W.POND.x + 0.5, W.POND.z + 0.3], ['집 벽 속', W.HOUSES[0].x, W.HOUSES[0].z], ['놀이터 패드', W.TAG.pad.x, W.TAG.pad.z], ['울타리 밖 들판', 0, W.BZ + 6]]) { // (원 충돌의 딱 한가운데 점은 resolve 가 못 밀어내서 피함 — 화면 클릭으로는 사실상 안 생김)
  assert.ok(!free(x, z), `${name} 은 바로 걸을 수 없는 곳`);
  const to = nearest(x, z);
  assert.ok(to && free(...to) && Math.hypot(to[0] - x, to[1] - z) < 12, `${name} → 가까운 걸을 수 있는 곳으로 보정 (${to && Math.hypot(to[0] - x, to[1] - z).toFixed(1)}m)`);
  assert.ok(findPath(0, 8, ...to), `${name} 보정한 곳까지 길 있음`);
}
assert.equal(nearest(5000, 5000), null, '지도 밖 아주 먼 곳 → 없음 (화면은 "길이 없어요")');
console.log(`  격자 만들기 ${buildMs.toFixed(0)}ms (화면은 Web Worker 에서 한 번), 먼 길 찾기 최대 ${pmax.toFixed(1)}ms`);
assert.ok(pmax < 200, '먼 길도 0.2초 안에 찾음');
console.log('길 찾기 시험 통과');
