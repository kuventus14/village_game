// 불꽃 스틱·올려다보는 카메라 시험: 서버 규칙(kind 검사·스틱 평면·동시 인원·획·간격·점 수·쿨다운·근처만 방송·취소·06:00·kind 없는 예전 메시지 = 하늘),
// 카메라 순수 함수(camrig.js: 올려다보기 범위·천정 시선·땅 위·아바타가 화면 아래에 보임), 화면 ↔ 평면 되돌림(하늘·스틱), 서버 통합(포트 3391)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import * as W from './public/world.js';
import { createFireworks } from './fireworks.js';
import { camRig, drawView, PMIN, PMAX, TILT, LOOK_MAX } from './public/camrig.js';

const { FIRE, FW, FW_PLANE, STICK, STICK_PLANE, fwWorld, fwHit } = W;
const KST = (h, m = 0) => Date.UTC(2026, 10, 3, h - 9, m); // 한국 시각 → ms

// ── 1. 서버 규칙 (가짜 시계)
{
  let t = KST(21), open = true; const out = [], players = new Map();
  const F = createFireworks({ now: () => t, rand: () => 0.5, players, send: (p, o) => out.push({ to: p.id, ...o }), open: () => open });
  const P = (id, x, z, o = {}) => { const p = { id, nick: 'n' + id, x, z, seat: -1, fl: 0, ...o }; players.set(id, p); return p; };
  const got = (to, k, id) => out.filter((m) => m.to === to && (m.t === 'fw' ? m.k === k : m.t === k) && (id == null || m.id === id));
  const watch = P(100, FIRE.x - 10, FIRE.z), far = P(101, 0, 0);
  // kind 검사: 모르는 값은 거부, 없으면 하늘(봇·예전 화면)
  const a = P(1, FIRE.x + 6, FIRE.z);
  for (const bad of ['moon', 5, {}, 'toString', '__proto__', false]) { F.act(a, { k: 'start', ry: 0, kind: bad }); assert.ok(!F.busy(a), `kind ${JSON.stringify(bad)} 거부`); }
  assert.match(got(1, 'fwno').at(-1).error, /알 수 없는/);
  F.act(a, { k: 'start', ry: 0 }); const sky = got(100, 'start', 1)[0];
  assert.ok(F.busy(a) && sky.kind === 'sky' && sky.plane.y === FW_PLANE.y && Math.abs(sky.plane.z - (a.z + FW_PLANE.d)) < 1e-3 && sky.plane.hu == null, 'kind 없음 = 하늘 불꽃놀이 (봇 호환, 예전 평면 그대로)');
  // 스틱: 서버가 평면을 정함 (클라이언트가 보낸 plane 은 무시)
  const b = P(2, FIRE.x - 6, FIRE.z);
  F.act(b, { k: 'start', ry: Math.PI / 2, kind: 'stick', plane: { x: 0, y: 99, z: 0, ry: 0, hu: 50 } }); const st = got(100, 'start', 2)[0];
  assert.ok(F.busy(b) && st.kind === 'stick', '스틱 시작');
  assert.ok(Math.abs(st.plane.x - (b.x + STICK_PLANE.d)) < 5e-3 && Math.abs(st.plane.z - b.z) < 5e-3 && st.plane.y === STICK_PLANE.y && st.plane.hu === STICK_PLANE.hu && st.plane.hv === STICK_PLANE.hv, '스틱 평면: 바라본 방향 앞 5.5m · 높이 2.4m · ±3.4×±2.4');
  assert.equal(got(101, 'start').length, 0, '120m 밖엔 방송 안 함');
  // 동시 인원: 스틱 6명 + 하늘 4명 따로
  const sk = [b, ...Array.from({ length: 6 }, (_, i) => P(10 + i, FIRE.x + Math.cos(i) * 4, FIRE.z + Math.sin(i) * 4))];
  for (const p of sk.slice(1)) F.act(p, { k: 'start', ry: 0, kind: 'stick' });
  assert.equal(sk.filter((p) => F.busy(p)).length, STICK.maxActive, '스틱 동시 6명'); assert.match(got(15, 'fwno').at(-1).error, /스틱이 다 나갔/);
  const sy = Array.from({ length: 4 }, (_, i) => P(20 + i, FIRE.x + Math.cos(i) * 7, FIRE.z + Math.sin(i) * 7));
  for (const p of sy) F.act(p, { k: 'start', ry: 0 });
  assert.equal(sy.filter((p) => F.busy(p)).length, 3, '하늘은 a 포함 4명 (스틱 6명과 따로)'); assert.match(got(23, 'fwno').at(-1).error, /하늘이 꽉/);
  // 획: 0.5초 간격, 점은 그대로 근처에, 초당 60점
  t += 100; F.act(b, { k: 'down' }); F.act(b, { k: 'pts', p: [[0.1, 0.2], [0.3, -0.4]] });
  assert.deepEqual(got(100, 'pts', 2).at(-1).p, [[0.1, 0.2], [0.3, -0.4]]); assert.equal(got(2, 'pts').length, 0, '그린 사람에겐 안 돌려보냄'); assert.equal(got(101, 'pts').length, 0);
  t += 1000; for (let i = 0; i < 10; i++) F.act(b, { k: 'pts', p: Array(12).fill([0, 0]) });
  assert.equal(got(100, 'pts', 2).slice(1).reduce((s, m) => s + m.p.length, 0), STICK.ptsPerSec, '초당 60점');
  F.act(b, { k: 'up' }); t += 1000; F.act(b, { k: 'down' }); F.act(b, { k: 'pts', p: [[0, 0]] }); F.act(b, { k: 'up' }); assert.equal(got(100, 'pts', 2).at(-1).n, 1, '두 번째 획');
  t += 400; F.act(b, { k: 'down' }); F.act(b, { k: 'pts', p: [[0, 0]] }); assert.equal(got(100, 'pts', 2).at(-1).n, 1, '앞 획 시작 0.4초 뒤엔 새 획 안 됨');
  t += 100; F.act(b, { k: 'down' }); F.act(b, { k: 'pts', p: [[0, 0]] }); assert.equal(got(100, 'pts', 2).at(-1).n, 2, '0.5초 뒤 세 번째 획');
  F.act(b, { k: 'up' });
  for (let i = 0; i < 12; i++) { t += 500; F.act(b, { k: 'down' }); F.act(b, { k: 'pts', p: [[i / 20, 0], [i / 20, 0.1]] }); F.act(b, { k: 'up' }); }
  assert.equal(got(100, 'pop', 2).length, STICK.maxStrokes, '12획까지'); assert.equal(got(100, 'end', 2).at(-1).r, 'done'); assert.ok(!F.busy(b));
  // 400점이면 그 획은 끝
  const c = sk[1]; t += 500; F.act(c, { k: 'down' }); for (let i = 0; i < 40; i++) { t += 200; F.act(c, { k: 'pts', p: Array(12).fill([0.2, 0.2]) }); } assert.equal(got(100, 'pop', c.id).length, 1, '400점에서 끝');
  // 취소(움직임) → 그리던 획 끝나고 end cancel, 스틱 쿨다운 3초, 그 뒤 하늘은 8초
  const d = sk[2]; t += 600; F.act(d, { k: 'down' }); F.act(d, { k: 'pts', p: [[0, 0], [0.2, 0.1]] }); F.stop(d);
  assert.equal(got(100, 'end', d.id).at(-1).r, 'cancel'); assert.ok(got(100, 'pop', d.id).length === 1, '취소해도 그리던 획은 끝남');
  t += 2900; F.act(d, { k: 'start', ry: 0, kind: 'stick' }); assert.match(got(d.id, 'fwno').at(-1).error, /조금 뒤/, '스틱 쿨다운 3초'); t += 100; F.act(d, { k: 'start', ry: 0, kind: 'stick' }); assert.ok(F.busy(d));
  F.stop(d); t += 3000; F.act(d, { k: 'start', ry: 0 }); assert.match(got(d.id, 'fwno').at(-1).error, /조금 뒤/, '하늘은 8초'); F.stop(d);
  // 30초면 끝, snapshot 에 kind·평면
  const snap = F.snapshot().find((x) => x.id === c.id); assert.ok(snap.kind === 'stick' && snap.plane.hu === STICK_PLANE.hu, 'welcome 스냅샷에 kind·평면');
  t += 30000; F.tick(); assert.ok(!F.busy(c) && got(100, 'end', c.id).at(-1).r === 'time', '30초면 끝');
  // 06:00: 그리던 획까지 끝나고 closed
  const e = sk[3]; t += 3000; F.act(e, { k: 'start', ry: 0, kind: 'stick' }); t += 600; F.act(e, { k: 'down' }); F.act(e, { k: 'pts', p: [[0, 0], [0.5, 0.5]] });
  open = false; F.tick(); assert.equal(got(100, 'end', e.id).at(-1).r, 'closed'); assert.ok(got(100, 'pop', e.id).length >= 1);
  F.act(e, { k: 'start', ry: 0, kind: 'stick' }); assert.ok(!F.busy(e), '닫힌 시간엔 스틱도 거부');
}
console.log('ok 스틱 규칙: kind 검사(모르는 값 거부·없으면 하늘=봇 호환), 서버가 평면 정함(앞 5.5m·높이 2.4m), 스틱 6명·하늘 4명 따로, 0.5초 간격·12획·초당 60점·400점·30초, 근처만, 취소·쿨다운 3초/8초, 06:00');

