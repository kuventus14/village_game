// 월드 시험: 카지노의 모든 자리·계단·엘리베이터, 성당·교회·사찰의 문·자리가 걸어서 닿는지 (층마다 충돌이 달라서 배치를 바꿀 때 꼭 확인)
import * as W from './public/world.js';
// 걸어서 닿을 수 있는 칸(격자 0.25m)을 채워 나감
function reach(fl, sx, sz) {
  const key = (x, z) => `${Math.round(x * 4)},${Math.round(z * 4)}`, seen = new Set([key(sx, sz)]), q = [[sx, sz]];
  while (q.length) { const [x, z] = q.pop(); for (const [dx, dz] of [[.25, 0], [-.25, 0], [0, .25], [0, -.25]]) { const nx = x + dx, nz = z + dz, k = key(nx, nz); if (seen.has(k)) continue; const [a, b] = W.resolve(nx, nz, 0.4, fl); if (Math.hypot(a - nx, b - nz) > 0.01) continue; seen.add(k); q.push([nx, nz]); } }
  return (x, z, r = 1.2) => { for (let dx = -r; dx <= r; dx += .25) for (let dz = -r; dz <= r; dz += .25) if (seen.has(key(x + dx, z + dz)) && Math.hypot(dx, dz) <= r) return true; return false; };
}
const [dx, dz] = W.doorPos(W.BUILDINGS.casino), C = W.BUILDINGS.casino;
const can0 = reach(0, dx, dz - 2); // 문 앞 바깥에서 출발
const bad = [];
for (const s of W.SEATS.filter((s) => s.fl === 0 && ['slot'].includes(s.kind))) if (!can0(s.x, s.z, 1.0)) bad.push(`슬롯 ${s.tbl}`);
for (const p of W.PORTALS.filter((p) => p.fl === 0)) if (!can0(p.x, p.z, 0.9)) bad.push(`포탈 ${p.id}(1층)`);
const can1 = reach(1, C.cx + 5.4, C.cz + 3.3); // 2층 도착 지점(동쪽 계단 위)
for (const s of W.SEATS.filter((s) => s.fl === 1)) if (!can1(s.x, s.z, 1.0)) bad.push(`홀덤 의자 ${s.chair}`);
for (const p of W.PORTALS.filter((p) => p.fl === 1)) if (!can1(p.x, p.z, 0.9)) bad.push(`포탈 ${p.id}(2층)`);
const can2 = reach(2, C.cx - 5.4, C.cz + 3.3); // 3층 도착 지점(서쪽 계단 위)
for (const s of W.SEATS.filter((s) => s.fl === 2)) if (!can2(s.x, s.z, 1.0)) bad.push(`블랙잭 의자 ${s.chair}`);
for (const p of W.PORTALS.filter((p) => p.fl === 2)) if (!can2(p.x, p.z, 0.9)) bad.push(`포탈 ${p.id}(3층)`);
// 성당·교회·사찰: 마을 한가운데서 걸어서 세 건물 문 안·모든 행동 자리(SPOTS)·긴 의자에 닿는지 (사찰은 동쪽 대문 → 숲길 → 마당)
const town = reach(0, 0, 8);
for (const k of ['cathedral', 'church', 'temple']) { const b = W.BUILDINGS[k], [x, z] = W.doorPos(b), [nx, nz] = W.sideNormal(b.door); if (!town(x - nx * 1.2, z - nz * 1.2, 0.5)) bad.push(`${k} 문 안`); }
for (const s of W.SPOTS) if (!town(s.x, s.z, 0.5)) bad.push(`${s.bld} ${s.kind} #${s.id}`);
for (const s of W.SEATS.filter((s) => s.kind === 'pew')) if (!town(s.x, s.z, 0.6)) bad.push(`긴 의자 ${s.id}`);
if (town(W.BX + 6, W.GATE.z + W.GATE.hw + 3, 0.2) || town(W.BX + 3, 0, 0.2) || town(0, W.BZ + 3, 0.2)) bad.push('대문 옆 울타리 밖으로 새어 나감');
import assert from 'node:assert/strict';
assert.deepEqual(bad, [], '걸어서 닿지 못하는 곳: ' + bad.join(', '));
console.log('카지노 모든 자리·계단·엘리베이터, 성당·교회·사찰 문 안과 행동 자리 전부에 걸어서 갈 수 있음');
