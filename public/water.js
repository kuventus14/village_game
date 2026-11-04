// 물: 물결 셰이더 연못(연잎·수련·갈대·오리 가족)과 2단 분수(떨어지는 물막·물줄기 입자)
import * as THREE from 'three';
import { FOUNTAIN, POND } from './world.js';
import { soft, patch, sway, paint, Batch, instanced, rng, U } from './gfx.js';
import { stoneTex, streakTex, dotTex } from './textures.js';

const NOISE = `
  float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
  float wf(vec2 w, float t){ return sin(w.x * 2.1 + t * 1.3 + sin(w.y * 1.7 + t) * 0.8) * 0.5 + sin(w.y * 2.7 - t * 1.1 + sin(w.x * 1.3) * 0.9) * 0.5 + wn(w * 3.0 + t * 0.6) * 0.6; }`;
// 물 재질: 정점 색 r 에 (반지름/3) 을 실어 보내 가장자리 거품 위치를 앎. rings = 분수 물막이 떨어지는 동심원 물결
function waterMat(cx, cz, rings) {
  return patch(soft('#ffffff', { vertexColors: true }), {
    key: 'water' + rings,
    uniforms: { uC: { value: new THREE.Vector2(cx, cz) }, uDeep: { value: new THREE.Color('#45aed6') }, uShal: { value: new THREE.Color('#86d6df') }, uSky: U.sky, uSunDir: U.light, uNight: U.night }, // 하늘색·빛 방향·밤 정도는 atmosphere 가 시간에 맞춰 채움
    vert: { head: 'varying vec3 vWP;', project_vertex: 'vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;' },
    frag: {
      head: 'varying vec3 vWP; uniform vec2 uC; uniform vec3 uDeep, uShal, uSky, uSunDir; uniform float uNight; float gSpark, gGlow;' + NOISE,
      '!color_fragment': `{
        vec2 w = vWP.xz; float t = uTime, R = vColor.r * 3.0, rr = length(w - uC), d = rr / R;
        vec3 col = mix(uDeep, uShal, smoothstep(0.1, 1.0, d));
        float c1 = wn(w * 1.5 + vec2(t * 0.25, -t * 0.18)), c2 = wn(w * 2.1 - vec2(t * 0.2, t * 0.23));
        col += pow(1.0 - abs(c1 - c2), 9.0) * 0.1;                       // 아른거리는 물빛 무늬
        ${rings ? 'col += sin((rr - 1.2) * 11.0 - t * 6.0) * exp(-abs(rr - 1.2) * 1.1) * 0.05 * step(1.15, rr) * step(1.5, R);' : ''}
        vec3 V = normalize(cameraPosition - vWP);
        col = mix(col, uSky, pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0) * 0.45); // 비스듬히 보면 하늘이 비침
        float foam = smoothstep(0.86, 0.98, d + (wn(w * 4.0 + t * 0.4) - 0.5) * 0.09);
        col = mix(col, vec3(1.0), foam * 0.7);
        vec2 e = vec2(0.12, 0.0); float h0 = wf(w, t);
        vec3 N = normalize(vec3(h0 - wf(w + e.xy, t), 0.9, h0 - wf(w + e.yx, t)));
        gSpark = pow(max(dot(reflect(-uSunDir, N), V), 0.0), 220.0) * 1.6 * (1.0 - foam); // 햇빛(밤엔 달빛) 반짝임 (블룸이 잡음)
        gGlow = ${rings ? '(1.0 - smoothstep(0.2, 1.0, d)) * 0.55' : 'smoothstep(0.55, 0.95, d) * 0.22'} * smoothstep(0.3, 0.8, uNight) * (1.0 - foam); // 밤엔 물속 조명이 은은하게
        diffuseColor.rgb = col;
      }`,
      emissivemap_fragment: 'totalEmissiveRadiance += vec3(1.0, 0.96, 0.85) * gSpark + vec3(0.35, 0.75, 0.95) * gGlow;',
    },
  });
}
const disc = (r, y, n = 48) => paint(new THREE.CircleGeometry(r, n).rotateX(-Math.PI / 2).translate(0, y, 0), () => [r / 3, 0, 0]);

function lathe(pts, n = 40, uvs = [10, 2]) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvs[0], uv.getY(i) * uvs[1]);
  return g;
}

// 오리 한 마리 모양 (정점 색). 몸·꼬리·머리·부리·눈·볼
function duckGeo(body, s) {
  const b = new Batch(), sph = (r) => new THREE.SphereGeometry(r, 10, 7);
  b.add('d', sph(0.28), { pos: [0, 0.22, 0], s: [1, 0.78, 1.3], color: body });
  b.add('d', new THREE.ConeGeometry(0.12, 0.26, 8), { pos: [0, 0.34, -0.36], rot: [-2.2, 0, 0], color: body });
  for (const sx of [-1, 1]) b.add('d', sph(0.16), { pos: [sx * 0.2, 0.28, -0.04], s: [0.45, 0.7, 1.3], rot: [0.2, 0, 0], color: body });
  b.add('d', sph(0.17), { pos: [0, 0.55, 0.24], color: body });
  b.add('d', sph(0.07), { pos: [0, 0.51, 0.42], s: [1.2, 0.5, 1.3], color: '#ff9f43' });
  for (const sx of [-1, 1]) { b.add('d', sph(0.026), { pos: [sx * 0.085, 0.6, 0.38], color: '#2b2230' }); b.add('d', sph(0.03), { pos: [sx * 0.12, 0.52, 0.36], s: [1, 0.6, 0.4], color: '#ffb3c1' }); }
  return b.geometry('d').scale(s, s, s);
}

