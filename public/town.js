// 마을 소품: 장식 집 5채(박공지붕·창·덧문·화분·굴뚝·우편함), 가로등, 벤치, 울타리, 이정표. 재질별로 합쳐 그리기 호출을 줄임
import * as THREE from 'three';
import { BX, BZ, HOUSES, LAMPS, BENCHES, BENCHES2, GATE, CAMP_GATE, VILLAGE_GATE_W, NORTH_GATE } from './world.js';
import { soft, Batch, boxUV, instanced, place, patch, nightGlow, rng, U } from './gfx.js';
import { woodTex, sidingTex, shingleTex, stoneTex, brickTex } from './textures.js';

const CREAM = '#fff7ea', METAL = '#5d4b6a';
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
// 창 유리 uv.x 에 '밤 정도가 얼마일 때 불이 켜지나'를 실어 보냄 → 저녁에 집집마다·창마다 하나둘 켜짐
const LR = rng(5), lit = (g, on) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, on, 0); return g; };

function house(B, h, hi) {
  const on = () => 0.32 + ((hi * 0.37) % 0.3) + LR() * 0.14;
  const { w, d } = h, H = 3.2, hd = d / 2 + 0.55, rh = 2.1, th = Math.atan2(rh, hd), L = Math.hypot(hd, rh) + 0.1;
  const at = (x, y, z) => [h.x + x, y, h.z + z];
  B.add('stone', boxUV(w + 0.24, 0.42, d + 0.24, 1.2), { pos: at(0, 0.21, 0), color: '#efe4d8' });
  B.add('siding', boxUV(w, H - 0.4, d, 1.6), { pos: at(0, 0.4 + (H - 0.4) / 2, 0), color: h.c });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add('plain', new THREE.BoxGeometry(0.2, H - 0.4, 0.2), { pos: at(sx * w / 2, 0.4 + (H - 0.4) / 2, sz * d / 2), color: CREAM });
  B.add('plain', new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), { pos: at(0, H - 0.02, 0), color: CREAM });
  // 박공지붕: 비늘 기와 두 판 + 용마루 + 양옆 삼각 벽(동그란 다락 창)
  for (const s of [1, -1]) B.add('roof', boxUV(w + 1.1, 0.18, L, 1.9), { pos: at(0, H + rh / 2 + 0.06, (s * hd) / 2), rot: [s * th, 0, 0], color: h.r });
  B.add('plain', new THREE.CylinderGeometry(0.13, 0.13, w + 1.2, 10), { pos: at(0, H + rh + 0.1, 0), rot: [0, 0, Math.PI / 2], color: shade(h.r, 0.8) });
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, (rh * (d / 2)) / hd)]);
  for (const s of [1, -1]) {
    const g = new THREE.ShapeGeometry(tri), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 1.6, uv.getY(k) / 1.6); // uv = 좌표(m) 라서 벽 판자 크기에 맞춤
    g.rotateY((s * Math.PI) / 2);
    B.add('siding', g, { pos: at(s * (w / 2 + 0.005), H, 0), color: h.c });
    B.add('plain', new THREE.TorusGeometry(0.3, 0.06, 6, 18), { pos: at(s * (w / 2 + 0.03), H + 0.75, 0), rot: [0, Math.PI / 2, 0], color: CREAM });
    B.add('glass', lit(new THREE.CircleGeometry(0.3, 16), on() + 0.1), { pos: at(s * (w / 2 + 0.02), H + 0.75, 0), rot: [0, (s * Math.PI) / 2, 0], color: '#cfeaff' });
  }
  // 굴뚝
  B.add('brick', boxUV(0.62, rh + 0.5, 0.62, 0.8), { pos: at(w / 4, H + 0.25 + (rh + 0.5) / 2, -0.8), color: '#f3d9cc' });
  B.add('plain', new THREE.BoxGeometry(0.8, 0.14, 0.8), { pos: at(w / 4, H + rh + 0.82, -0.8), color: '#6f5a66' });
  // 현관: 문틀·문(둥근 창)·손잡이·디딤돌·작은 차양
  const fz = d / 2;
  B.add('plain', new THREE.BoxGeometry(1.42, 2.22, 0.1), { pos: at(0, 0.4 + 1.11, fz + 0.02), color: CREAM });
  B.add('wood', boxUV(1.12, 1.98, 0.1, 0.8), { pos: at(0, 0.4 + 0.99, fz + 0.06), color: '#c27f55' });
  B.add('glass', lit(new THREE.CircleGeometry(0.2, 14), on()), { pos: at(0, 1.95, fz + 0.115), color: '#d7efff' });
  B.add('plain', new THREE.SphereGeometry(0.07, 8, 6), { pos: at(0.38, 1.35, fz + 0.14), color: '#ffd45a' });
  B.add('stone', boxUV(1.7, 0.36, 0.7, 1), { pos: at(0, 0.18, fz + 0.4), color: '#e9e0d6' });
  B.add('roof', boxUV(1.9, 0.1, 0.9, 1.2), { pos: at(0, 2.82, fz + 0.42), rot: [0.32, 0, 0], color: h.r });
  for (const sx of [-1, 1]) B.add('plain', new THREE.BoxGeometry(0.07, 0.5, 0.07), { pos: at(sx * 0.82, 2.55, fz + 0.38), rot: [-0.8, 0, 0], color: CREAM });
  // 창문: 틀·유리·십자 창살·덧문·창가 화분 (앞 2개 + 양옆 1개씩)
  const win = (x, z, ry) => {
    const o = new THREE.Object3D(); o.position.set(...at(x, 1.85, z)); o.rotation.y = ry; o.updateMatrix();
    const put = (key, geo, lp, color, rot) => { place(geo, { pos: lp, rot }); geo.applyMatrix4(o.matrix); B.add(key, geo, { color }); };
    put('plain', new THREE.BoxGeometry(1.24, 1.24, 0.1), [0, 0, 0.03], CREAM);
    put('glass', lit(new THREE.BoxGeometry(1.0, 1.0, 0.06), on()), [0, 0, 0.07], '#c6e8ff');
    put('plain', new THREE.BoxGeometry(0.07, 1.0, 0.05), [0, 0, 0.11], CREAM);
    put('plain', new THREE.BoxGeometry(1.0, 0.07, 0.05), [0, 0, 0.11], CREAM);
    for (const sx of [-1, 1]) put('wood', boxUV(0.44, 1.18, 0.06, 0.6), [sx * 0.88, 0, 0.06], shade(h.r, 1.05), [0, sx * 0.18, 0]);
    put('wood', boxUV(1.3, 0.24, 0.3, 0.6), [0, -0.72, 0.2], '#c98f5b');
    for (let i = 0; i < 6; i++) put('plain', new THREE.IcosahedronGeometry(0.1, 0), [-0.5 + i * 0.2, -0.55 + (i % 2) * 0.05, 0.22], ['#ff8fb1', '#ffffff', '#ffd84a', '#ff8fb1', '#c9a8ff', '#ffffff'][i]);
    for (let i = 0; i < 4; i++) put('plain', new THREE.IcosahedronGeometry(0.1, 0), [-0.45 + i * 0.3, -0.6, 0.14], '#7ccf6b');
  };
  for (const sx of [-1, 1]) if (w / 2 - 1.35 > 1.0) win(sx * (w / 2 - 1.45), fz, 0);
  win(w / 2, 0, Math.PI / 2); win(-w / 2, 0, -Math.PI / 2);
  // 우편함 (길가)
  B.add('wood', boxUV(0.1, 1.0, 0.1, 0.6), { pos: at(1.75, 0.5, fz + 1.7), color: '#b07a52' });
  B.add('plain', new THREE.CylinderGeometry(0.17, 0.17, 0.5, 12, 1, false, 0, Math.PI), { pos: at(1.75, 1.08, fz + 1.7), rot: [Math.PI / 2, 0, Math.PI / 2], color: h.r });
  B.add('plain', new THREE.BoxGeometry(0.34, 0.18, 0.5), { pos: at(1.75, 1.0, fz + 1.7), color: h.r });
  B.add('plain', new THREE.BoxGeometry(0.03, 0.22, 0.12), { pos: at(1.93, 1.18, fz + 1.62), color: '#ff5a5a' });
  return [h.x + w / 4, H + rh + 0.95, h.z - 0.8]; // 굴뚝 연기 나오는 곳
}

