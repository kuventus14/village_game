// 그린 한 획이 별·하트·동그라미·세모·번개 중 무엇과 닮았는지 (축하 문구용. 불꽃은 그린 선 그대로 터짐). 서버·브라우저·시험이 같이 씀
// 방식: 64점으로 다시 뽑기 → 가운데·크기 맞추기 → 본보기 모양과 점마다 거리 평균. 닫힌 모양은 시작점·방향을 모두 돌려 봄
export const SHAPE_NAME = { star: '⭐ 별', heart: '💖 하트', circle: '⭕ 동그라미', triangle: '🔺 세모', bolt: '⚡ 번개' };
const N = 64;
function resample(pts, n = N) {
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (!(L > 0)) return null;
  const step = L / (n - 1), out = [pts[0].slice()];
  let acc = 0, prev = pts[0];
  for (let i = 1; i < pts.length && out.length < n; i++) {
    let cur = pts[i], d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + d >= step && out.length < n) { const t = (step - acc) / d, q = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]; out.push(q); prev = q; d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); acc = 0; }
    acc += d; prev = cur;
  }
  while (out.length < n) out.push(pts.at(-1).slice());
  return out;
}
// 가운데(0,0)·크기(가로·세로 각각 1)로. 아주 납작하면(선) 비율 그대로
function normalize(p) {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let w = x1 - x0, h = y1 - y0; const m = Math.max(w, h) || 1;
  if (Math.min(w, h) / m < 0.3) w = h = m;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return p.map(([x, y]) => [(x - cx) / w, (y - cy) / h]);
}
const poly = (v, closed) => { const out = []; const list = closed ? [...v, v[0]] : v; for (let i = 1; i < list.length; i++) for (let k = 0; k < 16; k++) { const t = k / 16; out.push([list[i - 1][0] + (list[i][0] - list[i - 1][0]) * t, list[i - 1][1] + (list[i][1] - list[i - 1][1]) * t]); } out.push(list.at(-1)); return out; };
const outer = (k, r = 1, n = 5) => [Math.sin((k / n) * Math.PI * 2) * r, Math.cos((k / n) * Math.PI * 2) * r];
const TPL = [
  ['circle', true, Array.from({ length: 65 }, (_, i) => [Math.sin((i / 64) * Math.PI * 2), Math.cos((i / 64) * Math.PI * 2)])],
  ['heart', true, Array.from({ length: 129 }, (_, i) => { const t = (i / 128) * Math.PI * 2; return [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]; })],
  ['star', true, poly([0, 2, 4, 1, 3].map((k) => outer(k)), true)], // 한붓 별(오각별 꼭짓점을 하나씩 건너뛰며)
  ['star', true, poly(Array.from({ length: 10 }, (_, i) => outer(i / 2, i % 2 ? 0.42 : 1, 5)), true)], // 테두리 별
  ['triangle', true, poly([[0, 1], [0.87, -0.5], [-0.87, -0.5]], true)],
  ['bolt', false, poly([[0.35, 1], [-0.3, 0.1], [0.3, 0.05], [-0.35, -1]], false)],
].map(([name, closed, raw]) => ({ name, closed, p: normalize(resample(raw)) }));
const mean = (a, b) => { let s = 0; for (let i = 0; i < N; i++) s += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]); return s / N; };
function bestFit(p, t) {
  if (!t.closed) return Math.min(mean(p, t.p), mean(p, [...t.p].reverse()));
  let best = Infinity; const ring = t.p.slice(0, N - 1); // 닫힌 모양: 마지막 점 = 첫 점
  for (const dir of [1, -1]) for (let k = 0; k < N - 1; k += 1) {
    const q = Array.from({ length: N }, (_, i) => ring[(((k + dir * i) % (N - 1)) + (N - 1)) % (N - 1)]);
    best = Math.min(best, mean(p, q));
  }
  return best;
}
const LIMIT = { circle: 0.075, heart: 0.085, star: 0.13, triangle: 0.08, bolt: 0.09 };
// pts = [[u, v], ...] (위가 +v). 반환: 모양 이름 또는 null
export function recognize(pts) {
  if (!Array.isArray(pts) || pts.length < 8) return null;
  const r = resample(pts); if (!r) return null;
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (diag < 0.08) return null; // 너무 작은 점·짧은 선
  const closed = Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < diag * 0.3, p = normalize(r);
  let best = null, bd = Infinity, second = Infinity;
  for (const t of TPL) {
    if (t.closed !== closed) continue;
    const d = bestFit(p, t);
    if (d < bd) { if (best?.name !== t.name) second = bd; bd = d; best = t; } else if (t.name !== best?.name) second = Math.min(second, d);
  }
  return best && bd < LIMIT[best.name] && bd < second * 0.8 ? best.name : null;
}
