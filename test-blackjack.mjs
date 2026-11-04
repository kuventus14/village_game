// 블랙잭 서버 시험: 가짜 시계·지갑·우편함. node test-blackjack.mjs
import assert from 'node:assert/strict';
import { createBlackjack, newShoe, BET_MS, TURN_MS, RESULT_MS } from './blackjack.js';

let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok', name); };

function setup(stack, opts = {}) {
  const env = { clock: 0, ps: [] };
  const ctx = {
    now: () => env.clock,
    wallet: { chips: (p) => p.chips, add: (p, d) => (p.chips + d < 0 ? false : ((p.chips += d), true)) },
    toPlayer: (p, m) => p.inbox.push(m),
    players: new Map(),
  };
  // 정해진 카드 뒤에 무작위 슈를 이어 붙임(딜 순서: 각 자리 1장 → 딜러 업 → 각 자리 1장 → 딜러 홀)
  const shoe = opts.shoe ?? (stack ? (() => { let first = true; return () => (first ? ((first = false), [...stack, ...newShoe()]) : newShoe()); })() : undefined);
  env.bj = createBlackjack(ctx, { shoe });
  env.add = (chips = 1000) => { const p = { id: env.ps.length + 1, nick: `P${env.ps.length}`, chips, inbox: [] }; env.ps.push(p); ctx.players.set(p.id, p); return p; };
  env.st = (p) => p.inbox.findLast((m) => m.state)?.state;
  env.err = (p) => p.inbox.findLast((m) => m.error)?.error;
  env.go = (ms) => { env.clock += ms; env.bj.tick(); };
  return env;
}
// 한 판: 자리마다 100 베팅 후 마감까지 시계를 돌림
function round(stack, n = 1, chips = 1000) {
  const e = setup(stack);
  const ps = Array.from({ length: n }, (_, i) => { const p = e.add(chips); e.bj.join(p, { tbl: 0, chair: i }); e.bj.act(p, { a: 'bet', amount: 100 }); return p; });
  e.go(BET_MS);
  return { e, ps };
}

