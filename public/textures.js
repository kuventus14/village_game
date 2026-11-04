// 이미지 파일 없이 캔버스로 그리는 절차적 텍스처들 (반복되는 것은 이음매 없이 감쌈)
import * as THREE from 'three';
import { rng } from './gfx.js';

const cache = new Map();
function make(name, size, draw, { srgb = true, repeat = true } = {}) {
  if (cache.has(name)) return cache.get(name);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  // 가장자리를 넘는 그림은 반대편에도 그려서 타일 이음매가 안 보이게
  const tile = (fn) => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { x.save(); x.translate(ox, oy); fn(); x.restore(); } };
  draw(x, size, tile, rng(name.length * 977 + size));
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(name, t);
  return t;
}
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// 잔디: 짧은 풀잎 획을 잔뜩
export const grassTex = () => make('grass', 512, (x, S, tile, r) => {
  x.fillStyle = '#a9d98a'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { const px = r() * S, py = r() * S, rr = 20 + r() * 60, col = hsl(95 + r() * 25, 45, 60 + r() * 12, 0.18); tile(() => { x.fillStyle = col; x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); }); }
  x.lineCap = 'round';
  for (let i = 0; i < 4200; i++) {
    const px = r() * S, py = r() * S, l = 5 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 0.9, light = r();
    const col = light > 0.55 ? hsl(85 + r() * 20, 55, 72 + r() * 10, 0.75) : hsl(110 + r() * 25, 40, 46 + r() * 10, 0.55);
    const lw = 1.4 + r() * 1.2;
    tile(() => { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); });
  }
});

// 흙길: 모래빛 바탕 + 자잘한 자갈
export const dirtTex = () => make('dirt', 512, (x, S, tile, r) => {
  x.fillStyle = '#efd8ad'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) { const px = r() * S, py = r() * S, rr = 20 + r() * 50, col = hsl(36, 50, 72 + r() * 14, 0.25); tile(() => { x.fillStyle = col; x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); }); }
  for (let i = 0; i < 520; i++) {
    const px = r() * S, py = r() * S, rr = 1.5 + r() * 4.5, l = 62 + r() * 22, h = 25 + r() * 25;
    tile(() => {
      x.fillStyle = hsl(h, 30, l - 14, 0.55); x.beginPath(); x.ellipse(px + 0.8, py + 1.2, rr, rr * 0.75, 0, 0, 7); x.fill();
      x.fillStyle = hsl(h, 28, l); x.beginPath(); x.ellipse(px, py, rr, rr * 0.75, 0, 0, 7); x.fill();
    });
  }
});

// 광장 돌바닥: 둥근 돌을 어긋나게 깔고 줄눈
export const cobbleTex = () => make('cobble', 512, (x, S, tile, r) => {
  x.fillStyle = '#cdb795'; x.fillRect(0, 0, S, S);
  const n = 8, cs = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const px = (i + (j % 2) * 0.5) * cs + (r() - 0.5) * 6, py = (j + 0.5) * cs + (r() - 0.5) * 6, w = cs * (0.42 + r() * 0.05), h = cs * (0.4 + r() * 0.05);
    const pick = r(), base = pick < 0.6 ? [38, 40, 88] : pick < 0.8 ? [20, 45, 86] : pick < 0.92 ? [270, 18, 87] : [45, 25, 80];
    tile(() => {
      x.fillStyle = hsl(base[0], base[1], base[2] - 12); x.beginPath(); x.roundRect(px - w, py - h + 2, w * 2, h * 2, cs * 0.28); x.fill();
      x.fillStyle = hsl(...base); x.beginPath(); x.roundRect(px - w, py - h, w * 2, h * 2 - 2, cs * 0.28); x.fill();
      x.fillStyle = hsl(base[0], base[1], Math.min(97, base[2] + 7), 0.7); x.beginPath(); x.ellipse(px - w * 0.3, py - h * 0.4, w * 0.45, h * 0.28, -0.3, 0, 7); x.fill();
    });
  }
});

