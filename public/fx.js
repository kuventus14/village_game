// 효과음 2단계: 발소리 재료 · 마을(버튼·채팅·알림·문·분수·연못·새·가로등) · 놀이기구 · 동물원 · 게임 · 낚시 · 카지노 — 전부 WebAudio 합성
// 효과음 설정(sfx.js 의 켜기·크기)을 그대로 따르고 같은 AudioContext 를 씀. 위치가 있는 소리는 카메라 기준 거리 감쇠 + 좌우 팬.
// 동시에 나는 소리는 24개까지(넘으면 새 소리를 건너뜀), 자주 나는 소리는 쿨다운. 계속 나는 소리(분수·기구 모터 등)는 가까울 때만 노드를 만듦
import { sfx } from './sfx.js';
import { synth } from './bgm.js';
import { spatial, makeVoices, nearestN } from './audiodata.js';
import { BUILDINGS, FOUNTAIN, POND, LAMPS, TAG, DODGE, doorPos } from './world.js';
import { PLAZA_FOUNTAIN, ZOO_ZONE } from './parkdata.js';
import { ENCLOSURES } from './zoodata.js';

const { env, blip, hiss, kit, mtof, frog } = synth;
const R = Math.random, rr = (a, b) => a + R() * (b - a);
// 음높이가 시간에 따라 미끄러지는 소리 (끼익·삐걱·동물 울음의 바탕)
function glide(X, t, f0, f1, d, { type = 'sawtooth', g = 0.05, a = 0.03, lp, bp, q = 3, wet = 0, vib = 0, vr = 6, dest } = {}) {
  const o = X.ac.createOscillator(), e = env(X, t, g, a, d, dest, wet);
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  let f = null; if (lp || bp) { f = X.ac.createBiquadFilter(); f.type = bp ? 'bandpass' : 'lowpass'; f.frequency.value = bp || lp; f.Q.value = bp ? q : 0.7; o.connect(f).connect(e); } else o.connect(e);
  let l = null; if (vib) { l = X.ac.createOscillator(); const lg = X.ac.createGain(); l.frequency.value = vr; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + a + d + 0.05); }
  o.start(t); o.stop(t + a + d + 0.05); o.onended = () => { e.disconnect(); f?.disconnect(); };
}
// 목소리(동물): 톱니 성대 + 잡음 숨 → 입 모양 대역(포먼트) 여럿 → 떨림(AM) → 엔벨로프
function voice(X, t, { f0, f1 = f0, d, form, g = 0.1, a = 0.08, rel = 0.25, noise = 0.3, trem = 0, td = 0.3, vib = 0 }) {
  const ac = X.ac, mix = ac.createGain(), am = ac.createGain(), e = ac.createGain(), end = t + a + d + rel;
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.setValueAtTime(g, t + a + d); e.gain.linearRampToValueAtTime(0, end);
  mix.connect(am).connect(e).connect(X.out); e.connect(X.send[1]);
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  const n = ac.createBufferSource(), ng = ac.createGain(); n.buffer = kit(ac).noise; ng.gain.value = noise * 3;
  const og = ac.createGain(); og.gain.value = 1 - noise; o.connect(og); n.connect(ng);
  for (const [f, q, k = 1] of form) { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const bg = ac.createGain(); bg.gain.value = k; og.connect(b); ng.connect(b); b.connect(bg).connect(mix); }
  const ls = []; if (trem) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = trem; am.gain.value = 1 - td; lg.gain.value = td; l.connect(lg).connect(am.gain); ls.push(l); }
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6; lg.gain.value = vib; l.connect(lg).connect(o.frequency); ls.push(l); }
  for (const s of [o, n, ...ls]) { s.start(t, s === n ? R() : undefined); s.stop(end + 0.05); }
  o.onended = () => { e.disconnect(); mix.disconnect(); };
}
function sweep(X, t, d, f0, f1, { g = 0.05, q = 0.8, a = 0.02, wet = 0 } = {}) { // 바람이 휙 지나가는 잡음
  const s = X.ac.createBufferSource(), f = X.ac.createBiquadFilter(), e = env(X, t, g, a, d, null, wet);
  s.buffer = kit(X.ac).noise; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  s.connect(f).connect(e); s.start(t, R()); s.stop(t + a + d + 0.05); s.onended = () => { e.disconnect(); f.disconnect(); };
}
const drops = (X, t, n, g, span = 0.4) => { for (let i = 0; i < n; i++) blip(X, t + R() * span, rr(700, 1700), { g: g * rr(0.5, 1), a: 0.002, d: 0.05, f2: rr(1400, 2600) }); };

