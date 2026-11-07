// 집 안(방) (화면): 현관 앞 "들어가기" 카드 · 방 모양(바닥·벽·창·문·천장등) · 가구 · 안에서 쓰는 막대(나가기·꾸미기·문 잠그기) · 가구 꾸미기 창 · 가구 백화점(마을 광장 가게)
// 규칙은 서버 house.js (현관 거리·잠금·가구 검사·칩), 방 설계·가구 값은 roomdata.js. 방은 들어와 있는 동안만 만들고 나가면 지움.
// 메시지 { t:'house', a:'enter'|'leave'|'lock'|'furn'|'buy' } ↔ { a:'in'|'out'|'furn'|'inv'|'no' }
import * as THREE from 'three';
import { ROOM, roomBox, FURN, FURN_KEYS, FURN_STALL, NEAR_RANGE, BUY_RANGE, MAX_FURN, STEP, footprint, cleanFurn, setRoomFurn, restSpots, REST_RANGE } from './roomdata.js';
import { PLOTS, plotById } from './housedata.js';
import { Kit, bx, cy, sp, hdr, plane, leaf, buildKit, face, bands, windowPair } from './buildings.js';
import { buildStall, SHOP_CSS } from './shop.js';

const PI = Math.PI, WOOD = '#c99b6a', CREAM = '#fff4e6';
const BASE = SHOP_CSS.replaceAll('#shopPanel', '#rmPanel');
const CSS = BASE.replaceAll('#shq', '#rmq') + BASE.replaceAll('#shq', '#rmr') + `
#rmBar{position:fixed;left:50%;transform:translateX(-50%);top:calc(62px + env(safe-area-inset-top));z-index:7;display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:20px;background:var(--glass);backdrop-filter:blur(10px);box-shadow:var(--sh);font-size:15px;max-width:calc(100vw - 16px)}
#rmBar b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34vw}
#rmBar button{padding:6px 12px;min-height:36px;border-radius:14px;background:#fff;border:2px solid #f0d9c4;font-size:15px;white-space:nowrap}
#rmBar button.go{background:#1fa2b8;border-color:#1fa2b8;color:#fff}
#rmEdit{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));z-index:8;width:min(460px,calc(100vw - 16px));max-height:46vh;overflow:auto;overscroll-behavior:contain;padding:10px 12px;border-radius:22px;background:var(--glass);backdrop-filter:blur(10px);box-shadow:var(--sh)}
#rmEdit .chips2{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}#rmEdit button,#rmPanel button{padding:6px 10px;min-height:38px;border-radius:12px;background:#fff;border:2px solid #f0d9c4;font-size:15px}
#rmEdit button[aria-pressed=true]{background:#ffd45a;border-color:#e0b020}#rmEdit .pad{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}
#rmEdit .hd{display:flex;align-items:center;gap:8px;font-size:17px}#rmEdit .hd button{margin-left:auto}
#rmEdit small{opacity:.65}
`;

