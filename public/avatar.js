// 코드로 만든 귀여운 2등신 캐릭터. 꾸미기 옵션(머리·눈·피부·옷·악세서리)을 번호로 받아 조립함. 에셋 파일 없음.
import * as THREE from 'three';
import { OUTFITS, HAIRS, SKINS, BOTTOMS } from './world.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 3단계로 끊어지는 만화 느낌 조명
const grad = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;
const cache = new Map();
export const toon = (c, extra) => {
  const k = c + (extra ? JSON.stringify(extra) : '');
  if (!cache.has(k)) cache.set(k, new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...extra }));
  return cache.get(k);
};
const OUT = new THREE.MeshBasicMaterial({ color: 0x3a2a36, side: THREE.BackSide });
// 색을 어둡게(f<0)/밝게(f>0)
const shade = (hex, f) => '#' + [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f).toString(16).padStart(2, '0'); }).join('');

function mesh(geo, color, pos = [0, 0, 0], { scale, rot, outline = 0, shadow = false } = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? toon(color) : color);
  m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  m.castShadow = shadow;
  if (outline) { const o = new THREE.Mesh(geo, OUT); o.scale.setScalar(1 + outline); m.add(o); }
  return m;
}
const sph = (r, ...a) => new THREE.SphereGeometry(r, 20, 14, ...a);
const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);

// 눈 모양: [크기, 세로비, 기울기(+면 눈꼬리 올라감)]
const EYES = [[1, 1, 0], [1.3, 1, 0], [1, 1.1, -0.22], [1, 0.85, 0.25], [1, 1, 0], [1, 0.55, 0]];

