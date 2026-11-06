// 불꽃놀이 3분 대본 (순수 데이터, 서버·브라우저·시험이 같이 씀): 음악 박자(분당 96박)에 맞춰 "몇 초에 어디서 무슨 불꽃이 터지는지"를 정해 둠.
// 모두가 같은 쇼 시계(쇼 시작 = 0초)로 같은 걸 보므로 난수는 고정 씨앗. 시안(docs/visual/firework-show-preview.html)과 같은 구성 → 좌표만 월드(m)로 바꿈
// 월드 좌표: 정문(PARK_GATE) 바로 안쪽 하늘. 다리 위에서 서쪽(정문)을 보면 오른쪽이 -z. 높이는 땅 위 m.
import { PARK_GATE } from './parkdata.js';

export const BPM = 96, SPB = 60 / BPM, S16 = SPB / 4, BAR = SPB * 4, FLY = 1.05; // 한 마디 2.5초, 쏘아 올려 터질 때까지 1.05초
export const SHOW_X = PARK_GATE.x - 8; // 불꽃이 올라오는 자리 (정문 뒤)
export const ACTS = [['1 · 오프닝', 0], ['2 · 전개', 25], ['3 · 모양 불꽃', 65], ['4 · 클라이맥스', 110], ['5 · 피날레', 150]];
export const actOf = (t) => { let a = 0; ACTS.forEach(([, s], i) => { if (t >= s) a = i; }); return a; };
const PX_Z = 0.11, PX_Y = 0.28; // 시안 화면 1px → 월드 m (옆 0.11m, 높이 0.28m)

