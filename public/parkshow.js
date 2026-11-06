// 포근 놀이공원 불꽃놀이 (3D): 정문 뒤 하늘에서 3분 대본(showscript.js)대로 쏘아 올리고 터뜨림. 다리 위(동쪽)에서 서쪽 정문을 올려다보게 모양 불꽃은 (옆 z · 높이 y) 판 위에 그림
// 입자는 camp 불꽃놀이와 같은 빛 점(glowPoints, 가산·블룸) 한 묶음. 터질 때마다 점광원 하나가 그 색으로 다리·정문을 비추고 호수는 그 색으로 번쩍임(U.flash)
// 쇼 시계 t(초) 는 밖에서 넘겨 줌 (서버가 알려 준 시작 시각 기준) → 모두 같은 순간에 같은 불꽃. 소리·모션은 hooks 로 알림 (showaudio.js)
import * as THREE from 'three';
import { glowPoints, pointScale } from './camp-site.js';
import { SHOW_EVENTS, FLY } from './showscript.js';
import { PARK_GATE } from './parkdata.js';
import { U } from './gfx.js';

const K = 0.15, TWO_PI = Math.PI * 2; // 시안 px/s → m/s (다리에서 올려다보면 작게 보여 시안보다 크게)
const rr = (a, b) => a + Math.random() * (b - a);
const HSL = (h, l = 0.62, k = 2.2) => { const c = new THREE.Color().setHSL(((h % 1) + 1) % 1, 0.92, l); return [c.r * k, c.g * k, c.b * k]; };
const GOLD = [2.5, 1.95, 1.05], WHITE = [2.5, 2.4, 2.1];

