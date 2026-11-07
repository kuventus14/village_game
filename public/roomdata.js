// 집 안(방) 설계도 (서버·브라우저·시험이 같이 씀, 순수 데이터): 방은 월드 아주 먼 곳(4000,4000 부터 40m 간격 10×10칸)에 집터 번호마다 한 칸씩 있음.
// 현관(집 밖 문 앞)에서 들어가면 서버가 그 방 현관 안쪽으로 옮기고, 나가면 집 문 앞으로 되돌려 놓음. 방 안 걷기·충돌은 resolve(world.js)가 resolveRoom 으로 처리.
// 가구는 방 가운데 기준 좌표(x,z)와 90° 단위 회전(r 0~3)으로 저장 → 어느 방에서나 같은 데이터. 가구 값·크기는 FURN, 처음 주는 가구는 DEFAULT_FURN
export const ROOM = { w: 16, d: 11, h: 3.6 }; // 집 겉모양(12×9m)보다 넓은 만화 속 방 (카메라가 안에서 물러설 자리)
export const ROOM_BASE = 4000, ROOM_GAP = 40, ROOM_COLS = 10;
export const roomOrigin = (id) => ({ cx: ROOM_BASE + ((id - 1) % ROOM_COLS) * ROOM_GAP, cz: ROOM_BASE + Math.floor((id - 1) / ROOM_COLS) * ROOM_GAP });
// 방 한 칸: 벽 안쪽 범위·현관(남쪽 벽 가운데)·들어오면 서는 자리(현관 안쪽 2m: 카메라가 아바타 뒤 1.7m 이상 떨어져 벽 안에 있게)
export const roomBox = (id) => {
  const { cx, cz } = roomOrigin(id);
  return { id, cx, cz, x0: cx - ROOM.w / 2, x1: cx + ROOM.w / 2, z0: cz - ROOM.d / 2, z1: cz + ROOM.d / 2, door: { x: cx, z: cz + ROOM.d / 2 }, entry: { x: cx, z: cz + ROOM.d / 2 - 2.0, ry: Math.PI } };
};
// 이 좌표가 어느 방 안인가 (0 = 방 아님)
export function roomAt(x, z) {
  if (x < ROOM_BASE - 20 || z < ROOM_BASE - 20) return 0;
  const i = Math.round((x - ROOM_BASE) / ROOM_GAP), j = Math.round((z - ROOM_BASE) / ROOM_GAP);
  if (i < 0 || j < 0 || i >= ROOM_COLS || j >= ROOM_COLS) return 0;
  const { cx, cz } = roomOrigin(j * ROOM_COLS + i + 1);
  return Math.abs(x - cx) <= ROOM.w / 2 + 1 && Math.abs(z - cz) <= ROOM.d / 2 + 1 ? j * ROOM_COLS + i + 1 : 0;
}

// ── 가구 목록: k = 종류, w×d = 놓이는 크기(m), solid = 걸어 지나갈 수 없음(침대·의자·러그는 위로 올라가 앉기·눕기 가능), price = 칩(0 = 처음부터 가짐)
export const FURN = {
  bed: { name: '침대', icon: '🛏️', w: 1.3, d: 2.1, solid: false, price: 0 },
  desk: { name: '책상', icon: '🪑', w: 1.4, d: 0.7, solid: true, price: 0 },
  chair: { name: '의자', icon: '💺', w: 0.6, d: 0.6, solid: false, price: 0 },
  table: { name: '탁자', icon: '🍽️', w: 1.2, d: 1.2, solid: true, price: 0 },
  rug: { name: '러그', icon: '🟫', w: 2.4, d: 1.8, solid: false, price: 0 },
  lamp: { name: '스탠드', icon: '💡', w: 0.5, d: 0.5, solid: true, price: 0 },
  sofa: { name: '소파', icon: '🛋️', w: 2.0, d: 0.9, solid: true, price: 8000 },
  shelf: { name: '책장', icon: '📚', w: 1.4, d: 0.4, solid: true, price: 5000 },
  plant: { name: '화분', icon: '🪴', w: 0.6, d: 0.6, solid: true, price: 2000 },
  tv: { name: 'TV장', icon: '📺', w: 1.6, d: 0.5, solid: true, price: 15000 },
  wardrobe: { name: '옷장', icon: '🚪', w: 1.2, d: 0.6, solid: true, price: 6000 },
  bed2: { name: '공주 침대', icon: '👑', w: 1.8, d: 2.2, solid: false, price: 20000 },
  piano: { name: '피아노', icon: '🎹', w: 1.5, d: 0.8, solid: true, price: 50000 },
  tank: { name: '어항', icon: '🐠', w: 1.0, d: 0.5, solid: true, price: 12000 },
  rug2: { name: '꽃 러그', icon: '🌸', w: 2.0, d: 2.0, solid: false, price: 4000 },
};
export const FURN_KEYS = Object.keys(FURN);
export const MAX_FURN = 40, STEP = 0.5;
// 처음 받는 집의 가구 (r: 0 = 길이가 z 방향·정면이 +z 쪽(남쪽·현관 쪽)을 봄, 1 = +x, 2 = −z, 3 = −x)
export const DEFAULT_FURN = [
  { k: 'bed', x: -6.5, z: -3.5, r: 0 }, { k: 'desk', x: 4.5, z: -4.9, r: 2 }, { k: 'chair', x: 4.5, z: -4.0, r: 2 }, { k: 'table', x: 4.0, z: 1.0, r: 0 },
  { k: 'rug', x: 0, z: 0.2, r: 0 }, { k: 'lamp', x: -7.3, z: -5.0, r: 0 },
];
export const DEFAULT_INV = { bed: 1, desk: 1, chair: 1, table: 1, rug: 1, lamp: 1 };

