// 포근 놀이공원 설계도 (서버·브라우저·시험이 같이 씀, world.js 가 다시 내보냄). 숫자의 근거는 docs/PARK.md
// 마을 서쪽 대문 → 굽이진 벚꽃길(약 110m) → 웅장한 정문 → 입구 광장 → 중앙 대로(끝에 대관람차) / 북쪽 동물원 · 남쪽 놀이기구 구역 · 둘레 꼬마기차
// world.js 를 불러오지 않음(서로 부르면 초기화 순서가 꼬임) → 울타리 위치 120 은 world.js 의 BX 와 같은 값
const BX = 120;
export const PARK = { x0: -532, x1: -232, z0: -144, z1: 96 }; // 300 × 240 = 72,000㎡ (마을의 약 3.4배)
export const VILLAGE_GATE_W = { x: -BX, z: -34, hw: 4.5 }; // 마을 서쪽 울타리 대문 (동쪽 GATE 와 대칭, 성당 북쪽)
export const PARK_GATE = { x: -232, z: -34, hw: 15 }; // 놀이공원 정문 (부지 동쪽 울타리, 열린 폭 30m · 양옆 쌍둥이 탑)
// 정문 게이트 문: 닫히면 열린 폭(양 탑 사이 30m) 전체가 벽이 됨. 서버·화면이 각자 setGateClosed 로 같은 때에 바꿈 (충돌 목록 GATE_WALL 이 비거나 하나 찬 것)
export const GATE_WALL = [];
export const setGateClosed = (c) => { GATE_WALL.length = 0; if (c) GATE_WALL.push([PARK_GATE.x - 1, PARK_GATE.z - PARK_GATE.hw - 0.4, PARK_GATE.x + 1, PARK_GATE.z + PARK_GATE.hw + 0.4]); };
export const gateClosed = () => GATE_WALL.length > 0;
// 닫혀 있을 때 한 걸음(이전 → 새 위치)이 문을 가로지르는지 (서버가 큰 걸음·뒤처진 화면이 벽을 건너뛰는 걸 막음)
export function crossesGate(x0, z0, x1, z1) {
  if (!GATE_WALL.length || (x0 > PARK_GATE.x) === (x1 > PARK_GATE.x)) return false;
  const t = (PARK_GATE.x - x0) / (x1 - x0), z = z0 + (z1 - z0) * t;
  return Math.abs(z - PARK_GATE.z) <= PARK_GATE.hw + 0.4;
}
export const GATE_TOWERS = [-1, 1].map((s) => ({ x: PARK_GATE.x, z: PARK_GATE.z + s * 19.4, r: 4.4 })); // 탑 안쪽 끝 = 정문 가장자리(±15)
export const PROMENADE = { x0: -500, x1: -268, z: -34, hw: 9 }; // 중앙 대로 (서쪽 끝은 대관람차 승강장)
export const ENTRY_PLAZA = { x0: -268, x1: -232, z0: -74, z1: 6 }; // 입구 광장
export const PLAZA_FOUNTAIN = { x: -250, z: -34, r: 6 }; // 광장 가운데 별 분수
export const ZOO_ZONE = { x0: -520, x1: -250, z0: -142, z1: -68 };
export const RIDES_ZONE = { x0: -520, x1: -250, z0: -22, z1: 94 };
export const PARK_TOWN_PATH = [[-34, -16.5], [-46, -26], [-62, -35], [-100, -34.5], [-118, -34], [-121, -34]]; // 마을 안 흙길 (집 앞 골목 서쪽 끝 → 서쪽 대문)

