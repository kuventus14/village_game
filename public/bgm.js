// 배경음악(BGM): 파일 없이 WebAudio 로 즉석 합성하는 곡 4가지 + 구역·낮밤에 따라 서서히 섞기 + 설정 '🔊 소리'의 '배경음악' 줄
//  낮: 108bpm D장조 펜타토닉 — 마림바 멜로디 · 우쿨렐레풍 코드 · 베이스 · 작은 킥/우드블록/셰이커. 32마디(약 71초) 한 바퀴
//  밤: 62bpm F장조 — 부드러운 패드 · 느린 벨 피아노 단음 · 낮은 베이스 · 멀리 귀뚜라미. 16마디(약 62초)
//  놀이공원: 126bpm 3/4 C장조 왈츠 — 캘리오페(증기 오르간) 멜로디 · 오르골 겹침 · 움파파(튜바+아코디언) · 작은 북. 64마디(약 91초)
//  숲길(사찰 길·불멍 숲길): 멜로디 없음 — 옅은 드론·바람 + 낮엔 매미·풀벌레, 밤엔 귀뚜라미·풀벌레 합창 · 가끔 개구리·올빼미
// 멜로디는 화음 진행·리듬 틀·음계 규칙 안에서 확률로 지어서, 한 바퀴 돌 때마다 조금씩 바뀜 (모두 직접 만든 진행, 저작권 있는 곡 없음)
// 예약은 마디 단위: 마디 시작이 0.2초 안으로 다가오면 그 마디 음을 오디오 시계에 미리 걸어 둠 (프레임이 끊겨도 박자는 정확)
import { audio } from './audio.js';
import { bgmMix, bgmSettings, BGM_KEY, BGM_MAX, FADE_TAU } from './audiodata.js';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
export function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ── 재료: 잡음 버퍼·잔향 임펄스는 AudioContext 마다 한 번 ── */
const KITS = new WeakMap();
function kit(ac) {
  let K = KITS.get(ac); if (K) return K;
  const sr = ac.sampleRate, nb = ac.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const n = Math.floor(sr * 2.4), ir = ac.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / sr / 0.45) * 0.5; }
  K = { noise: nb, ir }; KITS.set(ac, K); return K;
}

/* ── 음 하나 만들기 (X = { ac, out, send:[작은·중간·큰 잔향] }) ── */
// 엔벨로프: 빠른 어택 → 지수 감쇠. 음이 끝나면 노드 연결을 스스로 끊음 (하루 종일 켜 둬도 쌓이지 않게)
function env(X, t, g, a, d, dest, wet) {
  const e = X.ac.createGain();
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(1e-4, t + a + d); e.gain.setValueAtTime(0, t + a + d + 0.005);
  e.connect(dest || X.out); if (wet) e.connect(X.send[wet - 1]);
  return e;
}
function blip(X, t, f, { type = 'sine', g = 0.1, a = 0.004, d = 0.4, wet = 0, dest, det = 0, f2, lp } = {}) {
  const e = env(X, t, g, a, d, dest, wet), o = X.ac.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det;
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + Math.min(d, 0.12));
  let f0 = null; if (lp) { f0 = X.ac.createBiquadFilter(); f0.type = 'lowpass'; f0.frequency.value = lp; o.connect(f0).connect(e); } else o.connect(e);
  o.start(t); o.stop(t + a + d + 0.02); o.onended = () => { e.disconnect(); f0?.disconnect(); };
  return o;
}
function hiss(X, t, d, { g = 0.05, type = 'bandpass', f = 3000, q = 1, a = 0.002, wet = 0, dest } = {}) {
  const s = X.ac.createBufferSource(), fl = X.ac.createBiquadFilter(), e = env(X, t, g, a, d, dest, wet);
  s.buffer = kit(X.ac).noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  s.connect(fl).connect(e); s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.02); s.onended = () => { e.disconnect(); fl.disconnect(); };
}
const vary = (r, v, k = 0.12) => v * (1 - k + r() * 2 * k); // 세기 사람 손처럼 ±12%

