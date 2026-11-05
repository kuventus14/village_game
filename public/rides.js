// 놀이기구 화면: 대관람차·회전목마·꼬마기차(선로·역 3곳) + 2단계 A(드롭타워·바이킹·회전그네·롤러코스터·후룸라이드) 모양 + 움직임, 타기 안내 패널(E / 버튼), 탄 사람(나·남) 자리 따라가기, 타는 동안 시점, 소리
// 움직임은 전부 ridesdata.js 의 시간 함수(서버 시각) → 서버가 위치를 프레임마다 보내지 않음. 규칙(탈 수 있나·자리)은 서버 rides.js 가 심판, 화면은 보여 주기만 함
// game.js 가 createRides({ scene, camera, Q, players, getMe, send, toast, bubble, host, aim }) 를 한 번 부르고, 서버 메시지마다 handle(m), 키마다 key(e),
// 매 프레임(플레이어 위치 계산 전에) update(dt) 를 부름. busy() 면 걷기 입력을 막음. 탄 사람 p 에는 p.ride = { id, seat, kind, h } (avatar.animate 의 앉기 자리) 를 붙임
// 성능: 재질별로 합친 메시 + 곤돌라·객차는 인스턴스, 회전목마 동물 위아래는 셰이더, 기구마다 거리 숨김. 연결 약속: docs/PARK.md · 새 기구: docs/RIDES.md
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RIDES, FERRIS, CAROUSEL, TRAIN, TRAIN_PATH, TRAIN_STATIONS, TRAIN_HUTS, ferrisAt, gondolaAt, carouselAt, carouselAnimal, carouselAngle, trainState, trainCarS, trainAtSmooth, PARK_CENTER, PARK_FAR,
  DROP, VIKING, SWING, COASTER, COASTER_PATH, COASTER_POSTS, FLUME, FLUME_PATH, FLUME_POSTS, FLUME_CAVE, dropAt, vikingAt, vikingSeat, swingAt, swingSeatA, coasterAt, coasterCarS, flumeBoat,
  BUMPER, TEACUPS, bumperStep, bumperAt, bumperUnpack, teacupsAt, cupSpin, cupLevel, cupHome } from './world.js';
import { soft, Batch, nightGlow, patch, paint } from './gfx.js';
import { Kit, bx, cy, sp, hdr, signTex, buildKit, lathe } from './buildings.js';
import { sfx } from './sfx.js';
import { fx } from './fx.js';
import { RIDE_SLOTS } from './parkdata.js';

const PI = Math.PI, TAU = PI * 2, TOUCH = matchMedia('(pointer:coarse)').matches;
const CREAM = '#fff4e6', PINK = '#ffc4d2', HOT = '#ff8fb1', MINT = '#8fdcc4', GOLD = '#ffd45a', LILAC = '#cdb6ff', SKY = '#9fd3ff', LEMON = '#fff0a0', PEACH = '#ffc9a8';
const PASTEL = [PINK, MINT, LEMON, LILAC, SKY, PEACH];
const BULB = ['#ffe6a0', '#ffb3c8', '#b8f0dc', '#c9b8ff'].map((c) => hdr(c, 2.2)); // 전구 색 (밤엔 블룸)
const SEAT_H = 0.45; // 아바타 앉는 높이 (avatar.animate: lift = h - 0.32)
const CSS = `
#rdq{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(78px + env(safe-area-inset-bottom));padding:9px 16px;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:200px;max-width:94vw;animation:pop .2s;z-index:3;text-align:center}
#rdq b{font-size:17px}#rdq small{opacity:.72;font-size:13px}
#rdq button{padding:8px 16px;min-height:40px;border-radius:14px;background:#ff8fb1;border:2px solid #ff8fb1;color:#fff;font-size:15px;touch-action:manipulation}
#rdq button:disabled{background:#fff;color:#b9a9a0;border-color:#f0d9c4}
#rdq kbd{font:12px/1 inherit;background:#0002;border-radius:5px;padding:2px 5px;margin-left:5px}
#rdq.ride{bottom:calc(14px + env(safe-area-inset-bottom));padding:6px 14px;flex-direction:row;flex-wrap:wrap;justify-content:center;gap:8px 10px}#rdq.ride b{font-size:15px}#rdq .lv{color:#ff8fb1;letter-spacing:1px;font-size:15px}
@media (max-height:520px) and (orientation:landscape){#rdq{bottom:calc(14px + env(safe-area-inset-bottom));padding:6px 12px;max-width:calc(100vw - 260px)}#rdq b{font-size:15px}#rdq button{min-height:36px;padding:5px 12px}}`;

// 별 모양 판 (park-site.js 와 같은 모양)
function starGeo(r, depth = 0.6, inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = PI / 2 + (i * PI) / 5, rr = i % 2 ? r * inner : r; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: r * 0.08, bevelSegments: 2 }).translate(0, 0, -depth / 2);
}
// 두 점 사이 막대 (Kit 의 기준 위치를 원점으로 되돌리고 그림)
const UP = new THREE.Vector3(0, 1, 0), qq = new THREE.Quaternion(), ee = new THREE.Euler(), va = new THREE.Vector3(), vb = new THREE.Vector3();
function rod(k, key, a, b, r0, r1, color, n = 8) {
  va.set(...a); vb.set(...b); const d = vb.clone().sub(va), L = d.length();
  qq.setFromUnitVectors(UP, d.normalize()); ee.setFromQuaternion(qq);
  return k.at(0, 0, 0).p(key, cy(r1, r0, L, n), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], color, [ee.x, ee.y, ee.z]); // 월드(또는 그룹) 좌표 그대로
}
// 판에 글 (양면, 밤엔 조금 어둡게). 멀면 숨김
function board(parent, tex, w, h, x, y, z, ry, far = 150) {
  const mat = nightGlow(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3 }), 1, 0.62, 0.5), two = new THREE.Group(), lod = new THREE.LOD();
  for (const s of [0, PI]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.y = ry + s; m.position.set(Math.sin(ry + s) * 0.02, 0, Math.cos(ry + s) * 0.02); two.add(m); }
  lod.addLevel(two, 0); lod.addLevel(new THREE.Object3D(), far); lod.position.set(x, y, z); parent.add(lod);
}
const geoOf = (kit, key) => kit.geometry(key); // Kit 한 묶음을 합친 지오메트리 (인스턴스용)
// 둥근 지붕 줄무늬: 삼각형마다 각도로 색 (정점 공유 안 함 → 줄이 또렷)
function stripes(geo, n, colors) {
  geo = geo.toNonIndexed(); const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = colors.map((x) => new THREE.Color(x));
  for (let i = 0; i < p.count; i += 3) { const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, k = Math.floor((((Math.atan2(x, z) / TAU) % 1) + 1) % 1 * n) % col.length; for (let j = 0; j < 3; j++) col[k].toArray(c, (i + j) * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}

/* ───────────── ① 대관람차 ───────────── */
function buildFerris(root, lite) {
  const F = FERRIS, g = new THREE.Group(); g.name = 'ride-ferris'; root.add(g);
  // 서 있는 뼈대: A자 다리 4개 + 옆 가새 + 축 + 받침 + 승강장(나무 바닥·난간·입구 아치)
  const k = new Kit(), top = (sx) => [F.x + sx * 2.9, F.hub, F.z], foot = (sx, sz) => [F.x + sx * 9, 0.4, F.z + sz * 14];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) { rod(k, 'plain', foot(sx, sz), top(sx), 0.62, 0.42, '#f6f0ff', 10); k.at(...foot(sx, sz)).p('stone', cy(1.3, 1.5, 0.6, 14), [0, -0.1, 0], '#f3e3d3').p('glow', sp(0.3, 8, 6), [sx * -0.9, 0.3, 0], BULB[(sx + sz + 2) % 4]); }
    for (const t of [0.3, 0.62]) { const lerp = (a, b) => a.map((v, i) => v + (b[i] - v) * t); rod(k, 'plain', lerp(foot(sx, -1), top(sx)), lerp(foot(sx, 1), top(sx)), 0.22, 0.22, PINK, 8); }
    k.at(F.x + sx * 2.9, F.hub, F.z).p('shine', sp(0.75, 12, 8), [0, 0, 0], GOLD);
  }
  k.at(F.x, F.hub, F.z).p('plain', cy(0.5, 0.5, 6.2, 14), [0, 0, 0], CREAM, [0, 0, PI / 2]);
  { const x0 = F.x + 2.0, x1 = F.x + 10.5; // 승강장: 곤돌라 동쪽 나무 바닥 + 양옆 난간 + 입구 아치(간판은 판)
    k.at((x0 + x1) / 2, 0.06, F.z).p('wood', bx(x1 - x0, 0.12, 6.4, 1.2), [0, 0, 0], '#f0c9a0');
    for (const s of [-1, 1]) { for (let x = x0 + 0.4; x <= x1; x += 1.6) k.at(x, 0, F.z + s * 3.1).p('plain', cy(0.07, 0.07, 1.0, 6), [0, 0.5, 0], CREAM).p('plain', sp(0.1, 6, 4), [0, 1.05, 0], HOT); k.at((x0 + x1) / 2, 0.95, F.z + s * 3.1).p('plain', bx(x1 - x0, 0.08, 0.08), [0, 0, 0], CREAM); }
    for (const s of [-1, 1]) k.at(x1, 0, F.z + s * 3.4).p('plain', cy(0.18, 0.22, 4.4, 10), [0, 2.2, 0], CREAM).p('shine', sp(0.26, 10, 6), [0, 4.5, 0], GOLD);
    k.at(x1, 4.1, F.z).p('plain', new THREE.TorusGeometry(3.4, 0.16, 6, 24, PI), [0, 0, 0], HOT, [0, PI / 2, 0]);
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * PI; k.p('glow', sp(0.13, 6, 4), [0, Math.sin(a) * 3.4, Math.cos(a) * 3.4], BULB[i % 4]); }
  }
  buildKit(k, g, false);
  board(g, signTex('🎡 대관람차', '#ff8fb1', '#ffffff', 512, 140, 66), 3.6, 1.0, F.x + 10.5, 4.1, F.z, PI / 2, 200);
  // 도는 바퀴 (축 가운데가 원점, 바퀴 면 z–y): 테 2겹·안쪽 고리·바퀴살·곤돌라 핀·별 조명·전구
  const wheel = new THREE.Group(); wheel.position.set(F.x, F.hub, F.z); g.add(wheel);
  const w = new Kit(), P = (r, a, x = 0) => [x, r * Math.sin(a), r * Math.cos(a)], nb = lite ? 24 : 48;
  for (const s of [-1, 1]) {
    w.at(0, 0, 0).p('plain', new THREE.TorusGeometry(F.r, 0.34, 6, 96), [s * 1.9, 0, 0], s < 0 ? PINK : '#ffd6e6', [0, PI / 2, 0]);
    w.p('plain', new THREE.TorusGeometry(F.r - 1.3, 0.16, 5, 96), [s * 1.9, 0, 0], CREAM, [0, PI / 2, 0]);
    w.p('plain', new THREE.TorusGeometry(13, 0.2, 5, 64), [s * 1.9, 0, 0], MINT, [0, PI / 2, 0]);
    for (let i = 0; i < 12; i++) {
      const a = -PI / 2 + (i * TAU) / 12;
      rod(w, 'plain', [s * 2.5, 0, 0], P(F.r, a, s * 1.9), 0.16, 0.12, CREAM, 6);
      rod(w, 'plain', P(13, a + PI / 12, s * 1.9), P(F.r - 1.3, a, s * 1.9), 0.1, 0.1, LILAC, 5);
      rod(w, 'plain', P(13, a - PI / 12, s * 1.9), P(F.r - 1.3, a, s * 1.9), 0.1, 0.1, LILAC, 5);
      w.at(...P(F.r, a + PI / 12, s * 2.15), 0).p('glow', starGeo(0.95, 0.25), [0, 0, 0], hdr(PASTEL[(i + (s > 0 ? 3 : 0)) % 6], 1.7), [0, PI / 2, 0]); // 별 조명 (곤돌라 사이)
    }
    for (let i = 0; i < nb; i++) w.at(0, 0, 0).p('glow', sp(0.17, 6, 4), P(F.r + 0.35, (i / nb) * TAU, s * 1.9), BULB[i % 4]);
  }
  for (let i = 0; i < 12; i++) w.at(0, 0, 0).p('plain', cy(0.14, 0.14, 3.8, 6), P(F.r, -PI / 2 + (i * TAU) / 12), CREAM, [0, 0, PI / 2]); // 곤돌라 핀
  w.at(0, 0, 0).p('plain', cy(2.2, 2.2, 4.4, 20), [0, 0, 0], CREAM, [0, 0, PI / 2]);
  for (const s of [-1, 1]) { w.p('shine', starGeo(3.0, 0.5), [s * 2.5, 0, 0], GOLD, [0, PI / 2, 0]); w.p('glow', starGeo(1.7, 0.2), [s * 2.85, 0, 0], hdr('#fff3b0', 1.8), [0, PI / 2, 0]); }
  buildKit(w, wheel, false);
  // 곤돌라 12개: 몸통(곤돌라마다 파스텔 색) · 테두리 · 전구 → 인스턴스 3개. 매달린 점이 원점, 아래로 매달림
  const gb = new Kit(), gt = new Kit(), gl = new Kit(), D = F.floor;
  gb.at(0, 0, 0).p('a', new THREE.SphereGeometry(1.65, 18, 8, 0, TAU, 0, PI / 2), [0, -0.98, 0], '#ffffff', [0, 0, 0], [1, 0.55, 1]); // 둥근 지붕
  gb.p('a', lathe([[0.01, -D], [1.55, -D], [1.66, -D + 0.12], [1.66, -D + 0.6], [1.5, -D + 0.6], [1.5, -D + 0.18], [0.01, -D + 0.18]], 22), [0, 0, 0], '#ffffff'); // 바닥 + 낮은 벽
  gt.at(0, 0, 0).p('a', new THREE.CircleGeometry(1.62, 18), [0, -0.98, 0], CREAM, [PI / 2, 0, 0]).p('a', new THREE.TorusGeometry(1.65, 0.09, 5, 24), [0, -0.98, 0], GOLD, [PI / 2, 0, 0]).p('a', new THREE.TorusGeometry(1.66, 0.07, 5, 24), [0, -D + 0.62, 0], CREAM, [PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) { const a = PI / 4 + (i * PI) / 2; gt.p('a', cy(0.06, 0.06, D - 1.83, 5), [Math.cos(a) * 1.52, -0.98 - (D - 1.83) / 2, Math.sin(a) * 1.52], CREAM); }
  for (const s of [-1, 1]) { gt.p('a', bx(0.6, 0.32, 1.9), [s * 0.82, -D + 0.34, 0], '#fff8ee').p('a', bx(0.14, 0.6, 1.9), [s * 1.2, -D + 0.62, 0], '#fff8ee'); } // 마주 보는 의자
  gt.p('a', cy(0.07, 0.07, 0.5, 5), [0, -0.3, 0], '#d8c8e8').p('a', sp(0.2, 8, 6), [0, -0.38, 0], GOLD, [0, 0, 0], [1, 0.6, 1]); // 매다는 고리
  gl.at(0, 0, 0).p('a', starGeo(0.32, 0.12), [0, -0.05, 0], hdr('#fff3b0', 1.8), [0, PI / 2, 0]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; gl.p('a', sp(0.09, 6, 4), [Math.cos(a) * 1.66, -0.92, Math.sin(a) * 1.66], BULB[i % 4]); }
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = mat.type !== 'MeshBasicMaterial'; m.receiveShadow = true; g.add(m); return m; };
  const gBody = inst(geoOf(gb, 'a'), soft('#ffffff', { vertexColors: true }), F.n), gTrim = inst(geoOf(gt, 'a'), soft('#ffffff', { vertexColors: true }), F.n);
  const gGlow = inst(geoOf(gl, 'a'), nightGlow(new THREE.MeshBasicMaterial({ vertexColors: true }), 0.45, 1.3, 0.3), F.n);
  const col = new THREE.Color();
  for (let i = 0; i < F.n; i++) gBody.setColorAt(i, col.set(PASTEL[i % 6]));
  const m4 = new THREE.Matrix4();
  return {
    g,
    update(t) {
      const f = ferrisAt(t);
      wheel.rotation.x = f.w % TAU;
      for (let i = 0; i < F.n; i++) { const [x, y, z] = gondolaAt(i, f.w); m4.makeTranslation(x, y, z); gBody.setMatrixAt(i, m4); gTrim.setMatrixAt(i, m4); gGlow.setMatrixAt(i, m4); }
      gBody.instanceMatrix.needsUpdate = gTrim.instanceMatrix.needsUpdate = gGlow.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ───────────── ② 회전목마 ───────────── */
// 동물 한 마리 (앞 = +z, 발밑 = 0, 안장 윗면 = CAROUSEL.saddle) — 정점 색으로 칠함
function animal(kind, seed) {
  const k = new Kit(), S = CAROUSEL.saddle, body = [['#ffffff', '#f2e6ff', '#ffe3d1', '#e3f4ff'], ['#ffd1e0', '#ffffff', '#fff1c9', '#e8dcff'], ['#f4c99a', '#e9b98a', '#f7d9b0', '#d9b48c']][kind][seed % 4];
  const dark = '#5a4a5e', accent = [HOT, MINT, LILAC, SKY][seed % 4];
  k.at(0, 0, 0);
  if (kind === 0) { // 말: 길쭉한 몸 · 목 · 머리 · 갈기 · 달리는 다리 · 꼬리
    k.p('a', sp(0.5, 14, 10), [0, S - 0.35, 0], body, [0, 0, 0], [0.75, 0.72, 1.35]);
    k.p('a', cy(0.2, 0.3, 0.9, 10), [0, S + 0.05, 0.55], body, [-0.7, 0, 0]);
    k.p('a', sp(0.3, 12, 8), [0, S + 0.42, 0.85], body, [0.5, 0, 0], [0.8, 0.85, 1.35]);
    k.p('a', sp(0.12, 8, 6), [0, S + 0.28, 1.2], '#ffd6e0');
    for (const s of [-1, 1]) { k.p('a', new THREE.ConeGeometry(0.08, 0.24, 6), [s * 0.13, S + 0.72, 0.7], body); k.p('a', sp(0.045, 6, 4), [s * 0.2, S + 0.5, 1.0], dark); }
    for (let i = 0; i < 5; i++) k.p('a', sp(0.12, 8, 6), [0, S + 0.62 - i * 0.12, 0.62 - i * 0.12], accent);
    for (const [x, z, r] of [[-0.22, 0.38, -0.7], [0.22, 0.38, -0.9], [-0.22, -0.4, 0.8], [0.22, -0.4, 0.6]]) { k.p('a', cy(0.07, 0.08, 0.75, 6), [x, S - 0.78, z + Math.sin(r) * 0.28], body, [r, 0, 0]); k.p('a', sp(0.09, 6, 4), [x, S - 1.08, z + Math.sin(r) * 0.55], GOLD); }
    k.p('a', cy(0.04, 0.14, 0.6, 6), [0, S - 0.3, -0.75], accent, [-1.0, 0, 0]);
  } else if (kind === 1) { // 토끼: 동그란 몸 · 큰 발 · 긴 귀 · 솜 꼬리
    k.p('a', sp(0.52, 14, 10), [0, S - 0.4, -0.05], body, [0, 0, 0], [0.82, 0.8, 1.1]);
    k.p('a', sp(0.38, 14, 10), [0, S + 0.28, 0.55], body);
    for (const s of [-1, 1]) { k.p('a', cy(0.08, 0.1, 0.7, 8), [s * 0.14, S + 0.85, 0.45], body, [-0.2, 0, s * 0.15], [1, 1, 0.6]); k.p('a', cy(0.04, 0.05, 0.5, 6), [s * 0.14, S + 0.86, 0.5], '#ffb3c8', [-0.2, 0, s * 0.15], [1, 1, 0.5]); k.p('a', sp(0.05, 6, 4), [s * 0.15, S + 0.34, 0.88], dark); k.p('a', sp(0.16, 8, 6), [s * 0.24, S - 0.88, 0.25], body, [0, 0, 0], [0.8, 0.5, 1.4]); }
    k.p('a', sp(0.06, 6, 4), [0, S + 0.22, 0.93], '#ff9fb0').p('a', sp(0.16, 8, 6), [0, S - 0.35, -0.62], '#ffffff');
  } else { // 곰: 통통한 몸 · 둥근 귀 · 주둥이 · 배
    k.p('a', sp(0.55, 14, 10), [0, S - 0.4, 0], body, [0, 0, 0], [0.85, 0.82, 1.15]);
    k.p('a', sp(0.4, 14, 10), [0, S + 0.28, 0.55], body);
    for (const s of [-1, 1]) { k.p('a', sp(0.14, 8, 6), [s * 0.3, S + 0.6, 0.5], body); k.p('a', sp(0.07, 6, 4), [s * 0.3, S + 0.6, 0.56], '#ffd6e0'); k.p('a', sp(0.05, 6, 4), [s * 0.15, S + 0.36, 0.9], dark); k.p('a', cy(0.12, 0.13, 0.55, 8), [s * 0.25, S - 0.88, 0.2], body); }
    k.p('a', sp(0.16, 10, 6), [0, S + 0.18, 0.88], '#fff1dc', [0, 0, 0], [1, 0.8, 1]).p('a', sp(0.06, 6, 4), [0, S + 0.24, 1.02], dark);
  }
  k.p('a', cy(0.36, 0.38, 0.1, 14), [0, S - 0.02, -0.05], accent).p('a', cy(0.38, 0.38, 0.04, 14), [0, S + 0.03, -0.05], GOLD); // 안장 (윗면 = S)
  for (const s of [-1, 1]) k.p('a', cy(0.02, 0.02, 0.45, 4), [s * 0.36, S - 0.25, -0.05], GOLD).p('a', new THREE.TorusGeometry(0.08, 0.025, 4, 8), [s * 0.36, S - 0.5, -0.05], GOLD, [0, PI / 2, 0]); // 발걸이
  return k.geometry('a');
}
function buildCarousel(root, lite) {
  const C = CAROUSEL, g = new THREE.Group(); g.name = 'ride-carousel'; root.add(g);
  const k = new Kit(); // 서 있는 받침·간판 기둥·꽃 화분
  k.at(C.x, 0, C.z).p('stone', cy(C.plat + 1.0, C.plat + 1.3, 0.3, 48), [0, 0.15, 0], '#f6e3e8').p('plain', new THREE.TorusGeometry(C.plat + 1.05, 0.1, 5, 64), [0, 0.3, 0], CREAM, [PI / 2, 0, 0]);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; k.p('glow', sp(0.13, 6, 4), [Math.sin(a) * (C.plat + 1.15), 0.32, Math.cos(a) * (C.plat + 1.15)], BULB[i % 4]); }
  k.at(C.x - 6.5, 0, C.z - C.plat - 2.6).p('wood', bx(0.16, 2.6, 0.16, 0.6), [0, 1.3, 0], '#b07a52').p('plain', sp(0.16, 8, 6), [0, 2.65, 0], PINK);
  buildKit(k, g, false);
  board(g, signTex('🎠 회전목마', '#e0a33a', '#ffffff', 512, 140, 66), 2.4, 0.66, C.x - 6.5, 2.1, C.z - C.plat - 2.52, PI, 150);
  // 도는 부분 (가운데 원점): 바닥판 · 가운데 기둥(거울·그림) · 금빛 기둥 · 크림 지붕(분홍 줄무늬) · 물결 천막 끝 · 꼭대기 · 전구
  const spin = new THREE.Group(); spin.position.set(C.x, 0, C.z); g.add(spin);
  const s = new Kit(), RT = 6.1; // 지붕 아랫면 높이
  s.at(0, 0, 0).p('plain', cy(C.plat, C.plat, 0.3, 48), [0, C.deck - 0.15, 0], CREAM).p('plain', cy(C.plat + 0.06, C.plat + 0.06, 0.12, 48), [0, C.deck - 0.24, 0], HOT);
  for (const [r0, r1, c] of [[2.4, 3.2, '#ffe0ea'], [5.9, 6.3, '#d9f3ea'], [8.1, 8.5, '#ffe9b8']]) s.p('plain', new THREE.RingGeometry(r0, r1, 40), [0, C.deck + 0.005, 0], c, [-PI / 2, 0, 0]);
  s.p('plain', cy(1.6, 1.85, RT - C.deck, 16), [0, (RT + C.deck) / 2, 0], CREAM);
  for (const y of [C.deck + 0.4, 3.3, RT - 0.3]) s.p('plain', new THREE.TorusGeometry(1.75, 0.12, 5, 20), [0, y, 0], GOLD, [PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + PI / 8; s.p('plain', bx(0.9, 1.4, 0.06), [Math.sin(a) * 1.72, 2.2, Math.cos(a) * 1.72], ['#dff2ff', '#ffe6f0'][i % 2], [0, a, 0]).p('plain', bx(0.8, 1.0, 0.06), [Math.sin(a) * 1.72, 4.4, Math.cos(a) * 1.72], PASTEL[i % 6], [0, a, 0]); }
  for (let seat = 0; seat < 24; seat++) { // 동물마다 금빛 기둥 (동물 목 앞으로 0.62m — 탄 사람이 잡음)
    const a = carouselAngle(seat), R = C.ring[seat >= 12 ? 1 : 0], fx = Math.cos(a), fz = -Math.sin(a), x = R * Math.sin(a) + fx * 0.62, z = R * Math.cos(a) + fz * 0.62;
    s.p('shine', cy(0.06, 0.06, RT - C.deck, 6), [x, (RT + C.deck) / 2, z], GOLD).p('shine', sp(0.11, 6, 4), [x, RT - 0.1, z], GOLD);
  }
  s.p('a', new THREE.CircleGeometry(C.plat + 0.9, 40), [0, RT, 0], '#fff8ee', [PI / 2, 0, 0]); // 지붕 아랫면
  s.p('plain', stripes(lathe([[C.plat + 1.1, RT], [C.plat + 0.7, RT + 0.9], [8, RT + 1.8], [5.4, RT + 2.8], [2.6, RT + 3.5], [0.8, RT + 3.75], [0.01, RT + 3.8]], 32), 16, [CREAM, '#ffc9d6']), [0, 0, 0]);
  const nv = lite ? 24 : 36;
  for (let i = 0; i < nv; i++) { // 물결 천막 끝 (반원 판, 분홍·크림·민트) + 위 전구
    const a = (i / nv) * TAU, r = C.plat + 1.1;
    s.p('plain', new THREE.CircleGeometry(0.62, 8, PI, PI), [Math.sin(a) * r, RT + 0.02, Math.cos(a) * r], [HOT, CREAM, MINT][i % 3], [0, a, 0]);
    s.p('glow', sp(0.13, 6, 4), [Math.sin(a) * (r + 0.05), RT + 0.25, Math.cos(a) * (r + 0.05)], BULB[i % 4]);
  }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; s.p('glow', sp(0.11, 6, 4), [Math.sin(a) * (C.plat - 1.2), RT - 0.08, Math.cos(a) * (C.plat - 1.2)], BULB[(i + 1) % 4]); s.p('glow', sp(0.1, 6, 4), [Math.sin(a) * 1.9, 1.4 + (i % 4) * 1.1, Math.cos(a) * 1.9], BULB[i % 4]); }
  s.p('plain', cy(0.9, 1.1, 1.0, 12), [0, RT + 4.2, 0], PINK).p('roof', new THREE.ConeGeometry(1.3, 1.5, 12), [0, RT + 5.4, 0], MINT).p('shine', sp(0.22, 8, 6), [0, RT + 6.2, 0], GOLD);
  s.p('glow', starGeo(0.6, 0.18), [0, RT + 6.9, 0], hdr('#fff3b0', 1.8));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; s.p('glow', sp(0.12, 6, 4), [Math.sin(a) * 0.95, RT + 4.4, Math.cos(a) * 0.95], BULB[i % 4]); }
  buildKit(s, spin, false, { a: soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide }) });
  // 동물 24마리: 한 덩어리 + 자리마다 위상 → 셰이더가 위아래로 (도는 각에 묶임, 서버 자리 높이와 같은 식)
  const parts = [];
  for (let seat = 0; seat < 24; seat++) {
    const a = carouselAngle(seat), R = C.ring[seat >= 12 ? 1 : 0], geo = animal(carouselAnimal(seat), seat);
    geo.rotateY(Math.atan2(Math.cos(a), -Math.sin(a))); geo.translate(R * Math.sin(a), C.deck, R * Math.cos(a));
    geo.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill((seat % 12) * 2.1 + (seat >= 12 ? PI : 0)), 1));
    parts.push(geo);
  }
  const uA = { value: 0 }, amat = patch(soft('#ffffff', { vertexColors: true }), { key: 'carousel-bob', uniforms: { uA }, vert: { head: 'attribute float aPh; uniform float uA;', begin_vertex: `transformed.y += ${C.bob.toFixed(3)} * sin(uA + aPh);` } });
  const animals = new THREE.Mesh(mergeGeometries(parts), amat); animals.receiveShadow = true; spin.add(animals); parts.forEach((p) => p.dispose());
  return { g, update(t) { const c = carouselAt(t); spin.rotation.y = c.a % TAU; uA.value = (3 * c.a) % TAU; return c; } };
}

