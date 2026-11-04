// 카지노 3층(겉·속): 금·보라 파사드, 순서대로 켜지는 마퀴 전구, 네온 간판, 층별 카펫·샹들리에·게임 테이블. 층마다 재질별로 합침
import * as THREE from 'three';
import { BUILDINGS, FLOOR_H, RUNS, SHAFT, SLOTS, CASHIER, POKER, POKER_CHAIRS, BJ, BJ_CHAIRS, runRect, doorPos } from './world.js';
import { patch, nightGlow } from './gfx.js';
import * as TX from './textures.js';
import { Kit, hdr, bx, cy, sp, plane, lathe, mats, face, bands, windowPair, shellWalls, buildKit, artMat, signTex, leaf } from './buildings.js';

const GOLD = '#e8b84a', H = FLOOR_H;
const FL = [ // 층별 분위기: 1층 레드 / 2층 그린 / 3층 블루
  { carpet: ['#7a1f3d', '#d9a441', '#b8324f'], wall: '#c4566c', velvet: '#9e2343', neon: '#ff5a7a', sign: '🎰 SLOTS' },
  { carpet: ['#14513a', '#d9a441', '#1f7a52'], wall: '#4f9a74', velvet: '#1d6b4a', neon: '#5ae0a0', sign: "🃏 HOLD'EM" },
  { carpet: ['#1d2d63', '#d9a441', '#3346a0'], wall: '#5a6fc0', velvet: '#25368a', neon: '#6aa0ff', sign: '♠️ BLACKJACK' },
];
// 이웃 칸 구멍 빼고 바닥판 칸 나누기 (계단·엘리베이터 자리)
function cells(outer, holes) {
  const pts = (i) => [...new Set([outer[i], outer[i + 2], ...holes.flatMap((h) => [h[i], h[i + 2]])])].sort((a, b) => a - b).filter((v) => v >= outer[i] && v <= outer[i + 2]);
  const xs = pts(0), zs = pts(1), out = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (!holes.some((h) => cx > h[0] && cx < h[2] && cz > h[1] && cz < h[3])) out.push([xs[i], zs[j], xs[i + 1], zs[j + 1]]);
  }
  return out;
}
// 슬롯 화면: 색이 무지개처럼 천천히 돌고, 기계마다 위상이 다름 (CPU 0)
const screenMat = () => patch(new THREE.MeshBasicMaterial({ vertexColors: true }), {
  key: 'slotScreen',
  vert: { head: 'varying float vSeed;', begin_vertex: 'vSeed = position.x * 0.37 + position.z * 0.23 + position.y * 0.9;' },
  frag: { head: 'varying float vSeed;', color_fragment: 'diffuseColor.rgb *= 0.7 + 0.6 * cos(6.2831 * (uTime * 0.45 + vSeed + vec3(0.0, 0.33, 0.67)));' },
});
// 마퀴 전구: 인스턴스 번호로 3칸마다 하나씩 켜지며 흘러감
const bulbMat = () => patch(nightGlow(new THREE.MeshBasicMaterial({ color: hdr('#ffd98a', 1) }), 0.55, 1.35, 0.2), { // 낮엔 은은, 밤엔 반짝
  key: 'marquee',
  vert: { head: 'varying float vOn;', begin_vertex: 'vOn = step(0.34, fract(float(gl_InstanceID) / 3.0 - uTime * 2.2));' },
  frag: { head: 'varying float vOn;', color_fragment: 'diffuseColor.rgb *= mix(4.2, 0.45, vOn);' },
});
function feltTex(name, w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6); g.addColorStop(0, '#2a9a68'); g.addColorStop(1, '#156343');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) { x.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  x.strokeStyle = 'rgba(255,233,168,.85)'; x.fillStyle = 'rgba(255,233,168,.9)'; x.textAlign = 'center'; x.textBaseline = 'middle';
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.name = name;
  return t;
}
const feltMat = (tex) => new THREE.MeshToonMaterial({ map: tex, gradientMap: mats().plain.gradientMap });

