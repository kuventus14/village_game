// 물고기 가게 (화면): 연못 북쪽의 작은 가게 · 가까이 가면 안내 카드 · 판매 창(가방 물고기를 종류별로/전부 팔기) · 칩(카지노와 같은 돈)이 오름
// 규칙은 서버 shop.js (거리·하루 한도·값 검사), 값·자리는 fishdata.js·shopdata.js. 메시지 { t:'shop', a:'sell'|'sellall'|'open' } ↔ { a:'state'|'sold'|'no' }
import * as THREE from 'three';
import { FISH, FISH_BY } from './fishdata.js';
import { FISH_STALL, NEAR_RANGE, SELL_RANGE, DAILY_CAP, priceOf } from './shopdata.js';
import { Kit, bx, cy, sp, hdr, signTex, buildKit } from './buildings.js';
import { nightGlow } from './gfx.js';

const PI = Math.PI, CREAM = '#fff4e6', WOOD = '#e8b987', BLUE = '#5ab4d6', PINK = '#ff9fb8';
export const SHOP_CSS = `
#shopPanel .sec{margin:8px 2px 2px;font-size:13px;opacity:.7}
#shq{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(78px + env(safe-area-inset-bottom));padding:10px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:200px;animation:pop .2s}
#shq b{font-size:18px}#shq small{opacity:.7;font-size:13px}
#shq button,#shopPanel button{padding:8px 16px;min-height:40px;border-radius:14px;background:#fff;border:2px solid #f0d9c4;font-size:16px}
#shq button.go,#shopPanel button.go{background:#1fa2b8;border-color:#1fa2b8;color:#fff}
#shopPanel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 24px));max-height:calc(var(--vvh,100dvh) - 32px);overflow:auto;overscroll-behavior:contain;z-index:8;padding:14px 14px 12px;border-radius:24px;background:var(--glass);backdrop-filter:blur(10px);box-shadow:var(--sh)}
#shopPanel .hd{display:flex;align-items:center;gap:8px;font-size:19px}#shopPanel .hd span{margin-left:auto;font-size:14px;opacity:.75}
#shopPanel .hd button{width:36px;height:36px;padding:0;min-height:0;border-radius:50%}
#shopPanel .sub{display:flex;justify-content:space-between;margin:8px 2px 6px;font-size:14px;opacity:.8}
#shopPanel .row{display:flex;align-items:center;gap:8px;padding:7px 4px;border-top:2px dashed #f0d9c4}
#shopPanel .row i{font-style:normal;font-size:28px;width:38px;text-align:center}
#shopPanel .row div{flex:1;min-width:0;font-size:16px}#shopPanel .row small{display:block;opacity:.65;font-size:13px}
#shopPanel .row button{padding:6px 10px;min-height:36px;font-size:15px}
#shopPanel .empty{padding:18px 6px;text-align:center;opacity:.7;line-height:1.6}
#shopPanel .all{width:100%;margin-top:8px}
@media (pointer:coarse),(max-width:700px),(max-height:500px){#shq{bottom:calc(14px + env(safe-area-inset-bottom));padding:8px 14px}}
@media (pointer:coarse) and (orientation:portrait),(max-width:700px) and (orientation:portrait){#hud #shq{bottom:calc(88px + env(safe-area-inset-bottom));max-width:calc(100vw - 24px);min-width:min(240px,calc(100vw - 24px))}}
`;

