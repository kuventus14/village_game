// 소리: WebAudio 로 합성만 (파일 없음). 목탁·범종·염불·오르간/합창 성가·찬양 반주·피아노·촛불·염주 딸깍·성당 종·풍경.
// 브라우저는 사용자가 한 번 누르기 전엔 소리를 못 냄 → 첫 터치/키 입력 때 AudioContext 를 만들고, 그 전엔 조용히 아무것도 안 함.
// 곡은 모두 직접 만든 간단한 화음 진행 (저작권 있는 곡 없음). 거리·건물에 따른 크기는 rituals.js 가 정해서 g(0~1)로 넘김
const KEY = 'village.sfx';
const S = (() => { try { return { on: true, vol: 0.7, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { on: true, vol: 0.7 }; } })();
let ac = null, master = null, rev = null, noiseBuf = null, DEST = null; // DEST: 배경 소리 안에서 낼 때 그 배경의 크기 노드로 보냄
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function init() {
  if (ac || !S.on) { if (ac?.state === 'suspended') ac.resume().catch(() => {}); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; return; }
  master = ac.createGain(); master.gain.value = S.vol; master.connect(ac.destination);
  // 잔향: 지수로 줄어드는 잡음 임펄스 3초 (성당·법당 울림)
  const n = ac.sampleRate * 3, ir = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3.2; }
  const conv = ac.createConvolver(); conv.buffer = ir; rev = ac.createGain(); rev.gain.value = 0.5; rev.connect(conv).connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, init, { passive: true });

const ready = () => ac && ac.state === 'running' && S.on && S.vol > 0;
// 출력: 원음 + 잔향 보내기
function out(node, wet = 0.2) { if (DEST) { node.connect(DEST); return node; } node.connect(master); if (wet) { const s = ac.createGain(); s.gain.value = wet; node.connect(s).connect(rev); } return node; }
// 음 하나: 오실레이터 → 엔벨로프(빠른 어택, 지수 감쇠). 반환: 끝나는 시각
function tone(f, t, { type = 'sine', g = 0.3, a = 0.005, d = 1, f2, wet = 0.2, dest } = {}) {
  g = Math.max(g, 1e-4); // 지수 램프는 0 을 못 받음
  const o = ac.createOscillator(), e = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + Math.min(0.08, d));
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  o.connect(e); dest ? e.connect(dest) : out(e, wet);
  o.start(t); o.stop(t + a + d + 0.05);
  return t + a + d;
}
function noise(t, dur, { g = 0.2, type = 'bandpass', f = 2000, q = 1, a = 0.002, wet = 0.1 } = {}) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), e = ac.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  s.connect(fl).connect(e); out(e, wet); s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
}
const into = (g, fn) => { DEST = g; try { fn(); } finally { DEST = null; } };
const V = (g) => Math.max(0, Math.min(1.5, g ?? 1));

