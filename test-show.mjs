// 불꽃놀이 시간 운영 시험: 단계표(19:00·22:00)·게이트 닫힘 벽·놀이공원 안 사람 퇴장(알림 → 자동 걷기 → 남은 사람 다리 앞으로)·놀이기구 영업 중단·봇, 그리고 서버(포트 3396)에서 실제로 닫힘
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { showAt, T, SHOW_LEN, SHOW_HOURS } from './public/showdata.js';
import { KST } from './public/daycycle.js';
import { resolve, PARK_GATE, inPark, gateClosed, setGateClosed, GATE_WALL } from './public/world.js';
import { createShow, OUT } from './show.js';

const H = 3.6e6, day0 = Math.floor((Date.now() + KST) / 864e5) * 864e5 - KST; // 오늘 한국 0시의 실제 시각
const at = (h, mi = 0, s = 0) => day0 + h * H + mi * 6e4 + s * 1e3;

// ── 1. 단계표: 19:00 쇼 기준 -5분 warn, -3분 evac, -1분 closed(게이트), 0 show, +3분 after, +3분30초 open
const ph = (h, mi, s) => showAt(at(h, mi, s)).ph;
assert.equal(ph(18, 54, 59), 'open'); assert.equal(ph(18, 55, 0), 'warn'); assert.equal(ph(18, 56, 59), 'warn'); assert.equal(ph(18, 57, 0), 'evac');
assert.equal(ph(18, 58, 59), 'evac'); assert.equal(ph(18, 59, 0), 'closed'); assert.equal(ph(18, 59, 59), 'closed'); assert.equal(ph(19, 0, 0), 'show');
assert.equal(ph(19, 2, 59), 'show'); assert.equal(ph(19, 3, 0), 'after'); assert.equal(ph(19, 3, 29), 'after'); assert.equal(ph(19, 3, 30), 'open');
assert.equal(ph(21, 55, 0), 'warn'); assert.equal(ph(22, 0, 0), 'show'); assert.equal(ph(22, 3, 30), 'open'); assert.equal(ph(12, 0, 0), 'open'); assert.equal(ph(0, 0, 0), 'open');
for (const [h, mi, s, gate] of [[18, 58, 59, false], [18, 59, 0, true], [19, 1, 0, true], [19, 3, 29, true], [19, 3, 30, false]]) assert.equal(showAt(at(h, mi, s)).gate, gate, `게이트 ${h}:${mi}:${s}`);
assert.equal(showAt(at(18, 59, 0)).until, 60e3); assert.equal(showAt(at(19, 0, 30)).until, -30e3); assert.equal(showAt(at(18, 55, 0)).next, 120e3); 
assert.equal(showAt(at(12, 0, 0)).next, 6 * H + 55 * 6e4, '12시 → 다음 알림(18:55)까지'); assert.equal(showAt(at(23, 0, 0)).next, 19 * H + 55 * 6e4, '23시 → 다음날 18:55 알림까지');
assert.equal(showAt(at(19, 0, 0)).park, false); assert.equal(showAt(at(12, 0, 0)).park, true);
assert.deepEqual(SHOW_HOURS, [19, 22]); assert.equal(SHOW_LEN, 180e3); assert.equal(T.reopen - T.after, 30e3);
console.log('ok 단계표: 19:00·22:00 쇼, -5분 안내 → -3분 퇴장 → -1분 게이트 닫힘 → 쇼 3분 → +3분30초 영업 재개');