/* ───────────── ⑩ 꼬마기차: 선로 · 역 3곳 · 기관차 + 객차 4량 · 연기 ───────────── */
function buildTrack(root, lite) {
  const g = new THREE.Group(); g.name = 'ride-track'; root.add(g);
  const L = TRAIN_PATH.len, step = 1.6, n = Math.ceil(L / step), G = TRAIN_PATH.gauge / 2;
  // 자갈 띠 + 레일 2줄: 부드러운 방향으로 뽑은 점을 이어 띠 지오메트리
  const strip = (off0, off1, y0, y1, color) => { // off: 선로 가운데에서 옆으로, y: 높이 (위 면 + 옆 면 둘)
    const P = [], idx = [];
    for (let i = 0; i <= n; i++) { const [x, z, tx, tz] = trainAtSmooth((i / n) * L), nx = -tz, nz = tx; for (const [o, y] of [[off0, y0], [off0, y1], [off1, y1], [off1, y0]]) P.push(x + nx * o, y, z + nz * o); if (i) for (let q = 0; q < 3; q++) { const a = (i - 1) * 4 + q, b = i * 4 + q; idx.push(a, a + 1, b, a + 1, b + 1, b); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(idx); geo.computeVertexNormals(); paint(geo, () => new THREE.Color(color).toArray()); geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((P.length / 3) * 2), 2)); return geo;
  };
  const k = new Kit();
  k.add('plain', strip(-1.35, 1.35, 0.02, 0.07, '#e9dccb'));
  for (const s of [-1, 1]) k.add('shine', strip(s * G - 0.06, s * G + 0.06, 0.12, 0.26, '#d9dde8'));
  for (let i = 0; i < n; i++) { const [x, z, tx, tz] = trainAtSmooth((i + 0.5) / n * L); k.at(x, 0.1, z, Math.atan2(tx, tz)).p('wood', bx(2.0, 0.1, 0.32, 1), [0, 0, 0], i % 9 ? '#b98b63' : '#c99b73'); }
  // 역 3곳: 승강장(분홍 돌) · 노란 안전선 · 줄무늬 지붕 · 기둥 · 화분 · 매표칸(정문역·기구역)
  for (const st of TRAIN_STATIONS) {
    const ry = Math.atan2(-st.nz, st.nx); // 지역 x = 승강장 쪽, z = 선로 방향
    k.at(st.x, 0, st.z, ry).p('stone', bx(3.2, 0.1, 14, 1), [2.8, 0.05, 0], '#ffdfe2').p('plain', bx(0.25, 0.012, 14), [1.45, 0.106, 0], '#ffe066');
    for (const z of [-4.4, 4.4]) k.p('plain', cy(0.14, 0.18, 3.5, 8), [4.6, 1.75, z], CREAM).p('shine', sp(0.18, 8, 6), [4.6, 3.55, z], GOLD);
    for (let i = 0; i < 8; i++) k.p('plain', bx(4.2, 0.18, 1.3), [2.9, 3.62 - 0.0, -4.55 + i * 1.3], i % 2 ? '#ffffff' : HOT, [0, 0, 0.12]);
    k.p('plain', bx(4.4, 0.08, 10.6), [2.9, 3.48, 0], CREAM, [0, 0, 0.12]);
    for (let i = 0; i < 6; i++) k.p('glow', sp(0.1, 6, 4), [1.0, 3.25, -4 + i * 1.6], BULB[i % 4]);
    for (const z of [-6.2, 6.2]) { k.p('stone', cy(0.45, 0.35, 0.5, 10), [3.8, 0.35, z], '#ffe9de'); k.p('plain', sp(0.42, 8, 6), [3.8, 0.75, z], ['#7fcf72', '#95d66d'][z > 0 ? 1 : 0]); k.p('plain', sp(0.12, 6, 4), [3.65, 1.05, z + 0.1], HOT); }
    board(g, signTex(`🚂 ${st.name}`, '#ff8fb1', '#ffffff', 512, 140, 70), 2.6, 0.72, st.x + st.nx * 1.15, 2.75, st.z + st.nz * 1.15, ry - PI / 2, 160);
  }
  for (const h of TRAIN_HUTS) { // 작은 매표칸: 크림 벽 · 민트 지붕 · 창
    const [x0, z0, x1, z1] = h.rect, w = x1 - x0, d = z1 - z0;
    k.at((x0 + x1) / 2, 0, (z0 + z1) / 2).p('stucco', bx(w, 2.6, d, 1.6), [0, 1.3, 0], '#fff0f2').p('plain', bx(w + 0.3, 0.25, d + 0.3), [0, 2.72, 0], CREAM).p('roof', new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.5, 1.6, 4), [0, 3.6, 0], MINT, [0, PI / 4, 0]).p('shine', sp(0.2, 8, 6), [0, 4.5, 0], GOLD);
    k.p('win', bx(0.08, 1.0, d * 0.5), [-w / 2 - 0.02, 1.6, 0], '#ffffff');
  }
  buildKit(k, g, false);
  return { g };
}
function buildTrain(root, lite) {
  const T = TRAIN, g = new THREE.Group(); g.name = 'ride-train'; root.add(g);
  // 기관차 (지역: 앞 = +z, 가운데 = 차량 가운데, 바닥 = 0): 동글동글 보일러 · 웃는 얼굴 · 나팔 굴뚝 · 하늘색 기관실 · 금빛 종
  const loco = new THREE.Group(); g.add(loco);
  const k = new Kit(), NAVY = '#5a5f86', RED = '#ff8fa3', CAB = '#8fd3ff';
  k.at(0, 0, 0).p('plain', bx(1.4, 0.32, 4.9), [0, 0.62, 0], NAVY).p('plain', bx(1.6, 0.14, 5.1), [0, 0.82, 0], '#7b80a8');
  k.p('plain', cy(0.78, 0.78, 3.1, 18), [0, 1.62, 0.7], RED, [PI / 2, 0, 0]);
  for (const z of [-0.5, 0.7, 1.9]) k.p('shine', new THREE.TorusGeometry(0.8, 0.06, 5, 20), [0, 1.62, z], GOLD);
  k.p('plain', cy(0.82, 0.82, 0.25, 18), [0, 1.62, 2.3], NAVY, [PI / 2, 0, 0]).p('plain', new THREE.CircleGeometry(0.7, 18), [0, 1.62, 2.43], '#fff1e0'); // 앞 얼굴판
  for (const s of [-1, 1]) { k.p('plain', sp(0.09, 8, 6), [s * 0.25, 1.78, 2.45], '#4a3a4e', [0, 0, 0], [1, 1.3, 0.5]).p('plain', sp(0.1, 8, 6), [s * 0.43, 1.5, 2.44], '#ffb3c8', [0, 0, 0], [1, 0.7, 0.4]); }
  k.p('plain', new THREE.TorusGeometry(0.16, 0.03, 4, 10, PI), [0, 1.47, 2.45], '#b4506a', [0, 0, PI]);
  k.p('plain', lathe([[0.26, 0], [0.24, 0.55], [0.42, 0.95], [0.5, 1.15], [0.38, 1.15]], 14), [0, 2.25, 1.65], NAVY).p('shine', new THREE.TorusGeometry(0.47, 0.06, 5, 14), [0, 3.38, 1.65], GOLD, [PI / 2, 0, 0]);
  k.p('shine', sp(0.32, 12, 8), [0, 2.4, 0.45], GOLD).p('shine', cy(0.14, 0.2, 0.3, 10), [0, 2.48, -0.25], GOLD); // 증기 돔 · 종
  k.p('plain', bx(1.65, 1.5, 1.6), [0, 1.65, -1.55], CAB).p('plain', bx(1.9, 0.2, 2.0), [0, 2.5, -1.55], CREAM).p('plain', sp(1.1, 14, 8), [0, 2.58, -1.55], CREAM, [0, 0, 0], [0.92, 0.28, 1.0]);
  for (const s of [-1, 1]) k.p('plain', bx(0.06, 0.7, 0.9), [s * 0.83, 1.95, -1.55], '#fffaf0');
  k.p('glow', sp(0.2, 10, 8), [0, 2.25, 2.4], hdr('#fff0b0', 2)).p('plain', bx(1.35, 0.32, 0.45), [0, 0.5, 2.6], RED, [-0.55, 0, 0]); // 앞 등 · 배장기
  buildKit(k, loco, false);
  const wk = new Kit(); wk.at(0, 0, 0).p('a', cy(0.46, 0.46, 0.16, 16), [0, 0, 0], '#ff6b6b', [0, 0, PI / 2]).p('a', cy(0.14, 0.14, 0.2, 8), [0, 0, 0], GOLD, [0, 0, PI / 2]).p('a', bx(0.18, 0.7, 0.12), [0, 0, 0], '#ffe0e0');
  const WH = [-1.5, 0, 1.5].flatMap((z) => [-1, 1].map((s) => [s * 0.8, 0.46, z])), wheels = new THREE.InstancedMesh(wk.geometry('a'), soft('#ffffff', { vertexColors: true }), WH.length); wheels.frustumCulled = false; g.add(wheels);
  // 객차 4량 (인스턴스): 몸통(차마다 파스텔) · 의자·지붕 기둥·바퀴 · 지붕 전구
  const cb = new Kit(), ct = new Kit(), cl = new Kit();
  cb.at(0, 0, 0).p('a', bx(1.7, 0.62, 3.7), [0, 0.86, 0], '#ffffff').p('a', bx(1.95, 0.14, 4.0), [0, 2.72, 0], '#ffffff');
  ct.at(0, 0, 0).p('a', bx(1.3, 0.3, 3.4), [0, 0.42, 0], NAVY).p('a', bx(1.8, 0.08, 3.8), [0, 1.2, 0], CREAM);
  for (const z of [-T.along, T.along]) ct.p('a', bx(1.4, 0.12, 0.6), [0, T.seatY - 0.06, z], '#fff8ee').p('a', bx(1.4, 0.5, 0.1), [0, T.seatY + 0.2, z - 0.36], '#fff8ee');
  for (const sx of [-0.85, 0.85]) for (const z of [-1.7, 1.7]) ct.p('a', cy(0.05, 0.05, 1.5, 5), [sx, 1.95, z], CREAM);
  for (const sx of [-0.7, 0.7]) for (const z of [-1.2, 1.2]) ct.p('a', cy(0.28, 0.28, 0.12, 12), [sx, 0.3, z], '#7b80a8', [0, 0, PI / 2]);
  ct.p('a', bx(0.25, 0.25, 0.5), [0, 0.5, 2.0], NAVY);
  for (const sx of [-0.9, 0.9]) for (const z of [-1.9, 0, 1.9]) cl.at(0, 0, 0).p('a', sp(0.09, 6, 4), [sx, 2.62, z], BULB[(z > 0 ? 1 : 0) + (sx > 0 ? 2 : 0)]);
  const inst = (kit, mat) => { const m = new THREE.InstancedMesh(kit.geometry('a'), mat, T.cars); m.frustumCulled = false; m.castShadow = mat.type !== 'MeshBasicMaterial'; m.receiveShadow = true; g.add(m); return m; };
  const cBody = inst(cb, soft('#ffffff', { vertexColors: true })), cTrim = inst(ct, soft('#ffffff', { vertexColors: true })), cGlow = inst(cl, nightGlow(new THREE.MeshBasicMaterial({ vertexColors: true }), 0.45, 1.3, 0.3));
  const col = new THREE.Color(); for (let i = 0; i < T.cars; i++) cBody.setColorAt(i, col.set([MINT, LEMON, LILAC, PEACH][i]));
  // 굴뚝 연기: 점 32개 (한 번 그림), 위로 퍼지며 옅어짐
  const NS = lite ? 16 : 32, sp3 = new Float32Array(NS * 3), sa = new Float32Array(NS), sz = new Float32Array(NS), life = new Float32Array(NS).fill(9), vel = new Float32Array(NS * 3);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp3, 3)); sg.setAttribute('aA', new THREE.BufferAttribute(sa, 1)); sg.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
  const puff = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const smat = new THREE.PointsMaterial({ map: puff, size: 1, color: '#f4f0f8', transparent: true, depthWrite: false, sizeAttenuation: true });
  smat.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute float aA; attribute float aS; varying float vA;\n' + sh.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aS; vA = aA;'); sh.fragmentShader = 'varying float vA;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vA;'); };
  const smoke = new THREE.Points(sg, smat); smoke.frustumCulled = false; g.add(smoke);
  let si = 0, emit = 0, lastS = null, lastT = 0;
  const m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4(), rot = new THREE.Matrix4();
  const carM = (s, m) => { const [x, z, tx, tz] = trainAtSmooth(s); return m.makeRotationY(Math.atan2(tx, tz)).setPosition(x, 0, z); };
  return {
    g, loco,
    update(t, dt) {
      const st = trainState(t), v = lastS == null || t <= lastT ? 0 : Math.min(20, (st.s - lastS) / ((t - lastT) / 1000)); lastS = st.s; lastT = t;
      carM(trainCarS(st.s, 0), m4); loco.position.setFromMatrixPosition(m4); loco.rotation.setFromRotationMatrix(m4);
      const spin = (st.s / 0.46) % TAU;
      WH.forEach(([x, y, z], i) => { rot.makeRotationX(spin); m5.makeTranslation(x, y, z).multiply(rot); wheels.setMatrixAt(i, m5.premultiply(m4)); });
      wheels.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < T.cars; i++) { carM(trainCarS(st.s, i + 1), m5); cBody.setMatrixAt(i, m5); cTrim.setMatrixAt(i, m5); cGlow.setMatrixAt(i, m5); }
      cBody.instanceMatrix.needsUpdate = cTrim.instanceMatrix.needsUpdate = cGlow.instanceMatrix.needsUpdate = true;
      // 연기: 달릴수록 자주, 서 있으면 가끔 몽글
      emit += dt * (v > 0.5 ? 5 + v * 0.6 : 1.6);
      va.set(0, 3.45, 1.65).applyMatrix4(m4);
      while (emit > 1) { emit--; const i = si++ % NS; life[i] = 0; sp3.set([va.x, va.y, va.z], i * 3); const [, , tx, tz] = trainAtSmooth(st.s); vel.set([-tx * v * 0.35 + (Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 0.8, -tz * v * 0.35 + (Math.random() - 0.5) * 0.6], i * 3); }
      for (let i = 0; i < NS; i++) { life[i] += dt; const L = life[i] / 2.6; if (L >= 1) { sa[i] = 0; continue; } for (let j = 0; j < 3; j++) sp3[i * 3 + j] += vel[i * 3 + j] * dt; vel[i * 3 + 1] *= 1 - dt * 0.5; sa[i] = 0.75 * (1 - L) * Math.min(1, L * 8); sz[i] = 0.9 + L * 2.6; } // sz = 지름(m), PointsMaterial 의 거리 줄임과 곱해짐
      sg.attributes.position.needsUpdate = sg.attributes.aA.needsUpdate = sg.attributes.aS.needsUpdate = true;
      return { st, v };
    },
  };
}