const m4 = new THREE.Matrix4();
export function createWater(scene, Q) {
  const R = rng(3), pondMat = waterMat(POND.x, POND.z, false), fMat = waterMat(FOUNTAIN.x, FOUNTAIN.z, true);
  const pond = new THREE.Mesh(disc(POND.r + 0.15, 0.06, 64).translate(POND.x, 0, POND.z), pondMat);
  pond.receiveShadow = true; scene.add(pond);

  // 연잎(가장자리 홈) + 수련꽃 + 갈대
  const pad = paint(new THREE.CircleGeometry(1, 20, 0.3, Math.PI * 2 - 0.55).rotateX(-Math.PI / 2), (x, y, z) => { const r = Math.hypot(x, z); return [0.36 + r * 0.22, 0.66 + r * 0.16, 0.36 + r * 0.1]; });
  const pads = [];
  for (let i = 0; i < 13; i++) { const a = R() * 6.28, r = 0.8 + R() * (POND.r - 1.8); pads.push({ x: POND.x + Math.sin(a) * r, y: 0.075, z: POND.z + Math.cos(a) * r, s: 0.32 + R() * 0.28, ry: R() * 6.28 }); }
  instanced(scene, pad, soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), pads);
  const lotus = new Batch();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; lotus.add('f', new THREE.SphereGeometry(0.06, 8, 6), { pos: [Math.sin(a) * 0.07, 0.07, Math.cos(a) * 0.07], s: [0.6, 0.9, 1.6], rot: [0.9 * Math.cos(a), 0, -0.9 * Math.sin(a)], color: i % 2 ? '#ffc2d8' : '#ffd8e6' }); }
  lotus.add('f', new THREE.SphereGeometry(0.035, 8, 6), { pos: [0, 0.09, 0], color: '#ffe066' });
  instanced(scene, lotus.geometry('f'), soft('#ffffff', { vertexColors: true }), pads.filter((_, i) => i % 3 === 0).map((p) => ({ ...p, y: 0.08, s: 1 + R() * 0.3 })));
  const reed = new Batch();
  for (let i = 0; i < 9; i++) {
    const h = 0.7 + R() * 0.7, a = R() * 6.28, r = R() * 0.35, blade = new THREE.PlaneGeometry(0.07, h, 1, 3).translate(0, h / 2, 0), p = blade.attributes.position;
    for (let k = 0; k < p.count; k++) { const u = p.getY(k) / h; p.setX(k, p.getX(k) * (1 - u * 0.9)); p.setZ(k, u * u * 0.15); }
    blade.computeVertexNormals();
    reed.add('r', paint(blade, (x, y) => [0.38 + (y / h) * 0.25, 0.62 + (y / h) * 0.2, 0.36]), { pos: [Math.sin(a) * r, 0, Math.cos(a) * r], rot: [0, R() * 6.28, 0] });
  }
  for (let i = 0; i < 3; i++) { const x = (R() - 0.5) * 0.4, z = (R() - 0.5) * 0.4, h = 1.0 + R() * 0.4; reed.add('r', new THREE.CylinderGeometry(0.012, 0.015, h, 4).translate(x, h / 2, z), { color: '#6f9f52' }); reed.add('r', new THREE.CapsuleGeometry(0.04, 0.18, 3, 6).translate(x, h - 0.05, z), { color: '#8a5a3c' }); }
  const reeds = [0, 0.55, -0.55, 2.35, -2.35, 1.2].map((a) => ({ x: POND.x + Math.sin(a) * (POND.r - 0.15), y: 0, z: POND.z + Math.cos(a) * (POND.r - 0.15), s: 0.9 + R() * 0.3, ry: R() * 6 }));
  instanced(scene, reed.geometry('r'), sway(soft('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), 0.08, 0.2, 'reed'), reeds, { cast: true });

  // 오리 가족: 엄마 오리 2 + 아기 오리 4 (줄지어 따라다님)
  const ducks = instanced(scene, duckGeo('#fffaf0', 1), soft('#ffffff', { vertexColors: true }), [{ x: 0, z: 0 }, { x: 0, z: 0 }], { cast: true });
  const babies = instanced(scene, duckGeo('#ffe27a', 0.55), soft('#ffffff', { vertexColors: true }), [0, 1, 2, 3].map(() => ({ x: 0, z: 0 })), { cast: true });
  ducks.frustumCulled = babies.frustumCulled = false;

  // 분수: 돌 받침(선반 깎기) 2단 + 물 3면 + 떨어지는 물막 + 물줄기 입자
  const f = new THREE.Group(); f.position.set(FOUNTAIN.x, 0, FOUNTAIN.z); scene.add(f);
  const stone = soft('#f2e8da', { map: stoneTex() });
  const parts = [
    [[2.45, 0.4], [2.45, 0.6], [2.52, 0.67], [2.72, 0.69], [2.86, 0.62], [2.86, 0.52], [2.78, 0.45], [2.82, 0.08], [2.9, 0.0]], // 큰 수반 테두리
    [[0, 0.4], [0.48, 0.4], [0.44, 0.52], [0.29, 0.64], [0.24, 1.15], [0.31, 1.27], [0.3, 1.36], [0, 1.36]],
    [[0, 1.34], [0.5, 1.35], [0.95, 1.48], [1.16, 1.62], [1.19, 1.7], [1.12, 1.73], [1.03, 1.67], [0, 1.62]],
    [[0, 1.6], [0.19, 1.6], [0.14, 1.88], [0.18, 2.06], [0, 2.06]],
    [[0, 2.03], [0.3, 2.05], [0.5, 2.18], [0.56, 2.26], [0.51, 2.29], [0.47, 2.25], [0, 2.21]],
  ];
  const sb = new Batch();
  parts.forEach((p, i) => sb.add('s', lathe(p, i ? 28 : 48, i ? [6, 1] : [16, 1.5])));
  sb.add('s', new THREE.SphereGeometry(0.11, 12, 8), { pos: [0, 2.36, 0] });
  sb.add('s', new THREE.CircleGeometry(2.46, 40).rotateX(-Math.PI / 2), { pos: [0, 0.41, 0], color: '#d9cfc0' });
  sb.build(f, { s: stone });
  const fw = new THREE.Mesh(new Batch().add('w', disc(2.47, 0.53)).add('w', disc(1.05, 1.68, 32)).add('w', disc(0.48, 2.25, 24)).geometry('w'), fMat);
  fw.receiveShadow = true; f.add(fw);
  const st = streakTex(); st.repeat.set(5, 1);
  const sheetMat = new THREE.MeshBasicMaterial({ map: st, color: '#e6f8ff', transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
  const sheets = new Batch().add('w', new THREE.CylinderGeometry(1.18, 1.32, 1.16, 40, 1, true).translate(0, 1.11, 0)).add('w', new THREE.CylinderGeometry(0.55, 0.64, 0.6, 28, 1, true).translate(0, 1.97, 0)).geometry('w');
  f.add(new THREE.Mesh(sheets, sheetMat));

  const N = Math.round(260 * Q.fx), seed = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) seed[i] = R();
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const jet = new THREE.Points(pg, patch(new THREE.PointsMaterial({ map: dotTex(), size: 0.11, color: '#effcff', transparent: true, depthWrite: false, opacity: 0.85 }), {
    key: 'jet',
    vert: {
      head: 'attribute vec4 aSeed;',
      begin_vertex: `float pAlive; {
        float top = step(aSeed.z, 0.4), a = aSeed.y * 6.2831;
        vec3 o = mix(vec3(cos(a) * 1.17, 1.71, sin(a) * 1.17), vec3(0.0, 2.42, 0.0), top);
        vec3 v = mix(vec3(cos(a) * 0.45, 0.55 + aSeed.w * 0.6, sin(a) * 0.45), vec3(cos(a) * 0.3 * aSeed.w, 2.3 + aSeed.w * 0.7, sin(a) * 0.3 * aSeed.w), top);
        float floorY = mix(0.53, 2.25, top), life = 0.75;
        float t = fract(uTime / life + aSeed.x) * life;
        transformed = o + v * t - vec3(0.0, 4.9 * t * t, 0.0);
        pAlive = step(floorY, transformed.y) * (0.6 + aSeed.w * 0.6);
      }`,
      fog_vertex: 'gl_PointSize *= pAlive;',
    },
  }));
  jet.frustumCulled = false; f.add(jet);

  return {
    update(dt, T) {
      st.offset.y -= dt * 1.3;
      for (let i = 0; i < 2; i++) {
        const r = 2 + i * 1.3, dir = i ? -1 : 1;
        const pose = (lag, bob) => { const a = T * 0.3 * dir + i * 3 - lag * dir; return [POND.x + Math.sin(a) * r, 0.04 + Math.sin(T * 2.2 + bob) * 0.025, POND.z + Math.cos(a) * r, a + dir * Math.PI / 2]; };
        const [x, y, z, ry] = pose(0, i);
        ducks.setMatrixAt(i, m4.makeRotationY(ry).setPosition(x, y, z));
        for (let k = 0; k < 2; k++) { const [bx, by, bz, bry] = pose(0.32 + k * 0.24, k + i * 2 + 1); babies.setMatrixAt(i * 2 + k, m4.makeRotationY(bry).setPosition(bx, by, bz)); }
      }
      ducks.instanceMatrix.needsUpdate = babies.instanceMatrix.needsUpdate = true;
    },
  };
}