// ── 마을 대문 → 정문 길: 부드러운 곡선 (world.js 숲길과 같은 방식: 양 끝 점은 방향만)
function catmull(cp, n = 12) {
  const out = [];
  for (let i = 1; i < cp.length - 2; i++) for (let k = 0; k < n; k++) {
    const [p0, p1, p2, p3] = [cp[i - 1], cp[i], cp[i + 1], cp[i + 2]], t = k / n, t2 = t * t, t3 = t2 * t;
    out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
  }
  out.push(cp[cp.length - 2]);
  return out;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const RCP = [[-108, -34], [-120, -34], [-136, -34], [-156, -30.5], [-178, -37], [-202, -31], [-221, -34], [-232, -34], [-246, -34]];
const rpts = catmull(RCP), racc = [0];
for (let i = 1; i < rpts.length; i++) racc.push(racc[i - 1] + Math.hypot(rpts[i][0] - rpts[i - 1][0], rpts[i][1] - rpts[i - 1][1]));
const RLEN = racc.at(-1);
// ── 호수와 아치 다리: 마을 대문~정문 길 가운데를 호수가 감싸고, 길은 그 위로 둥글게 솟는 다리가 됨 (정문 앞마당은 호숫가)
// s = 길 시작(마을 대문)부터 거리. 다리는 호수 안쪽에서 땅에 닿고, 가운데는 폭이 넓어져 불꽃놀이를 보는 전망 광장이 됨
export const LAKE = { s0: 17, s1: RLEN - 24, w: 30, y: -0.45 }; // 호수 가운데 반쪽 폭 최대 30m(길 기준), 수면 높이 -0.45
export const BRIDGE = { s0: 8, s1: RLEN - 16, H: 6.5 }; // 다리 놓인 구간(호수보다 양쪽 8~9m 길게: 땅에서 오르막으로 시작)과 가운데 높이(땅에서 6.5m)
const BMID = (BRIDGE.s0 + BRIDGE.s1) / 2;
export const bridgeH = (s) => (s <= BRIDGE.s0 || s >= BRIDGE.s1 ? 0 : BRIDGE.H * Math.sin(Math.PI * (s - BRIDGE.s0) / (BRIDGE.s1 - BRIDGE.s0))); // 걷는 바닥 높이
const plazaBump = (s) => smooth(BMID - 22, BMID - 9, s) * (1 - smooth(BMID + 9, BMID + 22, s)); // 다리 가운데 전망 광장 (폭 +4)
// pts = 가운데 선 [x,z], s = 마을 대문부터 걸은 거리, hw = 반쪽 폭 (5, 다리 가운데 9, 정문 앞 22m 동안 14 까지 넓어져 정문 앞마당이 됨)
export const PARK_ROAD = { pts: rpts, s: racc, len: RLEN, hw: racc.map((s) => 5 + 9 * smooth(RLEN - 22, RLEN, s) + 4.0 * plazaBump(s)) };
// 가장 가까운 길 가운데 점: d = 거리, (px,pz), hw = 그 자리 반쪽 폭, s = 대문부터 거리, (tx,tz) = 길 방향
export function parkRoadNear(x, z) {
  let best = { d: Infinity };
  for (let i = 0; i < rpts.length - 1; i++) {
    const [ax, az] = rpts[i], [bx, bz] = rpts[i + 1], ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)), px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) { const l = Math.sqrt(l2); best = { d, px, pz, i, hw: PARK_ROAD.hw[i] + (PARK_ROAD.hw[i + 1] - PARK_ROAD.hw[i]) * t, s: racc[i] + l * t, tx: ex / l, tz: ez / l }; }
  }
  return best;
}
// 호수 가장자리(길 가운데에서 옆으로): 양쪽이 조금 다르게 구불구불, 양 끝은 둥글게 모임
export function lakeEdge(s, side) {
  if (s <= LAKE.s0 || s >= LAKE.s1) return 0;
  const u = (2 * (s - LAKE.s0)) / (LAKE.s1 - LAKE.s0) - 1;
  return LAKE.w * Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.1 * Math.sin(s * 0.19 + side * 2) + 0.06 * Math.sin(s * 0.53 + side));
}
// 호수 가장자리까지 거리 (안이면 음수)
export function lakeD(x, z) {
  const r = parkRoadNear(x, z), side = r.tx * (z - r.pz) - r.tz * (x - r.px) >= 0 ? 1 : -1;
  return r.d - lakeEdge(r.s, side);
}
// 호수 바닥이 땅보다 얼마나 내려가는지 (물가 4m 밖에서 완만하게 내려가 안쪽 8m 에서 가장 깊음)
export function lakeDepth(x, z) { // 호수 양 끝(폭이 0 에 가까운 곳)은 깊이도 0 으로 모여 길 끝이 파이지 않음
  const r = parkRoadNear(x, z), e = lakeEdge(r.s, r.tx * (z - r.pz) - r.tz * (x - r.px) >= 0 ? 1 : -1), d = r.d - e;
  return e <= 0 || d > 4 ? 0 : 2.8 * smooth(4, -8, d) * smooth(0, 4, e);
}
export function parkRoadAt(s) { // 길 시작에서 s 만큼: [x, z, 방향x, 방향z, 반쪽 폭]
  let i = 1; while (i < rpts.length - 1 && racc[i] < s) i++;
  const a = rpts[i - 1], b = rpts[i], l = racc[i] - racc[i - 1], t = Math.max(0, Math.min(1, (s - racc[i - 1]) / l));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l, PARK_ROAD.hw[i - 1] + (PARK_ROAD.hw[i] - PARK_ROAD.hw[i - 1]) * t];
}
// 길가: 가로등(14m 마다 번갈아) · 벚나무(양옆 9m 마다). 걷는 땅 밖이라 충돌 없음
export const ROAD_LAMPS = [], ROAD_TREES = [];
for (let s = 8, i = 0; s < RLEN - 24; s += 14, i++) { const [x, z, tx, tz, hw] = parkRoadAt(s), side = i % 2 ? 1 : -1, p = { x: x - tz * side * (hw + 1.3), z: z + tx * side * (hw + 1.3) }; if (lakeD(p.x, p.z) > 2) ROAD_LAMPS.push(p); } // 호수·다리 위는 다리 난간 가로등(bridge.js)이 맡음
for (let s = 6, i = 0; s < RLEN - 20; s += 9, i++) for (const side of [-1, 1]) { const [x, z, tx, tz, hw] = parkRoadAt(s), o = hw + 3.4 + (i % 3) * 0.6, p = { x: x - tz * side * o, z: z + tx * side * o, s: 1 + ((i * 7 + (side > 0 ? 3 : 0)) % 5) * 0.08 }; if (lakeD(p.x, p.z) > 3) ROAD_TREES.push(p); } // 호수 속엔 나무 없음
for (let s = LAKE.s0 + 3, i = 0; s < LAKE.s1 - 3; s += 5.5, i++) for (const side of [-1, 1]) { // 호숫가 벚나무: 물가 3~5m 밖에 줄지어
  const [x, z, tx, tz] = parkRoadAt(s), o = lakeEdge(s, side) + 3.4 + ((i * 5 + (side > 0 ? 2 : 0)) % 4) * 0.7, p = { x: x - tz * side * o, z: z + tx * side * o, s: 1.05 + ((i * 3 + (side > 0 ? 1 : 0)) % 5) * 0.09 };
  if (lakeD(p.x, p.z) > 2.6 && parkRoadNear(p.x, p.z).d > 9) ROAD_TREES.push(p);
}

