// 땅(길·광장이 섞이는 셰이더)·언덕·잔디 뭉치·나무 4종·덤불·바위·꽃·버섯
import * as THREE from 'three';
import { BOUND, BX, BZ, inTown, BUILDINGS, HOUSES, TREES, DECOR_TREES, FLOWERS, LAMPS, BENCHES, BENCHES2, POND, TAG, DODGE, SACRED_YARDS, SACRED_BOXES, GATE_PATH, trailNear, doorPos, sideNormal, CAMP_TOWN_PATH, CAMP_GATE, campDist, PARK_TOWN_PATH, VILLAGE_GATE_W, parkDist } from './world.js';
import { soft, patch, sway, paint, lumpy, Batch, instanced, rng, noise, groundH, NEAR_FADE, U } from './gfx.js';
import { grassTex, dirtTex, cobbleTex, petalsTex, blobTex } from './textures.js';

// 장식용 길 (충돌 없음): [점들, 폭]. 원래 길 + 광장에서 각 장소로 이어지는 오솔길
export const PATHS = [
  [[[-14, -4], [-8.5, -3.4]], 3.4], // 카페 문
  [[[8, -6], [14.6, -6]], 3.8], // 회사 문
  [[[36, 24], [36, 10]], 4.6], [[[6.4, 7.2], [9.5, 9.6], [14, 10.2], [36, 10]], 3.4], // 카지노
  [[[-34, -16.5], [-17, -15.6], [0, -16], [17, -15.6], [30, -16.3]], 2.6], // 집 앞 골목 (동쪽 끝은 교회 뒤에서 멈춤)
  ...HOUSES.map((h) => [[[h.x, h.z + h.d / 2], [h.x, h.x === 0 ? -9 : -16]], 2.4]),
  [[[22, 10.5], [22, 13.6]], 2.2], // 연못가 벤치
  [[[-6.8, 6.9], [-13, 11.5], [-20, 14.3], [-27.5, 16.4]], 2.6], // 술래잡기 패드
  [[[1.5, 9.6], [2.6, 14], [4, 18.8]], 2.6], // 피구 패드
  [[[-12, 12.2], [-12, 16.5]], 2.2],
  [GATE_PATH, 4.2], // 사찰 가는 동쪽 대문 (교회 북쪽)
  [CAMP_TOWN_PATH, 4.0], // 불멍 캠프 가는 남쪽 대문 (공원 벤치 뒤)
  [PARK_TOWN_PATH, 4.2], // 놀이공원 가는 서쪽 대문 (성당 북쪽) — 무늬 지도 끝(-124)보다 안에서 멈춤: 대문 밖 길은 park-site.js
];
const W = BX + 4, MS = 2048, K = MS / (W * 2); // 무늬 지도: 월드 ±124m 를 2048px 로 (넓어진 마을 전체)
const toPx = (x, z) => [(x + W) * K, (z + W) * K];

