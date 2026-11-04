// 불멍 캠프 화면: 열림/닫힘(서버가 정함: 매일 오후 7시~오전 6시) → 점화·소등 연출과 알림, 안내판 글, 모닥불 소리,
// '🎆 불꽃놀이 할까요?' 패널([🎆 불꽃놀이] E 키 · [✨ 불꽃 스틱] 2 키 · 폰 버튼), 손으로 그리는 불꽃놀이·불꽃 스틱(fireworks.js). game.js 는 이 모듈과만 이야기함
import * as THREE from 'three';
import { FIRE, FW, STICK, FW_RANGE, SEATS, fireDist } from './world.js';
import { createCampSite, pointScale } from './camp-site.js';
import { createFireworks } from './fireworks.js';
import { sfx } from './sfx.js';

const TOUCH = matchMedia('(pointer:coarse)').matches;
const CSS = `
#fwq{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(78px + env(safe-area-inset-bottom));padding:10px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:220px;max-width:94vw;animation:pop .2s;z-index:3;text-align:center}
#fwq b{font-size:17px}#fwq small{opacity:.7;font-size:13px}#fwq .bt{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
#fwq button{padding:8px 14px;min-height:40px;border-radius:14px;background:#fff;border:2px solid #f0d9c4;font-size:15px;touch-action:manipulation}
#fwq button.go{background:linear-gradient(135deg,#ff7a3c,#e0408a);border-color:transparent;color:#fff}#fwq button.k{background:linear-gradient(135deg,#ffb238,#ff7a3c)}
#fwq kbd{font:12px/1 inherit;background:#0001;border-radius:5px;padding:2px 5px;margin-left:5px;opacity:.75}
#fwq.mini{padding:6px 12px;min-width:0}#fwq.mini b{font-size:15px}
#campBan{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:6;pointer-events:none;font-size:30px;font-weight:800;color:#fff;text-shadow:0 0 18px #ff8a3c,0 2px 4px #0008;white-space:nowrap;animation:campBan 3.6s ease-out forwards}
@keyframes campBan{0%{opacity:0;scale:.7}12%{opacity:1;scale:1.05}22%{scale:1}80%{opacity:1}100%{opacity:0}}
@media (max-height:520px) and (orientation:landscape){
  #fwq{bottom:calc(14px + env(safe-area-inset-bottom));padding:6px 12px;gap:4px;max-width:calc(100vw - 260px)}#fwq b{font-size:15px}#fwq small{font-size:12px}#fwq button{padding:5px 10px;min-height:36px;font-size:14px}
  #campBan{font-size:22px}
}`;
const hoursText = (ms) => (ms >= 3.6e6 ? `${Math.ceil(ms / 3.6e6)}시간 뒤` : `${Math.max(1, Math.ceil(ms / 6e4))}분 뒤`);

