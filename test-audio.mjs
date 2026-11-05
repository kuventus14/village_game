// 소리 시험 (순수 규칙만, WebAudio 없음): 배경음악 설정 · 구역·낮밤 섞는 비율 · 크로스페이드 시간 · 멜로디 규칙
// 실제 소리 렌더(클리핑·크기)는 헤드리스 크롬 OfflineAudioContext 로 따로 확인 (시험 체인에는 안 넣음)
import assert from 'node:assert/strict';
import { bgmSettings, bgmMix, BGM_DEFAULT, BGM_MAX, FADE_TAU, parkDepth, rideDist } from './public/audiodata.js';
import { placeOf, BUILDINGS, TRAIL, TEMPLE_YARD, inTown } from './public/world.js';
import { CAMP_PATH } from './public/campdata.js';
import { PARK_GATE, RIDE_SLOTS } from './public/parkdata.js';
import { compose, rng, SONG_NAMES } from './public/bgm.js';
import { surfaceAt, SURFACES, STEP_RATE, stepCount, footOf, spatial, makeVoices, nearestN } from './public/audiodata.js';
import { ENTRY_PLAZA, PROMENADE, ZOO_AVE_X } from './public/parkdata.js';
import { FIRE, CLEAR_R } from './public/campdata.js';
import { fireflySpots } from './public/fireflies.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
// 설정: 기본값·깨진 값·범위 밖
assert.deepEqual(bgmSettings(null), BGM_DEFAULT, '처음엔 기본값 (켜짐, 50%)');
assert.deepEqual(bgmSettings('{broken'), BGM_DEFAULT, '깨진 글자는 기본값');
assert.deepEqual(bgmSettings('{"on":false,"vol":0.3}'), { on: false, vol: 0.3 });
assert.equal(bgmSettings('{"vol":7}').vol, 1, '크기는 0~1');
assert.equal(bgmSettings('{"on":"yes","vol":"x"}').on, true, '이상한 값은 기본값');
assert.ok(BGM_DEFAULT.vol * BGM_MAX >= 0.15 && BGM_DEFAULT.vol * BGM_MAX <= 0.25, '기본 BGM 크기 0.15~0.25');
assert.ok(FADE_TAU * 3 >= 3 && FADE_TAU * 3 <= 5, '구역 전환 크로스페이드 3~5초 (95% 도달)');

// 섞는 비율: 몫 합 1, 크기 제곱 합 1 (같은 에너지로 크로스페이드)
const sum = (m) => Object.values(m.w).reduce((a, b) => a + b, 0), pow = (m) => Object.values(m.gain).reduce((a, b) => a + b * b, 0);
const R = rng(5);
for (let i = 0; i < 400; i++) { const x = -560 + R() * 640, z = -160 + R() * 400, m = bgmMix({ night: R(), x, z, pl: placeOf(x, z) }); assert.ok(near(sum(m), 1, 1e-9) && near(pow(m), 1, 1e-9), `합 1 (${x.toFixed(0)},${z.toFixed(0)})`); }
// 낮·밤·해질녘 (광장)
let m = bgmMix({ night: 0, x: 0, z: 6, pl: 'town' }); assert.equal(m.gain.day, 1); assert.equal(m.gain.night, 0); assert.equal(m.master, 1);
m = bgmMix({ night: 1, x: 0, z: 6, pl: 'town' }); assert.equal(m.gain.night, 1);
m = bgmMix({ night: 0.5, x: 0, z: 6, pl: 'town' }); assert.ok(near(m.gain.day, Math.SQRT1_2, 1e-9) && near(m.gain.night, Math.SQRT1_2, 1e-9), '해질녘엔 반반');
let prev = 1; for (let n = 0; n <= 1.0001; n += 0.05) { const g = bgmMix({ night: n }).gain.day; assert.ok(g <= prev + 1e-12, '밤이 깊어질수록 낮 곡이 줄기만 함'); prev = g; }
assert.equal(bgmMix({ night: 0.2 }).gain.day, 1, '밤 정도 0.25 아래는 낮 곡 그대로');
// 놀이공원: 정문 밖 12m 은 0, 안쪽 18m 부터 1, 그 사이 서서히
assert.equal(bgmMix({ x: PARK_GATE.x + 13, z: PARK_GATE.z }).w.park, 0, '정문 밖');
const mid = bgmMix({ x: PARK_GATE.x - 3, z: PARK_GATE.z }).w.park; assert.ok(mid > 0.2 && mid < 0.8, '정문 근처는 섞임 ' + mid);
const inP = { x: -400, z: -60 }; assert.equal(placeOf(inP.x, inP.z), 'park'); assert.equal(bgmMix({ ...inP, pl: 'park', night: 1 }).w.park, 1, '공원 안은 밤에도 놀이공원 곡');
assert.ok(parkDepth(-382, -34) > 18);
// 기구 가까이선 BGM 을 살짝 줄임 (멀면 그대로)
const car = RIDE_SLOTS.drop, atRide = bgmMix({ x: car.x, z: car.z, pl: 'park' }), far = bgmMix({ x: -382, z: -120, pl: 'park' });
assert.equal(rideDist(car.x, car.z), 0);
assert.ok(atRide.master < 0.75 && atRide.master >= 0.6, '기구 옆 줄임 ' + atRide.master);
const cm = bgmMix({ x: RIDE_SLOTS.carousel.x, z: RIDE_SLOTS.carousel.z, pl: 'park' }).master; assert.ok(cm < 0.35 && cm > 0.15, '회전목마 오르골 옆은 BGM 을 더 줄여 두 왈츠가 겹치지 않게 ' + cm);
assert.ok(far.master > atRide.master, '기구에서 멀면 덜 줄임');
// 숲길·사찰 마당·불멍 공터: 숲 소리만
const tp = TRAIL.pts[Math.floor(TRAIL.pts.length / 2)]; assert.equal(placeOf(tp[0], tp[1]), 'trail');
assert.equal(bgmMix({ x: tp[0], z: tp[1], pl: 'trail', night: 0.9 }).gain.forest, 1, '사찰 가는 숲길');
const cp = CAMP_PATH.pts[Math.floor(CAMP_PATH.pts.length / 2)]; assert.equal(placeOf(cp[0], cp[1]), 'trail');
assert.equal(bgmMix({ x: cp[0], z: cp[1], pl: 'trail' }).gain.forest, 1, '불멍 캠프 숲길');
assert.equal(bgmMix({ pl: 'camp' }).gain.forest, 1, '불멍 공터');
const yard = [TEMPLE_YARD.cx + TEMPLE_YARD.w * 0.4, TEMPLE_YARD.cz + TEMPLE_YARD.d * 0.4]; assert.equal(placeOf(...yard), 'temple');
assert.equal(bgmMix({ x: yard[0], z: yard[1], pl: 'temple' }).gain.forest, 1, '사찰 마당');
// 건물 안: 카페·회사 작고 먹먹하게, 카지노 더 작게, 성당·교회·사찰 안은 끔
const inside = (k) => { const b = BUILDINGS[k]; return bgmMix({ x: b.cx, z: b.cz, pl: placeOf(b.cx, b.cz), inKey: k }); };
for (const k of ['cafe', 'office']) { const r = inside(k); assert.ok(r.master > 0.3 && r.master < 0.6 && r.lp < 1000, k); assert.ok(r.gain.day === 1 && r.gain.forest === 0, k + ' 은 마을 곡'); }
assert.ok(inside('casino').master < inside('cafe').master, '카지노는 더 작게');
for (const k of ['cathedral', 'church', 'temple']) assert.equal(inside(k).master, 0, k + ' 안은 BGM 끔');
assert.equal(inside('temple').gain.forest, 0, '사찰 건물 안은 숲 소리도 아님');