// ── 공원 안 길 (장식 + 시험 기준): a→b 곧은 띠, hw = 반쪽 폭. 기구 발자국과 길 사이 4m 이상 (대관람차 승강장만 대로 끝에 붙음)
export const RIDE_SPINE_X = -366, RIDE_LOOP_Z = 27; // 기구 구역 세로 간선길 · 가로 순환길
export const ZOO_AVE_X = -398, ZOO_ROW_Z = -103, ZOO_BAND_Z = -66; // 동물원 들어가는 길 · 두 줄 울타리 사이 길 · 대로 북쪽 띠 길
export const PARK_PATHS = [
  { id: 'promenade', kind: 'promenade', a: [PROMENADE.x1, PROMENADE.z], b: [PROMENADE.x0, PROMENADE.z], hw: PROMENADE.hw },
  { id: 'spine', kind: 'ride', a: [RIDE_SPINE_X, -25], b: [RIDE_SPINE_X, RIDE_LOOP_Z], hw: 4 },
  { id: 'loop', kind: 'ride', a: [-279, RIDE_LOOP_Z], b: [-518, RIDE_LOOP_Z], hw: 4 },
  { id: 'zooAve', kind: 'zoo', a: [ZOO_AVE_X, -43], b: [ZOO_AVE_X, -134], hw: 4 },
  { id: 'zooRow', kind: 'zoo', a: [-279, ZOO_ROW_Z], b: [-517, ZOO_ROW_Z], hw: 4 },
  { id: 'zooW', kind: 'zoo', a: [-460, -72], b: [-460, -134], hw: 4 },
  { id: 'zooE', kind: 'zoo', a: [-336, -72], b: [-336, -134], hw: 4 },
  { id: 'band', kind: 'zoo', a: [-279, ZOO_BAND_Z], b: [-479, ZOO_BAND_Z], hw: 3 },
];
const segD = (x, z, [ax, az], [bx, bz]) => { const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))); return Math.hypot(x - ax - ex * t, z - az - ez * t); };
// 가장 가까운 공원 길: { p (길), d (길 가장자리까지, 안이면 음수) }
export function parkPathNear(x, z, kinds) {
  let best = { d: Infinity, p: null };
  for (const p of PARK_PATHS) { if (kinds && !kinds.includes(p.kind)) continue; const d = segD(x, z, p.a, p.b) - p.hw; if (d < best.d) best = { d, p }; }
  return best;
}

