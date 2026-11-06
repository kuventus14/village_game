// 놀이기구 규칙 (서버가 심판): 탈 수 있는 때(탑승 창)·거리·자리 배정(선착순, 같은 곤돌라에 여럿)·연타·중복 탑승 거절, 하차(스스로 / 회차 끝 / 연결 끊김).
// 기구마다 움직임은 public/ridesdata.js 의 순수 함수 → 서버는 tick 마다 탄 사람 위치(p.x/p.z)만 맞춰 둠(장소·말풍선·봇이 맞게), 위치는 방송하지 않음(화면이 같은 함수로 계산)
// 시계·난수는 ctx 로만 → 가짜 시계로 시험(test-rides.mjs). server.js 연결: { t: 'ride' } → act, 50ms tick, 나갈 때 leave, welcome 에 snapshot, frozen 이면 걷기 무시
// 메시지 (클라이언트 → 서버) { t:'ride', op:'on', id } 타기 · { op:'off' } 내리기 · { op:'in', … } 조작 기구(범퍼카 운전·찻잔 빠르기, RIDES[id].input)
//        (서버 → 모두)   { t:'ride', op:'on', id(사람), r(기구), seat, now } · { op:'off', id, x, z, ry, why, now } · { op:'in', id, r, … }
//        (서버 → 가까운 사람, 20Hz) { t:'ride', op:'bc', r, c, b, now } 상태를 서버가 계산하는 기구(범퍼카: RIDES[id].step)
//        (서버 → 본인)   { t:'ride', op:'no', error, now } 거절 이유 · { t:'tp' } 내린 자리로 옮김
import { RIDES, inPark, resolve } from './public/world.js';