/* ── 발소리: 재질마다 '쿵'(발뒤꿈치 사인) + '사각'(거른 잡음) + 알갱이(흙·낙엽 부스러기) + 나무 삐걱 ── */
export const SURF = {
  stone: { th: [150, 0.15, 0.04], sc: ['bandpass', 2600, 1.4, 0.03, 0.36], grit: 1, wet: 1 }, // 폰 스피커는 저음이 안 나니 '톡' 쪽(사각)을 살림
  brick: { th: [135, 0.14, 0.045], sc: ['bandpass', 1900, 1.2, 0.035, 0.32], grit: 1, wet: 1 },
  hall: { th: [180, 0.16, 0.05], sc: ['bandpass', 2300, 2, 0.04, 0.4], grit: 0, wet: 3 },
  grass: { th: [90, 0.08, 0.05], sc: ['highpass', 2200, 0.6, 0.11, 0.2], grit: 4, wet: 0, a: 0.02 },
  dirt: { th: [105, 0.11, 0.05], sc: ['bandpass', 1300, 0.8, 0.08, 0.3], grit: 5, wet: 0, a: 0.008 },
  forest: { th: [100, 0.1, 0.05], sc: ['bandpass', 2400, 0.7, 0.1, 0.24], grit: 8, wet: 0, a: 0.012 },
  wood: { th: [190, 0.2, 0.07, 'triangle'], sc: ['bandpass', 1000, 1.5, 0.03, 0.22], grit: 0, wet: 1, creak: 0.12 },
  maru: { th: [140, 0.22, 0.08, 'triangle'], sc: ['lowpass', 900, 0.7, 0.04, 0.22], grit: 0, wet: 2, creak: 0.06 },
  carpet: { th: [70, 0.1, 0.05], sc: ['lowpass', 500, 0.7, 0.05, 0.07], grit: 0, wet: 0 },
};
function step(X, t, g, { surf = 'stone', foot = 0, run = false, land = false } = {}) {
  const S = SURF[surf] || SURF.stone, v = g * rr(0.9, 1.1) * (run ? 1.25 : 1), k = (foot ? 1.03 : 0.97) * rr(0.95, 1.05), L = rr(0.9, 1.1) * (run ? 0.8 : 1) * (land ? 1.5 : 1);
  const [f, tg, td, ty = 'sine'] = S.th, [ft, fc, q, sd, sg] = S.sc;
  blip(X, t, f * k * (land ? 0.8 : 1), { type: ty, g: tg * v, a: 0.003, d: td * L, f2: f * k * 0.6, wet: S.wet });
  hiss(X, t + 0.008, sd * L, { g: sg * v, type: ft, f: fc * k, q, a: S.a || 0.002, wet: S.wet });
  for (let i = 0; i < S.grit; i++) hiss(X, t + 0.01 + R() * 0.08 * L, rr(0.003, 0.01), { g: rr(0.02, 0.06) * v, f: rr(2800, 6500), q: 1.5 });
  if (S.creak && R() < S.creak) glide(X, t + 0.03, rr(300, 360), rr(240, 280), 0.14, { g: 0.018 * v, a: 0.03, lp: 900 });
}

