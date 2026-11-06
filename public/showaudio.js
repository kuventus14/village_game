// 불꽃놀이 소리 (전부 코드로 만든 소리): 3분 음악(분당 96박, 막마다 악기가 늘고 4막·5막에서 장조가 올라감) + 쏘는 휘파람·터지는 쿵·잔불 타닥·지상 분수 지직
// 시안(docs/visual/firework-show-preview.html)에서 확인한 것과 같은 소리. 게임에선 audio.js 의 공용 출력에 연결하고 설정의 배경음악·효과음 크기를 따름
// 음악·효과음은 쇼 시계 t 에 맞춰 미리(0.4초) 예약 → 쇼 중간에 들어와도 지금 박자부터. 정문에서 멀수록 작아짐, 폭발음은 거리/340 초 늦게 들림
import { BAR, S16, FLY, SHOW_X } from './showscript.js';
import { PARK_GATE } from './parkdata.js';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const impCache = new WeakMap();
export function makeAudio(ctx, dest = ctx.destination, vol = 1) {
  const master = ctx.createGain(); master.gain.value = vol;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -22; comp.knee.value = 12; comp.ratio.value = 8; comp.attack.value = 0.004; comp.release.value = 0.3;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12; // 마지막에 넘치지 않게 막는 리미터
  const pre = ctx.createGain(); pre.gain.value = 0.55; // 겹쳐 터질 때 소리가 깨지지 않게 전체를 낮춰서 시작
  master.connect(pre); pre.connect(comp); comp.connect(lim); lim.connect(dest);
  let imp = impCache.get(ctx); if (!imp) { const len = ctx.sampleRate * 2.8; imp = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.4; } impCache.set(ctx, imp); }
  const rv = ctx.createConvolver(); rv.buffer = imp; const rvIn = ctx.createGain(); rvIn.gain.value = 0.5; rvIn.connect(rv); const rvOut = ctx.createGain(); rvOut.gain.value = 0.55; rv.connect(rvOut); rvOut.connect(master);
  const mus = ctx.createGain(); mus.gain.value = 0.5; mus.connect(master); const ms = ctx.createGain(); ms.gain.value = 0.3; mus.connect(ms); ms.connect(rvIn);
  const sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(master); const ss = ctx.createGain(); ss.gain.value = 0.7; sfx.connect(ss); ss.connect(rvIn);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return { ctx, master, mus, sfx, noise: nb, budget: 0 };
}
function tone(A, { when, f, dur, type = 'sine', gain = 0.2, att = 0.01, rel = 0.2, det = 0, lp = 0, out = A.mus, pan = 0, glide = 0 }) {
  const c = A.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, when); if (glide) o.frequency.exponentialRampToValueAtTime(glide, when + dur); o.detune.value = det;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(gain, when + att); g.gain.setValueAtTime(gain, when + Math.max(att, dur)); g.gain.exponentialRampToValueAtTime(0.0001, when + dur + rel);
  let n = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; }
  n.connect(g); let tail = g; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); tail = p; }
  tail.connect(out); o.start(when); o.stop(when + dur + rel + 0.05);
}
function hit(A, { when, dur, type = 'highpass', f = 3000, q = 0.7, gain = 0.2, out = A.sfx, pan = 0, to = 0, att = 0.002, rise = false }) {
  const c = A.ctx, s = c.createBufferSource(); s.buffer = A.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, when); fl.Q.value = q; if (to) fl.frequency.exponentialRampToValueAtTime(to, when + dur);
  const g = c.createGain(); if (rise) { g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(gain, when + dur); g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.05); } else { g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(gain, when + att); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); }
  s.connect(fl); fl.connect(g); let tail = g; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); tail = p; } tail.connect(out); s.start(when, Math.random() * 1.2); s.stop(when + dur + 0.1);
}
const kick = (A, w, g = 0.5) => tone(A, { when: w, f: 135, glide: 42, dur: 0.12, gain: g, att: 0.002, rel: 0.25 });
const snare = (A, w, g = 0.22) => { hit(A, { when: w, dur: 0.18, type: 'bandpass', f: 1900, q: 0.8, gain: g, out: A.mus }); tone(A, { when: w, f: 200, glide: 130, dur: 0.07, type: 'triangle', gain: g * 0.6, rel: 0.1 }); };
const hat = (A, w, g = 0.07) => hit(A, { when: w, dur: 0.045, f: 7500, gain: g, out: A.mus });
const crash = (A, w, g = 0.25) => hit(A, { when: w, dur: 2.6, f: 3200, gain: g, out: A.mus, att: 0.004 });
const ROOT = [0, 7, 9, 5], MINOR = [0, 0, 1, 0];
const MEL = [ // 한 마디(16칸) 안의 [칸, 높이, 길이] — C·G·Am·F 위의 멜로디
  [[0, 76, 6], [6, 79, 2], [8, 81, 4], [12, 79, 4]], [[0, 79, 6], [6, 76, 2], [8, 74, 4], [12, 71, 4]],
  [[0, 72, 4], [4, 76, 4], [8, 81, 6], [14, 79, 2]], [[0, 77, 6], [6, 76, 2], [8, 72, 8]]];
