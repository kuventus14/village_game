// 포근 동물원 그림: 종마다 울타리 칸(낮은 나무 울타리 + 기대는 난간 + 밤엔 작은 등) · 서식지 꾸밈(나무·바위·물웅덩이·대나무…) · 종 이름 안내판 · 동물 8종
// 동물 = 파스텔 로우폴리 (큰 머리·반짝이는 동글한 눈·짧은 다리). 모양·종별로 부품(몸·머리·다리·꼬리·턱)마다 InstancedMesh 하나 → 동물 40마리가 그리기 호출 수십 개
// 움직임은 zoodata.js 의 animalPose(동물, 시각) (시간만의 결정적 함수) → 부품 행렬만 매 프레임 바꿈. 140m 밖 동물은 숨기고 갱신 생략, 동물원에서 멀면 통째로 숨김
// 데이터·충돌은 zoodata.js (world.js 가 다시 내보냄). 땅·길·입구 아치는 park-site.js. 연결 약속: docs/PARK.md 맨 아래
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENCLOSURES, ZOO_ANIMALS, ZOO_SPECIES, ZOO_ZONE, animalPose } from './world.js';
import { soft, patch, paint, lumpy, rng, nightGlow, noise } from './gfx.js';
import { Kit, bx, cy, hdr, buildKit } from './buildings.js';

const PI = Math.PI;
const ZC = { x: (ZOO_ZONE.x0 + ZOO_ZONE.x1) / 2, z: (ZOO_ZONE.z0 + ZOO_ZONE.z1) / 2 };
const FAR = 330, NEAR = 140; // 동물원 가운데에서 330m 밖이면 통째로 숨김 · 동물은 카메라에서 140m 안만
const INK = '#2a2230';

/* ───── 모양 도구 ───── */
const S = (r, w = 10, h = 7) => new THREE.SphereGeometry(r, w, h);
const Yv = new THREE.Vector3(0, 1, 0), qv = new THREE.Quaternion(), ev = new THREE.Euler();
// a → b 를 잇는 막대 (캡슐, cap=false 면 원기둥)
function rod(k, key, a, b, r, color, cap = true, n = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  qv.setFromUnitVectors(Yv, d.normalize()); ev.setFromQuaternion(qv);
  k.p(key, cap ? new THREE.CapsuleGeometry(r, L, 3, n) : cy(r, r, L, n), A.add(B).multiplyScalar(0.5).toArray(), color, [ev.x, ev.y, ev.z]);
}
// 반짝이는 동글한 눈 한 쌍: 까만 눈 + 흰 빛 두 점. out = 옆을 보는 정도(0 앞, 1 옆), lash = 속눈썹 길이
function eyes(k, x, y, z, r, out = 0.3, lash = 0) {
  for (const s of [-1, 1]) {
    const n = new THREE.Vector3(s * out, 0.12, 1).normalize(), p = new THREE.Vector3(s * x, y, z);
    k.p('e', S(r, 10, 7), p.toArray(), INK, [0, s * out * 0.9, 0], [1, 1.15, 0.75]);
    k.p('e', S(r * 0.38, 8, 6), p.clone().addScaledVector(n, r * 0.7).add(new THREE.Vector3(-s * r * 0.15, r * 0.38, 0)).toArray(), '#ffffff');
    k.p('e', S(r * 0.17, 6, 4), p.clone().addScaledVector(n, r * 0.72).add(new THREE.Vector3(s * r * 0.2, -r * 0.3, 0)).toArray(), '#ffffff');
    if (lash) for (let i = 0; i < 3; i++) { const t = new THREE.Vector3(s * x + s * (i - 1) * r * 0.45, y + r * 1.0, z + r * 0.3); rod(k, 'e', t.toArray(), t.clone().add(new THREE.Vector3(s * (i - 0.4) * lash * 0.45, lash, lash * 0.3)).toArray(), r * 0.09, INK, false, 4); }
  }
}
const blush = (k, x, y, z, r) => { for (const s of [-1, 1]) k.p('s', S(r, 8, 6), [s * x, y, z], '#ffa9bb', [0, s * 0.6, 0], [1, 0.6, 0.35]); };

/* ───── 동물 모양 (+z 를 봄, 발바닥 y = 0). 부품: body·head(목 포함)·leg(한 다리, 엉덩이가 원점)·tail·jaw(아래턱 또는 소품)
   키: s = 색만, p = 무늬(줄무늬·기린 무늬, 셰이더), e = 눈(조명 없음). 뼈대: hips [x,y,z,위상], neck·tail·jaw 붙는 곳, legLen, 동작 크기 ───── */
