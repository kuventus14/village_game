// 주택 단지 설계도 (서버·브라우저·시험이 같이 씀, 순수 데이터): 마을 북쪽에 따로 빼낸 집터 동네. 포근마을은 시내가 되고 집은 이 단지에 있음
// 마을 북쪽 울타리(z -44)에 새 대문을 내고 → 길(북쪽으로 68m) → 입구 광장 → 동서 큰길(A~E) 양옆 집터. 큰길마다 20곳, 5개 = 100곳.
// 처음엔 큰길 A(20곳)만 열리고, 열린 집터의 80% 가 차면 다음 큰길이 자동으로 열림(openAvenues) — 모두가 같은 집터 주인 목록으로 같은 때에 계산. 100곳이 넘으면 공동주택(나중)
// 좌표는 월드(m), z 가 작을수록 북쪽. 집 안(방)은 단지 밖의 별도 공간 — 다음 조각에서 정함 (docs/HOUSING.md)
export const NORTH_GATE = { x: 0, z: -44, hw: 4.5 };            // 마을 북쪽 울타리 대문 (단지 가는 길)
export const ENTRY = { x: 0, z: -112, r: 14 };                    // 입구 광장 (안내판·분수)
export const GATE_ROAD = { x: 0, z0: -44, z1: -112, hw: 5 };       // 대문 → 입구 광장 흙길
export const PLOT_W = 24, PLOT_D = 30, STREET_HW = 5;              // 집터 24 × 30m, 큰길 반쪽 폭 5m
export const HOUSE = { w: 12, d: 9, yard: 8 };                     // 집 12 × 9m, 큰길쪽 앞마당 8m
export const STREETS = ['A', 'B', 'C', 'D', 'E'].map((id, i) => ({ id, z: -160 - 90 * i })); // 동서 큰길 5개 (90m 간격, 북쪽으로 늘어남)
export const AV_BAND = 35;                                         // 큰길 가운데에서 집터 바깥 끝까지(5 + 30m)
export const OPEN_FIRST = 20, OPEN_RATIO = 0.8;                    // 처음 열린 집터 수 · 다음 큰길이 열리는 비율
export const DISTRICT = { x0: -130, x1: 130, z0: STREETS.at(-1).z - AV_BAND, z1: -112 }; // 단지 전체 영역 (260 × 443m = 마을의 5.4배, 안 열린 곳은 울타리)
export const SPINE = { x: 0, z0: DISTRICT.z1, z1: DISTRICT.z0, hw: STREET_HW };  // 남북 중앙로
// 집터: 큰길 양옆 한 줄씩, 중앙로 좌우 5칸씩. door = 현관 앞 (큰길 쪽), face = 현관이 바라보는 방향(0 = +z 남쪽, π = −z 북쪽)
export const PLOTS = [];
for (const av of STREETS) for (const side of ['N', 'S']) for (const half of ['W', 'E']) for (let k = 0; k < 5; k++) {
  const x0 = half === 'W' ? -STREET_HW - PLOT_W * (k + 1) : STREET_HW + PLOT_W * k, north = side === 'N';
  const edge = north ? av.z - STREET_HW : av.z + STREET_HW;               // 큰길 쪽 가장자리 z
  const z0 = north ? edge - PLOT_D : edge, z1 = north ? edge : edge + PLOT_D;
  const cx = x0 + PLOT_W / 2, hz0 = north ? edge - HOUSE.yard - HOUSE.d : edge + HOUSE.yard, hz1 = hz0 + HOUSE.d;
  const id = PLOTS.length + 1, face = north ? 0 : Math.PI;
  PLOTS.push({
    id, av: av.id, side, x0, x1: x0 + PLOT_W, z0, z1, cx,
    house: [cx - HOUSE.w / 2, hz0, cx + HOUSE.w / 2, hz1],               // 집 발자국 [x0,z0,x1,z1] (충돌)
    door: { x: cx, z: north ? hz1 : hz0, face },                          // 현관 문 앞 가장자리 (큰길 쪽 벽 가운데)
    gate: { x: cx, z: edge },                                            // 앞마당 대문·우편함·문패 자리 (큰길 가장자리)
  });
}
// 큰길을 몇 개 열지: 처음 1개, 지금 열린 집터의 OPEN_RATIO 가 차면 하나씩 더 (claimed = 지금 집이 있는 집터 수)
export function openAvenues(claimed) { let n = 1; while (n < STREETS.length && claimed >= Math.ceil(OPEN_RATIO * OPEN_FIRST * n)) n++; return n; }
export const isOpen = (plot, n) => STREETS.findIndex((a) => a.id === plot.av) < n;
export const openZ0 = (n) => STREETS[n - 1].z - AV_BAND; // 열린 구역의 북쪽 끝 z (그 너머는 울타리)
export const ROOFS = ['#ff8fb1', '#ffb36b', '#ffd45a', '#8fdc9a', '#7fd3e8', '#8fb3ff', '#c8a2ff', '#d9d2c8']; // 지붕 색 8가지 (집터 받을 때 고름)
export const NAME_MAX = 12, CLAIM_RANGE = 22; // 문패 글자 수 · 집터를 받을 수 있는 거리(입구 광장 안내판에서)
export const plotById = (id) => PLOTS.find((p) => p.id === id);
export const plotAt = (x, z) => PLOTS.find((p) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) || null;
// 단지(영역 + 대문 길)까지의 거리 (안이면 0) — 땅 평탄화·나무 비우기에 씀
export function districtDist(x, z) {
  const R = DISTRICT, r = Math.hypot(Math.max(0, R.x0 - x, x - R.x1), Math.max(0, R.z0 - z, z - R.z1));
  const g = GATE_ROAD, dz = Math.max(0, g.z1 - z, z - g.z0), dx = Math.max(0, Math.abs(x - g.x) - g.hw), d = Math.hypot(dx, dz);
  return Math.min(r, d);
}
export const inDistrict = (x, z, m = 0) => x >= DISTRICT.x0 + m && x <= DISTRICT.x1 - m && z >= DISTRICT.z0 + m && z <= DISTRICT.z1 - m;
export const HOUSE_RECTS = PLOTS.map((p) => p.house); // 충돌: 집 발자국