function lamp(B, l, i) {
  const at = (y) => [l.x, y, l.z];
  B.add('metal', new THREE.LatheGeometry([[0, 0], [0.25, 0], [0.25, 0.1], [0.17, 0.2], [0.11, 0.46], [0.08, 0.58], [0, 0.58]].map(([r, y]) => new THREE.Vector2(r, y)), 14), { pos: at(0), color: METAL });
  B.add('metal', new THREE.CylinderGeometry(0.055, 0.065, 2.1, 10), { pos: at(1.6), color: METAL });
  B.add('metal', new THREE.TorusGeometry(0.08, 0.025, 6, 12), { pos: at(1.25), rot: [Math.PI / 2, 0, 0], color: METAL });
  B.add('metal', new THREE.CylinderGeometry(0.2, 0.14, 0.08, 4), { pos: at(2.66), rot: [0, Math.PI / 4, 0], color: METAL });
  B.add('glow', new THREE.BoxGeometry(0.3, 0.42, 0.3), { pos: at(2.9), color: '#fff3c4' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add('metal', new THREE.BoxGeometry(0.04, 0.44, 0.04), { pos: [l.x + sx * 0.15, 2.9, l.z + sz * 0.15], color: METAL });
  B.add('metal', new THREE.ConeGeometry(0.3, 0.28, 4), { pos: at(3.25), rot: [0, Math.PI / 4, 0], color: METAL });
  B.add('metal', new THREE.SphereGeometry(0.06, 8, 6), { pos: at(3.43), color: '#ffd45a' });
  if (i % 2) { // 걸이 꽃바구니
    const a = Math.atan2(l.x, l.z), dx = Math.sin(a) * 0.45, dz = Math.cos(a) * 0.45;
    B.add('metal', new THREE.BoxGeometry(0.03, 0.03, 0.5), { pos: [l.x + dx / 2, 2.35, l.z + dz / 2], rot: [0, a, 0], color: METAL });
    B.add('wood', new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), { pos: [l.x + dx, 2.1, l.z + dz], color: '#b98454' });
    for (let k = 0; k < 7; k++) { const t = (k / 7) * Math.PI * 2; B.add('plain', new THREE.IcosahedronGeometry(0.06, 0), { pos: [l.x + dx + Math.sin(t) * 0.11, 2.13 + (k % 2) * 0.04, l.z + dz + Math.cos(t) * 0.11], color: ['#ff8fb1', '#ffffff', '#ffd84a', '#c9a8ff'][k % 4] }); }
  }
}

function bench(B, b) {
  const o = new THREE.Object3D(); o.position.set(b.x, 0, b.z); o.rotation.y = b.ry; o.updateMatrix();
  const put = (key, geo, pos, color, rot) => { place(geo, { pos, rot }); geo.applyMatrix4(o.matrix); B.add(key, geo, { color }); };
  for (const z of [-0.2, 0, 0.2]) put('wood', boxUV(1.9, 0.07, 0.17, 0.8), [0, 0.52, z], '#d9a066');
  for (const y of [0.78, 0.98]) put('wood', boxUV(1.9, 0.15, 0.06, 0.8), [0, y, -0.31], '#d9a066', [-0.12, 0, 0]);
  for (const sx of [-0.84, 0.84]) {
    put('metal', new THREE.BoxGeometry(0.07, 0.5, 0.07), [sx, 0.25, 0.22], METAL);
    put('metal', new THREE.BoxGeometry(0.07, 1.1, 0.07), [sx, 0.55, -0.3], METAL, [-0.1, 0, 0]);
    put('metal', new THREE.BoxGeometry(0.07, 0.06, 0.56), [sx, 0.48, -0.02], METAL);
    put('metal', new THREE.BoxGeometry(0.07, 0.06, 0.6), [sx, 0.74, 0.0], METAL);
    put('metal', new THREE.TorusGeometry(0.06, 0.02, 6, 12, Math.PI * 1.5), [sx, 0.7, 0.3], METAL, [0, Math.PI / 2, 0]);
  }
}

// 이정표: 광장 옆 나무 기둥에 화살표 판 3개 (글씨는 캔버스)
function signpost(scene, B) {
  const x0 = 10.6, z0 = 3.0;
  B.add('wood', boxUV(0.14, 2.4, 0.14, 0.6), { pos: [x0, 1.2, z0], color: '#b07a52' });
  const c = document.createElement('canvas'); c.width = 256; c.height = 192;
  const g = c.getContext('2d'), rows = [['☕ 카페', '#e0735c'], ['🦆 연못', '#4fa6d8'], ['🏡 마을집', '#6fbf62']];
  rows.forEach(([t, col], i) => { g.fillStyle = col; g.beginPath(); g.roundRect(6, i * 64 + 6, 244, 52, 14); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 32px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 128, i * 64 + 33); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const dirs = [Math.atan2(-14 - x0, -4 - z0), Math.atan2(22 - x0, 21 - z0), Math.atan2(0 - x0, -20 - z0)];
  rows.forEach((_, i) => {
    const geo = new THREE.PlaneGeometry(1.1, 0.24), uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / 3);
    const m = new THREE.Mesh(geo, nightGlow(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), 1, 0.45, 0.5)); // 조명 없는 판이라 밤엔 직접 어둡게
    m.position.set(x0 + Math.sin(dirs[i]) * 0.5, 2.15 - i * 0.32, z0 + Math.cos(dirs[i]) * 0.5); m.rotation.y = dirs[i] - Math.PI / 2;
    scene.add(m);
  });
}

