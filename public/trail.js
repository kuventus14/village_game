// 사찰 가는 숲길: 동쪽 대문 → 흙길(디딤돌) → 빽빽한 숲(가까이는 자세히, 멀리는 단순하게) · 시내와 돌다리 · 석등 · 이정표
// 길 모양·폭·다리·시내 위치는 world.js 의 TRAIL·STREAM·GATE 가 정함 (충돌·걷는 영역도 그쪽)
import * as THREE from 'three';
import { GATE, TRAIL, STREAM, TEMPLE_YARD as TY, trailNear, streamDist, inTown } from './world.js';
import { soft, patch, paint, lumpy, Batch, rng, nightGlow, noise, NEAR_FADE } from './gfx.js';
import { Kit, bx, cy, sp, hdr, buildKit, signTex } from './buildings.js';
import { dirtTex } from './textures.js';

const PI = Math.PI, { pts } = TRAIL;
// 대문에서 s 만큼 간 곳: [x, z, 방향x, 방향z]. 걷는 방향의 오른쪽 = (-tz, tx)
function at(s) {
  let i = 1; while (i < pts.length - 1 && TRAIL.s[i] < s) i++;
  const a = pts[i - 1], b = pts[i], l = TRAIL.s[i] - TRAIL.s[i - 1], t = Math.max(-2, Math.min(3, (s - TRAIL.s[i - 1]) / l)), tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, tx, tz];
}
const leafCol = (yb, yt) => (x, y, z) => { const u = Math.max(0, Math.min(1, (y - yb) / (yt - yb))), n = 0.9 + noise(x * 2.7 + 9, z * 2.7 + y * 2.1) * 0.2; return [(0.6 + u * 0.52) * n, (0.7 + u * 0.4) * n, (0.8 + u * 0.12) * n]; };
// 나무 모양: 종류마다 가까이용(near)·멀리용(far). 잎 색 3가지씩
export function treeGeos(lite) { // 불멍 캠프 숲(camp-site.js)도 씀
  const R = rng(9), mk = (parts, trunkC, leafPal) => leafPal.map((lc) => {
    const b = new Batch(), lb = new Batch();
    b.add('t', parts.trunk(), { color: trunkC });
    parts.leaves().forEach(([g, o]) => lb.add('l', g, o));
    const lg = lb.geometry('l'); lg.computeBoundingBox();
    const c = new THREE.Color(lc), f = leafCol(lg.boundingBox.min.y, lg.boundingBox.max.y);
    paint(lg, (x, y, z) => { const k = f(x, y, z); return [k[0] * c.r, k[1] * c.g, k[2] * c.b]; });
    return b.add('t', lg).geometry('t');
  });
  const seg = lite ? 6 : 8;
  const pine = (near) => ({ trunk: () => new THREE.CylinderGeometry(0.13, 0.24, 1.8, near ? 6 : 4).translate(0, 0.9, 0), leaves: () => (near ? [[1.65, 2.0, 1.7], [1.25, 3.0, 1.5], [0.8, 3.95, 1.3]] : [[1.55, 2.6, 3.4]]).map(([r, y, h], i) => [near ? lumpy(new THREE.ConeGeometry(r, h, seg, 1), 0.05, 2.5, i * 3) : new THREE.ConeGeometry(r, h, 6, 1), { pos: [0, y, 0] }]) });
  const round = (near, tall) => ({ trunk: () => new THREE.CylinderGeometry(0.16, 0.26, tall ? 2.6 : 2.2, near ? 6 : 4).translate(0, tall ? 1.3 : 1.1, 0), leaves: () => (near ? (tall ? [[0, 2.5, 0, 1.0], [0.1, 3.4, 0, 1.0], [0, 4.2, 0, 0.75]] : [[0, 2.9, 0, 1.45], [0.95, 2.5, 0.3, 0.95], [-0.85, 2.6, -0.3, 1.0], [0.1, 3.6, 0, 0.95]]) : [[0, tall ? 3.2 : 2.9, 0, tall ? 1.3 : 1.65]]).map(([x, y, z, r], i) => [lumpy(new THREE.IcosahedronGeometry(1, near && i === 0 ? 1 : 0), 0.09, 1.8, i * 5.3 + R()), { pos: [x, y, z], s: tall ? [r, r * 1.15, r] : [r, r * 0.9, r] }]) });
  const out = {};
  for (const near of [true, false]) {
    out[near ? 'near' : 'far'] = {
      pine: mk(pine(near), '#91634c', ['#55b383', '#62bf8a', '#4aa682']),
      round: mk(round(near), '#a8714f', ['#86d371', '#9bdb6c', '#74c98a']),
      poplar: mk(round(near, true), '#9b6a4e', ['#6cc591', '#7fcf80', '#62b9a0']),
      cherry: mk(round(near), '#8e6655', ['#ffbdd3', '#ffc9de', '#fbc4e2']),
    };
  }
  return out;
}