// a: 저장된 아바타 번호들(world.js cleanAvatar). 캐릭터는 +z 방향을 봄
export function buildAvatar(a) {
  const skin = SKINS[a.sk], shirt = OUTFITS[a.oc], hair = HAIRS[a.hc], bot = BOTTOMS[a.bc];
  const dress = a.os === 2, overall = a.os === 4, torso = overall ? '#fffaf0' : shirt;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);

  // 다리 + 신발
  const legC = dress ? skin : overall ? shirt : bot, shoe = dress ? '#a5543c' : '#ffffff';
  const legs = [-1, 1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.14, 0.36, 0);
    leg.add(mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.3, 10), legC, [0, -0.15, 0], { shadow: true }));
    leg.add(mesh(sph(0.11), shoe, [0, -0.32, 0.03], { scale: [1, 0.7, 1.3], outline: 0.08 }));
    root.add(leg);
    return leg;
  });

  // 몸통 + 옷 스타일
  body.add(mesh(sph(0.3), torso, [0, 0.62, 0], { scale: [1, 0.95, 0.86], outline: 0.06, shadow: true }));
  const waist = (c) => body.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 18), c, [0, 0.42, 0], { scale: [1, 1, 0.86] }));
  if (a.os === 0) waist(bot);
  else if (a.os === 1) { // 후드티: 뒤에 후드, 앞주머니, 끈
    waist(bot);
    body.add(mesh(sph(0.2), shade(shirt, -0.12), [0, 0.88, -0.2], { scale: [1.4, 0.8, 0.7], outline: 0.05 }));
    body.add(mesh(new THREE.BoxGeometry(0.34, 0.14, 0.05), shade(shirt, -0.14), [0, 0.5, 0.245]));
    for (const s of [-1, 1]) body.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.15, 6), '#ffffff', [s * 0.07, 0.78, 0.265]));
  } else if (dress) { // 원피스: 치마 + 리본 깃
    body.add(mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.26, 18), shirt, [0, 0.44, 0], { outline: 0.05, shadow: true }));
    body.add(mesh(sph(0.05), '#ffffff', [0, 0.84, 0.24], { scale: [1.4, 1, 0.8] }));
  } else if (a.os === 3) { // 셔츠 + 넥타이
    waist(bot);
    for (const s of [-1, 1]) body.add(mesh(new THREE.BoxGeometry(0.1, 0.05, 0.03), '#ffffff', [s * 0.07, 0.87, 0.255], { rot: [0, 0, s * 0.6] }));
    body.add(mesh(new THREE.BoxGeometry(0.07, 0.2, 0.03), '#e0566a', [0, 0.72, 0.262]));
    body.add(mesh(sph(0.04), '#e0566a', [0, 0.84, 0.262]));
  } else { // 멜빵바지
    waist(shirt);
    body.add(mesh(new THREE.BoxGeometry(0.3, 0.26, 0.05), shirt, [0, 0.55, 0.25]));
    for (const s of [-1, 1]) {
      body.add(mesh(new THREE.BoxGeometry(0.06, 0.32, 0.04), shirt, [s * 0.12, 0.76, 0.235], { rot: [0.15, 0, 0] }));
      body.add(mesh(sph(0.025), '#ffd43b', [s * 0.12, 0.66, 0.272]));
    }
  }

  // 팔 (소매 색은 상의 색)
  const arms = [-1, 1].map((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.33, 0.78, 0);
    arm.add(mesh(cap(0.075, 0.14), torso, [0, -0.12, 0], { outline: 0.1 }));
    arm.add(mesh(sph(0.08), skin, [0, -0.27, 0]));
    body.add(arm);
    return arm;
  });
  const cup = new THREE.Group(); // 커피 타임일 때 오른손에 컵
  cup.add(mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.11, 12), '#ffffff', [0, 0, 0]));
  cup.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), '#8a5a3c', [0, 0.05, 0]));
  cup.position.set(0, -0.3, 0.06);
  cup.visible = false;
  arms[1].add(cup);

  // 머리 + 귀
  const head = new THREE.Group();
  head.position.set(0, 1.14, 0);
  body.add(head);
  head.add(mesh(sph(0.44), skin, [0, 0, 0], { scale: [1, 0.92, 1], outline: 0.05, shadow: true }));
  head.add(mesh(sph(0.09), skin, [-0.43, -0.03, 0], { scale: [0.6, 1, 1] }), mesh(sph(0.09), skin, [0.43, -0.03, 0], { scale: [0.6, 1, 1] }));

  // 눈 (e: 깜빡임 담당 / ei: 모양)
  const [es, ey, et] = EYES[a.ey], dark = '#2b2030';
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Group(), ei = new THREE.Group();
    e.position.set(s * 0.16, -0.02, 0.385);
    ei.scale.set(es, es * ey, es); ei.rotation.z = s * et;
    if (a.ey === 4) ei.add(mesh(new THREE.TorusGeometry(0.06, 0.017, 6, 14, Math.PI), dark, [0, -0.015, 0.02])); // 웃는 눈 ^
    else {
      ei.add(mesh(sph(0.075), dark, [0, 0, 0], { scale: [0.85, 1.2, 0.5] }));
      ei.add(mesh(sph(0.026), '#ffffff', [0.022, 0.035, 0.03]), mesh(sph(0.012), '#ffffff', [-0.02, -0.03, 0.03]));
      if (a.ey === 1) ei.add(mesh(sph(0.014), '#ffffff', [0.03, -0.045, 0.03]));
      if (a.ey === 3) ei.add(mesh(new THREE.ConeGeometry(0.02, 0.07, 6), dark, [s * 0.07, 0.07, 0.02], { rot: [0, 0, -s * 1.1] })); // 눈꼬리
      if (a.ey === 5) ei.add(mesh(new THREE.BoxGeometry(0.17, 0.018, 0.02), dark, [0, 0.07, 0.03])); // 졸린 눈꺼풀
    }
    e.add(ei);
    head.add(e);
    return e;
  });
  for (const s of [-1, 1]) head.add(mesh(sph(0.075), '#ff9fb0', [s * 0.27, -0.13, 0.31], { scale: [1, 0.6, 0.35], rot: [0, s * 0.7, 0] }));
  head.add(mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 14, Math.PI), '#b4506a', [0, -0.14, 0.415], { rot: [0, 0, Math.PI] }));

  // 머리카락
  const dome = (r, len, tilt, y = 0.03) => mesh(sph(r, 0, Math.PI * 2, 0, len), hair, [0, y, 0], { rot: [-tilt, 0, 0], outline: 0.04, shadow: true });
  const hp = (geo, pos, o) => head.add(mesh(geo, hair, pos, { outline: 0.05, shadow: true, ...o }));
  const fringe = () => hp(sph(0.4), [0, 0.27, 0.2], { scale: [1, 0.3, 0.55], rot: [0.45, 0, 0], outline: 0 });
  const back = (sx = 0.98, sy = 0.95) => hp(sph(0.5), [0, -0.1, -0.12], { scale: [sx, sy, 0.72], outline: 0.04 });
  const tie = (pos, c = '#ff6b9a') => head.add(mesh(sph(0.07), c, pos));
  const HS = [
    () => { // 0 짧은 머리 (뾰족)
      head.add(dome(0.475, 1.55, 0.32));
      head.add(mesh(new THREE.ConeGeometry(0.13, 0.28, 10), hair, [0.05, 0.5, 0.05], { rot: [0.1, 0, -0.35], outline: 0.08 }));
      head.add(mesh(new THREE.ConeGeometry(0.1, 0.22, 10), hair, [-0.16, 0.45, 0.2], { rot: [Math.PI * 0.62, 0, 0.5], outline: 0.08 }));
    },
    () => { head.add(dome(0.48, 1.62, 0.28)); fringe(); hp(sph(0.14), [-0.36, 0.1, 0.12], { scale: [0.6, 1.3, 0.8] }); hp(sph(0.14), [0.36, 0.1, 0.12], { scale: [0.6, 1.3, 0.8] }); }, // 1 단정 컷
    () => { // 2 양갈래 + 큰 리본
      head.add(dome(0.485, 1.6, 0.22)); back(); fringe();
      for (const s of [-1, 1]) { hp(cap(0.12, 0.28), [s * 0.45, -0.28, -0.05], { rot: [0, 0, s * 0.15], outline: 0.06 }); tie([s * 0.43, 0.03, -0.02]); }
      for (const s of [-1, 1]) head.add(mesh(new THREE.ConeGeometry(0.1, 0.18, 8), '#ff6b9a', [0.27 + s * 0.11, 0.5, 0.14], { rot: [0, 0, -s * Math.PI / 2], outline: 0.06 }));
      head.add(mesh(sph(0.055), '#ff3d7f', [0.27, 0.5, 0.15]));
    },
    () => { // 3 긴 생머리 (가르마 커튼 앞머리)
      head.add(dome(0.485, 1.6, 0.36));
      for (const s of [-1, 1]) {
        hp(sph(0.26), [s * 0.26, 0.27, 0.2], { scale: [0.8, 0.36, 0.5], rot: [0.45, 0, s * -0.6], outline: 0.04 });
        hp(cap(0.085, 0.34), [s * 0.45, -0.3, 0], { rot: [0, 0, s * 0.06], outline: 0.06 });
      }
      hp(cap(0.33, 0.28), [0, -0.4, -0.2], { scale: [1, 1, 0.55], outline: 0.04 });
    },
    () => { head.add(dome(0.485, 1.6, 0.25)); back(0.95, 0.9); fringe(); hp(cap(0.1, 0.42), [0, -0.2, -0.52], { rot: [0.25, 0, 0], outline: 0.05 }); tie([0, 0.08, -0.46]); }, // 4 포니테일
    () => { head.add(dome(0.48, 1.6, 0.25)); fringe(); hp(sph(0.21), [0, 0.52, -0.08], { outline: 0.06 }); tie([0, 0.4, -0.04]); }, // 5 똥머리
    () => { // 6 단발 보브
      head.add(dome(0.485, 1.65, 0.22)); fringe(); hp(sph(0.5), [0, -0.18, -0.22], { scale: [1.06, 0.78, 0.62], outline: 0.04 });
      for (const s of [-1, 1]) hp(cap(0.1, 0.18), [s * 0.43, -0.2, 0.04], { outline: 0.06 });
    },
    () => { // 7 곱슬 뭉게
      head.add(dome(0.47, 1.5, 0.3));
      for (let i = 0; i < 9; i++) { const t = (i / 9) * Math.PI * 2; if (Math.cos(t) < 0.45) hp(sph(0.2), [Math.sin(t) * 0.42, 0.14, Math.cos(t) * 0.42 - 0.05], { outline: 0.05 }); }
      for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2; hp(sph(0.19), [Math.sin(t) * 0.22, 0.4, Math.cos(t) * 0.22 - 0.06], { outline: 0.05 }); }
    },
  ];
  HS[a.hs]();

  // 악세서리
  const ACC = [
    null,
    () => { for (const s of [-1, 1]) head.add(mesh(new THREE.TorusGeometry(0.095, 0.013, 8, 20), '#3a2a36', [s * 0.16, -0.02, 0.408])); head.add(mesh(new THREE.BoxGeometry(0.07, 0.014, 0.014), '#3a2a36', [0, 0, 0.412])); },
    () => { for (const s of [-1, 1]) { head.add(mesh(sph(0.105), '#1d1722', [s * 0.16, -0.02, 0.405], { scale: [1, 0.78, 0.3] })); head.add(mesh(sph(0.025), '#ffffff', [s * 0.16 + 0.04, 0.01, 0.43], { scale: [1, 0.6, 0.3] })); } head.add(mesh(new THREE.BoxGeometry(0.08, 0.016, 0.016), '#1d1722', [0, 0, 0.412])); },
    () => { const h = new THREE.Group(); h.rotation.x = -0.18; head.add(h); h.add(mesh(sph(0.5, 0, Math.PI * 2, 0, 1.25), shirt, [0, 0.06, 0], { outline: 0.04, shadow: true })); h.add(mesh(new THREE.TorusGeometry(0.474, 0.045, 8, 28), shade(shirt, -0.12), [0, 0.216, 0], { rot: [Math.PI / 2, 0, 0] })); h.add(mesh(sph(0.1), '#ffffff', [0, 0.57, 0])); },
    () => { const h = new THREE.Group(); h.rotation.x = -0.1; head.add(h); h.add(mesh(sph(0.49, 0, Math.PI * 2, 0, 1.3), shirt, [0, 0.07, 0], { outline: 0.04, shadow: true })); h.add(mesh(new THREE.BoxGeometry(0.5, 0.035, 0.34), shade(shirt, -0.15), [0, 0.2, 0.5], { rot: [0.12, 0, 0], outline: 0.05 })); h.add(mesh(sph(0.04), '#ffffff', [0, 0.57, 0])); },
    () => { const t = mesh(new THREE.TorusGeometry(0.44, 0.03, 8, 24, Math.PI), '#ff8fb0', [0, 0.02, 0.02], { rot: [-0.2, 0, 0] }); head.add(t); for (const s of [-1, 1]) { head.add(mesh(sph(0.13), '#9a6a45', [s * 0.3, 0.4, 0.04], { outline: 0.05 })); head.add(mesh(sph(0.07), '#ffc9a0', [s * 0.3, 0.4, 0.14], { scale: [1, 1, 0.5] })); } },
  ];
  ACC[a.ac]?.();

  mergeParts(root);
  return { root, body, legs, arms, head, eyes, cup, phase: Math.random() * 6, blink: 1 + Math.random() * 3, wave: 0 };
}

