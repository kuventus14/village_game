// 카지노 2층 텍사스 홀덤: after-hours-holdem 엔진(vendor/ah)을 마을 지갑·자리·시계에 붙임. 가상 칩만, 원화 정산 없음.
// 엔진 타이머는 끄고(auto·pace false) 차례 제한시간·봇 생각 시간·다음 판 시작을 tick() 에서 ctx.now() 로 확인 → 남는 타이머 없음.
import { Table } from './vendor/ah/engine.cjs';
import { decide } from './vendor/ah/bot.cjs';

const MAX_SEATS = 8, BOTS_TO = 4, BUYIN = 1000, MIN_BUYIN = 200;
const POOR = '칩이 모자라요 (최소 200칩)';
const MOVES = ['fold', 'check', 'call', 'raise', 'allin'];

export function createPoker(ctx, opts = {}) {
  const o = { turnMs: 25000, botMs: [700, 1800], foldMs: 2500, showMs: 5500, startMs: 1500, ...opts };
  const tables = new Map(); // tbl → { t, humans: Map(id → p), ... }
  const where = new Map();  // p.id → tbl
  const bank = { in: 0, out: 0 }; // 봇에게 만들어 준 칩 / 봇·닫힌 테이블과 함께 사라진 칩 (총량 검사용)
  let gone = 0;
  const now = () => ctx.now();
  const tok = (p) => String(p.id);
  const rand = ([a, b]) => a + Math.random() * (b - a);
  const onTable = (t) => t.players.reduce((s, q) => s + q.chips, 0) + (t.inProgress() ? t.pot : 0); // 쇼다운 뒤 total 은 이미 나눠 준 칩

  function table(tbl) {
    if (tables.has(tbl)) return tables.get(tbl);
    const t = new Table({ auto: false, pace: false });
    t.clock = now;
    const tb = { t, humans: new Map(), dirty: true, key: '', deadline: 0, botAt: 0, nextAt: 0, shown: 0 };
    t.onChange = () => (tb.dirty = true);
    tables.set(tbl, tb);
    return tb;
  }

  // 자리 비우기(칩은 호출한 쪽이 먼저 가져감): 판 중이면 폴드만 시키고 자리는 다음 판 시작 때 지움 → 팟에 낸 칩이 사라지지 않음
  function drop(t, i) {
    const q = t.players[i];
    Object.assign(q, { token: `gone-${++gone}`, kicked: true, connected: false, chips: 0 }); // 토큰을 바꿔 둬야 같은 사람이 곧바로 다시 앉을 수 있음
    if (!(t.inProgress() && q.inHand)) { t.removeAt(i); t.departed.length = 0; return; }
    if (!q.folded) t.foldForKick(i);
    q.lastAction = '나감';
  }

  // 판 사이 정리: 나간 자리 지우기, 바닥난 봇 보충, 사람 수에 맞춰 봇 수 조절 (전체 4명, 최대 8명)
  function settle(tb) {
    const t = tb.t, n0 = t.players.length;
    let changed = false;
    t.applyKicks(); t.departed.length = 0;
    for (const q of t.players) if (q.bot && q.chips === 0) { q.chips = t.startChips; bank.in += t.startChips; changed = true; }
    const want = tb.humans.size ? Math.max(0, BOTS_TO - tb.humans.size) : 0;
    const bots = t.players.filter((q) => q.bot);
    while (bots.length > want) { const q = bots.pop(); bank.out += q.chips; drop(t, t.players.indexOf(q)); }
    while (bots.length < want && t.players.length < MAX_SEATS) { t.pushBot(); bots.push(t.players.at(-1)); bank.in += t.startChips; }
    if (changed || t.players.length !== n0) tb.dirty = true;
  }

  function next(tb) {
    const t = tb.t;
    settle(tb);
    const ready = t.players.filter((q) => q.chips > 0 && q.connected).length >= 2;
    if (ready || t.phase !== 'waiting') t.startHand(); // 모자라면 엔진이 '대기 중'으로 바꿔 줌 (대기 중엔 다시 부르지 않음)
    t.departed.length = 0;
  }

  function close(tbl) {
    const t = tables.get(tbl).t;
    bank.out += onTable(t);
    t.destroy();
    tables.delete(tbl);
  }

  function view(tb, p) {
    const t = tb.t, v = t.view(tok(p)), me = t.players[v.me];
    return {
      phase: v.phase, handNo: v.handNo, dealer: v.dealer, toAct: v.toAct, sbIdx: v.sbIdx, bbIdx: v.bbIdx,
      currentBet: v.currentBet, minRaise: v.minRaise, sb: v.sb, bb: v.bb, pot: v.pot, community: v.community,
      me: v.me, myHand: v.myHand, results: v.results,
      left: t.inProgress() ? Math.max(0, tb.deadline - now()) : 0, turnMs: o.turnMs,
      canRebuy: !!me && me.chips === 0 && !(t.inProgress() && me.inHand && !me.folded),
      players: v.players.map(({ name, chips, bet, folded, allIn, inHand, lastAction, cards, handName, won, bot, kicked }) =>
        ({ name, chips, bet, folded, allIn, inHand, lastAction, cards, handName, won, bot, left: kicked })),
      log: v.log.slice(-3), events: v.events.slice(-10), evSeq: v.evSeq,
    };
  }

  // 차례가 바뀌면 제한시간·봇 생각 시간을 새로 잡고, 판이 끝나면 다음 판 시각을 잡은 뒤 바뀐 상태를 사람마다 보냄
  function flush(tb) {
    const t = tb.t, n = now();
    if (t.inProgress()) {
      const key = `${t.handNo}:${t.evSeq}`;
      if (key !== tb.key) { tb.key = key; tb.deadline = n + o.turnMs; tb.botAt = n + rand(o.botMs); tb.dirty = true; }
    } else if (t.phase === 'showdown' && tb.shown !== t.handNo) {
      tb.shown = t.handNo; tb.nextAt = n + (t.results?.showdown ? o.showMs : o.foldMs);
    }
    if (!tb.dirty) return;
    tb.dirty = false;
    for (const p of tb.humans.values()) ctx.toPlayer(p, { state: view(tb, p) });
  }

  function rebuy(tb, p, q) {
    const t = tb.t;
    if (q.chips > 0) return '아직 칩이 남아 있어요';
    if (t.inProgress() && q.inHand && !q.folded) return '이번 판이 끝나면 할 수 있어요';
    const buy = Math.min(ctx.wallet.chips(p), BUYIN);
    if (buy < MIN_BUYIN || !ctx.wallet.add(p, -buy)) return POOR;
    q.chips = buy; q.sitOut = false;
    t.say(`${q.name} 님이 리바인했어요 (${buy.toLocaleString()}칩)`);
    tb.dirty = true;
    return null;
  }

  return {
    join(p, seat) {
      if (where.has(p.id)) return { ok: true };
      const have = ctx.wallet.chips(p), tbl = seat?.tbl ?? 0;
      if (!(have >= MIN_BUYIN)) return { ok: false, error: POOR };
      if (tables.get(tbl)?.humans.size >= MAX_SEATS) return { ok: false, error: '자리가 꽉 찼어요' };
      const buy = Math.min(have, BUYIN);
      if (!ctx.wallet.add(p, -buy)) return { ok: false, error: POOR };
      const tb = table(tbl), t = tb.t, r = t.addPlayer(tok(p), p.nick);
      if (r.error) { ctx.wallet.add(p, buy); if (!tb.humans.size) close(tbl); return { ok: false, error: '이번 판이 끝나면 다시 앉아 주세요' }; }
      Object.assign(t.players[r.idx], { chips: buy, name: p.nick }); // 엔진은 같은 이름(방금 나간 내 빈자리)이면 번호를 붙임 → 마을 닉은 겹치지 않으니 되돌림
      tb.humans.set(p.id, p); where.set(p.id, tbl);
      if (!t.inProgress()) settle(tb);
      if (t.phase === 'waiting') tb.nextAt = Math.max(tb.nextAt, now() + o.startMs);
      tb.dirty = true; flush(tb);
      return { ok: true };
    },

    leave(p) {
      const tbl = where.get(p.id), tb = tables.get(tbl);
      if (!tb) return;
      where.delete(p.id); tb.humans.delete(p.id);
      const t = tb.t, i = t.find(tok(p));
      if (i >= 0) { const c = t.players[i].chips; if (c > 0) ctx.wallet.add(p, c); drop(t, i); } // 판에 이미 낸 칩은 팟에 남음
      if (!tb.humans.size) return close(tbl); // 사람이 없으면 봇끼리 치지 않음
      tb.dirty = true; flush(tb);
    },

    act(p, m) {
      const tb = tables.get(where.get(p.id)), t = tb?.t, q = t?.players[t.find(tok(p))];
      if (!q) return;
      let err;
      if (m.a === 'rebuy') err = rebuy(tb, p, q);
      else if (MOVES.includes(m.a)) {
        let a = m.a, amt = m.amount;
        if (a === 'allin') { amt = q.bet + q.chips; a = amt > t.currentBet ? 'raise' : 'call'; }
        err = t.act(q.token, a, amt);
      } else return;
      if (err) ctx.toPlayer(p, { error: err });
      flush(tb);
    },

    tick() {
      const n = now();
      for (const tb of tables.values()) {
        const t = tb.t, q = t.inProgress() && t.players[t.toAct];
        if (q && n >= (q.bot ? tb.botAt : tb.deadline)) {
          let d = null;
          if (q.bot) try { d = decide(t, t.toAct); } catch (e) { console.error('봇 판단 오류', e); }
          else t.say(`${q.name} 님 시간 초과`);
          if (!d || t.act(q.token, d.a, d.amount)) t.act(q.token, t.currentBet > q.bet ? 'fold' : 'check'); // 판단이 막히면 체크/폴드
        } else if (!t.inProgress() && n >= tb.nextAt) next(tb);
        flush(tb);
      }
    },

    debug: () => ({ bank: { ...bank }, tables: [...tables].map(([tbl, tb]) => ({ tbl, t: tb.t, chips: onTable(tb.t) })) }), // 시험용
  };
}