export function createTown(scene) {
  const B = new Batch();
  const chimneys = HOUSES.map((h, i) => house(B, h, i));
  LAMPS.forEach((l, i) => lamp(B, l, i));
  [...BENCHES, ...BENCHES2].forEach((b) => bench(B, b));
  signpost(scene, B);
  // 울타리 난간 (기둥은 아래 인스턴싱)
  const g0 = GATE.z - GATE.hw, g1 = GATE.z + GATE.hw; // 동쪽 대문(사찰 숲길)은 비움
  const w0 = VILLAGE_GATE_W.z - VILLAGE_GATE_W.hw, w1 = VILLAGE_GATE_W.z + VILLAGE_GATE_W.hw;
  for (const y of [0.42, 0.85]) {
    const c0 = CAMP_GATE.x - CAMP_GATE.hw, c1 = CAMP_GATE.x + CAMP_GATE.hw; // 남쪽 대문(불멍 캠프 숲길)도 비움
    for (const [x, z, len, rx] of [[(NORTH_GATE.x + NORTH_GATE.hw - BX) / 2, -BZ, BX - NORTH_GATE.hw - NORTH_GATE.x, 0], [(NORTH_GATE.x - NORTH_GATE.hw + BX) / 2, -BZ, BX - NORTH_GATE.hw + NORTH_GATE.x, 0], [(c1 + BX) / 2, BZ, BX - c1, 0], [(-BX + c0) / 2, BZ, c0 + BX, 0]]) B.add('wood', boxUV(len, 0.12, 0.07, 1.5), { pos: [x, y, z], rot: [0, rx * Math.PI / 2, 0], color: '#fff3e2' });
    for (const [a, b] of [[-BZ, g0], [g1, BZ]]) B.add('wood', boxUV(b - a, 0.12, 0.07, 1.5), { pos: [BX, y, (a + b) / 2], rot: [0, Math.PI / 2, 0], color: '#fff3e2' });
    for (const [a, b] of [[-BZ, w0], [w1, BZ]]) B.add('wood', boxUV(b - a, 0.12, 0.07, 1.5), { pos: [-BX, y, (a + b) / 2], rot: [0, Math.PI / 2, 0], color: '#fff3e2' }); // 서쪽 대문(놀이공원 길)도 비움
  }
  const meshes = B.build(scene, {
    plain: soft('#ffffff', { vertexColors: true }),
    wood: soft('#ffffff', { vertexColors: true, map: woodTex() }),
    siding: soft('#ffffff', { vertexColors: true, map: sidingTex() }),
    roof: soft('#ffffff', { vertexColors: true, map: shingleTex() }),
    stone: soft('#ffffff', { vertexColors: true, map: stoneTex() }),
    brick: soft('#ffffff', { vertexColors: true, map: brickTex() }),
    metal: soft('#ffffff', { vertexColors: true }),
    glass: patch(soft('#ffffff', { vertexColors: true, emissive: new THREE.Color('#fff2d6'), emissiveIntensity: 0.18 }), {
      key: 'houseGlass', uniforms: { uNight: U.night },
      vert: { head: 'varying float vOn;', begin_vertex: 'vOn = uv.x;' },
      frag: { head: 'uniform float uNight; varying float vOn;', emissivemap_fragment: 'totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(2.4, 1.5, 0.62), smoothstep(vOn, vOn + 0.06, uNight));' },
    }),
    glow: nightGlow(soft('#ffffff', { vertexColors: true, emissive: new THREE.Color('#ffcf6e'), emissiveIntensity: 1.8 }), 0.55, 2.6, 0.25), // 블룸이 잡는 등불: 낮엔 은은, 해 지면 먼저 켜짐
  }, { noCast: ['glass', 'glow', 'plain'] }); // 잔장식(창가 꽃·테두리)은 그림자 생략
  // 울타리 기둥: 둥근 머리
  const post = new Batch().add('p', boxUV(0.2, 1.1, 0.2, 0.6), { pos: [0, 0.55, 0], color: '#fff6e6' }).add('p', new THREE.SphereGeometry(0.14, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), { pos: [0, 1.1, 0], color: '#fff6e6' }).geometry('p');
  const posts = [];
  for (let s = -BX; s <= BX + 0.01; s += 4) { if (Math.abs(s - NORTH_GATE.x) > NORTH_GATE.hw) posts.push({ x: s, z: -BZ }); if (Math.abs(s - CAMP_GATE.x) > CAMP_GATE.hw) posts.push({ x: s, z: BZ }); }
  for (let s = -BZ; s <= BZ + 0.01; s += BZ / 16) { if (s < w0 - 0.1 || s > w1 + 0.1) posts.push({ x: -BX, z: s }); if (s < g0 - 0.1 || s > g1 + 0.1) posts.push({ x: BX, z: s }); }
  instanced(scene, post, soft('#ffffff', { vertexColors: true, map: woodTex() }), posts, { cast: true });
  return { chimneys, meshes };
}