const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
export function musicStep(A, st, w) {
  if (st < 0) return; // 쇼 시작(0) 전에는 음악 없음
  const bar = Math.floor(st / 16), s = st % 16;
  if (bar >= 73) return;
  const ai = bar >= 60 ? 4 : bar >= 44 ? 3 : bar >= 26 ? 2 : bar >= 10 ? 1 : 0, key = bar >= 60 ? 4 : bar >= 44 ? 2 : 0;
  if (bar === 72) { // 마지막 큰 화음 (E 장조) + 위로 올라가는 종소리
    if (s === 0) { [40, 52, 59, 64, 68, 71, 76].forEach((m, i) => { tone(A, { when: w, f: mtof(m), dur: 4, type: 'sawtooth', gain: 0.05, att: 0.08, rel: 2.5, lp: 2200, det: i % 2 ? 6 : -6 }); }); crash(A, w, 0.35); kick(A, w, 0.7); [64, 68, 71, 76, 80, 83, 88, 92].forEach((m, i) => tone(A, { when: w + i * 0.09, f: mtof(m), dur: 0.2, gain: 0.1, rel: 1.8 })); }
    return;
  }
  const ci = bar % 4, rootM = 48 + key + ROOT[ci], third = MINOR[ci] ? 3 : 4, tri = [0, third, 7];
  if (s === 0) { // 패드
    tri.forEach((iv) => [-7, 7].forEach((d) => tone(A, { when: w, f: mtof(rootM + 12 + iv), dur: BAR * 0.95, type: 'sawtooth', gain: 0.032 + ai * 0.006, att: 0.5, rel: 1.1, lp: 900 + ai * 250, det: d })));
    if (ai >= 3) { tri.forEach((iv) => tone(A, { when: w, f: mtof(rootM + 24 + iv), dur: BAR * 0.95, gain: 0.035, att: 0.3, rel: 1 })); tone(A, { when: w, f: mtof(rootM - 12), dur: BAR, type: 'sawtooth', gain: 0.06, att: 0.1, rel: 0.6, lp: 380 }); }
  }
  if (ai === 0 && s % 2 === 0 && hash(st) < 0.16) { const m = rootM + 36 + [0, third, 7, 12][Math.floor(hash(st + 99) * 4)]; tone(A, { when: w, f: mtof(m), dur: 0.1, gain: 0.05, rel: 1.4, pan: hash(st + 5) - 0.5 }); }
  if (ai >= 1) { // 베이스
    if (ai === 1 && s === 0) tone(A, { when: w, f: mtof(rootM - 12), dur: BAR * 0.9, type: 'triangle', gain: 0.18, att: 0.05, rel: 0.4 });
    else if (ai === 2 && (s === 0 || s === 8)) tone(A, { when: w, f: mtof(rootM - 12), dur: S16 * 7, type: 'triangle', gain: 0.18, att: 0.02, rel: 0.2 });
    else if (ai >= 3 && s % 2 === 0) tone(A, { when: w, f: mtof(rootM - 12 + (s % 4 === 2 ? 12 : 0)), dur: S16 * 1.6, type: 'triangle', gain: 0.17, att: 0.01, rel: 0.12 });
    const seq = [0, 1, 2, 3, 2, 1], every = ai >= 3 ? 1 : 2; // 아르페지오
    if (s % every === 0) { const k = seq[(s / every) % seq.length], iv = k === 3 ? 12 : tri[k]; tone(A, { when: w, f: mtof(rootM + 24 + iv), dur: S16 * 1.4, type: 'triangle', gain: 0.055 + (ai >= 3 ? 0.012 : 0), att: 0.005, rel: 0.15, lp: 3600, pan: ((s % 4) - 1.5) * 0.25 }); }
  }
  if (ai >= 2) for (const [ms, m, len] of MEL[ci]) if (ms === s) { // 멜로디 (종소리 + 윗소리)
    const d = len * S16, f = mtof(m + key); tone(A, { when: w, f, dur: d, gain: 0.13, att: 0.008, rel: 0.7 }); tone(A, { when: w, f: f * 2, dur: d * 0.6, type: 'triangle', gain: 0.04, rel: 0.4 });
    if (ai >= 3) tone(A, { when: w, f: f * 2, dur: d, gain: 0.07, att: 0.01, rel: 0.6 }); if (ai === 4) tone(A, { when: w, f: f * 4, dur: d * 0.5, gain: 0.025, rel: 0.5 });
  }
  if (ai === 2 && s % 8 === 0) kick(A, w, 0.32);
  if (ai >= 3) { if (s % 4 === 0) kick(A, w, 0.5); if (s === 4 || s === 12) snare(A, w, ai === 4 ? 0.26 : 0.2); if (s % 2 === 0 || ai === 4) hat(A, w, s % 4 === 2 ? 0.09 : 0.055); if (ai === 4 && bar % 4 === 3 && s >= 8 && s % 2 === 0) snare(A, w, 0.14); }
  if (s === 0 && (bar === 44 || bar === 60 || bar === 26)) crash(A, w, bar === 26 ? 0.12 : 0.25);
  if (s === 0 && (bar === 9 || bar === 25 || bar === 43 || bar === 59)) hit(A, { when: w, dur: BAR, type: 'highpass', f: 1500, gain: 0.07, rise: true, out: A.mus, to: 7000 }); // 막이 바뀌기 전 점점 커지는 바람 소리
}
export function sfxLaunch(A, w, pan = 0) { tone(A, { when: w, f: 520, glide: 2300, dur: FLY - 0.05, gain: 0.05, att: 0.08, rel: 0.06, out: A.sfx, pan, lp: 5000 }); hit(A, { when: w, dur: FLY - 0.1, type: 'bandpass', f: 600, to: 2400, q: 0.9, gain: 0.07, pan, att: 0.1 }); }
export function sfxBurst(A, w, type, s, pan = 0) {
  const g = Math.min(1.5, s), giant = type === 'giant';
  tone(A, { when: w, f: 120, glide: 36, dur: giant ? 1 : 0.45, gain: 0.5 * g, att: 0.003, rel: giant ? 1.4 : 0.5, out: A.sfx, pan });
  hit(A, { when: w, dur: giant ? 1.1 : 0.45, type: 'lowpass', f: 900, gain: 0.5 * g, pan }); hit(A, { when: w, dur: 0.14, f: 2200, gain: 0.28 * g, pan });
  if (giant) { tone(A, { when: w, f: 62, glide: 30, dur: 1.8, gain: 0.7, rel: 2, out: A.sfx }); crash(A, w, 0.2); }
  const n = giant ? 40 : type === 'willow' || type === 'rainbow' || type === 'palm' ? 24 : 12;
  if (A.budget < 70) { const span = giant ? 3 : type === 'willow' ? 2.2 : 1.4; for (let i = 0; i < n; i++) hit(A, { when: w + 0.12 + Math.random() * span, dur: 0.03, f: 3800 + Math.random() * 2500, gain: 0.05 + Math.random() * 0.06, pan: pan + (Math.random() - 0.5) * 0.5 }); A.budget += n; if (!A.offline) setTimeout(() => (A.budget -= n), 1800); }
  if (type === 'crossette') hit(A, { when: w + 0.75, dur: 0.12, f: 1600, gain: 0.3, pan });
}
export const gerbSfx = (A, w, pan, dur) => hit(A, { when: w, dur, type: 'bandpass', f: 4200, q: 0.6, gain: 0.05, pan, att: 0.3 });


