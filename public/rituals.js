// 성당·사찰·교회 안 활동 화면: 자리 앞 행동 패널(1·2·3·E / 폰 버튼), 염주·묵주·고해·피아노·찬양 가사 패널, 공동 의식 배너,
// 공유 촛불·연등(3D)·범종 흔들림, 소리(sfx.js) 크기 조절, 설정의 '🔊 소리'·'🙏 내 기록'. 규칙은 서버 rituals.js 가 심판, 화면은 보여 주기만 함.
// 작동하는 장식은 SPOTS 좌표(종류·번호)에서 계산 → 실내 가구 위치가 바뀌어도 따라감
import * as THREE from 'three';
import { SPOTS, SEATS, ACTS, STATUS, SEAT_SPOTS, SONGS, LINE_MS, CANDLE_SLOTS, BUILDINGS, TEMPLE_YARD, SACRED, freeCushions, ON_CUSHION, inside } from './world.js';
import { sfx } from './sfx.js';
import { PARTS } from './sacred.js';

const TOUCH = matchMedia('(pointer:coarse)').matches;
const CSS = `
#rtq{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(78px + env(safe-area-inset-bottom));padding:10px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:220px;max-width:94vw;animation:pop .2s;z-index:3}
#rtq b{font-size:17px}#rtq small{opacity:.7;font-size:13px;text-align:center}
#rtq .bt{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
#rtq button,.rt-p button{padding:8px 14px;min-height:40px;border-radius:14px;background:#fff;border:2px solid #f0d9c4;font-size:15px;touch-action:manipulation}
#rtq button.go,.rt-p button.go{background:#8a63d2;border-color:#8a63d2;color:#fff}
#rtq button[aria-pressed=true]{background:#efe6ff;border-color:#8a63d2}
#rtq kbd,.rt-p kbd{font:12px/1 inherit;background:#0001;border-radius:5px;padding:2px 5px;margin-left:5px;opacity:.75}
#rtq.mini{padding:6px 12px;min-width:0}#rtq.mini b{font-size:15px}
.rt-p{position:absolute;padding:10px 14px;z-index:3;animation:pop .2s}
#rtBeads{right:14px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;width:96px}
#rtBeads canvas,#rtRos canvas{position:static;display:block}
#rtBeads canvas{width:72px;height:min(300px,calc(100dvh - 190px));touch-action:none;cursor:ns-resize}
#rtBeads b{font-size:18px}#rtBeads small{font-size:11px;opacity:.7;text-align:center}
#rtRos{right:14px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;width:230px}
#rtRos canvas{width:200px;height:min(230px,calc(100dvh - 200px));touch-action:manipulation;cursor:pointer}
#rtRos b{font-size:17px}#rtRos small{font-size:12px;opacity:.7}
#rtConf{left:50%;top:44%;transform:translate(-50%,-50%);width:min(420px,92vw);display:flex;flex-direction:column;gap:8px;text-align:center}
#rtConf p{margin:0;font-size:13px;opacity:.75;line-height:1.45}
#rtConf textarea{width:100%;box-sizing:border-box;height:96px;border-radius:14px;border:2px solid #e6dcf5;padding:10px;font:16px/1.5 inherit;resize:none;background:#fffefa}
#rtConf .fly{position:relative;height:0}#rtConf .fly span{position:absolute;color:#b79cf0;font-size:18px;text-shadow:0 0 8px #fff6c8;animation:rt-fly 1.8s ease-out forwards;pointer-events:none}
@keyframes rt-fly{to{transform:translate(var(--dx),-140px) scale(.3);opacity:0;filter:blur(2px)}}
#rtPiano{left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:8px 10px 10px;width:min(760px,calc(100vw - 20px));box-sizing:border-box}
#rtPiano .hd{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:14px}#rtPiano .hd button{margin-left:auto;min-height:34px;padding:4px 12px}
#rtPiano .kb{position:relative;height:120px;display:flex;touch-action:none;user-select:none}
#rtPiano .w{flex:1;background:#fff;border:1px solid #cfc3b8;border-radius:0 0 8px 8px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px;font-size:11px;color:#9a8c80}
#rtPiano .bk{position:absolute;top:0;width:4.2%;height:64%;background:#2b2230;border-radius:0 0 6px 6px;color:#fff8;font-size:10px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;box-sizing:border-box}
#rtPiano .on{background:#ffd8e4!important}#rtPiano .bk.on{background:#8a63d2!important}
#rtLyr{left:14px;top:30%;width:min(300px,44vw);pointer-events:none}
#rtLyr b{font-size:16px;display:block;margin-bottom:4px}#rtLyr div{font-size:15px;opacity:.45;padding:3px 0;transition:all .4s}#rtLyr div.cur{opacity:1;font-size:19px;color:#8a3fd1;font-weight:700}
#rtBan{position:absolute;left:50%;transform:translateX(-50%);top:calc(116px + env(safe-area-inset-top));padding:7px 16px;font-size:14px;white-space:nowrap;z-index:2;text-align:center}
#rtBan b{font-size:15px}
#rtRec{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,92vw);max-height:84dvh;overflow:auto;padding:12px 16px 14px;z-index:6;animation:pop .2s}
#rtRec .hd{display:flex;align-items:center;gap:10px;margin-bottom:8px}#rtRec .hd b{font-size:20px}#rtRec .hd button{margin-left:auto;width:40px;height:40px;border-radius:50%;background:#fff;font-size:18px}
#rtRec .g{display:grid;grid-template-columns:1fr 1fr;gap:8px}#rtRec .c{background:#fff;border-radius:14px;padding:8px 10px;border:2px solid #efe4f7}
#rtRec .c i{font-style:normal;font-size:22px}#rtRec .c b{display:block;font-size:20px}#rtRec .c small{opacity:.65;font-size:12px}
#rtRec .bar{height:8px;border-radius:9px;background:#f1eaf8;margin-top:5px;overflow:hidden}#rtRec .bar i{display:block;height:100%;background:linear-gradient(90deg,#c9a7ff,#ff9fbf)}
#setMenu .sfx{display:flex;align-items:center;gap:8px;padding:2px 10px 6px}#setMenu .sfx input{flex:1;accent-color:#8a63d2;min-height:28px}#setMenu .sfx span{font-size:13px;min-width:56px;opacity:.75}
body.rt-piano #jumpBtn,body.rt-piano #fab,body.rt-piano #hint{display:none!important}
@media (max-height:520px) and (orientation:landscape){
  #rtq{bottom:calc(14px + env(safe-area-inset-bottom));padding:6px 12px;gap:4px;max-width:calc(100vw - 260px)}#rtq b{font-size:15px}#rtq small{font-size:12px}
  #rtq button{padding:5px 10px;min-height:36px;font-size:14px}
  #rtBeads{right:136px;top:calc(56px + env(safe-area-inset-top));transform:none;padding:6px 8px}#rtBeads canvas{height:calc(100dvh - 150px)}#rtBeads small{display:none}
  #rtRos{right:136px;top:calc(56px + env(safe-area-inset-top));transform:none;width:170px;padding:6px 8px}#rtRos canvas{width:130px;height:calc(100dvh - 150px)}
  #rtPiano .kb{height:92px}#rtLyr{top:22%}#rtLyr div{font-size:13px}#rtLyr div.cur{font-size:16px}
  #rtBan{top:calc(112px + env(safe-area-inset-top));font-size:12px;padding:5px 12px}
  #rtConf{top:40%}#rtConf textarea{height:64px}
}`;
// 자리 종류 → 고를 수 있는 행동 (앞에서부터 1·2·3 키, E = 첫 번째)
const MENU = {
  cushion: ['bow', 'beads', 'palms'], beads: ['beads', 'bow', 'palms'], buddha: ['palms', 'bow'], bell: ['bell'], lantern: ['lantern', 'palms'],
  candle: ['candle', 'pray'], font: ['cross', 'veil'], confess: ['confess'], altar: ['pray'], choir: ['hymn'], rosary: ['rosary', 'hymn', 'cross'],
  pew: ['sing', 'pray'], pulpit: ['pray'], stage: ['sing'], cross: ['pray'], piano: ['piano'],
};
const WHERE = { cushion: '방석', beads: '방석 (염주)', buddha: '불상 앞', bell: '범종', lantern: '연꽃 석등', candle: '촛불대', font: '성수대', confess: '고해실', altar: '제대 앞', choir: '성가대 자리', rosary: '성당 의자', pew: '교회 의자', pulpit: '강대상', stage: '찬양 무대', cross: '큰 십자가 앞', piano: '피아노' };
const SUB = { buddha: '마음을 가다듬고 잠시 머물러 보세요', bell: '범종을 치면 멀리까지 울려요', lantern: '연등을 밝히면 30분 동안 환해요', candle: '촛불을 켜고 잠시 기도해요 · 30분 동안 모두에게 보여요', font: '성수에 손끝을 적시고 성호를 그어요', confess: '조용히 마음을 들여다보는 체험이에요', altar: '조용히 기도해 보세요', choir: '오르간·합창 성가가 성당 안에 흘러요', rosary: '묵주 한 바퀴 = 59알', pew: '함께 찬양하거나 기도해요', pulpit: '조용히 기도해 보세요', stage: '무대에 서서 함께 찬양해요', cross: '조용히 기도해 보세요', piano: '누른 건반은 교회 안 모두에게 들려요' };
const NOTE_KEYS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12 }; // 한 옥타브(+높은 도), Shift = 한 옥타브 위
const HINTS = { temple: TOUCH ? '🙏 방석 앞에 서서 절해 보세요 · 범종도 칠 수 있어요' : '🙏 방석 앞에 서서 절해 보세요 (1 절 · 2 염주 · 3 합장)', cathedral: '🕯️ 촛불대 앞에서 촛불을 켜고, 의자에 앉아 묵주기도를 해 보세요', church: '🎤 앞 무대에 서서 찬양하거나 피아노를 쳐 보세요' };
const fwd = (s, d) => [s.x + Math.sin(s.ry) * d, s.z + Math.cos(s.ry) * d]; // 자리에서 바라보는 쪽으로 d m
const glowTex = (() => { let t; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (t = new THREE.CanvasTexture(c)); }; })();
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export function createRituals({ scene, players, getMe, send, toast, bubble, host, menu, free, sitq, standUp, walk }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const mk = (h, parent = host) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return parent.appendChild(d.firstElementChild); };
  const q = mk('<div id="rtq" class="panel" hidden></div>');
  const beadsEl = mk('<div id="rtBeads" class="panel rt-p" hidden><b>0</b><canvas width="72" height="300"></canvas><small>위아래로 쓸어 넘기기</small></div>');
  const rosEl = mk('<div id="rtRos" class="panel rt-p" hidden><b>주님의 기도</b><canvas width="200" height="230"></canvas><small>알을 눌러 하나씩</small></div>');
  const confEl = mk(`<div id="rtConf" class="panel rt-p" hidden><b>🤫 마음속 이야기를 적어 보세요</b><p>이 글은 어디에도 전송·저장되지 않아요.<br>실제 고해성사를 대신하지 않아요.</p><div class="fly"></div><textarea id="rtConfText" maxlength="300" autocomplete="off" spellcheck="false" placeholder="여기에 적고 내려놓으면 빛이 되어 사라져요"></textarea><div class="bt" style="display:flex;gap:8px;justify-content:center"><button class="go" data-a="let">🕊️ 내려놓기</button><button data-a="x">닫기</button></div></div>`);
  const piaEl = mk('<div id="rtPiano" class="panel rt-p" hidden><div class="hd">🎹 <b>피아노</b><small>' + (TOUCH ? '건반을 눌러요' : 'A S D F G H J K · W E T Y U · Shift = 한 옥타브 위 · Esc 그만') + '</small><button data-a="x">그만하기</button></div><div class="kb"></div></div>');
  const lyrEl = mk('<div id="rtLyr" class="panel rt-p" hidden></div>');
  const banEl = mk('<div id="rtBan" class="panel" hidden></div>');
  const recEl = mk('<div id="rtRec" class="panel" hidden></div>');
  for (const el of [beadsEl, rosEl, confEl, piaEl, lyrEl]) el.style.zIndex = 3;
  confEl.querySelector('textarea').addEventListener('keydown', (e) => e.stopPropagation()); // 글 쓰는 동안 WASD 로 걷지 않게

  // ── 설정 메뉴: '🔊 소리' (켜기·크기) + '🙏 내 기록'
  const acct = menu.querySelector('[data-a="edit"]')?.previousElementSibling;
  const mi = document.createElement('div');
  mi.innerHTML = `<div class="hd">🔊 소리</div><div class="sfx"><span>효과음</span><button data-sfx="on" aria-pressed="${sfx.on}">${sfx.on ? '켜짐' : '꺼짐'}</button><input type="range" min="0" max="100" value="${Math.round(sfx.vol * 100)}" aria-label="효과음 크기"></div>` +
    '<div class="hd">🙏 성당·사찰·교회</div><button data-rit="rec"><b>내 기록</b><small>절·염주·촛불·찬양 모아 보기</small></button>';
  acct ? acct.before(...mi.children) : menu.append(...mi.children);
  const sfxBtn = menu.querySelector('[data-sfx]'), sfxVol = menu.querySelector('.sfx input');
  sfxBtn.onclick = (e) => { e.stopPropagation(); sfx.set({ on: !sfx.on }); sfxBtn.textContent = sfx.on ? '켜짐' : '꺼짐'; sfxBtn.setAttribute('aria-pressed', sfx.on); };
  sfxVol.oninput = () => sfx.set({ vol: sfxVol.value / 100 });
  sfxVol.onclick = (e) => e.stopPropagation();
  menu.querySelector('[data-rit]').onclick = () => { menu.hidden = true; openRec(); };
  recEl.onclick = (e) => { if (e.target.closest('[data-a=x]')) recEl.hidden = true; };

  let rec = {}, myAct = null, auto = false, qKey = '', choose = false, beadN = 0, rosN = 0, hintSeen = {};
  try { hintSeen = JSON.parse(localStorage.getItem('village.rhint') || '{}'); } catch {}
  const acts = new Map(); // id → { k, spot, t0, ms, song }
  const rituals = new Map(); // place → { name, until(performance ms) }
  let shrine = { candles: [], lanterns: [], hymn: null, praise: null }, shrineAt = 0;
  const clk = () => performance.now();
  const seatSpot = new Map(); // 긴 의자 자리 번호 → 같은 좌표의 SPOTS
  for (const st of SEATS) if (st.kind === 'pew') { const sp = SPOTS.find((s) => SEAT_SPOTS.includes(s.kind) && Math.hypot(s.x - st.x, s.z - st.z) < 0.1); if (sp) seatSpot.set(st.id, sp); }

  function openRec() {
    const r = rec, bows = r.bows || 0, to = 108 - (bows % 108);
    const C = [['🙇', '절', bows, `오늘 ${r.day === today() ? r.today || 0 : 0}번 · 108배까지 ${to}번`], ['📿', '염주 알', r.beads || 0, `${Math.floor((r.beads || 0) / 108)}바퀴`], ['🕯️', '켠 촛불', r.candles || 0, '성당 촛불대'], ['🙏', '묵주기도', r.rosaries || 0, '한 바퀴 = 59알'], ['🎤', '찬양', r.sung || 0, '교회 무대·의자'], ['🎹', '피아노 연주', r.played || 0, '교회 피아노'], ['🔔', '공동 의식 참여', r.ritual || 0, '예불·미사·새벽 예배']];
    recEl.innerHTML = `<div class="hd"><b>🙏 내 기록</b><span>${bows >= 108 ? `108배 ${Math.floor(bows / 108)}번 완성 🎉` : '첫 108배 도전 중'}</span><button data-a="x" aria-label="닫기">✕</button></div>` +
      `<div class="c" style="margin-bottom:8px"><i>🙇</i> 108배 <small>${bows % 108} / 108</small><div class="bar"><i style="width:${((bows % 108) / 108) * 100}%"></i></div></div><div class="g">` +
      C.map(([ic, nm, n, sub]) => `<div class="c"><i>${ic}</i> ${nm}<b>${n.toLocaleString('ko-KR')}</b><small>${sub}</small></div>`).join('') + '</div>';
    recEl.hidden = false;
  }

  /* ── 3D: 촛불(빈 컵 + 켜진 불꽃 + 번짐), 연등 불빛, 범종 흔들림. 촛불대·석등 위치는 SPOTS 에서 (자리 → 바라보는 쪽) ── */
  const candleSpots = SPOTS.filter((s) => s.kind === 'candle'), lanternSpots = SPOTS.filter((s) => s.kind === 'lantern'), bellSpot = SPOTS.find((s) => s.kind === 'bell');
  const slotPos = candleSpots.map((s) => { const [cx, cz] = fwd(s, 1.2); return Array.from({ length: CANDLE_SLOTS }, (_, j) => { const a = (j / CANDLE_SLOTS) * Math.PI * 2 + 0.26; return new THREE.Vector3(cx + Math.cos(a) * 0.2, s.y + 1.04, cz + Math.sin(a) * 0.2); }); }); // 촛불대 아래 받침 위 고리
  const NC = candleSpots.length * CANDLE_SLOTS, m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const cups = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.028, 0.024, 0.05, 8).translate(0, 0.025, 0), new THREE.MeshLambertMaterial({ color: '#fff6e8', emissive: '#ffcf8a', emissiveIntensity: 0.15 }), NC);
  const flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.014, 0.05, 6).translate(0, 0.075, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc35a').multiplyScalar(3.2) }), NC);
  slotPos.flat().forEach((p, i) => { cups.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); flames.setMatrixAt(i, m4.makeScale(0, 0, 0)); });
  const haloGeo = new THREE.BufferGeometry(); haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(slotPos.flat().flatMap((p) => [p.x, p.y + 0.09, p.z])), 3)); haloGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NC * 3), 3));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ map: glowTex(), size: 0.42, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const lampPos = lanternSpots.map((s) => { const [x, z] = fwd(s, 2.25); return [x, s.y + 4.35, z]; }); // 연꽃 석등 꼭대기 (설계도 1.45 × 3배)
  const lampGeo = new THREE.BufferGeometry(); lampGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lampPos.flat()), 3)); lampGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lampPos.length * 3), 3));
  const lamps = new THREE.Points(lampGeo, new THREE.PointsMaterial({ map: glowTex(), size: 7, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const [n, o] of Object.entries({ cups, flames, halos, lamps })) { o.name = 'rit-' + n; o.frustumCulled = false; scene.add(o); }
  flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  let bellHit = -1e9, ritToast = '', ritToastAt = -1e9;
  const CATH = BUILDINGS.cathedral;
  function draw3D(night) {
    const t = clk(), el = t - shrineAt, cam = Math.hypot((window.__village?.camera.position.x ?? CATH.cx) - CATH.cx, (window.__village?.camera.position.z ?? CATH.cz) - CATH.cz);
    const showC = cam < 120; cups.visible = flames.visible = halos.visible = showC;
    if (showC) {
      const lit = new Set(shrine.candles.filter((c) => c[2] - el > 0).map((c) => c[0] * CANDLE_SLOTS + c[1])), col = haloGeo.attributes.color;
      slotPos.flat().forEach((p, i) => {
        const on = lit.has(i), f = on ? 1 + Math.sin(t * 0.017 + i * 1.7) * 0.12 + Math.sin(t * 0.031 + i) * 0.08 : 0; // 깜빡임
        flames.setMatrixAt(i, on ? m4.compose(v3.copy(p), q4.identity(), s3.set(1, f, 1)) : m4.makeScale(0, 0, 0));
        const k = on ? (0.55 + 0.45 * f) * (0.8 + night * 0.6) : 0; col.setXYZ(i, k, k * 0.62, k * 0.25);
      });
      flames.instanceMatrix.needsUpdate = true; col.needsUpdate = true;
    }
    lamps.visible = Math.hypot((window.__village?.camera.position.x ?? 0) - TEMPLE_YARD.cx, (window.__village?.camera.position.z ?? 0) - TEMPLE_YARD.cz) < 200; // 사찰 근처에서만 그림
    const lc = lampGeo.attributes.color, lit = new Set(shrine.lanterns.filter((c) => c[1] - el > 0).map((c) => c[0]));
    for (let i = 0; i < lampPos.length; i++) { const k = lit.has(i) ? (0.35 + night * 0.65) * (1 + Math.sin(t * 0.004 + i) * 0.06) : 0; lc.setXYZ(i, k, k * 0.55, k * 0.62); }
    lc.needsUpdate = true;
    if (PARTS.bell) { const u = (t - bellHit) / 1000; PARTS.bell.rotation.z = u > 0 && u < 14 ? 0.07 * Math.exp(-u / 3.2) * Math.sin(u * 2.6) : 0; } // 당목에 맞아 서쪽으로 흔들렸다 잦아듦
  }

  /* ── 소리: 위치·건물로 크기 ── */
  const near = (x, z, range) => { const me = getMe(); return me ? Math.max(0, 1 - Math.hypot(me.x - x, me.z - z) / range) ** 1.5 : 0; };
  const gainAt = (x, z, place, range) => { const me = getMe(); return !me ? 0 : (me.pl === place ? 1 : 0.15) * near(x, z, range); }; // 건물 밖에선 아주 작게
  const ritualLeft = (pl) => { const r = rituals.get(pl); return r ? r.until - clk() : 0; };
  function sound() {
    const me = getMe(); if (!me) return;
    const pl = me.pl, el = clk() - shrineAt, yard = near(TEMPLE_YARD.cx, TEMPLE_YARD.cz, 150);
    sfx.bed('temple', pl === 'temple' ? 0.7 : yard * 0.4);
    sfx.bed('chant', ritualLeft('temple') > 0 ? (pl === 'temple' ? 0.9 : yard * 0.2) : 0);
    const hy = (shrine.hymn && shrine.hymn.left - el > 0) || ritualLeft('cathedral') > 0;
    sfx.bed('hymn', hy ? (pl === 'cathedral' ? 0.85 : near(CATH.cx, CATH.cz, 70) * 0.12) : 0, { el: shrine.hymn ? shrine.hymn.el + el : 0 });
    const pr = shrine.praise, CH = BUILDINGS.church, prOn = !!pr || ritualLeft('church') > 0;
    sfx.bed('praise', prOn ? (pl === 'church' ? 0.8 : near(CH.cx, CH.cz, 70) * 0.12) : 0, pr ? { song: pr.song, el: pr.el + el } : { song: 0 });
  }

  /* ── 패널 ── */
  function mySpot() { // 지금 쓸 수 있는 자리 (앉아 있으면 그 의자, 서 있으면 1.6m 안 가장 가까운 자리)
    const me = getMe();
    if (me.sit >= 0) return seatSpot.get(me.sit) ?? null;
    let best = null, bd = 1.6;
    for (const s of SPOTS) { if (SEAT_SPOTS.includes(s.kind) || s.bld !== me.pl) continue; const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  const label = (k) => (k === 'hymn' ? (shrine.hymn && shrine.hymn.left - (clk() - shrineAt) > 0 ? '🎶 성가 끄기' : ACTS.hymn.name) : k === 'veil' ? (getMe()?.vl ? '🤍 미사포 벗기' : '🤍 미사포 쓰기') : ACTS[k].name);
  function panel(key, html, mini = false) { if (key === qKey) return; qKey = key; q.hidden = !key; q.classList.toggle('mini', mini); if (key) q.innerHTML = html; }
  let cur = { spot: null, list: [] };
  /* ── 법당 '절하기' = 가장 가까운 빈 방석으로 걸어가서 (자동 걸음 재사용). 방석 위에 있으면 그 자리에서, 막히거나 서버가 거절하면 다음 방석으로 한 번 더 ── */
  const inHall = (me) => me.pl === 'temple' && inside(BUILDINGS.temple, me.x, me.z);
  const onCushion = (me) => SPOTS.some((s) => s.kind === 'cushion' && Math.hypot(s.x - me.x, s.z - me.z) < ON_CUSHION);
  let pend = null; // { tried: 이미 가 본 방석, n: 다시 고른 수, sent: 절을 보낸 방석 }
  function used(me) { // 다른 사람이 서 있거나 행동 중인 방석
    return { others: [...players.values()].filter((p) => p !== me).map((p) => [p.x, p.z]), busy: new Set([...acts].filter(([id]) => id !== me.id).map(([, a]) => a.spot)) };
  }
  function goBow(again = false) {
    const me = getMe();
    if (!again) pend = { tried: new Set(), n: 0 };
    const { others, busy } = used(me), sp = freeCushions(me.x, me.z, others, busy).find((s) => !pend.tried.has(s.id));
    if (!sp) { pend = null; return toast(again ? '빈 방석을 찾지 못했어요' : '빈 방석이 없어요'); }
    pend.tried.add(sp.id);
    if (myAct) { send({ t: 'act', k: 'stop' }); myAct = null; openUI(null); } // 하던 합장·염주는 그만두고 걸어감
    walk(sp.x, sp.z, () => arrive(sp));
  }
  function arrive(sp) {
    const me = getMe(); if (!me || !pend) return;
    const { others, busy } = used(me), taken = busy.has(sp.id) || others.some(([x, z]) => Math.hypot(x - sp.x, z - sp.z) < ON_CUSHION);
    if (taken || Math.hypot(me.x - sp.x, me.z - sp.z) > 1.2) return retry(); // 걷는 사이 누가 먼저 앉았거나 닿지 못함
    me.tr = sp.ry; pend.sent = sp.id; // 불상 쪽을 바라봄 (제자리에서 돌기만)
    send({ t: 'act', k: 'bow', spot: sp.id });
  }
  const retry = () => { if (pend && pend.n++ < 1) goBow(true); else { pend = null; toast('빈 방석을 찾지 못했어요'); } };

  function start(k, extra = {}) {
    const sp = cur.spot, me = getMe();
    if (!me) return;
    if (k === 'bow' && inHall(me) && !onCushion(me)) return goBow();
    if (k === 'sing' && !shrine.praise && !extra.song && !choose) { choose = true; qKey = ''; return; } // 곡 고르기
    choose = false;
    const spot = sp && ACTS[k].at.includes(sp.kind) ? sp.id : -1;
    if (spot >= 0 && !SEAT_SPOTS.includes(sp.kind)) me.tr = sp.ry; // 자리 쪽을 바라봄 (제자리에서 돌기만 → 서버가 '움직임'으로 보지 않음)
    send({ t: 'act', k, spot, ...extra });
  }
  const stop = () => { auto = false; if (myAct) send({ t: 'act', k: 'stop' }); };
  q.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'stop') stop(); else if (a === 'auto') { auto = !auto; qKey = ''; if (auto && !myAct) start('bow'); } else if (a === 'stand') standUp(); else if (a === 'song') start('sing', { song: +b.dataset.n }); else if (a === 'back') { choose = false; qKey = ''; } else if (a) start(a);
  };
  function updatePanel() {
    const me = getMe(), ok = free();
    if (!ok || !me) { panel(''); cur = { spot: null, list: [] }; return; }
    const sp = mySpot(), seated = me.sit >= 0;
    if (!seated && !sitq.hidden) { panel(''); cur = { spot: null, list: [] }; return; } // 앉기 안내가 먼저
    cur = { spot: sp, list: sp ? MENU[sp.kind] : [] };
    const kb = (i) => (TOUCH ? '' : `<kbd>${i + 1}</kbd>`);
    if (myAct) { // 하는 중: 작게 + 그만하기
      const A = ACTS[myAct], title = A.s && A.s !== 'pray' ? STATUS[A.s].join(' ') : A.name + ' 중';
      const extra = myAct === 'bow' ? `<small>절 ${rec.bows || 0} · 오늘 ${rec.day === today() ? rec.today || 0 : 0} / 108</small>` : '';
      panel(`act${myAct}${auto}${rec.bows}${seated}`, `<b>${title}…</b>${extra}<div class="bt">${myAct === 'bow' ? `<button data-a="auto" aria-pressed="${auto}">🔁 자동으로 계속</button><button data-a="bow">한 번 더${kb(0)}</button>` : ''}${A.hold ? `<button data-a="stop">그만하기${TOUCH ? '' : '<kbd>E</kbd>'}</button>` : ''}${seated ? '<button data-a="stand">🧍 일어나기</button>' : ''}</div>`, true);
      return;
    }
    if (choose && sp && MENU[sp.kind].includes('sing')) {
      panel('choose', `<b>🎤 어떤 곡을 부를까요?</b><div class="bt">${SONGS.map((s, i) => `<button data-a="song" data-n="${i}">${s.title}${kb(i)}</button>`).join('')}<button data-a="back">닫기</button></div>`);
      return;
    }
    choose = false;
    if (!sp && inHall(me)) { // 법당 안 통로·자리 밖: 절하기(빈 방석으로)·합장
      cur = { spot: null, list: ['bow', 'palms'] };
      panel(`hall${rec.bows}`, `<b>🙇 법당</b><small>절하기를 누르면 가까운 빈 방석으로 가서 절해요 · 절 ${rec.bows || 0}번</small><div class="bt">${cur.list.map((k, i) => `<button ${i ? '' : 'class="go"'} data-a="${k}">${label(k)}${kb(i)}</button>`).join('')}</div>`, true);
      return;
    }
    if (!sp) { panel(''); return; }
    const sub = sp.kind === 'cushion' || sp.kind === 'beads' ? `절 ${rec.bows || 0}번 · 108배까지 ${108 - ((rec.bows || 0) % 108)}번` : SUB[sp.kind];
    const lit = sp.kind === 'lantern' && shrine.lanterns.some((c) => c[0] === lanternSpots.indexOf(sp) && c[1] - (clk() - shrineAt) > 0);
    panel(`spot${sp.id}${label('hymn')}${label('veil')}${rec.bows}${lit}`, `<b>${WHERE[sp.kind]}</b><small>${lit ? '🪷 이미 밝혀져 있어요 · 다시 밝히면 30분 더' : sub}</small><div class="bt">${cur.list.map((k, i) => `<button ${i ? '' : 'class="go"'} data-a="${k}">${label(k)}${kb(i)}</button>`).join('')}${seated ? '<button data-a="stand">🧍 일어나기</button>' : ''}</div>`);
  }

  /* ── 염주: 108알 세로 줄, 쓸어 넘기기·휠·↑↓ ── */
  const bc = beadsEl.querySelector('canvas'), bx2 = bc.getContext('2d');
  let bOff = 0, bDrag = null, lastBead = 0;
  function flick(dir = 1) {
    const now = clk(); if (now - lastBead < 160) return; lastBead = now; // 서버 제한(초당 8)보다 조금 느리게
    beadN++; bOff = -dir; sfx.play('click', 1); send({ t: 'bead' });
    if (myAct === 'beads' && beadN % 108 === 0) { toast('📿 염주 한 바퀴(108알) 완성!'); sfx.play('yay', 0.8); }
  }
  function drawBeads(dt) {
    bOff += (0 - bOff) * Math.min(1, dt * 10);
    const W = bc.width, H = bc.height, gap = 26, n = Math.ceil(H / gap) + 2; bx2.clearRect(0, 0, W, H);
    bx2.strokeStyle = '#a0704a'; bx2.lineWidth = 2; bx2.beginPath(); bx2.moveTo(W / 2, 0); bx2.lineTo(W / 2, H); bx2.stroke();
    for (let i = -1; i < n; i++) {
      const idx = beadN + i - Math.floor(n / 2), y = H / 2 + (i - Math.floor(n / 2) + bOff) * gap, big = ((idx % 108) + 108) % 108 === 0, c = Math.abs(y - H / 2) < gap / 2;
      const r = big ? 13 : c ? 11 : 9, g = bx2.createRadialGradient(W / 2 - 3, y - 3, 1, W / 2, y, r);
      g.addColorStop(0, c ? '#f6d2a2' : '#d9a878'); g.addColorStop(1, big ? '#7a3e1e' : '#8a5634'); bx2.fillStyle = g; bx2.beginPath(); bx2.arc(W / 2, y, r, 0, 7); bx2.fill();
    }
    beadsEl.querySelector('b').textContent = `${beadN % 108} / 108`;
  }
  bc.addEventListener('pointerdown', (e) => { bDrag = e.clientY; bc.setPointerCapture(e.pointerId); });
  bc.addEventListener('pointermove', (e) => { if (bDrag == null) return; if (Math.abs(e.clientY - bDrag) > 22) { flick(Math.sign(e.clientY - bDrag)); bDrag = e.clientY; } });
  bc.addEventListener('pointerup', () => (bDrag = null)); bc.addEventListener('pointercancel', () => (bDrag = null));
  bc.addEventListener('wheel', (e) => { e.preventDefault(); if (Math.abs(e.deltaY) > 4) flick(Math.sign(e.deltaY)); }, { passive: false });

  /* ── 묵주: 십자가 쪽 4알 + 5단 × (큰 알 1 + 작은 알 10) = 59 ── */
  const rc = rosEl.querySelector('canvas'), rx = rc.getContext('2d');
  const ROS = (() => { const W = 200, cx = W / 2, cy = 80, R = 66, L = []; for (let i = 0; i < 4; i++) L.push({ x: cx, y: 200 - i * 13 - (i ? 4 : 0), big: i === 0 }); for (let i = 0; i < 55; i++) { const a = Math.PI / 2 + ((i + 0.5) / 55) * Math.PI * 2; L.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.95, big: i % 11 === 0 }); } return L; })();
  const prayerOf = (n) => { if (n < 4) return n === 0 ? '주님의 기도' : '성모송'; const k = (n - 4) % 11; return k === 0 ? '주님의 기도' : k === 10 ? '성모송 · 영광송' : '성모송'; };
  function nextRos() { const now = clk(); if (now - lastBead < 160) return; lastBead = now; rosN++; sfx.play('click', 1); send({ t: 'bead' }); if (rosN % 59 === 0) sfx.play('yay', 0.8); }
  function drawRos() {
    const n = rosN % 59; rx.clearRect(0, 0, rc.width, rc.height);
    rx.strokeStyle = '#c9b8e0'; rx.lineWidth = 1.5; rx.beginPath(); ROS.forEach((b, i) => (i ? rx.lineTo(b.x, b.y) : rx.moveTo(b.x, b.y))); rx.lineTo(ROS[4].x, ROS[4].y); rx.stroke();
    rx.fillStyle = '#c9a066'; rx.fillRect(98, 208, 4, 20); rx.fillRect(92, 213, 16, 4); // 십자가
    ROS.forEach((b, i) => { rx.fillStyle = i < n ? '#b79cf0' : i === n ? '#ff9fbf' : '#efe8f6'; rx.beginPath(); rx.arc(b.x, b.y, i === n ? (b.big ? 8 : 6.5) : b.big ? 6 : 4.2, 0, 7); rx.fill(); rx.strokeStyle = '#8a73b4'; rx.lineWidth = 1; rx.stroke(); });
    rosEl.querySelector('b').textContent = prayerOf(n); rosEl.querySelector('small').textContent = `${n} / 59 · ${TOUCH ? '알을 눌러 하나씩' : '알을 누르거나 ↑ 키'}`;
  }
  rc.addEventListener('pointerdown', (e) => { e.preventDefault(); nextRos(); });

  /* ── 고해 체험: 글은 이 화면 안에서만. 전송·저장하지 않음 ── */
  confEl.onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a, ta = confEl.querySelector('textarea');
    if (a === 'let') {
      const fly = confEl.querySelector('.fly'), chars = [...ta.value].filter((c) => c.trim()).slice(0, 80);
      fly.replaceChildren(...chars.map((c, i) => { const s = document.createElement('span'); s.textContent = c; s.style.cssText = `left:${10 + ((i * 37) % 80)}%;top:${20 + (i % 4) * 14}px;--dx:${((i * 53) % 120) - 60}px;animation-delay:${(i % 12) * 0.05}s`; return s; }));
      ta.value = ''; sfx.play('chime', 0.8); setTimeout(() => fly.replaceChildren(), 2600);
    } else if (a === 'x') stop();
  };

  /* ── 피아노: 2옥타브 (C4~C6) ── */
  const kbEl = piaEl.querySelector('.kb'), WHITE = [0, 2, 4, 5, 7, 9, 11], keyEls = new Map();
  { const whites = []; for (let o = 0; o < 2; o++) for (const w of WHITE) whites.push(o * 12 + w); whites.push(24);
    const KN = ['도', '레', '미', '파', '솔', '라', '시'], PCK = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K'];
    whites.forEach((n, i) => { const d = document.createElement('div'); d.className = 'w'; d.dataset.n = n; d.textContent = (TOUCH ? '' : i < 8 ? PCK[i] + ' ' : '') + KN[i % 7]; kbEl.append(d); keyEls.set(n, d); });
    whites.forEach((n, i) => { if (i < whites.length - 1 && [0, 2, 5, 7, 9].includes(n % 12)) { const d = document.createElement('div'); d.className = 'bk'; d.dataset.n = n + 1; d.style.left = `${((i + 1) / whites.length) * 100 - 2.1}%`; d.textContent = TOUCH || i > 6 ? '' : { 0: 'W', 2: 'E', 5: 'T', 7: 'Y', 9: 'U' }[n % 12]; kbEl.append(d); keyEls.set(n + 1, d); } }); }
  let lastNotes = [];
  function hit(n) {
    const now = clk(); lastNotes = lastNotes.filter((t) => now - t < 1000); if (lastNotes.length >= 8) return; lastNotes.push(now); // 서버와 같은 초당 8음
    sfx.piano(n, 1); send({ t: 'note', n }); const el = keyEls.get(n); if (el) { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 160); }
  }
  kbEl.addEventListener('pointerdown', (e) => { const k = e.target.closest('[data-n]'); if (k) { e.preventDefault(); hit(+k.dataset.n); } });
  piaEl.querySelector('[data-a=x]').onclick = stop;

  /* ── 찬양 가사 ── */
  function drawLyrics() {
    const me = getMe(), pr = shrine.praise, ritual = ritualLeft('church') > 0;
    const show = me && me.pl === 'church' && (pr || ritual || myAct === 'sing');
    lyrEl.hidden = !show; if (!show) return;
    const song = SONGS[pr?.song ?? 0], el = pr ? pr.el + (clk() - shrineAt) : (clk() % (LINE_MS * 4)), line = Math.floor(el / LINE_MS) % song.lines.length;
    const k = `${song.title}${line}`; if (lyrEl.dataset.k === k) return; lyrEl.dataset.k = k;
    const singers = [...acts.values()].filter((a) => a.k === 'sing').length;
    lyrEl.innerHTML = `<b>🎤 ${song.title}${singers > 1 ? ` · ${singers}명이 함께` : ''}</b>` + song.lines.map((l, i) => `<div class="${i === line ? 'cur' : ''}">${l}</div>`).join('');
  }
  function drawBanner() {
    const me = getMe(), r = me && rituals.get(me.pl), left = r ? r.until - clk() : 0;
    banEl.hidden = !(left > 0); if (banEl.hidden) return;
    const n = [...players.values()].filter((p) => p.pl === me.pl).length;
    const html = `<b>🔔 ${SACRED[me.pl].name} ${r.name}</b> · ${fmt(left)} 남음 · ${n}명이 함께하고 있어요`;
    if (banEl.innerHTML !== html) banEl.innerHTML = html;
  }
  function openUI(k) {
    beadsEl.hidden = k !== 'beads'; rosEl.hidden = k !== 'rosary'; confEl.hidden = k !== 'confess'; piaEl.hidden = k !== 'piano';
    document.body.classList.toggle('rt-piano', k === 'piano');
    if (k === 'beads') beadN = 0; if (k === 'rosary') rosN = 0;
    if (k === 'confess') setTimeout(() => confEl.querySelector('textarea').focus(), 50);
  }
  function startSound(m, p) {
    const sp = SPOTS[m.spot] ?? { x: p.x, z: p.z, bld: p.pl };
    if (m.k === 'bow') { sfx.play('moktak', gainAt(sp.x, sp.z, sp.bld, 40)); setTimeout(() => sfx.play('moktak', gainAt(sp.x, sp.z, sp.bld, 40) * 0.7), 1300); }
    else if (m.k === 'bell') { bellHit = clk() + 620; sfx.play('bell', Math.max(gainAt(bellSpot.x, bellSpot.z, 'temple', 260), near(bellSpot.x, bellSpot.z, 400) * 0.25), 0.62); }
    else if (m.k === 'candle') sfx.play('candle', gainAt(sp.x, sp.z, sp.bld, 20), 0.5);
    else if (m.k === 'lantern') sfx.play('chime', gainAt(sp.x, sp.z, 'temple', 40), 0.8);
  }
  function bells(place) { // 의식 시작 종 3번: 사찰은 범종, 성당·교회는 종탑 종
    const B = BUILDINGS[place], g = place === 'temple' ? Math.max(gainAt(bellSpot.x, bellSpot.z, 'temple', 260), near(bellSpot.x, bellSpot.z, 400) * 0.25) : Math.max(gainAt(B.cx, B.cz, place, 200), near(B.cx, B.cz, 260) * 0.5);
    for (let i = 0; i < 3; i++) { sfx.play(place === 'temple' ? 'bell' : 'churchBell', g, i * (place === 'temple' ? 4 : 2.2)); if (place === 'temple') setTimeout(() => (bellHit = clk()), i * 4000); }
  }

  return {
    acting: () => !!myAct,
    owns: () => !!myAct || (getMe()?.sit >= 0 && !q.hidden), // 의자에 앉아 있을 때 이 패널이 '일어나기'까지 맡음
    key(e) { // 처리했으면 true (game.js 가 걷기·점프로 안 씀)
      const me = getMe(); if (!me) return false;
      if (myAct === 'piano') {
        if (e.code === 'Escape') { stop(); return true; }
        if (e.code in NOTE_KEYS) { if (!e.repeat) hit(NOTE_KEYS[e.code] + (e.shiftKey && NOTE_KEYS[e.code] < 12 ? 12 : 0)); return true; }
        return ['KeyQ', 'KeyZ', 'KeyX', 'KeyC'].includes(e.code); // 건반 근처 키는 삼킴
      }
      if (myAct === 'beads' && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) { flick(e.code === 'ArrowUp' ? -1 : 1); return true; }
      if (myAct === 'rosary' && e.code === 'ArrowUp') { nextRos(); return true; }
      if (e.code === 'Escape' && myAct) { stop(); return true; }
      const i = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
      if (i != null) {
        if (choose) { if (SONGS[i]) start('sing', { song: i }); return true; }
        if (myAct === 'bow' && i === 0) { start('bow'); return true; }
        const k = cur.list[i] ?? (i === 2 && !cur.spot && (me.pl === 'cathedral' ? 'cross' : me.pl === 'temple' ? 'palms' : null)); // 3 키: 성당 안 어디서나 성호, 사찰 안 어디서나 합장
        if (k) { start(k); return true; }
        return false;
      }
      if (e.code === 'KeyE') {
        if (myAct && ACTS[myAct].hold) { stop(); return true; }
        if (myAct) return true;
        if (!q.hidden && cur.list[0]) { start(cur.list[0]); return true; }
      }
      return false;
    },
    handle(m) {
      if (m.t === 'welcome') {
        rec = m.sacred || {}; acts.clear(); rituals.clear(); myAct = null; openUI(null);
        const r = m.rit; if (!r) return false;
        for (const a of r.acts) acts.set(a.id, { ...a, t0: clk() - a.el });
        shrine = r.shrine; shrineAt = clk();
        for (const x of r.rituals) rituals.set(x.place, { name: x.name, until: clk() + x.left });
        return false;
      }
      const me = getMe(), p = players.get(m.id), mine = me && m.id === me.id;
      if (m.t === 'act') {
        acts.set(m.id, { k: m.k, spot: m.spot, t0: clk(), ms: m.ms, song: m.song });
        if (p) { p.s = m.s; startSound(m, p); if (m.k === 'bell') bubble(p, `🔔 ${p.name}님이 범종을 쳤어요`); if (m.k === 'lantern') bubble(p, `🪷 ${p.name}님이 연등을 밝혔어요`); if (m.k === 'sing' && SONGS[m.song]) bubble(p, `🎤 ${SONGS[m.song].title}`); }
        if (mine) { myAct = m.k; qKey = ''; openUI(m.k); pend = null; }
      } else if (m.t === 'actend') {
        acts.delete(m.id); if (p) p.s = m.s;
        if (mine) { myAct = null; qKey = ''; openUI(null); if (m.k === 'bow' && m.r === 'done' && auto) setTimeout(() => { if (auto && !myAct) start('bow'); }, 250); else if (m.r !== 'done') auto = false; }
      } else if (m.t === 'actno') { if (m.k === 'bow' && pend?.sent != null) { pend.sent = null; retry(); } else { toast(m.error); auto = false; } }
      else if (m.t === 'rec') {
        rec = m.rec; qKey = '';
        if (m.ev === '108') { toast('🎉 108배 완성!'); sfx.play('yay', 1); }
        else if (m.ev === 'rosaries') toast('🙏 묵주기도 한 바퀴 완성!');
        else if (m.ev === 'ritual') toast('🔔 공동 의식에 함께했어요');
        if (!recEl.hidden) openRec();
      } else if (m.t === 'shrine') { shrine = m; shrineAt = clk(); qKey = ''; }
      else if (m.t === 'veil') { if (p) p.vl = m.on; qKey = ''; }
      else if (m.t === 'note') { if (!mine && p) sfx.piano(m.n, gainAt(p.x, p.z, 'church', 45)); }
      else if (m.t === 'ritual') {
        if (m.left > 0) {
          rituals.set(m.place, { name: m.name, until: clk() + m.left });
          const ko = m.name.charCodeAt(m.name.length - 1) - 0xac00, txt = `🔔 ${SACRED[m.place].name} ${m.name}${ko % 28 ? '이' : '가'} 시작됐어요`; // 받침 있으면 '이'
          ritToast = clk() - ritToastAt < 2000 ? `${ritToast} · ${txt.slice(3)}` : txt; ritToastAt = clk(); toast(ritToast); bells(m.place); // 사찰·성당이 같이 시작하면 한 줄로
          if (me?.pl === 'temple' && m.place === 'temple') setTimeout(() => toast(TOUCH ? '🤲 합장으로 함께해 보세요' : '🤲 3 키로 합장하며 함께해 보세요'), 2600);
        } else rituals.delete(m.place);
      } else return false;
      return true;
    },
    update(dt) {
      const me = getMe(); if (!me) return;
      const t = clk(), night = window.__village?.atmo?.state?.night ?? 0;
      for (const p of players.values()) { const a = acts.get(p.id); p.av.act = a ? a.k : null; p.av.actT = a ? (t - a.t0) / 1000 : 0; p.av.actFont = a && SPOTS[a.spot]?.kind === 'font'; p.av.veil = !!p.vl; }
      if (SACRED[me.pl] && hintSeen[me.pl] !== today()) { hintSeen[me.pl] = today(); try { localStorage.setItem('village.rhint', JSON.stringify(hintSeen)); } catch {} toast(HINTS[me.pl]); } // 하루 첫 입장 한 줄 안내
      updatePanel();
      if (myAct === 'beads') drawBeads(dt); if (myAct === 'rosary') drawRos();
      drawLyrics(); drawBanner(); draw3D(night); sound();
    },
  };
}
