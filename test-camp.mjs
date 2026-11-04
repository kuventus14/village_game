// 불멍 캠프·손으로 그리는 불꽃놀이 시험: 길 길이·거리·도달성·벤치 자리, 여는 시간(가짜 시계·경계·자정 넘김), 불꽃놀이 규칙(가짜 시계·난수),
// 그린 선이 그대로 전달되는지(점 수·순서·좌표·평면 위치), 모양 알아보기(라벨용), 서버 통합(포트 3394, 닫히는 순간은 따로 띄운 서버 3393)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as THREE from 'three';
import * as W from './public/world.js';
import { campOpen, nextChange, atOffset, createCamp, CLOSED_MSG } from './camp.js';
import { createFireworks, validPts } from './fireworks.js';
import { recognize } from './public/shapes.js';

const { FIRE, CLEAR_R, CAMP_GATE, FW, FW_PLANE, fwWorld, fwHit } = W;
// ── 1. 땅: 걸어서 닿는 칸(0.25m 격자)
function reach(sx, sz) {
  const key = (x, z) => `${Math.round(x * 4)},${Math.round(z * 4)}`, seen = new Set([key(sx, sz)]), q = [[sx, sz]];
  while (q.length) { const [x, z] = q.pop(); for (const [dx, dz] of [[.25, 0], [-.25, 0], [0, .25], [0, -.25]]) { const nx = x + dx, nz = z + dz, k = key(nx, nz); if (seen.has(k)) continue; const [a, b] = W.resolve(nx, nz, 0.4, 0); if (Math.hypot(a - nx, b - nz) > 0.01) continue; seen.add(k); q.push([nx, nz]); } }
  return Object.assign((x, z, r = 1.2) => { for (let dx = -r; dx <= r; dx += .25) for (let dz = -r; dz <= r; dz += .25) if (seen.has(key(x + dx, z + dz)) && Math.hypot(dx, dz) <= r) return true; return false; }, { seen, key });
}
const town = reach(0, 8);
// 대문 → 불 둘레(안쪽 벤치 줄 바로 안, 불에서 4.6m) 최단 걸음 길이: 0.5m 격자, 16방향 다익스트라
function walkLen(from, goal) {
  const S = 0.5, k = (i, j) => i * 100000 + j, ok = new Map(), dist = new Map(), heap = [];
  const free = (i, j) => { const kk = k(i, j); if (!ok.has(kk)) { const x = i * S, z = j * S, [a, b] = W.resolve(x, z, 0.4, 0); ok.set(kk, Math.hypot(a - x, b - z) < 0.01); } return ok.get(kk); };
  const push = (d, i, j) => { heap.push([d, i, j]); let n = heap.length - 1; while (n) { const p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p; } };
  const popH = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m; } } return top; };
  const D = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [1, 2], [-2, 1], [-1, 2], [2, -1], [1, -2], [-2, -1], [-1, -2]];
  const i0 = Math.round(from[0] / S), j0 = Math.round(from[1] / S); push(0, i0, j0); dist.set(k(i0, j0), 0);
  while (heap.length) {
    const [d, i, j] = popH(); if (d > dist.get(k(i, j))) continue;
    if (goal(i * S, j * S)) return d;
    for (const [di, dj] of D) { const ni = i + di, nj = j + dj; if (nj * S < CAMP_GATE.z - 2 || !free(ni, nj) || (Math.abs(di) + Math.abs(dj) > 1 && (!free(i + Math.sign(di), j) || !free(i, j + Math.sign(dj))))) continue; const nd = d + Math.hypot(di, dj) * S; if (nd < (dist.get(k(ni, nj)) ?? Infinity)) { dist.set(k(ni, nj), nd); push(nd, ni, nj); } }
  }
  return Infinity;
}
const walk = walkLen([CAMP_GATE.x, CAMP_GATE.z], (x, z) => Math.hypot(x - FIRE.x, z - FIRE.z) < 4.6);
assert.ok(walk >= 135 && walk <= 165, `대문 → 불 걸음 길이 135~165 (지금 ${walk.toFixed(1)})`);
const fenceDist = FIRE.z - W.BZ;
assert.ok(fenceDist >= 100 && fenceDist <= 200, `울타리 → 캠프 직선거리 100~200 (지금 ${fenceDist})`);
assert.ok(W.CAMP_PATH.hw * 2 >= 8 && W.CAMP_PATH.hw * 2 <= 9, '길 폭 8~9');
assert.ok(Math.abs(CAMP_GATE.x - W.GATE.x) > 50 && W.trailNear(CAMP_GATE.x, CAMP_GATE.z).d > 60, '사찰 숲길과 다른 길(다른 대문)');
assert.ok([W.TAG, W.DODGE].every((g) => Math.abs(CAMP_GATE.x - g.cx) > g.hw + CAMP_GATE.hw), '대문이 놀이터와 안 겹침');
assert.ok(W.HOUSES.every((h) => Math.abs(h.z) < 35) && Math.hypot(CAMP_GATE.x - W.POND.x, CAMP_GATE.z - W.POND.z) > 30 && !W.inside(W.BUILDINGS.casino, CAMP_GATE.x, CAMP_GATE.z - 1), '집·연못·카지노와 안 겹침');
// 길·공터 도달성 + 밖으로 새지 않음
for (const s of [5, 40, 80, W.CAMP_PATH.len - 2]) { const i = W.CAMP_PATH.s.findIndex((x) => x >= s), [x, z] = W.CAMP_PATH.pts[i]; assert.ok(town(x, z, 0.5), `캠프 길 ${s}m 지점`); assert.equal(W.placeOf(x, z), W.inClearing(x, z) ? 'camp' : z > W.BZ ? 'trail' : 'town'); }
assert.ok(town(FIRE.x + 12, FIRE.z, 0.5) && town(FIRE.x, FIRE.z - 20, 0.5), '공터');
for (let a = 0; a < 6.28; a += 0.3) assert.ok(!town(FIRE.x + Math.sin(a) * (CLEAR_R + 3), FIRE.z + Math.cos(a) * (CLEAR_R + 3), 0.3) || W.campNear(FIRE.x + Math.sin(a) * (CLEAR_R + 3), FIRE.z + Math.cos(a) * (CLEAR_R + 3)).d < W.CAMP_PATH.hw, '공터 밖 숲으로 새지 않음');
for (const s of [20, 70, 110]) { const i = W.CAMP_PATH.s.findIndex((x) => x >= s), [x, z] = W.CAMP_PATH.pts[i], c = W.campNear(x, z); assert.ok(!town(x - c.tz * (c.hw + 2), z + c.tx * (c.hw + 2), 0.3) && !town(x + c.tz * (c.hw + 2), z - c.tx * (c.hw + 2), 0.3), `길 ${s}m 양옆 숲으로 새지 않음`); }
assert.ok(!town(CAMP_GATE.x + CAMP_GATE.hw + 4, W.BZ + 2.5, 0.2) && !town(CAMP_GATE.x - CAMP_GATE.hw - 4, W.BZ + 2.5, 0.2), '대문 옆 울타리 밖으로 새지 않음');
assert.equal(W.placeOf(FIRE.x + 3, FIRE.z), 'camp'); assert.equal(W.PLACE.camp.join(' '), '🔥 불멍 캠프');
// 기존 곳: 세 건물 문 안·사찰 숲길 끝·마당
for (const k of ['cathedral', 'church', 'temple']) { const b = W.BUILDINGS[k], [x, z] = W.doorPos(b), [nx, nz] = W.sideNormal(b.door); assert.ok(town(x - nx * 1.2, z - nz * 1.2, 0.5), `${k} 문 안`); }
assert.ok(town(W.TRAIL.pts[60][0], W.TRAIL.pts[60][1], 0.5) && town(W.TEMPLE_YARD.cx, W.TEMPLE_YARD.cz + 40, 0.5), '사찰 숲길·마당');
// 벤치 자리: 24석 이상, 기존 번호 뒤, 모두 닿고 충돌에 안 묻힘, 불을 봄, 서로 0.85m 이상
const fire = W.SEATS.filter((s) => s.kind === 'fire'), first = W.SEATS.findIndex((s) => s.kind === 'fire');
assert.ok(fire.length >= 24, `불멍 자리 ${fire.length}`);
assert.ok(W.SEATS.slice(first).every((s) => s.kind === 'fire' || (s.kind === 'park' && W.inPark(s.x, s.z))) && W.SEATS.every((s, i) => s.id === i), '불멍 자리는 맨 뒤 (기존 번호 그대로, 그 뒤엔 놀이공원 벤치만)');
for (const s of fire) {
  assert.ok(town(s.x, s.z, 1.0), `자리 ${s.id} 닿음`);
  const fx = s.x + Math.sin(s.ry) * 0.9, fz = s.z + Math.cos(s.ry) * 0.9, [a, b] = W.resolve(fx, fz);
  assert.ok(Math.hypot(a - fx, b - fz) < 0.01, `자리 ${s.id} 앞(불 쪽)이 비어 있음`);
  const [sx, sz] = W.standPos(s); assert.ok(town(sx, sz, 0.3), `자리 ${s.id} 일어서는 곳`);
  const want = Math.atan2(FIRE.x - s.x, FIRE.z - s.z); assert.ok(Math.abs(Math.atan2(Math.sin(s.ry - want), Math.cos(s.ry - want))) < 0.01, '불을 봄');
  assert.equal(s.h, 0.45); assert.equal(W.placeOf(s.x, s.z), 'camp');
  for (const o of fire) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.z - s.z) > 0.85, '자리 간격');
}
assert.equal(W.SIT_STATUS.fire, 'fire'); assert.deepEqual(W.STATUS.fire, ['🔥', '불멍 중']); assert.equal(W.SIT_TEXT.fire, '🔥 불멍하는 중'); assert.ok(W.ACT_STATUS.has('fire'), '상태 메뉴엔 안 보임');
console.log(`ok 캠프 길: 대문 → 불 걸음 ${walk.toFixed(1)}m · 울타리 → 불 ${fenceDist}m · 불멍 자리 ${fire.length}석 (번호 ${first}~${W.SEATS.length - 1})`);

