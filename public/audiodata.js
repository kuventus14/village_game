// 소리 순수 규칙 (브라우저·시험이 같이 씀, WebAudio 없음): 배경음악 설정 기본값 · 구역·낮밤에 따라 곡을 섞는 비율
import { PARK, RIDE_SLOTS, slotRect, ENTRY_PLAZA, parkPathNear, parkRoadNear, bridgeH } from './parkdata.js';
import { BUILDINGS, BX, inside, inTown, inYard, FOUNTAIN, POND, SACRED_YARDS, TAG, DODGE, trailNear } from './world.js';
import { inClearing, campNear } from './campdata.js';
import { PATHS } from './nature.js';

export const BGM_KEY = 'village.bgm';
export const BGM_MAX = 0.4; // 슬라이더 100% 일 때 배경음악 크기 (기본 40% → 0.16, 효과음보다 작게)
export const BGM_DEFAULT = { on: true, vol: 0.4 }; // 저장된 값이 없을 때만 (사용자 확인: 40%)
export const FADE_TAU = 1.2; // 곡 크기를 바꿀 때 시간 상수(초): 3배(3.6초)면 95% → 구역 전환 3~4초 크로스페이드
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 기기에 저장된 글자 → 설정 (깨졌거나 이상한 값이면 기본값)
export function bgmSettings(raw) {
  let o = {};
  try { o = JSON.parse(raw || '{}') || {}; } catch {}
  return { on: typeof o.on === 'boolean' ? o.on : BGM_DEFAULT.on, vol: Number.isFinite(o.vol) ? clamp(o.vol, 0, 1) : BGM_DEFAULT.vol };
}
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 건물 안: 카페·회사는 벽 너머처럼 작고 먹먹하게(저역만), 카지노는 더 작게(슬롯 소리 위주), 성당·교회·사찰 안은 끔(의식 소리·고요함)
export const INDOOR = { cafe: { g: 0.45, lp: 650 }, office: { g: 0.45, lp: 650 }, casino: { g: 0.3, lp: 900 }, cathedral: { g: 0, lp: 650 }, church: { g: 0, lp: 650 }, temple: { g: 0, lp: 650 } };
// 놀이공원 부지 안쪽으로 들어간 거리 (밖이면 음수): 정문 12m 밖부터 18m 안까지 서서히 놀이공원 곡으로
export const parkDepth = (x, z) => Math.min(x - PARK.x0, PARK.x1 - x, z - PARK.z0, PARK.z1 - z);
const RECTS = Object.values(RIDE_SLOTS).map(slotRect);
// 가장 가까운 기구 자리(네모)까지 거리 (안이면 0)
export const rideDist = (x, z) => Math.min(...RECTS.map(([x0, z0, x1, z1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1))));

// 섞는 비율: w = 곡마다 몫(합 1), gain = 곡마다 크기(√w, 서로 다른 곡을 섞을 때 전체 크기가 출렁이지 않게),
// master = 건물·기구 근처로 줄이는 배수, lp = 먹먹하게 거르는 주파수, nk = 밤 정도(곡 안 악기 바꿈용)
export function bgmMix({ night = 0, x = 0, z = 0, pl = 'town', inKey = null } = {}) {
  const nk = smooth(0.25, 0.75, night); // 해질녘·새벽에 낮 곡 ↔ 밤 곡이 서서히 바뀜
  const forest = !inKey && (pl === 'trail' || pl === 'temple' || pl === 'camp') ? 1 : 0; // 숲길·사찰 마당·불멍 공터: 고요한 숲 소리
  const park = forest ? 0 : smooth(-12, 18, parkDepth(x, z));
  const rest = (1 - forest) * (1 - park);
  const w = { day: rest * (1 - nk), night: rest * nk, park, forest };
  const gain = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Math.sqrt(v)]));
  const room = INDOOR[inKey] || { g: 1, lp: 20000 };
  const C = RIDE_SLOTS.carousel, dc = Math.hypot(x - C.x, z - C.z);
  const duck = park > 0 ? (1 - 0.35 * park * (1 - smooth(4, 26, rideDist(x, z)))) * (1 - 0.6 * park * (1 - smooth(12, 45, dc))) : 1; // 기구 가까이선 그 기구 소리가 들리게 살짝 줄임 · 회전목마 오르골(다른 빠르기 왈츠)과는 겹치지 않게 더 줄임
  return { w, gain, nk, master: room.g * duck, lp: room.lp };
}