// 같은 부모 그룹 안의 부품 메시를 재질별로 합침(외곽선 포함). 움직이는 건 그룹이라 구조·모양은 그대로, 그리기 호출만 1/3 쯤
const VC = toon('#ffffff', { vertexColors: true }), col = new THREE.Color();
function mergeParts(root) {
  const groups = []; root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  for (const grp of groups) {
    const parts = grp.children.filter((c) => c.isMesh && c.children.every((o) => o.isMesh && !o.children.length));
    if (parts.length < 2) continue;
    const buckets = new Map(), put = (key, mat, geo, matrix, color) => {
      const g = geo.clone().applyMatrix4(matrix);
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      if (color) { const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) c.set([color.r, color.g, color.b], i); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
      if (!buckets.has(key)) buckets.set(key, { mat, list: [], cast: key.endsWith('c') });
      buckets.get(key).list.push(g);
    };
    for (const m of parts) {
      m.updateMatrix();
      const mt = m.material, plain = mt.isMeshToonMaterial && !mt.transparent && !mt.map && mt.emissive.getHex() === 0;
      put(plain ? 'toon' + (m.castShadow ? 'c' : '') : mt.uuid + (m.castShadow ? 'c' : ''), plain ? VC : mt, m.geometry, m.matrix, plain && col.copy(mt.color));
      for (const o of m.children) { o.updateMatrix(); put(o.material.uuid, o.material, o.geometry, m.matrix.clone().multiply(o.matrix)); }
      grp.remove(m); m.traverse((o) => o.geometry.dispose());
    }
    for (const { mat, list, cast } of buckets.values()) { const mm = new THREE.Mesh(mergeGeometries(list), mat); mm.castShadow = cast; grp.add(mm); list.forEach((g) => g.dispose()); }
  }
}

