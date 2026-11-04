// 홀덤 모듈 시험: 가짜 시계·지갑·메시지로 칩 총량 보존, 입장 거절, 판 중 나가기 환급, 사이드팟, 봇 수 조절을 확인
import assert from 'node:assert/strict';
import { createPoker } from './holdem.js';

let pass = 0, clock = 0;
const test = (name, fn) => { fn(); pass++; console.log('✓', name); };
const C = (s) => ({ r: { T: 10, J: 11, Q: 12, K: 13, A: 14 }[s[0]] || +s[0], s: s[1] }); // 'As' → 카드

function setup(opts) {
  const sent = [];
  const ctx = {
    now: () => clock,
    wallet: { chips: (p) => p.chips, add: (p, d) => (p.chips + d < 0 ? false : ((p.chips += d), true)) },
    toPlayer: (p, m) => sent.push([p, m]),
    players: new Map(),
  };
  const pk = createPoker(ctx, { turnMs: 300, botMs: [0, 0], foldMs: 0, showMs: 0, startMs: 0, ...opts });
  const step = (n = 1) => { for (let k = 0; k < n; k++) { clock += 50; pk.tick(); } };
  const T = () => pk.debug().tables[0]?.t;
  return { pk, sent, step, T };
}
const human = (id, chips) => ({ id, nick: '사람' + id, chips });
const SEAT = { kind: 'poker', tbl: 0, chair: 0 };

// 사람 지갑 + 테이블 안 칩 − 봇에게 만들어 준 칩 + 봇과 함께 사라진 칩 = 처음 칩
function total(pk, people) {
  const d = pk.debug();
  return people.reduce((s, p) => s + p.chips, 0) + d.tables.reduce((s, x) => s + x.chips, 0) - d.bank.in + d.bank.out;
}

// 차례인 사람이 무작위로 행동 (가끔 잘못된 입력도)
function randomMove(pk, t, people) {
  if (!t?.inProgress()) return;
  const p = people.find((h) => String(h.id) === t.players[t.toAct]?.token);
  if (!p) return;
  const q = t.players[t.toAct], r = Math.random();
  const m = r < 0.15 ? { a: 'fold' } : r < 0.5 ? { a: 'call' } : r < 0.6 ? { a: 'check' } : r < 0.8 ? { a: 'raise', amount: t.currentBet + t.minRaise + Math.floor(Math.random() * 100) } : r < 0.85 ? { a: 'allin' } : r < 0.9 ? { a: 'raise', amount: 'x' } : { a: 'call' };
  pk.act(p, m);
  if (t.players[t.toAct] === q && t.inProgress()) pk.act(p, { a: q.bet < t.currentBet ? 'call' : 'check' });
}

test('봇만 상대: 사람 1명(시간 초과로만 행동) + 봇 3명, 500판 칩 총량 보존', () => {
  const { pk, step, T } = setup();
  const a = human(1, 3000), start = a.chips;
  assert.deepEqual(pk.join(a, SEAT), { ok: true });
  assert.equal(T().players.length, 4);
  while (T().handNo < 500) { step(); assert.equal(total(pk, [a]), start); }
  pk.leave(a);
  assert.equal(pk.debug().tables.length, 0, '사람이 없으면 테이블을 닫음');
  assert.equal(total(pk, [a]), start);
});

test('사람 여럿 + 봇: 무작위 플레이·앉기/나가기·리바인 2000판 칩 총량 보존', () => {
  const { pk, sent, step, T } = setup({ turnMs: 200 });
  const people = Array.from({ length: 7 }, (_, i) => human(i + 1, 2000 + i * 700));
  let start = people.reduce((s, p) => s + p.chips, 0);
  const seated = new Set();
  let hands = 0, last = 0;
  for (let k = 0; hands < 2000; k++) {
    assert.ok(k < 2e6, '판이 멈춤');
    for (const h of people) if (!seated.has(h) && h.chips < 200) { h.chips += 3000; start += 3000; } // 시험용 지갑 충전 (시작 칩에 더함)
    const p = people[Math.floor(Math.random() * people.length)];
    if (Math.random() < 0.01) {
      if (seated.has(p)) { pk.leave(p); pk.leave(p); seated.delete(p); } // 두 번 불려도 안전
      else if (pk.join(p, SEAT).ok) seated.add(p);
    }
    if (seated.size < 4 && Math.random() < 0.05) { const q = people.find((h) => !seated.has(h) && h.chips >= 200); if (q && pk.join(q, SEAT).ok) seated.add(q); }
    const t = T();
    if (t) for (const h of seated) if (t.players[t.find(String(h.id))]?.chips === 0) { if (h.chips >= 200) pk.act(h, { a: 'rebuy' }); else if (!t.inProgress()) { pk.leave(h); seated.delete(h); } }
    randomMove(pk, t, [...seated]);
    step();
    const t2 = T();
    if (t2 && t2.handNo !== last) { hands++; last = t2.handNo; }
    if (!t2) last = 0;
    assert.equal(total(pk, people), start);
    if (t2 && !t2.inProgress()) assert.ok(t2.players.length <= 8);
    for (const p of people) assert.ok(p.chips >= 0);
  }
  for (const p of seated) pk.leave(p);
  assert.equal(pk.debug().tables.length, 0);
  assert.equal(people.reduce((s, p) => s + p.chips, 0) - pk.debug().bank.in + pk.debug().bank.out, start);
  assert.ok(sent.some(([, m]) => m.error), '잘못된 입력엔 error 를 보냄');
});

