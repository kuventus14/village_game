import * as THREE from 'three';
import { ACT_STATUS, POSES, BUILDINGS, OUTFITS, STATUS, PLACE, SEATS, SIT_STATUS, SIT_TEXT, standPos, randomAvatar, FLOOR_H, PORTALS, transitAt, inside, placeOf, resolve, floorY, FACADES } from './world.js';
import { buildAvatar, disposeAvatar, animate, createCrowd } from './avatar.js';
import { api, wsUrl } from './api.js';
import { createEditor } from './editor.js';
import { createMinigames } from './minigame.js';
import { Q, LEVELS, KEY as Q_KEY } from './quality.js';
import { U } from './gfx.js';
import { createAtmosphere } from './atmosphere.js';
import { makeClock, clockLabel, MODES } from './daycycle.js';
import { createNature, PATHS } from './nature.js';
import { createMinimap } from './minimap.js';
import { createWater } from './water.js';
import { createTown } from './town.js';
import { createLife } from './life.js';
import { createPost } from './post.js';
import { createBuildings } from './buildings.js';
import { createCasino } from './casino.js';
import { createSacred } from './sacred.js';
import { createTrail } from './trail.js';
import { createFishing } from './fishing.js';
import { createRituals } from './rituals.js';
import { createCamp } from './camp.js';
import { createParkSite } from './park-site.js';
import { createZoo } from './zoo.js';
import { createRides } from './rides.js';
import { createBgm } from './bgm.js';
import { createFx } from './fx.js';
import { createFootsteps } from './footsteps.js';
import { createFireflies } from './fireflies.js';
import { camRig, PMIN, PMAX, TILT } from './camrig.js';

const $ = (s) => document.querySelector(s);
const coarse = matchMedia('(pointer:coarse)').matches;
const phoneUI = matchMedia('(pointer:coarse),(max-width:700px),(max-height:500px)'); // index.html 의 A안 최소 화면 조건과 같게
if (window.visualViewport) { const vv = visualViewport, fitVV = () => document.documentElement.style.setProperty('--vvh', vv.height + 'px'); vv.addEventListener('resize', fitVV); fitVV(); } // 주소창·키보드에 가려진 만큼 카드·메뉴 높이를 줄임
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: (k) => { try { localStorage.removeItem(k); } catch {} } };
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAng = (a, b, t) => a + ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * t;
let toastSound = null; // 알림 '띵' (fx.js 를 만든 뒤 연결)
const toast = (() => { let t; return (m) => { toastSound?.(); const el = $('#toast'); el.textContent = m; el.classList.add('on'); clearTimeout(t); t = setTimeout(() => el.classList.remove('on'), 2400); }; })();

/* ───────── 장면 ───────── */
const renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: !Q.post, powerPreference: 'high-performance' }); // 후처리 단계는 자체 MSAA 타깃을 씀
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false; // 그림자·후처리까지 한 프레임 전체를 세려고 직접 초기화
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
const post = createPost(renderer, scene, camera, Q);
const atmo = createAtmosphere(scene, camera, Q, renderer, post); // 하늘·해·달·별·안개·구름·먼 산 (한국 시간 낮·밤)
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  post.setSize();
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 64 : 50;
  camera.updateProjectionMatrix();
  joinSide = null;
}
let joinSide = null; // 가로 폰 입장 화면: 캐릭터를 왼쪽으로 밀어 카드와 안 겹치게
addEventListener('resize', resize);
resize();

/* ───────── 마을 만들기 ───────── */
let outdoors = null; // 매 프레임 움직이는 바깥 것들(물·오리·떠다니는 반짝이)
const BLD = {};

function buildVillage() {
  // 땅·나무·풀·꽃 / 집·가로등·벤치·울타리 / 연못·분수 / 나비·새·연기 (각 모듈 참고)
  const nature = createNature(scene, Q), town = createTown(scene), water = createWater(scene, Q);
  const life = createLife(scene, Q, { flowers: nature.flowers, cherry: nature.trees.cherry, chimneys: town.chimneys });
  outdoors = { water, life };
  Object.assign(interiors, createBuildings(scene)); // 카페·회사 (buildings.js)
  Object.assign(casino, createCasino(scene, buildAvatar)); // 카지노 3층 (casino.js)
  Object.assign(interiors, createSacred(scene, Q)); // 성당·교회·사찰 (sacred.js)
  createTrail(scene, Q); // 사찰 가는 숲길 (trail.js)
  outdoors.park = createParkSite(scene, Q); outdoors.zoo = createZoo(scene, Q); // 포근 놀이공원 땅·정문·광장·대로 (park-site.js) + 동물원 (zoo.js), 약속은 docs/PARK.md
  for (const key of Object.keys(BUILDINGS)) { // 건물 이름표(사람 수)
    BLD[key] = { label: document.createElement('div') };
    BLD[key].label.className = 'bld';
    $('#tags').append(BLD[key].label);
  }
}
const casino = { floors: [], npcs: [], cab: null, cabY: 0 }, interiors = {};

buildVillage();

/* ───────── 플레이어 ───────── */
const players = new Map();
let me = null, phase = 'join', MG = null; // phase 'join' = 가입·로그인·꾸미기 화면

function renderTag(p) {
  const [em, label] = STATUS[p.s] || STATUS.free;
  p.el.querySelector('.nm').textContent = p.name;
  const st = p.el.querySelector('.st');
  const gt = MG?.tagText(p); // 게임 중이면 역할(술래/팀/하트)이 상태를 대신함
  st.hidden = !gt && (p.s === 'free' || p.sit >= 0);
  const sb = p.el.querySelector('.sb'); // 앉아 있는 동안 머리 위 상태 말풍선
  sb.hidden = p.sit < 0;
  if (p.sit >= 0) sb.textContent = SIT_TEXT[SEATS[p.sit].kind];
  st.textContent = gt || `${em} ${label}`;
}
function addPlayer(i) {
  const av = buildAvatar(i.a);
  av.root.position.set(i.x, 0, i.z); av.root.rotation.y = i.ry;
  scene.add(av.root);
  const el = document.createElement('div');
  el.className = 'tag';
  el.style.setProperty('--c', OUTFITS[i.a.oc]);
  el.dataset.id = i.id;
  el.innerHTML = '<div class="bub" hidden></div><div class="sb" hidden></div><div class="st"></div><div class="nm"></div>';
  $('#tags').append(el);
  const p = { ...i, fl: i.fl ?? 0, gy: (i.fl ?? 0) * FLOOR_H, transit: null, jy: 0, ty: 0, vy: 0, sit: i.seat ?? -1, tx: i.x, tz: i.z, tr: i.ry, av, el, walking: false, bt: 0 };
  players.set(i.id, p);
  renderTag(p);
  return p;
}
function removePlayer(id) {
  const p = players.get(id);
  if (!p) return;
  disposeAvatar(p.av); p.el.remove(); players.delete(id);
}
function bubble(p, text, big) {
  const b = p.el.querySelector('.bub');
  b.textContent = text; b.hidden = false; b.className = 'bub' + (big ? ' big' : '');
  b.style.animation = 'none'; b.offsetWidth; b.style.animation = '';
  clearTimeout(p.bt);
  p.bt = setTimeout(() => (b.hidden = true), big ? 3000 : 5500);
}

