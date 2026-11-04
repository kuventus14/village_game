// 한국 시간(KST) 낮·밤 계산: 순수 함수만 (three 없이 노드에서 시험). 세상 좌표는 x=동, y=위, z=남
export const KST = 9 * 3600e3;
const LAT = (37.5 * Math.PI) / 180, LON = 127, DEG = Math.PI / 180;

export const kstHours = (ms) => ((((ms + KST) % 864e5) + 864e5) % 864e5) / 3.6e6;
export function kstParts(ms) {
  const d = new Date(ms + KST), y = d.getUTCFullYear();
  return { y, mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), doy: (Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 1)) / 864e5 + 1 };
}

// NOAA 근사식: 적위(rad)·균시차(분). g = 한 해 중 위치(rad)
const yearAngle = (doy, h) => ((2 * Math.PI) / 365) * (doy - 1 + (h - 12) / 24);
const decl = (g) => 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
const eqt = (g) => 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
const noonAt = (g) => 12 + ((135 - LON) * 4 - eqt(g)) / 60; // 서울은 표준 자오선(135°)보다 서쪽이라 남중이 12시 반쯤

// 그날의 해 뜨는·지는·남중 시각(KST 시간, 소수)
export function sunTimes(doy) {
  const g = yearAngle(doy, 12), dc = decl(g), noon = noonAt(g);
  const cosH = (Math.sin(-0.833 * DEG) - Math.sin(LAT) * Math.sin(dc)) / (Math.cos(LAT) * Math.cos(dc));
  const half = Math.acos(Math.max(-1, Math.min(1, cosH))) / DEG / 15;
  return { rise: noon - half, set: noon + half, noon };
}

// 해 방향(단위 벡터)을 out 에 씀. 달은 늘 그 반대편(-out)
export function sunVec(doy, hours, out) {
  const g = yearAngle(doy, hours), dc = decl(g), H = (hours - noonAt(g)) * 15 * DEG;
  const e = -Math.cos(dc) * Math.sin(H), n = Math.sin(dc) * Math.cos(LAT) - Math.cos(dc) * Math.cos(H) * Math.sin(LAT), u = Math.sin(dc) * Math.sin(LAT) + Math.cos(dc) * Math.cos(H) * Math.cos(LAT);
  out[0] = e; out[1] = u; out[2] = -n;
  return out;
}

// 달 위상 0..1 (0 = 그믐/삭, 0.5 = 보름). 2000-01-06 18:14 UTC 삭 기준
export const moonPhase = (ms) => ((((ms - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1) + 1) % 1;

/* ───── 시간대별 분위기 키프레임 (sRGB 색) ───── */
const COLORS = ['top', 'mid', 'hor', 'glow', 'sun', 'hemiS', 'hemiG', 'cloud', 'cloudE'];
const NUMS = ['halo', 'sunI', 'moonI', 'hemiI', 'fillI', 'exp', 'bloom', 'star', 'night'];
const P = {
  night: { top: '#0b1534', mid: '#1b2a5a', hor: '#34447a', glow: '#7f95e6', sun: '#a8bfff', hemiS: '#7d93e0', hemiG: '#3a4670', cloud: '#56649a', cloudE: '#1a2250', halo: 0.0, sunI: 0, moonI: 0.75, hemiI: 1.25, fillI: 0.3, exp: 1.08, bloom: 0.6, star: 1, night: 1 },
  dawnBlue: { top: '#22357a', mid: '#4f62a8', hor: '#a596c8', glow: '#c99fd4', sun: '#b9c4ff', hemiS: '#93a0dc', hemiG: '#4d5878', cloud: '#8986bd', cloudE: '#2c2a5a', halo: 0.35, sunI: 0, moonI: 0.35, hemiI: 1.25, fillI: 0.3, exp: 1.06, bloom: 0.5, star: 0.55, night: 0.8 },
  dawnPink: { top: '#4f74bf', mid: '#9ba7da', hor: '#ffc2b4', glow: '#ffae8a', sun: '#ffc09a', hemiS: '#c7c6ef', hemiG: '#8d8f88', cloud: '#ffc4c8', cloudE: '#5a3a6a', halo: 0.75, sunI: 0, moonI: 0, hemiI: 1.32, fillI: 0.35, exp: 1.02, bloom: 0.42, star: 0.12, night: 0.5 },
  sunrise: { top: '#63a0e2', mid: '#b5cff0', hor: '#ffd8b0', glow: '#ffc68e', sun: '#ffc890', hemiS: '#d2e2ff', hemiG: '#a9c292', hemiI: 1.45, cloud: '#fff0e2', cloudE: '#6a5a78', halo: 0.6, sunI: 1.7, moonI: 0, fillI: 0.42, exp: 1, bloom: 0.32, star: 0, night: 0.12 },
  morning: { top: '#5ea8ec', mid: '#a7d6f7', hor: '#eff1e6', glow: '#fff4d8', sun: '#fff0d8', hemiS: '#d6ebff', hemiG: '#b4d39a', cloud: '#ffffff', cloudE: '#5d6a8a', halo: 0.3, sunI: 2.15, moonI: 0, hemiI: 1.55, fillI: 0.45, exp: 1, bloom: 0.26, star: 0, night: 0 },
  day: { top: '#6aaeea', mid: '#acd8f6', hor: '#f4ead9', glow: '#fff0cc', sun: '#ffefd6', hemiS: '#d6ebff', hemiG: '#b4d39a', cloud: '#ffffff', cloudE: '#5d6a8a', halo: 0.25, sunI: 2.25, moonI: 0, hemiI: 1.55, fillI: 0.45, exp: 1, bloom: 0.28, star: 0, night: 0 },
  afternoon: { top: '#5c9ce0', mid: '#b2d3ef', hor: '#fbe2bf', glow: '#ffdf9e', sun: '#ffdca2', hemiS: '#e2e4f2', hemiG: '#c2c88f', cloud: '#fff4e2', cloudE: '#6a6080', halo: 0.4, sunI: 2.15, moonI: 0, hemiI: 1.5, fillI: 0.45, exp: 1, bloom: 0.3, star: 0, night: 0 },
  golden: { top: '#6a8ed2', mid: '#e6c6c4', hor: '#ffc488', glow: '#ffae6c', sun: '#ffb46e', hemiS: '#efd3d6', hemiG: '#c8a888', cloud: '#ffd2aa', cloudE: '#7a4a6a', halo: 0.75, sunI: 1.95, moonI: 0, hemiI: 1.45, fillI: 0.42, exp: 1, bloom: 0.36, star: 0, night: 0.1 },
  sunset: { top: '#cf6fa8', mid: '#ee8fae', hor: '#ffb08a', glow: '#ff9a66', sun: '#ff9c66', hemiS: '#f0b0c8', hemiG: '#a07882', cloud: '#e8708e', cloudE: '#7a3456', halo: 1, sunI: 1.25, moonI: 0, hemiI: 1.38, fillI: 0.38, exp: 1, bloom: 0.45, star: 0, night: 0.38 }, // 그림(docs/ref)처럼 위는 분홍, 아래는 살구·주황, 짙은 분홍 구름
  dusk: { top: '#1f2b6c', mid: '#4b4b98', hor: '#9878b0', glow: '#c47ea8', sun: '#b9a6ff', hemiS: '#8e90da', hemiG: '#4c4a6a', cloud: '#7e6ca6', cloudE: '#2a2452', halo: 0.55, sunI: 0, moonI: 0, hemiI: 1.28, fillI: 0.32, exp: 1.06, bloom: 0.52, star: 0.35, night: 0.82 },
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const PAL = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, [...COLORS.flatMap((c) => hex(v[c])), ...NUMS.map((n) => v[n])]]));
// 키프레임: [기준(해뜸 r / 남중 n / 해짐 s), 시간 차(h), 팔레트]. 이 범위 밖은 밤
const KEYS = [['r', -2.0, 'night'], ['r', -1.2, 'dawnBlue'], ['r', -0.45, 'dawnPink'], ['r', 0.3, 'sunrise'], ['r', 1.6, 'morning'], ['n', -1.2, 'day'], ['n', 1.0, 'day'], ['s', -2.2, 'afternoon'], ['s', -0.8, 'golden'], ['s', 0, 'sunset'], ['s', 0.6, 'dusk'], ['s', 1.5, 'night']];
export const keyTimes = (t) => KEYS.map(([a, o]) => (a === 'r' ? t.rise : a === 'n' ? t.noon : t.set) + o);