test('칩이 모자라면 입장 거절, 지갑은 그대로', () => {
  const { pk, T } = setup();
  const a = human(1, 199);
  assert.deepEqual(pk.join(a, SEAT), { ok: false, error: '칩이 모자라요 (최소 200칩)' });
  assert.equal(a.chips, 199);
  assert.equal(T(), undefined);
  const b = human(2, 350);
  assert.ok(pk.join(b, SEAT).ok);
  assert.equal(b.chips, 0, '바이인 = min(지갑, 1000)');
  assert.equal(T().players.find((q) => q.token === '2').chips, 350);
});

test('판 중 나가기: 폴드 처리되고 남은 칩만 환급, 판은 계속', () => {
  const { pk, sent, step, T } = setup({ turnMs: 100000 });
  const a = human(1, 5000), b = human(2, 5000);
  pk.join(a, SEAT); pk.join(b, SEAT);
  step();
  const t = T();
  assert.ok(t.inProgress());
  const qa = t.players[t.find('1')];
  // a 차례가 될 때까지 봇·b 가 움직이게 둠, a 는 콜 한 번
  for (let k = 0; k < 400 && !(t.toAct === t.players.indexOf(qa) && t.phase === 'preflop'); k++) {
    if (t.players[t.toAct]?.token === '2') pk.act(b, { a: 'call' });
    step();
  }
  assert.equal(t.toAct, t.players.indexOf(qa));
  pk.act(a, { a: 'call' });
  assert.ok(t.inProgress() && qa.total > 0);
  const stack = qa.chips, hand = t.handNo;
  pk.leave(a);
  assert.equal(a.chips, 4000 + stack, '앞에 남은 칩만 환급, 낸 칩은 팟에 남음');
  assert.ok(qa.folded && qa.chips === 0);
  assert.equal(t.find('1'), -1, '토큰을 바꿔서 같은 사람이 다시 앉을 수 있음');
  const n = sent.length;
  for (let k = 0; k < 400 && t.handNo === hand; k++) { if (t.players[t.toAct]?.token === '2') pk.act(b, { a: 'call' }); step(); }
  assert.ok(t.handNo > hand, '남은 사람끼리 판이 이어짐');
  assert.ok(!t.players.includes(qa), '다음 판엔 자리가 지워짐');
  assert.ok(sent.slice(n).every(([p]) => p === b), '나간 사람에겐 더 안 보냄');
  assert.ok(pk.join(a, SEAT).ok);
  pk.leave(a); pk.leave(b);
});

// 사람 4명(봇 없음) 모두 올인, 카드를 정해 두고 팟 나누기 확인
function allInHand(stacks, holes, board) {
  const { pk, sent, step, T } = setup();
  const ps = stacks.map((c, i) => human(i + 1, c));
  ps.forEach((p) => pk.join(p, SEAT));
  step();
  const t = T();
  assert.equal(t.players.length, 4);
  assert.ok(t.players.every((q) => !q.bot));
  ps.forEach((p, i) => (t.players[t.find(String(p.id))].hole = holes[i].map(C)));
  t.deck = board.map(C).reverse();
  while (t.inProgress()) pk.act(ps.find((p) => String(p.id) === t.players[t.toAct].token), { a: 'allin' });
  const chips = ps.map((p) => t.players[t.find(String(p.id))].chips);
  const st = sent.filter(([p]) => p === ps[0]).at(-1)[1].state;
  ps.forEach((p) => pk.leave(p));
  return { chips, wallets: ps.map((p) => p.chips), st };
}

