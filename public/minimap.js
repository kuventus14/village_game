// 지도: 오른쪽 아래 미니맵(나를 따라다니는 반경 70m, 북쪽 위 고정) + 전체 지도(미니맵 누르기·M 키)
// 그림은 world.js 의 좌표를 그때그때 읽어 그림(건물 크기·위치가 바뀌어도 따라감). 땅·길·건물은 밑그림 한 장에 한 번만 그려 두고, 매번 내 위치만큼 오려 붙인 뒤 이름표·점만 그림
import * as W from './world.js';
import { SPINE, STREET_HW } from './housedata.js';

export const VIEW_R = 70; // 미니맵이 보여 주는 반경 (m)
export const BAKE_S = 3; // 밑그림 해상도 (px/m)
const HZ = 1000 / 15; // 다시 그리는 간격 (약 15번/초)

// ───── 계산 (DOM 없음: test-minimap.mjs 가 그대로 씀) ─────
// 캠프는 아직 없을 수 있음 (world.js 에 CAMP 가 생기면 x·z 만 보고 아이콘을 그림)
const camp = () => (Number.isFinite(W.CAMP?.x) && Number.isFinite(W.CAMP?.z) ? W.CAMP : null);
// 지도에 담을 월드 범위 [x0, z0, x1, z1]: 마을 + 숲길(양옆 숲) + 사찰 마당 + 캠프
export function worldBounds() {
  let x0 = -W.BX - 8, z0 = -W.BZ - 8, x1 = W.BX + 8, z1 = W.BZ + 8;
  const add = (x, z, mx, mz = mx) => { x0 = Math.min(x0, x - mx); z0 = Math.min(z0, z - mz); x1 = Math.max(x1, x + mx); z1 = Math.max(z1, z + mz); };
  for (const [x, z] of W.TRAIL.pts) add(x, z, 24);
  const Y = W.TEMPLE_YARD; add(Y.cx, Y.cz, Y.w / 2 + 8, Y.d / 2 + 8);
  const c = camp(); if (c) add(c.x, c.z, 30);
  const P = W.PARK; if (P) { add(P.x0, P.z0, 14); add(P.x1, P.z1, 14); } // 포근 놀이공원 부지 (+ 둘레 숲)
  if (W.DISTRICT) { add(W.DISTRICT.x0, W.openZ0(W.HOUSING.open), 8); add(W.DISTRICT.x1, W.DISTRICT.z1, 8); } // 북쪽 주택 단지 (열린 큰길까지, 큰길이 열리면 밑그림을 다시 그림)
  return [x0, z0, x1, z1];
}
// 보기 = 가운데(cx,cz) · 배율 k(px/m) · 크기 w×h(px). 지도 x = 월드 x, 지도 아래 = 월드 +z (북쪽 -z 가 위)
export const view = (cx, cz, k, w, h = w) => ({ cx, cz, k, w, h });
export const fitView = ([x0, z0, x1, z1], w, h, pad = 0) => view((x0 + x1) / 2, (z0 + z1) / 2, Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (z1 - z0)), w, h);
export const miniView = (x, z, size) => view(x, z, size / (2 * VIEW_R), size);
export const toMap = (v, x, z) => [(x - v.cx) * v.k + v.w / 2, (z - v.cz) * v.k + v.h / 2];
export const fromMap = (v, px, py) => [(px - v.w / 2) / v.k + v.cx, (py - v.h / 2) / v.k + v.cz];
// 밑그림(범위 b, s px/m)에서 보기 v 에 들어오는 부분 → drawImage(src, sx,sy,sw,sh, dx,dy,dw,dh). 밑그림 밖은 잘라 냄, 하나도 안 겹치면 null
export function crop(v, b, s) {
  const [wx0, wz0] = fromMap(v, 0, 0), [wx1, wz1] = fromMap(v, v.w, v.h);
  const cx0 = Math.max(wx0, b[0]), cz0 = Math.max(wz0, b[1]), cx1 = Math.min(wx1, b[2]), cz1 = Math.min(wz1, b[3]);
  if (cx1 <= cx0 || cz1 <= cz0) return null;
  const [dx, dy] = toMap(v, cx0, cz0);
  return { sx: (cx0 - b[0]) * s, sy: (cz0 - b[1]) * s, sw: (cx1 - cx0) * s, sh: (cz1 - cz0) * s, dx, dy, dw: (cx1 - cx0) * v.k, dh: (cz1 - cz0) * v.k };
}
// 장소 이름표 (pri 작을수록 먼저 자리 잡고, 겹치면 뒤엣것이 이모지만 → 그래도 겹치면 생략)
export function labels() {
  const B = W.BUILDINGS, out = [], add = (x, z, icon, text, pri) => out.push({ x, z, icon, text, pri });
  for (const k of ['temple', 'cathedral', 'church', 'casino', 'cafe', 'office']) if (B[k] && W.PLACE[k]) add(B[k].cx, B[k].cz, ...W.PLACE[k], 1);
  const c = camp(); if (c) add(c.x, c.z, '🔥', '캠프', 1);
  if (W.ENTRY) add(W.ENTRY.x, W.ENTRY.z, ...W.PLACE.district, 1);
  if (W.PARK) { const P = W.PROMENADE; add((P.x0 + P.x1) / 2, P.z, ...W.PLACE.park, 1); add(W.ZOO_ARCH.x, (W.ZOO_ZONE.z0 + W.ZOO_ZONE.z1) / 2, ...W.PLACE.zoo, 1); add(W.PARK_GATE.x + 10, W.PARK_GATE.z, '🏰', '정문', 2); for (const s of Object.values(W.RIDE_SLOTS)) if (s.id !== 'train') add(s.x, s.z, { ferris: '🎡', carousel: '🎠', coaster: '🎢', viking: '🏴‍☠️', bumper: '🚗', teacups: '☕', swing: '🌼', drop: '🗼', flume: '🛶' }[s.id], s.name, 4); }
  add(W.FOUNTAIN.x, W.FOUNTAIN.z, '⛲', '광장', 2);
  add(W.GATE.x, W.GATE.z, '🚪', '대문', 2);
  add(W.POND.x, W.POND.z, '🎣', '연못', 3);
  add(W.TAG.cx, W.TAG.cz, '🏃', W.TAG.name, 3);
  add(W.DODGE.cx, W.DODGE.cz, '💦', '피구', 3);
  return out.sort((a, b) => a.pri - b.pri);
}
const r10 = (m) => Math.max(10, Math.round(m / 10) * 10);
// 지금 있는 곳 한 줄: 장소 + (숲길이면) 사찰·대문까지 남은 길 거리
export function where(x, z) {
  const pl = W.placeOf(x, z), [icon, name] = W.PLACE[pl] ?? W.PLACE.town;
  if (pl !== 'trail') return { pl, icon, name, tip: '', toTemple: null };
  const s = W.trailNear(x, z).s, toTemple = W.TRAIL.len - s;
  return { pl, icon, name, toTemple, tip: `🛕 사찰까지 약 ${r10(toTemple)}m · 🚪 대문 ${r10(s)}m` };
}

