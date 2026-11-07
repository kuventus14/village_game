// 집 배정 (서버가 심판): 열린 큰길의 집은 미리 지어 둠 → 로그인 계정이 처음 접속할 때(= 가입 직후) 입구에서 가까운 빈 집을 한 채 무료로 자동 배정. 손님(uid 없음)은 없음.
// 주인 목록은 저장소 한 칸('housing')에 { 집터번호: { uid, nick, roof, name } } 로 두고, 계정에도 u.house 를 적음. 열린 집의 80% 가 차면 다음 큰길이 자동으로 열림(housedata.js openAvenues).
// 같은 집을 두 명이 동시에 받지 않도록 메모리에서 동기로 정함(저장은 그 뒤). 지붕 색은 처음엔 집터 번호에 따라 정해지고 주인이 나중에 바꿀 수 있음.
// 집 안(방, roomdata.js): 현관 앞에서 { a:'enter', plot } → 서버가 그 방 현관 안쪽으로 옮김(잠긴 집은 주인만) · { a:'leave' } 나가면 집 문 앞으로 · { a:'lock', on } 주인이 잠그기(안에 있던 손님은 내보냄)
//   { a:'rest', i, s } 의자·소파에 앉기 / 침대에 눕기(가구 i 의 자리 s, 가까이에서·빈 자리만 → 그 자리로 옮겨 자세 + 높이로 앉음, 움직이면 풀림)
//   { a:'furn', list } 주인이 자기 방 가구 배치 저장(가진 수·방 안·단단한 가구 겹침·현관 막음 검사) · { a:'buy', k } 가구 사기(백화점 가까이에서, 칩)
// 메시지 (클라이언트 → 서버) { t:'house', a:'open' } 상태 요청 · { a:'roof', roof } 내 집 지붕 색 바꾸기 / (서버 → 본인) { a:'state', plots, open, mine } · { a:'mine', plot, roof, name } · { a:'no', error } · { a:'in', plot, furn, inv, name, owner, lock, mine } · { a:'out' } · { a:'inv', inv }
//        (서버 → 모두) { a:'owner', plot, o(닉), r(지붕 색 번호), n(문패), l(잠김) } · { a:'open', n(열린 큰길 수) } (서버 → 방 안 사람들) { a:'furn', plot, furn }
import { PLOTS, ROOFS, NAME_MAX, ENTRY, isOpen, openAvenues, setOpenAvenues, plotById } from './public/housedata.js';
import { roomBox, DEFAULT_FURN, DEFAULT_INV, setRoomFurn, cleanFurn, FURN, FURN_STALL, BUY_RANGE, restSpots, REST_RANGE } from './public/roomdata.js';