/* (1) 정해진 덱 정산 */
test('블랙잭 3:2', () => {
  const { e, ps: [p] } = round(['As', '9s', 'Kh', '7d']);
  const s = e.st(p);
  assert.equal(s.phase, 'result');
  assert.equal(s.seats[0].hands[0].res, 'bj');
  assert.equal(p.chips, 1150);
});
test('푸시', () => {
  const { e, ps: [p] } = round(['Ts', '9s', '8h', '9d']);
  e.bj.act(p, { a: 'stand' });
  assert.equal(e.st(p).seats[0].hands[0].res, 'push');
  assert.equal(p.chips, 1000);
});
test('버스트(딜러는 안 뽑음)', () => {
  const { e, ps: [p] } = round(['Ts', '9s', '6h', '8d', 'Kc']);
  e.bj.act(p, { a: 'hit' });
  const s = e.st(p);
  assert.equal(s.seats[0].hands[0].res, 'bust');
  assert.equal(s.dealer.cards.length, 2);
  assert.equal(p.chips, 900);
});
test('딜러 버스트', () => {
  const { e, ps: [p] } = round(['Ts', '6s', '8h', 'Td', '9c']);
  assert.deepEqual(e.st(p).dealer.cards, ['6s', null]); // 홀 카드 숨김
  e.bj.act(p, { a: 'stand' });
  const s = e.st(p);
  assert.deepEqual(s.dealer.cards, ['6s', 'Td', '9c']);
  assert.equal(s.seats[0].hands[0].res, 'win');
  assert.equal(p.chips, 1100);
});
test('딜러 소프트 17 스탠드', () => {
  const { e, ps: [p] } = round(['Ts', 'As', '8h', '6d']);
  e.bj.act(p, { a: 'stand' });
  assert.equal(e.st(p).dealer.cards.length, 2);
  assert.equal(p.chips, 1100);
});
test('더블', () => {
  const { e, ps: [p] } = round(['6s', '9s', '5h', '7d', 'Tc', '2c']);
  assert.equal(e.st(p).can.double, true);
  e.bj.act(p, { a: 'double' });
  const h = e.st(p).seats[0].hands[0];
  assert.equal(h.cards.length, 3); assert.equal(h.bet, 200); assert.equal(h.res, 'win');
  assert.equal(p.chips, 1200);
});
test('스플릿', () => {
  const { e, ps: [p] } = round(['8s', '6s', '8h', 'Td', '3c', 'Tc', 'Kd', '9s']);
  e.bj.act(p, { a: 'split' });
  assert.equal(p.chips, 800);
  e.bj.act(p, { a: 'hit' }); // 8 3 K = 21 → 자동 종료
  e.bj.act(p, { a: 'stand' }); // 8 T
  const s = e.st(p);
  assert.deepEqual(s.seats[0].hands.map((h) => h.res), ['win', 'win']);
  assert.equal(p.chips, 1200);
});
test('스플릿 에이스는 한 장씩, 21 은 1:1', () => {
  const { e, ps: [p] } = round(['As', '9s', 'Ah', '8d', 'Kc', '9c']);
  e.bj.act(p, { a: 'split' });
  const s = e.st(p);
  assert.equal(s.phase, 'result');
  assert.deepEqual(s.seats[0].hands.map((h) => [h.cards.length, h.res, h.delta]), [[2, 'win', 100], [2, 'win', 100]]);
  assert.equal(p.chips, 1200);
});
test('딜러 블랙잭: 플레이어 블랙잭만 푸시', () => {
  const { e, ps: [a, b] } = round(['As', 'Ts', 'Ah', 'Kd', '9h', 'Kc'], 2);
  const s = e.st(a);
  assert.equal(s.phase, 'result'); assert.equal(s.dealer.bj, true);
  assert.equal(s.seats[0].hands[0].res, 'push'); assert.equal(s.seats[1].hands[0].res, 'lose');
  assert.equal(a.chips, 1000); assert.equal(b.chips, 900);
});

/* (3) 시간 초과 */
test('대기·베팅 마감·차례 시간 초과·다음 판', () => {
  const e = setup(['Ts', '9s', '8h', '8d']);
  const p = e.add(); e.bj.join(p, { tbl: 0, chair: 2 });
  e.go(60000);
  assert.equal(e.st(p).phase, 'bet'); assert.equal(e.st(p).left, 0); // 아무도 안 걸면 계속 대기
  e.bj.act(p, { a: 'bet', amount: 50 }); e.bj.act(p, { a: 'bet', amount: 100 }); // 금액 바꾸기
  assert.equal(p.chips, 900);
  e.go(BET_MS - 1); assert.equal(e.st(p).phase, 'bet');
  e.go(1); assert.equal(e.st(p).phase, 'play'); assert.equal(e.st(p).left, TURN_MS);
  e.go(TURN_MS); // 18 스탠드, 딜러 17
  assert.equal(e.st(p).seats[2].hands[0].res, 'win'); assert.equal(p.chips, 1100);
  e.go(RESULT_MS); assert.equal(e.st(p).phase, 'bet'); assert.deepEqual(e.st(p).seats[2].hands, []);
  assert.equal(e.st(p).seats[2].lastBet, 100);
});
test('베팅 취소하면 타이머도 멈춤', () => {
  const e = setup();
  const p = e.add(); e.bj.join(p, { tbl: 0, chair: 0 });
  e.bj.act(p, { a: 'bet', amount: 30 }); e.bj.act(p, { a: 'cancel' });
  assert.equal(p.chips, 1000);
  e.go(BET_MS); assert.equal(e.st(p).phase, 'bet');
});