// 멀리 있는 사람들: 다리·몸·머리·머리카락 네 덩어리를 InstancedMesh 로 한꺼번에 (몇십 명이어도 그리기 호출 4번, 한 명 약 400삼각형)
// 한 명 아바타는 약 2만 삼각형·19번 호출이라 80명을 다 그리면 너무 무거움 → 가까운 사람만 진짜 아바타 (game.js)
export function createCrowd(scene, max = 256) {
  const leg = (a) => (a.os === 2 ? SKINS[a.sk] : a.os === 4 ? OUTFITS[a.oc] : BOTTOMS[a.bc]);
  const parts = [
    [new THREE.CylinderGeometry(0.2, 0.17, 0.42, 8).translate(0, 0.21, 0), leg],
    [new THREE.SphereGeometry(0.3, 10, 6).scale(1.05, 0.95, 0.86).translate(0, 0.64, 0), (a) => OUTFITS[a.oc]],
    [new THREE.SphereGeometry(0.44, 12, 8).scale(1, 0.92, 1).translate(0, 1.14, 0), (a) => SKINS[a.sk]],
    [new THREE.SphereGeometry(0.49, 12, 6, 0, Math.PI * 2, 0, 1.65).rotateX(-0.28).translate(0, 1.16, 0), (a) => HAIRS[a.hc]],
  ].map(([geo, color]) => {
    const m = new THREE.InstancedMesh(geo, toon('#ffffff'), max);
    m.setColorAt(0, new THREE.Color(1, 1, 1)); // 색 버퍼를 처음부터 만들어 둠 (나중에 생기면 셰이더가 안 바뀜)
    m.count = 0; m.frustumCulled = false; scene.add(m);
    return { m, color };
  });
  const o = new THREE.Object3D(), c = new THREE.Color();
  let n = 0;
  return {
    begin() { n = 0; },
    add(a, x, y, z, ry) { // a = 아바타 번호들
      if (n >= max) return;
      o.position.set(x, y, z); o.rotation.y = ry; o.updateMatrix();
      for (const P of parts) { P.m.setMatrixAt(n, o.matrix); P.m.setColorAt(n, c.set(P.color(a))); }
      n++;
    },
    end() { for (const { m } of parts) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } },
  };
}

