// 서버와 브라우저가 같이 쓰는 마을 설계도: 건물·가구·충돌·구역·상태 목록
import { CAMP_TOWN_PATH, FIRE, CLEAR_R, CAMP_SEATS, CAMP_CIRCLES, inClearing, campNear, campDist, campWalk } from './campdata.js';
export * from './campdata.js'; // 불멍 캠프 (아래 '불멍 캠프' 묶음 두 곳)
import { PARK, PARK_TOWN_PATH, PARK_RECTS, PARK_CIRCLES, PARK_BENCHES, inPark, inZoo, parkRoadNear, parkDist, parkWalk } from './parkdata.js';
import { ZOO_RECTS, ZOO_CIRCLES } from './zoodata.js';
import { RIDE_RECTS, RIDE_CIRCLES, RIDE_STATUS } from './ridesdata.js';
export * from './parkdata.js'; export * from './zoodata.js'; export * from './ridesdata.js'; // 포근 놀이공원·동물원·놀이기구 (아래 '포근 놀이공원' 묶음 두 곳, 약속은 docs/PARK.md)
export const BOUND = 44; // 걸어 다닐 수 있는 반쪽 크기(울타리 위치)
export const OUTFITS = ['#ff6b81', '#ff9f43', '#ffd43b', '#51cf66', '#22b8cf', '#4dabf7', '#9775fa', '#f783ac'];
export const HAIRS = ['#2b2118', '#4a3326', '#7a4b2a', '#e9b44c', '#d9480f', '#f06595', '#4c6ef5', '#ced4da', '#8e5bd9'];
export const SKINS = ['#ffe6d5', '#ffdcc0', '#f6c9a0', '#e8b088', '#c98f66', '#8d5a3c'];
export const BOTTOMS = ['#51648c', '#3a3a46', '#c9b48a', '#f2f0ea', '#7a5c46', '#9ab0d6'];
// 아바타 꾸미기: 저장은 전부 작은 정수 번호 (hs 머리모양, hc 머리색, ey 눈, sk 피부, os 옷스타일, oc 옷색, bc 바지색, ac 악세서리)
export const OPT = {
  hs: ['짧은 머리', '단정 컷', '양갈래', '긴 생머리', '포니테일', '똥머리', '단발 보브', '곱슬 뭉게'],
  ey: ['동글동글', '큰 눈', '강아지 눈', '고양이 눈', '웃는 눈', '졸린 눈'],
  os: ['티셔츠', '후드티', '원피스', '셔츠·넥타이', '멜빵바지'],
  ac: ['없음', '동그란 안경', '선글라스', '비니', '야구모자', '곰돌이 띠'],
};
const RANGE = { hs: OPT.hs.length, hc: HAIRS.length, ey: OPT.ey.length, sk: SKINS.length, os: OPT.os.length, oc: OUTFITS.length, bc: BOTTOMS.length, ac: OPT.ac.length };
export const defaultAvatar = (g = 'm') => (g === 'f'
  ? { g, hs: 2, hc: 1, ey: 0, sk: 1, os: 2, oc: 7, bc: 0, ac: 0 }
  : { g, hs: 0, hc: 1, ey: 0, sk: 1, os: 0, oc: 5, bc: 0, ac: 0 });
// 서버·브라우저 어디서든 이상한 값은 기본값으로 바꿔 줌
export function cleanAvatar(a) {
  const d = defaultAvatar(a?.g === 'f' ? 'f' : 'm'), o = { g: d.g };
  for (const k in RANGE) o[k] = Number.isInteger(a?.[k]) && a[k] >= 0 && a[k] < RANGE[k] ? a[k] : d[k];
  return o;
}
// 머리·옷은 성별에 맞는 것 중에서만 뽑음 (OPT 번호: hs 0 짧은 머리·1 단정 컷 / 2~7 양갈래·긴 생머리·포니테일·똥머리·단발·곱슬, os 2 원피스·3 셔츠넥타이, ac 5 곰돌이 띠)
const PICK = { m: { hs: [0, 1], os: [0, 1, 3, 4], ac: [0, 1, 2, 3, 4] }, f: { hs: [2, 3, 4, 5, 6, 7], os: [0, 1, 2, 4], ac: [0, 1, 2, 3, 4, 5] } };
export const randomAvatar = (g) => {
  const o = defaultAvatar(g), pick = PICK[g === 'f' ? 'f' : 'm'];
  for (const k in RANGE) o[k] = pick[k] ? pick[k][Math.floor(Math.random() * pick[k].length)] : Math.floor(Math.random() * RANGE[k]);
  return o;
};
export const STATUS = {
  free: ['🙂', '한가해요'],
  working: ['💼', '출근 중'],
  coffee: ['☕', '커피 타임'],
  lunch: ['🍚', '점심 중'],
  focus: ['🎧', '집중 중'],
  off: ['🌙', '퇴근!'],
  rest: ['😌', '쉬는 중'],
  slots: ['🎰', '슬롯 중'],
  poker: ['🃏', '홀덤 중'],
  bj: ['♠️', '블랙잭 중'],
  pray: ['🙏', '기도 중'],
  fish: ['🎣', '낚시 중'],
  bow: ['🙇', '절하는 중'],
  beads: ['📿', '염주 돌리는 중'],
  rosary: ['📿', '묵주기도 중'],
  candle: ['🕯️', '촛불 켜는 중'],
  confess: ['🤫', '고요히 머무는 중'],
  sing: ['🎤', '찬양 중'],
  piano: ['🎹', '연주 중'],
};
// 성당·사찰·교회 안 행동 (서버 rituals.js 가 심판, 화면은 public/rituals.js). at = 할 수 있는 SPOTS 종류, any = 그 건물 안 어디서나(자리 없이),
// ms = 한 번 하는 동작 길이, hold = 그만할 때까지, now = 바로 끝나는 토글, s = 그동안 이름표 상태. 'rosary'·'pew' 자리는 앉아 있어야 함
export const ACTS = {
  bow: { ms: 2600, at: ['cushion', 'beads', 'buddha'], s: 'bow', name: '🙇 절하기' },
  beads: { hold: 1, at: ['cushion', 'beads', 'buddha'], s: 'beads', name: '📿 염주' },
  palms: { hold: 1, at: ['cushion', 'beads', 'buddha', 'lantern'], any: 'temple', s: 'pray', name: '🤲 합장' },
  bell: { ms: 1800, at: ['bell'], name: '🔔 범종 치기' },
  lantern: { ms: 2000, at: ['lantern'], name: '🪷 연등 밝히기' },
  candle: { ms: 3200, at: ['candle'], s: 'candle', name: '🕯️ 촛불 켜기' },
  rosary: { hold: 1, at: ['rosary'], s: 'rosary', name: '📿 묵주기도' },
  cross: { ms: 2400, at: ['font'], any: 'cathedral', name: '✝️ 성호 긋기' },
  veil: { now: 1, at: ['font'], name: '🤍 미사포' },
  hymn: { now: 1, at: ['choir', 'rosary'], name: '🎶 성가 듣기' },
  confess: { hold: 1, at: ['confess'], s: 'confess', name: '🤫 고해 체험' },
  pray: { hold: 1, at: ['altar', 'cross', 'pulpit', 'pew', 'candle'], s: 'pray', name: '🙏 기도하기' },
  sing: { hold: 1, at: ['stage', 'pew'], s: 'sing', name: '🎤 찬양하기' },
  piano: { hold: 1, at: ['piano'], s: 'piano', name: '🎹 피아노' },
};
// 바닥 자세 (자세 버튼·P 키): 서 있을 때만, 움직이거나 점프하면 풀림. 저장하지 않음 (server.js 가 pose 필드로 중계, 동작은 avatar.js)
export const POSES = { sit: ['🧘', '앉기'], lie: ['🛌', '눕기'], cheer: ['🙌', '만세'], wave: ['👋', '손 흔들기'], clap: ['👏', '박수'], greet: ['🙇', '꾸벅 인사'] };
export const SEAT_SPOTS = ['rosary', 'pew']; // 앉아서 하는 자리 (SEATS 의 긴 의자와 같은 좌표)
export const ACT_STATUS = new Set(Object.values(ACTS).map((a) => a.s).filter((s) => s && s !== 'pray')); // 행동하는 동안만 쓰는 상태 (상태 메뉴엔 안 보임)
// 공동 의식 (한국 시간 정각부터 10분)
export const RITUALS = [{ place: 'temple', h: 5, name: '새벽 예불' }, { place: 'temple', h: 18, name: '저녁 예불' }, { place: 'church', h: 5, name: '새벽 예배' }, { place: 'cathedral', h: 18, name: '저녁 미사' }];
export const RITUAL_MS = 10 * 60000;
export const SONGS = [ // 교회 찬양: 직접 쓴 짧은 가사(저작권 없음). 반주 화음은 sfx.js
  { title: '새벽빛 노래', lines: ['어둠이 걷히는 새벽에', '작은 목소리 모아 불러요', '오늘도 지켜 주신 그 사랑', '감사해요 고마워요'] },
  { title: '포근한 길', lines: ['걸어온 길 돌아보면', '함께한 손 따뜻했죠', '넘어질 때 일으키신', '그 사랑을 노래해요'] },
  { title: '작은 등불', lines: ['작은 등불 하나 들고', '이웃에게 건네줄래요', '서로 비추는 마을 되어', '기쁨 가득 찰 거예요'] },
  { title: '평안의 노래', lines: ['고요한 이 시간에', '마음을 내려놓아요', '평안이 강물처럼', '우리 안에 흘러요'] },
];
export const LINE_MS = 6000; // 찬양 가사 한 줄 = 화음 2마디 (6초), 한 곡 = 4줄
export const CANDLE_SLOTS = 12, LIGHT_MS = 30 * 60000; // 촛불대마다 빈 자리 12, 촛불·연등은 30분 뒤 꺼짐
export const HYMN_MS = 5 * 60000; // 성가는 켜면 5분 동안
export const SIT_STATUS = { cafe: 'coffee', office: 'working', park: 'rest', slot: 'slots', poker: 'poker', bj: 'bj', pew: 'pray' }; // 앉은 자리 종류 → 자동 상태
export const SIT_TEXT = { cafe: '☕ 커피 마시는 중', office: '💻 일하는 중', park: '😌 쉬는 중', slot: '🎰 슬롯 도는 중', poker: '🃏 홀덤 하는 중', bj: '♠️ 블랙잭 하는 중', pew: '🙏 기도하는 중' }; // 머리 위 말풍선
export const AUTO = { office: 'working', cafe: 'coffee' }; // 건물에 들어가면 '한가해요' 에서 자동으로 바뀜
// 성당·사찰·교회 이름표 (docs/SACRED.md). 이름을 바꿀 땐 여기 한 곳만
export const SACRED = { cathedral: { name: '성당', icon: '⛪' }, temple: { name: '사찰', icon: '🛕' }, church: { name: '교회', icon: '⛪' } };
export const PLACE = { town: ['🌳', '마을'], cafe: ['☕', '카페'], office: ['🏢', '회사'], casino: ['🎰', '카지노'], trail: ['🌲', '숲길'], ...Object.fromEntries(Object.entries(SACRED).map(([k, s]) => [k, [s.icon, s.name]])), park: ['🎡', '놀이공원'], zoo: ['🦒', '동물원'] };

