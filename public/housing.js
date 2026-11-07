// 내 집 안내 (화면): 입구 광장 안내판 가까이 가면 카드 → 안내 창(내 집 정보·지붕 색 바꾸기·집 앞까지 걸어가기). 집은 가입하면 서버가 자동 배정(house.js)
// 주인 목록(plots)·열린 큰길(open)·내 집(mine)을 받아 단지 그림(district.js)에 알림
import { PLOTS, ROOFS, ENTRY, CLAIM_RANGE, STREETS, plotById, isOpen, setOpenAvenues } from './housedata.js';
import { SHOP_CSS } from './shop.js';

const CSS = SHOP_CSS.replaceAll('#shq', '#hsq').replaceAll('#shopPanel', '#hsPanel') + `
#hsPanel .roofs{display:flex;flex-wrap:wrap;gap:8px;margin:6px 2px}#hsPanel .roofs button{width:34px;height:34px;min-height:0;padding:0;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #e9d6c3}
#hsPanel .roofs button[aria-pressed=true]{box-shadow:0 0 0 3px var(--ink);transform:scale(1.15)}
#hsPanel .lots{display:flex;flex-wrap:wrap;gap:6px;margin:6px 2px;max-height:132px;overflow:auto}#hsPanel .lots button{min-height:34px;padding:4px 10px;font-size:15px}
#hsPanel .lots button[aria-pressed=true]{background:#1fa2b8;border-color:#1fa2b8;color:#fff}
`;

export function createHousing({ getMe, send, toast, host, district, walk, isGuest, onOpenChange }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const mk = (h) => { const d = document.createElement('div'); d.innerHTML = h; return host.appendChild(d.firstElementChild); };
  const card = mk('<div id="hsq" class="panel" hidden></div>'), panel = mk('<div id="hsPanel" hidden></div>');
  const S = { plots: {}, open: 1, mine: null };
  let open = false;
  const BOARD = { x: ENTRY.x, z: ENTRY.z + 1.5 }, dist = (me) => Math.hypot(me.x - BOARD.x, me.z - BOARD.z);
  const used = () => Object.keys(S.plots).length, cap = () => PLOTS.filter((p) => isOpen(p, S.open)).length;

  function render() {
    const mine = S.mine && plotById(S.mine.plot);
    const stat = `<div class="sub"><span>입주 ${used()}/${cap()}채</span><span>큰길 ${S.open}/${STREETS.length} 열림</span></div>`;
    panel.innerHTML = `<div class="hd"><b>🏡 내 집 안내</b><button data-a="x" aria-label="닫기">✕</button></div>${stat}` + (mine
      ? `<div class="row"><i>🏠</i><div><b>${S.mine.name}</b><small>${mine.av} 큰길 · ${mine.id}번 집</small></div></div>
        <div class="sec">지붕 색 바꾸기</div><div class="roofs">${ROOFS.slice(0, -1).map((c, i) => `<button data-a="roof" data-i="${i}" style="background:${c}" aria-pressed="${i === S.mine.roof}" aria-label="지붕 색 ${i + 1}"></button>`).join('')}</div>
        <button class="go all" data-a="walk">내 집 앞까지 걸어가기</button>`
      : isGuest() ? '<div class="empty">바로 입장 중에는 집이 없어요<br>회원가입하면 집을 한 채 무료로 드려요 🏡</div>'
        : '<div class="empty">지금은 빈 집이 없어요<br>곧 새 큰길이 열려요</div>');
  }
  const close = () => { open = false; panel.hidden = true; };
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    const a = b.dataset.a;
    if (a === 'x') return close();
    if (a === 'roof') return send({ t: 'house', a: 'roof', roof: +b.dataset.i });
    if (a === 'walk') { const p = plotById(S.mine.plot); close(); walk(p.gate.x, p.gate.z + (Math.cos(p.door.face) > 0 ? 2.5 : -2.5)); }
  });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  card.addEventListener('click', (e) => { if (!e.target.closest('button')) return; e.stopPropagation(); open = true; panel.hidden = false; send({ t: 'house', a: 'open' }); render(); });

  const apply = () => { district.setOwners(Object.fromEntries(Object.entries(S.plots).map(([id, v]) => [id, v]))); district.setOpen(S.open); district.setMine(S.mine?.plot ?? null); };
  function setOpen(n) { if (n !== S.open) { S.open = n; setOpenAvenues(n); onOpenChange?.(n); } }
  function handle(m) {
    if (m.a === 'state') { S.plots = m.plots; S.mine = m.mine; setOpen(m.open); apply(); }
    else if (m.a === 'owner') { S.plots[m.plot] = { o: m.o, r: m.r, n: m.n, l: m.l }; district.setOwner(m.plot, S.plots[m.plot]); }
    else if (m.a === 'open') { setOpen(m.n); district.setOpen(m.n); toast('🏡 새 큰길이 열렸어요! 집터가 더 생겼어요'); }
    else if (m.a === 'mine') { S.mine = { plot: m.plot, roof: m.roof, name: m.name }; district.setMine(m.plot); }
    else if (m.a === 'no') toast(m.error);
    if (open) render();
  }
  const snapshot = (s) => { if (!s) return; S.plots = s.plots; S.mine = s.mine; if (s.open !== S.open) { S.open = s.open; setOpenAvenues(s.open); onOpenChange?.(s.open); } apply(); };
  function update(dt, busy) {
    const me = getMe(), d = me ? dist(me) : 99, near = !!me && !me.fl && d < 7.5;
    if (open && (!me || me.fl || d > CLAIM_RANGE - 3)) close();
    const show = near && !open && !busy;
    if (show && card.hidden) { card.hidden = false; card.innerHTML = '<b>🏡 내 집 안내</b><small>가입하면 집 한 채 무료 · 지붕 색을 바꿔요</small><div style="display:flex;gap:8px;margin-top:4px"><button class="go">내 집 보기</button></div>'; }
    else if (!show && !card.hidden) card.hidden = true;
  }
  return { handle, snapshot, update, close, get open() { return open; }, state: S };
}