// 지붕 기와: 비늘 모양 줄 (흰 바탕, 색은 정점 색으로 입힘)
export const shingleTex = () => make('shingle', 256, (x, S, tile, r) => {
  x.fillStyle = '#d9d2cc'; x.fillRect(0, 0, S, S);
  const rows = 8, cols = 8, rh = S / rows, cw = S / cols;
  for (let j = rows; j >= -1; j--) for (let i = -1; i <= cols; i++) {
    const cx = (i + (j % 2) * 0.5) * cw + cw / 2, cy = j * rh;
    const l = 88 + r() * 10;
    x.fillStyle = hsl(30, 10, l); x.strokeStyle = 'rgba(90,70,70,.35)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx - cw / 2, cy); x.lineTo(cx - cw / 2, cy + rh * 0.55); x.arc(cx, cy + rh * 0.55, cw / 2, Math.PI, 0, true); x.lineTo(cx + cw / 2, cy); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(cx - cw * 0.15, cy + rh * 0.45, cw * 0.18, rh * 0.18, 0, 0, 7); x.fill();
  }
});

// 벽 판자(가로줄): 흰 바탕, 색은 정점 색으로
export const sidingTex = () => make('siding', 256, (x, S, tile, r) => {
  x.fillStyle = '#f4f0ec'; x.fillRect(0, 0, S, S);
  const n = 8, h = S / n;
  for (let j = 0; j < n; j++) {
    const g = x.createLinearGradient(0, j * h, 0, (j + 1) * h);
    g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(0.85, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,100,100,.28)');
    x.fillStyle = g; x.fillRect(0, j * h, S, h);
  }
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(150,130,120,${0.03 + r() * 0.05})`; x.fillRect(r() * S, r() * S, 2 + r() * 20, 1); }
});

// 나무판: 결과 옹이 (밝은 색, 정점 색으로 물들임)
export const woodTex = () => make('wood', 256, (x, S, tile, r) => {
  x.fillStyle = '#f2e2cc'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) { const px = r() * S; x.strokeStyle = `rgba(140,95,60,${0.06 + r() * 0.12})`; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + 6, S * 0.3, px - 6, S * 0.6, px + (r() - 0.5) * 4, S); x.stroke(); }
  for (let i = 0; i < 4; i++) { const px = r() * S, py = r() * S; tile(() => { x.strokeStyle = 'rgba(120,80,50,.25)'; x.lineWidth = 2; x.beginPath(); x.ellipse(px, py, 4, 9, 0, 0, 7); x.stroke(); }); }
  for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(110,70,40,.25)'; x.fillRect(j * S / 4, 0, 2, S); }
});

// 석재 블록 (기단·분수)
export const stoneTex = () => make('stone', 256, (x, S, tile, r) => {
  x.fillStyle = '#b9ab9c'; x.fillRect(0, 0, S, S);
  const rows = 4;
  for (let j = 0; j < rows; j++) {
    let px = (j % 2) * -30;
    while (px < S) {
      const w = 40 + r() * 50, y = j * S / rows, l = 82 + r() * 10;
      x.fillStyle = hsl(30 + r() * 20, 18, l); x.beginPath(); x.roundRect(px + 3, y + 3, w - 6, S / rows - 6, 10); x.fill();
      x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.roundRect(px + 6, y + 5, w - 16, 8, 4); x.fill();
      px += w;
    }
  }
});

// 벽돌 (굴뚝)
export const brickTex = () => make('brick', 128, (x, S, tile, r) => {
  x.fillStyle = '#e8d8cc'; x.fillRect(0, 0, S, S);
  const rows = 8, h = S / rows;
  for (let j = 0; j < rows; j++) for (let i = -1; i < 4; i++) { x.fillStyle = hsl(10 + r() * 15, 45, 55 + r() * 12); x.fillRect(i * S / 4 + (j % 2) * S / 8 + 2, j * h + 2, S / 4 - 4, h - 4); }
});

// 둥글고 부드러운 점 (연기·물보라·반짝이 입자)
export const dotTex = () => make('dot', 64, (x, S) => {
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
}, { repeat: false });

// 동그란 그림자 얼룩 (그림자를 안 드리우는 덤불·먼 나무 밑에 깔아 땅에 붙어 보이게)
export const blobTex = () => make('blob', 64, (x, S) => {
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.55, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
}, { repeat: false });

// 나비 날개 (한쪽 날개, 흰색 무늬 → 인스턴스 색으로 물들임)
export const wingTex = () => make('wing', 64, (x, S) => {
  x.fillStyle = '#ffffff';
  x.beginPath(); x.ellipse(S * 0.5, S * 0.32, S * 0.42, S * 0.3, -0.25, 0, 7); x.fill();
  x.beginPath(); x.ellipse(S * 0.4, S * 0.72, S * 0.3, S * 0.22, 0.4, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(S * 0.55, S * 0.3, S * 0.12, 0, 7); x.fill();
  x.strokeStyle = 'rgba(60,40,60,.6)'; x.lineWidth = 3; x.beginPath(); x.ellipse(S * 0.5, S * 0.32, S * 0.4, S * 0.28, -0.25, 0, 7); x.stroke();
}, { repeat: false });

// 흐르는 물줄기 (분수에서 떨어지는 물 막)
export const streakTex = () => make('streak', 128, (x, S, tile, r) => {
  x.clearRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) { const px = r() * S, w = 1 + r() * 3, a = 0.25 + r() * 0.5; tile(() => { const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.5, `rgba(220,245,255,${a * 0.5})`); g.addColorStop(1, `rgba(255,255,255,${a})`); x.fillStyle = g; x.fillRect(px, 0, w, S); }); }
}, { srgb: true });

// 벚꽃 나무 아래 떨어진 꽃잎 (투명 바탕)
export const petalsTex = () => make('petals', 256, (x, S, tile, r) => {
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.46, px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d;
    x.fillStyle = hsl(345 + r() * 15, 80, 86 + r() * 8, 0.9 - d / S); x.beginPath(); x.ellipse(px, py, 3 + r() * 3, 2 + r() * 2, r() * 3, 0, 7); x.fill();
  }
}, { repeat: false });

// 술래잡기장: 깎은 잔디 줄무늬
export const mowTex = () => make('mow', 256, (x, S, tile, r) => {
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#a3d98c' : '#b4e39a'; x.fillRect(i * S / 4, 0, S / 4, S); }
  x.lineCap = 'round';
  for (let i = 0; i < 1500; i++) { const px = r() * S, py = r() * S, col = r() > 0.5 ? 'rgba(235,255,210,.35)' : 'rgba(70,130,70,.22)', dx = (r() - 0.5) * 3, dy = 4 + r() * 4; tile(() => { x.strokeStyle = col; x.lineWidth = 1.3; x.beginPath(); x.moveTo(px, py); x.lineTo(px + dx, py - dy); x.stroke(); }); }
});

// 피구장: 두 진영 + 흰 선 + 가운데 원 (한 장으로 바닥 전체)
export function courtTex(w, h) {
  return make('court' + w + 'x' + h, 1024, (x, S) => {
    const sx = S / w, sz = S / h;
    const half = (c0, c1, x0) => { const g = x.createLinearGradient(x0, 0, x0 + S / 2, 0); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(x0, 0, S / 2, S); };
    half('#bcdcff', '#d4e8ff', 0); half('#ffd9d6', '#ffc7c2', S / 2);
    x.globalAlpha = 0.08; for (let i = 0; i < 2000; i++) { x.fillStyle = i % 2 ? '#fff' : '#557'; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); } x.globalAlpha = 1;
    x.strokeStyle = '#ffffff'; x.lineWidth = 0.18 * sx;
    x.strokeRect(0.35 * sx, 0.35 * sz, S - 0.7 * sx, S - 0.7 * sz);
    x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.stroke();
    x.beginPath(); x.ellipse(S / 2, S / 2, 1.8 * sx, 1.8 * sz, 0, 0, 7); x.stroke();
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(S / 2 + s * 4 * sx, 0.35 * sz); x.lineTo(S / 2 + s * 4 * sx, S - 0.35 * sz); x.setLineDash([0.5 * sx, 0.4 * sx]); x.stroke(); x.setLineDash([]); }
  }, { repeat: false });
}

/* ───── 건물(카페·회사·카지노) 겉·속 텍스처 ───── */
// 반짝이는 재질(금·크롬·유리)을 조명 없이도 보이게: 구면 하이라이트 매트캡 (흰 바탕 → 정점 색으로 물들임)
export const matcapTex = () => make('matcap', 256, (x, S) => {
  const g = x.createRadialGradient(S * 0.36, S * 0.3, S * 0.02, S * 0.5, S * 0.5, S * 0.52);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, '#f4f0ea'); g.addColorStop(0.55, '#a8a29c'); g.addColorStop(0.85, '#6a6460'); g.addColorStop(1, '#c8c0b8');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(S * 0.68, S * 0.74, S * 0.1, S * 0.05, -0.6, 0, 7); x.fill();
}, { repeat: false });

// 카페 마루: 꿀빛 널판을 어긋나게 + 결
export const parquetTex = () => make('parquet', 512, (x, S, tile, r) => {
  const rows = 8, h = S / rows;
  for (let j = 0; j < rows; j++) {
    let px = -r() * 200;
    while (px < S) {
      const w = 140 + r() * 120, l = 62 + r() * 10, hue = 28 + r() * 8;
      x.fillStyle = hsl(hue, 52, l); x.fillRect(px, j * h, w, h);
      for (let k = 0; k < 6; k++) { x.strokeStyle = hsl(hue, 45, l - 8 - r() * 6, 0.35); x.lineWidth = 1; const yy = j * h + 4 + r() * (h - 8); x.beginPath(); x.moveTo(px, yy); x.bezierCurveTo(px + w * 0.3, yy + 3, px + w * 0.6, yy - 3, px + w, yy + 1); x.stroke(); }
      x.fillStyle = 'rgba(255,240,215,.25)'; x.fillRect(px, j * h + 2, w, 4);
      x.fillStyle = 'rgba(90,50,25,.55)'; x.fillRect(px, j * h, 2, h);
      px += w;
    }
    x.fillStyle = 'rgba(90,50,25,.5)'; x.fillRect(0, j * h, S, 2);
  }
});

// 회사 카펫 타일: 결 방향이 엇갈리는 네모 타일
export const carpetTileTex = () => make('carpetTile', 256, (x, S, tile, r) => {
  const n = 2, c = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    x.fillStyle = (i + j) % 2 ? '#aebdd0' : '#b7c5d6'; x.fillRect(i * c, j * c, c, c);
    for (let k = 0; k < 500; k++) { const px = i * c + r() * c, py = j * c + r() * c, v = (i + j) % 2; x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(60,80,110,.14)'; v ? x.fillRect(px, py, 1.5, 5) : x.fillRect(px, py, 5, 1.5); }
    x.strokeStyle = 'rgba(80,95,120,.35)'; x.lineWidth = 2; x.strokeRect(i * c + 1, j * c + 1, c - 2, c - 2);
  }
});

// 카지노 층별 카펫: 바탕색 + 금빛 마름모 격자 + 꽃 메달
export const casinoCarpetTex = (base, line, dot) => make('cc' + base, 256, (x, S, tile, r) => {
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; x.fillRect(r() * S, r() * S, 2, 2); }
  x.strokeStyle = line; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S / 2, 0); x.lineTo(S, S / 2); x.lineTo(S / 2, S); x.closePath(); x.stroke();
  for (const [px, py] of [[S / 2, S / 2], [0, 0], [S, 0], [0, S], [S, S]]) {
    x.fillStyle = dot; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; x.beginPath(); x.ellipse(px + Math.cos(a) * 18, py + Math.sin(a) * 18, 14, 8, a, 0, 7); x.fill(); }
    x.fillStyle = line; x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill();
  }
  x.fillStyle = dot; for (const [px, py] of [[S / 4, S / 4], [S * 0.75, S / 4], [S / 4, S * 0.75], [S * 0.75, S * 0.75]]) { x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill(); }
});

// 벽지: 연한 세로 줄 + 작은 잎 무늬 (흰 바탕 → 정점 색)
export const wallpaperTex = () => make('wallpaper', 256, (x, S, tile, r) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(220,200,180,.25)' : 'rgba(255,255,255,0)'; x.fillRect(i * S / 8, 0, S / 8, S); }
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const px = i * S / 4 + (j % 2) * S / 8 + S / 16, py = j * S / 4 + S / 8;
    x.fillStyle = 'rgba(200,140,120,.35)'; x.beginPath(); x.ellipse(px - 5, py, 6, 3, -0.6, 0, 7); x.ellipse(px + 5, py, 6, 3, 0.6, 0, 7); x.fill();
    x.fillStyle = 'rgba(230,120,120,.45)'; x.beginPath(); x.arc(px, py - 5, 3.5, 0, 7); x.fill();
  }
});

// 카지노 벽 패널: 다마스크 무늬 (흰 바탕 → 층 색으로 물들임)
export const damaskTex = () => make('damask', 256, (x, S) => {
  x.fillStyle = '#e8e2ea'; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(255,255,255,.55)';
  const motif = (px, py, k) => { x.save(); x.translate(px, py); x.scale(k, k);
    x.beginPath(); x.moveTo(0, -40); x.bezierCurveTo(26, -20, 26, 10, 0, 40); x.bezierCurveTo(-26, 10, -26, -20, 0, -40); x.fill();
    x.beginPath(); x.ellipse(-22, -6, 10, 18, -0.5, 0, 7); x.ellipse(22, -6, 10, 18, 0.5, 0, 7); x.fill(); x.restore(); };
  motif(S / 2, S / 2, 1.2); for (const [px, py] of [[0, 0], [S, 0], [0, S], [S, S]]) motif(px, py, 1.2);
  x.fillStyle = 'rgba(120,100,130,.18)'; for (let i = 0; i < 60; i++) { x.fillRect((i * 37) % S, (i * 71) % S, 2, 2); }
});

// 나무 판넬 벽(웨인스코팅): 세로 판 + 홈
export const wainscotTex = () => make('wainscot', 128, (x, S, tile, r) => {
  x.fillStyle = '#f3e6d4'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2; i++) { x.fillStyle = 'rgba(120,80,50,.22)'; x.fillRect(i * S / 2, 0, 4, S); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(i * S / 2 + 4, 0, 3, S); }
  x.strokeStyle = 'rgba(120,80,50,.25)'; x.lineWidth = 3; for (let i = 0; i < 2; i++) x.strokeRect(i * S / 2 + 14, 16, S / 2 - 28, S - 32);
});

// 바깥 벽 회벽(스투코): 은은한 얼룩 (흰 바탕 → 정점 색)
export const stuccoTex = () => make('stucco', 256, (x, S, tile, r) => {
  x.fillStyle = '#f6f2ee'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) { const px = r() * S, py = r() * S, rr = 6 + r() * 26, col = r() > 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(160,140,130,.07)'; tile(() => { x.fillStyle = col; x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); }); }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(140,120,110,${0.05 + r() * 0.08})`; x.fillRect(r() * S, r() * S, 1.5, 1.5); }
});