/* ── 한 번 나는 소리 (g = 거리·건물로 줄인 크기 0~1) ── */
const SND = {
  // 목탁: 속이 빈 나무 'tok' — 삼각파 640→520Hz 0.15초 + 배음 + 짧은 잡음 딸깍
  moktak(t, g) { tone(640, t, { type: 'triangle', g: 0.5 * g, a: 0.002, d: 0.15, f2: 520, wet: 0.25 }); tone(1290, t, { g: 0.12 * g, a: 0.001, d: 0.05 }); noise(t, 0.02, { g: 0.12 * g, f: 2500 }); },
  // 범종: 82Hz 낮은 울림 + 비조화 배음(종 특유), 82·82.4Hz 맥놀이(웅~웅), 길게 12초 감쇠 + 당목이 닿는 둔탁한 소리
  bell(t, g) {
    for (const [r, a, d] of [[1, 0.5, 12], [1.005, 0.4, 12], [2, 0.22, 9], [2.76, 0.16, 7], [3.4, 0.14, 5.5], [5.4, 0.07, 3.5], [8.9, 0.03, 2]]) tone(82 * r, t, { g: a * g, a: 0.012, d, wet: 0.45 });
    noise(t, 0.35, { g: 0.35 * g, type: 'lowpass', f: 260, wet: 0.3 });
  },
  // 성당 종: 330Hz 기준 종 배음(험 0.5·프라임 1·단3도 1.2·5도 1.5·노미널 2), 4초
  churchBell(t, g) { for (const [r, a, d] of [[0.5, 0.25, 4.5], [1, 0.3, 3.5], [1.2, 0.18, 3], [1.5, 0.12, 2.5], [2, 0.16, 2], [2.66, 0.06, 1.2]]) tone(330 * r, t, { g: a * g, a: 0.004, d, wet: 0.5 }); },
  // 염주·묵주 알 딸깍: 짧은 높은 톡
  click(t, g) { tone(2600, t, { g: 0.12 * g, a: 0.001, d: 0.03, wet: 0.05 }); tone(1700, t + 0.004, { g: 0.08 * g, a: 0.001, d: 0.04, wet: 0.05 }); },
  // 촛불: 성냥 긋는 '칙' + 불 붙는 '후'
  candle(t, g) { noise(t, 0.12, { g: 0.25 * g, type: 'highpass', f: 2800, a: 0.03 }); noise(t + 0.14, 0.5, { g: 0.18 * g, type: 'lowpass', f: 450, a: 0.08 }); },
  // 풍경(처마 끝 종): 맑은 고음 두 배음, 2.5초
  chime(t, g) { const f = [1568, 1760, 2093][Math.floor(Math.random() * 3)]; tone(f, t, { g: 0.06 * g, a: 0.002, d: 2.5, wet: 0.4 }); tone(f * 2.76, t, { g: 0.02 * g, a: 0.002, d: 1.2, wet: 0.4 }); },
  // 축하: 밝은 세 음
  yay(t, g) { [72, 76, 79, 84].forEach((m, i) => tone(mtof(m), t + i * 0.09, { type: 'triangle', g: 0.12 * g, d: 0.5, wet: 0.3 })); },
};
// 피아노 음 하나: n = 0(가운데 도 C4) ~ 24(C6). 삼각파+배음, 높을수록 짧게
function piano(n, g = 1, t = ac.currentTime) {
  const f = mtof(60 + n), d = 1.8 - n * 0.03, lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(900, t + d); out(lp, 0.25);
  tone(f, t, { type: 'triangle', g: 0.32 * g, a: 0.004, d, dest: lp }); tone(f * 2, t, { g: 0.1 * g, a: 0.003, d: d * 0.6, dest: lp }); tone(f * 3, t, { g: 0.04 * g, a: 0.003, d: d * 0.3, dest: lp });
}