// 길·광장·물가를 그린 무늬 지도 (R=흙길, G=돌바닥, B=길가 풀)
function makeMask() {
  const c = document.createElement('canvas'); c.width = c.height = MS;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, MS, MS);
  x.globalCompositeOperation = 'lighter'; x.lineCap = x.lineJoin = 'round';
  const line = (pts, w, col, a) => { x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = w * K; x.beginPath(); pts.forEach(([px, pz], i) => x[i ? 'lineTo' : 'moveTo'](...toPx(px, pz))); x.stroke(); };
  const disc = (cx, cz, r, col, a) => { x.fillStyle = col; x.globalAlpha = a; x.beginPath(); x.arc(...toPx(cx, cz), r * K, 0, 7); x.fill(); };
  const ring = (cx, cz, r0, r1, col, a) => { x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = (r1 - r0) * K; x.beginPath(); x.arc(...toPx(cx, cz), ((r0 + r1) / 2) * K, 0, 7); x.stroke(); };
  for (const [pts, w] of PATHS) { line(pts, w + 2.2, '#0000ff', 0.5); line(pts, w + 0.8, '#ff0000', 0.33); line(pts, w, '#ff0000', 0.33); line(pts, w - 0.8, '#ff0000', 0.34); }
  disc(-12, 19.2, 3.6, '#ff0000', 0.5); disc(-12, 19.2, 4.6, '#0000ff', 0.4); // 남서쪽 공원 벤치 마당
  disc(0, 0, 11.4, '#0000ff', 0.6); disc(0, 0, 10.2, '#00ff00', 0.5); disc(0, 0, 9.8, '#00ff00', 0.5);
  ring(POND.x, POND.z, POND.r - 0.4, POND.r + 0.9, '#ff0000', 0.7); ring(POND.x, POND.z, POND.r + 0.6, POND.r + 2, '#0000ff', 0.5);
  for (const g of [TAG, DODGE]) disc(g.pad.x, g.pad.z, g.pad.r + 0.9, '#ff0000', 0.55);
  for (const [x0, z0, x1, z1] of Object.values(SACRED_YARDS)) { x.globalAlpha = 1; x.fillStyle = '#0000ff'; x.fillRect(...toPx(x0 - 0.6, z0 - 0.6), (x1 - x0 + 1.2) * K, (z1 - z0 + 1.2) * K); x.fillStyle = '#00ff00'; x.fillRect(...toPx(x0, z0), (x1 - x0) * K, (z1 - z0) * K); } // 성당·교회 앞마당 돌바닥
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false; tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
  const data = x.getImageData(0, 0, MS, MS).data;
  // 그 자리가 길·광장인지 (풀·꽃·덤불 놓을 때 피함)
  const at = (wx, wz) => { const [px, pz] = toPx(wx, wz); if (px < 0 || pz < 0 || px >= MS || pz >= MS) return [0, 0, 0]; const i = ((pz | 0) * MS + (px | 0)) * 4; return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]; };
  return { tex, at };
}

