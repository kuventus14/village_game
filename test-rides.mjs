// 놀이기구 시험 (가짜 시계): 시간 함수(회차·승차창·연속성·속도 상한·곤돌라 중력 방향·기차가 선로 위·역 정차 시간)와
// 서버 규칙(거리·승차창·자리 배정·같은 곤돌라·가득 참·중복/연타·하차·회차 끝·연결 끊김·기차 한 바퀴·공원 밖 거절·입력 훅)
import assert from 'node:assert/strict';
import * as W from './public/world.js';
import { createRidesServer, GAP } from './rides.js';

const { RIDES, FERRIS, CAROUSEL, TRAIN, TRAIN_PATH, TRAIN_STATIONS, ferrisAt, gondolaAt, carouselAt, trainState, trainNear, seatPose, trap, RIDE_SLOTS, RIDE_CIRCLES, RIDE_RECTS, STATUS } = W;
const { DROP, VIKING, SWING, COASTER, COASTER_PATH, FLUME, FLUME_PATH, dropAt, vikingAt, swingAt, coasterAt, flumeBoat } = W;
const { BUMPER, TEACUPS, bumperStep, bumperHome, bumperAt, bumperPack, bumperUnpack, teacupsAt, cupSpin, cupLevel } = W;
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; if (process.env.V) console.log(" ✓", m); }; // V=1 이면 확인 내용을 찍음

// ── 1. 등록부: 1단계 3종 + 2단계 A 5종 + 2단계 B 2종(범퍼카·회전 찻잔) = 10종 모두, 상태 이름표, 충돌은 채워짐
assert.deepEqual(Object.keys(RIDES).sort(), ['bumper', 'carousel', 'coaster', 'drop', 'ferris', 'flume', 'swing', 'teacups', 'train', 'viking']); n++;
for (const R of Object.values(RIDES)) ok(RIDE_SLOTS[R.id] && STATUS[R.status] && R.seats > 0 && typeof R.pose === 'function', `${R.name} 약속`);
ok(RIDE_CIRCLES.length >= 6 && RIDE_RECTS.length >= 2, '충돌 채움');
ok(trap(0, 10, 2) === 0 && trap(10, 10, 2) === 1 && Math.abs(trap(5, 10, 2) - 0.5) < 1e-12, 'trap 끝·가운데');

// ── 2. 시간: 회차 길이·승차창
ok(FERRIS.round > 80e3 && FERRIS.round < 110e3, `대관람차 한 바퀴 ${FERRIS.round / 1000}초`);
ok(CAROUSEL.run >= 50e3 && CAROUSEL.run <= 70e3, `회전목마 운행 ${CAROUSEL.run / 1000}초`);
ok(TRAIN.lap > 100e3 && TRAIN.lap < 170e3, `꼬마기차 한 바퀴 ${(TRAIN.lap / 1000).toFixed(0)}초`);
const T0 = 1_800_000_000_000; // 아무 큰 시각 (실제 서버 시계 크기)
{ const r0 = Math.ceil(T0 / FERRIS.round) * FERRIS.round; // 회차 시작
  ok(ferrisAt(r0 + 10).g === 0 && ferrisAt(r0 + FERRIS.stop + 100).g === -1 && ferrisAt(r0 + FERRIS.stop + FERRIS.step + 100).g === 1, '대관람차: 곤돌라 0 → 이동 → 1');
  ok(RIDES.ferris.open(r0 + 10).seats?.join() === '0,1,2,3' && !RIDES.ferris.open(r0 + FERRIS.stop + 100).seats && !RIDES.ferris.open(r0 + 40e3).seats, '대관람차 승차창: 정지 중에만');
  ok(Math.abs((ferrisAt(r0 + FERRIS.round).w - ferrisAt(r0).w) - 2 * Math.PI) < 1e-6, '한 회차 = 한 바퀴'); }
{ const r0 = Math.ceil(T0 / CAROUSEL.round) * CAROUSEL.round;
  ok(RIDES.carousel.open(r0 + 100).seats?.length === 24 && !RIDES.carousel.open(r0 + CAROUSEL.load + 100).seats, '회전목마 승차창: 멈춰 있을 때만');
  ok(!carouselAt(r0 + 5).run && carouselAt(r0 + CAROUSEL.load + 30e3).run, '회전목마 승차 → 운행'); }