/* ═════════════ 2단계 A: 드롭타워 · 바이킹 · 회전그네 · 롤러코스터 · 후룸라이드 ═════════════ */
const two = () => ({ two: soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide }) }); // 길 따라 뽑은 단면은 양면
// 길(COASTER_PATH·FLUME_PATH) 따라 단면 prof = [[옆, 위], …] 를 step 마다 이어 붙인 띠 (관은 처음 점을 끝에 한 번 더). uv = (단면 차례, 거리/4)
function sweep(path, s0, s1, step, prof, color) {
  const n = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length, P = [], UV = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n, [x, y, z, tx, , tz] = path.at(s), l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
    prof.forEach(([o, u], j) => { P.push(x + nx * o, y + u, z + nz * o); UV.push(j / (m - 1), s / 4); });
    if (i) for (let j = 0; j < m - 1; j++) { const a = (i - 1) * m + j, b = i * m + j; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  paint(geo, () => new THREE.Color(color).toArray()); return geo;
}
const ring = (r, n, cx = 0, cy0 = 0) => [...Array(n + 1).keys()].map((i) => [cx + r * Math.cos((i / n) * TAU), cy0 + r * Math.sin((i / n) * TAU)]); // 관 단면
// 길 위 한 점의 3D 자세 행렬 (지역 z = 나아가는 쪽, y = 위, x = 옆)
const WUP = new THREE.Vector3(0, 1, 0), vf = new THREE.Vector3(), vs2 = new THREE.Vector3(), vu = new THREE.Vector3();
function pathM(path, s, m) { const [x, y, z, tx, ty, tz] = path.at(s); vf.set(tx, ty, tz); vs2.crossVectors(WUP, vf).normalize(); vu.crossVectors(vf, vs2); return m.makeBasis(vs2, vu, vf).setPosition(x, y, z); }
const instOf = (g, geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = mat.type !== 'MeshBasicMaterial'; m.receiveShadow = true; g.add(m); return m; };
const glowMat = () => nightGlow(new THREE.MeshBasicMaterial({ vertexColors: true }), 0.45, 1.3, 0.3);
// 물 무늬 텍스처 (흐르는 물·폭포): 연한 하늘색 위 흰 물결 줄
function waterTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#9fe0f2'; x.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 9; i++) { x.strokeStyle = `rgba(255,255,255,${0.35 + (i % 3) * 0.15})`; x.lineWidth = 3 + (i % 2) * 2; x.beginPath(); const y0 = i * 14 + 4; x.moveTo(0, y0); x.bezierCurveTo(20, y0 - 6, 44, y0 + 6, 64, y0); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 튀는 물보라 점들 (후룸 낙하·폭포): burst(x,y,z,n,세기) 로 뿌리고 update(dt) 로 떨어뜨림
function sprayPoints(g, N, color = '#ffffff') {
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N).fill(9), aA = new Float32Array(N), aS = new Float32Array(N);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aA', new THREE.BufferAttribute(aA, 1)); geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(230,248,255,.7)'); gr.addColorStop(1, 'rgba(230,248,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const mat = new THREE.PointsMaterial({ map: tex, size: 1.7, color, transparent: true, depthWrite: false, sizeAttenuation: true });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute float aA; attribute float aS; varying float vA;\n' + sh.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aS; vA = aA;'); sh.fragmentShader = 'varying float vA;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vA;'); };
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; g.add(pts);
  let k = 0;
  return {
    burst(x, y, z, n, f = 1, dir = [0, 0]) { for (let i = 0; i < n; i++) { const j = k++ % N, a = Math.random() * TAU, sp = (1 + Math.random() * 3) * f; life[j] = 0; pos.set([x + (Math.random() - 0.5), y, z + (Math.random() - 0.5)], j * 3); vel.set([Math.cos(a) * sp + dir[0] * f * 2, (2.5 + Math.random() * 3.5) * f, Math.sin(a) * sp + dir[1] * f * 2], j * 3); } },
    update(dt) {
      for (let i = 0; i < N; i++) { life[i] += dt; const L = life[i] / 1.3; if (L >= 1) { aA[i] = 0; continue; } vel[i * 3 + 1] -= 9.8 * dt; for (let j = 0; j < 3; j++) pos[i * 3 + j] += vel[i * 3 + j] * dt; aA[i] = 0.95 * (1 - L * L); aS[i] = 0.7 + L * 1.6; }
      geo.attributes.position.needsUpdate = geo.attributes.aA.needsUpdate = geo.attributes.aS.needsUpdate = true;
    },
  };
}

/* ───────────── ⑧ 드롭타워 ───────────── */
function buildDrop(root, lite) {
  const D = DROP, g = new THREE.Group(); g.name = 'ride-drop'; root.add(g);
  const k = new Kit(), H = D.tower, BANDS = [PINK, CREAM, MINT, CREAM, LILAC, CREAM, SKY, CREAM, PEACH, CREAM, LEMON];
  k.at(D.x, 0, D.z).p('stone', cy(6.2, 6.6, 0.25, 40), [0, 0.12, 0], '#f6e3ee').p('plain', new THREE.TorusGeometry(6.4, 0.1, 5, 48), [0, 0.25, 0], CREAM, [PI / 2, 0, 0]);
  for (const [r0, r1, c] of [[3.6, 4.2, '#ffe9b8'], [4.9, 5.3, '#d9f3ea']]) k.p('plain', new THREE.RingGeometry(r0, r1, 40), [0, 0.26, 0], c, [-PI / 2, 0, 0]);
  const bh = (H - 2) / BANDS.length; // 둥근 탑: 위로 갈수록 가늘게, 파스텔 띠
  BANDS.forEach((c, i) => { const r = (y) => 1.55 - (y / H) * 0.45; k.p('plain', cy(r(bh * (i + 1)), r(bh * i), bh, 20), [0, bh * i + bh / 2, 0], c); });
  for (let i = 0; i < 4; i++) k.p('plain', bx(0.18, H - 2, 0.12), [Math.sin((i * PI) / 2) * 1.3, (H - 2) / 2, Math.cos((i * PI) / 2) * 1.3], '#ffffff', [0, (i * PI) / 2, 0]); // 고리 레일 4줄
  for (let y = 6, i = 0; y < H - 4; y += 4.5, i++) { const a = i * 0.9; k.p('glow', starGeo(0.55, 0.16), [Math.sin(a) * 1.5, y, Math.cos(a) * 1.5], hdr(PASTEL[i % 6], 1.6), [0, a, 0]); } // 탑을 감는 별
  k.p('plain', cy(2.2, 1.3, 1.2, 20), [0, H - 1.4, 0], PINK).p('plain', new THREE.TorusGeometry(2.2, 0.16, 6, 28), [0, H - 0.8, 0], GOLD, [PI / 2, 0, 0]); // 꼭대기 왕관
  k.p('plain', sp(1.6, 18, 10), [0, H - 0.6, 0], CREAM, [0, 0, 0], [1, 0.7, 1]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; k.p('shine', new THREE.ConeGeometry(0.28, 0.9, 8), [Math.sin(a) * 2.1, H - 0.2, Math.cos(a) * 2.1], GOLD).p('glow', sp(0.16, 6, 4), [Math.sin(a) * 2.25, H - 0.85, Math.cos(a) * 2.25], BULB[i % 4]); }
  k.p('shine', cy(0.12, 0.16, 2.2, 8), [0, H + 1.4, 0], GOLD).p('shine', starGeo(2.2, 0.5), [0, H + 3.6, 0], GOLD).p('glow', starGeo(1.3, 0.2), [0, H + 3.6, 0.32], hdr('#fff3b0', 2)).p('glow', starGeo(1.3, 0.2), [0, H + 3.6, -0.32], hdr('#fff3b0', 2));
  const nb = lite ? 10 : 20; for (let i = 0; i < nb; i++) { const y = 3 + (i * (H - 6)) / nb, a = i * 2.4; k.p('glow', sp(0.14, 6, 4), [Math.sin(a) * 1.62, y, Math.cos(a) * 1.62], BULB[i % 4]); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; if (Math.abs(Math.atan2(Math.sin(a), -Math.cos(a))) < 0.5) continue; k.p('plain', cy(0.06, 0.06, 0.8, 5), [Math.sin(a) * 6.4, 0.6, Math.cos(a) * 6.4], CREAM).p('glow', sp(0.1, 6, 4), [Math.sin(a) * 6.4, 1.05, Math.cos(a) * 6.4], BULB[i % 4]); } // 낮은 울타리 (북쪽 입구 열림)
  buildKit(k, g, false);
  board(g, signTex('🌟 드롭타워', '#b08ad8', '#ffffff', 512, 140, 66), 2.8, 0.78, D.x, 2.4, D.z - 7.4, PI, 150);
  { const kk = new Kit(); kk.at(D.x, 0, D.z - 7.4).p('wood', bx(0.16, 2.2, 0.16), [-1.5, 1.1, 0], '#9a6a44').p('wood', bx(0.16, 2.2, 0.16), [1.5, 1.1, 0], '#9a6a44'); buildKit(kk, g, false); }
  // 오르내리는 고리 (원점 = 앉는 면 높이): 깃 · 자리 8개(바깥을 봄) · 어깨 손잡이 · 발판 · 전구
  const car = new THREE.Group(); g.add(car); car.position.set(D.x, D.y0, D.z);
  const c = new Kit(); c.at(0, 0, 0).p('plain', cy(2.25, 2.25, 0.5, 24), [0, -0.3, 0], CREAM).p('plain', new THREE.TorusGeometry(2.25, 0.14, 6, 32), [0, -0.05, 0], HOT, [PI / 2, 0, 0]).p('plain', cy(2.0, 2.0, 1.6, 24, true), [0, 0.6, 0], '#fff8ee');
  for (let i = 0; i < D.n; i++) {
    const a = (i * TAU) / D.n, col = PASTEL[i % 6];
    c.at(Math.sin(a) * D.R, 0, Math.cos(a) * D.R, a).p('plain', bx(0.62, 0.14, 0.6), [0, -0.07, 0], col).p('plain', bx(0.62, 1.15, 0.14), [0, 0.5, -0.36], col).p('plain', sp(0.22, 8, 6), [0, 1.18, -0.33], col);
    c.p('shine', new THREE.TorusGeometry(0.3, 0.05, 5, 12, PI), [0, 0.75, -0.12], GOLD, [0, 0, 0]).p('plain', bx(0.5, 0.06, 0.3), [0, -0.62, 0.42], '#d8c8e8');
    c.at(0, 0, 0).p('glow', sp(0.11, 6, 4), [Math.sin(a + PI / D.n) * 2.32, -0.05, Math.cos(a + PI / D.n) * 2.32], BULB[i % 4]);
  }
  buildKit(c, car, false);
  return { g, car, update(t) { const d = dropAt(t); car.position.y = d.y; car.rotation.y = d.a % TAU; return d; } };
}