/* ── 가게 모양: 줄무늬 차양 · 나무 계산대 · 물건(물고기 통 또는 옷걸이) · 매단 간판 · 따뜻한 등 (물고기 가게·옷 가게가 같이 씀) ── */
export function buildStall(scene, spot, { sign, signBg, awning, goods }) {
  const root = new THREE.Group(); root.name = 'stall'; root.position.set(spot.x, 0, spot.z); root.rotation.y = spot.ry; scene.add(root);
  const k = new Kit(); k.at(0, 0, 0);
  k.p('wood', bx(4.2, 0.12, 2.2), [0, 0.06, 0], '#cfa77a'); // 바닥 판
  k.p('wood', bx(3.6, 1.0, 0.9), [0, 0.62, 0.55], WOOD).p('plain', bx(3.8, 0.1, 1.1), [0, 1.15, 0.55], '#fff0d8'); // 계산대(앞은 +z)
  for (const sx of [-1.9, 1.9]) k.p('wood', cy(0.09, 0.09, 3.0, 8), [sx, 1.5, -0.8], '#b98c5f').p('wood', cy(0.09, 0.09, 2.5, 8), [sx, 1.25, 1.0], '#b98c5f'); // 기둥
  for (let i = 0; i < 8; i++) k.p('plain', bx(0.52, 0.08, 2.4), [-1.82 + i * 0.52, 2.73, 0.1], awning[i % 2], [0.18, 0, 0]); // 줄무늬 차양 (앞이 낮게 기움)
  k.p('plain', bx(4.2, 0.18, 0.12), [0, 2.38, 1.12], awning[1]); // 차양 끝 띠
  if (goods === 'fish') {
    for (const sx of [-1.1, 0.9]) k.p('plain', cy(0.38, 0.3, 0.45, 12), [sx, 0.32, -0.2], BLUE).p('plain', cy(0.33, 0.33, 0.04, 12), [sx, 0.55, -0.2], '#9fe0f0'); // 물통
    for (let i = 0; i < 3; i++) k.p('plain', sp(0.14, 8, 6), [-0.7 + i * 0.5, 1.26, 0.45], ['#ff9f66', '#ffd45a', '#c8b8ff'][i], [0, 0, 0], [1.5, 0.8, 0.8]); // 계산대 위 물고기 장식
  } else if (goods === 'furn') { // 가구: 계산대 위 작은 스탠드·화분, 뒤에 소파·책장 견본
    k.p('plain', bx(1.5, 0.45, 0.7), [-0.5, 0.3, -0.45], '#8fb3ff').p('plain', bx(1.5, 0.5, 0.15), [-0.5, 0.65, -0.78], '#7fa3f0').p('wood', bx(0.7, 1.5, 0.3), [1.3, 0.8, -0.6], '#d6b08a');
    k.p('plain', cy(0.1, 0.12, 0.05, 10), [-0.9, 1.2, 0.5], '#b98c5f').p('plain', cy(0.02, 0.02, 0.4, 6), [-0.9, 1.42, 0.5], '#b98c5f').p('glow', cy(0.1, 0.16, 0.2, 10), [-0.9, 1.7, 0.5], hdr('#ffe2a8', 1.5)).p('plain', cy(0.14, 0.1, 0.22, 10), [0.6, 1.3, 0.5], '#ff9f66').p('plain', sp(0.2, 8, 6), [0.6, 1.6, 0.5], '#6cc47b');
  } else { // 옷: 옷걸이 봉 + 걸린 옷 색 조각들 + 계산대 위 모자
    k.p('wood', cy(0.04, 0.04, 3.3, 8), [0, 2.1, -0.55], '#b98c5f', [0, 0, PI / 2]);
    ['#ff8fb1', '#8fdcc4', '#ffd45a', '#9fd3ff', '#c8b8ff', '#ff9f43', '#f783ac'].forEach((c, i) => k.p('plain', bx(0.34, 0.62, 0.08), [-1.4 + i * 0.47, 1.72, -0.55], c));
    k.p('plain', cy(0.2, 0.2, 0.12, 14), [-0.9, 1.26, 0.45], '#4dabf7').p('plain', sp(0.18, 10, 6), [-0.9, 1.34, 0.45], '#4dabf7', [0, 0, 0], [1, 0.7, 1]).p('plain', cy(0.2, 0.2, 0.12, 14), [0.5, 1.26, 0.45], '#ff8fb1').p('plain', sp(0.16, 10, 6), [0.5, 1.34, 0.45], '#ff8fb1', [0, 0, 0], [1, 0.8, 1]);
  }
  for (const sx of [-1.7, 1.7]) k.p('glow', sp(0.2, 10, 8), [sx, 2.25, 1.15], hdr('#ffd9a0', 1.8)); // 등
  const g = new THREE.Group(); buildKit(k, g, false); root.add(g);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.78), nightGlow(new THREE.MeshBasicMaterial({ map: signTex(sign, signBg, '#ffffff', 640, 166, 68), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), 1, 0.62, 0.5));
  board.position.set(0, 3.25, -0.8); root.add(board);
  return root;
}

