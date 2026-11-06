// 불꽃놀이 대본 시험: 박자에 맞음·종류·위치 범위·순서·마지막 한 방, 음악 마디 구조(막 경계가 마디 경계)
import assert from 'node:assert/strict';
import { SHOW_EVENTS, SHOW_END, FLY, SPB, BAR, S16, ACTS, actOf, SHOW_X } from './public/showscript.js';
import { PARK_GATE, inPark } from './public/parkdata.js';

const bursts = SHOW_EVENTS.filter((e) => !e.kind), ems = SHOW_EVENTS.filter((e) => e.kind === 'em');
assert.ok(bursts.length > 150 && ems.length > 20, `터짐 ${bursts.length} · 분수/폭포 ${ems.length}`);
for (let i = 1; i < SHOW_EVENTS.length; i++) assert.ok(SHOW_EVENTS[i - 1].lt <= SHOW_EVENTS[i].lt, '발사 시각 순서');
const TYPES = new Set(['peony', 'rainbow', 'willow', 'palm', 'saturn', 'spiral', 'ring', 'ring2', 'heart', 'star', 'smile', 'crossette', 'giant']);
for (const e of bursts) {
  assert.ok(TYPES.has(e.type), '알 수 없는 종류 ' + e.type); assert.ok(Math.abs(e.t - e.lt - FLY) < 1e-9, '터짐 = 발사 + ' + FLY);
  assert.ok(Math.abs(e.t / (SPB / 2) - Math.round(e.t / (SPB / 2))) < 0.01, '반 박자에 맞음 ' + e.t);
  assert.ok(e.wy >= 85 && e.wy <= 130, '높이 ' + e.wy); assert.ok(Math.abs(e.wz - PARK_GATE.z) <= 80, '옆으로 ' + e.wz); assert.equal(e.wx, SHOW_X);
}
for (const e of ems) { assert.ok(['gerb', 'cascade'].includes(e.type)); assert.ok(e.dur > 0 && e.t >= 0 && e.t + e.dur <= 190); }
assert.equal(bursts.filter((e) => e.type === 'giant').length, 1); const last = Math.max(...bursts.map((e) => e.t)); assert.ok(last >= SHOW_END && last < SHOW_END + 1, '마지막 한 방 ' + last);
assert.ok(bursts.some((e) => e.type === 'heart') && bursts.some((e) => e.type === 'smile') && bursts.some((e) => e.type === 'star'), '모양 불꽃 있음');
// 막: 각 막 시작이 마디 경계(2.5초 배수 또는 가까움) → 음악 악기가 바뀌는 곳과 불꽃이 어긋나지 않음
for (const [, s] of ACTS) assert.ok(Math.abs(s / BAR - Math.round(s / BAR)) < 1e-9, '막 시작 ' + s + ' 은 마디 경계');
assert.equal(actOf(0), 0); assert.equal(actOf(24.9), 0); assert.equal(actOf(25), 1); assert.equal(actOf(110), 3); assert.equal(actOf(179), 4);
// 쏘아 올리는 자리와 터지는 자리는 정문 뒤(부지 안) 하늘, 다리(동쪽)에서 올려다봄
assert.ok(inPark(SHOW_X, PARK_GATE.z) && SHOW_X < PARK_GATE.x, '쏘는 자리는 정문 안쪽'); assert.ok(Math.abs(S16 * 4 - SPB) < 1e-12);
console.log(`ok 대본: 터짐 ${bursts.length}번(종류 ${new Set(bursts.map((e) => e.type)).size}) · 분수·폭포 ${ems.length}개, 모두 반 박자에 맞고 높이 85~130m, 마지막 한 방 ${last.toFixed(2)}초`);
console.log('불꽃놀이 대본 시험 통과 ✓');