/* ── 악기 ── */
const INST = {
  // 마림바: 사인 기음 + 4배 배음(나무 건반 특유) + 채 닿는 짧은 '톡'
  marimba(X, t, m, v) { const f = mtof(m); blip(X, t, f, { g: 0.3 * v, a: 0.002, d: 0.6, wet: 1 }); blip(X, t, f * 4, { g: 0.06 * v, a: 0.001, d: 0.07 }); hiss(X, t, 0.012, { g: 0.03 * v, f: 2600, q: 1.2 }); },
  // 플럭 코드(우쿨렐레풍): 삼각파 화음을 12ms 간격으로 긁음, 짧게
  strum(X, t, notes, v) { notes.forEach((m, i) => blip(X, t + i * 0.012, mtof(m), { type: 'triangle', g: 0.06 * v, a: 0.003, d: 0.28, lp: 3200, wet: 1 })); },
  bass(X, t, m, d, v) { const f = mtof(m); blip(X, t, f, { g: 0.16 * v, a: 0.008, d }); blip(X, t, f, { type: 'triangle', g: 0.09 * v, a: 0.006, d: d * 0.6, lp: 900 }); }, // 폰 스피커는 저음이 약하니 기음보다 배음 쪽을 조금 살림
  kick(X, t, v) { blip(X, t, 130, { g: 0.16 * v, a: 0.002, d: 0.16, f2: 60 }); },
  wood(X, t, v) { blip(X, t, 1050, { type: 'triangle', g: 0.07 * v, a: 0.001, d: 0.045, wet: 1 }); hiss(X, t, 0.015, { g: 0.03 * v, f: 2400, q: 2 }); },
  shaker(X, t, v) { hiss(X, t, 0.045, { g: 0.06 * v, type: 'highpass', f: 6500, a: 0.008 }); },
  // 글로켄슈필·오르골: 맑은 사인 + 비조화 배음 2.76배
  glock(X, t, m, v, d = 1.1) { const f = mtof(m); blip(X, t, f, { g: 0.06 * v, a: 0.002, d, wet: 2 }); blip(X, t, f * 2.76, { g: 0.015 * v, a: 0.001, d: d * 0.35, wet: 2 }); },
  // 벨 피아노(밤): 사인 1·2·3배음, 길게 울림 + 큰 잔향
  epiano(X, t, m, v) { const f = mtof(m); blip(X, t, f, { g: 0.16 * v, a: 0.008, d: 2.8, wet: 3 }); blip(X, t, f * 2, { g: 0.03 * v, a: 0.005, d: 1.1, wet: 3 }); blip(X, t, f * 3.003, { g: 0.008 * v, a: 0.004, d: 0.5, wet: 3 }); },
  // 패드: 음마다 살짝 어긋난 삼각파 둘 → 부드럽게 거름, 천천히 커졌다 천천히 사라짐
  pad(X, t, notes, dur, v, { lp = 1100, a = 1.8, r = 2.5, type = 'triangle' } = {}) {
    const f = X.ac.createBiquadFilter(), e = X.ac.createGain(), amp = 0.03 * v;
    f.type = 'lowpass'; f.frequency.value = lp; f.connect(e); e.connect(X.out); e.connect(X.send[2]);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(amp, t + a); e.gain.setValueAtTime(amp, t + dur); e.gain.linearRampToValueAtTime(0, t + dur + r);
    let left = 0;
    for (const m of notes) for (const det of [-6, 6]) { const o = X.ac.createOscillator(); o.type = type; o.frequency.value = mtof(m); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + r + 0.05); left++; o.onended = () => { if (--left === 0) { f.disconnect(); e.disconnect(); } }; }
  },
  // 캘리오페(증기 오르간): 삼각파 + 약한 사각파, 5.8Hz 떨림, 숨 잡음 조금
  calliope(X, t, m, d, v) {
    const f = mtof(m), e = X.ac.createGain(), lp = X.ac.createBiquadFilter(), lfo = X.ac.createOscillator(), lg = X.ac.createGain(), end = t + d + 0.1;
    lp.type = 'lowpass'; lp.frequency.value = 4000; lp.connect(e); e.connect(X.out); e.connect(X.send[1]);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.085 * v, t + 0.03); e.gain.setValueAtTime(0.075 * v, t + Math.max(0.04, d - 0.04)); e.gain.linearRampToValueAtTime(0, end);
    lfo.frequency.value = 5.8; lg.gain.value = 9; lfo.connect(lg);
    const os = [['triangle', 1], ['square', 0.3]].map(([ty, k]) => { const o = X.ac.createOscillator(), g = X.ac.createGain(); o.type = ty; o.frequency.value = f; g.gain.value = k; lg.connect(o.detune); o.connect(g).connect(lp); o.start(t); o.stop(end + 0.02); return o; });
    lfo.start(t); lfo.stop(end + 0.02);
    os[0].onended = () => { e.disconnect(); lp.disconnect(); lg.disconnect(); };
    hiss(X, t, Math.min(d, 0.25), { g: 0.006 * v, f: f * 2, q: 3, a: 0.02 });
  },
  // 아코디언 '파': 톱니파 둘(±8센트) → 1.6kHz 아래로 거름, 짧게
  accordion(X, t, notes, d, v) { for (const m of notes) for (const det of [-8, 8]) blip(X, t, mtof(m), { type: 'sawtooth', g: 0.014 * v, a: 0.015, d, det, lp: 2200, wet: 1 }); },
  // 튜바 '움': 톱니파를 낮게 거름 + 사인
  tuba(X, t, m, v) { const f = mtof(m); blip(X, t, f, { type: 'sawtooth', g: 0.11 * v, a: 0.02, d: 0.34, lp: 420 }); blip(X, t, f, { g: 0.16 * v, a: 0.015, d: 0.3 }); },
  brush(X, t, v) { hiss(X, t, 0.07, { g: 0.022 * v, type: 'highpass', f: 3500, a: 0.004 }); },
  cymbal(X, t, v) { hiss(X, t, 0.9, { g: 0.018 * v, type: 'highpass', f: 7000, a: 0.002, wet: 2 }); },
};