// 성당·교회·사찰은 아래 '설계도 → 3배' 에서 더함 (fy = 바닥 높이)
export const BUILDINGS = {
  cafe: { cx: -20, cz: -4, w: 13, d: 10, door: '+x', dw: 3.4, h: 3.6 },
  office: { cx: 22, cz: -6, w: 15, d: 12, door: '-x', dw: 3.8, h: 4.2 },
  casino: { cx: 36, cz: 31, w: 14, d: 14, door: '-z', dw: 4, h: 13 }, // 3층: 층 높이 FLOOR_H
};
export const HOUSES = [
  { x: -32, z: -26, w: 7, d: 6, c: '#ffc9d4', r: '#ef6f6c' },
  { x: -17, z: -29, w: 7, d: 6, c: '#c9e7ff', r: '#5a8fd6' },
  { x: 0, z: -30, w: 8, d: 6, c: '#fff0b3', r: '#f08c3a' },
  { x: 17, z: -29, w: 7, d: 6, c: '#d4f5d0', r: '#4fa66a' },
  { x: 32, z: -26, w: 7, d: 6, c: '#e5d4ff', r: '#8a63d2' },
];
export const FOUNTAIN = { x: 0, z: 0, r: 2.7 };
export const POND = { x: 22, z: 21, r: 5 };

const T = 0.4; // 벽 두께
const SIDE_N = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
export const sideNormal = (s) => SIDE_N[s];

// 벽 조각들 [x0,z0,x1,z1,방향]; 문 쪽은 가운데가 뚫림
export function wallRects(b) {
  const { cx, cz, w, d, door, dw } = b;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, hd = dw / 2, out = [];
  const sides = { '-z': ['x', z0], '+z': ['x', z1], '-x': ['z', x0], '+x': ['z', x1] };
  for (const s in sides) {
    const [ax, f] = sides[s];
    const a0 = ax === 'x' ? x0 : z0, a1 = ax === 'x' ? x1 : z1, c = ax === 'x' ? cx : cz;
    const spans = s === door ? [[a0, c - hd], [c + hd, a1]] : [[a0, a1]];
    for (const [s0, s1] of spans) out.push(ax === 'x' ? [s0, f - T / 2, s1, f + T / 2, s] : [f - T / 2, s0, f + T / 2, s1, s]);
  }
  return out;
}
export const doorPos = (b) => {
  const [nx, nz] = SIDE_N[b.door];
  return [b.cx + nx * b.w / 2 * (nx ? 1 : 0), b.cz + nz * b.d / 2 * (nz ? 1 : 0)];
};
export const inside = (b, x, z) => Math.abs(x - b.cx) < b.w / 2 - 0.15 && Math.abs(z - b.cz) < b.d / 2 - 0.15;
// 들어가 있는 건물 → 사찰 마당 → 숲길 → 마을 (사찰 마당은 마을 밖이라 '사찰'로 셈)
export const placeOf = (x, z) => {
  for (const k of ['cafe', 'office', 'casino', 'cathedral', 'church', 'temple']) if (inside(BUILDINGS[k], x, z)) return k;
  if (inTown(x, z)) return 'town';
  if (inYard(x, z, 0)) return 'temple';
  if (inClearing(x, z)) return 'camp';
  if (x < -BX) { if (inPark(x, z)) return inZoo(x, z) ? 'zoo' : 'park'; const r = parkRoadNear(x, z); if (r.d <= r.hw + 0.5) return 'park'; } // 놀이공원 부지·가는 길 (동물원 구역은 'zoo')
  const t = trailNear(x, z);
  return t.d <= t.hw + 0.5 || campNear(x, z).d <= campNear(x, z).hw + 0.5 ? 'trail' : 'town';
};

// 건물 안 가구. 렌더링과 충돌이 같은 표를 씀
export const FURN = [
  { k: 'counter', x: -25.3, z: -4.5, w: 1.4, d: 7 },
  { k: 'table', x: -21.5, z: -7.2, r: 0.8 },
  { k: 'table', x: -21.5, z: -0.8, r: 0.8 },
  { k: 'table', x: -17.2, z: -7.4, r: 0.8 },
  { k: 'table', x: -17.2, z: -0.6, r: 0.8 },
  { k: 'plant', x: -26, z: -8.4, r: 0.4 },
  { k: 'plant', x: -26, z: 0.4, r: 0.4 },
  ...[18.5, 22, 25.5].flatMap((x) => [
    { k: 'desk', x, z: -10.2, w: 2.4, d: 1.1, f: 1 },
    { k: 'desk', x, z: -1.8, w: 2.4, d: 1.1, f: -1 },
  ]),
  { k: 'meeting', x: 28, z: -6, w: 1.8, d: 3.6 },
  { k: 'plant', x: 15.4, z: -11.2, r: 0.4 },
  { k: 'cooler', x: 15.4, z: -0.8, r: 0.3 },
];

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const nearRect = (x, z, [x0, z0, x1, z1], m) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
const bounds = (b) => [b.cx - b.w / 2, b.cz - b.d / 2, b.cx + b.w / 2, b.cz + b.d / 2];

// ───── 마을 크기: 서·동으로만 넓힘 (남북 울타리는 그대로). BOUND(44) = 예전 마을 반쪽 크기 (예전 나무·꽃 생성에 그대로 씀)
export const BX = 120, BZ = BOUND; // 울타리: x ±120, z ±44
export const inTown = (x, z, m = 0) => Math.abs(x) <= BX - m && Math.abs(z) <= BZ - m;

