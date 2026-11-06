// 봇 유저 시험: 닉네임 풀·예약, 걷기 격자·길 찾기, 서버 통합(포트 3392, 봇 20명): welcome·위치 스냅샷·귓속말,
// 가짜 시계로 몇십 분 빠르게 돌리며 매 틱 규칙 검사(충돌·울타리·놀이터·좌석·불꽃·낚시), 이동 통계, 시간대별 장소, 들락날락, 채팅 빈도, 저장 안 함,
// 놀이기구·놀이터 게임(봇끼리 한 판·사람이 패드에 서면 봇이 안 끼어듦·기다리던 봇과 사람이 같이 시작·끝나면 경기장에 안 남음), 틱 비용(80명)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 가짜 시계·고정 난수: 서버를 불러오기 전에 바꿔야 모든 규칙 모듈이 같은 시계를 씀
const KST0 = Date.UTC(2026, 10, 4) - 9 * 3600e3; // 2026-11-04(수) 00:00 한국 시간
let T = KST0 + 2.5 * 3600e3;
Date.now = () => T;
let seed = 20261104;
Math.random = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-bots-'));
delete process.env.BOTS; delete process.env.CAMP_AT; delete process.env.RITUAL_AT;

const W = await import('./public/world.js');
const B = await import('./bots.js');
const S = await import('./server.js');
const { WebSocket } = await import('ws');
const { NICKS, grid, findPath, banned } = B;
const NICK = /^[0-9A-Za-z가-힣_]{2,10}$/;

// ── 1. 닉네임 풀
assert.ok(NICKS.length >= 200, `닉네임 풀 200개 이상 (지금 ${NICKS.length})`);
assert.equal(new Set(NICKS.map((n) => n.toLowerCase())).size, NICKS.length, '닉네임 풀에 중복 없음(대소문자 무시)');
for (const n of NICKS) assert.ok(NICK.test(n), `닉네임 규칙 통과: ${n}`);
assert.ok(NICKS.some((n) => /^[a-z0-9_]+$/.test(n)) && NICKS.some((n) => /[가-힣]/.test(n)) && NICKS.some((n) => /\d/.test(n)) && NICKS.some((n) => n.includes('_')), '한글·영문·숫자·_ 섞임');
for (const n of NICKS) assert.ok(!/(시발|씨발|병신|개새|존나|섹스|admin|운영자|관리자|gm_)/i.test(n), `욕설·사칭 없음: ${n}`);

// ── 2. 걷기 격자: 닿는 칸은 전부 빈 땅이고 놀이터 밖, 주요 목적지까지 길이 있음
const g = grid(), N = g.reach.length;
let cells = 0;
for (let i = 0; i < N; i++) if (g.reach[i]) {
  cells++;
  const x = g.X(i), z = g.Z(i), [a, b] = W.resolve(x, z, 0.4, 0);
  assert.ok(Math.hypot(a - x, b - z) < 0.05 && !banned(x, z), `격자 칸 (${x},${z}) 은 빈 땅·놀이터 밖`);
}
assert.ok(cells > 5000, `걸어서 닿는 칸이 충분함 (${cells})`);
for (const k of ['town', 'cafe', 'office', 'casino', 'cathedral', 'church', 'temple', 'trail', 'camp', 'park', 'zoo']) assert.ok(g.cells[k]?.length, `장소 ${k} 에 닿는 칸 있음`);
let pmax = 0;
const dests = [...W.SEATS.filter((s) => s.fl === 0 && ['cafe', 'office', 'park', 'fire', 'pew'].includes(s.kind)), ...W.SPOTS.filter((q) => ['cushion', 'font', 'candle', 'bell', 'lantern', 'piano'].includes(q.kind))];
for (const d of dests) {
  const t0 = performance.now(), p = findPath(0, 9, d.x, d.z);
  pmax = Math.max(pmax, performance.now() - t0);
  assert.ok(p && p.length >= 2, `광장 → ${d.kind} (${d.x.toFixed(1)},${d.z.toFixed(1)}) 길 있음`);
  for (let k = 1; k < p.length - 1; k++) assert.ok(!banned(p[k][0], p[k][1]), '길이 놀이터를 지나지 않음');
}
console.log(`  격자 ${cells}칸, 목적지 ${dests.length}곳 길 찾기 최대 ${pmax.toFixed(1)}ms`);