export function createCamp({ scene, camera, renderer, Q, players, getMe, send, toast, bubble, host, free, sitq, standUp }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const site = createCampSite(scene, Q);
  const fw = createFireworks({ scene, camera, renderer, Q, getMe, send, toast, bubble, players });
  const q = host.appendChild(Object.assign(document.createElement('div'), { id: 'fwq', className: 'panel', hidden: true }));
  let open = false, nextAt = 0, ign = 0, qKey = null, // qKey: 패널 내용 키 (null = 다시 그림, '' = 숨김)
    dismissed = -1e9, boardKey = '', lastEnd = -1e9;
  const clk = () => performance.now();
  const dir = new THREE.Vector3();
  function board() { // 안내판: 열려 있으면 '타오르는 중', 닫혀 있으면 몇 시간 뒤 열리는지
    const left = nextAt - clk(), k = open ? 'on' : 'off' + hoursText(left);
    if (k === boardKey) return; boardKey = k;
    site.board('🔥 불멍 · 매일 오후 7시 ~ 오전 6시', open ? '지금 불이 타오르고 있어요' : `지금은 불이 꺼져 있어요 (${hoursText(left)} 열려요)`, open);
  }
  const big = (text) => { const el = document.createElement('div'); el.id = 'campBan'; el.textContent = text; document.getElementById('campBan')?.remove(); document.body.append(el); setTimeout(() => el.remove(), 3700); };
  const go = (kind) => { const me = getMe(); if (!me) return; camera.getWorldDirection(dir); fw.start(Math.atan2(dir.x, dir.z), kind); qKey = null; }; // 바라보는 방향으로 (스틱은 아바타가 그쪽으로 돌아섬)
  q.onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'go') go(); else if (a === 'stick') go('stick'); else if (a === 'no') { dismissed = clk(); qKey = null; } else if (a === 'stand') standUp();
  };
  function panel(key, html, mini) { if (key === qKey) return; qKey = key; q.hidden = !key; q.classList.toggle('mini', !!mini); if (key) q.innerHTML = html; }
  function updatePanel(night) {
    const me = getMe();
    if (!me || fw.drawing() || !free() || fireDist(me.x, me.z) > FW_RANGE || me.fl) return panel('');
    const seated = me.sit >= 0, onFire = seated && SEATS[me.sit]?.kind === 'fire';
    if (!seated && !sitq.hidden) return panel(''); // 앉기 안내가 먼저
    if (seated && !onFire) return panel('');
    if (clk() - dismissed < 45000) return panel(''); // '아니요' 하면 잠깐 숨김
    if (!open) return panel('closed', `<b>🎆 불꽃놀이</b><small>불멍이 열리면 할 수 있어요 (오후 7시~오전 6시)</small><div class="bt"><button data-a="no">닫기</button></div>`, true);
    const wait = Math.ceil((FW.cooldown - (clk() - lastEnd)) / 1000), waitK = clk() - lastEnd < STICK.cooldown;
    const sub = wait > 0 ? `불꽃을 다시 준비하고 있어요 · ${wait}초` : `하늘에 그리면 그 모양대로 터져요 · 스틱은 눈앞 허공에${night < 0.4 ? ' · 밤에 더 예뻐요' : ''}`;
    panel(`open${seated}${wait > 0 ? wait : 0}${waitK}${night < 0.4}`, `<b>🎆 불꽃놀이 할까요?</b><small>${sub}</small><div class="bt"><button class="go" data-a="go">🎆 불꽃놀이${TOUCH ? '' : '<kbd>E</kbd>'}</button><button class="go k" data-a="stick">✨ 불꽃 스틱${TOUCH ? '' : '<kbd>2</kbd>'}</button><button data-a="no">아니요</button>${onFire ? '<button data-a="stand">🧍 일어나기</button>' : ''}</div>`);
  }
  function setOpen(o, next, show) {
    const was = open; open = o; nextAt = clk() + next; boardKey = '';
    if (!show) { ign = o ? 1 : 0; return; }
    if (o === was) return;
    const me = getMe(), here = me && fireDist(me.x, me.z) < 60;
    if (o) { toast('🔥 불멍 캠프가 열렸어요!'); if (here) { big('🔥 불멍 캠프가 열렸어요!'); sfx.play('candle', 1); } }
    else { toast('🌅 불멍 시간이 끝났어요'); if (here) big('🌅 불멍 시간이 끝났어요'); }
  }
  const api = {
    open: () => open,
    owns: () => getMe()?.sit >= 0 && !q.hidden, // 불멍 벤치에 앉아 있을 때 이 패널이 '일어나기'까지 맡음
    drawing: fw.drawing,
    key(e) {
      if (fw.key(e)) return true;
      if (e.code === 'KeyE' && !q.hidden && q.querySelector('[data-a=go]')) { go(); return true; }
      if (e.code === 'Digit2' && !q.hidden && q.querySelector('[data-a=stick]')) { go('stick'); return true; } // 2: 불꽃 스틱 (캠프엔 다른 1·2·3 활동이 없음)
      return false;
    },
    handle(m) {
      if (m.t === 'welcome') { if (m.camp) { setOpen(m.camp.open, m.camp.next, false); fw.snapshot(m.camp.fw); } return false; }
      if (m.t === 'camp') { setOpen(m.open, m.next, true); qKey = null; return true; }
      if (m.t === 'fw' && m.k === 'end' && m.id === getMe()?.id) lastEnd = clk();
      if (m.t === 'fw' && m.k === 'start' && m.id === getMe()?.id) qKey = null;
      return fw.handle(m);
    },
    update(dt) {
      const night = window.__village?.atmo?.state?.night ?? 0;
      ign += ((open ? 1 : 0) - ign) * Math.min(1, dt * (open ? 0.38 : 0.3)); // 켜질 땐 작은 불씨 → 몇 초 만에 큰 불, 꺼질 땐 서서히
      if (open && ign < 0.02) ign = 0.02;
      const e = open ? ign * ign * (3 - 2 * ign) : ign;
      site.update(dt, { ign: e < 0.004 ? 0 : e, night, cam: camera.position, scale: pointScale(camera, renderer) });
      fw.update(dt, night);
      const me = getMe();
      if (me) { const d = fireDist(me.x, me.z); sfx.bed('fire', e * Math.max(0, 1 - d / 48) ** 1.5 * 0.95); }
      board(); updatePanel(night);
    },
    _fw: fw, // 시험·사진용
    get ign() { return ign; },
  };
  window.__camp = api; // 시험·사진용
  return api;
}