let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const HUE = [0.98, 0.07, 0.13, 0.35, 0.52, 0.6, 0.78, 0.9];
const snap = (t) => Math.round(t / (SPB / 2)) * (SPB / 2), pick = () => HUE[Math.floor(rnd() * HUE.length)], R = (a, b) => a + rnd() * (b - a);
const raw = [];
const add = (t, o) => raw.push({ t: snap(t), s: 1, ...o });
const em = (t, o) => raw.push({ t, kind: 'em', ...o });
(function build() {
  [[3.75, 300, 'peony'], [7.5, 520, 'peony'], [11.25, 760, 'peony'], [15, 980, 'rainbow']].forEach(([t, x, type], i) => add(t, { type, x, h: HUE[i * 2 % 8], apex: 190, s: 0.9 }));
  add(18.75, { type: 'palm', x: 420, h: 0.12, apex: 170, s: 1 }); add(19.375, { type: 'palm', x: 860, h: 0.12, apex: 170, s: 1 });
  add(21.875, { type: 'saturn', x: 640, h: 0.55, apex: 150, s: 1.1 });
  [[23.75, 300], [24.0625, 640], [24.375, 980]].forEach(([t, x]) => add(t, { type: 'peony', x, h: pick(), apex: 170, s: 1 }));
  const mid = ['peony', 'willow', 'palm', 'saturn', 'rainbow', 'ring', 'spiral'];
  for (let t = 26.25, i = 0; t < 64; t += SPB * 3, i++) { const ty = mid[i % mid.length]; add(t, { type: ty, x: R(200, 1080), h: ty === 'willow' ? 0.12 : pick(), apex: R(120, 210), s: 1.05 }); if (i % 2) add(t + SPB * 1.5, { type: 'peony', x: R(160, 1120), h: pick(), apex: R(140, 220), s: 0.9 }); }
  em(45, { type: 'gerb', x: 70, dur: 6, h: 0.12 }); em(45, { type: 'gerb', x: 1210, dur: 6, h: 0.12 }); em(56, { type: 'gerb', x: 70, dur: 6, h: 0.12 }); em(56, { type: 'gerb', x: 1210, dur: 6, h: 0.12 });
  [['heart', 0.95], ['smile', 0.14], ['star', 0.14], ['ring2', 0.52], ['heart', 0.6], ['smile', 0.14], ['star', 0.78], ['heart', 0.98]].forEach(([type, h], i) => {
    const t = 68.75 + i * 5; add(t, { type, x: 640, h, apex: 185, s: 1.2 });
    add(t + SPB * 3, { type: i % 2 ? 'palm' : 'peony', x: 320, h: pick(), apex: 210, s: 0.9 }); add(t + SPB * 3.5, { type: i % 2 ? 'palm' : 'peony', x: 960, h: pick(), apex: 210, s: 0.9 });
    em(t - 1, { type: 'gerb', x: 70, dur: 2.5, h: 0.12 }); em(t - 1, { type: 'gerb', x: 1210, dur: 2.5, h: 0.12 });
  });
  [105, 106.25, 107.5, 108.75].forEach((t, i) => add(t, { type: 'rainbow', x: 240 + i * 270, h: 0.1 + i * 0.2, apex: 200 - i * 12, s: 1.1 }));
  const big = ['crossette', 'willow', 'palm', 'rainbow', 'saturn', 'spiral'];
  for (let t = 111.25, i = 0; t < 149; t += SPB * 3, i++) { const ty = big[i % big.length], x = R(200, 520), h = pick(), ap = R(130, 210); add(t, { type: ty, x, h: ty === 'willow' ? 0.12 : h, apex: ap, s: 1.15 }); add(t, { type: ty, x: 1280 - x, h: ty === 'willow' ? 0.12 : h, apex: ap, s: 1.15 }); }
  em(111, { type: 'gerb', x: 70, dur: 39, h: 0.12 }); em(111, { type: 'gerb', x: 1210, dur: 39, h: 0.12 }); em(111, { type: 'gerb', x: 350, dur: 39, h: 0.58 }); em(111, { type: 'gerb', x: 930, dur: 39, h: 0.58 });
  em(120, { type: 'cascade', x: 380, x2: 900, dur: 6 }); em(127, { type: 'cascade', x: 250, x2: 1030, dur: 5 }); em(138, { type: 'cascade', x: 150, x2: 1130, dur: 10 });
  const all = ['peony', 'ring', 'crossette', 'rainbow', 'palm', 'saturn', 'spiral', 'peony'];
  for (let t = 151.25, d = SPB; t < 172; t += d, d = Math.max(SPB / 2, d - 0.012)) add(t, { type: all[Math.floor(rnd() * all.length)], x: R(120, 1160), h: pick(), apex: R(100, 220), s: 1.05 });
  [172.5, 173.125, 173.75, 174.375, 175].forEach((t, i) => add(t, { type: 'willow', x: 200 + i * 220, h: 0.12, apex: 115, s: 1.5 }));
  for (let t = 176.25, i = 0; t < 179.9; t += SPB / 2, i++) add(t, { type: 'rainbow', x: 150 + ((i * 135) % 1000), h: (i * 0.11) % 1, apex: 110 + (i % 3) * 30, s: 1.1 }); // 화면 폭 안에서 왼쪽→오른쪽으로 훑고 되돌아옴
  for (let k = 0; k < 9; k++) em(150, { type: 'gerb', x: 70 + k * 142, dur: 30, h: k % 2 ? 0.12 : 0.58 });
  add(180, { type: 'giant', x: 640, h: 0.12, apex: 150, s: 2.4 });
  [[180, 220], [180, 1060], [180.3125, 430], [180.3125, 850]].forEach(([t, x]) => raw.push({ t: snap(t) + 0.0001, s: 1.7, type: 'willow', x, h: 0.12, apex: 120 }));
  em(180, { type: 'cascade', x: 60, x2: 1220, dur: 6 });
})();

// 대본: 터지는 시각 t, 쏘아 올리는 시각 lt(= t - FLY), 월드 위치(x·y·z). 발사 시각 순
export const SHOW_EVENTS = raw.map((e) => {
  const o = { ...e, lt: e.kind === 'em' ? e.t : e.t - FLY, wz: PARK_GATE.z - (e.x - 640) * PX_Z, wx: SHOW_X };
  if (e.x2 != null) o.wz2 = PARK_GATE.z - (e.x2 - 640) * PX_Z;
  if (e.apex != null) o.wy = (548 - e.apex) * PX_Y;
  return o;
}).sort((a, b) => a.lt - b.lt);
export const SHOW_END = 180; // 마지막 한 방이 터지는 시각