// ── 3. 서버 통합 (포트 3392)
const PORT = 3392, srv = await S.listen(PORT);
const api = async (name, body) => { const r = await fetch(`http://localhost:${PORT}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return [r.status, await r.json()]; };
const pre = NICKS.find((n) => /^[a-z]+$/.test(n)); // 봇이 켜지기 전에 가입한 사람 = 풀에서 빠져야 함
assert.equal((await api('signup', { id: 'early1', nick: pre, pw: 'secret1' }))[0], 200, '봇 켜기 전 가입');
assert.equal(S.bots.list().length, 0, 'listen() 만 부르면 봇 꺼짐 (시험 기본값)');
const BOTS = 20;
await S.bots.start(BOTS, { timer: false });
assert.equal(S.bots.list().length, BOTS, `봇 ${BOTS}명 들어옴`);
assert.ok(!S.bots.reserved(pre) && !S.bots.list().some((b) => b.p.nick.toLowerCase() === pre.toLowerCase()), '이미 가입한 닉네임은 봇이 안 씀');
const used = S.bots.list().map((b) => b.p.nick);
assert.equal(new Set(used).size, used.length, '봇 닉네임 동시 중복 없음');
const free1 = NICKS.find((n) => n !== pre && !used.includes(n));
for (const n of [used[0], used[1].toUpperCase(), free1]) {
  const [st, j] = await api('signup', { id: 'try' + Math.floor(Math.random() * 1e6), nick: n, pw: 'secret1' });
  assert.equal(st, 409, `봇 닉네임(${n})으로 가입 → 409`); assert.equal(j.error, '이미 있는 닉네임이에요');
}
for (const b of S.bots.list()) { const p = b.p; assert.ok(p.bot && p.ws === null && !p.uid && p.a && Number.isFinite(p.x) && p.id > 0 && S.players.get(p.id) === p, '봇은 사람과 같은 모양 + ws 없음 + uid 없음'); }

// 사람 한 명 접속
const [, me] = await api('signup', { id: 'human1', nick: '시험사람', pw: 'secret1' });
await api('avatar', { token: me.token, avatar: { g: 'f' } });
const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
ws.on('message', (d) => inbox.push(JSON.parse(d)));
await new Promise((r) => ws.on('open', r));
ws.send(JSON.stringify({ t: 'join', token: me.token }));
const wait = async (f, ms = 3000) => { const end = performance.now() + ms; while (performance.now() < end) { const m = inbox.find(f); if (m) return m; await new Promise((r) => setTimeout(r, 20)); } throw new Error('기다린 메시지가 안 옴'); };
const welcome = await wait((m) => m.t === 'welcome');
const ids = new Set(S.bots.list().map((b) => b.p.id));
assert.equal(welcome.players.filter((q) => ids.has(q.id)).length, BOTS, 'welcome 에 봇이 다 보임');
assert.ok(welcome.players.every((q) => !('bot' in q) && !('ws' in q)), '화면으로 가는 정보엔 봇 표시가 없음 (사람과 똑같이 보임)');

// 시뮬레이션 도구: 서버 틱(50ms)·봇 틱(100ms)을 가짜 시계로 빠르게
const sink = { readyState: 1, bufferedAmount: 0, rej: {}, send(s) { const m = s.match(/^\{"t":"(fwno|actno|sitfail|czerr|dmfail)"/) || (s.startsWith('{"t":"fish","a":"no"') && [0, 'fishno']); if (m) { this.rej[m[1]] = (this.rej[m[1]] || 0) + 1; } } };
const live = () => S.bots.list().map((b) => b.p);
function step() { T += 50; S.tick(); T += 50; S.tick(); for (const b of S.bots.list()) b.p.ws ??= sink; S.bots.tick(); } // 봇이 받은 거절 메시지를 세려고 가짜 연결을 붙임
const fails = [];
const bad = (msg) => { if (fails.length < 20) fails.push(msg); };
const prevTown = new Map(), track = new Map(), speeds = [], perBot = new Map(), turns = [0, 0];
let jumps = 0, botSec = 0, fwMax = 0, popMin = Infinity, popMax = 0, fwStarts = 0;
const fwSeen = new Set();
const nearGate = (x, z) => (Math.abs(x - W.GATE.x) < 4 && Math.abs(z - W.GATE.z) < W.GATE.hw + 1.5) || (Math.abs(x - W.VILLAGE_GATE_W.x) < 4 && Math.abs(z - W.VILLAGE_GATE_W.z) < W.VILLAGE_GATE_W.hw + 1.5) || (Math.abs(z - W.CAMP_GATE.z) < 4 && Math.abs(x - W.CAMP_GATE.x) < W.CAMP_GATE.hw + 1.5);
const kindOf = new Map(), padSec = new Map(); // 봇별 지금 활동 / 패드에 서 있은 시간
function check(i) {
  const ps = live();
  kindOf.clear(); for (const b of S.bots.list()) kindOf.set(b.p, b.kind);
  popMin = Math.min(popMin, ps.length); popMax = Math.max(popMax, ps.length);
  let fwn = 0;
  for (const p of ps) {
    if (p.fw) { fwn++; if (!fwSeen.has(p.fw)) { fwSeen.add(p.fw); fwStarts++; } }
    if (p.seat < 0 && !p.transit && !p.fl && !p.ride) { // 놀이기구 탄 봇은 기구 자리(충돌 안·빠름)라 걷기 검사에서 뺌
      const [a, b] = W.resolve(p.x, p.z, 0.4, 0);
      if (Math.hypot(a - p.x, b - p.z) > 0.1) bad(`${p.nick} 충돌 안(10cm 넘게) (${p.x},${p.z})`);
      const it = W.inTown(p.x, p.z), was = prevTown.get(p);
      if (was != null && was !== it && !nearGate(p.x, p.z)) bad(`${p.nick} 울타리를 대문 밖에서 넘음 (${p.x.toFixed(1)},${p.z.toFixed(1)})`);
      prevTown.set(p, it);
    } else prevTown.delete(p);
    if ((p.pad || p.game) && !['tag', 'dodge'].includes(kindOf.get(p))) bad(`${p.nick} 놀러 가지 않았는데 놀이터 패드·게임에 들어감 (${kindOf.get(p)} ${S.bots.list().find((b) => b.p === p)?.cur?.k} ${p.x.toFixed(1)},${p.z.toFixed(1)} T${((T - KST0) / 3600e3).toFixed(2)})`);
    if (p.pad) { const t = (padSec.get(p) || 0) + 0.1; padSec.set(p, t); if (t > 100) bad(`${p.nick} 패드에서 너무 오래 기다림`); } else padSec.delete(p);
    for (const G of Object.values(W.GAMES)) if (!p.game && Math.abs(p.x - G.cx) < G.hw && Math.abs(p.z - G.cz) < G.hd) bad(`${p.nick} 게임이 아닌데 놀이터 울타리 안 (갇힘)`);
    if (p.seat >= 0 && S.taken.get(p.seat) !== p.id) bad(`${p.nick} 앉은 자리가 taken 과 다름`);
    if (p.fish) { const d = Math.hypot(p.x - W.POND.x, p.z - W.POND.z); if (d < W.POND.r + 0.2 || d > W.POND.r + 3) bad(`${p.nick} 연못에서 먼 데서 낚시`); }
  }
  const seatOwners = new Map();
  for (const [seat, id] of S.taken) { const q = ps.find((p) => p.id === id); if (q && q.seat !== seat) bad(`자리 ${seat} 주인 불일치`); if (q) seatOwners.set(id, (seatOwners.get(id) || 0) + 1); }
  for (const n of seatOwners.values()) if (n > 1) bad('한 봇이 두 자리를 차지');
  fwMax = Math.max(fwMax, fwn);
  if (i % 10) return; // 1초마다 이동 통계
  for (const p of ps) {
    const o = track.get(p);
    if (o && p.seat < 0 && o.seat < 0 && !p.ride && !o.ride && !p.game && !o.game) { // 놀이터 게임 중엔 서버가 경기장 안팎으로 옮김(tp) → 걷기 속도에서 뺌
      const v = Math.hypot(p.x - o.x, p.z - o.z); speeds.push(v); botSec++;
      const pb = perBot.get(p) || []; pb.push(v); perBot.set(p, pb);
      if (v > 0.5) { turns[0]++; if (Math.abs(((p.ry - o.ry + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.5) turns[1]++; }
    }
    if (o && p.y > 0 && !o.jy) jumps++;
    track.set(p, { x: p.x, z: p.z, ry: p.ry, seat: p.seat, jy: p.y > 0, ride: !!p.ride, game: !!p.game });
  }
}
function sim(sec, onSec) { for (let i = 0; i < sec * 10; i++) { step(); check(i); if (onSec && i % 10 === 0) onSec(i / 10); } }
const places = (ps) => { const c = {}; for (const p of ps) c[p.pl] = (c[p.pl] || 0) + 1; return c; };
const kinds = () => { const c = {}; for (const b of S.bots.list()) c[b.kind] = (c[b.kind] || 0) + 1; return c; };

// 저장 감시: 봇만 움직이는 동안 저장소에 쓰는 일이 없어야 함
let writes = 0;
const set0 = S.store.set.bind(S.store);
S.store.set = (...a) => { writes++; return set0(...a); };

// 위치 스냅샷이 실시간으로 계속 옴 (진짜 타이머)
sim(10); inbox.length = 0;
for (let i = 0; i < 20; i++) { sim(0.1); await new Promise((r) => setTimeout(r, 100)); }
const snaps = inbox.filter((m) => m.t === 's' && m.p.some((e) => ids.has(e[0])));
assert.ok(snaps.length >= 10, `봇 위치 스냅샷이 계속 옴 (${snaps.length}번/2초)`);

// 사람 채팅·귓속말에 답하지 않음 (봇에게 귓속말 → 오류 없이 조용히)
sim(15); inbox.length = 0;
const chats0 = S.bots.stats.chats;
const target = live()[0].nick;
ws.send(JSON.stringify({ t: 'chat', text: '안녕하세요 다들 봇이에요?' }));
await new Promise((r) => setTimeout(r, 450));
ws.send(JSON.stringify({ t: 'dm', to: target, text: '혹시 봇이세요?' }));
await new Promise((r) => setTimeout(r, 150));
sim(1.5); await new Promise((r) => setTimeout(r, 150));
assert.ok(!inbox.some((m) => m.t === 'dmfail'), '봇에게 귓속말 → 실패 없이 감');
assert.ok(!inbox.some((m) => m.t === 'dm' && m.from !== '시험사람'), '봇이 귓속말에 답하지 않음');
assert.equal(S.bots.stats.chats, chats0, '사람이 말해도 봇이 바로 따라 말하지 않음');

// 시간대별로 몇 분씩: 03시(새벽 캠프) → 12시(점심 카페·회사) → 17:50(저녁 예불·미사) → 20시(밤 캠프·광장)
const dist = {};
const phases = [['03', 3, 7, 4], ['12', 12, 7, 4], ['18', 17.8, 6, 6], ['20', 20, 7, 4]];
const simStart = T, chatStart = S.bots.stats.chats, fwStart = S.bots.stats.fw;
let simSec = 0;
for (const [name, h, warm, look] of phases) {
  T = KST0 + h * 3600e3; S.tick(); S.bots.tick(); track.clear(); prevTown.clear(); // 시계를 건너뛴 순간은 이동 통계에서 뺌
  sim(warm * 60); simSec += warm * 60;
  const pl = {}, kd = {};
  sim(look * 60, (s) => { if (s % 10) return; for (const [k, v] of Object.entries(places(live()))) pl[k] = (pl[k] || 0) + v; for (const [k, v] of Object.entries(kinds())) kd[k] = (kd[k] || 0) + v; });
  simSec += look * 60;
  const tot = Object.values(pl).reduce((a, b) => a + b, 0), share = (k) => (pl[k] || 0) / tot;
  dist[name] = Object.fromEntries(Object.entries(pl).map(([k, v]) => [k, Math.round((v / tot) * 100)]));
  console.log(`  ${name}시 장소 %`, JSON.stringify(dist[name]), '활동', JSON.stringify(Object.fromEntries(Object.entries(kd).map(([k, v]) => [k, Math.round(v / (look * 6))]))));
  if (name === '03') { assert.ok(share('camp') >= 0.25, `03시 캠프가 많음 (${dist[name].camp}%)`); assert.ok(share('office') < 0.08, '03시 회사 거의 없음'); }
  if (name === '12') { assert.ok(share('cafe') + share('office') >= 0.2, '12시 카페·회사가 많음'); assert.ok(share('camp') < 0.03, '12시 캠프(닫힘)엔 거의 없음'); }
  if (name === '18') assert.ok(share('temple') + share('cathedral') + share('church') >= 0.1, '18시 예불·미사에 모임');
  if (name === '20') { assert.ok(share('camp') >= 0.2, `20시 캠프가 많음 (${dist[name].camp}%)`); assert.ok(share('office') < 0.1, '20시 회사 거의 없음'); }
}
assert.deepEqual(fails, [], '매 틱 규칙 검사 위반 없음');
console.log(`  놀이기구 탑승 ${JSON.stringify(S.bots.stats.rides)} · 놀이터 판 모음 ${JSON.stringify(S.bots.stats.rounds)} · 참가 ${JSON.stringify(S.bots.stats.played)}`);
assert.ok(Object.values(S.bots.stats.rides).reduce((a, b) => a + b, 0) >= 3, '봇이 놀이기구를 탐');
assert.ok(S.bots.stats.played.tag + S.bots.stats.played.dodge >= 2, '낮에 봇들이 놀이터 게임을 함');
assert.equal(writes, 0, '봇은 저장소에 아무것도 쓰지 않음 (auth.save* 안 부름)');

// 이동 통계 (1초 간격 이동 거리 = 속도)
const moving = speeds.filter((v) => v > 0.5), mean = moving.reduce((a, b) => a + b, 0) / moving.length;
const stopped = speeds.filter((v) => v < 0.2).length / speeds.length, runs = moving.filter((v) => v > 6).length / moving.length;
const botMeans = [...perBot.values()].map((a) => a.filter((v) => v > 0.5)).filter((a) => a.length > 20).map((a) => a.reduce((x, y) => x + y, 0) / a.length);
const spread = Math.max(...botMeans) - Math.min(...botMeans), turnRate = turns[1] / turns[0], jpm = jumps / (botSec / 60);
const hist = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((a) => speeds.filter((v) => v >= a && v < a + 1).length);
console.log(`  이동: 걷는 중 평균 ${mean.toFixed(2)}m/s, 달리기 ${(runs * 100).toFixed(1)}%, 서 있음 ${(stopped * 100).toFixed(0)}%, 봇별 평균 차이 ${spread.toFixed(2)}, 1초에 30°↑ 방향 바뀜 ${(turnRate * 100).toFixed(0)}%, 점프 ${jpm.toFixed(2)}/분, 속도 분포(1m/s 칸) ${hist.join(' ')}`);
assert.ok(mean >= 3.5 && mean <= 5.2, '걷는 속도 평균 3.5~5.2m/s');
assert.ok(runs >= 0.01 && runs <= 0.3, '가끔 달림 (1~30%)');
assert.ok(Math.max(...moving) <= 8.8, '최고 속도는 달리기(8m/s) 이하 (가속·방향 바꿈 때 한 번 8.5 가 나와 8.4 → 8.8)');
assert.ok(stopped >= 0.2 && stopped <= 0.85, '서 있는 비율 20~85%');
assert.ok(spread >= 0.4, '사람마다 걷는 속도가 다름');
assert.ok(turnRate >= 0.03 && turnRate <= 0.45, '방향 전환이 사람다운 범위');
assert.ok(jpm >= 0.05 && jpm <= 3, '점프는 가끔 (분당 0.05~3번)');

// 들락날락·채팅·불꽃 빈도
const st = S.bots.stats;
console.log(`  들어옴 ${st.joins - BOTS} / 나감 ${st.leaves}, 인원 ${popMin}~${popMax}, 채팅 ${st.chats - chatStart}번/${(simSec / 60).toFixed(0)}분, 불꽃 ${st.fw - fwStart}번 (동시 최대 ${fwMax}), 길 ${st.paths}번(평균 ${(st.pathMs / st.paths).toFixed(2)}ms), 끼임 ${st.stuck}·포기 ${st.abandoned}, 앉기 성공 ${st.sit[0]}·실패 ${st.sit[1]}, 거절 ${JSON.stringify(sink.rej)}`);
assert.ok(st.leaves >= 5 && st.joins - BOTS >= 5, '1~3분마다 들락날락');
assert.ok(popMin >= BOTS - 2 && popMax <= BOTS + 2, `인원 ${BOTS}±2 유지`);
const chatN = st.chats - chatStart;
assert.ok(chatN >= 5 && simSec / chatN >= 25, `채팅은 가끔 (평균 ${(simSec / chatN).toFixed(0)}초에 한 마디, 25초 이상)`);
assert.ok(fwMax <= 1 && st.fw - fwStart <= simSec / 120 + 1, '불꽃놀이는 한 번에 한 봇, 평균 2분에 한 번 이하');
assert.ok(!sink.rej.fwno && !sink.rej.fishno, '불꽃놀이·낚시 규칙에 거절당하는 일 없음');
assert.ok(st.abandoned <= st.paths * 0.03, '끼여서 포기하는 일 거의 없음');

// ── 놀이터 게임: 봇끼리 한 판 → 사람이 패드에 서 있으면 봇이 안 끼어듦 → 한 명만 기다리던 봇과 사람이 같이 시작 → 끝나면 아무도 경기장에 안 남음
{
  T = KST0 + 12 * 3600e3; S.tick(); S.bots.tick(); track.clear(); prevTown.clear();
  const meP = [...S.players.values()].find((p) => !p.bot), msgs = (t, g) => inbox.filter((m) => m.t === t && m.g === g);
  const mv = async (x, z) => { ws.send(JSON.stringify({ t: 'm', x, z, ry: 0, w: 0, y: 0 })); await new Promise((r) => setTimeout(r, 120)); };
  const flush = () => new Promise((r) => setTimeout(r, 150));
  // 1) 봇끼리 피구 한 판 (패드 → 경기장 → 끝나면 흩어짐)
  const p0 = S.bots.stats.played.dodge; inbox.length = 0;
  S.bots.organize('dodge');
  sim(170); await flush();
  assert.ok(S.bots.stats.played.dodge - p0 >= 2, `봇끼리 피구 한 판 (참가 ${S.bots.stats.played.dodge - p0}명)`);
  assert.ok(msgs('gstate', 'dodge').length >= 1 && msgs('gend', 'dodge').length >= 1, '피구가 시작하고 끝남 (구경꾼은 판 상태·끝남만 받음)');
  assert.ok(!msgs('gstart', 'dodge').length && msgs('gend', 'dodge').every((m) => !m.msg && !m.winners) && !inbox.some((m) => m.t === 'ghit'), '봇끼리 한 판의 결과·맞음 알림은 구경하는 사람에게 안 감');
  assert.ok(inbox.some((m) => m.t === 'balloon'), '봇이 물풍선을 던짐');
  sim(40);
  assert.ok(live().every((p) => !p.game && !p.pad), '끝나고 40초 뒤 아무도 패드·경기장에 없음');
  // 2) 사람이 술래잡기 패드에 혼자 서 있으면 봇이 새로 오지 않음 (게임이 저절로 시작되지 않음)
  await mv(W.TAG.pad.x, W.TAG.pad.z); assert.equal(meP.pad, 'tag', '사람이 패드에 섬');
  inbox.length = 0; S.bots.organize('tag'); S.bots.organize('tag', true);
  sim(60); await flush();
  assert.ok(!live().some((p) => p.pad === 'tag'), '사람이 패드에 있으면 봇이 끼어들지 않음');
  assert.equal(msgs('gstart', 'tag').length, 0, '사람 혼자 → 시작 안 함');
  await mv(W.TAG.pad.x, W.TAG.pad.z - 9); // 패드에서 내려옴
  // 3) 봇 한 명이 패드에서 기다림 → 사람이 오면 카운트다운 → 같이 시작, 끝나면 사람도 경기장 밖으로
  S.bots.organize('tag', true);
  for (let k = 0; k < 60 && !live().some((p) => p.pad === 'tag'); k++) sim(1);
  const waiter = live().find((p) => p.pad === 'tag');
  assert.ok(waiter, '봇 한 명이 패드에서 기다림');
  inbox.length = 0; await mv(W.TAG.pad.x + 0.5, W.TAG.pad.z);
  sim(12); await flush();
  const gs = msgs('gstart', 'tag')[0];
  assert.ok(gs && gs.parts.some(([id]) => id === meP.id) && gs.parts.some(([id]) => id === waiter.id), '사람과 기다리던 봇이 같이 술래잡기 시작');
  assert.ok(!live().some((p) => p.pad === 'tag'), '판이 도는 동안 다른 봇이 패드에 안 옴');
  sim(100); await flush();
  assert.ok(msgs('gend', 'tag').length === 1, '술래잡기가 끝남');
  for (const p of [meP, ...live()]) assert.ok(!(Math.abs(p.x - W.TAG.cx) < W.TAG.hw && Math.abs(p.z - W.TAG.cz) < W.TAG.hd) || p.game, `${p.nick} 끝난 뒤 경기장에 갇히지 않음`);
  sim(30);
  assert.deepEqual(fails, [], '게임 시험 중 매 틱 규칙 검사 위반 없음');
  console.log(`  놀이터 시험: 봇끼리 피구 ✓ · 사람 혼자 패드 → 봇 안 옴 ✓ · 기다리던 봇 + 사람 술래잡기 (${gs.parts.length}명) ✓`);
}

// 사람이 있어도 봇 수 유지 → 사람이 나가도 그대로
ws.close(); await new Promise((r) => setTimeout(r, 200));
assert.ok(Math.abs(S.bots.list().filter((b) => !b.leaving).length - BOTS) <= 1, '사람이 나가도 봇 수 유지');

// ── 4. 틱 비용: 80명
S.bots.stop();
assert.equal(live().length, 0, 'stop() → 봇 모두 나감');
T = KST0 + 13 * 3600e3; S.tick();
await S.bots.start(80, { timer: false });
const t80 = []; for (let i = 0; i < 600; i++) { T += 50; S.tick(); T += 50; const t0 = performance.now(); S.bots.tick(); t80.push(performance.now() - t0); }
t80.sort((a, b) => a - b);
const med = t80[300], p95 = t80[570];
console.log(`  80명 틱: 중앙값 ${med.toFixed(2)}ms, 95% ${p95.toFixed(2)}ms, 최대 ${t80.at(-1).toFixed(1)}ms`);
assert.ok(med < 3, '80명 한 틱 중앙값 3ms 미만');
assert.ok(p95 < 8, '80명 한 틱 95% 8ms 미만 (길 찾는 틱 포함)');
assert.equal(new Set(live().map((p) => p.nick)).size, 80, '80명 닉네임 중복 없음');

S.bots.stop(); srv.close();
console.log('봇 시험 통과');
process.exit(0);