/* ── 한 번 나는 소리 S[name](X, t, g, o) ── */
export const S = {
  step,
  land: (X, t, g, o) => step(X, t, g * 1.5, { ...o, land: true }),
  breath(X, t, g) { hiss(X, t, 0.12, { g: 0.035 * g, f: 1100, q: 1.5, a: 0.03 }); }, // 점프 '흡'
  cloth(X, t, g) { hiss(X, t, 0.22, { g: 0.05 * g, f: 2600, q: 0.5, a: 0.06 }); hiss(X, t + 0.1, 0.15, { g: 0.03 * g, f: 3800, q: 0.6, a: 0.04 }); }, // 옷깃 스침
  chair(X, t, g) { glide(X, t, rr(250, 290), rr(200, 220), 0.25, { g: 0.04 * g, a: 0.05, lp: 900, wet: 1 }); }, // 나무 의자 삐걱
  // UI·마을
  tap(X, t, g) { blip(X, t, 1800, { g: 0.04 * g, a: 0.001, d: 0.03 }); },
  chatIn(X, t, g) { blip(X, t, 660, { g: 0.07 * g, a: 0.004, d: 0.12, f2: 990 }); },
  chatMine(X, t, g) { blip(X, t, 880, { g: 0.05 * g, a: 0.003, d: 0.08, f2: 1320 }); },
  join(X, t, g) { [76, 83].forEach((m, i) => blip(X, t + i * 0.16, mtof(m), { g: 0.06 * g, a: 0.003, d: 0.9, wet: 2 })); },
  toast(X, t, g) { blip(X, t, mtof(84), { g: 0.035 * g, a: 0.002, d: 0.35, wet: 1 }); },
  door(X, t, g) { blip(X, t, 1400, { type: 'square', g: 0.02 * g, a: 0.001, d: 0.02, lp: 3000 }); glide(X, t + 0.05, 180, 140, 0.3, { g: 0.022 * g, lp: 700 }); blip(X, t + 0.5, 90, { g: 0.12 * g, d: 0.12, f2: 60 }); hiss(X, t + 0.5, 0.08, { g: 0.05 * g, type: 'lowpass', f: 400 }); },
  doorBell(X, t, g) { for (let i = 0; i < 4; i++) { const s = t + i * rr(0.06, 0.1), f = rr(2400, 2700); blip(X, s, f, { g: 0.035 * g * (1 - i * 0.2), a: 0.001, d: 0.5, wet: 1 }); blip(X, s, f * 2.4, { g: 0.012 * g, a: 0.001, d: 0.25 }); } },
  lampTick(X, t, g) { blip(X, t, 2600, { type: 'square', g: 0.015 * g, a: 0.0005, d: 0.012, lp: 5000 }); hiss(X, t, 0.01, { g: 0.03 * g, f: 4000, q: 2 }); blip(X, t + 0.02, 120, { g: 0.02 * g, d: 0.25 }); },
  bird(X, t, g) { const n = 3 + Math.floor(R() * 4), f0 = rr(2800, 4200); let s = t; for (let i = 0; i < n; i++) { const f = f0 * rr(0.85, 1.25); blip(X, s, f, { g: 0.03 * g, a: 0.005, d: 0.05, f2: f * rr(0.8, 1.4), wet: 1 }); s += rr(0.07, 0.12); } },
  frog(X, t, g) { const e = X.ac.createGain(); e.gain.value = g; e.connect(X.out); frog({ ...X, out: e }, R, e, t); setTimeout(() => e.disconnect(), 3000); },
  // 놀이기구
  gondolaBell(X, t, g) { blip(X, t, 1320, { g: 0.05 * g, a: 0.002, d: 1.4, wet: 2 }); blip(X, t, 1320 * 2.76, { g: 0.015 * g, a: 0.002, d: 0.5, wet: 2 }); },
  steelCreak(X, t, g) { const f = rr(380, 520); glide(X, t, f, f * 0.85, 0.6, { g: 0.03 * g, a: 0.1, bp: 900, q: 3, vib: 6, vr: 11, wet: 1 }); },
  brake(X, t, g) { glide(X, t, 2600, 2300, 1.1, { type: 'sine', g: 0.025 * g, a: 0.15, vib: 30, vr: 9, wet: 1 }); hiss(X, t, 1, { g: 0.03 * g, f: 3000, q: 2, a: 0.1 }); },
  stationBell(X, t, g) { for (let i = 0; i < 2; i++) { blip(X, t + i * 0.35, 1046, { g: 0.06 * g, a: 0.002, d: 0.6, wet: 1 }); blip(X, t + i * 0.35, 2794, { g: 0.015 * g, a: 0.002, d: 0.2 }); } },
  clunk(X, t, g) { blip(X, t, 180, { type: 'triangle', g: 0.18 * g, d: 0.15, f2: 120, wet: 1 }); hiss(X, t, 0.06, { g: 0.12 * g, f: 2200, q: 1.5 }); blip(X, t + 0.05, 900, { type: 'square', g: 0.03 * g, d: 0.06, lp: 3000 }); },
  puff(X, t, g) { hiss(X, t, 0.9, { g: 0.12 * g, f: 1800, q: 0.6, a: 0.02 }); hiss(X, t, 0.4, { g: 0.08 * g, type: 'lowpass', f: 500, a: 0.01 }); }, // 드롭타워 쿠션 '푸슉'
  spark(X, t, g) { for (let i = 0; i < 7; i++) hiss(X, t + R() * 0.15, rr(0.003, 0.01), { g: rr(0.02, 0.05) * g, type: 'highpass', f: 5000 }); },
  // 동물원 (실제 울음을 흉내 낸 포먼트·잡음 합성, 작게)
  lion(X, t, g) { voice(X, t, { f0: 115, f1: 72, d: 1.3, form: [[380, 3], [800, 4, 0.7], [1500, 5, 0.3]], g: 0.16 * g, a: 0.25, rel: 0.6, noise: 0.45, trem: 17, td: 0.35 }); for (let i = 0; i < 2; i++) voice(X, t + 2.3 + i * 0.7, { f0: 90, f1: 80, d: 0.12, form: [[350, 3], [700, 4, 0.5]], g: 0.1 * g, a: 0.04, rel: 0.15, noise: 0.5 }); },
  tiger(X, t, g) { voice(X, t, { f0: 140, f1: 88, d: 0.8, form: [[600, 3], [1100, 4, 0.6]], g: 0.13 * g, a: 0.12, rel: 0.4, noise: 0.4, trem: 24, td: 0.3 }); },
  giraffe(X, t, g) { voice(X, t, { f0: 60, d: 0.45, form: [[500, 1], [900, 2, 0.5]], g: 0.06 * g, a: 0.05, rel: 0.2, noise: 0.95, trem: 32, td: 0.6 }); }, // 거의 무음 + 코 '푸르르'
  hippo(X, t, g) { hiss(X, t, 0.5, { g: 0.1 * g, type: 'lowpass', f: 500, a: 0.04, wet: 1 }); voice(X, t + 0.5, { f0: 72, f1: 58, d: 0.9, form: [[300, 3], [600, 4, 0.5]], g: 0.13 * g, a: 0.1, rel: 0.4, noise: 0.25, trem: 8, td: 0.25 }); drops(X, t + 0.1, 3, 0.03 * g, 0.3); },
  ostrich(X, t, g) { for (let i = 0; i < 3; i++) voice(X, t + i * 0.6, { f0: 78, f1: 64, d: 0.25, form: [[180, 2], [320, 3, 0.5]], g: 0.16 * g, a: 0.05, rel: 0.2, noise: 0.1 }); }, // '붐 붐 붐' 낮게
  zebra(X, t, g) { g *= 1.6; for (let i = 0; i < 2; i++) { const s = t + i * 0.55; voice(X, s, { f0: 620, f1: 900, d: 0.16, form: [[900, 4], [2200, 5, 0.5]], g: 0.06 * g, a: 0.03, rel: 0.05, noise: 0.25, trem: 20, td: 0.35 }); voice(X, s + 0.22, { f0: 320, f1: 280, d: 0.18, form: [[700, 4], [1600, 5, 0.4]], g: 0.06 * g, a: 0.02, rel: 0.1, noise: 0.35 }); } },
  redpanda(X, t, g) { g *= 1.6; const n = 3 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const s = t + i * rr(0.09, 0.14), f = rr(2100, 2500); blip(X, s, f, { g: 0.035 * g, a: 0.004, d: 0.05, f2: f * 1.25 }); hiss(X, s, 0.03, { g: 0.012 * g, f: 4000, q: 2 }); } }, // 짹짹 같은 '찍찍'
  panda(X, t, g) { g *= 1.6; for (let i = 0; i < 2; i++) voice(X, t + i * 0.8, { f0: 390, f1: 360, d: 0.45, form: [[700, 4], [1200, 5, 0.6], [2600, 6, 0.25]], g: 0.06 * g, a: 0.05, rel: 0.15, noise: 0.2, trem: 7, td: 0.45 }); }, // 작은 '매에'
  // 게임
  swish(X, t, g) { sweep(X, t, 0.2, 700, 2600, { g: 0.08 * g, q: 1 }); },
  splat(X, t, g) { blip(X, t, 140, { g: 0.15 * g, d: 0.1, f2: 70 }); hiss(X, t, 0.25, { g: 0.14 * g, type: 'lowpass', f: 1600, a: 0.002, wet: 1 }); drops(X, t + 0.05, 4, 0.03 * g); },
  pop(X, t, g) { hiss(X, t, 0.05, { g: 0.1 * g, f: 2000, q: 0.8 }); hiss(X, t + 0.02, 0.3, { g: 0.07 * g, type: 'lowpass', f: 1200 }); drops(X, t + 0.05, 3, 0.02 * g); },
  tag(X, t, g) { blip(X, t, 700, { type: 'triangle', g: 0.1 * g, d: 0.06, f2: 500 }); blip(X, t + 0.08, 1050, { g: 0.06 * g, d: 0.15 }); },
  beep(X, t, g) { blip(X, t, 880, { type: 'square', g: 0.025 * g, a: 0.003, d: 0.15, lp: 2500 }); },
  beepHi(X, t, g) { blip(X, t, 1320, { type: 'square', g: 0.025 * g, a: 0.003, d: 0.4, lp: 2500 }); },
  // 낚시
  cast(X, t, g) { sweep(X, t, 0.3, 1200, 3500, { g: 0.06 * g }); for (let i = 0; i < 10; i++) blip(X, t + 0.05 + i * 0.03, 2600, { type: 'square', g: 0.008 * g, a: 0.001, d: 0.008, lp: 5000 }); },
  plop(X, t, g) { blip(X, t, 320, { g: 0.1 * g, a: 0.002, d: 0.12, f2: 900 }); hiss(X, t, 0.15, { g: 0.05 * g, type: 'lowpass', f: 1400 }); },
  bite(X, t, g) { blip(X, t, 500, { g: 0.08 * g, a: 0.003, d: 0.08, f2: 1100 }); blip(X, t + 0.12, 450, { g: 0.06 * g, a: 0.003, d: 0.08, f2: 1000 }); },
  reel(X, t, g) { for (let i = 0; i < 14; i++) blip(X, t + i * 0.035, 2200, { type: 'square', g: 0.012 * g, a: 0.001, d: 0.01, lp: 4000 }); },
  catchSplash(X, t, g) { hiss(X, t, 0.5, { g: 0.2 * g, type: 'lowpass', f: 1100, a: 0.005, wet: 1 }); hiss(X, t, 0.25, { g: 0.09 * g, f: 2600, q: 0.8 }); drops(X, t + 0.1, 6, 0.03 * g, 0.5); },
  // 카지노
  lever(X, t, g) { blip(X, t, 160, { type: 'triangle', g: 0.12 * g, d: 0.18, f2: 110 }); hiss(X, t, 0.05, { g: 0.06 * g, f: 1500, q: 1 }); for (let i = 0; i < 5; i++) blip(X, t + 0.03 + i * 0.02, 1500, { type: 'square', g: 0.015 * g, a: 0.001, d: 0.01, lp: 4000 }); },
  reelSpin(X, t, g, o) { const n = Math.floor((o?.dur || 1.8) * 18); for (let i = 0; i < n; i++) blip(X, t + i / 18, rr(1150, 1350), { type: 'square', g: 0.01 * g, a: 0.001, d: 0.008, lp: 3000 }); },
  reelStop(X, t, g) { blip(X, t, 240, { type: 'triangle', g: 0.1 * g, d: 0.08, f2: 180 }); blip(X, t, 1900, { type: 'square', g: 0.02 * g, a: 0.001, d: 0.02, lp: 4000 }); },
  coins(X, t, g, o) { const n = o?.big ? 18 : 7; for (let i = 0; i < n; i++) { const s = t + i * rr(0.05, 0.09); blip(X, s, rr(2000, 3200), { g: 0.035 * g, a: 0.001, d: 0.25, wet: 1 }); blip(X, s, rr(4500, 6000), { g: 0.012 * g, a: 0.001, d: 0.1 }); } if (o?.big) [72, 76, 79, 84].forEach((m, i) => blip(X, t + i * 0.12, mtof(m), { type: 'triangle', g: 0.08 * g, d: 0.5, wet: 2 })); },
  chip(X, t, g) { const n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const s = t + i * rr(0.03, 0.06); blip(X, s, rr(3000, 4200), { type: 'triangle', g: 0.04 * g, a: 0.0005, d: 0.03 }); hiss(X, s, 0.01, { g: 0.04 * g, f: 5000, q: 2 }); } },
};

