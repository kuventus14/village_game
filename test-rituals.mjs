// 성당·사찰·교회 활동 시험: 가짜 시계로 규칙(자리·거리·건물·앉기·쿨다운·초당 제한·공유 촛불/연등·범종·찬양·공동 의식 시간표·기록),
// 서버 통합(방송·움직이면 취소·의자 행동·고해 글이 서버로 안 감·기록 저장과 재접속·진행 중 의식 알림)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SPOTS, SEATS, CANDLE_SLOTS, LIGHT_MS, RITUAL_MS, BUILDINGS, freeCushions, ON_CUSHION, inside, resolve } from './public/world.js';
import { createRituals, ritualsAt, BELL_CD } from './rituals.js';

const S = (kind, i = 0) => SPOTS.filter((s) => s.kind === kind)[i];
const pewSeat = (sp) => SEATS.find((s) => s.kind === 'pew' && Math.hypot(s.x - sp.x, s.z - sp.z) < 0.1);
const KST18 = Date.UTC(2026, 10, 3, 9, 0, 0); // 2026-11-03 18:00 KST

// ── 공동 의식 시간표 (KST 05:00·18:00 정각부터 10분)
assert.deepEqual(ritualsAt(KST18 - 1000).map((r) => r.place), [], '17:59:59 엔 없음');
assert.deepEqual(ritualsAt(KST18).map((r) => r.place).sort(), ['cathedral', 'temple'], '18:00 사찰 예불 + 성당 미사');
assert.deepEqual(ritualsAt(KST18 + RITUAL_MS - 1).length, 2, '10분 동안');
assert.deepEqual(ritualsAt(KST18 + RITUAL_MS).length, 0, '10분 뒤 끝');
assert.deepEqual(ritualsAt(KST18 - 13 * 3600e3).map((r) => r.place).sort(), ['church', 'temple'], '05:00 사찰 예불 + 교회 새벽 예배');
assert.equal(ritualsAt(KST18 - 12 * 3600e3).length, 0, '06:00 엔 없음');

// ── 사찰 '절하기' 자동 걸음: 가장 가까운 빈 방석 고르기 (화면 public/rituals.js 가 씀)
{
  const all = SPOTS.filter((s) => s.kind === 'cushion'), T = BUILDINGS.temple;
  assert.equal(all.length, 100, '방석 100개');
  for (const c of all) { assert.ok(inside(T, c.x, c.z), '방석은 법당 안'); const [x, z] = resolve(c.x, c.z, 0.4, 0); assert.ok(Math.hypot(x - c.x, z - c.z) < 0.05, `방석 ${c.id} 위에 설 수 있음 (자동 걸음이 닿음)`); }
  const bud = SPOTS.find((s) => s.kind === 'buddha');
  const L = freeCushions(bud.x, bud.z);
  assert.equal(L.length, 100, '아무도 없으면 전부 빈 방석');
  for (let i = 1; i < L.length; i++) assert.ok(Math.hypot(L[i].x - bud.x, L[i].z - bud.z) >= Math.hypot(L[i - 1].x - bud.x, L[i - 1].z - bud.z), '가까운 순서');
  assert.ok(L.every((s) => s.kind === 'cushion'), '염주 자리·불상 앞은 방석으로 치지 않음');
  const [c0, c1, c2] = L;
  assert.deepEqual(freeCushions(bud.x, bud.z, [[c0.x + 0.1, c0.z]])[0], c1, '누가 서 있는 방석은 건너뜀');
  assert.equal(freeCushions(bud.x, bud.z, [[c0.x + ON_CUSHION + 0.05, c0.z]])[0], c0, '옆 통로에 선 사람은 방석을 쓰는 게 아님');
  assert.deepEqual(freeCushions(bud.x, bud.z, [], new Set([c0.id, c1.id]))[0], c2, '절·염주 중인 방석도 건너뜀');
  const far = all.reduce((a, b) => (b.z > a.z ? b : a)); // 문 쪽 끝 줄
  assert.equal(freeCushions(far.x, far.z)[0], far, '내 발밑 방석이 가장 가까움');
  assert.equal(freeCushions(0, 0, all.map((s) => [s.x, s.z])).length, 0, '다 차면 빈 방석 없음');
}