// ── 2. 여는 시간: 매일 KST 19:00 ~ 06:00
const KST = (d, h, mi = 0, s = 0) => Date.UTC(2026, 10, d, h - 9, mi, s); // 2026-11-d h:mi:s KST
assert.equal(campOpen(KST(3, 18, 59, 59)), false, '18:59:59 닫힘'); assert.equal(campOpen(KST(3, 19)), true, '19:00:00 열림');
assert.equal(campOpen(KST(4, 5, 59, 59)), true, '05:59:59 열림'); assert.equal(campOpen(KST(4, 6)), false, '06:00:00 닫힘');
assert.equal(campOpen(KST(3, 23, 59, 59)), true); assert.equal(campOpen(KST(4, 0)), true, '자정 넘어도 열림'); assert.equal(campOpen(KST(4, 12)), false, '낮 닫힘');
assert.equal(nextChange(KST(3, 18, 59, 59)), 1000); assert.equal(nextChange(KST(3, 19)), 11 * 3.6e6, '19시엔 11시간 뒤 닫힘'); assert.equal(nextChange(KST(4, 1)), 5 * 3.6e6); assert.equal(nextChange(KST(4, 6)), 13 * 3.6e6);
{ const now = KST(3, 12, 34), off = atOffset('21:00', now); assert.equal(campOpen(now + off), true); assert.equal(nextChange(now + off), 9 * 3.6e6, 'CAMP_AT=21:00 → 21:00 부터'); assert.equal(nextChange(now + atOffset('05:59:58', now)), 2000); }
{ let t = KST(3, 18, 59, 59); const out = [], stood = [], seated = { seat: W.SEATS.find((s) => s.kind === 'fire').id }, other = { seat: 0 };
  const C = createCamp({ now: () => t, bcast: (o) => out.push(o), players: new Map([[1, seated], [2, other]]), stand: (p) => stood.push(p) });
  assert.equal(C.snapshot().open, false); C.tick(); assert.equal(out.length, 0);
  t += 1000; C.tick(); assert.deepEqual(out.at(-1), { t: 'camp', open: true, next: 11 * 3.6e6 }, '19:00 열림 방송');
  t = KST(4, 5, 59, 59); C.tick(); assert.equal(out.length, 1); t += 1000; C.tick();
  assert.equal(out.at(-1).open, false, '06:00 닫힘 방송'); assert.deepEqual(stood, [seated], '06:00 불멍 벤치에 앉은 사람만 일어남'); }
