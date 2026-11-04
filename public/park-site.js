// 포근 놀이공원 그림 (기초 공사): 땅(길·광장·대로 포장) · 웅장한 정문(쌍둥이 탑 + 3겹 아치 + 별 + 간판 + 깃발 + 전구) · 입구 광장(별 분수·꽃밭·풍선·매표소)
// · 대로(가로등·꽃·벤치·깃발 줄) · 매점·쉼터·화장실 · 동물원 입구 아치 · 길 안내판 · 기구 자리 표시(준비 중 꽃울타리) · 부지 울타리·둘레 숲 · 서쪽 대문과 벚꽃길
// 좌표는 전부 parkdata.js (world.js 가 다시 내보냄). 동물원(zoo.js)·놀이기구(rides.js, 꼬마기차 선로 포함)는 따로 그림. 성능: 재질별로 합치고 구역별 거리 숨김, 공원 가운데에서 PARK_FAR 밖이면 통째로 숨김
import * as THREE from 'three';
import { PARK, PARK_GATE, GATE_TOWERS, PROMENADE, ENTRY_PLAZA, PLAZA_FOUNTAIN, ZOO_ZONE, RIDES_ZONE, PARK_ROAD, parkRoadAt, ROAD_LAMPS, ROAD_TREES, VILLAGE_GATE_W,
  PARK_PATHS, RIDE_SLOTS, slotRect, RIDES, PARK_SHOPS, PARK_BENCHES, PARK_LAMPS, PARK_TREES, BALLOON_CARTS, PARK_SIGNS, ZOO_ARCH, PARK_FAR, PARK_CENTER } from './world.js';
import { soft, Batch, rng, noise, patch, nightGlow, NEAR_FADE, U } from './gfx.js';
import { Kit, bx, cy, sp, hdr, signTex, buildKit } from './buildings.js';
import { flowers } from './sacred.js';
import { treeGeos } from './trail.js';
import { dirtTex, cobbleTex } from './textures.js';

const PI = Math.PI, G = PARK_GATE, FW = PLAZA_FOUNTAIN;
const CREAM = '#fff4e6', PINK = '#ffc4d2', HOT = '#ff8fb1', MINT = '#8fdcc4', GOLD = '#ffd45a', LILAC = '#cdb6ff', SKY = '#9fd3ff';
const BULB = ['#ffe6a0', '#ffb3c8', '#b8f0dc', '#c9b8ff'].map((c) => hdr(c, 2.2)); // 전구 색 (밤엔 블룸)