// ── 3. 연속성 (점프 없음) · 속도 상한 · 곤돌라 중력 방향 · 기차는 선로 위
const LIM = { ferris: 3.2, carousel: 3.0, train: 12.6, drop: 17.6, viking: 11, swing: 11, coaster: 18.5, flume: 13.5, bumper: 0.01, teacups: 3.2 }, DT = 50; // 범퍼카·찻잔은 sim 없이 = 제자리·찻잔 안 돎 (조작한 경우는 아래 6)
for (const R of Object.values(RIDES)) {
  const span = { ferris: FERRIS.round, carousel: CAROUSEL.round, train: TRAIN.lap, drop: DROP.round, viking: VIKING.round, swing: SWING.round, coaster: COASTER.round, flume: FLUME.round, bumper: BUMPER.round, teacups: TEACUPS.round }[R.id] * 2.2, seats = [0, 1, 5, R.seats - 1];
  let vmax = 0, gondola = 0, track = 0, yMin = Infinity;
  for (const s of seats) {
    let prev = null;
    for (let t = T0; t < T0 + span; t += DT) {
      const q = seatPose(R.id, s, t);
      assert.ok([q.x, q.y, q.z, q.ry].every(Number.isFinite), `${R.id} ${s} 숫자`);
      if (prev) vmax = Math.max(vmax, Math.hypot(q.x - prev.x, q.y - prev.y, q.z - prev.z) / (DT / 1000));
      if (R.id === 'ferris') { const [gx, gy, gz] = gondolaAt(Math.floor(s / 4), ferrisAt(t).w), [dx, dz] = W.GONDOLA_SEATS[s % 4]; gondola = Math.max(gondola, Math.abs(q.x - gx - dx), Math.abs(gy - q.y - FERRIS.drop), Math.abs(q.z - gz - dz)); }
      if (R.id === 'train') track = Math.max(track, Math.abs(trainNear(q.x, q.z).d - TRAIN.side));
      yMin = Math.min(yMin, q.y); prev = q;
    }
  }
  ok(vmax <= LIM[R.id], `${R.name} 속도 상한 ${vmax.toFixed(2)} ≤ ${LIM[R.id]} m/s (회차 경계 포함, 점프 없음)`);
  ok(yMin > 0.3, `${R.name} 자리가 땅 위 (${yMin.toFixed(2)}m)`);
  if (R.id === 'ferris') ok(gondola < 1e-6, '곤돌라는 늘 매단 점 바로 아래 (중력 방향 유지)');
  if (R.id === 'train') ok(track < 0.05, `기차 자리는 선로 위 (어긋남 ${track.toFixed(3)}m)`);
}
{ let top = 0; for (let t = T0; t < T0 + FERRIS.round; t += 200) top = Math.max(top, RIDES.ferris.pose(0, t).y); ok(top > 50, `대관람차 꼭대기 앉는 높이 ${top.toFixed(1)}m`); }
// 역 정차: 역 3곳에서 정확히 TRAIN.stop 동안 서고, 그때 객차 가운데가 승강장 앞
{ const stops = new Map(); let cur = null;
  for (let t = T0; t < T0 + TRAIN.lap * 2; t += 20) { const s = trainState(t); if (s.st >= 0) { if (!cur || cur.st !== s.st) cur = { st: s.st, t0: t, s: s.s }; cur.t1 = t; } else if (cur) { (stops.get(cur.st) ?? stops.set(cur.st, []).get(cur.st)).push(cur); cur = null; } }
  ok(stops.size === 3, '역 3곳 모두 섬');
  for (const [i, list] of stops) for (const c of list.filter((c) => c.t0 > T0)) {
    ok(Math.abs(c.t1 - c.t0 + 20 - TRAIN.stop) <= 40, `${TRAIN_STATIONS[i].name} 정차 ${((c.t1 - c.t0 + 20) / 1000).toFixed(2)}초`);
    const mid = W.trainCarS(c.s, 2.5), d = ((mid - TRAIN_STATIONS[i].s) % TRAIN_PATH.len + TRAIN_PATH.len) % TRAIN_PATH.len;
    ok(Math.min(d, TRAIN_PATH.len - d) < 4, `${TRAIN_STATIONS[i].name}: 객차 가운데가 승강장 앞 (${Math.min(d, TRAIN_PATH.len - d).toFixed(1)}m)`);
  } }
// 내릴 자리는 걸을 수 있는 빈 땅 (충돌에 안 막힘)
for (const R of Object.values(RIDES)) for (const s of [0, 3, R.seats - 1]) { const [x, z] = R.exit(s, T0); const [a, b] = W.resolve(x, z); ok(Math.hypot(a - x, b - z) < 0.05 && W.inPark(a, b), `${R.name} ${s}번 내릴 자리 (${x.toFixed(1)},${z.toFixed(1)})`); }