test('사이드팟: 200/400/1000/1000 올인 → 메인 800 · 사이드 600 · 사이드 1200', () => {
  const r = allInHand([200, 400, 1000, 1000], [['As', 'Ah'], ['Ks', 'Kh'], ['Qs', 'Qh'], ['3d', '6h']], ['2c', '7d', '9h', 'Js', '4c']);
  assert.deepEqual(r.chips, [800, 600, 1200, 0]);
  assert.deepEqual(r.wallets, [800, 600, 1200, 0]);
  assert.equal(r.st.phase, 'showdown');
  assert.equal(r.st.results.pots.length, 3);
  assert.equal(r.st.players[0].handName, '원페어');
  assert.ok(r.st.players.every((p) => p.cards.length === 2 && !p.cards.includes('??')), '쇼다운 카드는 모두에게 공개');
});

test('보드가 로열 플러시면 전원 무승부 → 각자 낸 만큼 돌려받음', () => {
  const r = allInHand([300, 500, 1000, 1000], [['2c', '3d'], ['4c', '5d'], ['2d', '3c'], ['4d', '5c']], ['As', 'Ks', 'Qs', 'Js', 'Ts']);
  assert.deepEqual(r.chips, [300, 500, 1000, 1000]);
  assert.equal(r.st.players[0].handName, '로열 플러시');
});

test('내 카드만 보임: 다른 사람 카드는 ?? 로', () => {
  const { pk, sent, step } = setup({ turnMs: 100000, botMs: [99999, 99999] });
  const a = human(1, 1000);
  pk.join(a, SEAT); step();
  const st = sent.at(-1)[1].state;
  assert.equal(st.players[st.me].cards.length, 2);
  assert.ok(!st.players[st.me].cards.includes('??'));
  assert.ok(st.players.filter((_, i) => i !== st.me).every((p) => p.cards.join() === '??,??'));
  pk.leave(a);
});

test('봇 수 조절: 총 4명 맞추고, 사람이 늘면 판 사이에 줄이고, 8명을 넘지 않음', () => {
  const { pk, step, T } = setup({ turnMs: 50 });
  const ps = Array.from({ length: 8 }, (_, i) => human(i + 1, 1000));
  const bots = () => T().players.filter((q) => q.bot && !q.kicked).length;
  pk.join(ps[0], SEAT);
  assert.equal(bots(), 3);
  step();
  assert.ok(T().inProgress());
  pk.join(ps[1], SEAT);
  assert.equal(bots(), 3, '판 중엔 봇을 바로 빼지 않음');
  const h = T().handNo;
  while (T().handNo === h) step();
  assert.equal(bots(), 2);
  assert.equal(T().players.length, 4);
  for (const p of ps.slice(2)) pk.join(p, SEAT); // 판 중에 6명 더
  assert.ok(T().players.length <= 12);
  const h2 = T().handNo;
  while (T().handNo === h2) step();
  assert.equal(bots(), 0);
  assert.equal(T().players.length, 8);
  assert.equal(pk.join(human(99, 1000), SEAT).error, '자리가 꽉 찼어요');
  for (const p of ps.slice(1)) pk.leave(p);
  for (let k = 0; k < 200 && bots() < 3; k++) step();
  assert.equal(bots(), 3, '혼자 남으면 다시 봇 3명');
  assert.equal(T().players.filter((q) => !q.kicked).length, 4);
  pk.leave(ps[0]);
  assert.equal(pk.debug().tables.length, 0);
});

test('리바인: 칩 0 이면 canRebuy, 다시 바이인', () => {
  const { pk, sent, step, T } = setup({ turnMs: 100000, botMs: [99999, 99999] });
  const a = human(1, 1500);
  pk.join(a, SEAT); step();
  const q = T().players[T().find('1')];
  pk.act(a, { a: 'rebuy' });
  assert.equal(sent.at(-1)[1].error, '아직 칩이 남아 있어요');
  q.chips = 0; q.folded = true; // 다 잃은 상황
  pk.act(a, { a: 'rebuy' });
  assert.equal(q.chips, 500, '지갑에 남은 500 으로 리바인');
  assert.equal(a.chips, 0);
  q.chips = 0; q.folded = true; T().onChange(); step(); // 판에서 다 잃으면 엔진이 상태를 바꿨다고 알림
  assert.equal(sent.filter(([, m]) => m.state).at(-1)[1].state.canRebuy, true);
  pk.act(a, { a: 'rebuy' });
  assert.equal(sent.at(-1)[1].error, '칩이 모자라요 (최소 200칩)');
  pk.leave(a);
});

console.log(`\n${pass}개 통과`);
