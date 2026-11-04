// 성당(그림 3: 모래빛 고딕 쌍탑)·교회(그림 1: 붉은 벽돌 종탑)·사찰 구내(그림 2) 겉·속·앞마당.
// 위치·충돌·자리는 world.js 의 설계도(SACRED_DESIGN)·SPOTS 를 그대로 따름. 재질별로 합쳐 그리기 호출을 줄임
import * as THREE from 'three';
import { SACRED_DESIGN, XF, wallRects } from './world.js';
const { B: DB, P: SP, TY } = SACRED_DESIGN; // 설계도(1배) 좌표로 짓고, createSacred 가 단지마다 3배로 키워 제자리에 놓음
import { soft, Batch, nightGlow, lumpy, place } from './gfx.js';
import { Kit, bx, cy, sp, plane, lathe, leaf, hdr, buildKit, face, mats } from './buildings.js';
import * as TX from './textures.js';
import { cathedralIn, churchIn, templeIn, templeAltar } from './interiors.js';

const PI = Math.PI;
/* ───── 캔버스 그림 (에셋 파일 없음) ───── */
const cache = {};
function canvasTex(name, w, h, draw, repeat = false) {
  if (cache[name]) return cache[name];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (cache[name] = t);
}
// 스테인드글라스: 파스텔 조각 + 납선
const stainedTex = () => canvasTex('stained', 128, 256, (x, w, h) => {
  const C = ['#ffb3c8', '#ffe39a', '#c9b4ff', '#a8dcff', '#ffcfa6', '#f7a1c4', '#b8f0d0'];
  for (let j = 0; j < 8; j++) for (let i = 0; i < 3; i++) { x.fillStyle = C[(i * 3 + j * 5) % C.length]; x.fillRect(i * w / 3, j * h / 8, w / 3, h / 8); }
  x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(w / 2, h * 0.28, w * 0.22, 0, 7); x.fill();
  x.strokeStyle = '#6b5470'; x.lineWidth = 5;
  for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(i * w / 3, 0); x.lineTo(i * w / 3, h); x.stroke(); }
  for (let j = 1; j < 8; j++) { x.beginPath(); x.moveTo(0, j * h / 8); x.lineTo(w, j * h / 8); x.stroke(); }
  x.beginPath(); x.arc(w / 2, h * 0.28, w * 0.22, 0, 7); x.stroke();
  x.lineWidth = 10; x.strokeRect(0, 0, w, h);
});
// 실내용 연한 스테인드글라스 (분홍·노랑 파스텔, 그림 interior-2)
const stainedPTex = () => canvasTex('stainedP', 128, 256, (x, w, h) => {
  const C = ['#ffd2e0', '#fff1b8', '#ffc6dc', '#ffe8b0', '#fbbcd4', '#ffe2c8', '#f6d6f2'];
  for (let j = 0; j < 8; j++) for (let i = 0; i < 3; i++) { x.fillStyle = C[(i * 3 + j * 5) % C.length]; x.fillRect(i * w / 3, j * h / 8, w / 3, h / 8); }
  x.strokeStyle = '#c99aa8'; x.lineWidth = 3;
  for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(i * w / 3, 0); x.lineTo(i * w / 3, h); x.stroke(); }
  for (let j = 1; j < 8; j++) { x.beginPath(); x.moveTo(0, j * h / 8); x.lineTo(w, j * h / 8); x.stroke(); }
  x.lineWidth = 6; x.strokeRect(0, 0, w, h);
});
// 꽃살창 너머 풍경: 분홍 노을 하늘 + 먼 산 + 벚나무 (그림 interior-3)
const sunsetTex = () => canvasTex('sunset', 128, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffb0c4'); g.addColorStop(0.55, '#ffd0b0'); g.addColorStop(1, '#ffe2c4'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#c99ab4'; x.beginPath(); x.moveTo(0, h * 0.7); x.quadraticCurveTo(w * 0.4, h * 0.55, w, h * 0.68); x.lineTo(w, h); x.lineTo(0, h); x.fill();
  x.fillStyle = '#7db07a'; x.fillRect(0, h * 0.82, w, h);
  x.fillStyle = '#6b4a3a'; x.fillRect(w * 0.42, h * 0.62, 8, h * 0.22);
  x.fillStyle = '#ff9fc0'; for (const [cx, cy, r] of [[0.5, 0.58, 0.22], [0.32, 0.62, 0.15], [0.68, 0.63, 0.16], [0.5, 0.48, 0.15]]) { x.beginPath(); x.arc(cx * w, cy * h, r * w, 0, 7); x.fill(); }
  x.fillStyle = '#3f7a5a'; x.beginPath(); x.moveTo(w * 0.05, h * 0.84); x.lineTo(w * 0.15, h * 0.6); x.lineTo(w * 0.25, h * 0.84); x.fill();
});
// 열린 꽃살: 투명 바탕에 나무 빗살·붉은 틀만 (밖 풍경이 보이게)
const latticeOpenTex = () => canvasTex('latticeO', 128, 256, (x, w, h) => {
  x.clearRect(0, 0, w, h); x.strokeStyle = '#7a3a24'; x.lineWidth = 4;
  for (let i = 0; i <= w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h * 0.62); x.stroke(); }
  for (let j = 0; j <= h * 0.62; j += 16) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
  x.fillStyle = '#8e3a2a'; x.fillRect(0, h * 0.62, w, h * 0.38); x.fillStyle = '#c4553e'; x.fillRect(10, h * 0.62 + 12, w - 20, h * 0.38 - 24);
  x.strokeStyle = '#b8392b'; x.lineWidth = 12; x.strokeRect(0, 0, w, h);
});
// 장미창: 꽃잎 12장 (분홍·노랑·보라)
const roseTex = () => canvasTex('rose', 256, 256, (x, w) => {
  const c = w / 2; x.fillStyle = '#6b5470'; x.beginPath(); x.arc(c, c, c, 0, 7); x.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2; x.save(); x.translate(c, c); x.rotate(a);
    x.fillStyle = ['#ffb3d1', '#ffd9a0', '#d8b8ff'][i % 3]; x.beginPath(); x.ellipse(0, -c * 0.55, c * 0.17, c * 0.36, 0, 0, 7); x.fill();
    x.fillStyle = '#fff1c9'; x.beginPath(); x.ellipse(0, -c * 0.6, c * 0.07, c * 0.17, 0, 0, 7); x.fill();
    x.restore();
  }
  x.fillStyle = '#ffd36a'; x.beginPath(); x.arc(c, c, c * 0.2, 0, 7); x.fill();
  x.strokeStyle = '#6b5470'; x.lineWidth = 6; x.beginPath(); x.arc(c, c, c * 0.2, 0, 7); x.stroke(); x.beginPath(); x.arc(c, c, c * 0.95, 0, 7); x.stroke();
});
// 꽃살문: 따뜻한 빛 + 나무 빗살 + 붉은 틀
const latticeTex = () => canvasTex('lattice', 128, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff2c4'); g.addColorStop(1, '#ffc977'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#9a5a34'; x.lineWidth = 3;
  for (let i = -h; i < w + h; i += 16) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i + h, h + 16); x.stroke(); x.beginPath(); x.moveTo(i, h + 16); x.lineTo(i + h, 16); x.stroke(); }
  x.fillStyle = '#e8805a'; for (let j = 24; j < h - 30; j += 22) for (let i = 8; i < w; i += 16) { x.beginPath(); x.arc(i + ((j / 22) % 2) * 8, j, 2.6, 0, 7); x.fill(); }
  x.fillStyle = '#9a5a34'; x.fillRect(0, h * 0.62, w, 10); x.fillRect(0, h * 0.62 + 10, w, h); // 아랫단 궁창판
  x.fillStyle = '#c4553e'; x.fillRect(10, h * 0.62 + 22, w - 20, h * 0.38 - 34);
  x.strokeStyle = '#b8392b'; x.lineWidth = 12; x.strokeRect(0, 0, w, h);
});
// 단청 띠: 초록 바탕 + 주홍·금 꽃무늬 + 위아래 줄
const danTex = () => canvasTex('dan', 256, 64, (x, w, h) => {
  x.fillStyle = '#3f8f73'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#2f6c8f'; x.fillRect(0, 0, w, 7); x.fillStyle = '#c64b36'; x.fillRect(0, h - 8, w, 8);
  for (let i = 0; i < 4; i++) {
    const cx = i * w / 4 + w / 8;
    x.fillStyle = '#e66a46'; x.beginPath(); x.arc(cx, h / 2, 17, 0, 7); x.fill();
    x.fillStyle = '#ffd25e'; for (let k = 0; k < 8; k++) { const a = k * PI / 4; x.beginPath(); x.arc(cx + Math.cos(a) * 11, h / 2 + Math.sin(a) * 11, 4, 0, 7); x.fill(); }
    x.fillStyle = '#fff3d6'; x.beginPath(); x.arc(cx, h / 2, 6, 0, 7); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx + 22, 10); x.lineTo(cx + 32, h / 2); x.lineTo(cx + 22, h - 12); x.stroke();
  }
}, true);
// 기와: 세로 골 + 가로 줄 (회보라)
const giwaTex = () => canvasTex('giwa', 128, 128, (x, w, h) => {
  x.fillStyle = '#4e4860'; x.fillRect(0, 0, w, h); // 짙은 회보라 기와
  for (let i = 0; i < 4; i++) { const g = x.createLinearGradient(i * 32, 0, i * 32 + 32, 0); g.addColorStop(0, '#4c4459'); g.addColorStop(0.5, '#8a8098'); g.addColorStop(1, '#4c4459'); x.fillStyle = g; x.fillRect(i * 32 + 4, 0, 24, h); }
  x.fillStyle = 'rgba(40,30,50,.35)'; for (let j = 0; j < 4; j++) x.fillRect(0, j * 32, w, 3);
}, true);
// 천장 반자: 초록 격자 + 연꽃
const cofferTex = () => canvasTex('coffer', 128, 128, (x, w) => {
  x.fillStyle = '#c0453a'; x.fillRect(0, 0, w, w); x.fillStyle = '#3f8f73'; x.fillRect(10, 10, w - 20, w - 20);
  x.fillStyle = '#ffd25e'; for (let k = 0; k < 8; k++) { const a = k * PI / 4; x.beginPath(); x.ellipse(w / 2 + Math.cos(a) * 24, w / 2 + Math.sin(a) * 24, 12, 7, a, 0, 7); x.fill(); }
  x.fillStyle = '#ff8f8f'; x.beginPath(); x.arc(w / 2, w / 2, 14, 0, 7); x.fill();
}, true);