/* ───────────── ④ 바이킹 ───────────── */
function buildViking(root, lite) {
  const V = VIKING, g = new THREE.Group(); g.name = 'ride-viking'; root.add(g);
  const k = new Kit();
  k.at(V.x, 0, V.z).p('stone', bx(28, 0.1, 5.2), [0, 0.05, 0], '#efe0f0'); // 배 아래 바닥
  for (const sz of [-1, 1]) { // 승강장 (낮은 나무 바닥 + 난간) · A자 다리 · 축 받침
    k.at(V.x, 0, V.z + sz * 3.9).p('wood', bx(10, 0.14, 2.6, 1.2), [0, 0.07, 0], '#f0c9a0');
    if (sz > 0) { for (let x = -4.6; x <= 4.7; x += 1.15) k.p('plain', cy(0.06, 0.06, 0.9, 5), [x, 0.5, 1.25], CREAM).p('plain', sp(0.09, 6, 4), [x, 0.98, 1.25], HOT); k.p('plain', bx(9.3, 0.07, 0.07), [0, 0.92, 1.25], CREAM); } // 남쪽 승강장 바깥 난간 (북쪽은 입구라 열림)
    for (const sx of [-1, 1]) { rod(k, 'plain', [V.x + sx * 6.2, 0.2, V.z + sz * 4.3], [V.x + sx * 0.5, V.pivot + 0.3, V.z + sz * 3.6], 0.42, 0.3, '#f6f0ff', 10); k.at(V.x + sx * 6.2, 0, V.z + sz * 4.3).p('stone', cy(0.75, 0.85, 0.4, 12), [0, 0.2, 0], '#f3e3d3'); }
    rod(k, 'plain', [V.x - 4.4, 3.4, V.z + sz * 4.15], [V.x + 4.4, 3.4, V.z + sz * 4.15], 0.16, 0.16, PINK, 8);
    k.at(V.x, V.pivot, V.z + sz * 3.6).p('shine', sp(0.7, 12, 8), [0, 0, 0], GOLD).p('glow', starGeo(0.6, 0.18), [0, 0, sz * 0.62], hdr('#fff3b0', 1.8));
    for (let i = 0; i <= 8; i++) { const f = i / 8; for (const sx of [-1, 1]) k.at(0, 0, 0).p('glow', sp(0.12, 6, 4), [V.x + sx * (6.2 - 5.7 * f), 0.4 + (V.pivot - 0.1) * f, V.z + sz * (4.45 - 0.7 * f)], BULB[(i + (sx > 0 ? 2 : 0)) % 4]); }
  }
  k.at(V.x, V.pivot, V.z).p('plain', cy(0.32, 0.32, 7.6, 12), [0, 0, 0], CREAM, [PI / 2, 0, 0]);
  buildKit(k, g, false);
  board(g, signTex('🏴‍☠️ 바이킹', '#5aa0d8', '#ffffff', 512, 140, 66), 2.8, 0.78, V.x, 2.4, V.z - 7.2, PI, 150);
  { const kk = new Kit(); kk.at(V.x, 0, V.z - 7.2).p('wood', bx(0.16, 2.2, 0.16), [-1.5, 1.1, 0], '#9a6a44').p('wood', bx(0.16, 2.2, 0.16), [1.5, 1.1, 0], '#9a6a44'); buildKit(kk, g, false); }
  // 흔들리는 배 (원점 = 축): 팔 · 둥근 선체 · 테두리 · 방패 무늬 · 의자 8줄 · 곰 선수상 · 꼬리 · 깃발 · 전구
  const ship = new THREE.Group(); ship.position.set(V.x, V.pivot, V.z); g.add(ship);
  const s = new Kit(), DY = -V.arm + 0.55, HULL = '#ffb48a'; // DY = 갑판 높이
  for (const sz of [-1, 1]) { for (const sx of [-1, 0, 1]) rod(s, 'plain', [0, 0, sz * 3.2], [sx * 4.6, DY + 0.2, sz * 2.0], 0.2, 0.2, sx ? HOT : PINK, 8); }
  s.at(0, 0, 0).p('plain', new THREE.SphereGeometry(1, 28, 12, 0, TAU, PI / 2, PI / 2), [0, DY, 0], HULL, [0, 0, 0], [7.6, 2.3, 2.3]);
  s.p('plain', new THREE.SphereGeometry(1, 28, 6, 0, TAU, PI / 2, PI / 6), [0, DY + 0.02, 0], '#7fd0c0', [0, 0, 0], [7.7, 2.35, 2.36]); // 테두리 아래 민트 띠
  s.p('shine', new THREE.TorusGeometry(1, 0.035, 5, 48), [0, DY + 0.05, 0], GOLD, [PI / 2, 0, 0], [7.6, 2.3, 1.6]);
  s.p('plain', new THREE.CircleGeometry(1, 32), [0, DY - 0.02, 0], '#e8b892', [-PI / 2, 0, 0], [7.4, 2.15, 1]); // 갑판
  for (let i = -2; i <= 2; i++) for (const sz of [-1, 1]) { const x = i * 2.6, zz = sz * (2.3 * Math.sqrt(Math.max(0, 1 - (x / 7.6) ** 2)) * 0.9 + 0.03); s.p('plain', new THREE.CircleGeometry(0.42, 12), [x, DY - 0.62, zz], PASTEL[(i + 2 + (sz > 0 ? 3 : 0)) % 6], [0, sz > 0 ? 0 : PI, 0]).p('shine', new THREE.TorusGeometry(0.42, 0.05, 4, 14), [x, DY - 0.62, zz], GOLD, [0, sz > 0 ? 0 : PI, 0]); }
  for (let seat = 0; seat < 16; seat += 2) { // 의자 한 줄 (두 자리) + 등받이(바깥쪽) + 손잡이 막대
    const q = vikingSeat(seat), dir = q.lx < 0 ? -1 : 1;
    const bh = q.ly - DY; // 바깥 줄일수록 높은 계단식
    s.p('plain', bx(0.55, bh, 2.2), [q.lx, q.ly - bh / 2, 0], ['#ffe0ea', '#e3f4ff', '#fff1c9', '#e8dcff'][(seat / 2) % 4]).p('plain', bx(0.12, 0.75, 2.2), [q.lx + dir * 0.32, q.ly + 0.3, 0], PASTEL[(seat / 2) % 6]).p('shine', cy(0.04, 0.04, 2.0, 5), [q.lx - dir * 0.42, q.ly + 0.35, 0], GOLD, [PI / 2, 0, 0]);
  }
  // 곰 선수상 (동쪽 뱃머리): 목 · 둥근 머리 · 귀 · 주둥이 · 눈 · 볼
  rod(s, 'plain', [7.0, DY - 0.3, 0], [8.1, DY + 2.0, 0], 0.55, 0.42, HULL, 12);
  s.at(8.35, DY + 2.55, 0).p('plain', sp(0.95, 16, 12), [0, 0, 0], '#f4c99a').p('plain', sp(0.32, 10, 8), [0.1, 0.78, 0.55], '#f4c99a').p('plain', sp(0.32, 10, 8), [0.1, 0.78, -0.55], '#f4c99a').p('plain', sp(0.16, 8, 6), [0.15, 0.8, 0.58], '#ffd6e0').p('plain', sp(0.16, 8, 6), [0.15, 0.8, -0.58], '#ffd6e0');
  s.p('plain', sp(0.4, 12, 8), [0.82, -0.18, 0], '#fff1dc', [0, 0, 0], [1, 0.8, 1]).p('plain', sp(0.13, 8, 6), [1.18, -0.08, 0], '#5a4a5e');
  for (const sz of [-1, 1]) s.p('plain', sp(0.11, 8, 6), [0.75, 0.22, sz * 0.36], '#4a3a4e').p('plain', sp(0.15, 8, 6), [0.62, -0.18, sz * 0.62], '#ffb3c8', [0, 0, 0], [1, 0.6, 0.5]);
  s.at(0, 0, 0); rod(s, 'plain', [-7.0, DY - 0.3, 0], [-8.0, DY + 1.6, 0], 0.5, 0.3, HULL, 10); s.p('plain', new THREE.TorusGeometry(0.55, 0.22, 8, 16, PI * 1.5), [-8.2, DY + 2.05, 0], HULL, [0, 0, 0.6]); // 꼬리 말림
  s.p('plain', cy(0.06, 0.06, 2.2, 5), [-6.4, DY + 1.1, 0], CREAM).p('plain', new THREE.ConeGeometry(0.55, 1.1, 3), [-6.4, DY + 1.9, 0.0], HOT, [0, 0, -PI / 2], [1, 1, 0.12]); // 깃발
  const nb = lite ? 14 : 28; for (let i = 0; i < nb; i++) { const a = (i / nb) * TAU; s.p('glow', sp(0.12, 6, 4), [Math.cos(a) * 7.62, DY + 0.12, Math.sin(a) * 2.32], BULB[i % 4]); }
  buildKit(s, ship, false);
  return { g, update(t) { const v = vikingAt(t); ship.rotation.z = v.th; return v; } };
}

/* ───────────── ⑦ 회전그네 ───────────── */
function buildSwing(root, lite) {
  const S = SWING, g = new THREE.Group(); g.name = 'ride-swing'; root.add(g);
  const k = new Kit();
  k.at(S.x, 0, S.z).p('stone', cy(3.2, 3.5, 0.3, 28), [0, 0.15, 0], '#f6e3ee').p('plain', stripes(cy(1.15, 1.35, 12.3, 24), 8, [CREAM, '#ffc9d6']), [0, 6.3, 0]);
  for (const y of [1.2, 4.5, 6.6]) k.p('shine', new THREE.TorusGeometry(1.3, 0.1, 5, 24), [0, y, 0], GOLD, [PI / 2, 0, 0]);
  for (let i = 0; i < (lite ? 8 : 16); i++) { const a = (i / (lite ? 8 : 16)) * TAU; k.p('glow', sp(0.12, 6, 4), [Math.sin(a) * 1.32, 1.6 + (i % 4) * 1.15, Math.cos(a) * 1.32], BULB[i % 4]); }
  for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; if (Math.abs(Math.atan2(Math.sin(a), -Math.cos(a))) < 0.32) continue; k.p('plain', new THREE.IcosahedronGeometry(0.42, 0), [Math.sin(a) * 15.6, 0.32, Math.cos(a) * 15.6], '#7fcf72').p('plain', sp(0.16, 6, 4), [Math.sin(a) * 15.6, 0.7, Math.cos(a) * 15.6], PASTEL[i % 6]); } // 꽃 울타리 (북쪽 열림)
  buildKit(k, g, false);
  board(g, signTex('🌸 회전그네', '#ff8fb1', '#ffffff', 512, 140, 66), 2.8, 0.78, S.x, 2.4, S.z - 16.6, PI, 150);
  { const kk = new Kit(); kk.at(S.x, 0, S.z - 16.6).p('wood', bx(0.16, 2.2, 0.16), [-1.5, 1.1, 0], '#9a6a44').p('wood', bx(0.16, 2.2, 0.16), [1.5, 1.1, 0], '#9a6a44'); buildKit(kk, g, false); }
  // 도는 꽃 지붕 (원점 = 그네 매단 높이 h): 테두리 · 꽃잎 10장 · 꽃술 · 매단 핀 · 전구
  const top = new THREE.Group(); top.position.set(S.x, S.h0, S.z); g.add(top);
  const t = new Kit();
  t.at(0, 0, 0).p('plain', new THREE.TorusGeometry(S.hang, 0.16, 6, 64), [0, 0, 0], CREAM, [PI / 2, 0, 0]).p('plain', cy(S.hang + 0.2, S.hang + 0.2, 0.5, 48, true), [0, 0.2, 0], HOT);
  for (let i = 0; i < 10; i++) t.at(0, 0, 0, (i / 10) * TAU).p('plain', sp(1, 14, 8), [0, 1.3, 4.6], [PINK, '#ffe0ea', LILAC, '#ffe0ea', PEACH][i % 5], [0.28, 0, 0], [2.2, 0.38, 3.4]); // 꽃잎 (바깥으로 살짝 늘어짐)
  t.at(0, 0, 0).p('plain', sp(2.4, 18, 10), [0, 1.9, 0], LEMON, [0, 0, 0], [1, 0.55, 1]).p('plain', sp(1.2, 14, 8), [0, 2.9, 0], GOLD);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; t.p('plain', sp(0.4, 8, 6), [Math.sin(a) * 1.3, 3.0, Math.cos(a) * 1.3], '#ffffff'); }
  t.p('glow', starGeo(0.7, 0.2), [0, 4.3, 0], hdr('#fff3b0', 1.8));
  for (let i = 0; i < S.n; i++) { const a = swingSeatA(i); t.p('plain', cy(0.05, 0.05, 0.5, 5), [Math.sin(a) * S.hang, -0.2, Math.cos(a) * S.hang], GOLD); }
  const nb = lite ? 24 : 48; for (let i = 0; i < nb; i++) { const a = (i / nb) * TAU; t.p('glow', sp(0.13, 6, 4), [Math.sin(a) * (S.hang + 0.22), 0.45, Math.cos(a) * (S.hang + 0.22)], BULB[i % 4]); }
  buildKit(t, top, false);
  // 그네 24개 (인스턴스): 지역 x = 도는 쪽, z = 바깥, 원점 = 매단 점 → 사슬 2줄 + 의자 + 등받이 + 발판
  const ck = new Kit(), L = S.chain;
  for (const o of [-0.26, 0.26]) ck.at(0, 0, 0).p('a', cy(0.025, 0.025, L - 0.1, 4), [o, -(L - 0.1) / 2, 0], '#e8e0f0');
  ck.p('a', bx(0.6, 0.1, 0.55), [0, -L - 0.05, 0], '#ffffff').p('a', bx(0.08, 0.6, 0.55), [-0.3, -L + 0.25, 0], '#ffffff').p('a', bx(0.5, 0.05, 0.2), [0.42, -L - 0.42, 0], '#d8c8e8');
  const chairs = instOf(g, ck.geometry('a'), soft('#ffffff', { vertexColors: true }), S.n), col = new THREE.Color();
  for (let i = 0; i < S.n; i++) chairs.setColorAt(i, col.set(PASTEL[i % 6]));
  const m4 = new THREE.Matrix4(), rx = new THREE.Matrix4(), ry = new THREE.Matrix4();
  return {
    g,
    update(t) {
      const w = swingAt(t); top.position.y = w.h; top.rotation.y = w.a % TAU; rx.makeRotationX(-w.phi);
      for (let i = 0; i < S.n; i++) { const a = swingSeatA(i) + w.a; ry.makeRotationY(a); m4.makeTranslation(S.x + Math.sin(a) * S.hang, w.h, S.z + Math.cos(a) * S.hang).multiply(ry).multiply(rx); chairs.setMatrixAt(i, m4); }
      chairs.instanceMatrix.needsUpdate = true; return w;
    },
  };
}

