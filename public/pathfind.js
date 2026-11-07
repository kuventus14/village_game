// 걷기 격자·길 찾기 (서버 봇 bots.js 와 화면 자동 걸음 pathfind-worker.js 가 같이 씀). world.js 만 씀 → node·브라우저·Web Worker 어디서나 돎
import { GAMES, resolve, placeOf } from './world.js';

// ───── 걷기 격자: 2m 칸, 마을 가운데서 걸어 닿는 칸만 (한 번 만들어 같이 씀). 서쪽은 놀이공원(x -532)까지, 북쪽은 주택 단지까지(열린 큰길만 닿음 — 큰길이 더 열리면 resetGrid)
const CELL = 2, GX0 = -536, GZ0 = -560, NX = 475, NZ = 389, N = NX * NZ; // 북쪽은 주택 단지 큰길 E(z -555)까지
const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], OPP = [1, 0, 3, 2, 7, 6, 5, 4];
const ARENAS = Object.values(GAMES).map((g) => [g.cx - g.hw - 2, g.cz - g.hd - 2, g.cx + g.hw + 2, g.cz + g.hd + 2]);
// 놀이터 패드(+여유)·경기장 근처는 격자에서 뺌 → 지나가던 봇·자동 걸음이 패드를 밟아 게임이 저절로 시작되지 않음 (게임하러 가는 봇은 마지막 몇 m 를 곧게 걸어 들어감). m = 여유를 줄이는 만큼
export const banned = (x, z, m = 0) => Object.values(GAMES).some((g) => Math.hypot(x - g.pad.x, z - g.pad.z) < g.pad.r + 2.6 - m) || ARENAS.some(([a, b, c, d]) => x > a + m && x < c - m && z > b + m && z < d - m);
const still = (x, z, r) => { const [a, b] = resolve(x, z, r, 0); return Math.abs(a - x) + Math.abs(b - z) < 0.02; };
export const free = (x, z) => still(x, z, 0.45) && still(x, z, 0.4) && !banned(x, z); // 실제 걷는 반지름(0.4)으로도 확인 (충돌 모양에 따라 결과가 다를 때가 있음)
let G = null;
export const resetGrid = () => { G = null; }; // 주택 단지 큰길이 더 열렸을 때 다시 만들기
export function grid() {
  if (G) return G;
  const st = new Uint8Array(N), edge = new Uint8Array(N), near = new Uint8Array(N), reach = new Uint8Array(N); // st: 0 모름 1 빈칸 2 막힘
  const X = (i) => GX0 + (i % NX) * CELL, Z = (i) => GZ0 + Math.floor(i / NX) * CELL;
  const test = (i) => st[i] || (st[i] = free(X(i), Z(i)) ? 1 : 2);
  const at = (x, z) => { const i = Math.round((x - GX0) / CELL), j = Math.round((z - GZ0) / CELL); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : i + j * NX; };
  const s0 = at(0, 8), q = [s0];
  test(s0); reach[s0] = 1;
  while (q.length) { // 걸어서 닿는 칸 채우기 + 칸 사이 길(가운데 점도 비어 있어야 함: 얇은 벽을 건너뛰지 않게)
    const i = q.pop(), x = X(i), z = Z(i), ci = i % NX, cj = (i / NX) | 0;
    for (let k = 0; k < 8; k++) {
      const ni = ci + D8[k][0], nj = cj + D8[k][1];
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const j = ni + nj * NX;
      if (test(j) !== 1) { near[i] = 1; continue; }
      if (edge[i] & (1 << k)) { if (!reach[j]) { reach[j] = 1; q.push(j); } continue; }
      if (k >= 4 && (test(ci + D8[k][0] + cj * NX) !== 1 || test(ci + (cj + D8[k][1]) * NX) !== 1)) continue; // 대각선은 양옆 칸도 비어야
      if (!free(x + D8[k][0] * CELL / 2, z + D8[k][1] * CELL / 2)) continue;
      edge[i] |= 1 << k; edge[j] |= 1 << OPP[k];
      if (!reach[j]) { reach[j] = 1; q.push(j); }
    }
  }
  const cells = {}; // 장소별 칸 목록 (어슬렁거릴 곳 고르기)
  for (let i = 0; i < N; i++) if (reach[i]) (cells[placeOf(X(i), Z(i))] ??= []).push(i);
  G = { X, Z, at, edge, near, reach, cells, gs: new Float32Array(N), from: new Int32Array(N), stamp: new Uint32Array(N), closed: new Uint32Array(N), run: 0 };
  return G;
}
// 가장 가까운 닿는 칸 (반경 3칸 안). 곧게 걸어 닿는(사이에 벽·의자가 없는) 칸을 먼저 고름 → 의자 줄·벤치 틈에 갇히지 않음
function snap(g, x, z) {
  const c = g.at(x, z), list = [];
  if (c < 0) return -1;
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
    const j = c + di + dj * NX;
    if (j >= 0 && j < N && g.reach[j]) list.push([Math.hypot(g.X(j) - x, g.Z(j) - z), j]);
  }
  list.sort((a, b) => a[0] - b[0]);
  return (list.find(([, j]) => clear([x, z], [g.X(j), g.Z(j)])) ?? list[0])?.[1] ?? -1;
}
// 아무 점에서 가장 가까운 닿는 칸의 [x, z] (반경 r 칸 안, 없으면 null) — 지도에서 건물 벽·울타리 밖·물 위를 눌렀을 때 보정
export function nearest(x, z, r = 40) {
  const g = grid(), ci = Math.round((x - GX0) / CELL), cj = Math.round((z - GZ0) / CELL);
  let best = null, bd = Infinity;
  for (let ring = 0; ring <= r; ring++) {
    for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= NX || j >= NZ || !g.reach[i + j * NX]) continue;
      const d = Math.hypot(g.X(i + j * NX) - x, g.Z(i + j * NX) - z);
      if (d < bd) { bd = d; best = [g.X(i + j * NX), g.Z(i + j * NX)]; }
    }
    if (best && bd < ring * CELL) break; // 다음 고리는 이보다 멀다
  }
  return best;
}
// A* (8방향, 벽 옆 칸은 조금 비싸게 → 길 가운데로 다님). 점 목록 [[x,z]…] (처음 = 지금 위치, 끝 = 목표) 또는 null
// exact: 의자·행동 자리처럼 그 점까지 가야 함. 아니면 마지막 칸에서 곧게 안 보이는 목표(가구 틈)는 마지막 칸에서 멈춤
export function findPath(x0, z0, x1, z1, exact = false) {
  const g = grid(), s = snap(g, x0, z0), t = snap(g, x1, z1);
  if (s < 0 || t < 0) return null;
  const run = ++g.run, tx = t % NX, tz = (t / NX) | 0, h = (i) => { const dx = Math.abs(i % NX - tx), dz = Math.abs(((i / NX) | 0) - tz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const heap = [s], f = new Map([[s, h(s)]]);
  g.stamp[s] = run; g.gs[s] = 0; g.from[s] = -1;
  const up = (k) => { while (k) { const p = (k - 1) >> 1; if (f.get(heap[p]) <= f.get(heap[k])) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const down = (k) => { for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && f.get(heap[l]) < f.get(heap[m])) m = l; if (r < heap.length && f.get(heap[r]) < f.get(heap[m])) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } };
  let found = false;
  while (heap.length) {
    const i = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; down(0); }
    if (g.closed[i] === run) continue;
    g.closed[i] = run;
    if (i === t) { found = true; break; }
    const e = g.edge[i], ci = i % NX, cj = (i / NX) | 0;
    for (let k = 0; k < 8; k++) {
      if (!(e & (1 << k))) continue;
      const j = ci + D8[k][0] + (cj + D8[k][1]) * NX;
      if (g.closed[j] === run) continue;
      const c = g.gs[i] + (k < 4 ? 1 : 1.414) * (g.near[j] ? 1.8 : 1);
      if (g.stamp[j] === run && c >= g.gs[j]) continue;
      g.stamp[j] = run; g.gs[j] = c; g.from[j] = i; f.set(j, c + h(j)); heap.push(j); up(heap.length - 1);
    }
  }
  if (!found) return null;
  const out = [];
  for (let i = t; i >= 0; i = g.from[i]) out.push([g.X(i), g.Z(i)]);
  out.reverse();
  out[0] = [x0, z0];
  if (Math.hypot(out.at(-1)[0] - x1, out.at(-1)[1] - z1) > 0.05 && (exact || clear(out.at(-1), [x1, z1]) || Math.hypot(out.at(-1)[0] - x1, out.at(-1)[1] - z1) > 2.2)) out.push([x1, z1]); // 너무 멀면(앉기 2.5m 밖) 그래도 다가감
  const pts = out.filter((p, k) => k === 0 || k === out.length - 1 || !colinear(out[k - 1], p, out[k + 1]));
  const sm = [pts[0]]; // 줄 당기기: 곧게 보이는 데까지 한 번에 감 → 격자 계단 모양이 펴져서 사람처럼 질러감
  for (let i = 0; i < pts.length - 1;) { let j = i + 1; while (j < pts.length - 1 && Math.hypot(pts[j + 1][0] - pts[i][0], pts[j + 1][1] - pts[i][1]) < 24 && clear(pts[i], pts[j + 1])) j++; sm.push(pts[j]); i = j; }
  return sm;
}
// 줄 당기기용 0.5m 촘촘한 칸 (처음 물어볼 때 한 번만 계산해 둠). shortcut: 칸 중심으로 근사 → 기둥 옆을 35cm 안쪽으로 스칠 수 있음, 실제 이동은 충돌로 미끄러져 지나감
const FX = NX * 4, FZ = NZ * 4, fine = new Uint8Array(FX * FZ);
export const freeFine = (x, z) => { const i = Math.round((x - GX0) * 2), j = Math.round((z - GZ0) * 2); if (i < 0 || j < 0 || i >= FX || j >= FZ) return false; const k = i + j * FX; return (fine[k] ||= (free(GX0 + i / 2, GZ0 + j / 2) ? 1 : 2)) === 1; };
export const clear = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25); for (let k = 1; k < n; k++) if (!freeFine(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)) return false; return true; };
// 사람마다 길 한가운데가 아니라 조금씩 옆으로 비켜 걸음 (모두 같은 줄로 걷지 않게). 꺾이는 점을 옆으로 off m 밀되 막히면 그대로
export function lane(P, off) {
  for (let i = 1; i < P.length - 1; i++) {
    const dx = P[i + 1][0] - P[i - 1][0], dz = P[i + 1][1] - P[i - 1][1], L = Math.hypot(dx, dz) || 1, o = [P[i][0] - (dz / L) * off, P[i][1] + (dx / L) * off];
    if (freeFine(...o) && clear(P[i - 1], o) && clear(o, P[i + 1])) P[i] = o;
  }
}
const colinear = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-6;