export function createCasino(scene, buildAvatar) {
  const b = BUILDINGS.casino, g = new THREE.Group(), ex = new Kit(), casino = { floors: [], npcs: [], cab: null, cabY: 0 };
  scene.add(g);
  const [dx, dz] = doorPos(b), PURPLE = '#8a6cc4', DEEP = '#2b1a40';
  /* ── 겉 ── */
  shellWalls(ex, b, 'stucco', PURPLE);
  for (const side of ['-z', '+z', '-x', '+x']) {
    const alongX = side[1] === 'z', c = alongX ? b.cx : b.cz, half = (alongX ? b.w : b.d) / 2;
    const base = side === b.door ? [[c - half - 0.1, c - b.dw / 2 - 0.25], [c + b.dw / 2 + 0.25, c + half + 0.1]] : [[c - half - 0.1, c + half + 0.1]];
    for (const [a0, a1] of base) face(ex, b, side, (a0 + a1) / 2, 0.35).p('stone', bx(a1 - a0, 0.7, 0.14, 1), [0, 0, 0.04], '#d8cce8');
    for (const k of [1, 2]) { face(ex, b, side, c, k * H).p('shine', bx(half * 2 + 0.5, 0.26, 0.22), [0, 0, 0.08], GOLD).p('plain', bx(half * 2 + 0.4, 0.12, 0.14), [0, -0.2, 0.05], '#f3e3ff'); } // 층 구분 몰딩(바깥만)
    face(ex, b, side, c, b.h - 0.3).p('plain', bx(half * 2 + 0.7, 0.6, 0.3), [0, 0, 0.12], '#f3e3ff').p('shine', bx(half * 2 + 0.8, 0.14, 0.36), [0, 0.34, 0.14], GOLD).p('shine', bx(half * 2 + 0.6, 0.1, 0.32), [0, -0.33, 0.12], GOLD);
    for (const a of [-3.5, 3.5]) face(ex, b, side, c + a, b.h / 2).p('plain', bx(0.5, b.h - 0.7, 0.14), [0, 0, 0.06], '#f3e3ff').p('shine', bx(0.62, 0.3, 0.2), [0, b.h / 2 - 0.6, 0.08], GOLD);
    for (let f = 0; f < 3; f++) {
      if (f === 0 && (side === '-z' || side === '-x')) continue; // 1층 북·서쪽 벽 안쪽엔 슬롯머신이 줄지어 있음
      for (const a of (f === 0 || side === b.door ? [-5.25, 5.25] : [-5.25, 0, 5.25]).filter((a) => !(side === '+z' && a > 5))) windowPair(ex, b, side, c + a, f * H + 1.9, 1.3, 1.7, { arch: true, frame: GOLD, fk: 'shine', glass: '#ffc6e8', gk: 1.15, curtain: FL[f].velvet, barY: 0.2 });
    }
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ex.at(b.cx + sx * b.w / 2, 0, b.cz + sz * b.d / 2).p('plain', bx(0.7, b.h + 0.4, 0.7), [0, (b.h + 0.4) / 2, 0], '#f3e3ff').p('shine', bx(0.82, 0.4, 0.82), [0, b.h + 0.3, 0], GOLD).p('shine', bx(0.82, 0.5, 0.82), [0, 0.25, 0], GOLD);
  // 지붕: 난간 + 작은 금빛 돔 + 별
  ex.at(b.cx, b.h, b.cz).p('plain', bx(b.w + 0.6, 0.3, b.d + 0.6), [0, 0.15, 0], DEEP).p('plain', bx(b.w - 0.6, 0.1, b.d - 0.6), [0, 0.32, 0], '#4a3570');
  for (const [w, d, x, z] of [[b.w + 0.6, 0.3, 0, b.d / 2 + 0.15], [b.w + 0.6, 0.3, 0, -b.d / 2 - 0.15], [0.3, b.d + 0.6, b.w / 2 + 0.15, 0], [0.3, b.d + 0.6, -b.w / 2 - 0.15, 0]]) ex.p('shine', bx(w, 0.4, d), [x, 0.5, z], GOLD);
  ex.p('plain', cy(2.0, 2.2, 0.8, 24), [0, 0.7, 2.5], '#f3e3ff').p('shine', new THREE.SphereGeometry(2.0, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), [0, 1.1, 2.5], '#c9a0ff').p('shine', cy(0.08, 0.12, 1.1, 8), [0, 3.6, 2.5], GOLD);
  ex.p('glow', new THREE.OctahedronGeometry(0.4, 0), [0, 4.4, 2.5], hdr('#ffe08a', 3));
  // 입구: 금 둥근 기둥 + 아치 채광창 + 붉은 카펫(금 테두리) + 캔틸레버 마퀴 차양 + 양옆 토피어리
  ex.at(dx, 0, dz, Math.PI).sub(0, 0, 0.2);
  for (const s of [-1, 1]) {
    ex.p('shine', cy(0.24, 0.24, 2.9, 16), [s * (b.dw / 2 + 0.3), 1.6, 0.2], GOLD).p('shine', cy(0.34, 0.3, 0.2, 16), [s * (b.dw / 2 + 0.3), 3.1, 0.2], GOLD).p('shine', bx(0.62, 0.2, 0.62), [s * (b.dw / 2 + 0.3), 0.1, 0.2], GOLD);
    ex.p('plain', lathe([[0, 0], [0.32, 0], [0.38, 0.5], [0.42, 0.55], [0, 0.55]], 14), [s * 4.4, 0, 0.32], '#e8b84a').p('plain', new THREE.ConeGeometry(0.34, 1.3, 12), [s * 4.4, 1.2, 0.32], '#3f9a55').p('plain', sp(0.2, 10, 8), [s * 4.4, 1.95, 0.32], '#5bb86c');
  }
  ex.p('win', new THREE.CircleGeometry(b.dw / 2, 28, 0, Math.PI), [0, 2.7, 0.03], hdr('#ffd98a', 1.3), [0, 0, 0], [1, 0.55, 1]);
  for (let i = 1; i < 6; i++) { const a = (i * Math.PI) / 6; ex.p('shine', bx(0.05, 0.9, 0.04), [Math.cos(a) * 1.05, 2.7 + Math.sin(a) * 0.58, 0.06], GOLD, [0, 0, Math.atan2(Math.sin(a) * 0.55, Math.cos(a)) - Math.PI / 2]); }
  ex.p('shine', new THREE.TorusGeometry(b.dw / 2 + 0.08, 0.1, 6, 28, Math.PI), [0, 2.7, 0.06], GOLD, [0, 0, 0], [1, 0.58, 1]);
  ex.p('plain', bx(b.dw + 0.4, 0.03, 3), [0, 0.04, 1.5], '#c0213f').p('shine', bx(0.12, 0.035, 3), [b.dw / 2 + 0.2, 0.045, 1.5], GOLD).p('shine', bx(0.12, 0.035, 3), [-b.dw / 2 - 0.2, 0.045, 1.5], GOLD);
  const CW = 6.6, CD = 2.4, CY = 3.55;
  ex.p('plain', bx(CW, 0.45, CD), [0, CY, CD / 2], DEEP).p('shine', bx(CW + 0.1, 0.12, CD + 0.05), [0, CY - 0.26, CD / 2], GOLD).p('shine', bx(CW + 0.1, 0.1, CD + 0.05), [0, CY + 0.26, CD / 2], GOLD);
  for (const s of [-1, 1]) ex.p('shine', cy(0.03, 0.03, 2.6, 6), [s * (CW / 2 - 0.3), CY + 1.15, CD / 2 + 0.1], '#c9ced6', [-1.0, 0, 0]);
  for (let i = 0; i < 3; i++) ex.p('glow', cy(0.16, 0.16, 0.02, 12), [(i - 1) * 2, CY - 0.33, CD / 2 + 0.3], hdr('#fff0c0', 3.5));
  const bulbs = [], P = new THREE.Vector3();
  const bulb = (x, y, z) => { P.set(x, y, z).applyMatrix4(ex.f); bulbs.push(P.clone()); };
  for (let x = -CW / 2 + 0.15; x <= CW / 2 - 0.1; x += 0.3) bulb(x, CY - 0.36, CD - 0.02);
  for (const s of [-1, 1]) for (let z = CD - 0.3; z > 0.1; z -= 0.3) bulb(s * (CW / 2 - 0.02), CY - 0.36, z);
  for (let a = 0.12; a < Math.PI - 0.05; a += 0.19) bulb(Math.cos(a) * (b.dw / 2 + 0.25), 2.7 + Math.sin(a) * (b.dw / 2 + 0.25) * 0.58, 0.14);
  // 지붕 위 큰 네온 간판 + 전구 테두리
  const art = casinoArt(), SW = 8.4, SH = 2.6, SY = b.h + 2.4;
  ex.at(b.cx, SY, b.cz - b.d / 2 + 0.6, Math.PI);
  ex.p('plain', bx(SW, SH, 0.3), [0, 0, 0], DEEP).p('shine', bx(SW + 0.2, 0.16, 0.36), [0, SH / 2, 0], GOLD).p('shine', bx(SW + 0.2, 0.16, 0.36), [0, -SH / 2, 0], GOLD);
  for (const s of [-1, 1]) ex.p('shine', bx(0.16, SH + 0.2, 0.36), [s * SW / 2, 0, 0], GOLD).p('plain', bx(0.25, 2.0, 0.25), [s * 2.6, -SH / 2 - 0.9, 0.2], DEEP);
  ex.p('neon', plane(SW - 0.6, SH - 0.5, 0, art.uv(0, 4, 1)), [0, 0, 0.16], '#ffffff');
  for (let x = -SW / 2 + 0.25; x < SW / 2 - 0.1; x += 0.35) { bulb(x, SH / 2 - 0.2, 0.17); bulb(-x, -SH / 2 + 0.2, 0.17); }
  for (let y = -SH / 2 + 0.45; y < SH / 2 - 0.3; y += 0.35) { bulb(SW / 2 - 0.2, y, 0.17); bulb(-SW / 2 + 0.2, -y, 0.17); }
  ex.at(dx, CY, dz - 0.2 - CD - 0.035, Math.PI).p('neon', plane(4.2, 0.4, 0, art.uv(4, 4, 0.4)), [0, 0, 0], '#ffffff');
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), bulbMat(), bulbs.length), m4 = new THREE.Matrix4();
  bulbs.forEach((p, i) => im.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  im.computeBoundingSphere(); g.add(im);

  /* ── 속: 층마다 그룹 하나(층 숨김·슬랩 구멍 유지) ── */
  const X0 = b.cx - b.w / 2 + 0.2, X1 = b.cx + b.w / 2 - 0.2, Z0 = b.cz - b.d / 2 + 0.2, Z1 = b.cz + b.d / 2 - 0.2, shaft = [SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1];
  const fg = casino.floors = [0, 1, 2].map(() => { const grp = new THREE.Group(); g.add(grp); return grp; });
  const K = [new Kit(), new Kit(), new Kit()];
  for (let f = 0; f < 3; f++) {
    const k = K[f], y0 = f * H, L = FL[f], top = y0 + H - 0.3;
    // 바닥: 1층은 바닥판, 2·3층은 구멍 뚫린 슬랩(아랫면은 아래층 천장) + 카펫
    const fl = f ? cells([X0, Z0, X1, Z1], [runRect(RUNS[f - 1]), shaft]) : [[X0 - 0.1, Z0 - 0.1, X1 + 0.1, Z1 + 0.1]];
    for (const [x0, z0, x1, z1] of fl) {
      const k = f ? K[f] : ex; // 1층 바닥은 겉에 둬서 멀리서 실내를 숨겨도 문 안이 비지 않게
      k.at((x0 + x1) / 2, y0, (z0 + z1) / 2);
      if (f) k.p('plain', bx(x1 - x0, 0.3, z1 - z0), [0, -0.15, 0], '#3a2a55').p('plain', bx(x1 - x0, 0.06, z1 - z0), [0, -0.33, 0], '#5e4a8a');
      else k.p('plain', bx(x1 - x0, 0.08, z1 - z0), [0, 0.04, 0], '#3a2a55');
      k.p('carpet', plane(x1 - x0, z1 - z0, 1.5), [0, f ? 0.012 : 0.09, 0], '#ffffff', [-Math.PI / 2, 0, 0]);
    }
    // 벽: 짙은 나무 판넬 + 다마스크 천 + 금 몰딩·세로 띠 + 천장 몰딩
    bands(k, b, y0, y0 + 1.1, 'wains', '#7a4a34', { door: f === 0, t: 1.1 });
    bands(k, b, y0 + 1.1, top, 'damask', L.wall, { door: f === 0, t: 1.4 });
    bands(k, b, y0 + 1.08, y0 + 1.16, 'shine', GOLD, { door: f === 0, dz: 0.035 });
    bands(k, b, top - 0.22, top, 'shine', GOLD, { door: false, dz: 0.05 });
    for (const side of ['-z', '+z', '-x', '+x']) {
      const alongX = side[1] === 'z', c = alongX ? b.cx : b.cz;
      for (const a of [-4.4, -1.6, 1.6, 4.4]) if (!(f === 0 && side === b.door && Math.abs(a) < b.dw / 2 + 0.2)) face(k, b, side, c + a, (y0 + 1.16 + top - 0.22) / 2, false).p('shine', bx(0.06, top - 0.22 - y0 - 1.16, 0.03), [0, 0, 0.03], GOLD);
      for (const a of [-3, 3]) face(k, b, side, c + a, y0 + 2.75, false).p('shine', bx(0.12, 0.3, 0.12), [0, -0.05, 0.06], GOLD).p('glow', sp(0.1, 10, 8), [0, 0.15, 0.1], hdr('#ffe2a8', 3));
    }
    // 천장: 금 격자(아래층 천장 = 위 슬랩 아랫면) + 샹들리에 + 앞벽 네온 줄 + 층 이름 간판
    if (f === 2) k.at(b.cx, 3 * H - 0.15, b.cz).p('plain', bx(X1 - X0, 0.3, Z1 - Z0), [0, 0, 0], '#5e4a8a');
    for (let i = -2; i <= 2; i++) { k.at(b.cx + i * 2.6, top - 0.1, b.cz).p('shine', bx(0.1, 0.05, Z1 - Z0 - 0.2), [0, 0, 0], GOLD); k.at(b.cx, top - 0.1, b.cz + i * 2.6).p('shine', bx(X1 - X0 - 0.2, 0.05, 0.1), [0, 0, 0], GOLD); }
    chandelier(k, b.cx, top, f === 1 ? 1.2 : 1);
    k.at(b.cx, y0 + 3.72, Z0 + 0.15).p('glow', bx(b.w - 1.5, 0.08, 0.1), [0, 0, 0], hdr(L.neon, 3));
    k.at(b.cx, y0 + 3.2, Z0, 0).p('art', plane(2.8, 0.875, 0, art.uv(8 + f, 1, 0.31)), [0, 0, 0.1], '#ffffff');
    elevatorDoor(k, y0);
  }
  // 엘리베이터 통로: 유리벽 + 크롬 기둥 (세 층을 꿰뚫음)
  { const k = K[0], w = SHAFT.x1 - SHAFT.x0, d = SHAFT.z1 - SHAFT.z0;
    for (const [x, z, sw, sd] of [[SHAFT.cx, SHAFT.z0, w, 0.06], [SHAFT.cx, SHAFT.z1, w, 0.06], [SHAFT.x1, SHAFT.cz, 0.06, d]]) k.at(x, 1.5 * H, z).p('glass', bx(sw, 3 * H, sd), [0, 0, 0], '#cfe8ff');
    for (const [x, z] of [[SHAFT.x0, SHAFT.z0], [SHAFT.x0, SHAFT.z1], [SHAFT.x1, SHAFT.z0], [SHAFT.x1, SHAFT.z1]]) k.at(x, 1.5 * H, z).p('shine', bx(0.12, 3 * H, 0.12), [0, 0, 0], '#d9dde2');
    const cabK = new Kit(), cab = casino.cab = new THREE.Group(); cab.position.set(SHAFT.cx, 0, SHAFT.cz); g.add(cab);
    cabK.p('shine', bx(w - 0.3, 0.1, d - 0.3), [0, 0.05, 0], '#c9a066').p('plain', bx(w - 0.3, 0.1, d - 0.3), [0, 2.6, 0], DEEP).p('glow', cy(0.35, 0.35, 0.02, 16), [0, 2.54, 0], hdr('#fff1c8', 3));
    cabK.p('shine', bx(0.06, 2.5, d - 0.3), [(w - 0.3) / 2, 1.3, 0], '#e3e7ec').p('shine', bx(w - 0.3, 2.5, 0.06), [0, 1.3, (d - 0.3) / 2], '#e3e7ec').p('shine', bx(w - 0.3, 2.5, 0.06), [0, 1.3, -(d - 0.3) / 2], '#e3e7ec');
    cabK.p('shine', bx(0.05, 0.05, d - 0.5), [(w - 0.3) / 2 - 0.08, 0.95, 0], GOLD).p('plain', bx(0.04, 0.4, 0.25), [(w - 0.3) / 2 - 0.03, 1.3, 0.55], '#3a3f4a');
    buildKit(cabK, cab, true);
  }
  // 1층: 슬롯머신 + 스툴 / 환전소
  SLOTS.forEach((m, i) => slot(K[0], m, i));
  { const [x0, z0, x1, z1] = CASHIER.counter, k = K[0], w = x1 - x0, d = z1 - z0;
    k.at((x0 + x1) / 2, 0, (z0 + z1) / 2, Math.PI); // 손님 쪽(-z)이 앞
    k.p('wood', bx(w, 1.0, d, 0.8), [0, 0.5, 0], '#6b3f1f').p('plain', bx(w + 0.2, 0.08, d + 0.2), [0, 1.04, 0], '#f4ece4').p('shine', bx(w + 0.22, 0.04, d + 0.22), [0, 0.99, 0], GOLD);
    for (let i = 0; i < 4; i++) k.p('shine', bx(0.9, 0.6, 0.03), [-1.5 + i, 0.5, d / 2 + 0.01], GOLD).p('wood', bx(0.78, 0.48, 0.03), [-1.5 + i, 0.5, d / 2 + 0.02], '#7e4a26');
    for (let x = -w / 2 + 0.1; x <= w / 2 - 0.05; x += 0.22) k.p('shine', cy(0.015, 0.015, 0.26, 6), [x, 1.21, d / 2 - 0.08], GOLD); // 낮은 놋쇠 난간: 키 큰 창살은 뒤에 선 카메라 시야를 가림
    k.p('shine', bx(w + 0.1, 0.05, 0.05), [0, 1.35, d / 2 - 0.08], GOLD);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) k.p('plain', cy(0.06, 0.06, 0.02, 12), [-0.4 + i * 0.2, 1.1 + j * 0.022, 0.05], ['#e03a3a', '#3a7be0', '#ffd43b', '#ffffff', '#3dbd78'][i]);
    k.at((x0 + x1) / 2, 2.75, Z1, Math.PI).p('art', plane(1.6, 0.5, 0, art.uv(11, 1, 0.31)), [0, 0, 0.04], '#ffffff');
  }
  // 계단: 나무 단 + 층 색 카펫 러너 + 옆판 + 금 난간 / 위층 구멍 둘레 난간
  RUNS.forEach((r, fa) => {
    const k = K[fa], n = 14, dzs = (r.zHigh - r.zLow) / n, len = Math.hypot(r.zHigh - r.zLow, H), ang = Math.atan2(H, r.zHigh - r.zLow);
    for (let i = 0; i < n; i++) { const h = ((i + 1) * H) / n, z = r.zLow + (i + 0.5) * dzs; k.at(r.x, fa * H, z).p('wood', bx(r.w, h, dzs * 0.98, 0.7), [0, h / 2, 0], '#b07a50').p('plain', bx(r.w - 0.5, h + 0.015, dzs * 0.99), [0, h / 2 + 0.0075, 0.004], FL[fa].velvet).p('shine', bx(r.w - 0.5, 0.02, 0.03), [0, h + 0.01, dzs / 2 - 0.01], GOLD); }
    for (const s of [-1, 1]) {
      k.at(r.x + s * (r.w / 2 - 0.05), fa * H + H / 2, (r.zLow + r.zHigh) / 2).p('wood', bx(0.1, 0.35, len, 0.8), [0, -0.25, 0], '#6b3f1f', [-ang, 0, 0]).p('shine', bx(0.07, 0.07, len), [0, 0.85, 0], GOLD, [-ang, 0, 0]);
      for (let i = 1; i < n; i += 2) { const z = r.zLow + (i + 0.5) * dzs, h = ((i + 1) * H) / n; k.at(r.x + s * (r.w / 2 - 0.05), fa * H + h, z).p('shine', cy(0.02, 0.02, 0.85, 6), [0, 0.42, 0], GOLD); }
    }
    const up = K[fa + 1], y = (fa + 1) * H, [x0, z0, x1, z1] = runRect(r);
    for (const [ax, az, bx2, bz] of [[x0, z0, x1, z0], [x0, z0, x0, z1], [x1, z0, x1, z1]]) {
      const l = Math.hypot(bx2 - ax, bz - az), a = Math.atan2(bx2 - ax, bz - az);
      up.at((ax + bx2) / 2, y, (az + bz) / 2, a).p('shine', bx(0.08, 0.08, l), [0, 1.0, 0], GOLD).p('shine', bx(0.05, 0.05, l), [0, 0.35, 0], GOLD).p('glass', bx(0.03, 0.6, l - 0.1), [0, 0.67, 0], '#e8d8ff');
      for (let t = 0; t <= l + 0.01; t += l / Math.max(2, Math.round(l / 0.9))) up.p('shine', cy(0.035, 0.035, 1.0, 8), [0, 0.5, -l / 2 + t], GOLD);
    }
  });
  // 2층: 홀덤 타원 테이블(쿠션 레일·펠트·칩·카드) + 의자
  { const k = K[1], py = H + 0.8, ell = (rx, rz, y, n = 64) => new THREE.CatmullRomCurve3(Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * rx, y, Math.cos(a) * rz); }), true);
    k.at(POKER.cx, 0, POKER.cz);
    k.p('wood', cy(1, 1, 0.24, 48), [0, py - 0.1, 0], '#6b3f1f', [0, 0, 0], [3.0, 1, 2.0]).p('plain', new THREE.TubeGeometry(ell(2.95, 1.95, py + 0.06), 64, 0.13, 8, true), [0, 0, 0], '#3a2228');
    k.p('shine', new THREE.TubeGeometry(ell(2.78, 1.78, py + 0.05), 64, 0.025, 4, true), [0, 0, 0], GOLD);
    k.p('pfelt', new THREE.CircleGeometry(1, 48), [0, py + 0.045, 0], '#ffffff', [-Math.PI / 2, 0, 0], [2.8, 1.8, 1]);
    k.p('wood', lathe([[0, 0], [0.9, 0], [0.9, 0.08], [0.4, 0.2], [0.35, 0.72], [0, 0.72]], 24), [0, H, 0], '#3a2a28', [0, 0, 0], [1.5, 1, 1]);
    POKER_CHAIRS.forEach((c, i) => {
      const a = (i / 8) * Math.PI * 2, px = Math.sin(a) * 2.25, pz = -Math.cos(a) * 1.4;
      for (let j = 0; j < 3 + (i % 3); j++) k.p('plain', cy(0.065, 0.065, 0.018, 12), [px - 0.12, py + 0.06 + j * 0.02, pz], ['#e03a3a', '#3a7be0', '#ffd43b', '#ffffff'][(i + j) % 4]);
      for (let j = 0; j < 2; j++) k.p('plain', bx(0.14, 0.008, 0.2), [px + 0.1 + j * 0.06, py + 0.055 + j * 0.003, pz], '#ffffff', [0, a + j * 0.25, 0]);
    });
    for (let i = 0; i < 5; i++) k.p('plain', bx(0.14, 0.008, 0.2), [-0.4 + i * 0.2, py + 0.055, 0.25], '#ffffff');
    for (let j = 0; j < 4; j++) for (const [cx2, c] of [[-0.3, '#e03a3a'], [0, '#ffd43b'], [0.3, '#3a7be0']]) k.p('plain', cy(0.065, 0.065, 0.018, 12), [cx2, py + 0.06 + j * 0.02, -0.35], c);
    POKER_CHAIRS.forEach((c) => chair(k, c, H, FL[1].velvet));
  }
  // 3층: 블랙잭 반달 테이블(펠트 무늬·쿠션 레일·칩 받침·카드 슈) + 딜러 + 의자
  const [bx0, bz0, bx1, bz1] = BJ.rect, rx = (bx1 - bx0) / 2, rz = bz1 - bz0, cxx = (bx0 + bx1) / 2;
  const bet = (dx) => Math.max(0.35, 0.7 * rz * Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2))); // 의자 앞 베팅 원(테이블 가장자리에서 안쪽)
  { const k = K[2], by = 2 * H + 0.8;
    const shape = new THREE.Shape(); shape.moveTo(rx, 0); for (let i = 1; i <= 40; i++) { const t = (i / 40) * Math.PI; shape.lineTo(Math.cos(t) * rx, -Math.sin(t) * rz); } shape.closePath();
    const top = new THREE.ShapeGeometry(shape, 40), uv = top.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + rx) / (2 * rx), (uv.getY(i) + rz) / rz);
    k.at(cxx, 0, bz0);
    k.p('bjfelt', top, [0, by + 0.05, 0], '#ffffff', [-Math.PI / 2, 0, 0]);
    k.p('wood', new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false, curveSegments: 40 }), [0, by - 0.18, 0], '#6b3f1f', [-Math.PI / 2, 0, 0]);
    const arc = new THREE.CatmullRomCurve3(Array.from({ length: 41 }, (_, i) => { const t = (i / 40) * Math.PI; return new THREE.Vector3(Math.cos(t) * (rx - 0.05), by + 0.08, Math.sin(t) * (rz - 0.05)); }));
    k.p('plain', new THREE.TubeGeometry(arc, 40, 0.12, 8, false), [0, 0, 0], '#3a2228').p('shine', bx(2 * rx, 0.06, 0.08), [0, by + 0.06, 0.02], GOLD);
    k.p('wood', bx(4.4, 0.6, 0.6), [0, 2 * H + 0.3, 0.4], '#3a2a28');
    k.p('plain', bx(1.1, 0.06, 0.3), [0, by + 0.07, 0.2], '#2a1a14');
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) k.p('plain', cy(0.045, 0.045, 0.02, 10), [-0.45 + i * 0.18, by + 0.1 + j * 0.0, 0.2 + (j - 1.5) * 0.06], ['#e03a3a', '#3a7be0', '#ffd43b', '#ffffff', '#3dbd78', '#1d1722'][i], [Math.PI / 2, 0, 0]);
    k.p('plain', bx(0.3, 0.14, 0.4), [1.2, by + 0.12, 0.35], '#7a1f3d').p('plain', bx(0.24, 0.1, 0.02), [1.2, by + 0.14, 0.56], '#ffffff', [-0.4, 0, 0]);
    BJ_CHAIRS.forEach((c) => { k.p('plain', bx(0.14, 0.008, 0.2), [c.x - cxx + 0.12, by + 0.062, bet(c.x - cxx) - 0.05], '#ffffff', [0, 0.2, 0]); chair(k, c, 2 * H, FL[2].velvet); k.at(cxx, 0, bz0); });
  }
  const pfelt = feltTex('poker', 512, 512, (x, w, h) => { x.save(); x.translate(w / 2, h / 2); x.lineWidth = 6; x.beginPath(); x.arc(0, 0, w * 0.36, 0, 7); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(0, 0, w * 0.33, 0, 7); x.stroke(); x.scale(1.8 / 2.8, 1); x.font = 'bold 54px serif'; x.fillText("HOLD'EM", 0, -10); x.font = '28px serif'; x.fillText('♠ ♥ POGEUN ♦ ♣', 0, 40); x.restore(); });
  const bjf = feltTex('bj', 520, 200, (x, w, h) => {
    x.font = 'bold 22px serif'; x.fillText('DEALER MUST STAND ON 17', w / 2, 30);
    x.lineWidth = 3; x.beginPath(); x.ellipse(w / 2, 0, w * 0.4, h * 0.72, 0, 0.15, Math.PI - 0.15); x.stroke();
    x.font = 'bold 20px serif'; x.fillText('BLACKJACK PAYS 3 TO 2', w / 2, h * 0.58);
    BJ_CHAIRS.forEach((c) => { const dx = c.x - cxx; x.lineWidth = 3; x.beginPath(); x.arc(((dx + rx) / (2 * rx)) * w, (bet(dx) / rz) * h, 15, 0, 7); x.stroke(); });
  });
  const carpet = (f) => new THREE.MeshToonMaterial({ map: TX.casinoCarpetTex(...FL[f].carpet), gradientMap: mats().plain.gradientMap, vertexColors: true });
  buildKit(ex, g, false, { neon: nightGlow(artMat(art.tex, 2.4), 0.6, 1.25, 0.2), carpet: carpet(0) });
  for (let f = 0; f < 3; f++) buildKit(K[f], fg[f], true, { carpet: carpet(f), art: artMat(art.tex, 1.1), screen: screenMat(), pfelt: feltMat(pfelt), bjfelt: feltMat(bjf) });
  // 직원(움직이지 않는 NPC): 환전소·블랙잭 딜러
  const npc = (a, x, y, z, ry, grp) => { const av = buildAvatar(a); av.root.position.set(x, 0, z); av.root.rotation.y = ry; av.gy = y; grp.add(av.root); casino.npcs.push(av); };
  npc({ g: 'm', hs: 1, hc: 0, ey: 4, sk: 1, os: 3, oc: 0, bc: 1, ac: 0 }, CASHIER.npc[0], 0, CASHIER.npc[1], Math.PI, fg[0]);
  npc({ g: 'f', hs: 5, hc: 0, ey: 0, sk: 1, os: 3, oc: 0, bc: 1, ac: 0 }, BJ.dealer[0], 2 * H, BJ.dealer[1], 0, fg[2]);
  return casino;
}

