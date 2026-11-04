// 슬롯머신 화면: 릴 3개가 차례로 멈추고, 칩 숫자는 릴이 다 멈춘 뒤에 바뀜(결과를 미리 알려 주지 않으려고)
const CSS = `
.sl-p{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);pointer-events:auto;width:min(380px,calc(100vw - 20px));background:linear-gradient(#2b1a3a,#1a1024);color:#fff;border:3px solid #e8b84a;border-radius:22px;padding:10px 14px 12px;box-shadow:0 8px 30px rgba(0,0,0,.4);font-family:'Jua','Apple SD Gothic Neo',sans-serif;text-align:center}
.sl-p header{display:flex;justify-content:space-between;align-items:center;font-size:15px;margin-bottom:6px}
.sl-p header b{color:#ffd86b;font-size:18px}
.sl-p button{font:inherit;color:inherit;cursor:pointer;border:0}
.sl-x{background:#4a3a5a;border-radius:12px;padding:4px 12px}
.sl-reels{display:flex;gap:8px;justify-content:center;background:#0e0816;border-radius:16px;padding:10px;border:2px solid #6b4a1f}
.sl-r{width:25%;max-width:84px;aspect-ratio:1;display:grid;place-items:center;font-size:clamp(34px,10vw,50px);background:#fffaf0;border-radius:14px;box-shadow:inset 0 -6px 0 #e8dcc6}
.sl-r.spin{animation:slbob .12s linear infinite}
@keyframes slbob{50%{transform:translateY(3px)}}
.sl-msg{min-height:26px;margin:8px 0 6px;font-size:18px}
.sl-msg.win{color:#ffd86b;animation:slpop .5s}
@keyframes slpop{from{transform:scale(.6)}}
.sl-bets{display:flex;gap:6px;justify-content:center}
.sl-bets button{flex:1;padding:7px 0;border-radius:12px;background:#3a2850;border:2px solid transparent}
.sl-bets button[aria-pressed=true]{background:#e8b84a;color:#2b1a00}
.sl-go{width:100%;margin-top:8px;padding:11px;border-radius:16px;background:#ff5a7a;font-size:22px;box-shadow:0 4px 0 #c13050}
.sl-go:active{transform:translateY(3px);box-shadow:0 1px 0 #c13050}
.sl-go:disabled{opacity:.55}
.sl-pay{font-size:12px;opacity:.75;margin-top:6px;line-height:1.5}
@media (max-height:520px){.sl-p{padding:6px 10px 8px;width:min(330px,calc(100vw - 20px))}.sl-r{max-width:56px;font-size:30px}.sl-msg{margin:4px 0}.sl-go{padding:7px;font-size:18px;margin-top:5px}.sl-pay{display:none}}
`;

export function createSlotUI(ctx) {
  if (!document.getElementById('sl-css')) document.head.append(Object.assign(document.createElement('style'), { id: 'sl-css', textContent: CSS }));
  let symbols = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'], pay = [7, 10, 22, 40, 200, 600], bets = [10, 50, 100, 500], bet = 10, busy = false, shown = ctx.chips(), timers = [];
  const el = document.createElement('div');
  el.className = 'sl-p'; el.hidden = true;
  el.innerHTML = '<header><span>🎰 슬롯머신</span><span>🪙 <b class="sl-c"></b></span><button class="sl-x">나가기</button></header><div class="sl-reels"><div class="sl-r">🎰</div><div class="sl-r">🎰</div><div class="sl-r">🎰</div></div><div class="sl-msg">베팅하고 돌려 보세요!</div><div class="sl-bets"></div><button class="sl-go">돌리기</button><div class="sl-pay"></div>';
  ctx.root.append(el);
  const $ = (s) => el.querySelector(s), reels = [...el.querySelectorAll('.sl-r')], msg = $('.sl-msg'), go = $('.sl-go');
  const money = (n) => n.toLocaleString('ko-KR');
  const showChips = () => ($('.sl-c').textContent = money(shown));
  const drawBets = () => {
    const box = $('.sl-bets'); box.replaceChildren();
    for (const b of bets) { const x = document.createElement('button'); x.textContent = b; x.setAttribute('aria-pressed', b === bet); x.onclick = () => { if (!busy) { bet = b; drawBets(); } }; box.append(x); }
    $('.sl-pay').textContent = `같은 그림 3개: ${symbols.map((s, i) => `${s}×${pay[i]}`).join(' ')} · 🍒 정확히 2개 = 본전`;
  };
  $('.sl-x').onclick = () => ctx.stand();
  go.onclick = () => {
    if (busy) return;
    if (ctx.chips() < bet) { msg.textContent = '칩이 모자라요 😢'; return; }
    busy = true; go.disabled = true; msg.className = 'sl-msg'; msg.textContent = '두근두근…';
    reels.forEach((r) => r.classList.add('spin'));
    const t = setInterval(() => reels.forEach((r) => r.classList.contains('spin') && (r.textContent = symbols[Math.floor(Math.random() * symbols.length)])), 80);
    timers.push(t); el._tick = t;
    ctx.send({ a: 'spin', bet });
  };
  ctx.onChips(() => { if (!busy) { shown = ctx.chips(); showChips(); } });

  function settle(m) { // 릴을 차례로 멈춘 뒤 결과 표시
    reels.forEach((r, i) => timers.push(setTimeout(() => { r.classList.remove('spin'); r.textContent = symbols[m.reels[i]]; }, 500 + i * 450)));
    timers.push(setTimeout(() => {
      clearInterval(el._tick); busy = false; go.disabled = false; shown = ctx.chips(); showChips();
      msg.className = 'sl-msg' + (m.win ? ' win' : '');
      msg.textContent = m.win > m.bet ? `🎉 +${money(m.win)} 당첨!` : m.win === m.bet ? '본전! 한 번 더?' : '아쉬워요 😅';
    }, 500 + 3 * 450));
  }
  return {
    open() { el.hidden = false; shown = ctx.chips(); showChips(); drawBets(); },
    close() { el.hidden = true; timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; clearInterval(el._tick); busy = false; go.disabled = false; },
    onMsg(m) {
      if (m.a === 'ready') { ({ symbols = symbols, pay = pay, bets = bets } = m); if (!bets.includes(bet)) bet = bets[0]; drawBets(); }
      else if (m.a === 'result') {
        if (m.error) { clearInterval(el._tick); reels.forEach((r) => r.classList.remove('spin')); busy = false; go.disabled = false; msg.textContent = m.error; }
        else settle(m);
      }
    },
  };
}
