// 살아 있는 분위기: 나비·새·떨어지는 벚꽃잎·햇빛 속 꽃가루(밤엔 반딧불)·굴뚝 연기. 움직임은 전부 셰이더가 시간으로 계산 (CPU 0)
import * as THREE from 'three';
import { BOUND, BX, BZ } from './world.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch, rng, nightGlow } from './gfx.js';
import { wingTex, dotTex } from './textures.js';

const seeds = (n, R, k = 4) => { const a = new Float32Array(n * k); for (let i = 0; i < a.length; i++) a[i] = R(); return a; };
function swarm(scene, geo, mat, anchors, R) {
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds(anchors.length, R), 4));
  const im = new THREE.InstancedMesh(geo, mat, anchors.length), m4 = new THREE.Matrix4();
  anchors.forEach(([x, y, z], i) => im.setMatrixAt(i, m4.makeTranslation(x, y, z)));
  im.frustumCulled = false; scene.add(im);
  return im;
}
function points(scene, n, R, mat, extra) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds(n, R), 4));
  if (extra) extra(g);
  const p = new THREE.Points(g, mat); p.frustumCulled = false; scene.add(p);
  return p;
}
const fade = { head: 'varying float vFade;', color_fragment: 'diffuseColor.a *= vFade;' };