/* ───────────── ③ 롤러코스터 ───────────── */
function buildCoaster(root, lite) {
  const P = COASTER_PATH, C = COASTER, g = new THREE.Group(); g.name = 'ride-coaster'; root.add(g);
  const k = new Kit(), G2 = 0.55, step = lite ? 1.2 : 0.8;
  for (const s of [-1, 1]) k.add('two', sweep(P, 0, P.L, step, ring(0.09, 6, s * G2, 0), MINT)); // 레일 2줄 (민트)
  k.add('two', sweep(P, 0, P.L, step, [[-0.2, -0.22], [0.2, -0.22], [0.2, -0.5], [-0.2, -0.5], [-0.2, -0.22]], '#f3fbf8')); // 가운데 등뼈
  for (let s = 0; s < P.L; s += 1.3) { const [x, y, z, tx, ty, tz] = P.at(s), h = Math.hypot(tx, tz); k.at(x, y, z, Math.atan2(tx, tz)).p('plain', bx(1.3, 0.1, 0.16), [0, -0.17, 0], (s / 1.3) % 6 < 1 ? LILAC : '#e8dcff', [-Math.atan2(ty, h), 0, 0]); } // 침목
  for (const q of COASTER_POSTS) { k.at(q.x, 0, q.z).p('plain', cy(0.2, 0.26, q.h, 8), [0, q.h / 2, 0], q.h > 9 ? '#ffd6e6' : '#f6f0ff').p('stone', cy(0.5, 0.6, 0.3, 10), [0, 0.15, 0], '#f3e3d3'); if (q.h > 7) k.p('plain', new THREE.TorusGeometry(0.3, 0.07, 4, 10), [0, q.h * 0.55, 0], MINT, [PI / 2, 0, 0]); }
  for (let s = 2, i = 0; s < P.L; s += lite ? 6 : 3, i++) { const [x, y, z, tx, , tz] = P.at(s), l = Math.hypot(tx, tz), o = (i % 2 ? 1 : -1) * 0.72; if (y < 1.5) continue; k.at(0, 0, 0).p('glow', sp(0.09, 6, 4), [x - (tz / l) * o, y + 0.02, z + (tx / l) * o], BULB[i % 4]); } // 레일 옆 전구
  // 역: 승강장(북쪽, 입구 쪽) · 줄무늬 지붕 · 기둥 · 간판
  { const x0 = -440, x1 = -423, zc = 41.6;
    k.at((x0 + x1) / 2, 0, zc).p('wood', bx(x1 - x0, 0.12, 2.6, 1.2), [0, 0.06, 0], '#f0c9a0').p('plain', bx(x1 - x0, 0.012, 0.22), [0, 0.125, 1.15], '#ffe066');
    for (const x of [x0 + 0.6, (x0 + x1) / 2, x1 - 0.6]) k.at(x, 0, 39.8).p('plain', cy(0.14, 0.18, 4.2, 8), [0, 2.1, 0], CREAM).p('shine', sp(0.18, 8, 6), [0, 4.25, 0], GOLD);
    for (let i = 0; i < 10; i++) k.at(x0 + 0.85 + i * 1.7, 4.3, 42.4).p('plain', bx(1.7, 0.16, 6.2), [0, 0, 0], i % 2 ? '#ffffff' : MINT, [0.12, 0, 0]);
    for (let i = 0; i < 9; i++) k.at(x0 + 1 + i * 1.9, 3.9, 39.6).p('glow', sp(0.1, 6, 4), [0, 0, 0], BULB[i % 4]);
  }
  buildKit(k, g, false, two());
  board(g, signTex('🎢 롤러코스터', '#3fb39a', '#ffffff', 512, 140, 62), 3.0, 0.82, -431.5, 3.4, 39.7, PI, 160);
  // 차량 4량 (인스턴스, 지역: 앞 = +z, 원점 = 레일 가운데): 통통한 몸통(차마다 색) · 의자·손잡이·바퀴 · 테두리 전구 / 앞 차량은 웃는 얼굴
  const cb = new Kit(), ct = new Kit(), cl = new Kit();
  cb.at(0, 0, 0).p('a', new THREE.SphereGeometry(1, 20, 10, 0, TAU, PI / 2, PI / 2), [0, 0.95, 0], '#ffffff', [0, 0, 0], [0.88, 0.75, 1.32]).p('a', new THREE.TorusGeometry(1, 0.09, 6, 28), [0, 0.95, 0], '#ffffff', [PI / 2, 0, 0], [0.88, 1.32, 1]);
  for (const z of [C.along, -C.along]) ct.at(0, 0, 0).p('a', bx(1.25, 0.12, 0.5), [0, C.seatY - 0.06, z], '#fff8ee').p('a', bx(1.25, 0.6, 0.1), [0, C.seatY + 0.25, z - 0.3], '#fff8ee').p('a', cy(0.04, 0.04, 1.0, 5), [0, C.seatY + 0.42, z + 0.3], GOLD, [0, 0, PI / 2]);
  for (const sx of [-G2, G2]) for (const z of [-0.85, 0.85]) ct.p('a', cy(0.16, 0.16, 0.14, 10), [sx, 0.05, z], '#7b80a8', [0, 0, PI / 2]);
  ct.p('a', bx(0.3, 0.35, 0.6), [0, 0.15, 0], '#7b80a8');
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; cl.at(0, 0, 0).p('a', sp(0.08, 6, 4), [Math.cos(a) * 0.88, 0.98, Math.sin(a) * 1.32], BULB[i % 4]); }
  const cBody = instOf(g, cb.geometry('a'), soft('#ffffff', { vertexColors: true }), C.cars), cTrim = instOf(g, ct.geometry('a'), soft('#ffffff', { vertexColors: true }), C.cars), cGlow = instOf(g, cl.geometry('a'), glowMat(), C.cars);
  const col = new THREE.Color(); for (let i = 0; i < C.cars; i++) cBody.setColorAt(i, col.set([MINT, PINK, LEMON, LILAC][i]));
  const face = new THREE.Group(); g.add(face);
  { const f = new Kit(); f.at(0, 0, 0).p('plain', sp(0.62, 14, 10), [0, 0.85, 1.25], '#9fe6d2', [0, 0, 0], [1.25, 0.9, 0.8]);
    for (const sx of [-1, 1]) f.p('plain', sp(0.09, 8, 6), [sx * 0.27, 1.02, 1.73], '#4a3a4e', [0, 0, 0], [1, 1.3, 0.5]).p('plain', sp(0.11, 8, 6), [sx * 0.48, 0.78, 1.68], '#ffb3c8', [0, 0, 0], [1, 0.7, 0.4]);
    f.p('plain', new THREE.TorusGeometry(0.15, 0.03, 4, 10, PI), [0, 0.8, 1.74], '#b4506a', [0, 0, PI]).p('glow', sp(0.15, 8, 6), [0, 1.42, 1.3], hdr('#fff0b0', 2));
    buildKit(f, face, false); }
  const m4 = new THREE.Matrix4();
  return {
    g,
    update(t) {
      const c = coasterAt(t);
      for (let i = 0; i < C.cars; i++) { pathM(P, coasterCarS(c.s, i), m4); cBody.setMatrixAt(i, m4); cTrim.setMatrixAt(i, m4); cGlow.setMatrixAt(i, m4); if (!i) { face.position.setFromMatrixPosition(m4); face.quaternion.setFromRotationMatrix(m4); } }
      cBody.instanceMatrix.needsUpdate = cTrim.instanceMatrix.needsUpdate = cGlow.instanceMatrix.needsUpdate = true; return c;
    },
  };
}

/* ───────────── ⑨ 후룸라이드 ───────────── */
function buildFlume(root, lite) {
  const P = FLUME_PATH, F = FLUME, g = new THREE.Group(); g.name = 'ride-flume'; root.add(g);
  const k = new Kit(), step = lite ? 1.2 : 0.7, W2 = F.hw + 0.25;
  k.add('two', sweep(P, 0, P.L, step, [[-W2 - 0.12, 0.35], [-W2, 0.35], [-W2, -0.4], [-F.hw + 0.2, -0.5], [F.hw - 0.2, -0.5], [W2, -0.4], [W2, 0.35], [W2 + 0.12, 0.35]], '#c99b73')); // 나무 물길 (U 단면)
  k.add('two', sweep(P, 0, P.L, step, [[-W2 - 0.12, 0.35], [-W2 - 0.12, -0.42], [W2 + 0.12, -0.42], [W2 + 0.12, 0.35]], '#a8794f')); // 바깥 판
  for (let s = 0; s < P.L; s += 2.4) { const [x, y, z, tx, ty, tz] = P.at(s), h = Math.hypot(tx, tz); for (const o of [-1, 1]) k.at(x - (tz / h) * o * (W2 + 0.14), y, z + (tx / h) * o * (W2 + 0.14), Math.atan2(tx, tz)).p('plain', bx(0.12, 0.85, 0.16), [0, -0.05, 0], '#8f6440', [-Math.atan2(ty, h), 0, 0]); } // 띠쇠
  for (const q of FLUME_POSTS) k.at(q.x, 0, q.z).p('wood', bx(0.32, q.h, 0.32, 1), [0, q.h / 2, 0], '#b98b63');
  for (let i = 0, nb = lite ? 6 : 12; i < nb; i++) { const s = F.sLift0 + 2 + (i * (F.sDrop1 - F.sLift0 - 4)) / nb, [x, y, z, tx, , tz] = P.at(s), l = Math.hypot(tx, tz); for (const o of [-1, 1]) k.at(0, 0, 0).p('glow', sp(0.1, 6, 4), [x - (tz / l) * o * (W2 + 0.2), y + 0.45, z + (tx / l) * o * (W2 + 0.2)], BULB[(i + o + 1) % 4]); } // 오르막·낙하 옆 전구
  // 동굴: 물길 위 반 원통 + 울퉁불퉁 바위 + 안쪽 반짝 수정
  { const Cv = FLUME_CAVE;
    k.at(Cv.x, 0, Cv.z).p('stone', new THREE.CylinderGeometry(Cv.r, Cv.r, Cv.len, 18, 1, true, -PI / 2, PI), [0, 0, 0], '#c9b8d8', [-PI / 2, 0, 0]);
    for (let i = 0; i < 14; i++) { const h = Math.sin(i * 91.7) * 43758.5, j = h - Math.floor(h), a = -PI / 2 + (i % 7) * (PI / 6), zz = -Cv.len / 2 + 1 + Math.floor(i / 7) * (Cv.len - 2) + (j - 0.5) * 3; k.p('stone', new THREE.IcosahedronGeometry(1.6 + j * 1.2, 0), [Math.sin(a) * (Cv.r + 0.5), Math.cos(a) * (Cv.r + 0.5) * 0.9, zz], ['#cdbfe0', '#bfb0d4', '#d8cbe8'][i % 3], [j, i, 0]); }
    for (const sx of [-1, 1]) k.p('stone', new THREE.IcosahedronGeometry(1.9, 0), [sx * 4.6, 0.8, 0], '#c4b4d6', [0.3, sx, 0]).p('plain', sp(0.5, 8, 6), [sx * 4.4, 2.6, 0.6], '#7fcf72');
    for (let i = 0; i < 6; i++) k.p('glow', new THREE.OctahedronGeometry(0.22, 0), [(i % 2 ? 1 : -1) * (Cv.r - 0.4), 1.4 + (i % 3) * 0.5, -4 + i * 1.6], hdr(PASTEL[i % 6], 1.6), [0, i, 0.3]);
    k.p('stone', new THREE.TorusGeometry(Cv.r + 0.1, 0.35, 6, 18, PI), [0, 0, Cv.len / 2], '#e0d4ee').p('stone', new THREE.TorusGeometry(Cv.r + 0.1, 0.35, 6, 18, PI), [0, 0, -Cv.len / 2], '#e0d4ee'); }
  // 작은 폭포: 물길 서쪽 바위 절벽에서 물길로 떨어짐
  const FX = -385.0, FZ = 69;
  k.at(FX - 3.2, 0, FZ).p('stone', new THREE.IcosahedronGeometry(2.6, 0), [0, 1.5, 0], '#cdbfe0', [0.2, 0.5, 0], [0.9, 1.5, 1.2]).p('stone', new THREE.IcosahedronGeometry(1.6, 0), [0.2, 3.6, 0.9], '#d8cbe8', [0.5, 0.2, 0]).p('plain', sp(0.7, 8, 6), [-0.4, 4.6, -0.5], '#7fcf72').p('plain', sp(0.18, 6, 4), [-0.2, 5.1, -0.4], HOT);
  // 나루 (북쪽, 입구 쪽): 나무 바닥 · 줄무늬 지붕 · 기둥 · 간판
  { const x0 = -373, x1 = -348;
    k.at((x0 + x1) / 2, 0, 38.2).p('wood', bx(x1 - x0, 0.12, 2.6, 1.2), [0, 0.06, 0], '#f0c9a0');
    for (const x of [x0 + 0.6, (x0 + x1) / 2, x1 - 0.6]) k.at(x, 0, 37.1).p('plain', cy(0.14, 0.18, 3.8, 8), [0, 1.9, 0], CREAM).p('shine', sp(0.18, 8, 6), [0, 3.85, 0], GOLD);
    for (let i = 0; i < 14; i++) k.at(x0 + 0.9 + i * 1.78, 3.9, 39.0).p('plain', bx(1.78, 0.16, 5.4), [0, 0, 0], i % 2 ? '#ffffff' : SKY, [0.12, 0, 0]);
    for (let i = 0; i < 12; i++) k.at(x0 + 1 + i * 2.1, 3.5, 36.9).p('glow', sp(0.1, 6, 4), [0, 0, 0], BULB[i % 4]); }
  buildKit(k, g, false, two());
  board(g, signTex('🪵 후룸라이드', '#5aa0d8', '#ffffff', 512, 140, 62), 3.0, 0.82, -360.5, 3.1, 36.95, PI, 160);
  // 물: 흐르는 무늬 (물살 쪽으로 움직임) · 폭포 판
  const wt = waterTex(), wmat = new THREE.MeshBasicMaterial({ map: wt, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide });
  const water = new THREE.Mesh(sweep(P, 0, P.L, step, [[-F.hw + 0.05, 0], [0, 0.03], [F.hw - 0.05, 0]], '#ffffff'), nightGlow(wmat, 1, 0.55, 0.5)); water.renderOrder = 2; g.add(water);
  const ft = wt.clone(); ft.repeat.set(1, 1.5); ft.needsUpdate = true;
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.6), nightGlow(new THREE.MeshBasicMaterial({ map: ft, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }), 1, 0.55, 0.5)); fall.position.set(FX - 0.3, 2.2, FZ); fall.rotation.y = PI / 2; g.add(fall);
  const spray = sprayPoints(g, lite ? 90 : 200);
  // 통나무 배 3척 (인스턴스, 지역: 앞 = +z, 원점 = 배 가운데 물 높이): 통나무 몸통 · 나이테 끝 · 의자 3줄 · 손잡이
  const bb = new Kit(), bt = new Kit(), HL = F.len / 2;
  bb.at(0, 0, 0).p('a', cy(0.95, 0.95, F.len - 0.6, 16), [0, 0.05, 0], '#b98256', [PI / 2, 0, 0], [1, 1, 0.62]).p('a', sp(0.95, 16, 10), [0, 0.05, HL - 0.3], '#b98256', [0, 0, 0], [1, 0.62, 0.7]).p('a', sp(0.95, 16, 10), [0, 0.05, -HL + 0.3], '#b98256', [0, 0, 0], [1, 0.62, 0.55]);
  bt.at(0, 0, 0).p('a', bx(1.5, 0.05, F.len - 0.9), [0, 0.5, 0], '#7a5236');
  for (const z of F.rows.map((r) => r + HL)) bt.p('a', bx(1.3, 0.14, 0.5), [0, F.seatY - 0.07 + 0.0, z], '#f0c9a0').p('a', bx(1.3, 0.4, 0.08), [0, F.seatY + 0.2, z - 0.3], '#e8b892');
  bt.p('a', new THREE.TorusGeometry(0.42, 0.06, 5, 14), [0, 0.32, HL + 0.05], '#f0d2a8', [0, 0, 0]).p('a', new THREE.CircleGeometry(0.36, 14), [0, 0.32, HL + 0.07], '#e6c08c').p('a', sp(0.13, 8, 6), [0, 0.95, HL - 0.25], '#7fcf72'); // 앞 나이테 · 새싹
  const bBody = instOf(g, bb.geometry('a'), soft('#ffffff', { vertexColors: true }), F.boats), bTrim = instOf(g, bt.geometry('a'), soft('#ffffff', { vertexColors: true }), F.boats);
  const m4 = new THREE.Matrix4(), last = [0, 0, 0];
  let fallT = 0;
  return {
    g,
    update(t, dt) {
      wt.offset.y -= dt * 0.75; ft.offset.y += dt * 1.6; fallT += dt;
      const boats = [];
      for (let i = 0; i < F.boats; i++) {
        const b = flumeBoat(i, t); boats.push(b); pathM(P, b.s - HL, m4); bBody.setMatrixAt(i, m4); bTrim.setMatrixAt(i, m4);
        const sm = ((b.s % P.L) + P.L) % P.L, prev = last[i]; last[i] = sm;
        if (prev < F.sDrop1 - 1 && sm >= F.sDrop1 - 1 && sm - prev < 5) { const [x, y, z, tx, , tz] = P.at(F.sDrop1); spray.burst(x, y + 0.3, z, lite ? 50 : 110, 1.4, [tx, tz]); boats.splash = i + 1; } // 낙하 끝: 풍덩!
      }
      if (fallT > 0.12) { fallT = 0; spray.burst(FX + 0.6, 0.6, FZ, 2, 0.35); } // 폭포 물보라
      spray.update(dt);
      bBody.instanceMatrix.needsUpdate = bTrim.instanceMatrix.needsUpdate = true; return boats;
    },
  };
}

/* ═════════════ 2단계 B: 범퍼카 · 회전 찻잔 (탄 사람이 직접 조작) ═════════════ */
const CANDY = ['#ff8fb1', '#8fdcc4', '#ffd45a', '#cdb6ff', '#9fd3ff', '#ffb38a', '#ff9fe0', '#a8e89a', '#ffc46b', '#b8c8ff'];
/* ───────────── ⑤ 범퍼카: 파스텔 실내 경기장 ─────────────
   inner(늘 보임) = 반짝이는 타일 바닥 · 고무 테두리 · 로비 · 안을 보는 벽 면 · 아래를 보는 천장 면 · 전구 / outer(바깥 껍데기) = 벽 · 줄무늬 지붕 · 정면 아치 · 둥근 창.
   내가 건물 안(로비·차)에 있으면 outer 를 숨김 → 카메라가 벽 밖에 있어도 안이 보임 (안쪽 면은 한쪽만 그려서 바깥에서 보면 투명) */