// ── 2. 카메라 (camrig.js): 올려다보기
const head = (gy = 0) => [0, gy + 1.65, 0];
function onScreen(cam, p) { const v = new THREE.Vector3(...p).project(cam); return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 ? v : null; }
function mkCam(pos, look, aspect = 16 / 9, fov = aspect < 1 ? 64 : 50) { const c = new THREE.PerspectiveCamera(fov, aspect, 0.1, 400); c.position.set(...pos); c.lookAt(...look); c.updateMatrixWorld(); c.updateProjectionMatrix(); return c; }
{
  const T = [3, 1.2, -2];
  for (const [yaw, pitch, dist] of [[0, 0.55, 9], [1.2, 0.26, 5.2], [-2, 1.0, 15], [0.4, PMIN, 3.5], [2, PMAX, 18]]) { // 평소(내려다보기)는 예전 식과 같음
    const r = camRig(T, yaw, pitch, dist), cp = Math.cos(pitch), old = [T[0] + Math.sin(yaw) * cp * dist, T[1] + Math.sin(pitch) * dist, T[2] + Math.cos(yaw) * cp * dist];
    assert.ok(r.tilt === 0 && r.pos.every((v, i) => Math.abs(v - old[i]) < 1e-9) && r.look.every((v, i) => v === T[i]), `평소 시점 그대로 ${pitch}`);
  }
  let prevEl = -Infinity;
  for (let k = 0; k <= 20; k++) { // 올려다보기: 시선 높이각이 계속 올라가고 카메라는 늘 땅 위 0.4m 이상
    const r = camRig([0, 1.2, 0], 0.7, PMIN - (k / 20) * TILT, 9, (x, z) => 0.3 * Math.sin(x * 3) * Math.cos(z * 2) + 0.3);
    const d = r.look.map((v, i) => v - r.pos[i]), el = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    assert.ok(el >= prevEl - 1e-9, '시선이 계속 올라감'); prevEl = el;
    const g = 0.3 * Math.sin(r.pos[0] * 3) * Math.cos(r.pos[2] * 2) + 0.3; assert.ok(r.pos[1] >= g + 0.4 - 1e-9, `카메라가 땅 위 ${r.pos[1].toFixed(2)} ≥ ${(g + 0.4).toFixed(2)}`);
  }
  assert.ok(Math.abs(prevEl - LOOK_MAX) < 1e-6 && LOOK_MAX > 1.25, `끝까지 올려다보면 ${(prevEl * 180 / Math.PI).toFixed(1)}°`);
  const r = camRig([0, 1.2, 0], 0, PMIN - TILT * 3, 9); assert.equal(r.tilt, 1, '범위 밖으로 끌어도 최대에서 멈춤');
  for (const [aspect, fov, nm] of [[16 / 9, 50, 'PC'], [800 / 360, 50, '폰 가로'], [390 / 844, 64, '폰 세로']]) {
    const cam = mkCam(r.pos, r.look, aspect, fov), z = onScreen(cam, [0, 400, 0]);
    assert.ok(z && z.y > 0, `${nm}: 천정(수직 위)이 화면 안 위쪽`);
    assert.ok(onScreen(cam, head()), `${nm}: 아바타 머리가 화면 아래쪽에 보임`);
  }
  // 낮은 곳(카지노 3층·축대 위): 땅 높이를 따라감
  const hi = camRig([0, 9.2, 0], 0, PMIN - TILT, 9, () => 8); assert.ok(hi.pos[1] >= 8.4 && hi.pos[1] < 9.2, '높은 층에서도 그 층 바닥 위');
}
console.log(`ok 올려다보기: 평소 시점 예전과 같음, 시선 0 → ${(LOOK_MAX * 180 / Math.PI).toFixed(0)}° 계속 올라감, 범위 멈춤, 카메라는 땅 위 0.4m 이상, 천정이 화면 안 + 아바타 머리 보임 (PC·폰 가로·세로)`);