/* (4) 판 중 퇴장 */
test('판 중 퇴장은 몰수, 차례 넘어감, 남의 시간은 그대로', () => {
  const { e, ps: [a, b, c] } = round(['Ts', 'Th', 'Tc', '9s', '6h', '7h', '7c', '8d'], 3);
  assert.deepEqual(e.st(a).turn, { c: 0, h: 0 });
  e.go(5000);
  e.bj.leave(c); // 차례 아닌 사람이 나가도 a 의 남은 시간은 그대로
  assert.equal(e.st(a).left, TURN_MS - 5000);
  e.bj.leave(a); e.bj.leave(a); // 두 번 불려도 안전
  assert.equal(a.chips, 900); assert.equal(c.chips, 900);
  assert.equal(e.st(b).seats[0], null); assert.deepEqual(e.st(b).turn, { c: 1, h: 0 });
  e.bj.act(b, { a: 'stand' }); // 17 대 17
  assert.equal(e.st(b).seats[1].hands[0].res, 'push'); assert.equal(b.chips, 1000);
});
test('딜 전 퇴장은 환급', () => {
  const e = setup();
  const p = e.add(); e.bj.join(p, { tbl: 0, chair: 0 });
  e.bj.act(p, { a: 'bet', amount: 200 }); e.bj.leave(p);
  assert.equal(p.chips, 1000);
});
test('자리 중복·잘못된 자리 거절', () => {
  const e = setup();
  const a = e.add(), b = e.add();
  assert.equal(e.bj.join(a, { tbl: 0, chair: 1 }).ok, true);
  assert.equal(e.bj.join(b, { tbl: 0, chair: 1 }).ok, false);
  assert.equal(e.bj.join(b, { tbl: 0, chair: 5 }).ok, false);
});

/* (5) 칩 부족 */
test('칩 부족이면 베팅·더블·스플릿 거절', () => {
  const { e, ps: [p] } = round(['8s', '9s', '8h', '7d'], 1, 150);
  assert.equal(p.chips, 50);
  assert.equal(e.st(p).can.double, false); assert.equal(e.st(p).can.split, false);
  e.bj.act(p, { a: 'double' }); assert.match(e.err(p), /칩이 모자라/);
  e.bj.act(p, { a: 'split' }); assert.match(e.err(p), /칩이 모자라/);
  assert.equal(p.chips, 50); assert.equal(e.st(p).seats[0].hands.length, 1); assert.equal(e.st(p).seats[0].hands[0].cards.length, 2);
  const q = setup(); const r = q.add(40); q.bj.join(r, { tbl: 0, chair: 0 });
  q.bj.act(r, { a: 'bet', amount: 50 }); assert.match(q.err(r), /칩이 모자라/);
  q.bj.act(r, { a: 'bet', amount: 5 }); assert.match(q.err(r), /10~500/);
  assert.equal(r.chips, 40);
});