/* ───── 모양 도우미 ───── */
function fitUV(g) { // 모양 좌표 → 0~1 uv (그림 한 장이 창 하나에 꽉 차게)
  g.computeBoundingBox(); const b = g.boundingBox, uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
  return g;
}
export const lancetShape = (w, h, s = new THREE.Shape()) => { // 뾰족 아치 (아래 가운데 = 원점)
  const r = w / 2, sh = h - w * 0.8;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, sh); s.quadraticCurveTo(r, h - w * 0.15, 0, h); s.quadraticCurveTo(-r, h - w * 0.15, -r, sh); s.closePath();
  return s;
};
export const archShape = (w, h, s = new THREE.Shape()) => { const r = w / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, PI, false); s.closePath(); return s; };
export const lancet = (w, h) => fitUV(new THREE.ShapeGeometry(lancetShape(w, h), 8));
export const arch = (w, h) => fitUV(new THREE.ShapeGeometry(archShape(w, h), 10));
export function ring(shapeFn, wo, ho, wi, hi, y0 = 0) { // 바깥 모양 - 안쪽 구멍 (문틀·창틀 테두리)
  const s = shapeFn(wo, ho), hole = new THREE.Path(); shapeFn(wi, hi, hole); s.holes.push(hole);
  return new THREE.ShapeGeometry(s, 8).translate(0, y0, 0);
}
const tri = (w, h) => new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]));
const coneRoof = (r, h) => new THREE.ConeGeometry(r, h, 4, 1).rotateY(PI / 4); // 네모 뾰족지붕
export function cross(k, key, y, s, color) { k.p(key, bx(0.14 * s, 1.1 * s, 0.14 * s), [0, y + 0.55 * s, 0], color).p(key, bx(0.7 * s, 0.14 * s, 0.14 * s), [0, y + 0.75 * s, 0], color); }
function bell(k, key, y, s, color) { k.p(key, lathe([[0, 0], [0.44, 0], [0.4, 0.12], [0.3, 0.45], [0.26, 0.85], [0.18, 0.98], [0, 1]].map(([r, h]) => [r * s, h * s]), 14), [0, y, 0], color); k.p(key, sp(0.07 * s, 8, 6), [0, y - 0.05 * s, 0], color); }
const flame = (k, x, y, z) => k.p('glow', new THREE.ConeGeometry(0.035, 0.12, 6), [x, y + 0.06, z], hdr('#ffc35a', 3.2));
export function candle(k, x, y, z, h = 0.22, s = 1) { k.p('plain', cy(0.03 * s, 0.03 * s, h, 8), [x, y + h / 2, z], '#fff8ec'); k.p('glow', new THREE.ConeGeometry(0.035 * s, 0.12 * s, 6), [x, y + h + 0.06 * s, z], hdr('#ffc35a', 3.2)); }
export function flowers(k, x0, z0, x1, z1, y, n, seed = 1) { // 꽃밭: 잎 덩어리 + 꽃송이
  let r = seed * 9301 + 49297; const R = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
    if (i % 3 === 0) k.p('plain', new THREE.IcosahedronGeometry(0.22 + R() * 0.12, 0), [x, y + 0.12, z], ['#6cc47b', '#5bb86c', '#7fcf72'][i % 3]);
    else k.p('plain', new THREE.IcosahedronGeometry(0.08 + R() * 0.04, 0), [x, y + 0.25 + R() * 0.15, z], ['#ff8fb1', '#ffffff', '#ffd84a', '#c9a8ff', '#ffb3c7'][i % 5]);
  }
}
function cherry(k, x, z, s = 1, y = 0) { // 앞마당 벚나무 (분홍 덩어리)
  k.at(x, y, z).p('wood', cy(0.16 * s, 0.26 * s, 2.4 * s, 8), [0, 1.2 * s, 0], '#8e6655');
  [[0, 3.0, 0, 1.4], [1.1, 2.7, 0.4, 1.0], [-1.1, 2.8, -0.3, 1.05], [0.3, 2.9, 1.1, 0.95], [-0.2, 2.9, -1.1, 0.95], [0.1, 3.7, 0, 0.9]].forEach(([dx, dy, dz, r], i) => k.p('plain', leaf(r * s, i + x), [dx * s, dy * s, dz * s], ['#ffbdd3', '#ffc9de', '#ffaecb', '#fbc4e2'][i % 4]));
}
// 분수: 돌 받침 2단(선반 깎기) + 물 원판 + 떨어지는 물막 (물막 무늬는 water.js 가 매 프레임 흘려 줌)
function fountain(k, f, color, water, sheets) {
  const s = f.r / 2.86;
  k.at(f.x, 0, f.z);
  [[[2.45, 0.4], [2.45, 0.6], [2.52, 0.67], [2.72, 0.69], [2.86, 0.62], [2.86, 0.52], [2.78, 0.45], [2.82, 0.08], [2.9, 0]],
    [[0, 0.4], [0.48, 0.4], [0.44, 0.52], [0.29, 0.64], [0.24, 1.15], [0.31, 1.27], [0.3, 1.36], [0, 1.36]],
    [[0, 1.34], [0.5, 1.35], [0.95, 1.48], [1.16, 1.62], [1.19, 1.7], [1.12, 1.73], [1.03, 1.67], [0, 1.62]],
    [[0, 1.6], [0.19, 1.6], [0.14, 1.88], [0.18, 2.06], [0, 2.06]],
    [[0, 2.03], [0.3, 2.05], [0.5, 2.18], [0.56, 2.26], [0.51, 2.29], [0.47, 2.25], [0, 2.21]]].forEach((p) => k.p('stone', lathe(p.map(([r, y]) => [r * s, y * s]), 32), [0, 0, 0], color));
  for (const [r, y] of [[2.47, 0.53], [1.05, 1.68], [0.48, 2.25]]) water.add('w', new THREE.CircleGeometry(r * s, 32).rotateX(-PI / 2), { pos: [f.x, y * s, f.z] });
  sheets.add('w', new THREE.CylinderGeometry(1.18 * s, 1.32 * s, 1.16 * s, 32, 1, true), { pos: [f.x, 1.11 * s, f.z] }).add('w', new THREE.CylinderGeometry(0.55 * s, 0.64 * s, 0.6 * s, 24, 1, true), { pos: [f.x, 1.97 * s, f.z] });
}
// 성모상: 받침 + 파란 겉옷·흰 옷 + 흰 베일 + 금빛 후광, 손 모음
function mary(k, m) {
  k.at(m.x, 0, m.z, -PI / 2 + 0.5); // 마당 쪽(서남쪽)을 봄
  k.p('stone', bx(1.2, 0.35, 1.2, 0.8), [0, 0.17, 0], '#eadbc9').p('stone', bx(0.85, 1.1, 0.85, 0.8), [0, 0.9, 0], '#f1e4d4').p('stone', bx(1.0, 0.16, 1.0, 0.8), [0, 1.52, 0], '#eadbc9');
  const y = 1.6;
  k.p('plain', lathe([[0.36, 0], [0.34, 0.5], [0.27, 1.05], [0.2, 1.28], [0, 1.32]], 16), [0, y, 0], '#f8f6f2'); // 흰 옷
  k.p('plain', lathe([[0.4, 0.02], [0.38, 0.4], [0.3, 1.0], [0.24, 1.3], [0.12, 1.42], [0, 1.44]], 16), [0, y, -0.06], '#7d9ee0', undefined, [1.02, 1, 0.9]); // 파란 겉옷
  k.p('plain', sp(0.15, 12, 10), [0, y + 1.5, 0.03], '#ffe1cf').p('plain', new THREE.SphereGeometry(0.18, 12, 10, 0, PI * 2, 0, PI * 0.6), [0, y + 1.52, -0.01], '#ffffff');
  k.p('plain', lathe([[0, -0.6], [0.28, -0.6], [0.24, -0.35], [0.2, 0]], 12), [0, y + 1.6, -0.03], '#ffffff');
  k.p('plain', sp(0.08, 8, 6), [0, y + 1.1, 0.26], '#ffe1cf', undefined, [0.8, 1.4, 0.6]); // 모은 손
  k.p('shine', new THREE.TorusGeometry(0.24, 0.025, 6, 24), [0, y + 1.62, -0.12], hdr('#ffd76a', 1.2));
}
const extraMats = () => ({
  brick: soft('#ffffff', { vertexColors: true, map: TX.brickTex() }),
  giwa: soft('#ffffff', { vertexColors: true, map: giwaTex(), side: THREE.DoubleSide }),
  under: soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide }),
  dan: soft('#ffffff', { vertexColors: true, map: danTex() }),
  coffer: soft('#ffffff', { vertexColors: true, map: cofferTex(), side: THREE.DoubleSide }),
  stained: nightGlow(new THREE.MeshBasicMaterial({ map: stainedTex(), vertexColors: true, side: THREE.DoubleSide }), 0.95, 1.7, 0.3),
  rose: nightGlow(new THREE.MeshBasicMaterial({ map: roseTex(), vertexColors: true }), 0.95, 1.8, 0.3),
  lattice: nightGlow(new THREE.MeshBasicMaterial({ map: latticeTex(), vertexColors: true, side: THREE.DoubleSide }), 0.9, 1.9, 0.3),
  lotus: nightGlow(new THREE.MeshBasicMaterial({ vertexColors: true }), 1, 1.9, 0.3), // 연꽃 석등: 낮에도 하얀 분홍, 밤엔 환하게
  guard: soft('#ffffff', { vertexColors: true, map: guardTex() }),
  ray: nightGlow(new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffe2a6', transparent: true, opacity: 0.022, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 1, 0.6, 0.5), // 창으로 드는 빛줄기 (가산 블렌딩)
  paver: soft('#ffffff', { vertexColors: true, map: TX.cobbleTex(), polygonOffset: true, polygonOffsetFactor: -1 }), // 분홍 둥근 돌바닥
  hallFloor: soft('#ffffff', { vertexColors: true, map: TX.parquetTex(), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), // 법당 마루 (축대 돌바닥보다 앞에)
  floorLight: nightGlow(new THREE.MeshBasicMaterial({ map: stainedPTex(), vertexColors: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 1, 0.25, 0.5), // 스테인드글라스 빛 무늬 (낮에 진하게)
});
// 사천왕 그림: 붉은 바탕 + 큰 갑옷 인물 실루엣
const guardTex = () => canvasTex('guard', 128, 192, (x, w, h) => {
  x.fillStyle = '#b8392b'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffd25e'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10);
  x.fillStyle = '#2f6c8f'; x.beginPath(); x.moveTo(w * 0.2, h * 0.92); x.lineTo(w * 0.3, h * 0.38); x.lineTo(w * 0.7, h * 0.38); x.lineTo(w * 0.8, h * 0.92); x.fill();
  x.fillStyle = '#3f8f73'; x.fillRect(w * 0.28, h * 0.45, w * 0.44, h * 0.16); x.fillStyle = '#ffd25e'; x.fillRect(w * 0.27, h * 0.6, w * 0.46, 6);
  x.fillStyle = '#f2c49a'; x.beginPath(); x.arc(w / 2, h * 0.28, w * 0.13, 0, 7); x.fill(); x.fillStyle = '#ffd25e'; x.beginPath(); x.moveTo(w * 0.36, h * 0.18); x.lineTo(w / 2, h * 0.07); x.lineTo(w * 0.64, h * 0.18); x.fill();
  x.fillStyle = '#222'; x.fillRect(w * 0.43, h * 0.26, 4, 4); x.fillRect(w * 0.55, h * 0.26, 4, 4); x.strokeStyle = '#e8b84a'; x.lineWidth = 5; x.beginPath(); x.moveTo(w * 0.78, h * 0.15); x.lineTo(w * 0.7, h * 0.7); x.stroke();
});

/* ───── 성당: 모래빛 고딕 쌍탑 + 장미창 + 뾰족 아치 대문 (그림 3) ───── */
const SAND = '#f7e2cf', SAND2 = '#ecd0b8', TRIM = '#fbefe2', PURP = '#76618f', GOLD = '#f2c35a';
const BELL_PIVOT = 2.25; // 범종 고리 높이 (범종각 단 위)
const S = 1 / 3; // 사람 크기 = 설계도의 1/3 (설계도는 3배로 커짐)
export function pewRow(k, p, F, wood) { // 사람 크기 긴 의자: 앉는 판(0.45m) + 등받이 + 양 끝 판 + 가운데 받침
  k.at(p.x, F, p.z).p('wood', bx(p.w, 0.07 * S, 0.46 * S), [0, 0.45 * S, 0], wood).p('wood', bx(p.w, 0.5 * S, 0.06 * S), [0, 0.8 * S, 0.17], wood, [-0.1, 0, 0]);
  for (const s of [-1, 0, 1]) k.p('wood', bx(0.07 * S, (s ? 0.95 : 0.45) * S, 0.62 * S), [s * p.w / 2, (s ? 0.47 : 0.22) * S, 0.05], wood);
}
function cathedral(ex, k) {
  const b = DB.cathedral, C = SP.cathedral, F = b.fy, H = b.h, x0 = b.cx - b.w / 2, x1 = b.cx + b.w / 2, z0 = b.cz - b.d / 2, z1 = b.cz + b.d / 2;
  // 벽 (충돌 벽과 같은 자리) + 문 위 + 바닥 단 + 기단 띠
  for (const [a0, c0, a1, c1] of wallRects(b)) ex.at((a0 + a1) / 2, H / 2, (c0 + c1) / 2).p('stone', bx(a1 - a0, H, c1 - c0, 1.2), [0, 0, 0], SAND);
  ex.at(b.cx, (F + 2.9 + H) / 2, z1).p('stone', bx(b.dw, H - F - 2.9, 0.4, 1.4), [0, 0, 0], SAND);
  ex.at(b.cx, F / 2, b.cz).p('stone', bx(b.w - 0.3, F, b.d - 0.3, 1.0), [0, 0, 0], '#fbebd9');
  for (const side of ['-x', '+x', '-z']) face(ex, b, side, side[1] === 'x' ? b.cz : b.cx, F / 2 + 0.1).p('stone', bx(side[1] === 'x' ? b.d + 0.2 : b.w + 0.2, F + 0.2, 0.16, 0.9), [0, 0, 0.04], SAND2);
  // 옆벽: 버팀벽 + 뾰족 스테인드글라스 창 (안팎)
  for (const side of ['-x', '+x']) {
    for (let z = z0 + 1.0; z <= z1 - 0.8; z += 2.5) { // 버팀벽(층층이 좁아짐) + 작은 첨탑 + 바깥 기둥에서 날아오는 부벽(플라잉 버트레스)
      face(ex, b, side, z, 0, true).p('stone', bx(0.6, H - 3, 0.6, 1), [0, (H - 3) / 2, 0.25], SAND2).p('stone', bx(0.48, 2.2, 0.45, 1), [0, H - 1.9, 0.18], SAND2).p('stone', coneRoof(0.34, 1.6), [0, H + 0.6, 0.18], TRIM).p('shine', sp(0.06, 6, 4), [0, H + 1.45, 0.18], GOLD);
      ex.p('stone', bx(0.55, H - 1.5, 0.55, 1), [0, (H - 1.5) / 2, 2.0], SAND2).p('stone', coneRoof(0.32, 1.5), [0, H - 0.75, 2.0], TRIM);
      ex.p('stone', new THREE.TorusGeometry(1.5, 0.12, 6, 12, PI / 2), [0, H - 2.9, 0.5], TRIM, [0, -PI / 2, 0]);
    }
    for (let z = z0 + 2.25; z < z1 - 1.5; z += 2.5) {
      face(ex, b, side, z, F + 1.6, true).p('stone', ring(lancetShape, 1.2, 3.6, 0.95, 3.35), [0, -0.12, 0.03], TRIM).p('stained', lancet(0.95, 3.35), [0, 0, 0.02], '#ffffff').p('stone', bx(0.06, 2.8, 0.04), [0, 1.4, 0.05], TRIM);
      face(k, b, side, z, F + 1.6, false).p('stained', lancet(0.95, 3.35), [0, 0, 0.03], '#ffffff').p('plain', ring(lancetShape, 1.15, 3.55, 0.95, 3.35), [0, -0.1, 0.04], TRIM); // 측랑 창 (그림처럼 작게)
    }
  }
  // 앞면: 뾰족 아치 대문 (테두리 3겹 + 문 위 팀파눔) + 장미창 + 작은 뾰족창 + 박공 + 십자가
  ex.at(b.cx, F, z1 + 0.2);
  [[5.0, 5.3, 4.4, 5.0, TRIM], [4.4, 5.0, 3.7, 4.6, SAND2], [3.7, 4.6, 3.1, 4.25, TRIM], [3.1, 4.25, 2.62, 3.95, SAND2]].forEach(([wo, ho, wi, hi, c], i) => ex.p('stone', ring(lancetShape, wo, ho, wi, hi), [0, 0, 0.02 + i * 0.07], c)); // 4겹 뾰족 아치 (안으로 깊어짐)
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) ex.p('stone', cy(0.12, 0.12, 2.9, 8), [s * (1.42 + i * 0.3), 1.45, 0.2 - i * 0.05], i % 2 ? TRIM : SAND2); // 문설주 작은 기둥들
  ex.p('stone', fitUV(new THREE.ShapeGeometry(lancetShape(2.62, 1.05))), [0, 2.9, 0.08], SAND2);
  cross(ex, 'shine', 3.0, 0.55, GOLD);
  for (const s of [-1, 1]) { ex.p('wood', bx(0.08, 2.85, 1.25, 0.6), [s * (b.dw / 2 - 0.06), 1.43, -0.85], '#8a5234'); for (const y of [0.6, 1.5, 2.4]) ex.p('shine', bx(0.03, 0.06, 1.1), [s * (b.dw / 2 - 0.12), y, -0.85], '#c9a066'); }
  for (const s of [-1, 1]) { ex.p('stone', ring(lancetShape, 1.05, 2.9, 0.8, 2.65), [s * 3.1, 0.9, 0.03], TRIM).p('stained', lancet(0.8, 2.65), [s * 3.1, 0.9, 0.02], '#ffffff'); }
  for (const s of [-1, 1]) for (const x of [2.3, 4.1]) ex.p('stone', bx(0.45, H - F + 0.6, 0.35, 1), [s * x, (H - F + 0.6) / 2 - 0.3, 0.1], SAND2).p('stone', coneRoof(0.3, 1.3), [s * x, H - F + 0.95, 0.1], TRIM);
  const RY = 7.45; // 큰 장미창 높이(바닥 기준)
  ex.p('stone', new THREE.TorusGeometry(1.95, 0.24, 8, 40), [0, RY, 0.08], TRIM).p('stone', new THREE.TorusGeometry(2.25, 0.1, 6, 40), [0, RY, 0.06], SAND2).p('rose', fitUV(new THREE.CircleGeometry(1.9, 40)), [0, RY, 0.05], '#ffffff');
  for (let i = 0; i < 9; i++) ex.p('stone', ring(lancetShape, 0.5, 1.15, 0.32, 0.95), [-2.6 + i * 0.65, 5.35, 0.05], TRIM); // 장미창 아래 작은 아치 줄
  ex.at(b.cx, H, z1 + 0.05).p('stone', tri(b.w + 0.2, 4.4), [0, 0, 0], SAND).p('stone', bx(b.w + 0.3, 0.25, 0.4), [0, 0, 0.05], TRIM);
  { const ga = Math.atan2(4.4, b.w / 2 + 0.1), gl = Math.hypot(4.4, b.w / 2 + 0.1); for (const sg of [-1, 1]) ex.p('stone', bx(gl + 0.3, 0.32, 0.7), [sg * (b.w / 2 + 0.1) / 2, 2.2 + 0.1, 0.15], TRIM, [0, 0, -sg * ga]); } // 박공 가장자리 크림 돌 (보라 지붕 끝을 가림)
  for (let i = 0; i <= 10; i++) { const t = i / 10; for (const s of [-1, 1]) ex.p('stone', new THREE.ConeGeometry(0.1, 0.36, 5), [s * (b.w / 2 + 0.1) * (1 - t), 4.4 * t + 0.25, 0.15], TRIM); }
  for (const x of [-0.75, 0, 0.75]) ex.p('stained', lancet(0.5, x ? 1.3 : 1.7), [x, 0.8, 0.12], '#ffffff'); cross(ex, 'shine', 3.6, 1.4, GOLD); // 박공 세 쌍 창 + 십자가
  // 지붕(보라 박공, 용마루는 z 방향) + 뒤 박공
  const hs = b.w / 2 + 0.5, rh = 4.4, th = Math.atan2(rh, hs), L = Math.hypot(hs, rh) + 0.15;
  ex.at(b.cx, H, b.cz);
  for (const s of [-1, 1]) ex.p('roof', bx(L, 0.22, b.d + 0.5, 1.2), [s * hs / 2, rh / 2 + 0.1, 0], PURP, [0, 0, -s * th]);
  ex.p('plain', bx(0.25, 0.25, b.d + 0.5), [0, rh + 0.2, 0], '#5d4b73');
  for (let z = -b.d / 2 + 1; z < b.d / 2; z += 1.6) ex.p('shine', coneRoof(0.07, 0.5), [0, rh + 0.5, z], GOLD); // 용마루 장식
  ex.at(b.cx, H, z0 - 0.05, PI).p('stone', tri(b.w + 0.2, 4.4), [0, 0, 0], SAND);
  // 쌍탑: 몸체·모서리 띠·창·종루(금빛 종)·네 귀 작은 첨탑·보라 첨탑·금 십자가
  for (const [tx0, tz0, tx1, tz1] of C.towers) {
    const tw = tx1 - tx0, td = tz1 - tz0, tcx = (tx0 + tx1) / 2, tcz = (tz0 + tz1) / 2, TH = 13.5;
    ex.at(tcx, 0, tcz).p('stone', bx(tw, TH, td, 1.2), [0, TH / 2, 0], SAND);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ex.p('stone', bx(0.42, TH - 2, 0.42, 1), [sx * (tw / 2 + 0.02), (TH - 2) / 2, sz * (td / 2 + 0.02)], SAND2).p('stone', bx(0.3, 2, 0.3, 1), [sx * (tw / 2 - 0.02), TH - 1, sz * (td / 2 - 0.02)], SAND2); }
    for (const y of [F, 4.6, 8.4, 10.6, TH]) ex.p('stone', bx(tw + 0.3, 0.26, td + 0.3, 1), [0, y, 0], TRIM);
    for (const [ry, dd] of [[0, td / 2], [tx0 < b.cx ? -PI / 2 : PI / 2, tw / 2]]) { // 앞면 + 바깥 옆면
      ex.at(tcx, 0, tcz, ry).sub(0, 0, dd + 0.02);
      ex.p('stone', ring(lancetShape, 1.0, 2.4, 0.75, 2.2), [0, 1.9, 0.01], TRIM).p('stained', lancet(0.75, 2.2), [0, 1.9, 0], '#ffffff');
      ex.p('stone', ring(lancetShape, 1.3, 3.2, 1.0, 2.9), [0, 5.1, 0.01], TRIM).p('stained', lancet(1.0, 2.9), [0, 5.1, 0], '#ffffff');
      for (const x of [-0.9, 0.9]) ex.p('stone', ring(lancetShape, 0.5, 1.5, 0.32, 1.3), [x, 8.8, 0.01], TRIM); // 막힌 아치 장식
      ex.p('stone', ring(lancetShape, 1.9, 2.8, 1.45, 2.55), [0, 10.75, 0.01], TRIM).p('plain', lancet(1.45, 2.55), [0, 10.75, 0], '#5a4860');
      bell(ex, 'shine', 11.1, 1.6, hdr(GOLD, 1.05)); // 종 (창 앞쪽에 살짝 나와 보이게)
    }
    ex.at(tcx, TH, tcz);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ex.p('stone', coneRoof(0.3, 2.6), [sx * (tw / 2 - 0.05), 1.3, sz * (td / 2 - 0.05)], TRIM).p('shine', sp(0.08, 6, 4), [sx * (tw / 2 - 0.05), 2.7, sz * (td / 2 - 0.05)], GOLD);
    ex.p('roof', coneRoof(Math.max(tw, td) * 0.6, 6.4), [0, 3.2, 0], PURP);
    for (let i = 0; i < 4; i++) ex.p('stone', coneRoof(0.18, 0.7), [Math.sin(i * PI / 2) * 0.75, 2.2, Math.cos(i * PI / 2) * 0.75], TRIM); // 첨탑 지붕창
    ex.p('shine', sp(0.14, 8, 6), [0, 6.45, 0], GOLD); cross(ex, 'shine', 6.5, 1.4, GOLD);
  }
  // 돌계단 6단 + 난간 담 (위에 꽃) + 성모상 + 분수 + 꽃밭 + 벚나무
  const [sx0, sz0, sx1, sz1] = C.stairs;
  for (let j = 0; j < 6; j++) { const zz = sz1 - 0.45 * j; ex.at((sx0 + sx1) / 2, 0, (sz0 + zz) / 2).p('stone', bx(sx1 - sx0, 0.15 * (j + 1), zz - sz0, 1), [0, 0.075 * (j + 1), 0], j % 2 ? '#f3e4d4' : '#ead8c5'); }
  for (const [a0, c0, a1, c1] of C.planters) {
    ex.at((a0 + a1) / 2, 0, (c0 + c1) / 2).p('stone', bx(a1 - a0, 1.0, c1 - c0, 1), [0, 0.5, 0], SAND).p('stone', bx(a1 - a0 + 0.12, 0.12, c1 - c0 + 0.12), [0, 1.04, 0], TRIM);
    for (const zz of [c1 - 0.1]) ex.p('stone', bx(0.36, 1.35, 0.36, 1), [(a0 < b.cx ? 1 : -1) * ((a1 - a0) / 2 - 0.15), 0.67, zz - (c0 + c1) / 2], TRIM).p('stone', sp(0.2, 10, 8), [(a0 < b.cx ? 1 : -1) * ((a1 - a0) / 2 - 0.15), 1.5, zz - (c0 + c1) / 2], TRIM);
    flowers(ex, a0 + 0.2, c0 + 0.2, a1 - 0.2, c1 - 0.3, 1.0, 26, a0);
  }
  mary(ex, C.mary);
  flowers(ex, C.mary.x - 1.6, C.mary.z - 1.6, C.mary.x + 1.6, C.mary.z + 1.6, 0, 26, 5);
  for (const [zz, xa, xb] of [[z1 + 0.6, -43.6, -41.2], [z1 + 0.6, -31.8, -29.4]]) flowers(ex, xa, zz, xb, zz + 1.2, 0, 22, xa);
  cathedralIn(k, b, C); // 실내: interiors.js (그림 interior-2)
}
// 안쪽 벽 띠: 문 자리(높이 top 까지)는 비움 (buildings.js 의 bands 는 문 높이가 2.7 로 고정이라 따로)
export function inBands(k, b, y0, y1, key, color, top) {
  for (const side of ['-z', '+z', '-x', '+x']) {
    const alongX = side[1] === 'z', c = alongX ? b.cx : b.cz, half = (alongX ? b.w : b.d) / 2 - 0.2;
    const door = side === b.door, spans = door && y0 < top ? [[c - half, c - b.dw / 2], [c + b.dw / 2, c + half]] : [[c - half, c + half]];
    for (const [a0, a1] of spans) face(k, b, side, (a0 + a1) / 2, (y0 + y1) / 2, false).p(key, plane(a1 - a0, y1 - y0, 1.1), [0, 0, 0.012], color);
    if (door && y0 < top && y1 > top) face(k, b, side, c, (top + y1) / 2, false).p(key, plane(b.dw, y1 - top, 1.1), [0, 0, 0.012], color);
  }
}

