// 포근 동물원 데이터 (서버·브라우저·시험이 같이 씀, world.js 가 다시 내보냄). 칸 위치는 ./parkdata.js 의 ZOO_PENS (연결 약속: docs/PARK.md 맨 아래)
// 종마다 울타리 칸 하나: 칸 = 사람이 못 들어가는 동물 공간(ENCLOSURES, 충돌 ZOO_RECTS), 안에 서식지 장애물(바위·나무·물웅덩이 원)
// 동물 움직임은 서버·네트워크 없이 시간만의 결정적 함수 animalPose(동물, ms) → 모든 사람 화면에서 거의 같은 모습
// world.js 를 불러오지 않음 (서로 부르면 초기화 순서가 꼬임). 배열은 world.js 가 그대로 가리키므로 다시 대입하지 말고 채움(push)
import { ZOO_PENS } from './parkdata.js';

export const ZOO_RECTS = []; // 충돌 네모 [x0,z0,x1,z1]: 칸 울타리 = 칸 네모 통째 (사람은 난간 앞에서 막힘)
export const ZOO_CIRCLES = []; // 충돌 원 { x, z, r }: 칸 밖에 세운 것이 없어 비어 있음 (서식지 장애물은 칸 안이라 칸 네모가 막음)
export const ENCLOSURES = []; // 동물 공간 { id, name, icon, species, x0,z0,x1,z1, cx,cz, count, obstacles:[{x,z,r,k}], pond } — test-park.mjs 가 '걸어서 못 들어감' 확인
export const ZOO_ANIMALS = []; // 동물 목록 { id, species, model, pen, seed, scale, baby, mom } (+ 움직임 계획 plan)
export const ANIMALS = ZOO_ANIMALS; // 같은 배열의 다른 이름 (시험·그림에서 짧게)

// 종 설명: 아이콘·마릿수(어른, 새끼는 따로)·몸 반지름(m, 장애물·울타리와 띄우는 거리)·걷는 속도(m/s)·멈춰서 하는 일·쉬는 시간(초)
export const ZOO_SPECIES = {
  giraffe: { icon: '🦒', name: '기린', n: 4, babies: 1, r: 1.3, speed: 0.75, acts: ['graze', 'reach', 'look', 'reach'], rest: [5, 13] },
  lion: { icon: '🦁', name: '사자', n: 5, babies: 0, r: 1.1, speed: 0.7, acts: ['lie', 'yawn', 'lie', 'look'], rest: [8, 24] },
  tiger: { icon: '🐯', name: '호랑이', n: 4, babies: 0, r: 1.1, speed: 0.9, acts: ['sit', 'yawn', 'look', 'lie'], rest: [6, 16] },
  redpanda: { icon: '🐾', name: '레서판다', n: 5, babies: 0, r: 0.6, speed: 0.6, acts: ['sit', 'look', 'graze', 'sit'], rest: [4, 12] },
  zebra: { icon: '🦓', name: '얼룩말', n: 5, babies: 1, r: 1.2, speed: 1.0, acts: ['graze', 'graze', 'look'], rest: [5, 14] },
  hippo: { icon: '🦛', name: '하마', n: 4, babies: 1, r: 1.5, speed: 0.5, acts: ['yawn', 'dive', 'look', 'dive'], rest: [8, 20] },
  ostrich: { icon: '🪶', name: '타조', n: 5, babies: 0, r: 0.8, speed: 1.3, acts: ['peck', 'look', 'peck'], rest: [3, 9] },
  panda: { icon: '🐼', name: '판다', n: 4, babies: 1, r: 1.0, speed: 0.5, acts: ['eat', 'eat', 'lie', 'look'], rest: [10, 26] },
};

