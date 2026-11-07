// 자동 걸음 길 찾기 일꾼 (Web Worker): 걷기 격자(약 2초, 폰은 더)를 화면 밖에서 만들고 길을 찾아 돌려줌 → 화면이 멈추지 않음
// 받는 것 { id, x0, z0, x1, z1 } → 주는 것 { id, path: [[x,z]…] | null, to: [x,z] (보정된 목표) | null, ms } · 처음 한 번 { ready, buildMs }
import { grid, findPath, nearest, free, resetGrid } from './pathfind.js';
import { setOpenAvenues } from './world.js';

const t0 = performance.now();
grid();
postMessage({ ready: true, buildMs: Math.round(performance.now() - t0) });
onmessage = ({ data: q }) => {
  if (q.open) { setOpenAvenues(q.open); resetGrid(); grid(); postMessage({ opened: q.open }); return; } // 주택 단지 큰길이 더 열림 → 격자 다시 만듦
  const t = performance.now();
  let to = free(q.x1, q.z1) ? [q.x1, q.z1] : nearest(q.x1, q.z1); // 벽 안·물 위·울타리 밖·놀이터 패드면 가장 가까운 걸을 수 있는 칸으로
  let path = to && findPath(q.x0, q.z0, to[0], to[1]);
  if (!path && to) { to = nearest(q.x1, q.z1); path = to && findPath(q.x0, q.z0, to[0], to[1]); } // 빈 땅이지만 막힌 곳(동물 우리 안 등)
  if (!path) to = null;
  postMessage({ id: q.id, path, to, ms: Math.round(performance.now() - t) });
};