// ── 가짜 시계로 규칙만
{
  let t = KST18 - 60e3;
  const out = [], saved = [];
  const R = createRituals({ now: () => t, send: (p, o) => out.push({ to: p.id, ...o }), bcast: (o) => out.push(o), info: () => {}, save: (p) => saved.push({ ...p.rec }) });
  const P = (sp, o = {}) => ({ id: Math.random(), nick: 'n' + Math.random(), s: 'free', auto: false, seat: -1, fl: 0, game: null, transit: null, fish: null, x: sp.x, z: sp.z, rec: {}, act: null, ...o });
  const last = (tt, f = () => true) => out.filter((m) => m.t === tt && f(m)).at(-1);
  const go = (p, k, spot, extra) => { t += 400; R.act(p, { k, spot, ...extra }); };
  const cu = S('cushion'), a = P(cu);
  // 절하기: 방송 → 상태 🙇 → 2.6초 뒤 끝나면 기록 +1, 이전 상태로
  go(a, 'bow', cu.id);
  assert.equal(last('act').k, 'bow'); assert.equal(last('act').ms, 2600); assert.equal(a.s, 'bow');
  t += 2599; R.tick(); assert.ok(a.act, '아직 절하는 중');
  t += 1; R.tick(); assert.equal(last('actend').r, 'done'); assert.equal(a.s, 'free'); assert.equal(a.rec.bows, 1); assert.equal(a.rec.today, 1);
  assert.equal(saved.at(-1).bows, 1, '기록 저장');
  // 취소된 절은 세지 않음
  go(a, 'bow', cu.id); R.stop(a); assert.equal(last('actend').r, 'cancel'); assert.equal(a.rec.bows, 1);
  // 108배 축하
  a.rec.bows = 107; go(a, 'bow', cu.id); t += 2600; R.tick(); assert.equal(last('rec', (m) => m.to === a.id).ev, '108');
  // 초당 제한(0.35초)
  t += 400; R.act(a, { k: 'palms', spot: cu.id }); R.act(a, { k: 'stop' }); t += 100; R.act(a, { k: 'palms', spot: cu.id }); assert.equal(a.act, null, '0.35초 안에 다시 누르면 무시');
  // 거리·종류·건물·앉기 검사
  const far = P(cu, { x: cu.x + 2.5 }); go(far, 'bow', cu.id); assert.match(last('actno').error, /가까이/); assert.equal(far.act, null);
  go(a, 'candle', cu.id); assert.equal(a.act, null, '방석에서 촛불 켜기는 안 됨');
  const town = P({ x: 0, z: 0 }); go(town, 'cross', -1); assert.equal(town.act, null, '건물 밖에선 성호(어디서나)도 안 됨');
  const fo = S('font'), inC = P(fo, { x: fo.x - 6 }); go(inC, 'cross', -1); assert.equal(inC.act?.k, 'cross', '성당 안 어디서나 성호');
  go(P(fo, { x: fo.x - 6 }), 'palms', -1); assert.equal(last('actno').k, 'palms', '사찰 합장은 성당에선 안 됨');
  const ro = S('rosary'), stand = P(ro); go(stand, 'rosary', ro.id); assert.match(last('actno').error, /앉아서/);
  const sat = P(ro, { seat: pewSeat(ro).id, s: 'pray' }); go(sat, 'rosary', ro.id); assert.equal(sat.act?.k, 'rosary'); assert.equal(sat.s, 'rosary');
  const sat2 = P(cu, { seat: 3 }); go(sat2, 'bow', cu.id); assert.equal(sat2.act, null, '다른 의자에 앉아 있으면 못 함');
  for (const o of [{ fish: { st: 'wait' } }, { game: 'tag' }, { transit: {} }, { fl: 1 }]) { const q = P(cu, o); go(q, 'bow', cu.id); assert.equal(q.act, null, JSON.stringify(o)); }
  // 묵주: 59알이면 한 바퀴, 초당 8알 제한
  for (let i = 0; i < 59; i++) { t += 130; R.bead(sat); }
  assert.equal(sat.rec.rosaries, 1); assert.equal(last('rec', (m) => m.to === sat.id).ev, 'rosaries');
  R.act(sat, { k: 'stop' }); assert.equal(sat.s, 'pray', '묵주 끝나면 앉은 상태(기도 중)로');
  const bd = P(S('beads')); go(bd, 'beads', S('beads').id); t += 1000; for (let i = 0; i < 12; i++) R.bead(bd); assert.equal(bd.rec.beads, 8, '초당 8알까지만');
  R.bead(a); assert.equal(a.rec.beads, undefined, '염주를 안 들었으면 안 셈');
  // 범종: 모두에게 방송, 6초 쿨다운
  const bl = S('bell'), b1 = P(bl), b2 = P(bl);
  go(b1, 'bell', bl.id); assert.equal(last('act').k, 'bell');
  go(b2, 'bell', bl.id); assert.match(last('actno').error, /범종/);
  t += BELL_CD; go(b2, 'bell', bl.id); assert.equal(last('act').id, b2.id);
  // 촛불: 빈 자리에 켜짐 → 가득 차면 가장 오래된 것 교체 → 30분 뒤 꺼짐
  const ca = S('candle'), c1 = P(ca);
  const lit = () => R.snapshot().shrine.candles.filter((c) => c[0] === 0);
  for (let i = 0; i < CANDLE_SLOTS; i++) { go(c1, 'candle', ca.id); t += 3200; R.tick(); }
  assert.equal(lit().length, CANDLE_SLOTS); assert.equal(c1.rec.candles, CANDLE_SLOTS);
  const oldest = Math.min(...lit().map((c) => LIGHT_MS - c[2]));
  go(c1, 'candle', ca.id); assert.equal(lit().length, CANDLE_SLOTS, '가득 차면 개수 그대로');
  assert.ok(Math.min(...lit().map((c) => LIGHT_MS - c[2])) < oldest, '가장 오래된 것이 새것으로');
  assert.ok(last('shrine').candles.length >= CANDLE_SLOTS, '켜면 모두에게 공유 상태 방송');
  t += LIGHT_MS; R.tick(); assert.equal(R.snapshot().shrine.candles.length, 0, '30분 뒤 모두 꺼짐');
  // 연등: 공유·만료
  const la = S('lantern', 2), l1 = P(la); go(l1, 'lantern', la.id);
  assert.deepEqual(R.snapshot().shrine.lanterns.map((c) => c[0]), [2]);
  t += LIGHT_MS - 1; R.tick(); assert.equal(R.snapshot().shrine.lanterns.length, 1); t += 1; R.tick(); assert.equal(R.snapshot().shrine.lanterns.length, 0);
  // 찬양: 첫 사람이 곡을 정하고, 다음 사람은 같은 곡에 합류, 모두 그만두면 반주도 멈춤
  const st1 = S('stage', 0), st2 = S('stage', 1), s1 = P(st1), s2 = P(st2);
  go(s1, 'sing', st1.id, { song: 2 }); go(s2, 'sing', st2.id, { song: 3 });
  assert.equal(R.snapshot().shrine.praise.song, 2); assert.equal(last('act').song, 2);
  R.act(s1, { k: 'stop' }); assert.ok(R.snapshot().shrine.praise, '한 명 남으면 계속');
  t += 400; R.act(s2, { k: 'sing', spot: st2.id }); assert.equal(R.snapshot().shrine.praise, null, '다시 누르면 그만 → 반주 멈춤');
  // 피아노: 연주 중일 때만, 초당 8음, 범위 밖 음 무시
  const pi = S('piano'), pp = P(pi), nb = () => out.filter((m) => m.t === 'note' && m.id === pp.id).length;
  R.note(pp, { n: 3 }); assert.equal(nb(), 0, '피아노 앞에서 시작해야');
  go(pp, 'piano', pi.id); t += 1000; for (let i = 0; i < 12; i++) R.note(pp, { n: i }); assert.equal(nb(), 8); R.note(pp, { n: 99 }); R.note(pp, { n: 1.5 }); assert.equal(nb(), 8);
  assert.equal(pp.rec.played, 1);
  // 미사포·성가 토글
  const fp = P(fo); go(fp, 'veil', fo.id); assert.equal(fp.vl, true); assert.equal(last('veil').on, 1); assert.equal(fp.act, null, '미사포는 동작 없이 바로');
  const ch = S('choir'); go(P(ch), 'hymn', ch.id); assert.ok(R.snapshot().shrine.hymn); go(P(ch), 'hymn', ch.id); assert.equal(R.snapshot().shrine.hymn, null);
  // 공동 의식: 정각에 시작 방송 → 의식 중 활동은 건물당 한 번만 참여 기록 → 10분 뒤 끝 방송
  t = KST18 + 864e5 - 1000; R.tick(); assert.equal(R.snapshot().rituals.length, 0); // 다음 날 17:59:59 (앞 시험들이 시계를 많이 돌렸음)
  const mark = out.length, KST18b = KST18 + 864e5;
  t = KST18b; R.tick();
  assert.deepEqual(out.slice(mark).filter((m) => m.t === 'ritual' && m.left > 0).map((m) => m.place).sort(), ['cathedral', 'temple']);
  const w = P(cu); go(w, 'palms', cu.id); go(w, 'bow', cu.id); t += 2600; R.tick();
  assert.equal(w.rec.ritual, 1, '같은 의식은 한 번만');
  const wc = P(fo); go(wc, 'cross', fo.id); assert.equal(wc.rec.ritual, 1, '성당 미사 참여');
  t = KST18b + RITUAL_MS; R.tick();
  assert.deepEqual(out.slice(mark).filter((m) => m.t === 'ritual' && m.left === 0).map((m) => m.place).sort(), ['cathedral', 'temple']); assert.equal(R.snapshot().rituals.length, 0);
}