// ───── 성당·교회·사찰: '설계도'(1배 좌표, 아래 D·DP)로 짓고 실제 마을엔 3배로 키워 돌려 놓음 ─────
// 실제 = c1 + 회전(th)·3·(설계도 - c0). 성당은 동쪽(광장)을, 교회는 서쪽(광장)을 보고, 광장에서 오는 큰길(z=5)이 정면 가운데 축과 일직선
export const XF = { cathedral: { c0: [-36.5, -7.5], c1: [-92, 5], th: Math.PI / 2 }, church: { c0: [37, -8.5], c1: [93.5, 5], th: -Math.PI / 2 }, temple: { c0: [270, -108], c1: [346, -158], th: 0 } }; // 사찰은 마당을 줄인 만큼 북쪽으로 옮겨 숲길 끝(마당 입구)은 그대로
for (const f of Object.values(XF)) Object.assign(f, { s: 3, co: Math.cos(f.th), si: Math.sin(f.th) });
export const toWorld = (k, x, z) => { const f = XF[k], dx = (x - f.c0[0]) * f.s, dz = (z - f.c0[1]) * f.s; return [f.c1[0] + dx * f.co + dz * f.si, f.c1[1] - dx * f.si + dz * f.co]; };
export const toDesign = (k, X, Z) => { const f = XF[k], ox = (X - f.c1[0]) / f.s, oz = (Z - f.c1[1]) / f.s; return [f.c0[0] + ox * f.co - oz * f.si, f.c0[1] + ox * f.si + oz * f.co]; };
const wRect = (k, [x0, z0, x1, z1]) => { const a = toWorld(k, x0, z0), b = toWorld(k, x1, z1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
const wSide = (k, sd) => { const [nx, nz] = SIDE_N[sd], f = XF[k], wx = nx * f.co + nz * f.si, wz = -nx * f.si + nz * f.co; return Math.abs(wx) > 0.5 ? (wx > 0 ? '+x' : '-x') : wz > 0 ? '+z' : '-z'; };
// 설계도 본당 (fy = 바닥 높이; 3배 해도 걷는 높이 차이가 3m 를 넘지 않게 낮게 잡음)
const D = {
  cathedral: { cx: -36.5, cz: -6.5, w: 13, d: 16, door: '+z', dw: 2.6, h: 9.5, fy: 0.9 }, // 그림(3/4 구도)처럼 본당을 길게: 뒤벽은 그대로, 앞을 2 내밂
  church: { cx: 37, cz: -8.5, w: 12, d: 17, door: '+z', dw: 2.4, h: 7.5, fy: 0.9 }, // 그림(겉·속)에 맞춰 넓고 낮게 // 실내 그림(양옆 2층 발코니)에 맞춰 넓힘 // 벽돌·회벽 본당 (종탑·날개채는 양옆)
  temple: { cx: 270, cz: -121, w: 20, d: 12, door: '+z', dw: 5, h: 7.0, fy: 2.0 }, // 높은 돌 축대(실제 6m) 위 대웅전 // 실내 그림(안쪽 기둥 두 줄)에 맞춰 깊게 // 대웅전: 축대 위
};
const TYD = { cx: 270, cz: -114, w: 30, d: 28, terrace: -114, th: 2.0 }; // 사찰 마당 설계도 (그림처럼 작게: 실제 90×84, 북쪽 14 는 높은 축대)
// 사람 크기 긴 의자 줄: 가운데 통로(실제 2.4m) 양옆으로 한 줄에 per 석(자리 간격 실제 0.9m), rows 줄 (줄 간격 pitch). 설계도 단위 = 실제의 1/3
function pewRows(cx, z0, rows, pitch, per) {
  const out = [], w = per * 0.3;
  for (let i = 0; i < rows; i++) for (const s of [-1, 1]) out.push({ x: cx + s * (0.4 + w / 2), z: z0 + i * pitch, w, n: per });
  return out;
}
export const pewSeats = (p) => Array.from({ length: p.n }, (_, k) => [p.x - p.w / 2 + (k + 0.5) * p.w / p.n, p.z]);
// 사찰 법당 방석: 가운데 통로 양옆 (실제 1.8m 간격) + 기둥 줄 바깥 염주 자리 (그림 interior-3)
const CUSHIONS = Array.from({ length: 10 }, (_, j) => -122 + j * 0.6).flatMap((z) => [1.2, 1.8, 2.4, 3, 3.6].flatMap((d) => [[270 - d, z], [270 + d, z]])); // 가운데 통로 양옆 5열씩 × 10줄 = 100
const BEADS = [-121.4, -120.6, -119.8, -119, -118.2, -117.4].flatMap((z) => [[264.8, z], [275.2, z]]); // 기둥 줄 바깥 측랑
// 설계도 소품 (렌더링·충돌이 같이 씀)
const DP = {
  // 성당 = 그림 3 (모래빛 고딕 쌍탑·장미창·성모상)
  cathedral: { towers: [[-47, -1.6, -43, 1.8], [-30, -1.6, -26, 1.8]], stairs: [-38.8, 1.5, -34.2, 4.6], planters: [[-41.2, 1.5, -38.8, 4.4], [-34.2, 1.5, -31.8, 4.4]],
    altar: [-37.6, -13.6, -35.4, -12.8], // 제대·불상·큰 십자가처럼 배경 구조물은 3배, 사람이 쓰는 의자·촛불대·고해실·성수대는 사람 크기(설계도의 1/3)
    // 실내 (그림 interior-2): 왼쪽 측랑 성모상 앞 촛불대 2, 오른쪽 측랑 성체 현시대 앞 촛불대 2 ([x, z, 자리가 바라보는 방향]), 측랑 벽 고해실 4, 문 안 성수대 2
    candles: [[-41.85, -11.1, -Math.PI / 2], [-41.85, -10.1, -Math.PI / 2], [-31.15, -11.1, Math.PI / 2], [-31.15, -10.1, Math.PI / 2]],
    booths: [[-42.8, -5.2, -42.4, -4.6], [-42.8, -3.9, -42.4, -3.3], [-30.6, -5.2, -30.2, -4.6], [-30.6, -3.9, -30.2, -3.3]], fonts: [[-38.6, -1.3], [-34.4, -1.3]],
    maryIn: { x: -42.45, z: -10.6, r: 0.3 }, monstrance: [-30.75, -10.95, -30.25, -10.25], sanctuary: -11.5,
    pews: pewRows(-36.5, -10.6, 9, 2.2 / 3, 6), fountain: { x: -42.5, z: 6.6, r: 1.8 }, mary: { x: -28.4, z: 7.4, r: 0.7 },
    piers: [-12.6, -10.2, -7.8, -5.4, -3].flatMap((z) => [-39.9, -33.1].map((x) => ({ x, z, r: 0.3 }))), flyers: [-13.5, -11, -8.5, -6].flatMap((z) => [-45.2, -27.8].map((x) => ({ x, z, r: 0.32 }))), yard: [-47, 1.5, -26, 8.5] }, // piers = 신자석·측랑을 나누는 기둥 다발, flyers = 바깥 부벽 기둥
  // 교회 = 그림 1 (붉은 벽돌·크림 회벽·오른쪽 종탑·양옆 날개채 회랑)
  church: { wingW: [26, -10, 31, -0.8], tower: [43, -3.6, 45.9, 0.3], wingE: [45.9, -10, 49.9, -0.8], stairs: [34.6, 0, 39.4, 2.6], rails: [[33.9, 0, 34.6, 2.4], [39.4, 0, 40.1, 2.4]], // 날개채: 정면 가까이 양옆으로 (2층)
    stage: [31.5, -17, 42.5, -13.4], pulpit: [36.83, -13.95, 37.17, -13.78], piano: [39.6, -15.5, 40.15, -15.3],
    cols: [-12, -9.6, -7.2, -4.8, -2.4].flatMap((z) => [34.3, 39.7].map((x) => ({ x, z, r: 0.15 }))), planters: [[32.7, -1.3, 33.6, -0.2], [40.4, -1.3, 41.3, -0.2]], // cols = 발코니 받치는 흰 기둥
    pews: pewRows(37, -12.6, 9, 2.6 / 3, 7), fountain: { x: 30.6, z: 4.0, r: 1.6 }, yard: [26, 0, 50, 6.5] },
  // 사찰 = 그림 2. 축선: 일주문 → 석등 → 석탑 → 큰 돌계단 → 대웅전 (천왕문은 그림에 없어서 뺌)
  // 그림 2 배치: 높은 축대 가운데 큰 돌계단, 계단 아래 연꽃 석등 한 쌍 + 앞쪽 한 쌍, 가운데 작은 석탑, 오른쪽 앞 범종각, 왼쪽·오른쪽 뒤 전각
  temple: { stairs: [265.5, -114, 274.5, -109.2], hallL: [255.5, -113.5, 261, -105], hallR: [279, -113.5, 285, -108.5], bellDeck: [277.5, -107.5, 283.5, -101.5], bellStairs: [275.5, -106, 277.5, -103], bell: { x: 280.5, z: -104.5, r: 0.75 },
    pagoda: [268.5, -107.5, 271.5, -104.5], lanterns: [[263.5, -110.5], [276.5, -110.5], [264.5, -102.5], [274, -102.5]], gate: [[265.2, -100.6], [274.8, -100.6]],
    buddha: [268.4, -126.6, 271.6, -124.6], altar: [268.6, -124.2, 271.4, -123.5], dais: [264.5, -126.8, 275.5, -124.4], cushions: CUSHIONS, beads: BEADS,
    inCols: [-125.4, -122.6, -119.8, -117].flatMap((z) => [265.8, 274.2].map((x) => ({ x, z, r: 0.36 }))), standLamps: [[265.2, -124], [274.8, -124], [265.2, -118.4], [274.8, -118.4], [261, -125.5], [279, -125.5], [261, -116.5], [279, -116.5]] }, // 법당 안 기둥 두 줄·서 있는 등롱
};
// 렌더링(sacred.js)이 쓰는 설계도 묶음
export const SACRED_DESIGN = { B: D, P: DP, TY: TYD };
export const SACRED_PROPS = DP;
// 실제 마을의 건물 (게임 카메라·placeOf·이름표가 씀). 충돌·발 높이는 설계도 좌표에서 계산(아래 sacredCollide·floorY)
for (const k of ['cathedral', 'church', 'temple']) {
  const b = D[k], f = XF[k], [cx, cz] = toWorld(k, b.cx, b.cz), rot = Math.abs(f.si) > 0.5;
  BUILDINGS[k] = { cx, cz, w: (rot ? b.d : b.w) * f.s, d: (rot ? b.w : b.d) * f.s, door: wSide(k, b.door), dw: b.dw * f.s, h: b.h * f.s, fy: b.fy * f.s };
}
{ const [cx, cz] = toWorld('temple', TYD.cx, TYD.cz); var TY = { cx, cz, w: TYD.w * 3, d: TYD.d * 3, th: TYD.th * 3 }; }
export const TEMPLE_YARD = TY; // 실제 사찰 마당 120×120
export const inYard = (x, z, m = 0.5) => Math.abs(x - TY.cx) <= TY.w / 2 - m && Math.abs(z - TY.cz) <= TY.d / 2 - m;
// 단지 전체 상자 (설계도 → 실제): 충돌·발 높이를 계산할 범위
const DBOX = { cathedral: [-48, -15.2, -25, 9], church: [25.5, -17.7, 50.5, 7], temple: [TYD.cx - TYD.w / 2 - 0.5, TYD.cz - TYD.d / 2 - 0.5, TYD.cx + TYD.w / 2 + 0.5, TYD.cz + TYD.d / 2 + 0.5] };
export const SACRED_BOXES = Object.fromEntries(Object.entries(DBOX).map(([k, r]) => [k, wRect(k, r)]));
// 광장 → 성당·교회 큰길 (정면 축과 일직선, 돌바닥) + 앞마당
export const AVENUES = { cathedral: [-51, 1.6, -11, 8.4], church: [11, 1.6, 49, 8.4] };
export const SACRED_YARDS = { cathedral: wRect('cathedral', DP.cathedral.yard), church: wRect('church', DP.church.yard), cathedralAve: AVENUES.cathedral, churchAve: AVENUES.church };
// 정면(문 가운데)과 바깥을 보는 방향 + 높이: 그 앞에 서면 카메라가 살짝 올려다봄 (game.js)
export const FACADES = ['cathedral', 'church', 'temple'].map((k) => { const b = BUILDINGS[k], [nx, nz] = SIDE_N[b.door]; return { k, x: b.cx + nx * b.w / 2, z: b.cz + nz * b.d / 2, nx, nz, h: b.h }; });

// ───── 숲길: 마을 동쪽 대문 → 굽이진 길 → 사찰 일주문 (가운데 선 + 반쪽 폭 hw, 돌다리에선 좁아짐) ─────
export const GATE = { x: BX, z: -34, hw: 4.5 }; // 동쪽 울타리에 뚫린 대문 (교회 북쪽, z -34±4.5)
const TRAIL_CP = [[24, 12], [44, 12], [64, 18], [82, 34], [102, 52], [122, 46], [136, 26], [148, 10], [164, 4], [182, 2], [196, -10], [206, -28], [220, -46], [240, -52], [258, -56], [268, -70], [270, -88], [270, -108]].map(([x, z]) => [x + 76, z - 46]);
function catmull(cp, n = 12) { // 점들을 지나는 부드러운 곡선 (양 끝 점은 방향만 잡음)
  const out = [];
  for (let i = 1; i < cp.length - 2; i++) for (let k = 0; k < n; k++) {
    const [p0, p1, p2, p3] = [cp[i - 1], cp[i], cp[i + 1], cp[i + 2]], t = k / n, t2 = t * t, t3 = t2 * t;
    out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
  }
  out.push(cp[cp.length - 2]);
  return out;
}
const pts = catmull(TRAIL_CP), acc = [0];
for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
const bi = pts.reduce((b, p, i) => (Math.abs(p[0] - 248) < Math.abs(pts[b][0] - 248) ? i : b), 0); // 돌다리: 길 가운데쯤
const smoothW = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// pts[i] = [x, z], s = 대문부터 걸은 거리, hw = 반쪽 폭 (다리 위 2.4, 다리 앞뒤 4m 동안 넓어짐)
export const TRAIL = { pts, s: acc, len: acc.at(-1), hw: acc.map((s) => 4.5 - 2.1 * (1 - smoothW(4.5, 8.5, Math.abs(s - acc[bi])))), bridge: { i: bi, s: acc[bi], x: pts[bi][0], z: pts[bi][1] } };
{ const [a, b] = [pts[bi - 1], pts[bi + 1]]; TRAIL.bridge.ry = Math.atan2(b[0] - a[0], b[1] - a[1]); } // 다리가 놓인 방향 (길 방향)
// 가장 가까운 길 가운데 점: d = 거리, hw = 그 자리 반쪽 폭, s = 대문부터 거리, (tx,tz) = 길 방향
export function trailNear(x, z) {
  let best = { d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)), px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) { const l = Math.sqrt(l2); best = { d, px, pz, i, hw: TRAIL.hw[i] + (TRAIL.hw[i + 1] - TRAIL.hw[i]) * t, s: acc[i] + l * t, tx: ex / l, tz: ez / l }; }
  }
  return best;
}
// 시내: 돌다리 아래를 남북으로 흐름 (길과는 다리에서 한 번만 만남)
const B0 = TRAIL.bridge;
export const STREAM = catmull([[B0.x + 2, B0.z - 95], [B0.x + 6, B0.z - 70], [B0.x - 4, B0.z - 40], [B0.x + 3, B0.z - 15], [B0.x, B0.z], [B0.x - 3, B0.z + 15], [B0.x + 5, B0.z + 40], [B0.x - 2, B0.z + 70], [B0.x + 2, B0.z + 95]], 8);
export const streamDist = (x, z) => {
  let d = Infinity;
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i], [bx, bz] = STREAM[i + 1], ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return d;
};
// 대문 가는 마을 길 (광장 북동쪽 골목 → 교회 북쪽 → 동쪽 대문)
export const GATE_PATH = [[30, -16.3], [40, -24], [60, -30], [BX - 2, GATE.z], [BX + 4, GATE.z]];

