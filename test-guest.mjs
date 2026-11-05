// 바로 입장(손님) 시험: 랜덤 닉네임 모양·길이, 성별에 맞는 아바타, 이상한 값 정리, 이름 겹침 방지(접속 중·가입된 이름), 다시 연결할 때 같은 이름,
// 그리고 기록이 저장되지 않는 것(저장소에 손님 흔적 없음)까지 서버 통합(포트 3395)으로 확인
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { guestNick, isGuestNick, GUEST_ADJ, GUEST_ANIMAL } from './guest.js';

// ── 1. 이름 만들기
for (let i = 0; i < 2000; i++) { const n = guestNick(Math.random, i % 2 ? 3 : 2); assert.ok(isGuestNick(n) && n.length >= 2 && n.length <= 11, n); }
assert.ok(GUEST_ADJ.every((a) => a.length <= 3) && GUEST_ANIMAL.every((a) => a.length <= 3), '2~10자 안에 들어옴(숫자 2자리 기준)');
assert.ok(Array.from({ length: 2000 }, () => guestNick(Math.random, 2)).every((n) => n.length <= 10));
for (const bad of ['관리자', '졸린고양이', '졸린고양이4', '졸린고양이4242', 'admin42', '', null, 42, '졸린고양이42<b>']) assert.ok(!isGuestNick(bad), `손님 모양이 아님: ${bad}`);
assert.ok(new Set(Array.from({ length: 200 }, () => guestNick())).size > 50, '충분히 다양함');
console.log(`ok 손님 이름: 형용사 ${GUEST_ADJ.length} × 동물 ${GUEST_ANIMAL.length} × 숫자, 2~10자, 엉뚱한 모양은 거절`);

// ── 1b. 성별에 맞는 머리·옷 (남자: 짧은 머리·단정 컷, 원피스·곰돌이 띠 없음 / 여자: 긴 머리류, 셔츠·넥타이 없음)
import { randomAvatar } from './public/world.js';
for (let i = 0; i < 3000; i++) {
  const m = randomAvatar('m'), f = randomAvatar('f');
  assert.ok(m.g === 'm' && m.hs <= 1 && m.os !== 2 && m.ac !== 5, 'male ' + JSON.stringify(m));
  assert.ok(f.g === 'f' && f.hs >= 2 && f.os !== 3, 'female ' + JSON.stringify(f));
}
console.log('ok 손님 아바타: 남자는 짧은 머리·원피스 없음, 여자는 긴 머리류·셔츠넥타이 없음');

// ── 2. 서버 통합
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-guest-'));
process.env.DATA_DIR = dir;
const { WebSocket } = await import('ws');
const { listen, players } = await import('./server.js');
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 5000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
const PORT = 3395, srv = await listen(PORT);
const api = async (name, body) => (await fetch(`http://localhost:${PORT}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
async function guest(gs) {
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', guest: gs }));
  const first = await until(() => inbox.find((m) => m.t === 'welcome' || m.t === 'auth' || m.t === 'full'));
  const c = { ws, inbox, first };
  if (first.t === 'welcome') { c.id = first.id; c.me = first.players.find((p) => p.id === first.id); c.send = (o) => ws.send(JSON.stringify(o)); }
  return c;
}
const keysOnDisk = () => { const f = path.join(dir, 'store.json'); return fs.existsSync(f) ? Object.keys(JSON.parse(fs.readFileSync(f, 'utf8'))) : []; };

const a = await guest({ g: 'f' }), b = await guest({ g: 'm' });
assert.equal(a.first.t, 'welcome'); assert.equal(b.first.t, 'welcome');
assert.ok(isGuestNick(a.me.name) && isGuestNick(b.me.name) && a.me.name !== b.me.name, `손님 이름: ${a.me.name} / ${b.me.name}`);
assert.equal(a.me.a.g, 'f'); assert.equal(b.me.a.g, 'm'); // 성별에 맞는 아바타 (클라이언트가 안 보내도 서버가 뽑음)
assert.equal(a.first.chips, 1000);
assert.equal(players.get(a.id).uid, null, '손님은 uid 없음 → 저장 안 됨');

// 클라이언트가 뽑아 보낸 아바타는 정리해서 씀, 이상한 값은 기본값으로
const c = await guest({ g: 'm', a: { g: 'f', hs: 999, oc: -5, evil: '<script>' } });
assert.equal(c.me.a.g, 'f'); assert.ok(c.me.a.hs >= 0 && c.me.a.hs < 50 && c.me.a.oc >= 0 && !('evil' in c.me.a), '아바타 값 정리');
// 엉뚱한 이름 요청은 무시하고 랜덤
const d = await guest({ g: 'm', nick: '관리자' }); assert.ok(isGuestNick(d.me.name), '아무 이름이나 못 씀');
// 다시 연결: 끊고 같은 이름 요청하면 그대로 (남이 안 쓰는 동안)
const keep = a.me.name; a.ws.close(); await until(() => ![...players.values()].some((p) => p.nick === keep));
const a2 = await guest({ g: 'f', a: a.me.a, nick: keep }); assert.equal(a2.me.name, keep, '다시 연결할 때 같은 이름'); assert.deepEqual(a2.me.a, a.me.a);
// 접속 중인 이름은 못 가져감
const dup = await guest({ g: 'f', nick: keep }); assert.notEqual(dup.me.name, keep, '접속 중인 이름은 겹치지 않음');
// 가입된 사람의 이름도 못 가져감 (가입자가 손님 모양 이름을 쓴 경우)
const taken = '포근한판다77'; const s = await api('signup', { id: 'guestchk1', nick: taken, pw: 'secret1' }); assert.ok(s.ok, '가입 이름 준비: ' + JSON.stringify(s));
const e = await guest({ g: 'm', nick: taken }); assert.notEqual(e.me.name, taken, '가입된 이름은 겹치지 않음');

// 기록 저장 안 됨: 칩·낚시·기도·이동 후 끊어도 저장소에 손님 흔적이 없음 (가입 계정 외 키 없음)
a2.send({ t: 'm', x: 1, z: 8, ry: 0, w: 1, y: 0 }); await wait(300);
for (const x of [a2, b, c, d, dup, e]) x.ws.close();
await wait(900);
const keys = keysOnDisk();
assert.ok(keys.every((k) => /^(user:guestchk1|nick:포근한판다77|sess:)/.test(k)), '저장소에 손님 기록 없음: ' + keys.join(','));
srv.close();
console.log('ok 서버(3395): 랜덤 이름·성별별 아바타·값 정리·이름 겹침 방지·다시 연결 유지·저장소에 손님 흔적 없음');
console.log('바로 입장(손님) 시험 통과 ✓');
process.exit(0);