// 땅: 가까이는 촘촘, 멀리는 성긴 동심원 격자. 울타리 밖은 언덕
function groundGeo() {
  const radii = [0, 8, 16, 24, 32, 38, 43];
  for (let r = 46; r < 100; r += 3) radii.push(r);
  for (let r = 100; r < 170; r += 7) radii.push(r);
  for (let r = 170; r < 500; r += 12) radii.push(r); // 사찰(원점에서 ~400)까지 촘촘하게: 숲길·마당 둘레가 평평하게 보이도록
  radii.push(560, 700, 900);
  const seg = 200, pos = [], idx = [];
  for (const r of radii) for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r; pos.push(x, groundH(x, z), z); }
  for (let j = 0; j < radii.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + seg + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const NOISE_GLSL = `
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`;

function makeGround(scene, mask) {
  const mat = patch(soft('#ffffff'), {
    key: 'ground',
    uniforms: { tMask: { value: mask.tex }, tGrass: { value: grassTex() }, tDirt: { value: dirtTex() }, tCobble: { value: cobbleTex() }, uNight: U.night, uLamps: { value: [...LAMPS.map((l) => new THREE.Vector2(l.x, l.z)), ...Object.values(BUILDINGS).map((b) => new THREE.Vector2(...doorPos(b)).addScaledVector(new THREE.Vector2(...sideNormal(b.door)), 1.6))] } },
    vert: { head: 'varying vec3 vWP;', project_vertex: 'vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;' },
    frag: {
      head: `varying vec3 vWP; uniform sampler2D tMask, tGrass, tDirt, tCobble; uniform float uNight; uniform vec2 uLamps[${LAMPS.length + Object.keys(BUILDINGS).length}];` + NOISE_GLSL,
      color_fragment: `{
        vec2 w = vWP.xz;
        vec4 m = texture2D(tMask, (w + ${W.toFixed(1)}) / ${(W * 2).toFixed(1)});
        float n1 = vn(w * 0.07), n2 = vn(w * 0.6 + 7.0), n3 = vn(w * 0.018 + 3.0);
        vec3 g = texture2D(tGrass, w / 5.5).rgb;
        g *= mix(vec3(0.86, 0.96, 0.9), vec3(1.1, 1.06, 0.86), n1);           // 누렇고 푸른 풀 얼룩
        g = mix(g, vec3(dot(g, vec3(0.3, 0.55, 0.15))), 0.18);                // 형광빛이 안 나게 채도 살짝 낮춤
        g = mix(g, g * vec3(1.12, 1.0, 0.78), smoothstep(0.55, 0.9, n3) * 0.5); // 넓은 들판 색 변화
        g = mix(g, g * vec3(1.1, 1.03, 0.8), smoothstep(0.1, 0.9, m.b) * 0.55);  // 길가는 살짝 바랜 풀
        vec3 col = mix(g, texture2D(tDirt, w / 4.0).rgb, smoothstep(0.38, 0.62, m.r + (n2 - 0.5) * 0.4));
        vec3 cob = mix(texture2D(tCobble, w / 2.3).rgb, vec3(0.86, 0.78, 0.68), 0.3); // 돌은 작게, 대비는 낮게
        float r = length(w);
        cob *= 1.0 - 0.14 * (smoothstep(0.22, 0.0, abs(r - 6.55)) + smoothstep(0.3, 0.0, abs(r - 9.55))); // 광장 둥근 띠 무늬
        col = mix(col, cob, smoothstep(0.42, 0.58, m.g + (n2 - 0.5) * 0.12));
        diffuseColor.rgb *= col;
      }`,
      emissivemap_fragment: `{ // 밤: 가로등·건물 입구 아래 땅에 따뜻한 불빛 웅덩이
        float lp = 0.0;
        for (int i = 0; i < ${LAMPS.length + Object.keys(BUILDINGS).length}; i++) { vec2 q = vWP.xz - uLamps[i]; lp += exp(-dot(q, q) * 0.3); }
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.7, 0.36) * min(lp, 1.0) * 1.1 * smoothstep(0.25, 0.6, uNight);
      }`,
    },
  });
  const m = new THREE.Mesh(groundGeo(), mat);
  m.receiveShadow = true;
  scene.add(m);
}

// ── 나무 ──
const leafCol = (yb, yt) => (x, y, z) => {
  const u = Math.max(0, Math.min(1, (y - yb) / (yt - yb))), n = 0.9 + noise(x * 2.7 + 9, z * 2.7 + y * 2.1) * 0.2;
  return [(0.6 + u * 0.52) * n, (0.7 + u * 0.4) * n, (0.8 + u * 0.12) * n]; // 아래는 푸르스름한 그늘, 위는 햇빛
};
function trunkGeo(R, h, r0, bend, branches, color) {
  const b = new Batch();
  const t = new THREE.CylinderGeometry(r0 * 0.55, r0, h, 9, 6, true).translate(0, h / 2, 0), p = t.attributes.position;
  for (let i = 0; i < p.count; i++) { // 위로 갈수록 휘고, 밑동은 뿌리처럼 퍼짐
    const y = p.getY(i), u = y / h, fl = 1 + 0.9 * Math.pow(Math.max(0, 1 - y / 0.45), 2);
    p.setXYZ(i, p.getX(i) * fl + bend * u * u, y, p.getZ(i) * fl);
  }
  t.computeVertexNormals();
  b.add('t', t);
  for (const [a, y0, len, tilt] of branches) {
    const br = new THREE.CylinderGeometry(r0 * 0.18, r0 * 0.32, len, 6).translate(0, len / 2, 0);
    b.add('t', br, { pos: [bend * (y0 / h) ** 2, y0, 0], rot: [Math.cos(a) * tilt, 0, Math.sin(a) * tilt] });
  }
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + R() * 0.5; b.add('t', new THREE.ConeGeometry(r0 * 0.4, 0.9, 5).translate(0, 0.45, 0), { pos: [Math.sin(a) * r0 * 0.7, -0.05, Math.cos(a) * r0 * 0.7], rot: [Math.cos(a) * 1.25, 0, -Math.sin(a) * 1.25] }); } // 뿌리
  const g = b.geometry('t'), c = new THREE.Color(color);
  return paint(g, (x, y) => { const k = 0.75 + Math.min(1, y / h) * 0.35; return [c.r * k, c.g * k, c.b * k]; });
}
let LITE = false; // 낮음 단계: 면 수와 잔소품을 줄임
function blobs(list, detail = LITE ? [7, 5] : [9, 6], amt = 0.09) {
  const b = new Batch();
  list.forEach(([x, y, z, r, sy = 1], i) => b.add('l', lumpy(new THREE.SphereGeometry(1, ...detail), amt, 1.8, i * 5.3), { pos: [x, y, z], s: [r, r * sy, r] }));
  const g = b.geometry('l'); g.computeBoundingBox();
  return paint(g, leafCol(g.boundingBox.min.y, g.boundingBox.max.y));
}
function makeTrees(scene, mask) {
  const R = rng(5);
  const TYPES = {
    round: {
      trunk: trunkGeo(R, 2.6, 0.3, 0.15, [[0.4, 1.5, 1.1, 0.8], [3.4, 1.7, 1.0, 0.7]], '#a8714f'),
      leaves: blobs([[0, 2.85, 0, 1.45, 0.92], [0.95, 2.45, 0.35, 0.95], [-0.85, 2.55, -0.35, 1.0], [0.15, 3.65, -0.1, 1.0], [-0.35, 2.25, 0.85, 0.85], [0.5, 2.3, -0.9, 0.8]]),
      pal: ['#86d371', '#9bdb6c', '#74c98a', '#aede72'], sway: 0.012,
    },
    poplar: {
      trunk: trunkGeo(R, 2.4, 0.26, -0.1, [[1, 1.6, 0.9, 0.5]], '#9b6a4e'),
      leaves: blobs([[0, 2.35, 0, 1.05], [0.12, 3.2, 0.05, 1.08], [-0.05, 4.1, -0.05, 0.9], [0.05, 4.85, 0, 0.6]].map(([x, y, z, r]) => [x, y, z, r, 1.12])),
      pal: ['#6cc591', '#7fcf80', '#62b9a0'], sway: 0.01,
    },
    pine: {
      trunk: trunkGeo(R, 2.2, 0.28, 0, [], '#91634c'),
      leaves: (() => {
        const b = new Batch();
        [[1.65, 1.95, 1.5], [1.35, 2.75, 1.4], [1.05, 3.5, 1.25], [0.68, 4.2, 1.05]].forEach(([r, y, h], i) => {
          const c = lumpy(new THREE.ConeGeometry(r, h, 14, 2), 0.05, 2.5, i * 3);
          const p = c.attributes.position; // 아래 가장자리를 동글게 말아 넣어 귀여운 실루엣
          for (let k = 0; k < p.count; k++) if (p.getY(k) < -h / 2 + 0.01) p.setY(k, p.getY(k) + 0.18);
          c.computeVertexNormals();
          b.add('l', c, { pos: [0, y, 0] });
        });
        const g = b.geometry('l'); g.computeBoundingBox();
        return paint(g, leafCol(g.boundingBox.min.y, g.boundingBox.max.y));
      })(),
      pal: ['#55b383', '#62bf8a', '#4aa682'], sway: 0.006,
    },
    cherry: {
      trunk: trunkGeo(R, 2.5, 0.28, 0.3, [[0.2, 1.6, 1.3, 0.95], [2.6, 1.8, 1.2, 0.9], [4.4, 1.7, 1.0, 0.85]], '#8e6655'),
      leaves: blobs([[0, 3.0, 0, 1.5, 0.82], [1.35, 2.75, 0.35, 1.05, 0.85], [-1.25, 2.85, -0.3, 1.1, 0.85], [0.3, 3.05, 1.25, 1.0, 0.85], [-0.2, 2.95, -1.3, 1.0, 0.85], [0.1, 3.75, 0.05, 0.95, 0.85]]),
      pal: ['#ffbdd3', '#ffc9de', '#ffaecb', '#fbc4e2'], sway: 0.012,
    },
  };
  const pick = (i, out) => { const v = (i * 0.618034 + 0.13) % 1; return out ? (v < 0.25 ? 'round' : v < 0.45 ? 'poplar' : v < 0.85 ? 'pine' : 'cherry') : (v < 0.4 ? 'round' : v < 0.55 ? 'poplar' : v < 0.8 ? 'pine' : 'cherry'); };
  const lists = { round: [], poplar: [], pine: [], cherry: [] };
  const all = [...TREES.map((t, i) => ({ ...t, ty: t.ty ?? pick(i, false) })), ...DECOR_TREES.map((t, i) => ({ ...t, ty: pick(i + 7, true) }))];
  for (const t of all) {
    const T = TYPES[t.ty];
    lists[t.ty].push({ x: t.x, y: groundH(t.x, t.z) - 0.05, z: t.z, s: t.s, ry: R() * 6.28, c: T.pal[(t.c + Math.floor(R() * 2)) % T.pal.length] });
  }
  const barkMat = soft('#ffffff', { vertexColors: true });
  const near = (t) => Math.max(Math.abs(t.x), Math.abs(t.z)) < BOUND + 3; // 그림자는 예전 마을 안 나무만 (넓어진 땅 나무는 얼룩 그림자 → 그림자 패스 가볍게)
  for (const [k, T] of Object.entries(TYPES)) {
    const leafMat = sway(soft('#ffffff', { vertexColors: true }), T.sway, 1.6, 'leaf', NEAR_FADE);
    for (const inFence of [true, false]) { // 울타리 밖 나무는 그림자 대신 얼룩을 깔아 그림자 패스를 가볍게
      const l = lists[k].filter((t) => near(t) === inFence);
      instanced(scene, T.trunk, barkMat, l.map((t) => ({ ...t, c: undefined })), { cast: inFence });
      instanced(scene, T.leaves, leafMat, l, { cast: inFence });
    }
  }
  // 벚나무 밑에 떨어진 꽃잎
  const inside = lists.cherry.filter((t) => inTown(t.x, t.z, -20));
  const petals = new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2);
  instanced(scene, petals, soft('#ffffff', { map: petalsTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), inside.map((t) => ({ x: t.x, y: t.y + 0.07, z: t.z, s: t.s, ry: t.ry })));
  return { all, cherry: lists.cherry };
}

