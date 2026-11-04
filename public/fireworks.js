// 손으로 그리는 불꽃놀이 화면: 그리기 레이어(마우스 누른 채 / 손가락), 스파클러 머리·빛 꼬리·뒤따라 터지는 잔불꽃, 손을 떼면 그린 선 그대로 피날레.
// 그린 선은 하늘 평면(campdata.js fwWorld/fwHit)에 놓임 → 다른 사람 화면에도 같은 자리. 규칙은 서버 fireworks.js 가 심판
// 입자는 점 묶음 하나(풀, 지오메트리 재할당 없음): 앞쪽 45% = 꼬리 점, 그다음 NK = 불꽃 스틱 빛의 선, 나머지 = 불티
// 불꽃 스틱(kind 'stick'): 아바타 앞 눈높이 허공 평면에 흰금색 → 주황으로 식으며 4초쯤 뒤 사라지는 빛의 선, 아바타 손에 스틱(avatar.js), 팔이 그리는 점을 따라감
import * as THREE from 'three';
import { FW, STICK, fwWorld, fwHit } from './world.js';
import { drawView } from './camrig.js';
import { SHAPE_NAME } from './shapes.js';
import { glowPoints, pointScale } from './camp-site.js';
import { sfx } from './sfx.js';

const TOUCH = matchMedia('(pointer:coarse)').matches;
const CSS = `
#fwLayer{position:fixed;inset:0;z-index:8;touch-action:none;cursor:crosshair;user-select:none;-webkit-user-select:none}
#fwLayer .top{position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);padding:8px 10px 8px 16px;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 20px);box-sizing:border-box;cursor:default}
#fwLayer .top div{display:flex;flex-direction:column}#fwLayer .top b{font-size:16px}#fwLayer .top small{font-size:12px;opacity:.75}
#fwLayer .top i{font-style:normal;font-size:13px;background:#fff;border-radius:10px;padding:4px 8px;white-space:nowrap}
#fwLayer button{padding:8px 14px;min-height:40px;border-radius:14px;background:#8a63d2;border:0;color:#fff;font-size:15px;white-space:nowrap;touch-action:manipulation}
.fwLbl{position:fixed;left:0;top:0;z-index:7;pointer-events:none;font-size:22px;font-weight:800;color:#fff;text-shadow:0 0 10px #ff9a3c,0 0 2px #000;white-space:nowrap;animation:fwLbl 2.6s ease-out forwards}
@keyframes fwLbl{0%{opacity:0;scale:.6}15%{opacity:1;scale:1.1}25%{scale:1}80%{opacity:1}100%{opacity:0;translate:0 -24px}}
body.fw-on #tags,body.fw-on #top,body.fw-on #jumpBtn,body.fw-on #fab,body.fw-on #chatBtn,body.fw-on #hint,body.fw-on #joy,body.fw-on #sitq,body.fw-on #rtq,body.fw-on #fwq,body.fw-on #chat{visibility:hidden!important}
@media (max-height:520px) and (orientation:landscape){#fwLayer .top{padding:5px 8px 5px 12px;gap:8px}#fwLayer .top b{font-size:14px}#fwLayer .top small{font-size:11px}#fwLayer button{min-height:34px;padding:5px 10px;font-size:14px}}`;
const HSL = (h, s, l, k) => { const c = new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); return [c.r * k, c.g * k, c.b * k]; };