/* ───────── 화면 UI ───────── */
let metaT = 0;
function renderMeta() { if (!metaT) metaT = setTimeout(() => { metaT = 0; renderMetaNow(); }, 200); } // 접속자 목록은 0.2초에 한 번만 다시 그림 (사람·봇 상태가 몰려 바뀔 때)
function renderMetaNow() {
  $('#cnt').textContent = players.size;
  const cnt = { cafe: 0, office: 0, casino: 0, work: 0 };
  const list = $('#roster');
  list.replaceChildren();
  for (const p of players.values()) {
    if (p.pl === 'cafe') cnt.cafe++;
    if (p.pl === 'office') cnt.office++;
    if (p.pl === 'casino') cnt.casino++;
    if (p.s === 'working') cnt.work++;
    const row = document.createElement('div'), dot = document.createElement('i'), nm = document.createElement('span'), sm = document.createElement('small');
    dot.className = 'dot'; dot.style.background = OUTFITS[p.a.oc];
    row.onclick = (ev) => { if (p !== me) showPMenu(p, ev.clientX, ev.clientY); };
    nm.textContent = p.name + (p === me ? ' (나)' : '');
    sm.textContent = `${STATUS[p.s][0]} ${PLACE[p.pl][1]}`;
    row.append(dot, nm, sm); list.append(row);
  }
  $('#places').innerHTML = $('#phm .pls').innerHTML = `<span class="chip">☕ 카페 ${cnt.cafe}</span><span class="chip">💼 출근 중 ${cnt.work}</span>` + (me ? `<span class="chip">🪙 ${(me.chips ?? 0).toLocaleString('ko-KR')}</span>` : ''); // 폰은 ≡ 메뉴 안에 같은 내용
  $('#phm .phn').textContent = players.size;
  for (const k of Object.keys(BUILDINGS)) {
    const n = [...players.values()].filter((p) => p.pl === k).length, w = [...players.values()].filter((p) => p.pl === k && p.s === 'working').length;
    BLD[k].label.textContent = `${PLACE[k][0]} ${PLACE[k][1]} · ${n}명` + (w ? ` · 💼 ${w}` : '');
  }
  if (me) { $('#stBtn').textContent = `${STATUS[me.s][0]} ${STATUS[me.s][1]} ▾`; $('#phm .phst').textContent = `${STATUS[me.s][0]} 내 상태: ${STATUS[me.s][1]}`; }
}
function logLine(e) {
  const ln = document.createElement('div'), dot = document.createElement('i'), nm = document.createElement('b');
  ln.className = 'ln'; dot.className = 'dot'; dot.style.cssText = `display:inline-block;margin-right:5px;background:${OUTFITS[e.c]}`;
  nm.textContent = e.name;
  ln.append(PLACE[e.pl]?.[0] + ' ', dot, nm, e.text);
  const log = $('#log'), stick = log.scrollTop + log.clientHeight > log.scrollHeight - 30;
  log.append(ln);
  while (log.children.length > 60) log.firstChild.remove();
  if (stick) log.scrollTop = log.scrollHeight;
}
let unread = 0;
const chatOpen = () => $('#chat').classList.contains('open');
const threads = new Map(); // 귓속말(비공개 채팅): 상대 닉네임 → { msgs, unread }
let active = ''; // '' = 전체 채팅, 아니면 지금 보는 귓속말 상대
const dmLog = $('#dmlog');
function setUnread(n) { unread = n; badge(); }
function badge() { const n = unread + [...threads.values()].reduce((s, t) => s + t.unread, 0); $('#chatBtn em').hidden = !n || chatOpen(); } // 닫혀 있을 때만 작은 점 (숫자 없음)
// 채팅 창 열기·닫기: 기본은 닫힘, 고른 것은 이 기기에 기억 (머리 위 말풍선은 늘 보임)
function setChat(open, save = true) {
  $('#chat').classList.toggle('open', open); $('#chatBtn').setAttribute('aria-pressed', open);
  if (open) setUnread(0); else { if (document.activeElement?.id === 'ci') document.activeElement.blur(); badge(); }
  if (save) store.set('village.chat', open ? '1' : '0');
}
function dmLine(m) {
  const ln = document.createElement('div'), nm = document.createElement('b');
  ln.className = 'ln' + (m.me ? ' me' : ''); nm.textContent = m.me ? '나' : m.from;
  ln.append(nm, m.text); dmLog.append(ln); dmLog.scrollTop = dmLog.scrollHeight;
}
function renderTabs() {
  const box = $('#ctabs'); box.replaceChildren();
  if (!threads.size) return;
  const mk = (label, key, cls, n) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.setAttribute('aria-pressed', active === key);
    if (n) { const i = document.createElement('i'); i.textContent = n; b.append(i); }
    b.onclick = () => setActive(key); box.append(b);
  };
  mk('전체', '', '', 0);
  for (const [nick, t] of threads) mk('🔒 ' + nick, nick, 'dm', t.unread);
}
function setActive(key) {
  active = key;
  if (key) { threads.get(key).unread = 0; dmLog.replaceChildren(); threads.get(key).msgs.forEach(dmLine); }
  dmLog.hidden = !key; $('#log').hidden = !!key; $('#cf').classList.toggle('dm', !!key);
  $('#ci').placeholder = key ? `${key}님에게만 보이는 귓속말` : '메시지 (Enter)';
  renderTabs(); badge();
}
function openDM(nick) {
  if (!threads.has(nick)) threads.set(nick, { msgs: [], unread: 0 });
  setChat(true); setActive(nick); $('#ci').focus();
}
// 이름표·주민 목록을 누르면 뜨는 작은 메뉴
const pm = $('#pmenu');
function showPMenu(p, x, y) {
  pm.replaceChildren();
  const t = document.createElement('small'); t.textContent = p.name;
  const b = document.createElement('button'); b.textContent = '💌 귓속말 (나와 그 사람만 보임)'; b.onclick = () => { pm.hidden = true; $('#roster').hidden = true; openDM(p.name); };
  pm.append(t, b); pm.hidden = false;
  pm.style.left = Math.max(8, Math.min(innerWidth - 250, x - 20)) + 'px'; pm.style.top = Math.max(8, Math.min(innerHeight - 110, y + 10)) + 'px';
}
document.addEventListener('pointerdown', (e) => { if (!pm.contains(e.target) && !e.target.closest('.nm')) pm.hidden = true; });
$('#tags').addEventListener('click', (e) => {
  const nm = e.target.closest('.nm'), p = nm && players.get(+nm.closest('.tag').dataset.id);
  if (p && p !== me) showPMenu(p, e.clientX, e.clientY);
});

