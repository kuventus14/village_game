// 주택 단지 (화면): 마을 북문 · 대문 길 · 입구 광장(안내판) · 열린 큰길 · 열린 큰길의 집은 미리 지어져 있음(주인 없으면 회색 지붕·번호 팻말, 있으면 고른 지붕 색·문패) · 안 열린 구역 울타리
// 좌표·규칙은 housedata.js (서버 house.js 가 주인 목록을 정함). 주인 목록이 바뀌면 집·팻말 묶음을 다시 만듦 (집 최대 100채, 묶음이라 가벼움)
import * as THREE from 'three';
import { NORTH_GATE, GATE_ROAD, ENTRY, DISTRICT, STREETS, SPINE, STREET_HW, PLOTS, ROOFS, HOUSE, HOUSING, openZ0, isOpen } from './housedata.js';
import { soft, nightGlow } from './gfx.js';
import { Kit, bx, cy, sp, hdr, signTex, buildKit } from './buildings.js';
import { dirtTex, cobbleTex } from './textures.js';

const PI = Math.PI, CREAM = '#fff4e6', PINK = '#ff8fb1', WOOD = '#d6a77a';
const FACE = ['#fff0e0', '#ffe9d2', '#f2f6e6', '#e8f0fa'];

export function createDistrict(scene) {
  const root = new THREE.Group(); root.name = 'district'; scene.add(root);
  const owners = {}; let open = HOUSING.open, mine = null, dyn = null, dirty = true;
  const dirt = soft('#ffffff', { map: dirtTex(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), pave = soft('#ffffff', { map: cobbleTex(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
  const flat = (x0, z0, x1, z1, y, mat) => { // 월드 좌표로 무늬가 이어지는 납작한 판
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
  };

  /* ── 고정: 대문 길 · 입구 광장 · 북문 · 안내판 ── */
  root.add(flat(GATE_ROAD.x - GATE_ROAD.hw, GATE_ROAD.z1, GATE_ROAD.x + GATE_ROAD.hw, GATE_ROAD.z0 + 1, 0.03, dirt));
  { const g = new THREE.CircleGeometry(ENTRY.r, 48).rotateX(-PI / 2).translate(ENTRY.x, 0.05, ENTRY.z), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3); root.add(new THREE.Mesh(g, pave)); }
  const kS = new Kit();
  for (const s of [-1, 1]) kS.at(NORTH_GATE.x + s * (NORTH_GATE.hw + 0.4), 0, NORTH_GATE.z).p('stone', bx(0.9, 0.5, 0.9, 0.8), [0, 0.25, 0], '#efe4d8').p('stucco', bx(0.6, 4.6, 0.6, 1), [0, 2.7, 0], CREAM).p('plain', sp(0.38, 10, 6), [0, 5.2, 0], PINK).p('glow', sp(0.2, 8, 6), [0, 5.2, 0], hdr('#ffd9a8', 1.8));
  kS.at(NORTH_GATE.x, 4.75, NORTH_GATE.z).p('plain', bx(NORTH_GATE.hw * 2 + 1.6, 0.35, 0.4), [0, 0, 0], PINK).p('plain', new THREE.TorusGeometry(NORTH_GATE.hw + 0.4, 0.16, 6, 24, PI), [0, 0.05, 0], CREAM);
  // 입구 광장 안내판 (큰 판 + 두 기둥 + 지붕) — 가까이 가면 집터 안내 카드가 뜸 (housing.js)
  kS.at(ENTRY.x, 0, ENTRY.z + 1.5).p('wood', cy(0.14, 0.14, 3.2, 8), [-2.2, 1.6, 0], WOOD).p('wood', cy(0.14, 0.14, 3.2, 8), [2.2, 1.6, 0], WOOD).p('plain', bx(5.4, 2.0, 0.2), [0, 2.3, 0], '#fff8ee').p('roof', bx(6.2, 0.18, 1.2), [0, 3.55, 0], '#ff9fb8', [-0.15, 0, 0]).p('glow', sp(0.2, 8, 6), [-2.4, 3.3, 0.4], hdr('#ffd9a8', 1.8)).p('glow', sp(0.2, 8, 6), [2.4, 3.3, 0.4], hdr('#ffd9a8', 1.8));
  { const g = new THREE.Group(); buildKit(kS, g, false); root.add(g); }
  const nightBoard = (tex, w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), nightGlow(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), 1, 0.62, 0.5)); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m; };
  nightBoard(signTex('🏡 주택 단지', '#ff7aa2', '#ffffff', 640, 150, 66), 3.6, 0.85, NORTH_GATE.x, 4.2, NORTH_GATE.z - 0.22, PI); // 마을 쪽에서 보이는 면(남쪽)
  nightBoard(signTex('🏙️ 포근마을', '#4f8a5b', '#ffffff', 640, 150, 66), 3.6, 0.85, NORTH_GATE.x, 4.2, NORTH_GATE.z + 0.22, 0);
  nightBoard(signTex('🏡 내 집 안내 · 가입하면 한 채 무료', '#8f6fd6', '#ffffff', 1100, 190, 62), 5.0, 0.86, ENTRY.x, 2.5, ENTRY.z + 1.62, 0);
  nightBoard(signTex('🏡 내 집 안내 · 가입하면 한 채 무료', '#8f6fd6', '#ffffff', 1100, 190, 62), 5.0, 0.86, ENTRY.x, 2.5, ENTRY.z + 1.38, PI);

  /* ── 바뀌는 것: 열린 큰길·중앙로·가로등·울타리 · 집터 팻말 · 주인 있는 집 (주인 목록·열린 큰길이 바뀔 때 다시 만듦) ── */
  const atlas = (() => { // 집터 번호 팻말 한 장 (10×10)
    const c = document.createElement('canvas'); c.width = 1280; c.height = 640; const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 100; i++) { const cx = (i % 10) * 128, cz = Math.floor(i / 10) * 64; x.fillStyle = '#fff8ee'; x.fillRect(cx + 3, cz + 3, 122, 58); x.strokeStyle = '#e8a0a8'; x.lineWidth = 5; x.strokeRect(cx + 5, cz + 5, 118, 54); x.fillStyle = '#d6335a'; x.font = 'bold 34px sans-serif'; x.fillText(String(i + 1), cx + 64, cz + 24); x.fillStyle = '#6a5a64'; x.font = 'bold 17px sans-serif'; x.fillText('입주 대기', cx + 64, cz + 47); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const atlasMat = nightGlow(new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide }), 1, 0.62, 0.5);
  const tag = (name, w) => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fffaf0'; x.beginPath(); x.roundRect(4, 4, 504, 120, 28); x.fill(); x.strokeStyle = '#d9b48f'; x.lineWidth = 8; x.stroke(); x.fillStyle = '#4a3b44'; x.font = `bold ${name.length > 8 ? 48 : 60}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, 256, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return nightGlow(new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }), 1, 0.62, 0.5); };

  function rebuild() {
    dirty = false; if (dyn) { root.remove(dyn); dyn.traverse((o) => { o.geometry?.dispose?.(); if (o.material?.map && o.material.map !== atlas) { o.material.map.dispose(); o.material.dispose(); } }); }
    dyn = new THREE.Group(); root.add(dyn);
    const zN = openZ0(open), k = new Kit();
    dyn.add(flat(SPINE.x - STREET_HW, zN, SPINE.x + STREET_HW, SPINE.z0, 0.03, dirt));
    for (const a of STREETS.slice(0, open)) {
      dyn.add(flat(DISTRICT.x0, a.z - STREET_HW, DISTRICT.x1, a.z + STREET_HW, 0.03, dirt));
      for (let x = -120; x <= 120; x += 20) for (const s of [-1, 1]) if (Math.abs(x) > 8) { // 가로등: 큰길 가장자리, 번갈아
        const lx = x + (s > 0 ? 0 : 10); k.at(lx, 0, a.z + s * (STREET_HW + 0.6)).p('plain', cy(0.2, 0.28, 0.3, 10), [0, 0.15, 0], '#ff9fb8').p('plain', cy(0.07, 0.09, 3.3, 8), [0, 1.85, 0], '#ff9fb8').p('glow', sp(0.32, 12, 8), [0, 3.7, 0], hdr('#fff0c0', 1.7)).p('plain', new THREE.ConeGeometry(0.4, 0.32, 12), [0, 4.1, 0], '#ff9fb8');
      }
    }
    // 안 열린 구역 울타리 + '곧 분양' 판
    if (open < STREETS.length) {
      for (let x = DISTRICT.x0; x < DISTRICT.x1; x += 4) if (Math.abs(x - SPINE.x) > STREET_HW) for (const y of [0.45, 0.95]) k.at(x + 2, y, zN - 1).p('wood', bx(4, 0.1, 0.1, 0.8), [0, 0, 0], '#fff3e2');
      for (let x = DISTRICT.x0; x <= DISTRICT.x1; x += 8) if (Math.abs(x - SPINE.x) > STREET_HW) k.at(x, 0, zN - 1).p('wood', bx(0.18, 1.1, 0.18, 0.8), [0, 0.55, 0], '#fff6e6');
      for (const s of [-1, 1]) k.at(SPINE.x + s * (STREET_HW + 0.4), 0, zN - 1).p('plain', bx(0.4, 1.2, 0.4), [0, 0.6, 0], '#ffd9d6');
      k.at(SPINE.x, 0, zN - 1).p('plain', bx(STREET_HW * 2, 0.12, 0.12), [0, 0.45, 0], '#ff8fb1').p('plain', bx(STREET_HW * 2, 0.12, 0.12), [0, 0.95, 0], '#ff8fb1');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.0), nightGlow(new THREE.MeshBasicMaterial({ map: signTex('🚧 곧 분양해요', '#ffb36b', '#ffffff', 640, 140, 62), transparent: true, side: THREE.DoubleSide }), 1, 0.62, 0.5)); m.position.set(SPINE.x, 2.0, zN - 1.2); dyn.add(m);
    }
    const sgn = new THREE.BufferGeometry(), P = [], UV = [], IDX = []; let vi = 0;
    for (const pl of PLOTS) {
      if (!isOpen(pl, open)) continue;
      const own = owners[pl.id], [hx0, hz0, hx1, hz1] = pl.house, north = Math.cos(pl.door.face) > 0; // north: 큰길이 남쪽에 있는 줄
      // 앞마당 길: 대문 → 현관
      k.at(pl.gate.x, 0, (pl.gate.z + pl.door.z) / 2).p('stone', bx(1.8, 0.06, Math.abs(pl.gate.z - pl.door.z), 1), [0, 0.03, 0], '#f0dcc6');
      if (!own) { // 입주 대기 집: 번호 팻말 한 개(번호 atlas)
        const sx = pl.gate.x - 2.2, sz = pl.gate.z + (north ? -0.6 : 0.6), i = pl.id - 1, u0 = (i % 10) / 10, v0 = 1 - (Math.floor(i / 10) + 1) / 10, du = 0.1, dv = 0.1;
        k.at(sx, 0, sz).p('wood', cy(0.06, 0.06, 1.5, 6), [-0.55, 0.75, 0], WOOD).p('wood', cy(0.06, 0.06, 1.5, 6), [0.55, 0.75, 0], WOOD);
        P.push(sx - 0.7, 1.0, sz, sx + 0.7, 1.0, sz, sx + 0.7, 1.7, sz, sx - 0.7, 1.7, sz); UV.push(u0, v0, u0 + du, v0, u0 + du, v0 + dv, u0, v0 + dv); IDX.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
      }
      // 주인 있는 집: 벽 · 사방 지붕(주인이 고른 색) · 현관문 · 창 · 굴뚝 · 계단 · 우편함
      const cx = (hx0 + hx1) / 2, cz = (hz0 + hz1) / 2, W = HOUSE.w, D = HOUSE.d, roof = ROOFS[own ? own.r : ROOFS.length - 1] ?? ROOFS[0]; // 주인 없는 집은 회색 지붕
      k.at(cx, 0, cz, pl.door.face);
      k.p('stucco', bx(W, 4.2, D, 1), [0, 2.1, 0], FACE[pl.id % FACE.length]).p('stone', bx(W + 0.3, 0.4, D + 0.3, 1), [0, 0.2, 0], '#efe4d8');
      k.p('roof', new THREE.ConeGeometry((W + 1.6) / Math.SQRT2, 3.6, 4, 1), [0, 4.2 + 1.8, 0], roof, [0, PI / 4, 0], [1, 1, (D + 1.6) / (W + 1.6)]);
      k.p('plain', bx(W + 1.7, 0.22, 0.3), [0, 4.2, D / 2 + 0.7], roof).p('plain', bx(1.7, 2.5, 0.22), [0, 1.35, D / 2 + 0.05], '#a86a4a').p('plain', bx(2.5, 0.3, 1.1), [0, 0.15, D / 2 + 0.8], '#e9dccb');
      for (const sx of [-1, 1]) k.p('win', bx(1.5, 1.3, 0.14), [sx * 3.6, 2.5, D / 2 + 0.03], '#ffffff').p('plain', bx(1.7, 0.12, 0.22), [sx * 3.6, 1.8, D / 2 + 0.1], '#ffffff');
      k.p('stone', bx(1.0, 2.4, 1.0), [W / 2 - 2, 5.7, -1.2], '#e8cdb4');
      k.at(pl.gate.x + 1.4, 0, pl.gate.z).p('wood', cy(0.06, 0.06, 1.1, 6), [0, 0.55, 0], WOOD).p('plain', bx(0.45, 0.32, 0.3), [0, 1.2, 0], roof).p('plain', bx(0.1, 0.1, 0.1), [0.1, 1.38, 0], '#ff4d6d');
      for (const sx of [-1.2, 1.2]) k.at(pl.gate.x + sx, 0, pl.gate.z).p('wood', bx(0.16, 0.9, 0.16), [0, 0.45, 0], '#fff6e6');
      if (own) { const tg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), tag(own.n, 1.5)); tg.position.set(pl.gate.x - 0.9, 1.3, pl.gate.z + (north ? -0.05 : 0.05)); tg.rotation.y = north ? 0 : PI; dyn.add(tg); } // 대문 문패 (주인 글)
      if (mine === pl.id) k.at(cx, 0, cz, pl.door.face).p('plain', sp(0.28, 10, 6), [0, 8.4, 0], '#ff4d6d').p('glow', sp(0.16, 8, 6), [0, 8.4, 0], hdr('#ff9fb8', 2)); // 내 집 표시(지붕 위 빨간 공)
    }
    const g = new THREE.Group(); buildKit(k, g, false); dyn.add(g);
    if (vi) { sgn.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); sgn.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); sgn.setIndex(IDX); dyn.add(new THREE.Mesh(sgn, atlasMat)); }
  }
  rebuild();
  const cam = new THREE.Vector3();
  function update(dt, camera) {
    camera.getWorldPosition(cam); root.visible = cam.z < 40 && Math.abs(cam.x) < 700; // 마을 북쪽에서만 그림
    if (dirty && root.visible) rebuild();
  }
  return {
    update, root,
    setOwner(id, v) { if (v) owners[id] = v; else delete owners[id]; dirty = true; },
    setOwners(map) { for (const k in owners) delete owners[k]; Object.assign(owners, map); dirty = true; },
    setOpen(n) { if (n !== open) { open = n; dirty = true; } },
    setMine(id) { mine = id; dirty = true; },
  };
}