export function createFireworks({ scene, camera, renderer, Q, getMe, send, toast, bubble, players }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const qk = Q.level === 'high' ? 1 : Q.level === 'normal' ? 0.66 : 0.34, NK = Math.round(1500 * qk), N = Math.round(6000 * qk) + NK, NT = Math.round((N - NK) * 0.45), GAP = Q.level === 'low' ? 0.5 : 0.35, GAPK = Q.level === 'low' ? 0.07 : 0.045; // 품질별 입자 수, 꼬리 점 간격(m) (스틱은 가까우니 촘촘히)
  const STICK_LIFE = 3.8;
  const P = glowPoints(N); P.pts.name = 'fireworks'; P.pts.renderOrder = 3; scene.add(P.pts);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), base = new Float32Array(N * 3), sz = new Float32Array(N), kind = new Uint8Array(N), owner = new Int32Array(N).fill(-1);
  let iT = 0, iK = NT, iS = NT + NK, alive = 0;
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  let dayK = 1; // 낮엔 더 밝고 크게
  function spawn(trail, x, y, z, vx, vy, vz, l, size, col, k = 0, own = -1) { // trail: 1 = 불꽃놀이 꼬리, 2 = 스틱 선, 0 = 불티
    const i = trail === 2 ? iK : trail ? iT : iS; if (trail === 2) iK = iK + 1 >= NT + NK ? NT : iK + 1; else if (trail) iT = iT + 1 >= NT ? 0 : iT + 1; else iS = iS + 1 >= N ? NT + NK : iS + 1; // 고리처럼 돌아가며 덮어씀
    P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i] = max[i] = l; sz[i] = size; base.set(col, i * 3); kind[i] = k; owner[i] = own; return i;
  }
  const burst = (p, n, speed, l, col, size = 0.32, grav = 1) => { for (let j = 0; j < n; j++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = speed * (0.6 + Math.random() * 0.4); spawn(false, p.x, p.y, p.z, Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, l * (0.7 + Math.random() * 0.5), size, col, grav ? 1 : 0); } };

  /* ── 세션: id → { plane, hue, strokes: [{ pts: [Vector3], uv, open, dots, idx }], q: [{ at, uv }] (받은 점을 0.1초 동안 나눠 그림) } ── */
  const S = new Map(), later = []; // later: 0.2~0.4초 뒤에 터질 잔불꽃
  let strokeSeq = 1;
  const session = (id, plane, c, kind) => { const s = { id, plane, hue: c, kind: kind === 'stick' ? 'stick' : 'sky', strokes: [], q: [], head: null, headAt: -1e9, done: false, doneAt: 0 }; s.L = s.kind === 'stick' ? STICK : FW; S.set(id, s); return s; };
  const now = () => performance.now();
  function addPoint(s, u, v) { // 한 점 더하기: 앞 점과 사이를 꼬리 점 간격으로 메워 끊김 없게 (곡선 보간)
    let st = s.strokes.at(-1); if (!st || !st.open) { st = { pts: [], uv: [], open: true, dots: [], idx: strokeSeq++, len: 0 }; s.strokes.push(st); }
    const w = new THREE.Vector3(...fwWorld(s.plane, u, v)), prev = st.pts.at(-1);
    st.uv.push([u, v]);
    const segs = prev ? Math.max(1, Math.ceil(prev.distanceTo(w) / (s.kind === 'stick' ? GAPK : GAP))) : 1, p0 = st.pts.at(-2) ?? prev;
    for (let k = 1; k <= segs; k++) {
      const t = k / segs, p = prev ? (p0 && p0 !== prev ? catmull(p0, prev, w, t) : prev.clone().lerp(w, t)) : w.clone();
      if (st.lp) st.len += p.distanceTo(st.lp); st.lp = p;
      dot(s, st, p);
    }
    st.pts.push(w); s.head = w; s.headAt = now();
  }
  const catmull = (a, b, c, t) => { const d = c.clone().add(c.clone().sub(b)); const p0 = a, p1 = b, p2 = c, p3 = d, t2 = t * t, t3 = t2 * t; return new THREE.Vector3().addScaledVector(p1, 2).addScaledVector(p2.clone().sub(p0), t).addScaledVector(p0.clone().multiplyScalar(2).sub(p1.clone().multiplyScalar(5)).add(p2.clone().multiplyScalar(4)).sub(p3), t2).addScaledVector(p1.clone().multiplyScalar(3).sub(p0).sub(p2.clone().multiplyScalar(3)).add(p3), t3).multiplyScalar(0.5); };
  function dot(s, st, p) { // 꼬리 점(그린 선 위에 남는 빛) + 0.3초 뒤 잔불꽃
    if (s.kind === 'stick') { st.dots.push(spawn(2, p.x, p.y, p.z, 0, 0, 0, STICK_LIFE * (0.9 + Math.random() * 0.2), 0.13, [3, 2.7, 1.9], 3, st.idx)); if (st.dots.length % 5 === 0) for (let j = 0; j < 2; j++) spawn(false, p.x, p.y, p.z, (Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.5, 0.05, [3, 2.1, 0.9], 1); return; } // 스틱: 선은 4초쯤 식고, 불티가 아래로 떨어짐
    const h = s.hue + st.len * 0.004 + st.idx * 0.08;
    st.dots.push(spawn(true, p.x, p.y, p.z, 0, 0, 0, 45, 0.5, HSL(h, 0.9, 0.62, 1.9), 2, st.idx)); // 세션이 끝날 때까지 남아 여러 획이 한 그림이 됨
    if (st.dots.length % 2 === 0) later.push({ at: now() + 200 + Math.random() * 200, p: p.clone(), h });
  }
  function popStroke(s, st, shape) { // 손을 뗀 획: 선을 따라 순서대로 크게 터짐 (선은 세션이 끝날 때까지 남음)
    if (!st || st.popped) return; st.open = false; st.popped = true;
    if (s.kind === 'stick') { // 스틱 끝 피날레: 선 위에서 작은 반짝임 몇 개 (+ 알아본 모양이면 가볍게 글자만)
      const list = st.dots, t0 = now(), n = Math.min(10, Math.max(3, Math.round(st.len / 0.8)));
      for (let j = 0; j < n; j++) { const i = list[Math.floor(((j + 0.5) / n) * list.length)]; if (i != null && owner[i] === st.idx) later.push({ at: t0 + j * 45, p: new THREE.Vector3(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]), h: 0.1 + Math.random() * 0.05, small: 1 }); }
      if (shape && list.length) { const i = list[Math.floor(list.length / 2)]; label(new THREE.Vector3(P.pos[i * 3], P.pos[i * 3 + 1] + 0.6, P.pos[i * 3 + 2]), `${SHAPE_NAME[shape]}!`); }
      sfx.play('crackle', gain(s) * 0.35); return;
    }
    const list = st.dots, step = Math.max(1, Math.round(list.length / Math.max(8, Math.min(90, st.len / 0.7)))), t0 = now(), dur = Math.min(1400, 300 + list.length * 6);
    for (let j = 0; j < list.length; j++) { const i = list[j]; if (owner[i] !== st.idx) continue; const at = (j / list.length) * dur; if (j % step === 0) later.push({ at: t0 + at, p: new THREE.Vector3(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]), h: s.hue + j * 0.004 + st.idx * 0.08, big: 1 }); }
    if (shape) { // 알아본 모양: 가운데에서 한 번 더 크게 + 글자
      const c = list.reduce((a, i) => a.add(v3.set(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2])), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, list.length));
      later.push({ at: t0 + dur * 0.6, p: c, h: 0.12, mega: 1 }); label(c, `${SHAPE_NAME[shape]} 불꽃!`);
    }
    const g = gain(s); sfx.play('whistle', g * 0.7); sfx.play('boom', g, 0.35); sfx.play('crackle', g * 0.8, 0.6);
  }
  function fadeSession(s) { // 세션 끝: 그린 그림이 처음 획부터 차례로 반짝 사라짐 (스틱 선은 저절로 식어 사라짐)
    if (s.kind === 'stick') return;
    const all = s.strokes.flatMap((st) => st.dots.filter((i) => owner[i] === st.idx)), t0 = now();
    all.forEach((i, j) => { const at = (j / Math.max(1, all.length)) * 1600; life[i] = Math.min(life[i], 0.6 + at / 1000); max[i] = life[i]; if (j % 9 === 0) later.push({ at: t0 + at, p: new THREE.Vector3(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]), h: s.hue + j * 0.003 }); });
  }
  const stickGain = (s) => { const me = getMe(); if (!me) return 0; return Math.max(0, 1 - Math.hypot(me.x - s.plane.x, me.z - s.plane.z) / 30) ** 1.5 * 0.55; }; // 스틱 소리는 가까이서만
  const gain = (s) => { const me = getMe(); if (!me) return 0; const d = Math.hypot(me.x - s.plane.x, me.z - s.plane.z); return Math.max(0, 1 - d / 160) ** 1.3 * (0.65 + night * 0.35); };
  let night = 0;
  const lbls = document.body;
  function label(p, text) { const el = document.createElement('div'); el.className = 'fwLbl'; el.textContent = text; lbls.append(el); el.wp = p.clone(); labels.push(el); setTimeout(() => { el.remove(); labels.splice(labels.indexOf(el), 1); }, 2600); }
  const labels = [];

  /* ── 내가 그리기: 레이어·포인터·서버로 보내기 ── */
  const layer = document.createElement('div'); layer.id = 'fwLayer'; layer.hidden = true;
  const TEXT = { sky: [`🎆 화면에 ${TOUCH ? '손가락' : '마우스(누른 채)'}으로 그려 보세요`, '⭐ 별 · ♥ 하트 · ○ 동그라미 · 글자·이름도 그대로 불꽃이 돼요'], stick: [`✨ 불꽃 스틱: ${TOUCH ? '손가락' : '마우스(누른 채)'}으로 허공에 그려요`, '빛의 선은 금방 식어요 · 이어서 여러 번 그려 보세요'] };
  layer.innerHTML = `<div class="top panel"><div><b></b><small></small></div><i>8획 · 30초</i><button data-a="stop">그만하기</button></div>`;
  document.body.append(layer);
  const info = layer.querySelector('i');
  let mine = null, cur = null, outbox = [], lastSend = 0, lastPt = null, aim = null, pid = null, lastDown = -1e9, wantDown = false, sx = 0, sy = 0, ending = false;
  const view = { b: 0, eye: new THREE.Vector3(), look: new THREE.Vector3(), from: new THREE.Vector3() };
  layer.querySelector('[data-a=stop]').onclick = (e) => { e.stopPropagation(); stop(); };
  layer.querySelector('.top').addEventListener('pointerdown', (e) => e.stopPropagation());
  function uvAt(x, y) { // 화면 좌표 → 하늘 평면 [u, v] (평면 밖이면 가장자리로)
    v3.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
    const h = fwHit(mine.plane, camera.position.toArray(), v3.toArray()); if (!h) return null;
    return [Math.max(-1, Math.min(1, h[0])), Math.max(-1, Math.min(1, h[1]))];
  }
  function down(e) {
    if (!mine || pid !== null) return;
    pid = e.pointerId; try { layer.setPointerCapture(e.pointerId); } catch {} // 합성 이벤트에선 실패할 수 있음
    sx = e.clientX; sy = e.clientY; wantDown = true; tryDown();
  }
  function tryDown() { // 획 사이 1초 (서버와 같은 규칙): 그 전이면 누르고 있는 동안 기다렸다 시작
    if (!wantDown || cur || !mine) return;
    if (mine.strokes.filter((x) => x.popped).length >= mine.L.maxStrokes || now() - lastDown < mine.L.strokeGap) return;
    wantDown = false; lastDown = now(); send({ t: 'fw', k: 'down' }); cur = { t0: now(), n: 0 }; lastPt = null; move({ clientX: sx, clientY: sy, pointerId: pid });
  }
  function move(e) {
    sx = e.clientX; sy = e.clientY; if (!mine) return;
    const uv = uvAt(sx, sy); if (!uv) return;
    if (!cur || e.pointerId !== pid) { aim = uv; return; } // 누르기 전: 조준 스파클러만
    aim = null;
    const t = now(); if (lastPt && (Math.hypot(uv[0] - lastPt[0], uv[1] - lastPt[1]) < 0.006 || t - lastPt.t < 20)) return; // 너무 촘촘한 점은 건너뜀
    if (cur.n >= mine.L.maxPts) return up();
    lastPt = Object.assign(uv.slice(), { t }); cur.n++;
    addPoint(mine, uv[0], uv[1]); outbox.push([+uv[0].toFixed(3), +uv[1].toFixed(3)]);
  }
  function flush(force) { if (!outbox.length || (!force && now() - lastSend < 100)) return; lastSend = now(); while (outbox.length) { send({ t: 'fw', k: 'pts', p: outbox.splice(0, FW.perMsg) }); if (!force) break; } }
  function up(e) {
    if (e && e.pointerId !== pid) return;
    if (e) { try { layer.releasePointerCapture(pid); } catch {} pid = null; }
    wantDown = false;
    if (!cur) return;
    flush(true); send({ t: 'fw', k: 'up' }); cur = null;
    popStroke(mine, mine.strokes.at(-1));
  }
  layer.addEventListener('pointerdown', down); layer.addEventListener('pointermove', move);
  for (const ev of ['pointerup', 'pointercancel']) layer.addEventListener(ev, up);
  layer.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { aim = null; up(e); } });
  function open(s) { // 서버가 시작을 허락 → 레이어 켜고 시점 고정 (camrig.js drawView: 하늘 = 아바타 뒤 낮은 곳에서 평면 가운데를 올려다봄, 스틱 = 아바타와 앞 허공을 한 화면에)
    mine = s; const me = getMe(), v = drawView(s.kind, me, s.plane, camera.aspect);
    view.from.copy(camera.position); view.eye.set(...v.eye); view.look.set(...v.look); view.b = 0.001;
    if (s.kind === 'stick') me.tr = s.plane.ry; // 평면 쪽으로 돌아섬 (서버는 제자리 회전은 취소하지 않음)
    layer.querySelector('b').textContent = TEXT[s.kind][0]; layer.querySelector('small').textContent = TEXT[s.kind][1];
    layer.hidden = false; document.body.classList.add('fw-on'); lastDown = -1e9; ending = false; s.t0Local = now();
  }
  function close() { layer.hidden = true; document.body.classList.remove('fw-on'); mine = null; cur = null; pid = null; aim = null; outbox = []; wantDown = false; }
  const stop = () => { if (!mine || ending) return; ending = true; if (cur) up(); send({ t: 'fw', k: 'stop' }); };

  function handle(m) {
    const me = getMe();
    if (m.t === 'fwno') { toast(m.error); return true; }
    if (m.t !== 'fw') return false;
    if (m.k === 'start') { const s = session(m.id, m.plane, m.c, m.kind); s.name = m.name; if (me && m.id === me.id) open(s); else if (s.kind === 'sky') { const g = gain(s); if (g > 0.05) sfx.play('whistle', g * 0.5); } }
    const s = S.get(m.id); if (!s) return true;
    const self = me && m.id === me.id;
    if (m.k === 'pts' && !self) { const t = now(), n = m.p.length; m.p.forEach(([u, v], i) => s.q.push({ at: t + (i / n) * 100, u, v, n: m.n })); }
    else if (m.k === 'pop') {
      if (!self) { for (const q of s.q.splice(0)) addPoint(s, q.u, q.v); popStroke(s, s.strokes.at(-1), m.shape); }
      else { const st = s.strokes.filter((x) => x.popped)[m.n]; if (m.shape && st?.pts.length && s.kind === 'stick') { const c = st.pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / st.pts.length); label(c.setY(c.y + 0.6), `${SHAPE_NAME[m.shape]}!`); } else if (m.shape && st?.pts.length) { const c = st.pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / st.pts.length); later.push({ at: now(), p: c, h: 0.12, mega: 1 }); label(c, `${SHAPE_NAME[m.shape]} 불꽃!`); } } // 내 획: 이미 터뜨렸고, 알아본 모양이면 축하만
    } else if (m.k === 'end') {
      s.done = true; s.doneAt = now(); for (const q of s.q.splice(0)) addPoint(s, q.u, q.v); fadeSession(s);
      if (self) { if (cur) popStroke(s, s.strokes.at(-1)); close(); if (m.r === 'time') toast(s.kind === 'stick' ? '✨ 30초가 다 됐어요' : '🎆 30초가 다 됐어요'); }
      const p = players.get(m.id), sh = m.shapes?.[0];
      if (p && m.shapes && s.kind === 'sky') bubble(p, sh ? `🎆 ${p.name}님이 ${SHAPE_NAME[sh].split(' ')[1]} 불꽃을 쏘았어요` : `🎆 ${p.name}님이 불꽃놀이를 했어요`);
    }
    return true;
  }
  function snapshot(list) { // 접속했을 때 진행 중이던 불꽃
    S.clear();
    for (const f of list || []) { const s = session(f.id, f.plane, f.c, f.kind); s.name = f.name; for (const st of f.strokes) { for (const [u, v] of st) addPoint(s, u, v); s.strokes.at(-1).open = false; } if (f.cur) for (const [u, v] of f.cur) addPoint(s, u, v); }
  }

  function update(dt, n) {
    night = n; dayK = 1 + (1 - n) * 0.8;
    P.mat.uniforms.uScale.value = pointScale(camera, renderer);
    const t = now();
    // 내 시점: 그리는 동안 하늘 평면을 봄 (게임 카메라 위에 덮어씀)
    if (mine || view.b > 0) {
      view.b = Math.max(0, Math.min(1, view.b + (mine ? dt : -dt) * 2.2)); const e = view.b * view.b * (3 - 2 * view.b);
      if (view.b > 0) { v4.set(camera.position.x, camera.position.y, camera.position.z); camera.getWorldDirection(v3); const lk = v3.multiplyScalar(10).add(v4); camera.position.lerpVectors(v4, view.eye, e); camera.lookAt(lk.lerp(view.look, e)); camera.updateMatrixWorld(); }
    }
    if (mine) {
      tryDown(); flush(false);
      if (cur && t - cur.t0 >= mine.L.strokeMs) up(); // 한 획 최대 10초
      const left = Math.max(0, mine.L.sessionMs - (t - mine.t0Local)), used = mine.strokes.filter((x) => x.popped).length;
      info.textContent = `${Math.max(0, mine.L.maxStrokes - used - (cur ? 1 : 0))}획 · ${Math.ceil(left / 1000)}초`;
    }
    // 받은 점을 차례로 그림, 0.2~0.4초 뒤 잔불꽃
    for (const s of S.values()) { while (s.q.length && s.q[0].at <= t) { const q = s.q.shift(); addPoint(s, q.u, q.v); } if (s.done && t - s.doneAt > 2500) S.delete(s.id); }
    // 불꽃 스틱 든 아바타: 그리는 중이면 팔이 지금 점을 가리킴(avatar.js), 스틱 끝에서 작은 불티가 계속 튐
    const holding = new Set();
    for (const s of S.values()) { if (s.kind !== 'stick' || s.done) continue; const av = players.get(s.id)?.av; if (!av) continue; holding.add(av); av.stick = 1; const st = s.strokes.at(-1), drawingNow = st?.open && s.head && t - s.headAt < 400; av.stickAim = drawingNow ? s.head.toArray() : s === mine && aim && !cur ? fwWorld(s.plane, aim[0], aim[1]) : null;
      if (av.root.visible && av.stickM) { av.stickM.tip.getWorldPosition(v4); for (let j = 0; j < (drawingNow ? 3 : 1); j++) spawn(false, v4.x, v4.y, v4.z, (Math.random() - 0.5) * 1.4, Math.random() * 1.2, (Math.random() - 0.5) * 1.4, 0.15 + Math.random() * 0.25, 0.035, [3, 2.4, 1.2], 1); } }
    for (const p of players.values()) if (p.av?.stick && !holding.has(p.av)) { p.av.stick = 0; p.av.stickAim = null; }
    for (let j = later.length - 1; j >= 0; j--) { const l = later[j]; if (l.at > t) continue; later.splice(j, 1);
      if (l.mega) { burst(l.p, Math.round(160 * Math.max(0.4, Q.fx)), 11, 2.2, HSL(l.h, 0.9, 0.7, 2.4), 0.5); burst(l.p, Math.round(60 * Math.max(0.4, Q.fx)), 6, 1.6, [2.6, 2.4, 2.0], 0.4); }
      else if (l.small) burst(l.p, Math.round(10 * Math.max(0.5, Q.fx)), 1.6, 0.6, HSL(l.h, 0.9, 0.75, 2.2), 0.07);
      else if (l.big) burst(l.p, Math.round(16 * Math.max(0.45, Q.fx)), 5.5, 1.5, HSL(l.h + Math.random() * 0.05, 0.95, 0.6, 2.2), 0.42);
      else burst(l.p, 5, 2.4, 0.7, HSL(l.h, 0.8, 0.75, 1.8), 0.24); }
    // 스파클러 머리: 그리는 중인 획의 끝(또는 조준 위치)에서 불티가 튐
    const heads = [];
    for (const s of S.values()) { const st = s.strokes.at(-1); if (st?.open && s.head && t - s.headAt < 600) heads.push(Object.assign(s.head.clone(), { k: s.kind })); }
    if (mine && aim && !cur) heads.push(Object.assign(new THREE.Vector3(...fwWorld(mine.plane, aim[0], aim[1])), { k: mine.kind }));
    for (const h of heads) {
      if (h.k === 'stick') { // 스틱 끝: 흰 불씨 + 아래로 떨어지며 작게 튀는 불티
        spawn(false, h.x, h.y, h.z, 0, 0, 0, 0.05, 0.42, [3, 2.8, 2.2], 0);
        for (let j = 0; j < Math.round(6 * Math.max(0.5, Q.fx)); j++) { const a = Math.random() * 6.283, s = 0.6 + Math.random() * 1.8; spawn(false, h.x, h.y, h.z, Math.cos(a) * s, Math.random() * 1.4 - 0.3, Math.sin(a) * s, 0.25 + Math.random() * 0.45, 0.06, [3, 2.2 + Math.random() * 0.6, 1.0], 1); }
        continue;
      }
      spawn(false, h.x, h.y, h.z, 0, 0, 0, 0.05, 2.4, [3, 2.6, 1.8], 0);
      for (let j = 0; j < Math.round(7 * Math.max(0.5, Q.fx)); j++) { const a = Math.random() * 6.283, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u), s = 2 + Math.random() * 5; spawn(false, h.x, h.y, h.z, Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, 0.2 + Math.random() * 0.35, 0.18, [3, 2.2 + Math.random() * 0.6, 1.2], 1); }
    }
    sfx.bed('spark', heads.some((h) => h.k === 'sky') ? Math.max(...[...S.values()].filter((s) => s.kind === 'sky' && s.strokes.at(-1)?.open).map(gain), mine?.kind === 'sky' && aim ? 0.3 : 0) * 0.8 : 0);
    sfx.bed('sizzle', Math.max(0, ...[...S.values()].filter((s) => s.kind === 'stick' && !s.done).map((s) => stickGain(s) * (s.strokes.at(-1)?.open ? 1 : 0.35)))); // 스틱 지글지글: 그리는 동안 크게, 들고만 있으면 작게
    // 입자 움직이기
    alive = 0;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { if (P.size[i]) P.size[i] = 0; continue; }
      life[i] -= dt; alive++;
      const u = Math.max(0, life[i] / max[i]), j = i * 3;
      if (kind[i] === 3) { const age = Math.min(1, (1 - u) * 1.5), k3 = Math.min(1, u * 4) * (0.82 + Math.sin(t * 0.025 + i * 1.7) * 0.18) * dayK; P.rgba[i * 4] = 3 * k3; P.rgba[i * 4 + 1] = (2.7 - 1.75 * age) * k3; P.rgba[i * 4 + 2] = (1.9 - 1.7 * age) * k3; P.rgba[i * 4 + 3] = 1; P.size[i] = sz[i] * (0.7 + u * 0.3) * (1 + (dayK - 1) * 0.8); continue; } // 스틱 선: 흰금색 → 주황으로 식으며 가늘어짐 (낮엔 굵게)
      if (kind[i] === 1) { vel[j + 1] -= 3.2 * dt; const dr = 1 - dt * 1.4; vel[j] *= dr; vel[j + 1] *= dr; vel[j + 2] *= dr; }
      P.pos[j] += vel[j] * dt; P.pos[j + 1] += vel[j + 1] * dt; P.pos[j + 2] += vel[j + 2] * dt;
      const tw = kind[i] === 2 ? 0.8 + Math.sin(t * 0.02 + i) * 0.2 : kind[i] === 1 ? (u < 0.4 && (i + (t >> 5)) % 3 === 0 ? 0.3 : 1) : 1; // 꼬리는 반짝, 잔불꽃은 꺼질 때 깜빡
      const k = (kind[i] === 2 ? Math.min(1, u * 6) : u) * tw * dayK;
      P.rgba[i * 4] = base[j] * k; P.rgba[i * 4 + 1] = base[j + 1] * k; P.rgba[i * 4 + 2] = base[j + 2] * k; P.rgba[i * 4 + 3] = 1;
      P.size[i] = sz[i] * (kind[i] === 1 ? 0.5 + u * 0.5 : 1) * (1 + (dayK - 1) * 0.4);
    }
    P.pts.visible = alive > 0; if (alive) P.dirty();
    for (const el of labels) { v3.copy(el.wp).project(camera); el.style.display = v3.z > 1 ? 'none' : ''; el.style.transform = `translate(${((v3.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px,${((-v3.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px) translate(-50%,-50%)`; }
  }
  return {
    handle, snapshot, update, stop,
    start(ry, kind) { send({ t: 'fw', k: 'start', ry: +ry.toFixed(3), ...(kind === 'stick' && { kind }) }); }, // kind 없으면 하늘 불꽃놀이 (예전 메시지 그대로)
    drawing: () => !!mine,
    busy: () => S.has(getMe()?.id),
    key(e) { if (!mine) return false; if (e.code === 'Escape') { stop(); return true; } if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) stop(); return false; }, // 움직이면 그만 (걷기는 그대로)
    stats: () => ({ alive, N, sessions: S.size, later: later.length, spark: Array.from(life.subarray(NT)).filter((x) => x > 0).length, strokes: [...S.values()].map((s) => s.strokes.map((x) => `${x.dots.length}:${x.open ? 'open' : ''}${x.popped ? 'popped' : ''}`)) }),
    _test: { uvAt, S, P }, // 시험·사진용
    get mine() { return mine; },
  };
}
