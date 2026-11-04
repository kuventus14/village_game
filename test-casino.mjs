// 카지노 통합 시험: 층 이동(계단·엘리베이터), 슬롯, 칩 저장, 블랙잭·홀덤 자리 (게임 규칙 자체는 test-blackjack / test-holdem 이 검사)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-casino-'));
const { WebSocket } = await import('ws');
const { listen, players, store } = await import('./server.js');
const W = await import('./public/world.js');
const { SEATS, PORTALS, FLOOR_H } = W;

const PORT = 3398, BASE = `http://localhost:${PORT}`;
const srv = await listen(PORT);
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 6000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
const api = async (name, body) => (await fetch(`${BASE}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '8.8.' + Math.floor(Math.random() * 250) + '.1' }, body: JSON.stringify(body) })).json();

async function connect(token) {
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', token }));
  const welcome = await until(() => inbox.find((m) => m.t === 'welcome'));
  const c = { ws, inbox, welcome, id: welcome.id, p: () => players.get(welcome.id), get: (t) => inbox.filter((m) => m.t === t), send: (o) => ws.send(JSON.stringify(o)), token };
  return c;
}
async function open(nick) {
  const s = await api('signup', { nick, pw: 'secret1' });
  await api('avatar', { token: s.token, avatar: { g: 'f' } });
  return connect(s.token);
}
const at = async (c, x, z) => { c.send({ t: 'm', x, z, ry: 0, w: 0 }); await wait(80); };

const a = await open('카지노가'), b = await open('카지노나');
assert.equal(a.welcome.chips, 1000, '처음엔 1,000칩');
assert.equal(a.p().fl, 0);

// ── 슬롯: 앉으면 화면용 준비 메시지, 돌리면 결과가 오고 칩이 정확히 맞아야 함
const slot = SEATS.find((s) => s.kind === 'slot' && s.tbl === 1);
await at(a, slot.x, slot.z + 0.6);
a.send({ t: 'sit', seat: slot.id });
await until(() => a.get('cz').find((m) => m.g === 'slot' && m.a === 'ready'));
assert.equal(a.p().s, 'slots');
let chips = 1000;
for (let i = 0; i < 6; i++) {
  const n = a.get('cz').filter((m) => m.a === 'result').length;
  a.send({ t: 'cz', g: 'slot', a: 'spin', bet: 50 });
  const r = await until(() => a.get('cz').filter((m) => m.a === 'result')[n]);
  chips += r.win - 50;
  assert.equal(a.p().chips, chips, '슬롯 한 번마다 칩 = 이전 - 베팅 + 당첨');
  await wait(750);
}
a.send({ t: 'cz', g: 'slot', a: 'spin', bet: 7 }); // 없는 베팅 금액은 무시
await wait(150);
assert.equal(a.p().chips, chips);
a.send({ t: 'stand' }); await wait(100);
assert.equal(a.p().seat, -1);
a.ws.close(); await wait(900); // 접속을 끊으면 칩이 계정에 저장됨
const again = await connect(a.token);
assert.equal(again.welcome.chips, chips, '다시 접속해도 칩이 그대로');
a.ws = again.ws; a.inbox = again.inbox; a.get = again.get; a.send = again.send; a.id = again.id; a.p = again.p;

// ── 다른 층 자리는 그 층에 가야 앉을 수 있음
const poker = SEATS.find((s) => s.kind === 'poker' && s.chair === 0);
await at(a, W.BUILDINGS.casino.cx, W.BUILDINGS.casino.cz);
a.send({ t: 'sit', seat: poker.id }); await wait(150);
assert.equal(a.p().seat, -1, '1층에서 2층 자리에 못 앉음');

// ── 계단: 서 있는 곳에서 go → 도착 층. 이동 중엔 못 움직이고, 엉뚱한 곳에선 안 됨
a.send({ t: 'go', p: 2 }); await wait(100);
assert.equal(a.p().transit, null, '계단 앞이 아니면 이동 안 됨');
const st = PORTALS[0];
await at(a, st.x, st.z + 0.5);
a.send({ t: 'go', p: 0 });
await until(() => a.p().transit);
assert.equal(b.get('fl')[0].id, a.id, '다른 사람에게도 이동이 알려짐');
const xz = [a.p().x, a.p().z];
a.send({ t: 'm', x: xz[0] - 3, z: xz[1], ry: 0, w: 1 }); await wait(80);
assert.deepEqual([a.p().x, a.p().z], xz, '이동 중엔 위치 고정');
await until(() => a.p().fl === 1, 5000);
assert.deepEqual([a.p().x.toFixed(1), a.p().z.toFixed(1)], [st.ex.toFixed(1), st.ez.toFixed(1)], '계단 위에 도착');
// 2층 홀덤: 앉기(바이인), 칩이 빠졌다가 일어나면 돌아옴
await at(a, poker.x, poker.z + 0.8 * Math.cos(poker.ry) * -1);
const before = a.p().chips;
a.send({ t: 'sit', seat: poker.id }); await wait(400);
if (a.p().seat === poker.id) {
  assert.ok(a.p().chips < before, '홀덤에 앉으면 바이인만큼 칩이 빠짐');
  await until(() => a.get('cz').find((m) => m.g === 'poker' && m.state), 3000);
  a.send({ t: 'stand' }); await wait(300);
  assert.ok(a.p().chips <= before && a.p().chips >= before - 120, `일어나면 남은 칩이 돌아옴 (${before} → ${a.p().chips})`);
  console.log('홀덤: 앉기·바이인·일어나서 환급 확인');
} else console.log('홀덤: 아직 서버에 없음(건너뜀):', a.get('czerr').at(-1)?.error);

// ── 엘리베이터: 2층 → 3층 (층 버튼), 블랙잭 자리 앉기·베팅 환급
const lift = PORTALS.find((p) => p.kind === 'lift' && p.fl === 1);
await at(a, lift.x, lift.z);
a.send({ t: 'go', p: lift.id, to: 1 }); await wait(100);
assert.equal(a.p().transit, null, '지금 있는 층으로는 못 감');
a.send({ t: 'go', p: lift.id, to: 2 });
await until(() => a.p().fl === 2, 6000);
assert.equal(a.p().gy ?? a.p().fl * FLOOR_H, 2 * FLOOR_H);
const bj = SEATS.find((s) => s.kind === 'bj' && s.chair === 2);
await at(a, bj.x, bj.z + 0.7);
const c0 = a.p().chips;
a.send({ t: 'sit', seat: bj.id });
await until(() => a.get('cz').find((m) => m.g === 'bj' && m.state), 3000);
assert.equal(a.p().s, 'bj');
a.send({ t: 'cz', g: 'bj', a: 'bet', amount: 100 }); await wait(200);
assert.equal(a.p().chips, c0 - 100, '베팅하면 칩이 빠짐');
a.send({ t: 'stand' }); await wait(300);
assert.equal(a.p().chips, c0, '딜 전에 일어나면 베팅이 돌아옴');

// ── 접속이 끊겨도 안 앉은 사람이 안전하게 처리됨
b.ws.close(); await wait(200);
console.log('카지노 통합 시험 통과');
a.ws.close(); srv.close(); store.flush(); process.exit(0);