export function disposeAvatar(a) {
  a.root.removeFromParent();
  a.root.traverse((o) => o.geometry?.dispose());
}

/* ── 성당·사찰·교회 동작 (rituals.js 가 a.act = 행동 이름, a.actT = 시작 뒤 지난 초, a.actFont = 성수대에서, a.veil = 미사포를 매 프레임 넣음) ── */
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const win = (t, a0, a1, b0, b1) => sm((t - a0) / (a1 - a0)) * (1 - sm((t - b0) / (b1 - b0))); // a0~a1 에 켜지고 b0~b1 에 꺼짐
const lerpK = (keys, t) => { let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++; const [t0, ...v0] = keys[i], [t1, ...v1] = keys[i + 1], q = sm((t - t0) / (t1 - t0)); return v0.map((v, j) => v + (v1[j] - v) * q); };
// 성호: 오른손이 이마 → 가슴 → 왼쪽 어깨 → 오른쪽 어깨 ([초, 팔 앞각, 팔 옆각])
const CROSS = [[0, -0.3, 0], [0.35, -2.55, -0.95], [0.7, -2.55, -0.95], [1.0, -1.35, -0.95], [1.25, -1.35, -0.95], [1.5, -1.75, -1.35], [1.7, -1.75, -1.35], [1.95, -1.75, -0.35], [2.15, -1.75, -0.35], [2.4, -0.3, 0]];
function actPose(k, u, seat, font) {
  const P = { l: 0, r: 0, lz: 0.06, rz: 0, az: 0, drop: 0, legX: null, bx: 0, hx: 0, sway: 0, sit: false, mouth: 0 };
  const palms = (q = 1) => { P.l = P.r = -1.35 * q; P.lz = 0.85 * q; P.rz = -0.85 * q; P.az = 0.14 * q; }; // 두 손 모아 가슴 앞
  const kneel = (q) => { P.drop = 0.28 * q; P.legX = 1.25 * q; };
  if (k === 'bow') { // 합장 → 무릎 꿇기 → 이마를 바닥에 → 일어남 (2.6초)
    const kn = win(u, 0.35, 0.8, 2.0, 2.5), dn = win(u, 0.85, 1.3, 1.6, 2.0);
    palms(1 - dn * 0.4); P.l = P.r = -1.35 - dn * 1.05; kneel(kn); P.bx = dn * 1.05; P.hx = 0.15 + dn * 0.15;
  } else if (k === 'palms' || k === 'pray' || k === 'confess') {
    palms(); P.hx = 0.22;
    if (k === 'pray' && !seat) kneel(sm(u / 0.6)); // 서서 하면 무릎 꿇고
    if (k === 'confess') { P.l = P.r = -0.95; P.hx = 0.45; }
  } else if (k === 'beads' || k === 'rosary') { P.l = -0.95; P.r = -0.95 + Math.sin(u * 7) * 0.12; P.lz = 0.6; P.rz = -0.6; P.az = 0.1; P.hx = 0.25; } // 손 앞에서 알 굴리기
  else if (k === 'bell') { // 당목 줄을 잡고 뒤로 당겼다가 앞으로 쿵
    const back = win(u, 0, 0.5, 0.5, 0.65), hit = win(u, 0.5, 0.65, 1.2, 1.7);
    P.l = P.r = -1.45 + back * 0.55 - hit * 0.2; P.lz = 0.3; P.rz = -0.3; P.bx = -0.14 * back + 0.16 * hit;
  } else if (k === 'candle') { const rch = win(u, 0, 0.4, 1.4, 1.8); P.bx = 0.2 * rch; P.r = -1.7 * rch; P.l = -0.4 * rch; if (u > 1.6) { palms(sm((u - 1.6) / 0.4)); P.hx = 0.25; } } // 몸을 숙여 팔을 뻗었다가 기도
  else if (k === 'lantern') { const up = win(u, 0, 0.45, 1.1, 1.5); P.l = P.r = -2.1 * up; P.lz = 0.3 * up; P.rz = -0.3 * up; if (u > 1.3) palms(sm((u - 1.3) / 0.4)); }
  else if (k === 'cross') { // 성수대면 성수에 손끝 적시고(0.6초) 성호
    const dip = font ? win(u, 0, 0.25, 0.45, 0.6) : 0, t = font ? u - 0.6 : u * 1.33;
    P.l = -0.3; P.bx = dip * 0.18; [P.r, P.rz] = dip > 0.01 ? [-0.95 * dip, 0] : lerpK(CROSS, Math.max(0, t)); P.hx = 0.12;
  } else if (k === 'sing') { P.l = P.r = -0.8; P.lz = 0.5; P.rz = -0.5; P.az = 0.08; P.sway = Math.sin(u * 2.1) * 0.08; P.hx = -0.08 + Math.sin(u * 4.2) * 0.05; P.mouth = Math.abs(Math.sin(u * 5.2)); }
  else if (k === 'piano') { P.sit = true; P.l = -1.3 + Math.sin(u * 9) * 0.16; P.r = -1.3 + Math.sin(u * 9 + 2.4) * 0.16; P.lz = 0.25; P.rz = -0.25; P.hx = 0.12; } // 앉아서 건반 위로 번갈아
  return P;
}
let veilGeo, veilMat, beadGeo, beadMat, mouthGeo;
function veilMesh() { // 미사포: 얼굴만 열린 반투명 흰 레이스
  if (!veilGeo) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(0, 0, 64, 64); x.globalCompositeOperation = 'destination-out'; // 레이스 구멍: 작은 꽃무늬
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; x.beginPath(); x.arc(8 + i * 16 + Math.cos(a) * 3.2, 8 + j * 16 + Math.sin(a) * 3.2, 1.6, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 4); t.colorSpace = THREE.SRGBColorSpace;
    veilGeo = new THREE.SphereGeometry(0.54, 20, 12, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, 2.05);
    veilMat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: grad, map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  }
  const m = new THREE.Mesh(veilGeo, veilMat); m.position.set(0, 0.04, -0.02); m.scale.set(1, 1.08, 1); return m;
}
function beadsMesh() { // 손에 쥔 구슬 줄 (작은 구슬 14개를 한 덩어리로)
  if (!beadGeo) {
    beadGeo = mergeGeometries(Array.from({ length: 14 }, (_, i) => { const t = (i / 14) * Math.PI * 2; return new THREE.SphereGeometry(i % 7 ? 0.022 : 0.03, 6, 4).translate(Math.cos(t) * 0.1, Math.sin(t) * 0.13 - 0.1, 0); }));
    beadMat = toon('#7a4a2e');
  }
  const m = new THREE.Mesh(beadGeo, beadMat); m.position.set(0, -0.3, 0.05); return m;
}

