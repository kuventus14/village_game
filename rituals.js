// 성당·사찰·교회 안 행동 규칙 (서버가 심판): 자리·거리·건물 검사, 쿨다운, 공유 촛불·연등·성가·찬양 상태, 공동 의식 시간표, 계정 기록.
// 낚시 모듈처럼 시간은 ctx.now() 로만 읽고 타이머는 tick() 에서 확인 → 가짜 시계로 시험 가능. 행동 표는 world.js 의 ACTS
import { SPOTS, SEATS, ACTS, SEAT_SPOTS, RITUALS, RITUAL_MS, CANDLE_SLOTS, LIGHT_MS, HYMN_MS, SONGS, placeOf } from './public/world.js';

export const REACH = 1.8, GAP = 350, BELL_CD = 6000, BEADS_PER_S = 8, NOTES_PER_S = 8, ROSARY_BEADS = 59;
const KST = 9 * 3600e3;
const kstDay = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
// 지금 진행 중인 공동 의식: [{ place, name, until, key }] (KST 정각부터 10분)
export function ritualsAt(ms) {
  const day = Math.floor((ms + KST) / 864e5) * 864e5 - KST; // 오늘 0시(KST)
  return RITUALS.map((r) => ({ ...r, start: day + r.h * 3600e3 })).filter((r) => ms >= r.start && ms < r.start + RITUAL_MS)
    .map((r) => ({ place: r.place, name: r.name, until: r.start + RITUAL_MS, key: r.place + r.start }));
}
const nth = (kind) => { const m = {}; let i = 0; for (const s of SPOTS) if (s.kind === kind) m[s.id] = i++; return m; }; // 자리 번호 → 같은 종류 안에서 몇 번째(촛불대·석등 번호)
const CANDLE_I = nth('candle'), LANTERN_I = nth('lantern');

