// 불멍 캠프 설계도 (서버·브라우저·시험이 같이 씀, world.js 가 다시 내보냄): 남쪽 대문 → 굽이진 숲길 → 숲속 공터의 큰 모닥불 + 둥근 통나무 벤치
// world.js 를 불러오지 않음(서로 부르면 초기화 순서가 꼬임) → 울타리 위치 44 는 world.js 의 BZ 와 같은 값
const FENCE_Z = 44;
export const CAMP_GATE = { x: -13, z: FENCE_Z, hw: 4.5 }; // 남쪽 울타리 대문: 남서쪽 공원 벤치 뒤, 술래잡기·피구 놀이터 사이 (x -13±4.5)
export const CAMP_TOWN_PATH = [[-12, 23.4], [-13, 32], [-13, FENCE_Z + 0.5]]; // 마을 안 흙길 (공원 벤치 → 대문)
export const FIRE = { x: -28, z: 186, r: 1.6 }; // 모닥불 가운데 (통나무 받침 반지름 1.6)
export const CLEAR_R = 28; // 공터 반지름 (지름 56)
export const FW_RANGE = 18, FW_NEAR = 120; // 불꽃놀이: 불에서 18m 안에서 시작, 120m 안 사람에게 보임
export const FW_PLANE = { d: 30, y: 23, hu: 22, hv: 14 }; // 그리는 하늘 평면: 바라보는 방향 앞 30m, 가운데 높이 23m, 정규화 좌표 ±1 = 가로 ±22m · 세로 ±14m
export const FW = { maxStrokes: 8, sessionMs: 30000, strokeMs: 10000, strokeGap: 1000, maxPts: 400, perMsg: 12, ptsPerSec: 60, cooldown: 8000, maxActive: 4 };
// 불꽃 스틱(스파클러): 아바타 앞 5.5m, 가운데 높이 2.4m, 아바타를 마주 보는 세로 평면 ±3.4m × ±2.4m 에 빛의 선으로 그림 (선은 4초쯤 식으며 사라짐)
// 규칙은 불꽃놀이와 같고 30초·12획·획 간격 0.5초·쿨다운 3초, 동시 인원은 하늘 불꽃놀이(4명)와 따로 6명
export const STICK_PLANE = { d: 5.5, y: 2.4, hu: 3.4, hv: 2.4 };
export const STICK = { ...FW, maxStrokes: 12, strokeGap: 500, cooldown: 3000, maxActive: 6 };

// 부드러운 곡선 (world.js 숲길과 같은 방식: 양 끝 점은 방향만)
function catmull(cp, n = 12) {
  const out = [];
  for (let i = 1; i < cp.length - 2; i++) for (let k = 0; k < n; k++) {
    const [p0, p1, p2, p3] = [cp[i - 1], cp[i], cp[i + 1], cp[i + 2]], t = k / n, t2 = t * t, t3 = t2 * t;
    out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
  }
  out.push(cp[cp.length - 2]);
  return out;
}
const CP = [[-13, 30], [-13, 40], [-13, 54], [-7, 74], [-14, 96], [-30, 116], [-36, 138], [-30, 160], [-29, 172]];
const pts = catmull(CP), acc = [0];
for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
export const CAMP_PATH = { pts, s: acc, len: acc.at(-1), hw: 4.3 }; // 가운데 선 · 대문 안쪽(z 40)부터 걸은 거리 · 반쪽 폭(길 폭 8.6)
// 가장 가까운 캠프 길 가운데 점: d = 거리, (px,pz), s = 길 시작부터 거리, (tx,tz) = 길 방향
export function campNear(x, z) {
  let best = { d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)), px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) { const l = Math.sqrt(l2); best = { d, px, pz, i, hw: CAMP_PATH.hw, s: acc[i] + l * t, tx: ex / l, tz: ez / l }; }
  }
  return best;
}
export const fireDist = (x, z) => Math.hypot(x - FIRE.x, z - FIRE.z);
export const inClearing = (x, z, m = 0) => fireDist(x, z) <= CLEAR_R - m;
export const campDist = (x, z) => Math.min(campNear(x, z).d, Math.max(0, fireDist(x, z) - CLEAR_R)); // 길·공터에서 잰 거리 (땅 평탄화·나무 비우기)

