// 항상 접속해 있는 봇 유저 (서버 안에서 돌아감, docs 없음 — README '봇' 참고).
// 봇은 players 맵에 사람과 같은 모양으로 들어가고(ws 없음, bot: true, uid 없음 → 저장 안 됨), 움직임·앉기·낚시·기도·불꽃놀이·채팅을
// 전부 서버의 같은 메시지 처리(ctx.handle)로 보냄 → 규칙이 거절하면 다른 데로 감. 시계·난수·서버 기능은 ctx 로 주입 → 가짜 시계로 시험(test-bots.mjs)
import { SEATS, SPOTS, POND, BUILDINGS, GAMES, GATE, CAMP_GATE, FIRE, RITUALS, resolve, placeOf, spawnPoint, randomAvatar, doorPos, sideNormal, inPark, parkPathNear, ENTRY_PLAZA, PROMENADE, ZOO_ARCH, RIDES, FERRIS, CAROUSEL, TRAIN_STATIONS, DROP, VIKING, SWING, BUMPER, TEACUPS, bumperHome, padOf } from './public/world.js';
import { kstHours, KST } from './public/daycycle.js';
import { grid, findPath, banned, free, lane } from './public/pathfind.js';

// 걷기 격자·길 찾기는 화면 자동 걸음과 같이 쓰려고 public/pathfind.js 로 옮김 (동작 그대로)
export { grid, findPath, banned } from './public/pathfind.js';

// ───── 이름·말
// 실제 게임 닉네임처럼: 순우리말·먹을 것·동물·애칭·영문 소문자·숫자·_ 섞어서 (2~10자, 특정인 이름·욕설 없음)
export const NICKS = `하늘별 바다빛 콩떡이 몽실이 보리차 다람쥐 토끼풀 햇살가득 구름빵 노을빛 달빛산책 새벽공기 초롱이 별하나 솜사탕 단비 꽃잎 모카라떼 젤리곰 치즈냥
말랑이 포동이 꿀벌 감자튀김 고구마 도토리 밤톨이 마루 누리 가람 한별 시냇물 산들바람 미르 아라 나래 다솜 소금빵 두부 만두 찐빵 붕어빵 호떡 떡볶이 순두부
귤껍질 한라봉 복숭아 딸기우유 체리 자두 망고 레몬청 유자차 당근 브로콜리 멍멍이 냥냥펀치 삐약이 꼬꼬 오리 펭귄 수달 너구리 판다곰 코알라 햄찌 고슴도치 부엉이
참새 까치 제비 나비 반딧불 무지개 눈송이 봄비 여름밤 가을비 겨울잠 첫눈 은하수 별똥별 해바라기 민들레 개나리 진달래 코스모스 라벤더 동백꽃 벚꽃잎 연두 하양
보라 분홍 초록이 파랑새 노랑 꼬마곰 아기곰 곰돌 뭉치 탱이 콩이 별이 달이 해님 봄이 겨울이 둥이 깜지 루루 나무늘보 산책러 커피중독 야근요정 퇴근각 월요병
칼퇴 집순이 집돌이 잠꾸러기 늦잠 아침형 올빼미 낮잠 멍때리기 불멍러 물멍 낚시왕 붕어사냥꾼 산책중 마실 동네주민 옆집 이웃집 앞마당 골목대장 꿈나무 새싹 떡잎
열매 씨앗 화분 감자123 고양이2 하늘_01 별빛77 달토끼_ 우유한잔 아아한잔 라떼말고 불멍가자 낚시하자 놀러옴 지나가요 구경중 뉴비 초보 집가고싶다 귀차니즘 행복해
sunny mochi latte dodo kiki luna bori coco hana yuni rio jun_99 minty peachy sky_01 nana22 cat_lover jjang_9 haru bean toast pudding honey berry olive pine maple
cloud9 mint_choco tofu ramen_ udon soba pancake waffle bagel donut muffin cookie_ choco vanilla caramel matcha yuja lemon lime apple pear grape plum kiwi_ melon
potato carrot onion pepper salty sugar spoon star_ moon_ night_owl early_bird dreamer walker runner lazy_cat sleepy happy lucky7 cozy chill mellow breeze river ocean
forest meadow pebble rain snow winter autumn spring summer aurora comet nova orbit pixel byte zz_zz abc123 qwer1234 asdf kk_kk hehe 0w0 x_x mungmung dalgom
hello_ hi_there just_me nobody_ wanderer im_new bbang ddeok gom_gom ppippi yeah_ okay_ hmm_ zzz_ banana_mlk sujebi kimchi_ bibim gimbap mandu_ hotteok`.split(/\s+/).filter(Boolean);
const L = (s) => s.split('|');
const LINES = {
  any: L('안녕하세요~|ㅎㅇ|ㅋㅋㅋㅋ|ㅋㅋㅋ 귀엽다|오 사람 많네|여기 분위기 좋다|오늘 뭐하지|심심하다..|배고프다..|날씨 좋다|다들 뭐해요?|와 여기 예쁘다|산책 중~|오랜만이에요|ㅎㅎ|헐|대박|오오|좋아요 👍|굿굿|하암..|졸리다 ㅠ|저 잠깐 자리 비워요|다녀올게요~|돌아왔어요|여기 처음 와봐요|길 잃었다 ㅋㅋ|지도 어떻게 봐요?|M 누르면 지도 나와요|분수 예쁘다|이 마을 넓네|숲길 가보신 분?|사찰 멀다..|오늘도 평화롭다|ㅋㅋㅋㅋㅋㅋ|음악 좋다|ㅠㅠ|옷 바꿨어요 ㅎㅎ|이 머리 어때요?|점프 ㅋㅋ|ㄱㄱ|넵|저 카페 갑니다|회사 가기 싫다|어디 가세요?|같이 가요~|여기 앉을 데 있나|오 고양이 귀엽|나무 많다|꽃 예쁘다 🌸'),
  morning: L('좋은 아침~|굿모닝|출근하기 싫다..|아침 먹었어요?|커피 수혈 필요|잠 덜 깼다|오늘도 화이팅!'),
  lunch: L('점심 뭐 먹지|밥 먹으러 가요|배고파요 ㅠㅠ|점심시간이다!|카페 갈 사람~|다들 점심 맛있게 드세요|김밥 먹고 싶다'),
  evening: L('퇴근했다!!|저녁 뭐 먹지|노을 예쁘다|오늘 하루 수고했어요|이제 쉬어야지|미사 시간이다|저녁 예불 가요'),
  night: L('불멍 하러 가실 분?|밤이다 🌙|별 보러 갈래요?|야식 땡긴다|아직 안 자요?|캠프 가요~|밤 산책 좋다|불꽃놀이 보러 가요'),
  fun: L('놀이공원 넓다!|정문 진짜 크다|대관람차 언제 생겨요?|회전목마 타고 싶다|여기 사진 맛집|분수 별 예쁘다|솜사탕 먹고 싶다|풍선 귀엽다 🎈|놀이공원 데이트 각|밤에 오면 반짝반짝해요'),
  zoo: L('기린 보러 왔어요|동물원 어디로 가요?|판다 보고 싶다|사자 무섭다 ㅋㅋ|레서판다 최애|동물원 크다|얼룩말 귀여워'),
  late: L('새벽 감성..|잠이 안 와요|다들 안 자네 ㅋㅋ|새벽 불멍 최고|이 시간에 사람 있네|내일 출근인데..'),
  cafe: L('아아 한 잔 주세요|라떼 맛있다|카페 자리 있어요?|여기 커피 맛집|케이크 먹고 싶다|창가 자리 최고'),
  office: L('일하기 싫다..|회의 또 해..|야근각|집중 집중|퇴근까지 몇 시간?|커피 한 잔 하고 올게요|메일 폭탄 ㅠ'),
  pond: L('입질이 안 와..|붕어 잡았다!|낚시 재밌다|오 큰 거 걸렸다|장화 낚았어요 ㅋㅋ|황금 잉어 본 사람?|물멍 좋다'),
  casino: L('슬롯 한 판만..|오늘 운 좋은 듯|칩 다 잃었다 ㅋㅋ|카지노 화려하다|홀덤 하실 분?'),
  camp: L('불멍 최고 🔥|따뜻하다|마시멜로 구워 먹고 싶다|불꽃놀이 하실 분?|여기 너무 좋다|장작 타는 소리 좋아|별 엄청 많다'),
  sacred: L('마음이 편해진다|조용하다..|여기 너무 예뻐요|범종 소리 좋다|촛불 켜고 왔어요|오늘도 감사합니다|스테인드글라스 예쁘다'),
  fw: L('와 불꽃놀이다!|오오 예쁘다|예쁘다 ㅠㅠ|누가 쏜 거예요?|👏👏|대박|하트 봤어요?'),
  greet: L('안녕하세요~|어서오세요!|ㅎㅇㅎㅇ|반가워요 👋|오 안녕하세요'),
};
const EMOTES = ['👋', '😄', '❤️', '👍'];
const INVITE = { tag: L('술래잡기 하실 분~?|술래잡기 한 판 해요!|술래잡기 같이 해요 🏃'), dodge: L('피구 하실 분 있어요?|물풍선 피구 같이 해요~|피구 한 판 💦') }; // 패드에서 기다리는 봇이 한 번
const GAME_KINDS = ['tag', 'dodge']; // 술래잡기·물풍선 피구 하러 간 봇의 kind (choose 가 아니라 organize 가 정함)