// 둘레에 무엇이 있는지: 풀·꽃·덤불을 놓아도 되는 빈 땅인지
const RECTS = [
  ...Object.values(BUILDINGS).map((b) => [b.cx - b.w / 2, b.cz - b.d / 2, b.cx + b.w / 2, b.cz + b.d / 2]),
  ...HOUSES.map((h) => [h.x - h.w / 2, h.z - h.d / 2, h.x + h.w / 2, h.z + h.d / 2]),
  ...[TAG, DODGE].map((g) => [g.cx - g.hw - 0.6, g.cz - g.hd - 0.6, g.cx + g.hw + 0.6, g.cz + g.hd + 0.6]),
];
export function makeFree(mask) {
  return (x, z, m = 0.3) => {
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.8 + m) return false;
    if (RECTS.some(([x0, z0, x1, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m)) return false;
    if ([TAG, DODGE].some((g) => Math.hypot(x - g.pad.x, z - g.pad.z) < g.pad.r + 0.8 + m)) return false;
    if (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 0.6 + m)) return false;
    if (LAMPS.some((l) => Math.hypot(l.x - x, l.z - z) < 0.5 + m) || [...BENCHES, ...BENCHES2].some((b) => Math.hypot(b.x - x, b.z - z) < 1.2 + m)) return false;
    if (Object.values(SACRED_BOXES).some(([x0, z0, x1, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m)) return false;
    const [pr, pg] = mask.at(x, z);
    return pr < 0.25 && pg < 0.2;
  };
}

// ── 잔디 뭉치: 바람에 살랑이는 짧은 풀잎 묶음 ──
function makeGrass(scene, free, n) {
  const R = rng(11), pos = [], col = [], idx = [];
  const c0 = new THREE.Color('#93c97c'), c1 = new THREE.Color('#c9e79a');
  for (let b = 0; b < 4; b++) { // 풀잎 4장: 밑 2점, 가운데 2점, 끝 1점
    const a = (b / 4) * Math.PI * 2 + R() * 0.8, r = 0.04 + R() * 0.07, h = 0.16 + R() * 0.2, w = 0.03 + R() * 0.018, lean = 0.05 + R() * 0.12;
    const cx = Math.sin(a) * r, cz = Math.cos(a) * r, tx = Math.cos(a), tz = -Math.sin(a), ox = Math.sin(a) * lean, oz = Math.cos(a) * lean, base = pos.length / 3;
    pos.push(cx - tx * w, 0, cz - tz * w, cx + tx * w, 0, cz + tz * w, cx - tx * w * 0.6 + ox * 0.4, h * 0.55, cz - tz * w * 0.6 + oz * 0.4, cx + tx * w * 0.6 + ox * 0.4, h * 0.55, cz + tz * w * 0.6 + oz * 0.4, cx + ox, h, cz + oz);
    for (const u of [0, 0, 0.55, 0.55, 1]) { const c = c0.clone().lerp(c1, u); col.push(c.r, c.g, c.b); }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); // 법선은 위로: 땅과 같은 밝기
  g.setIndex(idx);
  const list = [];
  for (let i = 0; i < n * 8 && list.length < n; i++) {
    const out = R() < 0.18, x = (R() * 2 - 1) * (out ? BX + 28 : BX - 0.5), z = (R() * 2 - 1) * (out ? BZ + 28 : BZ - 0.5);
    if (out && (inTown(x, z, -1) || trailNear(x, z).d < 4.2 || campDist(x, z) < 4.6 || parkDist(x, z) < 1)) continue;
    if (!out && Math.abs(x) > BOUND + 2 && R() > 0.3) continue; // 넓어진 땅은 예전 마을보다 성기게
    if (noise(x * 0.11 + 4, z * 0.11) < 0.38 && R() > 0.2) continue; // 군데군데 뭉쳐 나게
    if (!out && !free(x, z, 0.15)) continue;
    list.push({ x, y: groundH(x, z) - 0.02, z, s: 0.75 + R() * 0.7, ry: R() * 6.28, c: new THREE.Color().setHSL(0.24 + R() * 0.06, 0.4, 0.55 + R() * 0.15).lerp(new THREE.Color('#ffffff'), 0.6) });
  }
  const mat = sway(soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), 0.6, 0, 'grass'), cells = new Map();
  for (const t of list) { const k = Math.floor(t.x / 40) + ',' + Math.floor(t.z / 40); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(t); }
  for (const l of cells.values()) instanced(scene, g, mat, l); // 칸으로 나눠 화면 밖 풀은 통째로 건너뜀
}

// ── 덤불·바위·꽃·버섯 ──
function makeBushesRocks(scene, free, trees) {
  const R = rng(23);
  const bush = blobs([[0, 0.45, 0, 0.62], [0.5, 0.35, 0.1, 0.48], [-0.45, 0.36, -0.08, 0.5], [0.05, 0.38, 0.42, 0.42]], [7, 5], 0.1);
  const bl = [], add = (x, z, s) => { if (LITE && R() < 0.45) return; if (free(x, z, 0.2) || !inTown(x, z)) bl.push({ x, y: groundH(x, z) - 0.08, z, s, ry: R() * 6.28, c: ['#7fcf72', '#95d66d', '#6ec58d', '#a5dc77'][Math.floor(R() * 4)] }); };
  for (let s = -BX + 2; s <= BX - 2; s += 2.6 + R() * 2) for (const [x, z] of [[s, -BZ + 1.2], [s, BZ - 1.2], ...(Math.abs(s) < BZ - 2 ? [[-BX + 1.2, s], [BX - 1.2, s]] : [])]) if (R() < (Math.abs(x) > BOUND ? 0.22 : 0.42) && !(x > BX - 3 && Math.abs(z - GATE_PATH.at(-1)[1]) < 6) && !(z > BZ - 3 && Math.abs(x - CAMP_GATE.x) < 6) && !(x < -BX + 3 && Math.abs(z - VILLAGE_GATE_W.z) < 6)) add(x + (R() - 0.5) * 0.6, z + (R() - 0.5) * 0.6, 0.8 + R() * 0.6); // 울타리 따라 덤불 (대문 자리는 비움)
  for (const h of HOUSES) for (const sx of [-1, 1]) { add(h.x + sx * (h.w / 2 + 0.55), h.z + h.d / 2 - 0.4, 0.7 + R() * 0.3); add(h.x + sx * (h.w / 2 + 0.6), h.z - h.d / 2 + 0.5, 0.8 + R() * 0.4); }
  for (const b of Object.values(BUILDINGS).filter((b) => !b.fy)) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(b.cx + sx * (b.w / 2 + 0.75), b.cz + sz * (b.d / 2 + 0.75), 0.8 + R() * 0.4);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3; add(POND.x + Math.sin(a) * (POND.r + 1.9), POND.z + Math.cos(a) * (POND.r + 1.9), 0.6 + R() * 0.4); }
  for (const t of trees.all) if (R() < 0.25) { const a = R() * 6.28; add(t.x + Math.sin(a) * 1.4 * t.s, t.z + Math.cos(a) * 1.4 * t.s, 0.6 + R() * 0.3); }
  const bushMat = sway(soft('#ffffff', { vertexColors: true }), 0.02, 0.3, 'bush');
  instanced(scene, bush, bushMat, bl);
  const spots = [...bl.map((b) => ({ x: b.x, y: b.y + 0.12, z: b.z, s: b.s * 2.1 })), ...trees.all.filter((t) => Math.max(Math.abs(t.x), Math.abs(t.z)) >= BOUND + 3).map((t) => ({ x: t.x, y: groundH(t.x, t.z) + 0.06, z: t.z, s: t.s * 3.6 }))];
  instanced(scene, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex(), color: '#3d6b45', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), spots);
  // 덤불 위 작은 꽃송이
  const dots = [], dc = ['#ffd1e1', '#ffffff', '#fff1a8', '#d9c8ff'];
  bl.forEach((b, i) => { if (i % 3) return; const c = dc[i % 4]; for (let k = 0; k < 7; k++) { const a = R() * 6.28, e = 0.35 + R() * 0.9; dots.push({ x: b.x + Math.sin(a) * Math.cos(e) * 0.6 * b.s, y: b.y + (0.45 + Math.sin(e) * 0.55) * b.s, z: b.z + Math.cos(a) * Math.cos(e) * 0.6 * b.s, s: 0.07 + R() * 0.04, c }); } });
  instanced(scene, new THREE.IcosahedronGeometry(1, 0), soft('#ffffff'), dots);

  // 바위: 연못 둘레 + 언덕 + 나무 밑
  const rock = paint(lumpy(new THREE.IcosahedronGeometry(1, 1), 0.2, 1.2, 3), (x, y) => [0.82 + y * 0.18, 0.8 + y * 0.18, 0.84 + y * 0.14]);
  const rl = [], rc = ['#d8d0c8', '#cfc8cf', '#e0d6c6', '#c8c4c0'];
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + R() * 0.15, r = POND.r + 0.05 + R() * 0.3, s = 0.22 + R() * 0.28; rl.push({ x: POND.x + Math.sin(a) * r, y: s * 0.15, z: POND.z + Math.cos(a) * r, sv: [s * 1.3, s * 0.75, s], ry: R() * 6, c: rc[i % 4] }); }
  for (let i = 0; i < (LITE ? 0 : 70); i++) { const x = (R() * 2 - 1) * (BX + 46), z = (R() * 2 - 1) * (BZ + 46); if (inTown(x, z, -3) || trailNear(x, z).d < 7 || campDist(x, z) < 7 || parkDist(x, z) < 7) continue; const s = 0.4 + R() * 1.4; rl.push({ x, y: groundH(x, z) + s * 0.1, z, sv: [s * 1.2, s * 0.8, s], ry: R() * 6, c: rc[i % 4] }); }
  for (const t of trees.all) if (R() < 0.2 && inTown(t.x, t.z)) { const a = R() * 6.28, x = t.x + Math.sin(a) * 1.1, z = t.z + Math.cos(a) * 1.1, s = 0.15 + R() * 0.15; rl.push({ x, y: 0.02, z, sv: [s * 1.3, s * 0.8, s], ry: R() * 6, c: rc[0] }); }
  instanced(scene, rock, soft('#ffffff', { vertexColors: true }), rl, { cast: true });
  return bl;
}