for (const [k, [em, label]] of Object.entries(STATUS)) {
  if (ACT_STATUS.has(k)) continue; // 절·찬양 같은 행동 상태는 행동할 때만
  const b = document.createElement('button');
  b.textContent = `${em} ${label}`; b.dataset.s = k;
  b.onclick = () => { send({ t: 'st', s: k }); me.s = k; renderTag(me); renderMeta(); $('#stMenu').hidden = true; };
  $('#stMenu').append(b);
}
const MENUS = ['#roster', '#stMenu', '#setMenu', '#poseMenu'];
const toggleMenu = (id) => MENUS.forEach((m) => ($(m).hidden = m === id ? !$(m).hidden : true));
$('#stBtn').onclick = () => toggleMenu('#stMenu');
$('#who').onclick = () => toggleMenu('#roster');
$('#setBtn').onclick = () => toggleMenu('#setMenu');
$('#menuBtn').onclick = () => { toggleMenu('#setMenu'); $('#setMenu').scrollTop = 0; }; // 폰 ≡ = 설정 메뉴 (맨 위에 폰 전용 칸 #phm)
document.addEventListener('pointerdown', (e) => { if (phoneUI.matches && !e.target.closest('#top,#roster,#stMenu,#setMenu,#pmenu,#poseBtn,#poseMenu')) toggleMenu(); }); // 폰: 메뉴 바깥을 누르면 닫힘
// 바닥 자세 (앉기·눕기·만세·손 흔들기·박수·인사): 🧘 버튼·P 키 → 작은 목록. 서버가 pose 로 모두에게 중계, 움직이거나 점프하면 풀림 (control)
$('#poseMenu').innerHTML = Object.entries(POSES).map(([k, [em, nm]], i) => `<button data-pose="${k}">${em} ${nm}<kbd>${i + 1}</kbd></button>`).join('') + '<button class="up" data-pose="">🧍 일어나기<kbd>0</kbd></button>';
let poseAt = 0;
function markPose() { const k = me?.pose || ''; $('#poseBtn').setAttribute('aria-pressed', !!k); document.querySelectorAll('#poseMenu [data-pose]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.pose === k && !!k)); }
function setPose(k) {
  $('#poseMenu').hidden = true;
  if (!me || k === (me.pose || '')) return;
  if (k && (me.sit >= 0 || MG.active() || RIDE.busy() || FISH.busy() || RIT.acting() || CMP.drawing() || me.transit || auto)) return toast('지금은 자세를 바꿀 수 없어요');
  if (k && performance.now() - poseAt < 300) return; // 서버 상한(0.25초)보다 조금 느리게
  poseAt = performance.now(); me.pose = k; markPose(); send({ t: 'pose', p: k });
}
$('#poseBtn').onclick = () => { toggleMenu('#poseMenu'); markPose(); };
$('#poseMenu').onclick = (e) => { const b = e.target.closest('[data-pose]'); if (b) setPose(b.dataset.pose); };
$('#chatBtn').onclick = () => { setChat(!chatOpen()); if (chatOpen() && !coarse) $('#ci').focus(); };
setChat(store.get('village.chat') === '1', false);
$('#cf').onsubmit = (e) => {
  e.preventDefault();
  const v = $('#ci').value.trim(), w = v.match(/^\/(?:w|귓|귓속말)\s+(\S+)\s+([\s\S]+)/); // /w 닉네임 내용
  if (w) send({ t: 'dm', to: w[1], text: w[2] });
  else if (v && active) send({ t: 'dm', to: active, text: v });
  else if (v) send({ t: 'chat', text: v });
  $('#ci').value = ''; $('#ci').blur();
};

/* ───────── 네트워크 ───────── */
let ws, lastSent = '', sendT = 0, kicked = false;
const send = (o) => ws?.readyState === 1 && ws.send(JSON.stringify(o));
function connect() {
  ws = new WebSocket(wsUrl());
  ws.onopen = () => send(account.guest ? { t: 'join', guest: { g: account.g, a: account.avatar, nick: account.nick } } : { t: 'join', token: account.token }); // 손님은 다시 연결돼도 같은 아바타·이름
  ws.onmessage = (e) => handle(JSON.parse(e.data));
  ws.onclose = () => { if (phase === 'play' && !kicked) { toast('연결이 끊겼어요. 다시 연결 중…'); for (const id of [...players.keys()]) removePlayer(id); me = null; setTimeout(connect, 1500); } };
}
function handle(m) {
  FX.msg(m); // 소리만 (규칙은 아래 그대로)
  if (MG?.handle(m)) return; // 미니게임 메시지
  if (FISH.handle(m)) return; // 낚시 메시지 (welcome 은 도감만 읽고 넘김)
  if (RIT.handle(m)) return; // 성당·사찰·교회 행동 (welcome 은 기록·공유 상태만 읽고 넘김)
  if (CMP.handle(m)) return; // 불멍 캠프·불꽃놀이 (welcome 은 캠프 상태만 읽고 넘김)
  if (RIDE.handle(m)) return; // 놀이기구 (welcome 은 기구 상태만 읽고 넘김)
  if (m.t === 'welcome') {
    for (const i of m.players) addPlayer(i);
    me = players.get(m.id);
    if (account?.guest) { account.nick = me.name; account.avatar = me.a; } // 서버가 정한 손님 이름
    me.chips = m.chips; if (m.refilled) toast('🪙 칩이 바닥나서 1,000칩을 다시 받았어요!');
    if (phase !== 'play') { yaw = 0; camT.set(me.x, 1.2, me.z); }
    phase = 'play';
    if (prev) { disposeAvatar(prev); prev = null; }
    $('#join').hidden = true; $('#hud').hidden = false;
    camera.clearViewOffset(); joinSide = null;
    $('#log').replaceChildren(); m.log.forEach(logLine);
    $('#kick').hidden = true; m.state?.forEach((x) => MG.handle(x));
    renderMeta();
  } else if (m.t === 'wallet') { me.chips = m.chips; renderMeta(); chipSubs.forEach((f) => f(m.chips)); }
  else if (m.t === 'czerr') toast(m.error);
  else if (m.t === 'cz') { const ui = CZ_UI[m.g]; if (ui && czOpen === m.g) ui.onMsg(m); else { const q = (czQ[m.g] ??= []); q.push(m); if (q.length > 30) q.shift(); } }
  else if (m.t === 'fl') { const p = players.get(m.id); if (p) p.transit = { pt: PORTALS[m.p], to: m.to, t0: performance.now(), dur: m.dur }; }
  else if (m.t === 'auth') { store.del('village.token'); showAuth('로그인이 필요해요'); }
  else if (m.t === 'kicked') { kicked = true; $('#kick').hidden = false; }
  else if (m.t === 'tp') { Object.assign(me, { x: m.x, z: m.z, tr: m.ry, ry: m.ry, jy: 0, vy: 0 }); stopAuto(); } // 서버가 옮김(게임·기구 등) → 자동 걸음 끝
  else if (m.t === 'dm') {
    const other = m.from === me.name ? m.to : m.from, line = { me: m.from === me.name, from: m.from, text: m.text };
    if (!threads.has(other)) threads.set(other, { msgs: [], unread: 0 });
    const t = threads.get(other); t.msgs.push(line);
    if (active === other) dmLine(line); else if (!line.me) { t.unread++; toast(`💌 ${m.from}: ${m.text.slice(0, 24)}`); }
    renderTabs(); badge();
  } else if (m.t === 'dmfail') toast('그 사람은 지금 접속 중이 아니에요');
  else if (m.t === 'full') toast('마을이 꽉 찼어요 😢');
  else if (m.t === 'join') { addPlayer(m.p); toast(`${m.p.name}님이 놀러 왔어요 👋`); renderMeta(); }
  else if (m.t === 'sitfail') toast('앗, 그 자리엔 이미 누가 앉았어요');
  else if (m.t === 'pose') { const p = players.get(m.id); if (p) p.pose = m.p; if (p === me) markPose(); }
  else if (m.t === 'posefail') { me.pose = ''; markPose(); toast('지금은 자세를 바꿀 수 없어요'); }
  else if (m.t === 'leave') { removePlayer(m.id); renderMeta(); }
  else if (m.t === 's') {
    for (const [id, x, z, ry, w, y] of m.p) { const p = players.get(id); if (p && p !== me) Object.assign(p, { tx: x, tz: z, tr: ry, walking: !!w, ty: y }); }
  } else if (m.t === 'info') {
    const p = players.get(m.id);
    if (!p) return;
    const before = p.s, seat = m.seat ?? -1, moved = seat !== p.sit;
    p.s = m.s; p.pl = m.pl; p.sit = seat; p.fl = m.fl ?? p.fl;
    if (moved && p !== me) Object.assign(p, { tx: m.x, tz: m.z, tr: m.ry }); // 앉고 일어날 때 자리로 이동
    renderTag(p); renderMeta();
    if (p === me) casinoSync();
    if (p === me && m.s !== before && m.s !== 'free') toast(`${STATUS[m.s][0]} ${STATUS[m.s][1]} 으로 바뀌었어요`);
  } else if (m.t === 'chat') {
    logLine(m);
    const p = players.get(m.id);
    if (p) bubble(p, m.text);
    if (!chatOpen() && m.id !== me?.id) setUnread(unread + 1);
  } else if (m.t === 'emote') {
    const p = players.get(m.id);
    if (p) { bubble(p, m.e, true); if (m.e === '👋') p.av.wave = 1.4; }
  }
}

/* ───────── 카지노 화면 연결: 앉으면 그 게임 화면이 열림(모듈은 처음 쓸 때 불러옴) ───────── */
const CZ_FILES = { slot: ['./ui-slots.js', 'createSlotUI'], poker: ['./ui-poker.js', 'createPokerUI'], bj: ['./ui-blackjack.js', 'createBlackjackUI'] };
const CZ_UI = {}, czQ = {}, chipSubs = [];
let czOpen = null;
const czRoot = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'czroot' }));
async function loadUI(g) {
  if (g in CZ_UI) return CZ_UI[g];
  const [file, make] = CZ_FILES[g];
  try {
    CZ_UI[g] = (await import(file))[make]({ root: czRoot, send: (o) => send({ t: 'cz', g, ...o }), chips: () => me?.chips ?? 0, onChips: (fn) => chipSubs.push(fn), nick: account?.nick, toast, stand: () => { if (me?.sit >= 0) standUp(); } });
  } catch (e) { console.warn('카지노 화면을 못 불러왔어요:', g, e); CZ_UI[g] = null; }
  return CZ_UI[g];
}
async function casinoSync() {
  const kind = me && me.sit >= 0 ? SEATS[me.sit].kind : null, want = kind in CZ_FILES ? kind : null;
  if (want === czOpen) return;
  if (czOpen) { CZ_UI[czOpen]?.close(); czQ[czOpen] = []; }
  czOpen = want; document.body.classList.toggle('cz-open', !!want);
  if (!want) return;
  const ui = await loadUI(want);
  if (!ui) return toast('이 게임 화면을 불러오지 못했어요');
  if (czOpen === want) { ui.open(SEATS[me.sit]); (czQ[want] ?? []).splice(0).forEach((m) => ui.onMsg(m)); }
}

/* ───────── 미니게임 연결 ───────── */
MG = createMinigames({ scene, players, getMe: () => me, send, toast, place, bubble, refreshTags: () => players.forEach(renderTag), host: $('#hud') });