// ── 기구 자리 (2단계 것도 지금 잡음). 가운데 (x,z), 회전 ry(0 = 가로 w 가 x 방향), 발자국 w × d (줄 서는 곳 포함), entry = 길 쪽 입구, stage 1 = 지금 만듦
// 순한 기구(회전목마·찻잔·범퍼카·기차역)는 정문 쪽(동쪽), 센 기구는 서쪽 안쪽. 윗줄은 대로에, 아랫줄은 가로 순환길에 4m 떨어져 닿음
const slot = (id, name, stage, x, z, w, d, entry, o = {}) => ({ id, name, stage, x, z, ry: 0, w, d, entry, ...o });
export const RIDE_SLOTS = {
  ferris: slot('ferris', '대관람차', 1, -496, -34, 24, 64, [-484, -34], { wheel: { r: 28, hub: 31 }, note: '바퀴 면은 z–y (정문에서 정면), 대로 끝이 승강장' }),
  carousel: slot('carousel', '회전목마', 1, -295, -1, 40, 40, [-295, -21]),
  teacups: slot('teacups', '회전 찻잔', 2, -338, -1, 40, 40, [-338, -21]),
  swing: slot('swing', '회전그네', 2, -392, -3, 36, 36, [-392, -21]),
  viking: slot('viking', '바이킹', 2, -429, -5, 32, 32, [-429, -21]),
  drop: slot('drop', '드롭타워', 2, -459, -10, 22, 22, [-459, -21], { h: 50 }),
  bumper: slot('bumper', '범퍼카', 2, -297, 51, 44, 32, [-297, 35]),
  flume: slot('flume', '후룸라이드', 2, -362, 61, 80, 52, [-362, 35]),
  coaster: slot('coaster', '롤러코스터', 2, -455, 61, 100, 52, [-455, 35]),
  train: slot('train', '꼬마기차', 1, -263, -59, 10, 14, [-263, -52], { track: 'TRAIN_PATH', note: '정문역 자리. 선로·역 3곳은 TRAIN_PATH·TRAIN_STATIONS' }),
};
export const slotRect = (s) => { const r = Math.abs(Math.sin(s.ry)) > 0.5, w = r ? s.d : s.w, d = r ? s.w : s.d; return [s.x - w / 2, s.z - d / 2, s.x + w / 2, s.z + d / 2]; };