// ── 4. 서버 규칙 (가짜 시계)
let now = Math.ceil(T0 / FERRIS.round) * FERRIS.round + 500; // 대관람차 곤돌라 0 이 막 섬
const players = new Map(), sent = [], cast = [];
let nextId = 1;
const ctx = { now: () => now, rand: Math.random, players, send: (p, o) => sent.push([p.id, o]), bcast: (o) => cast.push(o), info: () => {}, stand: (p) => { p.seat = -1; p.stood = 1; } };
const S = createRidesServer(ctx);
const mk = (x, z, o = {}) => { const p = { id: nextId++, x, z, ry: 0, fl: 0, seat: -1, s: 'free', auto: false, game: null, transit: null, fish: null, act: null, ...o }; players.set(p.id, p); return p; };
const last = (p) => sent.filter(([id]) => id === p.id).at(-1)?.[1];
const wait = (ms) => { now += ms; S.tick(); };
const F0 = gondolaAt(0, ferrisAt(now).w);
// 거리·공원 밖·준비 중
const far = mk(-470, -34), out = mk(0, 8), a = mk(F0[0] + 3, F0[2] - 0.5), b = mk(F0[0] + 3, F0[2] + 0.5), c = mk(F0[0] + 4, F0[2]), d = mk(F0[0] + 4.5, F0[2] + 1), e = mk(F0[0] + 5, F0[2]);
S.act(far, { op: 'on', id: 'ferris' }); ok(!far.ride && /가까이/.test(last(far).error), '멀면 거절');
S.act(out, { op: 'on', id: 'ferris' }); ok(!out.ride && /놀이공원 안/.test(last(out).error), '공원 밖 거절');
S.act(a, { op: 'on', id: 'rocket' }); ok(!a.ride && /준비 중/.test(last(a).error), '없는 기구는 준비 중');
now += GAP;
// 친구 4명이 같은 곤돌라, 5번째는 가득
for (const p of [a, b, c, d, e]) S.act(p, { op: 'on', id: 'ferris' });
ok([a, b, c, d].every((p) => p.ride?.id === 'ferris' && Math.floor(p.ride.seat / 4) === 0), '4명이 같은 곤돌라(0번)');
ok(new Set([a, b, c, d].map((p) => p.ride.seat)).size === 4, '자리 겹치지 않음');
ok(!e.ride && /가득/.test(last(e).error), '5번째는 가득 참');
ok(S.frozen(a) && !S.frozen(e), 'frozen = 타는 중');
ok(cast.filter((o) => o.t === 'ride' && o.op === 'on').length === 4 && a.s === 'rideFerris', '타기 방송 · 이름표 상태');
// 중복·연타
sent.length = 0; S.act(a, { op: 'on', id: 'ferris' }); ok(sent.length === 0, '연타는 조용히 무시');
now += GAP; S.act(a, { op: 'on', id: 'carousel' }); ok(/이미/.test(last(a).error), '타는 중에 또 타기 거절');
// 탄 동안 서버 위치가 자리를 따라감 · 운행 중엔 못 내림
wait(30e3); const q = seatPose('ferris', a.ride.seat, now); ok(Math.hypot(a.x - q.x, a.z - q.z) < 1e-9 && W.inPark(a.x, a.z), 'tick: 서버 위치 = 자리');
now += GAP; S.act(a, { op: 'off' }); ok(a.ride && /내려오면/.test(last(a).error), '공중에서는 못 내림');
// 정지 중 스스로 내리기 (2번째 곤돌라 승차 → 바로 내림)
now = Math.ceil(now / FERRIS.round) * FERRIS.round - FERRIS.round + FERRIS.stop + FERRIS.step + 500; // 이번 회차 곤돌라 1 정지
const G1 = gondolaAt(1, ferrisAt(now).w), f = mk(G1[0] + 3, G1[2]);
S.act(f, { op: 'on', id: 'ferris' }); ok(Math.floor(f.ride?.seat / 4) === 1, '두 번째 정지엔 곤돌라 1');
now += GAP; S.act(f, { op: 'off' }); ok(!f.ride && last(f).t === 'tp' && f.s === 'free', '멈춰 있을 때 스스로 내림 → 내린 자리로 · 상태 되돌림');
// 회차 끝: 한 바퀴 돌고 곤돌라 0 이 다시 서면 내려 줌
const r1 = Math.ceil(now / FERRIS.round) * FERRIS.round;
now = r1 - 100; S.tick(); ok(a.ride, '한 바퀴 직전엔 아직 탐');
now = r1 + 50; S.tick(); ok(!a.ride && !b.ride && !c.ride && !d.ride, '한 바퀴 돌면 서버가 내려 줌');
{ const [x, z] = RIDES.ferris.exit(0); ok(Math.hypot(a.x - x, a.z - z) < 0.5 && cast.some((o) => o.op === 'off' && o.id === a.id && o.why === 'end'), '내린 자리 + 방송(why: end)'); }
// 연결 끊김: 자리 비움 → 다른 사람이 탐
now += GAP; S.act(e, { op: 'on', id: 'ferris' }); ok(e.ride, '빈 곤돌라에 탐');
const seatE = e.ride.seat; S.leave(e); players.delete(e.id);
const g = mk(e.x + 0, e.z); g.x = F0[0] + 3; g.z = F0[2]; // 같은 곤돌라 앞
for (let i = 0; i < 4; i++) { const p = mk(F0[0] + 3, F0[2] + (i - 1.5) * 0.4); S.act(p, { op: 'on', id: 'ferris' }); }
ok([...S.riders().values()].some((r) => r.seat === seatE), '끊긴 사람 자리를 다른 사람이 씀');
ok(S.snapshot().riders.length === 4 && Number.isFinite(S.snapshot().now), 'snapshot: 탄 사람 목록 + 서버 시각');
// 앉아 있던 사람은 일어나서 탐 · 낚시·행동 중엔 거절
{ now = Math.ceil(now / CAROUSEL.round) * CAROUSEL.round + 1000; const C = CAROUSEL;
  const s1 = mk(C.x + C.plat + 1, C.z, { seat: 5 }), s2 = mk(C.x - C.plat - 1, C.z, { act: { k: 'bow' } });
  S.act(s1, { op: 'on', id: 'carousel' }); ok(s1.ride?.id === 'carousel' && s1.stood, '벤치에서 일어나 회전목마 탐');
  S.act(s2, { op: 'on', id: 'carousel' }); ok(!s2.ride && /지금은/.test(last(s2).error), '다른 행동 중엔 거절');
  const p = seatPose('carousel', s1.ride.seat, now); ok(Math.hypot(p.x - s1.x, p.z - s1.z) <= RIDES.carousel.reach, '가까운 빈 말에 앉음');
  wait(C.load + 20e3); now += GAP; S.act(s1, { op: 'off' }); ok(s1.ride, '도는 중엔 못 내림');
  now = Math.ceil(now / C.round) * C.round + 30; S.tick(); ok(!s1.ride && Math.hypot(s1.x - C.x, s1.z - C.z) > C.plat, '회차 끝에 받침 밖으로 내림'); }
// 꼬마기차: 역에서만 타고, 다음 역에서 내릴 수 있고, 안 내리면 한 바퀴 뒤 내려 줌
{ let t = now; while (trainState(t).st !== 0 || trainState(t).left < 8000) t += 100; now = t;
  const st = TRAIN_STATIONS[0], p = mk(st.x + st.nx * 3, st.z + st.nz * 3), q2 = mk(st.x + st.nx * 3, st.z + st.nz * 3 + 1);
  S.act(p, { op: 'on', id: 'train' }); S.act(q2, { op: 'on', id: 'train' }); ok(p.ride?.id === 'train' && q2.ride, '정문역에서 기차 탐');
  while (trainState(now).st >= 0) wait(200);
  now += GAP; S.act(p, { op: 'off' }); ok(p.ride && /역에 서면/.test(last(p).error), '달리는 중엔 못 내림');
  ok(trainNear(p.x, p.z).d < 0.5, '달리는 동안 서버 위치가 선로 위');
  while (trainState(now).st < 0) wait(200);
  const at = TRAIN_STATIONS[trainState(now).st]; S.act(p, { op: 'off' });
  ok(!p.ride && Math.hypot(p.x - at.x, p.z - at.z) < 7 && last(p).t === 'tp', `다음 역(${at.name})에서 내림`);
  let laps = 0; while (q2.ride && laps++ < 4000) wait(100);
  ok(!q2.ride && Math.hypot(q2.x - st.x, q2.z - st.z) < 7, `한 바퀴 돌아 ${st.name}에서 내려 줌`); }