console.log('ok 여는 시간: 18:59:59 닫힘 · 19:00 열림 · 05:59:59 열림 · 06:00 닫힘 · 자정 넘김 · 06:00 자동으로 일어남');

// ── 3. 불꽃놀이 규칙 (가짜 시계·난수)
const ON = KST(3, 21);
{
  let t = ON, open = true; const out = [], players = new Map();
  const F = createFireworks({ now: () => t, rand: () => 0.25, players, send: (p, o) => out.push({ to: p.id, ...o }), open: () => open });
  const P = (id, x, z, o = {}) => { const p = { id, nick: 'n' + id, x, z, seat: -1, fl: 0, ...o }; players.set(id, p); return p; };
  const a = P(1, FIRE.x + 6, FIRE.z), b = P(2, FIRE.x - 40, FIRE.z), far = P(3, 0, 0), out2 = P(4, FIRE.x + 25, FIRE.z);
  const got = (to, k) => out.filter((m) => m.to === to && (m.t === 'fw' ? m.k === k : m.t === k));
  F.act(out2, { t: 'fw', k: 'start', ry: 0 }); assert.match(got(4, 'fwno').at(-1).error, /가까이/, '캠프 밖(불에서 25m) 거부');
  for (const o of [{ fish: { st: 'wait' } }, { game: 'tag' }, { act: { k: 'bow' } }, { transit: {} }]) { const q = P(10, FIRE.x + 3, FIRE.z, o); F.act(q, { k: 'start', ry: 0 }); assert.ok(!F.busy(q), JSON.stringify(o)); players.delete(10); }
  open = false; F.act(a, { k: 'start', ry: 0 }); assert.equal(got(1, 'fwno').at(-1).error, CLOSED_MSG, '닫힌 시간 거부'); open = true;
  F.act(a, { k: 'start', ry: Math.PI }); const st = got(2, 'start').at(-1);
  assert.ok(F.busy(a) && st && st.c === 0.25 && st.plane.y === FW_PLANE.y && Math.abs(st.plane.z - (a.z - FW_PLANE.d)) < 1e-3, '시작: 바라본 방향 앞 30m 평면');
  assert.equal(got(3, 'start').length, 0, '120m 밖(마을)엔 방송 안 함'); assert.ok(got(1, 'start').length === 1, '그린 사람도 받음');
  const sat = P(5, FIRE.x, FIRE.z + 5.4, { seat: 400 }); F.act(sat, { k: 'start', ry: 0 }); assert.ok(F.busy(sat), '앉은 채 시작 허용'); assert.equal(sat.seat, 400, '앉은 채로');
  // 획: down → pts → up. 그린 사람에겐 pts 를 되돌려 보내지 않음, 근처 사람은 점 그대로
  t += 100; F.act(a, { k: 'down' }); const line = Array.from({ length: 12 }, (_, i) => [i / 12 - 0.5, Math.sin(i) * 0.3]);
  F.act(a, { k: 'pts', p: line }); assert.deepEqual(got(2, 'pts').at(-1).p, line.map(([u, v]) => [Math.round(u * 1000) / 1000, Math.round(v * 1000) / 1000])); assert.equal(got(1, 'pts').length, 0);
  for (const bad of [[[NaN, 0]], [[0, 1.5]], [[0, -1.01]], [[Infinity, 0]], [[0]], [['0.1', 0.2]], Array(13).fill([0, 0]), [], 'x', null]) F.act(a, { k: 'pts', p: bad });
  assert.equal(got(2, 'pts').length, 1, '범위 밖·NaN·문자·13점 이상은 통째로 버림');
  t += 1000; for (let i = 0; i < 10; i++) F.act(a, { k: 'pts', p: Array(12).fill([0.1, 0.1]) });
  assert.equal(got(2, 'pts').slice(1).reduce((s, m) => s + m.p.length, 0), FW.ptsPerSec, '초당 60점까지만');
  t += 400; F.act(a, { k: 'up' }); assert.equal(got(2, 'pop').at(-1).n, 0, '손 떼면 터짐');
  t += 300; F.act(a, { k: 'down' }); F.act(a, { k: 'pts', p: [[0, 0]] }); assert.equal(got(2, 'pts').at(-1).n, 0, '획 사이 1초 전엔 새 획 안 됨 (점도 버림)');
  t += 700; F.act(a, { k: 'down' }); F.act(a, { k: 'pts', p: [[0, 0]] }); assert.equal(got(2, 'pts').at(-1).n, 1, '1초 뒤 두 번째 획');
  t += 10000; F.tick(); assert.equal(got(2, 'pop').at(-1).n, 1, '한 획 최대 10초');
  // 400점이면 그 획은 터짐
  t += 1000; F.act(a, { k: 'down' }); for (let i = 0; i < 40; i++) { t += 200; F.act(a, { k: 'pts', p: Array(12).fill([0.2, 0.2]) }); } assert.equal(got(2, 'pop').at(-1).n, 2, '400점에서 터짐');
  // 동시 상한 4: a, sat + 둘 더 → 다섯째 거부
  const c = P(6, FIRE.x + 2, FIRE.z + 2), d = P(7, FIRE.x - 2, FIRE.z + 2), e = P(8, FIRE.x - 2, FIRE.z - 2);
  F.act(c, { k: 'start', ry: 0 }); F.act(d, { k: 'start', ry: 0 }); F.act(e, { k: 'start', ry: 0 });
  assert.ok(F.busy(c) && F.busy(d) && !F.busy(e)); assert.match(got(8, 'fwno').at(-1).error, /꽉/, '동시 4명까지');
  // 움직이면 취소(stop) → 그리던 획까지 터지고 끝, 8초 쿨다운
  t += 1000; F.act(c, { k: 'down' }); F.act(c, { k: 'pts', p: [[0.1, 0.2], [0.2, 0.3]] }); F.stop(c);
  assert.equal(got(2, 'end').at(-1).r, 'cancel'); assert.ok(got(2, 'pop').some((m) => m.id === 6), '취소해도 그린 획은 터짐'); assert.ok(!F.busy(c));
  t += 7000; F.act(c, { k: 'start', ry: 0 }); assert.match(got(6, 'fwno').at(-1).error, /조금 뒤/, '끝난 뒤 8초 쿨다운'); t += 1000; F.act(c, { k: 'start', ry: 0 }); assert.ok(F.busy(c));
  // 8획이면 끝
  const g = P(9, FIRE.x + 1, FIRE.z - 4); F.stop(d); F.act(g, { k: 'start', ry: 1 });
  for (let i = 0; i < 9; i++) { t += 1001; F.act(g, { k: 'down' }); F.act(g, { k: 'pts', p: [[i / 10, 0], [i / 10, 0.1]] }); F.act(g, { k: 'up' }); }
  assert.equal(got(2, 'pop').filter((m) => m.id === 9).length, 8, '8획까지'); assert.equal(got(2, 'end').filter((m) => m.id === 9).at(-1).r, 'done'); assert.ok(!F.busy(g));
  // 30초면 끝, 06:00 엔 그리던 획까지 터뜨리고 끝
  t += 30000; F.tick(); assert.ok(!F.busy(a) && got(2, 'end').some((m) => m.id === 1 && m.r === 'time'), '30초면 끝');
  t += 8000; F.act(a, { k: 'start', ry: 0 }); t += 1000; F.act(a, { k: 'down' }); F.act(a, { k: 'pts', p: [[0, 0], [0.5, 0.5]] });
  open = false; F.tick(); assert.ok(got(2, 'end').some((m) => m.id === 1 && m.r === 'closed') && got(2, 'pop').filter((m) => m.id === 1).length >= 4, '06:00: 그리던 획 터지고 끝');
  assert.equal(F.snapshot().length, 0); F.leave(sat);
  assert.ok(!validPts([[0, 0]].concat(Array(12).fill([0, 0]))) && validPts([[1, -1]]), '점 검사');
}
console.log('ok 불꽃놀이 규칙: 캠프 밖·닫힘·행동 중 거부, 앉은 채 시작, 근처만 방송, 점 검사·초당 60점·획당 400점·10초·1초 간격·8획·30초, 동시 4명, 움직이면 취소, 8초 쿨다운, 06:00');