// ───── 그림 ─────
const COL = { cafe: '#c98b5e', office: '#6f93d8', casino: '#e0607e', cathedral: '#d8b47a', church: '#c4654b', temple: '#a8683e' };
const FIELD = '#bcdca6', ROAD = '#f3c3bb', WATER = '#7cc4f0', INK = '#4a3b44';
// 밑그림: 들판·숲길·사찰 마당·마을 땅·길·광장·물·놀이터·집·건물 (정적이라 한 번만)
function bake(paths) {
  const b = worldBounds(), s = BAKE_S, c = document.createElement('canvas');
  c.width = Math.ceil((b[2] - b[0]) * s); c.height = Math.ceil((b[3] - b[1]) * s);
  const x = c.getContext('2d'), P = (wx, wz) => [(wx - b[0]) * s, (wz - b[1]) * s];
  x.lineCap = x.lineJoin = 'round';
  const line = (pts, w, col) => { x.strokeStyle = col; x.lineWidth = w * s; x.beginPath(); pts.forEach(([px, pz], i) => x[i ? 'lineTo' : 'moveTo'](...P(px, pz))); x.stroke(); };
  const rect = ([x0, z0, x1, z1], fill, stroke) => { const [a, bb] = P(x0, z0); x.fillStyle = fill; x.fillRect(a, bb, (x1 - x0) * s, (z1 - z0) * s); if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1.5; x.strokeRect(a, bb, (x1 - x0) * s, (z1 - z0) * s); } };
  const disc = (cx, cz, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(...P(cx, cz), r * s, 0, 7); x.fill(); };
  const box = (o) => [o.cx - o.w / 2, o.cz - o.d / 2, o.cx + o.w / 2, o.cz + o.d / 2];
  const tRect = (r) => { const a = W.toWorld('temple', r[0], r[1]), q = W.toWorld('temple', r[2], r[3]); return [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[0], q[0]), Math.max(a[1], q[1])]; };
  x.fillStyle = FIELD; x.fillRect(0, 0, c.width, c.height);
  // 숲길: 양옆 빽빽한 숲 → 시내 → 흙길
  line(W.TRAIL.pts, 34, '#7fb878');
  if (W.STREAM) line(W.STREAM, 2.6, WATER);
  line(W.TRAIL.pts, 8, '#e2c296');
  if (W.CAMP_PATH) { line(W.CAMP_PATH.pts, 30, '#7fb878'); line(W.CAMP_PATH.pts, 8, '#e2c296'); } // 불멍 캠프 길
  // 사찰 마당 (돌바닥) + 법당 둘레 전각·석탑
  const Y = W.TEMPLE_YARD, TP = W.SACRED_PROPS?.temple;
  rect(box(Y), '#efe5d6', '#c9b9a2');
  if (TP) { for (const k of ['hallL', 'hallR', 'bellDeck', 'cheonwang']) if (TP[k]) rect(tRect(TP[k]), '#c79068', '#00000030'); if (TP.pagoda) { const r = tRect(TP.pagoda); disc((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, 3.2, '#8f8577'); } }
  // 마을 땅 + 울타리 (동쪽 대문은 뚫림)
  rect([-W.BX, -W.BZ, W.BX, W.BZ], '#d4eebd');
  const g0 = W.GATE.z - W.GATE.hw, g1 = W.GATE.z + W.GATE.hw;
  const V = W.VILLAGE_GATE_W, w0 = V ? V.z - V.hw : 0, w1 = V ? V.z + V.hw : 0; // 서쪽 대문(놀이공원)도 뚫림
  for (const pts of V ? [[[W.BX, g0], [W.BX, -W.BZ], [-W.BX, -W.BZ], [-W.BX, w0]], [[-W.BX, w1], [-W.BX, W.BZ], [W.BX, W.BZ], [W.BX, g1]]] : [[[W.BX, g0], [W.BX, -W.BZ], [-W.BX, -W.BZ], [-W.BX, W.BZ], [W.BX, W.BZ], [W.BX, g1]]]) line(pts, 0.8, '#b08a64');
  if (W.DISTRICT) { // 북쪽 주택 단지: 열린 구역 땅 · 대문 길 · 입구 광장 · 중앙로 · 큰길 · 집(주인 있든 없든 같은 색)
    const D = W.DISTRICT, n = W.HOUSING.open, DIRT = '#ecd6b4', G = W.GATE_ROAD;
    rect([D.x0, W.openZ0(n), D.x1, D.z1], '#d4eebd', '#b08a64'); rect([G.x - G.hw, G.z1, G.x + G.hw, G.z0], DIRT); disc(W.ENTRY.x, W.ENTRY.z, W.ENTRY.r, ROAD);
    rect([SPINE.x - STREET_HW, W.openZ0(n), SPINE.x + STREET_HW, SPINE.z0], DIRT);
    for (const a of W.STREETS.slice(0, n)) rect([D.x0, a.z - STREET_HW, D.x1, a.z + STREET_HW], DIRT);
    for (const pl of W.PLOTS) if (W.isOpen(pl, n)) rect(pl.house, '#d9a98a', '#00000038');
  }
  // 길·광장·성당/교회 앞마당 (분홍 돌바닥)
  for (const [pts, w] of paths || []) line(pts, w, ROAD);
  for (const r of Object.values(W.SACRED_YARDS)) rect(r, ROAD);
  disc(W.FOUNTAIN.x, W.FOUNTAIN.z, 10.2, ROAD);
  disc(W.POND.x, W.POND.z, W.POND.r, WATER);
  disc(W.FOUNTAIN.x, W.FOUNTAIN.z, W.FOUNTAIN.r + 0.6, '#e8d8cc'); disc(W.FOUNTAIN.x, W.FOUNTAIN.z, W.FOUNTAIN.r, '#9fd6f5');
  // 놀이터 2곳 (울타리 안 놀이 공간)
  for (const g of [W.TAG, W.DODGE]) rect([g.cx - g.hw, g.cz - g.hd, g.cx + g.hw, g.cz + g.hd], '#fff1bf', '#d4a95f');
  // 집(지붕 색)·건물(종류별 색)
  for (const h of W.HOUSES) rect([h.x - h.w / 2, h.z - h.d / 2, h.x + h.w / 2, h.z + h.d / 2], h.r, '#00000030');
  for (const [k, o] of Object.entries(W.BUILDINGS)) rect(box(o), COL[k] ?? '#b9a08a', '#00000038');
  const cp = camp(); if (cp) disc(cp.x, cp.z, cp.r ?? 7, '#e9d7b8');
  if (W.PARK) { // 포근 놀이공원: 둘레 숲 → 부지 잔디 → 구역 → 길·광장·대로 → 기구 자리 → 꼬마기차 선로 → 정문
    const P = W.PARK, Z = W.ZOO_ZONE, RZ = W.RIDES_ZONE, E = W.ENTRY_PLAZA, M = W.PROMENADE;
    line(W.PARK_ROAD.pts, 26, '#7fb878'); line(W.PARK_ROAD.pts, 9, '#e2c296');
    if (W.LAKE) { for (let i = 0; i < W.PARK_ROAD.pts.length; i += 2) { const [x, z] = W.PARK_ROAD.pts[i], e = (W.lakeEdge(W.PARK_ROAD.s[i], -1) + W.lakeEdge(W.PARK_ROAD.s[i], 1)) / 2; if (e > 1) disc(x, z, e, '#8fd0f0'); } line(W.PARK_ROAD.pts.filter((_, i) => W.PARK_ROAD.s[i] >= W.BRIDGE.s0 && W.PARK_ROAD.s[i] <= W.BRIDGE.s1), 9, '#fff0e0'); } // 호수 + 다리
    rect([P.x0 - 14, P.z0 - 14, P.x1 + 14, P.z1 + 14], '#7fb878'); rect([P.x0, P.z0, P.x1, P.z1], '#cfeab8', '#b08a64');
    rect([Z.x0, Z.z0, Z.x1, Z.z1], '#d9eec0'); rect([RZ.x0, RZ.z0, RZ.x1, RZ.z1], '#e3f0c6');
    for (const p of W.ZOO_PENS ?? []) rect([p.x0, p.z0, p.x1, p.z1], '#c4e3a3', '#8fb873');
    for (const p of W.PARK_PATHS) line([p.a, p.b], p.hw * 2, p.kind === 'promenade' ? ROAD : '#f3dcc4');
    rect([E.x0, E.z0, E.x1, E.z1], ROAD); disc(W.PLAZA_FOUNTAIN.x, W.PLAZA_FOUNTAIN.z, W.PLAZA_FOUNTAIN.r, '#9fd6f5'); disc(M.x0 + 4, M.z, 16, ROAD);
    for (const s of Object.values(W.RIDE_SLOTS)) if (s.id !== 'train') rect(W.slotRect(s), s.stage === 1 ? '#ffd6e2' : '#f6ead2', '#d8a8b8');
    x.setLineDash([3 * s, 2 * s]); line([...W.TRAIN_PATH.pts, W.TRAIN_PATH.pts[0]], 1.4, '#9a7b62'); x.setLineDash([]);
    for (const t of W.GATE_TOWERS) disc(t.x, t.z, t.r, '#ffb8c8');
  }
  return { c, b, s, L: labels(), open: W.HOUSING.open };
}
const rr = (x, x0, y0, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(x0, y0, w, h, r) : x.rect(x0, y0, w, h); };
// 한 장 그리기: 밑그림 오려 붙이기 → (밤이면 살짝 어둡게) → 이름표 → 다른 사람 점 → 내 시야·화살표
function paint(ctx, v, B, { players, me, yaw, night, big, short, dest }) {
  ctx.fillStyle = FIELD; ctx.fillRect(0, 0, v.w, v.h);
  const r = crop(v, B.b, B.s);
  if (r) ctx.drawImage(B.c, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  if (night > 0.05) { ctx.fillStyle = `rgba(30,40,90,${(night * 0.16).toFixed(3)})`; ctx.fillRect(0, 0, v.w, v.h); }
  const fs = big ? 15 : 10.5, lh = fs + 7, placed = [];
  ctx.font = `${fs}px Jua, 'Apple SD Gothic Neo', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hit = (a) => placed.some((q) => a[0] < q[2] && a[2] > q[0] && a[1] < q[3] && a[3] > q[1]);
  for (const L of B.L) {
    const [px, py] = toMap(v, L.x, L.z);
    if (px < -40 || py < -20 || px > v.w + 40 || py > v.h + 20) continue;
    for (const t of short ? [L.icon] : [`${L.icon} ${L.text}`, L.icon]) {
      const w = ctx.measureText(t).width + 10, a = [px - w / 2, py - lh / 2, px + w / 2, py + lh / 2];
      if (hit(a)) continue;
      placed.push(a); ctx.fillStyle = big ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.74)'; rr(ctx, a[0], a[1], w, lh, lh / 2); ctx.fill();
      ctx.fillStyle = INK; ctx.fillText(t, px, py + 1); break;
    }
  }
  const OUT = W.OUTFITS, pr = big ? 5.5 : 4.2;
  for (const p of players.values()) {
    if (p === me) continue;
    const [px, py] = toMap(v, p.x, p.z);
    if (px < -6 || py < -6 || px > v.w + 6 || py > v.h + 6) continue;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fillStyle = OUT[p.a?.oc] ?? '#888'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  if (dest) { const [dx, dy] = toMap(v, dest[0], dest[1]); ctx.beginPath(); ctx.arc(dx, dy, big ? 6 : 4, 0, 7); ctx.fillStyle = '#ffd43b'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); } // 자동 걸음 목적지
  if (!me) return;
  const [mx, my] = toMap(v, me.x, me.z), s = big ? 1.3 : 1;
  if (yaw != null) { // 카메라가 보는 쪽 부채꼴: 카메라 앞 = 월드 (-sin yaw, -cos yaw)
    const a = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.arc(mx, my, 30 * s, a - 0.55, a + 0.55); ctx.closePath(); ctx.fillStyle = 'rgba(255,90,115,.22)'; ctx.fill();
  }
  ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.atan2(Math.cos(me.ry), Math.sin(me.ry))); ctx.scale(s, s); // 아바타 앞 = 월드 (sin ry, cos ry)
  ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, 6.5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -6.5); ctx.closePath();
  ctx.fillStyle = '#ff5a73'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  if (big) { ctx.font = `bold 14px Jua, sans-serif`; const t = '📍 현재 위치', w = ctx.measureText(t).width + 12; ctx.fillStyle = '#ff5a73'; rr(ctx, mx - w / 2, my - 36, w, 21, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(t, mx, my - 25); }
}
// 캔버스 크기를 화면 크기(CSS)·화면 배율에 맞춤 → 그릴 2D 컨텍스트
function fit(cv) {
  const d = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
  return [x, w, h];
}

// ───── 화면: #mm(미니맵) 안에 그리고, 전체 지도는 처음 열 때 만듦 ─────
export function createMinimap({ root, host, menu, players, getMe, getYaw, getNight, paths, onOpen, onPick, getDest }) {
  const KEY = 'village.map', get = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
  const cv = root.querySelector('canvas'), chip = root.querySelector('.mmpl');
  let B = null, on = get(), last = 0, big = null, chipT = '', bv = null, down = null;
  root.hidden = !on;
  // 설정 메뉴: '내 계정' 위에 켜기/끄기
  const acct = menu.querySelector('[data-a="edit"]')?.previousElementSibling, mi = document.createElement('div');
  mi.innerHTML = '<div class="hd">🗺️ 지도</div><button data-map><b>🗺️ 지도 보이기</b><small>작은 지도 (PC 오른쪽 아래·폰 오른쪽 위) · M 키 = 큰 지도</small></button>';
  acct ? acct.before(...mi.children) : menu.append(...mi.children);
  const btn = menu.querySelector('[data-map]'), mark = () => btn.setAttribute('aria-pressed', on);
  btn.onclick = () => { on = !on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {} root.hidden = !on; mark(); };
  mark();
  root.addEventListener('click', () => toggle());
  function open() {
    if (!big) {
      big = document.createElement('div'); big.id = 'bigmap';
      big.innerHTML = '<div class="panel"><div class="hd"><b>🗺️ 포근마을 지도</b><span class="chip"></span><small>가고 싶은 곳을 누르면 걸어가요</small><button aria-label="닫기">✕</button></div><canvas></canvas></div>';
      host.append(big);
      const c = big.querySelector('canvas');
      c.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
      big.addEventListener('click', (e) => { // 지도 그림을 누르면(끌지 않고 톡) 그곳으로 자동 걸음, ✕·바깥은 그냥 닫힘 — 어느 쪽이든 지도는 닫혀 걷는 모습이 보임
        if (e.target === c && bv && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 10) { const r = c.getBoundingClientRect(); onPick?.(...fromMap(bv, e.clientX - r.left, e.clientY - r.top)); }
        down = null; toggle(false);
      });
    }
    big.hidden = false; onOpen?.(); last = 0;
  }
  const isOpen = () => !!big && !big.hidden;
  function toggle(want = !isOpen()) { if (want) open(); else if (big) big.hidden = true; }
  function draw(now = performance.now()) {
    const me = getMe();
    if (!me || now - last < HZ || (!on && !isOpen())) return;
    last = now; if (B && B.open !== W.HOUSING.open) B = null; B ??= bake(paths);
    const opt = { players, me, yaw: getYaw(), night: getNight?.() ?? 0, dest: getDest?.() }, w = where(me.x, me.z), t = `${w.icon} ${w.name}${w.tip ? ' · ' + w.tip : ''}`;
    if (on) {
      const [x, sw] = fit(cv);
      paint(x, miniView(me.x, me.z, sw), B, { ...opt, short: sw < 110 });
      if (t !== chipT) { chipT = t; chip.textContent = sw < 110 && w.tip ? `${w.icon} ${w.tip.split(' · ')[0]}` : t; } // 폰은 좁아서 사찰까지 거리만
    }
    if (isOpen()) {
      const c = big.querySelector('canvas'), [x, bw, bh] = fit(c);
      paint(x, (bv = fitView(B.b, bw, bh, 14)), B, { ...opt, big: true });
      big.querySelector('.chip').textContent = `📍 ${t}`;
    }
  }
  // 키: 큰 지도가 열려 있으면 M·Esc 로 닫고 나머지 키는 먹음(이동 안 됨). 닫혀 있으면 M 으로 엶 (can = 피아노·행동 중이 아님)
  function key(e, can) {
    if (isOpen()) { if (e.code === 'KeyM' || e.key === 'Escape') toggle(false); return true; }
    if (e.code === 'KeyM' && can && !e.repeat) { toggle(true); return true; }
    return false;
  }
  return { draw, key, toggle, isOpen };
}
