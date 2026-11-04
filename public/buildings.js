// 건물 겉·속(카페·회사): 재질별로 합쳐 건물당 그리기 호출 십여 개. 위치는 world.js 의 가구·자리·충돌 표를 그대로 따름
import * as THREE from 'three';
import { BUILDINGS, FURN, STOOLS, SEATS, wallRects, doorPos, sideNormal } from './world.js';
import { soft, Batch, boxUV, place, lumpy, nightGlow } from './gfx.js';
import * as TX from './textures.js';

/* ───── 공용 도구 ───── */
const o3 = new THREE.Object3D();
// Batch + 국소 좌표계: at() 로 기준점·방향을 잡고 p() 로 그 안에 부품을 넣음
export class Kit extends Batch {
  constructor() { super(); this.f = new THREE.Matrix4(); }
  sub(x = 0, y = 0, z = 0, ry = 0) { o3.position.set(x, y, z); o3.rotation.set(0, ry, 0); o3.scale.setScalar(1); o3.updateMatrix(); this.f.multiply(o3.matrix); return this; }
  at(x, y, z, ry) { this.f.identity(); return this.sub(x, y, z, ry); }
  p(key, geo, pos, color, rot, s) { place(geo, { pos, rot, s }); geo.applyMatrix4(this.f); return this.add(key, geo, { color }); }
}
export const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k); // 1 보다 밝으면 블룸이 번짐
export const bx = (w, h, d, t) => (t ? boxUV(w, h, d, t) : new THREE.BoxGeometry(w, h, d));
export const cy = (rt, rb, h, n = 12, open = false, t0, tl) => new THREE.CylinderGeometry(rt, rb, h, n, 1, open, t0, tl);
export const sp = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
export function plane(w, h, t = 0, uv) { // t: 텍스처 반복 크기(m), uv: 아틀라스 칸
  const g = new THREE.PlaneGeometry(w, h), a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) {
    const u = a.getX(i), v = a.getY(i);
    if (uv) a.setXY(i, uv[0] + u * (uv[2] - uv[0]), uv[1] + v * (uv[3] - uv[1])); else if (t) a.setXY(i, (u * w) / t, (v * h) / t);
  }
  return g;
}
export const lathe = (pts, n = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
export const leaf = (r, seed) => lumpy(new THREE.IcosahedronGeometry(r, 1), 0.18, 2.2, seed);

let MATS = null;
export function mats() {
  if (MATS) return MATS;
  const tx = (map, o = {}) => soft('#ffffff', { vertexColors: true, map, ...o }), matcap = TX.matcapTex();
  MATS = {
    plain: soft('#ffffff', { vertexColors: true }),
    wood: tx(TX.woodTex()), stucco: tx(TX.stuccoTex()), siding: tx(TX.sidingTex()), roof: tx(TX.shingleTex()), stone: tx(TX.stoneTex()),
    parquet: tx(TX.parquetTex()), carpet: tx(TX.carpetTileTex()), paper: tx(TX.wallpaperTex()), wains: tx(TX.wainscotTex()), damask: tx(TX.damaskTex()), felt: tx(TX.feltTex()),
    shine: new THREE.MeshMatcapMaterial({ matcap, vertexColors: true }), // 금·크롬: 실내 그늘에서도 반짝임
    glass: new THREE.MeshMatcapMaterial({ matcap, vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }), // 정점 색이 1 을 넘으면 블룸
    win: new THREE.MeshBasicMaterial({ map: TX.windowTex(), vertexColors: true }),
  };
  MATS.winIn = nightGlow(MATS.win.clone(), 1, 0.32, 0.5); // 안쪽에서 본 유리 = 바깥 하늘빛이라 밤엔 어두워짐
  return MATS;
}
// 아틀라스 그림 판: 키마다 재질 하나 (조명 없이 그대로)
export const artMat = (tex, k = 1) => new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, color: new THREE.Color(k, k, k), alphaTest: 0.5 });

