// 반딧불이: 사찰 가는 숲길(TRAIL)·불멍 캠프 숲길(CAMP_PATH) 양옆 풀숲(길 가운데서 3~14m, 높이 0.4~3m) + 사찰 마당 가장자리 + 불멍 공터 가장자리
// 밤·해질녘에만 서서히 나타나고, 작고 따뜻한 연두·노란 빛이 천천히 떠다니며 느리게 깜빡임 (움직임·깜빡임은 셰이더의 시간 함수 → CPU 거의 0)
// 점 N 개(품질별)를 카메라 50m 안 자리로만 재배치(풀 재활용) → 그리기 호출 1번. glow = 지금 보이는 정도(밤 벌레 소리 키우는 데 씀)
import * as THREE from 'three';
import { TRAIL, TEMPLE_YARD, inTown } from './world.js';
import { CAMP_PATH, FIRE, CLEAR_R } from './campdata.js';
import { groundH } from './gfx.js';
import { pointScale } from './camp-site.js';

const VS = `attribute vec4 aSeed; uniform float uTime, uVis, uScale, uSize; varying float vA, vH;
void main() {
  vec3 p = position; float t = uTime, s = aSeed.x * 6.2831;
  p.x += sin(t * 0.37 * aSeed.y + s) * aSeed.z + sin(t * 0.9 + s * 3.0) * 0.15;
  p.z += cos(t * 0.31 * aSeed.y + s * 1.7) * aSeed.z;
  p.y += sin(t * 0.5 * aSeed.y + s * 0.6) * 0.35;
  float c = fract(t * 0.18 * aSeed.y + aSeed.x);
  vA = (smoothstep(0.0, 0.12, c) * (1.0 - smoothstep(0.22, 0.45, c)) * 0.9 + 0.06) * uVis; vH = aSeed.w; // 부드럽게 켜졌다 꺼짐 + 아주 옅은 바탕빛
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = vA < 0.004 ? 0.0 : uSize * uScale / max(-mv.z, 0.5);
}`;
const FS = `varying float vA, vH;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0, a = (smoothstep(0.32, 0.0, r) + smoothstep(1.0, 0.0, r) * smoothstep(1.0, 0.0, r) * 0.3) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(vec3(0.72, 1.0, 0.32), vec3(1.0, 0.9, 0.42), vH), a);
}`;
const COUNT = { high: 600, normal: 420, low: 160 }; // 낮음은 약 1/3
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 반딧불이가 있을 수 있는 자리들 (한 번만 만듦): [x, z]
export function fireflySpots(rand = Math.random) {
  const out = [];
  for (const P of [TRAIL, CAMP_PATH]) for (let i = 0; i < P.pts.length - 1; i++) {
    const [ax, az] = P.pts[i], [bx, bz] = P.pts[i + 1], l = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / l, nz = (bx - ax) / l, hw = Array.isArray(P.hw) ? P.hw[i] : P.hw;
    for (let s = 0; s < l; s += 1.5) for (const side of [-1, 1]) { const o = Math.max(hw + 0.8, 3 + rand() * 11) * side, x = ax + ((bx - ax) * s) / l, z = az + ((bz - az) * s) / l; out.push([x + nx * o, z + nz * o]); }
  }
  const Y = TEMPLE_YARD; // 사찰 마당 안쪽 가장자리 띠 (소량)
  for (let k = 0; k < 120; k++) { const u = rand(), side = Math.floor(rand() * 4), w = Y.w / 2 - 2 - rand() * 4, d = Y.d / 2 - 2 - rand() * 4, e = (u - 0.5) * 2; out.push(side < 2 ? [Y.cx + e * w, Y.cz + (side ? d : -d)] : [Y.cx + (side === 2 ? w : -w), Y.cz + e * d]); }
  for (let k = 0; k < 90; k++) { const a = rand() * 6.2832, r = CLEAR_R - 3 + rand() * 9; out.push([FIRE.x + Math.sin(a) * r, FIRE.z + Math.cos(a) * r]); } // 불멍 공터 가장자리
  return out.filter(([x, z]) => !inTown(x, z, -3)); // 마을 울타리 안·바로 옆은 빼고
}

export function createFireflies(scene, Q) {
  const N = COUNT[Q?.level] ?? COUNT.normal, spots = fireflySpots(), sy = spots.map(([x, z]) => groundH(x, z));
  const g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3).fill(1e6), seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) seed.set([Math.random(), 0.9 + Math.random() * 1.3, 0.6 + Math.random() * 1.4, Math.random()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const U = { uTime: { value: 0 }, uVis: { value: 0 }, uScale: { value: 500 }, uSize: { value: 0.4 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5; scene.add(pts);
  let acc = 1, glow = 0, near = [];
  return {
    update(dt, camera, renderer, night) {
      U.uTime.value += dt;
      const vis = smooth(0.3, 0.6, night); // 해질녘부터 서서히, 낮엔 안 보임
      U.uVis.value = vis;
      if ((acc += dt) >= 0.4) {
        acc = 0; const cx = camera.position.x, cz = camera.position.z;
        near = []; if (vis > 0.01) for (let k = 0; k < spots.length; k++) if (Math.abs(spots[k][0] - cx) < 50 && Math.abs(spots[k][1] - cz) < 50 && Math.hypot(spots[k][0] - cx, spots[k][1] - cz) < 50) near.push(k);
        let moved = false;
        if (near.length) for (let i = 0; i < N; i++) { // 카메라에서 55m 넘게 먼 점만 가까운 자리로 옮김 (풀 재활용)
          if (Math.hypot(pos[i * 3] - cx, pos[i * 3 + 2] - cz) <= 55) continue;
          const k = near[Math.floor(Math.random() * near.length)], [x, z] = spots[k];
          pos.set([x + (Math.random() - 0.5) * 3, sy[k] + 0.4 + Math.random() * 2.6, z + (Math.random() - 0.5) * 3], i * 3); moved = true;
        }
        if (moved) g.attributes.position.needsUpdate = true;
        glow = vis * Math.min(1, near.length / 40);
        U.uScale.value = pointScale(camera, renderer);
      }
      pts.visible = vis > 0.01 && near.length > 0;
    },
    get glow() { return glow; }, get count() { return N; }, points: pts,
  };
}
