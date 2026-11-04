// 놀이기구 데이터 + 시간만으로 정해지는 움직임 (서버·브라우저·시험이 같이 씀, world.js 가 다시 내보냄). 새 기구 붙이는 법: docs/RIDES.md
// world.js 를 불러오지 않음. 자리는 ./parkdata.js 의 RIDE_SLOTS·TRAIN_PATH·TRAIN_STATIONS 를 불러 씀. 연결 약속: docs/PARK.md 맨 아래
// 핵심: 좌석 위치는 seatPose(기구, 자리, 서버 시각 ms) 순수 함수 → 서버·모든 화면이 같은 시각이면 같은 자리 (네트워크로 위치를 안 보냄)
// 기구마다 회차(round)로 돎: 대관람차·회전목마 = 승차 시간(탑승 창) → 운행 → 다음 회차 시작에 하차, 꼬마기차 = 쉬지 않고 돌며 역 3곳에서 섬
import { RIDE_SLOTS, TRAIN_PATH, TRAIN_STATIONS, trainAt, trainNear, parkPathNear, PARK_LAMPS, PARK_SHOPS } from './parkdata.js';

const PI = Math.PI, TAU = PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
// 사다리꼴 속도(가속 ta → 일정 → 감속 ta)로 0 → 1 을 T 동안 가는 진행도. u = 지난 시간 (같은 단위)
export function trap(u, T, ta) {
  if (u <= 0) return 0;
  if (u >= T) return 1;
  const v = 1 / (T - ta);
  return u < ta ? 0.5 * v * u * u / ta : u > T - ta ? 1 - 0.5 * v * (T - u) ** 2 / ta : v * (u - ta / 2);
}

export const RIDES = {}; // 기구 등록부: id(RIDE_SLOTS 의 id) → 기구 정보(아래 약속). 여기 들어간 id 는 park-site.js 가 '준비 중' 자리 표시를 안 그림
export const RIDE_RECTS = []; // 충돌 네모 [x0,z0,x1,z1] (역 매표칸). world.js resolve 가 공원 안에서만 확인 — 다시 대입하지 말고 push
export const RIDE_CIRCLES = []; // 충돌 원 { x, z, r } (관람차 다리·곤돌라 자리·회전목마 받침·역 지붕 기둥)
export const RIDE_STATUS = {}; // 이름표 상태 { key: ['🎡', '대관람차 타는 중'] } → world.js 가 STATUS·ACT_STATUS 에 넣음 (타는 동안만)

/* 기구 하나의 약속 (서버 rides.js 가 이것만 보고 심판함, 화면 rides.js 도 같은 것을 씀):
   { id, name, icon, status(이름표 상태 키), seats(자리 수), reach(탈 수 있는 거리 m: 내 위치 ↔ 자리), sit(앉는 자세: avatar.js animate 의 seat.kind), cam{pitch,dist}(타는 동안 시점),
     pose(seat, t) → {x, y(앉는 면 높이), z, ry}   ← 순수 함수, 서버 시각 t(ms)만 봄
     open(t) → { seats: [지금 탈 수 있는 자리…], left(ms) } 또는 { wait(ms), msg }   ← 탑승 창
     board(t) → 탄 사람 기록에 덧붙일 값 (회차 번호 등)
     exitOk(rider, t) 스스로 내릴 수 있나 · due(rider, t) 서버가 지금 내려 줘야 하나 · exit(seat, t) → [x, z, ry] 안전하게 내릴 자리
     input?(rider, m, t) → 2단계용 자리: 탄 사람의 조작({t:'ride', op:'in', …})을 rider.st 에 반영하고 모두에게 알릴 값(없으면 null) } */

/* ───── ① 대관람차: 바퀴 면 z–y (정문에서 정면), 곤돌라 12개 × 4자리 ─────
   한 회차: 맨 아래 곤돌라 0 정지(태움) → 30° → 곤돌라 1 정지 → 30° → 곤돌라 2 정지 → 남은 300° 를 천천히 운행 → 다시 곤돌라 0 이 아래 (= 탄 사람은 딱 한 바퀴)
   곤돌라 i 가 매달린 점의 각 φ = -90° + i·30° - W(t). W 는 회차마다 360° 씩 늘어남. 곤돌라는 그 점에서 늘 아래로 매달림(중력 방향) */
const FS = RIDE_SLOTS.ferris;
export const FERRIS = { x: FS.x, z: FS.z, r: FS.wheel.r, hub: FS.wheel.hub, n: 12, per: 4, stop: 7000, step: 8000, run: 60000, loads: 3, drop: 2.55, floor: 3.0 }; // drop = 매단 점 → 앉는 면, floor = 매단 점 → 바닥
FERRIS.round = FERRIS.loads * FERRIS.stop + (FERRIS.loads - 1) * FERRIS.step + FERRIS.run; // 97초 (한 칸 옮길 때도 운행과 같은 빠르기, 테두리 최고 약 2.9m/s)
const FSTEP = TAU / FERRIS.n;
// 대관람차 상태: n = 회차, w = 바퀴가 돈 각(rad, 계속 늘어남), g = 아래에 서 있는 곤돌라(-1 = 움직이는 중), left = 그 정지가 남은 ms, next = 운행 끝까지
export function ferrisAt(t) {
  const F = FERRIS, n = Math.floor(t / F.round), u = mod(t, F.round);
  for (let k = 0; k < F.loads; k++) {
    const s0 = k * (F.stop + F.step);
    if (u < s0 + F.stop) return { n, w: n * TAU + k * FSTEP, g: k, left: s0 + F.stop - u };
    if (k < F.loads - 1 && u < s0 + F.stop + F.step) return { n, w: n * TAU + (k + trap(u - s0 - F.stop, F.step, 3000)) * FSTEP, g: -1, left: 0, next: s0 + F.stop + F.step - u };
  }
  const u0 = F.loads * F.stop + (F.loads - 1) * F.step, a0 = (F.loads - 1) * FSTEP;
  return { n, w: n * TAU + a0 + trap(u - u0, F.run, 9000) * (TAU - a0), g: -1, left: 0, next: F.round - u };
}
// 곤돌라 i 가 매달린 점 [x, y, z] (바퀴 각 w)
export const gondolaAt = (i, w) => { const a = -PI / 2 + i * FSTEP - w; return [FERRIS.x, FERRIS.hub + FERRIS.r * Math.sin(a), FERRIS.z + FERRIS.r * Math.cos(a)]; };
export const GONDOLA_SEATS = [[0.62, -0.5, -PI / 2], [0.62, 0.5, -PI / 2], [-0.62, -0.5, PI / 2], [-0.62, 0.5, PI / 2]]; // 곤돌라 안 자리 (x, z, 바라보는 쪽): 둘씩 마주 앉음
RIDES.ferris = {
  id: 'ferris', name: '대관람차', icon: '🎡', status: 'rideFerris', seats: FERRIS.n * FERRIS.per, reach: 6, sit: 'park', cam: { pitch: 0.3, dist: 24 },
  pose(seat, t) {
    const [x, y, z] = gondolaAt(Math.floor(seat / 4), ferrisAt(t).w), [dx, dz, ry] = GONDOLA_SEATS[seat % 4];
    return { x: x + dx, y: y - FERRIS.drop, z: z + dz, ry };
  },
  open(t) {
    const f = ferrisAt(t);
    if (f.g >= 0 && f.left > 1000) return { seats: [0, 1, 2, 3].map((k) => f.g * 4 + k), left: f.left };
    return { wait: f.g >= 0 ? f.left + FERRIS.step : f.next, msg: '곤돌라가 내려와 멈추면 탈 수 있어요' };
  },
  board: (t) => ({ round: ferrisAt(t).n }),
  exitOk: (r, t) => ferrisAt(t).g === Math.floor(r.seat / 4), // 내 곤돌라가 아래에 서 있을 때만
  due: (r, t) => { const f = ferrisAt(t); return f.n > r.round && f.g === Math.floor(r.seat / 4); }, // 한 바퀴 돌고 다시 아래에 서면
  exit: (seat) => [FERRIS.x + 4.6, FERRIS.z + (seat % 2 ? 1.3 : -1.3), PI / 2],
};
// 다리 4개 (바퀴 양옆 A자) · 아래 곤돌라 가운데
for (const sx of [-1, 1]) for (const sz of [-1, 1]) RIDE_CIRCLES.push({ x: FERRIS.x + sx * 9, z: FERRIS.z + sz * 14, r: 0.9 });
RIDE_CIRCLES.push({ x: FERRIS.x, z: FERRIS.z, r: 0.5 }); // 아래 곤돌라 가운데 (대로 끝점은 걸어서 닿아야 해서 작게)