// ── 서버 통합 (진행 중인 의식이 있도록 의식 시계를 18:00 에 맞춤)
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-rit-'));
process.env.RITUAL_AT = '18:00';
const { WebSocket } = await import('ws');
const { listen, players, store } = await import('./server.js');
const PORT = 3395, BASE = `http://localhost:${PORT}`;
const srv = await listen(PORT);
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
const api = async (name, body) => (await fetch(`${BASE}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const sentToServer = []; // 화면 → 서버로 나간 모든 메시지
async function connect(token) {
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [], raw = [];
  ws.on('message', (d) => { raw.push(String(d)); inbox.push(JSON.parse(d)); });
  await new Promise((r) => ws.on('open', r));
  const c = { ws, inbox, raw, token, send: (o) => { const s = JSON.stringify(o); sentToServer.push(s); ws.send(s); }, got: (t, f = () => true) => inbox.filter((m) => m.t === t && f(m)) };
  c.send({ t: 'join', token });
  c.welcome = await until(() => inbox.find((m) => m.t === 'welcome')); c.id = c.welcome.id; c.p = () => players.get(c.id);
  return c;
}
async function open(nick) {
  const s = await api('signup', { nick, pw: 'secret1' });
  await api('avatar', { token: s.token, avatar: { g: 'f' } });
  return Object.assign(await connect(s.token), { nick });
}
const moveTo = async (c, x, z) => { c.send({ t: 'm', x, z, ry: 0, w: 0, y: 0 }); await wait(80); };
await wait(120); // 서버 틱이 의식을 시작하도록
const a = await open('절하는이'), b = await open('지켜봄');
assert.deepEqual(a.welcome.sacred, {}, '처음엔 기록이 비어 있음');
assert.deepEqual(a.welcome.rit.rituals.map((r) => r.place).sort(), ['cathedral', 'temple'], '접속하면 진행 중인 의식을 알려 줌');
assert.ok(a.welcome.rit.rituals.every((r) => r.left > 0 && r.left <= RITUAL_MS));
// 방석 앞에서 절 → 다른 사람도 동작을 받음 → 끝나면 기록
const cu = S('cushion', 5);
await moveTo(a, cu.x, cu.z);
assert.equal(a.p().pl, 'temple');
a.send({ t: 'act', k: 'bow', spot: cu.id });
const seen = await until(() => b.got('act', (m) => m.id === a.id)[0]);
assert.equal(seen.k, 'bow'); assert.equal(seen.s, 'bow');
await until(() => b.got('info', (m) => m.id === a.id && m.s === 'bow')[0]);
const done = await until(() => b.got('actend', (m) => m.id === a.id)[0], 4000);
assert.equal(done.r, 'done'); assert.equal(done.s, 'free');
const r1 = await until(() => a.got('rec', (m) => m.rec.bows === 1)[0]);
assert.equal(r1.rec.ritual, 1, '예불 중 절 → 의식 참여 +1');
// 움직이면 취소
await wait(400); a.send({ t: 'act', k: 'bow', spot: cu.id }); await until(() => a.got('act').length === 2);
await moveTo(a, cu.x + 0.5, cu.z);
assert.equal((await until(() => a.got('actend', (m) => m.r === 'cancel')[0])).k, 'bow');
// 점프해도 취소
await moveTo(a, cu.x, cu.z); await wait(400);
a.send({ t: 'act', k: 'palms', spot: cu.id }); await until(() => a.got('act').length === 3);
a.send({ t: 'm', x: cu.x, z: cu.z, ry: 0, w: 0, y: 0.6 }); await until(() => a.got('actend', (m) => m.r === 'cancel').length === 2);
// 먼 곳·엉뚱한 자리는 거부
await moveTo(a, cu.x, cu.z + 4); await wait(400);
a.send({ t: 'act', k: 'bow', spot: cu.id }); assert.match((await until(() => a.got('actno')[0])).error, /가까이/);
// 의자 행동: 성당 긴 의자에 앉아 묵주기도 → 일어나면 끝
const ro = S('rosary', 10), seat = pewSeat(ro);
await moveTo(b, ro.x + 0.9, ro.z); b.send({ t: 'sit', seat: seat.id }); await until(() => b.p().seat === seat.id);
await wait(400); b.send({ t: 'act', k: 'rosary', spot: ro.id });
await until(() => b.got('act', (m) => m.k === 'rosary')[0]); assert.equal(b.p().s, 'rosary');
b.send({ t: 'stand' }); await until(() => b.got('actend', (m) => m.k === 'rosary')[0]); assert.equal(b.p().s, 'free'); assert.equal(b.p().seat, -1);
// 고해 체험: 화면이 글을 보내지 않음 + 혹시 섞여 와도 서버가 어디에도 싣지 않음
const co = S('confess'); await moveTo(b, co.x, co.z); await wait(400);
b.send({ t: 'act', k: 'confess', spot: co.id, text: '비밀이야기XYZ' }); // 일부러 넣어 봄 (진짜 화면은 안 넣음)
await until(() => a.got('act', (m) => m.k === 'confess')[0]);
await wait(200);
assert.ok(![...a.raw, ...b.raw].some((s) => s.includes('비밀이야기XYZ')), '고해 글이 다른 사람·본인에게 되돌아가지 않음');
assert.ok(!a.got('act', (m) => m.k === 'confess')[0].text, '방송에 글 필드 없음');
const src = fs.readFileSync('./public/rituals.js', 'utf8');
assert.ok(!/send\([^)]*(textarea|rtConfText|\.value)/.test(src) && !/localStorage[^;]*(textarea|rtConfText|ta\.value)/.test(src), '화면 코드가 고해 글을 보내거나 저장하지 않음');
assert.ok(!sentToServer.filter((s) => !s.includes('비밀이야기XYZ')).some((s) => s.includes('text') && s.includes('"act"')), '행동 메시지엔 글이 없음');
// 낚시 중엔 행동 거부 (낚시와 충돌 없음)
await moveTo(b, cu.x, cu.z); await wait(400);
b.p().fish = { st: 'wait', prev: { s: 'free', auto: false } };
b.send({ t: 'act', k: 'bow', spot: cu.id }); assert.match((await until(() => b.got('actno')[0])).error, /지금은/);
b.p().fish = null;
// 범종 → 모두에게 방송, 피아노 음 → 건물 안 모두에게
const bl = S('bell'); await moveTo(b, bl.x, bl.z); await wait(400);
b.send({ t: 'act', k: 'bell', spot: bl.id }); assert.ok(await until(() => a.got('act', (m) => m.k === 'bell' && m.id === b.id)[0]));
const pi = S('piano'); await moveTo(a, pi.x, pi.z); await wait(400);
a.send({ t: 'act', k: 'piano', spot: pi.id }); await until(() => a.got('act', (m) => m.k === 'piano')[0]);
for (let i = 0; i < 12; i++) a.send({ t: 'note', n: i });
await wait(300); assert.equal(b.got('note', (m) => m.id === a.id).length, 8, '초당 8음까지');
// 미사포는 새로 들어온 사람에게도 보임
const fo = S('font'); await moveTo(b, fo.x, fo.z); await wait(400);
b.send({ t: 'act', k: 'veil', spot: fo.id }); await until(() => a.got('veil', (m) => m.id === b.id && m.on)[0]);
const c = await open('늦게옴');
assert.equal(c.welcome.players.find((p) => p.id === b.id).vl, 1);
assert.ok(c.welcome.rit.acts.some((x) => x.id === a.id && x.k === 'piano'), 'welcome 에 진행 중인 행동');
// 기록 저장 → 재접속하면 welcome 으로 옴
await wait(1700);
const saved = (await store.get('user:절하는이')).sacred;
assert.equal(saved.bows, 1); assert.equal(saved.played, 1); assert.equal(saved.ritual, 1);
a.ws.close(); await until(() => !players.has(a.id));
assert.ok(c.got('leave', (m) => m.id === a.id)[0]);
const a2 = await connect(a.token);
assert.equal(a2.welcome.sacred.bows, 1, '재접속하면 기록이 옴');
assert.ok(!a2.welcome.rit.acts.some((x) => x.id === a.id), '끊긴 사람의 행동은 정리됨');

console.log('성당·사찰·교회 활동 시험 통과');
for (const x of [a2, b, c]) x.ws.close();
srv.close(); store.flush(); process.exit(0);