/* ───────── 가입·로그인 → 아바타 꾸미기 → 입장 ───────── */
let account = null; // { token, nick, avatar }
let prev = null; // 입장 전 화면에서 빙글 도는 미리보기 캐릭터
const PV = [0, 7];
function setPreview(a) {
  if (prev) disposeAvatar(prev);
  prev = buildAvatar(a);
  prev.root.position.set(PV[0], 0, PV[1]); scene.add(prev.root); prev.wave = 1.4;
}
const editor = createEditor($('#ed'), setPreview);
let mode = 'login';
function setMode(m) {
  mode = m;
  document.querySelectorAll('#am button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === m));
  $('#ago').textContent = m === 'login' ? '로그인' : '가입하고 시작';
  $('#nkrow').hidden = m === 'login'; // 가입할 때만 닉네임 칸
  $('#un').placeholder = m === 'login' ? '아이디' : '로그인용 · 영문·숫자·_ 4~16자';
  $('#pw').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('#aerr').textContent = '';
}
document.querySelectorAll('#am button').forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
const showForm = (which) => { $('#af').hidden = which !== 'auth'; $('#jf').hidden = which !== 'edit'; $('#gf').hidden = which !== 'guest'; $('#join').hidden = false; $('#hud').hidden = true; phase = 'join'; };
function showAuth(msg = '') {
  account = null; showForm('auth'); setMode('login'); $('#aerr').textContent = msg;
  setPreview(randomAvatar(Math.random() < 0.5 ? 'm' : 'f'));
}
function showEditor() { showForm('edit'); editor.set(account.avatar || randomAvatar('f')); }
function afterLogin() {
  if (account.avatar && !sessionStorage.getItem('village.edit')) { setPreview(account.avatar); enter(); } else showEditor();
}
function enter() {
  if (coarse) { try { Promise.resolve(document.documentElement.requestFullscreen?.()).then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch {} } // 폰: 전체화면+가로 고정 시도(안 되는 기기는 안내문이 대신함)
  kicked = false; connect();
}
$('#af').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('#un').value.trim(), nick = $('#nk').value.trim(), pw = $('#pw').value, err = (t) => ($('#aerr').textContent = t);
  if (mode === 'signup' && !nick) return err('닉네임을 적어 주세요');
  if (!id || !pw) return err('아이디와 비밀번호를 적어 주세요');
  $('#ago').disabled = true; err('');
  const r = await api(mode, mode === 'signup' ? { id, nick, pw } : { id, pw });
  $('#ago').disabled = false;
  if (!r.ok) return err(r.error);
  account = { token: r.token, nick: r.nick, avatar: r.avatar };
  store.set('village.token', r.token); $('#pw').value = '';
  afterLogin();
};
// 바로 입장(손님): 계정·기록 없이. 성별만 고르면 아바타는 성별에 맞게 랜덤, 닉네임은 서버가 랜덤으로 정함 (welcome 에서 받음)
$('#guestgo').onclick = () => { showForm('guest'); setPreview(randomAvatar(Math.random() < 0.5 ? 'm' : 'f')); };
$('#guestback').onclick = () => showAuth();
$('#gg').onclick = (e) => {
  const g = e.target.closest('button')?.dataset.g; if (!g) return;
  account = { guest: true, g, nick: null, avatar: randomAvatar(g) };
  setPreview(account.avatar); enter();
};
$('#rnd').onclick = () => editor.random();
$('#jf').onsubmit = async (e) => {
  e.preventDefault();
  $('#go').disabled = true;
  const r = await api('avatar', { token: account.token, avatar: editor.get() });
  setTimeout(() => ($('#go').disabled = false), 2500);
  if (!r.ok) return toast(r.error);
  account.avatar = r.avatar; sessionStorage.removeItem('village.edit');
  enter();
};
$('#kb').onclick = () => location.reload();
(async () => { // 처음 열 때: 저장된 로그인이 있으면 바로 이어서
  setPreview(randomAvatar('f')); showForm('auth'); setMode('login');
  const token = store.get('village.token');
  if (token) {
    const r = await api('me', { token });
    if (r.ok) { account = { token, nick: r.nick, avatar: r.avatar }; return afterLogin(); }
    store.del('village.token');
  }
})();

/* ───────── 조작: PC(WASD+드래그), 폰(왼쪽 조이스틱+오른쪽 드래그) ───────── */
// 시점: 먼 뷰(기본) / 일반 뷰(어깨 너머) / 하늘 뷰. 설정에서 바꾸면 기기에 기억됨
const VIEWS = {
  normal: { name: '일반 뷰', desc: '어깨 너머로 가깝게', pitch: 0.26, dist: 5.2, pk: 1.4 },
  far: { name: '먼 뷰', desc: '위에서 넓게 내려다보기', pitch: 0.55, dist: 9, pk: 1.4 },
  sky: { name: '하늘 뷰', desc: '마을이 한눈에 보이게', pitch: 1.0, dist: 15, pk: 1.2 },
};
// 세로 화면(폰 세로)은 좌우가 좁아 같은 거리면 답답해서 pk 배만큼 더 멀리서 봄
for (const v of Object.values(VIEWS)) { const d = v.dist; Object.defineProperty(v, 'dist', { get: () => d * (innerWidth < innerHeight ? v.pk : 1) }); }
let viewId = store.get('village.view2') ? store.get('village.view') : null; // view2: 기본이 먼 뷰로 바뀐 뒤에 직접 고른 것만 기억(예전 저장값은 한 번 무시)
if (!VIEWS[viewId]) viewId = 'far';
let yaw = 0, pitch = VIEWS[viewId].pitch, dist = VIEWS[viewId].dist, tween = null;
let wasPortrait = innerWidth < innerHeight;
addEventListener('resize', () => { const pt = innerWidth < innerHeight; if (pt !== wasPortrait) { wasPortrait = pt; if (!tween) tween = VIEWS[viewId]; } }); // 가로↔세로를 돌리면 그 거리로 부드럽게
function setView(id, save = true) {
  viewId = id; tween = VIEWS[id];
  if (save) { store.set('village.view', id); store.set('village.view2', '1'); }
  document.querySelectorAll('#setMenu [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === id));
}
$('#setMenu').innerHTML = '<div class="hd">📖 도움말</div><button data-a="help"><b>사용방법</b><small>조작과 할 수 있는 것 한눈에</small></button><div class="hd">🎥 시점</div>' + Object.entries(VIEWS).map(([id, v]) => `<button data-v="${id}"><b>${v.name}</b><small>${v.desc}</small></button>`).join('');
// 시간: 실시간(한국 시간) 또는 이 기기에서만 고정. ?t=HH:MM 고정 / ?speed=N 배속은 시험·시연용
const TIME_KEY = 'village.time', qs = new URLSearchParams(location.search);
atmo.clock = makeClock({ t: qs.get('t'), speed: qs.get('speed'), mode: store.get(TIME_KEY) ?? 'live' });
const markTime = () => document.querySelectorAll('#setMenu [data-t]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === (store.get(TIME_KEY) ?? 'live')));
$('#setMenu').insertAdjacentHTML('beforeend', '<div class="hd">🕒 시간 <small>(고정은 이 기기에서만)</small></div><div class="trow">' + Object.entries(MODES).map(([id, name]) => `<button data-t="${id}">${name}</button>`).join('') + '</div>');
$('#setMenu').insertAdjacentHTML('beforeend', '<div class="hd">🎨 그래픽</div>' + Object.entries(LEVELS).map(([id, name]) => `<button data-q="${id}" aria-pressed="${id === Q.level}"><b>${name}</b><small>${{ high: '후처리·그림자·풀 모두 최고로', normal: '폰에 알맞게 (기본)', low: '가볍게: 효과를 줄여 빠르게' }[id]}</small></button>`).join(''));
$('#setMenu').insertAdjacentHTML('beforeend', '<div class="hd">👤 내 계정</div><button data-a="edit"><b>아바타 꾸미기</b><small>모습을 바꿔요</small></button><button data-a="logout"><b>로그아웃</b><small>다른 계정으로 들어갈 때</small></button>');
// 연못 낚시 (fishing.js): 안내·낚싯대·찌·결과·도감. 설정 메뉴에 '낚시 도감'을 넣으므로 메뉴를 다 만든 뒤에 만듦
const FISH = createFishing({ scene, players, getMe: () => me, send, toast, bubble, host: $('#hud'), menu: $('#setMenu'), canPrompt: () => !MG.active() && !me.transit && me.sit < 0 && $('#sitq').hidden });
// 성당·사찰·교회 활동 (rituals.js): 자리 앞 행동 패널·염주·묵주·고해·피아노·찬양·공동 의식·소리. 설정에 '🔊 소리'·'🙏 내 기록'
const RIT = createRituals({ scene, players, getMe: () => me, send, toast, bubble, host: $('#hud'), menu: $('#setMenu'), free: () => !MG.active() && !me.transit && !FISH.busy(), sitq: $('#sitq'), standUp: () => { if (me?.sit >= 0) standUp(); }, walk: (x, z, done) => autoWalk(x, z, false, done) }); // walk: 사찰 '절하기' → 빈 방석까지 자동 걸음
// 불멍 캠프·손으로 그리는 불꽃놀이 (camp.js): 모닥불·여는 시간·'불꽃놀이 할까요?' 패널·그리기 레이어·소리
// 놀이기구 (rides.js): 기구 모양·타기 안내·탄 사람 움직임. 서버 규칙은 rides.js(서버), 약속은 docs/PARK.md
const RIDE = createRides({ scene, camera, Q, players, getMe: () => me, send, toast, bubble, host: $('#hud'), aim: (p, d, y) => { if (y != null) yaw = y; tween = p == null ? VIEWS[viewId] : { pitch: p, dist: d }; } }); // aim: 타는 동안 시점 (null = 원래 시점)
const CMP = createCamp({ scene, camera, renderer, Q, players, getMe: () => me, send, toast, bubble, host: $('#hud'), free: () => !MG.active() && !me.transit && !FISH.busy() && !RIT.acting(), sitq: $('#sitq'), standUp: () => { if (me?.sit >= 0) standUp(); } });
// 배경음악 (bgm.js): 낮·밤·놀이공원·숲길 곡을 구역에 따라 섞음. 설정 '🔊 소리'에 '배경음악' 줄 (효과음 줄 다음)
const BGM = createBgm({ menu: $('#setMenu'), lite: Q.lite });
// 효과음 2단계 (fx.js: 마을·기구·동물원·게임·낚시·카지노 소리, footsteps.js: 발소리) · 반딧불이 (fireflies.js: 숲길·사찰 마당·불멍 공터, 밤에만)
const FX = createFx({ players, getMe: () => me }), STEPS = createFootsteps({ players, getMe: () => me }), FF = createFireflies(scene, Q);
toastSound = () => FX.ui('toast');
$('#setMenu').onclick = async (e) => {
  const b = e.target.closest('[data-v],[data-a],[data-q],[data-t]');
  if (!b) return;
  if (b.dataset.v) return setView(b.dataset.v);
  if (b.dataset.t) { store.set(TIME_KEY, b.dataset.t); atmo.clock = makeClock({ mode: b.dataset.t }); setTimeout(tick, 50); return markTime(); }
  if (b.dataset.q) { store.set(Q_KEY, b.dataset.q); const u = new URL(location.href); u.searchParams.delete('q'); location.replace(u); return; } // 품질은 다시 불러와야 적용됨
  if (b.dataset.a === 'help') { $('#setMenu').hidden = true; $('#help').hidden = false; return; }
  if (b.dataset.a === 'edit') { if (account?.guest) return toast('바로 입장 중에는 아바타를 바꿀 수 없어요. 회원가입하면 꾸밀 수 있어요'); sessionStorage.setItem('village.edit', '1'); location.reload(); }
  else { if (!account?.guest) { await api('logout', { token: account.token }); store.del('village.token'); } location.reload(); }
};
setView(viewId, false);
markTime();
// 폰 ≡ 메뉴 맨 위: 위쪽 칩에서 옮겨 온 것들 (카페·출근·포인트, 내 상태, 접속자, 큰 지도) + ✕
$('#setMenu').insertAdjacentHTML('afterbegin', '<div id="phm"><div class="phd"><b>≡ 메뉴</b><button type="button" data-ph="x" aria-label="닫기">✕</button></div><div class="pls"></div><button data-ph="st"><b class="phst">🙂 내 상태</b><small>한가해요·일하는 중 같은 상태 고르기</small></button><button data-ph="who"><b>👥 접속자 <span class="phn">1</span>명</b><small>목록 · 이름을 누르면 귓속말</small></button><button data-ph="map"><b>🗺️ 큰 지도</b><small>가고 싶은 곳을 누르면 걸어가요 (M)</small></button></div>');
$('#phm').addEventListener('click', (e) => { const a = e.target.closest('[data-ph]')?.dataset.ph; if (a === 'st') toggleMenu('#stMenu'); else if (a === 'who') toggleMenu('#roster'); else if (a) { toggleMenu(); if (a === 'map') MAP.toggle(true); } });
$('#stBtn').insertAdjacentHTML('beforebegin', '<button class="chip" id="clk" aria-label="마을 시각"></button>'); // 시계 칩: 누르면 설정(시간 고르기)
$('#clk').onclick = () => toggleMenu('#setMenu');
$('#help').onclick = (e) => { if (e.target.id === 'help' || e.target.closest('.hd button')) $('#help').hidden = true; }; // ✕ 나 바깥을 누르면 닫힘
function tick() { $('#clk').textContent = clockLabel(atmo.ms, atmo.state.key); }
setInterval(tick, 1000);
const camT = new THREE.Vector3(0, 1.2, 8);
let camShrink = 1; // 1 = 평소 거리, 작을수록 카메라가 캐릭터에 가까움(실내에서 벽에 막힐 때)
const keys = {}, joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 }, look = { id: null, x: 0, y: 0 };
const typing = () => document.activeElement?.tagName === 'INPUT';
// 지도 (minimap.js): 오른쪽 아래 미니맵 + M 키·누르면 큰 지도. 큰 지도가 열리면 누르던 이동 키는 놓은 것으로
const MAP = createMinimap({ root: $('#mm'), host: $('#hud'), menu: $('#setMenu'), players, getMe: () => me, getYaw: () => yaw, getNight: () => atmo.state.night, paths: PATHS, onOpen: () => { Object.keys(keys).forEach((k) => (keys[k] = false)); pathWorker(); }, onPick: (x, z) => autoWalk(x, z), getDest: () => auto?.to }); // 큰 지도를 열면 길 찾기 격자를 미리 만들기 시작
addEventListener('keydown', (e) => {
  if (typing()) { if (e.key === 'Escape') { if (document.activeElement.id === 'ci') setChat(false); else document.activeElement.blur(); } return; }
  if (e.key === 'Escape' && !$('#help').hidden) { $('#help').hidden = true; return; }
  if (phase === 'play' && me && MAP.key(e, !RIT.acting() && !document.body.classList.contains('rt-piano'))) { e.preventDefault(); return; } // M 지도 (열려 있는 동안은 다른 키를 먹음)
  if (e.key === 'Enter' && phase === 'play') { e.preventDefault(); setChat(true); $('#ci').focus(); return; }
  if (phase === 'play' && me && e.code === 'KeyP') { toggleMenu('#poseMenu'); markPose(); return; } // 자세 목록
  if (phase === 'play' && me && !$('#poseMenu').hidden) { // 목록이 열려 있으면 숫자로 고름
    const i = /^Digit[0-9]$/.test(e.code) ? +e.code[5] : -1;
    if (e.key === 'Escape') { $('#poseMenu').hidden = true; return; }
    if (i >= 0 && i <= Object.keys(POSES).length) { e.preventDefault(); setPose(i ? Object.keys(POSES)[i - 1] : ''); return; }
  }
  if (phase === 'play' && me && RIT.key(e)) { e.preventDefault(); return; } // 1·2·3·E 행동, 염주 ↑↓, 피아노 건반
  if (phase === 'play' && me && CMP.key(e)) { e.preventDefault(); return; } // E 불꽃놀이, 그리는 중 Esc
  if (phase === 'play' && me && RIDE.key(e)) { e.preventDefault(); return; } // 놀이기구 타기·내리기
  if (e.code === 'Space' && phase === 'play' && me) { e.preventDefault(); jump(); return; }
  if (e.code === 'KeyF' && phase === 'play' && me) { MG.throwNow(); return; }
  if (e.code === 'KeyE' && phase === 'play' && me) { if (FISH.onE()) return; if (me.sit >= 0) standUp(); else if (sitTarget >= 0) sitDown(); else if (portalNear?.kind === 'stairs') send({ t: 'go', p: portalNear.id }); return; }
  if (e.key === 'Escape' && chatOpen()) { setChat(false); return; } // 다른 Esc(행동 그만·지도 닫기)가 먼저
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Space' && !typing()) e.preventDefault(); }); // 포커스된 버튼이 스페이스로 눌리는 것 방지
$('#jumpBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (me) jump(); });
addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));
document.addEventListener('gesturestart', (e) => e.preventDefault());
const cv = $('#c');
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => { tween = null; dist = Math.max(3.5, Math.min(18, dist + e.deltaY * 0.01)); }, { passive: true });
cv.addEventListener('pointerdown', (e) => {
  if (phase !== 'play') return;
  MENUS.forEach((m) => ($(m).hidden = true));
  cv.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch' && e.clientX < innerWidth / 2 && joy.id === null) {
    Object.assign(joy, { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
    Object.assign($('#joy').style, { left: e.clientX + 'px', top: e.clientY + 'px' });
    $('#joy').hidden = false; $('#joy i').style.transform = '';
  } else if (look.id === null) Object.assign(look, { id: e.pointerId, x: e.clientX, y: e.clientY });
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const l = Math.hypot(dx, dy), R = 55;
    if (l > R) { dx *= R / l; dy *= R / l; }
    joy.dx = dx / R; joy.dy = dy / R;
    $('#joy i').style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === look.id) {
    tween = null; yaw -= (e.clientX - look.x) * 0.006;
    pitch = Math.max(PMIN - TILT, Math.min(PMAX, pitch + (e.clientY - look.y) * 0.005)); // 0.12 아래 = 올려다보기 (camrig.js)
    look.x = e.clientX; look.y = e.clientY;
  }
});
const release = (e) => {
  if (e.pointerId === joy.id) { joy.id = null; joy.dx = joy.dy = 0; joy.run = false; $('#joy').hidden = true; $('#joy').classList.remove('run'); }
  if (e.pointerId === look.id) look.id = null;
};
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);

const SPEED = 5;
function jump() { // 앉아 있으면 일어나기, 땅에 있을 때만 점프 (게임 준비 중엔 못 함)
  if (MG.locked() || me.transit || FISH.busy() || RIDE.busy()) return;
  stopAuto();
  if (me.sit >= 0) return standUp();
  if (me.jy === 0 && me.vy === 0) me.vy = 7.5;
}
function standUp() {
  [me.x, me.z] = standPos(SEATS[me.sit]);
  me.sit = -1; send({ t: 'stand' }); renderTag(me); casinoSync();
}
// 가까운 빈 자리에서 '앉으시겠습니까?', 계단·엘리베이터 앞에서 층 이동을 물어봄 (E 키나 버튼)
let sitTarget = -1, sitKey = '', dismissed = -1, portalNear = null, dismissedPortal = -1;
const SPOT = { cafe: '카페', office: '회사', park: '공원', slot: '슬롯머신', poker: '홀덤 테이블', bj: '블랙잭 테이블', pew: '긴 의자', fire: '불멍 벤치' };
const FL_KO = ['1층 슬롯', '2층 홀덤', '3층 블랙잭'];
function sitUI() {
  const q = $('#sitq');
  if ($('#poseBtn').hidden !== !!MG.active()) $('#poseBtn').hidden = !!MG.active(); // 게임 중엔 자세 버튼 숨김 (폰은 그 자리에 던지기 버튼)
  if (MG.active() || me.transit || FISH.busy() || RIT.owns() || CMP.owns() || CMP.drawing() || RIDE.busy()) { q.hidden = true; sitKey = ''; sitTarget = -1; return; } // 게임·층 이동·행동 중엔 안내 숨김 (의자 행동 패널이 '일어나기'도 맡음)
  let key = '';
  sitTarget = -1; portalNear = null;
  if (me.sit >= 0) key = 'stand';
  else {
    const occ = new Set([...players.values()].map((p) => p.sit));
    let bd = 1.6;
    for (const s of SEATS) {
      if (s.fl !== me.fl) continue;
      const d = Math.hypot(s.x - me.x, s.z - me.z);
      if (d < bd && !occ.has(s.id)) { bd = d; sitTarget = s.id; }
    }
    if (dismissed >= 0 && Math.hypot(SEATS[dismissed].x - me.x, SEATS[dismissed].z - me.z) > 3) dismissed = -1;
    if (sitTarget === dismissed) sitTarget = -1;
    if (sitTarget >= 0) key = 'sit' + sitTarget + (SEATS[sitTarget].kind === 'fire' && !CMP.open() ? 'x' : ''); // 불멍 벤치는 불이 꺼져 있으면 안내만
    else {
      portalNear = PORTALS.find((pt) => pt.fl === me.fl && Math.hypot(pt.x - me.x, pt.z - me.z) < pt.r) ?? null;
      if (dismissedPortal >= 0 && Math.hypot(PORTALS[dismissedPortal].x - me.x, PORTALS[dismissedPortal].z - me.z) > 2.4) dismissedPortal = -1;
      if (portalNear && portalNear.id !== dismissedPortal) key = 'go' + portalNear.id; else portalNear = null;
    }
  }
  if (key === sitKey) return;
  sitKey = key; q.hidden = !key;
  if (key === 'stand') q.innerHTML = '<button data-a="stand">🧍 일어나기</button><small>움직여도 일어나요</small>';
  else if (key.startsWith('go')) {
    const pt = portalNear, up = pt.to > pt.fl;
    q.innerHTML = pt.kind === 'stairs'
      ? `<b>🪜 계단으로 ${up ? '올라' : '내려'}가시겠습니까?</b><small>${FL_KO[pt.to]}</small><div class="bt"><button data-a="go">${up ? '올라가기' : '내려가기'}</button><button data-a="no">아니요</button></div>`
      : `<b>🛗 엘리베이터</b><small>어느 층으로 갈까요?</small><div class="bt">${[0, 1, 2].filter((f) => f !== pt.fl).map((f) => `<button data-a="lift" data-to="${f}">${FL_KO[f]}</button>`).join('')}<button data-a="no">닫기</button></div>`;
  } else if (key) {
    const kind = SEATS[sitTarget].kind, [em, label] = STATUS[SIT_STATUS[kind]];
    q.innerHTML = key.endsWith('x') ? '<b>🔥 지금은 불이 꺼져 있어요</b><small>불멍 벤치 · 매일 오후 7시~오전 6시에 열려요</small><div class="bt"><button data-a="no">닫기</button></div>' : `<b>🪑 앉으시겠습니까?</b><small>${SPOT[kind]} · ${em} ${label}</small><div class="bt"><button data-a="yes">앉기</button><button data-a="no">아니요</button></div>`;
  }
}
const sitDown = () => sitTarget >= 0 && send({ t: 'sit', seat: sitTarget });
$('#sitq').onclick = (e) => {
  const b = e.target.closest('button'), a = b?.dataset.a;
  if (a === 'yes') sitDown();
  else if (a === 'no') { dismissed = sitTarget; dismissedPortal = portalNear?.id ?? -1; sitKey = ''; }
  else if (a === 'stand') standUp();
  else if (a === 'go') send({ t: 'go', p: portalNear.id });
  else if (a === 'lift') send({ t: 'go', p: portalNear.id, to: +b.dataset.to });
};
/* ───────── 자동 걸음: 큰 지도에서 누른 곳까지 길을 찾아 걸어감 ─────────
   길 찾기는 Web Worker(pathfind-worker.js, 봇과 같은 격자·A*)가 화면 밖에서 → 걷기는 아래 control() 의 같은 이동·충돌·위치 보내기를 그대로 탐(키를 누른 것과 똑같이 보임)
   멈춤: 손으로 움직이기·점프·앉기·타기·낚시·행동·게임·서버가 옮김·도착·끼임 */
let pfw = null, pfReady = false, pfId = 0, auto = null; // auto = { to(목적지), want(누른 곳), path?, i(다음 점), chk(1.5초 확인), n(연달아 막힌 수) }
function pathWorker() {
  if (pfw) return pfw;
  try { pfw = new Worker(new URL('./pathfind-worker.js', import.meta.url), { type: 'module' }); } catch { return null; }
  pfw.onmessage = ({ data: m }) => {
    if (m.ready) { pfReady = true; window.__village.pathBuildMs = m.buildMs; return; }
    if (!auto || m.id !== pfId || !me) return; // 그 사이 취소했거나 새 목적지를 누름
    if (!m.path) return stopAuto('그곳까지 걸어갈 길이 없어요');
    if (auto.done) return Object.assign(auto, { path: Math.hypot(m.to[0] - auto.want[0], m.to[1] - auto.want[1]) > 0.05 ? [...m.path, auto.want] : m.path, i: 1, chk: null }); // 방석처럼 그 점까지 가야 하면 마지막은 곧게
    if (!auto.told && Math.hypot(m.to[0] - auto.want[0], m.to[1] - auto.want[1]) > 3) { auto.told = 1; toast('들어갈 수 없는 곳이라 가장 가까운 곳까지 갈게요'); }
    Object.assign(auto, { to: m.to, path: m.path, i: 1, chk: null });
  };
  pfw.onerror = () => { pfw = null; stopAuto('자동 걸음을 쓸 수 없어요'); };
  return pfw;
}
function autoWalk(x, z, again, done) { // done: 도착하면 부를 일 (있으면 0.25m 까지 바짝 다가감, '도착했어요' 알림 없음)
  if (!me) return;
  if (MG.active() || RIDE.busy() || me.transit || RIT.acting() || CMP.drawing()) return toast('지금은 자동 걸음을 쓸 수 없어요');
  if (me.fl) return toast('위층에서는 자동 걸음이 안 돼요 · 1층에서 써 주세요'); // 지도는 1층 땅만 보여 줌
  const w = pathWorker();
  if (!w) return toast('자동 걸음을 쓸 수 없어요');
  if (me.sit >= 0) standUp();
  if (FISH.busy()) FISH.cancel();
  if (!again) auto = { to: [x, z], want: [x, z], done, near: done ? 0.25 : 0.6 }; // 걷는 중에 새 곳을 누르면 바꿈
  $('#autoBar').hidden = false;
  w.postMessage({ id: ++pfId, x0: me.x, z0: me.z, x1: x, z1: z });
  if (!pfReady && !again) toast('길을 찾는 중이에요…');
}
function stopAuto(msg) { if (!auto) return; auto = null; pfId++; $('#autoBar').hidden = true; if (msg) toast(msg); }
$('#autoBar button').onclick = () => stopAuto();
// 이번 프레임에 걸어갈 방향 [x, z, 달리기] (길을 기다리는 중이면 null). 1.5초마다 얼마나 갔나 봐서 막히면 길 다시 찾기 → 그래도 막히면 포기
function autoStep() {
  const P = auto.path, now = performance.now();
  if (!P) return null;
  while (auto.i < P.length - 1 && Math.hypot(P[auto.i][0] - me.x, P[auto.i][1] - me.z) < 1.2) auto.i++;
  const end = P.at(-1), left = Math.hypot(end[0] - me.x, end[1] - me.z), arrive = () => { const f = auto.done; stopAuto(f ? null : '📍 도착했어요'); if (f) { me.walking = false; sendPos(); f(); } }; // 도착 위치를 먼저 보내야 서버가 다음 위치를 '움직임'으로 보지 않음 (절이 바로 취소되지 않게)
  if (left < auto.near) return arrive(), null;
  if (!auto.chk) auto.chk = { t: now, x: me.x, z: me.z };
  else if (now - auto.chk.t > 1500) {
    auto.n = Math.hypot(me.x - auto.chk.x, me.z - auto.chk.z) < 1 ? (auto.n || 0) + 1 : 0;
    if (auto.n && left < 2.5) return arrive(), null; // 목적지 바로 앞 가구·물가에 막힘 = 다 왔음
    if (auto.n >= 3) return stopAuto('길이 막혀서 자동 걸음을 멈췄어요'), null;
    auto.chk = { t: now, x: me.x, z: me.z };
    if (auto.n === 1) { auto.path = null; autoWalk(...auto.to, true); return null; } // 한 번 막히면 지금 자리에서 길 다시 찾기
  }
  let rest = Math.hypot(P[auto.i][0] - me.x, P[auto.i][1] - me.z);
  for (let k = auto.i; k < P.length - 1; k++) rest += Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]);
  const dx = P[auto.i][0] - me.x, dz = P[auto.i][1] - me.z, d = Math.hypot(dx, dz) || 1;
  return [dx / d, dz / d, rest > 50]; // 멀면(50m 넘게 남음) Shift 처럼 달리다가 가까워지면 걷기
}
function sendPos() { // 내 위치 보내기 (바뀌었을 때만)
  const s = `${me.x.toFixed(2)},${me.z.toFixed(2)},${me.ry.toFixed(2)},${me.walking ? 1 : 0},${me.jy.toFixed(2)}`;
  if (s !== lastSent) { lastSent = s; send({ t: 'm', x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), w: me.walking ? 1 : 0, y: +me.jy.toFixed(2) }); }
}
function control(dt) {
  if (!me) return;
  let ix = joy.dx, iy = -joy.dy;
  if (!typing()) {
    ix += (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    iy += (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  }
  if (auto && (Math.hypot(ix, iy) > 0.12 || me.sit >= 0 || FISH.busy() || RIDE.busy() || RIT.acting() || MG.active() || me.transit || me.fl)) stopAuto(); // 손으로 움직이거나 다른 걸 시작하면 멈춤
  const ad = auto && autoStep();
  if (FISH.busy()) { if (Math.hypot(ix, iy) > 0.12) FISH.cancel(); else ix = iy = 0; } // 낚시 중엔 제자리, 움직이려 하면 그만둠
  if (RIDE.busy()) { RIDE.drive(ix, iy); ix = iy = 0; } // 놀이기구 타는 중엔 걷지 않음 — 같은 입력이 범퍼카 운전·찻잔 빠르기 (내리기·조작은 rides.js 가 맡음)
  if (me.jy > 0 || me.vy > 0) { // 점프: 위로 튀었다가 중력으로 내려옴
    me.vy -= 22 * dt; me.jy += me.vy * dt;
    if (me.jy <= 0) me.jy = me.vy = 0;
  }
  const mag = MG.locked() || me.transit ? 0 : ad ? 1 : Math.min(1, Math.hypot(ix, iy)), seat = me.sit >= 0 ? SEATS[me.sit] : null;
  if (me.pose && (mag > 0.12 || me.vy > 0)) { me.pose = ''; markPose(); send({ t: 'pose', p: '' }); } // 움직이거나 점프하면 자세가 풀림
  if (seat && mag > 0.12) standUp(); // 앉아 있다가 움직이면 일어남
  else if (seat) { // 자리로 스르륵 들어가 앉아서 가만히
    const q = 1 - Math.exp(-dt * 12);
    me.x = lerp(me.x, seat.x, q); me.z = lerp(me.z, seat.z, q);
    me.tr = seat.ry; me.ry = lerpAng(me.ry, seat.ry, q); me.walking = false;
    return;
  }
  me.walking = mag > 0.12;
  if (me.walking) {
    let mx = Math.cos(yaw) * ix - Math.sin(yaw) * iy, mz = -Math.sin(yaw) * ix - Math.cos(yaw) * iy;
    if (ad) { [mx, mz] = ad; if (look.id === null) yaw = lerpAng(yaw, Math.atan2(-mx, -mz), 1 - Math.exp(-dt * 1.2)); } // 자동 걸음: 카메라가 천천히 아바타 뒤로 (끌어서 둘러보는 중엔 그대로)
    const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    if (joy.id !== null) { joy.run = mag >= (joy.run ? 0.7 : 0.88); $('#joy').classList.toggle('run', joy.run); } // 조이스틱을 끝까지 밀면 뜀 (살짝 풀어도 유지되게 0.88 에서 켜고 0.7 아래에서 꺼짐)
    const jr = joy.id !== null && !ad && joy.run;
    const sp = SPEED * (keys.ShiftLeft || keys.ShiftRight || ad?.[2] || jr ? 1.6 : 1) * (joy.id !== null && !ad && !jr ? Math.max(0.5, mag) : 1) * dt;
    [me.x, me.z] = MG.clamp(...resolve(me.x + mx * sp, me.z + mz * sp, 0.4, me.fl)); // 피구 중엔 자기 진영 안
    me.tr = Math.atan2(mx, mz);
  }
  me.ry = lerpAng(me.ry, me.tr, 1 - Math.exp(-dt * 14));
  sendT += dt;
  if (sendT > 0.08) { sendT = 0; sendPos(); }
  if (!me.pl || me.pl !== placeOf(me.x, me.z)) me.pl = placeOf(me.x, me.z);
}

/* ───────── 매 프레임 ───────── */
const v = new THREE.Vector3();
// 사람이 많을 때(봇 약 80명) 거리별로: 진짜 아바타(near) · 간단한 군중 모양(far) · 이름표(tag). 낮음 품질은 더 줄임
// 진짜 아바타는 near 안에서도 가까운 순서로 max 명까지만 (한 명 = 약 2만 삼각형·그림자 포함 25번쯤 그리기)
const LOD = { high: { near: 40, max: 10, far: 120, tag: 45 }, normal: { near: 30, max: 5, far: 110, tag: 45 }, low: { near: 20, max: 4, far: 85, tag: 32 } }[Q.level];
const TAG_ON = 2, TAG_OFF = 3; // 다른 사람의 이름표·말풍선이 보이는 거리(m): 2m 안에서 켜지고 3m 밖에서 꺼짐
const dists = [], fwd = new THREE.Vector3();
const crowd = createCrowd(scene);
function place(el, x, y, z, maxD) {
  v.set(x, y, z);
  const d = v.distanceTo(camera.position);
  v.project(camera);
  if (v.z > 1 || d > maxD) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.style.transform = `translate(${((v.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px,${((-v.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px) translate(-50%,-100%)`;
}
// 성당·교회·사찰 정면 앞에서 건물 쪽을 보면 시선을 살짝 들어 올려다보게 (가까울수록)
let lookUp = 0;
function facadeLift(x, z) {
  let best = 0;
  for (const f of FACADES) {
    const vx = f.x - x, vz = f.z - z, d = Math.hypot(vx, vz);
    if (d < 1 || vx * f.nx + vz * f.nz > 0) continue; // 건물 앞(바깥)에 있을 때만
    const face = (-Math.sin(yaw) * vx - Math.cos(yaw) * vz) / d, k = Math.max(0, Math.min(1, (face - 0.55) / 0.35)) * Math.max(0, Math.min(1, (95 - d) / 60));
    best = Math.max(best, k * 2.1 * Math.min(1, innerHeight / 720)); // 화면이 낮으면(폰 가로) 덜 들어 아바타가 UI 에 안 가리게 // 아바타가 화면 아래에 남도록 수평선 위 약 13°까지만
  }
  return best;
}
const clock = new THREE.Clock();
let T = 0;
renderer.setAnimationLoop(() => {
  const t0 = performance.now(), raw = clock.getDelta(), dt = Math.min(raw, 0.05);
  T += dt;
  const k = 1 - Math.exp(-dt * 12);
  let inKey = null; // 내가 들어와 있는 건물

  if (phase === 'join') {
    const a = Math.sin(T * 0.45) * 0.9;
    const side = innerWidth > innerHeight * 1.2 && innerHeight < 560;
    if (side !== joinSide) { joinSide = side; side ? camera.setViewOffset(innerWidth, innerHeight, innerWidth * 0.2, 0, innerWidth, innerHeight) : camera.clearViewOffset(); }
    const r = camera.aspect < 1 ? 7 : 5;
    camera.position.set(PV[0] + Math.sin(a) * r, 1.7, PV[1] + Math.cos(a) * r);
    camera.lookAt(PV[0], camera.aspect < 1 ? -0.9 : side ? 0.5 : -0.45, PV[1]); // 아래 카드에 안 가리게 캐릭터를 위로 올림
    if (prev) { animate(prev, dt, false, 'free'); if (Math.random() < dt / 4) prev.wave = 1.2; }
    atmo.follow(PV[0], 0, PV[1]);
  } else {
    RIDE.update(dt); // 놀이기구: 탄 사람 자리를 먼저 정함 (내 위치·카메라·아바타가 같은 프레임에 따라감)
    control(dt);
    if (me) sitUI();
    if (me) camT.lerp(v.set(me.x, 1.2 + me.gy, me.z), 1 - Math.exp(-dt * 10));
    if (tween) { // 시점을 바꾸면 부드럽게 이동
      const q = 1 - Math.exp(-dt * 6);
      pitch = lerp(pitch, tween.pitch, q); dist = lerp(dist, tween.dist, q);
      if (Math.abs(pitch - tween.pitch) < 0.005 && Math.abs(dist - tween.dist) < 0.02) tween = null;
    }
    const rig = camRig([camT.x, camT.y, camT.z], yaw, pitch, dist, (x, z) => (me ? me.fl * FLOOR_H + floorY(x, z) : 0), (camera.fov * Math.PI) / 360); // 위로 더 끌면 아바타 뒤 낮은 곳에서 하늘을 올려다봄
    camera.position.set(...rig.pos);
    // 건물 안에 들어서면 카메라도 방 안에서 따라옴: 벽·천장 밖으로 안 나가고, 문턱을 넘을 땐 부드럽게 바뀜
    let ft = 1;
    inKey = me ? Object.keys(BUILDINGS).find((key) => inside(BUILDINGS[key], me.x, me.z)) ?? null : null;
    if (inKey) {
      const b = BUILDINGS[inKey], top = inKey === 'casino' ? (Math.floor((me.gy + 0.3) / FLOOR_H) + 1) * FLOOR_H : b.h;
      const lo = [b.cx - b.w / 2 + 0.35, me.gy + 0.35, b.cz - b.d / 2 + 0.35], hi = [b.cx + b.w / 2 - 0.35, top - 0.95, b.cz + b.d / 2 - 0.35]; // 천장·조명에 너무 붙지 않게
      const P = [camT.x, camT.y, camT.z], Q = [camera.position.x, camera.position.y, camera.position.z];
      for (let a = 0; a < 3; a++) { const d = Q[a] - P[a]; if (d > 1e-6 && Q[a] > hi[a]) ft = Math.min(ft, (hi[a] - P[a]) / d); else if (d < -1e-6 && Q[a] < lo[a]) ft = Math.min(ft, (lo[a] - P[a]) / d); }
      ft = Math.max(ft, Math.min(1, 1.7 / Math.hypot(Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]))); // 너무 가까워지진 않게
    }
    camShrink = lerp(camShrink, ft, 1 - Math.exp(-dt * 8));
    camera.position.lerpVectors(camT, camera.position, camShrink);
    const sacredIn = inKey && BUILDINGS[inKey].fy; // 성당·교회·사찰 안: 높은 천장·제대 쪽으로 시선을 들어 올림 (절·기도 중엔 내 동작이 보이게 조금만)
    lookUp = lerp(lookUp, me && pitch < 0.5 && !rig.tilt ? (sacredIn ? (RIT.acting() ? 0.4 : 2.6) : inKey ? 0 : facadeLift(me.x, me.z)) : 0, 1 - Math.exp(-dt * 2.5));
    const lk = Math.min(1, rig.tilt * 5), lx = rig.look[0] + (camera.position.x - rig.pos[0]) * lk, ly = rig.look[1] + (camera.position.y - rig.pos[1]) * lk, lz = rig.look[2] + (camera.position.z - rig.pos[2]) * lk; // 올려다볼 땐 벽에 막혀 당겨져도 시선 방향 그대로
    camera.lookAt(lx, ly + lookUp * Math.min(1, camera.position.distanceTo(camT) / 5.2), lz); // 카메라가 벽에 막혀 가까워지면 덜 올려다봄
    const fc = window.__village?.freeCam; if (fc) { camera.position.set(...fc.pos); camera.lookAt(...fc.look); } // 시험용 자유 시점 (스크린샷)
    atmo.follow(camT.x, camT.y, camT.z);
  }

  const inC = phase === 'play' && me && inside(BUILDINGS.casino, me.x, me.z), now = performance.now(), cp = camera.position;
  crowd.begin();
  dists.length = 0;
  camera.getWorldDirection(fwd);
  for (const p of players.values()) if (p !== me) dists.push((p.camD = Math.hypot(p.x - cp.x, p.z - cp.z) + ((p.x - cp.x) * fwd.x + (p.z - cp.z) * fwd.z < -2 ? 1e3 : 0))); // 카메라 뒤 사람은 안 그림 (자리도 앞사람에게 양보)
  const cut = Math.min(LOD.near, dists.length > LOD.max ? dists.sort((a, b) => a - b)[LOD.max - 1] : Infinity);
  for (const p of players.values()) {
    if (p.transit) { // 계단·엘리베이터로 이동 중: 정해진 길을 따라 가고, 끝나면 도착 층이 됨
      const { pt, to, t0, dur } = p.transit, u = Math.min(1, (now - t0) / dur), r = transitAt(pt, to, u);
      Object.assign(p, { x: r.x, z: r.z, tx: r.x, tz: r.z, gy: r.y, walking: r.walking });
      if (r.walking) p.tr = p.ry = pt.ez > pt.z ? 0 : Math.PI;
      if (u >= 1) { p.fl = to; p.transit = null; }
    } else if (!p.ride) p.gy = lerp(p.gy, p.fl * FLOOR_H + floorY(p.x, p.z), k); // 계단·축대 위로 오르내림 (놀이기구 탄 사람은 rides.js 가 높이를 정함)
    if (p !== me) {
      p.x = lerp(p.x, p.tx, k); p.z = lerp(p.z, p.tz, k); p.ry = lerpAng(p.ry, p.tr, k);
      p.walking = Math.hypot(p.tx - p.x, p.tz - p.z) > 0.05;
      p.jy = lerp(p.jy, p.ty, k);
    }
    p.av.jy = p.jy; p.av.gy = p.gy;
    p.av.root.position.x = p.x; p.av.root.position.z = p.z; p.av.root.rotation.y = p.ry;
    const hide = inC && p !== me && Math.abs(p.gy - me.gy) > 1.8; // 카지노에서 다른 층 사람은 천장·바닥에 가려 안 보임
    const d = p === me ? 0 : p.camD, full = !hide && d <= cut; // 가까운 사람만 진짜 아바타 + 동작, 멀면 간단한 모양, 아주 멀면 안 그림
    p.av.pose = p.pose;
    if (full) animate(p.av, dt, p.walking, p.s, p.sit >= 0 ? SEATS[p.sit] : p.ride || MG.sitFor(p)); // 피구 탈락자는 주저앉음, 놀이기구는 그 자리에 앉음
    else { p.av.root.position.y = p.gy + p.jy; if (!hide && d < LOD.far) crowd.add(p.a, p.x, p.av.root.position.y - (p.sit >= 0 || p.ride ? 0.25 : 0), p.z, p.ry); }
    p.av.root.visible = full;
    // 이름·상태·말풍선은 내 아바타와 가까울 때만 (사람이 많아도 어지럽지 않게). 경계에서 깜빡이지 않게 켜질 땐 TAG_ON, 꺼질 땐 TAG_OFF
    if (p !== me) { const dn = Math.hypot(p.x - me.x, p.z - me.z); p.tagOn = dn <= (p.tagOn ? TAG_OFF : TAG_ON); }
    if (hide || (p !== me && !p.tagOn)) p.el.style.display = 'none'; else place(p.el, p.x, 2.15 + p.av.root.position.y, p.z, LOD.tag);
    p.el.classList.toggle('me', p === me);
  }

  crowd.end();
  casino.npcs.forEach((n) => animate(n, dt, false, 'free'));
  // 카지노 2·3층은 안에 있거나 가까울 때만 그림 (밖에선 벽·지붕에 가려 안 보임 → 그리기 호출 절약)
  casino.floors[1].visible = casino.floors[2].visible = inKey === 'casino' || Math.hypot(camera.position.x - BUILDINGS.casino.cx, camera.position.z - BUILDINGS.casino.cz) < 16;
  // 실내 소품은 건물 벽에서 10m 안쪽일 때만 (멀리선 문틈으로도 거의 안 보임)
  interiors.casino = casino.floors[0];
  for (const key in interiors) { const b = BUILDINGS[key]; interiors[key].visible = inKey === key || Math.max(Math.abs(camera.position.x - b.cx) - b.w / 2, Math.abs(camera.position.z - b.cz) - b.d / 2) < (b.fy ? 45 : 10); } // 3배 건물은 큰 문으로 안이 멀리서도 보임
  for (const p of players.values()) if (p.transit?.pt.kind === 'lift') casino.cabY = p.gy; // 엘리베이터 칸은 탄 사람을 따라 움직임
  if (casino.cab) casino.cab.position.y = casino.cabY;
  // 건물 안은 진짜 실내: 벽·천장은 그대로 보이고, 이름표 안내판만 숨김 (실내 조명은 atmo.update 가 올림)
  for (const key in BLD) place(BLD[key].label, BUILDINGS[key].cx, BUILDINGS[key].h + 3.8, BUILDINGS[key].cz, inKey === key ? 0 : 70);

  MG.update(dt, T, camera);
  FISH.update(dt, T);
  RIT.update(dt);
  CMP.update(dt);
  FF.update(dt, camera, renderer, atmo.state.night);
  BGM.update(dt, { night: atmo.state.night, x: me?.x, z: me?.z, pl: me?.pl, inKey, glow: FF.glow });
  FX.update(dt, { camera, night: atmo.state.night, inKey }); STEPS.update(dt);
  outdoors.park.update(dt, camera); outdoors.zoo.update(dt, camera);
  if (phase === 'play') MAP.draw(now); // 15번/초만 다시 그림
  U.time.value = T;
  atmo.update(dt, camera, inKey);
  outdoors.water.update(dt, T);
  outdoors.life.setNight(atmo.state.night, inKey);
  renderer.info.reset();
  post.render(dt);
  perfTick(raw, t0);
});
// 성능 기록(디버그): 1초마다 평균 프레임 간격·CPU 시간·그리기 호출·삼각형
const perf = { fps: 0, ms: 0, cpu: 0, calls: 0, tris: 0, n: 0, acc: 0, cpuAcc: 0 };
function perfTick(raw, t0) {
  perf.n++; perf.acc += raw; perf.cpuAcc += performance.now() - t0;
  if (perf.acc < 1) return;
  Object.assign(perf, { fps: +(perf.n / perf.acc).toFixed(1), ms: +((perf.acc / perf.n) * 1000).toFixed(1), cpu: +(perf.cpuAcc / perf.n).toFixed(2), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, n: 0, acc: 0, cpuAcc: 0 });
}
window.__village = { players, get me() { return me; }, get auto() { return auto; }, autoWalk, map: MAP, bgm: BGM, fx: FX, fireflies: FF, camera, scene, renderer, post, quality: Q, perf, atmo, makeClock, cam: (y, p = pitch, d = dist) => { yaw = y; pitch = p; dist = d; tween = null; } }; // 시험·디버깅용 (cam = 시점 돌리기)
