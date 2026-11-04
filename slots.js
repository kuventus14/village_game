// 1층 슬롯머신: 릴 3개, 가상 칩. 결과는 서버가 정함(crypto 난수). 환수율(RTP)은 아래 enumerate 로 계산 가능.
import crypto from 'node:crypto';

export const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
const STRIP = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 5]; // 릴 한 줄(20칸)에 심볼이 나오는 비율
export const PAY3 = [7, 10, 22, 40, 200, 600]; // 같은 그림 3개일 때 베팅 배수
export const BETS = [10, 50, 100, 500];
export const evaluate = (r) => (r[0] === r[1] && r[1] === r[2] ? PAY3[r[0]] : r.filter((s) => s === 0).length === 2 ? 1 : 0); // 🍒 정확히 2개면 본전
export function rtp() { // 모든 경우의 수(20³)를 세어 계산한 환수율
  let sum = 0;
  for (const a of STRIP) for (const b of STRIP) for (const c of STRIP) sum += evaluate([a, b, c]);
  return sum / STRIP.length ** 3;
}

export function createSlot(ctx, { rand = (n) => crypto.randomInt(n) } = {}) {
  const last = new Map();
  return {
    join(p) { ctx.toPlayer(p, { a: 'ready', bets: BETS, pay: PAY3, symbols: SYMBOLS }); return { ok: true }; },
    leave(p) { last.delete(p.id); },
    tick() {},
    act(p, m) {
      if (m.a !== 'spin' || !BETS.includes(m.bet)) return;
      const t = ctx.now();
      if (t - (last.get(p.id) || 0) < 700) return; // 연타 방지
      if (!ctx.wallet.add(p, -m.bet)) return ctx.toPlayer(p, { a: 'result', error: '칩이 모자라요' });
      last.set(p.id, t);
      const reels = [0, 1, 2].map(() => STRIP[rand(STRIP.length)]), mult = evaluate(reels), win = m.bet * mult;
      if (win) ctx.wallet.add(p, win);
      ctx.toPlayer(p, { a: 'result', reels, mult, win, bet: m.bet });
    },
  };
}