// ── 2. 게이트 벽: 닫혀 있을 때만 정문 폭 30m 가 막힘
setGateClosed(false); assert.equal(gateClosed(), false);
const [ox, oz] = resolve(PARK_GATE.x + 8, PARK_GATE.z); assert.ok(Math.abs(ox - (PARK_GATE.x + 8)) < 1e-6, '열려 있으면 그대로');
let [px, pz] = resolve(PARK_GATE.x - 3, PARK_GATE.z); assert.ok(Math.abs(px - (PARK_GATE.x - 3)) < 1e-6, '열려 있으면 안쪽으로 걸어 들어감');
setGateClosed(true); assert.equal(gateClosed(), true); assert.equal(GATE_WALL.length, 1);
for (const dz of [-14, -7, 0, 7, 14]) { const [x1] = resolve(PARK_GATE.x - 0.2, PARK_GATE.z + dz); const [x2] = resolve(PARK_GATE.x + 0.2, PARK_GATE.z + dz); assert.ok((x1 < PARK_GATE.x - 0.5) !== (x2 < PARK_GATE.x - 0.5) || Math.abs(x1 - x2) > 0.8, `닫힌 문 z${dz}: 문 안쪽 ${x1.toFixed(2)} 바깥쪽 ${x2.toFixed(2)} 로 갈라져야 함`); }
const [wx] = resolve(PARK_GATE.x + 1.5, PARK_GATE.z); assert.ok(wx > PARK_GATE.x + 0.9, '닫힌 문 앞(바깥)에서는 안으로 못 들어감: ' + wx);
const [wx2] = resolve(PARK_GATE.x - 1.5, PARK_GATE.z); assert.ok(wx2 < PARK_GATE.x - 0.9, '닫힌 문 안쪽에서는 밖으로 못 나감: ' + wx2);
setGateClosed(false);
console.log('ok 게이트 벽: 열림 → 지나감, 닫힘 → 정문 폭 전체가 양쪽에서 막힘');

// ── 3. 운영(가짜 시계·가짜 접속자): 안내 방송 순서, 퇴장 알림은 놀이공원 안 사람에게만, 문이 닫힐 때 남은 사람은 다리 앞으로, 타던 사람 내림, 봇 호출
let clock = at(18, 54, 0); const sent = [], bc = [], log = [];
const mk = (id, x, z, o = {}) => ({ id, x, z, ry: 0, seat: -1, ride: null, ws: {}, ...o });
const players = new Map([[1, mk(1, -300, -34)], [2, mk(2, -120 + 30, -30)], [3, mk(3, -420, -60, { seat: 5 })], [4, mk(4, -350, -34, { ride: { id: 'carousel', seat: 1 } })], [5, mk(5, -330, -34, { ws: null })], [6, mk(6, PARK_GATE.x + 0.5, PARK_GATE.z + 3)]]);
const show = createShow({ now: () => clock, rand: () => 0.5, players, send: (p, o) => sent.push([p.id, o]), bcast: (o) => bc.push(o), stand: (p) => { p.seat = -1; log.push('stand' + p.id); }, rides: { evict: (p) => { if (p.ride) { p.ride = null; log.push('evict' + p.id); } } }, bots: { evac: () => log.push('botEvac'), gather: (f) => { const [x, z] = f(); log.push('botGather'); assert.ok(x < -126 && x > -216 && Math.abs(z + 34) < 14, '봇 구경 자리는 다리 위: ' + x + ',' + z); }, reset: (p) => log.push('botReset' + p.id) } });
assert.equal(show.closed(), false); assert.equal(gateClosed(), false);
const step = (h, mi, s) => { clock = at(h, mi, s); show.tick(); };
step(18, 54, 59); assert.equal(bc.length, 0, '평소엔 방송 없음');
step(18, 55, 0); assert.equal(bc.at(-1).ph, 'warn'); assert.equal(bc.at(-1).until, 300e3); assert.equal(show.closed(), true, '안내 단계부터 놀이기구 영업 중단'); assert.equal(gateClosed(), false, '아직 문 열림');
assert.equal(sent.length, 0, '안내 단계엔 퇴장 알림 아직 없음');
step(18, 57, 0); assert.equal(bc.at(-1).ph, 'evac');
const evac = sent.filter(([, o]) => o.t === 'evac'); assert.deepEqual(evac.map(([id]) => id).sort(), [1, 3, 4, 6].filter((id) => inPark(players.get(id).x, players.get(id).z)).sort(), '놀이공원 안 사람(ws 있는)에게만 퇴장 알림: ' + JSON.stringify(evac.map(([id]) => id)));
assert.ok(evac.every(([, o]) => o.x >= OUT.x0 - 5 && o.x <= OUT.x1 + 5 && Math.abs(o.z - PARK_GATE.z) <= OUT.hz + 1), '퇴장 목적지는 정문 밖 다리 앞'); assert.ok(log.includes('stand3'), '앉아 있던 사람은 일어남'); assert.ok(log.includes('botEvac') && log.includes('botGather'), '봇에게도 알림·다리 구경');
assert.ok(!sent.some(([id, o]) => id === 2 && o.t === 'evac'), '마을에 있는 사람(2)에겐 안 보냄');
step(18, 59, 0); assert.equal(bc.at(-1).ph, 'closed'); assert.equal(bc.at(-1).gate, true); assert.equal(gateClosed(), true, '문 닫힘');
const tps = sent.filter(([, o]) => o.t === 'tp'); assert.ok(tps.length >= 3, '남은 사람 옮김: ' + tps.length);
for (const [, p] of players) { if (p.id === 2) continue; assert.ok(!inPark(p.x, p.z) && p.x > PARK_GATE.x + 2.5, `사람 ${p.id} 가 정문 밖으로: ${p.x.toFixed(1)}`); assert.ok(Math.abs(p.z - PARK_GATE.z) <= OUT.hz + 1); }
assert.equal(players.get(2).x, -90, '마을 사람은 그대로'); assert.ok(log.includes('evict4'), '타던 사람은 내림'); assert.ok(log.includes('botReset5'), '봇은 하던 일 비움'); assert.ok(sent.some(([id, o]) => id === 6 && o.t === 'tp'), '문 자리에 있던 사람도 옮김');
step(19, 0, 0); assert.equal(bc.at(-1).ph, 'show'); assert.equal(gateClosed(), true);
step(19, 3, 0); assert.equal(bc.at(-1).ph, 'after'); assert.equal(gateClosed(), true);
step(19, 3, 30); assert.equal(bc.at(-1).ph, 'open'); assert.equal(gateClosed(), false, '쇼 끝나면 문 열림'); assert.equal(show.closed(), false, '영업 재개');
assert.deepEqual(bc.map((b) => b.ph), ['warn', 'evac', 'closed', 'show', 'after', 'open']);
console.log('ok 운영: 방송 순서 warn→evac→closed→show→after→open, 안에 있던 사람(앉음·탑승·문 자리·봇)만 처리, 쇼 끝나면 문 열림·영업 재개');