// 밤에도 켜진 듯한 창 유리: 위는 밝고 아래로 따뜻해지는 그라데이션 + 대각선 반사 줄
export const windowTex = () => make('window', 128, (x, S) => {
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8d0c8');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(255,255,255,.65)'; x.beginPath(); x.moveTo(S * 0.15, S); x.lineTo(S * 0.45, S); x.lineTo(S, S * 0.35); x.lineTo(S, S * 0.05); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.moveTo(S * 0.55, S); x.lineTo(S * 0.65, S); x.lineTo(S, S * 0.68); x.lineTo(S, S * 0.58); x.closePath(); x.fill();
}, { repeat: false });

// 줄무늬 차양: 세로 줄 + 아래 물결 테두리(투명)
export const awningTex = (a, b) => make('awning' + a + b, 256, (x, S) => {
  x.clearRect(0, 0, S, S);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * S / 8, 0, S / 8, S * 0.82); x.beginPath(); x.arc(i * S / 8 + S / 16, S * 0.82, S / 16, 0, Math.PI); x.fill(); }
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)');
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, S, S); x.globalCompositeOperation = 'source-over';
}, { repeat: false });

// 펠트: 고운 털 얼룩 (흰 바탕 → 초록 정점 색)
export const feltTex = () => make('felt', 256, (x, S, tile, r) => {
  x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.07)'; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
});

// 그림·간판·메뉴판을 한 장에: cells[i](ctx, w, h) 를 n×n 칸에 그림(옆 칸까지 넓게 그려도 됨). uv(i, 폭칸, 높이칸) → [u0,v0,u1,v1]
export function atlas(name, n, px, cells) {
  const tex = make(name, n * px, (x) => cells.forEach((fn, i) => { x.save(); x.translate((i % n) * px, Math.floor(i / n) * px); fn(x, px, px); x.restore(); }), { repeat: false });
  return { tex, uv: (i, fw = 1, fh = 1) => { const c = i % n, r = Math.floor(i / n); return [c / n, 1 - (r + fh) / n, (c + fw) / n, 1 - r / n]; } };
}