const MODELS = {
  giraffe() {
    const C = '#f7deaa', body = new Kit(), head = new Kit(), leg = new Kit(), tail = new Kit();
    rod(leg, 'p', [0, 0, 0], [0, -1.78, 0], 0.14, C); leg.p('s', cy(0.13, 0.16, 0.2, 10), [0, -1.92, 0], '#7a5a48');
    body.p('p', S(1, 14, 10), [0, 2.38, 0], C, undefined, [0.74, 0.68, 1.12]).p('p', S(0.72), [0, 2.58, 0.5], C).p('p', S(0.62), [0, 2.4, -0.62], C);
    rod(tail, 's', [0, 0, 0], [0, -0.75, -0.25], 0.035, C); tail.p('s', S(0.11, 8, 6), [0, -0.85, -0.3], '#6a4532', undefined, [0.8, 1.4, 0.8]);
    const d = new THREE.Vector3(0, Math.cos(0.3), Math.sin(0.3)), nb = new THREE.Vector3(0, Math.sin(0.3), -Math.cos(0.3));
    rod(head, 'p', [0, -0.1, -0.03], [0, 2.05, 0.6], 0.24, C, true, 10);
    for (let t = 0.15; t < 2.2; t += 0.17) { const c = d.clone().multiplyScalar(t).add(new THREE.Vector3(0, -0.05, -0.05)).addScaledVector(nb, 0.2); head.p('s', bx(0.07, 0.13, 0.16), c.toArray(), '#c98a52', [0.3, 0, 0]); } // 짧은 갈기
    head.p('s', S(0.38, 14, 10), [0, 2.28, 0.72], '#f4d08f', undefined, [0.86, 0.82, 1.12]).p('s', S(0.27), [0, 2.16, 1.04], '#fdebc9', undefined, [0.86, 0.74, 1]);
    for (const s of [-1, 1]) { head.p('s', cy(0.05, 0.065, 0.34, 8), [s * 0.12, 2.66, 0.6], '#f4d08f', [-0.2, 0, s * 0.18]).p('s', S(0.08, 8, 6), [s * 0.155, 2.84, 0.57], '#7a5034'); // 뿔(오시콘)
      head.p('s', new THREE.ConeGeometry(0.09, 0.34, 8), [s * 0.34, 2.46, 0.58], '#f4d08f', [0.2, 0, s * 1.35]).p('s', S(0.02, 4, 3), [s * 0.11, 2.2, 1.24], '#7a5a48'); }
    eyes(head, 0.24, 2.36, 0.94, 0.085, 0.55, 0.11); blush(head, 0.26, 2.18, 0.94, 0.07);
    return { body, head, leg, tail, hips: [[0.36, 2.12, 0.72, 0], [-0.36, 2.12, 0.72, PI], [0.36, 2.06, -0.72, 0.25], [-0.36, 2.06, -0.72, PI + 0.25]], // 같은 쪽 다리가 함께 (기린 걸음)
      neck: [0, 2.72, 0.86], tailAt: [0, 2.6, -1.12], legLen: 2.0, stride: 3.4, swing: 0.32, graze: 0.75, reach: -0.3, ol: 0.035,
      pat: { kind: 'giraffe', color: '#c9783c', sc: 3.0 } };
  },
  lion(male = false) {
    const C = '#ecbb76', L = '#f8e2b8', body = new Kit(), head = new Kit(), leg = new Kit(), tail = new Kit(), jaw = new Kit();
    rod(leg, 's', [0, 0, 0], [0, -0.48, 0], 0.13, C); leg.p('s', S(0.15, 10, 7), [0, -0.6, 0.05], L, undefined, [1, 0.62, 1.25]);
    body.p('s', S(1, 14, 10), [0, 0.92, 0], C, undefined, [0.48, 0.45, 0.9]).p('s', S(0.43), [0, 0.97, 0.45], C).p('s', S(0.44), [0, 0.95, -0.44], C).p('s', S(1, 12, 8), [0, 0.76, 0.05], L, undefined, [0.4, 0.3, 0.7]);
    if (male) body.p('s', lumpy(S(0.55, 12, 9), 0.1, 3, 7), [0, 1.0, 0.55], '#c4703a');
    rod(tail, 's', [0, 0, 0], [0, -0.35, -0.45], 0.045, C); rod(tail, 's', [0, -0.35, -0.45], [0, -0.2, -0.8], 0.045, C); tail.p('s', S(0.11, 8, 6), [0, -0.18, -0.86], '#9a5a2e');
    if (male) { head.p('s', lumpy(S(0.64, 14, 10), 0.08, 2.6, 3), [0, 0.12, 0.06], '#c4703a', undefined, [1.05, 1.05, 0.75]);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; head.p('s', S(0.22, 8, 6), [Math.cos(a) * 0.56, 0.12 + Math.sin(a) * 0.56, 0.02], i % 2 ? '#b65f2e' : '#d98843'); } }
    head.p('s', S(0.4, 14, 10), [0, 0.12, 0.24], C, undefined, [1, 0.92, 0.95]);
    for (const s of [-1, 1]) head.p('s', S(0.16, 10, 8), [s * 0.1, -0.02, 0.52], L).p('s', S(0.12, 8, 6), [s * 0.27, 0.43, 0.14], C, undefined, [1, 1, 0.5]).p('s', S(0.065, 6, 4), [s * 0.27, 0.43, 0.18], '#c98a52', undefined, [1, 1, 0.5]);
    head.p('s', S(0.07, 8, 6), [0, 0.08, 0.64], '#c06e66', undefined, [1.4, 0.8, 0.8]).p('s', S(0.13, 8, 6), [0, -0.1, 0.44], '#8a3442', undefined, [1, 0.45, 0.9]); // 코 · 입속 (하품할 때 보임)
    eyes(head, 0.17, 0.22, 0.53, 0.07); blush(head, 0.27, 0.04, 0.47, 0.06);
    jaw.p('s', S(0.17, 10, 7), [0, -0.05, 0.16], L, undefined, [1, 0.5, 1.15]).p('s', S(0.09, 8, 6), [0, 0.0, 0.18], '#ff8fa3', undefined, [1, 0.4, 1.2]);
    return { body, head, leg, tail, jaw, hips: [[0.24, 0.7, 0.52, 0], [-0.24, 0.7, 0.52, PI], [0.24, 0.72, -0.48, PI], [-0.24, 0.72, -0.48, 0]],
      neck: [0, 1.12, 0.76], tailAt: [0, 1.05, -0.86], jawAt: [0, -0.08, 0.34], open: 0.7, legLen: 0.66, stride: 1.4, swing: 0.45, graze: 0.5, ol: 0.028 };
  },
  lionM() { return MODELS.lion(true); },
  tiger() {
    const C = '#f59c48', W = '#fff6ea', body = new Kit(), head = new Kit(), leg = new Kit(), tail = new Kit(), jaw = new Kit();
    rod(leg, 'p', [0, 0, 0], [0, -0.48, 0], 0.13, C); leg.p('s', S(0.15, 10, 7), [0, -0.6, 0.05], W, undefined, [1, 0.62, 1.25]);
    body.p('p', S(1, 14, 10), [0, 0.92, 0], C, undefined, [0.48, 0.45, 0.92]).p('p', S(0.43), [0, 0.97, 0.45], C).p('p', S(0.44), [0, 0.95, -0.44], C).p('s', S(1, 12, 8), [0, 0.74, 0.08], W, undefined, [0.4, 0.28, 0.7]).p('s', S(0.3), [0, 0.88, 0.72], W);
    rod(tail, 'p', [0, 0, 0], [0, -0.3, -0.5], 0.06, C); rod(tail, 'p', [0, -0.3, -0.5], [0, -0.1, -0.85], 0.055, C); tail.p('s', S(0.07, 8, 6), [0, -0.08, -0.9], INK);
    head.p('s', S(0.4, 14, 10), [0, 0.12, 0.24], C, undefined, [1.02, 0.92, 0.95]);
    for (const [x, y, z, rz, l] of [[0, 0.44, 0.33, 0, 0.16], [-0.09, 0.42, 0.32, 0.3, 0.12], [0.09, 0.42, 0.32, -0.3, 0.12], [-0.33, 0.12, 0.3, 1.3, 0.13], [0.33, 0.12, 0.3, -1.3, 0.13], [-0.36, 0.22, 0.2, 1.2, 0.12], [0.36, 0.22, 0.2, -1.2, 0.12]])
      head.p('s', S(0.035, 6, 4), [x, y, z], INK, [0.5, 0, rz], [1, l / 0.035, 0.6]); // 이마·볼 줄무늬 (王 무늬 느낌)
    for (const s of [-1, 1]) head.p('s', S(0.17, 10, 8), [s * 0.11, -0.02, 0.52], W).p('s', S(0.18, 8, 6), [s * 0.32, 0.0, 0.3], W, undefined, [0.7, 0.9, 0.9])
      .p('s', S(0.12, 8, 6), [s * 0.27, 0.43, 0.14], INK, undefined, [1, 1, 0.5]).p('s', S(0.05, 6, 4), [s * 0.27, 0.43, 0.19], W, undefined, [1, 1, 0.5]).p('s', S(0.06, 6, 4), [s * 0.16, 0.36, 0.5], W);
    head.p('s', S(0.065, 8, 6), [0, 0.08, 0.65], '#e0707a', undefined, [1.4, 0.8, 0.8]).p('s', S(0.13, 8, 6), [0, -0.1, 0.44], '#8a3442', undefined, [1, 0.45, 0.9]);
    eyes(head, 0.17, 0.22, 0.53, 0.07); blush(head, 0.27, 0.04, 0.47, 0.055);
    jaw.p('s', S(0.17, 10, 7), [0, -0.05, 0.16], W, undefined, [1, 0.5, 1.15]).p('s', S(0.09, 8, 6), [0, 0.0, 0.18], '#ff8fa3', undefined, [1, 0.4, 1.2]);
    return { body, head, leg, tail, jaw, hips: [[0.24, 0.7, 0.52, 0], [-0.24, 0.7, 0.52, PI], [0.24, 0.72, -0.48, PI], [-0.24, 0.72, -0.48, 0]],
      neck: [0, 1.12, 0.76], tailAt: [0, 1.05, -0.88], jawAt: [0, -0.08, 0.34], open: 0.7, legLen: 0.66, stride: 1.5, swing: 0.45, graze: 0.5, ol: 0.028,
      pat: { kind: 'stripe', color: INK, ax: { body: [0, 0, 22], leg: [0, 26, 0], tail: [0, -14, -20] }, abs: { body: [14, 0, 0] }, w: 0.7, duty: 0.45 } };
  },
  redpanda() {
    const C = '#cf5a2c', D = '#4a2a22', W = '#fff8ef', body = new Kit(), head = new Kit(), leg = new Kit(), tail = new Kit();
    rod(leg, 's', [0, 0, 0], [0, -0.26, 0], 0.075, D); leg.p('s', S(0.085, 8, 6), [0, -0.32, 0.03], D, undefined, [1, 0.7, 1.2]);
    body.p('s', S(1, 12, 9), [0, 0.45, 0], C, undefined, [0.27, 0.25, 0.44]).p('s', S(1, 10, 7), [0, 0.36, 0.05], D, undefined, [0.22, 0.14, 0.34]);
    rod(tail, 'p', [0, 0, 0], [0, -0.12, -0.32], 0.12, C, true, 10); rod(tail, 'p', [0, -0.12, -0.32], [0, -0.05, -0.62], 0.115, C, true, 10);
    head.p('s', S(0.25, 14, 10), [0, 0.07, 0.08], C, undefined, [1.12, 0.95, 0.95]).p('s', S(0.13, 10, 8), [0, -0.03, 0.25], W, undefined, [1.05, 0.8, 0.9]);
    for (const s of [-1, 1]) { head.p('s', S(0.05, 6, 4), [s * 0.1, 0.17, 0.27], W).p('s', S(0.095, 8, 6), [s * 0.17, -0.02, 0.18], W, undefined, [0.8, 0.9, 0.8]).p('s', S(0.045, 6, 4), [s * 0.12, 0.0, 0.29], '#9a3a1c', undefined, [0.7, 1.3, 0.6]);
      head.p('s', new THREE.ConeGeometry(0.09, 0.17, 8), [s * 0.18, 0.27, 0.03], W, [0, 0, -s * 0.35]).p('s', new THREE.ConeGeometry(0.06, 0.12, 8), [s * 0.178, 0.262, 0.05], D, [0, 0, -s * 0.35]); }
    head.p('s', S(0.035, 6, 4), [0, 0.02, 0.37], INK, undefined, [1.3, 0.9, 0.8]);
    eyes(head, 0.09, 0.08, 0.29, 0.045); blush(head, 0.17, -0.04, 0.24, 0.035);
    return { body, head, leg, tail, hips: [[0.14, 0.34, 0.24, 0], [-0.14, 0.34, 0.24, PI], [0.14, 0.36, -0.22, PI], [-0.14, 0.36, -0.22, 0]],
      neck: [0, 0.56, 0.36], tailAt: [0, 0.5, -0.4], legLen: 0.34, stride: 0.75, swing: 0.5, graze: 0.55, ol: 0.016,
      pat: { kind: 'stripe', color: '#f6b97e', ax: { tail: [0, -11, -28] }, w: 0, duty: 0.1 } };
  },
  zebra() {
    const C = '#fbfaf6', K = '#2c2a33', body = new Kit(), head = new Kit(), leg = new Kit(), tail = new Kit();
    rod(leg, 'p', [0, 0, 0], [0, -0.8, 0], 0.09, C); leg.p('s', cy(0.08, 0.1, 0.14, 8), [0, -0.92, 0], K);
    body.p('p', S(1, 14, 10), [0, 1.15, 0], C, undefined, [0.42, 0.42, 0.82]).p('p', S(0.42), [0, 1.18, -0.42], C).p('p', S(0.42), [0, 1.17, 0.42], C);
    rod(tail, 's', [0, 0, 0], [0, -0.45, -0.18], 0.03, C); tail.p('s', S(0.08, 8, 6), [0, -0.55, -0.22], K, undefined, [0.8, 1.6, 0.8]);
    rod(head, 'p', [0, -0.05, -0.05], [0, 0.55, 0.32], 0.2, C, true, 10);
    head.p('p', S(0.27, 14, 10), [0, 0.64, 0.4], C, undefined, [0.95, 1, 1.05]); rod(head, 'p', [0, 0.56, 0.5], [0, 0.44, 0.72], 0.165, C, true, 10); head.p('s', S(0.155, 10, 8), [0, 0.42, 0.78], K, undefined, [1, 0.9, 0.9]);
    for (let i = 0; i < 9; i++) { const t = i / 8, y = -0.02 + t * 0.86, z = -0.2 + t * 0.52; head.p('s', bx(0.06, 0.17, 0.1), [0, y + 0.12, z - 0.1], i % 2 ? C : K, [0.6, 0, 0]); } // 곧추선 갈기
    for (const s of [-1, 1]) head.p('s', new THREE.ConeGeometry(0.075, 0.24, 8), [s * 0.13, 0.9, 0.32], C, [-0.2, 0, -s * 0.35]).p('s', S(0.025, 4, 3), [s * 0.07, 0.43, 0.9], '#4a4552');
    eyes(head, 0.19, 0.68, 0.52, 0.065, 0.5, 0.06); blush(head, 0.18, 0.52, 0.6, 0.05);
    return { body, head, leg, tail, hips: [[0.2, 0.98, 0.52, 0], [-0.2, 0.98, 0.52, PI], [0.2, 0.98, -0.52, PI], [-0.2, 0.98, -0.52, 0]],
      neck: [0, 1.36, 0.62], tailAt: [0, 1.32, -0.82], legLen: 0.98, stride: 2.0, swing: 0.4, graze: 1.15, ol: 0.028,
      pat: { kind: 'stripe', color: K, ax: { body: [0, 3, 21], head: [0, 19, 11], leg: [0, 30, 0] }, abs: { body: [16, 0, 0] }, w: 0.3, duty: 0.38 } };
  },
  hippo() {
    const C = '#b8a0b0', P = '#f2b8c6', M = '#cdb3c2', body = new Kit(), head = new Kit(), leg = new Kit(), tail = new Kit(), jaw = new Kit();
    rod(leg, 's', [0, 0, 0], [0, -0.26, 0], 0.17, C); leg.p('s', S(0.19, 10, 7), [0, -0.33, 0.04], C, undefined, [1, 0.6, 1.1]);
    body.p('s', S(1, 16, 12), [0, 0.95, 0], C, undefined, [0.8, 0.66, 1.25]).p('s', S(1, 12, 8), [0, 0.6, 0.08], P, undefined, [0.7, 0.4, 1.0]);
    rod(tail, 's', [0, 0, 0], [0, -0.22, -0.12], 0.05, C);
    head.p('s', S(0.5, 14, 10), [0, 0.1, 0.12], C, undefined, [1, 0.86, 1]).p('s', S(0.5, 16, 10), [0, 0.0, 0.58], M, undefined, [1.12, 0.62, 0.85]).p('s', S(0.3, 10, 7), [0, -0.2, 0.55], '#d6607a', undefined, [1.3, 0.35, 1.1]);
    for (const s of [-1, 1]) head.p('s', S(0.14, 10, 8), [s * 0.22, 0.38, 0.24], C).p('s', S(0.06, 8, 6), [s * 0.17, 0.3, 0.86], '#6e5866', undefined, [1, 0.6, 0.6]).p('s', S(0.075, 8, 6), [s * 0.3, 0.5, 0.0], C, undefined, [0.7, 1, 0.6]).p('s', S(0.04, 6, 4), [s * 0.3, 0.51, 0.04], P, undefined, [0.7, 1, 0.6]);
    eyes(head, 0.22, 0.43, 0.33, 0.07, 0.2); blush(head, 0.42, 0.0, 0.56, 0.09);
    jaw.p('s', S(0.46, 14, 9), [0, -0.06, 0.36], M, undefined, [1.1, 0.42, 0.95]).p('s', S(0.38, 12, 8), [0, 0.04, 0.36], '#ff8fa3', undefined, [1, 0.2, 0.85]);
    for (const s of [-1, 1]) jaw.p('s', new THREE.ConeGeometry(0.05, 0.16, 6), [s * 0.3, 0.12, 0.62], '#ffffff');
    return { body, head, leg, tail, jaw, hips: [[0.4, 0.45, 0.62, 0], [-0.4, 0.45, 0.62, PI], [0.4, 0.45, -0.62, PI], [-0.4, 0.45, -0.62, 0]],
      neck: [0, 1.15, 1.02], tailAt: [0, 1.02, -1.22], jawAt: [0, -0.18, 0.2], open: 0.9, legLen: 0.42, stride: 1.0, swing: 0.4, graze: 0.35, ol: 0.035 };
  },
  ostrich() {
    const B = '#3d3644', N = '#f0c6b6', W = '#f8f4ec', body = new Kit(), head = new Kit(), leg = new Kit(), tail = new Kit();
    leg.p('s', S(0.17, 10, 8), [0, -0.12, 0], N, undefined, [1, 1.3, 1.1]); rod(leg, 's', [0, -0.25, 0], [0, -1.02, 0.02], 0.055, N); leg.p('s', S(0.1, 8, 6), [0, -1.06, 0.1], N, undefined, [0.8, 0.4, 1.7]);
    body.p('s', lumpy(S(1, 14, 10), 0.08, 2.4, 11), [0, 1.38, 0], B, undefined, [0.55, 0.5, 0.72]);
    for (const s of [-1, 1]) body.p('s', lumpy(S(0.4, 10, 8), 0.1, 3, s + 5), [s * 0.47, 1.4, -0.12], W, [0.2, 0, 0], [0.38, 0.62, 0.95]);
    tail.p('s', lumpy(S(0.26, 10, 8), 0.12, 3, 2), [0, 0.05, -0.1], W).p('s', S(0.17, 8, 6), [0.14, 0.18, -0.2], W).p('s', S(0.17, 8, 6), [-0.14, 0.18, -0.2], W);
    rod(head, 's', [0, 0, 0], [0, 0.88, 0.22], 0.075, N); head.p('s', S(0.17, 10, 8), [0, 0.02, 0.0], B);
    head.p('s', S(0.16, 12, 9), [0, 0.98, 0.27], N, undefined, [1, 0.92, 1.1]).p('s', S(0.1, 10, 7), [0, 0.93, 0.44], '#f2b46d', undefined, [0.85, 0.35, 1.3]).p('s', S(0.06, 6, 4), [0, 1.12, 0.24], '#b9aeb8');
    eyes(head, 0.1, 1.01, 0.33, 0.065, 0.45, 0.07);
    return { body, head, leg, tail, hips: [[0.2, 1.12, -0.04, 0], [-0.2, 1.12, -0.04, PI]], neck: [0, 1.6, 0.5], tailAt: [0, 1.5, -0.66], legLen: 1.1, stride: 2.2, swing: 0.55, graze: 1.9, ol: 0.024 };
  },
  panda() {
    const W = '#fbfaf5', K = '#2f2b33', body = new Kit(), head = new Kit(), leg = new Kit(), tail = new Kit(), jaw = new Kit();
    rod(leg, 's', [0, 0, 0], [0, -0.3, 0], 0.15, K); leg.p('s', S(0.17, 10, 7), [0, -0.38, 0.04], K, undefined, [1, 0.7, 1.15]);
    body.p('s', S(1, 16, 12), [0, 0.8, 0], W, undefined, [0.56, 0.5, 0.78]).p('s', S(1, 14, 8), [0, 0.84, 0.32], K, undefined, [0.58, 0.53, 0.2]);
    tail.p('s', S(0.1, 8, 6), [0, 0, -0.02], W);
    head.p('s', S(0.42, 16, 12), [0, 0.18, 0.15], W, undefined, [1.1, 0.95, 0.95]).p('s', S(0.17, 12, 8), [0, 0.06, 0.5], W, undefined, [1.1, 0.78, 0.8]).p('s', S(0.06, 8, 6), [0, 0.12, 0.63], K, undefined, [1.35, 0.8, 0.8]);
    for (const s of [-1, 1]) head.p('s', S(0.15, 10, 8), [s * 0.31, 0.52, 0.08], K, undefined, [1, 1, 0.6]).p('s', S(0.12, 10, 8), [s * 0.155, 0.2, 0.47], K, [0, 0, s * 0.55], [0.82, 1.15, 0.5]);
    eyes(head, 0.155, 0.22, 0.53, 0.05); blush(head, 0.27, 0.05, 0.46, 0.06);
    rod(jaw, 's', [-0.12, -0.42, 0.02], [0.18, 0.42, 0.06], 0.035, '#86c96f'); // 대나무 (먹을 때만 보임)
    for (const t of [0.2, 0.45, 0.7]) jaw.p('s', cy(0.042, 0.042, 0.03, 8), [-0.12 + 0.3 * t, -0.42 + 0.84 * t, 0.02 + 0.04 * t], '#5f9e4f', [0, 0, -0.34]);
    for (let i = 0; i < 4; i++) jaw.p('s', S(0.09, 6, 4), [0.18 + Math.cos(i * 1.6) * 0.1, 0.42 + Math.sin(i * 1.6) * 0.06, 0.06], '#7cc46a', [0, 0, i], [1.6, 0.35, 0.6]);
    return { body, head, leg, tail, jaw, hips: [[0.28, 0.5, 0.42, 0], [-0.28, 0.5, 0.42, PI], [0.28, 0.5, -0.4, PI], [-0.28, 0.5, -0.4, 0]],
      neck: [0, 0.95, 0.62], tailAt: [0, 0.82, -0.78], jawAt: [0, 0.0, 0.62], prop: true, legLen: 0.5, stride: 0.95, swing: 0.4, graze: 0.4, ol: 0.03 };
  },
};
for (const [m, sp] of [['giraffe', { sitA: 0 }], ['lion', {}], ['lionM', {}], ['tiger', {}], ['redpanda', {}], ['zebra', { sitA: 0 }], ['hippo', {}], ['ostrich', { sitA: 0 }], ['panda', {}]]) MODELS[m].extra = sp;