function buildBumper(root, lite) {
  const B = BUMPER, [hx0, hz0, hx1, hz1] = B.hall, [bx0, bz0, bx1, bz1] = B.box, H = 6.2, T = 0.6, g = new THREE.Group(); g.name = 'ride-bumper'; root.add(g);
  const cx = (hx0 + hx1) / 2, cz = (hz0 + hz1) / 2, W = hx1 - hx0, D = hz1 - hz0;
  const inner = new THREE.Group(), outer = new THREE.Group(); g.add(inner, outer);
  const k = new Kit(), TILE = ['#ffd6e6', '#d9f3ea', '#fff1c9', '#e8dcff', '#dff0ff'];
  k.at(0, 0, 0).p('plain', bx(bx1 - bx0 + 1.2, 0.04, bz1 - bz0 + 1.2), [(bx0 + bx1) / 2, 0.02, (bz0 + bz1) / 2], '#ffffff');
  const NX = 16, NZ = 9, tw = (bx1 - bx0) / NX, td = (bz1 - bz0) / NZ;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) k.p('plain', bx(tw - 0.08, 0.05, td - 0.08), [bx0 + (i + 0.5) * tw, 0.045, bz0 + (j + 0.5) * td], TILE[(i + j * 2) % 5]);
  for (let i = 0; i < (lite ? 24 : 48); i++) { const h = Math.sin(i * 78.233) * 43758.5, f = h - Math.floor(h), x = bx0 + 1 + ((i * 7.31) % (bx1 - bx0 - 2)), z = bz0 + 1 + f * (bz1 - bz0 - 2); k.p('glow', starGeo(0.18 + f * 0.14, 0.02), [x, 0.08, z], hdr(PASTEL[i % 6], 1.5), [-PI / 2, 0, f * 3]); } // 바닥 반짝이 별
  // 고무 테두리 (분홍·흰 줄무늬)
  const rim = (ax, az, bx_, bz_) => { const L = Math.hypot(bx_ - ax, bz_ - az), n = Math.round(L / 1.6), ry = Math.atan2(bx_ - ax, bz_ - az); for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; k.at(ax + (bx_ - ax) * f, 0, az + (bz_ - az) * f, ry).p('plain', bx(0.5, 0.55, L / n - 0.04), [0, 0.3, 0], i % 2 ? '#ffffff' : HOT); } };
  rim(bx0 - 0.25, bz0 - 0.25, bx1 + 0.25, bz0 - 0.25); rim(bx0 - 0.25, bz1 + 0.25, bx1 + 0.25, bz1 + 0.25); rim(bx0 - 0.25, bz0, bx0 - 0.25, bz1); rim(bx1 + 0.25, bz0, bx1 + 0.25, bz1);
  // 로비: 나무 바닥 · 대기 줄(금빛 기둥 + 분홍 줄, 문 앞은 비움)
  const [lx0, lz0, lx1, lz1] = B.lobby;
  k.at(0, 0, 0).p('wood', bx(lx1 - lx0, 0.08, lz1 - lz0 + 0.2, 1.2), [cx, 0.04, (lz0 + lz1) / 2], '#f0c9a0');
  for (const [x0, x1] of [[lx0 + 1.5, B.x - B.door - 1], [B.x + B.door + 1, lx1 - 1.5]]) {
    const n = Math.round((x1 - x0) / 2.2);
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; k.p('shine', cy(0.06, 0.06, 0.95, 6), [x, 0.5, 39.0], GOLD).p('shine', sp(0.1, 8, 6), [x, 1.0, 39.0], GOLD); if (i < n) k.p('plain', cy(0.035, 0.035, (x1 - x0) / n - 0.1, 5), [x + (x1 - x0) / n / 2, 0.82, 39.0], HOT, [0, 0, PI / 2]); }
  }
  // 안쪽 면: 아래 분홍 띠 + 위 크림 (한쪽만 = 안을 봄), 천장 (아래를 봄) + 전기 그물 + 전구
  const wallIn = (x, z, w, ry, y0 = 0, h = H) => { k.at(x, 0, z, ry).p('plain', new THREE.PlaneGeometry(w, Math.min(1.6, h)), [0, y0 + Math.min(1.6, h) / 2, 0], '#ffc4d2'); if (h > 1.6) k.p('plain', new THREE.PlaneGeometry(w, h - 1.6), [0, y0 + 1.6 + (h - 1.6) / 2, 0], '#fff4f8'); };
  wallIn(cx, hz1 - T - 0.01, W - 2 * T, PI); wallIn(hx0 + T + 0.01, cz, D - 2 * T, PI / 2); wallIn(hx1 - T - 0.01, cz, D - 2 * T, -PI / 2);
  const nw = (W - 2 * B.door) / 2 - T; for (const s of [-1, 1]) wallIn(B.x + s * (B.door + nw / 2), hz0 + T + 0.01, nw, 0);
  k.at(B.x, 3.8, hz0 + T + 0.01, 0).p('plain', new THREE.PlaneGeometry(2 * B.door, H - 3.8), [0, (H - 3.8) / 2, 0], '#fff4f8');
  for (let i = 0; i < 12; i++) { const a = i < 6, x = a ? hx0 + T + 0.03 : hx1 - T - 0.03, z = bz0 + 1.5 + (i % 6) * 3.7; k.at(x, 0, z, a ? PI / 2 : -PI / 2).p('glow', starGeo(0.55, 0.04), [0, 3.4 + (i % 2) * 0.9, 0], hdr(PASTEL[i % 6], 1.5)); } // 벽 별
  k.at(cx, H, cz).p('plain', new THREE.PlaneGeometry(W - 2 * T, D - 2 * T), [0, 0, 0], '#efe4ff', [PI / 2, 0, 0]);
  for (let x = bx0; x <= bx1 + 0.01; x += (bx1 - bx0) / 12) k.at(0, 0, 0).p('shine', bx(0.05, 0.05, bz1 - bz0), [x, H - 0.12, (bz0 + bz1) / 2], '#e8e0f0');
  for (let z = bz0; z <= bz1 + 0.01; z += (bz1 - bz0) / 7) k.at(0, 0, 0).p('shine', bx(bx1 - bx0, 0.05, 0.05), [(bx0 + bx1) / 2, H - 0.12, z], '#e8e0f0');
  const step = lite ? 4.6 : 3.1;
  for (let x = hx0 + 2.2, i = 0; x < hx1 - 1.5; x += step) for (let z = hz0 + 2.2; z < hz1 - 1.5; z += step, i++) k.at(0, 0, 0).p('glow', sp(0.16, 8, 6), [x, H - 0.45, z], BULB[i % 4]).p('plain', cy(0.015, 0.015, 0.3, 4), [x, H - 0.2, z], '#d8c8e8'); // 전구 천장
  buildKit(k, inner, false);
  // 바깥 껍데기: 파스텔 벽(민트 아랫단·크림 처마) · 줄무늬 박공 지붕 · 둥근 창 · 정면 아치 · 차양 · 간판
  const o = new Kit(), WALL = '#ffe3ec';
  const wallOut = (x0, z0, x1, z1, y0 = 0, h = H) => { o.at((x0 + x1) / 2, 0, (z0 + z1) / 2).p('plain', bx(x1 - x0, h, z1 - z0), [0, y0 + h / 2, 0], WALL); if (!y0) o.p('plain', bx(x1 - x0 + 0.12, 0.9, z1 - z0 + 0.12), [0, 0.45, 0], '#9fe0cf'); o.p('plain', bx(x1 - x0 + 0.3, 0.3, z1 - z0 + 0.3), [0, H - 0.1, 0], CREAM); };
  wallOut(hx0, hz1 - T, hx1, hz1); wallOut(hx0, hz0, hx0 + T, hz1 - T); wallOut(hx1 - T, hz0, hx1, hz1 - T);
  wallOut(hx0 + T, hz0, B.x - B.door, hz0 + T); wallOut(B.x + B.door, hz0, hx1 - T, hz0 + T); wallOut(B.x - B.door, hz0, B.x + B.door, hz0 + T, 3.8, H - 3.8);
  const win = (x, z, ry) => o.at(x, 0, z, ry).p('glow', new THREE.CircleGeometry(0.85, 18), [0, 3.4, 0.02], hdr(LEMON, 1.15)).p('plain', new THREE.TorusGeometry(0.88, 0.12, 6, 20), [0, 3.4, 0.04], CREAM);
  for (let i = 0; i < 6; i++) { const x = hx0 + 4 + i * ((W - 8) / 5); win(x, hz1, 0); }
  for (let i = 0; i < 4; i++) { const z = hz0 + 5 + i * ((D - 9) / 3); win(hx0, z, -PI / 2); win(hx1, z, PI / 2); }
  for (const x of [hx0 + 5, hx0 + 10.5, hx1 - 10.5, hx1 - 5]) win(x, hz0, PI);
  const SL = 0.33, RISE = (D / 2 + 0.8) * Math.tan(SL), RL = (D / 2 + 0.8) / Math.cos(SL), NS = 10; // 박공 지붕 (용마루는 x 방향)
  for (const s of [-1, 1]) for (let i = 0; i < NS; i++) o.at(hx0 - 0.8 + ((i + 0.5) * (W + 1.6)) / NS, H + RISE / 2 + 0.15, cz + (s * (D / 2 + 0.8)) / 2).p('plain', bx((W + 1.6) / NS + 0.01, 0.35, RL), [0, 0, 0], i % 2 ? '#ffffff' : '#ffb3c8', [s * SL, 0, 0]);
  o.at(cx, H + RISE + 0.3, cz).p('shine', cy(0.32, 0.32, W + 2, 12), [0, 0, 0], GOLD, [0, 0, PI / 2]);
  { const sh = new THREE.Shape(); sh.moveTo(-D / 2 - 0.2, 0); sh.lineTo(D / 2 + 0.2, 0); sh.lineTo(0, RISE); sh.closePath(); const tri = new THREE.ShapeGeometry(sh); // 박공 세모 벽 (동·서)
    for (const s of [-1, 1]) o.at(s < 0 ? hx0 + 0.05 : hx1 - 0.05, H + 0.15, cz, s * PI / 2).p('plain', tri.clone(), [0, 0, 0], '#fff4e6'); }
  for (const s of [-1, 1]) for (let i = 0; i < 22; i++) { const x = hx0 - 0.6 + ((i + 0.5) * (W + 1.2)) / 22; o.at(x, H + 0.05, cz + s * (D / 2 + 0.75)).p('plain', new THREE.CircleGeometry(0.95, 10, PI, PI), [0, 0, 0], [HOT, CREAM, MINT][i % 3], [0, s < 0 ? PI : 0, 0]).p('glow', sp(0.13, 6, 4), [0, 0.2, 0], BULB[i % 4]); } // 처마 물결 · 전구
  o.at(B.x, 0, hz0 - 0.15); for (const s of [-1, 1]) o.p('plain', stripes(cy(0.42, 0.48, 4.6, 16), 6, [CREAM, '#ffb3c8']), [s * (B.door + 0.4), 2.3, 0]).p('shine', sp(0.5, 10, 8), [s * (B.door + 0.4), 4.85, 0], GOLD);
  o.p('plain', new THREE.TorusGeometry(B.door + 0.4, 0.3, 8, 28, PI), [0, 4.7, 0], HOT); for (let i = 0; i <= 12; i++) { const a = (i / 12) * PI; o.p('glow', sp(0.15, 6, 4), [Math.cos(a) * (B.door + 0.4), 4.7 + Math.sin(a) * (B.door + 0.4), -0.32], BULB[i % 4]); }
  o.p('plain', new THREE.CylinderGeometry(1.1, 1.1, 2 * B.door, 16, 1, true, -PI / 2, PI), [0, 3.75, -0.6], '#ffffff', [0, 0, PI / 2], [1, 1, 0.8]); // 문 위 차양
  o.p('glow', starGeo(1.4, 0.3), [0, H + RISE - 0.6, -0.8], hdr('#fff3b0', 1.8)).p('shine', starGeo(1.9, 0.4), [0, H + RISE - 0.6, -0.55], GOLD); // 박공 위 큰 별
  buildKit(o, outer, false);
  board(outer, signTex('🚗 범퍼카', '#ff6f9a', '#ffffff', 512, 140, 70), 5.2, 1.4, B.x, 5.75, hz0 - 0.5, PI, 220);
  board(inner, signTex('콩! 부딪혀도 괜찮아요', '#b08ad8', '#ffffff', 512, 110, 46), 4.6, 1.0, B.x, 4.6, hz1 - T - 0.05, PI, 80);
  // 차 10대 (인스턴스, 지역: 앞 = +z, 바닥 = 0): 통통한 몸통(차마다 사탕색) · 고무 범퍼·의자·핸들·천장 기둥 · 앞 등·기둥 끝 불꽃
  const cb = new Kit(), ct = new Kit(), cl = new Kit(), PZ = -0.95;
  cb.at(0, 0, 0).p('a', lathe([[0.82, 0.16], [0.98, 0.2], [1.04, 0.42], [0.98, 0.7], [0.86, 0.74], [0.84, 0.3]], 26), [0, 0, 0], '#ffffff', [0, 0, 0], [1, 1, 1.3]).p('a', sp(0.7, 16, 10), [0, 0.62, 0.72], '#ffffff', [0, 0, 0], [1.15, 0.5, 0.75]);
  ct.at(0, 0, 0).p('a', new THREE.TorusGeometry(1.0, 0.2, 8, 28), [0, 0.24, 0], '#5a5f86', [PI / 2, 0, 0], [1.08, 1.36, 1]).p('a', new THREE.CircleGeometry(0.85, 20), [0, 0.3, 0], '#fff8ee', [-PI / 2, 0, 0], [1, 1.25, 1]);
  ct.p('a', bx(1.1, 0.26, 0.6), [0, 0.47, -0.35], '#fff8ee').p('a', bx(1.1, 0.75, 0.16), [0, 0.8, -0.72], '#fff8ee');
  ct.p('a', cy(0.04, 0.04, 0.55, 5), [0, 0.82, 0.42], '#d8c8e8', [-0.6, 0, 0]).p('a', new THREE.TorusGeometry(0.2, 0.045, 5, 14), [0, 1.05, 0.3], '#5a5f86', [-0.95, 0, 0]);
  ct.p('a', cy(0.045, 0.045, H - 1.0, 5), [0, 0.9 + (H - 1.0) / 2, PZ], '#f6f0ff').p('a', new THREE.TorusGeometry(0.16, 0.05, 4, 10), [0, H - 0.18, PZ], '#e8e0f0', [PI / 2, 0, 0]);
  for (const sx of [-1, 1]) cl.at(0, 0, 0).p('a', sp(0.12, 8, 6), [sx * 0.42, 0.55, 1.28], hdr('#fff0c0', 1.6)).p('a', sp(0.08, 6, 4), [sx * 0.5, 0.5, -1.3], hdr('#ff9fb8', 1.6));
  cl.p('a', sp(0.13, 8, 6), [0, H - 0.1, PZ], hdr('#fff3b0', 2));
  const cBody = instOf(g, cb.geometry('a'), soft('#ffffff', { vertexColors: true }), B.n), cTrim = instOf(g, ct.geometry('a'), soft('#ffffff', { vertexColors: true }), B.n), cGlow = instOf(g, cl.geometry('a'), glowMat(), B.n);
  const col = new THREE.Color(); for (let i = 0; i < B.n; i++) cBody.setColorAt(i, col.set(CANDY[i]));
  const spark = sprayPoints(g, lite ? 60 : 140, '#ffe6a0'), m4 = new THREE.Matrix4();
  return {
    g, outer,
    update(cars, dt) {
      cars.forEach((c, i) => { m4.makeRotationY(c.a).setPosition(c.x, 0, c.z); cBody.setMatrixAt(i, m4); cTrim.setMatrixAt(i, m4); cGlow.setMatrixAt(i, m4); });
      cBody.instanceMatrix.needsUpdate = cTrim.instanceMatrix.needsUpdate = cGlow.instanceMatrix.needsUpdate = true; spark.update(dt);
    },
    bump(x, z, f) { spark.burst(x, 0.7, z, lite ? 10 : 22, 0.45 + 0.1 * f); }, // 반짝 불꽃 (세기에 따라 조금 더)
  };
}