// ── 꼬마기차: 부지 안쪽을 한 바퀴 도는 닫힌 선로 (모서리 둥근 네모). 걸어서 건널 수 있음(충돌 없음)
const TR = { x0: -527, x1: -270, z0: -139, z1: 91, r: 14 };
const tpts = [];
{
  const { x0, x1, z0, z1, r } = TR, PI = Math.PI;
  const corners = [[x1 - r, z0 + r, -PI / 2], [x1 - r, z1 - r, 0], [x0 + r, z1 - r, PI / 2], [x0 + r, z0 + r, PI]];
  corners.forEach(([cx, cz, a0], ci) => {
    for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * (PI / 2); tpts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
    const [nx, nz, na] = corners[(ci + 1) % 4], ex = [cx + Math.cos(a0 + PI / 2) * r, cz + Math.sin(a0 + PI / 2) * r], sx = [nx + Math.cos(na) * r, nz + Math.sin(na) * r];
    const n = Math.max(1, Math.round(Math.hypot(sx[0] - ex[0], sx[1] - ex[1]) / 8));
    for (let k = 1; k < n; k++) tpts.push([ex[0] + (sx[0] - ex[0]) * (k / n), ex[1] + (sx[1] - ex[1]) * (k / n)]);
  });
}
const tacc = [0];
for (let i = 1; i <= tpts.length; i++) { const a = tpts[i - 1], b = tpts[i % tpts.length]; tacc.push(tacc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
// pts = 선로 가운데 점 (닫힘: 마지막 → 처음), s[i] = pts[i] 까지 거리, len = 한 바퀴 (s 가 늘면 지도(북쪽 -z 가 위)에서 시계 방향: 동쪽 변은 북→남)
export const TRAIN_PATH = { pts: tpts, s: tacc, len: tacc.at(-1), closed: true, box: TR, gauge: 1.2 };
export function trainAt(s) { // 선로 위 s 지점: [x, z, 방향x, 방향z]
  const L = TRAIN_PATH.len; s = ((s % L) + L) % L;
  let i = 1; while (i < tacc.length - 1 && tacc[i] < s) i++;
  const a = tpts[i - 1], b = tpts[i % tpts.length], l = tacc[i] - tacc[i - 1], t = (s - tacc[i - 1]) / l;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l];
}
export function trainNear(x, z) { // 선로에서 가장 가까운 점: { d, s, px, pz }
  let best = { d: Infinity };
  for (let i = 0; i < tpts.length; i++) {
    const a = tpts[i], b = tpts[(i + 1) % tpts.length], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)), px = a[0] + ex * t, pz = a[1] + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, s: tacc[i] + Math.sqrt(l2) * t, px, pz };
  }
  return best;
}
// 역 3곳: 서는 곳(x,z = 선로 위), s = 선로 거리, 승강장 쪽(nx,nz = 선로에서 승강장으로), 역사 발자국 [x0,z0,x1,z1]
const station = (id, name, x, z, nx, nz, rect) => ({ id, name, ...(({ px, pz, s }) => ({ x: px, z: pz, s }))(trainNear(x, z)), nx, nz, rect });
export const TRAIN_STATIONS = [
  station('gate', '정문역', -270, -59, 1, 0, [-268, -66, -258, -52]), // 광장 북쪽 (대로 건널목 바로 북쪽)
  station('zoo', '동물원역', ZOO_AVE_X, -139, 0, 1, [-402, -137, -394, -134]), // 동물원 길 북쪽 끝
  station('rides', '기구역', -527, 12, 1, 0, [-525, 4, -519, 20]), // 기구 구역 서쪽, 가로 순환길 서쪽 끝
];

// ── 동물원: 종마다 울타리 칸 (2줄 × 4칸, 칸 52 × 26m, 칸 사이·줄 사이 길 10m). zoo 에이전트가 이 칸 안에 울타리·동물을 둠
const PEN_X = [-517, -455, -393, -331], PEN_W = 52;
const pen = (id, name, i, z0, z1) => ({ id, name, x0: PEN_X[i], x1: PEN_X[i] + PEN_W, z0, z1 });
export const ZOO_PENS = [
  pen('giraffe', '기린', 0, -134, -108), pen('lion', '사자', 1, -134, -108), pen('tiger', '호랑이', 2, -134, -108), pen('redpanda', '레서판다', 3, -134, -108),
  pen('zebra', '얼룩말', 0, -98, -72), pen('hippo', '하마', 1, -98, -72), pen('ostrich', '타조', 2, -98, -72), pen('panda', '판다', 3, -98, -72),
];
export const ZOO_ARCH = { x: ZOO_AVE_X, z: -46, hw: 5 }; // 동물원 입구 아치 (대로 북쪽 가장자리)

