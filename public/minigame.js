// 미니게임 화면: 경기장·참가 패드 그리기, 안내판(HUD), 물풍선, 역할 표시. 규칙은 서버(games.js)가 심판.
import * as THREE from 'three';
import { TAG, DODGE, GAMES, TAG_HEDGES, TAG_CRATES, TAG_PILLARS, fenceRects, dodgeClamp } from './world.js';
import { toon } from './avatar.js';
import { soft, Batch, boxUV } from './gfx.js';
import { woodTex, stoneTex, shingleTex, mowTex, courtTex } from './textures.js';

const NAME = { tag: '🏃 술래잡기', dodge: '💦 물풍선 피구' };
const TEAM = ['파랑', '빨강'], TEAM_C = ['#4dabf7', '#ff6b6b'];
const TOUCH = matchMedia('(pointer:coarse)').matches;
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function createMinigames({ scene, players, getMe, send, toast, place, bubble, refreshTags, host }) {
  const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };
  const bar = host.appendChild($('<div id="gbar"></div>'));
  const res = host.appendChild($('<div id="gres" class="panel" hidden></div>'));
  const throwBtn = host.appendChild($('<button id="throwBtn" hidden>💦<br>던지기</button>'));
  const labels = [];

  /* ── 월드: 경기장과 패드 ── */
  const M = (geo, color, pos, o = {}) => {
    const m = new THREE.Mesh(geo, typeof color === 'string' ? toon(color, o.mat) : color);
    m.position.set(...pos); if (o.rot) m.rotation.set(...o.rot);
    m.castShadow = o.cast ?? true; m.receiveShadow = true; scene.add(m); return m;
  };
  const FLAT = [-Math.PI / 2, 0, 0];
  const board = (text, bg) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, 504, 152, 40); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 76px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 84);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.875), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  };
  const pads = {};
  function buildPad(G, color, title, signColor) {
    const ring = M(new THREE.RingGeometry(G.pad.r - 0.25, G.pad.r, 48), color, [G.pad.x, 0.05, G.pad.z], { rot: FLAT, cast: false, mat: { transparent: true, opacity: 0.9, emissive: new THREE.Color(color), emissiveIntensity: 0.4 } });
    const disc = M(new THREE.CircleGeometry(G.pad.r - 0.25, 48), color, [G.pad.x, 0.04, G.pad.z], { rot: FLAT, cast: false, mat: { transparent: true, opacity: 0.28 } });
    M(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), '#b07a52', [G.pad.x, 1.1, G.pad.z - G.pad.r - 0.6]);
    const s = board(title, signColor); s.position.set(G.pad.x, 2.4, G.pad.z - G.pad.r - 0.52); scene.add(s);
    const label = document.createElement('div'); label.className = 'bld'; document.body.querySelector('#tags').append(label);
    labels.push({ el: label, x: G.pad.x, z: G.pad.z });
    pads[G.id] = { ring, disc, label };
  }

  // 경기장 꾸밈(충돌은 world.js 그대로): 나무 판자 울타리·둥글둥글 산울타리·나무 상자·돌기둥. 재질별로 합쳐 그림
  const B = new Batch();
  const fence = (G) => {
    for (const r of fenceRects(G)) {
      const w = r[2] - r[0], d = r[3] - r[1], cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, long = Math.max(w, d), alongX = w > d;
      B.add('wood', boxUV(w, 0.95, d, 0.9), { pos: [cx, 0.475, cz], color: '#fff1dc' });
      B.add('wood', boxUV(w + 0.06, 0.1, d + 0.06, 0.9), { pos: [cx, 0.98, cz], color: '#f2d7b4' });
      for (let t = -long / 2; t <= long / 2 + 0.01; t += long / Math.max(1, Math.round(long / 2.5))) { // 기둥 + 둥근 머리
        const px = alongX ? cx + t : cx, pz = alongX ? cz : cz + t;
        B.add('wood', boxUV(0.36, 1.15, 0.36, 0.6), { pos: [px, 0.575, pz], color: '#ffffff' });
        B.add('plain', new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { pos: [px, 1.15, pz], color: '#ffd6a8' });
      }
    }
  };
  // 술래잡기장: 깎은 잔디 줄무늬 바닥
  const mow = mowTex();
  const tagFloor = new THREE.PlaneGeometry(TAG.hw * 2, TAG.hd * 2), tuv = tagFloor.attributes.uv;
  for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * TAG.hw / 2, tuv.getY(i) * TAG.hd / 4);
  M(tagFloor, soft('#ffffff', { map: mow }), [TAG.cx, 0.03, TAG.cz], { rot: FLAT, cast: false });
  fence(TAG);
  for (const r of TAG_HEDGES) { // 산울타리: 진한 속 + 위·옆에 동글동글 잎 덩어리
    const w = r[2] - r[0], d = r[3] - r[1], cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, alongX = w > d, long = Math.max(w, d);
    B.add('leaf', new THREE.BoxGeometry(w - 0.1, 1.3, d - 0.1), { pos: [cx, 0.65, cz], color: '#4f9e5c' });
    for (let t = -long / 2 + 0.4; t <= long / 2 - 0.39; t += 0.55) for (const [dy, sc] of [[1.2, 0.56], [0.55, 0.5]]) {
      const k = Math.sin(t * 7 + cx) * 0.06;
      B.add('leaf', new THREE.SphereGeometry(1, 10, 8), { pos: [alongX ? cx + t : cx, dy + k, alongX ? cz : cz + t], s: [sc, sc * 0.85, sc], color: dy > 1 ? '#7fcf72' : '#68bb68' });
    }
  }
  for (const r of TAG_CRATES) { // 나무 상자: 판자 + 테두리 + 대각 버팀목
    const w = r[2] - r[0], d = r[3] - r[1], cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, h = 1.3;
    B.add('wood', boxUV(w - 0.04, h - 0.04, d - 0.04, 0.7), { pos: [cx, h / 2, cz], color: '#e0a868' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add('wood', boxUV(0.14, h, 0.14, 0.7), { pos: [cx + sx * (w / 2 - 0.05), h / 2, cz + sz * (d / 2 - 0.05)], color: '#b97a48' });
    for (const y of [0.07, h - 0.07]) { B.add('wood', boxUV(w + 0.02, 0.14, 0.14, 0.7), { pos: [cx, y, cz - d / 2 + 0.05], color: '#b97a48' }); B.add('wood', boxUV(w + 0.02, 0.14, 0.14, 0.7), { pos: [cx, y, cz + d / 2 - 0.05], color: '#b97a48' }); B.add('wood', boxUV(0.14, 0.14, d, 0.7), { pos: [cx - w / 2 + 0.05, y, cz], color: '#b97a48' }); B.add('wood', boxUV(0.14, 0.14, d, 0.7), { pos: [cx + w / 2 - 0.05, y, cz], color: '#b97a48' }); }
    const diag = Math.hypot(w, h) - 0.25, a = Math.atan2(h, w);
    for (const sz of [-1, 1]) B.add('wood', boxUV(diag, 0.12, 0.06, 0.7), { pos: [cx, h / 2, cz + sz * (d / 2 + 0.01)], rot: [0, 0, sz * a], color: '#c48852' });
  }
  for (const p of TAG_PILLARS) {
    B.add('stone', new THREE.CylinderGeometry(p.r, p.r + 0.05, 2.4, 16), { pos: [p.x, 1.2, p.z], color: '#f1e8dc' });
    B.add('stone', new THREE.CylinderGeometry(p.r + 0.12, p.r + 0.12, 0.2, 16), { pos: [p.x, 2.35, p.z], color: '#e6dccd' });
    B.add('roof', new THREE.ConeGeometry(p.r + 0.32, 0.75, 16), { pos: [p.x, 2.82, p.z], color: '#ef7b62' });
    B.add('plain', new THREE.SphereGeometry(0.11, 10, 8), { pos: [p.x, 3.25, p.z], color: '#ffd45a' });
  }
  buildPad(TAG, '#7ee787', '🏃 술래잡기', '#3f9a5a');

  // 피구장: 파랑/빨강 진영·흰 선이 그려진 바닥 한 장
  const D = DODGE;
  M(new THREE.PlaneGeometry(D.hw * 2, D.hd * 2), soft('#ffffff', { map: courtTex(D.hw * 2, D.hd * 2) }), [D.cx, 0.03, D.cz], { rot: FLAT, cast: false });
  fence(D);
  for (const s of [-1, 1]) for (const z of [-2, 0, 2]) M(new THREE.SphereGeometry(0.22, 12, 10), TEAM_C[s < 0 ? 0 : 1], [D.cx + s * 0.9, 0.22, D.cz + z], { cast: false }); // 가운데 선 옆 물풍선 장식
  buildPad(D, '#ffd43b', '💦 물풍선 피구', '#3d8fe0');
  B.build(scene, {
    wood: soft('#ffffff', { vertexColors: true, map: woodTex() }), stone: soft('#ffffff', { vertexColors: true, map: stoneTex() }),
    roof: soft('#ffffff', { vertexColors: true, map: shingleTex() }), plain: soft('#ffffff', { vertexColors: true }), leaf: soft('#ffffff', { vertexColors: true }),
  });

  /* ── 상태 ── */
  const lob = {};
  let G = null; // 진행 중인 게임 {g, ph, readyEnd, until, parts: Map(id → {role|team,hp,out})}
  const parts = (m) => new Map(m.parts.map((r) => (m.g === 'tag' ? [r[0], { role: r[1] }] : [r[0], { team: r[1], hp: r[2], out: !!r[3] }])));
  const part = (id) => G?.parts.get(id);
  const mine = () => { const me = getMe(); return me && part(me.id); };

  /* ── 물풍선과 물방울 ── */
  const balloons = new Map(), drops = [];
  function addBalloon(m) {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), toon(TEAM_C[m.team], { transparent: true, opacity: 0.9 }));
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' })); hl.position.set(0.09, 0.1, 0.12);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 6), toon(TEAM_C[m.team])); tip.position.set(0, -0.25, 0); tip.rotation.x = Math.PI; // 풍선 꼭지
    g.add(body, hl, tip);
    scene.add(g);
    balloons.set(m.id, { g, m, age: 0 });
  }
  function splash(x, z, team) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4, v = 1.5 + Math.random() * 2;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), toon(TEAM_C[team], { transparent: true, opacity: 0.9 }));
      mesh.position.set(x, 1.0, z); scene.add(mesh);
      drops.push({ mesh, vx: Math.sin(a) * v, vz: Math.cos(a) * v, vy: 2 + Math.random() * 2.5, life: 0.7 });
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 24), new THREE.MeshBasicMaterial({ color: TEAM_C[team], transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.07, z); scene.add(ring);
    drops.push({ mesh: ring, ring: true, life: 0.5, max: 0.5 });
  }

  /* ── 안내판 ── */
  function render() {
    const me = getMe(), t = Date.now(), lines = [];
    for (const id of Object.keys(GAMES)) {
      const l = lob[id], P = pads[id];
      if (!l) continue;
      const txt = l.busy ? `${NAME[id]} 진행 중` : l.n ? (l.cd ? `${NAME[id]} ${l.n}/${l.max}명 · ${l.cd}초 뒤 시작!` : `${NAME[id]} ${l.n}/${l.min}명 모였어요 (패드에 서면 참가)`) : `${NAME[id]} · ${GAMES[id].min}~${GAMES[id].max}명`;
      P.label.textContent = txt;
      if (l.busy || l.n) lines.push(`<div class="gl${l.cd ? ' hot' : ''}">${txt}</div>`);
    }
    if (G && mine()) { // 내가 참가 중: 역할·남은 시간
      const v = part(me.id), left = mmss(G.until - t), ready = G.ph === 'ready' ? Math.ceil((G.readyEnd - t) / 1000) : 0;
      let role, sub;
      if (G.g === 'tag') {
        const run = [...G.parts.values()].filter((x) => x.role === 'run').length;
        role = v.role === 'it' ? '🔴 당신은 술래! 도망자를 잡으세요' : '🟢 도망치세요! 잡히면 술래가 돼요';
        sub = `도망자 ${run}명 남음`;
      } else {
        const alive = [0, 1].map((tm) => [...G.parts.values()].filter((x) => x.team === tm && !x.out).length);
        role = v.out ? '😵 탈락했어요. 응원하세요!' : `${v.team ? '🔴 빨강' : '🔵 파랑'} 팀 · ${'❤️'.repeat(v.hp)} (${TOUCH ? '버튼' : 'F키·버튼'}으로 던지기, 점프로 피하기)`;
        sub = `파랑 ${alive[0]} : ${alive[1]} 빨강`;
      }
      lines.unshift(`<div class="gl big g-${G.g}"><b>${NAME[G.g]}</b> · ${ready ? `<em>${ready}</em>` : left}<br>${role}<br><small>${sub}</small></div>`);
    }
    bar.innerHTML = lines.join('');
    const aliveThrower = G?.g === 'dodge' && mine() && !mine().out && G.ph === 'play';
    throwBtn.hidden = !aliveThrower;
  }
  let renderAt = 0;

  function aim() { // 바라보는 방향, 40° 안에 상대가 있으면 그쪽으로 보정
    const me = getMe(), me_ = mine(), f = [Math.sin(me.ry), Math.cos(me.ry)];
    let best = null, ba = 0.7;
    for (const [id, v] of G.parts) {
      const p = players.get(id);
      if (!p || v.out || v.team === me_.team) continue;
      const dx = p.x - me.x, dz = p.z - me.z, l = Math.hypot(dx, dz) || 1, a = Math.acos(Math.max(-1, Math.min(1, (dx * f[0] + dz * f[1]) / l)));
      if (a < ba) { ba = a; best = [dx / l, dz / l]; }
    }
    return best || f;
  }
  let lastThrow = 0;
  function throwNow() {
    const v = G && mine();
    if (!v || G.g !== 'dodge' || v.out || G.ph !== 'play' || Date.now() - lastThrow < 1100) return;
    lastThrow = Date.now();
    const [dx, dz] = aim();
    send({ t: 'throw', dx, dz });
    throwBtn.classList.add('cool'); setTimeout(() => throwBtn.classList.remove('cool'), 1100);
  }
  throwBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); throwNow(); });
  res.onclick = () => (res.hidden = true);

  /* ── 서버 메시지 ── */
  function handle(m) {
    const me = getMe();
    if (m.t === 'lobby') { lob[m.g] = m; render(); return true; }
    if (m.t === 'gstart') {
      const t = Date.now();
      G = { g: m.g, ph: 'ready', readyEnd: t + m.ready, until: t + m.ready + m.dur, parts: parts(m) };
      res.hidden = true; // 이전 판 결과창은 닫음
      if (me && part(me.id)) toast(`${NAME[m.g]} 시작! 잠깐 준비하세요`);
      refreshTags(); render(); return true;
    }
    if (m.t === 'gstate') {
      if (!G || G.g !== m.g) G = { g: m.g, ph: m.ph, readyEnd: 0, until: 0, parts: new Map() };
      G.ph = m.ph; G.until = Date.now() + m.left; G.parts = parts(m);
      refreshTags(); render(); return true;
    }
    if (m.t === 'gtag') {
      const v = part(m.id); if (v) v.role = 'it';
      const p = players.get(m.id);
      toast(m.id === me?.id ? '😱 잡혔어요! 이제 당신도 술래!' : `${p?.name ?? '누군가'}님이 술래가 됐어요`);
      if (p) bubble(p, '😱', true);
      refreshTags(); render(); return true;
    }
    if (m.t === 'ghit') {
      const v = part(m.id); if (v) { v.hp = m.hp; v.out = m.hp === 0; }
      const p = players.get(m.id);
      if (p) bubble(p, m.hp === 0 ? '😵' : '💦', true);
      if (m.id === me?.id) toast(m.hp === 0 ? '😵 탈락했어요!' : '💦 물풍선에 맞았어요! (한 번 더 맞으면 탈락)');
      refreshTags(); render(); return true;
    }
    if (m.t === 'balloon') { addBalloon(m); return true; }
    if (m.t === 'bend') { const b = balloons.get(m.id); if (b) { scene.remove(b.g); balloons.delete(m.id); splash(m.x, m.z, b.m.team); } return true; }
    if (m.t === 'gend') {
      const winners = m.winners?.length ? `🏆 ${m.winners.join(', ')}` : '';
      if (m.msg) { res.innerHTML = `<b>${NAME[m.g]} 끝!</b><br>${m.msg}<br>${winners}<br><small>눌러서 닫기</small>`; res.hidden = false; setTimeout(() => (res.hidden = true), 9000); }
      G = null; for (const b of balloons.values()) scene.remove(b.g); balloons.clear();
      refreshTags(); render(); return true;
    }
    return false;
  }

  /* ── 매 프레임 ── */
  const rings = new Map();
  function update(dt, T, camera) {
    for (const id of Object.keys(pads)) { const l = lob[id], P = pads[id]; P.disc.material.opacity = 0.2 + (l?.n ? 0.25 + Math.sin(T * 5) * 0.1 : 0); P.ring.rotation.z = T * 0.4; }
    for (const L of labels) place(L.el, L.x, 3.4, L.z, 60);
    for (const [id, b] of balloons) { // 포물선처럼 살짝 떠서 날아감
      b.age += dt; const d = Math.min(b.m.max, b.m.sp * b.age);
      b.g.position.set(b.m.x + b.m.dx * d, 1.1 + Math.sin(Math.min(1, d / b.m.max) * Math.PI) * 0.35, b.m.z + b.m.dz * d);
      b.g.rotation.y += dt * 6;
      if (d >= b.m.max + 1) { scene.remove(b.g); balloons.delete(id); }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.life -= dt;
      if (d.ring) { const k = 1 - d.life / d.max; d.mesh.scale.setScalar(1 + k * 5); d.mesh.material.opacity = 0.8 * (1 - k); }
      else { d.vy -= 9 * dt; d.mesh.position.x += d.vx * dt; d.mesh.position.z += d.vz * dt; d.mesh.position.y = Math.max(0.05, d.mesh.position.y + d.vy * dt); }
      if (d.life <= 0) { scene.remove(d.mesh); drops.splice(i, 1); }
    }
    // 참가자 발밑 링: 술래=빨강, 도망자=초록, 피구=팀 색(탈락은 회색)
    const want = new Set();
    if (G) for (const [id, v] of G.parts) {
      const p = players.get(id); if (!p) continue;
      want.add(id);
      let r = rings.get(id);
      if (!r) { r = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 28), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; scene.add(r); rings.set(id, r); }
      r.material.color.set(G.g === 'tag' ? (v.role === 'it' ? '#ff4d6d' : '#3ddc84') : v.out ? '#999999' : TEAM_C[v.team]);
      r.position.set(p.x, 0.08, p.z);
      r.scale.setScalar(G.g === 'tag' && v.role === 'it' ? 1 + Math.sin(T * 8) * 0.12 : 1);
    }
    for (const [id, r] of rings) if (!want.has(id)) { scene.remove(r); rings.delete(id); }
    if (Date.now() - renderAt > 250) { renderAt = Date.now(); render(); }
  }

  return {
    handle, update, throwNow,
    active: () => (G && mine() ? G.g : null),
    locked: () => !!(G && mine() && G.ph === 'ready'),
    clamp(x, z) { const v = G?.g === 'dodge' && mine(); return v && !v.out ? dodgeClamp(v.team, x, z) : [x, z]; },
    sitFor: (p) => { const v = G?.g === 'dodge' && part(p.id); return v?.out ? { kind: 'park', h: 0.32 } : null; }, // 탈락하면 주저앉음
    tagText(p) {
      const v = part(p.id);
      if (!v) return '';
      return G.g === 'tag' ? (v.role === 'it' ? '🔴 술래' : '🟢 도망') : v.out ? '😵 탈락' : `${v.team ? '🔴' : '🔵'}${'❤️'.repeat(v.hp)}`;
    },
  };
}