// ───── 하루 일정 (한국 시간): [시작 시각, { 활동: 무게 }]. 봇마다 성향(like) 을 곱하고, 자리·정원이 차면 다른 데로
const SCHED = [
  [0, { camp: 6, afk: 2.5, temple: 0.7, cathedral: 0.6, church: 0.5, plaza: 0.8, park: 0.8, casino: 1, stroll: 0.5, fun: 0.2, zoo: 0, office: 0.04 }], // 새벽 회사는 거의 비움 (놀이공원 일정을 넣으며 난수 순서가 바뀌어 시험이 흔들려서 분명히 적음)
  [5, { temple: 2.5, church: 2, cathedral: 0.8, camp: 2.5, afk: 2, plaza: 1, park: 1, stroll: 0.8, fun: 0.1, zoo: 0 }], // 새벽 예불·예배 (05:00)
  [7, { cafe: 4, office: 3, plaza: 2, stroll: 2, park: 1, afk: 1, follow: 0.6, fun: 0.4, zoo: 0.3 }],
  [9, { office: 5, cafe: 3, park: 2, plaza: 2, pond: 1.5, stroll: 1.5, afk: 1.2, casino: 0.5, trail: 0.5, follow: 1, fun: 1.4, zoo: 1.2 }],
  [11.5, { cafe: 6, office: 2.5, plaza: 2.5, park: 2, pond: 1, stroll: 1, afk: 1, follow: 1, fun: 1, zoo: 0.8 }], // 점심 카페 몰림
  [13, { office: 4.5, cafe: 3, park: 2, pond: 2, plaza: 2, casino: 1, stroll: 1.5, trail: 0.8, afk: 1.2, follow: 1, temple: 0.4, cathedral: 0.4, church: 0.3, fun: 1.8, zoo: 1.5 }],
  [17.5, { cathedral: 2, temple: 2, plaza: 3, cafe: 2, park: 2, church: 0.8, stroll: 1.5, pond: 1, follow: 1.2, afk: 1, fun: 1.5, zoo: 0.6 }], // 저녁 예불·미사 (18:00)
  [19, { camp: 5, plaza: 2, casino: 2.5, cafe: 2, park: 1.5, pond: 0.5, stroll: 1, afk: 1.5, follow: 1, fun: 1.2, zoo: 0.2 }], // 밤 놀이공원은 불빛 구경 (동물원은 동물이 자는 시간)
];
const KINDS = ['plaza', 'stroll', 'park', 'cafe', 'office', 'pond', 'casino', 'camp', 'cathedral', 'church', 'temple', 'trail', 'afk', 'follow', 'fun', 'zoo']; // park = 마을 벤치, fun = 포근 놀이공원, zoo = 동물원
const CAP = { cafe: 15, office: 9, casino: 10, pond: 6, park: 22, camp: 48, cathedral: 22, church: 22, temple: 22, trail: 6, fun: 20, zoo: 12 }; // 장소별 정원 (자리·넓이 기준)
const HERE = { cafe: 'cafe', office: 'office', casino: 'casino', camp: 'camp', cathedral: 'cathedral', church: 'church', temple: 'temple' };
const SEAT_KIND = { cafe: 'cafe', office: 'office', park: 'park', camp: 'fire', cathedral: 'pew', church: 'pew', casino: 'slot' };
const PEW_SPOT = new Map(); // 긴 의자 자리 번호 → 같은 곳의 앉아서 하는 행동 자리 (성당 묵주기도·교회 기도)
for (const s of SEATS) if (s.kind === 'pew') { const sp = SPOTS.find((q) => ['rosary', 'pew'].includes(q.kind) && Math.hypot(q.x - s.x, q.z - s.z) < 0.1); if (sp) PEW_SPOT.set(s.id, sp.id); }
const SEAT_PLACE = SEATS.map((s) => placeOf(s.x, s.z));
const lerpAng = (a, b, t) => a + ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * t;
const angDiff = (a, b) => Math.abs((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);

// 불꽃놀이 모양 (하늘 평면 정규화 좌표, 가로 ±22m·세로 ±14m 라서 가로를 줄여 동그랗게)
const AX = 14 / 22;
const curve = (n, f) => Array.from({ length: n + 1 }, (_, i) => f((i / n) * Math.PI * 2));
const FW_SHAPES = {
  heart: () => [curve(70, (t) => [16 * Math.sin(t) ** 3 / 17 * 0.5 * AX, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 * 0.5 + 0.08])],
  circle: () => [curve(56, (t) => [Math.sin(t) * 0.42 * AX, Math.cos(t) * 0.42 + 0.05])],
  star: () => [Array.from({ length: 11 }, (_, i) => { const a = (i * 4 * Math.PI) / 5; return [Math.sin(a) * 0.45 * AX, Math.cos(a) * 0.45 + 0.05]; }).flatMap((p, i, a) => (i ? Array.from({ length: 6 }, (_, k) => [a[i - 1][0] + (p[0] - a[i - 1][0]) * (k + 1) / 6, a[i - 1][1] + (p[1] - a[i - 1][1]) * (k + 1) / 6]) : [p]))],
  smile: () => [curve(50, (t) => [Math.sin(t) * 0.42 * AX, Math.cos(t) * 0.42 + 0.05]), [[-0.13 * AX, 0.2], [-0.13 * AX, 0.12]], [[0.13 * AX, 0.2], [0.13 * AX, 0.12]], Array.from({ length: 16 }, (_, i) => { const a = Math.PI * (0.65 + 0.7 * (i / 15)); return [Math.cos(a) * 0.24 * AX, Math.sin(a) * -0.24 + 0.02]; })],
  hi: () => [[[-0.3, 0.35], [-0.3, -0.25]], [[-0.3, 0.05], [-0.08, 0.05]], [[-0.08, 0.35], [-0.08, -0.25]], [[0.18, 0.35], [0.18, -0.25]]].map((s) => line(s[0], s[1])),
};
function line(a, b) { const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 30)); return Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * (i / n), a[1] + (b[1] - a[1]) * (i / n)]); }