/* ───── 교회: 크림 회벽 + 붉은 벽돌 + 주황 기와 + 오른쪽 종탑 + 큰 아치창 (그림 1) ───── */
const CREAM = '#fff5e8', BRICK = '#e9a28c', TILE = '#e06b45', RAFT = '#8a5a3c';
function church(ex, k) {
  const b = DB.church, C = SP.church, F = b.fy, H = b.h, x0 = b.cx - b.w / 2, x1 = b.cx + b.w / 2, z0 = b.cz - b.d / 2, z1 = b.cz + b.d / 2;
  for (const [a0, c0, a1, c1] of wallRects(b)) ex.at((a0 + a1) / 2, H / 2, (c0 + c1) / 2).p('stucco', bx(a1 - a0, H, c1 - c0, 1.6), [0, 0, 0], CREAM);
  ex.at(b.cx, F / 2, b.cz).p('wood', bx(b.w - 0.3, F, b.d - 0.3, 1.0), [0, 0, 0], '#d9b48a');
  for (const side of ['-x', '+x', '-z']) face(ex, b, side, side[1] === 'x' ? b.cz : b.cx, (F + 0.4) / 2).p('brick', bx(side[1] === 'x' ? b.d + 0.2 : b.w + 0.2, F + 0.4, 0.14, 1), [0, 0, 0.04], BRICK);
  // 옆벽 아치창 (안팎) + 서까래 끝
  for (const side of ['-x', '+x']) {
    for (let z = z0 + 2.2; z < z1 - 1.4; z += 2.8) {
      face(ex, b, side, z, F + 1.5, true).p('plain', ring(archShape, 1.3, 2.75, 1.0, 2.45), [0, -0.15, 0.03], '#fff8ee').p('win', arch(1.0, 2.45), [0, 0, 0.02], hdr('#ffe2a0', 1.05)).p('plain', bx(0.05, 2.4, 0.04), [0, 1.2, 0.04], '#fff8ee');
      face(k, b, side, z, F + 1.5, false).p('winIn', arch(1.0, 2.45), [0, 0, 0.03], hdr('#ffd1d6', 1.1)).p('plain', ring(archShape, 1.25, 2.7, 1.0, 2.45), [0, -0.12, 0.04], '#fff8ee');
      face(ex, b, side, z, 0, true).p('brick', bx(0.5, H - 0.4, 0.3, 1), [1.4, (H - 0.4) / 2, 0.12], BRICK); // 벽돌 기둥으로 면을 나눔
    }
    for (let z = z0; z <= z1 + 0.01; z += 0.9) face(ex, b, side, z, H - 0.05).p('wood', bx(0.12, 0.16, 0.8, 0.6), [0, 0, 0.35], RAFT);
  }
  // 앞면: 벽돌 기둥 두 개 + 큰 아치창(빛남, 창살) + 크림 아치 문틀 + 나무 문 + 박공 + 서까래 까치발
  ex.at(b.cx, 0, z1 + 0.2);
  for (const s of [-1, 1]) ex.p('brick', bx(0.9, H + 1.6, 0.3, 1), [s * 2.6, (H + 1.6) / 2, 0.1], BRICK).p('stucco', bx(1.0, 0.25, 0.38), [s * 2.6, H + 1.6, 0.1], CREAM);
  ex.p('brick', ring(archShape, 4.0, 6.0, 3.0, 5.4), [0, F + 3.3, 0.12], BRICK);
  ex.p('win', arch(3.0, 5.4), [0, F + 3.3, 0.08], hdr('#ffdf95', 1.12));
  for (const sx of [-1, 1]) { ex.p('win', arch(0.9, 3.0), [sx * 4.4, F + 1.6, 0.08], hdr('#ffdf95', 1.1)).p('stucco', ring(archShape, 1.15, 3.2, 0.9, 3.0), [sx * 4.4, F + 1.5, 0.1], '#fff8ee').p('stucco', bx(0.05, 2.9, 0.04), [sx * 4.4, F + 3.0, 0.11], '#fff8ee'); ex.p('glow', cy(0.08, 0.06, 0.2, 8), [sx * 1.75, F + 2.5, 0.25], hdr('#ffd98a', 2)); } // 그림처럼 큰 창 양옆 아치창 + 문 옆 벽등
  for (const xx of [-0.75, 0, 0.75]) ex.p('plain', bx(0.07, 5.3, 0.05), [xx, F + 3.3 + 2.65, 0.11], '#fff3e0');
  for (const yy of [1.4, 2.9]) ex.p('plain', bx(3.0, 0.07, 0.05), [0, F + 3.3 + yy, 0.11], '#fff3e0');
  ex.p('plain', new THREE.TorusGeometry(0.75, 0.04, 6, 20, PI), [0, F + 3.3 + 4.65, 0.11], '#fff3e0');
  ex.p('stucco', bx(3.4, 0.25, 0.3), [0, F + 3.2, 0.12], CREAM);
  ex.p('stucco', ring(archShape, 3.3, 3.55, 2.4, 3.1), [0, F, 0.12], '#fff8ee').p('brick', ring(archShape, 3.9, 3.85, 3.3, 3.55), [0, F, 0.1], BRICK);
  for (const s of [-1, 1]) { ex.p('wood', bx(0.08, 2.9, 1.15, 0.6), [s * (b.dw / 2 - 0.06), F + 1.45, -0.8], '#9a5a2a'); ex.p('shine', sp(0.05, 6, 4), [s * (b.dw / 2 - 0.15), F + 1.4, -0.3], '#ffd45a'); }
  ex.at(b.cx, (F + 2.9 + H) / 2, z1).p('stucco', bx(b.dw, H - F - 2.9, 0.4, 1.6), [0, 0, 0], CREAM); // 문 위 벽
  const hs = b.w / 2 + 0.9, rh = 4.4, th = Math.atan2(rh, hs), L = Math.hypot(hs, rh) + 0.15;
  ex.at(b.cx, H, z1 + 0.05).p('stucco', tri(b.w, rh * (b.w / 2) / hs), [0, 0, 0], CREAM);
  ex.at(b.cx, H, b.cz);
  for (const s of [-1, 1]) {
    ex.p('roof', bx(L, 0.24, b.d + 1.8, 1.4), [s * hs / 2, rh / 2 + 0.1, 0.4], TILE, [0, 0, -s * th]);
    ex.p('plain', bx(L, 0.1, 0.12), [s * hs / 2, rh / 2 - 0.06, b.d / 2 + 1.28], '#fff3e0', [0, 0, -s * th]);
    for (let i = 1; i < 6; i++) { const t = i / 6; ex.p('wood', bx(0.14, 0.4, 0.14, 0.6), [s * hs * (1 - t) * 0.95, rh * t - 0.2, b.d / 2 + 0.9], RAFT, [0, 0, s * 0.5]); }
  }
  ex.p('roof', bx(0.3, 0.3, b.d + 1.8, 1), [0, rh + 0.2, 0.4], '#c4553e');
  ex.at(b.cx, H, z0 - 0.05, PI).p('stucco', tri(b.w, rh * (b.w / 2) / hs), [0, 0, 0], CREAM);
  // 종탑: 벽돌 몸통 + 작은 아치창 + 크림 띠 + 종루(아치 4면 + 금빛 종) + 주황 사각 지붕 + 금 십자가
  { const [tx0, tz0, tx1, tz1] = C.tower, tw = tx1 - tx0, td = tz1 - tz0, tcx = (tx0 + tx1) / 2, tcz = (tz0 + tz1) / 2;
    ex.at(tcx, 0, tcz).p('brick', bx(tw, 9.6, td, 1), [0, 4.8, 0], BRICK);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ex.p('brick', bx(0.35, 9.6, 0.35, 1), [sx * (tw / 2 + 0.05), 4.8, sz * (td / 2 + 0.05)], '#d98a72'); // 모서리 벽돌 기둥
    for (const y of [0.25, 3.6, 6.6, 9.6]) ex.p('stucco', bx(tw + 0.3, y === 9.6 ? 0.45 : 0.22, td + 0.3), [0, y, 0], CREAM);
    ex.p('stucco', bx(tw - 0.1, 3.2, td - 0.1, 1), [0, 11.4, 0], CREAM).p('stucco', bx(tw + 0.4, 0.35, td + 0.4), [0, 13.1, 0], CREAM);
    for (const [ry, dd] of [[0, td / 2], [PI / 2, tw / 2], [-PI / 2, tw / 2], [PI, td / 2]]) {
      ex.at(tcx, 0, tcz, ry).sub(0, 0, dd - 0.03);
      ex.p('plain', arch(1.6, 2.5), [0, 10.05, 0.02], '#6a4a3c').p('stucco', ring(archShape, 2.0, 2.7, 1.6, 2.5), [0, 9.95, 0.03], '#fff8ee');
      bell(ex, 'shine', 10.5, 1.45, hdr(GOLD, 1.05));
      for (const y of [2.4, 5.4]) ex.p('stucco', ring(archShape, 0.85, 1.7, 0.6, 1.5), [0, y - 0.1, 0.06], '#fff8ee').p('win', arch(0.6, 1.5), [0, y, 0.05], hdr('#ffe2a0', 1.05));
    }
    ex.at(tcx, 13.25, tcz).p('roof', coneRoof(Math.max(tw, td) * 0.8, 3.4), [0, 1.7, 0], TILE);
    ex.p('shine', sp(0.12, 8, 6), [0, 3.45, 0], GOLD); cross(ex, 'shine', 3.5, 1.4, GOLD);
  }
  // 날개채: 양옆으로 뻗은 낮은 회벽 + 벽돌 기단 + 주황 박공지붕(용마루는 x 방향) + 앞쪽 아치 회랑(크림 기둥 줄) + 빛나는 창
  for (const [wx0, wz0, wx1, wz1] of [C.wingW, C.wingE]) {
    const ww = wx1 - wx0, wd = wz1 - wz0, wcx = (wx0 + wx1) / 2, WH = 3.4, PD = 1.3, W2 = 2.6; // PD = 회랑 깊이, W2 = 2층 높이 (그림처럼 2층 날개채)
    ex.at(wcx, 0, (wz0 + wz1 - PD) / 2).p('stucco', bx(ww, WH, wd - PD, 1.6), [0, WH / 2, 0], CREAM).p('brick', bx(ww + 0.1, 0.7, wd - PD + 0.1, 1), [0, 0.35, 0], BRICK);
    ex.at(wcx, 0, wz1 - PD / 2).p('stone', bx(ww, 0.25, PD, 1), [0, 0.12, 0], '#efe2d4').p('stucco', bx(ww, 0.9, PD + 0.1, 1.6), [0, WH - 0.45, 0], CREAM);
    const nc = Math.max(3, Math.round(ww / 1.1)), st = (ww - 0.4) / (nc - 1);
    for (let i = 0; i < nc; i++) {
      const x = -ww / 2 + 0.2 + i * st;
      ex.at(wcx + x, 0, wz1 - 0.25).p('stucco', cy(0.14, 0.17, WH - 0.9, 10), [0, (WH - 0.9) / 2, 0], '#fff8ee').p('stucco', bx(0.36, 0.16, 0.36), [0, WH - 0.95, 0], '#fff8ee');
      if (i < nc - 1) { ex.at(wcx + x + st / 2, 0, wz1 + 0.02).p('stucco', ring(archShape, st, WH - 0.7, st - 0.3, WH - 1.1), [0, 0.25, 0], '#fff8ee'); ex.at(wcx + x + st / 2, 0, wz1 - PD - 0.01).p('win', arch(st * 0.55, 1.7), [0, 0.9, 0], hdr('#ffe2a0', 1.05)); }
    }
    ex.at(wcx, WH, (wz0 + wz1) / 2).p('stucco', bx(ww, W2, wd, 1.6), [0, W2 / 2, 0], CREAM).p('roof', bx(ww + 0.4, 0.16, 0.7, 1.4), [0, -0.1, wd / 2 + 0.2], TILE, [0.35, 0, 0]); // 2층 몸 + 1층 회랑 위 작은 처마
    const n2 = Math.max(3, Math.round(ww / 1.0));
    for (let i = 0; i < n2; i++) { const x = wcx - ww / 2 + (i + 0.5) * ww / n2; ex.at(x, WH + W2 / 2 - 0.05, wz1 + 0.02).p('win', plane(0.5, 0.8), [0, 0, 0], hdr('#ffe2a0', 1.1)).p('plain', bx(0.62, 0.92, 0.03), [0, 0, -0.02], '#fff8ee'); } // 2층 노란 창 줄
    const WT = WH + W2, whs = wd / 2 + 0.5, wth = Math.atan2(1.6, whs), wL = Math.hypot(whs, 1.6) + 0.1;
    ex.at(wcx, WT, (wz0 + wz1) / 2);
    for (const s of [-1, 1]) ex.p('roof', bx(ww + 0.6, 0.2, wL, 1.4), [0, 0.85, s * whs / 2], TILE, [s * wth, 0, 0]);
    for (const s of [-1, 1]) ex.at(s < 0 ? wx0 - 0.02 : wx1 + 0.02, WT, (wz0 + wz1) / 2, s * PI / 2).p('stucco', tri(wd, 1.6 * (wd / 2) / whs), [0, 0, 0], CREAM);
  }
  // 돌계단 + 벽돌 화단(꽃) + 분수 쪽 꽃밭
  const [sx0, sz0, sx1, sz1] = C.stairs;
  for (let j = 0; j < 6; j++) { const zz = sz1 - (sz1 - sz0) / 6 * j; ex.at((sx0 + sx1) / 2, 0, (sz0 + zz) / 2).p('stone', bx(sx1 - sx0, 0.15 * (j + 1), zz - sz0, 1), [0, 0.075 * (j + 1), 0], j % 2 ? '#f6ece2' : '#ecdccc'); }
  for (const [a0, c0, a1, c1] of C.rails) {
    ex.at((a0 + a1) / 2, 0, (c0 + c1) / 2).p('brick', bx(a1 - a0, 1.05, c1 - c0, 1), [0, 0.52, 0], BRICK).p('stucco', bx(a1 - a0 + 0.1, 0.1, c1 - c0 + 0.1), [0, 1.08, 0], CREAM);
    flowers(ex, a0 + 0.1, c0 + 0.1, a1 - 0.1, c1 - 0.1, 1.05, 14, a1);
  }
  for (const [xa, xb] of [[30.9, 33.6], [40.3, 43.2]]) { ex.at(0, 0, 0).p('brick', bx(xb - xa, 0.35, 1.4, 1), [(xa + xb) / 2, 0.17, z1 + 1.0], BRICK); flowers(ex, xa + 0.1, z1 + 0.4, xb - 0.1, z1 + 1.6, 0.3, 24, xa); }
  churchIn(k, b, C); // 실내: interiors.js (그림 interior-1)
}