export function createTrail(scene, Q) {
  const R = rng(202), dens = { high: 1, normal: 0.75, low: 0.45 }[Q.level], lite = Q.lite, hw = GATE.hw;
  const ok = (x, z, m = 1.6) => {
    if (inTown(x, z, -2.5)) return false; // 마을 울타리 안은 비움
    const t = trailNear(x, z);
    if (t.d < t.hw + m) return false;
    if (streamDist(x, z) < 3.4) return false;
    return !(Math.abs(x - TY.cx) < TY.w / 2 + 1.8 && Math.abs(z - TY.cz) < TY.d / 2 + 1.8);
  };
  // ── 숲: 길 양옆 띠 + 사찰 마당 둘레. 64m 칸마다 한 덩어리, 카메라에서 멀면 단순한 모양으로 (THREE.LOD 가 알아서 바꿈)
  const occ = new Set(), trees = [], put = (x, z) => {
    const key = Math.round(x / 2.3) + ',' + Math.round(z / 2.3);
    if (occ.has(key) || !ok(x, z)) return; occ.add(key);
    const v = R(), ty = v < 0.42 ? 'pine' : v < 0.7 ? 'round' : v < 0.85 ? 'poplar' : 'cherry';
    trees.push({ x, z, ty, s: 0.85 + R() * 0.55, ry: R() * 6.28, c: Math.floor(R() * 3) });
  };
  for (let s = -4; s < TRAIL.len + 8; s += 2.4 / dens) {
    const [x, z, tx, tz] = at(s);
    for (const side of [-1, 1]) for (let o = hw + 1.9 + R() * 0.8; o < hw + (lite ? 13 : 18); o += (3.0 + R() * 1.4) / Math.sqrt(dens)) put(x - tz * side * o + (R() - 0.5) * 1.4, z + tx * side * o + (R() - 0.5) * 1.4);
  }
  for (let x = TY.cx - TY.w / 2 - 24; x < TY.cx + TY.w / 2 + 24; x += 3.4 / Math.sqrt(dens)) for (let z = TY.cz - TY.d / 2 - 24; z < TY.cz + TY.d / 2 + 16; z += 3.4 / Math.sqrt(dens)) { const ex = Math.max(0, Math.abs(x - TY.cx) - TY.w / 2), ez = Math.max(0, Math.abs(z - TY.cz) - TY.d / 2); if (Math.max(ex, ez) < 24) put(x + (R() - 0.5) * 1.6, z + (R() - 0.5) * 1.6); } // 마당 둘레 숲 띠
  // ── 길가: 덤불·꽃·풀·바위·디딤돌 (나무와 같은 칸에 합쳐 그림)
  const tint = (g, hex) => { const c = new THREE.Color(hex), out = g.clone(), a = out.attributes.color; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b); return out; };
  const white = (g) => paint(g, () => [1, 1, 1]);
  const bush0 = paint(new Batch().add('b', lumpy(new THREE.SphereGeometry(1, 7, 5), 0.1, 1.8, 1), { pos: [0, 0.45, 0], s: 0.62 }).add('b', lumpy(new THREE.SphereGeometry(1, 7, 5), 0.1, 1.8, 2), { pos: [0.45, 0.35, 0.1], s: 0.48 }).add('b', lumpy(new THREE.SphereGeometry(1, 7, 5), 0.1, 1.8, 3), { pos: [-0.42, 0.36, -0.08], s: 0.5 }).geometry('b'), leafCol(0, 1.1));
  const rock0 = paint(lumpy(new THREE.IcosahedronGeometry(1, lite ? 0 : 1), 0.2, 1.2, 3), (x, y) => [0.82 + y * 0.18, 0.8 + y * 0.18, 0.84 + y * 0.14]);
  const flowerOf = (c) => new Batch().add('f', new THREE.CylinderGeometry(0.012, 0.012, 0.3, 3).translate(0, 0.15, 0), { color: '#5fae5a' }).add('f', new THREE.IcosahedronGeometry(0.07, 0), { pos: [0, 0.31, 0], color: c }).add('f', new THREE.IcosahedronGeometry(0.06, 0), { pos: [0.12, 0.22, 0.05], color: c }).geometry('f');
  const tuft = new Batch(); for (let i = 0; i < 3; i++) tuft.add('g', new THREE.ConeGeometry(0.04, 0.38, 3).translate(0, 0.19, 0), { rot: [Math.cos(i * 2.1) * 0.35, i, Math.sin(i * 2.1) * 0.35], pos: [Math.cos(i * 2.1) * 0.05, 0, Math.sin(i * 2.1) * 0.05], color: ['#93c97c', '#a8d686', '#86bf73'][i] });
  const CG = { bush: ['#7fcf72', '#95d66d', '#6ec58d', '#a5dc77'].map((c) => tint(bush0, c)), flower: ['#ff8fb1', '#ffe066', '#ffffff', '#c9a8ff', '#ffa94d'].map(flowerOf), tuft: [tuft.geometry('g')],
    rock: ['#d8d0c8', '#cfc8cf', '#e0d6c6'].map((c) => tint(rock0, c)), stone: ['#eadbd3', '#e2d5d8', '#efe3d6'].map((c) => tint(white(new THREE.IcosahedronGeometry(1, 0)), c)) };
  const cover = [], add = (g, v, x, y, z, ry, s) => cover.push({ g, v, x, y, z, ry, s });
  for (let s = 0; s < TRAIL.len + 2; s += 1.1 / dens) {
    const [x, z, tx, tz] = at(s), w = trailNear(x, z).hw;
    for (const side of [-1, 1]) {
      const pt = (o) => [x - tz * side * o, z + tx * side * o];
      if (R() < 0.35) { const [px, pz] = pt(w + 0.8 + R() * 1.8); if (ok(px, pz, 0.5)) add('bush', Math.floor(R() * 4), px, -0.06, pz, R() * 6, 0.75 + R() * 0.6); }
      if (R() < 0.8) { const [px, pz] = pt(w - 0.1 + R() * 1.6); if (ok(px, pz, -0.2)) add('flower', Math.floor(noise(s * 0.08, side * 3) * 5), px, 0, pz, R() * 6, 0.8 + R() * 0.6); }
      for (let i = 0; i < (lite ? 1 : 2); i++) { const [px, pz] = pt(w - 0.9 + R() * 3.5); if (ok(px, pz, -1.2)) add('tuft', 0, px, 0, pz, R() * 6, 0.8 + R() * 0.7); }
      if (R() < 0.07) { const [px, pz] = pt(w + 0.5 + R() * 2), sc = 0.3 + R() * 0.6; add('rock', Math.floor(R() * 3), px, sc * 0.12, pz, R() * 6, [sc * 1.3, sc * 0.8, sc]); }
    }
  }
  for (let i = 0; i < STREAM.length; i++) for (const side of [-1, 1]) { // 시냇가 바위
    const a = STREAM[Math.max(0, i - 1)], b = STREAM[Math.min(STREAM.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    for (let k = 0; k < 2; k++) { const o = 1.9 + R() * 0.6, px = STREAM[i][0] + nx * side * o + (R() - 0.5) * 2, pz = STREAM[i][1] + nz * side * o + (R() - 0.5) * 2, sc = 0.25 + R() * 0.45; if (trailNear(px, pz).d > 3) add('rock', 1, px, sc * 0.15, pz, R() * 6, [sc * 1.3, sc * 0.75, sc]); }
  }
  for (let s = 2; s < TRAIL.len; s += 1.25) { if (Math.abs(s - TRAIL.bridge.s) < 4.5) continue; const [x, z, tx, tz] = at(s), o = (s / 1.25) % 2 < 1 ? 0.55 : -0.55; add('stone', Math.floor(R() * 3), x - tz * o, 0.035, z + tx * o, Math.atan2(tx, tz) + (R() - 0.5) * 0.6, [0.42 + R() * 0.12, 0.05, 0.34 + R() * 0.1]); }
  // ── 64m 칸마다: 가까우면 자세한 나무(그림자) + 길가 덮개, 멀면 단순한 나무만 (THREE.LOD 가 카메라 거리로 알아서 바꿈)
  const geos = treeGeos(lite), cells = new Map(), C = 64, cell = (x, z) => { const k = Math.floor(x / C) + ',' + Math.floor(z / C); if (!cells.has(k)) cells.set(k, { t: [], c: [] }); return cells.get(k); };
  for (const t of trees) cell(t.x, t.z).t.push(t);
  for (const c of cover) cell(c.x, c.z).c.push(c);
  const leafMat = patch(soft('#ffffff', { vertexColors: true }), { key: 'forest', frag: NEAR_FADE }), farMat = soft('#ffffff', { vertexColors: true }), coverMat = soft('#ffffff', { vertexColors: true });
  for (const { t, c } of cells.values()) {
    const all = [...t, ...c], cx = all.reduce((a, o) => a + o.x, 0) / all.length, cz = all.reduce((a, o) => a + o.z, 0) / all.length, lod = new THREE.LOD(), near = new THREE.Group();
    lod.position.set(cx, 0, cz); lod.name = 'forest';
    const mesh = (list, geo, mat, cast) => { if (!list.length) return null; const b = new Batch(); for (const o of list) b.add('t', geo(o), { pos: [o.x - cx, o.y ?? -0.05, o.z - cz], rot: [0, o.ry, 0], s: o.s }); const m = new THREE.Mesh(b.geometry('t'), mat); m.castShadow = cast; m.receiveShadow = true; return m; };
    const tn = mesh(t, (o) => geos.near[o.ty][o.c], leafMat, true), cm = mesh(c, (o) => CG[o.g][o.v], coverMat, false), tf = mesh(t, (o) => geos.far[o.ty][o.c], farMat, false);
    if (tn) near.add(tn); if (cm) near.add(cm);
    lod.addLevel(near, 0); lod.addLevel(tf ?? new THREE.Object3D(), lite ? 55 : 80); lod.addLevel(new THREE.Object3D(), lite ? 170 : 230); // 아주 멀면 안 그림 (안개·언덕·교회에 가림)
    scene.add(lod);
  }

  // ── 흙길 띠 (가장자리 들쭉날쭉) + 디딤돌
  { const pos = [], uv = [], col = [], idx = [], n = pts.length, ext = [...pts, [pts[n - 1][0], pts[n - 1][1] - 2]];
    ext.forEach(([x, z], i) => {
      const a = ext[Math.max(0, i - 1)], b = ext[Math.min(ext.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, s = TRAIL.s[Math.min(i, n - 1)] + (i >= n ? 2 : 0);
      const w = Math.min(3.3, (TRAIL.hw[Math.min(i, n - 1)] - 0.6)) + (noise(s * 0.3, 1) - 0.5) * 0.7;
      for (const [o, u] of [[-w - 0.5, 0], [-w, 0.12], [w, 0.88], [w + 0.5, 1]]) { pos.push(x + nx * o, 0.03, z + nz * o); uv.push(u * (w * 2 + 1) / 4, s / 4); const e = u === 0 || u === 1; col.push(...(e ? [0.85, 0.95, 0.8] : [1, 1, 1])); }
      if (i) for (let k = 0; k < 3; k++) { const p = (i - 1) * 4 + k, q = i * 4 + k; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, soft('#ffffff', { map: dirtTex(), vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })); m.receiveShadow = true; scene.add(m);
  }
  // ── 시내: 흐르는 물결 띠
  { const pos = [], uv = [], idx = [];
    STREAM.forEach(([x, z], i) => {
      const a = STREAM[Math.max(0, i - 1)], b = STREAM[Math.min(STREAM.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, w = 1.7 + noise(i * 0.4, 5) * 0.6;
      for (const [o, u] of [[-w, 0], [w, 1]]) { pos.push(x + nx * o, 0.05, z + nz * o); uv.push(u, i * 0.6); }
      if (i) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx);
    const mat = patch(soft('#7fcbe0', { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), {
      key: 'stream', vert: { head: 'varying vec2 vSt;', begin_vertex: 'vSt = uv;' },
      frag: { head: 'varying vec2 vSt;', color_fragment: 'float e = smoothstep(0.0, 0.18, vSt.x) * smoothstep(1.0, 0.82, vSt.x); float rp = sin(vSt.y * 6.0 - uTime * 2.4 + sin(vSt.x * 9.0) * 1.2) * 0.5 + 0.5; diffuseColor.rgb = mix(vec3(0.86, 0.95, 0.96), mix(vec3(0.33, 0.68, 0.84), vec3(0.6, 0.86, 0.93), rp * 0.6), e);' },
    });
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
  }
  // ── 돌다리 + 석등 + 이정표 + 마을 대문
  const k = new Kit(), B = TRAIL.bridge;
  k.at(B.x, 0, B.z, B.ry);
  k.p('stone', bx(5.2, 0.32, 7.2, 1), [0, 0.06, 0], '#e2d6cc');
  for (const s of [-1, 1]) {
    k.p('stone', bx(0.32, 0.5, 7.4, 1), [s * 2.6, 0.45, 0], '#ebe1d6').p('stone', bx(0.4, 0.08, 7.5), [s * 2.6, 0.72, 0], '#f3ebe2');
    for (const z of [-3.6, 0, 3.6]) k.p('stone', bx(0.42, 0.9, 0.42, 1), [s * 2.6, 0.45, z], '#ebe1d6').p('stone', sp(0.2, 8, 6), [s * 2.6, 1.0, z], '#f3ebe2');
    k.p('stone', bx(5.0, 0.7, 0.8, 1), [0, -0.2, s * 3.2], '#cfc5bb');
  }
  const lantern = (x, z) => { // 석등: 팔각 받침·기둥·연꽃 받침·불집(빛)·지붕돌·보주
    k.at(x, 0, z).p('stone', cy(0.42, 0.48, 0.25, 8), [0, 0.12, 0], '#d6ccc2').p('stone', cy(0.14, 0.17, 0.9, 8), [0, 0.7, 0], '#e2d9cf').p('stone', cy(0.36, 0.2, 0.18, 8), [0, 1.22, 0], '#d6ccc2');
    k.p('stone', cy(0.26, 0.26, 0.5, 8), [0, 1.56, 0], '#e2d9cf').p('glow', cy(0.27, 0.27, 0.26, 8), [0, 1.58, 0], hdr('#ffd88a', 1.6));
    k.p('stone', cy(0.12, 0.55, 0.26, 8), [0, 1.94, 0], '#cfc6bd').p('stone', sp(0.1, 8, 6), [0, 2.14, 0], '#cfc6bd');
  };
  for (let s = 18, i = 0; s < TRAIL.len - 6; s += 42, i++) { const [x, z, tx, tz] = at(s), side = i % 2 ? 1 : -1, o = trailNear(x, z).hw + 1.0; lantern(x - tz * side * o, z + tx * side * o); }
  { const [x, z] = at(TRAIL.len - 2); for (const side of [-1, 1]) lantern(x + side * 6.4, z + 1); }
  const signs = [];
  const sign = (s, text, bg) => { // 길 왼쪽에 세운 화살표 판 (길을 보고 섬, 판의 오른쪽 = 사찰 쪽)
    const [x, z, tx, tz] = at(s), o = trailNear(x, z).hw + 0.9, px = x + tz * o, pz = z - tx * o, ry = Math.atan2(-tz, tx);
    k.at(px, 0, pz).p('wood', bx(0.16, 2.3, 0.16, 0.6), [0, 1.15, 0], '#a8784e');
    signs.push({ x: px, z: pz, ry, tex: signTex(text, bg, '#ffffff', 512, 150, 74) });
  };
  sign(5, '🛕 사찰 →', '#b8392b');
  sign(TRAIL.len - 9, '← 🏡 마을', '#4f8a5b');
  sign(B.s - 7, '🛕 사찰 →', '#b8392b');
  // 마을 대문: 나무 기둥 둘 + 가로 들보 + 작은 기와지붕 + 현판 (마을 쪽·숲 쪽 양면)
  for (const s of [-1, 1]) k.at(GATE.x + 0.1, 0, GATE.z + s * (GATE.hw + 0.35)).p('stone', bx(0.7, 0.4, 0.7, 0.8), [0, 0.2, 0], '#e6dbd1').p('wood', cy(0.22, 0.25, 4.1, 10), [0, 2.25, 0], '#b8392b');
  k.at(GATE.x + 0.1, 4.2, GATE.z).p('wood', bx(0.5, 0.45, GATE.hw * 2 + 2.2, 0.6), [0, 0, 0], '#8a4a2a').p('plain', bx(1.5, 0.2, GATE.hw * 2 + 3.2), [0, 0.42, 0], '#5a5068');
  for (const s of [-1, 1]) k.p('plain', bx(1.1, 0.2, GATE.hw * 2 + 2.8), [s * 0.38, 0.62, 0], '#6a6079', [0, 0, -s * 0.45]);
  signs.push({ x: GATE.x - 0.18, z: GATE.z, y: 3.45, ry: -PI / 2, tex: signTex('🛕 사찰 가는 숲길', '#5a2e2a', '#ffd25e', 640, 150, 66), w: 3.4 }, { x: GATE.x + 0.38, z: GATE.z, y: 3.45, ry: PI / 2, tex: signTex('🏡 포근마을', '#5a2e2a', '#ffd25e', 640, 150, 72), w: 3.4 });
  buildKit(k, scene, false);
  for (const s of signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w ?? 1.7, 0.5), nightGlow(new THREE.MeshBasicMaterial({ map: s.tex, transparent: true, alphaTest: 0.3 }), 1, 0.5, 0.5));
    m.rotation.y = s.ry;
    const lod = new THREE.LOD(); lod.position.set(s.x, s.y ?? 1.95, s.z); lod.addLevel(m, 0); lod.addLevel(new THREE.Object3D(), 110); scene.add(lod); // 멀면 안 그림
  }
}