/* ctx: { players, now(), ritualNow(), rand(), handle(p, msg), join(p), leave(p), seatFree(id), campOpen(), nickTaken(nick) → Promise<bool>, gameInfo(p) → { phase, role, team, out } | null, gameBusy(gid) } */
export function createBots(ctx) {
  const rnd = ctx.rand, R = (a, b) => a + (b - a) * rnd(), pick = (a) => a[Math.floor(rnd() * a.length)];
  const bots = new Set(), inUse = new Set(), recent = [], pathQ = [];
  let pool = [], reservedSet = new Set(), target = 0, last = ctx.now(), nextPop = 0, nextChat = 0, fwNext = 0, fwBot = null, timer = null, loudAt = {}, greetAt = 0;
  const humans = () => { let n = 0; for (const p of ctx.players.values()) if (!p.bot) n++; return n; };
  const stats = { sit: [0, 0], paths: 0, pathMs: 0, stuck: 0, abandoned: 0, chats: 0, fw: 0, joins: 0, leaves: 0, tickMs: [], rides: {}, rounds: { tag: 0, dodge: 0 }, played: { tag: 0, dodge: 0 } };
  let gameNext = 0, gameTurn = 0; // 다음 놀이터 판을 모을 시각, 술래잡기·피구 번갈아 (시작 2분 뒤 첫 판: 난수를 안 써서 다른 활동의 난수 순서가 그대로)
  const H = () => kstHours(ctx.now()), weekday = () => { const d = new Date(ctx.now() + KST).getUTCDay(); return d > 0 && d < 6; };
  const send = (b, m) => ctx.handle(b.p, m);
  const others = (b) => [...ctx.players.values()].filter((q) => q !== b.p);
  const crowded = (x, z, r = 1.1, me) => { for (const q of ctx.players.values()) if (q !== me && Math.hypot(q.x - x, q.z - z) < r) return true; return false; };
  const cellPt = (place, filter) => { // 그 장소 안 빈칸 하나 (칸 안에서 조금 흔들어서 줄 서지 않게)
    const list = grid().cells[place]; if (!list) return null;
    for (let k = 0; k < 12; k++) { const g = grid(), i = pick(list), x = g.X(i) + R(-0.6, 0.6), z = g.Z(i) + R(-0.6, 0.6); if ((!filter || filter(x, z)) && !crowded(x, z)) return [x, z]; }
    return null;
  };
  const freeSeat = (kind, near, pred = () => true) => { // 비어 있고 옆자리 사람과도 안 붙는 자리 (가까운 데를 조금 더 좋아함)
    const c = SEATS.filter((s) => s.kind === kind && s.fl === 0 && ctx.seatFree(s.id) && pred(s) && ![...bots].some((o) => o.claim === s.id));
    if (!c.length) return null;
    c.sort((a, b) => Math.hypot(a.x - near[0], a.z - near[1]) * R(0.6, 1.4) - Math.hypot(b.x - near[0], b.z - near[1]) * R(0.6, 1.4));
    return c[Math.min(c.length - 1, Math.floor(rnd() ** 2 * 6))];
  };
  const outside = (k, d = 2.2) => { const b = BUILDINGS[k], [x, z] = doorPos(b), [nx, nz] = sideNormal(b.door); return [x + nx * d + R(-1, 1) * (nz ? 1 : 0.3), z + nz * d + R(-1, 1) * (nx ? 1 : 0.3)]; }; // 문 바로 앞 바깥
  const rideSpot = (id) => { // 기구마다 줄 서는 자리 (승강장·둘레, 가장 가까운 빈자리까지 탈 수 있는 거리 안)
    const an = R(0, 6.28), st = pick(TRAIN_STATIONS), al = R(-4, 4);
    return { ferris: [FERRIS.x + R(3, 4.8), FERRIS.z + R(-1.6, 1.6)], carousel: [CAROUSEL.x + Math.sin(an) * (CAROUSEL.plat + 1.2), CAROUSEL.z + Math.cos(an) * (CAROUSEL.plat + 1.2)], train: [st.x + st.nx * R(2.2, 3.6) - st.nz * al, st.z + st.nz * R(2.2, 3.6) + st.nx * al],
      drop: [DROP.x + Math.sin(an) * R(4.4, 6), DROP.z + Math.cos(an) * R(4.4, 6)], viking: [VIKING.x + R(-4.5, 4.5), VIKING.z - R(4.2, 5.4)], swing: [SWING.x + Math.sin(an) * R(8.2, 9.5), SWING.z + Math.cos(an) * R(8.2, 9.5)], // 2단계 A: 승강장·둘레
      coaster: [R(-436, -428), R(40, 41.5)], flume: [R(-366, -354), R(37, 38.2)], // 롤러코스터 역 · 후룸 나루 (북쪽, 입구 쪽)
      bumper: [bumperHome(Math.floor(R(0, BUMPER.n))).x + R(-0.8, 0.8), R(40.6, 41.8)], teacups: [TEACUPS.x + Math.sin(an) * R(13.2, 14.0), TEACUPS.z + Math.cos(an) * R(13.2, 14.0)] }[id]; // 2단계 B: 범퍼카 로비(차 앞 줄) · 찻잔 회전판 둘레 (탈 수 있는 거리 5.5m 안)
  };
  const quietRide = (not) => { // 지금 타거나 줄 선 봇이 가장 적은 기구 (같으면 아무거나) → 인기 기구로 안 쏠림
    const n = Object.fromEntries(Object.keys(RIDES).map((id) => [id, rnd() * 0.9]));
    for (const o of bots) for (const st of [o.cur, ...o.q]) if (st?.k === 'ride') n[st.id]++;
    return Object.keys(n).filter((id) => id !== not).sort((a, b) => n[a] - n[b])[0];
  };

  // ── 단계: go(목표까지 걷기) idle(가만히·두리번) sit(앉아 있기) act(성당·사찰·교회 행동) fish(낚시) follow(친구 따라가기) st(상태) emote
  const go = (x, z, r = 0.6, o = {}) => ({ k: 'go', x, z, r, ...o });
  const idle = (s, look = 1) => ({ k: 'idle', s, look });
  function plan(b, kind) {
    const p = b.p, a = b.pers.act, lazy = 1.6 - a;
    switch (kind) {
      case 'plaza': { // 분수 둘레: 친구가 서 있으면 그 옆에 둘러서기
        const fr = b.pers.soc > 0.4 && others(b).find((q) => q.seat < 0 && !q.w && Math.hypot(q.x, q.z) < 15 && Math.hypot(q.x, q.z) > 4 && rnd() < 0.5);
        const t = fr ? (() => { const an = R(0, 6.28), d = R(1.4, 2.2); return [fr.x + Math.sin(an) * d, fr.z + Math.cos(an) * d]; })() : cellPt('town', (x, z) => Math.hypot(x, z) > 4 && Math.hypot(x, z) < 15);
        return t && [go(...t, 0.7, { face: fr ? [fr.x, fr.z] : null }), idle(R(15, 110) * lazy)];
      }
      case 'stroll': { const t = cellPt('town', (x, z) => Math.abs(x) < 112 && Math.abs(z) < 40); return t && [go(...t, 1.2, { run: rnd() < a * 0.35 }), idle(R(2, 25) * lazy)]; }
      case 'trail': { const t = cellPt('trail'); return t && [go(...t, 1.5, { run: rnd() < 0.3 }), idle(R(4, 30))]; }
      case 'afk': return p.pl === 'camp' && !ctx.campOpen() ? null : [idle(R(60, 300) * lazy, 0)]; // 닫힌 캠프에 멍하니 남지 않음
      case 'park': case 'camp': { // 벤치: 마을(또는 사찰 마당) 벤치 / 불멍 벤치
        const s = freeSeat(SEAT_KIND[kind], [p.x, p.z], (s) => kind === 'camp' || SEAT_PLACE[s.id] === (p.pl === 'temple' || p.pl === 'park' ? p.pl : 'town'));
        return s && [go(s.x, s.z, 1.5, { seat: s.id }), { k: 'sit', seat: s.id, s: R(60, 360) * lazy * (kind === 'camp' ? 2 : 1) }];
      }
      case 'cafe': case 'office': case 'casino': case 'cathedral': case 'church': { // 문 앞에서 머뭇 → 들어가 자리 또는 서성이기
        const out = [go(...outside(kind), 1.4), idle(R(0.5, 3.5), 0)];
        if (kind === 'office' || (kind === 'cafe' && rnd() < 0.3) || (kind === 'casino' && rnd() < 0.2)) out.shift(), out.shift(); // 출근은 그냥 들어감
        const s = (kind !== 'casino' || rnd() < 0.45) && freeSeat(SEAT_KIND[kind], [p.x, p.z], (s) => SEAT_PLACE[s.id] === kind);
        if (kind === 'office' && rnd() < 0.3) out.push({ k: 'st', s: 'focus' });
        if (kind === 'cafe' && H() >= 11.5 && H() < 13.5 && rnd() < 0.3) out.push({ k: 'st', s: 'lunch' });
        if (kind === 'cathedral' && rnd() < 0.5) { const f = pick(SPOTS.filter((q) => q.kind === 'font')); out.push(go(f.x, f.z, 0.9), { k: 'act', act: 'cross', spot: f.id }); } // 성수대에서 성호
        if (s) {
          out.push(go(s.x, s.z, 1.5, { seat: s.id }), { k: 'sit', seat: s.id, s: R(90, kind === 'office' ? 1200 : 600) * lazy });
          const ps = PEW_SPOT.get(s.id);
          if (ps != null && rnd() < 0.6) out.push({ k: 'act', act: kind === 'cathedral' ? 'rosary' : 'pray', spot: ps, s: R(30, 150), seated: 1 });
        } else for (let i = 0, n = 1 + Math.floor(R(0, 3)); i < n; i++) { const t = cellPt(kind); if (t) out.push(go(...t, 0.8), idle(R(8, 60))); }
        if (kind === 'cathedral' && rnd() < 0.3) { const c = pick(SPOTS.filter((q) => q.kind === 'candle')); out.push(go(c.x, c.z, 0.9), { k: 'act', act: 'candle', spot: c.id }, idle(R(3, 12))); }
        if (kind === 'church' && rnd() < 0.08 && ctx.now() > (loudAt.piano || 0)) { const pn = SPOTS.find((q) => q.kind === 'piano'); loudAt.piano = ctx.now() + 600e3; out.push(go(pn.x, pn.z, 0.9), { k: 'act', act: 'piano', spot: pn.id, s: R(20, 60) }); }
        return out.length > (kind === 'office' ? 0 : 2) ? out : null;
      }
      case 'temple': { // 법당 방석에서 절·합장 (가끔 범종·연등)
        const cu = SPOTS.filter((q) => q.kind === 'cushion' && !crowded(q.x, q.z, 0.55) && ![...bots].some((o) => o.spot === q.id));
        if (!cu.length) return null;
        const c = pick(cu), out = [];
        if (rnd() < 0.12 && ctx.now() > (loudAt.bell || 0)) { const bl = SPOTS.find((q) => q.kind === 'bell'); loudAt.bell = ctx.now() + 240e3; out.push(go(bl.x, bl.z, 0.9), { k: 'act', act: 'bell', spot: bl.id }, idle(R(3, 8))); }
        if (rnd() < 0.15) { const ln = pick(SPOTS.filter((q) => q.kind === 'lantern')); out.push(go(ln.x, ln.z, 0.9), { k: 'act', act: 'lantern', spot: ln.id }, idle(R(2, 6))); }
        out.push(go(c.x, c.z, 0.5, { spot: c.id }));
        if (rnd() < 0.6) for (let i = 0, n = 1 + Math.floor(R(0, 3)); i < n; i++) out.push({ k: 'act', act: 'bow', spot: c.id }, idle(R(1, 4), 0));
        else out.push({ k: 'act', act: rnd() < 0.5 ? 'palms' : 'beads', spot: c.id, s: R(30, 120) });
        return [...out, idle(R(5, 40), 0)];
      }
      case 'fun': case 'zoo': { // 포근 놀이공원: 광장·대로·기구 길 / 동물원 길을 어슬렁 (놀이공원은 가끔 벤치에 앉음)
        if (kind === 'fun' && rnd() < 0.08) { const s = freeSeat('park', [p.x, p.z], (s) => SEAT_PLACE[s.id] === 'park'); if (s) return [go(s.x, s.z, 1.5, { seat: s.id }), { k: 'sit', seat: s.id, s: R(40, 200) * lazy }]; }
        if (kind === 'fun' && rnd() < 0.92) { // 놀이기구: 탑승구 앞에 가서 줄 서 있다가 탈 수 있을 때 탐 (규칙은 서버 rides.js 그대로). 지금 덜 붐비는 기구부터 → 10종 골고루, 낮엔 반쯤 내려서 하나 더 (밤엔 하나만 타고 캠프·광장으로)
          const out = [];
          for (let n = H() < 19 && rnd() < 0.6 ? 2 : 1, prev = null; n > 0; n--) { const id = quietRide(prev); prev = id; out.push(go(...rideSpot(id), 0.6), { k: 'ride', id, s: R(70, 160), hop: id === 'train' && rnd() < 0.5 }, idle(R(3, 12) * lazy)); }
          return out;
        }
        const E = ENTRY_PLAZA, onWay = kind === 'fun'
          ? (x, z) => inPark(x, z) && (parkPathNear(x, z, ['promenade', 'ride']).d < 1 || (x > E.x0 && x < E.x1 && z > E.z0 && z < E.z1))
          : (x, z) => parkPathNear(x, z, ['zoo']).d < 0.5;
        const out = [];
        for (let i = 0, n = 2 + Math.floor(R(0, 3)); i < n; i++) { const t = cellPt(kind === 'fun' ? 'park' : 'zoo', onWay); if (t) out.push(go(...t, 1.2, { run: rnd() < a * 0.2 }), idle(R(4, 30) * lazy)); }
        return out.length ? out : null;
      }
      case 'pond': { // 연못 가장자리 (벤치·다른 사람 피해서)
        for (let k = 0; k < 10; k++) {
          const an = R(0, 6.28), d = R(5.9, 7), x = POND.x + Math.sin(an) * d, z = POND.z + Math.cos(an) * d;
          if (free(x, z) && !crowded(x, z, 2.2)) return [go(x, z, 0.35), { k: 'fish', n: 2 + Math.floor(R(0, 6)) }];
        }
        return null;
      }
      case 'follow': { // 근처 친구(봇)를 따라가다 멈추면 둘러섬
        const c = [...bots].filter((o) => o !== b && !o.leaving && o.p.seat < 0 && o.cur?.k === 'go' && !GAME_KINDS.includes(o.kind) && Math.hypot(o.p.x - p.x, o.p.z - p.z) < 45);
        return c.length ? [{ k: 'follow', who: pick(c), s: R(30, 120), side: R(-1, 1), ring: R(0, 6.28) }] : null;
      }
    }
    return null;
  }
  // 다음 활동 고르기: 시간표 × 성향 × 거리 × 정원, 의식 시간엔 그 건물로
  function choose(b) {
    const h = H(), row = SCHED.findLast((r) => h >= r[0])[1], wk = weekday(), cnt = {};
    for (const o of bots) cnt[o.kind] = (cnt[o.kind] || 0) + 1;
    const rit = new Set(RITUALS.filter((r) => { const d = h - r.h; return d > -0.2 && d < 0.13; }).map((r) => r.place)), w = {};
    let sum = 0;
    for (const k of KINDS) {
      let v = (row[k] ?? 0.15) * b.pers.like[k]; // 시간표에 0 이면 그 시간엔 안 감 (동물원 밤)
      if (k === 'office' && !wk) v *= 0.12;
      if (k === 'camp' && !(ctx.campOpen() && (h < 5.6 || h >= 19))) v = 0; // 닫혔거나 곧 닫힘
      if ((k === 'fun' || k === 'zoo') && ctx.parkOpen && !ctx.parkOpen()) v = 0; // 불꽃놀이 시간엔 놀이공원이 영업 임시 중단
      if (rit.has(k)) v = (v + 2) * (b.pers.faith === k ? 6 : 1.5);
      if (b.pers.faith === k) v *= 1.6;
      if (CAP[k] && (cnt[k] || 0) >= CAP[k] * (target / 80 || 1)) v = 0;
      if (k === b.kind && !['afk', 'plaza', 'stroll'].includes(k)) v *= 0.35; // 같은 걸 연달아 덜 함
      const ref = { cafe: BUILDINGS.cafe, office: BUILDINGS.office, casino: BUILDINGS.casino, cathedral: BUILDINGS.cathedral, church: BUILDINGS.church, temple: BUILDINGS.temple, pond: { cx: POND.x, cz: POND.z }, camp: { cx: FIRE.x, cz: FIRE.z }, fun: { cx: (PROMENADE.x0 + PROMENADE.x1) / 2, cz: PROMENADE.z }, zoo: { cx: ZOO_ARCH.x, cz: -100 } }[k];
      if (ref) v /= 1 + Math.hypot(ref.cx - b.p.x, ref.cz - b.p.z) / 220;
      w[k] = v; sum += v;
    }
    for (let tries = 0; tries < 4; tries++) {
      let r = rnd() * sum, k = 'afk';
      for (const kk of KINDS) if ((r -= w[kk]) < 0) { k = kk; break; }
      const q = plan(b, k);
      if (q) { b.kind = k; return q; }
    }
    b.kind = 'plaza';
    return plan(b, 'stroll') || [idle(20)];
  }

  // ── 봇 하나 넣기/빼기
  function persona() {
    return { act: R(0.25, 1), soc: rnd() ** 1.3, kb: rnd() < 0.6, faith: rnd() < 0.35 ? pick(['temple', 'cathedral', 'church']) : null,
      like: Object.fromEntries(KINDS.map((k) => [k, R(0.4, 1.7)])), jump: rnd() < 0.15 ? R(2, 5) : R(0.2, 1.1), mag: R(0.62, 0.95) };
  }
  function spawn(initial) {
    const left = pool.filter((n) => !inUse.has(n));
    if (!left.length) return null;
    const nick = pick(left), [sx, sz] = resolve(...spawnPoint());
    const p = { ws: null, bot: true, nick, a: randomAvatar(rnd() < 0.5 ? 'f' : 'm'), chips: 0, s: 'free', auto: false, seat: -1, fl: 0, transit: null, pl: 'town', x: sx, z: sz, ry: R(-3.1, 3.1), y: 0, pad: null, game: null, dex: {}, fish: null, rec: {}, act: null, vl: false };
    const b = { p, pers: persona(), q: [], cur: null, kind: 'plaza', path: null, pi: 0, v: 0, ry: p.ry, h: p.ry, cam: R(0, 6.28), jy: 0, vy: 0, t: R(0, 100), ph: R(0, 6.28), next: 0, emoteAt: 0, chatAt: 0, prog: null, stuck: 0, trap: 0, claim: -1, spot: -1, leaving: null };
    inUse.add(nick); bots.add(b);
    if (initial) { // 서버를 켤 때 있던 사람들: 이미 어딘가에서 뭔가 하는 중인 것처럼
      b.q = choose(b) || [];
      const gi = b.q.findIndex((s) => s.k === 'go');
      if (gi >= 0) { const g = b.q[gi]; [p.x, p.z] = resolve(g.x + R(-0.5, 0.5), g.z + R(-0.5, 0.5)); if (banned(p.x, p.z)) [p.x, p.z] = [sx, sz]; b.q.splice(0, gi + (g.seat == null ? 1 : 0)); }
      b.next = ctx.now() + R(0, 8000);
    } else b.q = [idle(R(1, 5)), ...(rnd() < 0.3 ? [{ k: 'emote', e: '👋' }] : [])];
    p.pl = placeOf(p.x, p.z); // 처음부터 다른 데 있던 봇도 지도·접속자 목록에 제 장소로
    ctx.join(p); stats.joins++;
    return b;
  }
  function remove(b) { bots.delete(b); inUse.delete(b.p.nick); ctx.leave(b.p); stats.leaves++; if (fwBot === b) fwBot = null; }
  function leaveSoon(b) { // 나가는 모습 섞기: 일어나서 사라짐 / 대문 쪽으로 걷다가 사라짐 / 그냥 사라짐
    if (b.fw || GAME_KINDS.includes(b.kind)) return; // 놀이터 판 중엔 안 나감 (인원이 모자라 판이 깨지지 않게)
    const r = rnd();
    if (b.p.seat >= 0) b.q = [{ k: 'stand' }, idle(R(0.5, 3), 0), { k: 'bye' }];
    else if (r < 0.45 && b.p.pl === 'town') { const gt = rnd() < 0.5 ? [GATE.x - 4, GATE.z + R(-3, 3)] : [CAMP_GATE.x + R(-2, 2), CAMP_GATE.z - 3]; b.q = [go(...gt, 6, { bye: 1 }), { k: 'bye' }]; }
    else b.q = [{ k: 'bye' }];
    b.cur = null; b.leaving = ctx.now() + 120e3; // 늦어도 2분 뒤엔 사라짐
  }
  function population(now) { // 목표 ±5% 안에서 1~3분마다 한 명씩 나가거나 들어옴
    if (now < nextPop) return;
    const n = [...bots].filter((b) => !b.leaving).length, band = Math.max(1, Math.round(target * 0.05));
    nextPop = now + R(60e3, 180e3);
    if (n > target - band && (n >= target + band || rnd() < 0.5)) { const c = [...bots].filter((b) => !b.leaving && !b.fw && !GAME_KINDS.includes(b.kind)); if (c.length) leaveSoon(pick(c)); }
    else spawn(false);
  }

  // ── 걷기: 경로를 앞쪽 2.4m 지점을 보며 따라감 (코너는 자연스럽게 둥글게). PC 봇은 카메라 기준 8방향 키, 폰 봇은 조이스틱 연속 각도
  function steer(b, dt, now) {
    const p = b.p, P = b.path, c = b.cur;
    while (b.pi < P.length - 2) { // 지난 구간 넘기기
      const [ax, az] = P[b.pi], [bx, bz] = P[b.pi + 1], ex = bx - ax, ez = bz - az;
      if (((p.x - ax) * ex + (p.z - az) * ez) / (ex * ex + ez * ez || 1e-6) >= 1 || Math.hypot(bx - p.x, bz - p.z) < 1.4) b.pi++; else break;
    }
    const end = P.at(-1), dEnd = Math.hypot(end[0] - p.x, end[1] - p.z);
    if (dEnd < c.r) return true;
    let lx = end[0], lz = end[1], need = 2.4, px = p.x, pz = p.z;
    for (let i = b.pi + 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - px, P[i][1] - pz); if (d >= need) { lx = px + (P[i][0] - px) * need / d; lz = pz + (P[i][1] - pz) * need / d; break; } need -= d; px = P[i][0]; pz = P[i][1]; }
    let h = Math.atan2(lx - p.x, lz - p.z);
    const turn = angDiff(b.h, h);
    if (b.pers.kb && dEnd > 2.5) { // 키보드: W·A·S·D 조합 8방향, 방향이 30° 넘게 어긋날 때만 키를 바꿈
      const k = Math.round((h - b.cam) / (Math.PI / 4)), q = b.cam + k * Math.PI / 4;
      h = angDiff(b.h, h) < 0.52 && b.v > 0.5 ? b.h : q;
    } else if (!b.pers.kb) h = lerpAng(b.h, h + 0.12 * (Math.sin(b.t * 0.7 + b.ph) + 0.5 * Math.sin(b.t * 1.9 + b.ph * 2)), 1 - Math.exp(-dt * 6)); // 엄지가 살짝 흔들림
    b.h = h;
    const mag = b.pers.kb ? 1 : Math.max(0.5, Math.min(1, b.pers.mag + 0.15 * Math.sin(b.t * 0.37 + b.ph)));
    let want = 5 * mag * (b.run ? 1.6 : 1) * (turn > 1.0 ? (b.pers.kb ? 0.7 : 0.45) : 1);
    if (dEnd < 1.5 && !b.pers.kb) want *= Math.max(0.4, dEnd / 1.5); // 폰은 목표 앞에서 살살
    b.v += Math.max(-25 * dt, Math.min(14 * dt, want - b.v));
    const n = Math.max(1, Math.ceil((b.v * dt) / 0.25)), sx = (Math.sin(h) * b.v * dt) / n, sz = (Math.cos(h) * b.v * dt) / n;
    let nx = p.x, nz = p.z; const ox = nx, oz = nz;
    for (let k = 0; k < n; k++) [nx, nz] = resolve(nx + sx, nz + sz, 0.4, p.fl); // 25cm씩 나눠 움직임 → 달릴 때도 얇은 벽을 뚫고 지나가지 않음
    if (banned(nx, nz, 1.2) && !banned(p.x, p.z, 1.2)) { b.v = 0; b.path = null; return false; } // 놀이터 패드 쪽으로 미끄러지면 멈추고 길 다시 찾기
    const pad = padOf(nx, nz) && GAMES[padOf(nx, nz)].pad;
    if (pad) { const d = Math.hypot(p.x - pad.x, p.z - pad.z) || 1; move(b, ...resolve(p.x + (p.x - pad.x) / d * 0.3, p.z + (p.z - pad.z) / d * 0.3, 0.4, p.fl), true, dt); b.path = null; return false; } // 게임이 끝나 패드 옆에 내려진 봇: 패드를 밟지 않고 바깥쪽으로 먼저 비킴
    move(b, nx, nz, true, dt);
    if (Math.hypot(ox + sx * n - nx, oz + sz * n - nz) > 0.05 && dEnd < (c.seat != null ? 2.3 : c.r + 0.8)) return true; // 목표 앞에서 가구·물가에 막히면 거기서 멈춤 (틈으로 비집고 들어가지 않음, 앉기는 2.5m 안이면 됨)
    if (b.pers.kb && rnd() < dt / 25) b.cam += R(-0.8, 0.8); // 가끔 카메라를 돌림 → 키 방향 기준이 바뀜
    if (rnd() < dt * (b.pers.jump / 60) * (b.run ? 2 : 1)) b.vy = 7.5; // 걷다가(달리다가) 점프
    if (b.pers.kb && b.run && rnd() < dt / 8) b.run = false; else if (b.pers.kb && (c.run || c.far) && !b.run && dEnd > 15 && rnd() < dt / 4) b.run = true; // Shift 를 눌렀다 뗐다
    // 정체 감지: 1초 동안 기대한 만큼 못 가면 다시 길 찾기 → 옆으로 비켜 보기 → 포기
    if (!b.prog) b.prog = { t: now, x: p.x, z: p.z, exp: 0 };
    b.prog.exp += b.v * dt;
    if (now - b.prog.t > 1000) {
      const moved = Math.hypot(p.x - b.prog.x, p.z - b.prog.z);
      if (b.prog.exp > 1.2 && moved < b.prog.exp * 0.3) {
        b.stuck++; stats.stuck++;
        if (b.stuck === 1) b.path = null;
        else if (b.stuck === 2) { const t = cellPt(p.pl === 'town' ? 'town' : p.pl, (x, z) => Math.hypot(x - p.x, z - p.z) < 5); b.path = t ? [[p.x, p.z], t, ...P.slice(b.pi + 1)] : null; b.pi = 0; }
        else { stats.abandoned++; (stats.where ??= []).push([b.kind, p.pl, +p.x.toFixed(1), +p.z.toFixed(1)]); if (stats.where.length > 20) stats.where.shift(); // 어디서 끼였나 (최근 20곳, 확인용)
          b.q = []; b.cur = null; b.stuck = 0; if (++b.trap >= 3) leaveSoon(b); // 세 번 연달아 못 빠져나오면 그냥 나감 (다른 봇이 들어옴)
        }
      } else if (moved > 1) b.stuck = b.trap = 0;
      b.prog = { t: now, x: p.x, z: p.z, exp: 0 };
    }
    return false;
  }
  function move(b, x, z, walking, dt) { // 서버에 위치 보내기 (사람 화면이 보내는 것과 같은 'm')
    const p = b.p;
    if (b.vy || b.jy > 0) { b.vy -= 22 * dt; b.jy = Math.max(0, b.jy + b.vy * dt); if (b.jy === 0) b.vy = 0; }
    if (walking) b.ry = lerpAng(b.ry, b.h, 1 - Math.exp(-dt * 14));
    send(b, { t: 'm', x, z, ry: Math.round(b.ry * 100) / 100, w: walking ? 1 : 0, y: Math.round(b.jy * 100) / 100 });
  }
  const tap = (b, an, dt) => { b.h = an; b.ry = lerpAng(b.ry, an, 0.85); move(b, b.p.x + Math.sin(an) * R(0.12, 0.35), b.p.z + Math.cos(an) * R(0.12, 0.35), true, dt); }; // 키를 톡 눌러 방향만 돌림

  // ── 한 단계 실행. 끝나면 true
  function run(b, s, dt, now) {
    const p = b.p;
    switch (s.k) {
      case 'go': {
        if (s.seat != null) b.claim = s.seat;
        if (s.spot != null) b.spot = s.spot;
        if (s.seat != null && !seatOk(s.seat)) return fail(b); // 누가 먼저 앉음·불이 꺼짐
        if (!b.path) { if (!pathQ.includes(b)) pathQ.push(b); return false; } // 길 찾는 중 (잠깐 서 있음)
        if (b.run == null) { s.far ??= Math.hypot(s.x - p.x, s.z - p.z) > 50 && rnd() < b.pers.act * 0.6; b.run = b.pers.kb && (!!s.run || s.far); } // 먼 길은 활동적인 사람일수록 Shift 로 달려감
        if (steer(b, dt, now)) {
          b.path = null; b.v = 0; b.run = null; b.prog = null;
          if (s.face) tap(b, Math.atan2(s.face[0] - p.x, s.face[1] - p.z), dt); // 친구 쪽을 봄
          else if (!s.seat) move(b, p.x, p.z, false, dt);
          return true;
        }
        return false;
      }
      case 'idle': {
        s.until ??= now + s.s * 1000;
        if (b.vy || b.jy > 0) move(b, p.x, p.z, false, dt);
        if (s.look && now > (s.nl ??= now + R(1500, 7000))) { // 두리번: 사람 쪽이나 아무 데나 키를 톡
          const q = rnd() < 0.5 && others(b).find((o) => Math.hypot(o.x - p.x, o.z - p.z) < 10);
          tap(b, q ? Math.atan2(q.x - p.x, q.z - p.z) : b.ry + R(-2.2, 2.2), dt);
          s.nl = now + R(2000, 12000) * (1.5 - b.pers.act);
          if (rnd() < b.pers.jump / 40) b.vy = 7.5; // 심심하면 제자리 점프
        }
        greet(b, now);
        return now >= s.until;
      }
      case 'st': send(b, { t: 'st', s: s.s }); return true;
      case 'emote': send(b, { t: 'emote', e: s.e }); b.emoteAt = now; return true;
      case 'stand': if (p.seat >= 0) send(b, { t: 'stand' }); b.claim = -1; return true;
      case 'bye': remove(b); return false;
      case 'sit': {
        if (s.until == null) {
          if (!seatOk(s.seat)) return fail(b);
          const at = [p.x, p.z];
          send(b, { t: 'sit', seat: s.seat }); stats.sit[p.seat === s.seat ? 0 : 1]++;
          if (p.seat !== s.seat) return fail(b); // 규칙이 거절(멀다·닫힘 등)
          b.back = at;
          s.until = now + s.s * 1000;
        }
        if (p.seat !== s.seat) { b.claim = -1; return true; } // 캠프가 닫혀 일어났음 등
        if (b.kind === 'camp') fireworks(b, now);
        if (b.fw) return false;
        greet(b, now);
        if (now >= s.until && !b.q.some((x) => x.seated)) { send(b, { t: 'stand' }); b.claim = -1; return true; }
        return now >= s.until;
      }
      case 'act': { // 규칙(rituals.js)을 그대로 거침: 거절되면 건너뜀
        if (s.at == null) {
          if (s.seated && p.seat < 0) return true;
          send(b, { t: 'act', k: s.act, spot: s.spot });
          if (!p.act) { if (s.seated) { send(b, { t: 'stand' }); b.claim = -1; } return true; }
          s.at = now;
        }
        if (s.s && p.act && now - s.at > s.s * 1000) send(b, { t: 'act', k: 'stop' });
        if (p.act) return false;
        if (s.seated) { send(b, { t: 'stand' }); b.claim = -1; }
        return true;
      }
      case 'ride': { // 탈 수 있을 때까지 1.5~3.5초마다 '타기' (거절되면 기다림), 타면 서버가 내려 줄 때까지. 기차는 가끔 중간 역에서 내림
        s.until ??= now + s.s * 1000;
        if (p.ride) {
          if (s.on == null) { s.on = now; stats.rides[s.id] = (stats.rides[s.id] || 0) + 1; }
          if (s.hop && now - s.on > 25e3 && now >= (s.next || 0)) { s.next = now + 2000; send(b, { t: 'ride', op: 'off' }); }
          if (p.ride?.id === 'bumper' && now >= (s.drv || 0)) { // 범퍼카: 대충 앞으로 몰며 핸들을 이리저리, 벽이 가까우면 가운데 쪽으로 꺾음 (손님 입력과 같은 메시지)
            s.drv = now + R(400, 1100); const [x0, z0, x1, z1] = BUMPER.box, fx = Math.sin(p.ry), fz = Math.cos(p.ry), ahead = [p.x + fx * 4, p.z + fz * 4];
            const nearWall = ahead[0] < x0 + 1 || ahead[0] > x1 - 1 || ahead[1] < z0 + 1 || ahead[1] > z1 - 1, cx = (x0 + x1) / 2 - p.x, cz = (z0 + z1) / 2 - p.z;
            send(b, { t: 'ride', op: 'in', u: rnd() < 0.88 ? 1 : -0.5, s: nearWall ? (fx * cz - fz * cx > 0 ? 1 : -1) : Math.round(R(-0.7, 0.7) * 4) / 4 }); // (앞 × 가운데 방향) 부호 = 가운데가 오른쪽인지
          }
          if (p.ride?.id === 'teacups' && rnd() < dt * 0.25) send(b, { t: 'ride', op: 'in', d: rnd() < 0.65 ? 1 : -1 }); // 찻잔: 가끔 빠르게·느리게
          greet(b, now); return false;
        }
        if (s.on || now > s.until) return true; // 내렸음 / 너무 오래 기다려 포기
        if (now >= (s.next || 0)) { s.next = now + R(1500, 3500); send(b, { t: 'ride', op: 'on', id: s.id }); }
        return false;
      }
      case 'game': { // 놀이터 게임 (규칙은 games.js 그대로): 패드에 곧게 걸어 올라가 기다림 → 서버가 경기장으로 옮기면 놀기 → 끝나면 서버가 패드 밖으로 내보냄 → 흩어짐
        const G = GAMES[s.gid], info = ctx.gameInfo(p);
        if (info) { if (!s.played) { s.played = 1; stats.played[s.gid]++; } play(b, s, info, dt, now); return false; }
        if (s.played) return true;
        if (s.off) { if (Math.hypot(p.x - G.pad.x, p.z - G.pad.z) > G.pad.r + 1.5 || now - s.off[2] > 8000) return true; walkTo(b, s.off[0], s.off[1], dt, 5); return false; } // 그만둘 때는 패드에서 충분히 걸어 내려옴 (다른 활동이 패드 위에서 시작되지 않게)
        if (p.pad !== s.gid) { // 패드로: 사람이 패드에 섰거나 판이 도는 중이면 새로 끼어들지 않음 (사람 판을 봇이 바꾸지 않게)
          if (ctx.gameBusy(s.gid) || humanAt(s.gid) || now - (s.t0 ??= now) > 20e3) return true;
          s.tx ??= (() => { const a = R(0, 6.28), r = R(0, G.pad.r - 1); return [G.pad.x + Math.sin(a) * r, G.pad.z + Math.cos(a) * r]; })();
          walkTo(b, ...s.tx, dt, 5);
          return false;
        }
        s.at ??= now; b.v = 0;
        if (s.invite && !s.said && now - s.at > 3000) { s.said = 1; stats.chats++; send(b, { t: 'chat', text: pick(INVITE[s.gid]) }); } // 같이 할 사람을 한 번 부름
        let n = 0; for (const q of ctx.players.values()) if (q.pad === s.gid) n++;
        if (now - s.at > s.wait * 1000 && (n < G.min || ctx.gameBusy(s.gid))) { const a = Math.atan2(G.pad.x - G.cx, G.pad.z - G.cz) + R(-0.8, 0.8); s.off = [G.pad.x + Math.sin(a) * (G.pad.r + 2.4), G.pad.z + Math.cos(a) * (G.pad.r + 2.4), now]; } // 아무도 안 와서 그만 (카운트다운 중엔 안 내려감 → 사람이 낀 판을 깨지 않음)
        if (b.vy || b.jy > 0) move(b, p.x, p.z, false, dt);
        return false;
      }
      case 'fish': { // 던지기 → 입질에 맞춰 당기기 (가끔 너무 빨리·늦게 당겨 놓침)
        if (!p.fish) {
          if (s.wasFishing) { s.wasFishing = false; s.n--; s.nextCast = now + R(1500, 7000); }
          if (s.n <= 0 || (s.fails || 0) > 1) { b.spot = -1; return true; }
          if (now < (s.nextCast || 0)) return false;
          send(b, { t: 'fish', a: 'cast' });
          if (!p.fish) { s.fails = (s.fails || 0) + 1; s.nextCast = now + 1500; } else s.wasFishing = true;
          return false;
        }
        if (p.fish.st === 'wait' && rnd() < dt * 0.012) send(b, { t: 'fish', a: 'reel' }); // 참지 못하고 당김
        else if (p.fish.st === 'bite') {
          s.reelAt ??= now + (rnd() < 0.15 ? R(1500, 2200) : R(200, 700));
          if (now >= s.reelAt) { s.reelAt = null; send(b, { t: 'fish', a: 'reel' }); }
        }
        return false;
      }
      case 'follow': {
        const L = s.who;
        s.until ??= now + s.s * 1000;
        if (!bots.has(L) || L.leaving || now > s.until || GAME_KINDS.includes(L.kind)) return true; // 친구가 놀이터로 가면 안 따라감
        if (L.p.seat >= 0) { // 친구가 앉으면 옆자리에 (없으면 그 앞에 서 있다가 다른 데로)
          const ns = freeSeat(SEATS[L.p.seat].kind, [L.p.x, L.p.z], (q) => Math.hypot(q.x - L.p.x, q.z - L.p.z) < 4);
          b.q.unshift(...(ns ? [go(ns.x, ns.z, 1.5, { seat: ns.id }), { k: 'sit', seat: ns.id, s: R(60, 300) }] : [go(L.p.x + Math.sin(s.ring) * 1.8, L.p.z + Math.cos(s.ring) * 1.8, 0.8, { face: [L.p.x, L.p.z] }), idle(R(10, 40))]));
          return true;
        }
        const moving = L.cur?.k === 'go' && L.v > 0.5, d = moving ? 2 : 1.8, an = moving ? L.ry + Math.PI + s.side * 0.7 : s.ring;
        const tx = L.p.x + Math.sin(an) * d, tz = L.p.z + Math.cos(an) * d, far = Math.hypot(tx - p.x, tz - p.z);
        if (far < 0.7 && !moving) { if (!s.faced) { tap(b, Math.atan2(L.p.x - p.x, L.p.z - p.z), dt); s.faced = 1; } greet(b, now); b.v = 0; return false; }
        s.faced = 0;
        if (far > 12) { b.q.unshift(s); b.cur = go(tx, tz, 4); b.path = null; return false; } // 멀어지면 길을 찾아 따라잡고 다시 따라감
        b.path = [[p.x, p.z], [tx, tz]]; b.pi = 0;
        const sv = b.cur; b.cur = { k: 'go', r: 0.6 }; steer(b, dt, now); b.cur = sv;
        return false;
      }
    }
    return true;
  }
  // 경기장 안에서 놀기: 술래는 가까운 도망자를 쫓고, 도망자는 술래를 피해 달아남(벽 가까우면 가운데로) / 피구는 자기 진영에서 비키며 상대에게 물풍선, 가끔 점프로 피함
  function play(b, s, info, dt, now) {
    const p = b.p, G = GAMES[s.gid];
    if (info.phase !== 'play' || info.out) { if (b.vy || b.jy > 0) move(b, p.x, p.z, false, dt); return; } // 준비 3초(서버가 걷기를 막음) · 피구 탈락은 외야에서 구경
    const mates = []; for (const q of ctx.players.values()) if (q !== p && q.game === s.gid) { const v = ctx.gameInfo(q); if (v) mates.push([q, v]); }
    const near = (f) => { let best = null, bd = Infinity; for (const [q, v] of mates) if (f(v)) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } } return best && [best, bd]; };
    let ux = 0, uz = 0, sp = 5;
    if (now > (s.wn || 0)) { s.wn = now + R(1500, 3500); s.w = [G.cx + R(-0.8, 0.8) * G.hw, G.cz + R(-0.8, 0.8) * G.hd]; } // 어슬렁 목표
    if (s.gid === 'tag') {
      const it = info.role === 'it', f = near((v) => (it ? v.role === 'run' : v.role === 'it'));
      if (it && f) { ux = f[0].x - p.x; uz = f[0].z - p.z; sp = 8 * (0.82 + 0.18 * b.pers.act); }
      else if (!it && f && f[1] < 8) { // 달아나기 + 벽에서 떨어지기
        ux = (p.x - f[0].x) / f[1]; uz = (p.z - f[0].z) / f[1];
        const ex = (G.cx - p.x) / G.hw, ez = (G.cz - p.z) / G.hd;
        if (Math.abs(ex) > 0.7) ux += Math.sign(ex) * 1.3; if (Math.abs(ez) > 0.6) uz += Math.sign(ez) * 1.3;
        sp = 5 * (1.1 + 0.4 * b.pers.act);
      } else { ux = s.w[0] - p.x; uz = s.w[1] - p.z; }
    } else {
      const side = info.team === 0 ? -1 : 1;
      if (Math.abs(s.w[0] - G.cx) < 1.5 || Math.sign(s.w[0] - G.cx) !== side) s.w[0] = G.cx + side * R(2, G.hw - 1); // 자기 진영 안
      ux = s.w[0] - p.x; uz = s.w[1] - p.z;
      if (Math.hypot(ux, uz) < 0.5) ux = uz = 0;
      const foe = now > (s.nt ??= now + R(800, 2500)) && near((v) => v.team !== info.team && !v.out);
      if (foe) { s.nt = now + R(1400, 3200); const a = Math.atan2(foe[0].x - p.x, foe[0].z - p.z) + R(-0.14, 0.14); send(b, { t: 'throw', dx: Math.sin(a), dz: Math.cos(a) }); b.h = a; }
      if (!b.vy && !b.jy && rnd() < dt * 0.35) b.vy = 7.5; // 물풍선 피하기 점프
    }
    const l = Math.hypot(ux, uz);
    if (l < 0.01) { move(b, p.x, p.z, false, dt); return; }
    if (now < (s.det?.until || 0)) { const c = Math.cos(s.det.a), si = Math.sin(s.det.a); [ux, uz] = [ux * c - uz * si, ux * si + uz * c]; } // 막혀서 옆으로 돌아가는 중
    if (walkTo(b, p.x + (ux / l) * 3, p.z + (uz / l) * 3, dt, sp) < 0.35) s.det = { until: now + 700, a: rnd() < 0.5 ? 1.1 : -1.1 }; // 산울타리·상자에 막힘
  }
  // 곧게 걷기 (놀이터 패드·경기장은 걷기 격자 밖이라 길 찾기 없이). 충돌은 같은 resolve, 서버엔 같은 'm' → 실제로 간 비율(0~1)
  function walkTo(b, tx, tz, dt, sp) {
    const p = b.p, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), step = Math.min(d, sp * dt);
    if (step < 0.01) return 1;
    b.h = Math.atan2(dx, dz); b.v = sp;
    const n = Math.max(1, Math.ceil(step / 0.25)), sx = (dx / d) * step / n, sz = (dz / d) * step / n;
    let nx = p.x, nz = p.z;
    for (let k = 0; k < n; k++) [nx, nz] = resolve(nx + sx, nz + sz, 0.4, p.fl);
    const got = Math.hypot(nx - p.x, nz - p.z) / step;
    move(b, nx, nz, true, dt);
    return got;
  }
  const humanAt = (gid) => { for (const q of ctx.players.values()) if (!q.bot && (q.pad === gid || q.game === gid)) return true; return false; };
  // 놀이터 판 모으기: 낮(10~17시) 4~8분마다, 아침·저녁 무렵(8~10·17~19시) 10~18분마다 한 판 (밤엔 캠프·불꽃 시간이라 없음). 술래잡기·피구 번갈아
  // 안전: 판이 도는 중·사람이 패드에 있으면 안 모음. 사람이 접속해 있으면 가끔(30%) 한 명만 패드에서 기다림 → 사람이 오면 그 사람과 함께 시작
  function organize(now, force) { // force = { gid, invite } (시험용: 지금 바로 한 판)
    if (now < gameNext && !force) return;
    const h = H(), every = h >= 10 && h < 17 ? [4, 8] : (h >= 8 && h < 10) || (h >= 17 && h < 19) ? [10, 18] : null;
    gameNext = now + (every ? R(every[0], every[1]) : 10) * 60e3;
    if (!every && !force) return;
    const gid = force?.gid ?? GAME_KINDS[gameTurn++ % 2], G = GAMES[gid];
    if (ctx.gameBusy(gid) || humanAt(gid) || [...bots].some((o) => o.kind === gid)) return;
    const invite = force ? !!force.invite : humans() > 0 && rnd() < 0.3;
    const c = [...bots].filter((o) => !o.leaving && !o.fw && !GAME_KINDS.includes(o.kind) && o.p.pl === 'town' && o.p.seat < 0 && !o.p.ride && !o.p.fish && !o.p.act && Math.hypot(o.p.x - G.pad.x, o.p.z - G.pad.z) < 90)
      .map((o) => [Math.hypot(o.p.x - G.pad.x, o.p.z - G.pad.z) * R(0.7, 1.3), o]).sort((a, b) => a[0] - b[0]).map(([, o]) => o);
    if (c.length < (invite ? 1 : 2)) { gameNext = now + 60e3; return; } // 근처에 놀 봇이 없음 → 1분 뒤 다시
    const dx = G.pad.x - G.cx, dz = G.pad.z - G.cz, away = Math.atan2(dx, dz);
    for (const o of c.slice(0, invite ? 1 : 3 + Math.floor(R(0, 4)))) {
      let at = null; // 패드 바깥(경기장 반대쪽)에서 모였다가 곧게 올라감
      for (let k = 0; k < 8 && !at; k++) { const a = away + R(-0.9, 0.9), x = G.pad.x + Math.sin(a) * (G.pad.r + 3.4), z = G.pad.z + Math.cos(a) * (G.pad.r + 3.4); if (free(x, z)) at = [x, z]; }
      if (!at) continue;
      o.q = [go(...at, 1.2, { run: rnd() < 0.5 }), { k: 'game', gid, wait: invite ? R(45, 90) : R(25, 50), invite }, idle(R(2, 6))];
      o.cur = null; o.path = null; o.claim = -1; o.spot = -1; o.kind = gid;
    }
    stats.rounds[gid]++;
  }
  const seatOk = (id) => ctx.seatFree(id) && (SEATS[id].kind !== 'fire' || ctx.campOpen());
  function fail(b) { b.q = []; b.cur = null; b.claim = -1; b.spot = -1; b.path = null; return false; }
  function greet(b, now) { // 가까이 온 사람(진짜 접속자 포함)에게 가끔 이모트
    if (now < b.emoteAt || rnd() > 0.02) return;
    const q = others(b).find((o) => { const d = Math.hypot(o.x - b.p.x, o.z - b.p.z); return d < 6 && d > 0.8 && o.w; });
    b.emoteAt = now + R(60e3, 240e3);
    if (q && rnd() < 0.3 + b.pers.soc * 0.5) send(b, { t: 'emote', e: rnd() < 0.55 ? '👋' : pick(EMOTES) });
  }
  function fireworks(b, now) { // 캠프에서 한 번에 한 봇만, 합쳐서 평균 3분에 한 번쯤 천천히 그려 쏨
    const p = b.p;
    if (!b.fw) {
      if (fwBot || now < fwNext || !ctx.campOpen() || rnd() > 0.02) return;
      fwNext = now + R(140e3, 240e3);
      send(b, { t: 'fw', k: 'start', ry: p.ry });
      if (!p.fw) return;
      const names = Object.keys(FW_SHAPES), list = [pick(names), ...(rnd() < 0.5 ? [pick(names)] : [])];
      b.fw = { strokes: list.flatMap((n) => FW_SHAPES[n]().map((s) => s.map(([u, v]) => [u + R(-0.004, 0.004), v + R(-0.004, 0.004)]))).slice(0, 8), si: 0, pi: -1, wait: now + R(800, 2000) };
      fwBot = b; stats.fw++;
      return;
    }
    const f = b.fw;
    if (!p.fw || f.si >= f.strokes.length) { if (p.fw) send(b, { t: 'fw', k: 'stop' }); b.fw = null; fwBot = null; return; }
    if (now < f.wait) return;
    const s = f.strokes[f.si];
    if (f.pi < 0) { send(b, { t: 'fw', k: 'down' }); f.pi = 0; return; }
    const n = Math.min(s.length - f.pi, 3 + Math.floor(R(0, 2)));
    if (n > 0) send(b, { t: 'fw', k: 'pts', p: s.slice(f.pi, f.pi + n).map(([u, v]) => [Math.max(-1, Math.min(1, u)), Math.max(-1, Math.min(1, v))]) });
    f.pi += n;
    if (f.pi >= s.length) { send(b, { t: 'fw', k: 'up' }); f.si++; f.pi = -1; f.wait = now + R(1100, 2500); }
  }
  // 마을 전체 채팅: 봇 합쳐서 평균 50초(사람이 있으면 32초)에 한 마디, 최소 10초 간격. 사람 말에는 답하지 않음
  function chat(now, force) {
    if (!force && now < nextChat) return;
    nextChat = now + Math.max(10e3, -Math.log(1 - rnd()) * (humans() ? 32e3 : 50e3));
    const c = force?.who ? [force.who] : [...bots].filter((b) => !b.leaving && now > b.chatAt);
    if (!c.length) return;
    const b = pick(c), h = H(), pl = b.p.pl;
    const cat = force?.cat ?? (rnd() < 0.45 ? { cafe: 'cafe', office: 'office', casino: 'casino', camp: 'camp', cathedral: 'sacred', church: 'sacred', temple: 'sacred', park: 'fun', zoo: 'zoo' }[pl] ?? (b.kind === 'pond' ? 'pond' : null) : null) ??
      (rnd() < 0.4 ? (h < 5 ? 'late' : h < 10 ? 'morning' : h >= 11.5 && h < 13.5 ? 'lunch' : h >= 17.5 && h < 19.5 ? 'evening' : h >= 20 ? 'night' : null) : null) ?? 'any';
    const fresh = LINES[cat].filter((t) => !recent.includes(t));
    let text = pick(fresh.length ? fresh : LINES.any);
    recent.push(text); if (recent.length > 40) recent.shift();
    if (rnd() < 0.12) text += pick(['ㅋㅋ', '~', '..', 'ㅎㅎ', '!']);
    b.chatAt = now + 90e3; stats.chats++;
    send(b, { t: 'chat', text });
  }

  function tick() {
    const t0 = performance.now(), now = ctx.now(), dt = Math.min(0.3, Math.max(0, (now - last) / 1000));
    last = now;
    if (!target) return;
    population(now);
    organize(now);
    for (let k = 0; k < 2 && pathQ.length; k++) { // 길 찾기는 한 틱에 둘까지 (CPU 고르게)
      const b = pathQ.shift(), c = b.cur;
      if (!bots.has(b) || !c || c.k !== 'go') continue;
      const s = performance.now();
      const bk = b.back; b.back = null; // 막 일어났으면 앉으러 들어온 자리로 먼저 나감 (의자 줄·벤치 사이에서 길이 막히지 않게)
      b.path = findPath(...(bk ?? [b.p.x, b.p.z]), c.x, c.z, c.spot != null); if (b.path && bk) b.path.unshift([b.p.x, b.p.z]); b.pi = 0;
      stats.paths++; stats.pathMs += performance.now() - s;
      if (!b.path) fail(b); else lane(b.path, R(-1.2, 1.2));
    }
    for (const b of [...bots]) {
      b.t += dt;
      if (b.leaving && now > b.leaving) { remove(b); continue; }
      if (now < b.next) continue;
      if (!b.cur) {
        if (!b.q.length) { b.q = choose(b) || [idle(10)]; b.claim = -1; b.spot = -1; }
        b.cur = b.q.shift(); b.path = null; b.prog = null; b.stuck = 0;
      }
      if (run(b, b.cur, dt, now) && bots.has(b)) b.cur = null;
    }
    chat(now);
    if (greetAt && now >= greetAt) { greetAt = 0; chat(now, { cat: 'greet' }); }
    const ms = performance.now() - t0;
    stats.tickMs.push(ms); if (stats.tickMs.length > 600) stats.tickMs.shift();
  }

  return {
    tick, stats, list: () => [...bots], grid, organize: (gid, invite) => organize(ctx.now(), { gid, invite }),
    reserved: (nick) => reservedSet.has(String(nick).toLowerCase()),
    // 불꽃놀이 영업 중단: 놀이공원 안 봇은 하던 일을 접고 정문 밖으로 걸어 나감 (타고 있는 봇은 회차가 끝나면 나옴) / 문이 닫힐 때 옮겨진 봇은 하던 일을 비움
    evac(pt) {
      for (const b of bots) {
        const p = b.p; if (!inPark(p.x, p.z) || p.ride || b.leaving) continue;
        if (p.seat >= 0) send(b, { t: 'stand' });
        const [x, z] = pt(); b.q = [go(x, z, 1.5, { run: rnd() < 0.5 }), idle(R(5, 30))]; b.cur = null; b.path = null; b.claim = -1; b.spot = -1; b.kind = null;
      }
    },
    // 불꽃놀이 구경: 마을·길에 있던 봇 중 일부(frac)가 다리 가운데 광장으로 걸어가 서서 구경 (pt() = 다리 위 자리)
    gather(pt, frac = 0.55) {
      for (const b of bots) {
        const p = b.p; if (b.leaving || p.ride || p.fl || !['town', 'park'].includes(p.pl) || rnd() > frac) continue;
        if (p.seat >= 0) send(b, { t: 'stand' });
        const [x, z] = pt(); b.q = [go(x, z, 1.5, { run: rnd() < 0.4 }), idle(Number(process.env.SHOW_HOLD_S) || R(420, 620), 0.2)]; b.cur = null; b.path = null; b.claim = -1; b.spot = -1; b.kind = null;
      }
    },
    reset(p) { const b = [...bots].find((o) => o.p === p); if (b) { b.q = []; b.cur = null; b.path = null; b.claim = -1; b.spot = -1; b.kind = null; } },
    async start(n, { timer: useTimer = true } = {}) { // 닉네임 풀에서 이미 가입한 사람 이름은 빼고 예약 → n명 넣기
      const ok = [];
      for (const nick of NICKS) if (!(await ctx.nickTaken(nick))) ok.push(nick);
      pool = ok; reservedSet = new Set(ok.map((s) => s.toLowerCase()));
      grid();
      target = n; last = ctx.now(); gameNext = last + 120e3; nextPop = last + R(60e3, 180e3); nextChat = last + R(15e3, 40e3); fwNext = last + R(30e3, 90e3);
      for (let i = 0; i < n; i++) spawn(true);
      if (useTimer && !timer) timer = setInterval(tick, 100); // 10Hz
    },
    stop() { clearInterval(timer); timer = null; target = 0; for (const b of [...bots]) remove(b); },
    onHuman() { // 사람이 들어오면 가끔 누군가 인사 (그 사람 말에 답하는 건 아님)
      if (bots.size && rnd() < 0.35) greetAt = ctx.now() + R(3e3, 9e3); // 3~9초 뒤 (틱에서)
    },
  };
}