// 불꽃 스틱 (fireworks.js 가 a.stick = 1, a.stickAim = 그리는 점 [x, y, z](세상 좌표) 또는 null 을 매 프레임 넣음)
// 오른손(arms[1])에 가는 막대 + 끝 불씨. 그리는 동안 팔이 그 점을 가리키고 몸통도 그쪽으로 살짝 돌림, 손을 떼면 앞으로 살짝 든 채
let stickGeo, stickMat, tipGeo, tipMat;
function stickMesh() {
  if (!stickGeo) {
    stickGeo = mergeGeometries([new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6).translate(0, -0.33, 0), new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5).translate(0, -0.7, 0)]); // 손잡이 + 철사
    stickMat = toon('#8d8a86'); tipGeo = new THREE.SphereGeometry(0.03, 6, 4); tipMat = new THREE.MeshBasicMaterial({ color: '#fff1c4' });
  }
  const g = new THREE.Group(), tip = new THREE.Mesh(tipGeo, tipMat);
  g.add(new THREE.Mesh(stickGeo, stickMat)); tip.position.y = -1.0; g.add(tip); g.position.z = 0.04; g.tip = tip;
  return g;
}
const clampN = (v, a) => Math.max(-a, Math.min(a, v));
function stickPose(a) { // 팔 앞각 r·옆각 rz (팔은 아래(-y)로 뻗은 것을 Z 다음 X 로 돌림)·몸통 돌림 by
  if (!a.stickAim) return { r: -0.8, rz: 0.12, by: 0 };
  const ry = a.root.rotation.y, c = Math.cos(ry), s = Math.sin(ry), [tx, ty, tz] = a.stickAim;
  const wx = tx - a.root.position.x, wz = tz - a.root.position.z, wy = ty - (a.root.position.y + 0.78);
  let lx = wx * c - wz * s, lz = wx * s + wz * c; // 세상 → 아바타 (앞 = +z)
  const by = clampN(Math.atan2(lx, lz) * 0.35, 0.4), cb = Math.cos(by), sb = Math.sin(by);
  [lx, lz] = [lx * cb - lz * sb - 0.33, lx * sb + lz * cb]; // 몸통 기준, 어깨(x 0.33)에서
  const wy2 = wy * 1.5 + 0.9, L = Math.hypot(lx, wy2, lz) || 1, dx = lx / L, dy = wy2 / L, dz = Math.max(0.15, lz / L); // 위아래는 조금 크게(팔이 짧고 머리가 커서 그대로면 거의 안 움직여 보임)
  return { r: Math.atan2(-dz, -dy), rz: Math.asin(clampN(dx, 0.9)), by };
}

