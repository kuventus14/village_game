// 물고기 가게 규칙 (서버가 심판): 낚은 물고기는 가방(p.bag)에 쌓이고, 가게 가까이에서 팔면 칩(카지노와 같은 돈)을 받음. 하루 DAILY_CAP 마리까지.
// 쓰레기(값 0)는 가방에 안 담김. 가방·오늘 판 수는 계정에 저장(손님은 이번 접속 동안만). 시간은 ctx.now() 로만 → 가짜 시계로 시험
// 메시지 (클라이언트 → 서버) { t:'shop', a:'sell', k, n? } 한 종류 팔기(n 없으면 1마리) · { a:'sellall', k? } 가방 전부(k 있으면 그 종류만) · { a:'open' } 가방 상태 요청
//        (서버 → 본인)   { t:'shop', a:'state', bag, sold, cap } 가방이 바뀔 때 · { a:'sold', items:[[k,n,gain]], gain, bag, sold, cap } 판 결과 · { a:'no', error }
import { FISH_BY } from './public/fishdata.js';
import { FISH_STALL, SELL_RANGE, DAILY_CAP, priceOf, sellable, dayIndex } from './public/shopdata.js';

/* ctx: { now(), send(p, o), wallet: { add(p, d) }, save(p) } */
export function createShop(ctx) {
  const fresh = (p) => { p.bag ??= {}; const d = dayIndex(ctx.now()); if (p.soldDay !== d) { p.soldDay = d; p.sold = 0; } p.sold ||= 0; return p; }; // 날이 바뀌면 오늘 판 수 0
  const snapshot = (p) => { fresh(p); return { bag: { ...p.bag }, sold: p.sold, cap: DAILY_CAP }; };
  const no = (p, error) => ctx.send(p, { t: 'shop', a: 'no', error });
  const total = (p) => Object.values(p.bag).reduce((a, b) => a + b, 0);
  function sell(p, plan) { // plan: [[k, n]] 를 차례로, 오늘 한도 안에서 판다
    fresh(p); let left = DAILY_CAP - p.sold; const items = []; let gain = 0;
    for (const [k, want] of plan) {
      const n = Math.min(want, p.bag[k] || 0, left); if (n <= 0) continue;
      const g = n * priceOf(k); items.push([k, n, g]); gain += g; left -= n;
    }
    if (!items.length) return no(p, p.sold >= DAILY_CAP ? `오늘은 더 팔 수 없어요 · 하루 ${DAILY_CAP}마리까지, 내일 다시 와요` : '팔 물고기가 없어요');
    if (!ctx.wallet.add(p, gain)) return no(p, '지금은 팔 수 없어요');
    for (const [k, n] of items) { p.bag[k] -= n; if (p.bag[k] <= 0) delete p.bag[k]; p.sold += n; }
    ctx.save(p);
    ctx.send(p, { t: 'shop', a: 'sold', items, gain, ...snapshot(p) });
  }
  return {
    snapshot,
    // 낚은 물고기를 가방에 (값 0 인 쓰레기는 안 담음)
    add(p, k) { if (!sellable(k)) return false; fresh(p); p.bag[k] = (p.bag[k] || 0) + 1; ctx.save(p); ctx.send(p, { t: 'shop', a: 'state', ...snapshot(p) }); return true; },
    act(p, m) {
      if (!m || typeof m.a !== 'string') return;
      if (m.a === 'open') return ctx.send(p, { t: 'shop', a: 'state', ...snapshot(p) });
      if (p.fl || p.seat >= 0 || p.game || p.transit || p.fish || p.ride) return no(p, '지금은 팔 수 없어요');
      if (Math.hypot(p.x - FISH_STALL.x, p.z - FISH_STALL.z) > SELL_RANGE) return no(p, '가게 가까이 가서 팔아 주세요');
      fresh(p);
      if (m.a === 'sell') {
        if (typeof m.k !== 'string' || !Object.hasOwn(FISH_BY, m.k)) return;
        const n = Number.isInteger(m.n) && m.n > 0 ? Math.min(m.n, 999) : 1;
        return sell(p, [[m.k, n]]);
      }
      if (m.a === 'sellall') {
        const ks = typeof m.k === 'string' ? [m.k] : Object.keys(p.bag);
        return sell(p, ks.filter((k) => Object.hasOwn(FISH_BY, k)).sort((a, b) => priceOf(b) - priceOf(a)).map((k) => [k, p.bag[k] || 0])); // 비싼 것부터 (한도가 있으니)
      }
    },
    total,
  };
}