// 멜로디 규칙: 강박은 화음 음, 음역 안, 마지막 마디는 그 화음 근음, 변주는 길이 같고 조금 다름
const { allowed, genLine, varyLine } = compose;
assert.ok(!allowed([0, 2, 4, 5, 7, 9, 11], [60, 64, 67], false).has(5), 'C 화음 위 약박에 F(미와 반음) 안 씀');
assert.ok(allowed([0, 2, 4, 5, 7, 9, 11], [62, 66, 69, 72], false).has(4) && !allowed([0, 2, 4, 5, 7, 9, 11], [62, 66, 69, 72], false).has(5), 'D7 위에선 F 대신 피함');
const O = { lo: 69, hi: 86, scale: [2, 4, 6, 9, 11], strong: (p) => p % 2 === 0, rhythms: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[0, 2], [2.5, 0.5], [3, 1]]] };
const specs = [50, 47, 43, 45, 50, 42, 43, 45].map((r, i) => ({ tones: [r, r + (i === 1 || i === 5 ? 3 : 4), r + 7], rh: O.rhythms[i % 2], end: i === 7 ? 'root' : null }));
for (let s = 1; s < 30; s++) {
  const rr = rng(s), line = genLine(rr, specs, O);
  line.forEach((bar, i) => bar.forEach(([p, , n]) => {
    assert.ok(n >= O.lo && n <= O.hi, '음역');
    const pcs = specs[i].tones.map((t) => t % 12);
    if (O.strong(p)) assert.ok(pcs.includes(n % 12), `강박은 화음 음 (마디 ${i})`); else assert.ok(O.scale.includes(n % 12) || pcs.includes(n % 12), '약박은 음계 음 또는 화음 음');
  }));
  assert.equal(line[7].at(-1)[2] % 12, 45 % 12, '끝은 그 마디 화음의 근음 (A)');
  const v = varyLine(rr, line, specs, O, 0.3);
  assert.equal(v.length, line.length); assert.equal(v[7].at(-1)[2] % 12, 9, '변주해도 끝은 근음');
  if (s < 5) assert.notDeepEqual(v, line, '변주는 조금 다름');
}
assert.deepEqual(SONG_NAMES, ['day', 'night', 'park', 'forest']);