/* ───── ② 회전목마: 크림 지붕, 말·토끼·곰 24자리(바깥 12 · 안쪽 12), 천천히 3바퀴 돌며 위아래 ─────
   한 회차: 승차 18초(멈춤) → 운행 60초 (7초 동안 서서히 빨라지고 서서히 멈춤) → 다음 회차 시작에 모두 내림 */
const CS = RIDE_SLOTS.carousel;
export const CAROUSEL = { x: CS.x, z: CS.z, load: 18000, run: 60000, ramp: 7000, turns: 3, n: 12, ring: [7.2, 5.0], deck: 0.55, plat: 9.2, saddle: 1.2, bob: 0.32 };
CAROUSEL.round = CAROUSEL.load + CAROUSEL.run; // 78초
// 회전목마 상태: n = 회차, a = 돈 각(rad), run = 도는 중, left = 승차 시간이 남은 ms (도는 중엔 0), next = 운행 끝까지
export function carouselAt(t) {
  const C = CAROUSEL, n = Math.floor(t / C.round), u = mod(t, C.round), base = n * C.turns * TAU;
  if (u < C.load) return { n, a: base, run: false, left: C.load - u };
  return { n, a: base + trap(u - C.load, C.run, C.ramp) * C.turns * TAU, run: true, left: 0, next: C.round - u };
}
export const carouselAnimal = (seat) => (seat % 12 + (seat >= 12 ? 1 : 0)) % 3; // 0 말 · 1 토끼 · 2 곰
export const carouselBob = (seat, a) => Math.sin(3 * a + (seat % 12) * 2.1 + (seat >= 12 ? PI : 0)); // 위아래 (-1..1), 도는 각에 묶임 → 멈추면 같이 멈춤
export const carouselAngle = (seat) => (seat % 12) * (TAU / 12) + (seat >= 12 ? TAU / 24 : 0);
RIDES.carousel = {
  id: 'carousel', name: '회전목마', icon: '🎠', status: 'rideCarousel', seats: 24, reach: 4.5, sit: 'hold', cam: { pitch: 0.2, dist: 6.5 },
  pose(seat, t) {
    const C = CAROUSEL, c = carouselAt(t), a = carouselAngle(seat) + c.a, R = C.ring[seat >= 12 ? 1 : 0];
    return { x: C.x + R * Math.sin(a), y: C.deck + C.saddle + C.bob * carouselBob(seat, c.a), z: C.z + R * Math.cos(a), ry: Math.atan2(Math.cos(a), -Math.sin(a)) };
  },
  open(t) {
    const c = carouselAt(t);
    if (!c.run && c.left > 1000) return { seats: [...Array(24).keys()], left: c.left };
    return { wait: c.run ? c.next : c.left + CAROUSEL.run, msg: '회전목마가 멈추면 탈 수 있어요' };
  },
  board: (t) => ({ round: carouselAt(t).n }),
  exitOk: (r, t) => !carouselAt(t).run,
  due: (r, t) => carouselAt(t).n > r.round,
  exit(seat, t) { const C = CAROUSEL, a = carouselAngle(seat) + carouselAt(t).a, d = C.plat + 1.5; return [C.x + d * Math.sin(a), C.z + d * Math.cos(a), a]; },
};
RIDE_CIRCLES.push({ x: CAROUSEL.x, z: CAROUSEL.z, r: CAROUSEL.plat + 0.3 });

/* ───── ⑩ 꼬마기차: 기관차 + 객차 4량(각 4자리), 닫힌 선로를 쉬지 않고 돌며 역 3곳에서 12초씩 섬 ─────
   역 사이는 사다리꼴 속도(최고 12m/s, 1.2m/s² 로 출발·정지). 한 바퀴 약 2분 25초. 역에 서 있을 때만 타고 내림, 한 바퀴 돌면 내려 줌 */
