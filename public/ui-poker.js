// 카지노 2층 텍사스 홀덤 화면: 서버(holdem.js)가 보내는 state 를 2D 테이블로 그림. 규칙·판정은 전부 서버.
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const n = (v) => Number(v || 0).toLocaleString('ko-KR');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const CSS = `
.pk-panel{--bg:#0b1519;--ink:#f1eee5;--mute:#92a4a8;--gold:#dfc18c;--line:#2b3b40;--red:#d67e79;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(900px,calc(100vw - 16px));height:min(560px,calc(100dvh - 16px));display:flex;flex-direction:column;background:radial-gradient(120% 90% at 50% 40%,#13252b,var(--bg));color:var(--ink);border:1px solid #dfc18c55;border-radius:18px;box-shadow:0 20px 60px #0009;pointer-events:auto;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;overflow:hidden;-webkit-user-select:none;user-select:none}
.pk-panel[hidden]{display:none}
.pk-panel button{font:inherit;color:inherit;cursor:pointer;border:0;min-height:40px;border-radius:10px}
.pk-top{display:flex;align-items:center;gap:10px;padding:8px 10px 0 14px;font-size:13px;min-height:40px}
.pk-title{font-family:'Jua',sans-serif;font-size:18px;color:var(--gold);white-space:nowrap}
.pk-title small{font-family:inherit;font-size:12px;color:var(--mute);margin-left:6px}
.pk-log{flex:1;min-width:0;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
.pk-wallet{white-space:nowrap;color:var(--mute)}.pk-wallet b{color:var(--ink)}
.pk-exit{background:#ffffff14;padding:0 14px;border:1px solid #ffffff22!important}
.pk-table{position:relative;flex:1;min-height:0;margin:4px 10px}
.pk-felt{position:absolute;inset:9% 7%;border-radius:50%;background:radial-gradient(#1f5a56,#143b3a 70%);border:6px solid #3a2a1c;box-shadow:inset 0 0 0 2px #dfc18c55,0 8px 30px #0008}
.pk-mid{position:absolute;left:50%;top:47%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.pk-pot{font-size:14px;color:var(--gold);white-space:nowrap;min-height:18px;text-align:center}
.pk-pot.pk-win{font-family:'Jua',sans-serif;font-size:17px;text-shadow:0 0 12px #dfc18c88}
.pk-board{display:flex;gap:5px}
.pk-c{--w:44px;width:var(--w);height:calc(var(--w)*1.4);border-radius:6px;background:#f7f3e9;color:#172b33;position:relative;flex:none;box-shadow:0 3px 8px #0005;font-weight:700}
.pk-c.pk-r{color:#bd514f}
.pk-c b{position:absolute;left:4px;top:2px;font-size:calc(var(--w)*.42);letter-spacing:-.06em}
.pk-c i{position:absolute;right:4px;bottom:1px;font-style:normal;font-size:calc(var(--w)*.55)}
.pk-c.pk-back{background:repeating-linear-gradient(45deg,#1b4d4b,#1b4d4b 3px,#255a55 3px,#255a55 4px);border:2px solid #e0cfab}
.pk-c.pk-slot{background:none;border:1px dashed #ffffff30;box-shadow:none}
.pk-c.pk-new{animation:pk-flip .45s ease-out}
.pk-c.pk-hot{box-shadow:0 0 0 2px var(--gold),0 0 14px #dfc18c99}
@keyframes pk-flip{from{transform:rotateY(90deg) translateY(-6px);opacity:.3}to{transform:none;opacity:1}}
.pk-seat{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;transition:opacity .3s}
.pk-box{position:relative;display:flex;align-items:center;gap:6px;background:#0b1519e6;border:1px solid var(--line);border-radius:10px;padding:4px 9px;min-width:84px;max-width:120px;overflow:hidden}
.pk-box .pk-c{--w:17px}.pk-box .pk-c b{font-size:9px;left:2px;top:0}.pk-box .pk-c i{font-size:10px;right:2px}
.pk-box .pk-cs{display:flex;gap:2px}
.pk-who{display:flex;flex-direction:column;min-width:0;line-height:1.25}
.pk-who b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.pk-who span{font-size:12px;color:var(--gold)}
.pk-tag{font-style:normal;font-size:11px;padding:1px 7px;border-radius:8px;background:#ffffff1a;color:var(--ink);white-space:nowrap}
.pk-tag.pk-allin{background:var(--red);color:#fff}
.pk-tag.pk-hand{background:var(--gold);color:#172b33;font-weight:700}
.pk-turn .pk-box{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold),0 0 16px #dfc18c77}
.pk-fold{opacity:.42}
.pk-won .pk-box{border-color:var(--gold);background:#3b3220f0}
.pk-time{position:absolute;left:0;bottom:0;height:3px;background:var(--gold);animation:pk-time linear forwards}
@keyframes pk-time{from{width:var(--from)}to{width:0}}
.pk-d{position:absolute;right:-14px;top:-14px;width:20px;height:20px;border-radius:50%;background:#f7f3e9;color:#172b33;font-size:11px;font-weight:800;display:grid;place-items:center;box-shadow:0 2px 4px #0006}
.pk-bet{position:absolute;transform:translate(-50%,-50%);font-size:12px;padding:2px 8px;border-radius:9px;background:#0b1519cc;border:1px solid #dfc18c66;color:var(--gold);white-space:nowrap}
.pk-seat.pk-me{flex-direction:row;align-items:flex-end;gap:8px;top:auto!important;bottom:2px;transform:translateX(-50%)}
.pk-me .pk-mine{display:flex;gap:5px}
.pk-me .pk-mine .pk-c{--w:46px}
.pk-bar{display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 10px 10px;min-height:52px;flex-wrap:wrap}
.pk-bar .pk-msg{color:var(--mute);font-size:14px}
.pk-bar .pk-msg b{color:var(--ink)}
.pk-act{flex:1;max-width:180px;font-size:15px;font-weight:700;padding:0 12px;background:#24363b}
.pk-act.pk-call{background:#367b77}
.pk-act.pk-raise,.pk-go{background:var(--gold);color:#172b33!important}
.pk-act:disabled{opacity:.4;cursor:default}
.pk-rz{display:flex;align-items:center;gap:6px;width:100%;max-width:640px}
.pk-rz input{flex:1;min-width:60px;accent-color:#dfc18c;height:28px}
.pk-rz .pk-q{background:#ffffff14;padding:0 10px;font-size:12px}
.pk-go{padding:0 14px;font-weight:700;white-space:nowrap}
@media (max-height:440px){
 .pk-panel{border-radius:12px}
 .pk-top{min-height:34px;padding-top:4px;font-size:12px}.pk-title{font-size:15px}
 .pk-table{margin:0 6px}
 .pk-c{--w:30px}.pk-me .pk-mine .pk-c{--w:32px}
 .pk-box{padding:2px 7px;min-width:72px}.pk-who b,.pk-who span{font-size:11px}
 .pk-tag{font-size:10px;padding:0 5px}
 .pk-bar{min-height:46px;padding:2px 8px 6px;gap:6px}
 .pk-pot{font-size:12px}.pk-pot.pk-win{font-size:14px}
 .pk-mid{gap:3px}
}
`;

