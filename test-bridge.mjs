// 호수와 아치 다리 시험: 다리 높이(양 끝은 땅에 닿고 가운데 가장 높음)·걷는 높이·호수에 못 들어감·나무 가로등이 물속에 없음·넓은 전망 광장
import assert from 'node:assert/strict';
import { LAKE, BRIDGE, bridgeH, lakeD, lakeEdge, lakeDepth, PARK_ROAD, parkRoadAt, parkRoadNear, ROAD_LAMPS, ROAD_TREES, floorY, resolve, BX } from './public/world.js';

// 1. 다리 높이: 양 끝 0, 가운데 H, 이어져 있고 경사가 완만(14° 이하)
assert.equal(bridgeH(BRIDGE.s0), 0); assert.equal(bridgeH(BRIDGE.s1), 0); assert.equal(bridgeH(-5), 0); assert.equal(bridgeH(BRIDGE.s1 + 20), 0);
const mid = (BRIDGE.s0 + BRIDGE.s1) / 2; assert.ok(Math.abs(bridgeH(mid) - BRIDGE.H) < 1e-9, '가운데가 가장 높음');
let maxSlope = 0; for (let s = BRIDGE.s0; s < BRIDGE.s1; s += 0.25) maxSlope = Math.max(maxSlope, Math.abs(bridgeH(s + 0.25) - bridgeH(s)) / 0.25);
assert.ok(Math.atan(maxSlope) * 180 / Math.PI < 14, '오르막 경사 ' + (Math.atan(maxSlope) * 180 / Math.PI).toFixed(1) + '°');
console.log(`ok 다리: 길이 ${(BRIDGE.s1 - BRIDGE.s0).toFixed(0)}m, 가운데 높이 ${BRIDGE.H}m, 가장 가파른 곳 ${(Math.atan(maxSlope) * 180 / Math.PI).toFixed(1)}°`);

// 2. 걷는 높이 floorY 가 다리 높이를 따라감 (길 위 어디서나), 호수 밖 땅은 0
for (let s = 0; s <= PARK_ROAD.len; s += 3) { const [x, z] = parkRoadAt(s); assert.ok(Math.abs(floorY(x, z) - bridgeH(s)) < 0.02, `길 ${s.toFixed(0)}m 높이 ${floorY(x, z)} ≠ ${bridgeH(s)}`); }
assert.equal(floorY(0, 0), 0); assert.equal(floorY(-BX + 10, -34), 0);
console.log('ok 걷는 높이가 길 전체에서 다리 높이와 같음');

// 3. 호수: 길 가운데는 호수 안, 양 끝은 땅, 밖에서 물가까지 완만, 바닥 깊이
const [mx, mz] = parkRoadAt(mid); assert.ok(lakeD(mx, mz) < -10 && lakeDepth(mx, mz) > 2.5, '다리 가운데 아래는 깊은 물');
const [ex, ez] = parkRoadAt(BRIDGE.s0 - 1); assert.ok(lakeD(ex, ez) >= 0 && lakeDepth(ex, ez) === 0, '다리 시작 바로 앞은 땅');
const [fx, fz] = parkRoadAt(BRIDGE.s1 + 1); assert.ok(lakeD(fx, fz) >= 0 && lakeDepth(fx, fz) === 0, '다리 끝 바로 뒤는 땅');
assert.ok(LAKE.s0 > BRIDGE.s0 && LAKE.s1 < BRIDGE.s1, '다리가 호수보다 양쪽 땅에서 시작·끝남');
for (let s = LAKE.s0; s < LAKE.s1; s += 4) assert.ok(lakeEdge(s, 1) >= 0 && lakeEdge(s, -1) >= 0);
console.log('ok 호수: 다리 아래 깊은 물, 양 끝은 땅, 다리가 호수보다 길게 땅에서 시작');

// 4. 호수에 들어갈 수 없음: 물속 점을 resolve 하면 길(다리) 위로 되돌려짐
for (const o of [-24, -14, 14, 24]) { const [x, z, tx, tz] = parkRoadAt(mid + 4), [rx, rz] = resolve(x - tz * o, z + tx * o); const r = parkRoadNear(rx, rz); assert.ok(r.d <= r.hw, `물속(${o}m)이 길 위로 되돌려져야 함`); }
console.log('ok 호수 물속으로는 걸어 들어갈 수 없음 (다리 위로 되돌려짐)');

// 5. 다리 가운데는 전망 광장으로 넓음 (8m 이상), 양 끝 길은 5m
const hwMid = PARK_ROAD.hw[PARK_ROAD.s.findIndex((s) => s >= mid)]; assert.ok(hwMid >= 8, '전망 광장 반쪽 폭 ' + hwMid); assert.ok(PARK_ROAD.hw[0] <= 5.1);
console.log(`ok 다리 가운데 폭 ${(hwMid * 2).toFixed(1)}m, 양 끝 ${(PARK_ROAD.hw[0] * 2).toFixed(0)}m`);

// 6. 길가 가로등·나무가 물속에 없음
for (const p of ROAD_LAMPS) assert.ok(lakeD(p.x, p.z) > 0, '가로등이 물속');
for (const p of ROAD_TREES) assert.ok(lakeD(p.x, p.z) > 1.5, '나무가 물속 ' + lakeD(p.x, p.z).toFixed(1));
console.log(`ok 길가 가로등 ${ROAD_LAMPS.length}개·나무 ${ROAD_TREES.length}그루 모두 물 밖`);
console.log('호수·다리 시험 통과 ✓');