// ── 5. 2단계 A: 드롭타워·바이킹·회전그네·롤러코스터·후룸라이드
{ const sec = (ms) => ms / 1000;
  ok(sec(DROP.round) > 34 && sec(DROP.round) < 46, `드롭타워 한 회차 ${sec(DROP.round).toFixed(1)}초`);
  ok(sec(VIKING.round) > 44 && sec(VIKING.round) < 56, `바이킹 한 회차 ${sec(VIKING.round)}초`);
  ok(sec(SWING.round) > 54 && sec(SWING.round) < 66, `회전그네 한 회차 ${sec(SWING.round)}초`);
  ok(sec(COASTER.round) > 60 && sec(COASTER.round) < 80, `롤러코스터 한 회차 ${sec(COASTER.round).toFixed(1)}초`);
  ok(sec(FLUME.round) > 72 && sec(FLUME.round) < 95, `후룸라이드 한 회차 ${sec(FLUME.round).toFixed(1)}초`);
  // 승차 창: 회차 시작엔 모든 자리, 운행 중엔 안 됨 · 회차 끝 = 처음 자리 (exit 가 시각과 상관없이 맞음)
  for (const [id, K] of [['drop', DROP], ['viking', VIKING], ['swing', SWING], ['coaster', COASTER], ['flume', FLUME], ['bumper', BUMPER], ['teacups', TEACUPS]]) {
    const R = RIDES[id], r0 = Math.ceil(T0 / K.round) * K.round;
    ok(R.open(r0 + 100).seats?.length === R.seats && !R.open(r0 + K.load + 2000).seats && R.open(r0 + K.load + 2000).wait > 0, `${R.name} 승차창: 멈춰 있을 때만`);
    ok(R.exitOk({}, r0 + 100) && !R.exitOk({}, r0 + K.load + 3000) && R.due({ round: Math.floor(r0 / K.round) - 1 }, r0 + 10), `${R.name} 출발 전엔 내림 가능 · 운행 중엔 못 내림 · 다음 회차에 내려 줌`);
    let jump = 0; for (let s = 0; s < R.seats; s++) { const a = R.pose(s, r0 - 1), b = R.pose(s, r0 + 1); jump = Math.max(jump, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)); }
    ok(jump < 0.05, `${R.name} 회차 경계에서 모든 자리가 이어짐 (${jump.toFixed(3)}m)`);
    const ids = new Set(); for (let s = 0; s < R.seats; s++) { const q = R.pose(s, r0 + 100); ids.add(`${q.x.toFixed(1)},${q.y.toFixed(1)},${q.z.toFixed(1)}`); } ok(ids.size === R.seats, `${R.name} ${R.seats}자리가 서로 다른 곳`);
  }
  // 드롭타워: 꼭대기 40m 에서 4초 멈춤 → 떨어지며 빨라짐 → 브레이크 → 바닥
  { const r0 = Math.ceil(T0 / DROP.round) * DROP.round, tTop = r0 + DROP.load + DROP.up;
    ok(Math.abs(dropAt(tTop + 100).y - DROP.top) < 1e-9 && Math.abs(dropAt(tTop + DROP.hold - 100).y - DROP.top) < 1e-9 && dropAt(tTop + 100).ph === 'hold', '드롭타워 꼭대기에서 멈춤');
    const v = (t) => (dropAt(t).y - dropAt(t + 50).y) / 0.05, f0 = tTop + DROP.hold;
    ok(v(f0 + 200) < v(f0 + 800) && v(f0 + 800) < v(f0 + 1600) && v(f0 + DROP.fall - 100) > 15, `드롭타워 떨어지며 빨라짐 (최고 ${v(f0 + DROP.fall - 100).toFixed(1)}m/s)`);
    ok(dropAt(r0 + DROP.round - 10).y - DROP.y0 < 0.01 && dropAt(f0 + DROP.fall + DROP.brake).y > 1.5, '브레이크 뒤 바닥에 살며시'); }
  // 바이킹: 승차 중 0°, 흔들림 최대 45° 넘음, 끝엔 0°
  { const r0 = Math.ceil(T0 / VIKING.round) * VIKING.round; let mx = 0; for (let t = r0; t < r0 + VIKING.round; t += 50) mx = Math.max(mx, Math.abs(vikingAt(t).th));
    ok(vikingAt(r0 + 100).th === 0 && Math.abs(vikingAt(r0 + VIKING.round - 50).th) < 0.01 && mx > 0.8, `바이킹 최대 ${(mx * 180 / Math.PI).toFixed(0)}° · 멈춰서 타고 내림`);
    const lo = Math.min(...[...Array(16).keys()].map((s) => RIDES.viking.pose(s, r0 + 100).y)); ok(lo > 0.8 && lo < 2.5, `바이킹 멈췄을 때 자리 높이 ${lo.toFixed(2)}m`); }
  // 회전그네: 빠를 땐 바깥으로 30° 넘게 기울고 높이 올라감
  { const s = swingAt(Math.ceil(T0 / SWING.round) * SWING.round + SWING.load + 25000); ok(s.phi > 0.5 && s.h > SWING.h0 + 2 && RIDES.swing.pose(0, Math.ceil(T0 / SWING.round) * SWING.round + SWING.load + 25000).y > 3, `회전그네 기울기 ${(s.phi * 180 / Math.PI).toFixed(0)}°`); }
  // 롤러코스터: 자리는 늘 레일 위(옆 0.42m·위 0.75m, 가까운 점이 0.5m 간격이라 경사에선 0.2m 안팎 오차), 꼭대기 지나 내리막에서 빨라짐, 길 위로는 4.5m 넘게 띄움, 기둥은 길 위에 없음
  { const r0 = Math.ceil(T0 / COASTER.round) * COASTER.round; let off = 0;
    for (let t = r0; t < r0 + COASTER.round; t += 250) for (const s of [0, 7, 15]) { const q = seatPose('coaster', s, t), nr = COASTER_PATH.near(q.x, q.z); off = Math.max(off, Math.abs(nr.d - COASTER.side), Math.abs(q.y - nr.y - COASTER.seatY)); }
    ok(off < 0.25, `롤러코스터 자리는 레일 위 (어긋남 ${off.toFixed(3)}m)`);
    const T = (s) => { let lo = 0, hi = COASTER.table.T; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (COASTER.table.at(m) < s) lo = m; else hi = m; } return lo; }; // 앞머리가 s 에 닿는 시각
    const vAt = (s) => { const t = T(s); return (COASTER.table.at(t + 50) - COASTER.table.at(t - 50)) / 0.1; };
    ok(vAt(COASTER.sTop - 5) < 3 && vAt(COASTER.sTop + 8) > vAt(COASTER.sTop + 2) && vAt(COASTER.sTop + 22) > 12, `첫 내리막 가속 (꼭대기 ${vAt(COASTER.sTop - 5).toFixed(1)} → ${vAt(COASTER.sTop + 22).toFixed(1)}m/s)`);
    let low = Infinity; for (let s = 0; s < COASTER_PATH.L; s += 0.5) { const [x, y, z] = COASTER_PATH.at(s); if (W.parkPathNear(x, z).d < 0.5) low = Math.min(low, y); }
    ok(low > 4.5, `사람 길 위 레일 높이 ${low.toFixed(1)}m 이상`);
    ok(W.COASTER_POSTS.length > 15 && W.COASTER_POSTS.every((p) => W.parkPathNear(p.x, p.z).d > 1 && W.inPark(p.x, p.z)), `기둥 ${W.COASTER_POSTS.length}개 · 길 위엔 없음`);
    let inside = 0; for (let s = 0; s < COASTER_PATH.L; s += 1) { const [x, , z] = COASTER_PATH.at(s); if (W.inPark(x, z, 3)) inside++; } ok(inside >= Math.floor(COASTER_PATH.L) - 1, '레일은 부지 안'); }
  // 후룸라이드: 자리는 물길 위, 낙하에서 빨라짐(8m/s 넘게), 배끼리 안 겹침
  { const r0 = Math.ceil(T0 / FLUME.round) * FLUME.round; let off = 0, gap = Infinity, vmx = 0;
    for (let t = r0; t < r0 + FLUME.round; t += 100) {
      for (const s of [0, 7, 17]) { const q = seatPose('flume', s, t), nr = FLUME_PATH.near(q.x, q.z); off = Math.max(off, nr.d - FLUME.side, Math.abs(q.y - nr.y - FLUME.seatY)); }
      const b = [0, 1, 2].map((k) => flumeBoat(k, t).s); for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = ((b[i] - b[j]) % FLUME_PATH.L + FLUME_PATH.L) % FLUME_PATH.L; gap = Math.min(gap, d, FLUME_PATH.L - d); }
    }
    for (let k = 0; k < 3; k++) for (let t = r0; t < r0 + FLUME.round; t += 50) vmx = Math.max(vmx, (flumeBoat(k, t + 50).s - flumeBoat(k, t).s) / 0.05);
    ok(off < 0.25, `후룸 자리는 물길 위 (어긋남 ${off.toFixed(3)}m)`);
    ok(gap > FLUME.len + 0.3, `배 사이 ${gap.toFixed(1)}m (배 길이 ${FLUME.len}m)`);
    ok(vmx > 8 && FLUME.vb > 10, `낙하 가속: 최고 ${vmx.toFixed(1)}m/s`);
    let tops = 0; for (let t = r0; t < r0 + FLUME.round; t += 100) if (seatPose('flume', 0, t).y > 8) tops++; ok(tops > 20, '오르막 위 물길을 지나감'); }
  // 서버: 다섯 기구 모두 승차 창에 타서, 운행 중엔 못 내리고, 다음 회차에 내릴 자리로
  for (const [id, K] of [['drop', DROP], ['viking', VIKING], ['swing', SWING], ['coaster', COASTER], ['flume', FLUME], ['bumper', BUMPER], ['teacups', TEACUPS]]) {
    const R = RIDES[id]; now = Math.ceil((now + 1) / K.round) * K.round + 500;
    const ex = R.exit(1), p = mk(ex[0], ex[1]), q2 = mk(ex[0] + 0.3, ex[1]);
    S.act(p, { op: 'on', id }); S.act(q2, { op: 'on', id });
    ok(p.ride?.id === id && q2.ride?.id === id && p.ride.seat !== q2.ride.seat && p.s === R.status, `${R.name}: 친구 둘이 다른 자리에 탐`);
    now += GAP; S.act(p, { op: 'on', id: 'carousel' }); ok(/이미/.test(last(p).error), `${R.name}: 중복 탑승 거절`);
    wait(K.load + 5000); now += GAP; S.act(p, { op: 'off' }); ok(p.ride && /멈추면/.test(last(p).error), `${R.name}: 운행 중엔 못 내림`);
    const late = mk(ex[0], ex[1]); S.act(late, { op: 'on', id }); ok(!late.ride && /탈 수 있어요/.test(last(late).error), `${R.name}: 운행 중엔 못 탐`);
    while (p.ride && now < Math.ceil(now / K.round) * K.round + 200) wait(250);
    ok(!p.ride && !q2.ride && W.inPark(p.x, p.z) && cast.some((o) => o.op === 'off' && o.id === p.id && o.why === 'end'), `${R.name}: 회차 끝에 내려 줌 (${p.x.toFixed(1)},${p.z.toFixed(1)})`);
  } }
