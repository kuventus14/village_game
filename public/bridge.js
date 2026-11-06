// 포근 놀이공원 가는 길의 호수와 아치 다리: 물결 셰이더 호수 · 둥글게 솟는 돌다리(바닥·난간·가로등·교각) · 호숫가 갈대
// 좌표·높이는 전부 parkdata.js (LAKE·BRIDGE·bridgeH·lakeEdge) — 걷는 높이는 world.js floorY 가 같은 bridgeH 를 씀
import * as THREE from 'three';
import { LAKE, BRIDGE, bridgeH, lakeEdge, PARK_ROAD, parkRoadAt } from './world.js';
import { soft, patch, rng, U } from './gfx.js';
import { Kit, bx, cy, sp, hdr, buildKit } from './buildings.js';
import { cobbleTex } from './textures.js';

const PI = Math.PI, CREAM = '#fff4e6', PINK = '#ffc4d2', HOT = '#ff8fb1';
const NOISE = `
  float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
  float wf(vec2 w, float t){ return sin(w.x * 0.9 + t * 1.1 + sin(w.y * 0.8 + t) * 0.8) * 0.5 + sin(w.y * 1.3 - t * 0.9 + sin(w.x * 0.7) * 0.9) * 0.5 + wn(w * 1.6 + t * 0.5) * 0.6; }`;
// 호수 물: 정점 색 r = 가운데 0 → 가장자리 1 (가장자리 거품), 밤엔 은은한 푸른 빛, 낮엔 하늘이 비침
function lakeMat() {
  return patch(soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), {
    key: 'lake',
    uniforms: { uDeep: { value: new THREE.Color('#3f9fcf') }, uShal: { value: new THREE.Color('#8fdbe0') }, uSky: U.sky, uSunDir: U.light, uNight: U.night, uFlash: U.flash },
    vert: { head: 'varying vec3 vWP;', project_vertex: 'vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;' },
    frag: {
      head: 'varying vec3 vWP; uniform vec3 uDeep, uShal, uSky, uSunDir, uFlash; uniform float uNight; float gSpark, gGlow;' + NOISE,
      '!color_fragment': `{
        vec2 w = vWP.xz; float t = uTime, d = vColor.r;
        vec3 col = mix(uDeep, uShal, smoothstep(0.35, 1.0, d));
        float c1 = wn(w * 0.9 + vec2(t * 0.22, -t * 0.16)), c2 = wn(w * 1.3 - vec2(t * 0.18, t * 0.2));
        col += pow(1.0 - abs(c1 - c2), 9.0) * 0.1;
        vec3 V = normalize(cameraPosition - vWP);
        col = mix(col, uSky, pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0) * 0.5);
        float foam = smoothstep(0.9, 0.99, d + (wn(w * 2.5 + t * 0.35) - 0.5) * 0.08);
        col = mix(col, vec3(1.0), foam * 0.65);
        vec2 e = vec2(0.14, 0.0); float h0 = wf(w, t);
        vec3 N = normalize(vec3(h0 - wf(w + e.xy, t), 1.0, h0 - wf(w + e.yx, t)));
        gSpark = pow(max(dot(reflect(-uSunDir, N), V), 0.0), 160.0) * 1.5 * (1.0 - foam);
        gGlow = smoothstep(0.3, 0.8, uNight) * (0.12 + 0.12 * (1.0 - d)) * (1.0 - foam);
        diffuseColor.rgb = col;
      }`,
      emissivemap_fragment: 'totalEmissiveRadiance += vec3(1.0, 0.96, 0.85) * gSpark + vec3(0.25, 0.5, 0.85) * gGlow + uFlash * (0.55 + 0.45 * gSpark);',
    },
  });
}