/* ── 계속 나는 소리 L[name](X) → { set(arg, t), run(until), stop() } ── */
function noiseSrc(X, type, f, q, g, dest) { const s = X.ac.createBufferSource(), fl = X.ac.createBiquadFilter(), e = X.ac.createGain(); s.buffer = kit(X.ac).noise; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; e.gain.value = g; s.connect(fl).connect(e).connect(dest || X.out); s.start(0, R()); return { s, fl, e }; }
function oscSrc(X, type, f, g, lp, dest) { const o = X.ac.createOscillator(), fl = X.ac.createBiquadFilter(), e = X.ac.createGain(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp; e.gain.value = g; o.connect(fl).connect(e).connect(dest || X.out); o.start(); return { o, fl, e }; }
function lfo(X, param, rate, depth, type = 'sine') { const l = X.ac.createOscillator(), g = X.ac.createGain(); l.type = type; l.frequency.value = rate; g.gain.value = depth; l.connect(g).connect(param); l.start(); return l; }
// 일정한 빠르기로 짧은 소리를 반복 (딸깍·물방울 등). every(t) 가 다음 간격(초)
function ticker(X, fire, every) { let next = X.ac.currentTime + every(); return { run(until) { if (next < X.ac.currentTime) next = X.ac.currentTime; while (next < until) { fire(next); next += Math.max(0.02, every()); } } }; }
export const L = {
  water(X) { // 분수: 쏟아지는 물(거른 잡음 두 겹) + 물방울
    const a = noiseSrc(X, 'bandpass', 1200, 0.7, 0.06), b = noiseSrc(X, 'highpass', 4000, 0.7, 0.02), tk = ticker(X, (t) => blip(X, t, rr(600, 1800), { g: rr(0.008, 0.02), a: 0.002, d: 0.04, f2: rr(1500, 2800) }), () => rr(0.05, 0.25));
    return { run: tk.run, stop() { a.s.stop(); b.s.stop(); } };
  },
  lap(X) { const a = noiseSrc(X, 'lowpass', 450, 0.7, 0.04), l = lfo(X, a.e.gain, 0.3, 0.025), tk = ticker(X, (t) => blip(X, t, rr(500, 900), { g: 0.008, a: 0.003, d: 0.05, f2: rr(1000, 1600) }), () => rr(0.6, 2.5)); return { run: tk.run, stop() { a.s.stop(); l.stop(); } }; },
  gear(X) { const a = oscSrc(X, 'sawtooth', 55, 0.06, 200), b = oscSrc(X, 'sine', 110, 0.03, 400), c = oscSrc(X, 'triangle', 330, 0.012, 1200), h = noiseSrc(X, 'bandpass', 700, 1.5, 0.02), l = lfo(X, a.e.gain, 2, 0.03); return { stop() { a.o.stop(); b.o.stop(); c.o.stop(); h.s.stop(); l.stop(); } }; }, // 대관람차 기어 웅웅
  motor(X) { const a = oscSrc(X, 'sawtooth', 90, 0.05, 400), b = oscSrc(X, 'sawtooth', 92.5, 0.05, 400); return { set(v, t) { if (v?.f) for (const o of [a.o, b.o]) o.frequency.setTargetAtTime(v.f, t, 0.3); }, stop() { a.o.stop(); b.o.stop(); } }; },
  wind(X) { const a = noiseSrc(X, 'bandpass', 600, 0.7, 0.1); return { set(v, t) { if (v?.f) a.fl.frequency.setTargetAtTime(v.f, t, 0.15); }, stop() { a.s.stop(); } }; },
  jingle(X) { let rate = 4; const tk = ticker(X, (t) => blip(X, t, rr(3000, 5200), { g: rr(0.008, 0.018), a: 0.001, d: 0.06 }), () => rr(0.5, 1.5) / rate); return { set(v) { if (v?.rate) rate = v.rate; }, run: tk.run, stop() {} }; }, // 그네 체인 찰랑
  whine(X) { const a = oscSrc(X, 'sawtooth', 160, 0.025, 900), b = oscSrc(X, 'sawtooth', 163, 0.025, 900), l = lfo(X, a.e.gain, 3, 0.01); return { stop() { a.o.stop(); b.o.stop(); l.stop(); } }; }, // 범퍼카 모터 윙
  spin(X) { const a = noiseSrc(X, 'bandpass', 800, 3, 0.08), b = oscSrc(X, 'triangle', 200, 0.015, 600); return { set(v, t) { if (v?.f) { a.fl.frequency.setTargetAtTime(v.f, t, 0.3); b.o.frequency.setTargetAtTime(v.f / 4, t, 0.3); } }, stop() { a.s.stop(); b.o.stop(); } }; }, // 찻잔: 빠를수록 음이 올라감
  rumble(X) { const a = noiseSrc(X, 'lowpass', 160, 0.7, 0.12), b = noiseSrc(X, 'bandpass', 900, 1, 0.05), l = lfo(X, a.e.gain, 6, 0.05, 'square'), l2 = lfo(X, b.e.gain, 6, 0.035, 'square'); return { set(v, t) { if (v?.rate) for (const x of [l, l2]) x.frequency.setTargetAtTime(v.rate, t, 0.2); }, stop() { a.s.stop(); b.s.stop(); l.stop(); l2.stop(); } }; }, // 레일 덜컹: 낮은 울림 + 바퀴 덜걱(중역) // 롤러코스터 레일 덜컹
  flow(X) { // 후룸 물길 졸졸 + 폭포 쏴아
    const a = noiseSrc(X, 'bandpass', 900, 0.6, 0.07), b = noiseSrc(X, 'highpass', 2500, 0.7, 0.04), tk = ticker(X, (t) => blip(X, t, rr(400, 1100), { g: rr(0.008, 0.018), a: 0.003, d: 0.06, f2: rr(900, 2000) }), () => rr(0.08, 0.3));
    return { run: tk.run, stop() { a.s.stop(); b.s.stop(); } };
  },
  carousel(X) { // 회전목마 모터 낮은 웅웅 + 말 올라갈 때 작은 딸깍 (rate = 1초에 몇 번)
    const m = oscSrc(X, 'sawtooth', 70, 0.04, 180); let rate = 1;
    const tk = ticker(X, (t) => blip(X, t, 1500, { type: 'triangle', g: 0.02, a: 0.001, d: 0.02 }), () => 1 / Math.max(0.3, rate));
    return { set(v) { if (v?.rate) rate = v.rate; }, run: tk.run, stop() { m.o.stop(); } };
  },
};

/* ── 게임 안 재생기 ── */
const V = makeVoices(24), loops = new Map(), LIS = { x: 0, z: 0, rx: 1, rz: 0 };
let X = null;
function bundle() {
  const ac = sfx.ctx, bus = sfx.bus; if (!ac || !bus) return null;
  if (X?.ac === ac) return X;
  const verb = ac.createConvolver(); verb.buffer = kit(ac).ir; verb.connect(bus);
  X = { ac, out: bus, send: [0.1, 0.25, 0.5].map((v) => { const g = ac.createGain(); g.gain.value = v; g.connect(verb); return g; }) };
  setInterval(() => { if (ac.state !== 'running') return; const u = ac.currentTime + 0.2; for (const l of loops.values()) l.inst.run?.(u); }, 25);
  return X;
}
const ok = () => sfx.on && sfx.vol > 0 && sfx.ctx?.state === 'running' && bundle();
// 위치 → [크기, 팬] (위치 없으면 그대로)
function where(o) { if (o.x == null) return [o.g ?? 1, o.pan ?? 0]; const s = spatial(LIS.x, LIS.z, LIS.rx, LIS.rz, o.x, o.z, o.range ?? 30); return [Math.max(o.floor ?? 0, s.g) * (o.g ?? 1), s.pan + (o.pan ?? 0)]; }
export const fx = {
  // 한 번: name, { x, z, range, g, floor(멀어도 최소 크기), key·cd(쿨다운 초), dur(보이스 차지 시간), delay, ...그 소리 옵션 }
  play(name, o = {}) {
    if (!ok()) return false;
    const [g, pan] = where(o); if (g < 0.01) return false;
    const now = X.ac.currentTime, t = now + 0.01 + (o.delay || 0);
    if (!V.take(now, (o.delay || 0) + (o.dur || 1), o.key ?? null, o.cd || 0)) return false;
    const p = X.ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(X.out);
    S[name]({ ...X, out: p }, t, g, o);
    setTimeout(() => p.disconnect(), ((o.delay || 0) + (o.dur || 1) + 4) * 1000);
    return true;
  },
  // 계속: 매 프레임 불러도 됨. level 0~1 × 거리. 0 이 2초 이어지면 멈추고 노드를 놓아줌
  loop(id, name, level, o = {}) {
    let l = loops.get(id);
    if (!ok()) { if (l) { l.inst.stop(); l.p.disconnect(); loops.delete(id); } return; }
    const [g0, pan] = where(o), g = level * g0, now = X.ac.currentTime;
    if (g > 0.003 && !l) { const e = X.ac.createGain(), p = X.ac.createStereoPanner(); e.gain.value = 0; e.connect(p).connect(X.out); l = { e, p, inst: L[name]({ ...X, out: e }), zero: 0 }; loops.set(id, l); }
    if (!l) return;
    l.e.gain.setTargetAtTime(g, now, 0.15); l.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.1); l.inst.set?.(o.arg, now);
    if (g <= 0.003) { if (!l.zero) l.zero = now; else if (now - l.zero > 2) { l.inst.stop(); setTimeout(() => l.p.disconnect(), 400); loops.delete(id); } } else l.zero = 0;
  },
  listen(camera) { const e = camera.matrixWorld.elements; LIS.x = e[12]; LIS.z = e[14]; const l = Math.hypot(e[0], e[2]) || 1; LIS.rx = e[0] / l; LIS.rz = e[2] / l; },
  get voices() { return X ? V.active(X.ac.currentTime) : 0; }, get loops() { return [...loops.keys()]; },
};