/* ───── 재질: 색(툰) · 무늬(툰 + 셰이더: 줄무늬 / 기린 그물무늬, 부품 자기 좌표 기준이라 걸어도 무늬가 안 미끄러짐) · 눈 · 윤곽선 ───── */
const skinMat = soft('#ffffff', { vertexColors: true });
const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const outMat = new THREE.MeshBasicMaterial({ color: '#3a2a36', side: THREE.BackSide });
const PAT_FRAG = {
  stripe: `float f = dot(vZP, uAx) + dot(abs(vZP), uAbs) + (sin(vZP.x * 9.0 + vZP.y * 5.0) + sin(vZP.z * 7.0 - vZP.y * 4.0)) * uPW;
    diffuseColor.rgb = mix(diffuseColor.rgb, uPC, smoothstep(uDuty - 0.07, uDuty + 0.07, sin(f)));`,
  giraffe: `vec3 g = vZP * uSc, gi = floor(g), gf = fract(g); float d1 = 8.0, d2 = 8.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
      vec3 o = vec3(float(i), float(j), float(k)), c = gi + o;
      vec3 h = fract(sin(vec3(dot(c, vec3(127.1, 311.7, 74.7)), dot(c, vec3(269.5, 183.3, 246.1)), dot(c, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
      vec3 r = o + 0.15 + h * 0.7 - gf; float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    diffuseColor.rgb = mix(diffuseColor.rgb, uPC, smoothstep(0.1, 0.17, sqrt(d2) - sqrt(d1)));`,
};
function patMat(pat, part) {
  const ax = pat.ax?.[part] ?? [0, 0, 0];
  return patch(soft('#ffffff', { vertexColors: true }), {
    key: 'zoo-' + pat.kind,
    uniforms: { uAx: { value: new THREE.Vector3(...ax) }, uAbs: { value: new THREE.Vector3(...(pat.abs?.[part] ?? [0, 0, 0])) }, uPC: { value: new THREE.Color(pat.color) }, uPW: { value: pat.w ?? 0 }, uDuty: { value: pat.duty ?? 0.3 }, uSc: { value: pat.sc ?? 3 } },
    vert: { head: 'varying vec3 vZP;', begin_vertex: 'vZP = position;' },
    frag: { head: 'varying vec3 vZP; uniform vec3 uAx, uAbs, uPC; uniform float uPW, uDuty, uSc;', color_fragment: PAT_FRAG[pat.kind] },
  });
}
// 윤곽선: 겉면을 법선 방향으로 t 만큼 부풀린 뒷면 (아바타와 같은 진한 보라 테두리)
function outline(geos, t) {
  const g = mergeGeometries(geos.map((x) => { const c = x.clone(); for (const n of Object.keys(c.attributes)) if (n !== 'position' && n !== 'normal') c.deleteAttribute(n); return c; }));
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  return g;
}

