// 바닥 자세(앉기·눕기·만세·손 흔들기·박수·인사) 서버 규칙 시험 (포트 3388): 다른 사람에게 전달·새로 온 사람도 봄·이상한 값 무시·0.25초 상한,
// 움직이거나 점프·앉기·다른 행동을 하면 풀림, 의자·놀이터 패드·게임·층 이동·낚시·행동·불꽃·기구 중엔 거절
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-pose-'));
const { WebSocket } = await import('ws');
const { listen, players, store } = await import('./server.js');
const { SEATS, TAG, POSES, standPos } = await import('./public/world.js');

const PORT = 3388, srv = await listen(PORT);
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
async function open(g = 'f') { // 바로 입장(손님)
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', guest: { g } }));
  const c = { ws, inbox, get: (t) => inbox.filter((m) => m.t === t), send: (o) => ws.send(JSON.stringify(o)) };
  c.id = (await until(() => c.get('welcome')[0])).id; c.p = () => players.get(c.id);
  return c;
}
const moveTo = async (c, x, z, y = 0) => { c.send({ t: 'm', x, z, ry: 0, w: 0, y }); await wait(60); };
const poseOf = (c, id) => c.get('pose').filter((m) => m.id === id).at(-1)?.p;

assert.deepEqual(Object.keys(POSES), ['sit', 'lie', 'cheer', 'wave', 'clap', 'greet'], '자세 목록');
const a = await open('f'), b = await open('m');
await moveTo(a, 0, 6); await moveTo(b, 2, 6);

// 자세 → 다른 사람에게 전달, 새로 온 사람도 welcome 에서 봄
a.send({ t: 'pose', p: 'sit' });
await until(() => poseOf(b, a.id) === 'sit');
assert.equal(a.p().pose, 'sit'); assert.equal(poseOf(a, a.id), 'sit', '나에게도 옴');
const c = await open();
assert.equal(c.get('welcome')[0].players.find((p) => p.id === a.id).pose, 'sit', '새로 온 사람도 앉은 모습');
assert.equal(c.get('welcome')[0].players.find((p) => p.id === b.id).pose, '', '안 한 사람은 빈 값');

// 이상한 값·같은 자세는 무시, 0.25초 안에 또 바꾸면 무시
const n0 = b.get('pose').length;
for (const p of ['fly', 1, null, '__proto__', 'toString']) a.send({ t: 'pose', p });
a.send({ t: 'pose', p: 'sit' }); a.send({ t: 'pose', p: 'lie' });
await wait(150);
assert.equal(b.get('pose').length, n0, '이상한 값·같은 자세·너무 빠른 변경은 방송 안 함');
assert.equal(a.p().pose, 'sit');
await wait(150); a.send({ t: 'pose', p: 'lie' });
await until(() => poseOf(b, a.id) === 'lie');
// 상한: 1초 동안 마구 눌러도 4번까지만 바뀜
const n1 = b.get('pose').length, list = ['cheer', 'wave', 'clap', 'greet'];
for (let i = 0; i < 20; i++) { a.send({ t: 'pose', p: list[i % 4] }); await wait(50); }
await wait(100);
assert.ok(b.get('pose').length - n1 <= 5, `1초에 4~5번까지만 (${b.get('pose').length - n1})`);

// 풀기: 빈 값 / 아주 조금 흔들리면 그대로 / 걸으면 / 점프하면
await wait(300); a.send({ t: 'pose', p: '' }); await until(() => poseOf(b, a.id) === '');
assert.equal(a.p().pose, '');
await wait(300); a.send({ t: 'pose', p: 'wave' }); await until(() => poseOf(b, a.id) === 'wave');
const { x, z } = a.p(); a.send({ t: 'm', x: x + 0.02, z, ry: 1, w: 0, y: 0 }); await wait();
assert.equal(a.p().pose, 'wave', '제자리에서 도는 것·아주 작은 흔들림은 그대로');
await moveTo(a, x + 1, z); await until(() => poseOf(b, a.id) === '');
assert.equal(a.p().pose, '', '걸으면 풀림');
await wait(300); a.send({ t: 'pose', p: 'cheer' }); await until(() => poseOf(b, a.id) === 'cheer');
a.send({ t: 'm', x: a.p().x, z: a.p().z, ry: 0, w: 0, y: 0.6 }); await until(() => poseOf(b, a.id) === '');
a.send({ t: 'm', x: a.p().x, z: a.p().z, ry: 0, w: 0, y: 0 }); await wait();

// 의자에 앉으면 풀리고, 앉아 있는 동안엔 거절
const st = SEATS.find((s) => s.kind === 'park' && s.fl === 0);
const [sx, sz] = standPos(st); await moveTo(a, sx, sz);
await wait(300); a.send({ t: 'pose', p: 'sit' }); await until(() => poseOf(b, a.id) === 'sit');
a.send({ t: 'sit', seat: st.id }); await until(() => poseOf(b, a.id) === '');
assert.equal(a.p().seat, st.id, '의자에 앉음');
await wait(300); a.send({ t: 'pose', p: 'lie' }); await until(() => a.get('posefail').length === 1);
assert.equal(a.p().pose, '', '의자에 앉아 있으면 거절');
a.send({ t: 'stand' }); await wait();

// 놀이터 패드 위(게임 모집 중)엔 거절
await moveTo(a, TAG.pad.x, TAG.pad.z); assert.equal(a.p().pad, 'tag');
await wait(300); a.send({ t: 'pose', p: 'sit' }); await until(() => a.get('posefail').length === 2);
await moveTo(a, 0, 6); assert.equal(a.p().pad, null);

// 게임·층 이동·낚시·행동·불꽃·놀이기구 중엔 거절 (상태만 잠깐 넣어 봄)
for (const [k, v] of [['game', 'tag'], ['transit', {}], ['fish', { st: 'wait' }], ['act', { k: 'bow' }], ['fw', 1], ['ride', { id: 0 }]]) {
  const p = a.p(), n = a.get('posefail').length;
  p[k] = v; await wait(300); a.send({ t: 'pose', p: 'sit' });
  await until(() => a.get('posefail').length === n + 1);
  assert.equal(p.pose, '', `${k} 중엔 거절`);
  p[k] = null;
}

// 행동(사찰 절 등)·낚시를 시작하려 하면 자세가 먼저 풀림
await wait(300); a.send({ t: 'pose', p: 'clap' }); await until(() => poseOf(b, a.id) === 'clap');
a.send({ t: 'act', k: 'bow', spot: 0 }); await until(() => poseOf(b, a.id) === '');

// 나가면 끝 (자세는 접속자 객체의 필드 하나라 따로 쌓이는 게 없음, 저장도 안 함)
await wait(300); a.send({ t: 'pose', p: 'lie' }); await until(() => poseOf(b, a.id) === 'lie');
const aid = a.id; a.ws.close();
await until(() => b.get('leave').some((m) => m.id === aid));
assert.ok(!players.has(aid));
console.log('자세 시험 통과');
for (const x of [b, c]) x.ws.close();
srv.close(); store.flush(); process.exit(0);