// ── 3. 화면 ↔ 평면: 그리는 시점에서 화면 가운데·되돌림 (하늘·스틱), 올려다본 게임 카메라에서도
{
  const me = { x: FIRE.x + 4, z: FIRE.z - 3, gy: 0 }, ry = 2.1;
  const skyPl = { x: me.x + Math.sin(ry) * FW_PLANE.d, y: FW_PLANE.y, z: me.z + Math.cos(ry) * FW_PLANE.d, ry };
  const stPl = { x: me.x + Math.sin(ry) * STICK_PLANE.d, y: STICK_PLANE.y, z: me.z + Math.cos(ry) * STICK_PLANE.d, ry, hu: STICK_PLANE.hu, hv: STICK_PLANE.hv };
  const v = new THREE.Vector3();
  const ray = (cam, x, y) => { const d = new THREE.Vector3(x, y, 0.5).unproject(cam).sub(cam.position).normalize(); return fwHit_(cam, d); };
  let fwHit_;
  const spiral = Array.from({ length: 60 }, (_, i) => { const t = (i / 59) * Math.PI * 5, r = 0.05 + (i / 59) * 0.5; return [Math.cos(t) * r, Math.sin(t) * r * 0.9]; });
  const errs = {};
  for (const [nm, kind, pl] of [['하늘', 'sky', skyPl], ['스틱', 'stick', stPl]]) for (const [aspect, an] of [[16 / 9, 'PC'], [800 / 360, '폰 가로'], [390 / 844, '폰 세로']]) {
    const vw = drawView(kind, me, pl, aspect), cam = mkCam(vw.eye, vw.look, aspect);
    fwHit_ = (c, d) => fwHit(pl, c.position.toArray(), d.toArray());
    if (kind === 'sky') { const c0 = ray(cam, 0, 0); assert.ok(Math.hypot(c0[0], c0[1]) < 1e-6, `${an}: 하늘 평면 가운데가 화면 한가운데`); }
    else { v.set(pl.x, pl.y, pl.z).project(cam); assert.ok(Math.abs(v.x) < 0.5 && Math.abs(v.y) < 0.5, `${an}: 스틱 평면 가운데가 화면 가운데쯤 (${v.x.toFixed(2)}, ${v.y.toFixed(2)})`); }
    assert.ok(onScreen(cam, [me.x, 1.65, me.z]), `${nm} ${an}: 아바타 머리가 보임`);
    let e = 0;
    for (const [u, w] of spiral) { const p = fwWorld(pl, u, w), s = onScreen(cam, p); if (!s) { assert.ok(aspect < 1, `${nm} ${an}: 평면 안쪽 점이 화면 밖`); continue; } const back = ray(cam, s.x, s.y); e = Math.max(e, Math.hypot(back[0] - u, back[1] - w)); }
    assert.ok(e < 1e-4, `${nm} ${an}: 되돌림 오차 ${e}`); errs[nm] = Math.max(errs[nm] || 0, e);
  }
  // 올려다본 게임 카메라에서도 하늘 평면 위 점 → 화면 → 평면이 맞음
  const r = camRig([me.x, 1.2, me.z], ry + Math.PI, PMIN - TILT * 0.45, 9), cam = mkCam(r.pos, r.look); fwHit_ = (c, d) => fwHit(skyPl, c.position.toArray(), d.toArray());
  let e = 0, n = 0; for (const [u, w] of spiral) { const s = onScreen(cam, fwWorld(skyPl, u, w)); if (!s) continue; n++; const back = ray(cam, s.x, s.y); e = Math.max(e, Math.hypot(back[0] - u, back[1] - w)); }
  assert.ok(n >= 10 && e < 1e-4, `올려다본 카메라: ${n}점 되돌림 오차 ${e}`);
  console.log(`ok 화면 ↔ 평면: 하늘 평면 가운데 = 화면 한가운데, 되돌림 오차 하늘 ${errs['하늘'].toExponential(1)} · 스틱 ${errs['스틱'].toExponential(1)} · 올려다본 카메라 ${e.toExponential(1)}, 아바타도 보임 (PC·폰 가로·세로)`);
}