// ── 4. 모양 알아보기 (라벨용): 사람이 비뚤게 그린 합성 획
let seed = 7; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const lerpPts = (v, n) => { const out = []; for (let i = 1; i < v.length; i++) for (let k = 0; k < n; k++) { const t = k / n; out.push([v[i - 1][0] + (v[i][0] - v[i - 1][0]) * t, v[i - 1][1] + (v[i][1] - v[i - 1][1]) * t]); } out.push(v.at(-1)); return out; };
const ok5 = (k, r = 1) => [Math.sin((k / 5) * Math.PI * 2) * r, Math.cos((k / 5) * Math.PI * 2) * r];
const BASE = {
  star: () => (R() < 0.5 ? lerpPts([0, 2, 4, 1, 3, 0].map((k) => ok5(k)), 20) : lerpPts([...Array.from({ length: 10 }, (_, i) => ok5(i / 2, i % 2 ? 0.4 : 1)), ok5(0)], 10)), // 한붓 별 / 테두리 별
  heart: () => Array.from({ length: 120 }, (_, i) => { const t = (i / 119) * Math.PI * 2; return [16 * Math.sin(t) ** 3 / 16, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]; }),
  circle: () => Array.from({ length: 100 }, (_, i) => [Math.sin((i / 99) * Math.PI * 2), Math.cos((i / 99) * Math.PI * 2)]),
};
function human(kind) { // 시작점·방향·회전 ±12°·비율·크기·위치·흔들림·떨림·덜 닫힘
  let p = BASE[kind](); const sh = Math.floor(R() * (p.length - 1)); p = [...p.slice(sh, -1), ...p.slice(0, sh + 1)];
  if (R() < 0.5) p.reverse(); p = p.slice(0, Math.min(p.length, Math.floor(p.length * (0.93 + R() * 0.1))));
  const rot = (R() - 0.5) * 0.42, ax = 0.85 + R() * 0.3, s = 0.25 + R() * 0.5, ox = (R() - 0.5) * 0.6, oy = (R() - 0.5) * 0.4, ph = R() * 6, ph2 = R() * 6, amp = 0.03 + R() * 0.03;
  return p.map(([x, y], i) => { const u = i / p.length; x = x * ax + Math.sin(u * 9 + ph) * amp + Math.sin(u * 23 + ph2) * amp * 0.4 + (R() - 0.5) * 0.02; y += Math.cos(u * 7 + ph2) * amp + (R() - 0.5) * 0.02; return [ox + (x * Math.cos(rot) - y * Math.sin(rot)) * s, oy + (x * Math.sin(rot) + y * Math.cos(rot)) * s]; });
}
function scribble() {
  const k = Math.floor(R() * 6), s = 0.3 + R() * 0.4, out = [];
  if (k === 0) { let x = 0, y = 0, a = R() * 6; for (let i = 0; i < 120; i++) { a += (R() - 0.5) * 1.2; x += Math.cos(a) * 0.03; y += Math.sin(a) * 0.03; out.push([x * s, y * s]); } }
  else if (k === 1) for (let i = 0; i < 150; i++) { const t = (i / 149) * Math.PI * 6, r = 0.1 + i / 149; out.push([Math.cos(t) * r * s, Math.sin(t) * r * s]); }
  else if (k === 2) for (let i = 0; i < 100; i++) { const t = (i / 99) * Math.PI * 2; out.push([Math.sin(t) * s, Math.sin(2 * t) * s * 0.5]); }
  else if (k === 3) for (let i = 0; i < 100; i++) out.push([(i / 99 - 0.5) * s * 2, Math.sin((i / 99) * Math.PI * (3 + R() * 4)) * s * 0.3]);
  else if (k === 4) out.push(...lerpPts(Array.from({ length: 6 }, () => [(R() - 0.5) * s * 2, (R() - 0.5) * s * 2]), 15));
  else { const v = Array.from({ length: 4 + Math.floor(R() * 4) }, () => [(R() - 0.5) * s * 2, (R() - 0.5) * s * 2]); v.push(v[0]); out.push(...lerpPts(v, 15)); }
  return out;
}
const rate = {};
for (const k of ['star', 'heart', 'circle']) { let hit = 0; for (let i = 0; i < 200; i++) if (recognize(human(k)) === k) hit++; rate[k] = hit / 200; assert.ok(rate[k] >= 0.9, `${k} 인식률 ${rate[k]}`); }
let wrong = 0, wrongStar = 0; for (let i = 0; i < 600; i++) { const r = recognize(scribble()); if (r) wrong++; if (r === 'star') wrongStar++; }
assert.ok(wrong / 600 <= 0.05 && wrongStar <= 3, `낙서 오인식 ${wrong}/600 (별 ${wrongStar})`);
console.log(`ok 모양 인식률: 별 ${rate.star * 100}% · 하트 ${rate.heart * 100}% · 동그라미 ${rate.circle * 100}% · 낙서 600개 중 모양으로 잘못 읽음 ${wrong} (별 ${wrongStar})`);

