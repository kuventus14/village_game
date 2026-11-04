// 카지노 3층 블랙잭(가상 칩만): 6덱 슈, 딜러 소프트 17 스탠드, 블랙잭 3:2, 더블·스플릿 1회. 시간은 ctx.now() 로만.
import { randomInt } from 'node:crypto';

const RANKS = 'A23456789TJQK', SUITS = 'shdc';
export const MIN = 10, MAX = 500, CHAIRS = 5, BET_MS = 12000, TURN_MS = 15000, RESULT_MS = 4000;

export function newShoe(decks = 6) {
  const a = [];
  for (let d = 0; d < decks; d++) for (const r of RANKS) for (const s of SUITS) a.push(r + s);
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const val = (c) => Math.min(RANKS.indexOf(c[0]) + 1, 10); // A=1, TJQK=10
export function score(cards) {
  let t = 0, ace = false;
  for (const c of cards) { t += val(c); if (c[0] === 'A') ace = true; }
  const soft = ace && t + 10 <= 21;
  return { total: soft ? t + 10 : t, soft };
}
const isBJ = (cards, split) => !split && cards.length === 2 && score(cards).total === 21;

export function createBlackjack(ctx, opts = {}) {
  const mkShoe = opts.shoe ?? newShoe;
  const now = () => ctx.now();
  const tables = new Map(), where = new Map(); // tbl → 테이블, p.id → 테이블
  const table = (tbl) => {
    if (!tables.has(tbl)) tables.set(tbl, { tbl, phase: 'bet', seq: 0, until: 0, seats: Array(CHAIRS).fill(null), dealer: [], hole: false, turn: null, shoe: [], si: 0 });
    return tables.get(tbl);
  };
  const chairOf = (t, p) => t.seats.findIndex((s) => s?.p.id === p.id);
  const draw = (t) => { if (t.si >= t.shoe.length) { t.shoe = mkShoe(); t.si = 0; } return t.shoe[t.si++]; };
  const canDouble = (h) => !h.done && h.cards.length === 2;
  const canSplit = (s, h) => !h.done && s.hands.length === 1 && h.cards.length === 2 && val(h.cards[0]) === val(h.cards[1]);

  function view(t, me) {
    const dc = t.hole ? [t.dealer[0], null] : [...t.dealer]; // 복사본: 보낸 뒤 판이 바뀌어도 메시지는 그대로
    const seats = t.seats.map((s) => s && {
      id: s.p.id, nick: s.p.nick, lastBet: s.lastBet,
      bet: s.hands.length ? s.hands.reduce((a, h) => a + h.bet, 0) : s.bet,
      net: t.phase === 'result' ? s.hands.reduce((a, h) => a + h.delta, 0) : 0,
      hands: s.hands.map((h) => ({ cards: [...h.cards], ...score(h.cards), bet: h.bet, dbl: h.dbl, done: h.done, res: h.res, delta: h.delta })),
    });
    let can = null;
    if (t.phase === 'play' && t.turn?.c === me) {
      const s = t.seats[me], h = s.hands[t.turn.h], c = ctx.wallet.chips(s.p);
      can = { hit: true, stand: true, double: canDouble(h) && c >= h.bet, split: canSplit(s, h) && c >= h.bet };
    }
    return {
      tbl: t.tbl, phase: t.phase, seq: t.seq, you: me, min: MIN, max: MAX,
      left: t.until ? Math.max(0, t.until - now()) : 0, turn: t.turn && { ...t.turn }, can, seats,
      dealer: { cards: dc, total: score(dc.filter(Boolean)).total, bj: !t.hole && isBJ(t.dealer) },
    };
  }
  function push(t) {
    t.seq++;
    t.seats.forEach((s, c) => s && ctx.toPlayer(s.p, { state: view(t, c) }));
  }

  function deal(t) {
    const ps = t.seats.filter((s) => s?.bet);
    if (!ps.length) { t.until = 0; return push(t); }
    if (t.shoe.length - t.si < t.shoe.length * 0.25) { t.shoe = mkShoe(); t.si = 0; } // 슈 25% 미만이면 새로 섞음
    for (const s of ps) { s.hands = [{ cards: [], bet: s.bet, dbl: false, split: false, done: false, res: null, delta: 0 }]; s.lastBet = s.bet; s.bet = 0; }
    for (let k = 0; k < 2; k++) { for (const s of ps) s.hands[0].cards.push(draw(t)); t.dealer.push(draw(t)); }
    t.hole = true; t.phase = 'play';
    const dBJ = isBJ(t.dealer); // 딜러 블랙잭이면 바로 정산(피크)
    for (const s of ps) if (dBJ || isBJ(s.hands[0].cards)) s.hands[0].done = true;
    next(t, true);
  }

  // 다음 안 끝난 손에 차례를 줌. 차례가 바뀌거나 fresh 일 때만 제한시간을 새로 잼(남의 퇴장이 시간을 늘리지 않게)
  function next(t, fresh) {
    for (const [c, s] of t.seats.entries()) if (s) for (const [h, x] of s.hands.entries()) if (!x.done) {
      if (fresh || t.turn?.c !== c || t.turn?.h !== h) t.until = now() + TURN_MS;
      t.turn = { c, h };
      return push(t);
    }
    finish(t);
  }

  function finish(t) {
    t.hole = false; t.turn = null;
    const hands = t.seats.flatMap((s) => s?.hands ?? []);
    const dBJ = isBJ(t.dealer);
    // 살아 있는 일반 손이 있을 때만 딜러가 뽑음(소프트 17 포함 17 이상이면 멈춤)
    if (!dBJ && hands.some((h) => score(h.cards).total <= 21 && !isBJ(h.cards, h.split))) while (score(t.dealer).total < 17) t.dealer.push(draw(t));
    const d = score(t.dealer).total;
    for (const s of t.seats) if (s) for (const h of s.hands) {
      const pt = score(h.cards).total, bj = isBJ(h.cards, h.split);
      let pay = 0;
      if (pt > 21) h.res = 'bust';
      else if (bj) { h.res = dBJ ? 'push' : 'bj'; pay = dBJ ? h.bet : h.bet + Math.floor(h.bet * 3 / 2); } // shortcut: 홀수 베팅의 0.5칩은 버림
      else if (dBJ || (d <= 21 && d > pt)) h.res = 'lose';
      else if (d === pt) { h.res = 'push'; pay = h.bet; }
      else { h.res = 'win'; pay = h.bet * 2; }
      if (pay) ctx.wallet.add(s.p, pay);
      h.delta = pay - h.bet; h.done = true;
    }
    t.phase = 'result'; t.until = now() + RESULT_MS;
    push(t);
  }

  function newRound(t) {
    Object.assign(t, { phase: 'bet', until: 0, dealer: [], hole: false, turn: null });
    for (const s of t.seats) if (s) s.hands = [];
    push(t);
  }

  const api = {
    join(p, seat) {
      if (!Number.isInteger(seat?.chair) || seat.chair < 0 || seat.chair >= CHAIRS) return { ok: false, error: '없는 자리예요' };
      api.leave(p);
      const t = table(seat.tbl ?? 0);
      if (t.seats[seat.chair]) return { ok: false, error: '이미 누가 앉아 있어요' };
      t.seats[seat.chair] = { p, bet: 0, lastBet: 0, hands: [] };
      where.set(p.id, t);
      push(t);
      return { ok: true };
    },
    leave(p) {
      const t = where.get(p.id);
      if (!t) return;
      where.delete(p.id);
      const c = chairOf(t, p), s = t.seats[c];
      t.seats[c] = null;
      if (s.bet) ctx.wallet.add(p, s.bet); // 딜 전 베팅은 환급, 딜 후 손에 걸린 칩은 몰수(이미 빠져 있음)
      if (t.phase === 'bet' && !t.seats.some((x) => x?.bet)) t.until = 0;
      if (t.phase === 'play') return next(t, false);
      push(t);
    },
    act(p, m) {
      const t = where.get(p.id);
      if (!t || !m) return;
      const c = chairOf(t, p), s = t.seats[c];
      const err = (error) => ctx.toPlayer(p, { error });
      if (m.a === 'bet' || m.a === 'cancel') {
        if (t.phase !== 'bet') return err('지금은 베팅할 수 없어요');
        const amt = m.a === 'cancel' ? 0 : m.amount;
        if (m.a === 'bet' && !(Number.isInteger(amt) && amt >= MIN && amt <= MAX)) return err(`베팅은 ${MIN}~${MAX}칩이에요`);
        if (amt === s.bet) return;
        if (!ctx.wallet.add(p, s.bet - amt)) return err('칩이 모자라요');
        s.bet = amt;
        t.until = t.seats.some((x) => x?.bet) ? t.until || now() + BET_MS : 0; // 첫 베팅부터 마감 타이머
        return push(t);
      }
      if (t.phase !== 'play' || t.turn?.c !== c) return;
      const h = s.hands[t.turn.h];
      if (m.a === 'hit') {
        h.cards.push(draw(t));
        if (score(h.cards).total >= 21) h.done = true;
      } else if (m.a === 'stand') h.done = true;
      else if (m.a === 'double') {
        if (!canDouble(h)) return err('더블은 처음 두 장일 때만 돼요');
        if (!ctx.wallet.add(p, -h.bet)) return err('칩이 모자라 더블할 수 없어요');
        h.bet *= 2; h.dbl = true; h.cards.push(draw(t)); h.done = true;
      } else if (m.a === 'split') {
        if (!canSplit(s, h)) return err('같은 숫자 두 장일 때 한 번만 나눌 수 있어요');
        if (!ctx.wallet.add(p, -h.bet)) return err('칩이 모자라 스플릿할 수 없어요');
        h.split = true;
        s.hands.push({ ...h, cards: [h.cards.pop()] });
        for (const x of s.hands) {
          x.cards.push(draw(t));
          if (x.cards[0][0] === 'A' || score(x.cards).total === 21) x.done = true; // 스플릿 에이스는 한 장만
        }
      } else return;
      next(t, true);
    },
    tick() {
      for (const t of tables.values()) {
        if (!t.until || now() < t.until) continue;
        if (t.phase === 'bet') deal(t);
        else if (t.phase === 'play') { t.seats[t.turn.c].hands[t.turn.h].done = true; next(t, true); } // 시간 초과는 스탠드
        else if (t.phase === 'result') newRound(t);
      }
    },
  };
  return api;
}
