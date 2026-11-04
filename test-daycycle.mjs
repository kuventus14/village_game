// 낮·밤 시간 계산 시험: KST 변환, 해 뜨고 지는 시각, 해 방향, 시각→분위기 연속성, 시간 흐름(?t= / ?speed=)
import assert from 'node:assert/strict';
import { kstParts, kstHours, sunTimes, sunVec, keyTimes, newState, skyState, moonPhase, makeClock, parseHM, clockLabel } from './public/daycycle.js';

const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const between = (h, a, b, msg) => assert.ok(h >= parseHM(a) && h <= parseHM(b), `${msg}: ${hm(h)} 가 ${a}~${b} 밖`);

// KST = UTC+9, 기기 시간대와 무관 (UTC 로만 계산)
const p = kstParts(Date.UTC(2026, 10, 1, 15, 30)); // 11/1 15:30 UTC = 11/2 00:30 KST
assert.deepEqual([p.y, p.mo, p.d, p.h, p.mi, p.doy], [2026, 11, 2, 0, 30, 306]);
assert.equal(kstHours(Date.UTC(2026, 0, 1, 0, 0)), 9);
assert.equal(kstParts(Date.UTC(2026, 11, 31, 15, 0)).y, 2027, '연말 자정 넘김');

// 해 뜨고 지는 시각: 11월 초 ≈ 06:50/17:30, 6월 말 ≈ 05:10/19:55, 동지·하지 사이 범위
const nov = sunTimes(306), jun = sunTimes(176), dec = sunTimes(355);
between(nov.rise, '6:40', '7:05', '11월 해뜸'); between(nov.set, '17:20', '17:45', '11월 해짐');
between(jun.rise, '5:00', '5:25', '6월 해뜸'); between(jun.set, '19:45', '20:05', '6월 해짐');
assert.ok(jun.set - jun.rise > 14.3 && dec.set - dec.rise < 9.8, '여름 낮이 겨울보다 김');
for (let d = 1; d <= 366; d++) {
  const t = sunTimes(d), k = keyTimes(t);
  assert.ok(t.rise > 4.5 && t.rise < 8 && t.set > 17 && t.set < 20.5, `day ${d}`);
  for (let i = 1; i < k.length; i++) assert.ok(k[i] > k[i - 1], `day ${d} 키프레임 순서 ${i}`);
}

// 해: 동쪽에서 떠서 남쪽 하늘을 지나 서쪽으로 (x=동, z=남)
const v = [0, 0, 0];
sunVec(306, nov.rise, v); assert.ok(v[0] > 0.8 && Math.abs(v[1]) < 0.03, '동쪽 지평선에서 뜸');
sunVec(306, nov.noon, v); assert.ok(Math.abs(v[0]) < 0.01 && v[2] > 0.7, '정오엔 남쪽');
const alt = (Math.asin(v[1]) * 180) / Math.PI; assert.ok(alt > 37 && alt < 39, `11월 남중 고도 ${alt}`);
sunVec(306, nov.set, v); assert.ok(v[0] < -0.8 && Math.abs(v[1]) < 0.03, '서쪽으로 짐');
sunVec(306, 0, v); assert.ok(v[1] < -0.5, '자정엔 땅 아래 (달은 그 반대라 하늘 높이)');

// 시각 → 분위기: 1분 간격으로 하루를 돌며 값이 튀지 않음 (자정 넘김 포함), 시간대가 맞게 나옴
const s = newState(), prev = newState(), keys = ['top', 'mid', 'hor', 'glow', 'sun', 'hemiS', 'hemiG', 'cloud', 'cloudE', 'halo', 'sunI', 'moonI', 'hemiI', 'fillI', 'exp', 'bloom', 'star', 'night'];
for (const doy of [1, 80, 176, 306, 355]) {
  const k = keyTimes(sunTimes(doy));
  skyState(23.99, k, prev);
  for (let m = 0; m < 1440; m++) {
    skyState(m / 60, k, s);
    for (const n of keys) {
      const d = Array.isArray(s[n]) ? Math.max(...s[n].map((x, i) => Math.abs(x - prev[n][i]))) : Math.abs(s[n] - prev[n]) / (n === 'sunI' ? 2.25 : 1);
      assert.ok(d < 0.03, `day ${doy} ${hm(m / 60)} ${n} 튐 ${d.toFixed(3)}`);
      Array.isArray(s[n]) ? prev[n].splice(0, 3, ...s[n]) : (prev[n] = s[n]);
    }
    assert.ok(!(s.sunI > 0 && s.moonI > 0), '해와 달이 동시에 빛을 내지 않음 (빛 방향이 바뀔 때 튀지 않게)');
  }
}
const at = (t) => skyState(parseHM(t), keyTimes(nov), newState());
assert.equal(at('12:00').key, 'day'); assert.equal(at('02:00').key, 'night'); assert.equal(at('17:20').key, 'sunset'); assert.equal(at('18:30').key, 'dusk');
assert.ok(at('05:30').night > 0.5 && at('05:30').night < 1, '새벽은 밤과 아침 사이');
assert.ok(at('21:00').night === 1 && at('21:00').star === 1 && at('21:00').moonI > 0.5, '밤엔 별·달빛');
assert.ok(at('21:00').hemiI >= 1.2, '밤에도 캐릭터·길이 보이게 환경광 충분');

// 달 위상: 2000-01-21 보름 ≈ 0.5
assert.ok(Math.abs(moonPhase(Date.UTC(2000, 0, 21, 4, 40)) - 0.5) < 0.03);

// 시간 흐름: ?t= 고정, ?speed= 배속, 이상한 값은 실시간
const now = Date.UTC(2026, 10, 2, 3, 0); // KST 12:00
assert.equal(kstHours(makeClock({ t: '17:20', now })(now + 5e6)), 17 + 20 / 60, '고정 시각은 멈춰 있음');
const fast = makeClock({ speed: '60', now });
assert.equal(fast(now + 60e3) - fast(now), 3.6e6, '60배속: 1분에 1시간');
assert.equal(kstHours(makeClock({ t: '16:30', speed: 60, now })(now + 60e3)), 17.5, '고정 시각에서 배속으로 출발');
assert.equal(makeClock({ t: '25:00', speed: 'x', now })(now + 1234), now + 1234, '이상한 값 → 실시간');
assert.equal(parseHM('7:5'), null);
assert.equal(kstHours(makeClock({ mode: 'night', now })(now)), 22);
between(kstHours(makeClock({ mode: 'sunset', now })(now)), '17:00', '17:40', '노을 고정');

assert.equal(clockLabel(Date.UTC(2026, 10, 1, 15, 5), 'night'), '🌙 오전 12:05');
assert.equal(clockLabel(Date.UTC(2026, 10, 2, 6, 20), 'afternoon'), '🌤 오후 3:20');
console.log('낮·밤(한국 시간) 계산 시험 통과');