/* ── 멜로디 짓기 ── */
// spec: 마디마다 { tones: 화음 음(pc), rh: [[박 위치, 길이]...], end: 'root'|'tone'|null } → 마디마다 [[위치, 길이, MIDI]]
// 강박(strong)은 화음 음만, 약박은 음계 음 중 화음 음과 반음 부딪히지 않는 음. 가까운 음으로 걷되 가끔 방향을 바꿈
function allowed(scale, tones, strong) {
  const T = new Set(tones.map((m) => ((m % 12) + 12) % 12));
  if (strong) return T;
  const out = new Set(T);
  for (const p of scale) if (![...T].some((c) => (p - c + 12) % 12 === 1 || (c - p + 12) % 12 === 1)) out.add(p);
  return out;
}
function genBar(r, s, st, o) {
  const notes = [];
  s.rh.forEach(([pos, len], i) => {
    const last = i === s.rh.length - 1;
    let ok = allowed(o.scale, s.tones, o.strong(pos));
    if (last && s.end === 'root') ok = new Set([((s.tones[0] % 12) + 12) % 12]); else if (last && s.end) ok = allowed(o.scale, s.tones, true);
    const cands = []; for (let m = o.lo; m <= o.hi; m++) if (ok.has(m % 12)) cands.push(m);
    if (st.p >= o.hi - 2) st.dir = -1; else if (st.p <= o.lo + 2) st.dir = 1; else if (r() < 0.22) st.dir = -st.dir;
    let tot = 0; const w = cands.map((c) => { const x = Math.exp(-Math.abs(c - st.p - st.dir * 2) / 2.2) * (c === st.p ? 0.35 : 1); tot += x; return x; });
    let u = r() * tot, k = 0; while (k < cands.length - 1 && (u -= w[k]) > 0) k++;
    st.p = cands[k]; notes.push([pos, len, st.p]);
  });
  return notes;
}
function genLine(r, specs, o) { const st = { p: Math.round((o.lo + o.hi) / 2), dir: 1 }; return specs.map((s) => genBar(r, s, st, o)); }
// 변주: 마디마다 rate 확률로 리듬 틀을 바꿔 새로 짓고, 아니면 음 몇 개만 옆 음으로
function varyLine(r, line, specs, o, rate) {
  const st = { p: line[0][0]?.[2] ?? o.lo + 6, dir: 1 };
  return line.map((bar, i) => {
    const s = specs[i];
    if (!s.end && r() < rate) { const ns = { ...s, rh: o.rhythms[Math.floor(r() * o.rhythms.length)] }; return genBar(r, ns, st, o); }
    const nb = bar.map(([pos, len, m]) => {
      if (r() < rate * 0.6 && !(s.end && pos === bar.at(-1)[0])) { const ok = allowed(o.scale, s.tones, o.strong(pos)); for (const dm of r() < 0.5 ? [1, -1, 2, -2] : [-1, 1, -2, 2]) if (ok.has((m + dm + 120) % 12) && m + dm >= o.lo && m + dm <= o.hi) return [pos, len, m + dm]; }
      return [pos, len, m];
    });
    if (nb.length) st.p = nb.at(-1)[2];
    return nb;
  });
}
const voiced = (tones, lo) => tones.map((m) => { while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; }).sort((a, b) => a - b);
const tri = (r, q) => ({ r, t: [r, r + (q === 'm' ? 3 : 4), r + 7] });