function makeFlowers(scene, free, n) {
  const R = rng(41);
  const petals = new Batch(), center = new THREE.SphereGeometry(0.035, 5, 3).translate(0, 0.3, 0);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; petals.add('p', new THREE.CircleGeometry(0.055, 5).scale(0.75, 1.25, 1).translate(0, 0.06, 0), { pos: [0, 0.3, 0], rot: [-Math.PI / 2 + 0.35, 0, 0] }); petals.parts.get('p').at(-1).rotateY(a); }
  const head = petals.geometry('p'); // 꽃잎 5장이 둥글게
  const stem = new Batch().add('s', new THREE.CylinderGeometry(0.008, 0.013, 0.3, 4).translate(0, 0.15, 0), { color: '#5fae5a' })
    .add('s', new THREE.CircleGeometry(0.05, 6).scale(0.5, 1.2, 1), { pos: [0.03, 0.1, 0], rot: [-0.6, 0, -0.9], color: '#6fbf62' }).geometry('s');
  const PC = ['#ff8fb1', '#ffe066', '#ffffff', '#c9a8ff', '#ffa94d', '#8ec8ff'];
  const list = [];
  const put = (x, z, c) => list.push({ x, y: 0, z, s: 0.85 + R() * 0.55, ry: R() * 6.28, rx: (R() - 0.5) * 0.3, rz: (R() - 0.5) * 0.3, c });
  for (const f of FLOWERS) { const k = 2 + Math.floor(R() * 3); for (let i = 0; i < k && list.length < n; i++) { const x = f.x + (R() - 0.5) * 0.9, z = f.z + (R() - 0.5) * 0.9; if (free(x, z, 0.05)) put(x, z, PC[f.c]); } }
  // 광장 둘레 꽃밭
  for (let i = 0; i < 260 && list.length < n; i++) { const a = R() * 6.28, r = 10.5 + R() * 1.6, x = Math.sin(a) * r, z = Math.cos(a) * r; if (free(x, z, 0.1)) put(x, z, PC[Math.floor(noise(a * 2.2, 3) * 6)]); }
  // 집 앞 화단 (문 양옆 벽을 따라)
  for (const h of HOUSES) for (let x = h.x - h.w / 2 + 0.4; x < h.x + h.w / 2 - 0.3; x += 0.28) if (Math.abs(x - h.x) > 1.1 && list.length < n) put(x + (R() - 0.5) * 0.1, h.z + h.d / 2 + 0.3 + R() * 0.25, PC[(Math.floor(x * 1.3) % 6 + 6) % 6]);
  const tilt = sway(soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), 0.9, 0.1, 'flower');
  instanced(scene, stem, tilt, list.map((f) => ({ ...f, c: undefined })));
  instanced(scene, head, sway(soft('#ffffff', { side: THREE.DoubleSide }), 0.9, 0.1, 'flower'), list);
  instanced(scene, center, sway(soft('#ffd84a'), 0.9, 0.1, 'flower'), list.map((f) => ({ ...f, c: undefined })));
  return list;
}