export const GAP = 600; // 연타 방지 (ms)
/* ctx: { now(), rand(), players (Map), send(p, o), bcast(o), info(p), stand(p), closed?() = 불꽃놀이 영업 중단 중 } */
export function createRidesServer(ctx) {
  const riders = new Map(), taken = new Map(); // 사람 → { id, seat, at, …회차 기록 }, '기구:자리' → 사람
  const sims = {}; for (const R of Object.values(RIDES)) if (R.init) sims[R.id] = R.init(); // 조작 기구의 상태 (범퍼카 차 10대·찻잔 8개, 크기 고정 → 오래 켜 둬도 안 늘어남)
  const key = (id, seat) => id + ':' + seat;
  const no = (p, error) => ctx.send(p, { t: 'ride', op: 'no', error, now: ctx.now() });

  function on(p, m, now) {
    const R = typeof m.id === 'string' && Object.hasOwn(RIDES, m.id) && RIDES[m.id];
    if (!R) return no(p, '아직 준비 중인 기구예요');
    if (ctx.closed?.()) return no(p, '불꽃놀이 시간에는 놀이공원이 영업을 임시 중단해요');
    if (p.ride) return no(p, '이미 타고 있어요');
    if (!inPark(p.x, p.z) || p.fl) return no(p, '놀이공원 안에서 탈 수 있어요');
    if (p.game || p.transit || p.fish || p.act || p.fw) return no(p, '지금은 탈 수 없어요');
    const o = R.open(now);
    if (!o.seats) return no(p, `${o.msg} (${Math.ceil(o.wait / 1000)}초 뒤)`);
    let best = -1, bd = Infinity; // 빈자리 중 가장 가까운 곳 (먼저 온 사람이 먼저 앉음)
    for (const s of o.seats) {
      if (taken.has(key(R.id, s))) continue;
      const q = R.pose(s, now, sims[R.id]), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (best < 0) return no(p, '자리가 가득 찼어요 · 다음 차례에 타요');
    if (bd > R.reach) return no(p, '조금 더 가까이 가서 타 보세요');
    if (p.seat >= 0) ctx.stand(p); // 벤치에 앉아 있었으면 일어나서 탐
    const r = { id: R.id, seat: best, at: now, prev: { s: p.s, auto: p.auto }, ...R.board(now) };
    riders.set(p, r); taken.set(key(R.id, best), p);
    p.ride = { id: R.id, seat: best }; p.w = false; p.y = 0;
    place(p, R, now);
    ctx.bcast({ t: 'ride', op: 'on', id: p.id, r: R.id, seat: best, now });
    p.s = R.status; p.auto = false; ctx.info(p);
  }
  function off(p, why, now) {
    const r = riders.get(p);
    if (!r) return;
    const R = RIDES[r.id], [ex, ez, ry] = R.exit(r.seat, now), [x, z] = resolve(ex, ez);
    riders.delete(p); taken.delete(key(r.id, r.seat));
    p.ride = null; Object.assign(p, { x, z, ry, w: false, dirty: true });
    if (p.s === R.status) Object.assign(p, r.prev); // 타기 전 상태로 (그 사이 직접 바꿨으면 그대로)
    ctx.send(p, { t: 'tp', x, z, ry });
    ctx.bcast({ t: 'ride', op: 'off', id: p.id, x, z, ry, why, now });
    ctx.info(p);
  }
  const place = (p, R, now) => { const q = R.pose(riders.get(p).seat, now, sims[R.id]); p.x = q.x; p.z = q.z; p.ry = q.ry; }; // 방송 안 함 (dirty 그대로)

  return {
    act(p, m) {
      const now = ctx.now();
      if (!m || typeof m.op !== 'string') return;
      if (m.op === 'in') { // 조작 기구: 탄 사람만, 기구가 input 을 가질 때만 (연타 방지는 기구가 정함)
        const r = riders.get(p), R = r && RIDES[r.id];
        if (!R?.input) return;
        const o = R.input(r, m, now, sims[r.id]);
        if (o) ctx.bcast({ t: 'ride', op: 'in', id: p.id, r: r.id, ...o, now });
        return;
      }
      if (now - (p.rideAt || 0) < GAP) return; // 너무 자주 누르면 조용히 무시
      p.rideAt = now;
      if (m.op === 'on') return on(p, m, now);
      if (m.op === 'off') {
        const r = riders.get(p);
        if (!r) return;
        if (!RIDES[r.id].exitOk(r, now)) return no(p, r.id === 'train' ? '기차가 역에 서면 내릴 수 있어요' : r.id === 'ferris' ? '곤돌라가 아래로 내려오면 내릴 수 있어요' : '멈추면 내릴 수 있어요');
        off(p, 'self', now);
      }
    },
    tick() {
      const now = ctx.now();
      for (const id in sims) { // 서버가 상태를 계산하는 기구(범퍼카): 한 걸음 → 가까운 사람에게만 방송
        const R = RIDES[id]; if (!R.step) continue;
        const o = R.step(sims[id], now, [...riders.values()].filter((r) => r.id === id));
        if (!o) continue;
        const msg = { t: 'ride', op: 'bc', r: id, ...o, now };
        for (const q of ctx.players.values()) if (Math.hypot(q.x - R.x, q.z - R.z) < R.hear) ctx.send(q, msg);
      }
      for (const [p, r] of [...riders]) {
        if (!ctx.players.has(p.id) || ctx.players.get(p.id) !== p) { riders.delete(p); taken.delete(key(r.id, r.seat)); p.ride = null; continue; } // (leave 를 못 받고 사라진 경우)
        const R = RIDES[r.id];
        if (R.due(r, now)) off(p, 'end', now); else place(p, R, now);
      }
    },
    snapshot() { return { now: ctx.now(), riders: [...riders].map(([p, r]) => [p.id, r.id, r.seat]), sim: Object.fromEntries(Object.entries(sims).map(([id, s]) => [id, RIDES[id].snap(s)])) }; },
    evict(p, why = 'close') { if (riders.has(p)) off(p, why, ctx.now()); }, // 영업 중단: 타고 있던 사람을 내린 자리로 (회차 끝을 못 기다리는 경우)
    leave(p) { const r = riders.get(p); if (!r) return; riders.delete(p); taken.delete(key(r.id, r.seat)); p.ride = null; }, // 연결 끊김: 자리만 비움 (사람은 'leave' 로 사라짐)
    frozen: (p) => !!p.ride,
    riders: () => riders, sims, // 시험·봇 확인용
  };
}