// ── 열린 큰길 수(서버·화면이 각자 setOpenAvenues 로 같은 때에 바꿈) · 걸을 수 있는 땅
export const HOUSING = { open: 1 };
export const setOpenAvenues = (n) => { HOUSING.open = Math.max(1, Math.min(STREETS.length, n | 0)); };
const WM = 0.6; // 울타리 안쪽 여유 (걷기 반지름 0.4 + 0.2)
// 걸을 수 있는 땅에 더하기: 대문 길·입구 광장·열린 단지 안이면 null, 아니면 가장 가까운 걷는 점 후보 (z 가 작을수록 북쪽)
export function districtWalk(x, z) {
  const g = GATE_ROAD, d = DISTRICT, zN = openZ0(HOUSING.open) + WM, w = g.hw - 0.5;
  if (z > g.z0 + 2) return []; // 마을 쪽은 후보 없음
  if (Math.abs(x - g.x) <= w && z <= g.z0 + 2 && z >= g.z1) return null; // 대문 길
  if (x >= d.x0 + WM && x <= d.x1 - WM && z >= zN && z <= d.z1) return null; // 열린 단지 (집터는 앞마당·뒤뜰로 걸어 다님, 집 발자국은 충돌로 막음)
  if (Math.hypot(x - ENTRY.x, z - ENTRY.z) <= ENTRY.r - 0.5) return null; // 입구 광장 (단지 영역 밖으로 살짝 나온 부분)
  const c = (v, a, b) => Math.max(a, Math.min(b, v));
  return [[c(x, g.x - w, g.x + w), c(z, g.z1, g.z0 + 2)], [c(x, d.x0 + WM, d.x1 - WM), c(z, zN, d.z1)]];
}