/* ── 가구 모양 (정면 = +z, 가운데가 원점, 크기는 roomdata.js FURN 과 같음) ── */
const MODEL = {
  bed: (k) => k.p('wood', bx(1.3, 0.28, 2.1), [0, 0.14, 0], WOOD).p('plain', bx(1.2, 0.2, 1.95), [0, 0.38, 0.02], '#fffaf0').p('plain', bx(0.9, 0.12, 0.4), [0, 0.52, -0.7], '#ffffff').p('plain', bx(1.22, 0.1, 1.15), [0, 0.5, 0.42], '#ff9fb8').p('wood', bx(1.3, 0.8, 0.08), [0, 0.5, -1.04], '#b98c5f'),
  bed2: (k) => { k.p('wood', bx(1.8, 0.3, 2.2), [0, 0.15, 0], '#ffe9f0').p('plain', bx(1.7, 0.24, 2.05), [0, 0.42, 0.02], '#ffffff').p('plain', bx(0.7, 0.12, 0.4), [-0.42, 0.58, -0.75], '#ffffff').p('plain', bx(0.7, 0.12, 0.4), [0.42, 0.58, -0.75], '#ffffff').p('plain', bx(1.72, 0.1, 1.2), [0, 0.55, 0.4], '#ff8fb1').p('plain', bx(1.8, 1.1, 0.08), [0, 0.7, -1.08], '#ffc4d6');
    for (const sx of [-0.87, 0.87]) for (const sz of [-1.07, 1.07]) k.p('wood', cy(0.04, 0.04, 1.7, 8), [sx, 0.85, sz], '#fff0f4');
    return k.p('plain', bx(1.8, 0.05, 2.2), [0, 1.72, 0], '#ffd0de'); },
  desk: (k) => { k.p('wood', bx(1.4, 0.06, 0.7), [0, 0.74, 0], WOOD).p('wood', bx(0.5, 0.5, 0.6), [0.45, 0.45, 0], '#b98c5f').p('plain', bx(0.42, 0.02, 0.3), [-0.2, 0.78, 0.05], '#eceff4').p('plain', bx(0.42, 0.28, 0.02), [-0.2, 0.92, -0.1], '#3b4252', [-0.2, 0, 0]);
    for (const sx of [-0.65]) for (const sz of [-0.3, 0.3]) k.p('wood', bx(0.06, 0.72, 0.06), [sx, 0.36, sz], '#b98c5f');
    return k; },
  chair: (k) => { k.p('wood', bx(0.5, 0.06, 0.5), [0, 0.45, 0], '#e8b987').p('wood', bx(0.5, 0.45, 0.05), [0, 0.7, -0.23], '#e8b987');
    for (const sx of [-0.21, 0.21]) for (const sz of [-0.21, 0.21]) k.p('wood', bx(0.05, 0.44, 0.05), [sx, 0.22, sz], '#b98c5f');
    return k; },
  table: (k) => k.p('wood', bx(1.2, 0.06, 1.2), [0, 0.72, 0], WOOD).p('wood', cy(0.09, 0.12, 0.7, 10), [0, 0.35, 0], '#b98c5f').p('plain', cy(0.07, 0.09, 0.2, 10), [0, 0.85, 0], '#8fdcc4').p('plain', sp(0.12, 8, 6), [0, 1.0, 0], '#ff8fb1'),
  rug: (k) => k.p('plain', bx(2.4, 0.03, 1.8), [0, 0.015, 0], '#ff9fb8').p('plain', bx(2.0, 0.035, 1.4), [0, 0.02, 0], CREAM).p('plain', bx(1.5, 0.04, 0.9), [0, 0.025, 0], '#ffd0de'),
  rug2: (k) => k.p('plain', cy(1.0, 1.0, 0.03, 28), [0, 0.015, 0], '#c8a2ff').p('plain', cy(0.8, 0.8, 0.035, 28), [0, 0.02, 0], '#fff4fb').p('plain', cy(0.45, 0.45, 0.04, 28), [0, 0.025, 0], '#ffb3d0'),
  lamp: (k) => k.p('plain', cy(0.16, 0.2, 0.04, 12), [0, 0.02, 0], '#b98c5f').p('plain', cy(0.025, 0.025, 1.3, 8), [0, 0.67, 0], '#b98c5f').p('glow', cy(0.14, 0.24, 0.3, 12), [0, 1.45, 0], hdr('#ffe2a8', 1.5)),
  sofa: (k) => k.p('plain', bx(2.0, 0.4, 0.9), [0, 0.22, 0], '#8fb3ff').p('plain', bx(2.0, 0.55, 0.22), [0, 0.62, -0.34], '#7fa3f0').p('plain', bx(0.22, 0.38, 0.9), [-0.89, 0.5, 0], '#7fa3f0').p('plain', bx(0.22, 0.38, 0.9), [0.89, 0.5, 0], '#7fa3f0').p('plain', bx(0.7, 0.14, 0.6), [-0.4, 0.5, 0.08], '#a9c4ff').p('plain', bx(0.7, 0.14, 0.6), [0.4, 0.5, 0.08], '#a9c4ff'),
  shelf: (k) => { k.p('wood', bx(1.4, 1.8, 0.4), [0, 0.9, 0], WOOD).p('plain', bx(1.3, 1.7, 0.3), [0, 0.9, 0.06], '#f6e7d3');
    for (let i = 0; i < 4; i++) { k.p('wood', bx(1.32, 0.05, 0.34), [0, 0.35 + i * 0.45, 0.06], '#b98c5f'); for (let j = 0; j < 6; j++) k.p('plain', bx(0.1, 0.28, 0.2), [-0.55 + j * 0.2, 0.52 + i * 0.45, 0.06], ['#ff8fb1', '#8fdcc4', '#ffd45a', '#9fd3ff', '#c8b8ff', '#ff9f43'][(i + j) % 6]); }
    return k; },
  plant: (k) => k.p('plain', cy(0.24, 0.17, 0.36, 12), [0, 0.18, 0], '#ff9f66').p('plain', leaf(0.36, 3), [0, 0.7, 0], '#6cc47b').p('plain', leaf(0.24, 5), [0.12, 1.0, 0.05], '#8fdc9a'),
  tv: (k) => k.p('wood', bx(1.6, 0.45, 0.5), [0, 0.22, 0], WOOD).p('plain', bx(1.2, 0.72, 0.05), [0, 0.86, 0], '#2f3440').p('glow', bx(1.12, 0.64, 0.02), [0, 0.86, 0.03], hdr('#9fd3ff', 0.9)).p('plain', bx(0.3, 0.04, 0.2), [0, 0.47, 0.05], '#2f3440'),
  wardrobe: (k) => k.p('wood', bx(1.2, 1.9, 0.6), [0, 0.95, 0], '#d6b08a').p('wood', bx(0.02, 1.8, 0.02), [0, 0.95, 0.31], '#8a6a4a').p('shine', bx(0.04, 0.2, 0.04), [-0.08, 0.95, 0.32], '#f2c35a').p('shine', bx(0.04, 0.2, 0.04), [0.08, 0.95, 0.32], '#f2c35a'),
  piano: (k) => k.p('plain', bx(1.5, 1.0, 0.8), [0, 0.5, -0.05], '#26262c').p('plain', bx(1.4, 0.04, 0.3), [0, 0.8, 0.35], '#ffffff').p('plain', bx(1.5, 0.06, 0.12), [0, 0.88, 0.2], '#26262c').p('plain', bx(0.5, 0.06, 0.4), [0, 0.45, 0.8], '#26262c').p('plain', bx(0.5, 0.4, 0.4), [0, 0.2, 0.8], '#3a3a42'),
  tank: (k) => k.p('wood', bx(1.0, 0.6, 0.5), [0, 0.3, 0], WOOD).p('plain', bx(0.94, 0.5, 0.44), [0, 0.85, 0], '#cfeaf5').p('glow', bx(0.88, 0.44, 0.38), [0, 0.85, 0], hdr('#7fd0e8', 0.85)).p('plain', sp(0.07, 8, 6), [-0.15, 0.85, 0], '#ff9f43', [0, 0, 0], [1.6, 1, 0.8]).p('plain', sp(0.06, 8, 6), [0.2, 0.9, 0.04], '#ffd45a', [0, 0, 0], [1.6, 1, 0.8]),
};

