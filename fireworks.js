// 손으로 그리는 불꽃놀이 규칙 (서버가 심판). 한 번 켜면(세션) 30초 안에 최대 8획, 획마다 최대 10초·400점.
// 점은 그리는 사람이 고정한 하늘 평면의 정규화 좌표 [u, v] (-1~1). 받은 점은 캠프 근처(불에서 120m) 사람에게 그대로 방송 → 다른 화면도 실시간으로 그림.
// start 의 kind: 없거나 'sky' = 하늘 불꽃놀이(봇도 이것), 'stick' = 불꽃 스틱(아바타 앞 눈높이 허공 평면, 12획·0.5초 간격, 동시 6명은 하늘과 따로). 평면은 서버가 kind 로 정함
// 시간은 ctx.now(), 색은 ctx.rand() 로만 → 가짜 시계·난수로 시험
import { FW, FW_RANGE, FW_NEAR, FW_PLANE, STICK, STICK_PLANE, fireDist } from './public/world.js';
import { recognize } from './public/shapes.js';
import { CLOSED_MSG } from './camp.js';

const q3 = (n) => Math.round(n * 1000) / 1000 || 0; // -0 도 0 으로
const KINDS = { sky: { L: FW, P: FW_PLANE, full: '지금은 하늘이 꽉 찼어요 · 잠시 뒤에 해 보세요' }, stick: { L: STICK, P: STICK_PLANE, full: '지금은 불꽃 스틱이 다 나갔어요 · 잠시 뒤에 해 보세요' } };
export const validPts = (p) => Array.isArray(p) && p.length >= 1 && p.length <= FW.perMsg && p.every((q) => Array.isArray(q) && q.length === 2 && q.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1));

/* ctx: { now(), rand(), players (Map), send(p, o), open() } */
export function createFireworks(ctx) {
  const live = new Map(); // 사람 id → 세션
  const near = (o, except) => { for (const q of ctx.players.values()) if (q !== except && fireDist(q.x, q.z) <= FW_NEAR) ctx.send(q, o); };
  const no = (p, error) => ctx.send(p, { t: 'fwno', error });
  function pop(s) { // 지금 획을 터뜨림 (점이 없으면 그냥 닫음)
    const c = s.cur; s.cur = null;
    if (!c?.pts.length) return;
    const shape = recognize(c.pts);
    s.strokes.push({ pts: c.pts, shape });
    near({ t: 'fw', k: 'pop', id: s.p.id, n: s.strokes.length - 1, shape });
    if (s.strokes.length >= s.L.maxStrokes) end(s.p, 'done');
  }
  function end(p, r) {
    const s = live.get(p.id); if (!s) return;
    live.delete(p.id); // 먼저 지워서 pop → end 가 다시 불리지 않게
    if (s.cur) { const c = s.cur; s.cur = null; if (c.pts.length) { const shape = recognize(c.pts); s.strokes.push({ pts: c.pts, shape }); near({ t: 'fw', k: 'pop', id: p.id, n: s.strokes.length - 1, shape }); } } // 그리던 획도 끝까지 터짐
    p.fw = null; p.fwEnd = ctx.now();
    near({ t: 'fw', k: 'end', id: p.id, r, shapes: s.strokes.map((x) => x.shape).filter(Boolean) });
  }
  function start(p, m) {
    const now = ctx.now();
    if (live.has(p.id)) return;
    const kind = m.kind ?? 'sky', K = Object.hasOwn(KINDS, kind) ? KINDS[kind] : null;
    if (!K) return no(p, '알 수 없는 불꽃이에요');
    if (!ctx.open()) return no(p, CLOSED_MSG);
    if (p.game || p.transit || p.fish || p.act || p.fl) return no(p, '지금은 할 수 없어요');
    if (fireDist(p.x, p.z) > FW_RANGE) return no(p, '모닥불 가까이(18m 안)에서 할 수 있어요');
    if (!Number.isFinite(m.ry)) return;
    if (now - (p.fwEnd ?? -Infinity) < K.L.cooldown) return no(p, '불꽃을 다시 준비하고 있어요 · 조금 뒤에 해 보세요');
    if ([...live.values()].filter((x) => x.kind === kind).length >= K.L.maxActive) return no(p, K.full);
    const ry = q3(m.ry), plane = { x: q3(p.x + Math.sin(ry) * K.P.d), y: K.P.y, z: q3(p.z + Math.cos(ry) * K.P.d), ry, ...(kind === 'stick' && { hu: K.P.hu, hv: K.P.hv }) };
    const s = { p, kind, L: K.L, plane, c: q3(ctx.rand()), t0: now, strokes: [], cur: null, lastDown: -Infinity, win: { t: now, n: 0 } };
    live.set(p.id, s); p.fw = 1; p.w = false;
    near({ t: 'fw', k: 'start', id: p.id, name: p.nick, plane, c: s.c, kind });
  }
  function act(p, m) {
    if (m.k === 'start') return start(p, m);
    const s = live.get(p.id), now = ctx.now();
    if (!s) return;
    if (m.k === 'stop') return end(p, 'stop');
    if (m.k === 'down') {
      if (s.cur || s.strokes.length >= s.L.maxStrokes || now - s.lastDown < s.L.strokeGap) return; // 너무 빨리 다음 획: 조용히 무시 (화면도 같은 규칙)
      s.cur = { pts: [], t0: now }; s.lastDown = now;
    } else if (m.k === 'pts') {
      if (!s.cur || !validPts(m.p)) return; // 범위 밖·NaN·너무 많음 → 통째로 버림
      if (now - s.win.t >= 1000) s.win = { t: now, n: 0 };
      const room = Math.min(s.L.ptsPerSec - s.win.n, s.L.maxPts - s.cur.pts.length);
      if (room <= 0) return;
      const p2 = m.p.slice(0, room).map(([u, v]) => [q3(u), q3(v)]);
      s.win.n += p2.length; s.cur.pts.push(...p2);
      near({ t: 'fw', k: 'pts', id: p.id, n: s.strokes.length, p: p2 }, p); // 그린 사람은 이미 자기 화면에 그렸음
      if (s.cur.pts.length >= s.L.maxPts) pop(s);
    } else if (m.k === 'up') pop(s);
  }
  return {
    act,
    stop: (p) => end(p, 'cancel'),
    leave: (p) => end(p, 'leave'),
    busy: (p) => live.has(p.id),
    tick() {
      const now = ctx.now(), open = ctx.open();
      for (const s of [...live.values()]) {
        if (!open) end(s.p, 'closed'); // 06:00: 그리던 획까지 터뜨리고 끝
        else if (now - s.t0 >= s.L.sessionMs) end(s.p, 'time');
        else if (s.cur && now - s.cur.t0 >= s.L.strokeMs) pop(s);
      }
    },
    snapshot() { // welcome 에 실음: 진행 중인 불꽃 (늦게 온 사람도 하늘에서 보게)
      const now = ctx.now();
      return [...live.values()].map((s) => ({ id: s.p.id, name: s.p.nick, kind: s.kind, plane: s.plane, c: s.c, el: now - s.t0, strokes: s.strokes.map((x) => x.pts), cur: s.cur?.pts ?? null }));
    },
  };
}