/* ───── 서식지 꾸밈 (한 Kit 에 전부: 재질별로 합쳐 호출 몇 개) ───── */
const rockGeo = (seed, d = 1) => paint(lumpy(new THREE.IcosahedronGeometry(1, d), 0.2, 1.3, seed), (x, y) => [0.86 + y * 0.14, 0.84 + y * 0.14, 0.86 + y * 0.12]);
function habitat(k, E, R, dens) {
  const { x0, z0, x1, z1, cx, cz } = E, W = x1 - x0, D = z1 - z0;
  const GROUND = { giraffe: '#e3e7a6', lion: '#ecdca2', tiger: '#d3e4a0', redpanda: '#bfe1a3', zebra: '#cfe7a2', hippo: '#cfe3b2', ostrich: '#f3e1b3', panda: '#bfe4ab' }[E.id];
  { const g = new THREE.PlaneGeometry(W - 0.2, D - 0.2, Math.round(W / 2), Math.round(D / 2)).rotateX(-PI / 2), base = new THREE.Color(GROUND), mud = new THREE.Color('#d2b48e');
    paint(g, (x, y, z) => { const n = 0.92 + noise((cx + x) * 0.25, (cz + z) * 0.25) * 0.14; let c = base.clone(); if (E.pond) { const d = Math.hypot(cx + x - E.pond.x, cz + z - E.pond.z) - E.pond.r; if (d < 3) c.lerp(mud, Math.min(1, (3 - d) / 3)); } return [c.r * n, c.g * n, c.b * n]; });
    k.at(cx, 0.03, cz).p('plain', g, [0, 0, 0]); }
  const at = (x, z) => k.at(x, 0, z, R() * PI * 2);
  const rockAt = (o, sx = 1, sy = 0.62) => { at(o.x, o.z).p('stone', rockGeo(Math.floor(R() * 9), 1), [0, o.r * sy * 0.55, 0], ['#d9cdbf', '#cfc7cd', '#e2d4bf'][Math.floor(R() * 3)], undefined, [o.r * sx, o.r * sy, o.r * 0.9]); };
  const bushAt = (x, z, s) => { at(x, z); for (let i = 0; i < 3; i++) k.p('plain', lumpy(S(1, 9, 7), 0.12, 1.8, i), [(i - 1) * 0.55 * s, 0.45 * s, (i % 2) * 0.3 * s], ['#86cf72', '#9bd86e', '#78c48c'][i], undefined, s * (0.7 + (i % 2) * 0.2)); };
  const canopy = (x, y, z, r, c, flat = 0.4) => { for (let i = 0; i < 5; i++) { const a = i * 1.26; k.p('plain', lumpy(S(1, 10, 7), 0.14, 1.6, i + 3), [x + Math.cos(a) * r * 0.45 * (i ? 1 : 0), y + (i ? 0 : 0.3), z + Math.sin(a) * r * 0.45 * (i ? 1 : 0)], c[i % c.length], undefined, [r * 0.65, r * flat, r * 0.65]); } };
  for (const o of E.obstacles) {
    if (o.k === 'acacia') { // 우산 모양 아카시아 (잎 아래가 기린 머리보다 높은 5.6m)
      k.at(o.x, 0, o.z, R() * PI); rod(k, 'wood', [0, 0, 0], [0.3, 3.4, 0.1], 0.32, '#a77a52', false); rod(k, 'wood', [0.3, 3.3, 0.1], [-1.4, 6.3, 0.3], 0.18, '#a77a52', false); rod(k, 'wood', [0.3, 3.3, 0.1], [1.7, 6.4, -0.4], 0.18, '#a77a52', false);
      canopy(0.1, 7.0, 0, 4.4, ['#a3d36c', '#93c862', '#b2db78'], 0.32);
    } else if (o.k === 'feeder') { // 높은 먹이 받침대: 기둥 + 건초 바구니 (기린 입 높이)
      k.at(o.x, 0, o.z); rod(k, 'wood', [0, 0, 0], [0, 4.5, 0], 0.13, '#9a6a44', false); k.p('wood', cy(0.6, 0.42, 0.55, 12), [0, 4.65, 0], '#b98652').p('plain', S(0.58, 10, 6), [0, 4.95, 0], '#ecd27e', undefined, [1, 0.45, 1]);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; rod(k, 'wood', [Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9], [0, 2.4, 0], 0.07, '#9a6a44', false); }
    } else if (o.k === 'bigrock') { // 사자 바위: 넓은 바위 두 겹 (위는 평평)
      rockAt(o, 1, 0.5); k.at(o.x + 0.6, 0, o.z - 0.4).p('stone', rockGeo(4, 1), [0, o.r * 0.55, 0], '#e4d6c2', undefined, [o.r * 0.62, o.r * 0.32, o.r * 0.55]);
    } else if (o.k === 'rock') rockAt(o);
    else if (o.k === 'pool' || o.k === 'pond') { // 물웅덩이 바닥·둘레 돌 (물은 따로 반투명)
      k.at(o.x, 0.07, o.z).p('plain', new THREE.CircleGeometry(o.r + 0.2, 40).rotateX(-PI / 2), [0, 0, 0], '#5aa6b8').p('plain', new THREE.RingGeometry(o.r - 0.4, o.r + 0.8, 40).rotateX(-PI / 2), [0, 0.02, 0], o.k === 'pond' ? '#c7a67c' : '#d7c4a2');
      for (let a = 0; a < PI * 2; a += (o.k === 'pond' ? 0.5 : 0.42) + R() * 0.3) { if (o.k === 'pond' && Math.cos(a) < -0.3) continue; const s = 0.3 + R() * 0.35; k.at(o.x + Math.cos(a) * (o.r + 0.5), 0, o.z + Math.sin(a) * (o.r + 0.5), R() * 6).p('stone', rockGeo(Math.floor(R() * 9), 0), [0, s * 0.3, 0], '#d9d0c6', undefined, [s * 1.3, s * 0.7, s]); }
      if (o.k === 'pond') { for (let i = 0; i < 9; i++) { const a = R() * PI * 2, r = 2 + R() * (o.r - 3); k.at(o.x + Math.cos(a) * r, 0.17, o.z + Math.sin(a) * r, R() * 6).p('plain', new THREE.CircleGeometry(0.45 + R() * 0.25, 10, 0.4, PI * 1.85).rotateX(-PI / 2), [0, 0, 0], '#7cc46a'); if (i % 3 === 0) k.p('plain', S(0.13, 8, 5), [0.1, 0.06, 0.1], '#ffb3c8', undefined, [1, 0.6, 1]); }
        for (let a = 0; a < PI * 2; a += 0.28) if (Math.cos(a) < -0.3) for (let j = 0; j < 3; j++) k.at(o.x + Math.cos(a) * (o.r - 0.2 + j * 0.3), 0, o.z + Math.sin(a) * (o.r - 0.2 + j * 0.3)).p('plain', new THREE.ConeGeometry(0.05, 1.1 + R() * 0.6, 4), [0, 0.6, 0], '#8fc46e'); } // 갈대
    } else if (o.k === 'tree') { // 둥근 나무 + 둘레 쉼판 (레서판다)
      k.at(o.x, 0, o.z); rod(k, 'wood', [0, 0, 0], [0, 3.6, 0], 0.3, '#9a6a44', false); k.p('wood', cy(1.2, 1.2, 0.12, 14), [0, 1.6, 0], '#c89a6a'); rod(k, 'wood', [0, 2.2, 0], [1.4, 3.4, 0.3], 0.12, '#9a6a44', false);
      canopy(0, 4.4, 0, 3.2, ['#7fcf72', '#95d66d', '#6ec58d'], 0.55);
    } else if (o.k === 'post') { k.at(o.x, 0, o.z); rod(k, 'wood', [0, 0, 0], [0, 2.1, 0], 0.16, '#9a6a44', false); k.p('wood', cy(0.5, 0.5, 0.08, 12), [0, 2.1, 0], '#c89a6a'); }
    else if (o.k === 'stump') k.at(o.x, 0, o.z).p('wood', cy(0.75, 0.85, 0.55, 14), [0, 0.27, 0], '#a87a52').p('plain', cy(0.7, 0.7, 0.02, 14), [0, 0.56, 0], '#f0d6a8');
    else if (o.k === 'trough') k.at(o.x, 0, o.z, 0.3).p('wood', bx(2.2, 0.55, 0.9, 0.6), [0, 0.27, 0], '#b98652').p('plain', bx(2.0, 0.02, 0.7), [0, 0.53, 0], '#8fd3e8');
    else if (o.k === 'bush') bushAt(o.x, o.z, o.r * 0.9);
    else if (o.k === 'bamboo') { // 대나무 숲: 마디 있는 줄기 + 꼭대기 잎
      for (let i = 0; i < Math.round(14 * dens) + 4; i++) {
        const a = R() * PI * 2, r = Math.sqrt(R()) * o.r * 0.85, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r, h = 3.2 + R() * 2.4, lean = (R() - 0.5) * 0.25;
        k.at(x, 0, z, R() * 6); rod(k, 'plain', [0, 0, 0], [lean, h, 0], 0.06, R() < 0.5 ? '#8fcf6c' : '#7cc160', false, 6);
        for (let y = 0.6; y < h; y += 0.7) k.p('plain', cy(0.07, 0.07, 0.05, 6), [lean * y / h, y, 0], '#5f9e4f');
        for (let j = 0; j < 4; j++) k.p('plain', S(0.3, 6, 4), [lean + Math.cos(j * 1.7) * 0.32, h - 0.2 - j * 0.35, Math.sin(j * 1.7) * 0.32], '#86c96f', [0, j, 0.4], [1.4, 0.18, 0.5]);
      }
    }
  }
  // 바닥 꾸밈: 풀 포기(초원·사자는 마른 풀), 타조는 모래 물결 돌, 판다·레서판다는 꽃 조금
  const tuft = { giraffe: '#a8cf6a', lion: '#d9c27a', tiger: '#c9d27a', zebra: '#9fd06c', hippo: '#9fd06c', redpanda: '#8fcf72', panda: '#8fcf72', ostrich: '#e0cf8a' }[E.id];
  const n = Math.round(({ zebra: 140, giraffe: 90, lion: 110, tiger: 80, ostrich: 30, hippo: 50, redpanda: 50, panda: 40 }[E.id]) * dens);
  for (let i = 0; i < n; i++) {
    const x = x0 + 1 + R() * (W - 2), z = z0 + 1 + R() * (D - 2);
    if (E.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.6)) continue;
    k.at(x, 0, z, R() * 6); for (let j = 0; j < 3; j++) k.p('plain', new THREE.ConeGeometry(0.06, 0.45 + R() * 0.3, 3), [Math.cos(j * 2.1) * 0.08, 0.22, Math.sin(j * 2.1) * 0.08], tuft, [Math.cos(j * 2.1) * 0.3, 0, Math.sin(j * 2.1) * 0.3]);
    if ((E.id === 'panda' || E.id === 'redpanda') && i % 4 === 0) k.p('plain', S(0.07, 6, 4), [0.15, 0.32, 0], ['#ffd84a', '#ffffff', '#ff9fbd'][i % 3]);
  }
  if (E.id === 'redpanda') for (const [a, b] of [[[-0.2, 1.1, 0], [7.2, 1.1, 0]], [[0, 1.75, 0], [7, 1.75, 0]]]) { k.at(E.obstacles[1].x, 0, E.obstacles[1].z); rod(k, 'wood', a, b, 0.13, '#b07a52'); } // 두 기둥 사이 통나무 놀이대
}