// 2단계 입력 훅: input 이 있는 기구만, 탄 사람만
{ RIDES.carousel.input = (r, m) => (r.st = { spin: m.spin }, { spin: m.spin });
  now = Math.ceil(now / CAROUSEL.round) * CAROUSEL.round + 1000; const p = mk(CAROUSEL.x + CAROUSEL.plat + 1, CAROUSEL.z); S.act(p, { op: 'on', id: 'carousel' });
  cast.length = 0; S.act(p, { op: 'in', spin: 2 }); ok(cast.at(-1)?.op === 'in' && cast.at(-1).spin === 2 && S.riders().get(p).st.spin === 2, '입력 훅 → rider.st 반영 + 방송');
  const nr = mk(0, 8); cast.length = 0; S.act(nr, { op: 'in', spin: 1 }); ok(!cast.length, '안 탄 사람의 입력은 무시');
  delete RIDES.carousel.input; }
// 이상한 메시지는 무시
for (const m of [null, {}, { op: 5 }, { op: 'on' }, { op: 'on', id: '__proto__' }, { op: 'on', id: 'toString' }]) { const p = mk(-300, -20); now += GAP; S.act(p, m); assert.ok(!p.ride); } n++;

// ── 6. 2단계 B: 범퍼카 (서버가 2D 물리) · 회전 찻잔 (빠르기 조절)
{ let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); // 가짜 난수 (같은 씨앗 → 같은 수)
  const fresh = () => RIDES.bumper.init().cars;
  const drive = (cars, steps, s0) => { seed = s0; const all = []; for (let k = 0; k < steps; k++) { if (k % 10 === 0) for (const c of cars) { c.u = rnd() < 0.8 ? 1 : -1; c.s = Math.round((rnd() * 2 - 1) * 4) / 4; } all.push(...bumperStep(cars, 0.05)); } return all; };
  const [B0, B1] = [fresh(), fresh()]; drive(B0, 600, 11); drive(B1, 600, 11);
  ok(JSON.stringify(B0) === JSON.stringify(B1), 'bumperStep 결정성: 같은 입력 → 같은 결과 (30초 · 차 10대)');
  // 벽 안 뚫음 · 속도 상한 · 겹침 없음 (차 10대가 2분 동안 마구 달림)
  const cars = fresh(), [x0, z0, x1, z1] = BUMPER.box; let out = 0, vmx = 0, gap = Infinity, nb = 0; seed = 3;
  for (let k = 0; k < 2400; k++) {
    if (k % 8 === 0) for (const c of cars) { c.u = rnd() < 0.85 ? 1 : -1; c.s = rnd() * 2 - 1; }
    nb += bumperStep(cars, 0.05).filter((b) => b[1] >= 0).length;
    for (const c of cars) { out = Math.max(out, x0 + BUMPER.r - c.x, c.x - (x1 - BUMPER.r), z0 + BUMPER.r - c.z, c.z - (z1 - BUMPER.r)); vmx = Math.max(vmx, Math.hypot(c.vx, c.vz)); }
    for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) gap = Math.min(gap, Math.hypot(cars[i].x - cars[j].x, cars[i].z - cars[j].z));
  }
  ok(out <= 1e-9, `범퍼카 벽 안 뚫음 (넘침 ${out.toExponential(1)}m)`);
  ok(vmx <= BUMPER.vmax + 1e-9, `범퍼카 최고 속도 ${vmx.toFixed(2)} ≤ ${BUMPER.vmax} m/s`);
  ok(gap > 2 * BUMPER.r - 0.05 && nb > 20, `차 10대 2분: 서로 부딪힘 ${nb}번, 가장 가까운 거리 ${gap.toFixed(3)}m (겹침 없음)`);
  // 두 차 정면 충돌: 튕겨 나가고 겹치지 않음
  const two = [{ x: BUMPER.x - 4, z: 54, a: Math.PI / 2, vx: 0, vz: 0, u: 1, s: 0 }, { x: BUMPER.x + 4, z: 54, a: -Math.PI / 2, vx: 0, vz: 0, u: 1, s: 0 }];
  let hit = null, minD = Infinity;
  for (let k = 0; k < 60; k++) { const b = bumperStep(two, 0.05); if (b.length && !hit) hit = { k, v: b[0][2] }; minD = Math.min(minD, Math.hypot(two[0].x - two[1].x, two[0].z - two[1].z)); if (hit && k === hit.k) two.forEach((c) => (c.u = 0)); }
  ok(hit && hit.v > 3 && minD >= 2 * BUMPER.r - 1e-6, `정면 충돌 '통!' (세기 ${hit?.v.toFixed(1)}m/s), 겹침 없음 (최소 ${minD.toFixed(4)}m)`);
  ok(two[0].vx <= 0.05 && two[1].vx >= -0.05 && two[1].x - two[0].x > 2.5, '부딪힌 뒤 서로 튕겨 멀어짐');
  { const c = [{ ...bumperHome(0), vx: 0, vz: 0, u: 1, s: 1 }]; for (let k = 0; k < 20; k++) bumperStep(c, 0.05); ok(c[0].a < -0.5 && c[0].x < bumperHome(0).x, '오른쪽 조향 → 오른쪽(서쪽, 남쪽을 볼 때)으로 돎'); }
  { const p = bumperPack(cars), back = bumperUnpack(p, fresh()); ok(back.every((c, i) => Math.abs(c.x - cars[i].x) < 0.006 && Math.abs(c.z - cars[i].z) < 0.006) && p.every(Number.isInteger) && p.length === 50, '방송용 줄이기 (정수 50개, 1cm)'); }
  ok(BUMPER.round > 85e3 && BUMPER.round < 100e3 && BUMPER.run >= 60e3 && BUMPER.run <= 90e3, `범퍼카 운행 ${BUMPER.run / 1000}초 (한 회차 ${BUMPER.round / 1000}초)`);
  // 서버: 로비에서 타기 → 운전 → 20Hz 가까운 사람에게만 방송 → 회차 끝 하차
  now = Math.ceil((now + 1) / BUMPER.round) * BUMPER.round + 1000; S.tick();
  const lob = (i) => mk(bumperHome(i).x, 41.6), d1 = lob(2), d2 = lob(3), door = mk(BUMPER.x, 34), nearW = mk(BUMPER.x + 30, 30), farW = mk(-420, -34);
  S.act(door, { op: 'on', id: 'bumper' }); ok(!door.ride && /가까이/.test(last(door).error), '범퍼카: 문밖(로비 밖)에선 너무 멀어 거절');
  S.act(d1, { op: 'on', id: 'bumper' }); S.act(d2, { op: 'on', id: 'bumper' });
  ok(d1.ride?.seat === 2 && d2.ride?.seat === 3, '범퍼카: 친구 둘이 바로 앞 차에 탐');
  now += GAP; S.act(d1, { op: 'on', id: 'teacups' }); ok(/이미/.test(last(d1).error), '범퍼카: 중복 탑승 거절');
  sent.length = 0; now = Math.floor(now / BUMPER.round) * BUMPER.round + BUMPER.load + 200; S.tick(); sent.length = 0;
  const z0d = d1.z, t0 = now;
  for (let k = 0; k < 40; k++) { S.act(d1, { op: 'in', u: 1, s: 0 }); S.act(d2, { op: 'in', u: 1, s: -0.5 }); wait(50); } // 2초 동안 앞으로 (옆 친구는 왼쪽으로 빠짐)
  const bc = sent.filter(([, o]) => o.op === 'bc'), toNear = bc.filter(([id]) => id === nearW.id), bytes = toNear.reduce((a, [, o]) => a + JSON.stringify(o).length, 0) / ((now - t0) / 1000);
  ok(d1.z - z0d > 4 && Math.abs(d1.x - bumperHome(2).x) < 0.3, `범퍼카: 가속 → 앞으로 ${(d1.z - z0d).toFixed(1)}m (서버 위치 = 차)`);
  ok(toNear.length >= 38 && toNear.length <= 41 && !bc.some(([id]) => id === farW.id), `20Hz 방송 ${toNear.length}번/2초, 먼 사람(170m)은 안 받음`);
  ok(bytes < 9000 && JSON.stringify(toNear[0][1]).length < 420, `방송 크기 ${JSON.stringify(toNear[0][1]).length}바이트 · ${(bytes / 1024).toFixed(1)}KB/초 (한 사람)`);
  now += GAP; S.act(d1, { op: 'off' }); ok(d1.ride && /멈추면/.test(last(d1).error), '범퍼카: 운행 중엔 못 내림');
  { const c = S.sims.bumper.cars[2]; wait(1600); ok(c.u === 0, '입력이 1.5초 끊기면 손 뗀 것 (가속 0)'); }
  S.act(d1, { op: 'in', u: 'x', s: 99 }); ok(S.riders().get(d1).st.u === 0 && S.riders().get(d1).st.s === 1, '이상한 입력은 걸러 냄');
  const nc = mk(0, 8); S.act(nc, { op: 'in', u: 1 }); ok(!nc.ride, '안 탄 사람 입력 무시');
  for (let k = 0; k < 30; k++) { S.act(d1, { op: 'in', u: 1, s: 0.25 }); wait(50); }
  now = Math.ceil(now / BUMPER.round) * BUMPER.round - 3000; S.tick(); ok(d1.ride && bumperAt(now).ph === 'ret', '운행 끝: 제자리로 돌아오는 중엔 아직 탐');
  now += 3050; S.tick(); S.tick();
  ok(!d1.ride && !d2.ride && Math.abs(d1.z - 40.6) < 0.05 && W.resolve(d1.x, d1.z)[1] === d1.z, `회차 끝에 로비로 내려 줌 (${d1.x.toFixed(1)},${d1.z.toFixed(1)})`);
  ok(S.sims.bumper.cars.every((c, i) => Math.hypot(c.x - bumperHome(i).x, c.z - bumperHome(i).z) < 0.01), '다음 회차엔 차 10대가 제자리');
  { const snap = S.snapshot(); ok(snap.sim.bumper.c.length === 50 && snap.sim.teacups.cups.length === TEACUPS.n, 'snapshot 에 기구 상태 (늦게 온 사람용)'); }
  // 연결 끊김: 자리만 비움
  S.act(d2, { op: 'on', id: 'bumper' }); const sd = d2.ride?.seat; S.leave(d2); players.delete(d2.id); ok(sd >= 0 && ![...S.riders().values()].some((r) => r.id === 'bumper' && r.seat === sd), '범퍼카: 끊기면 차가 비어짐');
  // 회전 찻잔
  const T = RIDES.teacups, r0 = Math.ceil((now + 1) / TEACUPS.round) * TEACUPS.round, sim = T.init();
  ok(TEACUPS.round > 75e3 && TEACUPS.round < 100e3, `회전 찻잔 한 회차 ${TEACUPS.round / 1000}초`);
  const rr = { seat: 5 }, run = r0 + TEACUPS.load + 10000;
  ok(!T.input(rr, { d: 1 }, r0 + 1000, sim), '찻잔: 승차 중엔 빠르기 못 바꿈');
  let tt = run, lv = []; for (let k = 0; k < 10; k++) { const o = T.input(rr, { d: 1 }, (tt += 400), sim); lv.push(o ? o.lvl : '-'); }
  ok(cupLevel(sim.cups[1], tt) === TEACUPS.max && lv.join() === '1,2,3,4,5,-,-,-,-,-', `찻잔 빠르기 한 칸씩, 상한 ${TEACUPS.max}칸 (${lv.join(' ')})`);
  ok(T.input(rr, { d: -1 }, tt + 100, sim)?.lvl === 4 && !T.input(rr, { d: -1 }, tt + 300, sim) && T.input(rr, { d: -1 }, tt + 500, sim)?.lvl === 3, '연타 제한 0.35초 (어지럽지 않게)');
  ok(!T.input(rr, { d: 9 }, tt + 900, sim) && !T.input(rr, { d: '1' }, tt + 1300, sim), '이상한 값 무시');
  { const t1 = tt + 2000, a = cupSpin(sim.cups[1], t1 - 1), o = T.input(rr, { d: 1 }, t1, sim), b = cupSpin(sim.cups[1], t1 + 1); ok(o && Math.abs(b - a) < 0.01, `빠르기를 바꿔도 각도 이어짐 (${Math.abs(b - a).toFixed(4)}rad)`); }
  { const v = (t) => (cupSpin(sim.cups[1], t + 50) - cupSpin(sim.cups[1], t)) / 0.05; ok(sim.cups[1].lvl === 4 && Math.abs(v(tt + 3000) - 4 * TEACUPS.step) < 0.01, `4칸 = ${(4 * TEACUPS.step).toFixed(2)}rad/s (최고 5칸 = 초당 ${(TEACUPS.max * TEACUPS.step / 2 / Math.PI).toFixed(2)}바퀴)`); }
  // 좌석 연속성·속도 상한 (빠르기를 마구 바꿔도), 회차 끝엔 멈추고 다음 회차는 0 부터
  { let prev = null, vm = 0; const s2 = T.init(); seed = 5;
    for (let t = r0; t < r0 + TEACUPS.round * 2; t += 50) { if (rnd() < 0.08) T.input({ seat: 9 }, { d: rnd() < 0.7 ? 1 : -1 }, t, s2); const q = T.pose(9, t, s2); if (prev) vm = Math.max(vm, Math.hypot(q.x - prev.x, q.z - prev.z) / 0.05); prev = q; }
    ok(vm < 7.5, `찻잔 자리 최고 ${vm.toFixed(2)}m/s (점프 없음, 회차 경계 포함)`); }
  { const r1 = r0 + TEACUPS.round, a = cupSpin(sim.cups[1], r1 - 20), b = cupSpin(sim.cups[1], r1 + 5000);
    ok(Math.abs(a - b) < 0.02 && cupLevel(sim.cups[1], r1 + 10) === 0, '회차 끝: 찻잔이 멈추고 다음 회차는 빠르기 0 부터');
    ok(T.input(rr, { d: 1 }, r1 + TEACUPS.load + 5000, sim)?.lvl === 1, '다음 회차 첫 누름 = 1칸'); }
  ok(Math.abs(Math.sin(teacupsAt(r0 + 100).a)) < 1e-6 && Math.cos(teacupsAt(r0 + 100).a) > 0.999 && !teacupsAt(r0 + 100).run && teacupsAt(run).run, '회전판: 승차 중 멈춤 · 회차마다 정수 바퀴');
  // 서버: 찻잔 타기 → 빠르기 방송 → 같은 찻잔 친구가 같이 조절
  now = Math.ceil((now + 1) / TEACUPS.round) * TEACUPS.round + 1000;
  const [ex, ez] = T.exit(0), f1 = mk(ex, ez), f2 = mk(ex + 0.4, ez);
  S.act(f1, { op: 'on', id: 'teacups' }); S.act(f2, { op: 'on', id: 'teacups' });
  ok(Math.floor(f1.ride?.seat / 4) === 0 && Math.floor(f2.ride?.seat / 4) === 0 && f1.ride.seat !== f2.ride.seat, '찻잔: 친구 둘이 같은 찻잔(0번)');
  now += TEACUPS.load; cast.length = 0; S.act(f1, { op: 'in', d: 1 }); now += 400; S.act(f2, { op: 'in', d: 1 });
  ok(cast.filter((o) => o.op === 'in' && o.r === 'teacups').map((o) => o.lvl).join() === '1,2' && S.sims.teacups.cups[0].lvl === 2, '찻잔 빠르기 방송 (같은 찻잔 둘이 1 → 2칸)');
  wait(1000); { const q = T.pose(f1.ride.seat, now, S.sims.teacups); ok(Math.hypot(f1.x - q.x, f1.z - q.z) < 1e-9, 'tick: 서버 위치 = 도는 찻잔 자리'); }
  while (f1.ride) wait(500); ok(W.inPark(f1.x, f1.z) && Math.hypot(f1.x - TEACUPS.x, f1.z - TEACUPS.z) > TEACUPS.plat, '회차 끝에 회전판 밖으로 내림'); }

console.log(`놀이기구 시험 통과 ✓ (${n}개 확인, 대관람차 ${FERRIS.round / 1000}초 · 회전목마 ${CAROUSEL.round / 1000}초 · 꼬마기차 한 바퀴 ${(TRAIN.lap / 1000).toFixed(0)}초 · 드롭타워 ${(DROP.round / 1000).toFixed(0)}초 · 바이킹 ${VIKING.round / 1000}초 · 회전그네 ${SWING.round / 1000}초 · 롤러코스터 ${(COASTER.round / 1000).toFixed(0)}초 · 후룸라이드 ${(FLUME.round / 1000).toFixed(0)}초 · 범퍼카 ${BUMPER.round / 1000}초 · 회전 찻잔 ${TEACUPS.round / 1000}초)`);