/* ── 곡 ── (X, r = 난수, opt) → { barSec, bar(t, k), param?(nk, t), stop?() } */
const SONGS = {
  day(X, r) {
    const beat = 60 / 108, sw = beat * 0.06; // 살짝 튀는 스윙 (뒤 8분음표를 6% 늦게)
    const A = [tri(50), tri(47, 'm'), tri(43), tri(45), tri(50), tri(42, 'm'), tri(43), tri(45)]; // D Bm G A D F#m G A
    const B = [tri(43), tri(45), tri(42, 'm'), tri(47, 'm'), tri(40, 'm'), tri(45), tri(50), tri(50)]; // G A F#m Bm Em A D D
    const RH = [[[0, 1], [1, 0.5], [1.5, 1], [3, 1]], [[0, 0.5], [0.5, 0.5], [1, 1], [2.5, 0.5], [3, 1]], [[0, 1.5], [1.5, 0.5], [2, 0.5], [2.5, 1.5]], [[0.5, 0.5], [1, 0.5], [1.5, 1], [2.5, 0.5], [3, 0.5], [3.5, 0.5]], [[0, 1], [1, 1], [2, 1], [3, 0.5], [3.5, 0.5]], [[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 2]]];
    const END = [[[0, 1], [1, 3]], [[0, 2], [2, 2]], [[0, 0.5], [0.5, 0.5], [1, 3]]];
    const O = { lo: 69, hi: 86, scale: [2, 4, 6, 9, 11], strong: (p) => p % 2 === 0, rhythms: RH };
    const specs = (ch) => ch.map((c, i) => ({ tones: c.t, rh: (i % 4 === 3 ? END : RH)[Math.floor(r() * (i % 4 === 3 ? END : RH).length)], end: i === 7 ? 'root' : i % 4 === 3 ? 'tone' : null }));
    let sa, sb, a, a2, b, a3;
    const compose = (first) => {
      if (first) { sa = specs(A); sb = specs(B); a = genLine(r, sa, O); b = genLine(r, sb, O); } else { a = varyLine(r, a, sa, O, 0.3); if (r() < 0.5) b = genLine(r, sb, O); }
      a2 = varyLine(r, a, sa, O, 0.15); a3 = varyLine(r, a, sa, O, 0.25);
    };
    compose(true);
    const BASS = [[[0, 0, 1.4], [1.5, 0, 0.4], [2, 7, 1.4], [3.5, 0, 0.4]], [[0, 0, 0.9], [1, 12, 0.4], [2, 7, 0.9], [3, 0, 0.9]]];
    return {
      barSec: beat * 4,
      bar(t, k) {
        const pos = k % 32, sec = pos >> 3, c = (sec === 2 ? B : A)[pos & 7];
        if (pos === 0 && k) compose(false);
        const line = [a, a2, b, a3][sec][pos & 7];
        const at = (p) => t + p * beat + (p % 1 ? sw : 0) + (r() - 0.5) * 0.008;
        const drums = k >= 2 && pos !== 16; // 처음 두 마디·B 시작 마디는 북 쉼
        if (drums) {
          INST.kick(X, at(0), vary(r, 0.8)); INST.kick(X, at(2), vary(r, 0.6)); if ((pos & 7) === 7) INST.kick(X, at(3.5), 0.45);
          INST.wood(X, at(1), vary(r, 0.6)); INST.wood(X, at(3), vary(r, 0.6));
        }
        if (k >= 1) for (let i = 0; i < 8; i++) INST.shaker(X, at(i / 2), vary(r, i % 2 ? 0.8 : 0.45));
        let bm = c.r - 12; if (bm < 33) bm += 12;
        for (const [p, iv, d] of BASS[(pos >> 1) & 1]) INST.bass(X, at(p), bm + iv, d * beat, vary(r, 0.9, 0.08));
        const ch = voiced(c.t, 60);
        INST.pad(X, t, voiced(c.t, 57), beat * 4 - 0.2, 0.35, { a: 0.25, r: 0.6, lp: 1500 }); // 아주 옅은 바탕 화음 (마림바 사이 빈틈을 메움)
        [[1, 0.8], [2.5, 0.5], [3, 0.8]].forEach(([p, v]) => INST.strum(X, at(p), ch, vary(r, v)));
        if (k >= 2) for (const [p, , m] of line) INST.marimba(X, at(p), m, vary(r, p % 1 ? 0.72 : 0.95));
        if (sec === 2) for (const p of [0, 2]) if (r() < 0.55) INST.glock(X, at(p + 0.5), voiced(c.t, 74)[Math.floor(r() * 3)], vary(r, 0.55), 0.8); // B: 높은 글로켄 대선율
      },
    };
  },

  night(X, r, opt) {
    const beat = 60 / 62;
    const CH = [[41, [53, 57, 60, 64]], [45, [57, 60, 64, 67]], [46, [58, 62, 65, 69]], [41, [57, 60, 64, 65]], [38, [57, 60, 62, 65]], [46, [58, 62, 65, 69]], [43, [58, 62, 65, 67]], [48, [55, 60, 65, 67]]]; // Fmaj7 Am7 B♭maj7 Fmaj7 Dm7 B♭maj7 Gm7 Csus4 (화음 하나 2마디)
    const RH = [[[0, 2], [2, 2]], [[0, 3], [3, 1]], [[0, 1.5], [1.5, 2.5]], [[1, 3]], [[0, 1], [1, 1], [2, 2]], [], [[0.5, 1.5], [2, 2]]];
    const O = { lo: 65, hi: 81, scale: [5, 7, 9, 0, 2], strong: (p) => p % 2 === 0, rhythms: RH.filter((x) => x.length) };
    const specs = CH.flatMap(([, t], i) => [0, 1].map((h) => ({ tones: t, rh: h && r() < 0.3 ? [] : RH[Math.floor(r() * RH.length)], end: i === 7 && h ? 'root' : null })));
    specs[15] = { tones: CH[7][1], rh: [[0, 4]], end: null };
    let line = genLine(r, specs, O);
    const bugs = [0, 1].map(() => cricket(X, r, X.out, { lvl: 0.25 + r() * 0.15, f: 4100 + r() * 900 })); // 멀리 귀뚜라미 두 마리 (아주 작게)
    return {
      barSec: beat * 4,
      bar(t, k) {
        const pos = k % 16, [root, tones] = CH[pos >> 1];
        if (pos === 0 && k) line = varyLine(r, line, specs, O, 0.35);
        if (pos % 2 === 0) { INST.pad(X, t, tones, beat * 8 - 0.3, 1, { lp: 1000 }); INST.bass(X, t, root, beat * 7, 0.3); }
        if (k >= 1) for (const [p, , m] of line[pos]) INST.epiano(X, t + p * beat + (r() - 0.5) * 0.024, m, vary(r, p % 2 ? 0.7 : 0.9));
        if (pos % 4 === 2 && r() < 0.35) voiced(tones, 77).forEach((m, i) => INST.glock(X, t + (2 + i * 0.5) * beat, m, vary(r, 0.3), 1.6)); // 가끔 높은 반짝 분산화음
        for (const b of bugs) b.run(t + beat * 4, opt?.lvl ?? 1);
      },
      stop() { bugs.forEach((b) => b.stop()); },
    };
  },

  park(X, r) {
    const beat = 60 / 126;
    const C = { r: 48, t: [60, 64, 67] }, G7 = { r: 43, t: [59, 62, 65, 67] }, F = { r: 41, t: [60, 65, 69] }, Am = { r: 45, t: [60, 64, 69] }, D7 = { r: 50, t: [60, 62, 66, 69] };
    const A = [C, C, G7, G7, G7, G7, C, C, C, C, F, F, C, G7, C, C], B = [F, F, C, C, G7, G7, C, C, F, F, C, Am, D7, G7, C, C];
    const RH = [[[0, 1], [1, 1], [2, 1]], [[0, 2], [2, 1]], [[0, 1.5], [1.5, 0.5], [2, 1]], [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1]], [[0, 1], [1, 2]]];
    const END = [[[0, 3]], [[0, 2], [2, 1]]];
    const mk = (lo, hi) => ({ lo, hi, scale: [0, 2, 4, 5, 7, 9, 11], strong: (p) => p === 0, rhythms: RH });
    const OA = mk(72, 88), OB = mk(67, 81);
    const specs = (ch) => ch.map((c, i) => ({ tones: c.t, rh: i % 8 === 7 ? END[0] : i % 4 === 3 ? END[Math.floor(r() * 2)] : RH[Math.floor(r() * RH.length)], end: i % 8 === 7 ? 'root' : i % 4 === 3 ? 'tone' : null }));
    const sa = specs(A), sb = specs(B);
    let a = genLine(r, sa, OA), b = genLine(r, sb, OB), a2, a3;
    const re = () => { a2 = varyLine(r, a, sa, OA, 0.15); a3 = varyLine(r, a, sa, OA, 0.25); };
    re();
    const lp = X.ac.createBiquadFilter(), g = X.ac.createGain(), out = X.out; // 밤엔 조금 부드럽게 (고음을 거르고 살짝 작게)
    lp.type = 'lowpass'; lp.frequency.value = 7000; lp.connect(g).connect(out); X.out = lp; let first = true; // 처음 한 번은 바로 맞춤
    return {
      barSec: beat * 3,
      bar(t, k) {
        const pos = k % 64, sec = pos >> 4, c = (sec === 2 ? B : A)[pos & 15];
        if (pos === 0 && k) { a = varyLine(r, a, sa, OA, 0.3); if (r() < 0.5) b = genLine(r, sb, OB); re(); }
        const line = [a, a2, b, a3][sec][pos & 15];
        const at = (p) => t + p * beat + (r() - 0.5) * 0.006;
        let om = pos % 2 ? c.r + 7 : c.r; if (om > 52) om -= 12;
        INST.tuba(X, at(0), om, vary(r, 0.9, 0.08));
        for (const p of [1, 2]) INST.accordion(X, at(p), voiced(c.t, 60), 0.2, vary(r, p === 1 ? 0.9 : 0.75, 0.08));
        if (k >= 1) { INST.kick(X, at(0), vary(r, 0.45)); INST.brush(X, at(1), vary(r, 0.8)); INST.brush(X, at(2), vary(r, 0.6)); }
        if ((pos & 7) === 0 && k) INST.cymbal(X, at(0), 1);
        if (k >= 1) for (const [p, len, m] of line) {
          INST.calliope(X, at(p), m, len * beat * 0.9, vary(r, p === 0 ? 0.95 : 0.8, 0.08));
          if (sec === 1 || sec === 3) INST.glock(X, at(p), m + 12, vary(r, 0.45), 0.6); // 두 번째·마지막 A: 오르골이 한 옥타브 위로 겹침
        }
      },
      param(nk, t) { const f = 7000 - 4200 * nk, v = 1 - 0.2 * nk; if (first) { first = false; lp.frequency.value = f; g.gain.value = v; } else { lp.frequency.setTargetAtTime(f, t, 1); g.gain.setTargetAtTime(v, t, 1); } },
    };
  },

  forest(X, r, opt) {
    const ac = X.ac, lite = !!opt?.lite, mk = (v) => { const g = ac.createGain(); g.gain.value = v; g.connect(X.out); return g; };
    const dayB = mk(1), nightB = mk(0), trillB = mk(0.5); let nk = 0, first = true;
    // 옅은 드론(D3·A3, 천천히 숨 쉬듯) + 바람 (낮은 잡음이 아주 천천히 일렁임)
    const keep = [];
    for (const [m, a] of [[50, 0.007], [57, 0.005], [62, 0.002]]) { const o = ac.createOscillator(), e = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(); o.frequency.value = mtof(m); e.gain.value = a; l.frequency.value = 0.04 + r() * 0.04; lg.gain.value = a * 0.7; l.connect(lg).connect(e.gain); o.connect(e).connect(X.out); e.connect(X.send[2]); o.start(); l.start(); keep.push(o, l); }
    { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), w = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(); s.buffer = kit(ac).noise; s.loop = true; f.type = 'lowpass'; f.frequency.value = 360; w.gain.value = 0.03; l.frequency.value = 0.07; lg.gain.value = 0.02; l.connect(lg).connect(w.gain); s.connect(f).connect(w).connect(X.out); s.start(); l.start(); keep.push(s, l); }
    const n = (k) => (lite ? Math.ceil(k / 2) : k);
    const crickets = Array.from({ length: n(6) }, () => cricket(X, r, nightB));
    const trills = Array.from({ length: n(3) }, () => trill(X, r, trillB));
    const cicadas = [cicada(X, r, dayB, 'meem'), ...(lite ? [] : [cicada(X, r, dayB, 'buzz')])];
    let frogAt = 6 + r() * 10, owlAt = 25 + r() * 30, T0 = null;
    return {
      barSec: 2,
      bar(t) {
        if (T0 == null) T0 = t;
        const until = t + 2, dn = Math.sqrt(1 - nk), nn = Math.sqrt(nk);
        for (const c of crickets) c.run(until, nn > 0.03 ? 1 : 0);
        for (const c of trills) c.run(until, 1);
        for (const c of cicadas) c.run(until, dn > 0.03 ? 1 : 0);
        if (nn > 0.03 && t - T0 > frogAt) { frog(X, r, nightB, t + r()); frogAt = t - T0 + 12 + r() * 20; }
        if (nn > 0.03 && t - T0 > owlAt) { owl(X, r, nightB, t + r()); owlAt = t - T0 + 40 + r() * 50; }
      },
      param(v, t, glow = 0) {
        nk = v; const set = (n, x) => (first ? (n.gain.value = x) : n.gain.setTargetAtTime(x, t, 1)); // 처음 한 번은 바로 맞춤
        set(dayB, Math.sqrt(1 - v)); set(nightB, Math.sqrt(v) * (1 + 0.6 * glow)); set(trillB, 0.45 + 0.55 * v); first = false;
      },
      stop() { keep.forEach((o) => o.stop()); [...crickets, ...trills, ...cicadas].forEach((c) => c.stop()); },
    };
  },
};

