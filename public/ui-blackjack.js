// 카지노 3층 블랙잭 화면: 서버(blackjack.js)가 보낸 state 를 2D 테이블로 그림. 규칙·칩은 서버가 심판.
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RES = { bj: '블랙잭', win: '승', lose: '패', push: '푸시', bust: '버스트' };
const CHIPS = [10, 50, 100, 500];
const fmt = (n) => n.toLocaleString('ko-KR');
const sign = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '±0');

const CSS = `
.bj-panel{--g:#dfc18c;--felt:#0f2a2b;--ln:#2f4b4c;--mute:#9db4b2;--red:#ff7a8a;pointer-events:auto;position:absolute;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(800px,calc(100vw - 12px));max-height:calc(100dvh - 16px);overflow:auto;box-sizing:border-box;padding:10px 12px 12px;border-radius:22px;background:radial-gradient(120% 90% at 50% 0,#17403e,var(--felt) 70%);border:1px solid #b59a6866;box-shadow:0 14px 40px #0008;color:#f1eee5;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;display:flex;flex-direction:column;gap:8px;user-select:none;-webkit-user-select:none;animation:bj-pop .25s}
.bj-panel button{font:inherit;border:0;cursor:pointer;touch-action:manipulation;min-height:40px;border-radius:12px}
.bj-panel button:disabled{opacity:.35;cursor:default}
.bj-top{display:flex;align-items:center;gap:10px}
.bj-title{font:20px/1 'Jua',sans-serif;color:var(--g);letter-spacing:1px}
.bj-wallet{margin-left:auto;font:17px/1 'Jua',sans-serif;color:var(--g);background:#0006;border:1px solid #b59a6855;border-radius:999px;padding:7px 12px;font-variant-numeric:tabular-nums}
.bj-exit{background:#ffffff14;color:#f1eee5;padding:0 14px;border:1px solid #ffffff2a!important}
.bj-dealer{display:flex;align-items:center;justify-content:center;gap:10px;min-height:64px}
.bj-lab{font-size:12px;color:var(--mute);letter-spacing:.1em}
.bj-tot{font:15px/1 'Jua',sans-serif;background:#0007;border-radius:999px;padding:4px 9px;color:#fff;font-variant-numeric:tabular-nums}
.bj-tot.bust{color:var(--red)}
.bj-cards{display:flex}
.bj-card{--w:42px;width:var(--w);height:calc(var(--w)*1.4);border-radius:6px;background:#f7f3e9;color:#172b33;box-shadow:0 3px 8px #0006;position:relative;flex:none;font-family:Georgia,serif;transform-style:preserve-3d}
.bj-card+.bj-card{margin-left:calc(var(--w)*-.45)}
.bj-card b{position:absolute;left:4px;top:3px;font-size:calc(var(--w)*.4);line-height:1;letter-spacing:-.05em}
.bj-card i{position:absolute;right:4px;bottom:2px;font-style:normal;font-size:calc(var(--w)*.5);line-height:1}
.bj-card.red{color:#c0443f}
.bj-card.back{background:repeating-linear-gradient(45deg,#1b4d4b,#1b4d4b 3px,#255a55 3px,#255a55 5px);border:2px solid #e0cfab;box-sizing:border-box}
.bj-in{animation:bj-in .35s cubic-bezier(.2,.8,.3,1.2) backwards}
.bj-flip{animation:bj-flip .45s ease-out backwards}
.bj-seats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.bj-seat{border-radius:14px;background:#00000038;border:1px solid var(--ln);padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:108px;min-width:0;justify-content:flex-end;position:relative}
.bj-seat.me{border-color:var(--g);background:#dfc18c14;box-shadow:0 0 0 1px #dfc18c55 inset}
.bj-seat.empty{opacity:.4;justify-content:center;font-size:12px;color:var(--mute)}
.bj-hands{display:flex;gap:4px;align-items:flex-end;flex-wrap:wrap;justify-content:center}
.bj-hand{display:flex;flex-direction:column;align-items:center;gap:3px;padding:2px;border-radius:10px}
.bj-hand.on{background:#dfc18c26;box-shadow:0 0 0 2px var(--g);animation:bj-glow 1.2s ease-in-out infinite}
.bj-hands.two .bj-card{--w:30px}
.bj-nm{font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bj-seat.me .bj-nm{color:var(--g);font-weight:700}
.bj-bet{font:13px/1 'Jua',sans-serif;color:var(--g);font-variant-numeric:tabular-nums}
.bj-badge{font:12px/1 'Jua',sans-serif;border-radius:999px;padding:3px 7px;background:#ffffff1f;white-space:nowrap;animation:bj-pop .3s backwards}
.bj-badge.win,.bj-badge.bj{background:var(--g);color:#1d2a26}
.bj-badge.lose,.bj-badge.bust{background:#ff7a8a33;color:#ffb3bd}
.bj-status{display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;min-height:22px}
.bj-status em{font:normal 22px/1 'Jua',sans-serif}
.bj-status em.up{color:var(--g)} .bj-status em.down{color:var(--red)}
.bj-bar{height:4px;border-radius:4px;background:#ffffff1a;overflow:hidden}
.bj-bar i{display:block;height:100%;background:var(--g);animation:bj-bar linear forwards}
.bj-ctl{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;min-height:46px}
.bj-chip{width:46px;height:46px;border-radius:50%!important;font:15px/1 'Jua',sans-serif;color:#fff;border:3px dashed #fff8!important;box-shadow:0 3px 0 #0005}
.bj-chip[data-v="10"]{background:#3d8fe0}.bj-chip[data-v="50"]{background:#e0566a}.bj-chip[data-v="100"]{background:#2f9e6a}.bj-chip[data-v="500"]{background:#6b4bc4}
.bj-pend{font:20px/1 'Jua',sans-serif;color:var(--g);min-width:64px;text-align:center;font-variant-numeric:tabular-nums}
.bj-btn{padding:0 14px;background:#ffffff17;color:#f1eee5;font-size:15px}
.bj-btn.main{background:var(--g);color:#182126;font-weight:700}
.bj-act{min-width:76px;font:17px/1 'Jua',sans-serif}
@keyframes bj-in{from{transform:translate(30px,-60px) rotate(-12deg) scale(.8);opacity:0}}
@keyframes bj-flip{from{transform:rotateY(180deg);filter:brightness(.4)}}
@keyframes bj-pop{from{transform:translateX(var(--tx,0)) scale(.85);opacity:0}}
@keyframes bj-glow{50%{box-shadow:0 0 0 2px var(--g),0 0 14px #dfc18c88}}
@keyframes bj-bar{from{width:var(--w0)}to{width:0}}
.bj-panel{--tx:-50%}
.bj-badge{--tx:0}
@media (max-height:520px){
 .bj-panel{padding:6px 10px 8px;gap:5px;border-radius:16px;bottom:4px;max-height:calc(100dvh - 8px)}
 .bj-title{font-size:16px}.bj-wallet{font-size:14px;padding:5px 10px}
 .bj-dealer{min-height:44px;gap:8px}
 .bj-card{--w:28px}.bj-hands.two .bj-card{--w:22px}
 .bj-seat{min-height:78px;padding:4px 3px;gap:3px}
 .bj-nm{font-size:11px}.bj-status{font-size:13px;min-height:18px}.bj-status em{font-size:18px}
 .bj-chip{width:40px;height:40px;font-size:13px}.bj-ctl{min-height:40px}
}
@media (prefers-reduced-motion:reduce){.bj-panel *,.bj-panel{animation:none!important}}
`;

