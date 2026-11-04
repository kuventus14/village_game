// 불멍 캠프 그림: 남쪽 대문 · 굽이진 숲길(빽빽한 나무·덤불·꽃·랜턴·이정표) · 공터(흙바닥·둥근 통나무 벤치·장작더미·텐트·랜턴 줄) · 큰 모닥불
// 모닥불 = 통나무 받침 + 숯불 + 여러 겹 불꽃(노이즈 셰이더, 가산) + 불티·연기(점) + 땅에 번지는 빛 + 가까울 때만 깜빡이는 빛 하나.
// 길·벤치·충돌 좌표는 world.js(campdata.js) 가 정함. 켜짐/꺼짐은 서버가 정하고 camp.js 가 update 로 넘김
import * as THREE from 'three';
import { CAMP_PATH, CAMP_GATE, CAMP_BENCHES, CAMP_PROPS, FIRE, CLEAR_R, campNear, campDist, inTown, trailNear, benchSeats } from './world.js';
import { soft, patch, paint, lumpy, Batch, rng, nightGlow, noise, NEAR_FADE, U } from './gfx.js';
import { Kit, bx, cy, hdr, signTex, buildKit } from './buildings.js';
import { treeGeos } from './trail.js';
import { dirtTex } from './textures.js';

const PI = Math.PI, { pts } = CAMP_PATH;
function at(s) { // 길 시작에서 s 만큼: [x, z, 방향x, 방향z]
  let i = 1; while (i < pts.length - 1 && CAMP_PATH.s[i] < s) i++;
  const a = pts[i - 1], b = pts[i], l = CAMP_PATH.s[i] - CAMP_PATH.s[i - 1], t = Math.max(-2, Math.min(3, (s - CAMP_PATH.s[i - 1]) / l));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l];
}
const ring = (r, a) => [FIRE.x + Math.sin(a) * r, FIRE.z + Math.cos(a) * r];