/* ctx: { store, send(p, o), bcast(o), save(p) (계정에 u.house 저장), onOpen?(n) (큰길이 더 열림), each(fn) (접속자 돌기), warp(p, x, z, ry) (옮기기·모두에게 알림), pose(p, k, h) (자세 + 높이 h 를 모두에게 알림), busy(p) (다른 걸 하는 중), wallet: { add(p, d) } } */
const byEntry = [...PLOTS].sort((a, b) => Math.hypot(a.gate.x - ENTRY.x, a.gate.z - ENTRY.z) - Math.hypot(b.gate.x - ENTRY.x, b.gate.z - ENTRY.z) || a.id - b.id);
export const defaultRoof = (plot) => plot % (ROOFS.length - 1); // 마지막 색(회색)은 주인 없는 집 전용
export function createHouse(ctx) {
  const reg = {}; let open = 1;
  const view = (id) => ({ o: reg[id].nick, r: reg[id].roof, n: reg[id].name, l: reg[id].lock ? 1 : 0 });
  const furnOf = (id) => reg[id].furn ?? DEFAULT_FURN, invOf = (id) => reg[id].inv ?? DEFAULT_INV; // 옛 기록엔 가구가 없음 → 처음 가구
  const inRoom = (id, fn) => ctx.each((q) => { if (q.room === id) fn(q); });
  const no = (p, error) => ctx.send(p, { t: 'house', a: 'no', error });
  const count = () => Object.keys(reg).length;
  const persist = () => ctx.store.set('housing', reg).catch(console.error);
  const snapshot = (p) => ({ plots: Object.fromEntries(Object.keys(reg).map((id) => [id, view(id)])), open, mine: p?.house ?? null, inv: p?.house && reg[p.house.plot] ? invOf(p.house.plot) : null });
  const grow = () => { const n = openAvenues(count()); if (n !== open) { open = n; setOpenAvenues(n); ctx.bcast({ t: 'house', a: 'open', n }); ctx.onOpen?.(n); } };
  return {
    async load() { Object.assign(reg, (await ctx.store.get('housing')) || {}); for (const id in reg) setRoomFurn(+id, furnOf(id)); open = openAvenues(count()); setOpenAvenues(open); return open; },
    snapshot,
    owned: (id) => !!reg[id],
    // 계정이 접속할 때 집이 없으면 한 채 배정 (이미 있으면 그대로, 손님·빈 집이 없으면 null). 접속 직후 welcome 에 들어가도록 addPlayer 앞에서 부름
    assign(p) {
      if (!p.uid || p.house) return p.house ?? null;
      const plot = byEntry.find((q) => isOpen(q, open) && !reg[q.id]);
      if (!plot) return null;
      const roof = defaultRoof(plot.id), name = `${p.nick}의 집`.slice(0, NAME_MAX);
      reg[plot.id] = { uid: p.uid, nick: p.nick, roof, name }; setRoomFurn(plot.id, DEFAULT_FURN); // 동기로 먼저 적어 동시에 들어온 다른 사람과 겹치지 않음
      p.house = { plot: plot.id, roof, name }; ctx.save(p); persist();
      ctx.bcast({ t: 'house', a: 'owner', plot: plot.id, ...view(plot.id) });
      grow();
      return p.house;
    },
    leave(p) { // 방에서 나가 집 문 앞으로 (방 안에 있지 않으면 아무것도 안 함)
      if (!p.room) return false;
      const pl = plotById(p.room), out = Math.cos(pl.door.face) > 0 ? 2.6 : -2.6; p.room = 0;
      ctx.warp(p, pl.door.x, pl.door.z + out, pl.door.face); ctx.send(p, { t: 'house', a: 'out' }); return true;
    },
    act(p, m) {
      if (!m || typeof m.a !== 'string') return;
      if (m.a === 'open') return ctx.send(p, { t: 'house', a: 'state', ...snapshot(p) });
      if (m.a === 'enter') {
        const pl = Number.isInteger(m.plot) ? plotById(m.plot) : null, r = pl && reg[pl.id];
        if (!pl || p.room) return;
        if (!r) return no(p, '아직 주인이 없는 집이에요');
        if (ctx.busy(p) || p.fl) return no(p, '지금은 들어갈 수 없어요');
        if (Math.hypot(p.x - pl.door.x, p.z - pl.door.z) > 5) return no(p, '현관 앞으로 가까이 가 주세요');
        if (r.lock && r.uid !== p.uid) return no(p, '🔒 주인이 문을 잠갔어요');
        const b = roomBox(pl.id); p.room = pl.id; ctx.warp(p, b.entry.x, b.entry.z, b.entry.ry);
        return ctx.send(p, { t: 'house', a: 'in', plot: pl.id, furn: furnOf(pl.id), inv: r.uid === p.uid ? invOf(pl.id) : null, name: r.name, owner: r.nick, lock: !!r.lock, mine: r.uid === p.uid });
      }
      if (m.a === 'leave') return void this.leave(p);
      if (m.a === 'rest') { // 가구에 앉기·눕기: 방 안에서, 그 자리 가까이, 비어 있을 때만
        if (!p.room || !Number.isInteger(m.i) || !Number.isInteger(m.s)) return;
        const sp = restSpots(furnOf(p.room)).find((q) => q.i === m.i && q.s === m.s);
        if (!sp) return;
        const b = roomBox(p.room), key = `${p.room}:${m.i}:${m.s}`;
        if (ctx.busy(p)) return no(p, '지금은 할 수 없어요');
        if (Math.hypot(p.x - b.cx - sp.x, p.z - b.cz - sp.z) > REST_RANGE + 0.8) return no(p, '조금 더 가까이 가 주세요');
        let taken = false; ctx.each((q) => { if (q !== p && q.restKey === key) taken = true; });
        if (taken) return no(p, '누가 이미 쓰고 있어요');
        ctx.warp(p, b.cx + sp.x, b.cz + sp.z, sp.ry); p.restKey = key; ctx.pose(p, sp.pose, sp.h);
        return;
      }
      if (m.a === 'lock') {
        if (!p.house) return no(p, '아직 내 집이 없어요');
        reg[p.house.plot].lock = !!m.on; persist(); ctx.bcast({ t: 'house', a: 'owner', plot: p.house.plot, ...view(p.house.plot) });
        if (m.on) inRoom(p.house.plot, (q) => { if (q.uid !== p.uid) { this.leave(q); ctx.send(q, { t: 'house', a: 'no', error: '🔒 주인이 문을 잠갔어요' }); } });
        return;
      }
      if (m.a === 'furn') { // 내 방 안에서만, 가구 배치 저장
        if (!p.house || p.room !== p.house.plot) return no(p, '내 집 안에서만 꾸밀 수 있어요');
        const id = p.house.plot, list = cleanFurn(m.list, invOf(id)); reg[id].furn = list; reg[id].inv ??= { ...DEFAULT_INV }; setRoomFurn(id, list); persist();
        return inRoom(id, (q) => ctx.send(q, { t: 'house', a: 'furn', plot: id, furn: list }));
      }
      if (m.a === 'buy') { // 가구 백화점: 칩으로 사서 창고(inv)에 넣음, 방에 놓는 건 따로 (furn)
        const c = FURN[m.k];
        if (!p.house || !c || !c.price) return;
        if (ctx.busy(p) || Math.hypot(p.x - FURN_STALL.x, p.z - FURN_STALL.z) > BUY_RANGE) return no(p, '가구 백화점 가까이 가서 사 주세요');
        const r = reg[p.house.plot]; r.inv ??= { ...DEFAULT_INV };
        if ((r.inv[m.k] ?? 0) >= 9) return no(p, '같은 가구는 9개까지 가질 수 있어요');
        if (!ctx.wallet.add(p, -c.price)) return no(p, '칩이 모자라요');
        r.inv[m.k] = (r.inv[m.k] ?? 0) + 1; persist();
        return ctx.send(p, { t: 'house', a: 'inv', inv: r.inv, bought: m.k });
      }
      if (m.a !== 'roof') return;
      if (!p.house) return no(p, '아직 내 집이 없어요');
      if (!Number.isInteger(m.roof) || m.roof < 0 || m.roof >= ROOFS.length - 1) return;
      reg[p.house.plot].roof = p.house.roof = m.roof; ctx.save(p); persist();
      ctx.bcast({ t: 'house', a: 'owner', plot: p.house.plot, ...view(p.house.plot) });
      ctx.send(p, { t: 'house', a: 'mine', ...p.house });
    },
  };
}