/* ───── 사찰: 축대 위 법당(팔작지붕·단청·붉은 기둥·꽃살문·금빛 불상) + 3층 석탑 + 연꽃 석등 + 범종각 + 양옆 전각 (그림 2) ───── */
const RED = '#b8392b', PLAST = '#f4e8d4', STONE = '#d9cbc0', PAVE = '#efc9c2';
// 팔작지붕(근사): 앞뒤 사다리꼴 + 양옆 삼각 경사, 처마 가운데는 오목, 네 귀는 위로 들림. 기와 윗면 + 단청 밑면 + 처마 끝 띠
function roof(ex, x, y, z, ry, W, D, H, lift = 0.9, rafters = true) {
  const Lr = Math.max(W - D, W * 0.3) / 2, nu = 14, nv = 6, top = [], und = [], edge = [], rafterCol = [];
  const faces = [[(u) => [u * W / 2, D / 2], (u) => [u * Lr, 0]], [(u) => [-u * W / 2, -D / 2], (u) => [-u * Lr, 0]], [(u) => [W / 2, -u * D / 2], () => [Lr, 0]], [(u) => [-W / 2, u * D / 2], () => [-Lr, 0]]];
  const at = (e, r, u, v) => { const [ex0, ez0] = e(u), [rx, rz] = r(u); return [ex0 + (rx - ex0) * v, H * Math.pow(v, 1.45) + lift * Math.pow(Math.abs(u), 3) * (1 - v) * (1 - v), ez0 + (rz - ez0) * v]; };
  for (const [e, r] of faces) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = -1 + (2 * i) / nu, v = j / nv, p = at(e, r, u, v); pos.push(...p); uv.push(u * W / 2.4, v * 3); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, c = a + nu + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    top.push(g); und.push(g.clone().translate(0, -0.28, 0));
    const ep = [], ei = [];
    for (let i = 0; i <= nu; i++) { const p = at(e, r, -1 + (2 * i) / nu, 0); ep.push(p[0], p[1], p[2], p[0], p[1] - 0.3, p[2]); if (i < nu) ei.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3)); eg.setIndex(ei); eg.computeVertexNormals(); edge.push(eg);
    if (rafters) for (let i = 1; i < nu; i++) { const p = at(e, r, -1 + (2 * i) / nu, 0), q = at(e, r, -1 + (2 * i) / nu, 0.12); for (const [t, dy, c] of [[0, -0.42, '#3f8f73'], [0.45, -0.62, '#2f6c8f']]) { edge.push(place(new THREE.BoxGeometry(0.16, 0.16, 0.16), { pos: [p[0] + (q[0] - p[0]) * t, p[1] + dy, p[2] + (q[2] - p[2]) * t] })); rafterCol.push(c); } } // 겹처마 서까래 끝 두 줄
  }
  ex.at(x, y, z, ry);
  for (const g of top) ex.p('giwa', g, [0, 0, 0], '#ffffff');
  for (const g of und) ex.p('under', g, [0, 0, 0], '#4f9478');
  edge.forEach((g, i) => ex.p('plain', g, [0, 0, 0], i < 4 ? '#efe4e6' : rafterCol[i - 4] ?? '#3f8f73'));
  ex.p('plain', bx(Lr * 2 + 0.6, 0.42, 0.5), [0, H + 0.12, 0], '#4a4256'); // 용마루
  for (const s of [-1, 1]) {
    ex.p('plain', bx(0.4, 0.75, 0.55), [s * (Lr + 0.3), H + 0.4, 0], '#4a4256', [0, 0, s * 0.35]); // 취두
    ex.p('under', tri(D * 0.42, H * 0.42), [s * (Lr - 0.05), H * 0.55, 0], '#8a3d2e', [0, s * PI / 2, 0]); // 합각(옆 박공)
  }
}
// 단청 기둥 칸: 기둥 + 창방(단청 띠) + 공포(초록·주홍 블록). w,d = 몸체, y0 = 바닥, ph = 기둥 높이, cols = 앞면 기둥 x (몸체 중심 기준)
function frame(ex, cx, y0, cz, ry, w, d, ph, cols, mid = true, pr = 0.22) {
  ex.at(cx, y0, cz, ry);
  const posts = [...cols.map((x) => [x, d / 2]), ...cols.map((x) => [x, -d / 2]), ...(mid ? [[-w / 2, 0], [w / 2, 0]] : [])];
  for (const [px, pz] of posts) ex.p('plain', cy(pr, pr + 0.03, ph, 12), [px, ph / 2, pz], RED).p('stone', cy(pr + 0.12, pr + 0.16, 0.22, 8), [px, 0.11, pz], STONE);
  for (const [len, px, pz, nx, nz] of [[w + 0.4, 0, d / 2, 0, 1], [w + 0.4, 0, -d / 2, 0, -1], [d + 0.4, w / 2, 0, 1, 0], [d + 0.4, -w / 2, 0, -1, 0]]) {
    const ax = nz !== 0; // 이 면이 x 방향으로 길면 true
    ex.p('plain', bx(ax ? len : 0.5, 0.5, ax ? 0.5 : len), [px, ph + 0.25, pz], '#3f8f73');
    ex.p('dan', plane(len, 0.5, 0, [0, 0, len / 3, 1]), [px + nx * 0.26, ph + 0.25, pz + nz * 0.26], '#ffffff', [0, Math.atan2(nx, nz), 0]);
    const n = Math.round(len / 0.75);
    for (let i = 0; i <= n; i++) { const t = -len / 2 + (i * len) / n, qx = ax ? t : px, qz = ax ? pz : t; ex.p('plain', bx(0.34, 0.3, 0.34), [qx, ph + 0.66, qz], i % 2 ? '#3f8f73' : '#2f6c8f').p('plain', bx(0.4, 0.08, 0.4), [qx, ph + 0.85, qz], '#c64b36').p('plain', sp(0.06, 6, 4), [qx + nx * 0.2, ph + 0.62, qz + nz * 0.2], '#ffd25e'); }
  }
}
// 연꽃 석등: 네모 돌기둥 + 빛나는 연꽃 (그림 2 앞마당 4개)
function lotusLamp(ex, x, z, y = 0) {
  ex.at(x, y, z).p('stone', bx(0.75, 0.18, 0.75, 0.8), [0, 0.09, 0], STONE).p('stone', bx(0.5, 0.8, 0.5, 0.8), [0, 0.58, 0], '#e6dbd1').p('stone', bx(0.72, 0.14, 0.72, 0.8), [0, 1.04, 0], STONE);
  ex.p('plain', cy(0.32, 0.22, 0.12, 12), [0, 1.17, 0], '#e8a35a');
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; ex.p('lotus', sp(0.2, 8, 6), [Math.cos(a) * 0.28, 1.4, Math.sin(a) * 0.28], hdr('#ffd6e2', 1.05), [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55], [0.55, 1.25, 0.32]); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; ex.p('lotus', sp(0.15, 8, 6), [Math.cos(a) * 0.13, 1.5, Math.sin(a) * 0.13], hdr('#fff3dc', 1.1), undefined, [0.55, 1.3, 0.35]); }
  ex.p('lotus', sp(0.13, 10, 8), [0, 1.45, 0], hdr('#ffe9a8', 1.5));
}
function temple(ex, k, ext) {
  const b = DB.temple, T = SP.temple, F = b.fy, X0 = TY.cx - TY.w / 2, X1 = TY.cx + TY.w / 2, Z0 = TY.cz - TY.d / 2, Z1 = TY.cz + TY.d / 2, TZ = TY.terrace;
  // 마당 돌바닥(분홍) + 가운데 길 + 축대(돌) + 축대 위 바닥
  ex.at(TY.cx, 0.025, (TZ + Z1) / 2).p('paver', plane(TY.w, Z1 - TZ, 1.6), [0, 0, 0], PAVE, [-PI / 2, 0, 0]);
  ex.at(TY.cx, 0.035, (Z1 + T.stairs[3]) / 2).p('paver', plane(6.5, Z1 - T.stairs[3], 1.2), [0, 0, 0], '#f7ddd5', [-PI / 2, 0, 0]);
  ex.at(TY.cx, F / 2, (Z0 + TZ) / 2).p('stone', bx(TY.w, F, TZ - Z0, 1.2), [0, 0, 0], STONE);
  ex.at(TY.cx, F + 0.006, (Z0 + TZ) / 2).p('paver', plane(TY.w, TZ - Z0, 1.6), [0, 0, 0], PAVE, [-PI / 2, 0, 0]);
  // 큰 돌계단 9단 + 옆 소맷돌 + 축대 위 돌난간
  const [sx0, sz0, sx1, sz1] = T.stairs, n = 18;
  for (let j = 0; j < n; j++) { const zz = sz1 - ((sz1 - sz0) / n) * j; ex.at((sx0 + sx1) / 2, 0, (sz0 + zz) / 2).p('stone', bx(sx1 - sx0, (F / n) * (j + 1), zz - sz0, 1), [0, (F / n) * (j + 1) / 2, 0], j % 2 ? '#e9ded4' : '#dfd2c6'); }
  for (const s of [sx0 - 0.2, sx1 + 0.2]) { ex.at(s, 0, (sz0 + sz1) / 2).p('stone', bx(0.45, F + 0.5, sz1 - sz0, 1), [0, (F + 0.5) / 2, 0], '#e6dbd1').p('stone', bx(0.5, 0.9, 0.5), [0, 0.45, (sz1 - sz0) / 2 - 0.2], '#e6dbd1').p('stone', sp(0.24, 10, 8), [0, 1.05, (sz1 - sz0) / 2 - 0.2], '#efe6dc'); }
  for (const [a, c] of [[X0, sx0 - 0.4], [sx1 + 0.4, X1]]) {
    ex.at((a + c) / 2, F, TZ - 0.15).p('stone', bx(c - a, 0.12, 0.2), [0, 0.65, 0], '#efe6dc').p('stone', bx(c - a, 0.1, 0.25), [0, 0.06, 0], '#efe6dc');
    for (let x = a + 0.4; x <= c - 0.3; x += 2) ex.at(x, F, TZ - 0.15).p('stone', bx(0.24, 0.8, 0.24), [0, 0.4, 0], '#efe6dc').p('stone', sp(0.15, 8, 6), [0, 0.88, 0], '#efe6dc');
  }
  // 담장: 마당 동·서·남(대문 자리 비움) + 축대 뒤
  const wall = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + PI / 2; ex.at((x0 + x1) / 2, 0, (z0 + z1) / 2, ry).p('stone', bx(len, 0.7, 0.5, 1), [0, 0.35, 0], STONE).p('stucco', bx(len, 0.5, 0.44, 1.6), [0, 0.95, 0], PLAST).p('plain', bx(len + 0.2, 0.16, 0.8), [0, 1.27, 0], '#5a5068'); };
  wall(X0 - 0.3, Z1 + 0.3, X0 - 0.3, TZ); wall(X1 + 0.3, Z1 + 0.3, X1 + 0.3, TZ); wall(X0 - 0.3, Z1 + 0.3, T.gate[0][0] - 0.6, Z1 + 0.3); wall(T.gate[1][0] + 0.6, Z1 + 0.3, X1 + 0.3, Z1 + 0.3);
  for (const [a0, c0, a1, c1] of [[X0 - 0.3, Z0 - 0.3, X1 + 0.3, Z0 - 0.3], [X0 - 0.3, Z0 - 0.3, X0 - 0.3, TZ], [X1 + 0.3, Z0 - 0.3, X1 + 0.3, TZ]]) { const len = Math.hypot(a1 - a0, c1 - c0), ry = Math.atan2(a1 - a0, c1 - c0) + PI / 2; ex.at((a0 + a1) / 2, F, (c0 + c1) / 2, ry).p('stucco', bx(len, 1.0, 0.44, 1.6), [0, 0.5, 0], PLAST).p('plain', bx(len + 0.2, 0.16, 0.8), [0, 1.08, 0], '#5a5068'); }
  // 법당: 기단 + 기둥·단청 + 앞면 꽃살문 4칸(가운데 칸은 열림) + 옆·뒤 회벽 + 팔작지붕 + 현판
  const bw = b.w, bd = b.d, PH = 4.0, cols = [-9.8, -6.2, -2.5, 2.5, 6.2, 9.8];
  ex.at(b.cx, F, b.cz).p('stone', bx(bw + 0.8, 0.12, bd + 0.8, 1), [0, -0.06, 0], '#e6dbd1'); // 윗면 = 발 높이 (실내 마루와 같은 높이)
  for (const [a0, c0, a1, c1, side] of wallRects(b)) {
    const len = Math.max(a1 - a0, c1 - c0), mx = (a0 + a1) / 2, mz = (c0 + c1) / 2;
    if (side === '+z') continue;
    ex.at(mx, F, mz).p('stucco', bx(a1 - a0, PH, c1 - c0, 1.6), [0, PH / 2, 0], PLAST);
    ex.p('plain', bx(side[1] === 'z' ? len : 0.46, 0.18, side[1] === 'z' ? 0.46 : len), [0, 0.6, 0], RED).p('plain', bx(side[1] === 'z' ? len : 0.46, 0.18, side[1] === 'z' ? 0.46 : len), [0, PH - 0.1, 0], RED);
  }
  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i], c = cols[i + 1]; if (a === -2.5) continue; // 가운데 칸 = 문
    const w = c - a - 0.5;
    ex.at(b.cx + (a + c) / 2, F, b.cz + bd / 2).p('lattice', plane(w, PH - 0.2), [0, PH / 2, 0.06], '#ffffff').p('plain', bx(w + 0.1, 0.12, 0.2), [0, PH - 0.08, 0], RED);
    k.at(b.cx + (a + c) / 2, F, b.cz + bd / 2 - 0.25, PI).p('lattice', plane(w, PH - 0.2), [0, PH / 2, 0], '#ffffff');
  }
  frame(ex, b.cx, F, b.cz, 0, bw - 0.4, bd - 0.4, PH, cols.map((c) => c * (bw - 0.4) / bw), true, 0.34); // 굵은 붉은 기둥 열
  roof(ex, b.cx, F + PH + 0.9, b.cz, 0, bw + 7.5, bd + 7, 6.2, 2.0); // 그림처럼 크고 처마가 깊게 휜 팔작지붕
  ex.at(b.cx, F + PH + 0.55, b.cz + bd / 2 + 0.35).p('plain', bx(2.6, 0.9, 0.1), [0, 0, 0], '#5a2e2a').p('art', plane(2.4, 0.75, 0, ext.uv(0, 2, 1)), [0, 0, 0.06], '#ffffff');
  // 불상(금빛) + 연꽃 대좌 + 광배 + 불단·촛불 — 마당에서 문으로 보이도록 겉(ex)에 둠
  const [u0, uz0, u1, uz1] = T.buddha, ucx = (u0 + u1) / 2, ucz = (uz0 + uz1) / 2, G = hdr('#f4c45c', 1.12);
  ex.at(ucx, F, ucz); ex.f.multiply(new THREE.Matrix4().makeScale(1.35, 1.35, 1.35)); // 불상 1.35배 (그림처럼 크게)
  ex.p('plain', cy(1.25, 1.4, 0.55, 8), [0, 0.27, 0], '#9c2f25').p('shine', cy(1.3, 1.3, 0.08, 8), [0, 0.56, 0], hdr('#e8b84a', 1));
  for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; ex.p('plain', sp(0.28, 8, 6), [Math.cos(a) * 0.95, 0.85, Math.sin(a) * 0.75], i % 2 ? '#f6b9c6' : '#f9d1d9', undefined, [0.8, 1.2, 0.5]); }
  ex.p('shine', cy(0.95, 0.85, 0.3, 16), [0, 0.95, 0], G);
  ex.p('shine', sp(0.6, 14, 10), [0, 1.3, 0.05], G, undefined, [1.6, 0.55, 1.15]); // 가부좌 다리
  ex.p('shine', sp(0.6, 14, 10), [0, 1.95, -0.05], G, undefined, [1.0, 1.25, 0.8]); // 몸
  ex.p('shine', sp(0.36, 14, 10), [0, 2.85, 0], G).p('shine', sp(0.2, 10, 8), [0, 3.18, -0.02], G).p('shine', sp(0.1, 8, 6), [0, 3.33, -0.02], G);
  for (const s of [-1, 1]) ex.p('shine', sp(0.1, 8, 6), [s * 0.36, 2.8, 0], G, undefined, [0.5, 1.4, 0.6]).p('shine', sp(0.17, 10, 8), [s * 0.5, 2.15, 0.12], G, undefined, [0.8, 1.6, 0.8]);
  ex.p('shine', sp(0.16, 10, 8), [0, 1.55, 0.45], G, undefined, [1.4, 0.5, 0.8]); // 손 (선정인)
  ex.p('glow', new THREE.CircleGeometry(0.62, 28), [0, 2.9, -0.45], hdr('#ffd77a', 1.4)).p('shine', new THREE.TorusGeometry(0.62, 0.05, 6, 28), [0, 2.9, -0.43], G);
  ex.p('glow', fitUV(new THREE.ShapeGeometry(lancetShape(2.3, 3.4), 8)), [0, 0.95, -0.55], hdr('#ffb85c', 1.15)).p('shine', ring(lancetShape, 2.5, 3.6, 2.3, 3.4), [0, 0.85, -0.53], G);
  templeAltar(ex, b, T); // 3단 불단·공양상·향로·연꽃 등대 (interiors.js)
  templeIn(k, b, T); // 실내: interiors.js (그림 interior-3)
  // 양옆 전각: 낮은 돌 기단 + 기둥·단청 + 앞면 꽃살문 + 팔작지붕
  for (const [r, ry] of [[T.hallL, PI / 2], [T.hallR, -PI / 2]]) {
    const [h0, hz0, h1, hz1] = r, hcx = (h0 + h1) / 2, hcz = (hz0 + hz1) / 2, along = hz1 - hz0, deep = h1 - h0, HPH = 2.7, by = 0.6;
    ex.at(hcx, 0, hcz).p('stone', bx(deep + 0.6, by, along + 0.6, 1), [0, by / 2, 0], STONE).p('stucco', bx(deep - 0.4, HPH, along - 0.4, 1.6), [0, by + HPH / 2, 0], PLAST);
    const nb = Math.round(along / 2.4), step = (along - 0.4) / nb;
    for (let i = 0; i < nb; i++) ex.at(hcx, by, hcz, ry).sub((-(along - 0.4) / 2 + (i + 0.5) * step) * 1, 0, (deep - 0.4) / 2 + 0.03).p('lattice', plane(step - 0.35, HPH - 0.3), [0, HPH / 2, 0], '#ffffff');
    frame(ex, hcx, by, hcz, ry, along - 0.4, deep - 0.4, HPH, Array.from({ length: nb + 1 }, (_, i) => -(along - 0.4) / 2 + i * step));
    roof(ex, hcx, by + HPH + 0.9, hcz, ry, along + 1.8, deep + 1.8, 2.2, 0.8); // 전각 지붕은 대웅전보다 작게 (그림)
  }
  // 범종각: 돌 기단(서쪽 계단) + 기둥 4 + 나무 난간 + 단청 + 지붕 + 청동 종 + 당목
  { const [d0, dz0, d1, dz1] = T.bellDeck, dcx = (d0 + d1) / 2, dcz = (dz0 + dz1) / 2, dw = d1 - d0, PH2 = 3.3, Y = 0.9;
    ex.at(dcx, 0, dcz).p('stone', bx(dw, Y, dz1 - dz0, 1), [0, Y / 2, 0], STONE).p('paver', plane(dw - 0.1, dz1 - dz0 - 0.1, 1.2), [0, Y + 0.005, 0], PAVE, [-PI / 2, 0, 0]);
    const [e0, ez0, e1, ez1] = T.bellStairs;
    for (let j = 0; j < 4; j++) { const xx = e0 + ((e1 - e0) / 4) * j; ex.at((xx + e1) / 2, 0, (ez0 + ez1) / 2).p('stone', bx(e1 - xx, (Y / 4) * (j + 1), ez1 - ez0, 1), [0, (Y / 8) * (j + 1), 0], '#e3d7cc'); }
    frame(ex, dcx, Y, dcz, 0, dw - 1, dz1 - dz0 - 1, PH2, [-(dw - 1) / 2, (dw - 1) / 2], false);
    for (const [len, px, pz, rr] of [[dw - 1, 0, -(dz1 - dz0 - 1) / 2, 0], [dw - 1, 0, (dz1 - dz0 - 1) / 2, 0], [dz1 - dz0 - 1, (dw - 1) / 2, 0, PI / 2]]) ex.at(dcx + px, Y, dcz + pz, rr).p('wood', bx(len, 0.1, 0.1), [0, 0.75, 0], '#8a4a2a').p('wood', bx(len, 0.08, 0.08), [0, 0.3, 0], '#8a4a2a');
    for (const z of [dz0 + 0.5, dz1 - 0.5]) ex.at(d0 + 0.5, Y, z).p('wood', bx(0.1, 0.1, 0.9), [0, 0.75, z < dcz ? 0.45 : -0.45], '#8a4a2a');
    roof(ex, dcx, Y + PH2 + 0.9, dcz, 0, dw + 2.6, dz1 - dz0 + 2.6, 2.4, 0.8);
    ex.at(T.bell.x, Y, T.bell.z).p('wood', bx(0.25, 0.25, dz1 - dz0 - 0.8), [0, PH2 - 0.2, 0], '#8a4a2a');
    const bk = ext.bell ?? ex; // 청동 종은 따로 묶어 흔들 수 있게 (rituals.js 가 칠 때 흔듦). 축은 고리 위
    if (ext.bell) bk.at(0, -BELL_PIVOT, 0);
    bk.p('shine', lathe([[0, 0.5], [0.82, 0.5], [0.8, 0.55], [0.66, 0.9], [0.6, 1.5], [0.5, 1.95], [0.32, 2.08], [0, 2.1]], 18), [0, 0, 0], '#8c7a5a').p('shine', new THREE.TorusGeometry(0.12, 0.05, 6, 12), [0, 2.2, 0], '#6d5f45');
    for (const y of [0.62, 1.75]) bk.p('shine', cy(y < 1 ? 0.83 : 0.56, y < 1 ? 0.83 : 0.56, 0.08, 18), [0, y, 0], '#6d5f45');
    ex.at(T.bell.x + 1.6, Y, T.bell.z).p('wood', cy(0.16, 0.16, 1.5, 10), [0, 1.3, 0], '#a87a50', [0, 0, PI / 2]);
    for (const dx of [-0.5, 0.5]) ex.p('plain', cy(0.015, 0.015, PH2 - 1.5, 4), [dx, 1.3 + (PH2 - 1.5) / 2, 0], '#d9c8a8');
  }
  // 3층 석탑 + 돌울타리 + 안쪽 풀·꽃
  { const [p0, pz0, p1, pz1] = T.pagoda, pcx = (p0 + p1) / 2, pcz = (pz0 + pz1) / 2, pw = p1 - p0, S2 = '#d6cdc4';
    ex.at(pcx, 0.03, pcz).p('plain', plane(pw - 0.2, pw - 0.2), [0, 0, 0], '#8fca78', [-PI / 2, 0, 0]);
    flowers(ex, p0 + 0.3, pz0 + 0.3, p1 - 0.3, pz1 - 0.3, 0, 22, 9);
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) ex.at(pcx + ax * (pw / 2 - 0.1), 0, pcz + az * (pw / 2 - 0.1)).p('plain', bx(0.3, 0.75, 0.3), [0, 0.37, 0], '#ebe2d8').p('plain', sp(0.17, 8, 6), [0, 0.85, 0], '#ebe2d8');
    for (const [len, ax, az, rr] of [[pw, 0, -1, 0], [pw, 0, 1, 0], [pw, -1, 0, PI / 2], [pw, 1, 0, PI / 2]]) ex.at(pcx + ax * (pw / 2 - 0.1), 0, pcz + az * (pw / 2 - 0.1), rr).p('plain', bx(len - 0.2, 0.12, 0.14), [0, 0.55, 0], '#ebe2d8').p('plain', bx(len - 0.2, 0.12, 0.14), [0, 0.2, 0], '#ebe2d8');
    ex.at(pcx, 0, pcz); ex.f.multiply(new THREE.Matrix4().makeScale(0.7, 0.7, 0.7)); ex.p('plain', bx(0.01, 0.01, 0.01), [0, 0, 0], S2); // 석탑을 작게 (대웅전을 안 가리게)
    ex.p('plain', bx(2.4, 0.4, 2.4, 0.8), [0, 0.2, 0], S2).p('plain', bx(1.9, 0.55, 1.9, 0.8), [0, 0.67, 0], '#ddd5cc').p('plain', bx(2.0, 0.1, 2.0), [0, 0.98, 0], S2);
    let y = 1.03;
    for (const [bw2, bh, rw] of [[1.1, 0.95, 2.0], [0.9, 0.62, 1.7], [0.74, 0.5, 1.45]]) {
      ex.p('plain', bx(bw2, bh, bw2, 0.8), [0, y + bh / 2, 0], '#e4dcd3'); y += bh;
      ex.p('plain', bx(rw * 0.75, 0.12, rw * 0.75), [0, y + 0.06, 0], S2).p('plain', cy(rw * 0.7, rw * 0.62, 0.16, 4).rotateY(PI / 4), [0, y + 0.2, 0], '#cfc6bd').p('plain', bx(rw * 0.4, 0.1, rw * 0.4), [0, y + 0.33, 0], S2); y += 0.38;
    }
    ex.p('plain', cy(0.12, 0.14, 0.25, 8), [0, y + 0.12, 0], S2).p('plain', sp(0.17, 10, 8), [0, y + 0.38, 0], '#e4dcd3').p('plain', cy(0.04, 0.04, 0.9, 6), [0, y + 0.9, 0], '#bcb2a7');
    for (const dy of [0.62, 0.82, 1.0]) ex.p('plain', cy(0.13, 0.13, 0.05, 10), [0, y + dy, 0], '#bcb2a7');
    ex.p('plain', sp(0.08, 8, 6), [0, y + 1.38, 0], '#bcb2a7');
  }
  for (const [x, z] of T.lanterns) lotusLamp(ex, x, z);
  // 일주문: 그림에 없어 뺌 (마당 입구는 담 사이 열린 길)
  // 축대 위 소나무·벚나무·덤불, 마당 가장자리 꽃밭·바위
  for (const [x, z, ch] of [[256.5, -126, 0], [283.5, -126, 1], [257.5, -116.5, 1], [282.5, -116.5, 0]]) { if (ch) cherry(ex, x, z, 0.9, F); else { ex.at(x, F, z).p('wood', cy(0.18, 0.26, 2.2, 7), [0, 1.1, 0], '#91634c'); [[1.7, 2.0, 1.4], [1.35, 2.9, 1.3], [0.95, 3.7, 1.15], [0.55, 4.4, 0.9]].forEach(([r, y, h], i) => ex.p('plain', lumpy(new THREE.ConeGeometry(r, h, 10, 1), 0.04, 2.5, i), [0, y, 0], ['#55b383', '#62bf8a', '#4aa682', '#5bb886'][i])); } }
  for (const [x0, z0, x1, z1, n] of [[X0 + 0.4, TZ + 1, X0 + 3, Z1 - 6, 40], [X1 - 3, TZ + 1, X1 - 0.4, TZ + 6, 20], [X1 - 2.6, Z1 - 3.5, X1 - 0.4, Z1 - 0.4, 18], [X0 + 0.4, Z1 - 3, X0 + 5, Z1 - 0.4, 22], [sx0 - 6, TZ + 0.4, sx0 - 1.2, TZ + 2.4, 26], [sx1 + 1.2, TZ + 0.4, sx1 + 6, TZ + 2.4, 26]]) flowers(ex, x0, z0, x1, z1, 0, n, x0 + z0);
}
const BOARD = (t, f) => (x, w) => { x.fillStyle = '#4a2420'; x.fillRect(0, 0, w * 2, w); x.strokeStyle = '#e8b84a'; x.lineWidth = 8; x.strokeRect(8, 8, w * 2 - 16, w - 16); x.fillStyle = '#ffd25e'; x.font = `bold ${f}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, w, w / 2 + 6); };
const templeArt = () => TX.atlas('templeArt2', 4, 256, [BOARD('대웅전', 120), () => {}, BOARD('포근산 일주문', 72), () => {}, BOARD('천왕문', 120)]);

// 반환: 건물별 실내 그룹 (game.js 가 멀리 있으면 숨김). 단지마다 설계도로 짓고 그룹을 3배·회전해 제자리에 (world.js 의 XF 와 같은 변환)
const UP = new THREE.Vector3(0, 1, 0);
function placed(k, parent, origin = [0, 0]) {
  const f = XF[k], g = new THREE.Group(), o = new THREE.Vector3(f.c0[0] * f.s, 0, f.c0[1] * f.s).applyAxisAngle(UP, f.th);
  g.name = 'sacred-' + k; g.scale.setScalar(f.s); g.rotation.y = f.th; g.position.set(f.c1[0] - o.x - origin[0], 0, f.c1[1] - o.z - origin[1]);
  parent.add(g); return g;
}
export const PARTS = {}; // 움직이는 장식(범종) — rituals.js 가 씀. createSacred 의 반환값은 실내 그룹만(game.js 가 건물 키로 돎)
export function createSacred(scene) {
  const out = {}, em = extraMats(), art = templeArt();
  const artM = new THREE.MeshBasicMaterial({ map: art.tex, vertexColors: true }), paver = soft('#ffffff', { vertexColors: true, map: TX.cobbleTex(), polygonOffset: true, polygonOffsetFactor: -1 });
  const glowIn = nightGlow(mats().glow.clone(), 1, 1.7, 0.4); // 실내 랜턴·연등·등롱: 밤엔 더 환하게
  const inside = (kk, parent, extra) => { const gi = new THREE.Group(); parent.add(gi); buildKit(kk, gi, true, { ...em, glow: glowIn, ...extra }); return gi; };
  const stainedIn = { stained: nightGlow(new THREE.MeshBasicMaterial({ map: stainedPTex(), vertexColors: true, side: THREE.DoubleSide }), 1.05, 0.8, 0.5), sunset: nightGlow(new THREE.MeshBasicMaterial({ map: sunsetTex() }), 1.05, 0.55, 0.5), latticeOpen: new THREE.MeshBasicMaterial({ map: latticeOpenTex(), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }) }; // 실내 창: 연한 스테인드글라스·꽃살창 너머 노을
  const smoothStone = soft('#ffffff', { vertexColors: true, map: TX.stuccoTex(), emissive: new THREE.Color('#9a7464'), emissiveIntensity: 0.85 }); // 동쪽을 봐서 노을 땐 그늘 → 그림처럼 밝은 크림이 되게 살짝 스스로 밝힘
  const smoothCream = soft('#ffffff', { vertexColors: true }); // 교회 회벽: 얼룩 없이 매끈하게
  const wm = nightGlow(soft('#8fd8ec', { emissive: new THREE.Color('#3aa0c8'), emissiveIntensity: 0.15 }), 0.15, 0.9, 0.4);
  const sheetM = new THREE.MeshBasicMaterial({ map: TX.streakTex(), color: '#e6f8ff', transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
  // 성당 + 교회 (마을 안): 겉 한 덩어리 + 실내 그룹 + 앞마당 분수 물
  for (const [key, fn, f, fc] of [['cathedral', cathedral, SP.cathedral.fountain, '#f2e2d0'], ['church', church, SP.church.fountain, '#f6e6da']]) {
    const ex = new Kit(), k = new Kit(), water = new Batch(), sheets = new Batch(), g = placed(key, scene);
    fn(ex, k);
    fountain(ex, f, fc, water, sheets);
    flowers(ex, f.x - 2.6, f.z + f.r + 0.3, f.x + 2.6, f.z + f.r + 1.1, 0, 20, f.x);
    buildKit(ex, g, false, { ...em, art: artM, ...(key === 'cathedral' ? { stone: smoothStone } : { stucco: smoothCream }) }); // 성당은 그림처럼 매끈한 크림 돌
    water.build(g, { w: wm }, { cast: false }); sheets.build(g, { w: sheetM }, { cast: false, recv: false });
    out[key] = inside(k, g, stainedIn);
  }
  // 큰길 꽃밭: 광장에서 정면까지 양옆으로 이어진 낮은 화단 (사람 크기, 실제 좌표)
  { const av = new Kit();
    for (const [x0, x1] of [[-48, -28], [30, 47]]) for (const z of [-0.2, 10.2]) { av.at((x0 + x1) / 2, 0, z).p('stone', bx(x1 - x0, 0.3, 0.9, 1), [0, 0.15, 0], '#f3e4d4'); flowers(av, x0 + 0.3, z - 0.35, x1 - 0.3, z + 0.35, 0.3, Math.round((x1 - x0) * 3), x0 + z); }
    // 앞마당 잔디 화단 (그림처럼 분수·벤치 둘레에 잔디·꽃·둥근 덤불·바위)
    for (const r of [[-48, 11, -20, 15], [-48, -5, -20, -1], [-69, 27, -58, 35], [-69, -25, -58, -20], [20, 11, 48, 15], [20, -5, 48, -1], [52, 27, 63, 35], [52, -25, 63, -20]]) lawn(av, ...r, r[0] + r[1]);
    buildKit(av, scene, false); }
  // 사찰 (마을 밖): 마당 가운데에서 260m 밖이면 안 그림 (숲·언덕에 가려 안 보임)
  const tx = new Kit(), tk = new Kit(), lod = new THREE.LOD(), lc = toWorldYard();
  const bellKit = new Kit();
  temple(tx, tk, { uv: art.uv, bell: bellKit });
  lod.position.set(lc[0], 0, lc[1]);
  const lv = new THREE.Group(), tg = placed('temple', lv, lc), yk = new Kit(), yg = new THREE.Group(); // lv = LOD 가까운 단계 (구내 + 마당 잔디)
  for (const r of [[255.5, -104.5, 261.5, -100.5], [262, -110.2, 264.8, -105.5], [275.2, -110.2, 277, -108.2], [278, -101.2, 284.7, -100.5]]) { const a = toW(r[0], r[1]), c = toW(r[2], r[3]); lawn(yk, Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), r[0] + r[1]); } // 마당 화단 (설계도 좌표)
  for (const [x, z, sx, sy, sz, c] of [[346, -300, 70, 34, 40, '#6aa86a'], [270, -290, 55, 26, 40, '#78b46e'], [425, -285, 60, 30, 40, '#72ae6c'], [300, -320, 60, 40, 40, '#5f9e66'], [395, -325, 60, 38, 40, '#65a468']]) yk.at(x, 0, z).p('plain', lumpy(new THREE.SphereGeometry(1, 18, 8, 0, PI * 2, 0, PI / 2), 0.05, 2, x), [0, -1, 0], c, undefined, [sx, sy, sz]); // 사찰 뒤 숲 언덕 (그림 배경)
  yg.position.set(-lc[0], 0, -lc[1]); lv.add(yg); buildKit(yk, yg, false);
  buildKit(tx, tg, false, { ...em, art: artM, paver });
  const bell = (PARTS.bell = new THREE.Group()); bell.position.set(SP.temple.bell.x, 0.9 + BELL_PIVOT, SP.temple.bell.z); tg.add(bell); buildKit(bellKit, bell, false, em);
  lod.addLevel(lv, 0); lod.addLevel(new THREE.Object3D(), 260); scene.add(lod);
  out.temple = inside(tk, placed('temple', scene), { ...stainedIn, lattice: new THREE.MeshBasicMaterial({ map: latticeTex(), vertexColors: true, side: THREE.DoubleSide }) });
  return out;
}
const toWorldYard = () => { const f = XF.temple; return f.c1; };
const toW = (x, z) => { const f = XF.temple; return [f.c1[0] + (x - f.c0[0]) * f.s, f.c1[1] + (z - f.c0[1]) * f.s]; };
// 잔디 화단 (실제 크기): 돌 테두리 + 잔디 + 꽃 + 둥근 덤불 + 바위 + (넓으면) 작은 나무
function lawn(k, x0, z0, x1, z1, seed) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; let r = Math.abs(seed * 9301 + 49297) % 233280; const R = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  k.at(cx, 0.1, cz).p('plain', plane(w, d), [0, 0, 0], '#8fca78', [-PI / 2, 0, 0]); // 사찰 마당 돌바닥(0.075)보다 위
  for (const [a, b, ww, dd] of [[0, -d / 2, w + 0.3, 0.3], [0, d / 2, w + 0.3, 0.3], [-w / 2, 0, 0.3, d], [w / 2, 0, 0.3, d]]) k.p('stone', bx(ww, 0.22, dd, 0.8), [a, 0.08, b], '#efe4da');
  flowers(k, x0 + 0.4, z0 + 0.4, x1 - 0.4, z1 - 0.4, 0, Math.round(w * d * 0.55), seed);
  for (let i = 0; i < Math.max(2, Math.round(w * d / 22)); i++) { const x = x0 + 0.8 + R() * (w - 1.6), z = z0 + 0.8 + R() * (d - 1.6), s = 0.55 + R() * 0.45; k.at(x, 0, z).p('plain', leaf(s, i + seed), [0, s * 0.7, 0], ['#5fb86a', '#6cc47b', '#4fae62'][i % 3]).p('plain', leaf(s * 0.7, i + seed + 3), [s * 0.6, s * 0.5, 0.1], '#6cc47b'); }
  for (let i = 0; i < Math.round(w * d / 60); i++) k.at(x0 + 1 + R() * (w - 2), 0, z0 + 1 + R() * (d - 2)).p('stone', new THREE.IcosahedronGeometry(0.35 + R() * 0.25, 0), [0, 0.15, 0], '#cfc6c4', undefined, [1.3, 0.7, 1]);
  if (w * d > 80) cherry(k, cx + (R() - 0.5) * w * 0.4, cz, 0.9);
}