function makeMushrooms(scene, trees) {
  const R = rng(77), b = new Batch();
  b.add('m', new THREE.CylinderGeometry(0.045, 0.06, 0.16, 7).translate(0, 0.08, 0), { color: '#fff4e2' });
  const cap = new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1);
  paint(cap, (x, y, z) => (noise(x * 40 + 3, z * 40 + y * 30) > 0.72 ? [1, 0.98, 0.95] : [0.95, 0.32, 0.33])); // 빨간 갓에 흰 점
  b.add('m', cap, { pos: [0, 0.14, 0] });
  const geo = b.geometry('m'), list = [];
  for (const t of trees.all) {
    if (R() > 0.35 || !inTown(t.x, t.z)) continue;
    const a = R() * 6.28, k = 1 + Math.floor(R() * 3), c = R() < 0.3 ? '#e8c9a8' : '#ffffff';
    for (let i = 0; i < k; i++) { const r = 0.75 + R() * 0.35, aa = a + (R() - 0.5) * 0.7; list.push({ x: t.x + Math.sin(aa) * r, y: 0, z: t.z + Math.cos(aa) * r, s: 0.7 + R() * 0.7, ry: R() * 6, rz: (R() - 0.5) * 0.3, c }); }
  }
  instanced(scene, geo, soft('#ffffff', { vertexColors: true }), list);
}

export function createNature(scene, Q) {
  LITE = Q.lite;
  const mask = makeMask();
  makeGround(scene, mask);
  const free = makeFree(mask);
  const trees = makeTrees(scene, mask);
  makeGrass(scene, free, Q.grass);
  const bushes = makeBushesRocks(scene, free, trees);
  const flowers = makeFlowers(scene, free, Q.flowers);
  if (!LITE) makeMushrooms(scene, trees);
  return { mask, free, trees, bushes, flowers };
}
