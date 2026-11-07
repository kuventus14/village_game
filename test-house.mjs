// 주택 단지 설계도 시험: 집터 20곳·겹침 없음·집이 집터 안·현관이 큰길 쪽·다른 구역(마을·놀이공원·캠프·숲길·사찰)과 안 겹침·땅 거리 함수
import assert from 'node:assert/strict';
import { PLOTS, DISTRICT, ENTRY, GATE_ROAD, NORTH_GATE, STREETS, AV_BAND, SPINE, PLOT_W, PLOT_D, HOUSE, STREET_HW, OPEN_FIRST, plotAt, plotById, districtDist, inDistrict, HOUSE_RECTS, openAvenues, isOpen, openZ0 } from './public/housedata.js';
import { BX, BZ, trailNear, campDist, parkDist, TEMPLE_YARD } from './public/world.js';

assert.equal(PLOTS.length, 100); assert.deepEqual(PLOTS.map((p) => p.id), Array.from({ length: 100 }, (_, i) => i + 1), '번호 1~100'); assert.equal(STREETS.length, 5);
const ov = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
for (const a of PLOTS) {
  assert.equal(a.x1 - a.x0, PLOT_W); assert.equal(a.z1 - a.z0, PLOT_D);
  assert.ok(a.x0 >= DISTRICT.x0 && a.x1 <= DISTRICT.x1 && a.z0 >= DISTRICT.z0 && a.z1 <= DISTRICT.z1, `집터 ${a.id} 가 단지 안`);
  for (const b of PLOTS) if (a !== b) assert.ok(!ov(a, b), `집터 ${a.id}·${b.id} 겹침`);
  const [hx0, hz0, hx1, hz1] = a.house; assert.ok(hx0 >= a.x0 + 4 && hx1 <= a.x1 - 4 && hz0 >= a.z0 + 4 && hz1 <= a.z1 - 4 + 8 && hz0 >= a.z0 && hz1 <= a.z1, `집 ${a.id} 가 집터 안`);
  assert.ok(Math.abs(a.house[2] - a.house[0] - HOUSE.w) < 1e-9 && Math.abs(hz1 - hz0 - HOUSE.d) < 1e-9);
  // 현관: 큰길 쪽 벽 가운데, 큰길 쪽을 바라봄 / 앞마당 깊이 = HOUSE.yard
  const av = STREETS.find((v) => v.id === a.av), toAv = Math.sign(av.z - a.door.z); assert.equal(toAv, Math.cos(a.door.face) > 0 ? 1 : -1, `현관 ${a.id} 이 큰길을 봄`);
  assert.ok(Math.abs(Math.abs(av.z - a.door.z) - (HOUSE.yard + STREET_HW)) < 1e-9, '현관 앞 ' + (HOUSE.yard + STREET_HW) + 'm 에 큰길 가운데'); assert.ok(a.door.x > hx0 && a.door.x < hx1);
  assert.ok(Math.abs(Math.abs(a.gate.z - av.z) - STREET_HW) < 1e-9, '대문은 큰길 가장자리');
  assert.equal(plotAt(a.cx, (a.z0 + a.z1) / 2), a); assert.equal(plotById(a.id), a);
}
assert.equal(HOUSE_RECTS.length, 100);
for (const v of STREETS) assert.equal(PLOTS.filter((p) => p.av === v.id).length, 20, `큰길 ${v.id} 20곳`);
// 큰길·중앙로가 집터와 겹치지 않음
for (const a of PLOTS) { for (const v of STREETS) assert.ok(!(a.z1 > v.z - STREET_HW && a.z0 < v.z + STREET_HW), '큰길과 겹침'); assert.ok(!(a.x1 > SPINE.x - SPINE.hw && a.x0 < SPINE.x + SPINE.hw), '중앙로와 겹침'); }
// 단지 위치: 마을 북쪽 울타리 밖, 대문 길이 마을 대문에서 입구 광장까지 이어짐
assert.ok(DISTRICT.z1 < -BZ - 30 && DISTRICT.z0 > -600, '마을 북쪽 울타리(' + -BZ + ') 밖 30m 이상'); assert.equal(NORTH_GATE.z, -BZ); assert.equal(GATE_ROAD.z0, NORTH_GATE.z); assert.equal(GATE_ROAD.z1, ENTRY.z);
assert.ok(Math.abs(GATE_ROAD.z1 - GATE_ROAD.z0) > 60 && ENTRY.z === DISTRICT.z1, '대문 길은 입구 광장에서 단지로(단지의 마을 쪽 변)');
// 다른 구역과 안 겹침 (단지 네 모서리와 가운데, 대문 길 위)
const pts = [[DISTRICT.x0, DISTRICT.z0], [DISTRICT.x1, DISTRICT.z0], [DISTRICT.x0, DISTRICT.z1], [DISTRICT.x1, DISTRICT.z1], [0, -170], [-60, -170], [60, -170], [0, -60], [0, -90], [0, -350], [120, -450]];
for (const [x, z] of pts) { assert.ok(trailNear(x, z).d > 24, `숲길과 가까움 ${x},${z}: ${trailNear(x, z).d.toFixed(0)}`); assert.ok(campDist(x, z) > 60, '캠프와 가까움'); assert.ok(parkDist(x, z) > 60, '놀이공원과 가까움'); assert.ok(Math.hypot(x - TEMPLE_YARD.cx, z - TEMPLE_YARD.cz) > 200, '사찰과 가까움'); }
assert.ok(DISTRICT.x0 > -BX - 20 && DISTRICT.x1 < BX + 20, '마을 폭 안쪽에 놓임(대문 길이 곧음)');
// 거리 함수: 안은 0, 밖은 가장 가까운 단지·대문 길까지
assert.equal(districtDist(0, -170), 0); assert.equal(districtDist(0, -80), 0, '대문 길 위'); assert.ok(Math.abs(districtDist(0, DISTRICT.z0 - 70) - 70) < 1e-9, '남북으로 70m'); assert.ok(districtDist(200, -170) > 69.9, '동쪽 70m'); assert.ok(districtDist(0, 0) > 40, '마을 한가운데는 대문 길에서 멀다');
assert.ok(inDistrict(10, -150) && !inDistrict(10, -100) && !inDistrict(-200, -150));
// 자동 열림: 처음 큰길 A(20곳), 16곳이 차면 B, 32곳이면 C, 48곳이면 D, 64곳이면 E (80%)
assert.deepEqual([0, 1, 15, 16, 31, 32, 47, 48, 63, 64, 99].map(openAvenues), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]); assert.equal(OPEN_FIRST, 20);
assert.equal(PLOTS.filter((p) => isOpen(p, 1)).length, 20); assert.equal(PLOTS.filter((p) => isOpen(p, 2)).length, 40); assert.equal(PLOTS.filter((p) => isOpen(p, 5)).length, 100);
assert.equal(openZ0(1), STREETS[0].z - AV_BAND); assert.equal(openZ0(5), DISTRICT.z0); assert.ok(PLOTS.filter((p) => isOpen(p, 1)).every((p) => p.z0 >= openZ0(1)), '열린 집터는 열린 구역 안');
const area = (DISTRICT.x1 - DISTRICT.x0) * (DISTRICT.z1 - DISTRICT.z0), village = 2 * BX * 2 * BZ;
console.log(`ok 단지 설계: 집터 ${PLOTS.length}곳(큰길 ${STREETS.length}개×20, 24×30m) · 단지 ${area.toLocaleString()}㎡(마을의 ${(area / village).toFixed(1)}배) · 처음 20곳만 열리고 80% 차면 다음 큰길 · 겹침 없음 · 다른 구역과 떨어져 있음`);
console.log('주택 단지 설계 시험 통과 ✓');