// 매 프레임: 걷기/가만히/타자/커피/앉기/손 흔들기 동작. seat = 앉은 자리({kind,h}) 또는 null
export function animate(a, dt, walking, status, seat) {
  const k = 1 - Math.exp(-dt * 14), kind = ['slot', 'poker', 'bj'].includes(seat?.kind) ? 'office' : seat?.kind; // 카지노 자리는 모니터 보듯 앞으로 손을 모음
  walking = walking && !seat;
  const P = a.act && !walking ? actPose(a.act, a.actT || 0, seat, a.actFont) : null;
  if (P?.sit) seat = { kind: 'piano', h: 0.45 }; // 피아노 의자에 앉은 것처럼
  a.t = (a.t || 0) + dt;
  a.phase += dt * (walking ? 11 : 2.2);
  const sw = walking ? Math.sin(a.phase) : 0;
  const bob = walking ? Math.abs(Math.sin(a.phase)) * 0.07 : Math.sin(a.phase) * 0.012;
  const ease = (o, key, v) => (o[key] += (v - o[key]) * k);
  a.lift = (a.lift || 0) + ((seat ? seat.h - 0.32 : -(P?.drop || 0)) - (a.lift || 0)) * k; // 앉으면 엉덩이가 앉는 면 높이로
  a.root.position.y = a.lift + (a.jy || 0) + (a.gy || 0); // jy = 점프로 뜬 높이, gy = 서 있는 층의 높이
  const air = !seat && (a.jy || 0) > 0.05;
  ease(a.body.position, 'y', bob);
  ease(a.body.rotation, 'z', walking ? Math.sin(a.phase) * 0.06 : P?.sway || 0);

  // 다리: 앉으면 앞으로 쭉, 공원에선 살랑살랑
  const legSwing = kind === 'park' ? Math.sin(a.t * 1.6) * 0.12 : 0;
  const ride = kind === 'hold'; // 회전목마: 동물 등에 걸터앉아 다리를 양옆으로
  ease(a.legs[0].rotation, 'x', ride ? -0.55 : seat ? -1.45 + legSwing : air ? -0.5 : sw * 0.8);
  ease(a.legs[1].rotation, 'x', ride ? -0.55 : seat ? -1.45 - legSwing : air ? 0.3 : -sw * 0.8);
  a.legs.forEach((lg, i) => ease(lg.rotation, 'z', ride ? (i ? 0.38 : -0.38) : 0));
  if (P?.legX != null && !seat) for (const lg of a.legs) ease(lg.rotation, 'x', P.legX); // 무릎 꿇기

  let l = walking ? -sw * 0.9 : 0, r = walking ? sw * 0.9 : 0, rz = 0, hx = 0, bx = 0;
  if (status === 'working' && !walking) { l = -1.15 + Math.sin(a.phase * 5) * 0.08; r = -1.15 + Math.cos(a.phase * 5) * 0.08; } // 타자 치는 중
  if (status === 'coffee') r = walking ? -1.2 : -1.45; // 컵 든 손
  if (kind === 'cafe') { // 한 모금 홀짝: 5초마다 컵을 입으로
    const c = a.t % 5, sip = c > 3.3 && c < 4.5 ? Math.sin(((c - 3.3) / 1.2) * Math.PI) : 0;
    l = -0.55; r = -1.15 - sip * 0.95; hx = -0.2 * sip;
  } else if (kind === 'office') { // 모니터 보며 타자, 고개 살짝 숙임
    l = -1.2 + Math.sin(a.phase * 6) * 0.09; r = -1.2 + Math.cos(a.phase * 6) * 0.09; hx = 0.2; bx = 0.1;
  } else if (kind === 'hold') { // 회전목마: 두 손으로 앞 기둥을 잡음
    l = r = -1.5; hx = -0.06;
  } else if (kind === 'park') { // 편하게 뒤로 기대어 쉼
    l = r = -0.45; hx = -0.14 + Math.sin(a.t * 0.8) * 0.05; bx = -0.08;
  }
  let lz = 0.06, az = 0;
  if (P) ({ l, r, rz, lz, az, hx, bx } = P);
  let by = 0;
  if (a.stick && !walking) ({ r, rz, by } = stickPose(a));
  if (air) { l = r = -2.6; rz = 0.25; } // 점프: 만세!
  if (a.wave > 0) { a.wave -= dt; r = -2.7; rz = Math.sin(a.phase * 4 + a.wave * 14) * 0.5 + 0.3; }
  ease(a.arms[0].rotation, 'x', l);
  ease(a.arms[1].rotation, 'x', r);
  ease(a.arms[1].rotation, 'z', rz);
  ease(a.arms[0].rotation, 'z', lz);
  for (const am of a.arms) ease(am.position, 'z', az);
  ease(a.head.rotation, 'x', hx);
  ease(a.body.rotation, 'x', bx);
  ease(a.body.rotation, 'y', by);
  if (a.stick && !a.stickM) a.arms[1].add((a.stickM = stickMesh()));
  if (a.stickM) a.stickM.visible = !!a.stick;
  a.cup.visible = (status === 'coffee' || kind === 'cafe') && !P && !a.stick;
  // 소품: 염주·묵주, 미사포, 찬양할 때 벌리는 입 (처음 쓸 때 만듦)
  const holdBeads = P && (a.act === 'beads' || a.act === 'rosary');
  if (holdBeads && !a.beads) a.arms[1].add((a.beads = beadsMesh()));
  if (a.beads) a.beads.visible = !!holdBeads;
  if (a.veil && !a.veilM) a.head.add((a.veilM = veilMesh()));
  if (a.veilM) a.veilM.visible = !!a.veil;
  if (P?.mouth != null && a.act === 'sing' && !a.mouthM) { mouthGeo ??= new THREE.SphereGeometry(0.06, 10, 8); a.head.add((a.mouthM = new THREE.Mesh(mouthGeo, toon('#8a3348')))); a.mouthM.position.set(0, -0.15, 0.405); }
  if (a.mouthM) { a.mouthM.visible = a.act === 'sing' && !!P; a.mouthM.scale.set(0.9, 0.25 + (P?.mouth || 0) * 0.75, 0.3); }
  a.head.rotation.z = Math.sin(a.phase * 0.5) * (walking ? 0.05 : 0.025);

  a.blink -= dt; // 눈 깜빡 (쉬는 중엔 감고 있음)
  const open = kind === 'park' ? 0.1 : a.blink < 0.12 ? 0.1 : 1;
  if (a.blink < 0) a.blink = 2 + Math.random() * 3;
  for (const e of a.eyes) e.scale.y += (open - e.scale.y) * 0.6;
}