// 서식지 장애물 (칸 가운데 기준 u = x 방향 -26..26, v = z 방향 -13..13). k = 그림 종류. 관람 쪽(윗줄은 남쪽 v+, 아랫줄은 양쪽)을 가리지 않게 뒤·옆에
const HAB = {
  giraffe: [[-17, -7, 1.4, 'acacia'], [16, -8, 1.4, 'acacia'], [2, -9, 0.9, 'feeder']],
  lion: [[8, -6, 3.5, 'bigrock'], [-14, -8, 2, 'rock'], [-3, 6, 1.3, 'rock']],
  tiger: [[-12, -4, 4, 'pool'], [12, -7, 2.5, 'rock'], [4, 7, 1.2, 'rock']],
  redpanda: [[-15, -6, 1.8, 'tree'], [2, -7, 1, 'post'], [9, -7, 1, 'post'], [-4, 5, 0.9, 'stump'], [17, 4, 1.2, 'tree']],
  zebra: [[-18, 0, 1.4, 'acacia'], [14, -3, 1.3, 'trough']],
  hippo: [[5, 0, 9, 'pond'], [-17, -6, 1.6, 'rock'], [-15, 7, 1.2, 'rock']],
  ostrich: [[-16, -6, 1.3, 'bush'], [14, 7, 1.2, 'bush'], [5, -7, 1.5, 'rock']],
  panda: [[-19, -8, 2, 'bamboo'], [19, -8, 2, 'bamboo'], [19, 8, 2, 'bamboo'], [6, 3, 2, 'rock']],
};

// 시드 난수 (gfx.js rng 와 같은 식 — gfx 는 three 를 불러서 서버에서 못 씀)
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const segD = (px, pz, ax, az, bx, bz) => { const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1e-9, t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)); return Math.hypot(px - ax - ex * t, pz - az - ez * t); };

for (const p of ZOO_PENS) {
  const S = ZOO_SPECIES[p.id], cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
  const obstacles = HAB[p.id].map(([u, v, r, k]) => ({ x: cx + u, z: cz + v, r, k }));
  ENCLOSURES.push({ id: p.id, name: p.name, icon: S.icon, species: p.id, x0: p.x0, z0: p.z0, x1: p.x1, z1: p.z1, cx, cz, count: S.n + S.babies, obstacles, pond: obstacles.find((o) => o.k === 'pond' || o.k === 'pool') ?? null });
  ZOO_RECTS.push([p.x0, p.z0, p.x1, p.z1]);
}

// ── 움직임 계획: 칸 안 경유점을 차례로 걷고(가감속), 경유점마다 멈춰 종 특성 동작. 경유점·직선 구간은 장애물과 울타리에서 몸 반지름 + 여유만큼 떨어짐
function makePlan(a) {
  const E = ENCLOSURES.find((e) => e.id === a.pen), S = ZOO_SPECIES[a.species], R = rng(a.seed);
  const rad = S.r * a.scale, edge = rad + 0.6, clr = rad + 0.4;
  const obs = E.obstacles.filter((o) => !(a.species === 'hippo' && o.k === 'pond')); // 하마는 연못 안을 걸음 (물속에 몸이 잠김)
  const pond = a.species === 'hippo' ? E.pond : null;
  const okPt = (x, z) => obs.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + clr);
  const okSeg = (ax, az, bx, bz) => obs.every((o) => segD(o.x, o.z, ax, az, bx, bz) > o.r + clr);
  const pick = (i) => { // 하마는 경유점 셋 중 둘이 연못 안
    if (pond && i % 3 !== 2) { const t = R() * Math.PI * 2, rr = Math.sqrt(R()) * (pond.r - rad - 0.8); return [pond.x + Math.cos(t) * rr, pond.z + Math.sin(t) * rr]; }
    const w = (E.x1 - E.x0) / (pond ? 1 : S.n), lo = Math.max(E.x0 + edge, E.x0 + w * ((pond ? 0 : a.idx) - 0.3)), hi = Math.min(E.x1 - edge, E.x0 + w * ((pond ? 0 : a.idx) + 1.3)); // 마리마다 자기 띠(옆 띠와 조금 겹침)를 주로 다녀 서로 덜 겹침 (하마는 연못을 같이 씀)
    return [lo + R() * (hi - lo), E.z0 + edge + R() * (E.z1 - E.z0 - edge * 2)];
  };
  const okTurn = (a, b, c) => { const ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1]; return (ux * vx + uz * vz) / Math.hypot(ux, uz) / Math.hypot(vx, vz) > -0.5; }; // 꺾이는 각 120° 이하 (새끼가 따라 돌 때 휙 돌지 않게)
  const inBox = (x, z) => x > E.x0 + edge && x < E.x1 - edge && z > E.z0 + edge && z < E.z1 - edge;
  for (let tries = 0; tries < 400; tries++) {
    const pts = [];
    for (let i = 0; i < 7; i++) {
      let p = null;
      for (let k = 0; k < 200 && !p; k++) { const [x, z] = pick(i); if (inBox(x, z) && okPt(x, z) && (!pts.length || (Math.hypot(x - pts.at(-1)[0], z - pts.at(-1)[1]) > 4 && okSeg(...pts.at(-1), x, z) && (pts.length < 2 || okTurn(pts.at(-2), pts.at(-1), [x, z]))))) p = [x, z]; }
      if (!p) break; pts.push(p);
    }
    if (pts.length < 7 || !okSeg(...pts.at(-1), ...pts[0]) || !okTurn(pts[5], pts[6], pts[0]) || !okTurn(pts[6], pts[0], pts[1])) continue;
    // 구간: [걷기 출발, 걷기 시간, 쉬기 시간, 동작, 누적 걸음 거리]
    const legs = []; let t = 0, dist = 0;
    for (let i = 0; i < pts.length; i++) {
      const a0 = pts[i], b0 = pts[(i + 1) % pts.length], d = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]), walk = d / S.speed + 1.2; // 가감속 몫 1.2초
      const rest = S.rest[0] + R() * (S.rest[1] - S.rest[0]), inPond = pond && Math.hypot(b0[0] - pond.x, b0[1] - pond.z) < pond.r - 1;
      let act = S.acts[Math.floor(R() * S.acts.length)];
      if (a.species === 'hippo' && !inPond) act = R() < 0.5 ? 'lie' : 'look'; // 땅 위 하마는 엎드리거나 둘러봄
      legs.push({ a: a0, b: b0, d, t0: t, walk, rest, act, dist, ry: Math.atan2(b0[0] - a0[0], b0[1] - a0[1]) });
      t += walk + rest; dist += d;
    }
    return { legs, period: t, phase: R() * t, gait: dist };
  }
  throw new Error(`동물 길을 못 만듦: ${a.id}`);
}