const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const showDist = (x, z) => Math.hypot(x - SHOW_X, z - PARK_GATE.z); // 정문 뒤 쏘는 자리까지
export const showHear = (d) => 1 - smooth(130, 420, d) * 0.88; // 130m 안은 그대로, 420m 밖은 12%
export const panFor = (wz, lz) => Math.max(-1, Math.min(1, -(wz - lz) / 90)); // 서쪽(정문)을 볼 때 오른쪽이 -z

/* audio: audio.js 의 audio · bgm: 배경음악 설정(on, vol) · sfx: 효과음 설정(on, vol) */
export function createShowAudio({ audio, bgm, sfx }) {
  let A = null, mStep = 0, lastT = -1e9, lx = 0, lz = 0, g = 1;
  const user = () => ({ m: bgm.on ? Math.min(1.25, bgm.vol / 0.4) : 0, s: sfx.on ? Math.min(1.25, sfx.vol / 0.7) : 0 });
  const kill = () => { if (!A) return; const o = A; o.master.gain.cancelScheduledValues(0); o.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.04); setTimeout(() => { try { o.master.disconnect(); } catch {} }, 600); A = null; };
  function bus() { A = makeAudio(audio.ctx, audio.out); A.mus.gain.value = 0; A.sfx.gain.value = 0; }
  return {
    // 매 프레임: t = 쇼 시계(초) 또는 null(쇼 아님), 듣는 사람 위치
    tick(t, x, z) {
      const ac = audio.ctx; lx = x; lz = z;
      if (!ac || ac.state !== 'running' || t == null || t < -1 || t > 190) { kill(); lastT = -1e9; return; }
      g = showHear(showDist(x, z));
      if (!A || Math.abs(t - lastT) > 0.8 || t < lastT) { kill(); bus(); mStep = Math.ceil(t / S16 - 1e-6); }
      lastT = t;
      const u = user(), now = ac.currentTime;
      A.mus.gain.setTargetAtTime(0.5 * u.m * g, now, 0.25); A.sfx.gain.setTargetAtTime(u.s * g, now, 0.1);
      while (mStep * S16 < t + 0.4) { const w = now + (mStep * S16 - t); if (w >= now - 0.02) musicStep(A, mStep, Math.max(w, now)); mStep++; }
    },
    launch(e) { if (A) sfxLaunch(A, audio.ctx.currentTime, panFor(e.wz, lz)); },
    burst(e, x, y, z) { if (!A) return; const d = Math.hypot(x - lx, y - 1.7, z - lz); sfxBurst(A, audio.ctx.currentTime + Math.min(0.9, d / 340), e.type, e.s, panFor(z, lz)); },
    em(e) { if (A && e.type === 'gerb') gerbSfx(A, audio.ctx.currentTime, panFor(e.wz, lz), Math.min(e.dur, 6)); },
    get duck() { return A ? Math.min(0.97, 0.97 * g) : 0; }, // 마을 배경음악을 줄이는 정도 (쇼 소리가 들리는 만큼)
  };
}