// 가구가 차지하는 네모 [x0,z0,x1,z1] (방 가운데 기준) — 90° 회전이면 가로·세로가 바뀜
export const footprint = (f) => { const c = FURN[f.k], odd = f.r & 1, w = odd ? c.d : c.w, d = odd ? c.w : c.d; return [f.x - w / 2, f.z - d / 2, f.x + w / 2, f.z + d / 2]; };
const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const DOOR_CLEAR = [-1.3, ROOM.d / 2 - 2.2, 1.3, ROOM.d / 2]; // 현관 앞은 막지 않음 (못 나가는 일 방지)
const inRoom = (r) => r[0] >= -ROOM.w / 2 + 0.15 && r[2] <= ROOM.w / 2 - 0.15 && r[1] >= -ROOM.d / 2 + 0.15 && r[3] <= ROOM.d / 2 - 0.15;
// 가구 목록 검사·정리: 모르는 종류·방 밖·가진 수 초과·단단한 가구끼리 겹침·현관 막음은 버림. 반환: 정리된 목록 (inv 가 있으면 가진 수까지만)
export function cleanFurn(list, inv = null) {
  const out = [], used = {};
  for (const f of Array.isArray(list) ? list.slice(0, MAX_FURN * 2) : []) {
    if (!f || !Object.hasOwn(FURN, f.k) || !Number.isFinite(f.x) || !Number.isFinite(f.z) || !Number.isInteger(f.r) || f.r < 0 || f.r > 3) continue;
    const g = { k: f.k, x: Math.round(f.x / STEP) * STEP, z: Math.round(f.z / STEP) * STEP, r: f.r }, fp = footprint(g);
    if (!inRoom(fp) || out.length >= MAX_FURN || (inv && (used[g.k] ?? 0) >= (inv[g.k] ?? 0))) continue;
    if (FURN[g.k].solid && (hit(fp, DOOR_CLEAR) || out.some((o) => FURN[o.k].solid && hit(fp, footprint(o))))) continue;
    used[g.k] = (used[g.k] ?? 0) + 1; out.push(g);
  }
  return out;
}

// ── 앉고 눕는 자리: 가구 정면(+z)을 보고 앉음, 침대는 머리가 뒤(−z, 베개 쪽). h = 앉는·눕는 면 높이(m), x·z = 가구 가운데 기준
export const REST = {
  chair: [{ x: 0, z: -0.03, h: 0.45, pose: 'sit' }],
  sofa: [{ x: -0.45, z: 0.06, h: 0.42, pose: 'sit' }, { x: 0.45, z: 0.06, h: 0.42, pose: 'sit' }],
  bed: [{ x: 0, z: 0.1, h: 0.5, pose: 'lie' }],
  bed2: [{ x: 0, z: 0.1, h: 0.55, pose: 'lie' }],
};
export const REST_RANGE = 1.7; // 이만큼 가까이 가면 앉기·눕기 카드가 뜸 (서버 검사는 조금 더 넉넉히)
// 방 가구 목록 → 앉고 눕는 자리 목록 [{ i(가구 번호), s(자리 번호), k, pose, h, x, z(방 가운데 기준), ry }]
export function restSpots(furn) {
  const out = [];
  (furn ?? []).forEach((f, i) => (REST[f.k] ?? []).forEach((sp, s) => { const th = f.r * Math.PI / 2, c = Math.cos(th), si = Math.sin(th); out.push({ i, s, k: f.k, pose: sp.pose, h: sp.h, x: f.x + sp.x * c + sp.z * si, z: f.z - sp.x * si + sp.z * c, ry: th }); }));
  return out;
}

// ── 방 안 걷기: 방마다 단단한 가구 네모 목록(setRoomFurn 로 서버·화면이 각자 채움) · 벽 안쪽으로 가두고 단단한 가구 밖으로 밀어냄
const SOLIDS = new Map();
export const setRoomFurn = (id, list) => { if (list) SOLIDS.set(id, list.filter((f) => FURN[f.k]?.solid).map(footprint)); else SOLIDS.delete(id); };
export function resolveRoom(id, x, z, r = 0.4) {
  const b = roomBox(id), rects = SOLIDS.get(id) ?? [], lx = x - b.cx, lz = z - b.cz;
  let px = lx, pz = lz;
  for (let i = 0; i < 3; i++) {
    for (const [x0, z0, x1, z1] of rects) {
      const cx = Math.max(x0, Math.min(px, x1)), cz = Math.max(z0, Math.min(pz, z1)), dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; px += dx * k; pz += dz * k; }
      else { const l = px - x0, rr = x1 - px, t = pz - z0, bb = z1 - pz, m = Math.min(l, rr, t, bb); if (m === l) px = x0 - r; else if (m === rr) px = x1 + r; else if (m === t) pz = z0 - r; else pz = z1 + r; }
    }
    px = Math.max(-ROOM.w / 2 + r, Math.min(ROOM.w / 2 - r, px)); pz = Math.max(-ROOM.d / 2 + r, Math.min(ROOM.d / 2 - r, pz));
  }
  return [b.cx + px, b.cz + pz];
}

// 가구 백화점 자리 (마을 광장 동남쪽, 분수를 바라봄) · 사는 거리
export const FURN_STALL = { x: 11.5, z: 9.5, ry: -2.26, r: 2.2 }, BUY_RANGE = 6, NEAR_RANGE = 4.8;