// 마리 목록: 종마다 어른 n 마리(사자는 첫 마리가 갈기 수사자) + 새끼(엄마 = 그 종 첫 어른 중 하나, 엄마 옆을 따라다님)
let seedN = 9001;
for (const E of ENCLOSURES) {
  const S = ZOO_SPECIES[E.species];
  for (let i = 0; i < S.n; i++) ZOO_ANIMALS.push({ id: `${E.species}-${i}`, idx: i, species: E.species, model: E.species === 'lion' && i === 0 ? 'lionM' : E.species, pen: E.id, seed: seedN++ * 7919, scale: [1, 0.94, 1.04, 0.9, 0.97][i % 5] * (E.species === 'lion' && i === 0 ? 1.1 : 1), baby: false, hasBaby: i < S.babies });
  for (let b = 0; b < S.babies; b++) { const mom = `${E.species}-${b}`; ZOO_ANIMALS.push({ id: `${E.species}-baby${b}`, species: E.species, model: E.species, pen: E.id, seed: seedN++ * 7919, scale: E.species === 'giraffe' ? 0.48 : 0.52, baby: true, mom }); }
}
for (const a of ZOO_ANIMALS) if (!a.baby) Object.defineProperty(a, 'plan', { value: makePlan(a) }); // 계획은 안 보이는 속성 (JSON 으로 내보낼 때 빠짐)
const byId = new Map(ZOO_ANIMALS.map((a) => [a.id, a]));

const PI2 = Math.PI * 2, smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerpAng = (a, b, t) => { let d = ((b - a) % PI2 + PI2 * 1.5) % PI2 - Math.PI; return a + d * t; };
// 걷기 거리 (가감속: 처음·끝 0.6초 동안 속도가 0 ↔ 최고)
function walkS(d, dur, t) {
  const ta = 0.6, v = d / (dur - ta);
  if (t < ta) return 0.5 * v * t * t / ta;
  if (t < dur - ta) return v * (t - ta / 2);
  const r = Math.max(0, dur - t); return d - 0.5 * v * r * r / ta;
}