// 나무·꽃을 치울 곳: 세 단지·큰길·대문 가는 길
const SACRED_CLEAR = [...Object.values(SACRED_BOXES).map(([a, b, c, d]) => [a - 3, b - 3, c + 3, d + 3]), ...Object.values(AVENUES), [28, -38, BX, -14]];
const cleared = (x, z, m = 0) => SACRED_CLEAR.some((r) => nearRect(x, z, r, m));

// ── 설계도 좌표의 발 높이·충돌 (실제 좌표 → 설계도로 바꿔 계산하고 높이는 3배)
// 발 딛는 높이: [x0,z0,x1,z1,h0,h1,ax] ax 가 있으면 그 방향으로 h0→h1 경사(계단)
const T5 = TYD.terrace, [sx0, , sx1] = DP.temple.stairs, BD = DP.temple.bellDeck, BS = DP.temple.bellStairs;
const DFLOORS = {
  cathedral: [[...bounds(D.cathedral), 0.9, 0.9], [...DP.cathedral.stairs, 0.9, 0, 'z'], [D.cathedral.cx - D.cathedral.w / 2 + 0.2, D.cathedral.cz - D.cathedral.d / 2 + 0.2, D.cathedral.cx + D.cathedral.w / 2 - 0.2, DP.cathedral.sanctuary, 1.0, 1.0]], // 제단 구역은 한 단(0.3m) 높음
  church: [[...bounds(D.church), 0.9, 0.9], [...DP.church.stairs, 0.9, 0, 'z'], [...DP.church.stage, 1.0, 1.0]],
  temple: [[TYD.cx - TYD.w / 2, TYD.cz - TYD.d / 2, TYD.cx + TYD.w / 2, T5, TYD.th, TYD.th], [...DP.temple.stairs, TYD.th, 0, 'z'], [...BD, 0.9, 0.9], [...BS, 0, 0.9, 'x']],
};
const brd = TRAIL.bridge, WFLOORS = [[brd.x - 3.4, brd.z - 3, brd.x + 3.4, brd.z + 3, 0.22, 0.22]]; // 돌다리 판
const flo = (list, x, z) => { let y = 0; for (const [x0, z0, x1, z1, h0, h1, ax] of list) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) y = Math.max(y, ax ? h0 + (h1 - h0) * (ax === 'x' ? (x - x0) / (x1 - x0) : (z - z0) / (z1 - z0)) : h0); return y; };
export function floorY(x, z) {
  let y = flo(WFLOORS, x, z);
  for (const k in XF) if (nearRect(x, z, SACRED_BOXES[k], 0)) { const [dx, dz] = toDesign(k, x, z); y = Math.max(y, flo(DFLOORS[k], dx, dz) * XF[k].s); }
  return y;
}
export const SACRED_FLOORS = DFLOORS;
const back = (p) => [p.x - p.w / 2, p.z + 0.16, p.x + p.w / 2, p.z + 0.2]; // 의자는 등받이만 막아 앉는 자리 앞뒤로 걸어 들어감 (사람 크기)
const DRECTS = {
  cathedral: [...wallRects(D.cathedral).map((r) => r.slice(0, 4)), ...DP.cathedral.towers, ...DP.cathedral.planters, DP.cathedral.altar, ...DP.cathedral.booths, DP.cathedral.monstrance, ...DP.cathedral.pews.map(back)],
  church: [...wallRects(D.church).map((r) => r.slice(0, 4)), DP.church.wingW, DP.church.tower, DP.church.wingE, ...DP.church.rails, DP.church.pulpit, DP.church.piano, ...DP.church.planters, ...DP.church.pews.map(back)],
  temple: [...wallRects(D.temple).map((r) => r.slice(0, 4)), DP.temple.hallL, DP.temple.hallR, DP.temple.pagoda, DP.temple.buddha, DP.temple.altar, DP.temple.dais,
    [TYD.cx - TYD.w / 2, T5 - 0.2, sx0, T5 + 0.1], [sx1, T5 - 0.2, TYD.cx + TYD.w / 2, T5 + 0.1], // 축대 앞 끝 (계단만 열림)
    [sx0 - 0.2, T5, sx0, T5 + 4.6], [sx1, T5, sx1 + 0.2, T5 + 4.6], // 계단 옆 난간 (계단 끝 바로 앞까지)
    [BS[0], BS[1] - 0.2, BS[2], BS[1]], [BS[0], BS[3], BS[2], BS[3] + 0.2], // 범종각 계단 옆
    [BD[0], BD[1] - 0.15, BD[2], BD[1]], [BD[0], BD[3], BD[2], BD[3] + 0.15], [BD[2], BD[1], BD[2] + 0.15, BD[3]], // 범종각 단 북·남·동
    [BD[0] - 0.15, BD[1], BD[0], BS[1]], [BD[0] - 0.15, BS[3], BD[0], BD[3]]], // 서쪽(계단 양옆)
};
const DCIRCLES = {
  cathedral: [...DP.cathedral.candles.map(([x, z]) => ({ x, z, r: 0.1 })), ...DP.cathedral.fonts.map(([x, z]) => ({ x, z, r: 0.12 })), { ...DP.cathedral.fountain, r: DP.cathedral.fountain.r + 0.1 }, DP.cathedral.mary, DP.cathedral.maryIn, ...DP.cathedral.piers, ...DP.cathedral.flyers],
  church: [{ ...DP.church.fountain, r: DP.church.fountain.r + 0.1 }, ...DP.church.cols],
  temple: [...DP.temple.inCols, ...DP.temple.standLamps.map(([x, z]) => ({ x, z, r: 0.12 })), DP.temple.bell, ...DP.temple.lanterns.map(([x, z]) => ({ x, z, r: 0.45 })), ...[[BD[0] + 0.5, BD[1] + 0.5], [BD[2] - 0.5, BD[1] + 0.5], [BD[0] + 0.5, BD[3] - 0.5], [BD[2] - 0.5, BD[3] - 0.5]].map(([x, z]) => ({ x, z, r: 0.25 }))], // 범종각 기둥
};
export const SACRED_COLLIDE = { rects: DRECTS, circles: DCIRCLES };