// 빛나는 점 묶음(불티·불꽃놀이 공용): 점마다 위치·색(밝기 포함)·크기(m). 가산이면 색이 곧 빛, 아니면 a = 투명도
const PV = `attribute float size; attribute vec4 rgba; varying vec4 vC; uniform float uScale;
  void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PF = (add) => `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float k = ${add ? 'pow(max(0.0, 1.0 - d), 1.6)' : 'smoothstep(1.0, 0.0, d) * 0.6'};
  gl_FragColor = vec4(vC.rgb * ${add ? 'k' : '1.0'}, ${add ? '1.0' : 'vC.a * k'});
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function glowPoints(n, additive = true) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), rgba = new Float32Array(n * 4), size = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('rgba', new THREE.BufferAttribute(rgba, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, vertexShader: PV, fragmentShader: PF(additive), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  return { pts, pos, rgba, size, mat, dirty() { for (const k of ['position', 'rgba', 'size']) g.attributes[k].needsUpdate = true; } };
}
// 화면 픽셀 크기 비율 (점 크기를 m 로 쓰려고): 화면 높이 / (2·tan(시야/2))
export const pointScale = (camera, renderer) => (renderer.domElement.height / 2) / Math.tan((camera.fov * PI) / 360);

// 불꽃 혀: 카메라 쪽으로 도는 세로 판(원통형 빌보드) 위에 '아래 넓고 위 뾰족 + 노이즈로 휘청이고 끝이 끊기는' 모양을 셰이더로 그림 (가산)
const FV = `uniform float uTime, uSeed, uOn; varying vec2 vUv;
  void main(){ vUv = uv; vec3 p = position; float h = uv.y;
    p.x += (sin(uTime * 2.3 + uSeed) * 0.5 + sin(uTime * 4.1 + uSeed * 1.7) * 0.3) * h * h * 0.45;
    p.y *= (0.15 + 0.85 * uOn) * (1.0 + 0.08 * sin(uTime * 6.3 + uSeed) + 0.05 * sin(uTime * 11.0 + uSeed * 3.0));
    p.x *= 0.4 + 0.6 * uOn;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const FF = `uniform float uTime, uSeed, uOn, uGain; uniform vec3 uCore, uMid, uEdge; varying vec2 vUv;
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  void main(){ float y = vUv.y, x = vUv.x * 2.0 - 1.0, t = uTime * 2.4 + uSeed;
    float n = vn(vec2(x * 2.0 + uSeed, y * 3.2 - t)) * 0.62 + vn(vec2(x * 5.0 - uSeed, y * 7.0 - t * 1.6)) * 0.38;
    x += (n - 0.5) * 0.85 * y;                                   // 위로 갈수록 크게 휘청
    float w = mix(0.92, 0.05, pow(y, 0.75)), d = abs(x) / w;      // 아래 넓고 위 뾰족
    float k = smoothstep(1.0, 0.5, d) * smoothstep(1.0, 0.62, y + (n - 0.5) * 0.55) * smoothstep(0.0, 0.1, y); // 끝은 들쭉날쭉 끊김
    float hot = smoothstep(0.35, 0.95, (1.0 - d) * (1.0 - y));
    vec3 c = mix(uEdge, uMid, smoothstep(0.05, 0.55, k)); c = mix(c, uCore, hot);
    gl_FragColor = vec4(c * k * uGain * uOn, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createCampSite(scene, Q) {
  const R = rng(515), dens = { high: 1, normal: 0.75, low: 0.45 }[Q.level], lite = Q.lite, hw = CAMP_PATH.hw;
  const ok = (x, z, m = 1.6) => !inTown(x, z, -2.5) && campNear(x, z).d >= hw + m && Math.hypot(x - FIRE.x, z - FIRE.z) >= CLEAR_R + m && trailNear(x, z).d > 8;
  // ── 숲: 길 양옆 띠 + 공터 둘레 띠 (64m 칸마다 가까우면 자세히, 멀면 단순하게)
  const occ = new Set(), trees = [], put = (x, z) => {
    const key = Math.round(x / 2.3) + ',' + Math.round(z / 2.3);
    if (occ.has(key) || !ok(x, z)) return; occ.add(key);
    const v = R(), ty = v < 0.5 ? 'pine' : v < 0.75 ? 'round' : v < 0.9 ? 'poplar' : 'cherry';
    trees.push({ x, z, ty, s: 0.9 + R() * 0.6, ry: R() * 6.28, c: Math.floor(R() * 3) });
  };
  for (let s = 0; s < CAMP_PATH.len; s += 2.5 / dens) { const [x, z, tx, tz] = at(s); for (const side of [-1, 1]) for (let o = hw + 1.9 + R() * 0.8; o < hw + (lite ? 11 : 15); o += (3.1 + R() * 1.4) / Math.sqrt(dens)) put(x - tz * side * o + (R() - 0.5) * 1.4, z + tx * side * o + (R() - 0.5) * 1.4); }
  for (let r = CLEAR_R + 1.9; r < CLEAR_R + (lite ? 12 : 17); r += 3.2 / Math.sqrt(dens)) for (let a = 0; a < PI * 2; a += 3.3 / r / Math.sqrt(dens)) { const [x, z] = ring(r + (R() - 0.5) * 1.6, a + (R() - 0.5) * 0.05); put(x, z); }
  // ── 덮개: 덤불·꽃·풀·바위 (길가와 공터 가장자리)
  const leaf = (x, y, z) => { const n = 0.9 + noise(x * 2.7 + 9, z * 2.7 + y * 2.1) * 0.2, u = Math.min(1, y / 1.1); return [(0.6 + u * 0.5) * n, (0.7 + u * 0.4) * n, (0.8 + u * 0.12) * n]; };
  const blob = (s) => lumpy(new THREE.SphereGeometry(1, 7, 5), 0.1, 1.8, s);
  const bush0 = paint(new Batch().add('b', blob(1), { pos: [0, 0.45, 0], s: 0.62 }).add('b', blob(2), { pos: [0.45, 0.35, 0.1], s: 0.48 }).add('b', blob(3), { pos: [-0.42, 0.36, -0.08], s: 0.5 }).geometry('b'), leaf);
  const tint = (g, hex) => { const c = new THREE.Color(hex), o = g.clone(), a = o.attributes.color; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b); return o; };
  const flowerOf = (c) => new Batch().add('f', new THREE.CylinderGeometry(0.012, 0.012, 0.3, 3).translate(0, 0.15, 0), { color: '#5fae5a' }).add('f', new THREE.IcosahedronGeometry(0.07, 0), { pos: [0, 0.31, 0], color: c }).add('f', new THREE.IcosahedronGeometry(0.06, 0), { pos: [0.12, 0.22, 0.05], color: c }).geometry('f');
  const tuft = new Batch(); for (let i = 0; i < 3; i++) tuft.add('g', new THREE.ConeGeometry(0.04, 0.38, 3).translate(0, 0.19, 0), { rot: [Math.cos(i * 2.1) * 0.35, i, Math.sin(i * 2.1) * 0.35], pos: [Math.cos(i * 2.1) * 0.05, 0, Math.sin(i * 2.1) * 0.05], color: ['#93c97c', '#a8d686', '#86bf73'][i] });
  const rock0 = paint(lumpy(new THREE.IcosahedronGeometry(1, lite ? 0 : 1), 0.2, 1.2, 3), (x, y) => [0.82 + y * 0.18, 0.8 + y * 0.18, 0.84 + y * 0.14]);
  const CG = { bush: ['#7fcf72', '#95d66d', '#6ec58d', '#a5dc77'].map((c) => tint(bush0, c)), flower: ['#ff8fb1', '#ffe066', '#ffffff', '#c9a8ff', '#ffa94d'].map(flowerOf), tuft: [tuft.geometry('g')], rock: ['#d8d0c8', '#cfc8cf', '#e0d6c6'].map((c) => tint(rock0, c)) };
  const cover = [], add = (g, v, x, y, z, ry, s) => cover.push({ g, v, x, y, z, ry, s });
  for (let s = 2; s < CAMP_PATH.len - 4; s += 1.2 / dens) {
    const [x, z, tx, tz] = at(s); if (z < CAMP_GATE.z + 1) continue;
    for (const side of [-1, 1]) {
      const pt = (o) => [x - tz * side * o, z + tx * side * o];
      if (R() < 0.35) { const [px, pz] = pt(hw + 0.8 + R() * 1.8); if (ok(px, pz, 0.5)) add('bush', Math.floor(R() * 4), px, -0.06, pz, R() * 6, 0.75 + R() * 0.6); }
      if (R() < 0.8) { const [px, pz] = pt(hw - 0.2 + R() * 1.6); add('flower', Math.floor(noise(s * 0.08, side * 3) * 5), px, 0, pz, R() * 6, 0.8 + R() * 0.6); }
      for (let i = 0; i < (lite ? 1 : 2); i++) { const [px, pz] = pt(hw - 0.9 + R() * 3.5); add('tuft', 0, px, 0, pz, R() * 6, 0.8 + R() * 0.7); }
      if (R() < 0.08) { const [px, pz] = pt(hw + 0.5 + R() * 2), sc = 0.3 + R() * 0.6; add('rock', Math.floor(R() * 3), px, sc * 0.12, pz, R() * 6, [sc * 1.3, sc * 0.8, sc]); }
    }
  }
  for (let a = 0; a < PI * 2; a += 0.05 / dens) { // 공터 가장자리: 덤불·꽃, 안쪽 풀밭엔 꽃·풀 조금
    const [x, z] = ring(CLEAR_R - 0.5 + R() * 2, a); if (campNear(x, z).d < hw + 0.5) continue;
    if (R() < 0.4) add('bush', Math.floor(R() * 4), x, -0.06, z, R() * 6, 0.8 + R() * 0.7); else add('flower', Math.floor(R() * 5), x, 0, z, R() * 6, 0.9);
  }
  for (let i = 0; i < 260 * dens; i++) { const r = 11 + R() * (CLEAR_R - 12), [x, z] = ring(r, R() * PI * 2); if (CAMP_PROPS.tents.some((t) => Math.hypot(t.x - x, t.z - z) < 2.2) || campNear(x, z).d < 2) continue; const fl = R() < 0.3; add(fl ? 'flower' : 'tuft', fl ? Math.floor(R() * 5) : 0, x, 0, z, R() * 6, 0.8 + R() * 0.5); }
  const geos = treeGeos(lite), cells = new Map(), C = 64, cell = (x, z) => { const k = Math.floor(x / C) + ',' + Math.floor(z / C); if (!cells.has(k)) cells.set(k, { t: [], c: [] }); return cells.get(k); };
  for (const t of trees) cell(t.x, t.z).t.push(t);
  for (const c of cover) cell(c.x, c.z).c.push(c);
  const leafMat = patch(soft('#ffffff', { vertexColors: true }), { key: 'forest', frag: NEAR_FADE }), farMat = soft('#ffffff', { vertexColors: true }), coverMat = soft('#ffffff', { vertexColors: true });
  for (const { t, c } of cells.values()) {
    const all = [...t, ...c], cx = all.reduce((a, o) => a + o.x, 0) / all.length, cz = all.reduce((a, o) => a + o.z, 0) / all.length, lod = new THREE.LOD(), near = new THREE.Group();
    lod.position.set(cx, 0, cz); lod.name = 'camp-forest';
    const mesh = (list, geo, mat, cast) => { if (!list.length) return null; const b = new Batch(); for (const o of list) b.add('t', geo(o), { pos: [o.x - cx, o.y ?? -0.05, o.z - cz], rot: [0, o.ry, 0], s: o.s }); const m = new THREE.Mesh(b.geometry('t'), mat); m.castShadow = cast; m.receiveShadow = true; return m; };
    const tn = mesh(t, (o) => geos.near[o.ty][o.c], leafMat, true), cm = mesh(c, (o) => CG[o.g][o.v], coverMat, false), tf = mesh(t, (o) => geos.far[o.ty][o.c], farMat, false);
    if (tn) near.add(tn); if (cm) near.add(cm);
    lod.addLevel(near, 0); lod.addLevel(tf ?? new THREE.Object3D(), lite ? 55 : 80); lod.addLevel(new THREE.Object3D(), lite ? 130 : 170); // 마을 광장에선 안 그림
    scene.add(lod);
  }

  // ── 흙길 띠 + 공터 흙바닥 (가장자리 풀빛으로 번짐)
  const dirt = soft('#ffffff', { map: dirtTex(), vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  { const P = [], uv = [], col = [], idx = [], n = pts.length;
    pts.forEach(([x, z], i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, s = CAMP_PATH.s[i];
      const w = 3.2 + (noise(s * 0.3, 7) - 0.5) * 0.7;
      for (const [o, u] of [[-w - 0.5, 0], [-w, 0.12], [w, 0.88], [w + 0.5, 1]]) { P.push(x + nx * o, 0.03, z + nz * o); uv.push(u * (w * 2 + 1) / 4, s / 4); col.push(...(u === 0 || u === 1 ? [0.85, 0.95, 0.8] : [1, 1, 1])); }
      if (i) for (let k = 0; k < 3; k++) { const p = (i - 1) * 4 + k, q = i * 4 + k; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, dirt); m.receiveShadow = true; scene.add(m);
  }
  { const g = new THREE.CircleGeometry(11.5, 48).rotateX(-PI / 2), p = g.attributes.position, c = new Float32Array(p.count * 3), uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)), e = Math.min(1, Math.max(0, (r - 9) / 2.5)), ash = Math.max(0, 1 - r / 3); c.set([1 - e * 0.12 - ash * 0.45, 1 - e * 0.04 - ash * 0.48, 1 - e * 0.18 - ash * 0.46], i * 3); uv.setXY(i, p.getX(i) / 4, p.getZ(i) / 4); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.Mesh(g, dirt); m.position.set(FIRE.x, 0.035, FIRE.z); m.receiveShadow = true; scene.add(m);
  }

  // ── 대문 · 길가 랜턴 · 이정표 · 공터 소품 (같은 재질끼리 한 덩어리)
  // 대문(kG)·길가(kP)·공터(kC)를 따로 묶어 멀면 통째로 안 그림 (마을 광장 장면은 그대로)
  const kG = new Kit(), kP = new Kit(), kC = new Kit(), signs = [];
  let k = kG;
  const lodKit = (kit, x, z, far) => { const g = new THREE.Group(); buildKit(kit, g, false); g.position.set(-x, 0, -z); const lod = new THREE.LOD(); lod.position.set(x, 0, z); lod.addLevel(g, 0); if (far) lod.addLevel(new THREE.Object3D(), far); lod.name = 'camp-kit'; scene.add(lod); };
  const bark = (c) => new THREE.Color(c).offsetHSL(0, 0, (R() - 0.5) * 0.08).getStyle();
  for (const s of [-1, 1]) k.at(CAMP_GATE.x + s * (CAMP_GATE.hw + 0.35), 0, CAMP_GATE.z).p('stone', bx(0.8, 0.4, 0.8, 0.8), [0, 0.2, 0], '#e6dbd1').p('wood', cy(0.24, 0.28, 4.4, 10), [0, 2.4, 0], '#8a5a3a');
  k.at(CAMP_GATE.x, 4.5, CAMP_GATE.z).p('wood', cy(0.22, 0.22, CAMP_GATE.hw * 2 + 2.2, 10), [0, 0, 0], '#7a4b2e', [0, 0, PI / 2]).p('wood', cy(0.18, 0.18, CAMP_GATE.hw * 2 + 1.2, 10), [0, -0.75, 0], '#7a4b2e', [0, 0, PI / 2]);
  for (const s of [-1, 1]) k.p('wood', bx(0.05, 0.62, 0.05), [s * 1.5, -1.15, 0], '#5a3a26');
  signs.push({ x: CAMP_GATE.x, z: CAMP_GATE.z - 0.12, y: 3.1, ry: PI, tex: signTex('🔥 불멍 캠프 가는 숲길', '#5a2e1a', '#ffcf5e', 640, 150, 64), w: 3.4 }, { x: CAMP_GATE.x, z: CAMP_GATE.z + 0.12, y: 3.1, ry: 0, tex: signTex('🏡 포근마을', '#5a2e1a', '#ffcf5e', 640, 150, 72), w: 3.4 });
  k = kP;
  const lantern = (x, z) => { // 나무 기둥 랜턴: 기둥 + 팔 + 매달린 등(빛)
    k.at(x, 0, z).p('wood', cy(0.07, 0.09, 2.6, 6), [0, 1.3, 0], '#6e4a32').p('wood', bx(0.6, 0.06, 0.06), [0.25, 2.5, 0], '#6e4a32');
    k.p('plain', bx(0.26, 0.05, 0.26), [0.5, 2.28, 0], '#3a3640').p('glow', bx(0.2, 0.3, 0.2), [0.5, 2.1, 0], hdr('#ffd08a', 1.8)).p('plain', cy(0.02, 0.16, 0.1, 4), [0.5, 1.91, 0], '#3a3640', [0, PI / 4, 0]);
  };
  for (let s = 14, i = 0; s < CAMP_PATH.len - 12; s += 30, i++) { const [x, z, tx, tz] = at(s), side = i % 2 ? 1 : -1, o = hw + 1.0; if (z > CAMP_GATE.z + 2) lantern(x - tz * side * o, z + tx * side * o); }
  const post = (s, side, text, bg) => { // 길가 화살표 판 (길을 보고 섬)
    const [x, z, tx, tz] = at(s), o = hw + 0.9, px = x + tz * side * o, pz = z - tx * side * o;
    k.at(px, 0, pz).p('wood', bx(0.16, 2.3, 0.16, 0.6), [0, 1.15, 0], '#a8784e');
    signs.push({ x: px, z: pz, ry: Math.atan2(-tz * side, tx * side) + (side > 0 ? 0 : PI), tex: signTex(text, bg, '#ffffff', 512, 150, 70) });
    return [px, pz];
  };
  post(10, 1, '🔥 불멍 →', '#c2410c');
  post(CAMP_PATH.len - 6, -1, '← 🏡 마을', '#4f8a5b');
  post(66, 1, '🔥 불멍 →', '#c2410c');
  k = kC;
  // 공터: 둥근 통나무 벤치 (통나무 + 위 판자, 앉는 면 0.45m) — 조각마다 짧은 곧은 토막을 원호를 따라 이어 붙임
  for (const b of CAMP_BENCHES) {
    const n = Math.max(3, Math.round((b.half * 2 * b.r) / 0.65)), da = (b.half * 2) / n;
    for (let i = 0; i < n; i++) { const a = b.a - b.half + (i + 0.5) * da, [x, z] = ring(b.r + 0.06, a), len = da * (b.r + 0.06) + 0.04;
      k.at(x, 0, z, a).p('wood', cy(0.2, 0.2, len, 8), [0, 0.24, 0], bark('#8a5a3a'), [0, 0, PI / 2]).p('wood', bx(len, 0.07, 0.42, 0.6), [0, 0.415, 0], bark('#c08a5c')); }
    for (const a of [b.a - b.half * 0.75, b.a + b.half * 0.75]) { const [x, z] = ring(b.r + 0.06, a); k.at(x, 0, z).p('wood', cy(0.16, 0.19, 0.2, 7), [0, 0.1, 0], '#6e4a32'); }
  }
  // 모닥불 돌 테두리 + 통나무 받침(정자 쌓기 4단 + 비스듬히 기댄 통나무 8개)
  const rockG = paint(lumpy(new THREE.IcosahedronGeometry(1, 1), 0.22, 1.4, 5), (x, y) => [0.78 + y * 0.15, 0.76 + y * 0.15, 0.8 + y * 0.12]);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * PI * 2 + R() * 0.1, [x, z] = ring(2.05, a), s = 0.3 + R() * 0.12; k.at(x, 0, z, R() * 6).p('stone', rockG.clone(), [0, s * 0.45, 0], i % 3 ? '#c9c2bb' : '#b8b0aa', [0, 0, 0], [s * 1.2, s * 0.9, s]); }
  k.at(FIRE.x, 0, FIRE.z);
  for (let L = 0; L < 4; L++) for (const s of [-1, 1]) { const o = 1.05 - L * 0.12, y = 0.2 + L * 0.3, len = 2.6 - L * 0.25; if (L % 2) k.p('wood', cy(0.17, 0.17, len, 8), [s * o, y, 0], bark('#6b4630'), [PI / 2, 0, 0]); else k.p('wood', cy(0.17, 0.17, len, 8), [0, y, s * o], bark('#6b4630'), [0, 0, PI / 2]); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + 0.2; k.p('wood', cy(0.12, 0.16, 2.7, 7), [Math.sin(a) * 0.7, 1.15, Math.cos(a) * 0.7], bark('#5e3d2a'), [-Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42]); }
  // 장작더미·누운 통나무·텐트·랜턴 줄 기둥
  for (const w of CAMP_PROPS.woodpiles) { k.at(w.x, 0, w.z, w.ry + PI / 2); for (let r = 0; r < 4; r++) for (let c = 0; c < 5 - r; c++) k.p('wood', cy(0.16, 0.16, 1.1, 8), [(c - (4 - r) / 2) * 0.34, 0.16 + r * 0.29, 0], bark('#9a6a44'), [PI / 2, 0, 0]); k.p('wood', bx(0.08, 1.2, 0.08), [-1.0, 0.6, 0], '#5a3a26').p('wood', bx(0.08, 1.2, 0.08), [1.0, 0.6, 0], '#5a3a26'); }
  for (const l of CAMP_PROPS.logs) k.at(l.x, 0, l.z, l.ry + PI / 2).p('wood', cy(0.3, 0.32, 2.4, 9), [0, 0.3, 0], bark('#8a5a3a'), [0, 0, PI / 2]);
  const TENT = [['#ff9f6e', '#ffd8a8'], ['#5fb3a8', '#c3ece4'], ['#f6c453', '#fff1c1'], ['#9b8ae0', '#ddd5ff']];
  CAMP_PROPS.tents.forEach((t, i) => { k.at(t.x, 0, t.z, t.ry);
    k.p('plain', new THREE.CylinderGeometry(1.25, 1.25, 2.8, 3, 1).rotateX(-PI / 2).translate(0, 0.62, 0), [0, 0, 0], TENT[i][0]);
    k.p('plain', new THREE.CircleGeometry(0.62, 3).rotateZ(PI / 2), [0, 0.62, 1.42], '#3a2f3a').p('plain', bx(2.4, 0.03, 3.1), [0, 0.015, 0], TENT[i][1]);
    for (const s of [-1, 1]) k.p('wood', bx(0.05, 2, 0.05), [0, 1.0, s * 1.5], '#6e4a32'); });
  const poleTop = CAMP_PROPS.poles.map((p) => { k.at(p.x, 0, p.z).p('wood', cy(0.06, 0.08, 3.4, 6), [0, 1.7, 0], '#6e4a32'); return new THREE.Vector3(p.x, 3.3, p.z); });
  const bulbs = [];
  for (let i = 1; i < poleTop.length; i++) { const a = poleTop[i - 1], b = poleTop[i]; let prev = a.clone();
    for (let j = 1; j <= 8; j++) { const t = j / 8, p = a.clone().lerp(b, t); p.y -= Math.sin(t * PI) * 0.7; const mid = prev.clone().add(p).multiplyScalar(0.5), d = p.clone().sub(prev), l = d.length();
      k.at(mid.x, mid.y, mid.z, Math.atan2(d.x, d.z)).p('plain', cy(0.012, 0.012, l, 3), [0, 0, 0], '#3a3640', [PI / 2 - Math.atan2(d.y, Math.hypot(d.x, d.z)), 0, 0]); if (j < 8) bulbs.push(p.clone().setY(p.y - 0.12)); prev = p; } }
  const mid = at(CAMP_PATH.len / 2);
  lodKit(kG, CAMP_GATE.x, CAMP_GATE.z, 0); lodKit(kP, mid[0], mid[1], 95); lodKit(kC, FIRE.x, FIRE.z, 150);
  for (const s of signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w ?? 1.7, 0.5), nightGlow(new THREE.MeshBasicMaterial({ map: s.tex, transparent: true, alphaTest: 0.3 }), 1, 0.55, 0.5));
    m.rotation.y = s.ry; const lod = new THREE.LOD(); lod.position.set(s.x, s.y ?? 1.95, s.z); lod.addLevel(m, 0); lod.addLevel(new THREE.Object3D(), 110); scene.add(lod);
  }
  // 여는 시간 안내판 (대문 안쪽·길 들머리·공터 입구): 글은 camp.js 가 board(text) 로 바꿈
  const bc = document.createElement('canvas'); bc.width = 640; bc.height = 260;
  const boardTex = new THREE.CanvasTexture(bc); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  const boardMat = nightGlow(new THREE.MeshBasicMaterial({ map: boardTex }), 1, 0.6, 0.5), bk = new Kit();
  const [ex, ez] = ring(CLEAR_R - 2.5, Math.atan2(pts.at(-1)[0] - FIRE.x, pts.at(-1)[1] - FIRE.z) + 0.22);
  for (const [x, z, ry] of [[CAMP_GATE.x + 6.2, CAMP_GATE.z - 3.2, PI * 0.88], [...at(4).slice(0, 2).map((v, i) => v + (i ? 0 : -(hw + 1.4))), PI * 0.8], [ex, ez, Math.atan2(pts.at(-1)[0] - ex, pts.at(-1)[1] - ez)]]) {
    bk.at(x, 0, z, ry).p('wood', bx(0.12, 2.2, 0.12), [-0.95, 1.1, 0], '#7a4b2e').p('wood', bx(0.12, 2.2, 0.12), [0.95, 1.1, 0], '#7a4b2e').p('wood', bx(2.25, 0.95, 0.08), [0, 1.62, -0.06], '#7a4b2e').p('wood', bx(2.4, 0.1, 0.32), [0, 2.15, -0.04], '#5a3a26');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.83), boardMat); m.position.set(x, 1.62, z); m.rotation.y = ry; m.translateZ(-0.015); scene.add(m);
  }
  buildKit(bk, scene, false);
  function board(l1, l2, on) {
    const x = bc.getContext('2d'); x.clearRect(0, 0, 640, 260);
    x.fillStyle = on ? '#4a2414' : '#3a3440'; x.beginPath(); x.roundRect(6, 6, 628, 248, 34); x.fill(); x.strokeStyle = on ? '#ffb35c' : '#9a93a8'; x.lineWidth = 6; x.beginPath(); x.roundRect(20, 20, 600, 220, 26); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const fit = (t, px, y, c) => { x.fillStyle = c; do x.font = `bold ${px--}px sans-serif`; while (x.measureText(t).width > 530 && px > 18); x.fillText(t, 320, y); }; // 판에 맞게 글씨 크기를 줄임
    fit(l1, 52, 92, '#ffd98a'); fit(l2, 40, 176, on ? '#ffffff' : '#e6e0f0'); boardTex.needsUpdate = true;
  }

  /* ── 모닥불 ── */
  const T = new THREE.Group(); T.position.set(FIRE.x, 0, FIRE.z); T.name = 'camp-fire'; scene.add(T);
  const coal = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.18, 20), new THREE.MeshBasicMaterial({ color: '#6d6460' })); coal.position.y = 0.09; T.add(coal);
  // 혀들: [폭, 높이, x, z, 세기, 종류(0 큰 불·1 가운데 뜨거운 속불·2 작은 혀)]
  const flames = [], L = [[4.2, 8.0, 0, 0, 0.42, 0], [3.0, 6.6, 0.45, 0.2, 0.4, 0], [3.0, 6.2, -0.5, -0.25, 0.4, 0], [2.0, 4.6, 0, 0, 0.55, 1],
    ...Array.from({ length: lite ? 2 : 6 }, (_, i) => { const a = (i / (lite ? 2 : 6)) * PI * 2 + 0.3; return [1.3 + (i % 3) * 0.3, 3.0 + (i % 3) * 0.9, Math.sin(a) * 0.95, Math.cos(a) * 0.95, 0.38, 2]; })].filter((_, i) => !lite || i !== 2);
  L.forEach(([w, h, ox, oz, gain, ty], i) => {
    const mat = new THREE.ShaderMaterial({ uniforms: { uTime: U.time, uSeed: { value: i * 3.7 + 1 }, uOn: { value: 1 }, uGain: { value: gain },
      uCore: { value: new THREE.Color(ty === 1 ? '#ffe9a0' : '#ffc040').multiplyScalar(ty === 1 ? 1.5 : 1.1) }, uMid: { value: new THREE.Color(ty === 1 ? '#ffa020' : '#ff6a10').multiplyScalar(0.85) }, uEdge: { value: new THREE.Color(ty === 0 ? '#ff2006' : '#ff380a').multiplyScalar(0.5) } },
      vertexShader: FV, fragmentShader: FF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 8).translate(0, h / 2, 0), mat);
    m.position.set(ox, 0.3, oz); m.renderOrder = 2; T.add(m); flames.push(m);
  });
  const glowMat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uI; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0, k = pow(max(0.0, 1.0 - d), 2.0); gl_FragColor = vec4(vec3(1.0, 0.5, 0.18) * k * uI, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-PI / 2), glowMat); glow.position.y = 0.06; glow.renderOrder = 1; T.add(glow);
  const light = new THREE.PointLight('#ff9a4a', 0, 34, 1.6); light.position.set(FIRE.x, 2.6, FIRE.z); scene.add(light); // 늘 보이게 장면에 바로 둠(빛 개수가 바뀌면 모든 재질이 다시 컴파일됨) → 멀면 세기 0
  const NE = Math.round((lite ? 90 : 260) * Math.max(0.5, Q.fx)), NS = lite ? 14 : Math.round(40 * Math.max(0.6, Q.fx));
  const emb = glowPoints(NE), smk = glowPoints(NS, false), bul = glowPoints(bulbs.length);
  for (const o of [emb, smk]) T.add(o.pts); scene.add(bul.pts);
  bulbs.forEach((p, i) => { bul.pos.set([p.x, p.y, p.z], i * 3); bul.size[i] = 0.75; }); bul.dirty();
  const E = Array.from({ length: NE }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, x: 0, y: 0, z: 0 })), S = Array.from({ length: NS }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, s: 1, vx: 0 }));
  let eAcc = 0, sAcc = 0, flick = 1, fT = 0;
  function update(dt, { ign, night, cam, scale }) {
    const d = cam.distanceTo(T.position), show = d < 165, t = U.time.value; // 대문(142m)에선 보이고 광장(180m)에선 안 그림
    T.visible = show; bul.pts.visible = d < 150;
    for (const o of [emb, smk, bul]) o.mat.uniforms.uScale.value = scale;
    const bk = 0.35 + night * 0.65; for (let i = 0; i < bulbs.length; i++) { const tw = 0.85 + Math.sin(t * 2 + i * 1.3) * 0.15; bul.rgba.set([1.6 * bk * tw, 1.0 * bk * tw, 0.45 * bk * tw, 1], i * 4); } bul.dirty();
    if (!show) { light.intensity = 0; return; }
    fT += dt; if (fT > 0.06) { fT = 0; flick = 0.82 + Math.random() * 0.18 + Math.sin(t * 7.3) * 0.05; } // 깜빡임
    const on = ign, day = 1 - night, gainK = 1 + day * 0.5;
    for (const m of flames) { m.visible = on > 0.01; m.material.uniforms.uOn.value = on; m.rotation.y = Math.atan2(cam.x - T.position.x - m.position.x, cam.z - T.position.z - m.position.z); } // 카메라 쪽으로 돎
    flames.forEach((m, i) => (m.material.uniforms.uGain.value = L[i][4] * gainK * (0.85 + flick * 0.15)));
    coal.material.color.set(on > 0.01 ? '#ff5a1a' : '#6d6460').multiplyScalar(on > 0.01 ? 0.5 + on * 2.5 * flick : 1); if (on <= 0.01 && ign > 0) coal.material.color.lerp(new THREE.Color('#7a3a22'), 0.3);
    glow.visible = on > 0.01; glowMat.uniforms.uI.value = on * flick * (0.12 + night * 0.45);
    light.intensity = d < 40 && on > 0.01 ? on * flick * (12 + night * 38) : 0; light.distance = 16 + on * 18;
    // 불티: 받침에서 솟아 흔들리며 오르다 사라짐
    eAcc += dt * NE / 2.4 * on;
    for (const e of E) { if (e.life <= 0 && eAcc >= 1) { eAcc -= 1; const a = Math.random() * PI * 2, r = Math.random() * 1.1; Object.assign(e, { x: Math.sin(a) * r, y: 0.6 + Math.random() * 1.5, z: Math.cos(a) * r, vx: (Math.random() - 0.5) * 0.8, vy: 2.2 + Math.random() * 3.6, vz: (Math.random() - 0.5) * 0.8, max: 1.4 + Math.random() * 2.2 }); e.life = e.max; } }
    E.forEach((e, i) => {
      if (e.life <= 0) { emb.size[i] = 0; return; }
      e.life -= dt; e.vx += Math.sin(t * 2.7 + i) * dt * 1.6; e.vz += Math.cos(t * 2.3 + i * 1.3) * dt * 1.6; e.vy *= 1 - dt * 0.25;
      e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      const u = Math.max(0, e.life / e.max), k = u * (1.4 + night * 1.2) * (i % 5 ? 1 : 1.8);
      emb.pos.set([e.x, e.y, e.z], i * 3); emb.rgba.set([2.4 * k, (0.8 + u * 0.7) * k, 0.25 * k, 1], i * 4); emb.size[i] = (0.07 + (i % 7) * 0.017) * (0.6 + u * 0.6);
    });
    emb.dirty();
    // 연기: 불 위(꺼져 있으면 재 위 가늘게)에서 천천히 오르며 퍼짐
    const smokeRate = on > 0.01 ? (0.9 + day * 0.4) * on : 0.18;
    sAcc += dt * smokeRate * NS / 7;
    for (const s of S) if (s.life <= 0 && sAcc >= 1) { sAcc -= 1; Object.assign(s, { x: (Math.random() - 0.5) * 0.8, y: on > 0.01 ? 4 + on * 2.5 : 0.4, z: (Math.random() - 0.5) * 0.8, s: on > 0.01 ? 1.6 : 0.5, vx: 0.25 + Math.random() * 0.3, max: 6 + Math.random() * 3 }); s.life = s.max; }
    S.forEach((s, i) => {
      if (s.life <= 0) { smk.size[i] = 0; return; }
      s.life -= dt; s.y += dt * (1.1 + (on > 0.01 ? 0.6 : 0)); s.x += s.vx * dt; s.z += Math.sin(t * 0.4 + i) * dt * 0.2; s.s += dt * (on > 0.01 ? 0.9 : 0.35);
      const u = s.life / s.max, a = Math.sin(Math.min(1, (1 - u) * 4) * PI / 2) * u * (on > 0.01 ? 0.1 + day * 0.12 : 0.2);
      const warm = Math.max(0, 1 - (s.y - 3) / 10) * on * night; // 아래쪽 연기는 불빛에 붉게
      smk.pos.set([s.x, s.y, s.z], i * 3); smk.rgba.set([0.3 + warm * 0.45 + day * 0.55, 0.28 + warm * 0.12 + day * 0.55, 0.32 + day * 0.55, a], i * 4); smk.size[i] = s.s;
    });
    smk.dirty();
  }
  return { update, board };
}