export const TRAIN = { vmax: 12, acc: 1.2, stop: 12000, head: 11, cars: 4, loco: 5.2, car: 3.8, gap: 0.5, seatY: 0.95, side: 0.42, along: 0.85 };
const TL = TRAIN_PATH.len, TST = TRAIN_STATIONS.map((s, i) => ({ ...s, i })).sort((a, b) => a.s - b.s);
const TLEG = TST.map((s, k) => { const d = mod(TST[(k + 1) % TST.length].s - s.s, TL) || TL; return { st: s.i, s: s.s + TRAIN.head, d, T: (d / TRAIN.vmax + TRAIN.vmax / TRAIN.acc) * 1000 }; });
TRAIN.lap = TLEG.reduce((a, l) => a + TRAIN.stop + l.T, 0);
// 기관차 앞머리: s = 선로 거리(바퀴마다 계속 늘어남), st = 서 있는 역 번호(TRAIN_STATIONS 순서, -1 = 달리는 중), left = 정차가 남은 ms, next = 다음 역 도착까지
export function trainState(t) {
  const n = Math.floor(t / TRAIN.lap);
  let u = mod(t, TRAIN.lap), s = TLEG[0].s + n * TL;
  for (const l of TLEG) {
    if (u < TRAIN.stop) return { s, st: l.st, left: TRAIN.stop - u, lap: n };
    u -= TRAIN.stop;
    if (u < l.T) return { s: s + trap(u, l.T, (TRAIN.vmax / TRAIN.acc) * 1000) * l.d, st: -1, left: 0, next: l.T - u, lap: n };
    u -= l.T; s += l.d;
  }
  return { s, st: TLEG[0].st, left: TRAIN.stop, lap: n + 1 }; // (반올림 오차로 끝에 닿은 경우)
}
// 차량 k(0 = 기관차, 1..4 = 객차) 가운데의 선로 거리
export const trainCarS = (head, k) => k ? head - TRAIN.loco - TRAIN.gap - TRAIN.car / 2 - (k - 1) * (TRAIN.car + TRAIN.gap) : head - TRAIN.loco / 2;
// 선로 위 점 + 부드러운 방향 (앞뒤 1.2m 를 이은 방향 → 꺾인 점에서도 옆 자리·방향이 튀지 않음)
export function trainAtSmooth(s) { const [x, z] = trainAt(s), a = trainAt(s - 1.2), b = trainAt(s + 1.2), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [x, z, (b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
const tSeatS = (head, seat) => trainCarS(head, 1 + Math.floor(seat / 4)) + (seat % 4 < 2 ? TRAIN.along : -TRAIN.along);
RIDES.train = {
  id: 'train', name: '꼬마기차', icon: '🚂', status: 'rideTrain', seats: TRAIN.cars * 4, reach: 6, sit: 'park', cam: { pitch: 0.25, dist: 10 },
  pose(seat, t) {
    const [x, z, tx, tz] = trainAtSmooth(tSeatS(trainState(t).s, seat)), o = (seat % 2 ? 1 : -1) * TRAIN.side;
    return { x: x - tz * o, y: TRAIN.seatY, z: z + tx * o, ry: Math.atan2(tx, tz) };
  },
  open(t) {
    const r = trainState(t);
    if (r.st >= 0 && r.left > 1500) return { seats: [...Array(16).keys()], left: r.left, st: r.st };
    return { wait: r.st >= 0 ? r.left : r.next, msg: '기차가 역에 서면 탈 수 있어요' };
  },
  board: (t) => ({ s0: trainState(t).s }),
  exitOk: (r, t) => trainState(t).st >= 0,
  due: (r, t) => { const s = trainState(t); return s.st >= 0 && s.s - r.s0 > TL - 1; }, // 한 바퀴 돌아 처음 역에 서면
  exit(seat, t) {
    const r = trainState(t), st = TRAIN_STATIONS[Math.max(0, r.st)], [x, z, tx, tz] = trainAtSmooth(tSeatS(r.s, seat));
    const al = Math.max(-5, Math.min(5, (x - st.x) * tx + (z - st.z) * tz)); // 승강장 길이 안으로
    return [st.x + tx * al + st.nx * 2.7, st.z + tz * al + st.nz * 2.7, Math.atan2(st.nx, st.nz)];
  },
};
// 역: 승강장(선로에서 1.2~4.4m, 걸어 다님) + 지붕 기둥(선로 반대쪽 두 개) + 정문역·기구역은 작은 매표칸(승강장 뒤)
export const TRAIN_HUTS = [{ st: 'gate', rect: [-263.6, -62.5, -258.8, -55.5] }, { st: 'rides', rect: [-521.6, 8.5, -519.2, 15.5] }];
for (const h of TRAIN_HUTS) RIDE_RECTS.push(h.rect);
export const TRAIN_POSTS = TRAIN_STATIONS.flatMap((s) => [-1, 1].map((k) => ({ x: s.x + s.nx * 4.6 - s.nz * k * 4.4, z: s.z + s.nz * 4.6 + s.nx * k * 4.4, r: 0.2 })));
for (const p of TRAIN_POSTS) RIDE_CIRCLES.push(p);

/* ═════════════ 2단계 (2026-11-04): 드롭타워·바이킹·회전그네·롤러코스터·후룸라이드 ═════════════
   모두 같은 회차 틀: 승차(멈춤, 탑승 창) → 운행 → 다음 회차 시작에 하차. 회차 끝엔 늘 처음 자리로 돌아옴(정수 바퀴) → exit 는 시각과 상관없이 처음 자리 옆 */
const G = 9.8, clamp01 = (x) => Math.max(0, Math.min(1, x)), smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const roundOf = (t, K) => ({ n: Math.floor(t / K.round), u: mod(t, K.round) }); // n = 회차, u = 회차 안 지난 ms
function stdRide(K, o) { // 승차 창(K.load 동안 멈춤) 규칙을 한 번에: open · board · exitOk · due
  return {
    open(t) { const { u } = roundOf(t, K); if (u < K.load - 1000) return { seats: [...Array(o.seats).keys()], left: K.load - u }; return { wait: K.round - u, msg: o.msg }; },
    board: (t) => ({ round: roundOf(t, K).n }),
    exitOk: (r, t) => roundOf(t, K).u < K.load, // 출발 전엔 다시 내릴 수 있음
    due: (r, t) => roundOf(t, K).n > r.round, // 다음 회차 시작 = 처음 자리에 멈춰 있음
    ...o,
  };
}

/* ───── ⑧ 드롭타워: 별 장식 둥근 탑(50m), 8자리 고리가 천천히 한 바퀴 돌며 올라가 꼭대기에서 4초 멈춘 뒤 슝 — 떨어짐(0.75g) → 자석 브레이크 → 살며시 내려앉음 ───── */
const DS = RIDE_SLOTS.drop;
export const DROP = { x: DS.x, z: DS.z, tower: DS.h, n: 8, R: 2.9, y0: 0.8, top: 40, brakeAt: 20, stopAt: 2.2, acc: 0.75 * G, load: 16000, up: 12000, hold: 4000, settle: 3000 };
DROP.fall = Math.sqrt((2 * (DROP.top - DROP.brakeAt)) / DROP.acc) * 1000; // 자유 낙하 ms
DROP.vmax = (DROP.acc * DROP.fall) / 1000; // 브레이크 직전 속도 (m/s)
DROP.dec = DROP.vmax ** 2 / (2 * (DROP.brakeAt - DROP.stopAt)); DROP.brake = (DROP.vmax / DROP.dec) * 1000;
DROP.round = DROP.load + DROP.up + DROP.hold + DROP.fall + DROP.brake + DROP.settle; // 약 39초
// 고리 상태: y = 앉는 면 높이, a = 고리가 돈 각, ph = 'load'|'up'|'hold'|'fall'|'brake'|'settle'
export function dropAt(t) {
  const D = DROP, { n, u } = roundOf(t, D), a0 = n * TAU;
  let k = u - D.load;
  if (k < 0) return { n, y: D.y0, a: a0, ph: 'load' };
  if (k < D.up) { const p = trap(k, D.up, 3500); return { n, y: D.y0 + (D.top - D.y0) * p, a: a0 + p * TAU, ph: 'up' }; }
  if ((k -= D.up) < D.hold) return { n, y: D.top, a: a0 + TAU, ph: 'hold' };
  if ((k -= D.hold) < D.fall) { const s = k / 1000; return { n, y: D.top - 0.5 * D.acc * s * s, a: a0 + TAU, ph: 'fall', v: D.acc * s }; }
  if ((k -= D.fall) < D.brake) { const s = k / 1000; return { n, y: D.brakeAt - D.vmax * s + 0.5 * D.dec * s * s, a: a0 + TAU, ph: 'brake', v: D.vmax - D.dec * s }; }
  k -= D.brake; return { n, y: D.stopAt + (D.y0 - D.stopAt) * trap(k, D.settle, 1200), a: a0 + TAU, ph: 'settle' };
}
const dropSeatA = (seat) => (seat * TAU) / DROP.n;
RIDES.drop = stdRide(DROP, {
  id: 'drop', name: '드롭타워', icon: '🌟', status: 'rideDrop', seats: DROP.n, reach: 4.5, sit: 'park', cam: { pitch: 0.5, dist: 11 }, msg: '고리가 내려와 멈추면 탈 수 있어요',
  pose(seat, t) { const d = dropAt(t), a = dropSeatA(seat) + d.a; return { x: DROP.x + DROP.R * Math.sin(a), y: d.y, z: DROP.z + DROP.R * Math.cos(a), ry: a }; }, // 바깥을 보고 앉음
  exit(seat) { const a = dropSeatA(seat), r = DROP.R + 1.6; return [DROP.x + r * Math.sin(a), DROP.z + r * Math.cos(a), a]; },
});
RIDE_CIRCLES.push({ x: DROP.x, z: DROP.z, r: 2.0 }); // 탑 기둥

/* ───── ④ 바이킹: 둥근 해적선(길이 15m, 동물 선수상)이 x 방향으로 그네처럼 흔들림. 축 높이 11m, 축 → 갑판 10m, 16자리(가운데를 보고 마주 앉음: 양쪽 절반 × 4줄 × 2)
   흔들림 θ = A(τ)·sin(2πτ/주기): 14초 동안 점점 크게(최대 54°) → 유지 → 12초 동안 잦아들어 멈춤 ───── */
const VS = RIDE_SLOTS.viking;
export const VIKING = { x: VS.x, z: VS.z, pivot: 11, arm: 10, load: 14000, run: 36000, period: 6400, amp: 0.95, up: 14000, down: 12000, rows: [1.4, 2.7, 4.0, 5.3], side: 0.75 };
VIKING.round = VIKING.load + VIKING.run; // 50초
export function vikingAt(t) {
  const V = VIKING, { n, u } = roundOf(t, V), k = u - V.load;
  if (k <= 0) return { n, th: 0, run: false };
  const A = V.amp * smooth(k / V.up) * smooth((V.run - k) / V.down);
  return { n, th: A * Math.sin((TAU * k) / V.period), run: true };
}
// 자리 → 배 안 위치 (축 기준 지역 좌표: lx 앞뒤, ly 높이, lz 옆) · 바라보는 쪽 (서쪽 절반은 동쪽을 봄 → 마주 앉음)
export function vikingSeat(seat) {
  const V = VIKING, half = seat < 8 ? -1 : 1, k = Math.floor((seat % 8) / 2);
  return { lx: half * V.rows[k], ly: -V.arm + 1.0 + 0.32 * k, lz: (seat % 2 ? 1 : -1) * V.side, ry: half < 0 ? PI / 2 : -PI / 2 };
}
RIDES.viking = stdRide(VIKING, {
  id: 'viking', name: '바이킹', icon: '🏴‍☠️', status: 'rideViking', seats: 16, reach: 5.5, sit: 'park', cam: { pitch: 0.12, dist: 22 }, msg: '배가 멈추면 탈 수 있어요',
  pose(seat, t) {
    const V = VIKING, s = vikingSeat(seat), th = vikingAt(t).th, c = Math.cos(th), sn = Math.sin(th);
    return { x: V.x + s.lx * c - s.ly * sn, y: V.pivot + s.lx * sn + s.ly * c, z: V.z + s.lz, ry: s.ry };
  },
  exit(seat) { const s = vikingSeat(seat); return [VIKING.x + Math.max(-4.5, Math.min(4.5, s.lx)), VIKING.z - 4.4, PI]; }, // 북쪽(입구 쪽) 승강장
});
RIDE_RECTS.push([VIKING.x - 13, VIKING.z - 2.4, VIKING.x + 13, VIKING.z + 2.4]); // 흔들리는 배 아래 (승강장 사이)
for (const sx of [-1, 1]) for (const sz of [-1, 1]) RIDE_CIRCLES.push({ x: VIKING.x + sx * 6.2, z: VIKING.z + sz * 4.3, r: 0.5 }); // A자 다리 발

/* ───── ⑦ 회전그네: 꽃 모양 지붕(테두리 반지름 6.5m)에 그네 24개가 사슬 6.4m 로 매달림. 돌면서 지붕이 2.5m 올라가고 그네는 바깥으로 기울어짐
   한 회차: 승차 15초 → 45초 동안 5바퀴(10초 가감속). 기울기 φ 는 빠르기로 정함(tanφ = ω²r/g, 바로 따라감) ───── */
const WS = RIDE_SLOTS.swing;
export const SWING = { x: WS.x, z: WS.z, n: 24, hang: 6.5, chain: 6.4, h0: 7.0, h1: 9.5, load: 15000, run: 45000, ramp: 10000, turns: 5, lift: 7000 };
SWING.round = SWING.load + SWING.run; // 60초
export function swingAt(t) {
  const S = SWING, { n, u } = roundOf(t, S), k = u - S.load, base = n * S.turns * TAU;
  if (k <= 0) return { n, a: base, w: 0, h: S.h0, phi: 0, run: false };
  const T = S.run, ta = S.ramp, v = 1 / (T - ta), rate = k < ta ? (v * k) / ta : k > T - ta ? (v * (T - k)) / ta : v; // trap 의 빠르기 (1/ms)
  const w = rate * 1000 * S.turns * TAU, h = S.h0 + (S.h1 - S.h0) * smooth(Math.min(k, T - k) / S.lift);
  let phi = 0; for (let i = 0; i < 4; i++) phi = Math.atan((w * w * (S.hang + S.chain * Math.sin(phi))) / G);
  return { n, a: base + trap(k, T, ta) * S.turns * TAU, w, h, phi, run: true };
}
export const swingSeatA = (seat) => (seat * TAU) / SWING.n;
RIDES.swing = stdRide(SWING, {
  id: 'swing', name: '회전그네', icon: '🌸', status: 'rideSwing', seats: SWING.n, reach: 4, sit: 'park', cam: { pitch: 0.22, dist: 10 }, msg: '그네가 멈추면 탈 수 있어요',
  pose(seat, t) {
    const S = SWING, s = swingAt(t), a = swingSeatA(seat) + s.a, r = S.hang + S.chain * Math.sin(s.phi);
    return { x: S.x + r * Math.sin(a), y: s.h - S.chain * Math.cos(s.phi), z: S.z + r * Math.cos(a), ry: Math.atan2(Math.cos(a), -Math.sin(a)) }; // 도는 방향을 봄
  },
  exit(seat) { const a = swingSeatA(seat), r = SWING.hang + 1.9; return [SWING.x + r * Math.sin(a), SWING.z + r * Math.cos(a), a]; },
});
RIDE_CIRCLES.push({ x: SWING.x, z: SWING.z, r: 1.5 }); // 가운데 탑

/* ───── 2단계 공용: 닫힌 3D 길 (롤러코스터 레일·후룸 물길) ─────
   평면: 출발점 + 조각 ['L', x, z](곧게) · ['A', cx, cz, r, a0, a1](호, 도 단위, x = cx + r·cos a, z = cz + r·sin a) → 0.5m 마다 뽑음
   높이: 평면 거리 기준 꺾은선 [[p, y], …] 를 win(m) 폭으로 고르게 → 실제 3D 거리 s 로 찾음. at(s) → [x, y, z, tx, ty, tz] (s 는 한 바퀴 넘어도 됨) */
function loopPath(start, parts, ys, win, step = 0.5) {
  const P = [start];
  for (const q of parts) {
    if (q[0] === 'L') { P.push([q[1], q[2]]); continue; }
    const [, cx, cz, r, a0, a1] = q, k = Math.ceil(Math.abs(a1 - a0) / 3);
    for (let i = 1; i <= k; i++) { const a = ((a0 + ((a1 - a0) * i) / k) * PI) / 180; P.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); }
  }
  P.push(start);
  const C = [0]; for (let i = 1; i < P.length; i++) C.push(C[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const LP = C.at(-1), N = Math.round(LP / step), h = LP / N, X = [], Z = [], Yr = [], PL = [];
  for (let i = 0, j = 0; i < N; i++) {
    const d = i * h; while (C[j + 1] < d) j++;
    const f = (d - C[j]) / (C[j + 1] - C[j] || 1); X.push(P[j][0] + (P[j + 1][0] - P[j][0]) * f); Z.push(P[j][1] + (P[j + 1][1] - P[j][1]) * f); PL.push(d);
    let k = 0; while (ys[k + 1][0] < d) k++; Yr.push(ys[k][1] + ((ys[k + 1][1] - ys[k][1]) * (d - ys[k][0])) / (ys[k + 1][0] - ys[k][0]));
  }
  const w = Math.max(1, Math.round(win / 2 / h)), Y = Yr.map((_, i) => { let a = 0; for (let k = -w; k <= w; k++) a += Yr[mod(i + k, N)]; return a / (2 * w + 1); }); // 둘레를 따라 고르게 (닫힌 길)
  const S = [0]; for (let i = 1; i <= N; i++) { const a = i - 1, b = i % N; S.push(S[a] + Math.hypot(X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a])); }
  const L = S[N], ds = L / N; // 3D 거리는 거의 고르게 퍼져 있음 → 가까운 칸에서 앞뒤로만 맞춤
  const idx = (s) => { s = mod(s, L); let i = Math.min(N - 1, Math.floor(s / ds)); while (i > 0 && S[i] > s) i--; while (i < N - 1 && S[i + 1] <= s) i++; return [i, (s - S[i]) / (S[i + 1] - S[i])]; };
  const pt = (i) => [X[mod(i, N)], Y[mod(i, N)], Z[mod(i, N)]];
  return {
    L, N, X, Y, Z, PL, LP,
    at(s) {
      const [i, f] = idx(s), a = pt(i), b = pt(i + 1), p = pt(i - 1), q = pt(i + 2);
      const t0 = [b[0] - p[0], b[1] - p[1], b[2] - p[2]], t1 = [q[0] - a[0], q[1] - a[1], q[2] - a[2]], t = t0.map((v, k) => v + (t1[k] - v) * f), l = Math.hypot(...t);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, t[0] / l, t[1] / l, t[2] / l];
    },
    sOfPlan: (p) => S[Math.min(N - 1, Math.max(0, Math.round(p / h)))], // 평면 거리 → 3D 거리
    near(x, z) { let b = Infinity, bi = 0; for (let i = 0; i < N; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < b) { b = d; bi = i; } } return { d: Math.sqrt(b), s: S[bi], y: Y[bi] }; }, // 시험·안내용 (느림)
  };
}
// 길 위를 한 바퀴 가는 시간표: s0 에서 a0 로 서서히 출발 → 빠르기 v(s, y) → s0 + L 에 a1 로 서서히 섬. → { T(ms), at(ms) → 간 거리 0..L }
function runTable(path, v, s0, a0, a1, ds = 0.25) {
  const n = Math.ceil(path.L / ds), h = path.L / n, T = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const d = (i + 0.5) * h, s = mod(s0 + d, path.L); T[i + 1] = T[i] + (h / Math.max(0.05, Math.min(v(s, path.at(s)[1]), Math.sqrt(2 * a0 * d), Math.sqrt(2 * a1 * (path.L - d))))) * 1000; }
  return { T: T[n], at(ms) { if (ms <= 0) return 0; if (ms >= T[n]) return path.L; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= ms) lo = m; else hi = m; } return (lo + (ms - T[lo]) / (T[lo + 1] - T[lo])) * h; } };
}
function onPath(path, s, side, up) { const [x, y, z, tx, , tz] = path.at(s), l = Math.hypot(tx, tz) || 1; return { x: x - (tz / l) * side, y: y + up, z: z + (tx / l) * side, ry: Math.atan2(tx, tz) }; } // 길 위 자리 (옆으로 side, 위로 up)