// 영상용: 쇼 3분 소리를 한꺼번에 가상 렌더링 (화면 없이). 듣는 자리는 listener = { x, z } 고정
export async function renderShowAudio(events, from, to, listener, sr = 44100, { music = true, sfx = true } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * (to - from)), sr), a = makeAudio(ctx, ctx.destination, 1); a.offline = true; a.mus.gain.value = 0.5; a.sfx.gain.value = 1;
  const gh = showHear(showDist(listener.x, listener.z));
  a.mus.gain.value = 0.5 * gh; a.sfx.gain.value = gh;
  if (music) for (let st = Math.ceil(from / S16); st * S16 < to; st++) musicStep(a, st, st * S16 - from);
  if (sfx) for (const e of events) {
    if (e.kind === 'em') { if (e.type === 'gerb' && e.t >= from && e.t < to) gerbSfx(a, e.t - from, panFor(e.wz, listener.z), Math.min(e.dur, 6)); continue; }
    if (e.lt >= from && e.lt < to) sfxLaunch(a, e.lt - from, panFor(e.wz, listener.z));
    const d = Math.hypot(e.wx - listener.x, (e.wy ?? 100) - 1.7, e.wz - listener.z), tb = e.t + Math.min(0.9, d / 340);
    if (tb >= from && tb < to) sfxBurst(a, tb - from, e.type, e.s, panFor(e.wz, listener.z));
  }
  return ctx.startRendering();
}