// 길을 따라 지나가며 단면(profile = [[옆으로, 위로], ...])을 이어 붙인 판 (면마다 따로 정점 → 각진 모서리). o = 길 가운데부터 옆 오프셋
function sweep(samples, profile, { y0 = (s) => bridgeH(s), uvK = 0, color = null, closed = false } = {}) {
  const P = [], uv = [], col = [];
  const ring = samples.map(({ x, z, tx, tz, s, hw }) => profile.map(([o, h]) => { const ho = typeof o === 'function' ? o(hw) : o; return [x - tz * ho, y0(s) + h, z + tx * ho]; }));
  const n = profile.length, edges = closed ? n : n - 1;
  for (let i = 1; i < ring.length; i++) for (let k = 0; k < edges; k++) {
    const a = ring[i - 1][k], b = ring[i - 1][(k + 1) % n], c = ring[i][k], d = ring[i][(k + 1) % n];
    for (const v of [a, b, c, b, d, c]) { P.push(...v); if (uvK) uv.push(v[0] / uvK, v[2] / uvK); if (color) col.push(...color); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  if (uvK) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function createBridge(scene, Q) {
  const root = new THREE.Group(); root.name = 'bridge'; scene.add(root);
  // 표본: 다리 시작~끝 (길 점들 + 양 끝)
  const S = [BRIDGE.s0, ...PARK_ROAD.s.filter((s) => s > BRIDGE.s0 && s < BRIDGE.s1), BRIDGE.s1];
  const smp = S.map((s) => { const [x, z, tx, tz, hw] = parkRoadAt(s); return { x, z, tx, tz, s, hw }; });
  const hwOf = (hw) => hw - 0.1;

  /* ── 호수 물 ── */
  {
    const P = [], col = [], idx = [], rows = [];
    for (const s of PARK_ROAD.s) if (s > LAKE.s0 - 3 && s < LAKE.s1 + 3) rows.push(s);
    const Z = rows.map((s) => parkRoadAt(s)), cols = [[-1, 1], [-1, 0.45], [0, 0], [1, 0.45], [1, 1]];
    Z.forEach(([x, z, tx, tz], i) => {
      const s = rows[i], eL = lakeEdge(s, -1) + 1.4, eR = lakeEdge(s, 1) + 1.4;
      for (const [side, r] of cols) { const e = side === 0 ? 0 : side < 0 ? eL * (r === 1 ? 1 : 0.55) : eR * (r === 1 ? 1 : 0.55); P.push(x - tz * side * Math.abs(e), LAKE.y, z + tx * side * Math.abs(e)); col.push(r, 0, 0); }
      if (i) for (let k = 0; k < 4; k++) { const p = (i - 1) * 5 + k, q = i * 5 + k; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, lakeMat()); m.receiveShadow = true; m.renderOrder = 1; root.add(m);
  }

  /* ── 다리 바닥(돌길) · 몸통 · 난간 ── */
  const deck = new THREE.Mesh(sweep(smp, [[(hw) => -hwOf(hw), 0.02], [(hw) => hwOf(hw), 0.02]], { uvK: 2.3 }), soft('#fff0e4', { map: cobbleTex(), side: THREE.DoubleSide }));
  deck.receiveShadow = true; root.add(deck);
  const body = soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide });
  const girder = new THREE.Mesh(sweep(smp, [[(hw) => -hw - 0.5, 0], [(hw) => hw + 0.5, 0], [(hw) => hw + 0.5, -1.15], [(hw) => hw - 0.4, -1.45], [(hw) => -hw + 0.4, -1.45], [(hw) => -hw - 0.5, -1.15]], { color: [1, 0.92, 0.88], closed: true }), body);
  girder.castShadow = true; girder.receiveShadow = true; root.add(girder);
  for (const side of [-1, 1]) {
    const o = (hw) => side * (hw + 0.3);
    root.add(new THREE.Mesh(sweep(smp, [[(hw) => o(hw) - 0.2, 0], [(hw) => o(hw) + 0.2, 0], [(hw) => o(hw) + 0.2, 0.42], [(hw) => o(hw) - 0.2, 0.42]], { color: [1, 0.86, 0.9], closed: true }), body)); // 가장자리 턱
    const rail = new THREE.Mesh(sweep(smp, [[(hw) => o(hw) - 0.13, 1.0], [(hw) => o(hw) + 0.13, 1.0], [(hw) => o(hw) + 0.13, 1.2], [(hw) => o(hw) - 0.13, 1.2]], { color: [1, 0.55, 0.7], closed: true }), body); rail.castShadow = true; root.add(rail);
    root.add(new THREE.Mesh(sweep(smp, [[(hw) => o(hw) - 0.05, 0.62], [(hw) => o(hw) + 0.05, 0.62], [(hw) => o(hw) + 0.05, 0.7], [(hw) => o(hw) - 0.05, 0.7]], { color: [1, 0.8, 0.86], closed: true }), body)); // 가운데 가는 난간대
  }

  /* ── 기둥·난간 살·가로등·교각·다리 입구 기둥 (Kit 로 묶음) ── */
  const k = new Kit(), R = rng(7);
  const at = (s) => { const [x, z, tx, tz, hw] = parkRoadAt(s); return { x, z, tx, tz, hw, y: bridgeH(s) }; };
  const off = (p, side, o = 0.3) => ({ x: p.x - p.tz * side * (p.hw + o), z: p.z + p.tx * side * (p.hw + o) });
  for (let s = BRIDGE.s0 + 1; s < BRIDGE.s1 - 0.5; s += 0.95) for (const side of [-1, 1]) { // 난간 살(세로)
    const p = at(s), q = off(p, side); k.at(q.x, p.y, q.z).p('plain', bx(0.07, 0.62, 0.07), [0, 0.7, 0], CREAM);
  }
  for (let s = BRIDGE.s0 + 1.5; s < BRIDGE.s1 - 1; s += 3.8) for (const side of [-1, 1]) { // 굵은 기둥(2.8m 마다)
    const p = at(s), q = off(p, side); k.at(q.x, p.y, q.z).p('plain', bx(0.3, 1.34, 0.3), [0, 0.67, 0], CREAM).p('plain', bx(0.38, 0.1, 0.38), [0, 1.36, 0], HOT);
  }
  const lamp = (x, y, z, c = '#ff9fb8') => { // park-site 가로등과 같은 모양, 높이 y 에 놓음
    k.at(x, y, z).p('plain', cy(0.22, 0.3, 0.35, 10), [0, 0.18, 0], c).p('plain', cy(0.07, 0.09, 3.3, 8), [0, 1.9, 0], c).p('plain', new THREE.TorusGeometry(0.12, 0.04, 6, 12), [0, 1.2, 0], CREAM, [PI / 2, 0, 0]);
    k.p('plain', cy(0.3, 0.18, 0.12, 12), [0, 3.55, 0], c).p('glow', sp(0.34, 12, 8), [0, 3.92, 0], hdr('#fff0c0', 1.7)).p('plain', new THREE.ConeGeometry(0.42, 0.34, 12), [0, 4.36, 0], c).p('shine', sp(0.08, 6, 4), [0, 4.58, 0], '#ffd45a');
  };
  const lampS = [];
  for (let s = BRIDGE.s0 + 7; s < BRIDGE.s1 - 5; s += 11) lampS.push(s);
  lampS.forEach((s, i) => { const p = at(s); for (const side of [-1, 1]) { const q = off(p, side, 0.3); lamp(q.x, p.y, q.z); } });
  // 다리 입구 기둥 (양 끝, 양옆): 크림 기둥 + 분홍 공
  for (const s of [BRIDGE.s0 + 2, BRIDGE.s1 - 2]) { const p = at(s); for (const side of [-1, 1]) { const q = off(p, side, 0.5); k.at(q.x, p.y, q.z).p('stucco', bx(0.8, 0.45, 0.8, 0.8), [0, 0.22, 0], '#efe4d8').p('stucco', bx(0.55, 2.2, 0.55, 1), [0, 1.5, 0], CREAM).p('plain', sp(0.36, 10, 6), [0, 3.0, 0], PINK).p('glow', sp(0.2, 8, 6), [0, 3.0, 0], hdr('#ffd9a8', 1.8)); } }
  // 교각: 12m 마다 한 쌍 (호수 바닥까지) + 가로보
  for (let s = BRIDGE.s0 + 14; s < BRIDGE.s1 - 10; s += 12.5) {
    const p = at(s), top = p.y - 1.4, h = top + 3.2;
    for (const side of [-1, 1]) { const q = off(p, side, -1.4); k.at(q.x, top - h / 2, q.z).p('stucco', cy(0.62, 0.8, h, 10), [0, 0, 0], '#efe4d8').p('stucco', cy(0.8, 0.8, 0.3, 10), [0, h / 2 - 0.1, 0], CREAM); }
    k.at(p.x, top - 0.35, p.z, Math.atan2(p.tx, p.tz) + PI / 2).p('stucco', bx(p.hw * 2 - 1.2, 0.7, 0.7, 1), [0, 0, 0], CREAM);
  }
  { const g = new THREE.Group(); buildKit(k, g, false); root.add(g); }

  /* ── 호숫가 갈대 ── */
  {
    const reeds = [], rnd = rng(11);
    for (let s = LAKE.s0 + 4; s < LAKE.s1 - 4; s += 2.4) for (const side of [-1, 1]) {
      if (rnd() < 0.35) continue;
      const [x, z, tx, tz] = parkRoadAt(s), e = lakeEdge(s, side) - 0.2 + rnd() * 1.4;
      reeds.push({ x: x - tz * side * e, z: z + tx * side * e, h: 0.9 + rnd() * 1.1, ry: rnd() * 6.28 });
    }
    const geo = (() => { const g = new THREE.ConeGeometry(0.06, 1, 4, 1, true); g.translate(0, 0.5, 0); return g; })();
    const m = new THREE.InstancedMesh(geo, soft('#7fae6a', { side: THREE.DoubleSide }), reeds.length * 3), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (const r of reeds) for (let j = 0; j < 3; j++) { e.set((rnd() - 0.5) * 0.25, r.ry, (rnd() - 0.5) * 0.25); q.setFromEuler(e); M.compose(new THREE.Vector3(r.x + (rnd() - 0.5) * 0.5, LAKE.y - 0.1, r.z + (rnd() - 0.5) * 0.5), q, new THREE.Vector3(1, r.h * (0.8 + rnd() * 0.5), 1)); m.setMatrixAt(n++, M); }
    m.count = n; m.castShadow = false; root.add(m);
  }

  const cam = new THREE.Vector3();
  function update(dt, camera) { camera.getWorldPosition(cam); root.visible = cam.x < -30 && cam.x > -340; } // 길 있는 서쪽에서만 그림
  return { update, root };
}
