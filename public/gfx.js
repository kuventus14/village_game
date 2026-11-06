// 바깥 풍경 공용 도우미: 시간 유니폼, 부드러운 재질, 셰이더 덧대기, 지오메트리 합치기, 난수·노이즈, 땅 높이
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { trailNear, streamDist, TEMPLE_YARD, BX, BZ, campDist, parkDist, lakeDepth } from './world.js';

// 셰이더들이 같이 쓰는 값: 시간, 밤 정도(0~1), 물에 비치는 하늘색, 해(밤엔 달) 빛 방향 — atmosphere 가 매 프레임 채움
export const U = { time: { value: 0 }, night: { value: 0 }, flash: { value: new THREE.Color(0, 0, 0) }, // flash: 불꽃놀이 번쩍임 색(호수가 그 색으로 반짝)
  sky: { value: new THREE.Color('#eaf6fb') }, light: { value: new THREE.Vector3(0.62, 0.58, 0.5).normalize() } };

// 밤에 세기가 바뀌는 재질 목록: 낮 세기 day → 밤 세기 night (밤 정도가 on 근처를 지날 때 바뀜). 발광 재질은 emissiveIntensity, 나머지는 색에 곱함
export const GLOWS = [];
export function nightGlow(mat, day, night, on = 0.3) {
  GLOWS.push({ mat, day, night, on, base: mat.emissive?.getHex() ? null : mat.color.clone() });
  return mat;
}

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, z) => noise(x, z) * 0.55 + noise(x * 2.03 + 17, z * 2.03 + 9) * 0.3 + noise(x * 4.1 + 3, z * 4.1 + 41) * 0.15;
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 땅 높이: 울타리 안은 평평, 밖은 완만한 언덕 → 멀리 갈수록 큰 구릉. 숲길·사찰 마당·시내 둘레는 평평한 골짜기
export function groundH(x, z) {
  const d = Math.max(Math.abs(x) - (BX - BZ), Math.abs(z)), r = Math.hypot(x, z); // 울타리(x ±BX, z ±BZ) 에서 잰 거리 + 44
  if (d < BZ + 3) return 0;
  const Y = TEMPLE_YARD, yd = Math.hypot(Math.max(0, Math.abs(x - Y.cx) - Y.w / 2), Math.max(0, Math.abs(z - Y.cz) - Y.d / 2));
  const flat = Math.min(smooth(25, 60, trailNear(x, z).d), smooth(25, 60, yd), smooth(14, 32, streamDist(x, z)), smooth(25, 60, campDist(x, z)), smooth(25, 60, parkDist(x, z))); // 불멍 캠프 길·공터, 놀이공원 길·부지도 평평
  const ld = x < -BX ? lakeDepth(x, z) : 0; // 놀이공원 가는 길 호수 바닥 (땅을 파냄)
  if (flat <= 0) return -ld;
  return flat * (smooth(BZ + 3, BZ + 36, d) * (0.8 + fbm(x * 0.03, z * 0.03) * 5) + smooth(90, 260, Math.min(r, d + 46)) * fbm(x * 0.008 + 3, z * 0.008) * 34) - ld;
}