/* ctx: { now(), send(p, o), bcast(o), info(p) (상태 알림), save(p) (기록 저장) } */
export function createRituals(ctx) {
  const acting = new Set(), rit = new Map();
  const candles = [0, 1, 2, 3].map(() => Array(CANDLE_SLOTS).fill(null)), lanterns = [null, null, null, null];
  let bellAt = -Infinity, hymn = null, praise = null;

  function shrine() {
    const now = ctx.now();
    return {
      candles: candles.flatMap((st, i) => st.map((c, j) => c && [i, j, LIGHT_MS - (now - c.at), c.by]).filter(Boolean)),
      lanterns: lanterns.map((c, i) => c && [i, LIGHT_MS - (now - c.at), c.by]).filter(Boolean),
      hymn: hymn ? { left: hymn.until - now, el: now - hymn.at, by: hymn.by } : null,
      praise: praise ? { song: praise.song, el: now - praise.at } : null,
    };
  }
  const pushShrine = () => ctx.bcast({ t: 'shrine', ...shrine() });
  function bump(p, key) {
    const r = (p.rec ??= {}), now = ctx.now();
    r[key] = (r[key] || 0) + 1;
    let ev = key;
    if (key === 'bows') { const d = kstDay(now); if (r.day !== d) { r.day = d; r.today = 0; } r.today++; if (r.bows % 108 === 0) ev = '108'; }
    ctx.save(p); ctx.send(p, { t: 'rec', rec: r, ev });
  }
  function joinRitual(p, place) { // 의식 중 그 건물에서 처음 한 행동이면 참여 +1 (의식마다 한 번)
    for (const r of rit.values()) if (r.place === place && !r.joined.has(p.nick)) { r.joined.add(p.nick); bump(p, 'ritual'); }
  }
  function end(p, r) {
    const a = p.act;
    if (!a) return;
    p.act = null; acting.delete(p);
    const A = ACTS[a.k];
    if (A.s && p.s === A.s) Object.assign(p, a.prev); // 행동 전 상태로 (그 사이 직접 바꿨으면 그대로)
    if (a.k === 'bow' && r === 'done') bump(p, 'bows'); // 절은 끝까지 해야 한 번
    ctx.bcast({ t: 'actend', id: p.id, k: a.k, r, s: p.s });
    if (A.s) ctx.info(p);
    if (a.k === 'sing' && praise && ![...acting].some((q) => q.act.k === 'sing')) { praise = null; pushShrine(); } // 마지막 사람이 그만두면 반주도 멈춤
  }
  function act(p, m) {
    if (m.k === 'stop') return end(p, 'stop');
    const A = ACTS[m.k], now = ctx.now();
    if (!A || !Number.isInteger(m.spot)) return;
    const no = (error) => ctx.send(p, { t: 'actno', k: m.k, error });
    if (now - (p.actAt || 0) < GAP) return; // 너무 자주 누르면 조용히 무시
    if (p.act?.k === m.k) return A.hold ? end(p, 'stop') : undefined; // 그만할 때까지 하는 건 다시 누르면 그만, 한 번 하는 건 끝날 때까지 무시
    if (p.game || p.transit || p.fish || p.fl) return no('지금은 할 수 없어요');
    const sp = SPOTS[m.spot], here = placeOf(p.x, p.z);
    let ok;
    if (sp) {
      const seat = SEATS[p.seat];
      ok = A.at.includes(sp.kind) && here === sp.bld && Math.hypot(p.x - sp.x, p.z - sp.z) <= REACH &&
        (SEAT_SPOTS.includes(sp.kind) ? seat?.kind === 'pew' && Math.hypot(seat.x - sp.x, seat.z - sp.z) < 0.1 : p.seat < 0);
    } else ok = m.spot === -1 && A.any && here === A.any;
    if (!ok) return no(sp && SEAT_SPOTS.includes(sp.kind) && p.seat < 0 ? '의자에 앉아서 해 보세요' : '조금 더 가까이 가서 해 보세요');
    if (m.k === 'bell' && now - bellAt < BELL_CD) return no('범종은 조금 뒤에 다시 칠 수 있어요');
    p.actAt = now;
    const place = sp?.bld ?? A.any;
    // 바로 끝나는 토글: 미사포·성가
    if (A.now) {
      if (m.k === 'veil') { p.vl = !p.vl; ctx.bcast({ t: 'veil', id: p.id, on: p.vl ? 1 : 0 }); }
      else { hymn = hymn ? null : { at: now, until: now + HYMN_MS, by: p.nick }; pushShrine(); }
      return joinRitual(p, place);
    }
    if (p.act) end(p, 'switch');
    let lit = false;
    if (m.k === 'bell') bellAt = now;
    else if (m.k === 'lantern') { lanterns[LANTERN_I[sp.id]] = { at: now, by: p.nick }; lit = true; }
    else if (m.k === 'candle') { // 빈 자리(또는 꺼진 자리)에 켜고, 가득 차면 가장 오래된 것을 바꿈
      const st = candles[CANDLE_I[sp.id]];
      let j = st.findIndex((c) => !c || now - c.at >= LIGHT_MS);
      if (j < 0) j = st.reduce((b, c, i) => (c.at < st[b].at ? i : b), 0);
      st[j] = { at: now, by: p.nick }; lit = true; bump(p, 'candles');
    } else if (m.k === 'sing') { if (!praise) { praise = { song: Math.max(0, Math.min(SONGS.length - 1, m.song | 0)), at: now }; lit = true; } bump(p, 'sung'); }
    else if (m.k === 'piano') bump(p, 'played');
    p.act = { k: m.k, spot: sp ? sp.id : -1, at: now, until: A.ms ? now + A.ms : 0, n: 0, prev: { s: p.s, auto: p.auto } };
    acting.add(p); p.w = false;
    ctx.bcast({ t: 'act', id: p.id, k: m.k, spot: p.act.spot, ms: A.ms || 0, s: A.s || p.s, ...(m.k === 'sing' ? { song: praise.song } : {}) }); // 상태 알림보다 먼저 → 화면이 '바뀌었어요' 알림을 안 띄움
    if (A.s) { p.s = A.s; p.auto = false; ctx.info(p); }
    if (lit) pushShrine();
    joinRitual(p, place);
  }
  function bead(p) { // 염주·묵주 알 하나 넘김 (초당 제한)
    const a = p.act, now = ctx.now();
    if (!a || (a.k !== 'beads' && a.k !== 'rosary')) return;
    if (now - (a.bw || 0) >= 1000) { a.bw = now; a.bc = 0; }
    if (++a.bc > BEADS_PER_S) return;
    a.n++;
    if (a.k === 'beads') bump(p, 'beads');
    else if (a.n % ROSARY_BEADS === 0) bump(p, 'rosaries');
  }
  function note(p, m) { // 피아노 음 하나 (건물 안 모두에게, 초당 제한)
    const a = p.act, now = ctx.now();
    if (a?.k !== 'piano' || !Number.isInteger(m.n) || m.n < 0 || m.n > 24) return;
    if (now - (a.nw || 0) >= 1000) { a.nw = now; a.nc = 0; }
    if (++a.nc > NOTES_PER_S) return;
    ctx.bcast({ t: 'note', id: p.id, n: m.n });
  }
  return {
    act, bead, note,
    stop: (p) => end(p, 'cancel'),
    leave(p) { if (!p.act) return; const k = p.act.k; acting.delete(p); p.act = null; if (k === 'sing' && praise && ![...acting].some((q) => q.act.k === 'sing')) { praise = null; pushShrine(); } },
    tick() {
      const now = ctx.now();
      for (const p of acting) if (p.act.until && now >= p.act.until) end(p, 'done');
      let ch = false;
      for (const st of [...candles, lanterns]) st.forEach((c, j) => { if (c && now - c.at >= LIGHT_MS) { st[j] = null; ch = true; } });
      if (hymn && now >= hymn.until) { hymn = null; ch = true; }
      if (ch) pushShrine();
      for (const r of ritualsAt(now)) if (!rit.has(r.key)) { rit.set(r.key, { ...r, joined: new Set() }); ctx.bcast({ t: 'ritual', place: r.place, name: r.name, left: r.until - now }); }
      for (const [k, r] of rit) if (now >= r.until) { rit.delete(k); ctx.bcast({ t: 'ritual', place: r.place, name: r.name, left: 0 }); }
    },
    snapshot() { // welcome 에 실음: 진행 중인 행동·공유 상태·공동 의식
      const now = ctx.now();
      return { acts: [...acting].map((p) => ({ id: p.id, k: p.act.k, spot: p.act.spot, ms: ACTS[p.act.k].ms || 0, el: now - p.act.at })), shrine: shrine(),
        rituals: [...rit.values()].map((r) => ({ place: r.place, name: r.name, left: r.until - now })) };
    },
  };
}
