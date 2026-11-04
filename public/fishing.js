// 연못 낚시 화면: '🎣 낚시하시겠어요?' 안내, 낚싯대·줄·찌(코드로 만든 3D), 입질·당기기 버튼, 결과 팝업, 낚시 도감.
// 규칙(거리·입질 시각·물고기 뽑기)은 서버 fishing.js 가 심판. 화면은 보여 주기만 함
import * as THREE from 'three';
import { POND } from './world.js';
import { FISH, FISH_BY, FISH_NEAR, FISH_FAR, REEL_MS } from './fishdata.js';

const TOUCH = matchMedia('(pointer:coarse)').matches;
const CSS = `
#fsq{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(78px + env(safe-area-inset-bottom));padding:10px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:200px;animation:pop .2s}
#fsq b{font-size:18px}#fsq small{opacity:.7;font-size:13px}
#fsq .bt,#fsRes .bt{display:flex;gap:8px;justify-content:center;margin-top:4px}
#fsq button,#fsRes button{padding:8px 18px;min-height:40px;border-radius:14px;background:#fff;border:2px solid #f0d9c4;font-size:16px}
#fsq button.go,#fsRes button.go{background:#1fa2b8;border-color:#1fa2b8;color:#fff}
#fsReel{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(74px + env(safe-area-inset-bottom));width:112px;height:112px;border-radius:50%;background:#ff922b;color:#fff;font-size:21px;line-height:1.15;box-shadow:0 5px 0 #d9480f,var(--sh);animation:fs-pulse .32s ease-in-out infinite alternate;touch-action:manipulation;z-index:4}
#fsReel small{display:block;font-size:12px;opacity:.85}
#fsReel:active{box-shadow:0 1px 0 #d9480f;margin-bottom:-4px}
@keyframes fs-pulse{to{box-shadow:0 5px 0 #d9480f,0 0 0 16px rgba(255,146,43,.3)}}
#fsBite{position:fixed;left:50%;top:17%;font-size:58px;color:#fff;-webkit-text-stroke:3px #e8590c;text-shadow:0 4px 0 #e8590c,0 10px 20px rgba(0,0,0,.3);pointer-events:none;white-space:nowrap;animation:fs-shake .11s linear infinite alternate}
@keyframes fs-shake{from{transform:translate(-52%,-50%) rotate(-5deg)}to{transform:translate(-48%,-50%) rotate(5deg)}}
#fsRes{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);padding:12px 24px 14px;min-width:240px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:3px;animation:pop .25s;z-index:4}
.fs-ic{font-size:66px;line-height:1.15;animation:fs-jump .7s cubic-bezier(.3,1.7,.5,1)}
.fs-ic span{display:inline-block}
@keyframes fs-jump{0%{transform:translateY(50px) scale(.2) rotate(-40deg);opacity:0}60%{opacity:1}100%{transform:none}}
.fs-nm{font-size:24px}.fs-cm{font-size:18px;color:#1c7ed6;margin-left:6px}
.fs-st{color:#fab005;font-size:18px;letter-spacing:2px}
.fs-new{background:#fff3bf;border-radius:999px;padding:3px 12px;font-size:14px}
.fs-sub{opacity:.7;font-size:14px}
#fsDex{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:84dvh;overflow:auto;padding:12px 14px 14px;z-index:6;animation:pop .2s}
.fs-hd{display:flex;align-items:center;gap:10px;margin-bottom:8px}.fs-hd b{font-size:20px}.fs-hd span{opacity:.7;font-size:15px}
.fs-hd button{margin-left:auto;width:40px;height:40px;border-radius:50%;background:#fff;font-size:18px;flex:none}
.fs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.fs-card{background:#fff;border-radius:14px;padding:6px 4px 8px;text-align:center;border:2px solid #f0e4d6;overflow:hidden}
.fs-card i{font-style:normal;font-size:34px;display:block;height:46px;line-height:46px}.fs-card i span{display:inline-block}
.fs-card b{display:block;font-size:15px}.fs-card small{display:block;font-size:12px;opacity:.7}.fs-card em{display:block;font-style:normal;color:#fab005;font-size:12px;letter-spacing:1px}
.fs-card.no{background:#f4f1ee;opacity:.6}
@media (pointer:coarse),(max-width:700px){#fsReel{left:auto;right:150px;transform:none;bottom:calc(22px + env(safe-area-inset-bottom))}}
@media (max-height:520px) and (orientation:landscape){
  #fsq{bottom:calc(14px + env(safe-area-inset-bottom));padding:8px 14px}
  #fsReel{width:96px;height:96px;font-size:18px;right:140px;bottom:calc(14px + env(safe-area-inset-bottom))}
  #fsBite{font-size:42px;top:22%}
  #fsRes{top:42%;padding:8px 18px 10px}.fs-ic{font-size:46px}.fs-nm{font-size:20px}
  #fsDex{max-height:92dvh;padding:8px 12px 10px}.fs-grid{grid-template-columns:repeat(5,1fr);gap:6px}
  .fs-card{padding:3px 2px 5px}.fs-card i{font-size:26px;height:32px;line-height:32px}.fs-card b{font-size:13px}
}`;
const stars = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '🗑️ 쓰레기…');
const icon = (f) => `<span style="${f.fx || ''}">${f.icon}</span>`;