/* ── 벌레·밤 동물 (개체마다 고유한 음높이·박자·좌우 위치, 가끔 쉼) ── */
// 귀뚜라미: 4~5kHz 사인 펄스 2~4개가 한 번의 '찌르르', 개체마다 0.35~0.85초 간격으로 반복하다 가끔 몇 초 쉼
function cricket(X, r, dest, { f = 3900 + r() * 1300, lvl = 0.5 + r() * 0.5, pan = r() * 1.8 - 0.9 } = {}) {
  const ac = X.ac, o = ac.createOscillator(), e = ac.createGain(), p = ac.createStereoPanner();
  o.frequency.value = f; e.gain.value = 0; p.pan.value = pan; o.connect(e).connect(p).connect(dest); o.start();
  const pulses = 2 + Math.floor(r() * 3), plen = 0.012 + r() * 0.008, gap = 0.03 + r() * 0.012, every = 0.35 + r() * 0.5;
  let next = ac.currentTime + r() * every, sing = next + 3 + r() * 10;
  const A = 0.09 * lvl;
  return {
    run(until, on) {
      if (next < ac.currentTime) next = ac.currentTime + r() * 0.2;
      while (next < until) {
        const t = next;
        if (!on) { next = until + r() * every; break; }
        if (t > sing) { next = t + 1 + r() * 5; sing = next + 4 + r() * 12; continue; }
        const a = A * (0.8 + r() * 0.4);
        for (let i = 0; i < pulses; i++) { const s = t + i * gap; e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(a, s + 0.003); e.gain.setValueAtTime(a, s + plen - 0.003); e.gain.linearRampToValueAtTime(0, s + plen); }
        next = t + every * (0.92 + r() * 0.16);
      }
    },
    stop() { o.stop(); },
  };
}
// 풀벌레(방울벌레풍): 5.5~7.5kHz 사인을 30~50Hz 로 떨게 해 '링리리링', 1.5~4초 울고 1~6초 쉼
function trill(X, r, dest) {
  const ac = X.ac, o = ac.createOscillator(), am = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(), e = ac.createGain(), p = ac.createStereoPanner();
  o.frequency.value = 5500 + r() * 2000; l.frequency.value = 30 + r() * 20; am.gain.value = 0.5; lg.gain.value = 0.5; l.connect(lg).connect(am.gain);
  e.gain.value = 0; p.pan.value = r() * 1.6 - 0.8; o.connect(am).connect(e).connect(p).connect(dest); o.start(); l.start();
  let next = ac.currentTime + r() * 3; const A = 0.035 * (0.6 + r() * 0.4);
  return {
    run(until, on) {
      if (next < ac.currentTime) next = ac.currentTime + r();
      while (next < until) {
        const t = next, d = 1.5 + r() * 2.5, a = A * (0.7 + r() * 0.5);
        if (on) { e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(a, t + 0.35); e.gain.setValueAtTime(a, t + d - 0.4); e.gain.linearRampToValueAtTime(0, t + d); }
        next = t + d + 1 + r() * 5;
      }
    },
    stop() { o.stop(); l.stop(); },
  };
}
// 매미: 잡음을 4~5.5kHz 대역으로 거르고 빠르게 떨게 함. 'meem' = 참매미처럼 '맴-맴-맴' 음절이 점점 커졌다 작아짐, 'buzz' = 멀리서 '치이이' 길게
function cicada(X, r, dest, kind) {
  const ac = X.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), am = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(), e = ac.createGain(), p = ac.createStereoPanner();
  s.buffer = kit(ac).noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = kind === 'meem' ? 4600 + r() * 600 : 4000 + r() * 800; f.Q.value = 2.5;
  l.frequency.value = 90 + r() * 50; am.gain.value = 0.6; lg.gain.value = 0.4; l.connect(lg).connect(am.gain);
  e.gain.value = 0; p.pan.value = r() * 1.4 - 0.7; s.connect(f).connect(am).connect(e).connect(p).connect(dest); s.start(); l.start();
  let next = ac.currentTime + 2 + r() * 6; const A = kind === 'meem' ? 0.29 : 0.14;
  return {
    run(until, on) {
      if (next < ac.currentTime) next = ac.currentTime + r() * 2;
      while (next < until) {
        const t = next;
        if (!on) { next = until + 2 + r() * 4; break; }
        if (kind === 'meem') { // 음절 8~16개 (0.28초 간격), 처음엔 작다가 커지고 끝에서 잦아듦
          const n = 8 + Math.floor(r() * 9);
          for (let i = 0; i < n; i++) { const s0 = t + i * 0.28, a = A * Math.sin(Math.PI * (i + 0.5) / n) ** 0.7; e.gain.setValueAtTime(a * 0.15, s0); e.gain.linearRampToValueAtTime(a, s0 + 0.07); e.gain.setValueAtTime(a, s0 + 0.15); e.gain.linearRampToValueAtTime(a * 0.15, s0 + 0.25); }
          e.gain.linearRampToValueAtTime(0, t + n * 0.28 + 0.1); next = t + n * 0.28 + 4 + r() * 10;
        } else { const d = 6 + r() * 6; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(A, t + d * 0.4); e.gain.linearRampToValueAtTime(0, t + d); next = t + d + 3 + r() * 8; }
      }
    },
    stop() { s.stop(); l.stop(); },
  };
}
// 개구리 '개굴개굴': 낮은 톱니파를 두 대역(입 모양)으로 거르고 28Hz 로 끊어서, 2~4번
function frog(X, r, dest, t) {
  const n = 2 + Math.floor(r() * 3), f0 = 120 + r() * 60, p = X.ac.createStereoPanner(); p.pan.value = r() * 1.6 - 0.8; p.connect(dest);
  for (let i = 0; i < n; i++) {
    const s = t + i * (0.22 + r() * 0.06), o = X.ac.createOscillator(), b1 = X.ac.createBiquadFilter(), b2 = X.ac.createBiquadFilter(), am = X.ac.createGain(), l = X.ac.createOscillator(), e = env(X, s, 0.05, 0.01, 0.13, p);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, s); o.frequency.linearRampToValueAtTime(f0 * 0.9, s + 0.14);
    b1.type = b2.type = 'bandpass'; b1.frequency.value = 700; b2.frequency.value = 1500; b1.Q.value = 4; b2.Q.value = 5;
    l.type = 'square'; l.frequency.value = 28; am.gain.value = 0.5; l.connect(am.gain);
    o.connect(b1).connect(am); o.connect(b2).connect(am); am.connect(e);
    o.start(s); l.start(s); o.stop(s + 0.16); l.stop(s + 0.16); o.onended = () => { e.disconnect(); am.disconnect(); if (i === n - 1) p.disconnect(); };
  }
}
// 올빼미 '부-엉': 낮은 사인 두 번 (두 번째가 살짝 길고 낮게), 큰 잔향
function owl(X, r, dest, t) {
  const f = 300 + r() * 50;
  for (const [dt, d, k] of [[0, 0.3, 1], [0.75, 0.45, 0.93]]) {
    const s = t + dt, o = X.ac.createOscillator(), e = X.ac.createGain();
    o.frequency.setValueAtTime(f * k * 1.04, s); o.frequency.exponentialRampToValueAtTime(f * k, s + 0.08);
    e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(0.05, s + 0.07); e.gain.setValueAtTime(0.05, s + d - 0.1); e.gain.linearRampToValueAtTime(0, s + d);
    o.connect(e).connect(dest); e.connect(X.send[2]); o.start(s); o.stop(s + d + 0.02); o.onended = () => e.disconnect();
  }
}