// 별 모양 (가운데 원점, 바깥 반지름 r) — 판으로 도톰하게
function starGeo(r, depth = 0.6, inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = PI / 2 + (i * PI) / 5, rr = i % 2 ? r * inner : r; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: r * 0.08, bevelSegments: 2 }).translate(0, 0, -depth / 2);
}
// 판에 글 그린 간판 (밤엔 살짝 어둡게 — 조명 없는 판)
function board(scene, list, tex, w, h, x, y, z, ry, far = 160) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), nightGlowBasic(tex));
  m.rotation.y = ry; const lod = new THREE.LOD(); lod.position.set(x, y, z); lod.addLevel(m, 0); lod.addLevel(new THREE.Object3D(), far); list.push(lod); scene.add(lod);
  return m;
}
const nightGlowBasic = (tex) => nightGlow(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), 1, 0.62, 0.5);
// 큰 글씨 간판: 리본 모양 바탕 + 두 줄 글 (캔버스)
function titleTex(t1, t2) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 230;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 230);
  g.addColorStop(0, '#ff9fbd'); g.addColorStop(1, '#ff7aa2');
  x.fillStyle = g; x.beginPath(); x.roundRect(8, 8, 1008, 214, 60); x.fill();
  x.strokeStyle = '#fff4e6'; x.lineWidth = 10; x.beginPath(); x.roundRect(24, 24, 976, 182, 48); x.stroke();
  x.fillStyle = '#ffe680'; for (const px of [70, 954]) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + (i * PI) / 5, r = i % 2 ? 15 : 34; x.lineTo(px + Math.cos(a) * r, 115 + Math.sin(a) * r); } x.fill(); }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.font = 'bold 112px Jua, sans-serif';
  x.shadowColor = 'rgba(160,40,90,.55)'; x.shadowOffsetY = 6; x.fillText(t1, 512, t2 ? 100 : 118);
  if (t2) { x.shadowOffsetY = 3; x.font = 'bold 40px sans-serif'; x.fillStyle = '#fff4c2'; x.fillText(t2, 512, 182); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function rowsTex(rows) { // 화살표 판 여러 줄 (길 안내)
  const c = document.createElement('canvas'); c.width = 512; c.height = 118 * rows.length;
  const g = c.getContext('2d');
  rows.forEach(([t, col], i) => { g.fillStyle = col; g.beginPath(); g.roundRect(6, i * 118 + 8, 500, 102, 30); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 62px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 256, i * 118 + 62); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export function createParkSite(scene, Q) {
  const R = rng(4242), lite = Q.lite, dens = { high: 1, normal: 0.75, low: 0.45 }[Q.level];
  const root = new THREE.Group(); root.name = 'park'; scene.add(root); // 공원 부지 전체 (멀면 통째로 숨김)
  const near = new THREE.Group(); near.name = 'park-road'; scene.add(near); // 마을 대문~정문 길 (마을 쪽에서도 보임)
  const boards = [];
  const lodKit = (kit, x, z, far, parent = root) => { const g = new THREE.Group(); buildKit(kit, g, false); g.position.set(-x, 0, -z); const lod = new THREE.LOD(); lod.position.set(x, 0, z); lod.addLevel(g, 0); if (far) lod.addLevel(new THREE.Object3D(), far); lod.name = 'park-kit'; parent.add(lod); return lod; };

  /* ───── 땅: 흙길 띠 · 포장(광장·대로·길·입구 마당) ───── */
  const dirt = soft('#ffffff', { map: dirtTex(), vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  { const P = [], uv = [], col = [], idx = [], pts = PARK_ROAD.pts, n = pts.length;
    pts.forEach(([x, z], i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, s = PARK_ROAD.s[i];
      const w = PARK_ROAD.hw[i] - 0.9 + (noise(s * 0.3, 3) - 0.5) * 0.6;
      for (const [o, u] of [[-w - 0.6, 0], [-w, 0.12], [w, 0.88], [w + 0.6, 1]]) { P.push(x + nx * o, 0.03, z + nz * o); uv.push(u * (w * 2 + 1.2) / 4, s / 4); col.push(...(u === 0 || u === 1 ? [0.86, 0.95, 0.8] : [1, 0.97, 0.94])); }
      if (i) for (let k = 0; k < 3; k++) { const p = (i - 1) * 4 + k, q = i * 4 + k; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, dirt); m.receiveShadow = true; near.add(m);
  }
  // 포장: 같은 재질 하나에 전부 합침. uv = 월드 좌표 / 2.3 (돌 크기 일정), 색은 정점 색
  const pave = new Batch(), addFlat = (geo, x, y, z, color, ry = 0) => { geo.rotateX(-PI / 2); if (ry) geo.rotateY(ry); geo.translate(x, y, z); const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.3, p.getZ(i) / 2.3); pave.add('p', geo, { color }); };
  const rectFlat = (x0, z0, x1, z1, y, color) => addFlat(new THREE.PlaneGeometry(x1 - x0, z1 - z0), (x0 + x1) / 2, y, (z0 + z1) / 2, color);
  // 정문 앞마당 (길이 넓어지는 곳): 분홍 돌바닥 반원
  addFlat(new THREE.CircleGeometry(15, 40, -PI / 2, PI), G.x + 0.2, 0.04, G.z, '#ffd9d6');
  rectFlat(G.x - 1, G.z - 15, G.x + 3, G.z + 15, 0.042, '#ffe7c9');
  // 입구 광장: 분홍 돌바닥 + 분수 둘레 크림·민트 고리 + 별빛 줄무늬 8갈래
  { const E = ENTRY_PLAZA; rectFlat(E.x0, E.z0, E.x1, E.z1, 0.045, '#ffd6da'); rectFlat(E.x0 + 1.2, E.z0 + 1.2, E.x1 - 1.2, E.z1 - 1.2, 0.047, '#ffe2e2');
    addFlat(new THREE.RingGeometry(FW.r + 2.2, FW.r + 3.4, 48), FW.x, 0.05, FW.z, '#fff1d8'); addFlat(new THREE.RingGeometry(FW.r + 6.5, FW.r + 7.3, 64), FW.x, 0.05, FW.z, '#bfeede');
    for (let i = 0; i < 8; i++) { // 분수에서 뻗는 별빛 줄무늬 (세모 판, 북쪽(-z)을 향하게 만들어 돌림)
      const a = (i / 8) * PI * 2 + PI / 8, r0 = FW.r + 3.6, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.9, r0, 0, 0.9, r0, 0, 0, r0 + 13, 0], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
      addFlat(g, FW.x, 0.052, FW.z, i % 2 ? '#fff6c8' : '#ffe0ec', a);
    }
  }
  // 중앙 대로: 크림빛 돌바닥 + 양옆 분홍 띠 + 가운데 마름모 무늬
  { const P = PROMENADE; rectFlat(P.x0, P.z - P.hw, P.x1, P.z + P.hw, 0.04, '#ffeedd');
    for (const s of [-1, 1]) rectFlat(P.x0, P.z + s * (P.hw - 0.4) - 0.4, P.x1, P.z + s * (P.hw - 0.4) + 0.4, 0.043, '#ffc9cf');
    for (let x = P.x1 - 10; x > P.x0 + 20; x -= 14) addFlat(new THREE.PlaneGeometry(3, 3), x, 0.044, P.z, Math.round(x / 14) & 1 ? '#c6efe2' : '#ffe6a6', PI / 4);
    addFlat(new THREE.CircleGeometry(16, 48), P.x0 + 4, 0.046, P.z, '#ffe4e8'); addFlat(new THREE.RingGeometry(15.2, 16, 48), P.x0 + 4, 0.048, P.z, '#ffc9cf'); // 대관람차 앞 둥근 승강장 마당
  }
  // 공원 길 (기구·동물원): 베이지 돌바닥 + 기구 입구 앞 마당
  for (const p of PARK_PATHS) { if (p.kind === 'promenade') continue; const [ax, az] = p.a, [bx_, bz] = p.b, L = Math.hypot(bx_ - ax, bz - az); addFlat(new THREE.PlaneGeometry(p.hw * 2, L), (ax + bx_) / 2, 0.038, (az + bz) / 2, p.kind === 'zoo' ? '#f1e6cf' : '#f7e3d2', Math.atan2(bx_ - ax, bz - az)); }
  for (const s of Object.values(RIDE_SLOTS)) { if (s.id === 'ferris' || s.id === 'train') continue; const [ex, ez] = s.entry, up = ez < s.z; rectFlat(ex - 5, up ? ez - 4.2 : ez, ex + 5, up ? ez : ez + 4.2, 0.039, '#f7e3d2'); } // 길 → 기구 입구 (4m)
  const paveMat = soft('#ffffff', { map: cobbleTex(), vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3 });
  for (const m of Object.values(pave.build(root, { p: paveMat }, { cast: false }))) m.name = 'park-pave';

  /* ───── 웅장한 정문 ───── */
  const kG = new Kit();
  const tower = (zt, side) => { // side: 바깥(울타리) 쪽 부호
    kG.at(G.x, 0, zt);
    kG.p('stone', cy(4.45, 4.7, 2.4, 24), [0, 1.2, 0], '#f3e3d3').p('plain', cy(4.6, 4.6, 0.3, 24), [0, 2.5, 0], CREAM);
    kG.p('plain', cy(3.9, 4.15, 15, 24), [0, 2.4 + 7.5, 0], PINK);
    for (const y of [6.2, 10.8, 15.4]) kG.p('plain', new THREE.TorusGeometry(4.02 - (y - 6) * 0.017, 0.2, 6, 32), [0, y, 0], CREAM, [PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + PI / 6, ox = Math.cos(a) * 3.98, oz = Math.sin(a) * 3.98; for (const y of [8.4, 13]) { kG.p('win', bx(0.95, 1.7, 0.12), [ox, y, oz], '#ffffff', [0, -a + PI / 2, 0]); kG.p('plain', new THREE.CircleGeometry(0.62, 12, 0, PI), [ox * 1.012, y + 0.82, oz * 1.012], CREAM, [0, PI / 2 - a, 0]); } }
    kG.p('plain', cy(4.75, 4.4, 0.7, 28), [0, 17.75, 0], CREAM); // 발코니
    for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2; kG.p('plain', bx(0.7, 0.8, 0.5), [Math.cos(a) * 4.5, 18.5, Math.sin(a) * 4.5], i % 2 ? CREAM : PINK, [0, -a, 0]); }
    kG.p('plain', cy(3.1, 3.3, 5, 20), [0, 20.6, 0], CREAM);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; kG.p('glow', new THREE.CircleGeometry(0.75, 16), [Math.cos(a) * 3.2, 21, Math.sin(a) * 3.2], hdr('#ffd38a', 1.5), [0, PI / 2 - a, 0]); }
    kG.p('plain', new THREE.TorusGeometry(3.6, 0.32, 6, 28), [0, 23.2, 0], HOT, [PI / 2, 0, 0]);
    kG.p('roof', new THREE.ConeGeometry(4.5, 10.5, 20, 1), [0, 28.3, 0], MINT);
    kG.p('shine', sp(0.5, 12, 8), [0, 33.8, 0], GOLD).p('plain', cy(0.07, 0.07, 3.4, 6), [0, 35.4, 0], '#8a7a8a');
    kG.p('shine', starGeo(1.1, 0.35), [0, 36.9, 0], GOLD, [0, PI / 2, 0]);
    kG.p('plain', new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(2.6, -0.55), new THREE.Vector2(0, -1.1)])), [0.05, 36.0, 0], side < 0 ? HOT : '#7fc8ff', [0, side * PI / 2, 0]); // 깃발
    kG.p('plain', new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(2.6, -0.55), new THREE.Vector2(0, -1.1)])), [-0.05, 36.0, 0], side < 0 ? HOT : '#7fc8ff', [0, side * PI / 2 + PI, 0]);
    // 바깥쪽 낮은 성벽 (꽃 상자 + 요철) → 울타리로 이어짐
    kG.at(G.x, 0, zt + side * 9.6).p('plain', bx(2.6, 3.2, 10.4), [0, 1.6, 0], CREAM).p('plain', bx(3, 0.3, 10.8), [0, 3.35, 0], PINK);
    for (let i = 0; i < 5; i++) kG.p('plain', bx(2.8, 0.7, 1.1), [0, 3.85, -4.4 + i * 2.2], i % 2 ? PINK : CREAM);
    flowers(kG, 1.4, -4.8, 2.6, 4.8, 0.35, 34, 7 + side);
  };
  GATE_TOWERS.forEach((t) => tower(t.z, Math.sign(t.z - G.z)));
  // 3겹 아치 (크림 → 분홍 → 민트), 안쪽 따뜻한 불빛 띠 + 바깥 전구 줄
  const SPR = 12.2; kG.at(G.x, SPR, G.z, PI / 2);
  kG.p('plain', new THREE.TorusGeometry(15.6, 1.55, 10, 40, PI), [0, 0, 0], CREAM);
  kG.p('plain', new THREE.TorusGeometry(13.55, 0.85, 8, 40, PI), [0, 0, 0.9], HOT).p('plain', new THREE.TorusGeometry(13.55, 0.85, 8, 40, PI), [0, 0, -0.9], HOT);
  kG.p('plain', new THREE.TorusGeometry(12.15, 0.62, 8, 40, PI), [0, 0, 0], MINT);
  kG.p('glow', new THREE.TorusGeometry(11.45, 0.2, 6, 40, PI), [0, 0, 0], hdr('#ffcf7a', 1.9));
  for (let i = 0; i <= 26; i++) { const a = (i / 26) * PI, r = 17.25; for (const f of [-1, 1]) kG.p('glow', sp(0.3, 8, 6), [Math.cos(a) * r, Math.sin(a) * r, f * 0.9], BULB[i % 4]); }
  // 아치 꼭대기: 큰 노란 별 + 작은 별 둘
  kG.at(G.x, SPR + 15.6 + 4.2, G.z, PI / 2).p('plain', starGeo(3.4, 0.9), [0, 0, 0], '#ffe066').p('glow', starGeo(2.1, 0.2), [0, 0, 0.62], hdr('#fff3b0', 1.5)).p('glow', starGeo(2.1, 0.2), [0, 0, -0.62], hdr('#fff3b0', 1.5));
  for (const s of [-1, 1]) kG.at(G.x, SPR + 11.5, G.z + s * 11.5, PI / 2).p('plain', starGeo(1.3, 0.5), [0, 0, 0], s < 0 ? '#ffb3c8' : '#b8f0dc');
  // 간판: 분홍 리본 판 (양면) + 매단 사슬
  kG.at(G.x, 0, G.z).p('plain', bx(0.5, 4.6, 18.6), [0, SPR + 6.2, 0], '#ffffff').p('plain', bx(0.62, 0.3, 18.9), [0, SPR + 8.6, 0], GOLD).p('plain', bx(0.62, 0.3, 18.9), [0, SPR + 3.8, 0], GOLD);
  for (const s of [-1, 1]) kG.p('plain', cy(0.06, 0.06, 6.5, 5), [0, SPR + 11.5, s * 6], '#8a7a8a');
  const tt = titleTex('포근 놀이공원', '🎡 POGEUN PARK ✦ 어서 오세요'); for (const s of [-1, 1]) board(root, boards, tt, 18, 4.05, G.x + s * 0.27, SPR + 6.2, G.z, s * PI / 2, 400);
  // 깃발 줄: 탑 발코니 → 아치 꼭대기
  const pennants = (a, b, n, sag) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = a.clone().lerp(b, t); p.y -= Math.sin(t * PI) * sag; kG.at(p.x, p.y, p.z, PI / 2).p('plain', new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.45, 0), new THREE.Vector2(0.45, 0), new THREE.Vector2(0, -1.1)])), [0, 0, 0], [HOT, '#ffe066', MINT, '#7fc8ff', LILAC][i % 5]); } };
  for (const t of GATE_TOWERS) { const s = Math.sign(t.z - G.z); pennants(new THREE.Vector3(G.x, 18.6, t.z - s * 4.5), new THREE.Vector3(G.x, SPR + 16.6, G.z), 9, 1.4); }
  // 정문 앞 꽃화분 줄 (길 양옆)
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = G.x + 3.5 + i * 4.2, z = G.z + s * 12.8; kG.at(x, 0, z).p('stone', cy(0.9, 0.7, 0.8, 12), [0, 0.4, 0], '#ffe0e6'); flowers(kG, -0.7, -0.7, 0.7, 0.7, 0.75, 14, i * 3 + (s > 0 ? 11 : 1)); }
  lodKit(kG, G.x, G.z, 0);

  /* ───── 부지 울타리 (정문·성벽 자리는 비움) + 기둥 ───── */
  const kF = new Kit(), gz0 = G.z - 35, gz1 = G.z + 35, fence = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0); for (const y of [0.45, 0.95]) kF.at((x0 + x1) / 2, y, (z0 + z1) / 2, a).p('wood', bx(0.08, 0.13, L, 1.5), [0, 0, 0], '#fff3e2'); for (let s = 0; s <= L; s += 3) { const t = s / L; kF.at(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t).p('wood', bx(0.2, 1.25, 0.2, 0.6), [0, 0.62, 0], '#fff6e6').p('plain', sp(0.15, 8, 4), [0, 1.27, 0], s % 12 < 3 ? PINK : '#fff6e6'); } };
  fence(PARK.x0, PARK.z0, PARK.x1, PARK.z0); fence(PARK.x0, PARK.z1, PARK.x1, PARK.z1); fence(PARK.x0, PARK.z0, PARK.x0, PARK.z1);
  fence(PARK.x1, PARK.z0, PARK.x1, gz0); fence(PARK.x1, gz1, PARK.x1, PARK.z1);
  for (const s of [-1, 1]) { const z = s < 0 ? gz0 : gz1; kF.at(PARK.x1, 0, z).p('stucco', bx(1.2, 2.4, 1.2, 1), [0, 1.2, 0], CREAM).p('plain', sp(0.55, 10, 6), [0, 2.75, 0], PINK); }
  for (const [x, z] of [[PARK.x0, PARK.z0], [PARK.x0, PARK.z1], [PARK.x1, PARK.z0], [PARK.x1, PARK.z1]]) kF.at(x, 0, z).p('stucco', bx(1.4, 2.8, 1.4, 1), [0, 1.4, 0], CREAM).p('roof', new THREE.ConeGeometry(1.1, 1.6, 4), [0, 3.6, 0], MINT, [0, PI / 4, 0]);
  lodKit(kF, PARK_CENTER.x, PARK_CENTER.z, 0);

  /* ───── 소품 묶음: 가로등 · 벤치 · 꽃 상자 · 매점 · 풍선 · 분수 · 표지판 (구역마다 따로 묶어 거리 숨김) ───── */
  const lamp = (k, x, z, c = '#7cc9b5') => {
    k.at(x, 0, z).p('plain', cy(0.22, 0.3, 0.35, 10), [0, 0.18, 0], c).p('plain', cy(0.07, 0.09, 3.3, 8), [0, 1.9, 0], c).p('plain', new THREE.TorusGeometry(0.12, 0.04, 6, 12), [0, 1.2, 0], CREAM, [PI / 2, 0, 0]);
    k.p('plain', cy(0.3, 0.18, 0.12, 12), [0, 3.55, 0], c).p('glow', sp(0.34, 12, 8), [0, 3.92, 0], hdr('#fff0c0', 1.7)).p('plain', new THREE.ConeGeometry(0.42, 0.34, 12), [0, 4.36, 0], c).p('shine', sp(0.08, 6, 4), [0, 4.58, 0], GOLD);
  };
  const bench = (k, b) => {
    k.at(b.x, 0, b.z, b.ry);
    for (const z of [-0.2, 0, 0.2]) k.p('wood', bx(1.9, 0.07, 0.17, 0.8), [0, 0.52, z], '#f0b98a');
    for (const y of [0.8, 0.98]) k.p('wood', bx(1.9, 0.14, 0.06, 0.8), [0, y, -0.31], '#f0b98a', [-0.12, 0, 0]);
    for (const sx of [-0.84, 0.84]) k.p('plain', bx(0.08, 0.5, 0.5), [sx, 0.25, 0], '#ff9fb8').p('plain', bx(0.08, 0.62, 0.08), [sx, 0.78, -0.3], '#ff9fb8');
  };
  const planter = (k, x, z, w, d, seed) => { k.at(x, 0, z).p('stone', bx(w, 0.5, d, 1), [0, 0.25, 0], '#ffe9de').p('plain', bx(w + 0.12, 0.08, d + 0.12), [0, 0.52, 0], CREAM); flowers(k, -w / 2 + 0.25, -d / 2 + 0.25, w / 2 - 0.25, d / 2 - 0.25, 0.42, Math.round(w * d * 4.5 * dens + 6), seed); };
  const shop = (k, b) => {
    const C = { ticket: ['#ffd2dc', MINT], snack: ['#fff0c4', HOT], rest: [CREAM, '#9fd3c0'], toilet: ['#d8ecff', '#7fb3e8'] }[b.k];
    k.at(b.x, 0, b.z);
    if (b.k === 'rest') { // 쉼터: 기둥 4개 + 팔각 지붕 + 둥근 마루
      k.p('wood', cy(b.w / 2, b.w / 2 + 0.2, 0.35, 8), [0, 0.17, 0], '#e8c39a');
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; k.p('plain', cy(0.16, 0.18, 2.8, 8), [Math.cos(a) * (b.w / 2 - 0.5), 1.75, Math.sin(a) * (b.w / 2 - 0.5)], CREAM); }
      k.p('roof', new THREE.ConeGeometry(b.w / 2 + 1, 2.6, 6), [0, 4.4, 0], C[1]).p('shine', sp(0.25, 8, 6), [0, 5.8, 0], GOLD);
      return;
    }
    const h = b.k === 'ticket' ? 3 : 2.8;
    k.p('stucco', bx(b.w, h, b.d, 1.6), [0, h / 2, 0], C[0]).p('plain', bx(b.w + 0.3, 0.3, b.d + 0.3), [0, h + 0.15, 0], CREAM);
    k.p('roof', new THREE.ConeGeometry(Math.hypot(b.w, b.d) / 2 + 0.6, b.k === 'ticket' ? 3 : 1.8, 4), [0, h + (b.k === 'ticket' ? 1.8 : 1.2), 0], C[1], [0, PI / 4, 0]);
    if (b.k === 'ticket') k.p('shine', starGeo(0.7, 0.25), [0, h + 3.8, 0], GOLD);
    for (const s of [-1, 1]) { k.p('win', bx(b.w * 0.55, 1.1, 0.1), [0, 1.7, s * (b.d / 2 + 0.03)], '#ffffff'); k.p('plain', bx(b.w * 0.75, 0.12, 0.9), [0, 2.35, s * (b.d / 2 + 0.4)], C[1], [s * 0.35, 0, 0]); } // 창 + 차양
    for (let i = 0; i < 5; i++) k.p('plain', bx(b.w / 5, 0.5, 0.1), [-b.w / 2 + b.w / 10 + (i * b.w) / 5, 2.15, b.d / 2 + 0.75], i % 2 ? '#ffffff' : C[1], [0.5, 0, 0]);
    const icon = { ticket: '🎟️ 매표소', snack: '🍦 매점', toilet: '🚻 화장실' }[b.k];
    if (icon) for (const s of [-1, 1]) board(root, boards, signTex(icon, C[1], '#ffffff', 512, 150, 70), Math.min(b.w - 0.6, 4.2), 1.2, b.x, h + 0.62, b.z + s * (b.d / 2 + 0.2), s > 0 ? 0 : PI, 140);
  };
  // 광장: 별 분수 · 둥근 벤치 · 가로등 · 꽃밭 · 풍선 수레 · 매표소
  const kP = new Kit();
  kP.at(FW.x, 0, FW.z).p('stone', cy(FW.r, FW.r + 0.2, 0.7, 40), [0, 0.35, 0], '#f6e3e8').p('plain', new THREE.TorusGeometry(FW.r, 0.22, 6, 40), [0, 0.72, 0], CREAM, [PI / 2, 0, 0]);
  kP.p('stone', cy(2.2, 2.6, 1.1, 24), [0, 0.95, 0], '#ffe3ea').p('stone', cy(0.7, 1, 2.6, 16), [0, 2.6, 0], CREAM).p('plain', cy(1.9, 1.2, 0.4, 24), [0, 3.9, 0], PINK);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; kP.p('glow', sp(0.22, 8, 6), [Math.cos(a) * (FW.r - 0.15), 0.78, Math.sin(a) * (FW.r - 0.15)], BULB[i % 4]); }
  for (const b of PARK_BENCHES.slice(0, 6)) bench(kP, b);
  for (const l of PARK_LAMPS.slice(0, 4)) lamp(kP, l.x, l.z);
  { const E = ENTRY_PLAZA; for (const [x, z, w, d] of [[E.x1 - 6, E.z0 + 3, 7, 2.4], [E.x1 - 6, E.z1 - 3, 7, 2.4], [E.x0 + 8, E.z0 + 3, 6, 2.4], [E.x0 + 8, E.z1 - 3, 6, 2.4], [FW.x + 12.5, FW.z - 9, 2.4, 6], [FW.x + 12.5, FW.z + 9, 2.4, 6]]) planter(kP, x, z, w, d, x * 3 + z); }
  for (const c of BALLOON_CARTS) { // 풍선 수레 + 풍선 다발
    kP.at(c.x, 0, c.z).p('plain', bx(1.4, 0.7, 0.9), [0, 0.75, 0], '#ffe680').p('plain', cy(0.28, 0.28, 0.12, 12), [-0.5, 0.3, 0.5], '#8a7a8a', [PI / 2, 0, 0]).p('plain', cy(0.28, 0.28, 0.12, 12), [0.5, 0.3, 0.5], '#8a7a8a', [PI / 2, 0, 0]).p('plain', cy(0.28, 0.28, 0.12, 12), [-0.5, 0.3, -0.5], '#8a7a8a', [PI / 2, 0, 0]).p('plain', cy(0.28, 0.28, 0.12, 12), [0.5, 0.3, -0.5], '#8a7a8a', [PI / 2, 0, 0]);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.3 + (i % 3) * 0.35, y = 3.1 + (i % 4) * 0.45, x = Math.cos(a) * r, z = Math.sin(a) * r; kP.p('plain', cy(0.01, 0.01, y - 1.1, 3), [x / 2, (y + 1.1) / 2, z / 2], '#ffffff', [z * 0.25, 0, -x * 0.25]); kP.p('plain', sp(0.36, 10, 8), [x, y, z], [HOT, '#ffe066', MINT, '#7fc8ff', LILAC, '#ffa94d'][i % 6], [0, 0, 0], [1, 1.18, 1]); }
  }
  for (const b of PARK_SHOPS.slice(0, 2)) shop(kP, b);
  lodKit(kP, FW.x, FW.z, 260);
  // 분수 물 + 천천히 도는 별 (따로 움직임)
  const water = new THREE.Mesh(new THREE.CircleGeometry(FW.r - 0.2, 40).rotateX(-PI / 2), nightGlow(new THREE.MeshBasicMaterial({ color: '#9fdcf5', transparent: true, opacity: 0.85 }), 1, 0.45, 0.4)); water.position.set(FW.x, 0.73, FW.z); root.add(water);
  const jetGeo = new Batch().add('j', new THREE.CylinderGeometry(0.12, 0.45, 2.2, 10, 1, true), { pos: [0, 1.1, 0] }); // 가운데 물기둥 + 가장자리에서 안으로 휘는 물줄기 8개
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; jetGeo.add('j', new THREE.TorusGeometry(1.7, 0.07, 4, 14, PI), { pos: [Math.cos(a) * (FW.r - 2.0), -3.3, Math.sin(a) * (FW.r - 2.0)], rot: [0, -a, 0] }); }
  const jets = new THREE.Mesh(jetGeo.geometry('j'), nightGlow(new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }), 1, 0.6, 0.4)); jets.position.set(FW.x, 4.0, FW.z); root.add(jets);
  const star = new THREE.Group(); star.position.set(FW.x, 6.4, FW.z); root.add(star);
  { const sk = new Kit(); sk.at(0, 0, 0).p('plain', starGeo(1.9, 0.7), [0, 0, 0], '#ffe066').p('glow', starGeo(1.1, 0.12), [0, 0, 0.5], hdr('#fff3b0', 1.6)).p('glow', starGeo(1.1, 0.12), [0, 0, -0.5], hdr('#fff3b0', 1.6)); buildKit(sk, star, false); }

  // 대로: 가로등 · 벤치 · 꽃 상자 · 깃발 줄 · 대관람차 앞 승강장 둘레 꽃
  const kM = new Kit(), P = PROMENADE;
  for (const l of PARK_LAMPS.slice(4)) lamp(kM, l.x, l.z, l.z > 0 ? '#ff9fb8' : '#7cc9b5');
  for (const b of PARK_BENCHES.slice(6)) bench(kM, b);
  for (let x = P.x1 - 18; x > P.x0 + 30; x -= 26) for (const s of [-1, 1]) { const z = P.z + s * (P.hw + 1.2); if (PARK_BENCHES.some((b) => Math.hypot(b.x - x, b.z - z) < 3) || PARK_LAMPS.some((l) => Math.hypot(l.x - x, l.z - z) < 2.5) || Math.abs(x - (-366)) < 7 || Math.abs(x - ZOO_ARCH.x) < 8) continue; planter(kM, x, z, 3.2, 1.1, x + s); }
  for (let x = P.x1 - 30; x > P.x0 + 20; x -= 40) { // 대로를 가로지르는 깃발 줄 (높이 6m)
    for (const s of [-1, 1]) kM.at(x, 0, P.z + s * (P.hw + 0.5)).p('plain', cy(0.09, 0.11, 6.4, 8), [0, 3.2, 0], CREAM).p('shine', sp(0.16, 8, 6), [0, 6.45, 0], GOLD);
    for (let i = 0; i < 12; i++) { const t = (i + 0.5) / 12, z = P.z - (P.hw + 0.5) + t * 2 * (P.hw + 0.5), y = 6.1 - Math.sin(t * PI) * 1.1; kM.at(x, y, z).p('plain', new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.4, 0), new THREE.Vector2(0.4, 0), new THREE.Vector2(0, -0.9)])), [0, 0, 0], [HOT, '#ffe066', MINT, '#7fc8ff', LILAC][(i + Math.round(-x / 40)) % 5], [0, PI / 2, 0]).p('glow', sp(0.12, 6, 4), [0, 0.05, 0], BULB[i % 4]); }
  }
  for (const b of PARK_SHOPS.slice(2, 7)) shop(kM, b);
  lodKit(kM, (P.x0 + P.x1) / 2, P.z, 300);

  // 동물원 입구 아치 · 길 안내판 · 구석 쉼터 (동물원 그림은 zoo.js)
  const kZ = new Kit();
  for (const s of [-1, 1]) kZ.at(ZOO_ARCH.x + s * ZOO_ARCH.hw, 0, ZOO_ARCH.z).p('wood', cy(0.42, 0.55, 5.6, 10), [0, 2.8, 0], '#b07a52').p('plain', sp(0.9, 10, 8), [0, 6, 0], '#7fcf72');
  kZ.at(ZOO_ARCH.x, 5.2, ZOO_ARCH.z).p('wood', bx(ZOO_ARCH.hw * 2 + 2.4, 0.5, 0.6, 1), [0, 0, 0], '#9a6a44').p('wood', bx(ZOO_ARCH.hw * 2 + 1.4, 0.35, 0.5, 1), [0, -0.9, 0], '#9a6a44');
  for (let i = 0; i < 9; i++) kZ.p('plain', sp(0.55 + (i % 3) * 0.15, 8, 6), [-ZOO_ARCH.hw - 0.6 + i * (ZOO_ARCH.hw * 2 + 1.2) / 8, 0.55, (i % 2 - 0.5) * 0.4], ['#7fcf72', '#95d66d', '#6ec58d'][i % 3]);
  for (const s of [-1, 1]) board(root, boards, signTex('🦒 포근 동물원', '#6aa86b', '#ffffff', 640, 160, 74), 6.4, 1.6, ZOO_ARCH.x, 4.3, ZOO_ARCH.z + s * 0.36, s > 0 ? 0 : PI, 200);
  for (const b of PARK_SHOPS.slice(7)) shop(kZ, b);
  lodKit(kZ, ZOO_ARCH.x, ZOO_ARCH.z, 300);
  for (const sg of PARK_SIGNS) { // 기둥 + 화살표 판
    const k = sg.x > PARK.x1 ? near : root, kit = new Kit();
    kit.at(sg.x, 0, sg.z).p('wood', bx(0.16, 2.4 + sg.rows.length * 0.25, 0.16, 0.6), [0, 1.2 + sg.rows.length * 0.12, 0], '#b07a52').p('plain', sp(0.14, 8, 6), [0, 2.5 + sg.rows.length * 0.25, 0], PINK);
    const g = new THREE.Group(); buildKit(kit, g, false); k.add(g);
    board(k, boards, rowsTex(sg.rows), 1.9, 0.44 * sg.rows.length, sg.x + Math.sin(sg.ry) * 0.1, 2.3 - (sg.rows.length - 1) * 0.1, sg.z + Math.cos(sg.ry) * 0.1, sg.ry, 120);
  }

  // 기구 자리 표시: 아직 안 지은 자리(RIDES 에 없는 id)는 빈 땅 + 낮은 꽃울타리(입구 쪽 8m 열림) + '준비 중' 안내판 + 귀여운 고깔
  const kS = new Kit();
  for (const s of Object.values(RIDE_SLOTS)) {
    if (s.id === 'train' || RIDES[s.id]) continue;
    const [x0, z0, x1, z1] = slotRect(s), [ex, ez] = s.entry, m = 0.6;
    const edge = (ax, az, bx_, bz) => { // 입구가 이 변 위에 있으면 가운데 8m 를 비움
      const L = Math.hypot(bx_ - ax, bz - az), dx = (bx_ - ax) / L, dz = (bz - az) / L, t = (ex - ax) * dx + (ez - az) * dz, off = Math.abs((ex - ax) * dz - (ez - az) * dx);
      const spans = off < 1.5 && t > 0 && t < L ? [[0, t - 4], [t + 4, L]] : [[0, L]];
      for (const [a, b] of spans) { const l = b - a; if (l < 0.5) continue; kS.at(ax + dx * (a + l / 2), 0, az + dz * (a + l / 2), Math.atan2(dx, dz)).p('plain', bx(0.55, 0.5, l), [0, 0.25, 0], '#7fcf72'); for (let u = 0.4; u < l; u += 1.3) kS.p('plain', new THREE.IcosahedronGeometry(0.13, 0), [0, 0.55, -l / 2 + u], ['#ff8fb1', '#ffffff', '#ffd84a', '#c9a8ff'][(u * 3 | 0) % 4]); }
    };
    if (s.id !== 'ferris') { edge(x0 + m, z0 + m, x1 - m, z0 + m); edge(x0 + m, z1 - m, x1 - m, z1 - m); edge(x0 + m, z0 + m, x0 + m, z1 - m); edge(x1 - m, z0 + m, x1 - m, z1 - m); }
    const up = ez < s.z, sx = ex, sz = s.id === 'ferris' ? ez : ez + (up ? 1.6 : -1.6), sry = s.id === 'ferris' ? PI / 2 : up ? PI : 0;
    kS.at(sx, 0, sz, sry); for (const o of [-1.25, 1.25]) kS.p('wood', bx(0.14, 2.2, 0.14), [o, 1.1, 0], '#9a6a44');
    for (const o of [-4.6, 4.6]) kS.at(sx + (s.id === 'ferris' ? 0 : o), 0, sz + (s.id === 'ferris' ? o : 0)).p('plain', new THREE.ConeGeometry(0.32, 0.8, 10), [0, 0.4, 0], '#ffa94d').p('plain', cy(0.25, 0.27, 0.1, 10), [0, 0.45, 0], '#ffffff');
    board(root, boards, rowsTex([[`🚧 ${s.name}`, '#e0a33a'], ['준비 중이에요', '#b08ad8']]), 2.6, 1.2, sx, 1.85, sz, sry, 150);
  }
  lodKit(kS, (RIDES_ZONE.x0 + RIDES_ZONE.x1) / 2, (RIDES_ZONE.z0 + RIDES_ZONE.z1) / 2, 260);

  /* ───── 숲: 부지 둘레 띠(울타리 밖 6~16m) + 길가 벚나무, 64m 칸마다 가까우면 자세히 ───── */
  const geos = treeGeos(lite), trees = [];
  for (const [ax, az, bx_, bz, nx, nz] of [[PARK.x0, PARK.z0, PARK.x1, PARK.z0, 0, -1], [PARK.x0, PARK.z1, PARK.x1, PARK.z1, 0, 1], [PARK.x0, PARK.z0, PARK.x0, PARK.z1, -1, 0], [PARK.x1, PARK.z0, PARK.x1, PARK.z1, 1, 0]]) {
    const L = Math.hypot(bx_ - ax, bz - az);
    for (let s = -8; s < L + 8; s += 5.2 / Math.sqrt(dens)) for (let o = 5 + R() * 2; o < (lite ? 12 : 17); o += 4.4 / Math.sqrt(dens)) {
      const t = s / L, x = ax + (bx_ - ax) * t + nx * o + (R() - 0.5) * 2, z = az + (bz - az) * t + nz * o + (R() - 0.5) * 2;
      if (nx > 0 && Math.abs(z - G.z) < 40) continue; // 정문 앞은 열어 둠 (길·앞마당)
      const v = R(); trees.push({ x, z, ty: v < 0.35 ? 'round' : v < 0.6 ? 'pine' : v < 0.8 ? 'poplar' : 'cherry', s: 0.95 + R() * 0.6, ry: R() * 6.28, c: Math.floor(R() * 3) });
    }
  }
  for (const t of PARK_TREES) trees.push({ ...t, ry: R() * 6.28, c: Math.floor(R() * 3) }); // 정문 양옆 귀퉁이 숲
  for (const t of ROAD_TREES) trees.push({ ...t, ty: 'cherry', ry: R() * 6.28, c: Math.floor(R() * 3), road: 1 });
  const leafMat = patch(soft('#ffffff', { vertexColors: true }), { key: 'forest', frag: NEAR_FADE }), farMat = soft('#ffffff', { vertexColors: true }), cells = new Map(), C = 64;
  for (const t of trees) { const k = Math.floor(t.x / C) + ',' + Math.floor(t.z / C); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(t); }
  for (const list of cells.values()) {
    const cx = list.reduce((a, o) => a + o.x, 0) / list.length, cz = list.reduce((a, o) => a + o.z, 0) / list.length, lod = new THREE.LOD();
    lod.position.set(cx, 0, cz); lod.name = 'park-forest';
    const mesh = (geo, mat, cast) => { const b = new Batch(); for (const o of list) b.add('t', geo(o), { pos: [o.x - cx, -0.05, o.z - cz], rot: [0, o.ry, 0], s: o.s }); const m = new THREE.Mesh(b.geometry('t'), mat); m.castShadow = cast; m.receiveShadow = true; return m; };
    lod.addLevel(mesh((o) => geos.near[o.ty][o.c], leafMat, true), 0); lod.addLevel(mesh((o) => geos.far[o.ty][o.c], farMat, false), lite ? 60 : 90); lod.addLevel(new THREE.Object3D(), lite ? 220 : 300);
    (list.some((t) => t.road) ? near : root).add(lod);
  }

  /* ───── 마을 서쪽 대문 · 벚꽃길 가로등 ───── */
  const kR = new Kit(), V = VILLAGE_GATE_W;
  for (const s of [-1, 1]) kR.at(V.x - 0.3, 0, V.z + s * (V.hw + 0.4)).p('stone', bx(0.9, 0.5, 0.9, 0.8), [0, 0.25, 0], '#efe4d8').p('stucco', bx(0.6, 4.6, 0.6, 1), [0, 2.7, 0], CREAM).p('plain', sp(0.38, 10, 6), [0, 5.2, 0], PINK);
  kR.at(V.x - 0.3, 4.75, V.z).p('plain', bx(0.4, 0.35, V.hw * 2 + 1.6), [0, 0, 0], HOT).p('plain', new THREE.TorusGeometry(V.hw + 0.4, 0.16, 6, 24, PI), [0, 0.05, 0], CREAM, [0, PI / 2, 0]);
  for (let i = 0; i < 9; i++) { const a = (i / 8) * PI; kR.p('glow', sp(0.16, 8, 6), [0, 0.05 + Math.sin(a) * (V.hw + 0.4), Math.cos(a) * (V.hw + 0.4)], BULB[i % 4]); }
  for (const s of [-1, 1]) board(near, boards, signTex(s > 0 ? '🎡 포근 놀이공원' : '🏡 포근마을', '#ff7aa2', '#ffffff', 640, 150, 66), 3.6, 0.85, V.x - 0.3 + s * 0.22, 4.1, V.z, s > 0 ? PI / 2 : -PI / 2, 150);
  for (const l of ROAD_LAMPS) lamp(kR, l.x, l.z, '#ff9fb8');
  { const mid = parkRoadAt(PARK_ROAD.len / 2); lodKit(kR, mid[0], mid[1], 300, near); }

  // 매 프레임: 멀면 통째로 숨김, 분수 별은 천천히 돌고 물줄기는 출렁
  const cam = new THREE.Vector3();
  function update(dt, camera) {
    camera.getWorldPosition(cam);
    const d = Math.hypot(cam.x - PARK_CENTER.x, cam.z - PARK_CENTER.z);
    root.visible = d < PARK_FAR; near.visible = cam.x < -40 || d < PARK_FAR; // 길은 마을 서쪽 절반에서만
    if (!root.visible) return;
    const t = U.time.value; star.rotation.y = t * 0.6; star.position.y = 6.4 + Math.sin(t * 1.3) * 0.15;
    jets.scale.y = 1 + Math.sin(t * 2.3) * 0.06;
  }
  return { update, root };
}