export function createFishing({ scene, players, getMe, send, toast, bubble, host, menu, canPrompt }) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const mk = (h, parent = host) => { const d = document.createElement('div'); d.innerHTML = h; return parent.appendChild(d.firstElementChild); };
  const q = mk('<div id="fsq" class="panel" hidden></div>');
  const reelBtn = mk(`<button id="fsReel" hidden>🎣<br>당기기!${TOUCH ? '' : '<small>E 키</small>'}</button>`);
  const biteEl = mk('<div id="fsBite" hidden>❗ 입질!</div>');
  const res = mk('<div id="fsRes" class="panel" hidden></div>');
  const dexEl = mk('<div id="fsDex" class="panel" hidden></div>');
  // 설정 메뉴: '내 계정' 위에 '낚시 도감'
  const acct = menu.querySelector('[data-a="edit"]')?.previousElementSibling;
  const mi = document.createElement('div');
  mi.innerHTML = '<div class="hd">🎣 낚시</div><button data-fish="dex"><b>낚시 도감</b><small>잡은 물고기 모아 보기</small></button>';
  acct ? acct.before(...mi.children) : menu.append(...mi.children);
  menu.querySelector('[data-fish]').onclick = () => { menu.hidden = true; openDex(); };

  let st = '', pendAt = 0, dismissed = false, qKey = '', dex = {}, resT = 0, holdT = 0;
  const clk = () => performance.now() / 1000;
  const busy = () => st === 'pend' || st === 'wait' || st === 'bite';
  function setSt(s) { st = s; reelBtn.hidden = biteEl.hidden = s !== 'bite'; }
  function panel(key, html) { if (key === qKey) return; qKey = key; q.hidden = !key; if (key) q.innerHTML = html; }
  function cast() { if (busy()) return; send({ t: 'fish', a: 'cast' }); setSt('pend'); pendAt = clk(); res.hidden = true; }
  function reel() { if (st === 'wait' || st === 'bite') { send({ t: 'fish', a: 'reel' }); setSt('pend'); pendAt = clk(); } }
  function cancel() { if (busy()) send({ t: 'fish', a: 'stop' }); setSt(''); }
  q.onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'cast') cast(); else if (a === 'no') { dismissed = true; setSt(''); } else if (a === 'stop') cancel(); else if (a === 'dex') openDex();
  };
  reelBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); reel(); });
  res.onclick = (e) => { const a = e.target.closest('button')?.dataset.a; if (a === 'again') cast(); else if (a) res.hidden = true; };
  dexEl.onclick = (e) => { if (e.target.closest('[data-a=x]')) dexEl.hidden = true; };
  function showRes(html, ms) {
    res.innerHTML = html; res.hidden = false; res.style.animation = 'none'; res.offsetWidth; res.style.animation = '';
    clearTimeout(resT); resT = setTimeout(() => (res.hidden = true), ms);
  }
  function openDex() {
    const got = FISH.filter((f) => dex[f.k]).length;
    dexEl.innerHTML = `<div class="fs-hd"><b>🎣 낚시 도감</b><span>${got} / ${FISH.length}종</span><button data-a="x" aria-label="닫기">✕</button></div><div class="fs-grid">` +
      FISH.map((f) => { const e = dex[f.k]; return e
        ? `<div class="fs-card"><i>${icon(f)}</i><b>${f.name}</b><small>${e.n}${f.max ? `마리 · 최대 ${e.best}cm` : '개'}</small><em>${f.star ? stars(f.star) : '쓰레기'}</em></div>`
        : '<div class="fs-card no"><i>❓</i><b>???</b><small>아직 못 잡았어요</small></div>'; }).join('') + '</div>';
    dexEl.hidden = false;
  }

  /* ── 3D: 낚싯대(아바타 손에)·줄·찌·물결·물방울·튀어나오는 물고기. 밤에도 보이게 찌·줄은 조명 안 받는 재질 */
  const lam = (c, e = 0.45) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e });
  const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, fog: false, ...o });
  const ROD_L = 2.1, TILT = 0.95; // 막대 길이, 앞으로 기울인 각(세로에서)
  const G = {
    rod: new THREE.CylinderGeometry(0.011, 0.026, ROD_L, 6).translate(0, ROD_L / 2, 0),
    grip: new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8).translate(0, 0.08, 0),
    reel: new THREE.CylinderGeometry(0.055, 0.055, 0.05, 10).rotateZ(Math.PI / 2).translate(0.05, 0.24, 0),
    top: new THREE.SphereGeometry(0.095, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    bot: new THREE.SphereGeometry(0.095, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    stick: new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5).translate(0, 0.12, 0),
    ring: new THREE.RingGeometry(0.86, 1, 36).rotateX(-Math.PI / 2),
    drop: new THREE.SphereGeometry(0.028, 6, 4),
  };
  const MAT = { rod: lam('#8a5a32'), grip: lam('#f2c879', 0.35), reel: lam('#c9ced6', 0.4), red: basic('#ff2d55'), white: basic('#ffffff'),
    line: new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, fog: false }), ring: basic('#ffffff', { transparent: true, opacity: 0.6, depthWrite: false }) };
  const sprites = {};
  function fishSprite(k) { // 이모지를 그림으로 (물고기 꾸밈 필터도 같이)
    if (!sprites[k]) {
      const f = FISH_BY[k], c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); x.filter = f.fx?.match(/filter:([^;]+)/)?.[1] ?? 'none';
      x.font = '100px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(f.icon, 64, 70);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      sprites[k] = new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false });
    }
    const s = new THREE.Sprite(sprites[k]); s.scale.setScalar(0.7); return s;
  }
  const NP = 14, rigs = new Map(); // id → { bx, bz, t0, bite, bt, end, g(만든 3D) }
  function build(r, p) {
    const rod = new THREE.Group();
    rod.add(new THREE.Mesh(G.rod, MAT.rod), new THREE.Mesh(G.grip, MAT.grip), new THREE.Mesh(G.reel, MAT.reel));
    rod.position.set(0.3, 0.6, 0.2); rod.rotation.x = TILT; p.av.root.add(rod);
    const bob = new THREE.Group(); bob.add(new THREE.Mesh(G.top, MAT.red), new THREE.Mesh(G.bot, MAT.white), new THREE.Mesh(G.stick, MAT.red));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    const line = new THREE.Line(lg, MAT.line); line.frustumCulled = false;
    const ring = new THREE.Mesh(G.ring, MAT.ring.clone());
    const drops = Array.from({ length: 6 }, () => new THREE.Mesh(G.drop, MAT.white));
    scene.add(bob, line, ring, ...drops);
    r.g = { rod, bob, line, ring, drops, fish: null };
  }
  function drop(r) {
    if (!r.g) return;
    const g = r.g; g.rod.removeFromParent(); scene.remove(g.bob, g.line, g.ring, ...g.drops); if (g.fish) scene.remove(g.fish);
    g.line.geometry.dispose(); g.ring.material.dispose();
  }
  const tip = new THREE.Vector3(), B = new THREE.Vector3();
  function animRig(r, p, t) {
    const g = r.g, age = t - r.t0, e = r.end ? t - r.end.t : -1;
    let tilt = TILT;
    if (r.bite && !r.end) tilt = TILT + 0.18 + Math.sin(t * 38) * 0.05; // 물고기가 당겨서 휨
    if (r.end?.r === 'catch') tilt = TILT - 0.6 * Math.min(1, e / 0.15); // 휙 들어 올림
    g.rod.rotation.x = tilt;
    g.rod.updateWorldMatrix(true, false); g.rod.localToWorld(tip.set(0, ROD_L, 0));
    // 팔: 두 손으로 낚싯대를 앞으로 (animate() 다음에 덮어씀)
    p.av.arms[1].rotation.x = -0.95 - (r.bite && !r.end ? 0.2 : 0); p.av.arms[0].rotation.x = -0.7;
    // 찌: 던지면 포물선으로 날아가 퐁당 → 둥실 / 입질이면 쏙쏙 잠김
    const u = Math.min(1, age / 0.55), landed = u >= 1;
    B.set(r.bx, 0.08 + Math.sin(t * 2.6 + r.bx) * 0.012, r.bz);
    if (!landed) B.lerpVectors(tip, B.set(r.bx, 0.08, r.bz), u).y += Math.sin(Math.PI * u) * 0.8;
    else if (r.bite && !r.end) B.y = 0.02 + Math.sin(t * 26) * 0.035;
    else if (!r.end && Math.sin(t * 1.7 + r.bx * 3) > 0.96) B.y -= 0.025; // 가끔 톡톡 (간보기)
    if (r.end?.r === 'catch') B.lerpVectors(B, tip, Math.min(1, e / 0.35));
    else if (r.end) B.y -= Math.min(0.2, e * 0.8);
    g.bob.position.copy(B);
    // 줄: 끝에서 찌까지, 입질 땐 팽팽하게
    const pa = g.line.geometry.attributes.position, sag = r.bite || !landed ? 0.05 : 0.35;
    for (let i = 0; i < NP; i++) { const s = i / (NP - 1); pa.setXYZ(i, tip.x + (B.x - tip.x) * s, tip.y + (B.y + 0.12 - tip.y) * s - Math.sin(Math.PI * s) * sag, tip.z + (B.z - tip.z) * s); }
    pa.needsUpdate = true;
    // 물결: 기다릴 땐 느리게, 입질 땐 빠르게
    const per = r.bite ? 0.4 : 2.2, w = (((t - r.t0 - 0.55) / per) % 1 + 1) % 1;
    g.ring.visible = landed && !(r.end && r.end.r !== 'catch');
    g.ring.position.set(r.bx, 0.075, r.bz); g.ring.scale.setScalar(0.12 + w * (r.bite ? 0.55 : 0.4)); g.ring.material.opacity = (1 - w) * 0.6;
    g.drops.forEach((d, i) => { // 물방울 튐 (입질·잡을 때)
      const on = landed && (r.bite || age < 0.9) && (!r.end || e < 0.4), ph = (((t - r.bt) * 2.4 + i / 6) % 1 + 1) % 1, a = i * 1.05;
      d.visible = on;
      if (on) d.position.set(r.bx + Math.cos(a) * 0.3 * ph, 0.06 + Math.sin(Math.PI * ph) * 0.38, r.bz + Math.sin(a) * 0.3 * ph);
    });
    // 잡았으면 물고기가 찌에서 뿅 튀어나와 머리 위로
    if (r.end?.r === 'catch' && r.end.k) {
      if (!g.fish) { g.fish = fishSprite(r.end.k); scene.add(g.fish); }
      const v = Math.min(1, e / 0.75);
      g.fish.position.set(r.bx + (p.x - r.bx) * v, 0.1 + (2.5 - 0.1) * v + Math.sin(Math.PI * v) * 1.4, r.bz + (p.z - r.bz) * v);
      g.fish.material.rotation = Math.sin(t * 20) * 0.3 * (1 - v);
    }
  }

  return {
    busy, cancel,
    onE() { // E 키: 낚시 중이면 당기기, 안내가 떠 있으면 던지기
      if (st === 'wait' || st === 'bite') { reel(); return true; }
      if (st === 'ask') { cast(); return true; }
      return st === 'pend';
    },
    handle(m) {
      if (m.t === 'welcome') { dex = m.fish || {}; rigs.forEach(drop); rigs.clear(); setSt(''); for (const f of m.fishers || []) rigs.set(f.id, { bx: f.bx, bz: f.bz, t0: clk() - 1, bite: f.bite, bt: clk(), end: null }); return false; }
      if (m.t !== 'fish') return false;
      const me = getMe(), mine = me && m.id === me.id, p = players.get(m.id), r = rigs.get(m.id);
      if (m.a === 'no') { toast(m.error); setSt(''); }
      else if (m.a === 'cast') {
        if (r) drop(r);
        rigs.set(m.id, { bx: m.bx, bz: m.bz, t0: clk(), bite: false, bt: 0, end: null });
        if (p) { p.s = 'fish'; p.tr = m.ry; } // 상태 알림('…으로 바뀌었어요')이 안 뜨게 먼저 바꿔 둠
        if (mine) { setSt('wait'); dismissed = false; }
      } else if (m.a === 'bite' && r) {
        r.bite = true; r.bt = clk();
        if (mine) {
          setSt('bite'); biteEl.style.animation = 'none'; biteEl.offsetWidth; biteEl.style.animation = '';
          try { navigator.vibrate?.([90, 40, 90]); } catch {}
          setTimeout(() => { if (st === 'bite') { setSt('pend'); pendAt = clk(); } }, REEL_MS); // 시간이 지나면 버튼을 거둠 (놓침 판정은 서버)
        }
      } else if (m.a === 'catch') {
        const f = FISH_BY[m.k]; dex[m.k] = m.e; holdT = clk() + 0.7;
        setTimeout(() => showRes(`<div class="fs-ic">${icon(f)}</div><div><b class="fs-nm">${f.name}</b>${f.max ? `<span class="fs-cm">${m.cm}cm</span>` : ''}</div><div class="fs-st">${stars(f.star)}</div>` +
          (m.first ? '<div class="fs-new">🆕 처음 잡았어요!</div>' : m.record && f.max ? '<div class="fs-new">🏆 이번이 가장 큰 기록!</div>' : `<div class="fs-sub">${f.max ? `최고 기록 ${m.e.best}cm · ` : ''}${m.e.n}번째</div>`) +
          '<div class="bt"><button class="go" data-a="again">한 번 더</button><button data-a="ok">확인</button></div>', 5000), 650); // 물고기가 튀어나오는 걸 먼저 보여 줌
      } else if (m.a === 'end') {
        if (r) r.end = { r: m.r, k: m.k, t: clk() };
        if (p) p.s = m.s;
        if (m.r === 'catch' && FISH_BY[m.k]?.rare && p) bubble(p, `${FISH_BY[m.k].icon} ${FISH_BY[m.k].name} 잡았다!`);
        if (mine) {
          setSt('');
          if (m.r === 'miss') showRes('<div class="fs-ic">😢</div><b class="fs-nm">놓쳤어요</b><div class="fs-sub">입질이 오면 바로 당겨요</div><div class="bt"><button class="go" data-a="again">다시 던지기</button><button data-a="ok">닫기</button></div>', 3000);
          if (m.r === 'early') showRes('<div class="fs-ic">💨</div><b class="fs-nm">너무 빨라요!</b><div class="fs-sub">물고기가 도망갔어요</div><div class="bt"><button class="go" data-a="again">다시 던지기</button><button data-a="ok">닫기</button></div>', 3000);
        }
      }
      return true;
    },
    update(dt, T) {
      const me = getMe(), t = clk();
      if (!me) return;
      if (st === 'pend' && t - pendAt > 2.5) setSt(''); // 서버가 조용히 무시했으면 원래대로
      // 연못 가장자리에서 연못을 보고 있으면 안내
      const dx = POND.x - me.x, dz = POND.z - me.z, d = Math.hypot(dx, dz);
      if (d > POND.r + FISH_FAR + 0.8) dismissed = false;
      const zone = me.fl === 0 && d > POND.r + FISH_NEAR && d < POND.r + FISH_FAR && (Math.sin(me.ry) * dx + Math.cos(me.ry) * dz) / d > 0.34;
      if (!busy()) setSt(zone && !dismissed && res.hidden && dexEl.hidden && t > holdT && canPrompt() ? 'ask' : ''); // 결과·도감이 떠 있으면 안내는 잠시 숨김
      const n = FISH.filter((f) => dex[f.k]).length;
      if (st === 'ask') panel('ask' + n, `<b>🎣 낚시하시겠어요?</b><small>연못 · 도감 ${n}/${FISH.length}종</small><div class="bt"><button class="go" data-a="cast">낚시하기</button><button data-a="no">아니요</button><button data-a="dex" aria-label="낚시 도감">📖</button></div>`);
      else if (st === 'wait' || st === 'pend') panel('wait', `<b>🎣 찌를 지켜보세요…</b><small>입질이 오면 ${TOUCH ? '당기기 버튼!' : 'E 키!'} · 움직이면 그만둬요</small><div class="bt"><button data-a="stop">그만하기</button></div>`);
      else panel('', ''); // 입질 땐 안내 대신 큰 '당기기!' 버튼
      for (const [id, r] of rigs) {
        const p = players.get(id);
        if (!p || (r.end && t - r.end.t > (r.end.r === 'catch' ? 1.1 : 0.3))) { drop(r); rigs.delete(id); continue; }
        if (!r.g) build(r, p);
        animRig(r, p, t);
      }
    },
  };
}