// 샹들리에: 금 고리 두 겹 + 수정(블룸) + 촛불 전구
function chandelier(k, x, top, s) {
  k.at(x, top - 0.06, BUILDINGS.casino.cz);
  k.p('shine', cy(0.02, 0.02, 0.2, 6), [0, -0.1, 0], '#d9b46a').p('shine', sp(0.1 * s, 10, 8), [0, -0.22, 0], GOLD);
  for (const [r, y, n] of [[0.85 * s, -0.28, 12], [0.5 * s, -0.4, 8]]) {
    k.p('shine', new THREE.TorusGeometry(r, 0.035, 6, 32), [0, y, 0], GOLD, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, px = Math.cos(a) * r, pz = Math.sin(a) * r; k.p('glow', new THREE.OctahedronGeometry(0.05, 0), [px, y - 0.1, pz], hdr('#e8f4ff', 2.6), [0, 0, 0], [1, 1.8, 1]).p('glow', sp(0.045, 6, 4), [px, y + 0.07, pz], hdr('#ffe2a8', 4)); }
  }
  k.p('glow', new THREE.OctahedronGeometry(0.1, 0), [0, -0.5, 0], hdr('#e8f4ff', 3), [0, 0, 0], [1, 1.8, 1]);
}
// 슬롯머신: 둥근 머리 + 위 조명 상자 + 무지개 화면(릴 3개) + 버튼 판 + 손잡이 + 동전 받이 / 스툴
function slot(k, m, i) {
  const col = ['#d62f4b', '#2f7bd6', '#e0a82e', '#3dbd78', '#8a4fd6', '#e07a2f'][i % 6];
  k.at(m.x, 0, m.z, m.ry);
  k.p('plain', bx(1.0, 0.8, 0.78), [0, 0.4, -0.02], col).p('shine', bx(1.04, 0.06, 0.82), [0, 0.8, -0.02], GOLD);
  k.p('plain', bx(1.0, 0.75, 0.6), [0, 1.18, -0.1], '#1d1722').p('shine', bx(1.04, 0.79, 0.04), [0, 1.18, 0.21], GOLD);
  k.p('glow', plane(0.82, 0.6), [0, 1.2, 0.235], hdr('#2a1840', 1));
  for (let r = 0; r < 3; r++) k.p('screen', plane(0.22, 0.42), [(r - 1) * 0.26, 1.2, 0.24], hdr(['#ff6b8a', '#ffd84a', '#6bd4ff'][r], 1.6));
  k.p('plain', bx(1.0, 0.12, 0.3), [0, 0.86, 0.33], '#2a2236', [0.35, 0, 0]);
  for (let r = 0; r < 4; r++) k.p('glow', cy(0.045, 0.045, 0.03, 10), [-0.3 + r * 0.2, 0.92, 0.36], hdr(['#ff5a7a', '#ffd84a', '#5ae0a0', '#6aa0ff'][r], 3), [0.35 - Math.PI / 2, 0, 0]);
  k.p('plain', bx(1.0, 0.5, 0.6), [0, 1.8, -0.1], col).p('glow', plane(0.86, 0.36), [0, 1.8, 0.205], hdr('#ffe9a8', 2.4));
  k.p('plain', cy(0.5, 0.5, 0.6, 20, false, -Math.PI / 2, Math.PI), [0, 2.05, -0.1], col, [Math.PI / 2, 0, 0], [1, 1, 0.4]);
  k.p('glow', new THREE.TorusGeometry(0.5, 0.025, 6, 20, Math.PI), [0, 2.05, 0.21], hdr('#fff1b0', 3));
  k.p('shine', cy(0.04, 0.04, 0.6, 8), [0.6, 1.05, -0.05], '#d9dde2').p('plain', sp(0.1, 10, 8), [0.6, 1.4, -0.05], '#e03a3a').p('shine', bx(0.1, 0.15, 0.15), [0.53, 0.8, -0.05], '#d9dde2');
  k.p('shine', bx(0.5, 0.1, 0.16), [0, 0.3, 0.42], '#d9dde2');
  k.at(m.sx, 0, m.sz, m.sry).p('plain', cy(0.26, 0.24, 0.12, 16), [0, 0.5, 0], '#9e2343').p('shine', cy(0.05, 0.05, 0.42, 8), [0, 0.22, 0], GOLD).p('shine', cy(0.24, 0.26, 0.04, 16), [0, 0.02, 0], GOLD).p('shine', new THREE.TorusGeometry(0.18, 0.015, 4, 16), [0, 0.2, 0], GOLD, [Math.PI / 2, 0, 0]);
}
// 의자: 둥근 쿠션 + 등받이 + 금 다리
function chair(k, c, y0, color) {
  k.at(c.x, y0, c.z, c.ry);
  k.p('plain', cy(0.3, 0.28, 0.12, 18), [0, 0.46, 0], color).p('shine', cy(0.29, 0.29, 0.03, 18), [0, 0.39, 0], GOLD);
  k.p('shine', cy(0.04, 0.06, 0.38, 8), [0, 0.19, 0], GOLD).p('shine', cy(0.24, 0.26, 0.03, 16), [0, 0.015, 0], GOLD);
  k.p('plain', bx(0.52, 0.5, 0.1), [0, 0.8, -0.27], color, [-0.1, 0, 0]).p('shine', new THREE.TorusGeometry(0.27, 0.025, 6, 16, Math.PI), [0, 1.03, -0.29], GOLD, [-0.1, 0, 0]);
}
// 엘리베이터 문틀(층마다): 금속 틀 + 층 표시등 + 호출 버튼
function elevatorDoor(k, y0) {
  const z0 = BUILDINGS.casino.cz + 5.1, z1 = BUILDINGS.casino.cz + 6.3, zc = (z0 + z1) / 2, x = SHAFT.x0 - 0.08;
  k.at(x, y0, zc, -Math.PI / 2);
  for (const s of [-1, 1]) k.p('shine', bx(0.14, 2.6, 0.12), [s * ((z1 - z0) / 2 + 0.07), 1.3, 0], GOLD);
  k.p('shine', bx(z1 - z0 + 0.42, 0.18, 0.14), [0, 2.65, 0], GOLD).p('plain', bx(0.9, 0.24, 0.06), [0, 2.95, 0], '#1d1722');
  for (let i = 0; i < 3; i++) k.p('glow', sp(0.04, 8, 6), [-0.25 + i * 0.25, 2.95, 0.04], hdr(Math.round(y0 / FLOOR_H) === i ? '#7ee787' : '#4a4a5a', Math.round(y0 / FLOOR_H) === i ? 3 : 1));
  k.p('shine', bx(0.12, 0.26, 0.05), [(z1 - z0) / 2 + 0.35, 1.2, 0], '#d9dde2').p('glow', sp(0.03, 6, 4), [(z1 - z0) / 2 + 0.35, 1.25, 0.03], hdr('#ffd98a', 3));
}
function casinoArt() {
  return TX.atlas('casinoArt', 4, 256, [
    (x, w, h) => { // 0~3 가로 4칸 × 1.2: 큰 네온 간판
      const W = w * 4, Hh = h; x.fillStyle = '#12081e'; x.fillRect(0, 0, W, Hh);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 190px sans-serif';
      x.shadowColor = '#ff4fa3'; x.shadowBlur = 30; x.fillStyle = '#ffd6ec'; x.fillText('CASINO', W / 2, Hh * 0.45);
      x.shadowColor = '#ffd86b'; x.shadowBlur = 18; x.font = 'bold 54px sans-serif'; x.fillStyle = '#fff2c4'; x.fillText('★  🎰  ♠  ♥  ♦  ♣  🃏  ★', W / 2, Hh * 0.84); x.shadowBlur = 0;
    }, () => {}, () => {}, () => {},
    (x, w, h) => { const W = w * 4, Hh = h * 0.4; x.fillStyle = '#12081e'; x.fillRect(0, 0, W, Hh); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 70px sans-serif'; x.shadowColor = '#ffd86b'; x.shadowBlur = 16; x.fillStyle = '#fff2c4'; x.fillText('✦ GRAND POGEUN CASINO ✦', W / 2, Hh / 2 + 4); x.shadowBlur = 0; },
    () => {}, () => {}, () => {},
    ...FL.map((L) => (x, w) => { const t = signTex(L.sign, L.velvet, '#ffe9a8', 256, 80, 40); x.drawImage(t.image, 0, 0, w, 80); }),
    (x, w) => { const t = signTex('🪙 CASHIER', '#6b3f1f', '#ffe9a8', 256, 80, 38); x.drawImage(t.image, 0, 0, w, 80); },
  ]);
}
