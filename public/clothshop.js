// 옷 가게 (화면): 마을 광장 남서쪽 가게 · 가까이 가면 안내 카드 · 구매 창(옷·꾸미기 목록, 산 것 표시) · 산 옷은 아바타 꾸미기에서 입음
// 규칙은 서버 closet.js (거리·칩·중복·로그인 검사), 값·자리·소유 규칙은 closet.js(공용). 메시지 { t:'closet', a:'buy'|'open' } ↔ { a:'state'|'bought'|'no' }
import { OPT } from './world.js';
import { buildStall, SHOP_CSS } from './shop.js';
import { CLOSET, CLOSET_STALL, NEAR_RANGE, BUY_RANGE } from './closet.js';

const CSS = SHOP_CSS.replaceAll('#shq', '#clq').replaceAll('#shopPanel', '#clPanel');

export function createClothShop({ scene, getMe, send, toast, host, onEdit, isGuest, onOwned }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const mk = (h) => { const d = document.createElement('div'); d.innerHTML = h; return host.appendChild(d.firstElementChild); };
  const card = mk('<div id="clq" class="panel" hidden></div>'), panel = mk('<div id="clPanel" hidden></div>');
  buildStall(scene, CLOSET_STALL, { sign: '👗 옷 가게', signBg: '#8f6fd6', awning: ['#fff4e6', '#c8b8ff'], goods: 'clothes' });
  let owned = [], open = false;
  const n = (x) => x.toLocaleString('ko-KR'), nameOf = (kind, i) => OPT[kind][i];

  function render() {
    const me = getMe(), row = ([kind, i, price]) => {
      const key = kind + i, has = owned.includes(key);
      return `<div class="row"><div><b>${nameOf(kind, i)}</b><small>${has ? '✓ 가지고 있어요' : `🪙 ${n(price)}`}</small></div>${has ? '<span style="opacity:.6;font-size:14px">보유</span>' : `<button class="go" data-a="buy" data-i="${key}">사기</button>`}</div>`;
    };
    panel.innerHTML = `<div class="hd"><b>👗 옷 가게</b><button data-a="x" aria-label="닫기">✕</button></div>
      <div class="sub"><span>🪙 내 칩 ${n(me?.chips ?? 0)}</span><span>${isGuest() ? '로그인하면 살 수 있어요' : '한 번 사면 계속 입어요'}</span></div>
      <div class="sec">옷 스타일</div>${CLOSET.filter(([k]) => k === 'os').map(row).join('')}
      <div class="sec">꾸미기</div>${CLOSET.filter(([k]) => k === 'ac').map(row).join('')}
      <button class="go all" data-a="edit">👤 아바타 꾸미기 열기 (산 옷 입어 보기)</button>`;
  }
  const close = () => { open = false; panel.hidden = true; };
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    if (b.dataset.a === 'x') return close();
    if (b.dataset.a === 'edit') return onEdit();
    if (b.dataset.a === 'buy') { if (isGuest()) return toast('로그인하면 옷을 살 수 있어요'); send({ t: 'closet', a: 'buy', i: b.dataset.i }); }
  });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  card.addEventListener('click', (e) => { if (!e.target.closest('button')) return; e.stopPropagation(); open = true; panel.hidden = false; send({ t: 'closet', a: 'open' }); render(); });

  function handle(m) {
    if (m.owned) { owned = m.owned; onOwned?.(owned); }
    if (m.a === 'bought') { const [k, i] = [m.i.slice(0, 2), +m.i.slice(2)]; toast(`👗 ${nameOf(k, i)} 샀어요! 아바타 꾸미기에서 입어 보세요`); }
    if (m.a === 'no') toast(m.error);
    if (open) render();
  }
  const snapshot = (s) => { if (s) { owned = s.owned; onOwned?.(owned); } };
  let tick = 0;
  function update(dt, busy) {
    const me = getMe(); tick += dt;
    const d = me ? Math.hypot(me.x - CLOSET_STALL.x, me.z - CLOSET_STALL.z) : 99, near = !!me && !me.fl && d < NEAR_RANGE;
    if (open && (!me || me.fl || d > BUY_RANGE + 2 || me.sit >= 0)) close();
    const show = near && !open && !busy;
    if (show && card.hidden) { card.hidden = false; card.innerHTML = '<b>👗 옷 가게</b><small>옷과 꾸미기를 칩으로 사요</small><div style="display:flex;gap:8px;margin-top:4px"><button class="go">구경하기</button></div>'; }
    else if (!show && !card.hidden) card.hidden = true;
    if (open && tick > 0.5) { tick = 0; render(); }
  }
  return { handle, snapshot, update, close, get open() { return open; }, get owned() { return owned; } };
}