/* ── 효과음 2단계 순수 규칙 ── */
// 바닥 재질: 발소리 소리를 고름. 건물 안 → 마을(광장·앞마당 돌, 오솔길 흙, 나머지 잔디) → 사찰 마당 → 불멍 공터 → 놀이공원(대로·기구 길 벽돌, 동물원 길 흙, 나머지 잔디) → 가는 길 흙 → 숲길(흙+낙엽)
const ROOM = { cafe: 'wood', office: 'wood', casino: 'carpet', cathedral: 'hall', church: 'hall', temple: 'maru' };
export const SURFACES = ['stone', 'brick', 'hall', 'grass', 'dirt', 'forest', 'wood', 'maru', 'carpet'];
const segDist = (x, z, [ax, az], [bx, bz]) => { const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1e-9))); return Math.hypot(x - ax - ex * t, z - az - ez * t); };
export function surfaceAt(x, z) {
  for (const k in ROOM) if (inside(BUILDINGS[k], x, z)) return ROOM[k];
  if (inTown(x, z)) {
    if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 10.2) return 'stone';
    for (const [x0, z0, x1, z1] of Object.values(SACRED_YARDS)) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return 'stone';
    for (const [pts, w] of PATHS) for (let i = 0; i < pts.length - 1; i++) if (segDist(x, z, pts[i], pts[i + 1]) <= w / 2 + 0.3) return 'dirt';
    const dp = Math.hypot(x - POND.x, z - POND.z); if (dp > POND.r - 0.4 && dp < POND.r + 0.9) return 'dirt';
    for (const g of [TAG, DODGE]) if (Math.hypot(x - g.pad.x, z - g.pad.z) < g.pad.r + 0.9) return 'dirt';
    return Math.hypot(x + 12, z - 19.2) < 3.6 ? 'dirt' : 'grass';
  }
  if (inYard(x, z, 0)) return 'dirt';
  if (inClearing(x, z)) return 'forest';
  if (x >= PARK.x0 && x <= PARK.x1 && z >= PARK.z0 && z <= PARK.z1) {
    const E = ENTRY_PLAZA; if (x >= E.x0 && x <= E.x1 && z >= E.z0 && z <= E.z1) return 'brick';
    const p = parkPathNear(x, z); return p.d <= 0.3 ? (p.p.kind === 'zoo' ? 'dirt' : 'brick') : 'grass';
  }
  if (x < -BX) { const r = parkRoadNear(x, z); if (r.d <= r.hw + 0.5) return bridgeH(r.s) > 0.3 ? 'brick' : 'dirt'; } // 호수 위 돌다리는 돌 소리
  const t = trailNear(x, z), c = campNear(x, z);
  return t.d <= t.hw + 0.5 || c.d <= c.hw + 0.5 ? 'forest' : 'grass';
}
// 발걸음: 아바타 걷기 위상(avatar.js animate 의 a.phase, 걸을 때 1초에 11 라디안)이 π 의 배수를 지날 때마다 한 걸음 = 다리 그림과 딱 맞음
export const STEP_RATE = 11 / Math.PI; // 1초에 약 3.5걸음 (걷기·달리기 모두 같은 다리 빠르기 — 달리기는 소리만 세고 짧게)
export const stepCount = (ph0, ph1) => Math.max(0, Math.floor(ph1 / Math.PI) - Math.floor(ph0 / Math.PI));
export const footOf = (ph) => Math.floor(ph / Math.PI) & 1; // 0 왼발 · 1 오른발
// 거리·좌우: 듣는 사람(카메라) 위치 (lx,lz)·오른쪽 방향 (rx,rz) → 크기 g(가까우면 1, range 에서 0)·팬(-1 왼쪽 ~ 1 오른쪽)
export function spatial(lx, lz, rx, rz, x, z, range) {
  const dx = x - lx, dz = z - lz, d = Math.hypot(dx, dz);
  const g = d <= 1.5 ? 1 : Math.max(0, 1 - (d - 1.5) / Math.max(1e-6, range - 1.5)) ** 1.6;
  return { d, g, pan: Math.max(-1, Math.min(1, (dx * rx + dz * rz) / Math.max(d, 2))) * 0.85 };
}
// 동시에 나는 소리 수 상한 + 같은 소리 쿨다운 (소음·CPU 방지). now·dur 는 초
export function makeVoices(max = 24) {
  const ends = [], last = new Map();
  return {
    take(now, dur, key, cd = 0) {
      if (key != null && last.has(key) && now - last.get(key) < cd) return false;
      for (let i = ends.length - 1; i >= 0; i--) if (ends[i] <= now) ends.splice(i, 1);
      if (ends.length >= max) return false;
      ends.push(now + dur); if (key != null) last.set(key, now); return true;
    },
    active(now) { return ends.filter((e) => e > now).length; },
  };
}
// 가까운 것 n 개 (range 안, 가까운 순)
export function nearestN(list, x, z, n, range) {
  return list.map((o) => [o, Math.hypot(o.x - x, o.z - z)]).filter(([, d]) => d <= range).sort((a, b) => a[1] - b[1]).slice(0, n).map(([o]) => o);
}