// 둥근 통나무 벤치: 불을 30° 칸 12개로 나눠, 안쪽 겹(반지름 5.5)은 입구 칸 3개(길 쪽과 ±120°)를 비우고 9조각 × 3석,
// 바깥 겹(반지름 8.2)은 입구 옆 칸마다 6조각 × 4석. 자리 간격 약 0.9m, 모두 불을 봄
const ENTRY = Math.atan2(pts.at(-1)[0] - FIRE.x, pts.at(-1)[1] - FIRE.z); // 불에서 본 길 끝 방향
const SLOT = Math.PI / 6;
export const CAMP_BENCHES = [
  ...[1, 2, 3, 5, 6, 7, 9, 10, 11].map((k) => ({ r: 5.5, a: ENTRY + k * SLOT, half: 0.245, n: 3 })), // half = 조각 반쪽 각도(라디안)
  ...[1, 3, 5, 7, 9, 11].map((k) => ({ r: 8.2, a: ENTRY + k * SLOT, half: 0.215, n: 4 })),
];
const SEAT_DA = 0.9; // 자리 간격(m)
export const benchSeats = (b) => Array.from({ length: b.n }, (_, i) => b.a + ((i - (b.n - 1) / 2) * SEAT_DA) / b.r); // 자리마다 각도
const onRing = (r, a) => [FIRE.x + Math.sin(a) * r, FIRE.z + Math.cos(a) * r];
export const CAMP_SEATS = CAMP_BENCHES.flatMap((b) => benchSeats(b).map((a) => { const [x, z] = onRing(b.r - 0.12, a); return { x, z, ry: Math.atan2(FIRE.x - x, FIRE.z - z) }; })); // 통나무 가운데보다 살짝 불 쪽에 앉음
// 장식 (렌더링·충돌이 같이 씀): 장작더미·텐트·랜턴 줄 기둥·큰 통나무
const ring = (r, a) => { const [x, z] = onRing(r, ENTRY + a); return { x, z, ry: Math.atan2(FIRE.x - x, FIRE.z - z) }; };
export const CAMP_PROPS = {
  woodpiles: [ring(12.5, 1.1), ring(12.5, -2.6)],
  tents: [ring(19.5, 2.2), ring(20.5, 2.75), ring(19.5, -1.9), ring(20, 3.6)],
  poles: [0.55, 1.6, 2.6, 3.65, 4.7, 5.75].map((a) => ring(15.5, a)), // 랜턴 줄 기둥 (입구 쪽 위는 비움)
  logs: [ring(11, 0.6), ring(11.5, -1.2), ring(10.8, 3.2)],
};
// 충돌: 불 받침 + 벤치(통나무 가운데 줄을 작은 원으로) + 장식
export const CAMP_CIRCLES = [
  { x: FIRE.x, z: FIRE.z, r: 2.15 }, // 돌 테두리까지
  ...CAMP_BENCHES.flatMap((b) => { const out = [], len = b.half * 2 * b.r, n = Math.max(2, Math.round(len / 0.45)); for (let i = 0; i <= n; i++) { const [x, z] = onRing(b.r + 0.06, b.a - b.half + (i / n) * b.half * 2); out.push({ x, z, r: 0.2 }); } return out; }),
  ...CAMP_PROPS.woodpiles.map((p) => ({ x: p.x, z: p.z, r: 1.3 })), ...CAMP_PROPS.tents.map((p) => ({ x: p.x, z: p.z, r: 1.7 })),
  ...CAMP_PROPS.poles.map((p) => ({ x: p.x, z: p.z, r: 0.15 })), ...CAMP_PROPS.logs.map((p) => ({ x: p.x, z: p.z, r: 0.55 })),
];
// 걸을 수 있는 땅에 더하기: 캠프 길·공터 안이면 [x,z], 아니면 가장 가까운 안쪽 점 후보 두 개
export function campWalk(x, z) {
  if (inClearing(x, z, 0.6)) return null;
  const t = campNear(x, z), w = t.hw - 0.5;
  if (t.d <= w) return null;
  const k = w / t.d, fd = fireDist(x, z) || 1e-4, R = CLEAR_R - 0.6;
  return [[t.px + (x - t.px) * k, t.pz + (z - t.pz) * k], [FIRE.x + ((x - FIRE.x) / fd) * R, FIRE.z + ((z - FIRE.z) / fd) * R]];
}
// 하늘 평면 ↔ 세상 좌표: plane = { x, y, z (가운데), ry (그린 사람이 본 방향, 0 = +z), hu·hv (반폭·반높이, 없으면 하늘 평면 크기) }. 오른쪽 = 바라보는 방향 × 위
export function fwWorld(pl, u, v) { const rx = -Math.cos(pl.ry), rz = Math.sin(pl.ry), hu = pl.hu ?? FW_PLANE.hu; return [pl.x + rx * u * hu, pl.y + v * (pl.hv ?? FW_PLANE.hv), pl.z + rz * u * hu]; }
// 시선(o 에서 d 방향)이 평면과 만나는 점의 [u, v] (뒤쪽이면 null). 화면을 누른 곳 → 평면 좌표
export function fwHit(pl, o, d) {
  const nx = Math.sin(pl.ry), nz = Math.cos(pl.ry), dn = d[0] * nx + d[2] * nz;
  if (Math.abs(dn) < 1e-6) return null;
  const t = ((pl.x - o[0]) * nx + (pl.z - o[2]) * nz) / dn;
  if (t <= 0) return null;
  const px = o[0] + d[0] * t - pl.x, py = o[1] + d[1] * t - pl.y, pz = o[2] + d[2] * t - pl.z;
  return [(px * -Math.cos(pl.ry) + pz * Math.sin(pl.ry)) / (pl.hu ?? FW_PLANE.hu), py / (pl.hv ?? FW_PLANE.hv)];
}