export function createLife(scene, Q, { flowers, cherry, chimneys }) {
  const R = rng(91), n = (k) => Math.max(0, Math.round(k * Q.fx));

  // 나비: 꽃 근처를 팔랑팔랑 (날개 2장이 몸통 축으로 접혔다 펴짐)
  const wing = new THREE.PlaneGeometry(0.15, 0.13).rotateX(-Math.PI / 2).translate(0.08, 0, 0);
  const wings = mergeGeometries([wing, wing.clone().scale(-1, 1, 1)]); // 왼쪽 날개는 거울
  const bAnch = [];
  for (let i = 0; i < n(26) && flowers.length; i++) { const f = flowers[Math.floor(R() * flowers.length)]; bAnch.push([f.x, 0, f.z]); }
  const butterflies = swarm(scene, wings, patch(new THREE.MeshBasicMaterial({ map: wingTex(), alphaTest: 0.5, side: THREE.DoubleSide }), {
    key: 'butterfly',
    vert: {
      head: 'attribute vec4 aSeed;',
      begin_vertex: `{
        float t = uTime * (0.45 + aSeed.y * 0.4) + aSeed.x * 40.0, rr = 0.8 + aSeed.z * 1.6;
        float fl = sin(uTime * 15.0 + aSeed.x * 20.0) * 0.95 + 0.25, c = cos(fl), s = sin(fl);
        vec3 p = vec3(transformed.x * c, abs(transformed.x) * s, transformed.z);
        vec2 vel = vec2(cos(t * 0.9) * 0.9 * rr + cos(t * 2.3) * 0.9, -sin(t * 0.7) * 0.7 * rr - sin(t * 1.9) * 0.75);
        float h = atan(vel.x, vel.y), ch = cos(h), sh = sin(h);
        p = vec3(p.x * ch + p.z * sh, p.y, -p.x * sh + p.z * ch);
        transformed = p + vec3(sin(t * 0.9) * rr + sin(t * 2.3) * 0.4, 0.45 + aSeed.w * 0.9 + sin(t * 1.7) * 0.25 + abs(sin(uTime * 7.5 + aSeed.x * 10.0)) * 0.06, cos(t * 0.7) * rr + cos(t * 1.9) * 0.4);
      }`,
    },
  }), bAnch, R);
  const bc = ['#ffd84a', '#ffffff', '#ffa8c8', '#9fd0ff', '#ffb36b', '#c9a8ff'], col = new THREE.Color();
  for (let i = 0; i < bAnch.length; i++) butterflies.setColorAt(i, col.set(bc[i % bc.length]));

  // 새: 하늘 높이 큰 원을 그리며 날갯짓
  const bird = new THREE.BufferGeometry();
  bird.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, 0, 0, -0.15, -0.55, 0, -0.05, 0, 0, 0.18, 0, 0, -0.15, 0.55, 0, -0.05], 3));
  const birds = swarm(scene, bird, patch(new THREE.MeshBasicMaterial({ color: '#6d6079', side: THREE.DoubleSide }), {
    key: 'bird',
    vert: {
      head: 'attribute vec4 aSeed;',
      begin_vertex: `{
        float t = uTime * (0.08 + aSeed.y * 0.06) + aSeed.x * 6.283, rr = 35.0 + aSeed.z * 45.0;
        float fl = sin(uTime * (5.0 + aSeed.w * 2.0) + aSeed.x * 9.0) * 0.6, c = cos(fl), s = sin(fl);
        vec3 p = vec3(transformed.x * c, abs(transformed.x) * s, transformed.z) * 1.6;
        float h = t + 1.5708, ch = cos(h), sh = sin(h);
        p = vec3(p.x * ch + p.z * sh, p.y, -p.x * sh + p.z * ch);
        transformed = p + vec3(sin(t) * rr, sin(t * 3.0) * 1.5, cos(t) * rr);
      }`,
    },
  }), Array.from({ length: n(9) + 2 }, () => [(R() - 0.5) * 60, 28 + R() * 18, (R() - 0.5) * 60]), R);

  // 벚꽃잎: 벚나무에서 바람에 날려 빙글빙글 떨어짐
  const petalAnch = [];
  for (const t of cherry) if (Math.max(Math.abs(t.x), Math.abs(t.z)) < BOUND + 25) for (let i = 0; i < n(14); i++) petalAnch.push([t.x + (R() - 0.5) * 2.6, 0, t.z + (R() - 0.5) * 2.6]);
  const petals = petalAnch.length && swarm(scene, new THREE.PlaneGeometry(0.09, 0.065), patch(new THREE.MeshBasicMaterial({ color: '#ffc4da', side: THREE.DoubleSide }), {
    key: 'petal',
    vert: {
      head: 'attribute vec4 aSeed;',
      begin_vertex: `{
        float u = fract(uTime * (0.06 + aSeed.y * 0.05) + aSeed.x);
        float a = uTime * (2.0 + aSeed.z * 3.0) + aSeed.x * 20.0, c = cos(a), s = sin(a);
        vec3 p = vec3(transformed.x * c - transformed.y * s, transformed.x * s * 0.6 + transformed.y * c, transformed.x * s * 0.8) * smoothstep(0.0, 0.06, 1.0 - u);
        transformed = p + vec3(sin(u * 6.0 + aSeed.z * 6.0) * 0.7 + u * 2.2, mix(3.4, 0.02, u), cos(u * 5.0 + aSeed.w * 6.0) * 0.6);
      }`,
    },
  }), petalAnch, R);

  // 햇빛 속에 떠다니는 반짝이 꽃가루 (가산 혼합)
  const motes = n(420) ? points(scene, n(420), R, patch(new THREE.PointsMaterial({ map: dotTex(), size: 0.09, color: '#fff3c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }), {
    key: 'mote',
    vert: {
      head: 'attribute vec4 aSeed;',
      begin_vertex: `float pAlive; {
        vec3 b = (aSeed.xyz - 0.5) * vec3(${(BX * 2).toFixed(1)}, 0.0, ${(BZ * 2).toFixed(1)});
        float t = uTime * 0.15 + aSeed.w * 30.0;
        transformed = b + vec3(sin(t + aSeed.x * 9.0) * 1.5, 0.6 + aSeed.y * 3.5 + sin(t * 1.3 + aSeed.z * 7.0) * 0.4, cos(t * 0.8 + aSeed.y * 9.0) * 1.5);
        pAlive = 0.4 + 0.6 * max(0.0, sin(uTime * 2.0 + aSeed.w * 40.0));
      }`,
      fog_vertex: 'gl_PointSize *= pAlive;',
    },
  })) : null;

  // 굴뚝 연기: 몽글몽글 피어올라 커지며 옅어짐
  const per = Math.max(4, n(14));
  points(scene, chimneys.length * per, R, patch(nightGlow(new THREE.PointsMaterial({ map: dotTex(), size: 0.9, color: '#f7f3f6', transparent: true, depthWrite: false, opacity: 0.7 }), 1, 0.42, 0.5), {
    key: 'smoke',
    vert: {
      head: 'attribute vec4 aSeed; attribute vec3 aOrigin; varying float vFade;',
      begin_vertex: `float pAlive; {
        float u = fract(uTime * 0.16 + aSeed.x);
        transformed = aOrigin + vec3(u * 1.6 + sin(u * 6.0 + aSeed.y * 6.0) * 0.25, u * 3.4, sin(u * 4.0 + aSeed.z * 6.0) * 0.3);
        pAlive = 0.5 + u * 2.2; vFade = smoothstep(0.0, 0.12, u) * (1.0 - u);
      }`,
      fog_vertex: 'gl_PointSize *= pAlive;',
    },
    frag: fade,
  }), (g) => { const o = new Float32Array(chimneys.length * per * 3); chimneys.forEach((c, i) => { for (let k = 0; k < per; k++) o.set(c, (i * per + k) * 3); }); g.setAttribute('aOrigin', new THREE.BufferAttribute(o, 3)); });
  // 밤: 나비·새·꽃잎은 쉬러 가고, 꽃가루는 연두빛 반딧불(블룸)로 바뀜. 굴뚝 연기는 계속
  const DAY = new THREE.Color('#fff3c8'), FLY = new THREE.Color('#d6ff7a').multiplyScalar(2.4);
  return {
    motes,
    setNight(n, inKey) {
      const day = n < 0.5;
      butterflies.visible = birds.visible = day;
      if (petals) petals.visible = day;
      if (!motes) return;
      const f = Math.min(1, Math.max(0, (n - 0.4) / 0.4));
      motes.visible = !inKey;
      motes.material.color.lerpColors(DAY, FLY, f);
      motes.material.size = 0.09 + f * 0.07;
    },
  };
}