/* ───── ③ 롤러코스터: 민트 레일, 통통한 기차 4량 × 4자리. 역(슬롯 북쪽, 입구 옆)에서 서쪽으로 출발 → 북쪽 체인 오르막(가로 순환길 위를 지남)
   → 꼭대기 17.5m 에서 왼쪽으로 돌며 → 슬롯 밖 북쪽 풀밭(매점·드롭타워 사이) 위를 서쪽으로 내리꽂음 → 다시 순환길 위를 넘어 남쪽 → 슬롯 남쪽 낙타 등 2개 → 동쪽에서 돌아 역 브레이크
   빠르기: 꼭대기까지 2.5m/s(사슬), 꼭대기부터는 에너지(높이) − 마찰, 마지막 브레이크 3m/s². 한 회차 = 승차 20초 + 운행 ───── */
export const COASTER_PATH = loopPath([-437, 44], [
  ['L', -441, 44], ['A', -441, 38, 6, 90, 180], ['L', -447, 13], ['A', -456, 13, 9, 0, -90], ['L', -505, 4], ['A', -505, 12, 8, -90, -180],
  ['L', -513, 66], ['A', -501, 66, 12, 180, 90], ['L', -424, 78], ['A', -424, 66, 12, 90, 0], ['L', -412, 54], ['A', -422, 54, 10, 0, -90],
], [[0, 0.6], [5, 0.6], [13.4, 2], [38.4, 16], [45, 17.5], [50, 17.5], [55, 16], [74, 3], [80, 2.6], [101.6, 9.5], [114, 10.5], [125, 10], [140, 9], [160, 3], [170, 2],
  [187, 2], [205, 6.5], [225, 2.2], [245, 5.5], [264, 2], [283, 1.6], [300, 0.8], [312, 0.6], [400, 0.6]], 6);