/* ── 마을 환경음·이벤트 (game.js 가 매 프레임 update, 메시지마다 msg) ── */
export function createFx({ players, getMe }) {
  let acc = 0, inPrev = null, nPrev = -1, birdAt = 0, frogAt = 0, zooAt = 0, bets = '';
  const bob = new Map();
  if (typeof document !== 'undefined') document.addEventListener('click', (e) => { if (e.target.closest?.('button')) fx.play('tap', { key: 'tap', cd: 0.05, dur: 0.1 }); }, true);
  const posOf = (id) => { const p = players.get(id); return p ? { x: p.x, z: p.z } : {}; };
  return {
    update(dt, { camera, night, inKey }) {
      fx.listen(camera);
      const me = getMe(); if (!me) return;
      const out = !inKey;
      fx.loop('fountain', 'water', out ? 0.8 : 0, { x: FOUNTAIN.x, z: FOUNTAIN.z, range: 24 });
      fx.loop('pfountain', 'water', out ? 0.8 : 0, { x: PLAZA_FOUNTAIN.x, z: PLAZA_FOUNTAIN.z, range: 26 });
      fx.loop('pond', 'lap', out ? 0.6 : 0, { x: POND.x, z: POND.z, range: 16 });
      fx.loop('parkwind', 'wind', out && (me.pl === 'park' || me.pl === 'zoo') ? 0.18 : 0, { arg: { f: 500 } });
      if (inKey !== inPrev) { // 건물 문 열고 닫힘 (카페는 문 방울 '딸랑')
        const k = inKey || inPrev, b = BUILDINGS[k];
        if (b && !b.fy) { const [x, z] = doorPos(b); fx.play('door', { x, z, range: 20, g: 0.8 }); if (k === 'cafe') fx.play('doorBell', { x, z, range: 20, delay: 0.05 }); }
        inPrev = inKey;
      }
      if (nPrev >= 0 && nPrev < 0.5 && night >= 0.5) nearestN(LAMPS, me.x, me.z, 3, 40).forEach((l, i) => fx.play('lampTick', { x: l.x, z: l.z, range: 40, delay: 0.2 + i * rr(0.15, 0.5) })); // 가로등 켜질 때 '틱'
      nPrev = night;
      if ((acc += dt) < 0.5) return; acc = 0;
      const now = performance.now() / 1000;
      if (out && night < 0.3 && ['town', 'park', 'zoo'].includes(me.pl) && now > birdAt) { birdAt = now + rr(3, 9); const a = R() * 6.283, d = rr(8, 25); fx.play('bird', { x: me.x + Math.sin(a) * d, z: me.z + Math.cos(a) * d, range: 30, key: 'bird', dur: 0.8 }); }
      if (out && night > 0.6 && Math.hypot(me.x - POND.x, me.z - POND.z) < 35 && now > frogAt) { frogAt = now + rr(4, 12); fx.play('frog', { x: POND.x + rr(-4, 4), z: POND.z + rr(-4, 4), range: 35, g: 1.4, dur: 1.2 }); }
      const Z = ZOO_ZONE;
      if (me.x > Z.x0 - 20 && me.x < Z.x1 + 20 && me.z > Z.z0 - 20 && me.z < Z.z1 + 20 && now > zooAt) { // 동물원: 몇 초에 한 번, 가까운 칸 중 하나만
        zooAt = now + rr(7, 14);
        const pens = nearestN(ENCLOSURES.map((e) => ({ x: e.cx, z: e.cz, sp: e.species })), me.x, me.z, 3, 45);
        const p = pens[R() < 0.6 ? 0 : Math.floor(R() * pens.length)]; if (p && S[p.sp]) fx.play(p.sp, { x: p.x, z: p.z, range: 45, g: 0.9, dur: 3 });
      }
    },
    msg(m) { // 서버 메시지 → 소리 (게임 규칙은 건드리지 않음)
      const me = getMe(), mine = m.id != null && m.id === me?.id;
      if (m.t === 'chat') fx.play(mine ? 'chatMine' : 'chatIn', mine ? { dur: 0.2 } : { ...posOf(m.id), range: 30, floor: 0.35, key: 'chat', cd: 0.15, dur: 0.2 });
      else if (m.t === 'join') fx.play('join', { key: 'notif', cd: 1.5 });
      else if (m.t === 'gstart' && me && [TAG, DODGE].some((g) => Math.hypot(me.x - g.cx, me.z - g.cz) < 30)) { const r = (m.ready || 3000) / 1000; for (let i = 3; i >= 1; i--) if (r - i > 0) fx.play('beep', { delay: r - i, dur: 0.2 }); fx.play('beepHi', { delay: r, dur: 0.5 }); }
      else if (m.t === 'gtag') fx.play('tag', { ...posOf(m.id), range: 30, floor: mine ? 1 : 0 });
      else if (m.t === 'ghit') fx.play('splat', { ...posOf(m.id), range: 30, floor: mine ? 1 : 0 });
      else if (m.t === 'balloon') fx.play('swish', { x: m.x, z: m.z, range: 25 });
      else if (m.t === 'bend') fx.play('pop', { x: m.x, z: m.z, range: 25 });
      else if (m.t === 'fish') {
        const p = posOf(m.id);
        if (m.a === 'cast') { bob.set(m.id, { x: m.bx, z: m.bz }); fx.play('cast', { ...p, range: 25 }); fx.play('plop', { x: m.bx, z: m.bz, range: 25, delay: 0.6 }); }
        else if (m.a === 'bite') fx.play('bite', { ...(bob.get(m.id) || p), range: 25, floor: mine ? 0.8 : 0 });
        else if (m.a === 'catch') { fx.play('reel', { ...p, range: 25 }); fx.play('catchSplash', { ...(bob.get(m.id) || p), range: 25, delay: 0.4, floor: mine ? 0.8 : 0 }); }
        else if (m.a === 'end' && m.r !== 'catch') fx.play('plop', { ...(bob.get(m.id) || p), range: 25, g: 0.5 });
      } else if (m.t === 'cz') {
        if (m.g === 'slot' && m.a === 'result' && !m.error) {
          fx.play('lever', { dur: 0.3 }); fx.play('reelSpin', { dur: 1.85 });
          for (let i = 0; i < 3; i++) fx.play('reelStop', { delay: 0.5 + i * 0.45, dur: 0.2 });
          if (m.win > m.bet) fx.play('coins', { delay: 1.9, big: m.win >= m.bet * 10, dur: 1.5 });
        } else if (m.state) { const s = JSON.stringify([m.state.pot, m.state.seats?.map((x) => x?.bet)]); if (bets && s !== bets) fx.play('chip', { key: 'chip', cd: 0.25, dur: 0.3 }); bets = s; } // 칩이 오갈 때 짤각
      }
    },
    ui(name) { if (name === 'toast') fx.play('toast', { key: 'notif', cd: 1.5, dur: 0.4 }); },
  };
}