export function newState() {
  const s = { key: '' };
  for (const c of COLORS) s[c] = [0, 0, 0];
  for (const n of NUMS) s[n] = 0;
  return s;
}
// 시각(h) → 분위기 값을 out 에 채움 (키프레임 사이는 부드럽게, 할당 없음). times = keyTimes(sunTimes(doy))
export function skyState(h, times, out) {
  let a = PAL.night, b = PAL.night, u = 0, key = 'night';
  for (let i = 0; i < times.length - 1; i++) {
    if (h >= times[i] && h < times[i + 1]) {
      a = PAL[KEYS[i][2]]; b = PAL[KEYS[i + 1][2]];
      const x = (h - times[i]) / (times[i + 1] - times[i]);
      u = x * x * (3 - 2 * x); key = u < 0.5 ? KEYS[i][2] : KEYS[i + 1][2];
      break;
    }
  }
  let j = 0;
  for (const c of COLORS) { const o = out[c]; for (let k = 0; k < 3; k++, j++) o[k] = a[j] + (b[j] - a[j]) * u; }
  for (const n of NUMS) { out[n] = a[j] + (b[j] - a[j]) * u; j++; }
  out.key = key;
  return out;
}

/* ───── 시간 흐름: 실시간 / ?t=HH:MM 고정 / ?speed=N 배속 / 설정 메뉴 고정 ───── */
export const MODES = { live: '🕒 실시간', morning: '🌅 아침', day: '☀️ 낮', sunset: '🌇 노을', night: '🌙 밤' };
const PRESET = { morning: (t) => t.rise + 1.3, day: (t) => t.noon + 0.3, sunset: (t) => t.set - 0.15, night: () => 22 };
export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] + +m[2] / 60 : null;
}
// 반환: 지금 실제 ms → 마을의 ms. 그날(KST) 0시 기준으로 시각만 바꿈
export function makeClock({ t = null, speed = null, mode = 'live', now = Date.now() } = {}) {
  let h = parseHM(t);
  if (h == null && PRESET[mode]) h = PRESET[mode](sunTimes(kstParts(now).doy));
  const sp = Math.min(Math.max(Number(speed) || 1, 1), 10000);
  const start = h == null ? now : now - kstHours(now) * 3.6e6 + h * 3.6e6;
  if (sp > 1) return (ms) => start + (ms - now) * sp;
  return h == null ? (ms) => ms : () => start;
}

// 시계 칩 글자: "🌇 오후 5:20"
const ICON = { night: '🌙', dawnBlue: '🌌', dawnPink: '🌅', sunrise: '🌅', morning: '🌤', day: '☀️', afternoon: '🌤', golden: '🌇', sunset: '🌇', dusk: '🌆' };
export function clockLabel(ms, key) {
  const { h, mi } = kstParts(ms);
  return `${ICON[key] ?? '☀️'} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(mi).padStart(2, '0')}`;
}