/* ───────────── ⑥ 회전 찻잔: 가운데 거대 찻주전자(멈춰 있음) · 도는 회전판 · 찻잔 8개(인스턴스, 회전판 각 + 자기 회전) ───────────── */
function buildTeacups(root, lite) {
  const K = TEACUPS, g = new THREE.Group(); g.name = 'ride-teacups'; root.add(g);
  const k = new Kit();
  k.at(K.x, 0, K.z).p('stone', cy(K.plat + 0.9, K.plat + 1.2, 0.3, 48), [0, 0.15, 0], '#f6e3ee').p('plain', new THREE.TorusGeometry(K.plat + 1.0, 0.1, 5, 64), [0, 0.3, 0], CREAM, [PI / 2, 0, 0]);
  for (let i = 0; i < (lite ? 16 : 32); i++) { const a = (i / (lite ? 16 : 32)) * TAU; k.p('glow', sp(0.13, 6, 4), [Math.sin(a) * (K.plat + 1.12), 0.33, Math.cos(a) * (K.plat + 1.12)], BULB[i % 4]); }
  for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; if (Math.abs(Math.atan2(Math.sin(a), -Math.cos(a))) < 0.28) continue; k.p('plain', new THREE.IcosahedronGeometry(0.45, 0), [Math.sin(a) * 17, 0.34, Math.cos(a) * 17], '#7fcf72').p('plain', sp(0.17, 6, 4), [Math.sin(a) * 17, 0.74, Math.cos(a) * 17], PASTEL[i % 6]); } // 꽃 울타리 (북쪽 입구 열림)
  // 찻주전자 (가운데, 멈춰 있음): 민트 몸통 · 흰 물방울 무늬 · 분홍 뚜껑 · 금 손잡이 · 주둥이 · 김 · 뚜껑 전구
  k.p('plain', lathe([[0.01, 0.3], [2.3, 0.35], [3.1, 1.1], [3.5, 2.5], [3.25, 3.8], [2.5, 4.6], [1.6, 4.95], [0.01, 5.0]], 28), [0, 0, 0], MINT);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + (i % 2) * 0.2, y = i % 2 ? 1.6 : 3.2, r = i % 2 ? 3.3 : 3.42; k.p('plain', sp(0.36, 10, 8), [Math.sin(a) * r, y, Math.cos(a) * r], '#ffffff', [0, a, 0], [1, 1, 0.3]); }
  k.p('plain', lathe([[1.75, 4.85], [1.85, 5.1], [1.3, 5.65], [0.35, 5.95], [0.01, 6.0]], 24), [0, 0, 0], PINK).p('shine', sp(0.45, 12, 8), [0, 6.35, 0], GOLD).p('shine', new THREE.TorusGeometry(1.82, 0.1, 5, 32), [0, 4.95, 0], GOLD, [PI / 2, 0, 0]);
  rod(k, 'plain', [K.x + 2.9, 2.0, K.z], [K.x + 5.2, 4.3, K.z], 0.6, 0.32, MINT, 14); k.at(K.x, 0, K.z).p('shine', new THREE.TorusGeometry(0.34, 0.08, 6, 14), [5.25, 4.35, 0], GOLD, [0, 0, -0.8]); // 주둥이 (동쪽)
  k.p('plain', new THREE.TorusGeometry(1.45, 0.34, 8, 20, PI * 1.25), [-3.55, 2.7, 0], PINK, [0, 0, -PI * 0.62]); // 손잡이 (서쪽)
  for (const [x, y, r] of [[5.6, 5.1, 0.42], [5.9, 5.8, 0.34], [5.5, 6.4, 0.28]]) k.p('plain', sp(r, 10, 8), [x, y, 0], '#ffffff'); // 김 몽글
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; k.p('glow', sp(0.13, 6, 4), [Math.sin(a) * 1.95, 5.05, Math.cos(a) * 1.95], BULB[i % 4]); }
  k.p('glow', starGeo(0.6, 0.18), [0, 7.2, 0], hdr('#fff3b0', 1.8));
  k.at(K.x, 0, K.z - 17.6).p('wood', bx(0.16, 2.2, 0.16), [-1.5, 1.1, 0], '#9a6a44').p('wood', bx(0.16, 2.2, 0.16), [1.5, 1.1, 0], '#9a6a44');
  buildKit(k, g, false);
  board(g, signTex('☕ 회전 찻잔', '#e48ab4', '#ffffff', 512, 140, 66), 2.8, 0.78, K.x, 2.4, K.z - 17.6, PI, 150);
  // 도는 회전판 (가운데 원점): 크림 판 · 파스텔 고리 · 찻잔 자리마다 꽃 무늬 · 금 테두리 · 전구
  const spin = new THREE.Group(); spin.position.set(K.x, 0, K.z); g.add(spin);
  const s = new Kit();
  s.at(0, 0, 0).p('plain', cy(K.plat, K.plat, 0.3, 56), [0, K.deck - 0.15, 0], CREAM).p('plain', cy(K.plat + 0.06, K.plat + 0.06, 0.1, 56), [0, K.deck - 0.25, 0], HOT);
  for (const [r0, r1, c] of [[3.8, 4.4, '#ffe0ea'], [6.6, 7.0, '#d9f3ea'], [11.6, 12.1, '#ffe9b8']]) s.p('plain', new THREE.RingGeometry(r0, r1, 48), [0, K.deck + 0.005, 0], c, [-PI / 2, 0, 0]);
  for (let c = 0; c < K.n; c++) { const a = cupHome(c); s.p('plain', new THREE.CircleGeometry(2.3, 24), [Math.sin(a) * K.ring, K.deck + 0.01, Math.cos(a) * K.ring], PASTEL[c % 6], [-PI / 2, 0, 0]); for (let i = 0; i < 6; i++) { const b = a + (i / 6) * TAU; s.p('plain', new THREE.CircleGeometry(0.5, 10), [Math.sin(a) * K.ring + Math.sin(b) * 2.6, K.deck + 0.012, Math.cos(a) * K.ring + Math.cos(b) * 2.6], '#ffffff', [-PI / 2, 0, 0]); } }
  s.p('shine', new THREE.TorusGeometry(K.plat, 0.12, 5, 64), [0, K.deck, 0], GOLD, [PI / 2, 0, 0]);
  for (let i = 0; i < (lite ? 24 : 48); i++) { const a = (i / (lite ? 24 : 48)) * TAU; s.p('glow', sp(0.12, 6, 4), [Math.sin(a) * (K.plat - 0.35), K.deck + 0.1, Math.cos(a) * (K.plat - 0.35)], BULB[i % 4]); }
  buildKit(s, spin, false);
  // 찻잔 8개 (인스턴스, 지역 원점 = 찻잔 가운데 회전판 높이): 몸통(찻잔마다 색) · 받침·금 테·손잡이·물방울 무늬·가운데 핸들·둥근 방석 · 받침 전구
  const ub = new Kit(), ut = new Kit(), ul = new Kit(), D0 = K.deck;
  ub.at(0, 0, 0).p('a', lathe([[0.01, 0.12], [1.0, 0.16], [1.3, 0.42], [1.46, 0.9], [1.5, 1.32], [1.4, 1.34], [1.32, 0.95], [1.16, 0.5], [0.01, 0.46]], 28), [0, D0, 0], '#ffffff');
  ut.at(0, 0, 0).p('a', cy(1.9, 1.8, 0.12, 28), [0, D0 + 0.06, 0], '#fff8ee').p('a', new THREE.TorusGeometry(1.48, 0.07, 5, 28), [0, D0 + 1.33, 0], GOLD, [PI / 2, 0, 0]);
  ut.p('a', new THREE.TorusGeometry(0.42, 0.11, 6, 12, PI * 1.25), [1.62, D0 + 0.9, 0], '#fff8ee', [0, 0, -PI * 0.62]);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.4; ut.p('a', sp(0.2, 8, 6), [Math.sin(a) * 1.43, D0 + 0.85, Math.cos(a) * 1.43], '#ffffff', [0, a, 0], [1, 1, 0.3]); }
  ut.p('a', cy(0.13, 0.18, 0.65, 8), [0, D0 + 0.75, 0], '#d8c8e8').p('a', cy(0.48, 0.48, 0.09, 16), [0, D0 + 1.1, 0], HOT).p('a', sp(0.12, 8, 6), [0, D0 + 1.2, 0], GOLD); // 가운데 손잡이 = 빠르기 바퀴
  ut.p('a', new THREE.TorusGeometry(K.seatR + 0.05, 0.22, 6, 20), [0, K.seatY - 0.22, 0], '#fff1f5', [PI / 2, 0, 0]); // 둥근 방석
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ul.at(0, 0, 0).p('a', sp(0.08, 6, 4), [Math.sin(a) * 1.85, D0 + 0.16, Math.cos(a) * 1.85], BULB[i % 4]); }
  const uBody = instOf(g, ub.geometry('a'), soft('#ffffff', { vertexColors: true }), K.n), uTrim = instOf(g, ut.geometry('a'), soft('#ffffff', { vertexColors: true }), K.n), uGlow = instOf(g, ul.geometry('a'), glowMat(), K.n);
  const col = new THREE.Color(); for (let c = 0; c < K.n; c++) uBody.setColorAt(c, col.set([PINK, SKY, LEMON, LILAC, MINT, PEACH, '#ff9fd0', '#b8e0a0'][c]));
  const m4 = new THREE.Matrix4();
  return {
    g,
    update(t, sim) {
      const p = teacupsAt(t); spin.rotation.y = p.a % TAU;
      for (let c = 0; c < K.n; c++) { const ph = cupHome(c) + p.a; m4.makeRotationY((ph + cupSpin(sim.cups[c], t)) % TAU).setPosition(K.x + K.ring * Math.sin(ph), 0, K.z + K.ring * Math.cos(ph)); uBody.setMatrixAt(c, m4); uTrim.setMatrixAt(c, m4); uGlow.setMatrixAt(c, m4); }
      uBody.instanceMatrix.needsUpdate = uTrim.instanceMatrix.needsUpdate = uGlow.instanceMatrix.needsUpdate = true; return p;
    },
  };
}