// 부드러운 만화 조명: 그림자 쪽도 너무 어둡지 않게 감싸는 4단 램프(선형 보간)
const ramp = new THREE.DataTexture(new Uint8Array([92, 150, 218, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.LinearFilter;
ramp.needsUpdate = true;
export const soft = (color = '#ffffff', o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...o });

// 내장 재질 셰이더에 코드 덧대기. 키 'head' = 맨 위, '!chunk' = 그 조각을 통째로 바꿈, 그 외 = 조각 뒤에 붙임
export function patch(mat, { uniforms = {}, vert = {}, frag = {}, key }) {
  const apply = (src, parts) => {
    for (const [k, code] of Object.entries(parts)) {
      if (k === 'head') src = code + '\n' + src;
      else if (k[0] === '!') src = src.replace(`#include <${k.slice(1)}>`, code);
      else src = src.replace(`#include <${k}>`, `#include <${k}>\n${code}`);
    }
    return src;
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.time }, uniforms);
    sh.vertexShader = apply('uniform float uTime;\n' + sh.vertexShader, vert);
    sh.fragmentShader = apply('uniform float uTime;\n' + sh.fragmentShader, frag);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// 바람에 살랑: 높이(y)가 base 보다 높은 정점일수록 많이 흔들림. 인스턴스마다 위상이 다름
export const sway = (mat, amp, base = 0, key = 'sway', frag = {}) => patch(mat, {
  key: key + amp + base,
  frag,
  vert: {
    begin_vertex: `{
      float hh = max(position.y - ${base.toFixed(2)}, 0.0);
      vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      float ph = ip.x * 0.37 + ip.z * 0.23;
      transformed.x += (sin(uTime * 1.7 + ph) * 0.7 + sin(uTime * 3.1 + ph * 2.0) * 0.3) * ${amp.toFixed(3)} * hh * hh;
      transformed.z += cos(uTime * 1.3 + ph * 1.3) * ${(amp * 0.6).toFixed(3)} * hh * hh;
    }`,
  },
});

// 카메라가 잎 속에 들어가면 가까운 잎을 점점이 비워 시야를 열어 줌 (1m 안은 다 비우고 2.2m 까지 옅어짐)
export const NEAR_FADE = { clipping_planes_fragment: `{ float cd = length(vViewPosition); if (cd < 2.2 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > (cd - 1.0) / 1.2) discard; }` };

// 정점 색 칠하기: fn(x,y,z) → [r,g,b] (1 이 원래 색)
export function paint(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.set(fn(p.getX(i), p.getY(i), p.getZ(i), i), i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
// 점들을 노이즈로 살짝 울퉁불퉁하게 (구름·잎·바위)
export function lumpy(geo, amt, f = 1.6, seed = 0) {
  const p = geo.attributes.position, v = new THREE.Vector3(), seen = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`; // 이음매 정점은 같은 양만큼 움직여 틈이 안 생기게
    if (!seen.has(k)) seen.set(k, 1 + (noise(v.x * f + seed, v.z * f + v.y * 1.7) - 0.5) * 2 * amt);
    v.multiplyScalar(seen.get(k)); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// 같은 재질끼리 한 덩어리로 합쳐 그리기 호출을 줄임. 색은 정점 색(color)으로 실어 보냄
const o3 = new THREE.Object3D();
export function place(geo, { pos = [0, 0, 0], rot = [0, 0, 0], s = 1 } = {}) {
  o3.position.set(...pos); o3.rotation.set(...rot); typeof s === 'number' ? o3.scale.setScalar(s) : o3.scale.set(...s);
  o3.updateMatrix();
  return geo.applyMatrix4(o3.matrix);
}
export class Batch {
  constructor() { this.parts = new Map(); }
  add(key, geo, o = {}) {
    let g = geo.index ? geo.clone() : geo.clone().setIndex([...Array(geo.attributes.position.count).keys()]);
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color || o.color) { const c = new THREE.Color(o.color ?? '#ffffff'); paint(g, () => [c.r, c.g, c.b]); }
    g.clearGroups();
    place(g, o);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return this;
  }
  // 메시 없이 합친 지오메트리만 (인스턴싱용 원본 모양 만들 때)
  geometry(key) {
    const list = this.parts.get(key), g = mergeGeometries(list);
    list.forEach((x) => x.dispose()); this.parts.delete(key);
    return g;
  }
  // mats: 키 → 재질. 반환: 키 → 메시(장면에 붙음)
  build(parent, mats, { cast = true, recv = true, noCast = [] } = {}) {
    const out = {};
    for (const [k, list] of this.parts) {
      const m = new THREE.Mesh(mergeGeometries(list), mats[k]);
      m.castShadow = cast && !noCast.includes(k); m.receiveShadow = recv;
      parent.add(m); out[k] = m;
      list.forEach((g) => g.dispose());
    }
    this.parts.clear();
    return out;
  }
}

// 상자 UV 를 실제 크기(미터)에 맞춰 텍스처가 늘어나지 않게
export function boxUV(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] / tile, uv.getY(j) * dims[f][1] / tile); }
  return g;
}

// 인스턴스 배치: list = [{x,y,z,ry,s|sv:[x,y,z],c,rx,rz}]
const q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), m4 = new THREE.Matrix4();
export function instanced(parent, geo, mat, list, { cast = false, recv = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  im.count = list.length;
  const col = new THREE.Color(), tint = list.some((t) => t.c !== undefined);
  list.forEach((t, i) => {
    e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0); q.setFromEuler(e);
    t.sv ? sv.set(...t.sv) : sv.setScalar(t.s ?? 1);
    im.setMatrixAt(i, m4.compose(pv.set(t.x, t.y ?? 0, t.z), q, sv));
    if (tint) im.setColorAt(i, col.set(t.c ?? '#ffffff'));
  });
  im.castShadow = cast; im.receiveShadow = recv;
  im.computeBoundingSphere();
  parent.add(im);
  return im;
}