export const COASTER = { cars: 4, car: 2.7, along: 0.55, side: 0.42, seatY: 0.75, load: 20000, lift: 2.5, drag: 0.015, a0: 1.0, a1: 3.0 };
{ const P = COASTER_PATH; let ci = 0; for (let i = 0; i < P.N; i++) if (P.Y[i] > P.Y[ci]) ci = i; // 꼭대기 = 가장 높은 점
  COASTER.sTop = P.sOfPlan(P.PL[ci]); COASTER.yTop = P.Y[ci]; }
COASTER.table = runTable(COASTER_PATH, (s, y) => (s < COASTER.sTop ? COASTER.lift : Math.sqrt(Math.max(4, COASTER.lift ** 2 + 2 * G * (COASTER.yTop - y) - 2 * G * COASTER.drag * (s - COASTER.sTop)))), 0, COASTER.a0, COASTER.a1);
COASTER.round = COASTER.load + COASTER.table.T + 500;
// 기차 앞머리 거리 s (회차마다 L 씩 늘어남), run = 달리는 중
export function coasterAt(t) { const C = COASTER, { n, u } = roundOf(t, C); return { n, s: n * COASTER_PATH.L + C.table.at(u - C.load), run: u > C.load && u < C.load + C.table.T }; }
export const coasterCarS = (head, c) => head - 1.35 - c * COASTER.car; // 차량 c 가운데
const cSeatS = (head, seat) => coasterCarS(head, Math.floor(seat / 4)) + (seat % 4 < 2 ? COASTER.along : -COASTER.along);
RIDES.coaster = stdRide(COASTER, {
  id: 'coaster', name: '롤러코스터', icon: '🎢', status: 'rideCoaster', seats: COASTER.cars * 4, reach: 5, sit: 'park', cam: { pitch: 0.16, dist: 7.5 }, msg: '기차가 역에 들어와 멈추면 탈 수 있어요',
  pose: (seat, t) => onPath(COASTER_PATH, cSeatS(coasterAt(t).s, seat), (seat % 2 ? 1 : -1) * COASTER.side, COASTER.seatY),
  exit(seat) { const q = onPath(COASTER_PATH, cSeatS(0, seat), 0, 0); return [q.x, 40.6, PI]; }, // 역 북쪽 승강장 (입구 쪽)
});
// 기둥: 레일이 2.2m 넘는 곳 7m 마다, 길·가로등·매점·선로 옆은 비움 → 작은 충돌 원
export const COASTER_POSTS = [];
{ const P = COASTER_PATH;
  for (let s = 3; s < P.L; s += 7) {
    const [x, y, z] = P.at(s);
    if (y < 2.2 || parkPathNear(x, z).d < 1.6 || trainNear(x, z).d < 3 || PARK_LAMPS.some((l) => Math.hypot(l.x - x, l.z - z) < 2) || PARK_SHOPS.some((b) => Math.abs(x - b.x) < b.w / 2 + 1.5 && Math.abs(z - b.z) < b.d / 2 + 1.5)) continue;
    COASTER_POSTS.push({ x, z, h: y - 0.55 }); RIDE_CIRCLES.push({ x, z, r: 0.35 });
  } }