// ── 건물풍 장식 (렌더링·충돌이 같이 씀): 매표소·매점·쉼터·화장실
const box = (k, x, z, w, d, name) => ({ k, x, z, w, d, name });
export const PARK_SHOPS = [
  box('ticket', -247, -64, 8, 5, '매표소'), box('ticket', -247, -4, 8, 5, '매표소'),
  box('snack', -300, -53, 8, 6, '매점'), box('rest', -345, -53, 10, 8, '쉼터'), box('toilet', -430, -53, 8, 6, '화장실'), box('snack', -460, -53, 8, 6, '매점'),
  box('snack', -482, 12, 8, 6, '매점'), box('toilet', -250, 32, 8, 6, '화장실'), box('rest', -250, 62, 10, 8, '쉼터'), box('snack', -250, -104, 8, 6, '매점'),
];
// ── 벤치(앉을 수 있음, ry = 바라보는 방향) · 가로등 · 풍선 수레
const PI = Math.PI, FW = PLAZA_FOUNTAIN;
export const PARK_BENCHES = [
  ...[40, 90, 140, 220, 270, 320].map((deg) => { const a = (deg * PI) / 180, x = FW.x + Math.cos(a) * 12, z = FW.z + Math.sin(a) * 12; return { x, z, ry: Math.atan2(FW.x - x, FW.z - z) }; }), // 분수를 보는 둥근 벤치
  ...[-290, -320, -350, -430, -460].map((x) => ({ x, z: PROMENADE.z - PROMENADE.hw - 1.4, ry: 0 })), // 대로 북쪽 (대로를 봄)
  ...[-317, -352, -411, -444].map((x) => ({ x, z: PROMENADE.z + PROMENADE.hw + 1.4, ry: PI })), // 대로 남쪽 (기구 입구 사이)
];
export const PARK_LAMPS = [
  ...[[-238, -58], [-238, -10], [-260, -10], [-255, -58]].map(([x, z]) => ({ x, z })), // 광장 네 귀 (정문역 자리는 피함)
  ...[-305, -335, -380, -415, -445, -476].map((x) => ({ x, z: PROMENADE.z - PROMENADE.hw - 1.6 })),
  ...[-280, -305, -332, -380, -420, -452, -476].map((x) => ({ x, z: PROMENADE.z + PROMENADE.hw + 1.6 })),
  ...[-300, -340, -420, -470, -500].map((x) => ({ x, z: RIDE_LOOP_Z - 5.4 })), // 가로 순환길
  ...[-300, -360, -430, -490].map((x) => ({ x, z: ZOO_ROW_Z + 5.4 })), // 동물원 줄 사이 길
];
// 구석 숲 (선로 바깥 정문 양옆 귀퉁이: 광장 남·북): 7m 간격 + 정해진 흔들림, 건물 둘레는 비움. 충돌 있음(줄기)
export const PARK_TREES = [];
for (const [z0, z1] of [[12, 90], [-140, -80]]) for (let x = -263; x <= -239; x += 7) for (let z = z0; z <= z1; z += 7) {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, j = h - Math.floor(h), tx = x + (j - 0.5) * 3, tz = z + ((j * 7.3) % 1 - 0.5) * 3;
  if (PARK_SHOPS.some((b) => Math.abs(tx - b.x) < b.w / 2 + 4 && Math.abs(tz - b.z) < b.d / 2 + 4)) continue;
  PARK_TREES.push({ x: tx, z: tz, ty: ['round', 'cherry', 'poplar', 'round'][Math.floor(j * 4)], s: 0.95 + j * 0.4 });
}
export const BALLOON_CARTS = [{ x: -258, z: -50 }, { x: -242, z: -18 }];
// 길 안내 표지판 (렌더링만): 화살표 판 글 + 바라보는 방향
export const PARK_SIGNS = [
  { x: -262, z: -46, ry: PI / 2, rows: [['🎡 대관람차', '#e07a9a'], ['🦒 동물원', '#6aa86b'], ['🎠 놀이기구', '#e0a33a']] },
  { x: ZOO_AVE_X + 6.5, z: -44.6, ry: 0, rows: [['🦒 동물원 ↑', '#6aa86b']] },
  { x: RIDE_SPINE_X - 6.5, z: -23.4, ry: PI, rows: [['🎢 놀이기구 ↓', '#e0a33a']] },
  { x: VILLAGE_GATE_W.x - 6, z: VILLAGE_GATE_W.z + 7, ry: -PI / 2, rows: [['🎡 놀이공원 →', '#e07a9a'], ['🏡 마을 ←', '#4f8a5b']] },
];