export function createBlackjackUI(ctx) {
  let panel = null, st = null, pend = 0, deadline = 0, iv = 0, phase = '', myBet = 0;
  const seen = new Set(); // 이미 그린 카드(새 카드만 날아오게)
  ctx.onChips?.(() => panel && !panel.hidden && render());

  function mount() {
    if (panel) return;
    if (!document.getElementById('bj-css')) document.head.append(Object.assign(document.createElement('style'), { id: 'bj-css', textContent: CSS }));
    panel = document.createElement('div');
    panel.className = 'bj-panel';
    panel.addEventListener('click', onClick);
    ctx.root.append(panel);
  }

  let fresh = 0;
  function card(c, key) {
    const was = seen.has(key + 'null');
    const k = key + c;
    const anim = seen.has(k) ? '' : c && was ? ' bj-flip' : ' bj-in';
    const delay = anim ? ` style="animation-delay:${fresh++ * 110}ms"` : '';
    seen.add(k);
    if (!c) return `<div class="bj-card back${anim}"${delay}></div>`;
    const r = c[0] === 'T' ? '10' : c[0], red = c[1] === 'h' || c[1] === 'd';
    return `<div class="bj-card${red ? ' red' : ''}${anim}"${delay}><b>${r}</b><i>${SUIT[c[1]]}</i></div>`;
  }

  function seatHtml(s, c) {
    if (!s) return `<div class="bj-seat empty">빈 자리</div>`;
    const me = c === st.you, res = st.phase === 'result';
    const hands = s.hands.map((h, i) => {
      const on = st.turn?.c === c && st.turn.h === i;
      const badge = h.res ? `<span class="bj-badge ${h.res}">${RES[h.res]} ${sign(h.delta)}</span>` : h.dbl ? `<span class="bj-badge">더블</span>` : '';
      return `<div class="bj-hand${on ? ' on' : ''}"><div class="bj-cards">${h.cards.map((x, j) => card(x, `${c}.${i}.${j}:`)).join('')}</div>
        <span class="bj-tot${h.total > 21 ? ' bust' : ''}">${h.total}</span>${badge}</div>`;
    }).join('');
    return `<div class="bj-seat${me ? ' me' : ''}"><div class="bj-hands${s.hands.length > 1 ? ' two' : ''}">${hands}</div>
      <div class="bj-nm">${me ? '나' : esc(s.nick)}</div><div class="bj-bet">${s.bet ? `🪙 ${fmt(s.bet)}` : res || st.phase === 'play' ? '구경' : '&nbsp;'}</div></div>`;
  }

  function status() {
    const mine = st.seats[st.you];
    if (st.phase === 'bet') return st.left ? `베팅 마감 <em class="bj-sec">${Math.ceil(st.left / 1000)}</em>초` : '칩을 걸면 시작해요';
    if (st.phase === 'play') {
      const t = st.turn && st.seats[st.turn.c];
      return t ? `${st.turn.c === st.you ? '<b>내 차례</b>' : `${esc(t.nick)} 차례`} <em class="bj-sec">${Math.ceil(st.left / 1000)}</em>` : '딜러 차례';
    }
    if (!mine?.hands.length) return '정산 중';
    return `내 결과 <em class="${mine.net > 0 ? 'up' : mine.net < 0 ? 'down' : ''}">${sign(mine.net)}</em>`;
  }

  function controls() {
    const mine = st.seats[st.you];
    if (!mine) return '';
    if (st.phase === 'bet') {
      const room = Math.min(st.max, ctx.chips() + mine.bet);
      const chips = CHIPS.map((v) => `<button class="bj-chip" data-a="chip" data-v="${v}" ${pend + v > room ? 'disabled' : ''}>${v}</button>`).join('');
      const placed = mine.bet && pend === mine.bet;
      return `${chips}<span class="bj-pend">${placed ? '✓ ' : ''}${fmt(pend)}</span>
        <button class="bj-btn main" data-a="bet" ${pend < st.min || placed ? 'disabled' : ''}>베팅 확정</button>
        <button class="bj-btn" data-a="cancel" ${pend || mine.bet ? '' : 'disabled'}>취소</button>
        <button class="bj-btn" data-a="again" ${mine.lastBet && mine.lastBet <= room && mine.lastBet !== mine.bet ? '' : 'disabled'}>반복 ${mine.lastBet || ''}</button>`;
    }
    if (st.phase === 'play' && st.can) {
      const b = (a, label) => `<button class="bj-btn bj-act${a === 'hit' ? ' main' : ''}" data-a="${a}" ${st.can[a] ? '' : 'disabled'}>${label}</button>`;
      return b('hit', '히트') + b('stand', '스탠드') + b('double', '더블') + b('split', '스플릿');
    }
    return '';
  }

  function render() {
    if (!panel || !st) return;
    fresh = 0;
    const d = st.dealer;
    const left = Math.max(0, deadline - performance.now()), total = st.left && (st.phase === 'bet' ? 12000 : 15000);
    panel.innerHTML = `
      <div class="bj-top"><span class="bj-title">♠ 블랙잭</span><span class="bj-lab">3:2 · 소프트17 스탠드</span>
        <span class="bj-wallet">🪙 ${fmt(ctx.chips())}</span><button class="bj-exit" data-a="exit">나가기</button></div>
      <div class="bj-dealer"><span class="bj-lab">딜러</span><div class="bj-cards">${d.cards.map((c, j) => card(c, `d.${j}:`)).join('')}</div>
        ${d.cards.length ? `<span class="bj-tot${d.total > 21 ? ' bust' : ''}">${d.bj ? '블랙잭' : d.total}</span>` : ''}</div>
      <div class="bj-seats">${st.seats.map(seatHtml).join('')}</div>
      <div class="bj-status">${status()}</div>
      <div class="bj-bar">${total && st.phase !== 'result' ? `<i style="--w0:${(left / total) * 100}%;animation-duration:${left}ms"></i>` : ''}</div>
      <div class="bj-ctl">${controls()}</div>`;
  }

  function onClick(e) {
    const b = e.target.closest('button[data-a]');
    if (!b || b.disabled) return;
    const a = b.dataset.a, mine = st?.seats[st.you];
    if (a === 'exit') return ctx.stand();
    if (a === 'chip') { pend += +b.dataset.v; return render(); }
    if (a === 'bet') return ctx.send({ a: 'bet', amount: pend });
    if (a === 'cancel') { pend = 0; if (mine?.bet) ctx.send({ a: 'cancel' }); return render(); }
    if (a === 'again') { pend = mine.lastBet; return ctx.send({ a: 'bet', amount: pend }); }
    ctx.send({ a }); // hit/stand/double/split
  }

  function tickClock() {
    const el = panel?.querySelector('.bj-sec');
    if (el) el.textContent = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
  }

  return {
    open() { mount(); panel.hidden = false; render(); clearInterval(iv); iv = setInterval(tickClock, 250); },
    close() { clearInterval(iv); iv = 0; if (panel) panel.hidden = true; st = null; pend = 0; phase = ''; myBet = 0; seen.clear(); },
    onMsg(m) {
      if (m.error) return ctx.toast?.(m.error);
      if (!m.state) return;
      st = m.state;
      if (st.phase === 'bet' && phase !== 'bet') { seen.clear(); pend = 0; } // 새 판
      phase = st.phase;
      const b = st.seats[st.you]?.bet ?? 0;
      if (st.phase === 'bet' && b !== myBet) pend = b; // 서버 베팅이 바뀔 때만 맞춤(고르던 칩은 유지)
      myBet = b;
      deadline = performance.now() + st.left;
      render();
    },
  };
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