/* ───── ⑨ 후룸라이드: 통나무 배 3척 × 6자리, 물길: 나루에서 서쪽 → 동굴 → 작은 폭포 옆 → 남쪽 → 동쪽 오르막(8.6m) → 북쪽 경사로 낙하(풍덩) → 나루
   배는 물길 거리로만 움직임(물살 3m/s, 오르막 1.8, 위 2.0, 낙하는 에너지, 낙하 뒤 물에서 잦아듦). 회차마다 3척이 4초 간격으로 차례로 떠나 제자리로 돌아옴 ───── */
export const FLUME_PATH = loopPath([-368, 41], [
  ['L', -375, 41], ['A', -375, 50, 9, -90, -180], ['L', -384, 72], ['A', -376, 72, 8, 180, 90], ['L', -352, 80], ['L', -334, 80],
  ['A', -334, 72, 8, 90, 0], ['L', -326, 64], ['L', -326, 51], ['L', -326, 49], ['A', -334, 49, 8, 0, -90],
], [[0, 0.4], [79.7, 0.4], [97.7, 8.6], [118.3, 8.6], [131.3, 0.4], [400, 0.4]], 3);
export const FLUME = { boats: 3, per: 6, len: 4.6, space: 5.6, side: 0.42, rows: [-0.9, -2.15, -3.4], seatY: 0.42, load: 13000, gap: 3500, water: 3.4, lift: 1.8, topV: 2.0, a0: 0.5, a1: 0.8, hw: 1.3, yTop: 8.6 };
Object.assign(FLUME, { sLift0: FLUME_PATH.sOfPlan(79.7), sLift1: FLUME_PATH.sOfPlan(97.7), sDrop0: FLUME_PATH.sOfPlan(118.3), sDrop1: FLUME_PATH.sOfPlan(131.3) });
FLUME.vb = Math.sqrt(FLUME.topV ** 2 + 2 * G * 0.9 * (FLUME.yTop - 0.4)); // 낙하 끝 빠르기
function flumeV(s, y) {
  const F = FLUME;
  if (s >= F.sLift0 && s < F.sLift1) return F.lift;
  if (s >= F.sLift1 && s < F.sDrop0) return F.topV;
  if (s >= F.sDrop0 && s < F.sDrop1) return Math.sqrt(F.topV ** 2 + 2 * G * 0.9 * Math.max(0, F.yTop - y));
  if (s >= F.sDrop1 && s < F.sDrop1 + 40) return F.water + (F.vb - F.water) * Math.exp(-(s - F.sDrop1) / 5); // 물에 잦아듦
  return F.water;
}
FLUME.tables = [...Array(FLUME.boats).keys()].map((k) => runTable(FLUME_PATH, flumeV, mod(-k * FLUME.space, FLUME_PATH.L), FLUME.a0, FLUME.a1));
FLUME.round = FLUME.load + Math.max(...FLUME.tables.map((tb, k) => k * FLUME.gap + tb.T)) + 1000;
// 배 k 앞머리 거리 (회차 끝엔 제자리), run = 떠 가는 중
export function flumeBoat(k, t) { const F = FLUME, { n, u } = roundOf(t, F), tb = F.tables[k], e = u - F.load - k * F.gap; return { n, s: n * FLUME_PATH.L - k * F.space + tb.at(e), run: e > 0 && e < tb.T }; }
const fSeat = (seat) => ({ k: Math.floor(seat / FLUME.per), row: Math.floor((seat % FLUME.per) / 2), side: seat % 2 ? 1 : -1 });
RIDES.flume = stdRide(FLUME, {
  id: 'flume', name: '후룸라이드', icon: '🪵', status: 'rideFlume', seats: FLUME.boats * FLUME.per, reach: 5, sit: 'park', cam: { pitch: 0.2, dist: 8 }, msg: '배가 모두 돌아와 멈추면 탈 수 있어요',
  pose(seat, t) { const q = fSeat(seat); return onPath(FLUME_PATH, flumeBoat(q.k, t).s + FLUME.rows[q.row], q.side * FLUME.side, FLUME.seatY); },
  exit(seat) { const q = fSeat(seat), p = onPath(FLUME_PATH, -q.k * FLUME.space + FLUME.rows[q.row], 0, 0); return [p.x, 37.6, PI]; }, // 북쪽 나루 (입구 쪽)
});
// 동굴 양옆 바위 · 오르막/낙하 받침 기둥 (물길 자체는 걸어서 건넘 — 충돌 최소)
export const FLUME_CAVE = { x: -384, z: 60, len: 12, r: 3.4 };
RIDE_CIRCLES.push({ x: FLUME_CAVE.x - 4.6, z: FLUME_CAVE.z, r: 1.4 }, { x: FLUME_CAVE.x + 4.6, z: FLUME_CAVE.z, r: 1.4 });
export const FLUME_POSTS = [];
{ const P = FLUME_PATH; for (let s = FLUME.sLift0 + 4; s < FLUME.sDrop1 - 1; s += 4.5) { const [x, y, z, tx, , tz] = P.at(s), l = Math.hypot(tx, tz); if (y < 2) continue; for (const o of [-1.7, 1.7]) { const px = x - (tz / l) * o, pz = z + (tx / l) * o; FLUME_POSTS.push({ x: px, z: pz, h: y - 0.3 }); RIDE_CIRCLES.push({ x: px, z: pz, r: 0.3 }); } } }

/* ═════════════ 2단계 B (2026-11-04): 범퍼카·회전 찻잔 — 탄 사람이 직접 조작 ═════════════
   둘 다 기구 전체의 상태 sim 을 가짐: init() → sim, pose(seat, t, sim), input(rider, m, t, sim) → 방송할 값(없으면 null), snap(sim)·load(sim, 값) (늦게 들어온 사람용)
   범퍼카는 위치가 입력에 따라 달라져 시간만으로 안 정해짐 → 서버 tick 이 step(sim, t, 탄 사람들) 로 2D 물리를 계산해 가까운 사람에게 20Hz 방송, 화면은 같은 bumperStep 으로 내 차를 예측
   찻잔은 빠르기가 바뀔 때만 상태가 바뀜 → 시각만으로 이어 계산 (angle = a0 + w·(G(t) − G(t0)), G = 운행 시간 누적). sim 이 없으면(시험·처음 그릴 때) 제자리·속도 0 */
const BS = RIDE_SLOTS.bumper;
// 범퍼카 경기장: 건물 hall(바깥 벽) 안 북쪽은 대기 줄(로비, z 36.6..42.4), 남쪽은 차가 다니는 바닥 box (고무 테두리 안쪽). 사람은 로비까지만 걸어 들어옴(바닥은 늘 충돌 → 차에 치일 일 없음)
export const BUMPER = { x: BS.x, n: 10, r: 1.0, seatY: 0.62, load: 20000, run: 70000, ret: 6000, hall: [BS.x - 21, 36, BS.x + 21, 66], lobby: [BS.x - 20.4, 36.6, BS.x + 20.4, 42.4], box: [BS.x - 18.6, 43.6, BS.x + 18.6, 64.6], zc: 54, door: 4,
  acc: 3.4, brake: 7, drag: 1.1, vmax: 4.6, vrev: 2.2, turn: 2.1, grip: 5.5, e: 0.7, hear: 110 };