// 바닥 재질 (발소리)
const B = (k) => [BUILDINGS[k].cx, BUILDINGS[k].cz];
const SURF_CASES = [[[0, 4], 'stone', '마을 광장'], [[0, 30], 'grass', '마을 잔디'], [B('cafe'), 'wood', '카페 마루'], [B('office'), 'wood', '회사'], [B('casino'), 'carpet', '카지노 카펫'],
  [B('cathedral'), 'hall', '성당 석재'], [B('church'), 'hall', '교회'], [B('temple'), 'maru', '사찰 마루'], [[-17, -15.6], 'dirt', '집 앞 골목 흙길'], [tp, 'forest', '사찰 가는 숲길'], [cp, 'forest', '불멍 숲길'],
  [[(ENTRY_PLAZA.x0 + ENTRY_PLAZA.x1) / 2, -34], 'brick', '놀이공원 입구 광장'], [[-400, PROMENADE.z], 'brick', '놀이공원 대로'], [[ZOO_AVE_X, -110], 'dirt', '동물원 흙길'], [[-400, 80], 'grass', '공원 잔디'], [yard, 'dirt', '사찰 마당 흙'], [[FIRE.x + CLEAR_R - 3, FIRE.z], 'forest', '불멍 공터']];
for (const [[x, z], want, name] of SURF_CASES) assert.equal(surfaceAt(x, z), want, `${name} (${x.toFixed(1)},${z.toFixed(1)})`);
for (let i = 0; i < 300; i++) assert.ok(SURFACES.includes(surfaceAt(-560 + R() * 960, -200 + R() * 400)), '모든 자리는 아는 재질');
// 발걸음 박자: 아바타 다리 위상(1초 11 라디안)이 π 지날 때마다 한 걸음 → 1초 약 3.5걸음, 좌우 번갈아
assert.ok(Math.abs(STEP_RATE - 3.5) < 0.05);
let ph = 0.3, n = 0, feet = []; for (let i = 0; i < 600; i++) { const a = ph + 11 / 60; const k = stepCount(ph, a); n += k; if (k) feet.push(footOf(a)); ph = a; } // 10초, 60fps
assert.ok(n >= 34 && n <= 36, '10초 걸으면 35걸음 ' + n);
assert.ok(feet.every((f, i) => !i || f !== feet[i - 1]), '왼발·오른발 번갈아');
assert.equal(stepCount(1, 1 + 1e-3), 0); assert.equal(stepCount(3.1, 3.2), 1, 'π 를 넘는 순간 한 걸음');
// 거리·좌우
let sp = spatial(0, 0, 1, 0, 0, 0.5, 30); assert.equal(sp.g, 1); sp = spatial(0, 0, 1, 0, 10, 0, 30); assert.ok(sp.pan > 0.8 && sp.g < 1 && sp.g > 0.3, '오른쪽 10m');
sp = spatial(0, 0, 1, 0, -10, 0, 30); assert.ok(sp.pan < -0.8, '왼쪽'); assert.equal(spatial(0, 0, 1, 0, 40, 0, 30).g, 0, '범위 밖은 무음');
assert.ok(spatial(0, 0, 1, 0, 0, 20, 30).g < spatial(0, 0, 1, 0, 0, 10, 30).g, '멀수록 작게');
// 동시 소리 상한·쿨다운
const VV = makeVoices(24); let got = 0; for (let i = 0; i < 40; i++) got += VV.take(1, 0.5) ? 1 : 0; assert.equal(got, 24, '24개까지만'); assert.equal(VV.take(1.6, 0.5), true, '끝난 소리 자리는 다시 씀');
assert.equal(VV.take(2, 0.1, 'bird', 3), true); assert.equal(VV.take(3, 0.1, 'bird', 3), false, '쿨다운 안'); assert.equal(VV.take(5.1, 0.1, 'bird', 3), true);
// 가까운 사람 3명까지 (8m 안)
const ppl = Array.from({ length: 80 }, (_, i) => ({ x: (i % 10) * 2, z: Math.floor(i / 10) * 2 })); const nn = nearestN(ppl, 0.1, 0.1, 3, 8);
assert.equal(nn.length, 3); assert.deepEqual(nn[0], { x: 0, z: 0 }); assert.equal(nearestN(ppl, 100, 100, 3, 8).length, 0, '멀면 아무도');
// 반딧불이 자리: 숲길 가운데에서 3~14m 옆(길 위 아님) · 사찰 마당·불멍 공터 가장자리
const spots = fireflySpots(rng(9)); assert.ok(spots.length > 600, '자리 ' + spots.length);
let onTrail = 0; for (const [x, z] of spots) { const pl = placeOf(x, z); if (inTown(x, z)) assert.fail(`마을 안에 반딧불이 자리 (${x.toFixed(0)},${z.toFixed(0)})`); if (surfaceAt(x, z) === 'forest' && pl === 'trail') onTrail++; }
assert.ok(onTrail < spots.length * 0.05, '길 한가운데는 거의 없음 ' + onTrail);
console.log('소리(배경음악 구역·섞기·설정·멜로디 · 발소리 재질·박자 · 거리·좌우 · 동시 소리 상한 · 반딧불이 자리) 시험 통과');