/* ── 곡 하나를 재생하는 트랙: out(크기 조절용 GainNode) 하나로 나감 ── */
const TRIM = { day: 1, night: 1.25, park: 1, forest: 1.6 }; // 곡끼리 귀에 들리는 크기(A 가중) 맞춤: 낮·밤·놀이공원 비슷하게, 숲길은 3~4dB 작게 (오프라인 렌더로 잼)
export function makeTrack(ac, dest, name, { seed = (Math.random() * 2 ** 31) | 0, lite = false } = {}) {
  const out = ac.createGain(), trim = ac.createGain(), verb = ac.createConvolver(), r = rng(seed);
  out.gain.value = 0; trim.gain.value = TRIM[name]; out.connect(trim).connect(dest); verb.buffer = kit(ac).ir; verb.connect(out);
  const send = [0.12, 0.3, 0.6].map((v) => { const g = ac.createGain(); g.gain.value = v; g.connect(verb); return g; });
  const X = { ac, out, send }, song = SONGS[name](X, r, { lite });
  let t = ac.currentTime + 0.05, k = 0;
  return {
    out,
    run(until) {
      while (t < until) {
        if (t < ac.currentTime - 0.02) { t += song.barSec; k++; continue; } // 탭이 멈췄다 돌아오면 지난 마디는 건너뜀 (한꺼번에 쏟아지지 않게)
        song.bar(t, k++); t += song.barSec;
      }
    },
    param(nk, glow = 0) { song.param?.(nk, ac.currentTime, glow); },
    stop() { song.stop?.(); trim.disconnect(); },
  };
}
export const SONG_NAMES = Object.keys(SONGS);
export const compose = { allowed, genLine, varyLine }; // 시험용 (멜로디 규칙)