export function createShop({ scene, getMe, send, toast, host }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: SHOP_CSS }));
  const mk = (h) => { const d = document.createElement('div'); d.innerHTML = h; return host.appendChild(d.firstElementChild); };
  const card = mk('<div id="shq" class="panel" hidden></div>'), panel = mk('<div id="shopPanel" hidden></div>');
  const S = { bag: {}, sold: 0, cap: DAILY_CAP };
  const n = (x) => x.toLocaleString('ko-KR');
  const bagCount = () => Object.values(S.bag).reduce((a, b) => a + b, 0);

  buildStall(scene, FISH_STALL, { sign: '🐟 물고기 가게', signBg: '#3d9ec2', awning: [CREAM, PINK], goods: 'fish' });

  /* ── 판매 창 ── */
  let open = false;
  function render() {
    const me = getMe(), ks = FISH.filter((f) => S.bag[f.k] > 0).sort((a, b) => b.price - a.price), tot = ks.reduce((t, f) => t + f.price * S.bag[f.k], 0), left = Math.max(0, S.cap - S.sold);
    panel.innerHTML = `<div class="hd"><b>🐟 물고기 가게</b><span>오늘 ${S.sold}/${S.cap}마리</span><button data-a="x" aria-label="닫기">✕</button></div>
      <div class="sub"><span>🪙 내 칩 ${n(me?.chips ?? 0)}</span><span>${left ? `오늘 ${left}마리 더 팔 수 있어요` : '오늘은 다 팔았어요'}</span></div>` +
      (ks.length ? ks.map((f) => `<div class="row"><i style="${f.fx || ''}">${f.icon}</i><div><b>${f.name}</b> ×${S.bag[f.k]}<small>한 마리 🪙 ${n(f.price)}</small></div><button data-a="sell" data-k="${f.k}">1마리</button><button data-a="sellall" data-k="${f.k}" class="go">전부</button></div>`).join('') + `<button class="go all" data-a="sellall">가방 전부 팔기 · 🪙 ${n(tot)}</button>`
        : '<div class="empty">가방이 비었어요<br>연못에서 낚시를 해 보세요 🎣<br><small>낡은 장화나 빈 깡통은 가방에 담기지 않아요</small></div>');
  }
  const close = () => { open = false; panel.hidden = true; };
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    if (b.dataset.a === 'x') return close();
    send({ t: 'shop', a: b.dataset.a, ...(b.dataset.k && { k: b.dataset.k }) });
  });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  card.addEventListener('click', (e) => { if (!e.target.closest('button')) return; e.stopPropagation(); open = true; panel.hidden = false; send({ t: 'shop', a: 'open' }); render(); });

  function handle(m) {
    if (m.a === 'state' || m.a === 'sold') { S.bag = m.bag; S.sold = m.sold; S.cap = m.cap; }
    if (m.a === 'sold') toast(`🐟 ${m.items.map(([k, c]) => `${FISH_BY[k].name} ${c}마리`).join(' · ')} 판매 · +${n(m.gain)}칩`);
    if (m.a === 'no') toast(m.error);
    if (open) render();
  }
  const snapshot = (s) => { if (s) { S.bag = s.bag; S.sold = s.sold; S.cap = s.cap; } };
  let tick = 0;
  function update(dt, busy) { // busy: 다른 안내(앉기·낚시·놀이기구…)가 떠 있으면 true
    const me = getMe(); tick += dt;
    const d = me ? Math.hypot(me.x - FISH_STALL.x, me.z - FISH_STALL.z) : 99, near = !!me && !me.fl && d < NEAR_RANGE;
    if (open && (!me || me.fl || d > SELL_RANGE + 2 || me.sit >= 0)) close();
    const show = near && !open && !busy;
    if (show && card.hidden) { card.hidden = false; card.innerHTML = `<b>🐟 물고기 가게</b><small>가방에 물고기 ${bagCount()}마리 · 칩으로 바꿔요</small><div style="display:flex;gap:8px;margin-top:4px"><button class="go">팔러 가기</button></div>`; }
    else if (!show && !card.hidden) card.hidden = true;
    else if (show && tick > 0.5) { tick = 0; const sm = card.querySelector('small'); if (sm) sm.textContent = `가방에 물고기 ${bagCount()}마리 · 칩으로 바꿔요`; }
    if (open && tick > 0.5) { tick = 0; render(); } // 칩이 바뀐 걸 반영
  }
  return { handle, snapshot, update, close, get open() { return open; }, state: S };
}
