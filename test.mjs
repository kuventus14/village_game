// 서버 통합 시험: 가입·로그인·저장, 귓속말, 건물 상태, 앉기, 술래잡기, 물풍선 피구
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-test-'));
Object.assign(process.env, { GAME_COUNTDOWN: '300', GAME_READY: '150', GAME_THROW_CD: '60' });
const { WebSocket } = await import('ws');
const { listen, players, store } = await import('./server.js');
const W = await import('./public/world.js');
const { BUILDINGS, SEATS, TAG, DODGE, doorPos, resolve } = W;

const PORT = 3399, BASE = `http://localhost:${PORT}`;
const srv = await listen(PORT);
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const api = async (name, body, ip = '9.9.9.9') => {
  const r = await fetch(`${BASE}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
  return { status: r.status, ...(await r.json()) };
};
const until = async (fn, ms = 4000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };

// 가입 → 아바타 저장 → 접속까지 해 주는 도우미
async function open(nick, avatar = {}) {
  const s = await api('signup', { nick, pw: 'secret1' });
  assert.equal(s.ok, true, `signup ${nick}: ${s.error}`);
  if (avatar) assert.equal((await api('avatar', { token: s.token, avatar: { g: 'f', ...avatar } })).ok, true);
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', token: s.token }));
  const c = { ws, inbox, token: s.token, nick, get: (t) => inbox.filter((m) => m.t === t), send: (o) => ws.send(JSON.stringify(o)) };
  if (avatar) { await until(() => c.get('welcome')[0]); c.id = c.get('welcome')[0].id; c.p = () => players.get(c.id); }
  return c;
}
const moveTo = async (c, x, z, y = 0) => { c.send({ t: 'm', x, z, ry: 0, w: 0, y }); await wait(60); };

// ── 가입·로그인
assert.equal((await api('signup', { nick: 'a', pw: 'secret1' })).status, 400, '너무 짧은 아이디');
assert.equal((await api('signup', { nick: 'bad<name>', pw: 'secret1' })).status, 400, '특수문자');
assert.equal((await api('signup', { nick: 'okname', pw: '123' })).status, 400, '짧은 비밀번호');
const su = await api('signup', { nick: '모모', pw: 'secret1' });
assert.ok(su.ok && su.token.length === 64 && su.avatar === null);
assert.equal((await api('signup', { nick: '모모', pw: 'other123' })).status, 409, '중복 아이디');
assert.equal((await api('signup', { nick: '모모', pw: 'other123' })).status, 409);
assert.equal((await api('login', { nick: '모모', pw: 'wrong-pw' })).status, 401);

// 닉네임(표시용, 중복 불가) · 아이디(로그인용, 중복 불가) · 비밀번호 (가입·로그인 횟수 제한을 피하려고 다른 주소로)
const apiB = (n, b) => api(n, b, '7.7.7.7');
const u1 = await apiB('signup', { id: 'login_one', nick: '표시이름', pw: 'secret1' });
assert.ok(u1.ok && u1.id === 'login_one' && u1.nick === '표시이름');
assert.equal((await apiB('signup', { id: 'login_one', nick: '다른이름', pw: 'secret1' })).status, 409, '아이디 중복');
assert.equal((await apiB('signup', { id: 'LOGIN_ONE', nick: '또다른', pw: 'secret1' })).status, 409, '아이디는 대소문자 구분 없이 중복');
const dupNick = await apiB('signup', { id: 'login_two', nick: '표시이름', pw: 'secret1' });
assert.equal(dupNick.status, 409); assert.ok(dupNick.error.includes('닉네임'), '닉네임 중복');
assert.equal((await apiB('signup', { id: 'login_three', nick: '모모', pw: 'secret1' })).status, 409, '옛 계정(닉네임=아이디)의 닉네임도 중복');
assert.equal((await apiB('signup', { id: '한글아이디', nick: '새닉네임', pw: 'secret1' })).status, 400, '아이디는 영문·숫자·_ 만');
assert.equal((await apiB('signup', { id: 'abc', nick: '새닉네임', pw: 'secret1' })).status, 400, '아이디 4자 이상');
assert.equal((await apiB('signup', { id: 'login_four', nick: 'x', pw: 'secret1' })).status, 400, '닉네임 2자 이상');
assert.equal((await apiB('login', { id: 'login_one', pw: 'wrong-pw' })).status, 401);
const l1 = await apiB('login', { id: 'login_one', pw: 'secret1' });
assert.ok(l1.ok && l1.nick === '표시이름', '아이디로 로그인하면 닉네임이 표시 이름');
assert.equal((await apiB('login', { id: '표시이름', pw: 'secret1' })).status, 401, '닉네임으로는 로그인 안 됨');
const meNew = await apiB('me', { token: l1.token });
assert.ok(meNew.ok && meNew.nick === '표시이름' && meNew.id === 'login_one');
assert.equal((await api('login', { nick: '없는사람', pw: 'secret1' })).status, 401, '없는 아이디도 같은 오류');
const li = await api('login', { nick: '모모', pw: 'secret1' });
assert.ok(li.ok && li.token !== su.token);
assert.equal((await api('me', { token: li.token })).nick, '모모');
assert.equal((await api('me', { token: 'x'.repeat(64) })).status, 401);
const sv = await api('avatar', { token: li.token, avatar: { g: 'f', hs: 99, ey: 'x', sk: 5, os: 4 } });
assert.deepEqual([sv.avatar.hs, sv.avatar.ey, sv.avatar.sk, sv.avatar.os, sv.avatar.g], [2, 0, 5, 4, 'f'], '이상한 값은 기본값, 나머지는 저장');
assert.equal((await api('me', { token: su.token })).avatar.sk, 5, '다른 로그인에서도 같은 아바타');
assert.equal((await api('avatar', { token: 'nope', avatar: {} })).status, 401);
const stored = JSON.stringify(await store.get('user:모모'));
assert.ok(!stored.includes('secret1'), '비밀번호 원문은 저장되지 않음');
await api('logout', { token: li.token });
assert.equal((await api('me', { token: li.token })).status, 401, '로그아웃하면 토큰 무효');
let last; for (let i = 0; i < 17; i++) last = await api('login', { nick: '모모', pw: 'bad-bad' }, '7.7.7.7');
assert.equal(last.status, 429, '로그인 시도 횟수 제한');

// 아바타 없이 접속하면 거절
{ const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', token: su.token })); // 이 계정은 위에서 아바타를 저장했음
  ws.send(JSON.stringify({ t: 'join', token: 'z'.repeat(64) }));
  await wait();
  assert.ok(inbox.some((m) => m.t === 'welcome'), '아바타가 있는 계정은 입장');
  ws.close(); await wait(); }
{ const s = await api('signup', { nick: '무아바타', pw: 'secret1' }), ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', token: s.token })); await wait();
  assert.ok(inbox.some((m) => m.t === 'auth') && !inbox.some((m) => m.t === 'welcome'), '아바타 없으면 입장 거절'); ws.close(); }

// ── 접속·귓속말
const a = await open('가나', { hs: 3, os: 1, ac: 2 }), b = await open('다라', { g: 'm', hs: 0 }), c = await open('마바', {});
await until(() => b.get('join').length >= 0 && c.get('welcome')[0]);
assert.equal(a.get('welcome')[0].players.length, 1);
assert.equal(b.get('welcome')[0].players.find((p) => p.name === '가나').a.hs, 3, '다른 사람 아바타 옵션이 전달됨');
a.send({ t: 'dm', to: '다라', text: '  비밀이야<b>  ' });
await until(() => b.get('dm')[0]);
assert.deepEqual(b.get('dm')[0], { ...b.get('dm')[0], from: '가나', to: '다라', text: '비밀이야b' });
assert.equal(a.get('dm').length, 1, '보낸 사람에게도 사본');
await wait();
assert.equal(c.get('dm').length, 0, '제3자에게는 안 보임');
await wait(450);
a.send({ t: 'dm', to: '없는사람', text: 'hi' });
await until(() => a.get('dmfail')[0]);
a.send({ t: 'dm', to: '가나', text: '나에게' }); await wait(450);
assert.equal(a.get('dm').length, 1, '자기 자신에게는 못 보냄');
await wait(450); a.send({ t: 'chat', text: '안녕' }); await until(() => c.get('chat')[0]);
assert.equal(b.get('dm').length, 1);

// 같은 계정이 또 접속하면 이전 접속이 끊김
{ const d = await open('중복', {}), ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (m) => inbox.push(JSON.parse(m)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', token: d.token }));
  await until(() => d.get('kicked')[0] && inbox.find((m) => m.t === 'welcome'));
  ws.close(); await wait(100); }

// ── 건물·앉기·점프 (이전 기능 유지 확인)
const [dx, dz] = doorPos(BUILDINGS.cafe);
await moveTo(a, dx - 3, dz);
assert.deepEqual([a.p().s, a.p().pl], ['coffee', 'cafe']);
const cs = SEATS.find((s) => s.kind === 'cafe');
await moveTo(b, cs.x + 1, cs.z);
b.send({ t: 'sit', seat: cs.id }); await wait();
assert.equal(b.p().seat, cs.id);
await moveTo(c, cs.x + 1, cs.z); c.send({ t: 'sit', seat: cs.id }); await wait();
assert.ok(c.get('sitfail')[0] && c.p().seat === -1, '같은 자리는 못 앉음');
b.send({ t: 'stand' }); await wait();
await moveTo(a, 0, 9, 1.234); await wait(250);
assert.equal(b.get('s').flatMap((m) => m.p).filter((r) => r[0] === a.id).at(-1)[5], 1.23, '점프 높이 전달');

// ── 술래잡기: 패드에 모이면 시작
await moveTo(a, TAG.pad.x, TAG.pad.z); await moveTo(b, TAG.pad.x + 1, TAG.pad.z);
const lob = await until(() => c.get('lobby').filter((m) => m.g === 'tag' && m.n === 2)[0]);
assert.ok(lob.cd >= 1 && lob.min === 2);
await until(() => a.get('gstart')[0]);
const gs = a.get('gstart')[0];
assert.equal(gs.g, 'tag');
const roles = Object.fromEntries(gs.parts);
assert.deepEqual(Object.values(roles).sort(), ['it', 'run']);
await until(() => a.get('tp')[0] && b.get('tp')[0]);
const [itC, runC] = roles[a.id] === 'it' ? [a, b] : [b, a];
const before = runC.p().x;
runC.send({ t: 'm', x: before + 3, z: runC.p().z, ry: 0, w: 1 }); await wait(60);
assert.equal(runC.p().x, before, '준비 시간엔 못 움직임');
await until(() => a.get('gstate').some((m) => m.ph === 'play'));
// 술래가 도망자 바로 옆으로 가면 잡힘 → 전원 술래라 끝
const rx = TAG.cx, rz = TAG.cz - 7;
runC.send({ t: 'm', x: rx, z: rz, ry: 0, w: 0 }); await wait(80);
itC.send({ t: 'm', x: rx + 0.7, z: rz, ry: 0, w: 0 });
await until(() => a.get('gtag')[0]);
assert.equal(a.get('gtag')[0].id, runC.id);
const ge = await until(() => a.get('gend')[0]);
assert.equal(ge.win, 'it');
// 게임 정보는 참가자에게만: 구경꾼(c)은 모집 알림·판 상태만 받고, 시작 알림·술래 알림·결과는 못 받음
assert.ok(b.get('gstart')[0] && b.get('gtag')[0] && b.get('gend')[0].msg && b.get('gend')[0].winners, '참가자는 시작·술래·결과를 받음');
await until(() => c.get('gend')[0]);
assert.equal(c.get('gstart').length + c.get('gtag').length, 0, '구경꾼에겐 시작·술래 알림이 안 감');
assert.ok(c.get('gstate').some((m) => m.g === 'tag' && m.ph === 'ready'), '구경꾼은 판 상태(발밑 링)만 받음');
assert.deepEqual(c.get('gend')[0], { t: 'gend', g: 'tag' }, '구경꾼에겐 결과(누가 이겼는지·이름)가 안 감');
await wait(100);
assert.equal(a.p().game, null);
assert.ok(Math.hypot(a.p().x - TAG.pad.x, a.p().z - TAG.pad.z) > TAG.pad.r, '끝나면 패드 밖으로 돌려보냄');
const inArena = (g, p) => Math.abs(p.x - g.cx) < g.hw && Math.abs(p.z - g.cz) < g.hd;
assert.ok(!inArena(TAG, a.p()) && !inArena(TAG, b.p()), '끝난 사람이 울타리 친 경기장 안에 내리면 못 나옴');
await moveTo(c, TAG.cx, TAG.cz); await wait(100); // 갇혔더라도 게임 중이 아니면 꺼내 줌
assert.ok(!inArena(TAG, c.p()), '경기장 안에 갇힌 사람 구조');

// ── 물풍선 피구
await moveTo(a, DODGE.pad.x, DODGE.pad.z); await moveTo(b, DODGE.pad.x + 1, DODGE.pad.z);
await until(() => a.get('gstart').find((m) => m.g === 'dodge'));
const ds = a.get('gstart').find((m) => m.g === 'dodge'), team = Object.fromEntries(ds.parts.map(([id, t]) => [id, t]));
assert.notEqual(team[a.id], team[b.id], '두 팀으로 나뉨');
const [t0, t1] = team[a.id] === 0 ? [a, b] : [b, a];
await until(() => a.get('gstate').some((m) => m.g === 'dodge' && m.ph === 'play'));
await moveTo(t0, DODGE.cx - 3, DODGE.cz); await moveTo(t1, DODGE.cx + 3, DODGE.cz);
await moveTo(t1, DODGE.cx - 5, DODGE.cz); // 자기 진영을 넘으려 해도 못 넘음
assert.ok(t1.p().x >= DODGE.cx + 0.5, '상대 진영으로 못 넘어감: ' + t1.p().x);
await moveTo(t1, DODGE.cx + 3, DODGE.cz);
const hits = () => t0.get('ghit').filter((m) => m.id === t1.id);
t0.send({ t: 'throw', dx: 1, dz: 0 });
await until(() => hits().length === 1);
assert.equal(hits()[0].hp, 1);
// 점프로 피하기
await moveTo(t1, DODGE.cx + 3, DODGE.cz, 1.1); await wait(100);
const bends = () => t0.get('bend').length;
const nb = bends(); t0.send({ t: 'throw', dx: 1, dz: 0 });
await until(() => bends() > nb);
assert.equal(hits().length, 1, '점프하면 맞지 않음');
await moveTo(t1, DODGE.cx + 3, DODGE.cz, 0); await wait(100);
t0.send({ t: 'throw', dx: 1, dz: 0 });
await until(() => hits().length === 2);
assert.equal(hits()[1].hp, 0);
const de = await until(() => a.get('gend').find((m) => m.g === 'dodge'));
assert.equal(de.win, team[t0.id]);
assert.deepEqual(de.winners, [t0.nick]);
assert.ok(t1.get('gend').find((m) => m.g === 'dodge')?.msg, '탈락한 참가자도 결과를 받음');
await until(() => c.get('gend').find((m) => m.g === 'dodge'));
assert.equal(c.get('ghit').length, 0, '구경꾼에겐 맞음·탈락 알림이 안 감');
assert.deepEqual(c.get('gend').find((m) => m.g === 'dodge'), { t: 'gend', g: 'dodge' }, '구경꾼에겐 피구 결과가 안 감');
assert.ok(c.get('balloon').length && c.get('bend').length, '물풍선 그림(3D)은 구경꾼에게도');
await wait(100);
assert.ok(!inArena(DODGE, t0.p()) && !inArena(DODGE, t1.p()), '피구 끝난 사람도 경기장 밖으로');

// ── 나가기·마무리
c.ws.close(); await wait(100);
assert.ok(b.get('leave').some((m) => m.id === c.id));
console.log('모든 시험 통과');
for (const x of [a, b]) x.ws.close();
srv.close(); store.flush(); process.exit(0);