BUMPER.round = BUMPER.load + BUMPER.run + BUMPER.ret; // 96초: 승차 20 → 운행 70 → 제자리로 6
export const bumperHome = (i) => ({ x: BS.x + (i - (BUMPER.n - 1) / 2) * 2.4, z: BUMPER.box[1] + 1.3, a: 0 }); // 로비 앞 한 줄, 남쪽(바닥 안)을 봄
export function bumperAt(t) { const B = BUMPER, { n, u } = roundOf(t, B); return { n, u, ph: u < B.load ? 'load' : u < B.load + B.run ? 'run' : 'ret' }; }
const wrapA = (a) => mod(a + PI, TAU) - PI;
/* 2D 물리 한 걸음 (서버·화면이 같이 씀, 시계·난수 안 씀 → 같은 입력이면 같은 결과). cars[i] = { x, z, a(바라보는 쪽, 앞 = (sin a, cos a)), vx, vz, u(가속 -1..1), s(오른쪽 조향 -1..1) } 를 그 자리에서 고침
   앞뒤 빠르기는 가속·브레이크·끌림, 옆 미끄럼은 grip 으로 잦아듦(부딪혀 옆으로 밀려도 곧 섬), 최고 속도 상한, 벽은 반사(e), 차끼리는 원(r) 충돌 → 겹침을 밀어내고 맞닿는 쪽 빠르기를 주고받음
   → 부딪힘 목록 [[i, j(-1 = 벽), 세기 m/s]] */
export function bumperStep(cars, dt, B = BUMPER) {
  const bumps = [], [x0, z0, x1, z1] = B.box, r = B.r, N = Math.max(1, Math.ceil(dt / 0.025)), h = dt / N;
  const cap = (c) => { const sp = Math.hypot(c.vx, c.vz); if (sp > B.vmax) { c.vx *= B.vmax / sp; c.vz *= B.vmax / sp; } }; // 부딪혀 밀려도 최고 속도 넘지 않게
  const wall = (c, i, hit) => {
    if (c.x < x0 + r) { c.x = x0 + r; if (c.vx < 0) { if (hit && c.vx < -1) bumps.push([i, -1, -c.vx]); c.vx *= -B.e; } } else if (c.x > x1 - r) { c.x = x1 - r; if (c.vx > 0) { if (hit && c.vx > 1) bumps.push([i, -1, c.vx]); c.vx *= -B.e; } }
    if (c.z < z0 + r) { c.z = z0 + r; if (c.vz < 0) { if (hit && c.vz < -1) bumps.push([i, -1, -c.vz]); c.vz *= -B.e; } } else if (c.z > z1 - r) { c.z = z1 - r; if (c.vz > 0) { if (hit && c.vz > 1) bumps.push([i, -1, c.vz]); c.vz *= -B.e; } }
  };
  for (let k = 0; k < N; k++) {
    cars.forEach((c, i) => {
      const u = Math.max(-1, Math.min(1, c.u || 0)), s = Math.max(-1, Math.min(1, c.s || 0));
      let hx = Math.sin(c.a), hz = Math.cos(c.a), f = c.vx * hx + c.vz * hz, l = c.vx * hz - c.vz * hx; // 앞뒤 · 옆 빠르기
      if (u * f < -0.05) f += u * B.brake * h; else if (u) f += u * B.acc * h; else f *= Math.exp(-B.drag * h); // 반대로 밀면 브레이크
      f = Math.max(-B.vrev, Math.min(B.vmax, f)); l *= Math.exp(-B.grip * h);
      c.a = wrapA(c.a - s * B.turn * h * (f < -0.2 ? -1 : 1)); hx = Math.sin(c.a); hz = Math.cos(c.a); // 뒤로 갈 땐 핸들 반대 (자동차처럼)
      c.vx = f * hx + l * hz; c.vz = f * hz - l * hx;
      cap(c); c.x += c.vx * h; c.z += c.vz * h; wall(c, i, true);
    });
    for (let it = 0; it < 3; it++) { // 차끼리: 여러 대가 엉켜도 겹침이 풀리게 세 번 (빠르기 주고받기는 처음 한 번만)
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 >= 4 * r * r) continue;
        const d = Math.sqrt(d2), nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0, push = (2 * r - d) / 2 + 1e-4;
        a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
        const vr = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (it === 0 && vr > 0) { const J = ((1 + B.e) * vr) / 2; a.vx -= J * nx; a.vz -= J * nz; b.vx += J * nx; b.vz += J * nz; cap(a); cap(b); if (vr > 0.6) bumps.push([i, j, vr]); }
      }
      cars.forEach((c, i) => wall(c, i, false));
    }
  }
  return bumps;
}
// 방송용으로 줄이기: 차마다 [x−가운데, z−가운데, a, vx, vz] × 100 정수 (차 10대 ≈ 300바이트)
export const bumperPack = (cars) => cars.flatMap((c) => [Math.round((c.x - BUMPER.x) * 100), Math.round((c.z - BUMPER.zc) * 100), Math.round(wrapA(c.a) * 100), Math.round(c.vx * 100), Math.round(c.vz * 100)]);
export function bumperUnpack(a, cars) { for (let i = 0; i < cars.length && i * 5 + 4 < a.length; i++) Object.assign(cars[i], { x: BUMPER.x + a[i * 5] / 100, z: BUMPER.zc + a[i * 5 + 1] / 100, a: a[i * 5 + 2] / 100, vx: a[i * 5 + 3] / 100, vz: a[i * 5 + 4] / 100 }); return cars; }
RIDES.bumper = stdRide(BUMPER, {
  id: 'bumper', name: '범퍼카', icon: '🚗', status: 'rideBumper', seats: BUMPER.n, reach: 5, sit: 'park', cam: { pitch: 0.4, dist: 7.5 }, msg: '차가 제자리에 모이면 탈 수 있어요', x: BUMPER.x, z: BUMPER.zc, hear: BUMPER.hear,
  init: () => ({ n: -1, t: 0, cars: [...Array(BUMPER.n).keys()].map((i) => ({ ...bumperHome(i), vx: 0, vz: 0, u: 0, s: 0 })) }),
  pose(seat, t, sim) { const c = sim?.cars[seat] ?? bumperHome(seat); return { x: c.x, y: BUMPER.seatY, z: c.z, ry: c.a }; },
  // 조작 { u: 가속(-1..1, ↑ 앞 ↓ 뒤), s: 조향(-1..1, 오른쪽 +) } → rider.st (1.5초 동안 새 입력이 없으면 손을 뗀 것으로)
  input(r, m, t) { const q = (v) => (Number.isFinite(v) ? Math.round(Math.max(-1, Math.min(1, v)) * 4) / 4 : 0); r.st = { u: q(m.u), s: q(m.s), at: t }; return null; },
  // 서버 tick (20Hz): 운행 중엔 물리, 끝나면 6초 동안 제자리로 미끄러져 돌아감, 승차 중엔 멈춤 → 움직이는 동안만 { c: 줄인 상태, b: 부딪힘 } 을 돌려줌 (서버가 가까운 사람에게 방송)
  step(sim, t, riders) {
    const B = BUMPER, st = bumperAt(t), dt = Math.min(0.1, Math.max(0, (t - (sim.t || t)) / 1000)); sim.t = t;
    if (st.n !== sim.n) { sim.n = st.n; sim.cars.forEach((c, i) => Object.assign(c, bumperHome(i), { vx: 0, vz: 0, u: 0, s: 0 })); return { c: bumperPack(sim.cars), b: [] }; } // 새 회차: 제자리 (보통 이미 돌아와 있음)
    if (st.ph === 'load') return null;
    let bumps = [];
    if (st.ph === 'run') {
      if (!riders.length && sim.cars.every((c) => Math.abs(c.vx) + Math.abs(c.vz) < 0.01)) return null; // 아무도 안 타고 다 멈춰 있으면 방송 안 함
      for (const c of sim.cars) c.u = c.s = 0;
      for (const r of riders) if (r.st && t - r.st.at < 1500) Object.assign(sim.cars[r.seat], { u: r.st.u, s: r.st.s });
      bumps = bumperStep(sim.cars, dt);
    } else { // 제자리로: 남은 시간에 맞춰 곧장 미끄러짐 (부딪힘 없음)
      const k = Math.min(1, dt / Math.max(0.05, (B.round - st.u) / 1000));
      sim.cars.forEach((c, i) => { const h = bumperHome(i); c.x += (h.x - c.x) * k; c.z += (h.z - c.z) * k; c.a = wrapA(c.a + wrapA(h.a - c.a) * k); c.vx = c.vz = c.u = c.s = 0; });
    }
    return { c: bumperPack(sim.cars), b: bumps.filter((q) => q[1] >= 0 || q[2] > 2).map(([i, j]) => [i, j]) };
  },
  snap: (sim) => ({ c: bumperPack(sim.cars) }),
  load(sim, o) { if (o?.c) bumperUnpack(o.c, sim.cars); },
  exit(seat) { return [bumperHome(seat).x, 40.6, PI]; }, // 로비 (자기 차 바로 앞), 문(북쪽)을 봄
});
{ const [hx0, hz0, hx1, hz1] = BUMPER.hall, B = BUMPER, W = 0.6;
  RIDE_RECTS.push([hx0, B.lobby[3] + 0.2, hx1, hz1]); // 차 바닥 + 테두리 + 남·동·서 벽 (사람은 못 들어감)
  RIDE_RECTS.push([hx0, hz0, hx0 + W, B.lobby[3] + 0.2], [hx1 - W, hz0, hx1, B.lobby[3] + 0.2]); // 로비 양옆 벽
  RIDE_RECTS.push([hx0, hz0, B.x - B.door, hz0 + W], [B.x + B.door, hz0, hx1, hz0 + W]); } // 북쪽 벽 (가운데 문 8m)