export function createParkShow({ scene, camera, renderer, Q, hooks = {} }) {
  const qk = Q.level === 'high' ? 1 : Q.level === 'normal' ? 0.7 : 0.42; // 품질별 입자 수
  const N = Math.round(9000 * qk);
  const P = glowPoints(N); P.pts.name = 'park-show'; P.pts.renderOrder = 4; scene.add(P.pts);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), base = new Float32Array(N * 3), sz = new Float32Array(N);
  const grav = new Float32Array(N), drag = new Float32Array(N), flag = new Uint8Array(N); // flag: 1 = 반짝(꺼질 때 깜빡), 2 = 터지면 네 갈래로 갈라짐
  let ip = 0, alive = 0, evi = 0, lastT = -1e9;
  let SC = 1; // 불꽃 크기 배율 (영상 촬영에서 세로 화면에 크게 담을 때)
  const rockets = [], ems = [], flashes = [];
  const light = new THREE.PointLight('#ffffff', 0, 320, 0); // 가장 센 터짐 하나의 빛 (쇼 시작 즈음에 씬에 넣고 끝나면 뺌: 켜고 끌 때 재질이 다시 컴파일되므로 쇼 중엔 가만히)
  let lightOn = false;

  function spark(x, y, z, vx, vy, vz, l, col, size, g = 16, d = 0.985, f = 0) {
    const i = ip; ip = ip + 1 >= N ? 0 : ip + 1; const j = i * 3;
    P.pos[j] = x; P.pos[j + 1] = y; P.pos[j + 2] = z; vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz;
    life[i] = max[i] = l; sz[i] = size; base[j] = col[0]; base[j + 1] = col[1]; base[j + 2] = col[2]; grav[i] = g; drag[i] = d; flag[i] = f;
  }
  const dir = () => { const u = rr(-1, 1), a = rr(0, TWO_PI), r = Math.sqrt(1 - u * u); return [Math.cos(a) * r, u, Math.sin(a) * r]; }; // 구 위의 한 방향 (x 동서, y 위, z 남북)
  // 모양 불꽃은 정문을 보는 판(동쪽에서 본 화면) 위에 그림: 화면 오른쪽 = -z, 위 = +y
  const planar = (x, y, z, px, py, v, l, col, size, g, d) => spark(x, y, z, rr(-0.8, 0.8), -py * v, -px * v, l, col, size, g, d);

  function burst(e, x, y, z) {
    const { type, h, s } = e, c1 = HSL(h, 0.62), c2 = HSL((h + 0.14) % 1, 0.7), n = (a) => Math.max(8, Math.round(a * qk));
    flashes.push({ x, y, z, a: 1, s, c: HSL(h, 0.62, 1) });
    const S = K * s * SC, SZ = 2.3 * (0.8 + s * 0.25) * Math.sqrt(SC); // 점 크기(m): 100m 넘게 떨어진 다리에서 보이게 크게
    const shape = (pts, c, life, k, g) => pts.forEach(([px, py]) => planar(x, y, z, px, py, k * S * 1, life, c, SZ * 1.15, g, 0.99));
    if (type === 'peony') {
      for (let i = 0; i < n(190); i++) { const [a, b, d] = dir(), v = rr(90, 190) * S; spark(x, y, z, a * v, b * v, d * v, rr(1.4, 2.3), c1, SZ, 16, 0.985); }
      for (let i = 0; i < n(80); i++) { const [a, b, d] = dir(), v = rr(25, 90) * S; spark(x, y, z, a * v, b * v, d * v, rr(1.2, 1.9), c2, SZ, 14, 0.985); }
      for (let i = 0; i < n(18); i++) { const [a, b, d] = dir(), v = rr(10, 40) * K; spark(x, y, z, a * v, b * v, d * v, 0.6, WHITE, SZ * 1.4, 0, 0.985); }
    } else if (type === 'rainbow') for (let i = 0; i < n(230); i++) { const [a, b, d] = dir(), v = rr(70, 190) * S; spark(x, y, z, a * v, b * v, d * v, rr(1.5, 2.4), HSL(h + Math.atan2(d, b) / TWO_PI), SZ, 14, 0.985); }
    else if (type === 'willow') for (let i = 0; i < n(160); i++) { const [a, b, d] = dir(), v = rr(55, 150) * S; spark(x, y, z, a * v, b * v, d * v, rr(2.8, 4.2), i % 4 ? GOLD : WHITE, SZ * 1.05, 7, 0.975, 1); }
    else if (type === 'palm') for (let k = 0; k < 9; k++) { const az = (k / 9) * TWO_PI + rr(-0.1, 0.1), el = rr(0.1, 0.9); for (let i = 0; i < 16; i++) { const v = (70 + i * 7) * S, a = Math.cos(az) * Math.cos(el), d = Math.sin(az) * Math.cos(el), b = Math.sin(el); spark(x, y, z, a * v, b * v - 3, d * v, rr(1.9, 2.6), i % 5 === 0 ? WHITE : (h === 0.12 ? GOLD : c1), SZ * 1.1, 19, 0.982); } }
    else if (type === 'saturn') {
      for (let i = 0; i < n(110); i++) { const [a, b, d] = dir(), v = rr(0, 70) * S; spark(x, y, z, a * v, b * v * 0.9, d * v, 1.9, c1, SZ, 6, 0.99); }
      for (let i = 0; i < n(110); i++) { const a = (i / n(110)) * TWO_PI, v = 190 * S; spark(x, y, z, Math.sin(a) * v * 0.9, Math.sin(a) * v * 0.28, Math.cos(a) * v, 2.1, c2, SZ * 1.1, 5, 0.99); } // 비스듬한 고리
    } else if (type === 'spiral') for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 44; i++) { const a = arm * 2.0944 + i * 0.17, v = (14 + i * 3.9) * S; planar(x, y, z, Math.cos(a), Math.sin(a), v, 2, HSL(h + i / 90), SZ * 1.1, 8, 0.988); }
    else if (type === 'ring' || type === 'ring2') for (let r = 0; r < (type === 'ring2' ? 2 : 1); r++) for (let i = 0; i < n(90); i++) { const a = (i / n(90)) * TWO_PI; planar(x, y, z, Math.cos(a), Math.sin(a), (r ? 90 : 155) * S, 1.9, r ? c2 : c1, SZ * 1.15, 11, 0.988); }
    else if (type === 'heart') shape(Array.from({ length: 150 }, (_, i) => { const a = (i / 150) * TWO_PI; return [16 * Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]; }), c1, 2.3, 6 * 0.9, 5);
    else if (type === 'star') shape(Array.from({ length: 150 }, (_, i) => { const kk = (i / 150) * 5, sd = Math.floor(kk), f = kk - sd, a0 = sd * 4 * Math.PI / 5 - Math.PI / 2, a1 = (sd + 1) * 4 * Math.PI / 5 - Math.PI / 2; return [(Math.cos(a0) * (1 - f) + Math.cos(a1) * f) * 25, (Math.sin(a0) * (1 - f) + Math.sin(a1) * f) * 25]; }), c1, 2.2, 5.6 * 0.9, 5);
    else if (type === 'smile') { const pts = [], Y = HSL(0.14, 0.62); for (let i = 0; i < 80; i++) { const a = (i / 80) * TWO_PI; pts.push([Math.cos(a) * 22, Math.sin(a) * 22]); } for (const ex of [-8, 8]) for (let i = 0; i < 10; i++) { const a = (i / 10) * TWO_PI; pts.push([ex + Math.cos(a) * 2.4, -7 + Math.sin(a) * 3.4]); } for (let i = 0; i <= 26; i++) { const a = 0.22 * Math.PI + (i / 26) * 0.56 * Math.PI; pts.push([Math.cos(a) * 13, Math.sin(a) * 13 - 1]); } shape(pts, Y, 2.5, 5.6 * 0.9, 5); }
    else if (type === 'crossette') for (let i = 0; i < 20; i++) { const [a, b, d] = dir(), v = 125 * S; spark(x, y, z, a * v, b * v, d * v, 0.8, c1, SZ * 1.3, 8, 0.985, 2); }
    else if (type === 'giant') {
      for (let i = 0; i < n(460); i++) { const [a, b, d] = dir(), v = rr(40, 330) * S * 0.78; spark(x, y, z, a * v, b * v, d * v, rr(3, 5), i % 3 ? GOLD : WHITE, SZ * 1.1, 7, 0.977, 1); }
      for (let i = 0; i < n(90); i++) { const a = (i / n(90)) * TWO_PI; planar(x, y, z, Math.cos(a), Math.sin(a), 300 * S, 2.4, c1, SZ * 1.3, 6, 0.985); }
      for (let i = 0; i < 14; i++) { const [a, b, d] = dir(), v = 200 * K * s; spark(x, y, z, a * v, b * v, d * v, 1.1, GOLD, SZ * 1.4, 8, 0.985, 2); }
    }
  }

  function fire(e) {
    if (e.kind === 'em') { ems.push({ ...e, t0: e.t }); hooks.onEm?.(e); return; }
    rockets.push({ e, x: e.wx, z: e.wz, y0: 1.5, apex: e.wy, age: 0 }); hooks.onLaunch?.(e);
  }

  /* st: { t: 쇼 시계(초, 쇼가 아니면 null), night } */
  function update(dt, st) {
    P.mat.uniforms.uScale.value = pointScale(camera, renderer);
    const dayK = 1 + (1 - (st.night ?? 1)) * 0.8, t = st.t;
    const live = t != null && t > -2 && t < 200;
    if (live) {
      if (Math.abs(t - lastT) > 1.5 || t < lastT) { // 쇼 중간에 들어오거나 시계가 튀면 지금 이후부터 (지금 진행 중인 지상 분수·하늘 폭포는 이어서)
        evi = 0; ems.length = 0;
        while (evi < SHOW_EVENTS.length && SHOW_EVENTS[evi].lt < t - 0.05) { const e = SHOW_EVENTS[evi++]; if (e.kind === 'em' && e.t <= t && e.t + e.dur > t) ems.push({ ...e, t0: e.t }); }
      }
      while (evi < SHOW_EVENTS.length && SHOW_EVENTS[evi].lt <= t) fire(SHOW_EVENTS[evi++]);
      lastT = t;
    } else { evi = 0; lastT = -1e9; rockets.length = 0; ems.length = 0; }
    // 점광원: 쇼 앞뒤 30초 동안만 씬에 둠
    const want = t != null && t > -30 && t < 215;
    if (want !== lightOn) { lightOn = want; if (want) scene.add(light); else { scene.remove(light); light.intensity = 0; } }
    // 올라가는 불꽃
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.age += dt; const u = Math.min(1, r.age / FLY);
      const y = r.y0 + (r.apex - r.y0) * (1 - (1 - u) * (1 - u));
      for (let k = 0; k < 2; k++) spark(r.x + rr(-0.4, 0.4), y - k * 1.2, r.z + rr(-0.4, 0.4), rr(-1, 1), rr(-6, -2), rr(-1, 1), 0.55, [2.4, 1.7, 0.9], 1.7, 4, 0.98);
      if (u >= 1) { rockets.splice(i, 1); burst(r.e, r.x, r.apex, r.z); hooks.onBurst?.(r.e, r.x, r.apex, r.z); }
    }
    // 지상 분수·하늘 폭포
    for (let i = ems.length - 1; i >= 0; i--) {
      const c = ems[i], uu = (t - c.t0) / c.dur; if (t == null || uu > 1 || uu < 0) { if (t == null || uu > 1) ems.splice(i, 1); continue; }
      const f = Math.max(1, Math.round(dt * 60 * qk));
      if (c.type === 'cascade') for (let k = 0; k < Math.round(12 * f * 0.7); k++) spark(c.wx + rr(-2, 2) * 0, 106 + rr(-3, 3), c.wz + (c.wz2 - c.wz) * Math.random(), rr(-0.6, 0.6), -rr(1, 4), rr(-0.6, 0.6), rr(2.6, 4), GOLD, 2.4, 8, 0.99, 1);
      else { const kk = c.h > 0.4 ? 0.8 : 1; for (let k = 0; k < Math.round(5 * f * 0.8); k++) spark(c.wx + rr(-1, 1), 1, c.wz + rr(-1, 1), rr(-6, 6), rr(25, 38) * kk, rr(-6, 6), rr(0.8, 1.2), k % 3 ? HSL(c.h, 0.7) : WHITE, 2.1, 43, 0.995, 1); }
    }
    // 입자 움직이기
    alive = 0; const born = [];
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { if (P.size[i]) P.size[i] = 0; continue; }
      life[i] -= dt; alive++; const j = i * 3;
      if (life[i] <= 0) { // 십자 분열
        if (flag[i] === 2) for (let a = 0; a < 4; a++) { const ang = a * 1.5708 + 0.6, v = rr(7, 10); born.push([P.pos[j], P.pos[j + 1], P.pos[j + 2], vel[j] * 0.2 + Math.cos(ang) * v, vel[j + 1] * 0.2 + Math.sin(ang) * v, vel[j + 2] * 0.2 + Math.cos(ang + 1) * v * 0.6, base[j], base[j + 1], base[j + 2]]); }
        P.size[i] = 0; continue;
      }
      const dk = Math.pow(drag[i], dt * 60); vel[j] *= dk; vel[j + 1] = vel[j + 1] * dk - grav[i] * dt; vel[j + 2] *= dk;
      P.pos[j] += vel[j] * dt; P.pos[j + 1] += vel[j + 1] * dt; P.pos[j + 2] += vel[j + 2] * dt;
      const u = Math.max(0, life[i] / max[i]);
      let k = u * (u < 0.45 ? 0.55 + 0.45 * Math.random() : 1);
      if (flag[i] === 1 && u < 0.75 && Math.random() < 0.4) k *= 0.2; // 반짝
      k *= dayK;
      P.rgba[i * 4] = base[j] * k; P.rgba[i * 4 + 1] = base[j + 1] * k; P.rgba[i * 4 + 2] = base[j + 2] * k; P.rgba[i * 4 + 3] = 1;
      P.size[i] = sz[i] * (0.55 + 0.6 * u);
    }
    for (const b of born) spark(b[0], b[1], b[2], b[3], b[4], b[5], 1.2, [b[6], b[7], b[8]], 2.0, 9, 0.985, 1);
    P.pts.visible = alive > 0 || born.length > 0; if (alive) P.dirty();
    // 번쩍임: 점광원(다리·정문) + 호수
    let sa = 0, br = 0, bg = 0, bb = 0, bx = PARK_GATE.x, by = 60, bz = PARK_GATE.z, best = 0;
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.a -= dt * 1.6; if (f.a <= 0) { flashes.splice(i, 1); continue; }
      const w = f.a * f.a * Math.min(2.2, f.s); sa += w; br += f.c[0] * w; bg += f.c[1] * w; bb += f.c[2] * w;
      if (w > best) { best = w; bx = f.x; by = f.y * 0.75; bz = f.z; }
    }
    if (lightOn) {
      light.position.set(bx - 10, by, bz); light.color.setRGB(Math.min(1, br / Math.max(0.001, sa) / 2.2), Math.min(1, bg / Math.max(0.001, sa) / 2.2), Math.min(1, bb / Math.max(0.001, sa) / 2.2));
      light.intensity = Math.min(7, sa * 2.4) * (0.5 + 0.5 * (1 - (st.night ?? 1) * 0.0));
    }
    U.flash.value.setRGB(Math.min(1.2, br * 0.16), Math.min(1.2, bg * 0.16), Math.min(1.2, bb * 0.16));
  }
  return { update, setScale: (k) => { SC = k; }, stats: () => ({ alive, N, rockets: rockets.length, ems: ems.length, evi, flashes: flashes.length }), _burst: burst };
}