// ── 5. 화면 수치: 하늘 평면 ↔ 화면. 그린 점을 평면에 놓고 → 카메라로 화면에 비춘 뒤 → 다시 화면을 눌러 평면 좌표로 = 원래 점
{
  const pl = { x: FIRE.x + 3, y: FW_PLANE.y, z: FIRE.z - 30, ry: Math.PI }, cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 400);
  cam.position.set(FIRE.x + 3, 2.4, FIRE.z + 4); cam.lookAt(pl.x, pl.y, pl.z); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const v = new THREE.Vector3(), o = new THREE.Vector3();
  const spiral = Array.from({ length: 80 }, (_, i) => { const t = (i / 79) * Math.PI * 5, r = 0.05 + (i / 79) * 0.55; return [Math.cos(t) * r, Math.sin(t) * r * 0.9]; });
  let maxErr = 0;
  for (const [u, w] of spiral) {
    const P = fwWorld(pl, u, w), dn = ((P[0] - pl.x) * Math.sin(pl.ry) + (P[2] - pl.z) * Math.cos(pl.ry)); assert.ok(Math.abs(dn) < 1e-9, '점이 평면 위');
    v.set(...P).project(cam); assert.ok(Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1, '화면 안');
    o.copy(cam.position); const d = new THREE.Vector3(v.x, v.y, 0.5).unproject(cam).sub(o).normalize();
    const back = fwHit(pl, o.toArray(), d.toArray()); maxErr = Math.max(maxErr, Math.hypot(back[0] - u, back[1] - w));
  }
  assert.ok(maxErr < 1e-4, `화면 → 평면 되돌림 오차 ${maxErr}`);
  const [x0, y0, z0] = fwWorld(pl, 0, 0), [x1, , z1] = fwWorld(pl, 1, 0); assert.ok(Math.abs(Math.hypot(x1 - x0, z1 - z0) - FW_PLANE.hu) < 1e-9 && y0 === FW_PLANE.y);
  const [rx, , rz] = fwWorld(pl, 1, 0); v.set(rx, FW_PLANE.y, rz).project(cam); assert.ok(v.x > 0, 'u+ = 그린 사람 화면의 오른쪽 (거울처럼 뒤집히지 않음)');
}
console.log('ok 하늘 평면: 점이 평면 위, 화면 → 평면 되돌림 오차 1e-4 미만, 좌우 안 뒤집힘');