// ── 4. 서버 통합 (포트 3391): kind 실어 보내기·거부·예전 메시지
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-stick-'));
process.env.CAMP_AT = '21:00';
const { WebSocket } = await import('ws');
const { listen, players } = await import('./server.js');
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 5000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
async function client(port, nick) {
  const api = async (name, body) => (await fetch(`http://localhost:${port}/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const s = await api('signup', { nick, pw: 'secret1' }); await api('avatar', { token: s.token, avatar: { g: 'f' } });
  const ws = new WebSocket(`ws://localhost:${port}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r));
  const c = { ws, inbox, send: (o) => ws.send(JSON.stringify(o)), got: (t, f = () => true) => inbox.filter((m) => m.t === t && f(m)), fw: (k, f = () => true) => inbox.filter((m) => m.t === 'fw' && m.k === k && f(m)) };
  c.send({ t: 'join', token: s.token }); c.welcome = await until(() => inbox.find((m) => m.t === 'welcome')); c.id = c.welcome.id;
  return c;
}
const walkTo = async (c, x, z) => { for (let i = 0; i < W.CAMP_PATH.pts.length; i += 8) { c.send({ t: 'm', x: W.CAMP_PATH.pts[i][0], z: W.CAMP_PATH.pts[i][1], ry: 0, w: 1, y: 0 }); await wait(40); } c.send({ t: 'm', x, z, ry: 0, w: 0, y: 0 }); await wait(250); };
{
  const PORT = 3391, srv = await listen(PORT);
  const a = await client(PORT, '스틱쟁이'), b = await client(PORT, '스틱구경');
  await walkTo(a, FIRE.x + 4, FIRE.z); await walkTo(b, FIRE.x - 8, FIRE.z + 3);
  a.send({ t: 'fw', k: 'start', ry: 0, kind: 'rocket' }); assert.match((await until(() => a.got('fwno')[0])).error, /알 수 없는/);
  a.send({ t: 'fw', k: 'start', ry: 0, kind: 'stick' }); const st = await until(() => b.fw('start', (m) => m.id === a.id)[0]);
  const pa = players.get(a.id); assert.ok(st.kind === 'stick' && st.plane.y === STICK_PLANE.y && Math.abs(st.plane.z - (pa.z + STICK_PLANE.d)) < 1e-3 && st.plane.hu === STICK_PLANE.hu, '구경꾼이 스틱 평면을 받음');
  a.send({ t: 'fw', k: 'down' }); const heart = Array.from({ length: 24 }, (_, i) => { const t = (i / 23) * Math.PI * 2; return [Math.round(Math.sin(t) ** 3 * 0.5 * 1000) / 1000, Math.round((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32 * 1000) / 1000]; });
  for (let i = 0; i < heart.length; i += 6) { a.send({ t: 'fw', k: 'pts', p: heart.slice(i, i + 6) }); await wait(105); }
  a.send({ t: 'fw', k: 'up' }); await until(() => b.fw('pop', (m) => m.id === a.id)[0]);
  assert.deepEqual(b.fw('pts', (m) => m.id === a.id).flatMap((m) => m.p), heart.map(([u, v]) => [u || 0, v || 0]), '점 그대로 실시간 방송');
  a.send({ t: 'm', x: pa.x + 1, z: pa.z, ry: 0, w: 1, y: 0 }); assert.equal((await until(() => b.fw('end', (m) => m.id === a.id)[0])).r, 'cancel', '걸으면 취소');
  await wait(3100); b.send({ t: 'fw', k: 'start', ry: 0 }); const sk = await until(() => a.fw('start', (m) => m.id === b.id)[0]); assert.ok(sk.kind === 'sky' && sk.plane.y === FW_PLANE.y, 'kind 없는 예전 메시지 = 하늘 불꽃놀이');
  b.send({ t: 'fw', k: 'stop' }); await until(() => a.fw('end', (m) => m.id === b.id)[0]);
  for (const c of [a, b]) c.ws.close();
  srv.close();
}
console.log('ok 서버(3391): 모르는 kind 거부 · 스틱 평면 방송 · 하트 점 그대로 · 걸으면 취소 · kind 없으면 하늘');
console.log('불꽃 스틱·올려다보기 시험 통과');
process.exit(0);