// 벽면 위치: side 의 벽 중심선에서 along(절대 좌표) 지점, 높이 y. out=true 면 바깥을 보고 아니면 안쪽을 봄
export function face(k, b, side, along, y, out = true) {
  const [nx, nz] = sideNormal(side), x = nx ? b.cx + nx * b.w / 2 : along, z = nz ? b.cz + nz * b.d / 2 : along;
  return k.at(x, y, z, Math.atan2(nx, nz) + (out ? 0 : Math.PI)).sub(0, 0, 0.2);
}
// 안쪽 벽 네 면에 띠(벽지·판넬)를 두름. 문 자리(높이 2.7)는 비움
export function bands(k, b, y0, y1, key, color, { door = true, t = 1, dz = 0.012 } = {}) {
  for (const side of ['-z', '+z', '-x', '+x']) {
    const alongX = side[1] === 'z', c = alongX ? b.cx : b.cz, half = (alongX ? b.w : b.d) / 2 - 0.2;
    const spans = door && side === b.door && y0 < 2.7 ? [[c - half, c - b.dw / 2], [c + b.dw / 2, c + half]] : [[c - half, c + half]];
    for (const [a0, a1] of spans) face(k, b, side, (a0 + a1) / 2, (y0 + y1) / 2, false).p(key, plane(a1 - a0, y1 - y0, t), [0, 0, dz], color);
    if (spans.length === 2 && y1 > 2.7) face(k, b, side, c, (2.7 + y1) / 2, false).p(key, plane(b.dw, y1 - 2.7, t), [0, 0, dz], color);
  }
}
// 창: 바깥은 따뜻하게 켜진 유리 + 틀·창살·창턱(+꽃상자), 안쪽은 하늘빛 유리 + 틀(+커튼)
export function windowPair(k, b, side, along, y, w, h, o = {}) {
  const frame = o.frame ?? '#fffaf0', fk = o.fk ?? 'plain';
  const one = (out) => {
    face(k, b, side, along, y, out);
    k.p(fk, bx(w + 0.24, h + 0.24, 0.08), [0, 0, 0.03], frame);
    k.p(out ? 'win' : 'winIn', plane(w, h), [0, 0, 0.075], out ? hdr(o.glass ?? '#ffe6b8', o.gk ?? 1.05) : hdr('#d9efff', 1.1));
    if (o.arch && out) k.p('win', new THREE.CircleGeometry(w / 2, 20, 0, Math.PI), [0, h / 2, 0.075], hdr(o.glass ?? '#ffe6b8', 1.05)).p(fk, new THREE.TorusGeometry(w / 2 + 0.06, 0.07, 6, 20, Math.PI), [0, h / 2, 0.08], frame);
    k.p(fk, bx(0.06, h, 0.05), [0, 0, 0.1], frame);
    if (!o.noBar) k.p(fk, bx(w, 0.06, 0.05), [0, o.barY ?? h * 0.12, 0.1], frame);
    k.p(fk, bx(w + 0.4, 0.08, 0.2), [0, -h / 2 - 0.14, 0.1], frame);
    if (out && o.flowers) {
      k.p('wood', bx(w, 0.24, 0.26, 0.6), [0, -h / 2 - 0.32, 0.17], '#c98f5b');
      for (let i = 0; i < Math.round(w * 4); i++) k.p('plain', new THREE.IcosahedronGeometry(0.1, 0), [-w / 2 + 0.12 + i * 0.25, -h / 2 - 0.15 + (i % 2) * 0.05, 0.2], ['#ff8fb1', '#ffffff', '#ffd84a', '#c9a8ff'][i % 4]);
      for (let i = 0; i < Math.round(w * 3); i++) k.p('plain', new THREE.IcosahedronGeometry(0.11, 0), [-w / 2 + 0.15 + i * 0.33, -h / 2 - 0.2, 0.12], '#7ccf6b');
    }
    if (!out && o.curtain) for (const s of [-1, 1]) {
      k.p('plain', bx(w * 0.22, h + 0.3, 0.06), [s * (w / 2 + 0.02), 0, 0.15], o.curtain);
      k.p('plain', cy(0.07, 0.07, w * 0.2, 8), [s * (w / 2 + 0.02), -h * 0.1, 0.19], '#f6e3c0', [0, 0, Math.PI / 2]);
    }
    if (!out && o.curtain) k.p('shine', cy(0.025, 0.025, w + 0.8, 8), [0, h / 2 + 0.2, 0.17], '#d9b46a', [0, 0, Math.PI / 2]);
  };
  one(true); one(false);
}
// 화분: 테라코타 화분 + 울퉁불퉁한 잎 덩어리
export function pot(k, x, z, s = 1, y = 0, c = '#c97b5d') {
  k.at(x, y, z).p('plain', lathe([[0, 0], [0.2, 0], [0.26, 0.36], [0.3, 0.38], [0.3, 0.44], [0, 0.44]].map(([r, h]) => [r * s, h * s]), 14), [0, 0, 0], c);
  k.p('plain', cy(0.25 * s, 0.25 * s, 0.02, 14), [0, 0.43 * s, 0], '#6b4a34');
  [[0, 0.75, 0, 0.36], [0.17, 0.95, 0.06, 0.25], [-0.15, 1.02, -0.05, 0.24], [0.02, 1.2, 0.1, 0.2]].forEach(([dx, dy, dz, r], i) => k.p('plain', leaf(r * s, i * 3 + x), [dx * s, dy * s, dz * s], ['#4fae62', '#6cc47b', '#5bb86c', '#86d48f'][i]));
}
// 이름 간판 (둥근 판 + 글씨)
export function signTex(text, bg, fg, w = 512, h = 160, font = 86) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, h * 0.25); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 6; x.beginPath(); x.roundRect(16, 16, w - 32, h - 32, h * 0.18); x.stroke();
  x.fillStyle = fg; x.font = `bold ${font}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// 바깥 벽(충돌 벽과 같은 자리) + 문 위 상인방 + 바닥판
export function shellWalls(k, b, key, color) {
  for (const [x0, z0, x1, z1] of wallRects(b)) k.at((x0 + x1) / 2, b.h / 2, (z0 + z1) / 2).p(key, bx(x1 - x0, b.h, z1 - z0, 1.6), [0, 0, 0], color);
  const [dx, dz] = doorPos(b), alongZ = b.door[1] === 'x';
  k.at(dx, 2.7 + (b.h - 2.7) / 2, dz).p(key, bx(alongZ ? 0.4 : b.dw, b.h - 2.7, alongZ ? b.dw : 0.4, 1.6), [0, 0, 0], color);
}
// 건물 겉은 밤에 따라 세기가 바뀌는 자기만의 재질: 창·등불은 밝아지고(건물마다 켜지는 때가 조금씩 다름), 조명 없는 금장·유리·안쪽 창은 어두워짐
let nOut = 0;
const outMats = () => {
  const m = mats(), on = 0.22 + (nOut++ % 3) * 0.11;
  return { glow: nightGlow(m.glow.clone(), 0.45, 1.3, on), win: nightGlow(m.win.clone(), 0.85, 2.1, on + 0.08), shine: nightGlow(m.shine.clone(), 1, 0.6, 0.5), glass: nightGlow(m.glass.clone(), 1, 0.5, 0.5) };
};
const build = (k, parent, inside, extra = {}) => k.build(parent, { ...mats(), ...(inside ? {} : outMats()), ...extra }, inside ? { cast: false, recv: false } : { noCast: ['glow', 'win', 'winIn', 'glass', 'art', 'plain', 'shine'] }); // 잔장식은 그림자 생략
export { build as buildKit };

/* ───── 카페 ───── */
function cafe(scene) {
  const b = BUILDINGS.cafe, g = new THREE.Group(), gi = new THREE.Group(), ex = new Kit(), k = new Kit();
  scene.add(g); g.add(gi);
  const CREAM = '#fff7ea', ROOF = '#e0735c', H = b.h;
  // 겉: 회벽 + 돌 기단 + 모서리 기둥 + 처마 띠
  shellWalls(ex, b, 'stucco', '#fff1dc');
  for (const side of ['-z', '+z', '-x', '+x']) {
    const alongX = side[1] === 'z', c = alongX ? b.cx : b.cz, half = (alongX ? b.w : b.d) / 2 + 0.05;
    const spans = side === b.door ? [[c - half, c - b.dw / 2], [c + b.dw / 2, c + half]] : [[c - half, c + half]];
    for (const [a0, a1] of spans) face(ex, b, side, (a0 + a1) / 2, 0.25).p('stone', bx(a1 - a0, 0.5, 0.1, 0.9), [0, 0, 0.02], '#efe4d8');
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ex.at(b.cx + sx * b.w / 2, H / 2, b.cz + sz * b.d / 2).p('wood', bx(0.36, H, 0.36, 0.8), [0, 0, 0], CREAM);
  ex.at(b.cx, H - 0.08, b.cz).p('plain', bx(b.w + 0.2, 0.18, b.d + 0.2), [0, 0, 0], CREAM);
  // 박공지붕(용마루는 x 방향) + 서까래 끝 + 처마 판 + 박공 벽과 둥근 다락 창
  const hd = b.d / 2 + 0.75, rh = 2.3, th = Math.atan2(rh, hd), L = Math.hypot(hd, rh) + 0.1;
  ex.at(b.cx, H, b.cz);
  for (const s of [1, -1]) {
    ex.p('roof', bx(b.w + 1.5, 0.22, L, 1.6), [0, rh / 2 + 0.08, (s * hd) / 2], ROOF, [s * th, 0, 0]);
    ex.p('plain', bx(b.w + 1.5, 0.12, 0.08), [0, 0.02, s * (hd + 0.02)], CREAM);
    for (let x = -b.w / 2; x <= b.w / 2 + 0.01; x += 1.08) ex.p('wood', bx(0.12, 0.14, 0.75, 0.6), [x, -0.06, s * (b.d / 2 + 0.38)], '#b98454');
  }
  ex.p('plain', cy(0.16, 0.16, b.w + 1.6, 12), [0, rh + 0.14, 0], '#c4584a', [0, 0, Math.PI / 2]);
  const tri = new THREE.Shape([new THREE.Vector2(-b.d / 2, 0), new THREE.Vector2(b.d / 2, 0), new THREE.Vector2(0, (rh * (b.d / 2)) / hd)]);
  for (const s of [1, -1]) {
    const tg = new THREE.ShapeGeometry(tri), uv = tg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
    ex.p('siding', tg, [s * (b.w / 2 + 0.01), 0, 0], '#ffe9cf', [0, (s * Math.PI) / 2, 0]);
    ex.p('plain', new THREE.TorusGeometry(0.36, 0.07, 6, 20), [s * (b.w / 2 + 0.05), 1.45, 0], CREAM, [0, Math.PI / 2, 0]);
    ex.p('win', new THREE.CircleGeometry(0.36, 18), [s * (b.w / 2 + 0.04), 1.45, 0], hdr('#ffe2a8', 1.1), [0, (s * Math.PI) / 2, 0]);
  }
  // 창: 긴 벽 양쪽 2개씩(안쪽은 창가 자리), 앞 벽 문 양옆 좁은 창
  for (const side of ['-z', '+z']) for (const x of [-23.3, -19.4]) windowPair(ex, b, side, x, 1.7, 2.2, 1.5, { flowers: true, curtain: '#fff2f0', frame: CREAM });
  for (const z of [-8.25, 0.25]) windowPair(ex, b, '+x', z, 1.6, 0.9, 1.2, { flowers: true, arch: true, frame: CREAM, noBar: true });
  // 문틀 + 활짝 열린 나무 문짝(유리 창) + 줄무늬 차양 + 간판
  const [dx, dz] = doorPos(b);
  ex.at(dx, 0, dz, Math.PI / 2).sub(0, 0, 0.2);
  for (const s of [-1, 1]) {
    ex.p('wood', bx(0.2, 2.8, 0.16, 0.6), [s * (b.dw / 2 + 0.1), 1.4, 0.04], '#a8693f');
    ex.p('wood', bx(1.5, 2.55, 0.07, 0.6), [s * (b.dw / 2 + 0.95), 1.3, 0.1], '#c27f55');
    ex.p('win', plane(1.0, 1.3), [s * (b.dw / 2 + 0.95), 1.75, 0.14], hdr('#ffe6b8', 1.0));
    ex.p('plain', sp(0.06, 8, 6), [s * (b.dw / 2 + 0.35), 1.2, 0.17], '#ffd45a');
  }
  ex.p('wood', bx(b.dw + 0.6, 0.22, 0.18, 0.6), [0, 2.8, 0.05], '#a8693f');
  const aw = awningMesh(b.dw + 3.6, 1.3, TX.awningTex('#e0735c', '#fffaf0'));
  aw.position.set(dx + 0.2, 3.2, dz); aw.rotation.y = Math.PI / 2; g.add(aw);
  ex.at(dx, 0, dz, Math.PI / 2);
  for (const s of [-1, 1]) ex.p('plain', bx(0.04, 0.04, 1.35), [s * (b.dw / 2 + 1.75), 3.12, 0.78], '#7a5c4a', [0.42, 0, 0]);
  const art = cafeArt();
  ex.at(dx + 0.06, H + 0.62, dz, Math.PI / 2).p('art', plane(2.6, 0.82, 0, art.uv(10, 1, 0.32)), [0, 0, 0], '#ffffff');
  // 칠판 입간판(벽에 기대 둠) + 벽걸이 반쪽 파라솔 + 반달 선반 테이블 + 화분
  face(ex, b, '+z', -14.4, 0);
  ex.p('wood', bx(0.9, 1.25, 0.06, 0.6), [0, 0.62, 0.14], '#8a5a3c', [-0.12, 0, 0]).p('art', plane(0.74, 1.0, 0, art.uv(4)), [0, 0.66, 0.18], '#ffffff', [-0.12, 0, 0]);
  face(ex, b, '+z', -16.3, 0);
  ex.p('wood', cy(0.42, 0.42, 0.06, 18, false, 0, Math.PI), [0, 1.0, 0], '#c98f5b', [0, -Math.PI / 2, 0]).p('wood', bx(0.08, 1.0, 0.08, 0.6), [0, 0.5, 0.25], '#8a5a3c');
  ex.p('plain', cy(0.03, 0.03, 1.95, 6), [0, 1.97, 0.05], '#8a5a3c');
  for (let i = 0; i < 6; i++) ex.p('plain', new THREE.ConeGeometry(1.1, 0.55, 12, 1, true, -Math.PI / 2 + (i * Math.PI) / 6, Math.PI / 6), [0, 2.65, 0], i % 2 ? '#fffaf0' : '#7fc4b8');
  ex.p('plain', cy(0.05, 0.04, 0.1, 10), [0.12, 1.08, 0.1], '#ffffff').p('plain', cy(0.05, 0.04, 0.1, 10), [-0.14, 1.08, 0.14], '#ffd6e0');
  for (const x of [-14.3, -15.3]) pot(ex, x, b.cz - b.d / 2 - 0.45, 0.75);

  // 속: 마루 + 판넬 벽 + 벽지 + 몰딩 + 서까래 천장
  ex.at(b.cx, 0.04, b.cz).p('parquet', bx(b.w - 0.3, 0.09, b.d - 0.3, 1.6), [0, 0, 0], '#ffffff'); // 바닥은 겉에 둬서 멀리서 실내를 숨겨도 문 안이 비어 보이지 않게
  bands(k, b, 0, 1.05, 'wains', '#e8c9a2', { t: 1.2 });
  bands(k, b, 1.05, H - 0.12, 'paper', '#fff3e0', { t: 1.1 });
  bands(k, b, 1.02, 1.1, 'wood', '#b98454', { dz: 0.04, t: 0.8 });
  bands(k, b, H - 0.3, H - 0.12, 'plain', CREAM, { dz: 0.05 });
  k.at(b.cx, H - 0.06, b.cz).p('wood', bx(b.w - 0.3, 0.12, b.d - 0.3, 1.4), [0, 0, 0], '#f3dfc2');
  for (let x = b.cx - b.w / 2 + 1.2; x < b.cx + b.w / 2 - 0.5; x += 1.6) k.at(x, H - 0.24, b.cz).p('wood', bx(0.18, 0.22, b.d - 0.4, 0.8), [0, 0, 0], '#b98454');
  // 펜던트 등: 줄 + 갓 + 전구(블룸)
  [[-3.5, -2.5, '#8fd1c0'], [-3.5, 2.5, '#ffc9d4'], [0, 0, '#ffe08a'], [3.5, -2.5, '#ffc9d4'], [3.5, 2.5, '#8fd1c0']].forEach(([px, pz, c]) => {
    k.at(b.cx + px, 0, b.cz + pz).p('plain', cy(0.012, 0.012, 0.42, 5), [0, H - 0.33, 0], '#5d4b52');
    k.p('plain', lathe([[0.05, 0.36], [0.12, 0.33], [0.26, 0.12], [0.34, 0], [0.32, 0]], 16), [0, H - 0.9, 0], c);
    k.p('glow', sp(0.1, 10, 8), [0, H - 0.86, 0], hdr('#fff0c0', 4));
  });
  // 카운터: 나무 판 앞면 + 대리석 상판 + 에스프레소 머신 + 유리 진열장(케이크·빵) + 컵 + 뒷벽 선반·메뉴판
  const cf = FURN.find((f) => f.k === 'counter'), cx0 = cf.x, cz0 = cf.z;
  k.at(cx0, 0, cz0).p('wood', bx(cf.w, 0.95, cf.d, 0.7), [0, 0.5, 0], '#b9805a').p('plain', bx(cf.w - 0.1, 0.08, cf.d - 0.1), [0, 0.04, 0], '#6b4a34');
  for (let z = -cf.d / 2 + 0.45; z < cf.d / 2; z += 0.75) k.p('wood', bx(0.04, 0.7, 0.6, 0.5), [cf.w / 2 + 0.01, 0.5, z], '#d29a6e');
  k.p('plain', bx(cf.w + 0.2, 0.08, cf.d + 0.2), [0, 1.0, 0], '#f6efe6').p('shine', bx(0.03, 0.03, cf.d), [cf.w / 2 + 0.11, 0.97, 0], '#d9b46a');
  k.sub(0, 1.04, -2.2);
  k.p('shine', bx(0.6, 0.48, 0.75), [0, 0.24, 0], '#e8edf2').p('shine', bx(0.62, 0.06, 0.78), [0, 0.5, 0], '#c9a066');
  for (const s of [-1, 1]) { k.p('shine', cy(0.06, 0.06, 0.12, 10), [0.33, 0.28, s * 0.18], '#c9ced6'); k.p('plain', cy(0.03, 0.03, 0.22, 6), [0.4, 0.22, s * 0.18], '#3a2a28', [0, 0, Math.PI / 2]); k.p('plain', cy(0.06, 0.045, 0.08, 10), [0.36, 0.04, s * 0.18], '#ffffff'); }
  k.p('glow', sp(0.03, 6, 4), [0.31, 0.42, 0], hdr('#7ee787', 3)).p('glow', sp(0.03, 6, 4), [0.31, 0.42, 0.1], hdr('#ff6b6b', 3));
  for (let i = 0; i < 4; i++) k.p('plain', cy(0.05, 0.04, 0.07, 10), [-0.1 + (i % 2) * 0.15, 0.56, -0.2 + i * 0.13], '#fff6ee');
  k.at(cx0, 1.04, cz0 + 1.6);
  k.p('wood', bx(0.75, 0.08, 1.7, 0.5), [0, 0.04, 0], '#8a5a3c').p('glass', bx(0.72, 0.5, 1.66), [0, 0.33, 0], '#dff3ff').p('wood', bx(0.75, 0.04, 1.7, 0.5), [0, 0.6, 0], '#8a5a3c');
  [['#ffb3c7', '#fff4f6'], ['#7a4b2a', '#f3d3a6'], ['#fff1b0', '#ffffff']].forEach(([a, c], i) => {
    const z = -0.5 + i * 0.5; k.p('plain', cy(0.15, 0.15, 0.08, 16), [0, 0.13, z], a).p('plain', cy(0.15, 0.15, 0.04, 16), [0, 0.19, z], c).p('plain', cy(0.15, 0.15, 0.06, 16), [0, 0.24, z], a);
    k.p('plain', sp(0.035, 8, 6), [0.05, 0.3, z], '#e03a5a').p('plain', sp(0.035, 8, 6), [-0.05, 0.3, z + 0.04], '#e03a5a');
  });
  for (let i = 0; i < 3; i++) k.p('plain', new THREE.CapsuleGeometry(0.06, 0.16, 3, 8), [0.22, 0.12, -0.5 + i * 0.32], '#e3a865', [Math.PI / 2, 0, 0]);
  k.at(cx0, 1.04, cz0 - 0.6);
  for (let i = 0; i < 3; i++) k.p('plain', cy(0.07, 0.055, 0.1, 12), [0.25, 0.05 + i * 0.1, 0], ['#fff6ee', '#ffd6e0', '#cfe8ff'][i]);
  k.p('glass', cy(0.1, 0.1, 0.22, 12), [0.1, 0.11, 0.5], '#ffffff').p('plain', sp(0.04, 6, 4), [0.1, 0.06, 0.5], '#c98f5b').p('plain', sp(0.04, 6, 4), [0.13, 0.1, 0.46], '#e3a865');
  const bw = b.cx - b.w / 2 + 0.2; // 뒷벽 안쪽 면
  for (const y of [1.45, 1.95]) {
    k.at(bw, y, cz0).p('wood', bx(0.26, 0.05, 6.2, 0.6), [0.13, 0, 0], '#b98454');
    for (let i = 0; i < 14; i++) {
      const z = -2.9 + i * 0.44, kind = (i + (y > 1.6 ? 1 : 0)) % 4;
      if (kind === 0) k.p('plain', cy(0.07, 0.055, 0.12, 10), [0.13, 0.085, z], ['#ffffff', '#ffd6e0', '#cfe8ff'][i % 3]);
      else if (kind === 1) k.p('glass', cy(0.08, 0.08, 0.24, 10), [0.13, 0.145, z], '#ffe9c0').p('plain', cy(0.06, 0.06, 0.1, 10), [0.13, 0.08, z], ['#a0522d', '#f2c14e', '#c94f6d'][i % 3]);
      else if (kind === 2) for (let j = 0; j < 3; j++) k.p('plain', bx(0.18, 0.24 + j * 0.03, 0.06), [0.12, 0.15, z - 0.08 + j * 0.07], ['#e0735c', '#7fc4b8', '#ffd45a'][j]);
      else k.p('plain', cy(0.07, 0.06, 0.1, 10), [0.13, 0.075, z], '#c97b5d').p('plain', leaf(0.1, i), [0.13, 0.2, z], '#6cc47b');
    }
  }
  k.at(bw, 2.75, cz0, Math.PI / 2).p('wood', bx(3.35, 1.1, 0.06, 0.6), [0, 0, 0.01], '#8a5a3c').p('art', plane(3.2, 0.95, 0, art.uv(0, 2, 0.6)), [0, 0, 0.05], '#ffffff');
  // 테이블: 대리석 상판 + 나무 테두리 + 받침 + 컵·꽃병 / 의자: 쿠션 + 둥근 등받이 + 다리
  for (const f of FURN.filter((f) => f.k === 'table')) {
    k.at(f.x, 0, f.z);
    k.p('plain', cy(f.r, f.r, 0.06, 28), [0, 0.76, 0], '#f7f1ea').p('wood', new THREE.TorusGeometry(f.r, 0.035, 6, 28), [0, 0.76, 0], '#b98454', [Math.PI / 2, 0, 0]);
    k.p('shine', lathe([[0, 0], [0.32, 0], [0.32, 0.03], [0.07, 0.08], [0.05, 0.73], [0, 0.73]], 16), [0, 0, 0], '#5d4b52');
    k.p('plain', cy(0.075, 0.06, 0.1, 12), [0.22, 0.84, 0.1], '#ffffff').p('plain', cy(0.11, 0.11, 0.015, 14), [0.22, 0.795, 0.1], '#ffffff').p('plain', new THREE.TorusGeometry(0.03, 0.01, 4, 8), [0.3, 0.84, 0.1], '#ffffff');
    k.p('glass', cy(0.05, 0.07, 0.18, 10), [-0.15, 0.88, -0.1], '#cfe8ff').p('plain', cy(0.008, 0.008, 0.2, 4), [-0.15, 1.02, -0.1], '#4fae62').p('plain', sp(0.05, 8, 6), [-0.15, 1.13, -0.1], ['#ff8fb1', '#ffd84a', '#c9a8ff', '#ffffff'][Math.abs(Math.round(f.z)) % 4]);
  }
  const chair = (s, cushion) => {
    k.at(s.x, 0, s.z, s.ry);
    k.p('plain', cy(0.24, 0.24, 0.08, 16), [0, 0.42, 0], cushion).p('wood', cy(0.25, 0.25, 0.03, 16), [0, 0.37, 0], '#b98454');
    for (const [lx, lz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) k.p('wood', cy(0.02, 0.025, 0.37, 6), [lx, 0.185, lz], '#8a5a3c');
    k.p('wood', new THREE.TorusGeometry(0.24, 0.025, 6, 16, Math.PI), [0, 0.75, -0.2], '#8a5a3c', [0, 0, 0]);
    for (const lx of [-0.24, 0.24]) k.p('wood', cy(0.02, 0.02, 0.38, 6), [lx, 0.57, -0.2], '#8a5a3c');
  };
  SEATS.filter((s) => s.kind === 'cafe' && !STOOLS.some((st) => st.x === s.x && st.z === s.z)).forEach((s) => chair(s, '#e0735c'));
  for (const st of STOOLS) { k.at(st.x, 0, st.z).p('plain', cy(0.24, 0.22, 0.1, 16), [0, 0.42, 0], '#e0735c').p('shine', cy(0.04, 0.04, 0.38, 8), [0, 0.19, 0], '#d9dde2').p('shine', new THREE.TorusGeometry(0.17, 0.015, 4, 16), [0, 0.18, 0], '#d9dde2', [Math.PI / 2, 0, 0]).p('shine', cy(0.2, 0.22, 0.03, 16), [0, 0.015, 0], '#d9dde2'); }
  // 둥근 러그(겹 무늬) + 화분 + 벽 액자
  k.at(-19.5, 0.1, -4);
  [[2.2, '#f6c1cf'], [1.95, '#fff4e4'], [1.75, '#f6c1cf'], [1.2, '#ffe1a8'], [0.5, '#f6c1cf']].forEach(([r, c], i) => k.p('plain', new THREE.CircleGeometry(r, 36), [0, i * 0.003, 0], c, [-Math.PI / 2, 0, 0]));
  for (const f of FURN.filter((f) => f.k === 'plant' && f.x < 0)) pot(k, f.x, f.z, 1.15, 0.09);
  [['-z', -21.4, 5], ['-z', -17.2, 6], ['+z', -21.4, 7], ['+z', -17.2, 8], ['-z', -25.4, 9]].forEach(([side, x, cell]) => {
    face(k, b, side, x, 2.45, false).p('wood', bx(0.86, 0.66, 0.05, 0.6), [0, 0, 0.03], '#a8693f').p('art', plane(0.72, 0.52, 0, art.uv(cell)), [0, 0, 0.06], '#ffffff');
  });
  build(ex, g, false, { art: artMat(art.tex, 1.05) });
  build(k, gi, true, { art: artMat(art.tex) });
  return gi;
}
// 줄무늬 차양: 비스듬한 천 + 물결 앞자락
function awningMesh(w, d, tex) {
  const grp = new THREE.Group(), mat = new THREE.MeshToonMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, gradientMap: mats().plain.gradientMap });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); top.rotation.x = -Math.PI / 2 + 0.45; top.position.set(0, 0, d / 2 * Math.cos(0.45)); top.castShadow = true;
  const g2 = new THREE.PlaneGeometry(w, 0.32), uv = g2.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.3);
  const front = new THREE.Mesh(g2, mat); front.position.set(0, -d / 2 * Math.sin(0.45) - 0.16, d * Math.cos(0.45));
  grp.add(top, front);
  return grp;
}
function cafeArt() {
  return TX.atlas('cafeArt', 4, 256, [
    (x, w, h) => { // 0~1: 메뉴 칠판(2칸 폭 × 0.6 높이 사용)
      const W = w * 2, Hh = h * 0.6; x.fillStyle = '#2f3b36'; x.fillRect(0, 0, W, Hh);
      x.fillStyle = '#fff6e0'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText('☕ MENU', W / 2, 40);
      x.font = '22px sans-serif'; x.textAlign = 'left';
      [['아메리카노', '3.0'], ['카페라떼', '3.5'], ['딸기케이크', '4.5'], ['크루아상', '2.8']].forEach(([n, p], i) => { const cx = i < 2 ? 30 : W / 2 + 20, cy = 80 + (i % 2) * 34; x.fillStyle = '#fff6e0'; x.fillText(n, cx, cy); x.fillStyle = '#ffd38a'; x.fillText(p, cx + 160, cy); });
      x.strokeStyle = '#ffb3c7'; x.lineWidth = 3; x.beginPath(); x.moveTo(20, 52); x.lineTo(W - 20, 52); x.stroke();
    },
    () => {}, () => {}, () => {},
    (x, w, h) => { // 4: 입간판 칠판
      x.fillStyle = '#2f3b36'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff6e0'; x.textAlign = 'center';
      x.font = 'bold 40px sans-serif'; x.fillText('OPEN', w / 2, 56); x.font = '26px sans-serif'; x.fillText('오늘의 커피', w / 2, 110); x.fillStyle = '#ffd38a'; x.fillText('라떼 ♡', w / 2, 150);
      x.fillStyle = '#ffb3c7'; x.beginPath(); x.arc(w / 2 - 14, 200, 14, 0, 7); x.arc(w / 2 + 14, 200, 14, 0, 7); x.fill(); x.beginPath(); x.moveTo(w / 2 - 28, 205); x.lineTo(w / 2, 236); x.lineTo(w / 2 + 28, 205); x.fill();
    },
    (x, w, h) => { x.fillStyle = '#ffe9d0'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(w / 2, h * 0.62, 60, 46, 0, 0, 7); x.fill(); x.fillStyle = '#a0522d'; x.beginPath(); x.ellipse(w / 2, h * 0.5, 54, 14, 0, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 8; x.beginPath(); x.arc(w / 2 + 62, h * 0.62, 18, -1.2, 1.2); x.stroke(); x.strokeStyle = 'rgba(160,82,45,.5)'; x.lineWidth = 5; for (const dx of [-16, 0, 16]) { x.beginPath(); x.moveTo(w / 2 + dx, h * 0.38); x.bezierCurveTo(w / 2 + dx + 12, h * 0.3, w / 2 + dx - 12, h * 0.24, w / 2 + dx, h * 0.16); x.stroke(); } },
    (x, w, h) => { x.fillStyle = '#d9f0e8'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffb36b'; x.beginPath(); x.ellipse(w / 2, h * 0.65, 64, 50, 0, 0, 7); x.fill(); x.beginPath(); x.arc(w / 2, h * 0.38, 44, 0, 7); x.fill(); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 40, h * 0.3); x.lineTo(w / 2 + s * 28, h * 0.12); x.lineTo(w / 2 + s * 12, h * 0.26); x.fill(); x.fillStyle = '#3a2a36'; x.beginPath(); x.arc(w / 2 + s * 16, h * 0.38, 5, 0, 7); x.fill(); x.fillStyle = '#ffb36b'; } },
    (x, w, h) => { x.fillStyle = '#fff4d6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { const px = 50 + i * 40, py = 100 + (i % 2) * 40; x.strokeStyle = '#6cc47b'; x.lineWidth = 5; x.beginPath(); x.moveTo(px, h); x.lineTo(px, py); x.stroke(); x.fillStyle = ['#ff8fb1', '#ffd84a', '#c9a8ff', '#ff8f6b', '#8fd1ff'][i]; for (let p = 0; p < 5; p++) { const a = (p / 5) * 6.28; x.beginPath(); x.arc(px + Math.cos(a) * 12, py + Math.sin(a) * 12, 10, 0, 7); x.fill(); } x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); } },
    (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd3ff'); g.addColorStop(1, '#ffe2f0'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#7cc47b'; x.beginPath(); x.ellipse(w * 0.3, h, 140, 90, 0, 0, 7); x.ellipse(w * 0.8, h, 120, 70, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(70, 60, 22, 0, 7); x.arc(98, 52, 26, 0, 7); x.arc(126, 62, 20, 0, 7); x.fill(); },
    (x, w, h) => { x.fillStyle = '#ffe1e8'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a4b2a'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.fillText('since', w / 2, 100); x.font = 'bold 64px sans-serif'; x.fillText('2024', w / 2, 170); },
    (x, w) => { x.fillStyle = '#7a4b2a'; x.beginPath(); x.roundRect(3, 3, w - 6, 76, 22); x.fill(); x.strokeStyle = 'rgba(255,241,220,.6)'; x.lineWidth = 3; x.beginPath(); x.roundRect(9, 9, w - 18, 64, 17); x.stroke(); x.fillStyle = '#fff1dc'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('☕ CAFE', w / 2, 44); },
  ]);
}

/* ───── 회사 ───── */
function office(scene) {
  const b = BUILDINGS.office, g = new THREE.Group(), gi = new THREE.Group(), ex = new Kit(), k = new Kit();
  scene.add(g); g.add(gi);
  const H = b.h, MUL = '#5f7591', GL = '#8fc2ea', art = officeArt();
  // 겉: 밝은 벽 + 푸른 유리 커튼월(창살 격자, 가운데 흰 층 띠) + 기단 + 위 테두리
  shellWalls(ex, b, 'plain', '#eef2f7');
  for (const side of ['-z', '+z', '-x', '+x']) {
    const alongX = side[1] === 'z', c = alongX ? b.cx : b.cz, half = (alongX ? b.w : b.d) / 2;
    face(ex, b, side, c, 0.2).p('stone', bx(half * 2 + 0.1, 0.4, 0.1, 1), [0, 0, 0.02], '#cfd5dd');
    face(ex, b, side, c, H - 0.25).p('plain', bx(half * 2 + 0.3, 0.5, 0.16), [0, 0, 0.04], '#f7f9fc');
    face(ex, b, side, c, 2.15).p('plain', bx(half * 2, 0.36, 0.12), [0, 0, 0.04], '#ffffff');
    const n = Math.round((half * 2 - 0.6) / 1.5), step = (half * 2 - 0.6) / n;
    for (let i = 0; i < n; i++) {
      const a = c - half + 0.3 + (i + 0.5) * step;
      if (side === b.door && Math.abs(a - c) < b.dw / 2 + 0.6) continue;
      for (const [y, h] of [[1.2, 1.5], [3.05, 1.2]]) { face(ex, b, side, a, y); ex.p('win', plane(step - 0.1, h), [0, 0, 0.07], hdr(GL, 0.95)); face(k, b, side, a, y, false); k.p('winIn', plane(step - 0.1, h), [0, 0, 0.03], hdr('#e6f4ff', 1.1)); }
    }
    for (let i = 0; i <= n; i++) {
      const a = c - half + 0.3 + i * step;
      if (side === b.door && Math.abs(a - c) < b.dw / 2 + 0.4) continue;
      face(ex, b, side, a, H / 2 - 0.1).p('shine', bx(0.1, H - 0.6, 0.1), [0, 0, 0.1], MUL);
      face(k, b, side, a, H / 2 - 0.1, false).p('plain', bx(0.08, H - 0.6, 0.06), [0, 0, 0.04], '#d6dee8');
    }
    for (const y of [0.42, 3.68]) { face(ex, b, side, c, y).p('shine', bx(half * 2 - 0.4, 0.08, 0.1), [0, 0, 0.1], MUL); }
  }
  // 입구: 유리문 틀 + 캔틸레버 캐노피(아래 조명) + 간판 + 양옆 긴 화단
  const [dx, dz] = doorPos(b);
  ex.at(dx, 0, dz, -Math.PI / 2).sub(0, 0, 0.2);
  for (const s of [-1, 1]) { ex.p('shine', bx(0.14, 2.75, 0.18), [s * (b.dw / 2 + 0.07), 1.37, 0.03], MUL); ex.p('glass', bx(0.9, 2.6, 0.04), [s * (b.dw / 2 + 0.55), 1.3, 0.14], '#bfe3ff'); ex.p('shine', bx(0.04, 0.8, 0.06), [s * (b.dw / 2 + 0.2), 1.2, 0.18], '#e8edf2'); }
  ex.p('plain', bx(b.dw + 2.2, 0.22, 2.0), [0, 3.0, 1.0], '#f7f9fc').p('shine', bx(b.dw + 2.24, 0.08, 2.04), [0, 2.87, 1.0], MUL);
  for (const s of [-1, 0, 1]) ex.p('glow', cy(0.12, 0.12, 0.02, 12), [s * 1.6, 2.88, 1.2], hdr('#fff6e0', 3.5));
  for (const s of [-1, 1]) ex.p('shine', cy(0.025, 0.025, 2.2, 6), [s * (b.dw / 2 + 0.6), 3.7, 1.0], '#c9ced6', [-1.05, 0, 0]);
  ex.at(dx - 0.45, 3.55, dz, -Math.PI / 2).p('art', plane(3.2, 0.8, 0, art.uv(0, 1, 0.25)), [0, 0, 0], '#ffffff');
  for (const s of [-1, 1]) {
    ex.at(dx, 0, dz + s * (b.dw / 2 + 2.6), -Math.PI / 2).sub(0, 0, 0.2);
    ex.p('stone', bx(3.4, 0.5, 0.36, 0.8), [0, 0.25, 0.18], '#dfe3e8').p('plain', bx(3.3, 0.05, 0.3), [0, 0.5, 0.18], '#6b4a34');
    for (let i = 0; i < 5; i++) ex.p('plain', leaf(0.28, i + s), [-1.3 + i * 0.65, 0.68, 0.18], ['#4fae62', '#6cc47b', '#5bb86c'][i % 3]);
  }
  // 옥상: 난간 + 에어컨 실외기 + 물탱크 + 환기구
  ex.at(b.cx, H, b.cz);
  ex.p('plain', bx(b.w + 0.6, 0.5, b.d + 0.6), [0, 0.25, 0], '#d9e1ea').p('plain', bx(b.w - 0.2, 0.08, b.d - 0.2), [0, 0.52, 0], '#b8c4d2');
  for (const [w, d, x, z] of [[b.w + 0.6, 0.2, 0, b.d / 2 + 0.2], [b.w + 0.6, 0.2, 0, -b.d / 2 - 0.2], [0.2, b.d + 0.6, b.w / 2 + 0.2, 0], [0.2, b.d + 0.6, -b.w / 2 - 0.2, 0]]) ex.p('plain', bx(w, 0.35, d), [x, 0.68, z], '#f7f9fc');
  for (const [x, z] of [[-4, -3], [-2, -3], [-4, 3]]) { ex.p('plain', bx(1.3, 0.9, 0.8), [x, 1.0, z], '#e9edf2'); ex.p('shine', cy(0.32, 0.32, 0.04, 16), [x, 1.0, z + 0.41], '#7d8a99', [Math.PI / 2, 0, 0]); ex.p('plain', bx(0.5, 0.06, 0.06), [x, 1.0, z + 0.44], '#5f7591', [0, 0, 0.8]); }
  ex.p('shine', cy(0.9, 0.9, 1.6, 18), [4, 2.15, 2], '#c9d6e4').p('shine', new THREE.SphereGeometry(0.9, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2), [4, 2.95, 2], '#c9d6e4');
  for (const [x, z] of [[3.4, 1.4], [4.6, 1.4], [3.4, 2.6], [4.6, 2.6]]) ex.p('shine', bx(0.08, 0.8, 0.08), [x, 0.95, z], '#7d8a99');
  ex.p('shine', cy(0.2, 0.2, 0.7, 10), [3, 0.9, -3.5], '#c9ced6').p('shine', new THREE.ConeGeometry(0.32, 0.25, 10), [3, 1.38, -3.5], '#c9ced6');

  // 속: 카펫 타일 + 벽 판넬 + 천장 격자 + 조명판
  ex.at(b.cx, 0.04, b.cz).p('carpet', bx(b.w - 0.3, 0.09, b.d - 0.3, 1.2), [0, 0, 0], '#ffffff');
  bands(k, b, 0, 0.42, 'wood', '#e3c9a3', { t: 0.8 });
  bands(k, b, 0.4, 0.45, 'plain', '#ffffff', { dz: 0.03 });
  k.at(b.cx, H - 0.06, b.cz).p('plain', bx(b.w - 0.3, 0.12, b.d - 0.3), [0, 0, 0], '#f4f7fa');
  for (let x = b.cx - b.w / 2 + 1.2; x < b.cx + b.w / 2; x += 1.2) k.at(x, H - 0.13, b.cz).p('plain', bx(0.04, 0.02, b.d - 0.4), [0, 0, 0], '#d8dfe7');
  for (let z = b.cz - b.d / 2 + 1.2; z < b.cz + b.d / 2; z += 1.2) k.at(b.cx, H - 0.13, z).p('plain', bx(b.w - 0.4, 0.02, 0.04), [0, 0, 0], '#d8dfe7');
  for (const ox of [-4.5, 0, 4.5]) for (const oz of [-3.5, 3.5]) { k.at(b.cx + ox, H - 0.15, b.cz + oz).p('plain', bx(3.1, 0.06, 0.5), [0, 0, 0], '#cfd8e2').p('glow', bx(2.9, 0.02, 0.36), [0, -0.035, 0], hdr('#f4fbff', 2.2)); }
  // 책상: 원목 상판 + 금속 다리 + 칸막이 + 모니터·키보드·마우스·머그·서류·화분 / 의자: 바퀴 달린 사무 의자
  FURN.filter((f) => f.k === 'desk').forEach((f, i) => {
    k.at(f.x, 0, f.z, f.f > 0 ? 0 : Math.PI); // 앉는 쪽이 +z
    k.p('wood', bx(f.w, 0.05, f.d, 0.9), [0, 0.75, 0], '#ecd8b8');
    for (const sx of [-1, 1]) { k.p('shine', bx(0.06, 0.72, 0.06), [sx * (f.w / 2 - 0.08), 0.36, 0.42], '#9aa6b4').p('shine', bx(0.06, 0.72, 0.06), [sx * (f.w / 2 - 0.08), 0.36, -0.42], '#9aa6b4').p('shine', bx(0.06, 0.05, f.d - 0.2), [sx * (f.w / 2 - 0.08), 0.06, 0], '#9aa6b4'); }
    k.p('plain', bx(f.w - 0.3, 0.4, 0.03), [0, 0.45, -0.45], '#d8dfe7');
    k.p('plain', bx(f.w, 0.55, 0.06), [0, 1.05, -f.d / 2 + 0.03], '#9fb6d0').p('plain', bx(f.w + 0.04, 0.05, 0.08), [0, 1.34, -f.d / 2 + 0.03], '#7d93ad');
    for (const sx of [-1, 1]) k.p('plain', bx(0.06, 0.5, f.d - 0.1), [sx * (f.w / 2 - 0.03), 1.02, 0], '#b3c6dc');
    k.p('plain', bx(0.82, 0.52, 0.05), [0, 1.13, -0.25], '#2f3542').p('plain', bx(0.07, 0.3, 0.05), [0, 0.92, -0.29], '#555e6b').p('plain', bx(0.3, 0.02, 0.2), [0, 0.785, -0.29], '#555e6b');
    k.p('plain', bx(0.55, 0.025, 0.18), [-0.05, 0.79, 0.15], '#eef1f5').p('plain', bx(0.07, 0.03, 0.11), [0.38, 0.79, 0.16], '#eef1f5');
    k.p('plain', cy(0.05, 0.045, 0.11, 12), [0.75, 0.83, 0.05], ['#ff8fb1', '#ffd45a', '#8fd1c0', '#9fb6ff'][i % 4]).p('plain', new THREE.TorusGeometry(0.03, 0.01, 4, 8), [0.81, 0.83, 0.05], '#ffffff');
    for (let j = 0; j < 3; j++) k.p('plain', bx(0.3, 0.01, 0.4), [-0.75 + j * 0.02, 0.78 + j * 0.012, 0.0 + j * 0.03], '#ffffff', [0, j * 0.15, 0]);
    k.p('plain', cy(0.06, 0.05, 0.09, 10), [-0.98, 0.82, -0.3], '#e9edf2').p('plain', leaf(0.08, i), [-0.98, 0.93, -0.3], '#6cc47b');
    k.p('art', plane(0.74, 0.44, 0, art.uv(4 + (i % 3))), [0, 1.13, -0.22], '#ffffff');
    const s = SEATS.find((s) => s.kind === 'office' && Math.abs(s.x - f.x) < 0.01 && Math.sign(s.z - f.z) === f.f);
    k.at(f.x, 0, f.z + f.f * 1.0, s.ry);
    k.p('plain', bx(0.5, 0.09, 0.48), [0, 0.47, 0.02], '#4a5568').p('plain', bx(0.48, 0.55, 0.08), [0, 0.82, -0.24], '#4a5568', [-0.08, 0, 0]);
    k.p('shine', cy(0.035, 0.035, 0.36, 8), [0, 0.26, 0], '#9aa6b4');
    for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2; k.p('shine', bx(0.04, 0.04, 0.3), [Math.sin(a) * 0.15, 0.07, Math.cos(a) * 0.15], '#555e6b', [0, a, 0]).p('plain', sp(0.035, 6, 4), [Math.sin(a) * 0.29, 0.035, Math.cos(a) * 0.29], '#2f3542'); }
  });
  // 회의 탁자 + 밀어 넣은 의자 + 노트북 / 벽 화이트보드
  const mt = FURN.find((f) => f.k === 'meeting');
  k.at(mt.x, 0, mt.z).p('wood', bx(mt.w, 0.07, mt.d, 0.9), [0, 0.76, 0], '#d9b48a').p('plain', bx(0.4, 0.7, mt.d - 0.8), [0, 0.36, 0], '#8d6b4a');
  for (const z of [-1.1, 0, 1.1]) for (const s of [-1, 1]) { k.p('plain', bx(0.46, 0.08, 0.44), [s * (mt.w / 2 + 0.05), 0.47, z], '#7d93ad').p('plain', bx(0.08, 0.5, 0.44), [s * (mt.w / 2 + 0.25), 0.78, z], '#7d93ad'); }
  for (const z of [-1.1, 1.1]) { k.p('plain', bx(0.32, 0.02, 0.24), [-0.35, 0.805, z], '#c9ced6').p('plain', bx(0.32, 0.22, 0.02), [-0.35, 0.92, z - 0.12], '#c9ced6', [-0.3, 0, 0]); }
  const wb = b.cx + b.w / 2 - 0.2;
  k.at(wb, 1.65, mt.z, -Math.PI / 2).p('shine', bx(2.6, 1.3, 0.05), [0, 0, 0.03], '#c9ced6').p('plain', bx(2.5, 0.05, 0.12), [0, -0.66, 0.08], '#c9ced6');
  k.p('art', plane(2.46, 1.2, 0, art.uv(8, 2, 1)), [0, 0, 0.065], '#ffffff');
  // 정수기 + 커피 코너(벽에 붙은 장) + 큰 화분 + 책장 + 벽 그림·시계
  const cl = FURN.find((f) => f.k === 'cooler');
  k.at(cl.x, 0, cl.z).p('plain', bx(0.42, 0.95, 0.42), [0, 0.475, 0], '#f4f7fa').p('glass', cy(0.17, 0.17, 0.48, 14), [0, 1.2, 0], '#7fc8ff').p('plain', cy(0.07, 0.07, 0.06, 10), [0, 1.47, 0], '#4f9fe0');
  k.p('glow', bx(0.05, 0.05, 0.02), [-0.08, 0.8, 0.22], hdr('#7fc8ff', 2.5)).p('glow', bx(0.05, 0.05, 0.02), [0.08, 0.8, 0.22], hdr('#ff7b7b', 2.5));
  face(k, b, '+z', 17.1, 0, false);
  k.p('wood', bx(1.4, 0.9, 0.36, 0.7), [0, 0.45, 0.18], '#ecd8b8').p('plain', bx(1.44, 0.04, 0.4), [0, 0.92, 0.2], '#ffffff');
  k.p('shine', bx(0.34, 0.42, 0.3), [-0.35, 1.15, 0.2], '#3a3f4a').p('glow', bx(0.08, 0.05, 0.01), [-0.35, 1.28, 0.355], hdr('#9fe0ff', 2.5));
  for (let i = 0; i < 4; i++) k.p('plain', cy(0.045, 0.04, 0.1, 10), [0.15 + i * 0.13, 0.99, 0.2], ['#ffffff', '#ff8fb1', '#ffd45a', '#8fd1c0'][i]);
  k.p('plain', bx(1.2, 0.04, 0.22), [0, 1.65, 0.11], '#ecd8b8').p('plain', cy(0.06, 0.05, 0.1, 10), [0.4, 1.72, 0.11], '#ffffff').p('plain', leaf(0.12, 3), [0.4, 1.85, 0.11], '#5bb86c');
  const pl = FURN.find((f) => f.k === 'plant' && f.x > 10);
  pot(k, pl.x, pl.z, 1.2, 0.09, '#e9edf2');
  k.at(pl.x, 0.09, pl.z).p('plain', cy(0.025, 0.03, 1.1, 6), [0, 1.0, 0], '#7a5c46'); [[0, 1.75, 0, 0.32], [0.2, 1.55, 0.1, 0.24], [-0.18, 1.6, -0.08, 0.26]].forEach(([x, y, z, r], i) => k.p('plain', leaf(r, i + 9), [x, y, z], ['#4fae62', '#3f9a55', '#5bb86c'][i]));
  face(k, b, '-x', -2.75, 0, false).p('wood', bx(1.5, 2.0, 0.34, 0.8), [0, 1.0, 0.17], '#d9b48a');
  for (const y of [0.45, 0.95, 1.45]) { k.p('wood', bx(1.4, 0.04, 0.3), [0, y, 0.2], '#c49a6c'); for (let i = 0; i < 9; i++) k.p('plain', bx(0.1, 0.32 + (i % 3) * 0.04, 0.24), [-0.6 + i * 0.13, y + 0.18, 0.2], ['#e0735c', '#4dabf7', '#ffd45a', '#51cf66', '#9775fa', '#f783ac'][(i + y * 10) % 6 | 0]); }
  [['-z', 18.5, 10], ['-z', 25.5, 11], ['+z', 22, 12]].forEach(([side, x, cell]) => face(k, b, side, x, 2.85, false).p('shine', bx(1.1, 0.8, 0.04), [0, 0, 0.03], '#c9a066').p('art', plane(0.98, 0.68, 0, art.uv(cell)), [0, 0, 0.06], '#ffffff'));
  build(ex, g, false, { art: artMat(art.tex, 1.05) });
  build(k, gi, true, { art: artMat(art.tex, 1.05) });
  return gi;
}
function officeArt() {
  const ui = (bg, bar) => (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(0, 0, w, 22); x.fillStyle = bar; for (let i = 0; i < 6; i++) x.fillRect(16 + i * 38, h - 30 - ((i * 37) % 90) - 30, 26, ((i * 37) % 90) + 30); x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 5; i++) x.fillRect(16, 36 + i * 14, 60 + ((i * 53) % 120), 6); };
  return TX.atlas('officeArt', 4, 256, [
    (x, w) => { x.fillStyle = '#3d5a80'; x.beginPath(); x.roundRect(4, 4, w - 8, 56, 16); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('💼 OFFICE', w / 2, 46); },
    () => {}, () => {}, () => {},
    ui('#2b4a7a', '#7ee0c0'), ui('#3a2f63', '#ffb36b'), ui('#1f5a5a', '#ffd45a'), () => {},
    (x, w, h) => { const W = w * 2; x.fillStyle = '#fbfdff'; x.fillRect(0, 0, W, h); x.strokeStyle = '#4dabf7'; x.lineWidth = 5; x.strokeRect(40, 40, 120, 70); x.strokeRect(220, 40, 120, 70); x.beginPath(); x.moveTo(160, 75); x.lineTo(220, 75); x.stroke(); x.strokeStyle = '#ff6b81'; x.beginPath(); x.moveTo(40, 200); x.bezierCurveTo(140, 140, 240, 240, 460, 150); x.stroke(); x.fillStyle = '#3a3f4a'; x.font = 'bold 28px sans-serif'; x.fillText('이번 주 목표 ✓', 300, 220); x.fillStyle = '#ffd45a'; x.fillRect(380, 30, 90, 90); x.fillStyle = '#3a3f4a'; x.font = '20px sans-serif'; x.fillText('회의 3시', 388, 80); },
    () => {},
    (x, w, h) => { x.fillStyle = '#e8f4ff'; x.fillRect(0, 0, w, h); x.fillStyle = '#4dabf7'; x.beginPath(); x.arc(80, 90, 40, 0, 7); x.fill(); x.fillStyle = '#ffd45a'; x.fillRect(130, 60, 80, 120); x.fillStyle = '#ff8fb1'; x.beginPath(); x.moveTo(30, 230); x.lineTo(130, 130); x.lineTo(230, 230); x.fill(); },
    (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffe1a8'); g.addColorStop(1, '#ff9fb0'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.arc(w * 0.7, h * 0.35, 36, 0, 7); x.fill(); x.fillStyle = '#5a8fd6'; x.beginPath(); x.moveTo(0, h); x.lineTo(w * 0.35, h * 0.45); x.lineTo(w * 0.7, h); x.fill(); x.fillStyle = '#4fae62'; x.beginPath(); x.moveTo(w * 0.4, h); x.lineTo(w * 0.75, h * 0.55); x.lineTo(w, h); x.fill(); },
    (x, w, h) => { x.fillStyle = '#f3fff4'; x.fillRect(0, 0, w, h); x.fillStyle = '#3d5a80'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('TEAM', w / 2, 110); x.font = '30px sans-serif'; x.fillText('포근마을 🌱', w / 2, 170); },
  ]);
}

// 반환: 건물별 실내 그룹 (멀리 있으면 game.js 가 숨겨 그리기 호출·삼각형 절약)
export const createBuildings = (scene) => ({ cafe: cafe(scene), office: office(scene) });