// 안에서 할 행동 자리 (다음 단계가 씀). 설계도에서 정하고 실제 좌표로 바꿈. y = 발 딛는 높이, ry = 바라보는 방향 (0 = +z)
export const SPOTS = [];
const spot = (bld, kind, x, z, ry) => SPOTS.push({ id: SPOTS.length, bld, kind, x, z, ry, y: 0 });
{
  const C = DP.cathedral, H = DP.church, T = DP.temple, PI = Math.PI, CA = D.cathedral, CH = D.church, TP = D.temple;
  for (const [x, z, ry] of C.candles) spot('cathedral', 'candle', x - Math.sin(ry) * 0.4, z - Math.cos(ry) * 0.4, ry); // 촛불대 앞 실제 1.2m (rituals.js slotPos 와 같은 약속)
  for (const p of C.pews) for (const [x, z] of pewSeats(p)) spot('cathedral', 'rosary', x, z, PI);
  for (const [x, z] of C.fonts) spot('cathedral', 'font', x, z - 0.45, 0);
  for (const b of C.booths) { const left = b[0] < CA.cx; spot('cathedral', 'confess', left ? b[2] + 0.35 : b[0] - 0.35, (b[1] + b[3]) / 2, left ? -PI / 2 : PI / 2); } // 측랑 벽 고해실 앞, 고해실을 봄
  spot('cathedral', 'altar', CA.cx, C.altar[1] + 1.6, PI);
  for (const x of [-38.7, -38.1, -34.9, -34.3]) spot('cathedral', 'choir', x, -11.9, 0); // 제단 구역 양옆
  for (const p of H.pews) for (const [x, z] of pewSeats(p)) spot('church', 'pew', x, z, PI);
  spot('church', 'pulpit', CH.cx, H.pulpit[1] - 0.3, 0);
  for (const z of [-14.6, -15.2]) for (const x of [33.7, 34.25, 34.8]) spot('church', 'stage', x, z, 0); // 무대 왼쪽 합창 의자 줄
  spot('church', 'cross', CH.cx, -15.9, PI);
  spot('church', 'piano', (H.piano[0] + H.piano[2]) / 2, H.piano[3] + 0.3, PI);
  for (const [x, z] of T.cushions) spot('temple', 'cushion', x, z, PI);
  for (const [x, z] of T.beads) spot('temple', 'beads', x, z, Math.atan2(TP.cx - x, (T.buddha[1] + T.buddha[3]) / 2 - z)); // 옆줄 방석은 불상 쪽으로 돌려 앉음
  spot('temple', 'bell', T.bell.x - 1.1, T.bell.z, PI / 2);
  for (const [x, z] of T.lanterns) spot('temple', 'lantern', x + (x < TYD.cx ? 0.75 : -0.75), z, x < TYD.cx ? -PI / 2 : PI / 2);
  spot('temple', 'buddha', TP.cx, T.altar[3] + 0.8, PI);
  for (const s of SPOTS) { [s.x, s.z] = toWorld(s.bld, s.x, s.z); s.ry = Math.atan2(Math.sin(s.ry + XF[s.bld].th), Math.cos(s.ry + XF[s.bld].th)); s.y = floorY(s.x, s.z); }
}
// 사찰 '절하기' 자동 걸음: 빈 방석(cushion)을 가까운 순서로. others = 다른 사람 위치 [[x, z]…] (방석 0.35m 안에 서 있으면 쓰는 중), busy = 다른 사람이 행동 중인 자리 번호
export const ON_CUSHION = 0.35;
export const freeCushions = (x, z, others = [], busy = new Set()) => SPOTS.filter((s) => s.kind === 'cushion' && !busy.has(s.id) && !others.some(([ox, oz]) => Math.hypot(ox - s.x, oz - s.z) < ON_CUSHION))
  .map((s) => [Math.hypot(s.x - x, s.z - z), s]).sort((a, b) => a[0] - b[0]).map(([, s]) => s);

// ── 넓어진 땅에 더한 사람 크기 가로등·벤치·벚나무: 큰길 양옆 줄(원근으로 건물이 길 끝에 우뚝), 사찰 마당 가장자리
const AVE_X = { cathedral: [-30, -36, -42, -48], church: [32, 40, 46] };
const NEW_LAMPS = [...AVE_X.cathedral.flatMap((x) => [[x, 0.6], [x, 9.4]]), ...AVE_X.church.flatMap((x) => [[x, 0.6], ...(x > 38 ? [[x, 9.4]] : [])]),
  ...[[-60, -30], [-60, 30], [64, -30], [90, -36], [-4, 40], [60, 40], [-80, 38]], // 넓어진 땅 곳곳
  ...[[262.5, -101], [277.5, -100.9], [258, -114.6], [282, -114.6]].map(([x, z]) => toWorld('temple', x, z))].map(([x, z]) => ({ x, z })); // 사찰 가로등: 설계도 좌표
export const BENCHES2 = [{ x: -33, z: -0.4, ry: 0 }, { x: -45, z: 10.4, ry: Math.PI }, { x: 36.5, z: 0.0, ry: 0 }, { x: 43, z: 10.2, ry: Math.PI }, { x: -70, z: 32, ry: Math.PI }, { x: 72, z: 36, ry: Math.PI },
  ...[[262.5, -108, Math.PI / 2], [262.5, -104, Math.PI / 2], [258.5, -101.6, Math.PI / 2], [276.4, -100.9, -Math.PI / 2]].map(([x, z, ry]) => { const [X, Z] = toWorld('temple', x, z); return { x: X, z: Z, ry }; })]; // 사찰 벤치
const AVE_TREES = [...[-33, -39, -45].flatMap((x) => [[x, -0.6], [x, 10.6]]), ...[43].flatMap((x) => [[x, -0.6], [x, 10.6]])];
// 광장 둘레 가로등·벤치
export const LAMPS = [...Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + 0.39;
  return { x: Math.sin(a) * 9.6, z: Math.cos(a) * 9.6 };
}), ...NEW_LAMPS];
export const BENCHES = [
  ...Array.from({ length: 4 }, (_, i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return { x: Math.sin(a) * 6.2, z: Math.cos(a) * 6.2, ry: a + Math.PI };
  }),
  // 연못가·남서쪽 공원 벤치 (ry = 바라보는 방향)
  { x: 22, z: 14.4, ry: 0 }, { x: 14.4, z: 21, ry: Math.PI / 2 }, { x: 29.6, z: 21, ry: -Math.PI / 2 },
  { x: -12, z: 16, ry: 0 }, { x: -12, z: 22, ry: Math.PI },
];
export const STOOLS = [-6.5, -4.5, -2.5].map((z) => ({ x: -23.9, z })); // 카페 바 스툴