// ── 걸을 수 있는 땅·거리
export const inPark = (x, z, m = 0) => x >= PARK.x0 + m && x <= PARK.x1 - m && z >= PARK.z0 + m && z <= PARK.z1 - m;
export const inZoo = (x, z) => x >= ZOO_ZONE.x0 && x <= ZOO_ZONE.x1 && z >= ZOO_ZONE.z0 && z <= ZOO_ZONE.z1;
const rectD = (x, z) => Math.hypot(Math.max(0, PARK.x0 - x, x - PARK.x1), Math.max(0, PARK.z0 - z, z - PARK.z1));
export const parkDist = (x, z) => { const t = parkRoadNear(x, z); return Math.min(rectD(x, z), Math.max(0, t.d - t.hw)); }; // 부지·길에서 잰 거리 (땅 평탄화·나무 비우기)
const WM = 0.6; // 부지 울타리 안쪽 여유 (걷기 반지름 0.4 + 0.2)
// 걸을 수 있는 땅에 더하기: 부지 안·길 위면 null, 아니면 가장 가까운 안쪽 점 후보 (마을 쪽은 후보 없음 → 빈 목록)
export function parkWalk(x, z) {
  if (inPark(x, z, WM)) return null;
  if (x > -BX + 4) return [];
  const t = parkRoadNear(x, z), w = t.hw - 0.5;
  if (t.d <= w) return null;
  const k = w / t.d;
  return [[t.px + (x - t.px) * k, t.pz + (z - t.pz) * k], [Math.max(PARK.x0 + WM, Math.min(PARK.x1 - WM, x)), Math.max(PARK.z0 + WM, Math.min(PARK.z1 - WM, z))]];
}
// 충돌: 정문 탑·분수·벤치·가로등·풍선 수레·동물원 아치 기둥 (원) + 매표소·매점·쉼터·화장실 (네모). 꽃울타리·선로·길가 장식은 충돌 없음
export const PARK_CIRCLES = [
  ...GATE_TOWERS, { x: FW.x, z: FW.z, r: FW.r + 0.3 },
  ...PARK_BENCHES.map((b) => ({ x: b.x, z: b.z, r: 0.85 })), ...PARK_LAMPS.map((l) => ({ x: l.x, z: l.z, r: 0.3 })),
  ...BALLOON_CARTS.map((c) => ({ x: c.x, z: c.z, r: 0.9 })), ...PARK_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.5 })), ...[-1, 1].map((s) => ({ x: ZOO_ARCH.x + s * ZOO_ARCH.hw, z: ZOO_ARCH.z, r: 0.8 })),
];
export const PARK_RECTS = PARK_SHOPS.map((b) => [b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2]);
export const PARK_FAR = 330; // 카메라가 부지 가운데에서 이만큼 밖이면 공원 전체를 안 그림
export const PARK_CENTER = { x: (PARK.x0 + PARK.x1) / 2, z: (PARK.z0 + PARK.z1) / 2 };