// 시간 tMs(ms, 모두 같은 시계 Date.now() 기준) 의 모습: { x, z, ry, act, k(동작 세기 0~1), walk(걷는 세기 0~1), gait(걸은 거리 m, 다리 흔들기), sink(물에 잠긴 깊이 m) }
// 순수 함수 (같은 입력 = 같은 출력). 위치·방향은 시간에 대해 끊김 없음
export function animalPose(a, tMs) {
  if (typeof a === 'string') a = byId.get(a);
  if (a.baby) { // 새끼: 엄마가 걸은 길을 몇 m 뒤에서 그대로 따라감 (엄마가 서면 같이 서고 같은 동작). 방향은 길 앞뒤 점으로 부드럽게
    const m = byId.get(a.mom), p = animalPose(m, tMs), D = ZOO_SPECIES[a.species].r * 2 + 0.8, [x, z] = pathAt(m.plan, p.gait - D), [x0, z0] = pathAt(m.plan, p.gait - D - 1.2), [x1, z1] = pathAt(m.plan, p.gait - D + 1.2);
    return { ...p, x, z, ry: Math.atan2(x1 - x0, z1 - z0), gait: p.gait / a.scale * m.scale * 0.8, sink: sinkAt(a, x, z, p.act, p.k) };
  }
  const P = a.plan, T = (((tMs / 1000 + P.phase) % P.period) + P.period) % P.period;
  let i = 0; while (i < P.legs.length - 1 && P.legs[i + 1].t0 <= T) i++;
  const L = P.legs[i], u = T - L.t0;
  let x, z, ry, act = 'walk', k = 0, walk = 0, gait;
  if (u < L.walk) { // 걷기 (출발 전 0.8초 동안 갈 방향으로 돌아섬 — 쉬기 끝에서 이미 돌아 있음)
    const s = walkS(L.d, L.walk, u), f = s / L.d;
    x = L.a[0] + (L.b[0] - L.a[0]) * f; z = L.a[1] + (L.b[1] - L.a[1]) * f; ry = L.ry;
    walk = Math.min(1, u / 0.6, (L.walk - u) / 0.6); // 속도 / 최고 속도 (walkS 의 가감속과 같음)
    gait = L.dist + s;
    const q = L.walk - u; if (q < 1.2) { act = L.act; k = smooth(1 - q / 1.2) * 0.25; } // 도착 직전부터 동작을 조금씩 시작
  } else { // 쉬기: 동작 세기는 1.2초에 걸쳐 오르고 내림, 끝 1.6초 동안 다음 갈 방향으로 돌아섬
    const r = u - L.walk, next = P.legs[(i + 1) % P.legs.length];
    x = L.b[0]; z = L.b[1]; act = L.act; gait = L.dist + L.d;
    k = Math.min(0.25 + smooth(r / 1.2) * 0.75, smooth((L.rest - r) / 1.4));
    ry = lerpAng(L.ry, next.ry, smooth((r - (L.rest - 1.6)) / 1.6));
  }
  return { x, z, ry, act, k, walk, gait, sink: sinkAt(a, x, z, act, k) };
}
// 물에 잠김: 하마가 연못 안이면 가장자리에서 2.5m 들어올수록 깊게, 잠수하면 눈·귀만
function sinkAt(a, x, z, act, k) {
  if (a.species !== 'hippo') return 0;
  const E = ENCLOSURES.find((e) => e.id === a.pen), P = E.pond, d = Math.hypot(x - P.x, z - P.z), w = smooth((P.r - d) / 2.5);
  return w * a.scale * (0.75 + (act === 'dive' ? 0.45 * k : 0));
}
// 엄마 길(닫힌 경유점 고리)에서 걸음 거리 s 인 점
function pathAt(P, s) {
  s = ((s % P.gait) + P.gait) % P.gait;
  let i = 0; while (i < P.legs.length - 1 && P.legs[i + 1].dist <= s) i++;
  const L = P.legs[i], f = (s - L.dist) / L.d;
  return [L.a[0] + (L.b[0] - L.a[0]) * f, L.a[1] + (L.b[1] - L.a[1]) * f];
}
