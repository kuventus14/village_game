// 옷 가게 규칙 (서버가 심판): 가게 가까이에서 칩으로 옷·꾸미기를 사면 계정에 영원히 남음(p.closet). 로그인한 계정만(손님은 아바타를 못 바꿈).
// 입는 건 아바타 꾸미기에서 — 안 산 유료 옷은 서버(auth.js avatar)가 거절. 값·자리는 public/closet.js
// 메시지 (클라이언트 → 서버) { t:'closet', a:'buy', i:'os3' } 사기 · { a:'open' } 내 옷장 요청 / (서버 → 본인) { t:'closet', a:'state'|'bought', owned:[…], i? } · { a:'no', error }
import { CLOSET_STALL, BUY_RANGE, PRICE, ownedWith } from './public/closet.js';

/* ctx: { send(p, o), wallet: { add(p, d) }, save(p) } */
export function createCloset(ctx) {
  const no = (p, error) => ctx.send(p, { t: 'closet', a: 'no', error });
  const owned = (p) => (p.closet = ownedWith(p.closet, p.a)); // 사 둔 것 + 지금 입고 있는 것(예전 계정 보호)
  return {
    snapshot: (p) => ({ owned: owned(p) }),
    act(p, m) {
      if (!m || typeof m.a !== 'string') return;
      if (m.a === 'open') return ctx.send(p, { t: 'closet', a: 'state', owned: owned(p) });
      if (m.a !== 'buy') return;
      if (!p.uid) return no(p, '로그인하면 옷을 살 수 있어요');
      if (typeof m.i !== 'string' || !Object.hasOwn(PRICE, m.i)) return;
      if (p.fl || p.seat >= 0 || p.game || p.transit || p.fish || p.ride) return no(p, '지금은 살 수 없어요');
      if (Math.hypot(p.x - CLOSET_STALL.x, p.z - CLOSET_STALL.z) > BUY_RANGE) return no(p, '가게 가까이 가서 사 주세요');
      if (owned(p).includes(m.i)) return no(p, '이미 가지고 있어요');
      if (!ctx.wallet.add(p, -PRICE[m.i])) return no(p, '칩이 모자라요');
      p.closet.push(m.i); ctx.save(p);
      ctx.send(p, { t: 'closet', a: 'bought', i: m.i, owned: [...p.closet] });
    },
  };
}