/* ───── ⑥ 회전 찻잔: 가운데 거대 찻주전자, 회전판(반지름 12.5) 위 찻잔 8개 × 4자리. 회전판은 회차마다 3바퀴(8초 가감속), 찻잔은 탄 사람이 빠르기를 0~5칸 조절
   찻잔 c 의 가운데 = 회전판 각 + c·45°, 찻잔이 돈 각 ψ (회전판 기준) = a0 + w·(G(t) − G(t0)). G = 운행 시간을 사다리꼴(가감속)로 누적한 초 → 승차 중엔 멈추고 운행 끝에 살며시 멈춤
   회차가 바뀌면 그 찻잔은 지난 회차 끝 각도에 멈춰 있고 빠르기 0 부터 (서버가 따로 지우지 않아도 됨) ───── */
const TS = RIDE_SLOTS.teacups;
export const TEACUPS = { x: TS.x, z: TS.z, n: 8, per: 4, ring: 9.6, plat: 12.5, cupR: 1.45, seatR: 0.8, seatY: 0.95, deck: 0.45, load: 15000, run: 72000, ramp: 8000, turns: 3, step: 0.85, max: 5, gap: 350 };
TEACUPS.round = TEACUPS.load + TEACUPS.run; // 87초
TEACUPS.E = (TEACUPS.run - TEACUPS.ramp) / 1000; // 한 회차의 G (초)
export const teacupsG = (t) => { const K = TEACUPS, { n, u } = roundOf(t, K); return (n + trap(u - K.load, K.run, K.ramp)) * K.E; };
// 회전판 상태: a = 돈 각(rad, 회차마다 3바퀴씩 늘어남), run = 도는 중
export function teacupsAt(t) { const K = TEACUPS, { n, u } = roundOf(t, K), p = trap(u - K.load, K.run, K.ramp); return { n, a: (n + p) * K.turns * TAU, run: u > K.load && u < K.round, p }; }
export function cupSpin(cup, t) { // 찻잔이 돈 각 ψ (회전판 기준). 빠르기를 바꾼 회차가 끝나면 그 끝에 멈춤
  if (!cup || !cup.w) return cup?.a0 || 0;
  const n0 = Math.floor(cup.t0 / TEACUPS.round), te = Math.min(t, (n0 + 1) * TEACUPS.round);
  return cup.a0 + cup.w * (teacupsG(te) - teacupsG(cup.t0));
}
export const cupLevel = (cup, t) => (cup && Math.floor(cup.t0 / TEACUPS.round) === Math.floor(t / TEACUPS.round) ? cup.lvl : 0); // 지금 회차의 빠르기 칸 (회차가 바뀌면 0)
export const cupHome = (c) => (c * TAU) / TEACUPS.n; // 찻잔 c 의 회전판 위 각
RIDES.teacups = stdRide(TEACUPS, {
  id: 'teacups', name: '회전 찻잔', icon: '☕', status: 'rideTeacups', seats: TEACUPS.n * TEACUPS.per, reach: 5.5, sit: 'park', cam: { pitch: 0.34, dist: 9 }, msg: '찻잔이 멈추면 탈 수 있어요',
  init: () => ({ cups: [...Array(TEACUPS.n)].map(() => ({ a0: 0, w: 0, lvl: 0, t0: 0, at: 0 })) }),
  pose(seat, t, sim) {
    const K = TEACUPS, c = Math.floor(seat / K.per), ph = cupHome(c) + teacupsAt(t).a, cx = K.x + K.ring * Math.sin(ph), cz = K.z + K.ring * Math.cos(ph);
    const th = ph + cupSpin(sim?.cups[c], t) + ((seat % K.per) * TAU) / K.per;
    return { x: cx + K.seatR * Math.sin(th), y: K.seatY, z: cz + K.seatR * Math.cos(th), ry: th + PI }; // 찻잔 가운데 손잡이를 보고 앉음
  },
  // 조작 { d: +1 빠르게 / -1 느리게 } → 찻잔 하나에 한 칸씩 (0.35초에 한 번, 0~5칸, 운행 중만). 같은 찻잔 친구들이 같이 조절
  input(r, m, t, sim) {
    const K = TEACUPS, c = Math.floor(r.seat / K.per), cup = sim.cups[c];
    if ((m.d !== 1 && m.d !== -1) || !teacupsAt(t).run || t - cup.at < K.gap) return null;
    const lvl = Math.max(0, Math.min(K.max, cupLevel(cup, t) + m.d));
    if (lvl === cupLevel(cup, t)) return null;
    Object.assign(cup, { a0: cupSpin(cup, t), w: lvl * K.step, lvl, t0: t, at: t });
    return { c, a0: cup.a0, w: cup.w, lvl, t0: t };
  },
  snap: (sim) => ({ cups: sim.cups.map((q) => [q.a0, q.w, q.lvl, q.t0]) }),
  load(sim, o) { o?.cups?.forEach(([a0, w, lvl, t0], i) => sim.cups[i] && Object.assign(sim.cups[i], { a0, w, lvl, t0 })); },
  exit(seat) { const a = cupHome(Math.floor(seat / TEACUPS.per)), r = TEACUPS.plat + 1.2; return [TEACUPS.x + r * Math.sin(a), TEACUPS.z + r * Math.cos(a), a]; }, // 회차 끝 = 처음 자리 (정수 바퀴)
});
RIDE_CIRCLES.push({ x: TEACUPS.x, z: TEACUPS.z, r: TEACUPS.plat + 0.3 });

// 공용: 이름표 상태 · 좌석 위치 함수
for (const R of Object.values(RIDES)) RIDE_STATUS[R.status] = [R.icon, `${R.name} 타는 중`];
export const seatPose = (id, seat, t, sim) => RIDES[id].pose(seat, t, sim);