/* ── 계속 흐르는 소리(배경): 크기를 0 으로 두면 멈추고, 올리면 다시 시작 ── */
// 화음 진행: [근음 MIDI, 장(0)/단(1)]
const tri = ([r, mi]) => [r, r + (mi ? 3 : 4), r + 7];
const HYMN = [[53, 0], [50, 1], [46, 0], [48, 0], [53, 0], [57, 1], [46, 0], [48, 0], [50, 1], [46, 0], [53, 0], [48, 0], [46, 0], [53, 0], [48, 0], [53, 0]]; // F 장조, 한 화음 4초 × 16 = 64초
const PRAISE = [ // 곡마다 8화음(가사 한 줄 = 2화음, 3초씩)
  [[55, 0], [52, 1], [48, 0], [50, 0], [55, 0], [47, 1], [48, 0], [55, 0]], // G
  [[50, 0], [47, 1], [43, 0], [45, 0], [50, 0], [54, 1], [43, 0], [50, 0]], // D
  [[48, 0], [45, 1], [53, 0], [55, 0], [48, 0], [52, 1], [53, 0], [48, 0]], // C
  [[53, 0], [50, 1], [46, 0], [48, 0], [46, 0], [53, 0], [48, 0], [53, 0]], // F
];
function makeBed(build) {
  let lv = 0, node = null, stopAt = 0;
  return {
    level(v, arg) { // 매 프레임 불러도 됨
      if (!ready()) { if (node) { node.stop(); node = null; } return; }
      v = Math.max(0, Math.min(1, v));
      if (v > 0.002 && !node) { node = build(arg); node.g.gain.value = 0; }
      if (node) { node.g.gain.setTargetAtTime(v, ac.currentTime, 0.4); node.arg?.(arg); }
      if (v <= 0.002 && node) { if (!stopAt) stopAt = ac.currentTime + 2; else if (ac.currentTime > stopAt) { node.stop(); node = null; stopAt = 0; } } else stopAt = 0;
      lv = v;
    },
    get on() { return !!node && lv > 0.002; },
  };
}
function bedOut(wet) { const g = ac.createGain(); out(g, wet); return g; }
// 화음 진행 재생기: chords, 한 화음 길이(초), voice(t, chord, i) 가 화음 하나를 냄. el = 공유 시작점에서 지난 ms (모두가 같은 곳을 듣게)
function chordBed(getChords, sec, voice, wet) {
  return (arg = {}) => {
    const g = bedOut(wet); let t0 = ac.currentTime - (arg.el || 0) / 1000, next = -1, song = arg.song | 0;
    const iv = setInterval(() => {
      const ch = getChords(song), now = ac.currentTime, idx = Math.floor((now + 0.3 - t0) / sec);
      if (idx > next) { next = idx; const st = t0 + idx * sec; voice(Math.max(now, st), ch[((idx % ch.length) + ch.length) % ch.length], idx, g, sec); }
    }, 120);
    return { g, stop() { clearInterval(iv); g.gain.setTargetAtTime(0, ac.currentTime, 0.3); setTimeout(() => g.disconnect(), 1500); },
      arg(a) { if (!a) return; if ((a.song | 0) !== song) { song = a.song | 0; next = -1; } if (a.el != null && Math.abs(ac.currentTime - (t0 + a.el / 1000)) > 1.5) { t0 = ac.currentTime - a.el / 1000; next = -1; } } };
  };
}
function pad(t, notes, dur, g, { type = 'sawtooth', lp = 1000, amp = 0.05, a = 0.6, formants } = {}) { // 천천히 커졌다 줄어드는 화음
  for (const m of notes) for (const det of [-4, 4]) {
    const o = ac.createOscillator(), e = ac.createGain();
    o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f);
    if (formants) { const mix = ac.createGain(); for (const [fq, q] of formants) { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fq; b.Q.value = q; f.connect(b).connect(mix); } mix.connect(e); } else f.connect(e);
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(amp, t + a); e.gain.setValueAtTime(amp, t + dur - 0.2); e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
    e.connect(g); o.start(t); o.stop(t + dur + 1.3);
  }
}
const BEDS = {
  // 사찰 환경음: 바람(낮은 잡음, 천천히 일렁임) + 가끔 풍경 소리
  temple: () => {
    const g = bedOut(0.3), s = ac.createBufferSource(), f = ac.createBiquadFilter(), w = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 420; w.gain.value = 0.05; lfo.frequency.value = 0.07; lg.gain.value = 0.03;
    lfo.connect(lg).connect(w.gain); s.connect(f).connect(w).connect(g); s.start(); lfo.start();
    let nextChime = ac.currentTime + 2;
    const iv = setInterval(() => { if (ac.currentTime > nextChime) { into(g, () => SND.chime(ac.currentTime, 1)); nextChime = ac.currentTime + 6 + Math.random() * 8; } }, 500);
    return { g, stop() { clearInterval(iv); s.stop(); lfo.stop(); g.disconnect(); } };
  },
  // 염불: 낮은 드론(D2·A2) + 목탁 박자(1.1초)에 맞춘 낮은 목소리 음절(D3, 모음 '오' 포먼트)
  chant: () => {
    const g = bedOut(0.45), oscs = [];
    for (const [m, a] of [[38, 0.05], [45, 0.03]]) { const o = ac.createOscillator(), f = ac.createBiquadFilter(), e = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.value = 300; e.gain.value = a; o.connect(f).connect(e).connect(g); o.start(); oscs.push(o); }
    const beat = 1.1; let next = Math.ceil(ac.currentTime / beat) * beat, k = 0;
    const iv = setInterval(() => {
      while (next < ac.currentTime + 0.4) {
        const t = next;
        into(g, () => SND.moktak(t, 0.8));
        const o = ac.createOscillator(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), e = ac.createGain(), mix = ac.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(k % 8 === 7 ? 48 : 50), t); // 대부분 한 음, 마디 끝에서 살짝 내림
        f1.type = f2.type = 'bandpass'; f1.frequency.value = 450; f2.frequency.value = 800; f1.Q.value = f2.Q.value = 6;
        o.connect(f1).connect(mix); o.connect(f2).connect(mix); mix.connect(e).connect(g);
        e.gain.setValueAtTime(0.0001, t + 0.05); e.gain.linearRampToValueAtTime(0.5, t + 0.15); e.gain.setValueAtTime(0.5, t + beat * 0.7); e.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.95);
        o.start(t); o.stop(t + beat);
        next += beat; k++;
      }
    }, 150);
    return { g, stop() { clearInterval(iv); oscs.forEach((o) => o.stop()); g.disconnect(); } };
  },
  // 성가(성당): 오르간(사각파, 부드럽게 거른) + 합창 '아' (포먼트 700·1150Hz), 한 화음 4초 × 16 = 64초 반복
  hymn: chordBed(() => HYMN, 4, (t, c, i, g, sec) => {
    const n = tri(c);
    pad(t, [c[0] - 12, ...n], sec, g, { type: 'square', lp: 1100, amp: 0.018, a: 0.35 });
    pad(t, n.map((m) => m + 12), sec, g, { lp: 2400, amp: 0.05, a: 0.9, formants: [[700, 5], [1150, 6]] });
  }, 0.55),
  // 찬양 반주(교회): 따뜻한 패드 + 베이스 + 박자마다 피아노 분산화음 (한 화음 3초 = 4박)
  praise: chordBed((song) => PRAISE[song] || PRAISE[0], 3, (t, c, i, g, sec) => {
    const n = tri(c);
    pad(t, n, sec, g, { lp: 900, amp: 0.025, a: 0.3 });
    pad(t, [c[0] - 12], sec, g, { type: 'triangle', lp: 400, amp: 0.08, a: 0.05 });
    [0, 1, 2, 1].forEach((k, b) => { const tt = t + b * sec / 4, m = n[k] + 12; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(g); tone(mtof(m), tt, { type: 'triangle', g: 0.07, d: 0.9, dest: lp }); });
  }, 0.3),
};
// ── 불멍 캠프·불꽃놀이 (camp.js 가 거리·밤에 따라 크기를 정해 넘김)
Object.assign(SND, {
  // 불꽃 '펑': 낮게 떨어지는 쿵(90→38Hz) + 넓은 잡음 터짐 + 짧은 높은 '팍'
  boom(t, g) { const o = ac.createOscillator(), e = ac.createGain(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.5); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.55 * g, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(e); out(e, 0.35); o.start(t); o.stop(t + 1);
    noise(t, 0.9, { g: 0.45 * g, type: 'lowpass', f: 420, a: 0.003, wet: 0.4 }); noise(t, 0.18, { g: 0.2 * g, type: 'bandpass', f: 1800, q: 0.7, a: 0.001, wet: 0.3 }); },
  // 쏘아 올리는 휘파람: 사인파 600→2300Hz 0.8초 + 살짝 떨림 + 바람 잡음
  whistle(t, g) { const o = ac.createOscillator(), e = ac.createGain(), v = ac.createOscillator(), vg = ac.createGain(); o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(2300, t + 0.8); v.frequency.value = 22; vg.gain.value = 40; v.connect(vg).connect(o.frequency);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.06 * g, t + 0.08); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.85); o.connect(e); out(e, 0.25); o.start(t); v.start(t); o.stop(t + 0.9); v.stop(t + 0.9); noise(t, 0.8, { g: 0.05 * g, type: 'highpass', f: 3000, a: 0.1, wet: 0.2 }); },
  // 잔 폭죽 타닥: 1.2초 동안 아주 짧은 높은 딸깍 20개
  crackle(t, g) { for (let i = 0; i < 20; i++) noise(t + Math.random() * 1.2, 0.006 + Math.random() * 0.012, { g: (0.08 + Math.random() * 0.2) * g, f: 2600 + Math.random() * 4000, q: 1.5, a: 0.001, wet: 0.2 }); },
});
Object.assign(BEDS, {
  // 모닥불: 낮게 웅웅거리는 불 소리(거른 잡음, 천천히 일렁임) + 불규칙한 짧은 타닥(띠 잡음 딸깍) + 가끔 낮은 '퍽'(장작 터짐)
  fire: () => {
    const g = bedOut(0.15), s = ac.createBufferSource(), f = ac.createBiquadFilter(), w = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 520; w.gain.value = 0.11; lfo.frequency.value = 0.31; lg.gain.value = 0.045;
    lfo.connect(lg).connect(w.gain); s.connect(f).connect(w).connect(g); s.start(); lfo.start();
    const iv = setInterval(() => into(g, () => { const now = ac.currentTime; for (let i = 0; i < 5; i++) if (Math.random() < 0.5) { const t = now + 0.05 + Math.random() * 0.25; noise(t, 0.006 + Math.random() * 0.03, { g: 0.06 + Math.random() * 0.28, f: 1100 + Math.random() * 3800, q: 1.3, a: 0.001, wet: 0 }); }
      if (Math.random() < 0.06) { tone(120 + Math.random() * 90, now + 0.1, { type: 'triangle', g: 0.1, a: 0.002, d: 0.08 }); noise(now + 0.1, 0.12, { g: 0.2, type: 'lowpass', f: 700, a: 0.002 }); } }), 250);
    return { g, stop() { clearInterval(iv); s.stop(); lfo.stop(); g.disconnect(); } };
  },
  // 스파클러 치익: 높은 잡음이 빠르게 떨림
  spark: () => {
    const g = bedOut(0.1), s = ac.createBufferSource(), f = ac.createBiquadFilter(), w = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'highpass'; f.frequency.value = 4200; w.gain.value = 0.05; lfo.type = 'square'; lfo.frequency.value = 13; lg.gain.value = 0.025;
    lfo.connect(lg).connect(w.gain); s.connect(f).connect(w).connect(g); s.start(); lfo.start();
    return { g, stop() { s.stop(); lfo.stop(); g.disconnect(); } };
  },
  // 불꽃 스틱 지글지글: 아주 높은 잡음(6.5kHz 위) + 불규칙한 짧은 '틱' (스파클러 치익보다 가늘고 잘게)
  sizzle: () => {
    const g = bedOut(0.05), s = ac.createBufferSource(), f = ac.createBiquadFilter(), w = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'highpass'; f.frequency.value = 6500; w.gain.value = 0.035; s.connect(f).connect(w).connect(g); s.start();
    const iv = setInterval(() => into(g, () => { const now = ac.currentTime; for (let i = 0; i < 4; i++) if (Math.random() < 0.6) noise(now + Math.random() * 0.1, 0.003 + Math.random() * 0.006, { g: 0.04 + Math.random() * 0.08, f: 5000 + Math.random() * 4000, q: 2, a: 0.0005, wet: 0 }); }), 100);
    return { g, stop() { clearInterval(iv); s.stop(); g.disconnect(); } };
  },
});
// ── 포근 놀이공원 (rides.js 가 거리·운행에 따라 크기를 정해 넘김, 아주 작게)
Object.assign(SND, {
  // 꼬마기차 기적: 부드러운 두 음 '뿌-우' (삼각파 + 살짝 떨림)
  toot(t, g) {
    for (const [f, dt, d] of [[587, 0, 0.42], [740, 0.46, 0.62]]) {
      const o = ac.createOscillator(), e = ac.createGain(), v = ac.createOscillator(), vg = ac.createGain(), s = t + dt;
      o.type = 'triangle'; o.frequency.value = f; v.frequency.value = 6; vg.gain.value = 5; v.connect(vg).connect(o.frequency);
      e.gain.setValueAtTime(0.0001, s); e.gain.exponentialRampToValueAtTime(0.08 * g, s + 0.05); e.gain.setValueAtTime(0.08 * g, s + d - 0.12); e.gain.exponentialRampToValueAtTime(0.0001, s + d);
      o.connect(e); out(e, 0.3); o.start(s); v.start(s); o.stop(s + d + 0.05); v.stop(s + d + 0.05);
    }
  },
});
const WALTZ = [[60, 0], [65, 0], [67, 0], [60, 0], [57, 1], [62, 1], [67, 0], [60, 0]]; // 회전목마 왈츠 (C F G C Am Dm G C), 한 화음 = 3박 2.1초
Object.assign(BEDS, {
  // 회전목마 오르골: 쿵(낮은 근음)-짝-짝 + 맑은 오르골 멜로디 (높은 사인파, 짧게 울림)
  musicbox: chordBed(() => WALTZ, 2.1, (t, c, i, g, sec) => {
    const n = tri(c), b = sec / 3, mel = [[n[2] + 12, n[1] + 24], [n[0] + 24, n[2] + 12], [n[1] + 24, n[0] + 24], [n[2] + 24, n[1] + 12]][i % 4];
    tone(mtof(c[0] - 12), t, { type: 'triangle', g: 0.1, d: 0.7, dest: g });
    for (const k of [1, 2]) for (const m of n) tone(mtof(m), t + k * b, { type: 'triangle', g: 0.025, d: 0.35, dest: g });
    mel.forEach((m, k) => { tone(mtof(m), t + k * b * 1.5, { g: 0.07, a: 0.002, d: 0.9, dest: g }); tone(mtof(m) * 3, t + k * b * 1.5, { g: 0.012, a: 0.002, d: 0.3, dest: g }); });
  }, 0.25),
  // 꼬마기차 칙칙폭폭: 빠르기(rate, 1초에 몇 번)에 맞춰 짧은 증기 잡음
  chug: () => {
    const g = bedOut(0.1); let rate = 0, ph = 0, last = ac.currentTime;
    const iv = setInterval(() => { const now = ac.currentTime; ph += rate * (now - last); last = now; let k = 0; while (ph >= 1 && k++ < 4) { ph -= 1; into(g, () => noise(now + 0.01, 0.08, { g: 0.2, type: 'bandpass', f: 850 + Math.random() * 350, q: 1.2, a: 0.004, wet: 0 })); } if (ph > 1) ph = 0; }, 30);
    return { g, stop() { clearInterval(iv); g.disconnect(); }, arg(a) { if (a) rate = Math.max(0, Math.min(8, a.rate || 0)); } };
  },
});
// ── 놀이공원 2단계 A (드롭타워·롤러코스터·후룸라이드·바이킹, rides.js 가 거리로 크기를 정함)
Object.assign(SND, {
  // 슝: 바람 잡음이 높아지며 지나감 (떨어질 때·내리막)
  whoosh(t, g) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(1500, t + 0.9); f.frequency.exponentialRampToValueAtTime(600, t + 1.8);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.22 * g, t + 0.5); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.9); s.connect(f).connect(e); out(e, 0.15); s.start(t, Math.random()); s.stop(t + 2); },
  // 풍덩: 낮은 물 잡음 터짐 + 물방울 몇 개
  splash(t, g) { noise(t, 0.7, { g: 0.32 * g, type: 'lowpass', f: 900, a: 0.01, wet: 0.2 }); noise(t + 0.05, 0.35, { g: 0.12 * g, type: 'bandpass', f: 2600, q: 0.8, a: 0.005, wet: 0.2 }); for (let i = 0; i < 5; i++) tone(700 + Math.random() * 900, t + 0.15 + Math.random() * 0.5, { g: 0.03 * g, a: 0.002, d: 0.08, f2: 1400, wet: 0.2 }); },
  // 범퍼카 '통!': 말랑한 고무 범퍼가 부딪히는 낮은 퉁 + 짧은 높은 똑 (2단계 B)
  bonk(t, g) { tone(190, t, { type: 'sine', g: 0.32 * g, a: 0.002, d: 0.2, f2: 105, wet: 0.15 }); tone(620, t, { type: 'triangle', g: 0.07 * g, a: 0.001, d: 0.06, f2: 420, wet: 0.1 }); noise(t, 0.05, { g: 0.1 * g, type: 'lowpass', f: 700, a: 0.002, wet: 0.1 }); },
  // 바이킹 끼익: 짧은 낮은 나무 삐걱 (끝에서 방향 바꿀 때)
  creak(t, g) { tone(150, t, { type: 'sawtooth', g: 0.025 * g, a: 0.05, d: 0.35, f2: 115, wet: 0.2 }); },
});
Object.assign(BEDS, {
  // 체인 오르막 딸깍딸깍: rate(1초에 몇 번)에 맞춰 짧은 금속 딸깍
  clack: () => {
    const g = bedOut(0.1); let rate = 0, ph = 0, last = ac.currentTime;
    const iv = setInterval(() => { const now = ac.currentTime; ph += rate * (now - last); last = now; let k = 0; while (ph >= 1 && k++ < 4) { ph -= 1; into(g, () => { tone(1900 + Math.random() * 300, now + 0.01, { type: 'square', g: 0.035, a: 0.001, d: 0.025, wet: 0 }); noise(now + 0.01, 0.015, { g: 0.08, f: 3200, q: 2, a: 0.001, wet: 0 }); }); } if (ph > 1) ph = 0; }, 30);
    return { g, stop() { clearInterval(iv); g.disconnect(); }, arg(a) { if (a) rate = Math.max(0, Math.min(12, a.rate || 0)); } };
  },
});
const beds = Object.fromEntries(Object.keys(BEDS).map((k) => [k, makeBed((arg) => BEDS[k](arg))]));

export const sfx = {
  get on() { return S.on; }, get vol() { return S.vol; }, get ctx() { return ac; },
  set(o) { Object.assign(S, o); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} if (S.on) init(); if (master) master.gain.setTargetAtTime(S.on ? S.vol : 0, ac.currentTime, 0.05); },
  play(name, g = 1, delay = 0) { if (ready() && V(g) > 0.003) SND[name](ac.currentTime + delay, V(g)); },
  piano(n, g = 1) { if (ready() && V(g) > 0.003) piano(n, V(g)); },
  bed: (name, v, arg) => beds[name].level(v, arg),
  get playing() { return Object.keys(beds).filter((k) => beds[k].on); }, // 시험·디버깅용: 지금 흐르는 배경 소리
};