/* (2) 무작위 수천 판: 손마다 독립 정산 대조 + 칩 보존 */
const sc = (cs) => { let t = 0, a = 0; for (const c of cs) { const v = 'A23456789'.includes(c[0]) ? 'A23456789'.indexOf(c[0]) + 1 : 10; t += v; if (v === 1) a = 1; } return a && t + 10 <= 21 ? t + 10 : t; };
function expectDelta(h, split, dealer) {
  const pt = sc(h.cards), d = sc(dealer), pbj = !split && h.cards.length === 2 && pt === 21, dbj = dealer.length === 2 && d === 21;
  if (pt > 21) return -h.bet;
  if (pbj) return dbj ? 0 : Math.floor(h.bet * 1.5);
  if (dbj) return -h.bet;
  if (d > 21 || pt > d) return h.bet;
  return pt === d ? 0 : -h.bet;
}
test('무작위 3000판 칩 보존', () => {
  const R = Math.random, e = setup(null);
  const ps = Array.from({ length: 6 }, () => e.add(2000)), start = ps.map((p) => p.chips);
  const topup = ps.map(() => 0), own = ps.map(() => 0); // 외부 충전, 각자 확정 손익(정산 + 몰수)
  let dealerTake = 0, rounds = 0, hands = 0, lastSeq = -1;
  const seated = () => ps.filter((p) => e.st(p) && e.st(p).seats[e.st(p).you]?.id === p.id && seatedSet.has(p));
  const seatedSet = new Set();
  const sit = (p) => { const used = new Set(seated().map((q) => e.st(q).you)); const free = [0, 1, 2, 3, 4].filter((c) => !used.has(c)); if (!free.length) return; if (e.bj.join(p, { tbl: 0, chair: free[Math.floor(R() * free.length)] }).ok) seatedSet.add(p); };
  const out = (p) => {
    const s = e.st(p), me = s.seats[s.you];
    if (s.phase === 'play' && me.hands.length) { const f = me.hands.filter((h) => h.res == null).reduce((a, h) => a + h.bet, 0); dealerTake += f; own[ps.indexOf(p)] -= f; }
    e.bj.leave(p); seatedSet.delete(p);
  };
  const pending = (p) => { const s = seatedSet.has(p) && e.st(p); return s && s.phase === 'bet' ? s.seats[s.you].bet : 0; };
  for (const p of ps.slice(0, 4)) sit(p);
  while (rounds < 3000) {
    for (const p of ps) {
      if (!seatedSet.has(p)) { if (R() < 0.3) sit(p); continue; }
      if (R() < 0.04) { out(p); continue; }
      const i = ps.indexOf(p);
      if (p.chips + pending(p) < 600) { p.chips += 1000; topup[i] += 1000; }
      const k = R();
      if (k < 0.75) e.bj.act(p, { a: 'bet', amount: 10 + Math.floor(R() * 491) });
      if (k < 0.15) e.bj.act(p, { a: 'bet', amount: 10 * (1 + Math.floor(R() * 50)) });
      if (k > 0.95) e.bj.act(p, { a: 'cancel' });
    }
    e.go(BET_MS);
    for (let guard = 0; guard < 200; guard++) {
      const any = [...seatedSet][0], s = any && e.st(any);
      if (!s || s.phase !== 'play') break;
      const p = ps.find((q) => seatedSet.has(q) && e.st(q).you === s.turn.c);
      const k = R();
      if (k < 0.02) out(p);
      else if (k < 0.06) e.go(TURN_MS);
      else e.bj.act(p, { a: ['hit', 'stand', 'double', 'split', 'hit', 'stand'][Math.floor(R() * 6)] });
    }
    const any = [...seatedSet][0], s = any && e.st(any);
    if (s?.phase === 'result' && s.seq !== lastSeq) {
      lastSeq = s.seq; rounds++;
      s.seats.forEach((seat) => seat?.hands.forEach((h) => {
        const dlt = expectDelta(h, seat.hands.length > 1, s.dealer.cards);
        assert.equal(h.delta, dlt, JSON.stringify({ h, dealer: s.dealer.cards }));
        dealerTake -= dlt; own[ps.findIndex((p) => p.id === seat.id)] += dlt; hands++;
      }));
      assert.ok(!s.dealer.cards.includes(null));
      e.go(RESULT_MS);
    }
    ps.forEach((p, i) => assert.equal(p.chips + pending(p), start[i] + topup[i] + own[i], `player ${i} round ${rounds}`));
  }
  for (const p of ps) if (seatedSet.has(p)) out(p); // 베팅 단계에서 모두 나가면 걸린 칩 환급
  const walletDelta = ps.reduce((a, p, i) => a + p.chips - start[i] - topup[i], 0);
  assert.equal(walletDelta, -dealerTake);
  console.log(`   ${rounds}판 ${hands}손, 딜러 몫 ${dealerTake}`);
});

console.log(`\n${pass}개 통과`);