// ── 6. 서버 통합 (CAMP_AT=21:00 → 열려 있음)
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-camp-'));
process.env.CAMP_AT = '21:00';
const { WebSocket } = await import('ws');
const { listen, players } = await import('./server.js');
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 5000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
async function client(port, nick) {
  const api = async (name, body) => (await fetch(`http://localhost:${port}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const s = await api('signup', { nick, pw: 'secret1' }); await api('avatar', { token: s.token, avatar: { g: 'f' } });
  const ws = new WebSocket(`ws://localhost:${port}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r));
  const c = { ws, inbox, send: (o) => ws.send(JSON.stringify(o)), got: (t, f = () => true) => inbox.filter((m) => m.t === t && f(m)), fw: (k, f = () => true) => inbox.filter((m) => m.t === 'fw' && m.k === k && f(m)) };
  c.send({ t: 'join', token: s.token }); c.welcome = await until(() => inbox.find((m) => m.t === 'welcome')); c.id = c.welcome.id;
  return c;
}
// 캠프 근처로 걸어감 (서버는 걸을 수 있는 곳으로만 옮기므로 길을 따라 여러 걸음)
const walkTo = async (c, x, z) => { for (let i = 0; i < W.CAMP_PATH.pts.length; i += 8) { c.send({ t: 'm', x: W.CAMP_PATH.pts[i][0], z: W.CAMP_PATH.pts[i][1], ry: 0, w: 1, y: 0 }); await wait(40); } c.send({ t: 'm', x, z, ry: 0, w: 0, y: 0 }); await wait(250); }; // 초당 40건 제한 아래로
{
  const PORT = 3394, srv = await listen(PORT);
  const a = await client(PORT, '불꽃쟁이'), b = await client(PORT, '구경꾼'), far = await client(PORT, '마을사람');
  assert.equal(a.welcome.camp.open, true); assert.ok(a.welcome.camp.next > 8.9 * 3.6e6 && a.welcome.camp.next <= 9 * 3.6e6, 'welcome 에 캠프 열림·남은 시간'); assert.deepEqual(a.welcome.camp.fw, []);
  const pa = () => players.get(a.id);
  await walkTo(a, FIRE.x + 3.5, FIRE.z); await walkTo(b, FIRE.x - 10, FIRE.z + 4);
  assert.ok(Math.hypot(pa().x - FIRE.x - 3.5, pa().z - FIRE.z) < 0.01, '캠프까지 걸어감'); assert.equal(pa().pl, 'camp');
  // 벤치에 앉기 → 🔥 불멍 중 → 일어서기
  const seat = W.SEATS.filter((s) => s.kind === 'fire')[4];
  b.send({ t: 'm', x: seat.x - Math.sin(seat.ry) * 1.2, z: seat.z - Math.cos(seat.ry) * 1.2, ry: 0, w: 0, y: 0 }); await wait(150);
  b.send({ t: 'sit', seat: seat.id }); await until(() => players.get(b.id).seat === seat.id); assert.equal(players.get(b.id).s, 'fire');
  assert.ok(a.got('info', (m) => m.id === b.id && m.s === 'fire')[0] || (await until(() => a.got('info', (m) => m.id === b.id && m.s === 'fire')[0])));
  // 앉은 채로 불꽃놀이: 'ㅎ' 비슷한 3획 + 지그재그 + 나선 → 구경꾼은 점 수·순서·좌표 그대로, 마을 사람은 못 받음
  a.send({ t: 'fw', k: 'start', ry: Math.PI });
  const start = await until(() => b.fw('start', (m) => m.id === a.id)[0]); assert.equal(start.name, '불꽃쟁이'); assert.ok(a.fw('start')[0], '그린 사람도 시작을 받음');
  const H = [lerpPts([[-0.2, 0.62], [0.2, 0.62]], 10), lerpPts([[-0.42, 0.42], [0.42, 0.42]], 16), Array.from({ length: 40 }, (_, i) => [Math.sin((i / 39) * Math.PI * 2) * 0.25, Math.cos((i / 39) * Math.PI * 2) * 0.25 - 0.05])];
  const zig = lerpPts([[-0.6, -0.5], [-0.3, -0.2], [0, -0.5], [0.3, -0.2], [0.6, -0.5]], 8), spiral = Array.from({ length: 50 }, (_, i) => { const t = (i / 49) * Math.PI * 4, r = 0.05 + (i / 49) * 0.3; return [0.55 + Math.cos(t) * r * 0.5, 0.3 + Math.sin(t) * r * 0.7]; });
  const strokes = [...H, zig, spiral], q = (n) => Math.round(n * 1000) / 1000 || 0;
  for (const st of strokes) {
    a.send({ t: 'fw', k: 'down' });
    for (let i = 0; i < st.length; i += 4) { a.send({ t: 'fw', k: 'pts', p: st.slice(i, i + 4) }); await wait(105); } // 그리는 속도 ≈ 초당 38점 (10Hz × 4점)
    a.send({ t: 'fw', k: 'up' }); await wait(1050);
  }
  await until(() => b.fw('pop', (m) => m.id === a.id).length === strokes.length, 6000);
  for (let n = 0; n < strokes.length; n++) {
    const recv = b.fw('pts', (m) => m.id === a.id && m.n === n).flatMap((m) => m.p);
    assert.deepEqual(recv, strokes[n].map(([u, v]) => [q(u), q(v)]), `획 ${n}: 점 수·순서·좌표 그대로 (받은 ${recv.length}점)`);
  }
  assert.equal(a.fw('pts').length, 0, '그린 사람에겐 점을 되돌려 보내지 않음'); assert.equal(far.fw('start').length + far.fw('pts').length, 0, '마을(120m 밖)엔 안 감');
  assert.equal(b.fw('pop', (m) => m.id === a.id && m.n === 2)[0].shape, 'circle', "'ㅎ' 의 동그라미 획은 동그라미로 읽힘");
  a.send({ t: 'fw', k: 'stop' }); assert.equal((await until(() => b.fw('end', (m) => m.id === a.id)[0])).r, 'stop');
  assert.equal(players.get(a.id).seat, -1, '서 있던 사람은 그대로'); assert.equal(players.get(b.id).seat, seat.id, '앉은 구경꾼은 그대로 앉아 있음');
  // 늦게 온 사람은 진행 중인 불꽃을 welcome 으로 받음 + 움직이면 취소
  b.send({ t: 'fw', k: 'start', ry: 0 }); await until(() => b.fw('start', (m) => m.id === b.id)[0]); assert.equal(players.get(b.id).seat, seat.id, '앉은 채 시작');
  b.send({ t: 'fw', k: 'down' }); b.send({ t: 'fw', k: 'pts', p: [[0, 0], [0.1, 0.1]] }); await wait(100);
  const late = await client(PORT, '늦게옴'); assert.deepEqual(late.welcome.camp.fw[0].cur, [[0, 0], [0.1, 0.1]], 'welcome 에 그리는 중인 획');
  b.send({ t: 'stand' }); assert.equal((await until(() => a.fw('end', (m) => m.id === b.id)[0])).r, 'cancel', '일어나면(움직이면) 취소');
  await wait(8100); a.send({ t: 'fw', k: 'start', ry: 0 }); await until(() => a.fw('start').length === 2);
  a.send({ t: 'm', x: pa().x + 1, z: pa().z, ry: 0, w: 1, y: 0 }); assert.equal((await until(() => b.fw('end', (m) => m.id === a.id && m.r === 'cancel')[0])).r, 'cancel', '걸으면 취소');
  // 캠프 밖(마을)에서 시작 거부
  far.send({ t: 'fw', k: 'start', ry: 0 }); assert.match((await until(() => far.got('fwno')[0])).error, /가까이/);
  for (const c of [a, b, far, late]) c.ws.close();
  srv.close();
}
console.log('ok 서버: welcome 캠프 상태 · 벤치 앉기(🔥 불멍 중) · 그린 선(ㅎ 3획·지그재그·나선) 점 수·순서·좌표 그대로 방송 · 근처만 · 늦게 온 사람 · 움직이면 취소');

// ── 7. 닫히는 순간: 따로 띄운 서버 (CAMP_AT=05:59:55 → 5초 뒤 06:00)
{
  const PORT = 3393, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-camp2-'));
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, CAMP_AT: '05:59:55' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${PORT}/`); break; } catch { await wait(100); } }
    const a = await client(PORT, '새벽불멍'), b = await client(PORT, '새벽불꽃');
    assert.equal(a.welcome.camp.open, true); assert.ok(a.welcome.camp.next <= 5000);
    await walkTo(a, FIRE.x + 3.5, FIRE.z); await walkTo(b, FIRE.x - 3.5, FIRE.z);
    const seat = W.SEATS.filter((s) => s.kind === 'fire')[0];
    a.send({ t: 'm', x: seat.x - Math.sin(seat.ry) * 1.2, z: seat.z - Math.cos(seat.ry) * 1.2, ry: 0, w: 0, y: 0 }); await wait(150);
    a.send({ t: 'sit', seat: seat.id }); await until(() => a.got('info', (m) => m.id === a.id && m.seat === seat.id)[0]);
    b.send({ t: 'fw', k: 'start', ry: 0 }); await until(() => b.fw('start')[0]); b.send({ t: 'fw', k: 'down' }); b.send({ t: 'fw', k: 'pts', p: [[0, 0], [0.3, 0.3]] });
    const closed = await until(() => a.got('camp', (m) => !m.open)[0], 8000);
    assert.ok(closed.next > 12.9 * 3.6e6, '닫힘 방송 + 다음 열림까지 13시간');
    assert.equal((await until(() => a.got('info', (m) => m.id === a.id && m.seat === -1)[0])).s, 'free', '06:00 벤치에서 일어남 (앉기 전 상태로)');
    assert.equal(b.fw('end')[0]?.r ?? (await until(() => b.fw('end')[0])).r, 'closed'); assert.ok(b.fw('pop')[0], '그리던 획은 터지고 끝');
    a.send({ t: 'sit', seat: seat.id }); assert.match((await until(() => a.got('fwno')[0])).error, /오후 7시~오전 6시/, '닫힌 시간엔 벤치에 못 앉음');
    await wait(8100); b.send({ t: 'fw', k: 'start', ry: 0 }); assert.equal((await until(() => b.got('fwno')[0])).error, CLOSED_MSG, '닫힌 시간엔 불꽃놀이 거부');
    const c = await client(PORT, '낮손님'); assert.equal(c.welcome.camp.open, false);
    for (const x of [a, b, c]) x.ws.close();
  } finally { child.kill(); }
}
console.log('ok 06:00 서버: 닫힘 방송 · 벤치에서 자동으로 일어남 · 그리던 획 터지고 끝 · 닫힌 시간 앉기·불꽃놀이 거부 · welcome 닫힘');
console.log('불멍 캠프·불꽃놀이 시험 통과');
process.exit(0);