/* ───────────── 화면 연결 ───────────── */
export function createRides({ scene, camera, Q, players, getMe, send, toast, host, aim }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const lite = Q.lite || Q.level === 'low';
  const root = new THREE.Group(); root.name = 'rides'; scene.add(root);
  const ferris = buildFerris(root, lite), carousel = buildCarousel(root, lite), track = buildTrack(root, lite), train = buildTrain(root, lite);
  const drop = buildDrop(root, lite), viking = buildViking(root, lite), swing = buildSwing(root, lite), coaster = buildCoaster(root, lite), flume = buildFlume(root, lite);
  const bumper = buildBumper(root, lite), teacups = buildTeacups(root, lite);
  const B2 = [[drop, DROP.x, DROP.z, 320], [viking, VIKING.x, VIKING.z, 240], [swing, SWING.x, SWING.z, 240], [coaster, -462, 40, 320], [flume, -360, 60, 260], [bumper, BUMPER.x, BUMPER.zc, 240], [teacups, TEACUPS.x, TEACUPS.z, 240]]; // 2단계 A·B: 모양 · 가운데 · 숨기는 거리
  // 조작 기구 상태: sims = 화면에 그리는 값 (범퍼카 = 보여 주는 차, 찻잔 = 서버와 같은 찻잔 상태), btg = 서버가 보낸 차 (다른 차는 이쪽으로 부드럽게 따라감), drv = 내 조작
  const sims = {}; for (const R of Object.values(RIDES)) if (R.init) sims[R.id] = R.init();
  const btg = RIDES.bumper.init().cars, drv = { u: 0, s: 0, su: 0, ss: 0, at: 0, d: 0 };
  const angD = (a) => ((((a + PI) % TAU) + TAU) % TAU) - PI;
  let lastDrop = '', lastC = 0, lastTh = 0, lastUp = false;
  const q = host.appendChild(Object.assign(document.createElement('div'), { id: 'rdq', className: 'panel', hidden: true }));
  const sitq = document.querySelector('#sitq');
  let off = 0, qKey = '', near = null, base = null, lastSt = -2, fy = null, dragAt = 0, pv = null, slope = 0;
  document.querySelector('#c')?.addEventListener('pointermove', (e) => { if (e.buttons) dragAt = performance.now(); }); // 끌어서 둘러보면 잠시 따라가기를 멈춤
  const riders = new Map(); // 사람 id → { r, seat }
  const now = () => Date.now() + off;
  const sync = (sv) => { if (!Number.isFinite(sv)) return; const o = sv - Date.now(); off = Math.abs(o - off) > 1500 ? o : off + (o - off) * 0.2; }; // 서버 시각 맞추기 (가끔 오는 시각으로 천천히)
  const mine = () => { const me = getMe(); return me && riders.get(me.id); };
  const cam = new THREE.Vector3();

  function panel(key, html, cls = '') { if (key === qKey) return; qKey = key; q.hidden = !key; q.className = 'panel ' + cls; if (key) q.innerHTML = html; }
  q.onclick = (e) => { const a = e.target.closest('button')?.dataset.a; if (a === 'on' && near) send({ t: 'ride', op: 'on', id: near }); else if (a === 'off') send({ t: 'ride', op: 'off' }); else if (a === 'fast' || a === 'slow') send({ t: 'ride', op: 'in', d: a === 'fast' ? 1 : -1 }); };
  // 가까운 기구 탑승구: 대관람차 승강장 · 회전목마 둘레 · 기차역 승강장
  function nearRide(me) {
    if (Math.hypot(me.x - FERRIS.x - 1.5, me.z - FERRIS.z) < 7.5) return 'ferris';
    if (Math.hypot(me.x - CAROUSEL.x, me.z - CAROUSEL.z) < CAROUSEL.plat + 4) return 'carousel';
    if (TRAIN_STATIONS.some((s) => Math.hypot(me.x - s.x - s.nx * 2.8, me.z - s.z - s.nz * 2.8) < 8)) return 'train';
    if (Math.hypot(me.x - DROP.x, me.z - DROP.z) < DROP.R + 4.5) return 'drop';
    if (Math.abs(me.x - VIKING.x) < 7 && Math.abs(me.z - VIKING.z) < 7) return 'viking';
    if (Math.hypot(me.x - SWING.x, me.z - SWING.z) < SWING.hang + 4) return 'swing';
    if (me.x > -441 && me.x < -422 && me.z > 37.5 && me.z < 43) return 'coaster'; // 역 승강장
    if (me.x > -374 && me.x < -347 && me.z > 35 && me.z < 39.7) return 'flume'; // 나루
    { const [x0, z0, x1, z1] = BUMPER.lobby; if (me.x > x0 && me.x < x1 && me.z > z0 + 1.5 && me.z < z1 + 0.5) return 'bumper'; } // 범퍼카 로비 (차 앞 줄)
    if (Math.hypot(me.x - TEACUPS.x, me.z - TEACUPS.z) < TEACUPS.plat + 4) return 'teacups';
    return null;
  }
  const sec = (ms) => `${Math.max(1, Math.ceil(ms / 1000))}초`;
  function ui(me, t) {
    const r = mine();
    if (r) {
      const R = RIDES[r.r], ex = R.exitOk({ seat: r.seat }, t);
      let tip = ex ? '지금 내릴 수 있어요' : r.r === 'train' ? '역에 서면 내릴 수 있어요' : r.r === 'ferris' ? '한 바퀴 돌면 내려요' : r.r === 'carousel' ? '다 돌면 내려요' : '끝나면 내려요', ctl = '';
      if (r.r === 'bumper') { const ph = bumperAt(t).ph; tip = ph === 'run' ? (TOUCH ? '왼쪽 화면을 끌어 운전 · 콩콩 부딪혀요' : 'WASD·방향키로 운전 · 콩콩 부딪혀요') : ph === 'load' ? '곧 출발해요! 친구를 기다려요' : '제자리로 돌아가요'; }
      if (r.r === 'teacups') { const run = teacupsAt(t).run, lv = cupLevel(sims.teacups.cups[Math.floor(r.seat / TEACUPS.per)], t), dis = run ? '' : 'disabled';
        tip = run ? '찻잔 빠르기를 직접!' : '돌기 시작하면 빠르기를 바꿔요';
        ctl = `<span class="lv">${'●'.repeat(lv)}${'○'.repeat(TEACUPS.max - lv)}</span><button data-a="slow" ${dis}>느리게${TOUCH ? '' : '<kbd>↓</kbd>'}</button><button data-a="fast" ${dis}>빠르게${TOUCH ? '' : '<kbd>↑</kbd>'}</button>`; }
      return panel(`ride${r.r}${ex}${tip}${ctl}`, `<b>${R.icon} ${R.name}</b><small>${tip}</small>${ctl}<button data-a="off" ${ex ? '' : 'disabled'}>내리기${TOUCH ? '' : '<kbd>E</kbd>'}</button>`, 'ride');
    }
    near = me.sit < 0 && sitq?.hidden !== false && me.fl === 0 ? nearRide(me) : null;
    if (!near) return panel('');
    const R = RIDES[near], o = R.open(t);
    const sub = o.seats ? { ferris: '친구와 같은 곤돌라에 4명까지', carousel: '말·토끼·곰 중 가까운 자리에', train: '공원을 한 바퀴 돌아요', drop: '40m 꼭대기에서 슝!', viking: '마주 앉아 크게 흔들려요', swing: '꽃 지붕 아래 빙글빙글', coaster: '공원을 가로질러 달려요', flume: '통나무 배 물길 여행 · 마지막엔 풍덩!', bumper: '사탕색 차를 직접 운전해요', teacups: '찻잔 빠르기를 내 손으로' }[near] + ` · ${sec(o.left)} 남음` : `${o.msg} · ${sec(o.wait)}`;
    panel(`near${near}${!!o.seats}${sub}`, `<b>${R.icon} ${R.name}${o.seats ? ' 타기' : ''}</b><small>${sub}</small>${o.seats ? `<button data-a="on">타기${TOUCH ? '' : '<kbd>E</kbd>'}</button>` : ''}`);
  }
  // 탄 사람 아바타를 자리에 (game.js 가 이 값으로 그림: p.ride 가 있으면 땅 높이 대신 p.gy, 앉는 자세)
  function seat(p, r, t) {
    const R = RIDES[r.r], s = R.pose(r.seat, t, sims[r.r]);
    if (p.ride?.id !== r.r || p.ride.seat !== r.seat) p.ride = { id: r.r, seat: r.seat, kind: R.sit, h: SEAT_H };
    p.x = p.tx = s.x; p.z = p.tz = s.z; p.ry = p.tr = s.ry; p.gy = s.y - SEAT_H; p.walking = false; p.jy = p.ty = p.vy = 0;
  }
  function getOff(p, m) { p.ride = null; if (m) Object.assign(p, { x: m.x, z: m.z, tx: m.x, tz: m.z, ry: m.ry, tr: m.ry }); }
  // 범퍼카: 서버 상태 받기 (20Hz). 내 차는 화면이 같은 bumperStep 으로 먼저 움직이고(예측) 서버 값으로 조금씩 당김, 부딪힘엔 불꽃 + '통!'
  function bumperIn(m, me) {
    bumperUnpack(m.c, btg);
    const r = mine(), ms = r?.r === 'bumper' && bumperAt(now()).ph === 'run' ? r.seat : -1, D = sims.bumper.cars;
    if (ms >= 0) {
      const c = D[ms], S = btg[ms], hit = m.b?.some(([i, j]) => i === ms || j === ms), ex = S.x + S.vx * 0.06 - c.x, ez = S.z + S.vz * 0.06 - c.z; // 서버 값은 조금 지난 값 → 빠르기만큼 앞으로 당겨 비교
      if (Math.hypot(ex, ez) > 2.5) Object.assign(c, { x: S.x, z: S.z, a: S.a, vx: S.vx, vz: S.vz });
      else { c.x += ex * 0.3; c.z += ez * 0.3; c.a += angD(S.a - c.a) * 0.3; const k = hit ? 1 : 0.3; c.vx += (S.vx - c.vx) * k; c.vz += (S.vz - c.vz) * k; }
    }
    for (const [i, j] of m.b || []) {
      const a = D[i], b = j >= 0 ? D[j] : a, x = (a.x + b.x) / 2, z = (a.z + b.z) / 2, d = me ? Math.hypot(me.x - x, me.z - z) : 99;
      if (bumper.g.visible) bumper.bump(x, z, j >= 0 ? 1 : 0.4);
      if (d < 45) sfx.play('bonk', (i === ms || j === ms ? 0.7 : 0.45 * (1 - d / 45)) * (j >= 0 ? 1 : 0.6));
    }
  }
  function bumperFrame(t, dt) {
    const D = sims.bumper.cars, [x0, z0, x1, z1] = BUMPER.box, r = mine(), ms = r?.r === 'bumper' && bumperAt(t).ph === 'run' ? r.seat : -1, k = 1 - Math.exp(-dt * 10);
    D.forEach((c, i) => {
      if (i === ms) return;
      const g = btg[i]; g.x = Math.max(x0, Math.min(x1, g.x + g.vx * dt)); g.z = Math.max(z0 - 2, Math.min(z1, g.z + g.vz * dt)); // 다음 값이 올 때까지 빠르기로 이어 감
      c.x += (g.x - c.x) * k; c.z += (g.z - c.z) * k; c.a += angD(g.a - c.a) * k; c.vx = g.vx; c.vz = g.vz;
    });
    if (ms >= 0) { const c = D[ms]; c.u = drv.u; c.s = drv.s; bumperStep(D.map((o, i) => (i === ms ? c : { ...o, u: 0, s: 0 })), dt); } // 내 차만 예측 (다른 차는 복사본 = 바로 튕기는 느낌만, 위치는 서버가 정함)
  }
  // 소리: 회전목마 오르골(도는 동안) · 기차 칙칙폭폭(달리는 동안) · 떠날 때 기적 — 가까울 때만, 아주 작게
  function sound(me, c, tr) {
    const r = mine(), dC = Math.hypot(me.x - CAROUSEL.x, me.z - CAROUSEL.z), dT = Math.hypot(me.x - train.loco.position.x, me.z - train.loco.position.z);
    sfx.bed('musicbox', c.run ? (r?.r === 'carousel' ? 0.55 : Math.max(0, 1 - dC / 45) ** 1.5 * 0.45) : 0, { el: (now() % CAROUSEL.round) - CAROUSEL.load });
    sfx.bed('chug', r?.r === 'train' ? Math.min(1, tr.v / 5) * 0.4 : Math.max(0, 1 - dT / 40) ** 1.5 * Math.min(1, tr.v / 5) * 0.35, { rate: tr.v / 2.2 });
    if (lastSt >= 0 && tr.st.st < 0 && dT < 120) sfx.play('toot', r?.r === 'train' ? 0.5 : 0.35 * (1 - dT / 120));
    lastSt = tr.st.st;
  }
  // 2단계 A 소리 (가까울 때만, 아주 작게): 드롭타워 올라갈 때 딸깍·떨어질 때 슝 · 롤러코스터 체인 오르막 딸깍·첫 내리막 슝 · 후룸 풍덩 · 바이킹 끝에서 끼익
  function sound2(me, b) {
    const r = mine()?.r, near = (x, z, R, on) => (on ? 0.55 : Math.max(0, 1 - Math.hypot(me.x - x, me.z - z) / R) ** 1.5 * 0.45);
    const dG = near(DROP.x, DROP.z, 90, r === 'drop'), d = b.drop;
    if (d.ph === 'fall' && lastDrop === 'hold') sfx.play('whoosh', dG); lastDrop = d.ph;
    const cs = ((b.coaster.s % COASTER_PATH.L) + COASTER_PATH.L) % COASTER_PATH.L, onLift = b.coaster.run && cs > 8 && cs < COASTER.sTop;
    sfx.bed('clack', Math.max(d.ph === 'up' ? dG * 0.7 : 0, onLift ? near(-447, 25, 70, r === 'coaster') : 0), { rate: onLift ? 7 : 4 });
    if (lastC < COASTER.sTop + 3 && cs >= COASTER.sTop + 3 && cs - lastC < 10) sfx.play('whoosh', near(-470, 4, 90, r === 'coaster')); lastC = cs;
    if (b.flume?.splash) sfx.play('splash', near(-326, 50, 70, r === 'flume'));
    const th = Math.abs(b.viking.th), up = th > lastTh; // 끝에 닿아 되돌아올 때 한 번
    if (lastUp && !up && th > 0.5) sfx.play('creak', near(VIKING.x, VIKING.z, 50, r === 'viking'));
    lastTh = th; lastUp = up;
  }
  // 효과음 2단계 (fx.js: 카메라 기준 거리·좌우, 타고 있으면 그 자리에서 또렷하게): 기구마다 움직임과 맞춘 소리
  const P3 = { fw: null, fMove: false, ca: null, cs: null, th: 0, dp: '', st: -1, ta: null };
  function sound3(me, t, dt, b, c, tr) {
    const at = (x, z, range, g = 1) => ({ x, z, range, g });
    const F = ferrisAt(t), fv = P3.fw == null ? 0 : Math.abs(F.w - P3.fw) / Math.max(dt, 1e-3), fm = fv > 0.005; P3.fw = F.w; // 대관람차: 기어 웅웅 · 가끔 철골 삐걱 · 출발할 때 곤돌라 종
    fx.loop('ferris', 'gear', fm ? 0.8 : 0, at(FERRIS.x, FERRIS.z, 75));
    if (fm && Math.random() < dt / 5) fx.play('steelCreak', { ...at(FERRIS.x, FERRIS.z, 60, 0.8), key: 'fcreak', cd: 3 });
    if (fm && !P3.fMove) fx.play('gondolaBell', at(FERRIS.x, FERRIS.z, 55)); P3.fMove = fm;
    const cw = P3.ca == null ? 0 : (c.a - P3.ca) / Math.max(dt, 1e-3); P3.ca = c.a; // 회전목마: 모터 + 말이 오를 때 딸깍 (한 바퀴에 3번 오르내림)
    fx.loop('carousel', 'carousel', c.run ? 0.9 : 0, { ...at(CAROUSEL.x, CAROUSEL.z, 40), arg: { rate: (Math.abs(cw) * 3) / (2 * PI) * 4 } });
    const L = train.loco.position; // 꼬마기차: 역에 설 때 브레이크 '끼익', 떠날 때 종 (기적·칙칙폭폭은 sound())
    if (P3.st < 0 && tr.st.st >= 0) fx.play('brake', { ...at(L.x, L.z, 60), dur: 1.3 });
    if (P3.st >= 0 && tr.st.st < 0) fx.play('stationBell', at(L.x, L.z, 60)); P3.st = tr.st.st;
    const cs = b.coaster.s, v = P3.cs == null ? 0 : Math.abs(cs - P3.cs) / Math.max(dt, 1e-3); P3.cs = cs; // 롤러코스터: 레일 덜컹 (빠를수록 촘촘)
    const onLift = b.coaster.run && (((cs % COASTER_PATH.L) + COASTER_PATH.L) % COASTER_PATH.L) < COASTER.sTop;
    fx.loop('coaster', 'rumble', b.coaster.run && !onLift ? Math.min(1, v / 14) : 0, { ...at(RIDE_SLOTS.coaster.x, RIDE_SLOTS.coaster.z, 90), arg: { rate: Math.max(1, v / 2.5) } });
    const th = b.viking.th, w = Math.abs(th - P3.th) / Math.max(dt, 1e-3); P3.th = th; // 바이킹: 흔들림 빠르기에 맞춘 바람
    fx.loop('viking', 'wind', b.viking.run ? Math.min(1, w / 0.9) * 0.9 : 0, { ...at(VIKING.x, VIKING.z, 50), arg: { f: 300 + 1300 * Math.min(1, w) } });
    const d = b.drop; // 드롭타워: 올라가는 모터 · 꼭대기 '철컥' · 바닥 쿠션 '푸슉'
    fx.loop('drop', 'motor', d.ph === 'up' ? 0.8 : 0, { ...at(DROP.x, DROP.z, 70), arg: { f: 80 + (d.y / DROP.top) * 40 } });
    if (P3.dp === 'up' && d.ph === 'hold') fx.play('clunk', at(DROP.x, DROP.z, 70));
    if (P3.dp === 'fall' && d.ph !== 'fall') fx.play('puff', at(DROP.x, DROP.z, 70)); P3.dp = d.ph;
    const sw = swingAt(t); // 회전그네: 체인 찰랑 + 바람 (도는 빠르기에 맞춤)
    fx.loop('swingWind', 'wind', sw.run ? Math.min(1, sw.w / 0.7) * 0.7 : 0, { ...at(SWING.x, SWING.z, 45), arg: { f: 400 + 800 * Math.min(1, sw.w) } });
    fx.loop('swingChain', 'jingle', sw.run ? 0.9 : 0, { ...at(SWING.x, SWING.z, 35), arg: { rate: 2 + 14 * Math.min(1, sw.w) } });
    fx.loop('flume', 'flow', 0.8, at(RIDE_SLOTS.flume.x, RIDE_SLOTS.flume.z, 50)); // 후룸: 물길 졸졸·폭포 쏴아 (풍덩은 sound2)
    const bp = bumperAt(t).ph === 'run'; // 범퍼카: 모터 윙 + 가끔 천장 전기 '지직' (부딪힘 '통!'은 bumperIn)
    fx.loop('bumper', 'whine', bp ? 0.8 : 0, at(BUMPER.x, BUMPER.zc, 45));
    if (bp && Math.random() < dt / 3) fx.play('spark', { ...at(BUMPER.x + (Math.random() - 0.5) * 30, BUMPER.zc + (Math.random() - 0.5) * 16, 40, 0.7), key: 'spark', cd: 1 });
    const tc = teacupsAt(t), ts = P3.ta == null ? 0 : Math.abs(tc.a - P3.ta) / Math.max(dt, 1e-3); P3.ta = tc.a; // 회전 찻잔: 빠를수록 도는 소리가 높아짐
    fx.loop('teacups', 'spin', tc.run ? Math.min(1, ts / 1.2) * 0.8 : 0, { ...at(TEACUPS.x, TEACUPS.z, 40), arg: { f: 600 + 1200 * Math.min(1, ts / 1.5) } });
  }
  // 따라가는 시점 (회전목마 = 뒤에서, 기차 = 바깥 옆에서). 직접 끌어 둘러보면 2.5초 동안은 그대로 둠
  function follow(me, r, dt, t) {
    if (!['carousel', 'train', 'drop', 'swing', 'coaster', 'flume', 'bumper', 'teacups'].includes(r?.r)) { fy = null; pv = null; slope = 0; return; }
    const R = RIDES[r.r], want = r.r === 'train' ? me.ry + (Math.sin(me.ry) * (me.z - PARK_CENTER.z) - Math.cos(me.ry) * (me.x - PARK_CENTER.x) > 0 ? -PI / 2 : PI / 2) // 기차: 선로 고리 바깥쪽
      : r.r === 'drop' ? me.ry + 1.2 : r.r === 'teacups' ? cupHome(Math.floor(r.seat / TEACUPS.per)) + teacupsAt(t).a : me.ry + PI; // 드롭타워: 바깥 비스듬히 위에서 내려다봄(탑에 안 가림) · 찻잔: 찻잔이 도는 것과 상관없이 회전판 바깥에서 찻주전자 쪽을 봄(멀미 방지) · 나머지: 뒤에서
    let pitch = R.cam.pitch;
    if (r.r === 'coaster' || r.r === 'flume') { // 내리막에선 뒤쪽 레일이 높아 카메라가 레일 아래로 묻힘 → 내려가는 기울기만큼 시점을 올림
      if (pv) { const h = Math.hypot(me.x - pv[0], me.z - pv[2]); if (h > 0.02) slope += (Math.max(0, (pv[1] - me.gy) / h) - slope) * (1 - Math.exp(-dt * 4)); }
      pv = [me.x, me.gy, me.z]; pitch += Math.min(0.75, slope * 1.1);
    }
    if (fy == null) fy = want;
    if (performance.now() - dragAt < 2500) return;
    fy += ((((want - fy + PI) % TAU) + TAU) % TAU - PI) * (1 - Math.exp(-dt * (r.r === 'coaster' || r.r === 'flume' || r.r === 'teacups' ? 1.4 : r.r === 'bumper' ? 3.2 : 2.5))); // 빠른 기구는 더 완만히 따라감 (멀미 방지), 범퍼카는 핸들 따라 조금 빨리
    aim?.(pitch, R.cam.dist, fy);
  }
  // 대관람차 높이 올라가면 안개를 걷어 마을까지 보이게 (내리면 되돌림)
  function fog(h) {
    const f = scene.fog; if (!f) return;
    base ??= { near: f.near, far: f.far };
    const k = Math.max(0, Math.min(1, (h - 6) / 40));
    f.near = base.near + 260 * k; f.far = base.far + 820 * k;
  }

  return {
    handle(m) {
      if (m.t === 'welcome') { // 기구 상태만 읽고 game.js 에 넘김
        if (m.rides) { sync(m.rides.now); riders.clear(); for (const [id, r, s] of m.rides.riders || []) riders.set(id, { r, seat: s }); for (const id in m.rides.sim || {}) if (sims[id]) { RIDES[id].load(sims[id], m.rides.sim[id]); if (id === 'bumper') RIDES.bumper.load({ cars: btg }, m.rides.sim[id]); } }
        return false;
      }
      if (m.t === 'leave') { riders.delete(m.id); return false; }
      if (m.t !== 'ride') return false;
      sync(m.now);
      const me = getMe(), p = players.get(m.id), isMe = me && m.id === me.id;
      if (m.op === 'bc' && m.r === 'bumper') { bumperIn(m, me); return true; }
      if (m.op === 'in' && m.r === 'teacups') { const cup = sims.teacups.cups[m.c]; if (cup) { Object.assign(cup, { a0: m.a0, w: m.w, lvl: m.lvl, t0: m.t0 }); const r = mine(); if (r?.r === 'teacups' && Math.floor(r.seat / TEACUPS.per) === m.c) sfx.play('click', 0.6); } return true; }
      if (m.op === 'on') {
        riders.set(m.id, { r: m.r, seat: m.seat });
        if (isMe) { const R = RIDES[m.r]; aim?.(R.cam.pitch, R.cam.dist, m.r === 'ferris' ? -PI / 2 : m.r === 'viking' ? PI : null); /* 바이킹: 북쪽 옆에서 흔들림을 봄 */ toast(`${R.icon} ${R.name} 출발 준비! ${m.r === 'ferris' ? '친구와 함께 마을을 구경해요' : ''}`); sfx.play('chime', 0.5); }
      } else if (m.op === 'off') {
        riders.delete(m.id);
        if (p) getOff(p, m);
        if (isMe) { aim?.(null); fog(0); if (m.why === 'end') toast('즐거웠어요! 또 타러 와요 🎈'); }
      } else if (m.op === 'no') toast(m.error);
      return true;
    },
    key(e) {
      if (e.code !== 'KeyE' || e.repeat) return false;
      if (mine()) { send({ t: 'ride', op: 'off' }); return true; }
      if (near && !q.hidden) { send({ t: 'ride', op: 'on', id: near }); return true; }
      return false;
    },
    update(dt) {
      const me = getMe(), t = now();
      camera.getWorldPosition(cam);
      const show = Math.hypot(cam.x - PARK_CENTER.x, cam.z - PARK_CENTER.z) < PARK_FAR + 60; // 공원이 보일 때만 (park-site 와 같은 기준 + 대관람차는 조금 더 멀리서도)
      root.visible = show || Math.hypot(cam.x - FERRIS.x, cam.z - FERRIS.z) < 460;
      track.g.visible = carousel.g.visible = train.g.visible = show;
      ferris.update(t);
      const c = show ? carousel.update(t) : carouselAt(t);
      const tr = show ? train.update(t, dt) : { st: trainState(t), v: 0 };
      if (show) { carousel.g.visible = Math.hypot(cam.x - CAROUSEL.x, cam.z - CAROUSEL.z) < 260; train.g.visible = cam.distanceTo(train.loco.position) < 280; }
      const b2 = {}; // 2단계 A: 보일 때만 움직임 계산 (소리용 상태는 늘)
      for (const [o, x, z, far] of B2) o.g.visible = show && Math.hypot(cam.x - x, cam.z - z) < far;
      b2.drop = drop.g.visible ? drop.update(t) : dropAt(t); b2.viking = viking.g.visible ? viking.update(t) : vikingAt(t); if (swing.g.visible) swing.update(t);
      b2.coaster = coaster.g.visible ? coaster.update(t) : coasterAt(t); b2.flume = flume.g.visible ? flume.update(t, dt) : null;
      bumperFrame(t, dt); if (bumper.g.visible) bumper.update(sims.bumper.cars, dt); if (teacups.g.visible) teacups.update(t, sims.teacups);
      for (const [id, r] of riders) { const p = players.get(id); if (p) seat(p, r, t); }
      if (!me) return;
      const r = mine(), [hx0, hz0, hx1, hz1] = BUMPER.hall;
      bumper.outer.visible = !(me.x > hx0 && me.x < hx1 && me.z > hz0 && me.z < hz1); // 경기장 안에선 바깥 껍데기를 숨겨 카메라가 벽에 안 막힘
      fog(r?.r === 'ferris' || r?.r === 'drop' ? me.gy : 0); follow(me, r, dt, t);
      ui(me, t);
      if (show) { sound(me, c, tr); sound2(me, b2); sound3(me, t, dt, b2, c, tr); }
    },
    busy: () => !!mine(),
    // 타는 동안 game.js 의 이동 입력(ix 오른쪽+, iy 앞+: 키보드·조이스틱)을 받음 → 범퍼카 운전 / 찻잔 빠르기 (↑↓). 바뀔 때 + 누르고 있으면 0.5초마다 보냄
    drive(ix, iy) {
      const r = mine(); if (!r) return;
      const tm = performance.now(), q = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 4) / 4;
      if (r.r === 'bumper') {
        drv.u = q(iy); drv.s = q(ix);
        if (((drv.u !== drv.su || drv.s !== drv.ss) && tm - drv.at > 80) || ((drv.u || drv.s) && tm - drv.at > 500)) { send({ t: 'ride', op: 'in', u: drv.u, s: drv.s }); drv.su = drv.u; drv.ss = drv.s; drv.at = tm; }
      } else if (r.r === 'teacups') {
        const d = iy > 0.6 ? 1 : iy < -0.6 ? -1 : 0;
        if (d && (d !== drv.d || tm - drv.at > 450)) { send({ t: 'ride', op: 'in', d }); drv.at = tm; }
        drv.d = d;
      }
    },
  };
}