// ── 마을 안 놀이터 두 곳: 서 있는 '참가 패드'에 모이면 게임이 시작됨
export const TAG = { id: 'tag', name: '술래잡기', cx: -30, cz: 29, hw: 10, hd: 8, pad: { x: -30, z: 17.5, r: 2.6 }, min: 2, max: 12, dur: 90000 };
export const DODGE = { id: 'dodge', name: '물풍선 피구', cx: 4, cz: 31, hw: 10, hd: 6, pad: { x: 4, z: 21.5, r: 2.6 }, min: 2, max: 12, dur: 120000 };
export const GAMES = { tag: TAG, dodge: DODGE };
export const padOf = (x, z) => Object.values(GAMES).find((g) => Math.hypot(x - g.pad.x, z - g.pad.z) < g.pad.r)?.id ?? null;
export const fenceRects = (g) => [ // 울타리 4면 (안쪽 hw×hd 가 놀이 공간)
  [g.cx - g.hw - 0.3, g.cz - g.hd - 0.3, g.cx + g.hw + 0.3, g.cz - g.hd], [g.cx - g.hw - 0.3, g.cz + g.hd, g.cx + g.hw + 0.3, g.cz + g.hd + 0.3],
  [g.cx - g.hw - 0.3, g.cz - g.hd - 0.3, g.cx - g.hw, g.cz + g.hd + 0.3], [g.cx + g.hw, g.cz - g.hd - 0.3, g.cx + g.hw + 0.3, g.cz + g.hd + 0.3],
];
// 술래잡기 장애물: 산울타리·상자·기둥 (길은 2m 이상 남김)
const T0 = TAG, box = (dx, dz, w, d) => [T0.cx + dx - w / 2, T0.cz + dz - d / 2, T0.cx + dx + w / 2, T0.cz + dz + d / 2];
export const TAG_HEDGES = [box(-5, -3, 6, 1), box(5, 3, 6, 1), box(-6, 3.5, 1, 5), box(6, -3.5, 1, 5)];
export const TAG_CRATES = [box(0, 0, 2, 2), box(-2.5, 5.2, 1.6, 1.6), box(2.5, -5.2, 1.6, 1.6)];
export const TAG_PILLARS = [{ x: T0.cx - 6, z: T0.cz - 6.3, r: 0.7 }, { x: T0.cx + 6, z: T0.cz + 6.3, r: 0.7 }];
export const TAG_STARTS = [[-9, -6.5], [9, -6.5], [-9, 6.5], [9, 6.5], [0, -7], [0, 7], [-9, 0], [9, 0], [-3.5, -6], [3.5, 6], [-3.5, 1.5], [3.5, -1.5]].map(([dx, dz]) => [T0.cx + dx, T0.cz + dz]);
export const IT_START = [T0.cx - 1.5, T0.cz + 0.1]; // 술래 시작 위치 (가운데 상자 옆)
// 피구: 팀 0 = 왼쪽(파랑), 팀 1 = 오른쪽(빨강). 끝난 사람은 울타리 밖 외야
export const dodgeClamp = (team, x, z) => {
  const d = DODGE, m = 0.5;
  return [team === 0 ? Math.max(d.cx - d.hw + m, Math.min(d.cx - 0.5, x)) : Math.max(d.cx + 0.5, Math.min(d.cx + d.hw - m, x)), Math.max(d.cz - d.hd + m, Math.min(d.cz + d.hd - m, z))];
};
export const dodgeOut = (team, i) => [DODGE.cx + (team === 0 ? -1 : 1) * (DODGE.hw + 2.2), DODGE.cz + ((i % 6) - 2.5) * 1.4];
const GAME_BOXES = [[-41, 14.5, -19, 38.5], [-7.5, 18.5, 15.5, 39]]; // 나무·꽃을 심지 않을 곳

// 나무: 들어갈 수 있는 구역 안(TREES, 충돌)과 울타리 밖 풍경(DECOR_TREES)
const rand = rng(7);
const blocked = (x, z, m) =>
  Math.hypot(x, z) < 12.5 ||
  Object.values(BUILDINGS).some((b) => !b.fy && nearRect(x, z, bounds(b), b.h > 8 ? 6.5 : 3.2)) || // 높은 카지노는 나무를 더 멀리 (성당·교회 자리는 아래에서 따로 치움: 기존 나무 배치가 그대로 남게)
  HOUSES.some((h) => nearRect(x, z, [h.x - h.w / 2, h.z - h.d / 2, h.x + h.w / 2, h.z + h.d / 2 + 6], m)) ||
  Math.hypot(x - POND.x, z - POND.z) < POND.r + 2 ||
  BENCHES.some((b) => Math.hypot(b.x - x, b.z - z) < m + 2) ||
  GAME_BOXES.some((r) => nearRect(x, z, r, m)) ||
  (Math.abs(x - 36) < 3.5 + m && z > 8 && z < 25) || (Math.abs(z - 10) < 2.5 + m && x > 8 && x < 37) || // 카지노 가는 길

  (Math.abs(z + 4) < 3 && x < -8 && x > -14) || (Math.abs(z + 6) < 3 && x > 6 && x < 15);
export const TREES = [];
for (let i = 0; i < 400 && TREES.length < 46; i++) {
  const x = (rand() * 2 - 1) * (BOUND - 3), z = (rand() * 2 - 1) * (BOUND - 3);
  if (!blocked(x, z, 2.5) && TREES.every((t) => Math.hypot(t.x - x, t.z - z) > 4)) TREES.push({ x, z, s: 0.85 + rand() * 0.6, c: Math.floor(rand() * 3) });
}
for (let i = TREES.length - 1; i >= 0; i--) if (cleared(TREES[i].x, TREES[i].z, 2)) TREES.splice(i, 1);
export const DECOR_TREES = Array.from({ length: 70 }, () => { // 울타리 바깥 풍경 (원이 아니라 네모 울타리 바깥만)
  for (;;) {
    const a = rand() * Math.PI * 2, r = BOUND + 4 + rand() * 40, x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.abs(x) > BOUND + 3 || Math.abs(z) > BOUND + 3) return { x, z, s: 1 + rand() * 0.9, c: Math.floor(rand() * 3) };
  }
}).filter((t) => !inTown(t.x, t.z, -3) && trailNear(t.x, t.z).d > GATE.hw + 3); // 넓어진 마을 안·숲길 위는 비움 (예전 생성 순서는 그대로)
export const FLOWERS = Array.from({ length: 260 }, () => {
  const x = (rand() * 2 - 1) * (BOUND - 1.5), z = (rand() * 2 - 1) * (BOUND - 1.5);
  return { x, z, c: Math.floor(rand() * 5), ok: !blocked(x, z, 1.5) && Math.hypot(x, z) > 11 };
}).filter((f) => f.ok && !cleared(f.x, f.z));
// 넓어진 마을 땅(예전 울타리 밖 ~ 새 울타리)의 나무·꽃·바깥 풍경 나무 (새 난수라 예전 배치는 그대로)
{
  const R2 = rng(91), onPath = (x, z, m) => [...Object.values(AVENUES)].some((r) => nearRect(x, z, r, m)) || GATE_PATH.some((p, i) => i && segD(x, z, GATE_PATH[i - 1], p) < 3 + m);
  for (const [x, z] of AVE_TREES) TREES.push({ x, z, s: 1.05, c: 1, ty: 'cherry' });
  for (let i = 0; i < 3000 && TREES.length < 125; i++) {
    const x = (R2() * 2 - 1) * (BX - 3), z = (R2() * 2 - 1) * (BZ - 3);
    if (Math.abs(x) < BOUND + 1 || cleared(x, z, 2.5) || onPath(x, z, 2) || NEW_LAMPS.some((l) => Math.hypot(l.x - x, l.z - z) < 2.5) || BENCHES2.some((b) => Math.hypot(b.x - x, b.z - z) < 3)) continue;
    if (TREES.every((t) => Math.hypot(t.x - x, t.z - z) > 4.5)) TREES.push({ x, z, s: 0.85 + R2() * 0.7, c: Math.floor(R2() * 3) });
  }
  for (let i = 0; i < 260; i++) {
    const x = (R2() * 2 - 1) * (BX - 1.5), z = (R2() * 2 - 1) * (BZ - 1.5);
    if (Math.abs(x) > BOUND + 1 && !cleared(x, z) && !onPath(x, z, 0.5)) FLOWERS.push({ x, z, c: Math.floor(R2() * 5), ok: true });
  }
  for (let i = 0; i < 45; i++) { const a = R2() * Math.PI * 2, r = 30 + R2() * 60, x = Math.sin(a) * r * 3, z = Math.cos(a) * r; if (!inTown(x, z, -3) && trailNear(x, z).d > GATE.hw + 3 && !inYard(x, z, -20)) DECOR_TREES.push({ x, z, s: 1 + R2() * 0.9, c: Math.floor(R2() * 3) }); }
}
// ── 불멍 캠프 (1/2): 대문 가는 마을 길·캠프 길·공터 위 나무·꽃은 옆으로 비켜 줌 (지우면 뒤 나무의 모양 순서가 바뀌므로 자리만 옮김)
{
  const nudge = (t, d0, px, pz) => { const d = Math.hypot(t.x - px, t.z - pz) || 1e-3, k = d0 / d; t.x = px + (t.x - px) * k; t.z = pz + (t.z - pz) * k; };
  for (const t of TREES) for (let i = 1; i < CAMP_TOWN_PATH.length; i++) { const [a, b] = [CAMP_TOWN_PATH[i - 1], CAMP_TOWN_PATH[i]], ex = b[0] - a[0], ez = b[1] - a[1], u = Math.max(0, Math.min(1, ((t.x - a[0]) * ex + (t.z - a[1]) * ez) / (ex * ex + ez * ez))); if (segD(t.x, t.z, a, b) < 3.6) nudge(t, 3.6, a[0] + ex * u, a[1] + ez * u); }
  for (let i = FLOWERS.length - 1; i >= 0; i--) if (CAMP_TOWN_PATH.some((p, j) => j && segD(FLOWERS[i].x, FLOWERS[i].z, CAMP_TOWN_PATH[j - 1], p) < 2.4)) FLOWERS.splice(i, 1);
  for (const t of DECOR_TREES) if (campDist(t.x, t.z) < 7) { const c = campNear(t.x, t.z); if (c.d < c.hw + 7) nudge(t, c.hw + 7, c.px, c.pz); else nudge(t, CLEAR_R + 7, FIRE.x, FIRE.z); }
}
// ── 포근 놀이공원 (1/2): 서쪽 대문 가는 마을 길 위 나무는 비켜 주고 꽃은 치움, 울타리 밖 풍경 나무는 놀이공원 길·부지 밖으로 (지우지 않고 자리만 옮김)
{
  const nudge = (t, d0, px, pz) => { const d = Math.hypot(t.x - px, t.z - pz) || 1e-3, k = d0 / d; t.x = px + (t.x - px) * k; t.z = pz + (t.z - pz) * k; };
  const P = PARK_TOWN_PATH, seg = (x, z) => { let b = null; for (let i = 1; i < P.length; i++) { const [a, c] = [P[i - 1], P[i]], ex = c[0] - a[0], ez = c[1] - a[1], u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez))), px = a[0] + ex * u, pz = a[1] + ez * u, d = Math.hypot(x - px, z - pz); if (!b || d < b.d) b = { d, px, pz }; } return b; };
  for (const t of TREES) { const s = seg(t.x, t.z); if (s.d < 3.6) nudge(t, 3.6, s.px, s.pz); }
  for (let i = FLOWERS.length - 1; i >= 0; i--) if (seg(FLOWERS[i].x, FLOWERS[i].z).d < 2.4) FLOWERS.splice(i, 1);
  for (const t of DECOR_TREES) {
    if (parkDist(t.x, t.z) >= 6) continue;
    if (inPark(t.x, t.z, -6)) { // 부지 안·가장자리 → 가장 가까운 울타리 밖 6m
      const e = [t.x - PARK.x0 + 6, PARK.x1 + 6 - t.x, t.z - PARK.z0 + 6, PARK.z1 + 6 - t.z], m = Math.min(...e);
      if (m === e[0]) t.x = PARK.x0 - 6; else if (m === e[1]) t.x = PARK.x1 + 6; else if (m === e[2]) t.z = PARK.z0 - 6; else t.z = PARK.z1 + 6;
    }
    const r = parkRoadNear(t.x, t.z); if (r.d < r.hw + 6) nudge(t, r.hw + 6, r.px, r.pz); // 길가 → 길에서 6m 밖
  }
}
function segD(x, z, [ax, az], [bx, bz]) { const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))); return Math.hypot(x - ax - ex * t, z - az - ez * t); }