// 울타리: 기둥(2.6m 간격) + 가로대 두 줄 + 기대는 난간판, 기둥 셋 중 하나엔 작은 등(밤에 빛남)
function fence(k, E) {
  const { x0, z0, x1, z1 } = E, sides = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
  let post = 0;
  for (const [ax, az, bx_, bz] of sides) {
    const L = Math.hypot(bx_ - ax, bz - az), ry = Math.atan2(bx_ - ax, bz - az), n = Math.round(L / 2.6);
    k.at((ax + bx_) / 2, 0, (az + bz) / 2, ry).p('wood', bx(0.07, 0.1, L, 1), [0, 0.42, 0], '#e8c49a').p('wood', bx(0.07, 0.1, L, 1), [0, 0.76, 0], '#e8c49a').p('wood', bx(0.24, 0.07, L + 0.24, 1), [0, 1.08, 0], '#d6a774');
    for (let i = 0; i < n; i++) {
      const t = i / n, x = ax + (bx_ - ax) * t, z = az + (bz - az) * t;
      k.at(x, 0, z, ry).p('wood', bx(0.16, 1.1, 0.16, 0.6), [0, 0.53, 0], '#c08f62');
      if (post++ % 3 === 0) k.p('plain', cy(0.11, 0.11, 0.05, 8), [0, 1.37, 0], '#8a6a52').p('glow', S(0.09, 8, 6), [0, 1.27, 0], hdr('#ffe3a3', 1.7)).p('plain', cy(0.03, 0.03, 0.14, 4), [0, 1.17, 0], '#8a6a52');
    }
  }
}

