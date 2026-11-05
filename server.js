import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { STATUS, POSES, AUTO, SEATS, SIT_STATUS, PORTALS, transitMs, placeOf, resolve, spawnPoint, standPos, cleanAvatar, randomAvatar } from './public/world.js';
import { guestNick, isGuestNick } from './guest.js';
import { createStore } from './store.js';
import { createAuth } from './auth.js';
import { createGames } from './games.js';
import { createSlot } from './slots.js';
import { createFishing } from './fishing.js';
import { createRituals } from './rituals.js';
import { kstHours } from './public/daycycle.js';
import { createCamp, atOffset, CLOSED_MSG } from './camp.js';
import { createFireworks } from './fireworks.js';
import { createBots } from './bots.js';
import { createRidesServer } from './rides.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const MAX_PLAYERS = 200; // 봇(약 80) + 사람
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN; // 화면(Vercel)과 서버가 다른 주소일 때만 필요: 화면 주소를 적음

export const store = createStore({ dir: process.env.DATA_DIR || path.join(ROOT, 'data'), upstashUrl: process.env.UPSTASH_REDIS_REST_URL, upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN });
const auth = createAuth(store, { reserved: (nick) => bots.reserved(nick) }); // 봇 닉네임은 가입 못 함

// three.js 는 node_modules 에서 그대로 내려줌 (CDN 에 안 기댐)
const fileFor = (url) => {
  const p = decodeURIComponent(url.split('?')[0]);
  const base = p.startsWith('/vendor/three/') ? [path.join(ROOT, 'node_modules/three/build'), p.slice(13)]
    : p.startsWith('/vendor/three-addons/') ? [path.join(ROOT, 'node_modules/three/examples/jsm'), p.slice(20)] // 후처리·유틸 같은 three 애드온
    : [path.join(ROOT, 'public'), p === '/' ? '/index.html' : p];
  const f = path.join(base[0], base[1]);
  return f.startsWith(base[0] + path.sep) ? f : null; // 폴더 밖으로 나가는 주소 차단
};
const server = http.createServer(async (req, res) => {
  if (ALLOW_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  if (req.url.startsWith('/api/')) {
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    return auth.handle(req, res, ip);
  }
  const f = fileFor(req.url);
  fs.readFile(f || '', (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

export const players = new Map();
export const chatLog = [];
const taken = new Map(); // 자리 번호 → 앉은 사람 id
const wss = new WebSocketServer({ server, maxPayload: 2048 });
let nextId = 1;

const ok = (ws) => ws?.readyState === 1 && ws.bufferedAmount < 2e6; // 밀린 연결엔 안 보냄
const send = (ws, o) => ok(ws) && ws.send(JSON.stringify(o));
const bcast = (o, except) => { const s = JSON.stringify(o); for (const p of players.values()) if (p.ws !== except && ok(p.ws)) p.ws.send(s); };
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const pub = (p) => ({ id: p.id, name: p.nick, a: p.a, s: p.s, pl: p.pl, x: p.x, z: p.z, ry: p.ry, seat: p.seat, fl: p.fl, vl: p.vl ? 1 : 0, pose: p.pose || '' });
const byUid = (uid) => [...players.values()].find((p) => p.uid === uid); // 같은 계정(로그인 아이디) 접속 찾기
const byNick = (nick) => { const k = String(nick).toLowerCase(); return [...players.values()].find((p) => p.nick.toLowerCase() === k); };

const games = createGames({ players, send, bcast, opts: { countdown: +process.env.GAME_COUNTDOWN || undefined, ready: +process.env.GAME_READY || undefined, throwCd: +process.env.GAME_THROW_CD || undefined } });

// ── 카지노: 지갑(칩은 가상, 계정에 저장)과 게임 모듈(슬롯·홀덤·블랙잭). 모듈 약속은 docs/CASINO.md
const saveTimers = new Map();
const wallet = {
  chips: (p) => p.chips,
  add(p, d) { // 결과가 음수면 거절. 바뀔 때마다 본인에게 알리고 잠시 뒤 저장
    if (!Number.isInteger(d) || p.chips + d < 0) return false;
    p.chips += d; send(p.ws, { t: 'wallet', chips: p.chips });
    clearTimeout(saveTimers.get(p.id));
    if (p.uid) saveTimers.set(p.id, setTimeout(() => auth.saveChips(p.uid, p.chips).catch(console.error), 600)); // 봇(uid 없음)은 저장 안 함
    return true;
  },
};
const CZ = {}; // 게임 종류('slot'|'poker'|'bj') → 모듈
const czCtx = (g) => ({ now: Date.now, wallet, players, toPlayer: (p, payload) => send(p.ws, { t: 'cz', g, ...payload }) });
CZ.slot = createSlot(czCtx('slot'));
for (const [g, file, make] of [['poker', './holdem.js', 'createPoker'], ['bj', './blackjack.js', 'createBlackjack']]) {
  try { CZ[g] = (await import(file))[make](czCtx(g)); } catch (e) { console.warn(`카지노 모듈 '${g}' 없음/오류 → 그 자리는 앉을 수 없음:`, e.code === 'ERR_MODULE_NOT_FOUND' ? '파일 없음' : e.message); }
}
const leaveCasino = (p) => { try { CZ[SEATS[p.seat]?.kind]?.leave(p); } catch (e) { console.error(e); } };

// 건물에 들어가면 '한가해요' 일 때만 자동으로 출근/커피 상태가 되고, 나오면 되돌아옴
export function setPlace(p, pl) {
  if (p.pl === pl) return false;
  p.pl = pl;
  if (p.auto) { p.s = 'free'; p.auto = false; }
  if (AUTO[pl] && p.s === 'free') { p.s = AUTO[pl]; p.auto = true; }
  return true;
}
// 바닥 자세 풀기 (움직이거나 다른 걸 하면): 모두에게 알림
const unpose = (p) => { p.pose = ''; bcast({ t: 'pose', id: p.id, p: '' }); };
const sendInfo = (p) => bcast({ t: 'info', id: p.id, s: p.s, pl: p.pl, seat: p.seat, x: p.x, z: p.z, ry: p.ry, fl: p.fl });
// 연못 낚시 (규칙은 fishing.js). FISH_BITE=최소,최대(ms) 는 시험용으로 입질을 빨리 오게 함
const fishing = createFishing({ now: Date.now, rand: Math.random, send: (p, o) => send(p.ws, o), bcast, info: sendInfo, save: (p) => p.uid && auth.saveFish(p.uid, p.dex).catch(console.error), opts: process.env.FISH_BITE ? { bite: process.env.FISH_BITE.split(',').map(Number) } : {} });

// 성당·사찰·교회 행동 (규칙은 rituals.js). RITUAL_AT=HH:MM 은 시험·시연용: 서버의 의식 시계를 그 한국 시각부터 흐르게 함
const ritOff = process.env.RITUAL_AT ? (() => { const [h, mi] = process.env.RITUAL_AT.split(':').map(Number); return ((((h + mi / 60 - kstHours(Date.now())) % 24) + 24) % 24) * 3.6e6; })() : 0;
const recTimers = new Map();
const saveRec = (p) => { if (!p.uid) return; clearTimeout(recTimers.get(p.id)); recTimers.set(p.id, setTimeout(() => { recTimers.delete(p.id); auth.saveSacred(p.uid, p.rec).catch(console.error); }, 1500)); };
const rituals = createRituals({ now: () => Date.now() + ritOff, send: (p, o) => send(p.ws, o), bcast, info: sendInfo, save: saveRec });
// 불멍 캠프 여는 시간(camp.js)·손으로 그리는 불꽃놀이(fireworks.js). CAMP_AT=HH:MM 은 시험·시연용: 캠프 시계를 그 한국 시각부터 흐르게 함
const campOff = process.env.CAMP_AT ? atOffset(process.env.CAMP_AT) : 0, campNow = () => Date.now() + campOff;
const camp = createCamp({ now: campNow, bcast, players, stand: (p) => stand(p) });
// 포근 놀이공원 놀이기구 (규칙은 rides.js, 약속은 docs/PARK.md): 메시지 { t: 'ride' } → act, 타는 중엔 걷기 무시(frozen)
const rides = createRidesServer({ now: Date.now, rand: Math.random, players, send: (p, o) => send(p.ws, o), bcast, info: sendInfo, stand: (p) => stand(p) });
const fireworks = createFireworks({ now: campNow, rand: Math.random, players, send: (p, o) => send(p.ws, o), open: camp.open });

// 일어나기: 앉기 전 상태로 되돌리고 의자 앞/뒤에 세움
export function stand(p) {
  if (p.seat < 0) return;
  leaveCasino(p);
  taken.delete(p.seat);
  [p.x, p.z] = standPos(SEATS[p.seat]);
  p.seat = -1; p.w = false; p.dirty = true;
  Object.assign(p, { s: p.prev.s, auto: p.prev.auto });
  setPlace(p, placeOf(p.x, p.z));
  sendInfo(p);
}

wss.on('connection', (ws) => {
  let me = null, joining = false, msgs = 0;
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  const rate = setInterval(() => (msgs = 0), 1000);

  const newMe = (nick, uid, a, chips, dex, rec) => { const [x, z] = resolve(...spawnPoint()); return { ws, nick, uid, a, chips, s: 'free', auto: false, seat: -1, fl: 0, transit: null, pl: 'town', x, z, ry: Math.PI, y: 0, pad: null, game: null, dex, fish: null, rec, act: null, vl: false }; };
  // 바로 입장(손님): 계정·기록 없이 들어옴. uid 가 없어서 칩·낚시·기도 기록은 저장되지 않음(봇과 같은 규칙). 닉네임은 서버가 랜덤으로 정하고 겹치면 다시 뽑음, 아바타는 성별에 맞게 클라이언트가 뽑은 것을 정리해서 씀
  async function joinGuest(gs) {
    if (players.size >= MAX_PLAYERS) return send(ws, { t: 'full' });
    const a = cleanAvatar(gs?.a?.g ? gs.a : randomAvatar(gs?.g === 'f' ? 'f' : 'm'));
    const online = (n) => [...players.values()].some((p) => p.nick.toLowerCase() === n.toLowerCase());
    const used = async (n) => bots.reserved(n) || online(n) || (await auth.nickTaken(n));
    let nick = isGuestNick(gs?.nick) && !(await used(gs.nick)) ? gs.nick : null; // 끊겼다 다시 들어올 땐 같은 이름
    for (let i = 0; !nick && i < 60; i++) { const n = guestNick(Math.random, i < 40 ? 2 : 3); if (!(await used(n))) nick = n; }
    if (!nick || online(nick)) return send(ws, { t: 'auth' }); // 동시에 같은 이름이 나온 드문 경우만 (다시 누르면 됨)
    me = newMe(nick, null, a, 1000, {}, {});
    addPlayer(me, { chips: 1000, refilled: false });
    bots.onHuman(me);
  }
  async function join(msg) {
    if (msg.guest) return joinGuest(msg.guest);
    const m = await auth.me(msg.token);
    if (!m?.user.avatar) return send(ws, { t: 'auth' }); // 로그인 안 됐거나 아바타를 아직 안 만듦
    if (players.size >= MAX_PLAYERS) return send(ws, { t: 'full' });
    const old = byUid(m.id);
    if (old) { send(old.ws, { t: 'kicked' }); old.ws.close(); } // 같은 계정이 다른 곳에서 접속하면 이전 접속을 끊음
    let chips = m.user.chips ?? 1000, refilled = false;
    if (chips < 300 && Date.now() - (m.user.refillAt || 0) > 6 * 3600e3) { chips = 1000; refilled = true; auth.saveChips(m.id, chips, Date.now()).catch(console.error); } // 파산 구제: 6시간에 한 번
    me = newMe(m.nick, m.id, m.user.avatar, chips, m.user.fish ?? {}, m.user.sacred ?? {});
    addPlayer(me, { chips, refilled });
    bots.onHuman(me);
  }

  ws.on('message', (raw) => {
    if (++msgs > 40) return; // 초당 40건 넘으면 무시
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join') { if (!me && !joining) { joining = true; join(m).catch((e) => console.error(e)).finally(() => (joining = false)); } return; }
    if (me) onMsg(me, m);
  });
  ws.on('close', () => { clearInterval(rate); if (me) drop(me); });
  ws.on('error', () => {});
});

// 접속자(사람·봇) 넣기: 사람에겐 welcome, 모두에게 join. 봇은 ws 가 없음
export function addPlayer(p, extra = {}) {
  p.id = nextId++;
  send(p.ws, { t: 'welcome', id: p.id, players: [...players.values()].map(pub).concat(pub(p)), log: chatLog, state: games.snapshot(), ...extra, fish: p.dex, fishers: fishing.snapshot(), sacred: p.rec, rit: rituals.snapshot(), camp: { ...camp.snapshot(), fw: fireworks.snapshot() }, rides: rides.snapshot() });
  players.set(p.id, p);
  bcast({ t: 'join', p: pub(p) }, p.ws ?? undefined);
}
// 접속 끊김(사람)·나감(봇): 자리·낚시·행동·불꽃 정리, 사람만 저장
export function drop(me) {
  if (me.seat >= 0) { leaveCasino(me); taken.delete(me.seat); }
  fishing.leave(me); rituals.leave(me); fireworks.leave(me); rides.leave(me);
  if (me.uid) {
    if (recTimers.has(me.id)) { clearTimeout(recTimers.get(me.id)); recTimers.delete(me.id); auth.saveSacred(me.uid, me.rec).catch(console.error); }
    clearTimeout(saveTimers.get(me.id)); auth.saveChips(me.uid, me.chips).catch(console.error);
  }
  if (players.get(me.id) === me) { players.delete(me.id); games.onLeave(me); bcast({ t: 'leave', id: me.id }); }
}
// 메시지 하나 처리 (사람은 웹소켓에서, 봇은 bots.js 에서 같은 규칙으로)
export function onMsg(me, m) {
  if (me.fish && (['sit', 'go', 'throw'].includes(m.t) || (m.t === 'm' && (Math.hypot(m.x - me.x, m.z - me.z) > 0.05 || m.y > 0)))) fishing.stop(me); // 낚시 중 움직이거나 다른 걸 하면 취소
  if (me.act && (['sit', 'stand', 'go', 'throw', 'fish'].includes(m.t) || (m.t === 'm' && (Math.hypot(m.x - me.x, m.z - me.z) > 0.05 || m.y > 0)))) rituals.stop(me); // 행동 중 움직이거나 다른 걸 하면 취소
  if (me.pose && (['sit', 'go', 'throw', 'fish', 'act', 'ride', 'fw'].includes(m.t) || (m.t === 'm' && (Math.hypot(m.x - me.x, m.z - me.z) > 0.05 || m.y > 0)))) unpose(me); // 자세 중 움직이거나 점프·다른 걸 하면 풀림
  if (me.fw && (['sit', 'stand', 'go', 'throw', 'fish', 'act'].includes(m.t) || (m.t === 'm' && (Math.hypot(m.x - me.x, m.z - me.z) > 0.05 || m.y > 0)))) fireworks.stop(me); // 불꽃놀이 중 움직이면 취소
  if (m.t === 'm') {
    if (me.seat >= 0 || me.transit || games.frozen(me) || rides.frozen(me)) return; // 앉아 있거나 층 이동·게임 준비·놀이기구 타는 중엔 위치 고정
    if (![m.x, m.z, m.ry].every(Number.isFinite)) return;
    [me.x, me.z] = games.clamp(me, ...resolve(m.x, m.z, 0.4, me.fl));
    me.ry = m.ry; me.w = !!m.w; me.y = Math.max(0, Math.min(2, Number(m.y) || 0)); me.dirty = true; // y = 점프 높이
    games.onMove(me);
    if (setPlace(me, placeOf(me.x, me.z))) sendInfo(me);
  } else if (m.t === 'chat') {
    const text = clean(m.text, 80), now = Date.now();
    if (!text || now - (me.lastChat || 0) < 400) return;
    me.lastChat = now;
    const e = { id: me.id, name: me.nick, c: me.a.oc, pl: me.pl, text };
    chatLog.push(e); if (chatLog.length > 40) chatLog.shift();
    bcast({ t: 'chat', ...e });
  } else if (m.t === 'dm') { // 귓속말: 받는 사람과 보낸 사람에게만 감
    const text = clean(m.text, 200), now = Date.now(), to = byNick(m.to);
    if (!text || now - (me.lastChat || 0) < 400) return;
    if (!to || to === me) return send(me.ws, { t: 'dmfail', to: clean(m.to, 10) });
    me.lastChat = now;
    const e = { t: 'dm', from: me.nick, to: to.nick, text, ts: now };
    send(me.ws, e); send(to.ws, e);
  } else if (m.t === 'st' && STATUS[m.s]) {
    me.s = m.s; me.auto = false; sendInfo(me);
  } else if (m.t === 'sit') {
    const st = SEATS[m.seat];
    if (!st || me.seat >= 0 || me.game || me.transit || rides.frozen(me) || st.fl !== me.fl || Math.hypot(me.x - st.x, me.z - st.z) > 2.5) return;
    if (taken.has(st.id)) return send(me.ws, { t: 'sitfail' });
    if (st.kind === 'fire' && !camp.open()) return send(me.ws, { t: 'fwno', error: CLOSED_MSG }); // 불멍 벤치는 불이 켜져 있을 때만
    taken.set(st.id, me.id);
    const before = { prev: { s: me.s, auto: me.auto }, x: me.x, z: me.z, ry: me.ry };
    Object.assign(me, { ...before, seat: st.id, s: SIT_STATUS[st.kind], auto: false, x: st.x, z: st.z, ry: st.ry, w: false, dirty: true });
    if (['slot', 'poker', 'bj'].includes(st.kind)) { // 카지노 자리: 게임 모듈이 허락해야 앉음 (칩 부족 등은 거절)
      const r = CZ[st.kind]?.join(me, st) ?? { ok: false, error: '아직 준비 중인 게임이에요' };
      if (!r.ok) { taken.delete(st.id); Object.assign(me, { seat: -1, s: before.prev.s, auto: before.prev.auto, x: before.x, z: before.z, ry: before.ry }); return send(me.ws, { t: 'czerr', error: r.error }); }
    }
    games.onMove(me);
    sendInfo(me);
  } else if (m.t === 'stand') stand(me);
  else if (m.t === 'cz') { const st = me.seat >= 0 && SEATS[me.seat]; if (st && m.g === st.kind && CZ[st.kind]) CZ[st.kind].act(me, m); }
  else if (m.t === 'go') { // 계단·엘리베이터: 서 있는 지점에서만, 이동 중엔 못 움직임
    const pt = PORTALS[m.p], to = pt?.kind === 'lift' ? m.to : pt?.to;
    if (!pt || me.transit || me.seat >= 0 || me.game || rides.frozen(me) || pt.fl !== me.fl || Math.hypot(me.x - pt.x, me.z - pt.z) > pt.r + 1 || !Number.isInteger(to) || to < 0 || to > 2 || to === pt.fl) return;
    const dur = transitMs(pt, to);
    Object.assign(me, { x: pt.x, z: pt.z, w: false, dirty: true, transit: { pt, to, end: Date.now() + dur } });
    bcast({ t: 'fl', id: me.id, p: pt.id, to, dur });
  }
  else if (m.t === 'throw') games.throwBalloon(me, m);
  else if (m.t === 'fish') fishing.act(me, m);
  else if (m.t === 'act') rituals.act(me, m); // 고해 체험 글은 화면에만 있고 여기로 오지 않음 (오더라도 읽지 않음)
  else if (m.t === 'bead') rituals.bead(me);
  else if (m.t === 'note') rituals.note(me, m);
  else if (m.t === 'fw') fireworks.act(me, m);
  else if (m.t === 'ride') rides.act(me, m); // 놀이기구 타기·내리기·조작 (rides.js)
  else if (m.t === 'pose') { // 바닥 자세: 서 있을 때만 (의자·게임·놀이터 패드·층 이동·낚시·행동·불꽃·기구 중엔 거절), 바꾸기는 0.25초에 한 번
    const k = m.p === '' ? '' : Object.hasOwn(POSES, m.p) ? m.p : null, now = Date.now();
    if (k === null || k === (me.pose || '')) return;
    if (!k) return unpose(me);
    if (me.seat >= 0 || me.game || me.pad || me.transit || me.fish || me.act || me.fw || rides.frozen(me)) return send(me.ws, { t: 'posefail' });
    if (now - (me.poseAt || 0) < 250) return;
    me.pose = k; me.poseAt = now; bcast({ t: 'pose', id: me.id, p: k });
  }
  else if (m.t === 'emote' && ['👋', '😄', '❤️', '👍'].includes(m.e)) {
    bcast({ t: 'emote', id: me.id, e: m.e });
  }
}

// 위치는 1초에 10번 모아서 한 번에 보냄
setInterval(() => {
  const moved = [...players.values()].filter((p) => p.dirty);
  if (!moved.length) return;
  const r = (n) => Math.round(n * 100) / 100;
  bcast({ t: 's', p: moved.map((p) => { p.dirty = false; return [p.id, r(p.x), r(p.z), r(p.ry), p.w ? 1 : 0, r(p.y || 0)]; }) });
}, 100);
export function tick() {
  games.tick();
  fishing.tick();
  rituals.tick();
  camp.tick(); fireworks.tick(); rides.tick();
  for (const g in CZ) { try { CZ[g].tick(); } catch (e) { console.error(g, e); } }
  const now = Date.now();
  for (const p of players.values()) if (p.transit && now >= p.transit.end) { // 층 이동 끝: 도착 위치에 세움
    const { pt, to } = p.transit;
    Object.assign(p, { fl: to, transit: null, x: pt.kind === 'lift' ? pt.x : pt.ex, z: pt.kind === 'lift' ? pt.z : pt.ez, dirty: true });
    sendInfo(p);
  }
}
setInterval(tick, 50);
// 끊긴 연결 정리
setInterval(() => wss.clients.forEach((ws) => (ws.alive ? ((ws.alive = false), ws.ping()) : ws.terminate())), 30000);

// 항상 접속해 있는 봇 유저 (bots.js). 하루 일정은 캠프 시계(CAMP_AT) → 의식 시계(RITUAL_AT) → 실제 시각 순으로 따름 (시연용 시각을 맞추면 봇도 그 시간대처럼 움직임)
const botNow = campOff ? campNow : ritOff ? () => Date.now() + ritOff : Date.now;
export const bots = createBots({ players, now: () => botNow(), ritualNow: () => Date.now() + ritOff, rand: Math.random, handle: onMsg, join: (p) => addPlayer(p), leave: drop, seatFree: (id) => !taken.has(id), campOpen: () => camp.open(), nickTaken: (nick) => auth.nickTaken(nick), gameInfo: (p) => games.info(p), gameBusy: (gid) => games.busy(gid) });
export { taken };

export const listen = (port) => new Promise((res) => server.listen(port, () => res(server)));
process.on('SIGTERM', () => { store.flush(); process.exit(0); });
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3300;
  const nBots = process.env.BOTS == null || process.env.BOTS === '' ? 80 : Math.max(0, Math.min(150, Number(process.env.BOTS) || 0)); // 본 실행만 기본 80명 (시험의 listen() 은 꺼짐)
  listen(port).then(async () => { console.log(`포근마을 http://localhost:${port} (저장소: ${store.kind})`); if (nBots) { await bots.start(nBots); console.log(`봇 ${nBots}명 접속`); } });
}