// ── 카지노(3층): 1층 슬롯 / 2층 홀덤 / 3층 블랙잭. 층마다 충돌이 달라서 resolve 에 fl(층)을 넘김
export const FLOOR_H = 4.2;
const C = BUILDINGS.casino;
const rr = (x0, z0, x1, z1) => [C.cx + x0, C.cz + z0, C.cx + x1, C.cz + z1]; // 건물 중심 기준 좌표 → 절대 좌표
export const RUNS = [0, 1].map((fa) => ({ fa, x: C.cx + (fa ? -5.4 : 5.4), zLow: C.cz - 5, zHigh: C.cz + 2.2, w: 1.8 })); // 계단: 0→1층은 동쪽, 1→2층은 서쪽
export const SHAFT = { x0: C.cx + 4.5, z0: C.cz + 4.7, x1: C.cx + 6.7, z1: C.cz + 6.7, cx: C.cx + 5.6, cz: C.cz + 5.7 }; // 엘리베이터 통로(서쪽 문)
export const runRect = (r) => [r.x - r.w / 2, r.zLow, r.x + r.w / 2, r.zHigh];
const T2 = 0.15;
const shaftWalls = [[SHAFT.x0, SHAFT.z0 - T2, SHAFT.x1 + T2, SHAFT.z0], [SHAFT.x0, SHAFT.z1, SHAFT.x1 + T2, SHAFT.z1 + T2], [SHAFT.x1, SHAFT.z0 - T2, SHAFT.x1 + T2, SHAFT.z1 + T2],
  [SHAFT.x0 - T2, SHAFT.z0 - T2, SHAFT.x0, C.cz + 5.1], [SHAFT.x0 - T2, C.cz + 6.3, SHAFT.x0, SHAFT.z1 + T2]];
// 1층: 슬롯머신 10대 (북쪽 벽 4 — 출입구·계단 앞은 비움 — + 서쪽 벽 6), 앉는 쪽은 기계 앞 스툴
export const SLOTS = [
  ...[-5.6, -4.2, -2.8, 2.9].map((dx) => ({ x: C.cx + dx, z: C.cz - 6.25, ry: 0, sx: C.cx + dx, sz: C.cz - 5.05, sry: Math.PI })),
  ...[-3.5, -2, -0.5, 1, 2.5, 4].map((dz) => ({ x: C.cx - 6.25, z: C.cz + dz, ry: Math.PI / 2, sx: C.cx - 5.05, sz: C.cz + dz, sry: -Math.PI / 2 })),
];
export const CASHIER = { counter: rr(-2.2, 5.5, 2.2, 6.3), npc: [C.cx, C.cz + 6.55] };
// 2층: 홀덤 테이블(타원) 가운데 + 의자 8개
export const POKER = { cx: C.cx, cz: C.cz, rx: 3.0, rz: 2.0, rects: [rr(-3.2, -1.6, 3.2, 1.6), rr(-2.2, -2.2, 2.2, 2.2)] }; // 타원을 십자 두 개로 근사(모서리를 깎음)
export const POKER_CHAIRS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2, x = C.cx + Math.sin(a) * 3.9, z = C.cz - Math.cos(a) * 2.9;
  return { x, z, ry: Math.atan2(C.cx - x, C.cz - z) };
});
// 3층: 블랙잭 테이블 + 딜러 + 의자 5개
export const BJ = { rect: rr(-2.6, -3.4, 2.6, -1.4), dealer: [C.cx, C.cz - 3.9] };
export const BJ_CHAIRS = [[-2.5, -0.2], [-1.25, -0.6], [0, -0.8], [1.25, -0.6], [2.5, -0.2]].map(([dx, dz]) => ({ x: C.cx + dx, z: C.cz + dz, ry: Math.atan2(-dx, -(dz + 3.0)) }));
const doorBlock = [C.cx - C.dw / 2, C.cz - C.d / 2 - 0.2, C.cx + C.dw / 2, C.cz - C.d / 2 + 0.2]; // 위층엔 바깥으로 나가는 문이 없음
export const FL_RECTS = [
  [...shaftWalls, runRect(RUNS[0]), ...SLOTS.map((m) => (m.ry === 0 ? [m.x - 0.55, m.z - 0.45, m.x + 0.55, m.z + 0.45] : [m.x - 0.45, m.z - 0.55, m.x + 0.45, m.z + 0.55])), CASHIER.counter],
  [...shaftWalls, runRect(RUNS[0]), runRect(RUNS[1]), ...POKER.rects, doorBlock],
  [...shaftWalls, runRect(RUNS[1]), BJ.rect, doorBlock],
];
// 층 이동 지점: 계단(서 있으면 자동으로 걸어 오르내림)과 엘리베이터(층 버튼)
export const PORTALS = [
  { id: 0, kind: 'stairs', fl: 0, x: C.cx + 5.4, z: C.cz - 5.9, r: 1.1, to: 1, run: 0, ex: C.cx + 5.4, ez: C.cz + 3.3 },
  { id: 1, kind: 'stairs', fl: 1, x: C.cx + 5.4, z: C.cz + 3.3, r: 1.1, to: 0, run: 0, ex: C.cx + 5.4, ez: C.cz - 5.9 },
  { id: 2, kind: 'stairs', fl: 1, x: C.cx - 5.4, z: C.cz - 5.9, r: 1.1, to: 2, run: 1, ex: C.cx - 5.4, ez: C.cz + 3.3 },
  { id: 3, kind: 'stairs', fl: 2, x: C.cx - 5.4, z: C.cz + 3.3, r: 1.1, to: 1, run: 1, ex: C.cx - 5.4, ez: C.cz - 5.9 },
  ...[0, 1, 2].map((fl) => ({ id: 4 + fl, kind: 'lift', fl, x: SHAFT.cx, z: SHAFT.cz, r: 0.8 })),
];
export const STAIR_MS = 3200;
export const transitMs = (pt, to) => (pt.kind === 'lift' ? 1400 + 900 * Math.abs(to - pt.fl) : STAIR_MS);
// 이동 중 위치와 높이(월드 y): u = 0~1 진행도
export function transitAt(pt, to, u) {
  if (pt.kind === 'lift') { const e = u * u * (3 - 2 * u); return { x: pt.x, z: pt.z, y: (pt.fl + (to - pt.fl) * e) * FLOOR_H, walking: false }; }
  const x = pt.x + (pt.ex - pt.x) * u, z = pt.z + (pt.ez - pt.z) * u, run = RUNS[pt.run];
  const t = Math.max(0, Math.min(1, (z - run.zLow) / (run.zHigh - run.zLow)));
  return { x, z, y: (run.fa + t) * FLOOR_H, walking: true };
}