export function createRoom({ scene, players, getMe, send, toast, host, plots, isGuest }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const mk = (h) => { const d = document.createElement('div'); d.innerHTML = h; return host.appendChild(d.firstElementChild); };
  const card = mk('<div id="rmq" class="panel" hidden></div>'), restC = mk('<div id="rmr" class="panel" hidden></div>'), bar = mk('<div id="rmBar" hidden></div>'), edit = mk('<div id="rmEdit" hidden></div>'), shopP = mk('<div id="rmPanel" hidden></div>'), shopC = mk('<div id="rmsq" class="panel" hidden></div>');
  shopC.className = 'panel'; shopC.id = 'rmsq';
  document.head.append(Object.assign(document.createElement('style'), { textContent: SHOP_CSS.replaceAll('#shq', '#rmsq').replaceAll('#shopPanel', '#rmPanel') }));
  const S = { plot: 0, furn: [], inv: null, name: '', owner: '', lock: false, mine: false };
  let grp = null, group = null, sel = -1, editing = false, saveT = 0, shopOpen = false;
  const n = (x) => x.toLocaleString('ko-KR');
  buildStall(scene, FURN_STALL, { sign: '🛋️ 가구 백화점', signBg: '#8f6fd6', awning: [CREAM, '#c8a2ff'], goods: 'furn' });

  /* ── 방 모양 ── */
  function buildRoom() {
    dispose(); const b = { ...roomBox(S.plot), w: ROOM.w, d: ROOM.d, door: '+z', dw: 1.6, h: ROOM.h };
    grp = new THREE.Group(); scene.add(grp);
    const k = new Kit(); k.at(b.cx, 0, b.cz);
    k.p('parquet', plane(ROOM.w, ROOM.d, 1.6).rotateX(-PI / 2), [0, 0.02, 0], '#ffffff').p('plain', plane(ROOM.w, ROOM.d).rotateX(PI / 2), [0, ROOM.h, 0], '#fff8ee');
    bands(k, b, 0, ROOM.h, 'paper', '#fff2e0', { door: false }); bands(k, b, 0, 1.0, 'wains', '#ffffff', { door: false, dz: 0.02 });
    for (const dx of [-4.5, 0, 4.5]) windowPair(k, b, '-z', b.cx + dx, 1.9, 1.6, 1.4, {});
    face(k, b, '+z', b.cx, 1.25, false).p('plain', plane(1.9, 2.55), [0, 0, 0.03], '#fffaf0').p('wood', plane(1.6, 2.4), [0, -0.02, 0.05], '#a86a4a').p('shine', sp(0.06, 8, 6), [0.6, -0.1, 0.1], '#f2c35a'); // 문: 안쪽에서만 보이는 판(밖에서 카메라가 벽 너머로 나가도 가리지 않게)
    for (const [dx, c] of [[-6, '#ffb3c6'], [5, '#9fd3ff']]) face(k, b, '+x', b.cz + dx * 0.5, 1.9, false).p('wood', bx(0.9, 0.7, 0.05), [0, 0, 0.03], '#b98c5f').p('plain', plane(0.78, 0.58), [0, 0, 0.07], c);
    k.at(b.cx, 0, b.cz).p('plain', sp(0.2, 10, 8), [0, ROOM.h - 0.3, 0], '#fff').p('glow', sp(0.16, 10, 8), [0, ROOM.h - 0.32, 0], hdr('#fff0c8', 2));
    const g = new THREE.Group(); buildKit(k, g, false); grp.add(g);
    const pl = new THREE.PointLight('#fff0d8', 1.8, 22, 1.1); pl.position.set(b.cx, ROOM.h - 0.7, b.cz); grp.add(pl);
    group = new THREE.Group(); grp.add(group); drawFurn();
  }
  function drawFurn() {
    if (!group) return; for (const c of [...group.children]) { group.remove(c); c.traverse((o) => o.geometry?.dispose?.()); }
    const b = roomBox(S.plot), k = new Kit();
    for (const f of S.furn) { k.at(b.cx + f.x, 0, b.cz + f.z, f.r * PI / 2); MODEL[f.k]?.(k); }
    const g = new THREE.Group(); buildKit(k, g, false); group.add(g);
    const f = S.furn[sel]; if (f && editing) { const [x0, z0, x1, z1] = footprint(f); const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.1, 0.06, z1 - z0 + 0.1), new THREE.MeshBasicMaterial({ color: '#ffd45a', transparent: true, opacity: 0.55, depthTest: false })); m.position.set(b.cx + f.x, 0.05, b.cz + f.z); m.renderOrder = 9; group.add(m); }
  }
  function dispose() { if (!grp) return; scene.remove(grp); grp.traverse((o) => o.geometry?.dispose?.()); grp = group = null; }

  /* ── 안에서 쓰는 막대 ── */
  function renderBar() {
    if (!S.plot) return void (bar.hidden = true);
    bar.hidden = false;
    bar.innerHTML = `<b>🏠 ${S.name}</b>${S.mine ? `<button data-a="edit">${editing ? '✔ 꾸미기 끝' : '🛋️ 꾸미기'}</button><button data-a="lock">${S.lock ? '🔒 잠김' : '🔓 열림'}</button>` : `<small>${S.owner}님의 집</small>`}<button class="go" data-a="leave">🚪 나가기</button>`;
  }
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    if (b.dataset.a === 'leave') { setEditing(false); send({ t: 'house', a: 'leave' }); }
    if (b.dataset.a === 'lock') send({ t: 'house', a: 'lock', on: !S.lock });
    if (b.dataset.a === 'edit') setEditing(!editing);
  });
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());

  /* ── 꾸미기 창: 놓인 가구 고르기 → 옮기기·돌리기·창고에 넣기 / 창고에서 꺼내 놓기 ── */
  const placed = (key) => S.furn.filter((f) => f.k === key).length, stock = (key) => (S.inv?.[key] ?? 0) - placed(key);
  function setEditing(on) { editing = on && S.mine; sel = -1; edit.hidden = !editing; renderBar(); if (editing) renderEdit(); drawFurn(); }
  function renderEdit() {
    const f = S.furn[sel], cnt = {};
    edit.innerHTML = `<div class="hd"><b>🛋️ 방 꾸미기</b><small>${S.furn.length}/${MAX_FURN}개</small><button data-a="done">끝</button></div>
      <small>놓인 가구 (눌러서 고르기)</small><div class="chips2">${S.furn.map((g, i) => `<button data-a="sel" data-i="${i}" aria-pressed="${i === sel}">${FURN[g.k].icon} ${FURN[g.k].name}${(cnt[g.k] = (cnt[g.k] ?? 0) + 1) > 1 ? ' ' + cnt[g.k] : ''}</button>`).join('') || '<small>비어 있어요</small>'}</div>
      ${f ? `<div class="pad"><b>${FURN[f.k].icon} ${FURN[f.k].name}</b><button data-a="mv" data-x="-1" data-z="0">◀</button><button data-a="mv" data-x="0" data-z="-1">▲</button><button data-a="mv" data-x="0" data-z="1">▼</button><button data-a="mv" data-x="1" data-z="0">▶</button><button data-a="rot">⟳ 돌리기</button><button data-a="stash">📦 창고로</button></div><small>▲는 창문 쪽, ▼는 문 쪽이에요</small>` : ''}
      <small>창고 (눌러서 방에 놓기)</small><div class="chips2">${FURN_KEYS.filter((key) => stock(key) > 0).map((key) => `<button data-a="put" data-k="${key}">${FURN[key].icon} ${FURN[key].name} ×${stock(key)}</button>`).join('') || '<small>창고가 비었어요 · 마을 광장 가구 백화점에서 새 가구를 사 보세요</small>'}</div>`;
  }
  function commit(list) { // 화면에 먼저 반영하고 서버에 저장 요청 (서버가 검사해서 다시 보내 줌)
    const next = cleanFurn(list, S.inv); if (next.length !== list.length) return toast('거기엔 놓을 수 없어요 (벽·다른 가구·문 앞)');
    S.furn = next; setRoomFurn(S.plot, next); drawFurn(); renderEdit(); clearTimeout(saveT); saveT = setTimeout(() => send({ t: 'house', a: 'furn', list: S.furn }), 200);
  }
  edit.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    const a = b.dataset.a, f = S.furn[sel];
    if (a === 'done') return setEditing(false);
    if (a === 'sel') { sel = +b.dataset.i; drawFurn(); return renderEdit(); }
    if (a === 'mv' && f) return commit(S.furn.map((g) => (g === f ? { ...g, x: g.x + b.dataset.x * STEP, z: g.z + b.dataset.z * STEP } : g)));
    if (a === 'rot' && f) return commit(S.furn.map((g) => (g === f ? { ...g, r: (g.r + 1) % 4 } : g)));
    if (a === 'stash' && f) { const i = sel; sel = -1; return commit(S.furn.filter((_, j) => j !== i)); }
    if (a === 'put') { // 방 가운데에서 가까운 빈 자리를 찾아 놓음
      const k = b.dataset.k, spots = []; for (let x = -7; x <= 7; x += STEP) for (let z = -4.5; z <= 4; z += STEP) spots.push([x, z]);
      spots.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
      for (const [x, z] of spots) { const list = [...S.furn, { k, x, z, r: 0 }]; if (cleanFurn(list, S.inv).length === list.length) { sel = list.length - 1; return commit(list); } }
      toast('놓을 자리가 없어요');
    }
  });
  edit.addEventListener('pointerdown', (e) => e.stopPropagation());

  /* ── 현관 앞 카드 / 백화점 ── */
  function frontOf(pl) { const out = Math.cos(pl.door.face) > 0 ? 2.6 : -2.6; return [pl.door.x, pl.door.z + out]; }
  card.addEventListener('click', (e) => { if (!e.target.closest('button')) return; e.stopPropagation(); if (card.dataset.plot) send({ t: 'house', a: 'enter', plot: +card.dataset.plot }); });
  /* 앉기·눕기: 방 안에서 의자·소파·침대 자리 가까이 가면 카드 (이미 누가 쓰는 자리·이미 앉은 나는 빼고) */
  let restSel = null;
  restC.addEventListener('click', (e) => { if (!e.target.closest('button') || !restSel) return; e.stopPropagation(); send({ t: 'house', a: 'rest', i: restSel.i, s: restSel.s }); });
  function nearRest(me) {
    if (!S.plot || !me || me.pose && me.rh) return null;
    const b = roomBox(S.plot); let best = null, bd = REST_RANGE;
    for (const sp of restSpots(S.furn)) {
      const d = Math.hypot(me.x - b.cx - sp.x, me.z - b.cz - sp.z); if (d >= bd) continue;
      let used = false; for (const q of players.values()) if (q !== me && q.rh && Math.hypot(q.x - b.cx - sp.x, q.z - b.cz - sp.z) < 0.5) used = true;
      if (!used) { best = sp; bd = d; }
    }
    return best;
  }
  function renderShop() {
    const me = getMe(), mineHas = S.inv != null;
    shopP.innerHTML = `<div class="hd"><b>🛋️ 가구 백화점</b><button data-a="x" aria-label="닫기">✕</button></div><div class="sub"><span>🪙 내 칩 ${n(me?.chips ?? 0)}</span><span>${isGuest() ? '로그인하면 살 수 있어요' : '산 가구는 창고에 들어가요'}</span></div>` +
      FURN_KEYS.filter((key) => FURN[key].price).map((key) => `<div class="row"><i>${FURN[key].icon}</i><div><b>${FURN[key].name}</b><small>🪙 ${n(FURN[key].price)}${mineHas && S.inv[key] ? ` · 가진 수 ${S.inv[key]}` : ''}</small></div><button class="go" data-a="buy" data-k="${key}">사기</button></div>`).join('') +
      '<div class="sec" style="text-align:center">산 뒤에는 내 집 안에서 🛋️ 꾸미기로 놓아요</div>';
  }
  shopP.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    if (b.dataset.a === 'x') { shopOpen = false; shopP.hidden = true; return; }
    if (b.dataset.a === 'buy') { if (isGuest()) return toast('로그인하면 가구를 살 수 있어요'); send({ t: 'house', a: 'buy', k: b.dataset.k }); }
  });
  shopP.addEventListener('pointerdown', (e) => e.stopPropagation());
  shopC.addEventListener('click', (e) => { if (!e.target.closest('button')) return; e.stopPropagation(); shopOpen = true; shopP.hidden = false; send({ t: 'house', a: 'open' }); renderShop(); });

  function handle(m) {
    if (m.a === 'in') { Object.assign(S, { plot: m.plot, furn: m.furn, inv: m.inv ?? S.inv, name: m.name, owner: m.owner, lock: m.lock, mine: m.mine }); setRoomFurn(m.plot, m.furn); buildRoom(); renderBar(); }
    else if (m.a === 'out') { setEditing(false); setRoomFurn(S.plot, null); S.plot = 0; dispose(); renderBar(); }
    else if (m.a === 'furn' && m.plot === S.plot) { S.furn = m.furn; setRoomFurn(m.plot, m.furn); if (sel >= S.furn.length) sel = -1; drawFurn(); if (editing) renderEdit(); }
    else if (m.a === 'inv') { S.inv = m.inv; if (m.bought) toast(`🛋️ ${FURN[m.bought].name} 샀어요! 내 집 안에서 꾸미기로 놓아 보세요`); if (shopOpen) renderShop(); if (editing) renderEdit(); }
  }
  const snapshot = (s) => { if (s?.inv) S.inv = s.inv; };
  const setLock = (v) => { if (S.mine && S.plot) { S.lock = v; renderBar(); } };
  let tick = 0;
  function update(dt, busy) { // busy: 다른 안내가 떠 있으면 true
    const me = getMe(); tick += dt;
    if (S.plot && !me?.room && me && !(Math.abs(me.x - roomBox(S.plot).cx) < 20)) { /* 서버가 옮겨 준 뒤 'out' 이 안 온 경우를 위해 */ handle({ a: 'out' }); }
    // 현관 앞: 가장 가까운 주인 있는 집의 문 앞 3.4m 안
    let near = null;
    if (me && !S.plot && !me.fl && !busy) for (const pl of PLOTS) { const o = plots()[pl.id]; if (!o) continue; const [fx, fz] = frontOf(pl); if (Math.hypot(me.x - fx, me.z - fz) < 3.4) { near = { pl, o }; break; } }
    if (near && !card.hidden && card.dataset.plot === String(near.pl.id)) { /* 그대로 */ }
    else if (near) { card.hidden = false; card.dataset.plot = near.pl.id; const mineHere = near.o.o === me.name; card.innerHTML = `<b>🏠 ${near.o.n}</b><small>${near.o.l && !mineHere ? '🔒 문이 잠겨 있어요' : mineHere ? '내 집이에요' : `${near.o.o}님의 집 · 구경해요`}</small><div style="display:flex;gap:8px;margin-top:4px"><button class="go">🚪 들어가기</button></div>`; }
    else if (!card.hidden) { card.hidden = true; card.dataset.plot = ''; }
    const rs = busy || editing ? null : nearRest(me);
    if (rs && (!restSel || restSel.i !== rs.i || restSel.s !== rs.s || restC.hidden)) { restSel = rs; restC.hidden = false; const lie = rs.pose === 'lie'; restC.innerHTML = `<b>${FURN[rs.k].icon} ${FURN[rs.k].name}</b><small>${lie ? '누워서 쉬어요' : '앉아서 쉬어요'}</small><div style="display:flex;gap:8px;margin-top:4px"><button class="go">${lie ? '🛌 눕기' : '🧘 앉기'}</button></div>`; }
    else if (!rs && !restC.hidden) { restC.hidden = true; restSel = null; }
    const d = me ? Math.hypot(me.x - FURN_STALL.x, me.z - FURN_STALL.z) : 99, nearShop = !!me && !me.fl && d < NEAR_RANGE && !S.plot;
    if (shopOpen && (!me || me.fl || d > BUY_RANGE + 2 || me.sit >= 0)) { shopOpen = false; shopP.hidden = true; }
    const showShop = nearShop && !shopOpen && !busy;
    if (showShop && shopC.hidden) { shopC.hidden = false; shopC.innerHTML = '<b>🛋️ 가구 백화점</b><small>가구를 칩으로 사요</small><div style="display:flex;gap:8px;margin-top:4px"><button class="go">구경하기</button></div>'; }
    else if (!showShop && !shopC.hidden) shopC.hidden = true;
    if (shopOpen && tick > 0.5) { tick = 0; renderShop(); }
  }
  return { handle, snapshot, update, setLock, get inside() { return S.plot; }, state: S, get editing() { return editing; } };
}