// 종 이름 안내판: 캔버스 하나(2×4 칸)에 8종을 그려 판 전부가 그리기 호출 하나
function signAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const x = c.getContext('2d'), BG = { giraffe: '#f4b860', lion: '#e99b55', tiger: '#f08a4b', redpanda: '#d9734a', zebra: '#8a8aa8', hippo: '#c49ab8', ostrich: '#b9a07a', panda: '#7fb98a' };
  ENCLOSURES.forEach((e, i) => {
    const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 256;
    x.fillStyle = BG[e.id]; x.beginPath(); x.roundRect(ox + 10, oy + 10, 492, 236, 70); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 10; x.beginPath(); x.roundRect(ox + 26, oy + 26, 460, 204, 56); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 110px sans-serif'; x.fillStyle = '#fff';
    x.fillText(e.icon, ox + 130, oy + 134); x.font = `bold ${e.name.length > 3 ? 82 : 100}px Jua, sans-serif`; x.fillText(e.name, ox + 330, oy + 136);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createZoo(scene, Q) {
  const lite = Q.lite || Q.level === 'low', dens = { high: 1, normal: 0.75, low: 0.45 }[Q.level] ?? 1, R = rng(7331);
  const root = new THREE.Group(); root.name = 'zoo'; scene.add(root);

  // ── 울타리·서식지·안내판 기둥 (한 Kit, 동물원 가운데에서 260m 밖이면 안 그림)
  const k = new Kit();
  for (const E of ENCLOSURES) { habitat(k, E, R, lite ? 0.5 : dens); fence(k, E); }
  const signs = [];
  ENCLOSURES.forEach((E, i) => { // 줄 사이 길 쪽 난간 (아랫줄은 남쪽 띠 길 쪽에도 하나 더)
    const top = E.z1 < -103, list = top ? [[E.z1, 0]] : [[E.z0, PI], [E.z1, 0]]; // 판은 모서리 가까이 (가운데 구경을 안 가리게)
    for (const [z, ry] of list) { const x = E.x0 + (E.x1 - E.x0) * (top ? 0.12 : ry ? 0.88 : 0.12); signs.push({ i, x, z, ry }); for (const s of [-1, 1]) k.at(x + s * 1.25, 0, z).p('wood', bx(0.14, 2.6, 0.14, 0.6), [0, 1.3, 0], '#a8784e').p('plain', S(0.13, 8, 6), [0, 2.66, 0], '#ffc4d2'); }
  });
  { const g = new THREE.Group(); buildKit(k, g, false); g.position.set(-ZC.x, 0, -ZC.z); const lod = new THREE.LOD(); lod.position.set(ZC.x, 0, ZC.z); lod.addLevel(g, 0); lod.addLevel(new THREE.Object3D(), 260); lod.name = 'zoo-habitat'; root.add(lod); }
  { const geos = signs.map(({ i, x, z, ry }) => { const g = new THREE.PlaneGeometry(2.7, 1.35), uv = g.attributes.uv, u0 = (i % 2) / 2, v0 = 1 - (Math.floor(i / 2) + 1) / 4;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) / 2, v0 + uv.getY(j) / 4);
      return g.rotateY(ry).translate(x, 1.85, z + (ry ? -0.09 : 0.09)); });
    root.add(new THREE.Mesh(mergeGeometries(geos), nightGlow(new THREE.MeshBasicMaterial({ map: signAtlas(), transparent: true, alphaTest: 0.3 }), 1, 0.62, 0.5))); }
  // ── 물 (반투명, 살짝 일렁이는 빛): 호랑이 웅덩이 + 하마 연못
  { const geos = ENCLOSURES.filter((E) => E.pond).map((E) => new THREE.CircleGeometry(E.pond.r + 0.15, 48).rotateX(-PI / 2).translate(E.pond.x, 0.16, E.pond.z));
    const mat = patch(soft('#9fdcef', { transparent: true, opacity: 0.62, depthWrite: false }), { key: 'zoo-water', vert: { head: 'varying vec3 vWP;', worldpos_vertex: 'vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;' },
      frag: { head: 'varying vec3 vWP;', color_fragment: 'float w = sin(vWP.x * 1.7 + uTime * 1.3) * sin(vWP.z * 1.9 - uTime * 1.1); diffuseColor.rgb += smoothstep(0.75, 0.98, w) * 0.22;' } });
    const m = new THREE.Mesh(mergeGeometries(geos), mat); m.renderOrder = 1; m.receiveShadow = true; root.add(m); }

  // ── 동물: 모양별 부품마다 InstancedMesh (새끼도 같은 모양을 작게). 낮음·lite 는 새끼 빼기 (어른만으로 종마다 4마리 이상)
  const animals = ZOO_ANIMALS.filter((a) => !(lite && a.baby)), PEN = Object.fromEntries(ENCLOSURES.map((e) => [e.id, e]));
  const groups = [];
  for (const model of Object.keys(MODELS)) {
    const list = animals.filter((a) => a.model === model); if (!list.length) continue;
    const def = MODELS[model](), ex = MODELS[model].extra, nh = def.hips.length, ims = {};
    for (const part of ['body', 'head', 'leg', 'tail', 'jaw']) {
      const kit = def[part]; if (!kit) continue;
      const count = list.length * (part === 'leg' ? nh : 1), out = [], solid = [];
      for (const key of [...kit.parts.keys()]) {
        const geo = kit.geometry(key), mat = key === 'e' ? eyeMat : key === 'p' ? patMat(def.pat, part) : skinMat;
        if (key !== 'e') solid.push(geo);
        const im = new THREE.InstancedMesh(geo, mat, count); im.castShadow = key !== 'e' && (part === 'body' || part === 'head'); // 그림자는 몸·머리만 (다리·꼬리는 작아서 생략) im.receiveShadow = key !== 'e';
        out.push(im);
      }
      if (solid.length && !lite && part !== 'jaw' && part !== 'tail') out.push(new THREE.InstancedMesh(outline(solid, def.ol), outMat, count));
      // 윤곽선(뒷면 부풀린 껍데기)은 낮음·lite 에선 생략 (삼각형 약 1/3 절약)
      for (const im of out) { im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.name = `zoo-${model}-${part}`; root.add(im); }
      ims[part] = out;
    }
    const L = Math.abs(def.hips[0][2] - def.hips.at(-1)[2]) || 1;
    def.sitA = ex.sitA ?? Math.asin(Math.min(0.9, def.legLen / L)); // 앉기: 앞다리 엉덩이를 축으로 뒤를 땅까지 내림
    groups.push({ model, def, list, ims, nh, hidden: list.map(() => false) });
  }

  // ── 매 프레임: 동물 부품 행렬
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), mR = new THREE.Matrix4(), mB = new THREE.Matrix4(), mH = new THREE.Matrix4(), mX = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  const qq = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), cam = new THREE.Vector3();
  const tr = (m, x, y, z) => m.multiply(tmp.makeTranslation(x, y, z)), rx = (m, a) => (a ? m.multiply(tmp.makeRotationX(a)) : m), ryM = (m, a) => (a ? m.multiply(tmp.makeRotationY(a)) : m);
  const setAll = (list, i, m) => { for (const im of list) im.setMatrixAt(i, m); };
  const bell = (x) => Math.max(0, Math.sin(x)) ** 2;
  function pose(g, j, a, t) {
    const d = g.def, p = animalPose(a, t), s = t / 1000, k = p.k, w = p.walk, ph = (p.gait / (d.stride * (a.baby ? 0.6 : 1))) * PI * 2, sd = a.seed % 97;
    let drop = Math.abs(Math.sin(ph)) * 0.025 * d.legLen * w, pitch = 0, piv = d.hips[0], hp = Math.sin(ph * 2) * 0.04 * w, hy = 0, open = 0, tailY = Math.sin(s * 1.6 + sd) * 0.3 + Math.sin(ph) * 0.2 * w;
    const fold = [0, 0], legX = [0, 0]; // [앞, 뒤] 다리 접기
    switch (p.act) {
      case 'graze': case 'peck': hp += d.graze * k * (p.act === 'peck' ? 0.75 + 0.25 * Math.abs(Math.sin(s * 3.2 + sd)) : 1) + Math.sin(s * 5 + sd) * 0.04 * k; break;
      case 'reach': hp += (d.reach ?? -0.25) * k + Math.sin(s * 4 + sd) * 0.03 * k; break;
      case 'look': hy = Math.sin(s * 0.55 + sd) * 0.75 * k; hp -= 0.08 * k; break;
      case 'yawn': open = bell(s * 0.7 + sd) * k; hp -= 0.45 * open; break;
      case 'dive': hy = Math.sin(s * 0.4 + sd) * 0.4 * k; break;
      case 'sit': case 'eat': if (d.sitA) { pitch = -d.sitA * k; fold[0] = d.sitA * k; fold[1] = -1.25 * k; drop += d.legLen * 0.08 * k; }
        if (p.act === 'eat') { legX[0] = -1.2 * k; hp += 0.15 * k + Math.sin(s * 3 + sd) * 0.08 * k; open = k; } else hy = Math.sin(s * 0.5 + sd) * 0.5 * k; break;
      case 'lie': drop += d.legLen * 0.78 * k; fold[0] = -1.45 * k; fold[1] = -1.3 * k; hp += 0.12 * k; hy = Math.sin(s * 0.3 + sd) * 0.35 * k; break;
    }
    pos.set(p.x, -p.sink, p.z); qq.setFromAxisAngle(Yv, p.ry); scl.setScalar(a.scale);
    mR.compose(pos, qq, scl);
    mB.copy(mR); tr(mB, 0, -drop, 0); if (pitch) { tr(mB, 0, piv[1], piv[2]); rx(mB, pitch); tr(mB, 0, -piv[1], -piv[2]); }
    setAll(g.ims.body, j, mB);
    mH.copy(mB); tr(mH, ...d.neck); ryM(mH, hy); rx(mH, hp + (a.baby ? -0.1 : 0)); if (a.baby) mH.multiply(tmp.makeScale(1.22, 1.22, 1.22)); setAll(g.ims.head, j, mH); // 새끼는 머리가 더 큼
    if (g.ims.jaw) { mX.copy(mH); tr(mX, ...d.jawAt); if (d.prop) mX.multiply(tmp.makeScale(open || 1e-4, open || 1e-4, open || 1e-4)); else rx(mX, open * d.open); setAll(g.ims.jaw, j, mX); }
    if (g.ims.tail) { mX.copy(mB); tr(mX, ...d.tailAt); ryM(mX, tailY); setAll(g.ims.tail, j, mX); }
    d.hips.forEach(([hx, hyy, hz, lp], h) => { const back = hz < 0 ? 1 : 0; mX.copy(mB); tr(mX, hx, hyy, hz); rx(mX, Math.sin(ph + lp) * d.swing * w + fold[back] + legX[back]); setAll(g.ims.leg, j * g.nh + h, mX); });
  }
  function hide(g, j) { for (const part in g.ims) for (const im of g.ims[part]) { if (part === 'leg') for (let h = 0; h < g.nh; h++) im.setMatrixAt(j * g.nh + h, ZERO); else im.setMatrixAt(j, ZERO); } }
  function update(dt, camera) {
    camera.getWorldPosition(cam);
    root.visible = Math.hypot(cam.x - ZC.x, cam.z - ZC.z) < FAR;
    if (!root.visible) return;
    const t = Date.now(); // 모두 같은 시계 → 다른 사람 화면과 거의 같은 모습
    for (const g of groups) {
      let dirty = false;
      g.list.forEach((a, j) => {
        const e = PEN[a.pen], off = Math.hypot(Math.max(0, e.x0 - cam.x, cam.x - e.x1), Math.max(0, e.z0 - cam.z, cam.z - e.z1)) > NEAR; // 칸이 140m 밖이면 숨기고 갱신 생략
        if (off) { if (!g.hidden[j]) { hide(g, j); g.hidden[j] = dirty = true; } return; }
        g.hidden[j] = false; pose(g, j, a, t); dirty = true;
      });
      if (dirty) for (const part in g.ims) for (const im of g.ims[part]) im.instanceMatrix.needsUpdate = true;
    }
  }
  // 처음엔 다 숨겨 둠 (첫 update 가 보이는 것만 놓음)
  for (const g of groups) g.list.forEach((_, j) => { hide(g, j); g.hidden[j] = true; });
  return { update, root };
}