export function createPokerUI(ctx) {
  if (!document.getElementById('pk-style')) document.head.append(Object.assign(document.createElement('style'), { id: 'pk-style', textContent: CSS }));
  const el = document.createElement('div');
  el.className = 'pk-panel'; el.hidden = true;
  el.innerHTML = `<div class="pk-top"><div class="pk-title">♠ 텍사스 홀덤<small></small></div><div class="pk-log"></div><div class="pk-wallet">지갑 <b></b></div><button class="pk-exit">나가기</button></div>
    <div class="pk-table"><div class="pk-felt"></div><div class="pk-seats"></div><div class="pk-mid"><div class="pk-pot"></div><div class="pk-board"></div></div></div>
    <div class="pk-bar"></div>`;
  ctx.root.append(el);
  const $ = (s) => el.querySelector(s);
  const bar = $('.pk-bar');
  let st = null, seen = new Set(), barKey = '', raising = false;
  $('.pk-exit').onclick = () => ctx.stand();
  const wallet = () => ($('.pk-wallet b').textContent = n(ctx.chips()));
  ctx.onChips?.(wallet);

  // 새로 보이는 카드만 뒤집히는 연출 (같은 자리·같은 카드는 그대로)
  const card = (c, key, cls = '') => {
    if (!c) return `<div class="pk-c pk-slot"></div>`;
    if (c === '??') return `<div class="pk-c pk-back ${cls}"></div>`;
    const k = key + c, fresh = !seen.has(k);
    next.add(k);
    return `<div class="pk-c ${'hd'.includes(c[1]) ? 'pk-r' : ''} ${fresh ? 'pk-new' : ''} ${cls}"><b>${c[0] === 'T' ? '10' : c[0]}</b><i>${SUIT[c[1]]}</i></div>`;
  };
  let next = new Set();

  function render() {
    const s = st, me = s.players[s.me], N = s.players.length, show = s.phase === 'showdown' && s.results;
    next = new Set();
    $('.pk-title small').textContent = `${s.sb}/${s.bb}`;
    $('.pk-log').textContent = (s.log.at(-1) || '').replace(/\b([2-9TJQKA])([shdc])\b/g, (_, r, u) => (r === 'T' ? '10' : r) + SUIT[u]); // 엔진 로그의 'Jd' → 'J♦'
    wallet();
    // 내 자리가 맨 아래, 나머지는 시계 방향으로 타원 둘레에
    const pos = (i, r = 1) => { const a = Math.PI / 2 + ((i - Math.max(0, s.me) + N) % N) * (2 * Math.PI / N); return [50 + 43 * r * Math.cos(a), 50 + 41 * r * Math.sin(a)]; };
    const winners = new Set(show ? s.results.pots.flatMap((p) => p.winners) : []);
    $('.pk-seats').innerHTML = s.players.map((p, i) => {
      const [x, y] = pos(i), mine = i === s.me, turn = i === s.toAct;
      const tag = p.handName && show ? `<em class="pk-tag pk-hand">${p.handName}</em>` : p.left ? '<em class="pk-tag">나감</em>'
        : p.allIn ? '<em class="pk-tag pk-allin">올인</em>' : p.lastAction ? `<em class="pk-tag">${esc(p.lastAction)}</em>` : '';
      const time = turn && !p.bot && s.left > 0 ? `<i class="pk-time" style="--from:${(100 * s.left / s.turnMs).toFixed(1)}%;animation-duration:${s.left}ms"></i>` : '';
      const cs = p.cards.map((c, k) => card(c, `p${i}${k}`)).join('');
      const [bx, by] = pos(i, 0.6);
      return `<div class="pk-seat ${mine ? 'pk-me' : ''} ${turn ? 'pk-turn' : ''} ${p.folded || p.left || (!p.inHand && s.phase !== 'waiting') ? 'pk-fold' : ''} ${winners.has(i) ? 'pk-won' : ''}" style="left:${x}%;top:${y}%">
        ${mine && cs ? `<div class="pk-mine">${cs}</div>` : ''}
        <div class="pk-box">${!mine && cs ? `<div class="pk-cs">${cs}</div>` : ''}<div class="pk-who"><b>${p.bot ? '🤖 ' : ''}${esc(p.name)}</b><span>${p.chips ? n(p.chips) : '칩 없음'}</span></div>${time}</div>
        ${tag}${i === s.dealer && s.handNo ? '<i class="pk-d">D</i>' : ''}</div>${p.bet && !show ? `<div class="pk-bet" style="left:${bx}%;top:${by}%">${n(p.bet)}</div>` : ''}`;
    }).join('');
    const pot = $('.pk-pot');
    const won = s.players.map((p, i) => [p, i]).filter(([p]) => p.won > 0);
    pot.className = 'pk-pot' + (show ? ' pk-win' : '');
    pot.textContent = show ? '🏆 ' + won.map(([p]) => `${p.name} +${n(p.won)}`).join(' · ') + (s.results.showdown ? ` · ${s.results.pots[0].hand}` : '')
      : s.phase === 'waiting' ? '함께 칠 사람을 기다리는 중…' : s.pot ? `팟 ${n(s.pot)}` : '';
    $('.pk-board').innerHTML = s.phase === 'waiting' ? '' : [0, 1, 2, 3, 4].map((k) => card(s.community[k], 'b')).join('');
    seen = next;
    renderBar(me);
  }

  // 행동 버튼은 내 차례 정보가 바뀔 때만 다시 그림 (슬라이더를 끄는 중에 상태가 와도 안 튐)
  function renderBar(me) {
    const s = st, myTurn = me && s.toAct === s.me && me.inHand;
    const key = myTurn ? `${s.handNo}|${s.phase}|${s.currentBet}|${me.bet}|${me.chips}|${raising}` : `w|${s.canRebuy}|${s.toAct}|${s.phase}|${me?.inHand}`;
    if (key === barKey) return;
    barKey = key;
    if (s.canRebuy) {
      bar.innerHTML = `<span class="pk-msg">칩이 다 떨어졌어요</span><button class="pk-act pk-raise" data-a="rebuy">리바인</button><button class="pk-act" data-a="stand">일어나기</button>`;
    } else if (!myTurn) {
      const who = s.players[s.toAct];
      bar.innerHTML = `<span class="pk-msg">${s.phase === 'waiting' ? '곧 시작해요' : !me?.inHand && s.phase !== 'showdown' ? '다음 판부터 참여해요' : who ? `<b>${esc(who.name)}</b> 차례` : s.phase === 'showdown' ? '다음 판 준비 중' : ''}</span>`;
    } else {
      const toCall = s.currentBet - me.bet, maxTo = me.bet + me.chips, minTo = Math.min(maxTo, s.currentBet + s.minRaise);
      const canRaise = maxTo > s.currentBet, label = s.currentBet ? '레이즈' : '벳';
      if (raising && canRaise) {
        const at = (f) => Math.max(minTo, Math.min(maxTo, Math.round((s.currentBet + f * (s.pot + toCall)) / 10) * 10));
        bar.innerHTML = `<div class="pk-rz"><button class="pk-q" data-a="back">✕</button><input type="range" min="${minTo}" max="${maxTo}" step="10" value="${minTo}">
          <button class="pk-q" data-v="${minTo}">최소</button><button class="pk-q" data-v="${at(0.5)}">½팟</button><button class="pk-q" data-v="${at(1)}">팟</button><button class="pk-q" data-v="${maxTo}">올인</button>
          <button class="pk-go" data-a="raise"></button></div>`;
        const r = bar.querySelector('input'), go = bar.querySelector('.pk-go');
        const sync = () => (go.textContent = +r.value >= maxTo ? `올인 ${n(maxTo)}` : `${label} ${n(r.value)}`);
        r.oninput = sync; sync();
        bar.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { r.value = b.dataset.v; sync(); }));
      } else {
        bar.innerHTML = `<button class="pk-act" data-a="fold">폴드</button>
          <button class="pk-act pk-call" data-a="${toCall > 0 ? 'call' : 'check'}">${toCall <= 0 ? '체크' : toCall >= me.chips ? `올인 ${n(me.chips)}` : `콜 ${n(toCall)}`}</button>
          ${canRaise && toCall < me.chips ? `<button class="pk-act pk-raise" data-a="open">${label}</button>` : ''}`;
      }
    }
  }
  bar.onclick = (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'stand') return ctx.stand();
    if (a === 'open' || a === 'back') { raising = a === 'open'; return renderBar(st.players[st.me]); }
    const m = { a };
    if (a === 'raise') m.amount = +bar.querySelector('input').value;
    raising = false;
    ctx.send(m);
  };

  return {
    open() { // 상태가 open 보다 먼저 올 수도 있음
      el.hidden = false; wallet(); barKey = '';
      if (st) render(); else bar.innerHTML = '<span class="pk-msg">자리에 앉는 중…</span>';
    },
    close() { el.hidden = true; st = null; seen = new Set(); barKey = ''; raising = false; $('.pk-seats').innerHTML = $('.pk-board').innerHTML = $('.pk-pot').textContent = ''; },
    onMsg(m) {
      if (m.error) ctx.toast(m.error);
      if (!m.state) return;
      if (m.state.handNo !== st?.handNo) raising = false;
      st = m.state;
      if (!el.hidden) render();
    },
  };
}