// 충돌 목록
export const RECTS = [
  ...Object.values(BUILDINGS).filter((b) => !b.fy).flatMap(wallRects).map((r) => r.slice(0, 4)), // 성당·교회·사찰 벽은 설계도 좌표에서 따로 (sacredCollide)
  ...HOUSES.map((h) => [h.x - h.w / 2, h.z - h.d / 2, h.x + h.w / 2, h.z + h.d / 2]),
  ...FURN.filter((f) => f.w).map((f) => [f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2]),
  ...fenceRects(TAG), ...fenceRects(DODGE), ...TAG_HEDGES, ...TAG_CRATES,
];
export const CIRCLES = [
  FOUNTAIN, { x: POND.x, z: POND.z, r: POND.r + 0.3 },
  ...LAMPS.map((l) => ({ x: l.x, z: l.z, r: 0.3 })),
  ...[...BENCHES, ...BENCHES2].map((b) => ({ x: b.x, z: b.z, r: 0.85 })),
  ...FURN.filter((f) => f.r).map((f) => ({ x: f.x, z: f.z, r: f.r })),
  ...TREES.map((t) => ({ x: t.x, z: t.z, r: 0.5 })),
  ...TAG_PILLARS,
];

// 사람 반지름 r 이 벽·물건 안으로 못 들어가게 밀어냄
export function resolve(x, z, r = 0.4, fl = 0) {
  if (x < -BX - 1.5) return resolvePark(x, z, r); // 마을 서쪽 밖(놀이공원 길·부지)엔 마을 물건이 없음 → 공원 충돌만 봄
  const rects = fl ? [...RECTS, ...FL_RECTS[fl]] : [...RECTS, ...FL_RECTS[0]];
  for (let i = 0; i < 3; i++) {
    for (const [x0, z0, x1, z1] of rects) {
      const cx = Math.max(x0, Math.min(x, x1)), cz = Math.max(z0, Math.min(z, z1));
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; x += dx * k; z += dz * k; }
      else {
        const l = x - x0, rr = x1 - x, t = z - z0, b = z1 - z, m = Math.min(l, rr, t, b);
        if (m === l) x = x0 - r; else if (m === rr) x = x1 + r; else if (m === t) z = z0 - r; else z = z1 + r;
      }
    }
    for (const c of CIRCLES) {
      const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; x = c.x + (dx / d) * rr; z = c.z + (dz / d) * rr; }
    }
    for (const k in XF) if (nearRect(x, z, SACRED_BOXES[k], r)) { // 성당·교회·사찰: 설계도 좌표로 바꿔 밀어내고 되돌림 (반지름도 1/3)
      const [dx, dz] = toDesign(k, x, z), [ex, ez] = pushOut(dx, dz, r / XF[k].s, DRECTS[k], DCIRCLES[k]);
      if (ex !== dx || ez !== dz) [x, z] = toWorld(k, ex, ez);
    }
  }
  return walkable(x, z);
}
// ── 포근 놀이공원 충돌: 공원(parkdata)·동물원(zoodata)·놀이기구(ridesdata) 목록을 그대로 가리킴 → 뒤에 채워져도(push) 바로 반영
const PARK_COLLIDE = [[PARK_RECTS, PARK_CIRCLES], [ZOO_RECTS, ZOO_CIRCLES], [RIDE_RECTS, RIDE_CIRCLES]];
function resolvePark(x, z, r) {
  for (let i = 0; i < 3; i++) for (const [rects, circles] of PARK_COLLIDE) [x, z] = pushOut(x, z, r, rects, circles);
  return walkable(x, z);
}
function pushOut(x, z, r, rects, circles) {
  for (const [x0, z0, x1, z1] of rects) {
    const cx = Math.max(x0, Math.min(x, x1)), cz = Math.max(z0, Math.min(z, z1)), dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; x += dx * k; z += dz * k; }
    else { const l = x - x0, rr = x1 - x, t = z - z0, b = z1 - z, m = Math.min(l, rr, t, b); if (m === l) x = x0 - r; else if (m === rr) x = x1 + r; else if (m === t) z = z0 - r; else z = z1 + r; }
  }
  for (const c of circles) { const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; x = c.x + (dx / d) * rr; z = c.z + (dz / d) * rr; } }
  return [x, z];
}
// 걸을 수 있는 땅 = 마을 네모 ∪ 숲길 ∪ 사찰 마당 ∪ 캠프 ∪ 놀이공원(길·부지). 밖이면 가장 가까운 안쪽 점으로 (숲은 보이지 않는 벽)
function walkable(x, z) {
  const B = BX - 0.6, BB = BZ - 0.6;
  if (Math.abs(x) <= B && Math.abs(z) <= BB) return [x, z];
  if (inYard(x, z)) return [x, z];
  const pw = parkWalk(x, z); if (!pw) return [x, z]; // 포근 놀이공원 길·부지
  const cw = campWalk(x, z); if (!cw) return [x, z]; // 불멍 캠프 길·공터
  const t = trailNear(x, z), w = t.hw - 0.5;
  if (t.d <= w) return [x, z];
  const k = w / t.d, YB = [TY.w / 2 - 0.5, TY.d / 2 - 0.5];
  const cand = [[Math.max(-B, Math.min(B, x)), Math.max(-BB, Math.min(BB, z))], [t.px + (x - t.px) * k, t.pz + (z - t.pz) * k],
    [TY.cx + Math.max(-YB[0], Math.min(YB[0], x - TY.cx)), TY.cz + Math.max(-YB[1], Math.min(YB[1], z - TY.cz))], ...cw, ...pw];
  return cand.reduce((a, c) => (Math.hypot(c[0] - x, c[1] - z) < Math.hypot(a[0] - x, a[1] - z) ? c : a));
}

// 앉을 수 있는 자리 (서버·브라우저가 같은 번호를 씀). h = 앉는 면 높이, 사람은 ry 방향을 봄
export const SEATS = [];
const seat = (kind, x, z, ry, h, fwd = 0, o = {}) => SEATS.push({ id: SEATS.length, kind, x: x + Math.sin(ry) * fwd, z: z + Math.cos(ry) * fwd, ry, h, fl: 0, tbl: 0, chair: 0, ...o });
for (const f of FURN) {
  if (f.k === 'table') { seat('cafe', f.x + 1.15, f.z, -Math.PI / 2, 0.45); seat('cafe', f.x - 1.15, f.z, Math.PI / 2, 0.45); }
  if (f.k === 'desk') seat('office', f.x, f.z + f.f * 1.0, f.f > 0 ? Math.PI : 0, 0.53, 0.12); // 책상 쪽으로 살짝 당겨 앉음
}
for (const s of STOOLS) seat('cafe', s.x, s.z, -Math.PI / 2, 0.45);
for (const b of BENCHES) for (const o of [-0.5, 0.5]) seat('park', b.x + Math.cos(b.ry) * o, b.z - Math.sin(b.ry) * o, b.ry, 0.56, 0.12);
SLOTS.forEach((m, i) => seat('slot', m.sx, m.sz, m.sry, 0.55, 0, { tbl: i }));
POKER_CHAIRS.forEach((c, i) => seat('poker', c.x, c.z, c.ry, 0.5, 0, { fl: 1, chair: i }));
BJ_CHAIRS.forEach((c, i) => seat('bj', c.x, c.z, c.ry, 0.5, 0, { fl: 2, chair: i }));
for (const k of ['cathedral', 'church']) for (const p of DP[k].pews) for (const [x, z] of pewSeats(p)) seat('pew', ...toWorld(k, x, z), Math.PI + XF[k].th, 0.45); // 성당·교회 긴 의자: 사람 크기(앉는 면 0.45m, 건물 바닥 기준), 한 자리씩
for (const b of BENCHES2) for (const o of [-0.5, 0.5]) seat('park', b.x + Math.cos(b.ry) * o, b.z - Math.sin(b.ry) * o, b.ry, 0.56, 0.12); // 새로 더한 벤치는 번호 맨 뒤 (기존 자리 번호 그대로)
// 일어서면 서는 곳: 벤치는 앞쪽, 나머지는 의자 뒤쪽
export const standPos = (s) => { const d = s.kind === 'park' ? 1 : -1; return resolve(s.x + Math.sin(s.ry) * d, s.z + Math.cos(s.ry) * d, 0.4, s.fl); };
export const spawnPoint =() => [(Math.random() * 2 - 1) * 4, 8 + Math.random() * 3];
// ── 불멍 캠프 (2/2): 상태·장소 이름, 충돌, 벤치 자리(번호는 맨 뒤 → 기존 자리 번호 그대로). 데이터는 campdata.js
Object.assign(STATUS, { fire: ['🔥', '불멍 중'] }); ACT_STATUS.add('fire'); // 앉아 있을 때만 (상태 메뉴엔 안 보임)
Object.assign(SIT_STATUS, { fire: 'fire' }); Object.assign(SIT_TEXT, { fire: '🔥 불멍하는 중' }); Object.assign(PLACE, { camp: ['🔥', '불멍 캠프'] });
CIRCLES.push(...CAMP_CIRCLES);
for (const s of CAMP_SEATS) seat('fire', s.x, s.z, s.ry, 0.45);
export const CAMP = { x: FIRE.x, z: FIRE.z, r: CLEAR_R }; // 지도용: 불멍 캠프 가운데와 공터 반지름
// ── 포근 놀이공원 (2/2): 광장·대로 벤치 자리(번호는 맨 뒤 → 기존 자리 번호 그대로), 놀이기구가 더하는 이름표 상태. 데이터는 parkdata.js·ridesdata.js
for (const b of PARK_BENCHES) for (const o of [-0.5, 0.5]) seat('park', b.x + Math.cos(b.ry) * o, b.z - Math.sin(b.ry) * o, b.ry, 0.56, 0.12);
Object.assign(STATUS, RIDE_STATUS); for (const k in RIDE_STATUS) ACT_STATUS.add(k); // 타는 동안만 (상태 메뉴엔 안 보임)