// ── 4. 서버 통합(포트 3396): 쇼 1분 전(18:58:58 부터)에 접속해 놀이공원 안에 서 있다가 닫힘 → 다리 앞으로 옮겨지고 문이 막음
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'village-show-')); process.env.DATA_DIR = dir; process.env.SHOW_AT = '18:58:56';
const { WebSocket } = await import('ws');
const S = await import('./server.js');
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('시간 초과: ' + fn); await wait(20); } };
const srv = await S.listen(3396);
const ws = new WebSocket('ws://localhost:3396'), inbox = []; ws.on('message', (d) => inbox.push(JSON.parse(d))); await new Promise((r) => ws.on('open', r));
ws.send(JSON.stringify({ t: 'join', guest: { g: 'f' } })); const welcome = await until(() => inbox.find((m) => m.t === 'welcome'));
assert.equal(welcome.show.ph, 'evac'); assert.ok(welcome.show.until > 0 && welcome.show.until <= 65e3); assert.equal(welcome.show.gate, false);
const me = S.players.get(welcome.id); Object.assign(me, { x: -300, z: -34 }); // 놀이공원 안에 선 것으로
const closed = await until(() => inbox.find((m) => m.t === 'show' && m.ph === 'closed'), 12000); assert.equal(closed.gate, true);
const tp = await until(() => inbox.find((m) => m.t === 'tp')); assert.ok(tp.x > PARK_GATE.x + 2.5 && Math.abs(tp.z - PARK_GATE.z) <= 9, '다리 앞으로 옮겨짐: ' + tp.x + ',' + tp.z);
assert.ok(gateClosed(), '서버 쪽 문 닫힘');
for (let x = PARK_GATE.x + 12; x >= PARK_GATE.x - 4; x -= 0.6) { ws.send(JSON.stringify({ t: 'm', x, z: PARK_GATE.z, ry: 1, w: 1, y: 0 })); await wait(25); } await wait(200); assert.ok(me.x > PARK_GATE.x, '닫힌 문 안으로는 걸어 들어갈 수 없음(걸어서 밀어도): ' + me.x);
ws.close(); await wait(300); srv.close();
console.log('ok 서버(3396): welcome 에 단계 · 닫힘 방송 · 남은 사람 다리 앞으로 · 닫힌 문 못 지남');
console.log('불꽃놀이 운영 시험 통과 ✓');
process.exit(0);