/* ── 게임 안 재생기: 구역·낮밤을 보고 곡 크기를 3~4초에 걸쳐 바꾸고, 안 들리는 곡은 멈춰 노드를 놓아줌 ── */
export function createBgm({ menu, lite = false } = {}) {
  let S = bgmSettings((() => { try { return localStorage.getItem(BGM_KEY); } catch { return null; } })());
  let ac = null, bus = null, lp = null, acc = 1, last = null;
  const live = {}, quiet = {};
  function setup() {
    ac = audio.ctx; if (!ac) return;
    lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; bus = ac.createGain(); bus.gain.value = 0; lp.connect(bus).connect(audio.out);
    setInterval(() => { if (ac.state !== 'running') return; const until = ac.currentTime + 0.2; for (const k in live) live[k].run(until); }, 25);
  }
  function apply(st) {
    const m = bgmMix(st), now = ac.currentTime, on = S.on && S.vol > 0;
    bus.gain.setTargetAtTime(on ? S.vol * BGM_MAX * m.master * (1 - (st.duck || 0)) : 0, now, FADE_TAU); // duck: 불꽃놀이 음악이 들릴 땐 마을 배경음악을 줄임
    lp.frequency.setTargetAtTime(m.lp, now, 0.6);
    for (const k of SONG_NAMES) {
      const g = on && m.master > 0 ? m.gain[k] : 0;
      if (g > 0.01 && !live[k]) { live[k] = makeTrack(ac, lp, k, { lite }); quiet[k] = 0; }
      const tr = live[k]; if (!tr) continue;
      tr.out.gain.setTargetAtTime(g, now, FADE_TAU);
      tr.param(m.nk, st.glow || 0); // glow: 반딧불이가 보이는 정도 → 숲 밤 벌레 소리를 키움
      if (g <= 0.01) { if ((quiet[k] += 0.25) > 6) { tr.stop(); delete live[k]; } } else quiet[k] = 0;
    }
  }
  const save = () => { try { localStorage.setItem(BGM_KEY, JSON.stringify(S)); } catch {} };
  if (menu) { // 설정 '🔊 소리' 아래 효과음 줄 바로 뒤에 '배경음악' 켜기·크기
    const row = document.createElement('div'); row.className = 'sfx';
    row.innerHTML = `<span>배경음악</span><button data-bgm aria-pressed="${S.on}">${S.on ? '켜짐' : '꺼짐'}</button><input type="range" min="0" max="100" value="${Math.round(S.vol * 100)}" aria-label="배경음악 크기">`;
    const fx = menu.querySelector('.sfx'); fx ? fx.after(row) : menu.append(row);
    const btn = row.querySelector('button'), vol = row.querySelector('input');
    btn.onclick = (e) => { e.stopPropagation(); S.on = !S.on; save(); btn.textContent = S.on ? '켜짐' : '꺼짐'; btn.setAttribute('aria-pressed', S.on); audio.unlock(); acc = 1; };
    vol.oninput = () => { S.vol = vol.value / 100; save(); acc = 1; };
    vol.onclick = (e) => e.stopPropagation();
  }
  return {
    // 매 프레임 불러도 됨 (0.25초마다 한 번만 계산). st = { night, x, z, pl, inKey }
    update(dt, st) {
      last = st; acc += dt; if (acc < 0.25) return; acc = 0;
      if (!bus) { setup(); if (!bus) return; }
      if (ac.state === 'running') apply(st);
    },
    get on() { return S.on; }, get vol() { return S.vol; },
    get playing() { return Object.keys(live).filter((k) => live[k].out.gain.value > 0.01); }, // 시험·디버깅용
    get mix() { return last && bgmMix(last); },
  };
}
export const synth = { env, blip, hiss, kit, vary, mtof, frog }; // 효과음(fx.js)이 같은 재료로 소리를 만듦
